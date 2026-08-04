import { describe, expect, it } from 'vitest';
import { fillTemplate } from '@/lib/i18n/tournament';
import type { PlatformStats } from '@/types/adminStats';
import {
  collectWatchSignals,
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

describe('collectWatchSignals', () => {
  const watchLabels = {
    applications: 'Club requests waiting',
    playersWithoutClub: 'Players with no club',
    invitesExpired: 'Invitations expired',
    overdue: 'Events past their date',
    noBracket: 'Published with no draw',
    emailFailed: 'Emails failed',
    outboxPending: 'Jobs waiting',
    outboxFailed: 'Jobs given up',
  };

  /** Only the counts the watch list reads; the rest of the payload is irrelevant
   *  to it and stubbing it would only make the fixture harder to read. */
  function statsWith(counts: {
    applicationsWaiting?: number;
    playersWithoutClub?: number;
    invitesExpired?: number;
    overdue?: number;
    noBracket?: number;
    emailFailed?: number;
    outboxPending?: number;
    outboxFailed?: number;
  }) {
    return {
      people: {
        applications: { approved: 0, rejected: 0, waiting: counts.applicationsWaiting ?? 0 },
        clubs: { total: 0, created: 0, playersWithoutClub: counts.playersWithoutClub ?? 0 },
        invites: { sent: 0, accepted: 0, expiredUnused: counts.invitesExpired ?? 0 },
      },
      tournaments: {
        events: {
          byStatus: [],
          drafts: 0,
          overdue: counts.overdue ?? 0,
          publishedWithoutDraw: counts.noBracket ?? 0,
        },
      },
      operations: {
        email: { byStatus: [], failedAfterRetries: counts.emailFailed ?? 0 },
        outbox: {
          pending: counts.outboxPending ?? 0,
          failed: counts.outboxFailed ?? 0,
          oldestPendingAgeSeconds: null,
        },
      },
    } as unknown as PlatformStats;
  }

  it('is empty when nothing is stuck, which is the all-clear', () => {
    expect(collectWatchSignals(statsWith({}), watchLabels)).toEqual([]);
  });

  it('drops every zero rather than listing a signal that says nothing', () => {
    const signals = collectWatchSignals(statsWith({ overdue: 2 }), watchLabels);
    expect(signals).toHaveLength(1);
    expect(signals[0]).toMatchObject({ key: 'overdue', count: 2, label: 'Events past their date' });
  });

  it('orders by who is blocked: a person, then an event, then a machine', () => {
    const signals = collectWatchSignals(
      statsWith({
        outboxPending: 5,
        overdue: 1,
        applicationsWaiting: 2,
        playersWithoutClub: 3,
      }),
      watchLabels,
    );
    expect(signals.map((signal) => signal.key)).toEqual([
      'applications',
      'playersWithoutClub',
      'overdue',
      'outboxPending',
    ]);
  });

  it('links only where the product has a screen to land on', () => {
    const signals = collectWatchSignals(
      statsWith({ applicationsWaiting: 1, emailFailed: 1, outboxFailed: 1 }),
      watchLabels,
    );
    const byKey = Object.fromEntries(signals.map((signal) => [signal.key, signal.href]));
    expect(byKey.applications).toBe('/admin/applications');
    // No delivery log and no outbox screen exist; a link here would 404.
    expect(byKey.emailFailed).toBeUndefined();
    expect(byKey.outboxFailed).toBeUndefined();
  });
});
