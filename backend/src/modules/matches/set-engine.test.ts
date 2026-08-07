import { describe, expect, it } from 'vitest';
import { MatchSide } from '../../generated/prisma/client.js';
import { isTerminalTally, isValidSetCount, maxSets, nextSetNumber, setMatchWinner, setWinsNeeded, setsToReachTally, tallySets } from './set-engine.js';

const sets = (...sides: MatchSide[]) => sides.map((winnerSide) => ({ winnerSide }));

describe('set count validation', () => {
  it('accepts only one, two, or three', () => {
    expect(isValidSetCount(1)).toBe(true);
    expect(isValidSetCount(3)).toBe(true);
    expect(isValidSetCount(0)).toBe(false);
    expect(isValidSetCount(4)).toBe(false);
    expect(isValidSetCount('2')).toBe(false);
  });
});

describe('set race shape', () => {
  it('races to the configured set count', () => {
    expect(setWinsNeeded(1)).toBe(1);
    expect(setWinsNeeded(2)).toBe(2);
    expect(setWinsNeeded(3)).toBe(3);
  });

  it('allows enough sets for a decider without overrunning', () => {
    expect(maxSets(1)).toBe(1);
    expect(maxSets(2)).toBe(3);
    expect(maxSets(3)).toBe(5);
  });
});

describe('tally and set numbering', () => {
  it('counts wins per side', () => {
    expect(tallySets(sets(MatchSide.A, MatchSide.B, MatchSide.A))).toEqual({ setsA: 2, setsB: 1 });
    expect(tallySets([])).toEqual({ setsA: 0, setsB: 0 });
  });

  it('numbers the next set after the decided ones', () => {
    expect(nextSetNumber([])).toBe(1);
    expect(nextSetNumber(sets(MatchSide.A, MatchSide.B))).toBe(3);
  });
});

describe('match completion', () => {
  it('completes a single-set match on the first decision', () => {
    expect(setMatchWinner(1, 0, 1)).toBe(MatchSide.A);
    expect(setMatchWinner(0, 1, 1)).toBe(MatchSide.B);
    expect(setMatchWinner(0, 0, 1)).toBeNull();
  });

  it('completes a first-to-two match early at two-nil and after a decider', () => {
    expect(setMatchWinner(2, 0, 2)).toBe(MatchSide.A);
    expect(setMatchWinner(1, 2, 2)).toBe(MatchSide.B);
    expect(setMatchWinner(1, 1, 2)).toBeNull();
    expect(setMatchWinner(1, 0, 2)).toBeNull();
  });

  it('completes a first-to-three match only at three set wins', () => {
    expect(setMatchWinner(3, 0, 3)).toBe(MatchSide.A);
    expect(setMatchWinner(2, 3, 3)).toBe(MatchSide.B);
    expect(setMatchWinner(2, 2, 3)).toBeNull();
    expect(setMatchWinner(2, 1, 3)).toBeNull();
  });
});

describe('terminal tally validation', () => {
  it('accepts finished results', () => {
    expect(isTerminalTally(1, 0, 1)).toBe(true);
    expect(isTerminalTally(2, 1, 2)).toBe(true);
    expect(isTerminalTally(0, 2, 2)).toBe(true);
    expect(isTerminalTally(3, 2, 3)).toBe(true);
  });

  it('rejects unfinished, impossible, or malformed tallies', () => {
    expect(isTerminalTally(1, 1, 2)).toBe(false);
    expect(isTerminalTally(2, 2, 3)).toBe(false);
    expect(isTerminalTally(3, 0, 2)).toBe(false);
    expect(isTerminalTally(2, 2, 2)).toBe(false);
    expect(isTerminalTally(-1, 2, 2)).toBe(false);
    expect(isTerminalTally(1.5, 0, 2)).toBe(false);
  });
});

describe('expanding a tally into sets', () => {
  it('gives the decider to the winner', () => {
    expect(setsToReachTally({ setsA: 0, setsB: 0 }, { setsA: 1, setsB: 2 }))
      .toEqual([MatchSide.A, MatchSide.B, MatchSide.B]);
    expect(setsToReachTally({ setsA: 0, setsB: 0 }, { setsA: 3, setsB: 2 }))
      .toEqual([MatchSide.B, MatchSide.B, MatchSide.A, MatchSide.A, MatchSide.A]);
  });

  it('expands a straight win into the winner alone', () => {
    expect(setsToReachTally({ setsA: 0, setsB: 0 }, { setsA: 2, setsB: 0 })).toEqual([MatchSide.A, MatchSide.A]);
    expect(setsToReachTally({ setsA: 0, setsB: 0 }, { setsA: 0, setsB: 1 })).toEqual([MatchSide.B]);
  });

  it('adds only what is outstanding when sets are already recorded', () => {
    expect(setsToReachTally({ setsA: 1, setsB: 0 }, { setsA: 1, setsB: 2 })).toEqual([MatchSide.B, MatchSide.B]);
    expect(setsToReachTally({ setsA: 1, setsB: 1 }, { setsA: 2, setsB: 1 })).toEqual([MatchSide.A]);
  });
});
