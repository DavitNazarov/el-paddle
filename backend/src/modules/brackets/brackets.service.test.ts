import { describe, expect, it } from 'vitest';
import { MatchRound } from '../../generated/prisma/client.js';
import { bracketSizeForEntryCount, roundPlan } from './brackets.service.js';

describe('bracket sizing', () => {
  it('uses the smallest supported draw that fits approved entries', () => {
    expect(bracketSizeForEntryCount(2)).toBe(2);
    expect(bracketSizeForEntryCount(3)).toBe(4);
    expect(bracketSizeForEntryCount(5)).toBe(8);
    expect(bracketSizeForEntryCount(9)).toBe(16);
    expect(bracketSizeForEntryCount(17)).toBe(32);
  });

  it('fills a full draw exactly, and leaves the gap to byes below it', () => {
    expect(bracketSizeForEntryCount(16)).toBe(16);
    expect(bracketSizeForEntryCount(32)).toBe(32);
  });

  it('rejects counts that cannot produce a supported bracket', () => {
    expect(() => bracketSizeForEntryCount(1)).toThrow();
    expect(() => bracketSizeForEntryCount(33)).toThrow();
  });
});

describe('the rounds a draw is made of', () => {
  it('opens a 32-entry draw with a round of 32 and numbers straight through to the final', () => {
    expect(roundPlan(32)).toEqual([
      { round: MatchRound.ROUND_OF_32, count: 16, firstMatchNumber: 1 },
      { round: MatchRound.ROUND_OF_16, count: 8, firstMatchNumber: 17 },
      { round: MatchRound.QUARTERFINAL, count: 4, firstMatchNumber: 25 },
      { round: MatchRound.SEMIFINAL, count: 2, firstMatchNumber: 29 },
      { round: MatchRound.FINAL, count: 1, firstMatchNumber: 31 },
    ]);
  });

  it('starts a smaller draw at the round that fits it, and never invents an earlier one', () => {
    expect(roundPlan(16).map((item) => item.round)).toEqual([
      MatchRound.ROUND_OF_16,
      MatchRound.QUARTERFINAL,
      MatchRound.SEMIFINAL,
      MatchRound.FINAL,
    ]);
    expect(roundPlan(2)).toEqual([{ round: MatchRound.FINAL, count: 1, firstMatchNumber: 1 }]);
  });

  it('always plans one match fewer than the draw has slots', () => {
    for (const size of [2, 4, 8, 16, 32]) {
      const matches = roundPlan(size).reduce((total, item) => total + item.count, 0);
      expect(matches).toBe(size - 1);
    }
  });
});
