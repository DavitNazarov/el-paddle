import { describe, expect, it } from 'vitest';
import { EventStatus } from '../../generated/prisma/client.js';
import { canTransitionEvent } from './events.service.js';

describe('event lifecycle', () => {
  it('allows only the normal forward sequence', () => {
    expect(canTransitionEvent(EventStatus.REGISTRATION_OPEN, EventStatus.REGISTRATION_CLOSED)).toBe(true);
    expect(canTransitionEvent(EventStatus.REGISTRATION_CLOSED, EventStatus.ONGOING)).toBe(true);
    expect(canTransitionEvent(EventStatus.ONGOING, EventStatus.COMPLETED)).toBe(true);
  });

  it('rejects skipped transitions and allows explicit completed-event rollback', () => {
    expect(canTransitionEvent(EventStatus.REGISTRATION_OPEN, EventStatus.ONGOING)).toBe(false);
    expect(canTransitionEvent(EventStatus.COMPLETED, EventStatus.ONGOING)).toBe(true);
  });
});
