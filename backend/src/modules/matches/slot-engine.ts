import { MatchSide } from '../../generated/prisma/client.js';

/**
 * Slot scoring rules. `slotCount` is the number of slot wins a side races to:
 * 1 -> first to 1 (a single slot), 2 -> first to 2 (up to 3 slots), 3 -> first to 3 (up to 5 slots).
 */
export const SLOT_COUNT_OPTIONS = [1, 2, 3] as const;

export type SlotCount = (typeof SLOT_COUNT_OPTIONS)[number];

export function isValidSlotCount(value: unknown): value is SlotCount {
  return SLOT_COUNT_OPTIONS.includes(value as SlotCount);
}

/** Slot wins a side needs to take the match. */
export function slotWinsNeeded(slotCount: number) {
  return slotCount;
}

/** Highest slot number that can ever be played, so a decider always exists and never overruns. */
export function maxSlots(slotCount: number) {
  return slotCount * 2 - 1;
}

export function tallySlots(slots: { winnerSide: MatchSide }[]) {
  return {
    slotsA: slots.filter((slot) => slot.winnerSide === MatchSide.A).length,
    slotsB: slots.filter((slot) => slot.winnerSide === MatchSide.B).length,
  };
}

export function nextSlotNumber(slots: unknown[]) {
  return slots.length + 1;
}

/** The side that has reached the required slot wins, or null while the match is still open. */
export function slotMatchWinner(slotsA: number, slotsB: number, slotCount: number) {
  const needed = slotWinsNeeded(slotCount);
  if (slotsA >= needed) return MatchSide.A;
  if (slotsB >= needed) return MatchSide.B;
  return null;
}

/** Whether a tally is a finished result, used to validate admin corrections of slot matches. */
export function isTerminalTally(slotsA: number, slotsB: number, slotCount: number) {
  if (![slotsA, slotsB].every((value) => Number.isInteger(value) && value >= 0)) return false;
  const needed = slotWinsNeeded(slotCount);
  const winner = Math.max(slotsA, slotsB);
  const loser = Math.min(slotsA, slotsB);
  return winner === needed && loser < needed;
}

/** Human-readable example of a valid final tally, used in validation messages. */
export function terminalTallyExample(slotCount: number) {
  const needed = slotWinsNeeded(slotCount);
  return `${needed}–${Math.max(needed - 1, 0)}`;
}
