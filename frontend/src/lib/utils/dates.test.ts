import { describe, expect, it } from 'vitest';
import { daysUntil } from './dates';

/**
 * The countdown is read beside a date that `formatDate` prints in court time,
 * so it has to be counted in court time too. These cases all sit near midnight
 * in Asia/Tbilisi, which is where counting in the runtime's own zone drifts by
 * a day — differently on a UTC server and in the reader's browser, so the same
 * card rendered two numbers.
 */
describe('daysUntil', () => {
  // 02:00 on 21 August, court time. Still 20 August anywhere behind UTC+2.
  const justAfterCourtMidnight = '2026-08-20T22:00:00.000Z';
  // 10:00 on 18 August, court time.
  const now = new Date('2026-08-18T06:00:00.000Z');

  it('counts to the court day, not the runtime day', () => {
    expect(daysUntil(justAfterCourtMidnight, now)).toBe(3);
  });

  it('counts from the court day the reader is standing in', () => {
    // 01:00 on 19 August court time — already tomorrow, though still the 18th in UTC.
    const lateNight = new Date('2026-08-18T21:00:00.000Z');
    expect(daysUntil('2026-08-21T10:00:00.000Z', lateNight)).toBe(2);
  });

  it('names the same day zero and yesterday negative', () => {
    // 22:00 on the 18th court time — the same day, though 20:00 UTC would
    // already be the 19th on court and so must not read as today.
    expect(daysUntil('2026-08-18T18:00:00.000Z', now)).toBe(0);
    expect(daysUntil('2026-08-18T20:00:00.000Z', now)).toBe(1);
    expect(daysUntil('2026-08-17T10:00:00.000Z', now)).toBe(-1);
  });

  it('gives no count for a date it cannot read', () => {
    expect(daysUntil('not a date', now)).toBeNaN();
  });
});
