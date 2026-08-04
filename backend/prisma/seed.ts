import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import {
  PrismaClient,
  RegistrationStatus,
  UserRole,
  UserStatus,
  EventStatus,
  BracketStatus,
  MatchRound,
  MatchStatus,
  MatchResultType,
  MatchSide,
  ScoreAction,
  ScheduleItemStatus,
  ScoringMode,
  SlotEventAction,
  OpponentRequestStatus,
} from '../src/generated/prisma/client';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

if (process.env.NODE_ENV === 'production' || process.env.ALLOW_DEVELOPMENT_SEED !== 'true') {
  throw new Error(
    'Refusing to run mock seed data. Set ALLOW_DEVELOPMENT_SEED=true outside production for local/demo databases.',
  );
}

const seedPassword = 'Password123!';

// -------------------------------------------------------------------------
// Small utilities
// -------------------------------------------------------------------------

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function atHour(base: Date, hour: number, minute = 0) {
  const d = new Date(base);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function daysFromNow(days: number, hour = 18) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date;
}

let commandCounter = 0;
function nextCommandId(prefix: string) {
  commandCounter += 1;
  return `${prefix}_cmd_${commandCounter.toString().padStart(5, '0')}`;
}

// -------------------------------------------------------------------------
// Single-elimination bracket maths
// -------------------------------------------------------------------------

const ROUNDS_BY_SIZE: Record<number, MatchRound[]> = {
  2: [MatchRound.FINAL],
  4: [MatchRound.SEMIFINAL, MatchRound.FINAL],
  8: [MatchRound.QUARTERFINAL, MatchRound.SEMIFINAL, MatchRound.FINAL],
  16: [MatchRound.ROUND_OF_16, MatchRound.QUARTERFINAL, MatchRound.SEMIFINAL, MatchRound.FINAL],
};

function bracketSizeFor(teamCount: number): 2 | 4 | 8 | 16 {
  if (teamCount <= 2) return 2;
  if (teamCount <= 4) return 4;
  if (teamCount <= 8) return 8;
  return 16;
}

// Classic seeding order so byes fall against the top seeds and never meet.
function seedSlots(size: number): number[] {
  let slots = [1, 2];
  while (slots.length < size) {
    const sum = slots.length * 2 + 1;
    const next: number[] = [];
    for (const s of slots) {
      next.push(s);
      next.push(sum - s);
    }
    slots = next;
  }
  return slots;
}

// Increment-by-increment score history that ends at (a, b).
function scoreSequence(a: number, b: number) {
  const seq: {
    side: MatchSide;
    aBefore: number;
    aAfter: number;
    bBefore: number;
    bAfter: number;
  }[] = [];
  let ca = 0;
  let cb = 0;
  while (ca < a || cb < b) {
    const takeB = cb < b && (ca >= a || (ca + cb) % 2 === 1);
    if (takeB) {
      seq.push({ side: MatchSide.B, aBefore: ca, aAfter: ca, bBefore: cb, bAfter: cb + 1 });
      cb += 1;
    } else {
      seq.push({ side: MatchSide.A, aBefore: ca, aAfter: ca + 1, bBefore: cb, bAfter: cb });
      ca += 1;
    }
  }
  return seq;
}

// -------------------------------------------------------------------------
// Types used while assembling the fixture in memory
// -------------------------------------------------------------------------

type Team = {
  regId: string;
  clubId: string;
  clubName: string;
  ownerId: string;
  ownerName: string;
  teammateId: string;
  teammateName: string;
};

type BuiltMatch = {
  id: string;
  bracketId: string;
  round: MatchRound;
  roundPosition: number;
  matchNumber: number;
  participantAEntryId: string | null;
  participantBEntryId: string | null;
  scoreA: number;
  scoreB: number;
  winnerEntryId: string | null;
  loserEntryId: string | null;
  nextMatchId: string | null;
  nextMatchSlot: MatchSide | null;
  status: MatchStatus;
  resultType: MatchResultType | null;
  resultReason: string | null;
  version: number;
  startedAt: Date | null;
  completedAt: Date | null;
  scoringMode: ScoringMode;
  slotCount: number | null;
  // helper-only fields (not persisted directly):
  judgeUserId: string | null;
  emitScoreEvents: boolean;
  slots: { slotNumber: number; winnerSide: MatchSide }[];
};

/** Slot wins a round races to, so the fixtures show the per-round format in use. */
function slotCountForRound(round: MatchRound) {
  if (round === MatchRound.FINAL) return 3;
  if (round === MatchRound.SEMIFINAL) return 2;
  return 1;
}

/**
 * A plausible slot sequence in which `winnerSide` reaches `slotCount` wins last, taking
 * `loserSlots` along the way.
 */
function slotSequence(winnerSide: MatchSide, slotCount: number, loserSlots: number) {
  const loserSide = winnerSide === MatchSide.A ? MatchSide.B : MatchSide.A;
  const sides = [
    ...Array.from({ length: slotCount - 1 }, () => winnerSide),
    ...Array.from({ length: Math.min(loserSlots, slotCount - 1) }, () => loserSide),
    winnerSide,
  ];
  return sides.map((side, index) => ({ slotNumber: index + 1, winnerSide: side }));
}

// -------------------------------------------------------------------------
// Prisma upsert helpers
// -------------------------------------------------------------------------

async function upsertUser(opts: {
  email: string;
  name?: string;
  surname?: string;
  role?: UserRole;
  status?: UserStatus;
}) {
  const { email, name, surname, role = UserRole.USER, status = UserStatus.ACTIVE } = opts;
  const passwordHash = status === UserStatus.INVITED ? null : await bcrypt.hash(seedPassword, 12);
  return prisma.user.upsert({
    where: { email },
    update: {
      name,
      surname,
      role,
      status,
      passwordHash,
      emailVerifiedAt: status === UserStatus.ACTIVE ? new Date() : null,
      matchesPlayed: 0,
      wins: 0,
      losses: 0,
    },
    create: {
      email,
      name,
      surname,
      role,
      status,
      passwordHash,
      emailVerifiedAt: status === UserStatus.ACTIVE ? new Date() : null,
      matchesPlayed: 0,
      wins: 0,
      losses: 0,
    },
  });
}

// -------------------------------------------------------------------------
// Main
// -------------------------------------------------------------------------

