import { entryUserSelect, eventInclude, registrationInclude } from '../../common/includes.js';
import { prisma } from '../../database/prisma.js';
import {
  BracketStatus,
  ClubApplicationStatus,
  EventStatus,
  MatchStatus,
  OpponentRequestStatus,
  RegistrationStatus,
} from '../../generated/prisma/client.js';
import { opponentRequestWindowOpen } from '../opponent-requests/opponent-requests.service.js';

/** Entry states that still hold (or may hold) a place in the event. */
const ACTIVE_ENTRY_STATUSES = [
  RegistrationStatus.PENDING,
  RegistrationStatus.APPROVED,
  RegistrationStatus.NEEDS_CHANGES,
  RegistrationStatus.WAITLISTED,
];

/**
 * Opponent-request states that still speak for the entry that sent them. The
 * settled ones — refused, rejected, expired, withdrawn — release the entry to
 * ask someone else, so the home screen has nothing to say about them and goes
 * back to offering the request action.
 */
const LIVE_REQUEST_STATUSES = [
  OpponentRequestStatus.PENDING_RESPONSE,
  OpponentRequestStatus.ACCEPTED_BY_OPPONENT,
  OpponentRequestStatus.CONFLICTED,
  OpponentRequestStatus.APPROVED_BY_ADMIN,
  OpponentRequestStatus.OVERRIDDEN_BY_ADMIN,
  OpponentRequestStatus.APPLIED_TO_BRACKET,
];

type NextMatchCandidate = {
  id: string;
  round: string;
  status: MatchStatus;
  scoreA: number;
  scoreB: number;
  participantAEntryId: string | null;
  participantBEntryId: string | null;
  participantA: PairEntry | null;
  participantB: PairEntry | null;
  scheduleItem: {
    queuePosition: number;
    plannedStartAt: Date | null;
    court: { name: string; location: string | null } | null;
  } | null;
  bracket: { event: { id: string; title: string } };
};

type PairEntry = {
  owner: { name: string | null; surname: string | null };
  teammate: { name: string | null; surname: string | null };
};

function playerName(user: { name: string | null; surname: string | null }) {
  return [user.name, user.surname].filter(Boolean).join(' ') || 'Player';
}

function pairNames(entry: PairEntry | null) {
  if (!entry) return null;
  return { ownerName: playerName(entry.owner), teammateName: playerName(entry.teammate) };
}

/**
 * The one match the player checks the app for: the running one, else the
 * earliest scheduled one. Only matches in published draws with a court (or
 * already being played) qualify — an unscheduled match has nothing to say yet.
 */
function pickNextMatch(candidates: NextMatchCandidate[], personalEntryIds: Set<string>) {
  const playable = candidates.filter(
    (match) => match.status === MatchStatus.IN_PROGRESS || match.scheduleItem,
  );
  playable.sort((a, b) => {
    const liveA = a.status === MatchStatus.IN_PROGRESS ? 0 : 1;
    const liveB = b.status === MatchStatus.IN_PROGRESS ? 0 : 1;
    if (liveA !== liveB) return liveA - liveB;
    const timeA = a.scheduleItem?.plannedStartAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const timeB = b.scheduleItem?.plannedStartAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
    if (timeA !== timeB) return timeA - timeB;
    return (a.scheduleItem?.queuePosition ?? 0) - (b.scheduleItem?.queuePosition ?? 0);
  });
  const match = playable[0];
  if (!match) return null;

  const yourSide = match.participantAEntryId && personalEntryIds.has(match.participantAEntryId) ? 'A' : 'B';
  const you = yourSide === 'A' ? match.participantA : match.participantB;
  const opponent = yourSide === 'A' ? match.participantB : match.participantA;

  return {
    id: match.id,
    eventId: match.bracket.event.id,
    eventTitle: match.bracket.event.title,
    round: match.round,
    status: match.status,
    scoreA: match.scoreA,
    scoreB: match.scoreB,
    yourSide,
    you: pairNames(you),
    opponent: pairNames(opponent),
    court: match.scheduleItem?.court
      ? { name: match.scheduleItem.court.name, location: match.scheduleItem.court.location ?? '' }
      : null,
    plannedStartAt: match.scheduleItem?.plannedStartAt?.toISOString() ?? null,
  };
}

