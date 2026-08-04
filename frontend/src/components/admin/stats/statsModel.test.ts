import { describe, expect, it } from 'vitest';
import { fillTemplate } from '@/lib/i18n/tournament';
import {
  formatAgeSeconds,
  formatDuration,
  labelFor,
  seriesTotal,
  sumDistribution,
  toSegments,
  valueFor,
} from './statsModel';

const durations = { minutes: '{count} min', hours: '{count} h', days: '{count} days' };

describe('labelFor', () => {
  it('falls back to the raw key rather than rendering nothing', () => {
    // A status the server knows and the UI does not must still be visible.
    expect(labelFor({ ACTIVE: 'Active' }, 'ACTIVE')).toBe('Active');
    expect(labelFor({ ACTIVE: 'Active' }, 'SOMETHING_NEW')).toBe('SOMETHING_NEW');
  });
});

describe('toSegments', () => {
  it('labels and tones each entry, keeping unknown keys with a fallback tone', () => {
    const segments = toSegments(
      [
        { key: 'APPROVED', value: 10 },
        { key: 'MYSTERY', value: 1 },
      ],
      { APPROVED: 'Approved' },
      { APPROVED: 'teal' },
    );
    expect(segments).toEqual([
      { key: 'APPROVED', name: 'Approved', value: 10, tone: 'teal' },
      { key: 'MYSTERY', name: 'MYSTERY', value: 1, tone: 'info' },
    ]);
  });
});

describe('sumDistribution / valueFor', () => {
  const distribution = [
    { key: 'A', value: 3 },
    { key: 'B', value: 4 },
  ];

  it('sums and looks up', () => {
    expect(sumDistribution(distribution)).toBe(7);
    expect(valueFor(distribution, 'B')).toBe(4);
  });

  it('treats a missing key as zero', () => {
    expect(valueFor(distribution, 'C')).toBe(0);
    expect(sumDistribution([])).toBe(0);
  });
});

describe('seriesTotal', () => {
  it('ignores untracked buckets instead of counting them as zero', () => {
    // Summing `null` as 0 would claim nothing happened in a period nobody measured.
    expect(
      seriesTotal([
        { bucketStart: 'a', label: '01.07', value: null },
        { bucketStart: 'b', label: '02.07', value: 3 },
        { bucketStart: 'c', label: '03.07', value: 0 },
      ]),
    ).toBe(3);
  });

  it('is zero for an empty series', () => {
    expect(seriesTotal([])).toBe(0);
  });
});

describe('formatDuration', () => {
  it('is null when there is nothing to measure', () => {
    expect(formatDuration(null, durations, fillTemplate)).toBeNull();
  });

  it('uses minutes below an hour, hours below two days, days above', () => {
    expect(formatDuration(0.5, durations, fillTemplate)).toBe('30 min');
    expect(formatDuration(2.44, durations, fillTemplate)).toBe('2.4 h');
    expect(formatDuration(47, durations, fillTemplate)).toBe('47 h');
    expect(formatDuration(72, durations, fillTemplate)).toBe('3 days');
  });

  it('never rounds a real duration away to zero', () => {
    expect(formatDuration(0.001, durations, fillTemplate)).toBe('1 min');
  });

  it('never emits NaN', () => {
    for (const hours of [0, 0.4, 1, 23.9, 48, 1000]) {
      expect(formatDuration(hours, durations, fillTemplate)).not.toMatch(/NaN|undefined/);
    }
  });
});

describe('formatAgeSeconds', () => {
  it('converts an age in seconds through the same vocabulary', () => {
    expect(formatAgeSeconds(null, durations, fillTemplate)).toBeNull();
    expect(formatAgeSeconds(9_000, durations, fillTemplate)).toBe('2.5 h');
    expect(formatAgeSeconds(120, durations, fillTemplate)).toBe('2 min');
  });
});
