import { describe, expect, it } from 'vitest';
import { resolveOpponentRequestExpiry } from './opponent-requests.service.js';

describe('resolveOpponentRequestExpiry', () => {
  it('expires a pending request at the category opponent-request deadline', () => {
    // Regression guard for the dead expiry worker (H-2): a request created while a
    // deadline is configured must carry expiresAt so the worker can transition it.
    const deadline = new Date('2026-08-01T12:00:00.000Z');
    expect(resolveOpponentRequestExpiry({ opponentRequestDeadline: deadline })).toEqual(deadline);
  });

  it('leaves expiresAt null when the category has no deadline', () => {
    expect(resolveOpponentRequestExpiry({ opponentRequestDeadline: null })).toBeNull();
  });
});
