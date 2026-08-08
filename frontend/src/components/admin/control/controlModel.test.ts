import { describe, expect, it } from 'vitest';
import type { MatchDto } from '@/types/tournament';
import {
  LATE_AFTER_MINUTES,
  canEditTime,
  courtOf,
  fromLocalInputValue,
  minutesLate,
  plannedStartOf,
  toLocalInputValue,
} from './controlModel';

function match(id: string, fields: Partial<MatchDto> = {}) {
  return { id, matchNumber: Number(id.slice(1)), status: 'READY', ...fields } as MatchDto;
}

function scheduled(courtId: string, queuePosition: number, status = 'READY', plannedStartAt: string | null = null) {
  return {
    id: `item-${courtId}-${queuePosition}`,
    status,
    version: 1,
    queuePosition,
    plannedStartAt,
    court: { id: courtId, name: courtId.toUpperCase(), location: null },
  } as unknown as MatchDto['scheduleItem'];
}

describe('where and when a match is', () => {
  it('reads the court off the match, and null while it waits for one', () => {
    expect(courtOf(match('m1', { scheduleItem: scheduled('c1', 1) }))?.name).toBe('C1');
    expect(courtOf(match('m1'))).toBeNull();
  });

  it('reads the planned start, or null when none is set', () => {
    expect(plannedStartOf(match('m1', { scheduleItem: scheduled('c1', 1, 'READY', '2026-08-05T11:30:00.000Z') }))).toBe('2026-08-05T11:30:00.000Z');
    expect(plannedStartOf(match('m1'))).toBeNull();
  });

  it('stops offering the time field once the server has frozen the item', () => {
    expect(canEditTime(match('m1', { scheduleItem: scheduled('c1', 1) }))).toBe(true);
    expect(canEditTime(match('m1', { scheduleItem: scheduled('c1', 1, 'IN_PROGRESS') }))).toBe(false);
    expect(canEditTime(match('m1', { scheduleItem: scheduled('c1', 1, 'COMPLETED') }))).toBe(false);
    expect(canEditTime(match('m1'))).toBe(false);
  });
});

describe('running late', () => {
  const now = new Date('2026-08-05T12:00:00.000Z').getTime();
  const due = (minutesAgo: number) => new Date(now - minutesAgo * 60_000).toISOString();

  it('stays quiet until a match is far enough behind to be worth saying', () => {
    const barely = match('m1', { scheduleItem: scheduled('c1', 1, 'READY', due(LATE_AFTER_MINUTES - 1)) });
    const late = match('m2', { scheduleItem: scheduled('c1', 2, 'READY', due(23)) });
    expect(minutesLate(barely, now)).toBeNull();
    expect(minutesLate(late, now)).toBe(23);
  });

  it('says nothing about a match that has already started or finished', () => {
    const started = { status: 'IN_PROGRESS', scheduleItem: scheduled('c1', 1, 'IN_PROGRESS', due(40)) };
    const done = { status: 'COMPLETED', scheduleItem: scheduled('c1', 1, 'COMPLETED', due(40)) };
    expect(minutesLate(match('m1', started as Partial<MatchDto>), now)).toBeNull();
    expect(minutesLate(match('m2', done as Partial<MatchDto>), now)).toBeNull();
  });

  it('cannot be late without a time to be late against', () => {
    expect(minutesLate(match('m1', { scheduleItem: scheduled('c1', 1) }), now)).toBeNull();
    expect(minutesLate(match('m1'), now)).toBeNull();
  });
});

describe('datetime-local round trip', () => {
  it('renders an ISO instant as local wall-clock text and back again', () => {
    const iso = new Date(2026, 7, 5, 14, 30).toISOString();
    const text = toLocalInputValue(iso);
    expect(text).toBe('2026-08-05T14:30');
    expect(fromLocalInputValue(text)).toBe(iso);
  });

  it('treats an empty field as clearing the time, and ignores nonsense', () => {
    expect(toLocalInputValue(null)).toBe('');
    expect(toLocalInputValue('not a date')).toBe('');
    expect(fromLocalInputValue('')).toBeNull();
    expect(fromLocalInputValue('   ')).toBeNull();
    expect(fromLocalInputValue('not a date')).toBeNull();
  });
});