export async function getPlayerDashboard(userId: string) {
  const currentMembership = await prisma.clubMember.findUnique({
    where: { userId },
    select: { clubId: true, membershipRole: true },
  });

  const registrationScope = currentMembership
    ? { clubId: currentMembership.clubId }
    : { OR: [{ ownerId: userId }, { teammateId: userId }] };

  const [events, registrations, clubMembers] = await Promise.all([
    prisma.event.findMany({
      where: {
        isPublished: true,
        OR: [
          { status: EventStatus.REGISTRATION_OPEN },
          { registrations: { some: registrationScope } },
        ],
      },
      orderBy: { date: 'asc' },
      include: eventInclude,
    }),
    prisma.eventRegistration.findMany({
      where: registrationScope,
      orderBy: { createdAt: 'desc' },
      include: registrationInclude,
    }),
    currentMembership
      ? prisma.user.findMany({
          where: {
            id: { not: userId },
            role: 'USER',
            clubMemberships: { some: { clubId: currentMembership.clubId } },
            status: { not: 'INACTIVE' },
          },
          orderBy: [{ name: 'asc' }, { surname: 'asc' }, { email: 'asc' }],
          // Only the columns serializeTeammateOption reads (F7) — no clubMemberships,
          // stats, or disqualification for the saved-teammate dropdown. `status` is
          // read because only an accepted account can be entered in an event, and
          // the picker has to say so rather than fail on submit.
          select: { id: true, email: true, name: true, surname: true, phone: true, status: true },
        })
      : Promise.resolve([]),
  ]);

  const entryIds = registrations.map((registration) => registration.id);
  // Club mates see each other's entries, but only the players *in* a team may
  // speak for it. Everything about opponent requests below is scoped to the
  // reader's own entries, exactly like the write paths that authorize them.
  const personalEntries = registrations.filter(
    (registration) => registration.ownerId === userId || registration.teammateId === userId,
  );
  const personalEntryIds = new Set(personalEntries.map((entry) => entry.id));
  const personalEventIds = [...new Set(personalEntries.map((entry) => entry.eventId))];
  const personalCategoryIds = [...new Set(personalEntries.map((entry) => entry.categoryId))];

  const [
    drawMatches,
    teamCountGroups,
    nextMatchCandidates,
    receivedRequests,
    sentRequests,
    requestWindows,
    lockedBrackets,
  ] = await Promise.all([
    // Which of the viewer's entries appear in a *published* draw. Draft and
    // locked-but-unpublished brackets stay invisible, so the entry rail can
    // only ever claim "in the draw" once the player could actually see it.
    entryIds.length
      ? prisma.match.findMany({
          where: {
            bracket: { publishedAt: { not: null } },
            OR: [
              { participantAEntryId: { in: entryIds } },
              { participantBEntryId: { in: entryIds } },
            ],
          },
          select: { participantAEntryId: true, participantBEntryId: true },
        })
      : Promise.resolve([]),
    // "{n} teams in" on event cards — a real count, one grouped read.
    events.length
      ? prisma.eventRegistration.groupBy({
          by: ['eventId'],
          where: {
            eventId: { in: events.map((event) => event.id) },
            status: { in: ACTIVE_ENTRY_STATUSES },
          },
          _count: { _all: true },
        })
      : Promise.resolve([]),
    personalEntryIds.size
      ? prisma.match.findMany({
          where: {
            bracket: { publishedAt: { not: null } },
            status: { in: [MatchStatus.PENDING, MatchStatus.READY, MatchStatus.IN_PROGRESS] },
            OR: [
              { participantAEntryId: { in: [...personalEntryIds] } },
              { participantBEntryId: { in: [...personalEntryIds] } },
            ],
          },
          select: {
            id: true,
            round: true,
            status: true,
            scoreA: true,
            scoreB: true,
            participantAEntryId: true,
            participantBEntryId: true,
            participantA: {
              select: { owner: { select: entryUserSelect }, teammate: { select: entryUserSelect } },
            },
            participantB: {
              select: { owner: { select: entryUserSelect }, teammate: { select: entryUserSelect } },
            },
            scheduleItem: {
              select: {
                queuePosition: true,
                plannedStartAt: true,
                court: { select: { name: true, location: true } },
              },
            },
            bracket: { select: { event: { select: { id: true, title: true } } } },
          },
        })
      : Promise.resolve([]),
    // Opponent requests waiting on *this player's* answer — the home screen
    // lifts them into the "For you" strip instead of leaving them buried on
    // the event page.
    personalEntryIds.size
      ? prisma.opponentRequest.findMany({
          where: {
            targetEntryId: { in: [...personalEntryIds] },
            status: 'PENDING_RESPONSE',
          },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            eventId: true,
            event: { select: { title: true } },
            requestingEntry: {
              select: { owner: { select: entryUserSelect }, teammate: { select: entryUserSelect } },
            },
          },
        })
      : Promise.resolve([]),
    // The other half of the same conversation: what the reader asked for and
    // where it stands. Without it the home screen keeps offering "ask a team to
    // play" to a team that already asked one and is waiting on the answer.
    personalEntryIds.size
      ? prisma.opponentRequest.findMany({
          where: {
            requestingEntryId: { in: [...personalEntryIds] },
            status: { in: LIVE_REQUEST_STATUSES },
          },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            eventId: true,
            categoryId: true,
            status: true,
            targetEntry: {
              select: { owner: { select: entryUserSelect }, teammate: { select: entryUserSelect } },
            },
          },
        })
      : Promise.resolve([]),
    // Whether choosing an opponent is open at all. An event only opens the
    // window once registration closes and shuts it again when the draw locks,
    // so without these two reads the screen offers an action the write path
    // answers with a 409.
    //
    // The event and category ids are matched independently rather than as
    // pairs: that is a superset of the reader's own (event, category) pairs,
    // and a row nobody entered simply never matches when it is read back.
    personalEventIds.length
      ? prisma.eventCategory.findMany({
          where: { eventId: { in: personalEventIds }, categoryId: { in: personalCategoryIds } },
          select: {
            eventId: true,
            categoryId: true,
            opponentRequestsOpenedAt: true,
            opponentRequestsClosedAt: true,
            opponentRequestDeadline: true,
          },
        })
      : Promise.resolve([]),
    personalEventIds.length
      ? prisma.bracket.findMany({
          where: {
            eventId: { in: personalEventIds },
            categoryId: { in: personalCategoryIds },
            status: { in: [BracketStatus.LOCKED, BracketStatus.COMPLETED] },
          },
          select: { eventId: true, categoryId: true },
        })
      : Promise.resolve([]),
  ]);

  const inDrawEntryIds = new Set(
    drawMatches.flatMap((match) =>
      [match.participantAEntryId, match.participantBEntryId].filter(
        (id): id is string => Boolean(id) && entryIds.includes(id as string),
      ),
    ),
  );

  const lockedDraws = new Set(
    lockedBrackets.map((bracket) => `${bracket.eventId}:${bracket.categoryId}`),
  );

  return {
    events,
    registrations,
    clubMembers,
    clubMembershipRole: currentMembership?.membershipRole ?? null,
    inDrawEntryIds,
    teamCounts: new Map(teamCountGroups.map((group) => [group.eventId, group._count._all])),
    nextMatch: pickNextMatch(nextMatchCandidates as NextMatchCandidate[], personalEntryIds),
    receivedRequests: receivedRequests.map((request) => ({
      id: request.id,
      eventId: request.eventId,
      eventTitle: request.event.title,
      from: pairNames(request.requestingEntry),
    })),
    sentRequests: sentRequests.map((request) => ({
      id: request.id,
      eventId: request.eventId,
      categoryId: request.categoryId,
      status: request.status,
      to: {
        ownerName: playerName(request.targetEntry.owner),
        teammateName: playerName(request.targetEntry.teammate),
      },
    })),
    requestWindows: requestWindows.map((window) => ({
      eventId: window.eventId,
      categoryId: window.categoryId,
      open: opponentRequestWindowOpen(
        window,
        lockedDraws.has(`${window.eventId}:${window.categoryId}`),
      ),
    })),
  };
}

