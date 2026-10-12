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

/**
 * Every result this match can end on.
 *
 * A race to three has six possible finishes and a race to one has two, so the
 * whole set is small enough to show. Naming them removes the arithmetic an
 * operator was being asked to do — how many sets this match runs to, and which
 * pairs of numbers finish it — which is the arithmetic they were getting wrong.
 *
 * Ordered as a scoreboard reads: A's most decisive win first, down through the
 * close ones, and out the other side to B's.
 */
export function finishedTallies(winsNeeded: number): Array<{ a: number; b: number }> {
  if (!Number.isInteger(winsNeeded) || winsNeeded < 1) return [];
  const losses = Array.from({ length: winsNeeded }, (_, index) => index);
  return [
    ...losses.map((loss) => ({ a: winsNeeded, b: loss })),
    ...[...losses].reverse().map((loss) => ({ a: loss, b: winsNeeded })),
  ];
}
