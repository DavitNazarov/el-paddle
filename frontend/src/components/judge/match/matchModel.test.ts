import { describe, expect, it } from 'vitest';
import type { MatchDto } from '@/types/tournament';
import {
  canAddPoint,
  canRecordSlot,
  canSubtractPoint,
  canUndo,
  currentSlotNumber,
  lastSlotNumber,
  pairName,
  previewSlot,
  slotProgress,
  usesSlots,
} from './matchModel';

const match = (overrides: Partial<MatchDto> = {}): MatchDto => ({
  id: 'm1',
  bracketId: 'b1',
  round: 'FINAL',
  roundPosition: 1,
  matchNumber: 7,
  participantAEntryId: 'a',
  participantBEntryId: 'b',
  nextMatchId: null,
  nextMatchSlot: null,
  participantA: null,
  participantB: null,
  scoreA: 0,
  scoreB: 0,
  scoringMode: 'SLOTS',
  slotCount: 2,
  slotCountOverride: null,
  slotsToWin: 2,
  maxSlots: 3,
  slots: [],
  status: 'IN_PROGRESS',
  resultType: null,
  resultReason: null,
  winnerEntryId: null,
  version: 1,
  startedAt: null,
  completedAt: null,
  snapshots: [],
  ...overrides,
}) as MatchDto;

const slot = (slotNumber: number, winnerSide: 'A' | 'B') =>
  ({ slotNumber, winnerSide }) as MatchDto['slots'][number];

describe('recording permissions', () => {
  it('allows a slot only while the match is running', () => {
    expect(canRecordSlot(match({ status: 'IN_PROGRESS' }))).toBe(true);
    expect(canRecordSlot(match({ status: 'READY' }))).toBe(false);
    expect(canRecordSlot(match({ status: 'COMPLETED' }))).toBe(false);
    expect(canRecordSlot(match({ status: 'CANCELLED' }))).toBe(false);
  });

  it('never offers slot recording on a points match', () => {
    expect(canRecordSlot(match({ scoringMode: 'POINTS' }))).toBe(false);
    expect(usesSlots(match({ scoringMode: 'POINTS' }))).toBe(false);
  });

  it('offers undo only once something has been recorded, and only while running', () => {
    expect(canUndo(match({ slots: [] }))).toBe(false);
    expect(canUndo(match({ slots: [slot(1, 'A')] }))).toBe(true);
    // Reopening a completed match is an admin job, not the judge's.
    expect(canUndo(match({ slots: [slot(1, 'A')], status: 'COMPLETED' }))).toBe(false);
  });
});

describe('slot numbering', () => {
  it('counts the next slot from what has been played', () => {
    expect(currentSlotNumber(match({ slots: [] }))).toBe(1);
    expect(currentSlotNumber(match({ slots: [slot(1, 'A'), slot(2, 'B')] }))).toBe(3);
  });

  it('reports the last recorded slot, or zero when there is none', () => {
    expect(lastSlotNumber(match({ slots: [] }))).toBe(0);
    expect(lastSlotNumber(match({ slots: [slot(1, 'A'), slot(2, 'B')] }))).toBe(2);
  });

  it('reads the played, maximum and target counts together', () => {
    expect(slotProgress(match({ slots: [slot(1, 'A')] }))).toEqual({ played: 1, max: 3, winsNeeded: 2 });
  });

  it('derives the maximum when the server has not snapshotted one', () => {
    expect(slotProgress(match({ maxSlots: null, slotsToWin: 3 })).max).toBe(5);
  });
});

describe('slot preview', () => {
  it('adds the win to the chosen side only', () => {
    const outcome = previewSlot(match({ scoreA: 0, scoreB: 1 }), 'A', 2);
    expect(outcome).toMatchObject({ side: 'A', slotNumber: 2, a: 1, b: 1 });
  });

  it('knows when the slot would finish the match', () => {
    expect(previewSlot(match({ scoreA: 1, slotsToWin: 2 }), 'A', 2).completes).toBe(true);
    expect(previewSlot(match({ scoreA: 0, slotsToWin: 2 }), 'A', 1).completes).toBe(false);
  });

  it('treats a race to one as decided by the first slot', () => {
    expect(previewSlot(match({ slotsToWin: 1, scoreA: 0 }), 'B', 1).completes).toBe(true);
  });
});

describe('points mode bounds', () => {
  it('stops at six and at zero', () => {
    expect(canAddPoint(match({ scoreA: 5 }), 'A')).toBe(true);
    expect(canAddPoint(match({ scoreA: 6 }), 'A')).toBe(false);
    expect(canSubtractPoint(match({ scoreA: 1 }), 'A')).toBe(true);
    expect(canSubtractPoint(match({ scoreA: 0 }), 'A')).toBe(false);
  });

  it('refuses both when the match is not running', () => {
    expect(canAddPoint(match({ status: 'READY', scoreA: 0 }), 'A')).toBe(false);
    expect(canSubtractPoint(match({ status: 'COMPLETED', scoreA: 3 }), 'A')).toBe(false);
  });
});

describe('pair naming', () => {
  it('joins both names, because a judge checks two people', () => {
    const entry = { owner: { fullName: 'Ana Beridze' }, teammate: { fullName: 'Nino Kapanadze' } } as MatchDto['participantA'];
    expect(pairName(entry, 'TBD')).toBe('Ana Beridze / Nino Kapanadze');
  });

  it('falls back when the slot in the draw is still empty', () => {
    expect(pairName(null, 'Participant pending')).toBe('Participant pending');
  });
});
