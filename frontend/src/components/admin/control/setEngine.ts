import type { MatchDto } from '@/types/tournament';

/**
 * Mirror of the server set rules, used only to phrase what the console offers.
 * The server stays authoritative for what actually completes a match.
 */
export function setsToWin(match: Pick<MatchDto, 'setCount' | 'setsToWin'>) {
  return match.setsToWin ?? match.setCount ?? 1;
}

export function maxSetsFor(match: Pick<MatchDto, 'setCount' | 'setsToWin' | 'maxSets'>) {
  return match.maxSets ?? setsToWin(match) * 2 - 1;
}

/** Whether two numbers are a finished result: the leader reaches the race, the other stops short. */
export function isFinishedTally(setsA: number, setsB: number, winsNeeded: number) {
  if (![setsA, setsB].every((value) => Number.isInteger(value) && value >= 0)) return false;
  return Math.max(setsA, setsB) === winsNeeded && Math.min(setsA, setsB) < winsNeeded;
}

/** A valid final tally, shown beside the fields so the rule needs no explaining. */
export function finishedTallyExample(winsNeeded: number) {
  return `${winsNeeded}–${Math.max(winsNeeded - 1, 0)}`;
}
