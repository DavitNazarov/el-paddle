/**
 * Mirror of the backend `PlatformStats` contract
 * (`backend/src/modules/dashboard/dashboard.stats.service.ts`). Hand-written, in
 * line with the other DTOs in this folder.
 */

export type StatsRange = '7d' | '30d' | '90d' | '12m';

export type BucketUnit = 'day' | 'week' | 'month';

export type SeriesPoint = {
  bucketStart: string;
  /** Locale-neutral numeric tick, computed server-side so the browser never
   *  re-derives a calendar day from an instant in its own timezone. */
  label: string;
  /** `null` means the period was not tracked. Never render it as zero. */
  value: number | null;
};

export type Delta = {
  current: number;
  previous: number;
  /** `null` when the previous period held nothing to compare against. */
  changePct: number | null;
  direction: 'up' | 'down' | 'flat';
};

/** `{ key, value }` pairs rather than a fixed record, so a new server-side enum
 *  value cannot break this contract. Keys are raw enum names. */
export type Distribution = { key: string; value: number }[];

export type PlatformStats = {
  range: StatsRange;
  bucket: BucketUnit;
  from: string;
  to: string;
  timeZone: string;
  generatedAt: string;

  headline: {
    newAccounts: Delta;
    deletedAccounts: Delta & { trackedSince: string };
    signedIn: { count: number; totalAccounts: number; neverSeen: number; trackedSince: string };
    entries: Delta;
  };

  people: {
    joinedAndLeft: { joined: SeriesPoint[]; deleted: SeriesPoint[] };
    composition: { roles: Distribution; statuses: Distribution };
    signupRoute: { google: number; password: number };
    invites: { sent: number; accepted: number; expiredUnused: number };
    clubs: { total: number; created: number; playersWithoutClub: number };
    applications: { approved: number; rejected: number; waiting: number };
    clubMembersRemoved: number;
  };

  tournaments: {
    entriesPerBucket: SeriesPoint[];
    entryOutcomes: Distribution;
    reviewLatency: { decided: number; medianHours: number | null; p90Hours: number | null };
    events: {
      byStatus: Distribution;
      drafts: number;
      overdue: number;
      publishedWithoutDraw: number;
    };
    matches: { finished: number; byResultType: Distribution };
    opponentRequests: Distribution;
    topClubs: { clubId: string; name: string; entries: number }[];
  };

  operations: {
    email: { byStatus: Distribution; failedAfterRetries: number };
    outbox: { pending: number; failed: number; oldestPendingAgeSeconds: number | null };
  };
};
