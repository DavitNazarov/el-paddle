import { ApiError } from '../../common/http.js';

/**
 * Pure reading for the platform statistics endpoint: window resolution, bucket
 * boundaries, gap filling and deltas. No Prisma import, so every rule below is
 * unit-testable without a database.
 */

/**
 * Buckets and window bounds are Georgian local time, not UTC. Every reader is in
 * Georgia and `Event.timeZone` already defaults here; a UTC day boundary lands at
 * 04:00 local and would split one evening's signups across two bars, which is
 * visibly wrong to the only people looking at it.
 */
export const STATS_TIME_ZONE = 'Asia/Tbilisi';

/**
 * Account deletions and sign-ins were not recorded before the
 * 20260730121727_platform_stats_tracking migration: deletion was a hard delete
 * with no audit row, and no login was ever persisted. Anything before this date
 * is *unknown*, never zero, and the payload carries it so the screen can say so.
 */
export const TRACKING_STARTED_AT = new Date('2026-07-30T00:00:00+04:00');

export const STATS_RANGES = ['7d', '30d', '90d', '12m'] as const;
export type StatsRange = (typeof STATS_RANGES)[number];

export type BucketUnit = 'day' | 'week' | 'month';

export type ResolvedRange = {
  range: StatsRange;
  bucket: BucketUnit;
  /** Inclusive start of the window. */
  from: Date;
  /** Exclusive end of the window. */
  to: Date;
  /** Inclusive start of the immediately preceding window of the same length. */
  previousFrom: Date;
};

type RangeShape = { bucket: BucketUnit; buckets: number };

// The bucket unit is derived from the preset and never from the request, which
// is what keeps it safe to interpolate into SQL.
const RANGE_SHAPES: Record<StatsRange, RangeShape> = {
  '7d': { bucket: 'day', buckets: 7 },
  '30d': { bucket: 'day', buckets: 30 },
  '90d': { bucket: 'week', buckets: 13 },
  '12m': { bucket: 'month', buckets: 12 },
};

export function rangeShape(range: StatsRange): RangeShape {
  return RANGE_SHAPES[range];
}

function tbilisiParts(date: Date) {
  // Intl rather than a hard-coded +4: Georgia has no DST today, but deriving the
  // parts keeps this correct if that policy ever changes.
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: STATS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts: Record<string, number> = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value);
  }
  return parts;
}

function tbilisiOffsetMs(date: Date) {
  const parts = tbilisiParts(date);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour === 24 ? 0 : parts.hour,
    parts.minute,
    parts.second,
  );
  // Compare against a whole second: `asUtc` has no milliseconds, so measuring
  // against an instant that does would fold that remainder into the offset and
  // every bucket start would inherit it. Bucket starts must be exact, because
  // they are matched by value against the instants Postgres returns.
  const wholeSecond = Math.floor(date.getTime() / 1000) * 1000;
  return asUtc - wholeSecond;
}

/** The instant at which the Georgian calendar day containing `date` began. */
export function startOfTbilisiDay(date: Date) {
  const parts = tbilisiParts(date);
  const guess = new Date(Date.UTC(parts.year, parts.month - 1, parts.day) - tbilisiOffsetMs(date));
  // One correction pass settles the case where the offset differs between the
  // instant and its own midnight.
  const corrected = new Date(Date.UTC(parts.year, parts.month - 1, parts.day) - tbilisiOffsetMs(guess));
  return corrected;
}

/** The instant at which the Georgian week (Monday-based) containing `date` began. */
export function startOfTbilisiWeek(date: Date) {
  const dayStart = startOfTbilisiDay(date);
  const parts = tbilisiParts(dayStart);
  const weekday = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
  const backToMonday = (weekday + 6) % 7;
  return startOfTbilisiDay(new Date(dayStart.getTime() - backToMonday * 86_400_000));
}

/** The instant at which the Georgian month containing `date` began. */
export function startOfTbilisiMonth(date: Date) {
  const parts = tbilisiParts(date);
  const firstOfMonth = new Date(Date.UTC(parts.year, parts.month - 1, 1, 12));
  return startOfTbilisiDay(firstOfMonth);
}

export function startOfBucket(date: Date, unit: BucketUnit) {
  if (unit === 'week') return startOfTbilisiWeek(date);
  if (unit === 'month') return startOfTbilisiMonth(date);
  return startOfTbilisiDay(date);
}

function addBuckets(start: Date, unit: BucketUnit, count: number) {
  if (unit === 'month') {
    const parts = tbilisiParts(start);
    return startOfTbilisiMonth(new Date(Date.UTC(parts.year, parts.month - 1 + count, 1, 12)));
  }
  const days = unit === 'week' ? count * 7 : count;
  return startOfBucket(new Date(start.getTime() + days * 86_400_000), unit);
}

/**
 * Resolve the requested preset into a window and its comparison window. Both end
 * on a bucket boundary, so `from` and the SQL truncation can never disagree and
 * leave the first or last bucket short.
 */