const FIRST_NAMES = [
  'Nika', 'Giorgi', 'Luka', 'Saba', 'Data', 'Beka', 'Irakli', 'Levan',
  'Zurab', 'Vato', 'Rezo', 'Sandro', 'Ana', 'Mariam', 'Salome', 'Nino',
  'Tamar', 'Elene', 'Keti', 'Lika', 'Mari', 'Sopo', 'Nia', 'Teona',
  'Gvantsa', 'Barbare', ' Toma', 'Aleko', 'Temo', 'Guram', 'Otar', 'Vaja',
  'Dachi', 'Ilia', 'Nodar', 'Zaza', 'Tornike', 'Shota', 'Vakho', 'Lasha',
];

const LAST_NAMES = [
  'Beridze', 'Kapanadze', 'Lomidze', 'Gelashvili', 'Tskitishvili', 'Mamaladze',
  'Dvali', 'Chkheidze', 'Bolkvadze', 'Kvirkvelia', 'Nadiradze', 'Tsereteli',
  'Abashidze', 'Gogoladze', 'Kiknadze', 'Jorbenadze', 'Maisuradze', 'Peradze',
  'Chikovani', 'Sturua', 'Gabelia', 'Tabatadze', 'Zurabishvili', 'Kobakhidze',
];

const CLUB_NAMES = [
  'Aurum Padel Club', 'Velvet Court Team', 'Vake Smash Club', 'Lisi Lake Padel',
  'Saburtalo Slice', 'Old Town Rally', 'Mtatsminda Volley', 'Digomi Drop Shot',
  'Kus Tba Padel', 'Rustavi Racket Club', 'Batumi Bandeja', 'Gldani Glass Court',
  'Isani Ace Team', 'Nadzaladevi Net', 'Krtsanisi Court Kings', 'Chugureti Chip',
  'Ortachala Overhead', 'Didube Deuce Club',
];

