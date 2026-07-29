import { describe, expect, it } from 'vitest';
import { MatchSide } from '../../generated/prisma/client.js';
import { isTerminalTally, isValidSlotCount, maxSlots, nextSlotNumber, slotMatchWinner, slotWinsNeeded, tallySlots } from './slot-engine.js';

const slots = (...sides: MatchSide[]) => sides.map((winnerSide) => ({ winnerSide }));

describe('slot count validation', () => {
  it('accepts only one, two, or three', () => {
    expect(isValidSlotCount(1)).toBe(true);
    expect(isValidSlotCount(3)).toBe(true);
    expect(isValidSlotCount(0)).toBe(false);
    expect(isValidSlotCount(4)).toBe(false);
    expect(isValidSlotCount('2')).toBe(false);
  });
});

describe('slot race shape', () => {
  it('races to the configured slot count', () => {
    expect(slotWinsNeeded(1)).toBe(1);
    expect(slotWinsNeeded(2)).toBe(2);
    expect(slotWinsNeeded(3)).toBe(3);
  });

  it('allows enough slots for a decider without overrunning', () => {
    expect(maxSlots(1)).toBe(1);
    expect(maxSlots(2)).toBe(3);
    expect(maxSlots(3)).toBe(5);
  });
});

describe('tally and slot numbering', () => {
  it('counts wins per side', () => {
    expect(tallySlots(slots(MatchSide.A, MatchSide.B, MatchSide.A))).toEqual({ slotsA: 2, slotsB: 1 });
    expect(tallySlots([])).toEqual({ slotsA: 0, slotsB: 0 });
  });

  it('numbers the next slot after the decided ones', () => {
    expect(nextSlotNumber([])).toBe(1);
    expect(nextSlotNumber(slots(MatchSide.A, MatchSide.B))).toBe(3);
  });
});

describe('match completion', () => {
  it('completes a single-slot match on the first decision', () => {
    expect(slotMatchWinner(1, 0, 1)).toBe(MatchSide.A);
    expect(slotMatchWinner(0, 1, 1)).toBe(MatchSide.B);
    expect(slotMatchWinner(0, 0, 1)).toBeNull();
  });

  it('completes a first-to-two match early at two-nil and after a decider', () => {
    expect(slotMatchWinner(2, 0, 2)).toBe(MatchSide.A);
    expect(slotMatchWinner(1, 2, 2)).toBe(MatchSide.B);
    expect(slotMatchWinner(1, 1, 2)).toBeNull();
    expect(slotMatchWinner(1, 0, 2)).toBeNull();
  });

  it('completes a first-to-three match only at three slot wins', () => {
    expect(slotMatchWinner(3, 0, 3)).toBe(MatchSide.A);
    expect(slotMatchWinner(2, 3, 3)).toBe(MatchSide.B);
    expect(slotMatchWinner(2, 2, 3)).toBeNull();
    expect(slotMatchWinner(2, 1, 3)).toBeNull();
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
