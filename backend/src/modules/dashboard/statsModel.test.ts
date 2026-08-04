import { describe, expect, it } from 'vitest';
import { ApiError } from '../../common/http.js';
import {
  bucketLabel,
  delta,
  fillBuckets,
  foldRoleStatus,
  resolveRange,
  share,
  startOfTbilisiDay,
  startOfTbilisiMonth,
  startOfTbilisiWeek,
  toCount,
  toDistribution,
  toNullableNumber,
  topN,
} from './statsModel.js';

// A fixed instant so the assertions do not drift: 15 Aug 2026, 21:30 Tbilisi
// (17:30 UTC). Deliberately in the evening, because that is the case a UTC day
// boundary would put in the wrong bucket.
const NOW = new Date('2026-08-15T17:30:00Z');

describe('startOfTbilisiDay', () => {
  it('returns the Georgian midnight, not the UTC one', () => {
    // 20:00 UTC on the 15th is already the 16th in Tbilisi (00:00 +04:00).
    expect(startOfTbilisiDay(new Date('2026-08-15T20:00:00Z')).toISOString()).toBe(
      '2026-08-15T20:00:00.000Z',
    );
    expect(startOfTbilisiDay(new Date('2026-08-15T17:30:00Z')).toISOString()).toBe(
      '2026-08-14T20:00:00.000Z',
    );
  });

  it('is idempotent', () => {
    const once = startOfTbilisiDay(NOW);
    expect(startOfTbilisiDay(once).toISOString()).toBe(once.toISOString());
  });

  it('lands on an exact second regardless of the input milliseconds', () => {
    // Regression: bucket starts are matched by value against the instants
    // Postgres returns, so a stray millisecond makes every bucket miss.
    const messy = startOfTbilisiDay(new Date('2026-08-15T17:30:00.487Z'));
    expect(messy.getUTCMilliseconds()).toBe(0);
    expect(messy.toISOString()).toBe('2026-08-14T20:00:00.000Z');
  });
});

describe('startOfTbilisiWeek / Month', () => {
  it('starts weeks on Monday', () => {
    // 15 Aug 2026 is a Saturday; its week began Monday the 10th.
    expect(startOfTbilisiWeek(NOW).toISOString()).toBe('2026-08-09T20:00:00.000Z');
  });

  it('starts months on the first', () => {
    expect(startOfTbilisiMonth(NOW).toISOString()).toBe('2026-07-31T20:00:00.000Z');
  });
});

describe('resolveRange', () => {
  it('defaults to 30 days when absent or blank', () => {
    expect(resolveRange(undefined, NOW).range).toBe('30d');
    expect(resolveRange('', NOW).range).toBe('30d');
    expect(resolveRange('  ', NOW).range).toBe('30d');
  });

  it('maps each preset to its bucket unit', () => {
    expect(resolveRange('7d', NOW).bucket).toBe('day');
    expect(resolveRange('30d', NOW).bucket).toBe('day');
    expect(resolveRange('90d', NOW).bucket).toBe('week');
    expect(resolveRange('12m', NOW).bucket).toBe('month');
  });

  it('rejects anything else with a 400 rather than guessing', () => {
    for (const bad of ['42d', 'all', 'DROP TABLE', '7', 12, null, {}]) {
      let thrown: unknown;
      try {
        resolveRange(bad, NOW);
      } catch (error) {
        thrown = error;
      }
      expect(thrown, String(bad)).toBeInstanceOf(ApiError);
      expect((thrown as ApiError).status).toBe(400);
    }
  });

  it('lands the window bounds on Georgian bucket boundaries', () => {
    const { from, to } = resolveRange('7d', NOW);
    expect(from.toISOString()).toBe('2026-08-08T20:00:00.000Z'); // 9 Aug 00:00 +04
    expect(to.toISOString()).toBe('2026-08-15T20:00:00.000Z'); // 16 Aug 00:00 +04
  });

  it('produces millisecond-exact bounds from a ragged clock', () => {
    const { from, to, previousFrom } = resolveRange('30d', new Date('2026-08-15T17:30:00.487Z'));
    for (const bound of [from, to, previousFrom]) {
      expect(bound.getUTCMilliseconds()).toBe(0);
      expect(bound.getUTCSeconds()).toBe(0);
    }
  });

  it('includes the bucket in progress', () => {
    // `to` is exclusive and sits at tomorrow's midnight, so today counts.
    expect(resolveRange('7d', NOW).to.getTime()).toBeGreaterThan(NOW.getTime());
  });

  it('gives the previous window exactly the same length, immediately before', () => {
    for (const range of ['7d', '30d', '90d', '12m'] as const) {
      const { from, to, previousFrom } = resolveRange(range, NOW);
      const length = to.getTime() - from.getTime();
      const previousLength = from.getTime() - previousFrom.getTime();
      // Month buckets have unequal lengths, so allow a day of slack there only.
      const tolerance = range === '12m' ? 3 * 86_400_000 : 0;
      expect(Math.abs(previousLength - length), range).toBeLessThanOrEqual(tolerance);
      expect(previousFrom.getTime(), range).toBeLessThan(from.getTime());
    }
  });
});

