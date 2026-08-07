import { describe, expect, it } from 'vitest';
import { endOfDayInZone, PLATFORM_TIME_ZONE } from './time.js';

describe('endOfDayInZone', () => {
  it('resolves the end of a Georgian day regardless of the server zone', () => {
    // Georgia is a fixed UTC+4, so 23:59:59.999 local is 19:59:59.999Z.
    expect(endOfDayInZone('2026-08-10')?.toISOString()).toBe('2026-08-10T19:59:59.999Z');
  });

  it('is stable across a DST boundary in a zone that observes it', () => {
    // London: BST (UTC+1) in July, GMT (UTC+0) in December. A fixed offset
    // would get one of these wrong.
    expect(endOfDayInZone('2026-07-15', 'Europe/London')?.toISOString()).toBe('2026-07-15T22:59:59.999Z');
    expect(endOfDayInZone('2026-12-15', 'Europe/London')?.toISOString()).toBe('2026-12-15T23:59:59.999Z');
  });

  it('rejects anything that is not a calendar date', () => {
    for (const bad of ['', 'tomorrow', '2026-8-1', '2026-08-10T12:00:00Z', '10/08/2026', '2026-13-45']) {
      expect(endOfDayInZone(bad)).toBeNull();
    }
  });

  it('defaults to the platform zone', () => {
    expect(endOfDayInZone('2026-08-10')).toEqual(endOfDayInZone('2026-08-10', PLATFORM_TIME_ZONE));
  });
});