/**
 * The two numbers the player shell shows on every page: unread notifications
 * for the bell, and entries waiting on the *player* (needs-changes) for the
 * entries badge. Entries waiting on an administrator are deliberately not
 * counted — a badge should mean "you are being asked for something".
 */
export async function getPlayerSummary(userId: string) {
  const currentMembership = await prisma.clubMember.findUnique({
    where: { userId },
    select: { clubId: true },
  });
  const registrationScope = currentMembership
    ? { clubId: currentMembership.clubId }
    : { OR: [{ ownerId: userId }, { teammateId: userId }] };

  const personalEntries = await prisma.eventRegistration.findMany({
    where: { OR: [{ ownerId: userId }, { teammateId: userId }] },
    select: { id: true },
  });
  const personalEntryIds = personalEntries.map((entry) => entry.id);

  const [unreadNotifications, attentionEntries, pendingOpponentRequests] = await Promise.all([
    prisma.notification.count({ where: { recipientUserId: userId, readAt: null } }),
    prisma.eventRegistration.count({
      where: { ...registrationScope, status: RegistrationStatus.NEEDS_CHANGES },
    }),
    personalEntryIds.length
      ? prisma.opponentRequest.count({
          where: {
            targetEntryId: { in: personalEntryIds },
            status: 'PENDING_RESPONSE',
          },
        })
      : Promise.resolve(0),
  ]);

  return { unreadNotifications, attentionEntries, pendingOpponentRequests };
}