describe('fillBuckets', () => {
  const from = new Date('2026-08-08T20:00:00Z'); // 9 Aug 00:00 +04

  it('emits one point per bucket in chronological order', () => {
    const points = fillBuckets([], { from, unit: 'day', buckets: 7 });
    expect(points).toHaveLength(7);
    expect(points.map((point) => point.label)).toEqual([
      '09.08',
      '10.08',
      '11.08',
      '12.08',
      '13.08',
      '14.08',
      '15.08',
    ]);
  });

  it('fills empty buckets with zero and keeps sparse rows in place', () => {
    const points = fillBuckets(
      [
        { bucketStart: new Date('2026-08-08T20:00:00Z'), value: 3 },
        { bucketStart: new Date('2026-08-14T20:00:00Z'), value: 5 },
      ],
      { from, unit: 'day', buckets: 7 },
    );
    expect(points[0].value).toBe(3);
    expect(points[6].value).toBe(5);
    expect(points.slice(1, 6).map((point) => point.value)).toEqual([0, 0, 0, 0, 0]);
  });

  it('sums rows that land in the same bucket', () => {
    const points = fillBuckets(
      [
        { bucketStart: new Date('2026-08-09T04:00:00Z'), value: 2 },
        { bucketStart: new Date('2026-08-09T10:00:00Z'), value: 4 },
      ],
      { from, unit: 'day', buckets: 7 },
    );
    expect(points[0].value).toBe(6);
  });

  it('emits null, never zero, for buckets that ended before tracking began', () => {
    const points = fillBuckets([], {
      from,
      unit: 'day',
      buckets: 7,
      trackedSince: new Date('2026-08-12T20:00:00Z'), // 13 Aug 00:00 +04
    });
    // 9–12 Aug all closed at or before tracking started: unknown, not none.
    // The 12 Aug bucket ends exactly at the tracking instant, so it too holds no
    // tracked time.
    expect(points.slice(0, 4).map((point) => point.value)).toEqual([null, null, null, null]);
    // From the 13th onward a zero is a real observation.
    expect(points.slice(4).map((point) => point.value)).toEqual([0, 0, 0]);
  });

  it('still reports a recorded row inside an untracked bucket', () => {
    const points = fillBuckets([{ bucketStart: from, value: 1 }], {
      from,
      unit: 'day',
      buckets: 7,
      trackedSince: new Date('2026-08-12T20:00:00Z'),
    });
    expect(points[0].value).toBe(1);
  });
});

describe('delta', () => {
  it('reports no comparison rather than a percentage against zero', () => {
    expect(delta(9, 0)).toEqual({ current: 9, previous: 0, changePct: null, direction: 'up' });
  });

  it('signs the change and names the direction', () => {
    expect(delta(150, 100)).toMatchObject({ changePct: 50, direction: 'up' });
    expect(delta(50, 100)).toMatchObject({ changePct: -50, direction: 'down' });
    expect(delta(7, 7)).toMatchObject({ changePct: 0, direction: 'flat' });
  });

  it('never produces NaN or Infinity', () => {
    for (const [current, previous] of [
      [0, 0],
      [0, 5],
      [5, 0],
    ]) {
      const result = delta(current, previous);
      expect(result.changePct === null || Number.isFinite(result.changePct)).toBe(true);
    }
  });
});

describe('share', () => {
  it('is null when there is no whole', () => {
    expect(share(0, 0)).toBeNull();
    expect(share(3, 0)).toBeNull();
  });

  it('rounds to a whole percentage', () => {
    expect(share(1, 3)).toBe(33);
    expect(share(2, 4)).toBe(50);
  });
});

describe('toDistribution / foldRoleStatus', () => {
  it('merges duplicate keys and sorts by size', () => {
    expect(
      toDistribution([
        { key: 'A', value: 1 },
        { key: 'B', value: 5 },
        { key: 'A', value: 2 },
      ]),
    ).toEqual([
      { key: 'B', value: 5 },
      { key: 'A', value: 3 },
    ]);
  });

  it('folds one grouped read into two distributions with matching totals', () => {
    const { roles, statuses } = foldRoleStatus([
      { role: 'USER', status: 'ACTIVE', count: 10 },
      { role: 'USER', status: 'INVITED', count: 4 },
      { role: 'JUDGE', status: 'ACTIVE', count: 2 },
    ]);
    const sum = (rows: { value: number }[]) => rows.reduce((total, row) => total + row.value, 0);
    expect(sum(roles)).toBe(16);
    expect(sum(statuses)).toBe(16);
    expect(roles).toEqual([
      { key: 'USER', value: 14 },
      { key: 'JUDGE', value: 2 },
    ]);
  });
});

describe('topN', () => {
  it('takes the largest rows without mutating the input', () => {
    const rows = [{ n: 1 }, { n: 9 }, { n: 5 }];
    expect(topN(rows, 2, (row) => row.n)).toEqual([{ n: 9 }, { n: 5 }]);
    expect(rows[0].n).toBe(1);
  });
});

describe('bucketLabel', () => {
  it('is locale-neutral and numeric', () => {
    expect(bucketLabel(new Date('2026-08-08T20:00:00Z'), 'day')).toBe('09.08');
    expect(bucketLabel(new Date('2026-07-31T20:00:00Z'), 'month')).toBe('2026-08');
  });
});

describe('toCount / toNullableNumber', () => {
  it('normalises what the driver returns for count(*)', () => {
    expect(toCount(7)).toBe(7);
    expect(toCount('7')).toBe(7);
    expect(toCount(7n)).toBe(7);
    expect(toCount(null)).toBe(0);
    expect(toCount('nonsense')).toBe(0);
  });

  it('keeps null distinct from zero for measured aggregates', () => {
    expect(toNullableNumber(null)).toBeNull();
    expect(toNullableNumber(undefined)).toBeNull();
    expect(toNullableNumber('2.5')).toBe(2.5);
    expect(toNullableNumber(0)).toBe(0);
  });
});
