import type { ChartTone, ShareSegment } from '@/components/shared/dashboard/DashboardCharts';
import type { tournamentCopy } from '@/lib/i18n/tournament';
import type { Distribution, PlatformStats, SeriesPoint } from '@/types/adminStats';

/** Relax `as const` string literals back to `string`. The `en` block is `as
 *  const` and `ka` is not, so without this the two locales are unrelated types
 *  and `tournamentCopy[locale]` fits neither. */
type Widen<T> = T extends string ? string : { -readonly [K in keyof T]: Widen<T[K]> };

/** The statistics copy block, derived from the dictionary rather than restated,
 *  so a renamed key is a type error instead of a blank label. */
export type StatsCopy = Widen<(typeof tournamentCopy)['en']['admin']['stats']>;

type Labels = Readonly<Record<string, string>>;

/**
 * Pure reading for the statistics panels: how a raw enum distribution becomes a
 * labelled, toned set of segments, and how a duration becomes a sentence. Kept
 * out of the components so it is testable without a DOM or a locale provider.
 */

/** Look a key up in a copy record, falling back to the raw enum name rather than
 *  rendering nothing when the server introduces a value the UI has not learnt. */
export function labelFor(labels: Labels, key: string) {
  return labels[key] ?? key;
}

export function toSegments(
  distribution: Distribution,
  labels: Labels,
  tones: Readonly<Record<string, ChartTone>>,
  fallbackTone: ChartTone = 'info',
): ShareSegment[] {
  return distribution.map((entry) => ({
    key: entry.key,
    name: labelFor(labels, entry.key),
    value: entry.value,
    tone: tones[entry.key] ?? fallbackTone,
  }));
}

export function sumDistribution(distribution: Distribution) {
  return distribution.reduce((total, entry) => total + entry.value, 0);
}

export function valueFor(distribution: Distribution, key: string) {
  return distribution.find((entry) => entry.key === key)?.value ?? 0;
}

/** Series totals ignore untracked buckets: summing `null` as zero would state
 *  that nothing happened in a period nobody measured. */
export function seriesTotal(points: SeriesPoint[]) {
  return points.reduce((total, point) => total + (point.value ?? 0), 0);
}

/**
 * Hours as something a human reads. Below a day it stays in hours, above it
 * switches to days, because "73.4 h" makes a reader do arithmetic.
 */
export function formatDuration(
  hours: number | null,
  copy: Readonly<{ hours: string; days: string; minutes: string }>,
  fill: (template: string, values: Record<string, string | number>) => string,
) {
  if (hours === null) return null;
  if (hours < 1) return fill(copy.minutes, { count: Math.max(Math.round(hours * 60), 1) });
  if (hours < 48) return fill(copy.hours, { count: Math.round(hours * 10) / 10 });
  return fill(copy.days, { count: Math.round((hours / 24) * 10) / 10 });
}

export function formatAgeSeconds(
  seconds: number | null,
  copy: Readonly<{ hours: string; days: string; minutes: string }>,
  fill: (template: string, values: Record<string, string | number>) => string,
) {
  if (seconds === null) return null;
  return formatDuration(seconds / 3600, copy, fill);
}

/** One thing that has stopped moving on its own, with somewhere to go about it. */
export type WatchSignal = {
  key: string;
  label: string;
  count: number;
  /** Where the reader fixes it. Absent when the product has no screen for it. */
  href?: string;
};

/**
 * Every count on this screen that means "someone has to do something", pulled
 * out of the three domains it is scattered across and put in one place.
 *
 * This is the question the statistics exist to answer — "is anything quietly
 * rotting?" — and it cannot be answered by a reader who has to hold seven
 * numbers from three different panels in their head. A zero is not a signal, so
 * only non-zero counts are returned; an empty result is the all-clear.
 *
 * Ordered by who is blocked: a person waiting outranks an event waiting, which
 * outranks a machine waiting.
 */
export function collectWatchSignals(
  stats: PlatformStats,
  labels: Readonly<{
    applications: string;
    playersWithoutClub: string;
    invitesExpired: string;
    overdue: string;
    noBracket: string;
    emailFailed: string;
    outboxPending: string;
    outboxFailed: string;
  }>,
): WatchSignal[] {
  const candidates: WatchSignal[] = [
    // Nobody exists in the product until an admin approves them.
    { key: 'applications', label: labels.applications, count: stats.people.applications.waiting, href: '/admin/applications' },
    // A player with no club cannot enter anything, so this is a support queue.
    { key: 'playersWithoutClub', label: labels.playersWithoutClub, count: stats.people.clubs.playersWithoutClub, href: '/admin/users/players' },
    { key: 'overdue', label: labels.overdue, count: stats.tournaments.events.overdue, href: '/admin/events' },
    { key: 'noBracket', label: labels.noBracket, count: stats.tournaments.events.publishedWithoutDraw, href: '/admin/brackets' },
    { key: 'invitesExpired', label: labels.invitesExpired, count: stats.people.invites.expiredUnused },
    // No link on the last three: the app has no delivery-log or outbox screen,
    // and a shortcut that 404s reads as broken rather than as help.
    { key: 'emailFailed', label: labels.emailFailed, count: stats.operations.email.failedAfterRetries },
    { key: 'outboxFailed', label: labels.outboxFailed, count: stats.operations.outbox.failed },
    { key: 'outboxPending', label: labels.outboxPending, count: stats.operations.outbox.pending },
  ];

  return candidates.filter((signal) => signal.count > 0);
}
