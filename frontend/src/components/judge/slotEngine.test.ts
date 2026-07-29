import { describe, expect, it } from 'vitest';
import { maxSlotsFor, slotsToWin, willCompleteMatch } from './slotEngine';

describe('judge slot helpers', () => {
  it('reads the wins needed from the server snapshot', () => {
    expect(slotsToWin({ slotCount: 3, slotsToWin: 3 })).toBe(3);
    expect(slotsToWin({ slotCount: 2, slotsToWin: null })).toBe(2);
    expect(slotsToWin({ slotCount: null, slotsToWin: null })).toBe(1);
  });

  it('derives the maximum slot count when the server did not send one', () => {
    expect(maxSlotsFor({ slotCount: 2, slotsToWin: 2, maxSlots: null })).toBe(3);
    expect(maxSlotsFor({ slotCount: 3, slotsToWin: 3, maxSlots: 5 })).toBe(5);
    expect(maxSlotsFor({ slotCount: 1, slotsToWin: 1, maxSlots: null })).toBe(1);
  });

  it('flags the decision that would finish the match', () => {
    expect(willCompleteMatch(0, 1)).toBe(true);
    expect(willCompleteMatch(0, 2)).toBe(false);
    expect(willCompleteMatch(1, 2)).toBe(true);
    expect(willCompleteMatch(2, 3)).toBe(true);
  });
});