export function resolveRange(raw: unknown, now = new Date()): ResolvedRange {
  const range = parseRange(raw);
  const { bucket, buckets } = RANGE_SHAPES[range];
  const currentBucketStart = startOfBucket(now, bucket);
  // `to` is exclusive and sits at the end of the bucket in progress, so today's
  // partial bucket is included rather than silently dropped.
  const to = addBuckets(currentBucketStart, bucket, 1);
  const from = addBuckets(currentBucketStart, bucket, -(buckets - 1));
  const previousFrom = addBuckets(from, bucket, -buckets);
  return { range, bucket, from, to, previousFrom };
}

function parseRange(raw: unknown): StatsRange {
  if (raw === undefined) return '30d';
  if (typeof raw !== 'string') {
    throw new ApiError(unknownRangeMessage(), 400);
  }
  const value = raw.trim();
  if (!value) return '30d';
  const match = STATS_RANGES.find((candidate) => candidate === value);
  if (!match) throw new ApiError(unknownRangeMessage(), 400);
  return match;
}

function unknownRangeMessage() {
  return `Unknown range. Use ${STATS_RANGES.join(', ')}.`;
}

/** One point of a time series. `null` means "not tracked", never "none". */
export type SeriesPoint = {
  bucketStart: string;
  label: string;
  value: number | null;
};

/** A locale-neutral numeric tick, computed here so the browser never re-derives
 *  a calendar day from an instant in its own timezone. */
export function bucketLabel(start: Date, unit: BucketUnit) {
  const parts = tbilisiParts(start);
  const pad = (value: number) => String(value).padStart(2, '0');
  if (unit === 'month') return `${parts.year}-${pad(parts.month)}`;
  return `${pad(parts.day)}.${pad(parts.month)}`;
}

export type BucketRow = { bucketStart: Date; value: number };

/**
 * Turn the sparse rows a `GROUP BY date_trunc` returns into one point per bucket.
 * Buckets earlier than `trackedSince` are `null` rather than `0`: the screen must
 * not draw a flat line implying nothing happened when the truth is that nothing
 * was recorded.
 */
export function fillBuckets(
  rows: BucketRow[],
  options: { from: Date; unit: BucketUnit; buckets: number; trackedSince?: Date },
): SeriesPoint[] {
  const byBucket = new Map<number, number>();
  for (const row of rows) {
    const key = startOfBucket(row.bucketStart, options.unit).getTime();
    byBucket.set(key, (byBucket.get(key) ?? 0) + row.value);
  }

  const points: SeriesPoint[] = [];
  for (let index = 0; index < options.buckets; index += 1) {
    const start = addBuckets(options.from, options.unit, index);
    const recorded = byBucket.get(start.getTime());
    // A bucket that ended before tracking began holds no information at all.
    // One that merely started before it may hold real rows, so it counts.
    const bucketEnd = addBuckets(start, options.unit, 1);
    const untracked = options.trackedSince ? bucketEnd <= options.trackedSince : false;
    points.push({
      bucketStart: start.toISOString(),
      label: bucketLabel(start, options.unit),
      value: untracked && recorded === undefined ? null : recorded ?? 0,
    });
  }
  return points;
}

export type Delta = {
  current: number;
  previous: number;
  /** `null` when there is nothing to compare against — a percentage would be fiction. */
  changePct: number | null;
  direction: 'up' | 'down' | 'flat';
};

export function delta(current: number, previous: number): Delta {
  const direction = current === previous ? 'flat' : current > previous ? 'up' : 'down';
  const changePct = previous === 0 ? null : Math.round(((current - previous) / previous) * 100);
  return { current, previous, changePct, direction };
}

/** A part of a whole as a percentage, or `null` when there is no whole. */
export function share(part: number, whole: number) {
  if (whole <= 0) return null;
  return Math.round((part / whole) * 100);
}

/** `{ key, value }` pairs rather than a fixed record, so a new enum value in the
 *  database cannot break the contract or silently vanish. */
export type Distribution = { key: string; value: number }[];

export function toDistribution(rows: Array<{ key: string; value: number }>): Distribution {
  const totals = new Map<string, number>();
  for (const row of rows) {
    totals.set(row.key, (totals.get(row.key) ?? 0) + row.value);
  }
  return [...totals.entries()]
    .map(([key, value]) => ({ key, value }))
    .sort((a, b) => b.value - a.value || a.key.localeCompare(b.key));
}

/** Fold one `groupBy(['role', 'status'])` read into the two distributions the
 *  screen actually shows, rather than paying for two reads. */
export function foldRoleStatus(rows: Array<{ role: string; status: string; count: number }>) {
  return {
    roles: toDistribution(rows.map((row) => ({ key: row.role, value: row.count }))),
    statuses: toDistribution(rows.map((row) => ({ key: row.status, value: row.count }))),
  };
}

export function topN<T>(rows: T[], count: number, by: (row: T) => number): T[] {
  return [...rows].sort((a, b) => by(b) - by(a)).slice(0, count);
}

/** Postgres returns `count(*)` as a bigint, which the driver hands back as a
 *  string or BigInt depending on the column. Normalise once, here. */
export function toCount(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

/** Same for a nullable numeric aggregate: `null` stays `null`, because "no rows
 *  to measure" is not "zero hours". */
export function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = toCount(value);
  return Number.isFinite(parsed) ? parsed : null;
}