async function main() {
  // ---- Staff --------------------------------------------------------------
  const admin = await upsertUser({
    email: 'admin@example.com',
    name: 'Ana',
    surname: 'Matadori',
    role: UserRole.ADMIN,
  });

  const judges: { id: string; name: string }[] = [];
  for (let i = 0; i < 5; i += 1) {
    const j = await upsertUser({
      email: `judge${i + 1}@example.com`,
      name: `Judge ${i + 1}`,
      surname: LAST_NAMES[(i + 3) % LAST_NAMES.length],
      role: UserRole.JUDGE,
    });
    judges.push({ id: j.id, name: `${j.name} ${j.surname}` });
  }

  const organiser = await upsertUser({
    email: 'organiser@example.com',
    name: 'Nino',
    surname: 'Organizatori',
    role: UserRole.ORGANISER,
  });

  const lukaInvited = await upsertUser({
    email: 'luka.invited@example.com',
    name: 'Luka',
    surname: 'Invited',
    status: UserStatus.INVITED,
  });

  // ---- Categories: A, B, C, B + C ----------------------------------------
  const categoryDefs = [
    { name: 'A', description: 'Top competitive tier — experienced tournament teams.' },
    { name: 'B', description: 'Strong club-level teams.' },
    { name: 'C', description: 'Developing and newer competitive teams.' },
    { name: 'B + C', description: 'Combined B and C tier for mixed-strength draws.' },
  ];
  const categories = await Promise.all(
    categoryDefs.map((c) =>
      prisma.category.upsert({
        where: { name: c.name },
        update: { description: c.description, createdById: admin.id },
        create: { ...c, createdById: admin.id },
      }),
    ),
  );
  const catByName = new Map(categories.map((c) => [c.name, c]));
  const catId = (name: string) => catByName.get(name)!.id;

  // Remove any legacy categories from earlier seed runs so only A/B/C/B+C remain.
  await prisma.category.deleteMany({
    where: { name: { notIn: categoryDefs.map((c) => c.name) } },
  });

  // ---- Club + athlete pool -----------------------------------------------
  // Each club fields exactly one two-player team (owner + teammate). Clubs are
  // reused across DIFFERENT events, never twice inside the same event.
  const teamPool: Team[] = [];
  for (let i = 0; i < CLUB_NAMES.length; i += 1) {
    const slug = `seed-club-${(i + 1).toString().padStart(2, '0')}`;
    const club = await prisma.club.upsert({
      where: { slug },
      update: { name: CLUB_NAMES[i] },
      create: {
        name: CLUB_NAMES[i],
        slug,
        description: `${CLUB_NAMES[i]} — competitive doubles club based in Georgia.`,
      },
    });

    const owner = await upsertUser({
      email: `athlete${(i * 2 + 1).toString().padStart(3, '0')}@example.com`,
      name: FIRST_NAMES[(i * 2) % FIRST_NAMES.length].trim(),
      surname: LAST_NAMES[i % LAST_NAMES.length],
    });
    const teammate = await upsertUser({
      email: `athlete${(i * 2 + 2).toString().padStart(3, '0')}@example.com`,
      name: FIRST_NAMES[(i * 2 + 1) % FIRST_NAMES.length].trim(),
      surname: LAST_NAMES[(i + 7) % LAST_NAMES.length],
    });

    await prisma.clubMember.upsert({
      where: { userId: owner.id },
      update: { clubId: club.id, roleTitle: 'Captain' },
      create: { clubId: club.id, userId: owner.id, roleTitle: 'Captain' },
    });
    await prisma.clubMember.upsert({
      where: { userId: teammate.id },
      update: { clubId: club.id, roleTitle: 'Doubles player' },
      create: { clubId: club.id, userId: teammate.id, roleTitle: 'Doubles player' },
    });

    teamPool.push({
      regId: '', // assigned per registration
      clubId: club.id,
      clubName: club.name,
      ownerId: owner.id,
      ownerName: `${owner.name} ${owner.surname}`,
      teammateId: teammate.id,
      teammateName: `${teammate.name} ${teammate.surname}`,
    });
  }

  // Per-event club allocator (guarantees distinct clubs + distinct users/event).
  const usedClubsByEvent = new Map<string, Set<string>>();
  function takeTeams(eventId: string, count: number): Team[] {
    const used = usedClubsByEvent.get(eventId) ?? new Set<string>();
    usedClubsByEvent.set(eventId, used);
    const picked: Team[] = [];
    for (const team of teamPool) {
      if (picked.length >= count) break;
      if (used.has(team.clubId)) continue;
      used.add(team.clubId);
      picked.push({ ...team });
    }
    if (picked.length < count) {
      throw new Error(`Team pool exhausted for event ${eventId}: need ${count}, have ${picked.length}`);
    }
    return picked;
  }

  // ---- Idempotent teardown of prior seed events --------------------------
  const seedEventIds = [
    'seed_event_spring_championship',
    'seed_event_summer_slam_live',
    'seed_event_autumn_cup',
    'seed_event_winter_open',
    'seed_event_preseason_draft',
    'seed_event_valley_classic',
  ];

  // Delete in dependency order (matches reference registrations with RESTRICT).
  await prisma.scoreEvent.deleteMany({ where: { match: { bracket: { eventId: { in: seedEventIds } } } } });
  await prisma.slotEvent.deleteMany({ where: { match: { bracket: { eventId: { in: seedEventIds } } } } });
  await prisma.matchSlot.deleteMany({ where: { match: { bracket: { eventId: { in: seedEventIds } } } } });
  await prisma.bracketRoundConfig.deleteMany({ where: { bracket: { eventId: { in: seedEventIds } } } });
  await prisma.matchParticipantSnapshot.deleteMany({ where: { match: { bracket: { eventId: { in: seedEventIds } } } } });
  await prisma.scheduleItem.deleteMany({ where: { match: { bracket: { eventId: { in: seedEventIds } } } } });
  await prisma.match.deleteMany({ where: { bracket: { eventId: { in: seedEventIds } } } });
  await prisma.bracket.deleteMany({ where: { eventId: { in: seedEventIds } } });
  await prisma.eventOrganiser.deleteMany({ where: { eventId: { in: seedEventIds } } });
  await prisma.eventJudge.deleteMany({ where: { eventId: { in: seedEventIds } } });
  await prisma.courtJudgeAssignment.deleteMany({ where: { court: { eventId: { in: seedEventIds } } } });
  await prisma.court.deleteMany({ where: { eventId: { in: seedEventIds } } });
  await prisma.opponentRequest.deleteMany({ where: { eventId: { in: seedEventIds } } });
  await prisma.registrationStatusHistory.deleteMany({ where: { registration: { eventId: { in: seedEventIds } } } });
  await prisma.eventRegistration.deleteMany({ where: { eventId: { in: seedEventIds } } });
  await prisma.eventStatusHistory.deleteMany({ where: { eventId: { in: seedEventIds } } });
  await prisma.eventCategory.deleteMany({ where: { eventId: { in: seedEventIds } } });
  await prisma.event.deleteMany({ where: { id: { in: seedEventIds } } });

  // Running tallies applied to User rows at the end.
  const teamById = new Map<string, Team>();
  const winTally = new Map<string, number>();
  const lossTally = new Map<string, number>();
  const playedTally = new Map<string, number>();
  const bump = (map: Map<string, number>, key: string) => map.set(key, (map.get(key) ?? 0) + 1);
  function recordResult(winner: Team, loser: Team) {
    for (const id of [winner.ownerId, winner.teammateId]) {
      bump(winTally, id);
      bump(playedTally, id);
    }
    for (const id of [loser.ownerId, loser.teammateId]) {
      bump(lossTally, id);
      bump(playedTally, id);
    }
  }

  // Accumulators for batched inserts.
  const registrationRows: any[] = [];
  const bracketRows: any[] = [];
  const matchRows: BuiltMatch[] = [];
  const snapshotRows: any[] = [];
  const courtRows: any[] = [];
  const judgeAssignmentRows: any[] = [];
  const scheduleRows: any[] = [];
  const scoreEventRows: any[] = [];
  const matchSlotRows: any[] = [];
  const slotEventRows: any[] = [];
  const roundConfigRows: any[] = [];
  const opponentRequestRows: any[] = [];

  // ---- Registration factory ----------------------------------------------
  let regCounter = 0;
  function addRegistration(params: {
    eventId: string;
    categoryId: string;
    team: Team;
    status: RegistrationStatus;
    declineReason?: string;
    publicStatusReason?: string;
    withdrawnAt?: Date | null;
    reviewed?: boolean;
    reviewedAt?: Date | null;
  }): Team {
    regCounter += 1;
    const regId = `seed_reg_${regCounter.toString().padStart(4, '0')}`;
    const team = { ...params.team, regId };
    teamById.set(regId, team);
    registrationRows.push({
      id: regId,
      clubId: team.clubId,
      eventId: params.eventId,
      categoryId: params.categoryId,
      ownerId: team.ownerId,
      teammateId: team.teammateId,
      teammateEmail: `athlete-teammate-${regCounter}@example.com`,
      ownerPhone: `+995 555 ${(100 + regCounter).toString().slice(-3)} ${(200 + regCounter).toString().slice(-3)}`,
      teammatePhone: `+995 555 ${(300 + regCounter).toString().slice(-3)} ${(400 + regCounter).toString().slice(-3)}`,
      status: params.status,
      declineReason: params.declineReason ?? null,
      publicStatusReason: params.publicStatusReason ?? null,
      withdrawnAt: params.withdrawnAt ?? null,
      reviewedById: params.reviewed ? admin.id : null,
      reviewedAt: params.reviewed ? (params.reviewedAt ?? new Date()) : null,
    });
    return team;
  }

  // ---- Bracket builder ----------------------------------------------------
  // completeThroughRound: index (0-based) of the last fully-decided round.
  //   -1  = draft (round-1 seeded, byes resolved, no played results)
  //   len-1 = fully completed tournament
  // frontierInProgress: if true, one match in the first undecided round is IN_PROGRESS.
  function buildBracket(params: {
    eventKey: string;
    categoryKey: string;
    categoryId: string;
    eventId: string;
    teams: Team[];
    status: BracketStatus;
    completeThroughRound: number;
    frontierInProgress?: boolean;
    lockedById?: string;
    publishedById?: string;
    scheduled?: boolean;
    liveScoring?: boolean;
    courtId?: string;
    judgePool?: { id: string; name: string }[];
    baseDate: Date;
    specialResults?: Record<string, { resultType: MatchResultType; reason: string }>;
  }) {
    const {
      eventKey, categoryKey, categoryId, eventId, teams, status,
      completeThroughRound, frontierInProgress, lockedById, publishedById,
      scheduled, liveScoring, courtId, judgePool, baseDate, specialResults = {},
    } = params;

    const size = bracketSizeFor(teams.length);
    const rounds = ROUNDS_BY_SIZE[size];
    const isDraft = completeThroughRound < 0;
    const bracketId = `seed_brk_${eventKey}_${categoryKey}`;

    bracketRows.push({
      id: bracketId,
      eventId,
      categoryId,
      size,
      status,
      generation: 1,
      version: 1,
      lockedAt: status === BracketStatus.DRAFT ? null : atHour(baseDate, 8),
      lockedById: status === BracketStatus.DRAFT ? null : (lockedById ?? admin.id),
      publishedAt: publishedById ? atHour(baseDate, 9) : null,
      publishedById: publishedById ?? null,
      completedAt: status === BracketStatus.COMPLETED ? atHour(baseDate, 20) : null,
    });

    // Per-round slot defaults matching the format the fixtures were scored with.
    for (const round of ROUNDS_BY_SIZE[size]) {
      roundConfigRows.push({ bracketId, round, slotCount: slotCountForRound(round) });
    }

    const slots = seedSlots(size);
    const teamForSeed = (seed: number): Team | null => (seed <= teams.length ? teams[seed - 1] : null);

    // matrix[round][position] holds the built match; positions are 1-based.
    const matrix: BuiltMatch[][] = rounds.map((round, rIdx) => {
      const count = size / 2 ** (rIdx + 1);
      return Array.from({ length: count }, (_, pIdx) => ({
        id: `seed_m_${eventKey}_${categoryKey}_r${rIdx}_p${pIdx + 1}`,
        bracketId,
        round,
        roundPosition: pIdx + 1,
        matchNumber: 0,
        participantAEntryId: null,
        participantBEntryId: null,
        scoreA: 0,
        scoreB: 0,
        winnerEntryId: null,
        loserEntryId: null,
        nextMatchId: null,
        nextMatchSlot: null,
        status: MatchStatus.PENDING,
        resultType: null,
        resultReason: null,
        version: 0,
        startedAt: null,
        completedAt: null,
        scoringMode: ScoringMode.SLOTS,
        slotCount: null,
        judgeUserId: null,
        emitScoreEvents: false,
        slots: [],
      }));
    });

    // Wire progression (nextMatch pointer + slot) and assign match numbers.
    let matchNumber = 0;
    for (let rIdx = 0; rIdx < matrix.length; rIdx += 1) {
      for (let pIdx = 0; pIdx < matrix[rIdx].length; pIdx += 1) {
        matchNumber += 1;
        const m = matrix[rIdx][pIdx];
        m.matchNumber = matchNumber;
        if (rIdx < matrix.length - 1) {
          const nextPos = Math.floor(pIdx / 2);
          m.nextMatchId = matrix[rIdx + 1][nextPos].id;
          m.nextMatchSlot = pIdx % 2 === 0 ? MatchSide.A : MatchSide.B;
        }
      }
    }

    // Seed round 0 participants.
    for (let pIdx = 0; pIdx < matrix[0].length; pIdx += 1) {
      const a = teamForSeed(slots[pIdx * 2]);
      const b = teamForSeed(slots[pIdx * 2 + 1]);
      matrix[0][pIdx].participantAEntryId = a?.regId ?? null;
      matrix[0][pIdx].participantBEntryId = b?.regId ?? null;
    }

    const promote = (m: BuiltMatch, winnerRegId: string) => {
      if (!m.nextMatchId || !m.nextMatchSlot) return;
      const [rIdx, pIdx] = m.nextMatchId
        .replace(`seed_m_${eventKey}_${categoryKey}_r`, '')
        .split('_p')
        .map((s, i) => (i === 0 ? Number(s) : Number(s) - 1));
      const next = matrix[rIdx][pIdx];
      if (m.nextMatchSlot === MatchSide.A) next.participantAEntryId = winnerRegId;
      else next.participantBEntryId = winnerRegId;
    };

    let scheduleQueue = 0;
    // Resolve each round in order.
    for (let rIdx = 0; rIdx < matrix.length; rIdx += 1) {
      let frontierUsed = false;
      for (const m of matrix[rIdx]) {
        const a = m.participantAEntryId;
        const b = m.participantBEntryId;
        const special = specialResults[`${rIdx}:${m.roundPosition}`];

        // Bye — first round only. An empty first-round slot is a real bye from
        // an odd draw; an empty slot in a later round just means the feeding
        // match has not been played yet, so it stays PENDING.
        if (rIdx === 0 && ((a && !b) || (b && !a))) {
          const winner = (a ?? b)!;
          m.winnerEntryId = winner;
          m.loserEntryId = null;
          m.status = MatchStatus.COMPLETED;
          m.resultType = MatchResultType.BYE;
          m.completedAt = atHour(baseDate, 10);
          promote(m, winner);
          continue;
        }
        if (!a || !b) {
          // Not both present yet — leave PENDING.
          continue;
        }

        const decided = rIdx <= completeThroughRound;
        const teamA = teamById.get(a)!;
        const teamB = teamById.get(b)!;
        // Deterministic winner: side A wins on even (round+position), else B.
        const aWins = (rIdx + m.roundPosition) % 2 === 0;
        const winnerTeam = aWins ? teamA : teamB;
        const loserTeam = aWins ? teamB : teamA;

        if (decided) {
          const loserPoints = [3, 4, 2, 5, 1, 4, 2][(rIdx + m.roundPosition) % 7];
          m.status = MatchStatus.COMPLETED;
          m.startedAt = atHour(baseDate, 11 + rIdx);
          m.completedAt = atHour(baseDate, 11 + rIdx, 40);
          m.winnerEntryId = winnerTeam.regId;
          m.loserEntryId = loserTeam.regId;
          if (special) {
            // Walkover / disqualification / admin decision keep the tree valid;
            // the winner still advances, result recorded by type (0–0 on court).
            m.resultType = special.resultType;
            m.resultReason = special.reason;
            m.scoreA = 0;
            m.scoreB = 0;
          } else {
            m.resultType = MatchResultType.NORMAL;
            const slotCount = slotCountForRound(m.round);
            const loserSlots = Math.min(loserPoints % slotCount, slotCount - 1);
            m.slotCount = slotCount;
            m.slots = slotSequence(aWins ? MatchSide.A : MatchSide.B, slotCount, loserSlots);
            m.scoreA = m.slots.filter((slot) => slot.winnerSide === MatchSide.A).length;
            m.scoreB = m.slots.filter((slot) => slot.winnerSide === MatchSide.B).length;
            if (liveScoring && judgePool && judgePool.length) {
              m.judgeUserId = judgePool[m.matchNumber % judgePool.length].id;
              m.emitScoreEvents = true;
            }
          }
          m.version = m.slots.length + 1;
          recordResult(winnerTeam, loserTeam);
          promote(m, winnerTeam.regId);
        } else if (isDraft) {
          // Draft bracket: real matches are seeded but not yet playable.
          m.status = MatchStatus.PENDING;
        } else if (!frontierUsed) {
          // First undecided round of a live bracket: expose live/ready state.
          frontierUsed = true;
          if (frontierInProgress) {
            m.status = MatchStatus.IN_PROGRESS;
            m.startedAt = atHour(baseDate, 15);
            m.slotCount = 2;
            m.slots = [{ slotNumber: 1, winnerSide: MatchSide.A }];
            m.scoreA = 1;
            m.scoreB = 0;
            m.version = 2;
            if (judgePool && judgePool.length) {
              m.judgeUserId = judgePool[0].id;
              m.emitScoreEvents = true;
            }
          } else {
            m.status = MatchStatus.READY;
          }
        } else {
          m.status = MatchStatus.READY;
        }
      }
    }

    // Persist rows + snapshots + schedule + score events.
    for (const rowSet of matrix) {
      for (const m of rowSet) {
        matchRows.push(m);

        // Snapshots capture identity for locked/completed brackets.
        if (status !== BracketStatus.DRAFT) {
          for (const [side, regId] of [
            [MatchSide.A, m.participantAEntryId],
            [MatchSide.B, m.participantBEntryId],
          ] as const) {
            if (!regId) continue;
            const t = teamById.get(regId)!;
            snapshotRows.push({
              matchId: m.id,
              side,
              entryId: regId,
              ownerUserId: t.ownerId,
              ownerName: t.ownerName,
              teammateUserId: t.teammateId,
              teammateName: t.teammateName,
              clubId: t.clubId,
              clubName: t.clubName,
            });
          }
        }

        // Schedule items (only for scheduled events, real two-sided matches).
        if (scheduled && courtId && m.participantAEntryId && m.participantBEntryId && m.resultType !== MatchResultType.BYE) {
          scheduleQueue += 1;
          const scheduleStatus =
            m.status === MatchStatus.COMPLETED
              ? ScheduleItemStatus.COMPLETED
              : m.status === MatchStatus.IN_PROGRESS
                ? ScheduleItemStatus.IN_PROGRESS
                : m.status === MatchStatus.READY
                  ? ScheduleItemStatus.READY
                  : ScheduleItemStatus.TENTATIVE;
          scheduleRows.push({
            matchId: m.id,
            courtId,
            assignedJudgeId: m.judgeUserId ?? (judgePool && judgePool.length ? judgePool[scheduleQueue % judgePool.length].id : null),
            queuePosition: scheduleQueue,
            plannedStartAt: atHour(baseDate, 11 + scheduleQueue),
            plannedEndAt: atHour(baseDate, 11 + scheduleQueue, 45),
            status: scheduleStatus,
          });
        }

        // Decided slots plus their append-only history, for matches a judge scored.
        if (m.slots.length && m.judgeUserId) {
          let slotsA = 0;
          let slotsB = 0;
          for (const slot of m.slots) {
            const winnerEntryId = (slot.winnerSide === MatchSide.A ? m.participantAEntryId : m.participantBEntryId)!;
            matchSlotRows.push({
              matchId: m.id,
              slotNumber: slot.slotNumber,
              winnerSide: slot.winnerSide,
              winnerEntryId,
              decidedById: m.judgeUserId,
            });
            const before = { a: slotsA, b: slotsB };
            if (slot.winnerSide === MatchSide.A) slotsA += 1; else slotsB += 1;
            slotEventRows.push({
              matchId: m.id,
              actorId: m.judgeUserId,
              action: SlotEventAction.DECIDED,
              slotNumber: slot.slotNumber,
              winnerSide: slot.winnerSide,
              winnerEntryId,
              slotsABefore: before.a,
              slotsBBefore: before.b,
              slotsAAfter: slotsA,
              slotsBAfter: slotsB,
              matchVersion: slot.slotNumber + 1,
              commandId: nextCommandId('slot'),
            });
          }
        }
      }
    }

    return { bracketId, size };
  }

  // =========================================================================
  // EVENT 1 — COMPLETED championship (full progression, results published)
  // =========================================================================
  {
    const eventId = 'seed_event_spring_championship';
    const eventKey = 'spring';
    const eventDate = daysFromNow(-30, 18);
    await prisma.event.create({
      data: {
        id: eventId,
        title: 'El Padel Spring Championship',
        date: eventDate,
        location: 'KUS TBA Padel Courts',
        arrivalTime: atHour(eventDate, 16),
        participationFee: 300,
        bankAccountIban: 'GE29NB0000000101904917',
        bankAccountReceiver: 'El Padel Georgia',
        description: 'A completed flagship championship with full brackets, judged matches and published results.',
        isPublished: true,
        status: EventStatus.COMPLETED,
        timeZone: 'Asia/Tbilisi',
        registrationClosedAt: daysFromNow(-40, 12),
        registrationRosterPublishedAt: daysFromNow(-39, 12),
        startedAt: atHour(eventDate, 10),
        completedAt: atHour(eventDate, 21),
        schedulePublishedAt: daysFromNow(-33, 12),
        publicLiveScoringEnabled: true,
        resultsPublishedAt: atHour(eventDate, 22),
        createdById: admin.id,
      },
    });
    await prisma.eventCategory.createMany({
      data: [catId('A'), catId('B')].map((categoryId) => ({ eventId, categoryId })),
    });

    const court1 = { id: `seed_court_${eventKey}_1`, eventId, name: 'Center Court', active: true };
    const court2 = { id: `seed_court_${eventKey}_2`, eventId, name: 'Court 2', active: true };
    courtRows.push(court1, court2);
    // A judge may not hold two overlapping active assignments, so each court
    // gets a disjoint set of judges.
    const court1Judges = judges.slice(0, 2);
    const court2Judges = judges.slice(2, 4);
    for (const [court, courtJudges] of [[court1, court1Judges], [court2, court2Judges]] as const) {
      for (const judge of courtJudges) {
        judgeAssignmentRows.push({
          courtId: court.id,
          judgeUserId: judge.id,
          startsAt: atHour(eventDate, 9),
          endsAt: atHour(eventDate, 22),
          assignedById: admin.id,
        });
      }
    }

    // Category A — 6 teams in an 8-slot bracket (two byes), fully played,
    // with a walkover, a disqualification and an admin decision mixed in.
    const teamsA = takeTeams(eventId, 6).map((t) =>
      addRegistration({ eventId, categoryId: catId('A'), team: t, status: RegistrationStatus.APPROVED, reviewed: true, reviewedAt: daysFromNow(-40, 10) }),
    );
    buildBracket({
      eventKey, categoryKey: 'A', categoryId: catId('A'), eventId, teams: teamsA,
      status: BracketStatus.COMPLETED, completeThroughRound: 2, lockedById: admin.id, publishedById: admin.id,
      scheduled: true, liveScoring: true, courtId: court1.id, judgePool: court1Judges, baseDate: eventDate,
      // Positions 1 and 3 of round 0 are byes (6 teams in an 8-slot draw), so
      // the special results target the real matches at positions 2 and 4.
      specialResults: {
        '0:2': { resultType: MatchResultType.WALKOVER, reason: 'Opponent team did not arrive on time.' },
        '0:4': { resultType: MatchResultType.DISQUALIFICATION, reason: 'Unsportsmanlike conduct — disqualified by head judge.' },
        '1:1': { resultType: MatchResultType.ADMIN_DECISION, reason: 'Result confirmed by admin after score dispute.' },
      },
    });

    // Category B — 4 teams, clean single-elimination, fully played.
    const teamsB = takeTeams(eventId, 4).map((t) =>
      addRegistration({ eventId, categoryId: catId('B'), team: t, status: RegistrationStatus.APPROVED, reviewed: true, reviewedAt: daysFromNow(-40, 10) }),
    );
    buildBracket({
      eventKey, categoryKey: 'B', categoryId: catId('B'), eventId, teams: teamsB,
      status: BracketStatus.COMPLETED, completeThroughRound: 1, lockedById: admin.id, publishedById: admin.id,
      scheduled: true, liveScoring: true, courtId: court2.id, judgePool: court2Judges, baseDate: eventDate,
    });
  }

  // =========================================================================
  // EVENT 2 — ONGOING event with live scoring (partial progression)
  // =========================================================================
  {
    const eventId = 'seed_event_summer_slam_live';
    const eventKey = 'summer';
    const eventDate = daysFromNow(0, 18); // today
    await prisma.event.create({
      data: {
        id: eventId,
        title: 'El Padel Summer Slam (Live)',
        date: eventDate,
        location: 'Vake Padel Arena',
        arrivalTime: atHour(eventDate, 9),
        participationFee: 280,
        bankAccountIban: 'GE33BG0000000101904928',
        bankAccountReceiver: 'El Padel Georgia',
        description: 'An in-progress event: quarterfinals done, a semifinal live on court, final still pending.',
        isPublished: true,
        status: EventStatus.ONGOING,
        registrationClosedAt: daysFromNow(-6, 12),
        registrationRosterPublishedAt: daysFromNow(-5, 12),
        startedAt: atHour(eventDate, 10),
        schedulePublishedAt: daysFromNow(-2, 12),
        publicLiveScoringEnabled: true,
        createdById: admin.id,
      },
    });
    await prisma.eventCategory.create({ data: { eventId, categoryId: catId('C') } });

    const court = { id: `seed_court_${eventKey}_1`, eventId, name: 'Show Court', active: true };
    courtRows.push(court);
    for (const judge of judges.slice(0, 3)) {
      judgeAssignmentRows.push({
        courtId: court.id, judgeUserId: judge.id,
        startsAt: atHour(eventDate, 9), endsAt: atHour(eventDate, 22), assignedById: admin.id,
      });
    }

    const teamsC = takeTeams(eventId, 8).map((t) =>
      addRegistration({ eventId, categoryId: catId('C'), team: t, status: RegistrationStatus.APPROVED, reviewed: true, reviewedAt: daysFromNow(-6, 10) }),
    );
    buildBracket({
      eventKey, categoryKey: 'C', categoryId: catId('C'), eventId, teams: teamsC,
      status: BracketStatus.LOCKED, completeThroughRound: 0, frontierInProgress: true,
      lockedById: admin.id, publishedById: admin.id,
      scheduled: true, liveScoring: true, courtId: court.id, judgePool: judges.slice(0, 3), baseDate: eventDate,
    });
  }

  // =========================================================================
  // EVENT 3 — REGISTRATION_CLOSED with a DRAFT bracket (not yet played)
  // =========================================================================
  {
    const eventId = 'seed_event_autumn_cup';
    const eventKey = 'autumn';
    const eventDate = daysFromNow(9, 18);
    await prisma.event.create({
      data: {
        id: eventId,
        title: 'El Padel Autumn Cup',
        date: eventDate,
        location: 'Lisi Padel Club',
        participationFee: 250,
        bankAccountIban: 'GE45TB0000000101904939',
        bankAccountReceiver: 'Lisi Padel Club',
        description: 'Registration closed, roster published, draft bracket generated but not yet locked/played.',
        isPublished: true,
        status: EventStatus.REGISTRATION_CLOSED,
        registrationClosedAt: daysFromNow(-1, 12),
        registrationRosterPublishedAt: daysFromNow(-1, 13),
        createdById: admin.id,
      },
    });
    await prisma.eventCategory.create({ data: { eventId, categoryId: catId('B + C') } });

    const teams = takeTeams(eventId, 6).map((t) =>
      addRegistration({ eventId, categoryId: catId('B + C'), team: t, status: RegistrationStatus.APPROVED, reviewed: true }),
    );
    buildBracket({
      eventKey, categoryKey: 'BC', categoryId: catId('B + C'), eventId, teams,
      status: BracketStatus.DRAFT, completeThroughRound: -1, baseDate: eventDate,
    });
    // Show MatchStatus.CANCELLED safely inside a draft bracket (voided fixture).
    const draftFinal = matchRows.find((m) => m.bracketId === `seed_brk_${eventKey}_BC` && m.round === MatchRound.FINAL);
    if (draftFinal) {
      draftFinal.status = MatchStatus.CANCELLED;
      draftFinal.resultType = MatchResultType.ADMIN_DECISION;
      draftFinal.resultReason = 'Fixture voided; bracket will be regenerated after a late withdrawal.';
    }
  }

  // =========================================================================
  // EVENT 4 — REGISTRATION_OPEN: every registration status + opponent requests
  // =========================================================================
  {
    const eventId = 'seed_event_winter_open';
    const eventDate = daysFromNow(24, 18);
    await prisma.event.create({
      data: {
        id: eventId,
        title: 'El Padel Winter Open',
        date: eventDate,
        location: 'Saburtalo Indoor Courts',
        arrivalTime: atHour(eventDate, 16),
        participationFee: 260,
        bankAccountIban: 'GE67LB0000000101904940',
        bankAccountReceiver: 'El Padel Georgia',
        description: 'Open for registration — shows every registration status and opponent-request variation.',
        isPublished: true,
        status: EventStatus.REGISTRATION_OPEN,
        createdById: admin.id,
      },
    });
    await prisma.eventCategory.createMany({
      data: [catId('A'), catId('B + C')].map((categoryId) => ({ eventId, categoryId })),
    });

    // One team per status (distinct clubs/users — the overlap trigger requires it).
    const statusPlan: { status: RegistrationStatus; declineReason?: string; publicStatusReason?: string; withdrawnAt?: Date | null; reviewed?: boolean }[] = [
      { status: RegistrationStatus.PENDING },
      { status: RegistrationStatus.APPROVED, reviewed: true },
      { status: RegistrationStatus.DECLINED, reviewed: true, declineReason: 'Category already full.', publicStatusReason: 'Category full — added to waitlist consideration.' },
      { status: RegistrationStatus.NEEDS_CHANGES, reviewed: true, publicStatusReason: 'Please confirm teammate contact details.' },
      { status: RegistrationStatus.WAITLISTED, reviewed: true, publicStatusReason: 'Waitlisted — a spot may open closer to the event.' },
      { status: RegistrationStatus.WITHDRAWN, withdrawnAt: daysFromNow(-2, 12) },
      { status: RegistrationStatus.CANCELLED, publicStatusReason: 'Cancelled by the team.' },
    ];
    const openTeams = takeTeams(eventId, statusPlan.length + 6);
    statusPlan.forEach((plan, i) => {
      addRegistration({
        eventId, categoryId: i % 2 === 0 ? catId('A') : catId('B + C'), team: openTeams[i],
        status: plan.status, declineReason: plan.declineReason, publicStatusReason: plan.publicStatusReason,
        withdrawnAt: plan.withdrawnAt ?? null, reviewed: plan.reviewed,
      });
    });

    // Six more approved teams in category A for opponent-request variations.
    const orTeams = [7, 8, 9, 10, 11, 12].map((idx) =>
      addRegistration({ eventId, categoryId: catId('A'), team: openTeams[idx], status: RegistrationStatus.APPROVED, reviewed: true }),
    );

    const pairKey = (x: string, y: string) => [x, y].sort().join(':');
    const orDefs: { from: Team; to: Team; status: OpponentRequestStatus; extra?: Record<string, unknown> }[] = [
      { from: orTeams[0], to: orTeams[1], status: OpponentRequestStatus.PENDING_RESPONSE },
      // Uses two teams of its own: an approval must not collide with the already
      // approved pairing below, or the accepted row could never be approved.
      { from: orTeams[4], to: orTeams[5], status: OpponentRequestStatus.ACCEPTED_BY_OPPONENT, extra: { respondedByUserId: orTeams[5].ownerId, respondedAt: daysFromNow(-1, 10) } },
      { from: orTeams[0], to: orTeams[2], status: OpponentRequestStatus.REFUSED_BY_OPPONENT, extra: { respondedByUserId: orTeams[2].ownerId, respondedAt: daysFromNow(-1, 11), responseReason: 'Prefer a different opponent.' } },
      { from: orTeams[1], to: orTeams[3], status: OpponentRequestStatus.APPROVED_BY_ADMIN, extra: { adminDecisionByUserId: admin.id, adminDecisionAt: daysFromNow(-1, 12), adminPublicReason: 'Approved matchup.' } },
      { from: orTeams[0], to: orTeams[3], status: OpponentRequestStatus.EXPIRED, extra: { expiresAt: daysFromNow(-1, 9) } },
    ];
    let orCounter = 0;
    for (const def of orDefs) {
      orCounter += 1;
      opponentRequestRows.push({
        id: `seed_opr_${orCounter.toString().padStart(3, '0')}`,
        eventId,
        categoryId: catId('A'),
        requestingEntryId: def.from.regId,
        targetEntryId: def.to.regId,
        requestedByUserId: def.from.ownerId,
        status: def.status,
        canonicalPairKey: pairKey(def.from.regId, def.to.regId),
        version: 0,
        requestMessage: 'Would you like to play us in the first round?',
        ...(def.extra ?? {}),
      });
    }
  }

  // =========================================================================
  // EVENT 5 — DRAFT (unpublished) event, hidden from players
  // =========================================================================
  {
    const eventId = 'seed_event_preseason_draft';
    const eventDate = daysFromNow(60, 18);
    await prisma.event.create({
      data: {
        id: eventId,
        title: 'Preseason Trials (Draft)',
        date: eventDate,
        location: 'Digomi Padel Center',
        participationFee: 200,
        bankAccountIban: 'GE11VT0000000101904951',
        bankAccountReceiver: 'El Padel Georgia',
        description: 'An unpublished draft event — not visible on public pages until an admin publishes it.',
        isPublished: false,
        status: EventStatus.REGISTRATION_OPEN,
        createdById: admin.id,
      },
    });
    await prisma.eventCategory.create({ data: { eventId, categoryId: catId('C') } });
    for (const t of takeTeams(eventId, 2)) {
      addRegistration({ eventId, categoryId: catId('C'), team: t, status: RegistrationStatus.PENDING });
    }
  }

  // =========================================================================
  // EVENT 6 — older COMPLETED event for the previous-events archive
  // =========================================================================
  {
    const eventId = 'seed_event_valley_classic';
    const eventKey = 'valley';
    const eventDate = daysFromNow(-90, 17);
    await prisma.event.create({
      data: {
        id: eventId,
        title: 'El Padel Valley Classic',
        date: eventDate,
        location: 'Rustavi Sports Hall',
        participationFee: 220,
        bankAccountIban: 'GE77RS0000000101904962',
        bankAccountReceiver: 'El Padel Georgia',
        description: 'A past completed event kept for the previous-events archive.',
        isPublished: true,
        status: EventStatus.COMPLETED,
        registrationClosedAt: daysFromNow(-100, 12),
        registrationRosterPublishedAt: daysFromNow(-99, 12),
        startedAt: atHour(eventDate, 10),
        completedAt: atHour(eventDate, 20),
        schedulePublishedAt: daysFromNow(-95, 12),
        resultsPublishedAt: atHour(eventDate, 21),
        createdById: admin.id,
      },
    });
    await prisma.eventCategory.create({ data: { eventId, categoryId: catId('B') } });

    const court = { id: `seed_court_${eventKey}_1`, eventId, name: 'Main Court', active: true };
    courtRows.push(court);
    for (const judge of judges.slice(2, 4)) {
      judgeAssignmentRows.push({
        courtId: court.id, judgeUserId: judge.id,
        startsAt: atHour(eventDate, 9), endsAt: atHour(eventDate, 21), assignedById: admin.id,
      });
    }
    const teams = takeTeams(eventId, 4).map((t) =>
      addRegistration({ eventId, categoryId: catId('B'), team: t, status: RegistrationStatus.APPROVED, reviewed: true }),
    );
    buildBracket({
      eventKey, categoryKey: 'B', categoryId: catId('B'), eventId, teams,
      status: BracketStatus.COMPLETED, completeThroughRound: 1, lockedById: admin.id, publishedById: admin.id,
      scheduled: true, liveScoring: false, courtId: court.id, judgePool: judges.slice(2, 4), baseDate: eventDate,
    });
  }

  // ---- Persist all accumulated rows (dependency order) --------------------
  await prisma.eventRegistration.createMany({ data: registrationRows });
  await prisma.bracket.createMany({ data: bracketRows });
  await prisma.court.createMany({ data: courtRows });
  await prisma.courtJudgeAssignment.createMany({ data: judgeAssignmentRows });

  // Insert matches final-round-first so nextMatchId FK targets already exist.
  const matchesByRoundDesc = [...matchRows].sort((a, b) => {
    const order = [MatchRound.ROUND_OF_16, MatchRound.QUARTERFINAL, MatchRound.SEMIFINAL, MatchRound.FINAL];
    return order.indexOf(b.round) - order.indexOf(a.round);
  });
  for (const m of matchesByRoundDesc) {
    await prisma.match.create({
      data: {
        id: m.id,
        bracketId: m.bracketId,
        round: m.round,
        roundPosition: m.roundPosition,
        matchNumber: m.matchNumber,
        participantAEntryId: m.participantAEntryId,
        participantBEntryId: m.participantBEntryId,
        scoreA: m.scoreA,
        scoreB: m.scoreB,
        winnerEntryId: m.winnerEntryId,
        loserEntryId: m.loserEntryId,
        nextMatchId: m.nextMatchId,
        nextMatchSlot: m.nextMatchSlot,
        status: m.status,
        resultType: m.resultType,
        resultReason: m.resultReason,
        version: m.version,
        startedAt: m.startedAt,
        completedAt: m.completedAt,
        scoringMode: m.scoringMode,
        slotCount: m.slotCount,
      },
    });
  }

  await prisma.matchParticipantSnapshot.createMany({ data: snapshotRows });
  await prisma.scheduleItem.createMany({ data: scheduleRows });
  await prisma.scoreEvent.createMany({ data: scoreEventRows });
  await prisma.bracketRoundConfig.createMany({ data: roundConfigRows });
  await prisma.matchSlot.createMany({ data: matchSlotRows });
  await prisma.slotEvent.createMany({ data: slotEventRows });
  await prisma.opponentRequest.createMany({ data: opponentRequestRows });

  // ---- Per-event staff: judge pools and one organiser hand-off ------------
  await prisma.eventJudge.createMany({
    data: seedEventIds.flatMap((eventId) =>
      judges.map((judge) => ({ eventId, userId: judge.id, createdById: admin.id })),
    ),
    skipDuplicates: true,
  });
  await prisma.eventOrganiser.create({
    data: {
      eventId: 'seed_event_summer_slam_live',
      userId: organiser.id,
      assignedById: admin.id,
    },
  });

  // ---- Apply win/loss/matches tallies to users ---------------------------
  const statUserIds = new Set<string>([...winTally.keys(), ...lossTally.keys(), ...playedTally.keys()]);
  for (const userId of statUserIds) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        wins: winTally.get(userId) ?? 0,
        losses: lossTally.get(userId) ?? 0,
        matchesPlayed: playedTally.get(userId) ?? 0,
      },
    });
  }

  // ---- Invite token demo --------------------------------------------------
  await prisma.inviteToken.deleteMany({ where: { userId: lukaInvited.id, usedAt: null } });
  await prisma.inviteToken.create({
    data: { userId: lukaInvited.id, tokenHash: hashToken('mock-invite-token'), expiresAt: daysFromNow(14) },
  });

  console.log('Mock data created.');
  console.log(`Login password for active mock users: ${seedPassword}`);
  console.log('Admin login: admin@example.com');
  console.log('Judges: judge1@example.com … judge5@example.com');
  console.log('Organiser: organiser@example.com (runs the live Summer Slam event only)');
  console.log('Athletes: athlete001@example.com … athlete036@example.com');
  console.log('Categories: A, B, C, B + C');
  console.log(`Events seeded: ${seedEventIds.length} (completed, ongoing/live, registration-closed, registration-open, draft, archived).`);
  console.log(`Registrations: ${registrationRows.length}, matches: ${matchRows.length}, decided slots: ${matchSlotRows.length}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
