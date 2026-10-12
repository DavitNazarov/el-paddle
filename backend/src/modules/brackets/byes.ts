import { BracketStatus, MatchResultType, MatchRound, MatchSide, MatchStatus, ScheduleItemStatus, type Prisma } from '../../generated/prisma/client.js';
import { backfillParticipantSnapshots, carryParticipantSnapshot } from '../../common/snapshots.js';

/**
 * A draw slot nobody can arrive at decides the match beside it: the team standing
 * there has no opponent, so it walks into the next round. Reading that off the
 * match graph rather than off one round means it holds wherever the gap falls —
 * a first-round team with no opponent, a team whose whole side of the draw is
 * empty, and a team that walks twice in a row.
 */

export type ByeMatch = {
  id: string;
  matchNumber: number;
  status: MatchStatus;
  participantAEntryId: string | null;
  participantBEntryId: string | null;
  nextMatchId: string | null;
  nextMatchSlot: MatchSide | null;
};

export type PlannedBye = { matchId: string; entryId: string; nextMatchId: string | null; nextMatchSlot: MatchSide | null };

export type ByePlan = {
  /** Matches won without being played, in the order they have to be applied. */
  byes: PlannedBye[];
  /** Matches no team can ever reach — the hole a rearranged draw leaves behind. */
  empties: string[];
};

/** True while a match can still turn into a bye; anything recorded keeps its result. */
function isUndecided(status: MatchStatus) {
  return status === MatchStatus.PENDING || status === MatchStatus.READY;
}

/**
 * Every bye the draw's current shape already decides. A match with one live side
 * and a team standing on it is a bye now; one with a live side still to be played
 * becomes a bye later, once that match produces a winner.
 */
export function planByes(matches: ByeMatch[]): ByePlan {
  // Match numbers run straight through the draw, so playing order is also the
  // order in which a bye can be known: every feeder is resolved before its target.
  const ordered = [...matches].sort((a, b) => a.matchNumber - b.matchNumber);
  const feeders = new Map<string, Partial<Record<MatchSide, string>>>();
  for (const match of ordered) {
    if (!match.nextMatchId || !match.nextMatchSlot) continue;
    const target = feeders.get(match.nextMatchId) ?? {};
    target[match.nextMatchSlot] = match.id;
    feeders.set(match.nextMatchId, target);
  }

  const occupants = new Map(ordered.map((match) => [match.id, { [MatchSide.A]: match.participantAEntryId, [MatchSide.B]: match.participantBEntryId }]));
  const producesWinner = new Map<string, boolean>();
  const plan: ByePlan = { byes: [], empties: [] };

  for (const match of ordered) {
    if (match.status === MatchStatus.CANCELLED) {
      producesWinner.set(match.id, false);
      continue;
    }
    if (!isUndecided(match.status)) {
      producesWinner.set(match.id, true);
      continue;
    }
    const slots = occupants.get(match.id)!;
    const feeder = feeders.get(match.id) ?? {};
    const isLive = (side: MatchSide) => {
      const source = feeder[side];
      return Boolean(slots[side]) || Boolean(source && producesWinner.get(source));
    };
    const liveA = isLive(MatchSide.A);
    const liveB = isLive(MatchSide.B);
    if (!liveA && !liveB) {
      plan.empties.push(match.id);
      producesWinner.set(match.id, false);
      continue;
    }
    producesWinner.set(match.id, true);
    if (liveA && liveB) continue;
    const side = liveA ? MatchSide.A : MatchSide.B;
    const entryId = slots[side];
    // The live side is a match still to be played: this becomes a bye when that
    // match produces a winner, not now.
    if (!entryId) continue;
    plan.byes.push({ matchId: match.id, entryId, nextMatchId: match.nextMatchId, nextMatchSlot: match.nextMatchSlot });
    if (match.nextMatchId && match.nextMatchSlot) {
      const target = occupants.get(match.nextMatchId);
      if (target) target[match.nextMatchSlot] = entryId;
    }
  }
  return plan;
}

const byeMatchSelect = {
  id: true,
  matchNumber: true,
  round: true,
  status: true,
  participantAEntryId: true,
  participantBEntryId: true,
  nextMatchId: true,
  nextMatchSlot: true,
} satisfies Prisma.MatchSelect;

/**
 * Applies every bye the draw already decides. Safe to run again at any point —
 * a bye it has recorded is a completed match, which no later pass reads as
 * undecided.
 */
export async function applyByes(tx: Prisma.TransactionClient, bracketId: string) {
  // A team already standing in the draw must carry its identity before the pass
  // that may advance it again, so nothing is carried forward from an empty side.
  await backfillParticipantSnapshots(tx, bracketId);
  const matches = await tx.match.findMany({ where: { bracketId }, select: byeMatchSelect });
  const plan = planByes(matches);
  if (!plan.byes.length && !plan.empties.length) return plan;

  if (plan.empties.length) {
    await tx.match.updateMany({ where: { id: { in: plan.empties } }, data: { status: MatchStatus.CANCELLED, version: { increment: 1 } } });
    await tx.scheduleItem.updateMany({ where: { matchId: { in: plan.empties } }, data: { status: ScheduleItemStatus.CANCELLED, version: { increment: 1 } } });
  }

  const rounds = new Map(matches.map((match) => [match.id, match.round]));
  for (const bye of plan.byes) {
    await tx.match.update({
      where: { id: bye.matchId },
      data: { winnerEntryId: bye.entryId, status: MatchStatus.COMPLETED, resultType: MatchResultType.BYE, completedAt: new Date(), version: { increment: 1 } },
    });
    // A bye occupies no court, so its queue slot closes with it.
    await tx.scheduleItem.updateMany({ where: { matchId: bye.matchId }, data: { status: ScheduleItemStatus.COMPLETED, version: { increment: 1 } } });
    // A bye can decide the title when a whole side of the draw is empty.
    if (rounds.get(bye.matchId) === MatchRound.FINAL) {
      await tx.bracket.update({ where: { id: bracketId }, data: { status: BracketStatus.COMPLETED, completedAt: new Date(), version: { increment: 1 } } });
    }
    if (!bye.nextMatchId || !bye.nextMatchSlot) continue;
    const data = bye.nextMatchSlot === MatchSide.A ? { participantAEntryId: bye.entryId } : { participantBEntryId: bye.entryId };
    const next = await tx.match.update({ where: { id: bye.nextMatchId }, data: { ...data, version: { increment: 1 } } });
    await carryParticipantSnapshot(tx, { sourceMatchId: bye.matchId, entryId: bye.entryId, targetMatchId: next.id, targetSide: bye.nextMatchSlot });
    if (next.participantAEntryId && next.participantBEntryId) {
      await tx.match.update({ where: { id: next.id }, data: { status: MatchStatus.READY, version: { increment: 1 } } });
      await tx.scheduleItem.updateMany({ where: { matchId: next.id, status: ScheduleItemStatus.TENTATIVE }, data: { status: ScheduleItemStatus.READY, version: { increment: 1 } } });
    }
  }
  return plan;
}
