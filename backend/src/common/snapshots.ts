import { MatchSide, type Prisma } from '../generated/prisma/client.js';
import { jsonError } from './http.js';
import { entryUserSelect } from './includes.js';

/**
 * Participant identity, frozen onto a match. A locked draw has to keep reading
 * correctly after a player leaves their club or changes their name, so identity
 * travels with the team as it advances instead of being looked up again.
 */

const snapshotEntryInclude = {
  club: { select: { id: true, name: true } },
  owner: { select: { ...entryUserSelect, clubMemberships: { select: { club: { select: { id: true, name: true } } }, take: 1 } } },
  teammate: { select: entryUserSelect },
} satisfies Prisma.EventRegistrationInclude;

type SnapshotFields = {
  entryId: string;
  ownerUserId: string;
  ownerName: string;
  teammateUserId: string;
  teammateName: string;
  clubId: string | null;
  clubName: string | null;
};

function displayName(user: { name: string | null; surname: string | null; email: string }) {
  return [user.name, user.surname].filter(Boolean).join(' ') || user.email;
}

async function snapshotFromEntry(tx: Prisma.TransactionClient, entryId: string): Promise<SnapshotFields> {
  const entry = await tx.eventRegistration.findUnique({ where: { id: entryId }, include: snapshotEntryInclude });
  if (!entry) jsonError('Bracket entry not found.', 409);
  // The club the team entered under is the historical answer. The owner's
  // current membership is only a fallback for an entry written before the
  // registration carried its own club, and a deleted club leaves neither —
  // which is a fact to record, not a reason to stop the event.
  const club = entry.club ?? entry.owner.clubMemberships[0]?.club ?? null;
  return {
    entryId: entry.id,
    ownerUserId: entry.owner.id,
    ownerName: displayName(entry.owner),
    teammateUserId: entry.teammate.id,
    teammateName: displayName(entry.teammate),
    clubId: club?.id ?? null,
    clubName: club?.name ?? null,
  };
}

/** Freezes the identity a locked draw is judged against onto one side of a match. */
export async function writeParticipantSnapshot(tx: Prisma.TransactionClient, input: { matchId: string; side: MatchSide; entryId: string }) {
  const fields = await snapshotFromEntry(tx, input.entryId);
  await tx.matchParticipantSnapshot.upsert({
    where: { matchId_side: { matchId: input.matchId, side: input.side } },
    update: fields,
    create: { matchId: input.matchId, side: input.side, ...fields },
  });
}

/**
 * Writes identity onto every occupied side of a draw that is missing one.
 *
 * A draw locked before byes carried identity forward has real teams standing in
 * later rounds with nothing frozen beside them: the console reads them as
 * club-less and any correction that needs the snapshot has nothing to copy. The
 * entry is still the right source for them, so the gap closes itself the next
 * time the draw is written to, rather than needing a repair script.
 */
export async function backfillParticipantSnapshots(tx: Prisma.TransactionClient, bracketId: string) {
  const matches = await tx.match.findMany({
    where: { bracketId, OR: [{ participantAEntryId: { not: null } }, { participantBEntryId: { not: null } }] },
    select: { id: true, participantAEntryId: true, participantBEntryId: true, snapshots: { select: { side: true } } },
  });
  for (const match of matches) {
    const held = new Set(match.snapshots.map((snapshot) => snapshot.side));
    const sides = [
      { side: MatchSide.A, entryId: match.participantAEntryId },
      { side: MatchSide.B, entryId: match.participantBEntryId },
    ];
    for (const { side, entryId } of sides) {
      if (!entryId || held.has(side)) continue;
      await writeParticipantSnapshot(tx, { matchId: match.id, side, entryId });
    }
  }
}

/**
 * Carries a team's frozen identity into the match it advances to. Falls back to
 * the registration when the source match holds no snapshot, so a draw locked
 * before byes carried identity forward still advances instead of failing.
 */
export async function carryParticipantSnapshot(tx: Prisma.TransactionClient, input: { sourceMatchId: string; entryId: string; targetMatchId: string; targetSide: MatchSide }) {
  const existing = await tx.matchParticipantSnapshot.findFirst({ where: { matchId: input.sourceMatchId, entryId: input.entryId } });
  const fields: SnapshotFields = existing
    ? { entryId: existing.entryId, ownerUserId: existing.ownerUserId, ownerName: existing.ownerName, teammateUserId: existing.teammateUserId, teammateName: existing.teammateName, clubId: existing.clubId, clubName: existing.clubName }
    : await snapshotFromEntry(tx, input.entryId);
  await tx.matchParticipantSnapshot.upsert({
    where: { matchId_side: { matchId: input.targetMatchId, side: input.targetSide } },
    update: fields,
    create: { matchId: input.targetMatchId, side: input.targetSide, ...fields },
  });
}
