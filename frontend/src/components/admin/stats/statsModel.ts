import type { ChartTone, ShareSegment } from '@/components/shared/dashboard/DashboardCharts';
import type { tournamentCopy } from '@/lib/i18n/tournament';
import type { Distribution, SeriesPoint } from '@/types/adminStats';

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
