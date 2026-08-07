import { describe, expect, it } from 'vitest';
import type { BracketDto, MatchDto } from '@/types/tournament';
import {
  actionableMatches,
  buildControlSummary,
  canEditTime,
  courtOf,
  fromLocalInputValue,
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

const bracket = (matches: MatchDto[]) => ({ id: 'b1', matches } as BracketDto);

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

describe('the summary strip', () => {
  it('counts by status, ignores cancelled matches, and counts distinct live courts', () => {
    const summary = buildControlSummary([
      bracket([
        match('m1', { status: 'IN_PROGRESS', scheduleItem: scheduled('c1', 1, 'IN_PROGRESS') }),
        match('m2', { status: 'IN_PROGRESS', scheduleItem: scheduled('c1', 2, 'IN_PROGRESS') }),
        match('m3', { status: 'IN_PROGRESS', scheduleItem: scheduled('c2', 1, 'IN_PROGRESS') }),
        match('m4', { status: 'READY', scheduleItem: scheduled('c2', 2) }),
        match('m5', { status: 'COMPLETED' }),
        match('m6', { status: 'CANCELLED' }),
      ]),
    ]);
    expect(summary).toMatchObject({ live: 3, ready: 1, completed: 1, total: 5, courtsInPlay: 2 });
  });

  it('flags matches that are ready with nowhere to play', () => {
    const summary = buildControlSummary([bracket([match('m1', { status: 'READY' }), match('m2', { status: 'READY', scheduleItem: scheduled('c1', 1) })])]);
    expect(summary.awaitingCourt).toBe(1);
  });
});

describe('what can be acted on now', () => {
  it('puts running matches first, then ready ones in court-queue order', () => {
    const ordered = actionableMatches([
      bracket([
        match('m4', { status: 'READY', scheduleItem: scheduled('c1', 3) }),
        match('m2', { status: 'READY', scheduleItem: scheduled('c1', 2) }),
        match('m9', { status: 'IN_PROGRESS', scheduleItem: scheduled('c1', 1, 'IN_PROGRESS') }),
        match('m7', { status: 'COMPLETED' }),
        match('m8', { status: 'PENDING' }),
      ]),
    ]);
    expect(ordered.map(({ match: entry }) => entry.id)).toEqual(['m9', 'm2', 'm4']);
  });

  it('sends matches with no court to the back, ordered by match number', () => {
    const ordered = actionableMatches([
      bracket([match('m5', { status: 'READY' }), match('m3', { status: 'READY' }), match('m1', { status: 'READY', scheduleItem: scheduled('c1', 1) })]),
    ]);
    expect(ordered.map(({ match: entry }) => entry.id)).toEqual(['m1', 'm3', 'm5']);
  });
});
