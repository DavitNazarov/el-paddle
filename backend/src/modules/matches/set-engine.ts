import { MatchSide } from '../../generated/prisma/client.js';

/**
 * Set scoring rules. `setCount` is the number of set wins a side races to:
 * 1 -> first to 1 (a single set), 2 -> first to 2 (up to 3 sets), 3 -> first to 3 (up to 5 sets).
 */
export const SET_COUNT_OPTIONS = [1, 2, 3] as const;

export type SetCount = (typeof SET_COUNT_OPTIONS)[number];

export function isValidSetCount(value: unknown): value is SetCount {
  return SET_COUNT_OPTIONS.includes(value as SetCount);
}

/** Set wins a side needs to take the match. */
export function setWinsNeeded(setCount: number) {
  return setCount;
}

/** Highest set number that can ever be played, so a decider always exists and never overruns. */
export function maxSets(setCount: number) {
  return setCount * 2 - 1;
}

export function tallySets(sets: { winnerSide: MatchSide }[]) {
  return {
    setsA: sets.filter((set) => set.winnerSide === MatchSide.A).length,
    setsB: sets.filter((set) => set.winnerSide === MatchSide.B).length,
  };
}

export function nextSetNumber(sets: unknown[]) {
  return sets.length + 1;
}

/** The side that has reached the required set wins, or null while the match is still open. */
export function setMatchWinner(setsA: number, setsB: number, setCount: number) {
  const needed = setWinsNeeded(setCount);
  if (setsA >= needed) return MatchSide.A;
  if (setsB >= needed) return MatchSide.B;
  return null;
}

/** Whether a tally is a finished result, used to validate admin corrections of set matches. */
export function isTerminalTally(setsA: number, setsB: number, setCount: number) {
  if (![setsA, setsB].every((value) => Number.isInteger(value) && value >= 0)) return false;
  const needed = setWinsNeeded(setCount);
  const winner = Math.max(setsA, setsB);
  const loser = Math.min(setsA, setsB);
  return winner === needed && loser < needed;
}

/** Human-readable example of a valid final tally, used in validation messages. */
export function terminalTallyExample(setCount: number) {
  const needed = setWinsNeeded(setCount);
  return `${needed}–${Math.max(needed - 1, 0)}`;
}

/**
 * The sets still to record for a match to stand at a finished tally.
 *
 * A result entered as two numbers names no order, so one is derived: the loser's
 * outstanding sets come first, which leaves the decider to the winner. That is the
 * only ordering every finished tally can be told in, and it keeps the `MatchSet`
 * rows equal to `scoreA`/`scoreB` without inventing a set-by-set story.
 */
export function setsToReachTally(current: { setsA: number; setsB: number }, target: { setsA: number; setsB: number }) {
  const winner = target.setsA > target.setsB ? MatchSide.A : MatchSide.B;
  const loser = winner === MatchSide.A ? MatchSide.B : MatchSide.A;
  const outstanding = (side: MatchSide) => Math.max(
    side === MatchSide.A ? target.setsA - current.setsA : target.setsB - current.setsB,
    0,
  );
  return [
    ...new Array<MatchSide>(outstanding(loser)).fill(loser),
    ...new Array<MatchSide>(outstanding(winner)).fill(winner),
  ];
}
