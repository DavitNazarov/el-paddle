import type { MatchDto } from '@/types/tournament';
import { maxSlotsFor, slotsToWin, willCompleteMatch } from '../slotEngine';

/**
 * Pure reading for the judge match console. The server stays authoritative for
 * every rule; this only decides what the console is allowed to *offer*, so a
 * judge is never shown a control the server would refuse.
 */

export type Side = 'A' | 'B';

export const SIDES: readonly Side[] = ['A', 'B'];

export function participantOf(match: MatchDto, side: Side) {
  return side === 'A' ? match.participantA : match.participantB;
}

export function tallyOf(match: MatchDto, side: Side) {
  return side === 'A' ? match.scoreA : match.scoreB;
}

/** Both names, because a judge checks them against the two people on court. */
export function pairName(entry: MatchDto['participantA'], fallback: string) {
  return entry ? `${entry.owner.fullName} / ${entry.teammate.fullName}` : fallback;
}

export function isLive(match: MatchDto) {
  return match.status === 'IN_PROGRESS';
}

export function usesSlots(match: MatchDto) {
  return match.scoringMode === 'SLOTS';
}

/** The slot about to be played. Slots are 1-based and always contiguous. */
export function currentSlotNumber(match: MatchDto) {
  return match.slots.length + 1;
}

export function lastSlotNumber(match: MatchDto) {
  return match.slots.at(-1)?.slotNumber ?? 0;
}

/**
 * A judge may only record a slot on a running match. Anything else — ready,
 * completed, cancelled — means the server would refuse, so the buttons are off.
 */
export function canRecordSlot(match: MatchDto) {
  return usesSlots(match) && isLive(match);
}

/** Undo removes only the last slot, and only while the match is still running. */
export function canUndo(match: MatchDto) {
  return usesSlots(match) && isLive(match) && match.slots.length > 0;
}

export type SlotProgress = {
  /** Slots played so far. */
  played: number;
  /** The most slots this match can ever run to, so a decider always exists. */
  max: number;
  /** Slot wins needed to take the match. */
  winsNeeded: number;
};

export function slotProgress(match: MatchDto): SlotProgress {
  return { played: match.slots.length, max: maxSlotsFor(match), winsNeeded: slotsToWin(match) };
}

/**
 * What recording this slot would do. The console needs to know before it asks,
 * because "this wins the match" and "this levels it at 1–1" are different
 * enough that they deserve different confirmations.
 */
export type SlotOutcome = {
  side: Side;
  slotNumber: number;
  /** Tallies as they would stand after the slot is recorded. */
  a: number;
  b: number;
  completes: boolean;
};

export function previewSlot(match: MatchDto, side: Side, slotNumber: number): SlotOutcome {
  const winsNeeded = slotsToWin(match);
  return {
    side,
    slotNumber,
    a: side === 'A' ? match.scoreA + 1 : match.scoreA,
    b: side === 'B' ? match.scoreB + 1 : match.scoreB,
    completes: willCompleteMatch(tallyOf(match, side), winsNeeded),
  };
}

/* ---- Points mode, kept for historical matches ---- */

export const POINTS_MAX = 6;

export function canAddPoint(match: MatchDto, side: Side) {
  return isLive(match) && tallyOf(match, side) < POINTS_MAX;
}

export function canSubtractPoint(match: MatchDto, side: Side) {
  return isLive(match) && tallyOf(match, side) > 0;
}
