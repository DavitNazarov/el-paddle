import { describe, expect, it } from 'vitest';
import type { NotificationDto } from '@/types/tournament';
import { dayKey, groupByDay, isUnread, readProgress, sortForQueue } from './notificationsModel';

const note = (id: string, createdAt: string, readAt: string | null = null): NotificationDto => ({
  id,
  type: 'test',
  title: id,
  message: '',
  actionPath: `/x/${id}`,
  readAt,
  createdAt,
});

describe('unread reading', () => {
  it('treats a null readAt as unread', () => {
    expect(isUnread(note('a', '2026-07-01T10:00:00.000Z'))).toBe(true);
    expect(isUnread(note('b', '2026-07-01T10:00:00.000Z', '2026-07-01T11:00:00.000Z'))).toBe(false);
  });
});

describe('queue order', () => {
  it('lifts every unread row above the read ones regardless of age', () => {
    const rows = [
      note('read-today', '2026-07-10T10:00:00.000Z', '2026-07-10T11:00:00.000Z'),
      note('unread-old', '2026-07-01T10:00:00.000Z'),
    ];
    const { unread, read } = sortForQueue(rows);
    expect(unread.map((row) => row.id)).toEqual(['unread-old']);
    expect(read.map((row) => row.id)).toEqual(['read-today']);
  });

  it('puts the newest first inside each state', () => {
    const rows = [
      note('older', '2026-07-01T10:00:00.000Z'),
      note('newer', '2026-07-05T10:00:00.000Z'),
    ];
    expect(sortForQueue(rows).unread.map((row) => row.id)).toEqual(['newer', 'older']);
  });

  it('copes with an empty inbox', () => {
    expect(sortForQueue([])).toEqual({ unread: [], read: [] });
  });
});

describe('day grouping', () => {
  it('buckets by calendar day and counts the unread in each', () => {
    const rows = [
      note('a', '2026-07-05T09:00:00.000Z'),
      note('b', '2026-07-05T18:00:00.000Z', '2026-07-06T09:00:00.000Z'),
      note('c', '2026-07-04T09:00:00.000Z'),
    ];
    const days = groupByDay(rows);
    expect(days).toHaveLength(2);
    expect(days[0]!.items.map((row) => row.id)).toEqual(['a', 'b']);
    expect(days[0]!.unread).toBe(1);
    expect(days[1]!.unread).toBe(1);
  });

  it('preserves the order it was given rather than re-sorting', () => {
    const rows = [note('newer', '2026-07-05T09:00:00.000Z'), note('older', '2026-07-01T09:00:00.000Z')];
    expect(groupByDay(rows).map((day) => day.items[0]!.id)).toEqual(['newer', 'older']);
  });

  it('builds a zero-padded, sortable day key', () => {
    expect(dayKey('2026-07-05T09:00:00.000Z')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns nothing for an empty list', () => {
    expect(groupByDay([])).toEqual([]);
  });
});

describe('progress', () => {
  it('counts what has been dealt with against the whole queue', () => {
    const rows = [
      note('a', '2026-07-05T09:00:00.000Z'),
      note('b', '2026-07-05T09:00:00.000Z', '2026-07-05T10:00:00.000Z'),
      note('c', '2026-07-05T09:00:00.000Z', '2026-07-05T10:00:00.000Z'),
    ];
    expect(readProgress(rows)).toEqual({ read: 2, total: 3 });
  });

  it('reports an empty queue honestly rather than as complete', () => {
    expect(readProgress([])).toEqual({ read: 0, total: 0 });
  });
});