/**
 * How far a round carries a player, for picking their best-ever finish. Only the
 * ordering matters — the numbers are compared against each other, never stored.
 */
const ROUND_DEPTH: Record<string, number> = {
  ROUND_OF_32: 0,
  ROUND_OF_16: 1,
  QUARTERFINAL: 2,
  SEMIFINAL: 3,
  FINAL: 4,
};

/**
 * A player's competitive record: streaks, best finish, and how they fare with
 * each partner. Read-only, computed from completed matches in the order they
 * finished. Byes are not played matches and are excluded, matching the public
 * profile's definition of the record.
 *
 * `publicOnly` narrows it to events that have published their results, which is
 * the same gate `getPlayerStats` in `player-stats.ts` and the public match
 * history already apply. It is what lets this same record be shown on a public
 * profile without an unpublished result leaking through the streak.
 */
export async function getPlayerStats(userId: string, { publicOnly = false }: { publicOnly?: boolean } = {}) {
  const entries = await prisma.eventRegistration.findMany({
    where: { OR: [{ ownerId: userId }, { teammateId: userId }] },
    select: {
      id: true,
      ownerId: true,
      owner: { select: entryUserSelect },
      teammate: { select: entryUserSelect },
    },
  });
  const entryIds = entries.map((entry) => entry.id);
  const entryById = new Map(entries.map((entry) => [entry.id, entry]));
  if (!entryIds.length) {
    return { matches: [], currentStreak: null, bestWinStreak: 0, bestFinish: null, partners: [] };
  }

  const rows = await prisma.match.findMany({
    where: {
      status: MatchStatus.COMPLETED,
      resultType: { not: 'BYE' },
      ...(publicOnly ? { bracket: { event: { resultsPublishedAt: { not: null } } } } : {}),
      OR: [
        { participantAEntryId: { in: entryIds } },
        { participantBEntryId: { in: entryIds } },
      ],
    },
    orderBy: [{ completedAt: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      round: true,
      scoreA: true,
      scoreB: true,
      winnerEntryId: true,
      participantAEntryId: true,
      participantBEntryId: true,
      completedAt: true,
      bracket: { select: { event: { select: { id: true, title: true } } } },
    },
  });

  const played = rows.flatMap((match) => {
    const mineEntryId =
      match.participantAEntryId && entryById.has(match.participantAEntryId)
        ? match.participantAEntryId
        : match.participantBEntryId && entryById.has(match.participantBEntryId)
          ? match.participantBEntryId
          : null;
    if (!mineEntryId) return [];
    const side = mineEntryId === match.participantAEntryId ? 'A' : 'B';
    const won = match.winnerEntryId
      ? match.winnerEntryId === mineEntryId
      : side === 'A'
        ? match.scoreA > match.scoreB
        : match.scoreB > match.scoreA;
    return [{ match, mineEntryId, won }];
  });

  // Streaks, walked in the order the matches finished.
  let bestWinStreak = 0;
  let run = 0;
  for (const { won } of played) {
    run = won ? run + 1 : 0;
    if (run > bestWinStreak) bestWinStreak = run;
  }
  let currentStreak: { kind: 'W' | 'L'; count: number } | null = null;
  if (played.length) {
    const lastWon = played[played.length - 1]!.won;
    let count = 0;
    for (let index = played.length - 1; index >= 0 && played[index]!.won === lastWon; index -= 1) count += 1;
    currentStreak = { kind: lastWon ? 'W' : 'L', count };
  }

  // Best finish: winning a final beats losing one, losing a final beats
  // exiting in the semis, and so on down.
  let bestFinish: { kind: 'CHAMPION' | 'FINALIST' | 'SEMIFINALIST' | 'COMPETED'; eventTitle: string } | null = null;
  let bestScore = -1;
  for (const { match, won } of played) {
    const depth = ROUND_DEPTH[match.round] ?? 0;
    const score = won && match.round === 'FINAL' ? 100 : depth * 2 + (won ? 1 : 0);
    if (score > bestScore) {
      bestScore = score;
      bestFinish = {
        kind:
          won && match.round === 'FINAL'
            ? 'CHAMPION'
            : match.round === 'FINAL'
              ? 'FINALIST'
              : match.round === 'SEMIFINAL'
                ? 'SEMIFINALIST'
                : 'COMPETED',
        eventTitle: match.bracket.event.title,
      };
    }
  }

  // Record per partner — the other player of the entry the reader was on.
  const partnerRecords = new Map<string, { name: string; wins: number; losses: number }>();
  for (const { mineEntryId, won } of played) {
    const entry = entryById.get(mineEntryId)!;
    const partner = entry.ownerId === userId ? entry.teammate : entry.owner;
    const name = [partner.name, partner.surname].filter(Boolean).join(' ') || 'Player';
    const record = partnerRecords.get(name) ?? { name, wins: 0, losses: 0 };
    if (won) record.wins += 1;
    else record.losses += 1;
    partnerRecords.set(name, record);
  }

  return {
    matches: played.map(({ match, won }) => ({
      id: match.id,
      round: match.round,
      won,
      eventId: match.bracket.event.id,
      eventTitle: match.bracket.event.title,
      completedAt: match.completedAt?.toISOString() ?? null,
    })),
    currentStreak,
    bestWinStreak,
    bestFinish,
    partners: [...partnerRecords.values()].sort((a, b) => b.wins + b.losses - (a.wins + a.losses)),
  };
}

/**
 * Counts for the admin overview. An organiser sees the same shape narrowed to
 * the events handed to them, and never platform-wide club, category, or
 * application totals they have no power over.
 */
export async function getAdminSummary(organiserId?: string) {
  const eventScope = organiserId
    ? { organisers: { some: { userId: organiserId, revokedAt: null } } }
    : {};
  const registrationScope = organiserId ? { event: eventScope } : {};

  const [registrationGroups, eventGroups, events, clubs, categories, applications] = await Promise.all([
    prisma.eventRegistration.groupBy({ by: ['status'], where: registrationScope, _count: { _all: true } }),
    prisma.event.groupBy({ by: ['isPublished'], where: eventScope, _count: { _all: true } }),
    prisma.event.count({ where: eventScope }),
    organiserId ? Promise.resolve(0) : prisma.club.count(),
    organiserId ? Promise.resolve(0) : prisma.category.count(),
    organiserId
      ? Promise.resolve(0)
      : prisma.clubApplication.count({ where: { status: ClubApplicationStatus.SUBMITTED } }),
  ]);

  const registrationCount = (status: string) =>
    registrationGroups.find((group) => group.status === status)?._count._all ?? 0;
  const eventCount = (isPublished: boolean) =>
    eventGroups.find((group) => group.isPublished === isPublished)?._count._all ?? 0;

  return {
    pending: registrationCount('PENDING'),
    approved: registrationCount('APPROVED'),
    declined: registrationCount('DECLINED'),
    published: eventCount(true),
    drafts: eventCount(false),
    events,
    clubs,
    categories,
    applications,
  };
}

/** Opponent-request states still sitting in an administrator's decision queue. */
const AWAITING_ADMIN_DECISION = ['ACCEPTED_BY_OPPONENT', 'REFUSED_BY_OPPONENT', 'CONFLICTED'];

export type EventOperations = {
  eventId: string;
  registrations: { pending: number; approved: number; total: number };
  requests: { awaiting: number; total: number };
  brackets: { total: number; locked: number; published: number };
  /** `idle` is a court with matches queued and none of them running — dead time. */
  courts: { total: number; staffed: number; idle: number };
  /**
   * `unscheduled` is a playable match with no court yet. It used to be the one
   * thing the board could not say — the count needs the draw, not the queues —
   * so it was passed through as zero and the season row stayed silent about
   * matches nobody could reach. One grouped read answers it.
   */
  schedule: { queued: number; unscheduled: number };
  matches: { total: number; live: number; ready: number; completed: number };
};

/**
 * Per-event operational counts for every event the caller runs. The role home
 * screens need to say which event needs a decision, and answering that per
 * event with separate list reads is one request per stage per event; these are
 * grouped counts instead, so the cost does not grow with the roster.
 *
 * Scoping matches `getAdminSummary`: an organiser sees only the events handed
 * to them, an admin sees every event.
 */
/** Settled: played out or called off, and so no longer waiting on a court. */
const SETTLED_SCHEDULE_STATUSES = ['COMPLETED', 'CANCELLED'];

/**
 * A court with work still queued and nothing running on it. This is the only
 * count here that describes time being lost rather than a decision outstanding,
 * which is why the boards rank it above every review queue.
 */
function isIdleCourt(rows: Array<{ courtId: string; status: string; _count: { _all: number } }>, courtId: string) {
  const onCourt = rows.filter((row) => row.courtId === courtId);
  const waiting = onCourt.some((row) => !SETTLED_SCHEDULE_STATUSES.includes(row.status) && row.status !== 'IN_PROGRESS');
  const running = onCourt.some((row) => row.status === 'IN_PROGRESS');
  return waiting && !running;
}

export async function getEventOperations(organiserId?: string): Promise<EventOperations[]> {
  const eventScope = organiserId
    ? { organisers: { some: { userId: organiserId, revokedAt: null } } }
    : {};

  const [
    events,
    registrationGroups,
    requestGroups,
    brackets,
    courts,
    staffedCourts,
    scheduleGroups,
    matchGroups,
    unscheduledGroups,
  ] = await Promise.all([
      prisma.event.findMany({ where: eventScope, select: { id: true } }),
      prisma.eventRegistration.groupBy({
        by: ['eventId', 'status'],
        where: { event: eventScope },
        _count: { _all: true },
      }),
      prisma.opponentRequest.groupBy({
        by: ['eventId', 'status'],
        where: { event: eventScope },
        _count: { _all: true },
      }),
      prisma.bracket.findMany({
        where: { event: eventScope },
        select: { id: true, eventId: true, status: true, publishedAt: true },
      }),
      prisma.court.findMany({ where: { event: eventScope }, select: { id: true, eventId: true } }),
      // groupBy collapses to one row per court, so this counts distinct courts
      // that still hold a live judge assignment.
      prisma.courtJudgeAssignment.groupBy({
        by: ['courtId'],
        where: { revokedAt: null, court: { event: eventScope } },
      }),
      // Grouped by status as well as court: the board has to tell a court that
      // is working through a queue from one standing free with a queue on it.
      prisma.scheduleItem.groupBy({
        by: ['courtId', 'status'],
        where: { court: { event: eventScope } },
        _count: { _all: true },
      }),
      prisma.match.groupBy({
        by: ['bracketId', 'status'],
        where: { bracket: { event: eventScope } },
        _count: { _all: true },
      }),
      // A match still to be played and not yet on a court. Completed and
      // cancelled matches are excluded because neither is waiting for one — a
      // bye is decided without a court by definition.
      prisma.match.groupBy({
        by: ['bracketId'],
        where: {
          bracket: { event: eventScope },
          scheduleItem: { is: null },
          status: { notIn: [MatchStatus.COMPLETED, MatchStatus.CANCELLED] },
        },
        _count: { _all: true },
      }),
    ]);

  const eventOfBracket = new Map(brackets.map((bracket) => [bracket.id, bracket.eventId]));
  const eventOfCourt = new Map(courts.map((court) => [court.id, court.eventId]));
  const staffedCourtIds = new Set(staffedCourts.map((row) => row.courtId));

  return events.map((event) => {
    const registrationsFor = registrationGroups.filter((row) => row.eventId === event.id);
    const requestsFor = requestGroups.filter((row) => row.eventId === event.id);
    const bracketsFor = brackets.filter((row) => row.eventId === event.id);
    const courtsFor = courts.filter((row) => row.eventId === event.id);
    const matchesFor = matchGroups.filter((row) => eventOfBracket.get(row.bracketId) === event.id);
    const scheduleFor = scheduleGroups.filter((row) => eventOfCourt.get(row.courtId) === event.id);
    const unscheduledFor = unscheduledGroups.filter((row) => eventOfBracket.get(row.bracketId) === event.id);
    const total = (rows: Array<{ _count: { _all: number } }>) =>
      rows.reduce((sum, row) => sum + row._count._all, 0);

    return {
      eventId: event.id,
      registrations: {
        pending: total(registrationsFor.filter((row) => row.status === 'PENDING')),
        approved: total(registrationsFor.filter((row) => row.status === 'APPROVED')),
        total: total(registrationsFor),
      },
      requests: {
        awaiting: total(requestsFor.filter((row) => AWAITING_ADMIN_DECISION.includes(row.status))),
        total: total(requestsFor),
      },
      brackets: {
        total: bracketsFor.length,
        locked: bracketsFor.filter((row) => row.status !== 'DRAFT').length,
        published: bracketsFor.filter((row) => row.publishedAt).length,
      },
      courts: {
        total: courtsFor.length,
        staffed: courtsFor.filter((court) => staffedCourtIds.has(court.id)).length,
        idle: courtsFor.filter((court) => isIdleCourt(scheduleGroups, court.id)).length,
      },
      schedule: {
        queued: total(scheduleFor),
        unscheduled: total(unscheduledFor),
      },
      matches: {
        total: total(matchesFor),
        live: total(matchesFor.filter((row) => row.status === 'IN_PROGRESS')),
        ready: total(matchesFor.filter((row) => row.status === 'READY')),
        completed: total(matchesFor.filter((row) => row.status === 'COMPLETED')),
      },
    };
  });
}
