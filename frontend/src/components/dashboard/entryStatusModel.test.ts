import { describe, expect, it } from 'vitest';
import { entryNoteKey, entryStage, entryStep } from './entryStatusModel';

describe('entryStage', () => {
  it('keeps a pending entry at the first stop with no flag', () => {
    expect(entryStage({ status: 'PENDING' })).toEqual({ kind: 'path', step: 0, attention: null });
  });

  it('flags needs-changes and waitlisted instead of hiding them inside pending', () => {
    expect(entryStage({ status: 'NEEDS_CHANGES' })).toEqual({
      kind: 'path',
      step: 0,
      attention: 'NEEDS_CHANGES',
    });
    expect(entryStage({ status: 'WAITLISTED' })).toEqual({
      kind: 'path',
      step: 0,
      attention: 'WAITLISTED',
    });
  });

  it('moves an approved entry to the final stop once the draw is published', () => {
    expect(entryStage({ status: 'APPROVED' })).toEqual({ kind: 'path', step: 1, attention: null });
    expect(entryStage({ status: 'APPROVED', inDraw: true })).toEqual({
      kind: 'path',
      step: 2,
      attention: null,
    });
  });

  it('gives blocked states no rail at all', () => {
    for (const status of ['DECLINED', 'WITHDRAWN', 'CANCELLED'] as const) {
      expect(entryStage({ status })).toEqual({ kind: 'blocked' });
      expect(entryStep({ status })).toBe(-1);
    }
  });
});

describe('entryNoteKey', () => {
  it('gives every status a next-step sentence', () => {
    expect(entryNoteKey({ status: 'PENDING' })).toBe('underReview');
    expect(entryNoteKey({ status: 'NEEDS_CHANGES' })).toBe('needsChangesNote');
    expect(entryNoteKey({ status: 'WAITLISTED' })).toBe('waitlistedNote');
    expect(entryNoteKey({ status: 'APPROVED' })).toBe('approvedNote');
    expect(entryNoteKey({ status: 'APPROVED', inDraw: true })).toBe('inDrawNote');
    expect(entryNoteKey({ status: 'DECLINED' })).toBe('declinedNote');
    expect(entryNoteKey({ status: 'WITHDRAWN' })).toBe('withdrawnNote');
    expect(entryNoteKey({ status: 'CANCELLED' })).toBe('cancelledNote');
  });
});
