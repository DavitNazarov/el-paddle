import { withTimeout } from '../../common/timeout.js';
import { prisma } from '../../database/prisma.js';
import {
  AccountProvider,
  ClubApplicationStatus,
  DeliveryStatus,
  MatchStatus,
  OutboxStatus,
  Prisma,
  UserRole,
} from '../../generated/prisma/client.js';
import { readStatsCache, writeStatsCache } from './statsCache.js';
import {
  delta,
  fillBuckets,
  foldRoleStatus,
  rangeShape,
  resolveRange,
  STATS_TIME_ZONE,
  toCount,
  toDistribution,
  toNullableNumber,
  topN,
  TRACKING_STARTED_AT,
  type BucketUnit,
  type Delta,
  type Distribution,
  type SeriesPoint,
  type StatsRange,
} from './statsModel.js';

/**
 * Platform statistics for the administrator home screen: how the platform moved
 * over a window, and what is quietly rotting.
 *
 * Every statement below returns a scalar, a single row, or one row per distinct
 * enum value, so the cost does not grow with the roster — the same rule
 * `getEventOperations` follows. All the bucket and delta arithmetic lives in
 * `statsModel.ts` so it is unit-tested without a database.
 */

export type PlatformStats = {
  range: StatsRange;
  bucket: BucketUnit;
  from: string;
  /** Exclusive. */
  to: string;
  timeZone: string;
  generatedAt: string;

  headline: {
    newAccounts: Delta;
    deletedAccounts: Delta & { trackedSince: string };
    /** No delta: `lastLoginAt` holds only the latest sign-in, so the previous
     *  window is genuinely unknowable and a delta would be invented. */
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

/** Audit actions the statistics count. Each is already written by the domain. */
const AUDIT_ACTIONS = {
  userDeleted: 'user.deleted',
  applicationApproved: 'club_application.approve',
  applicationRejected: 'club_application.reject',
  memberRemoved: 'club.member_removed',
} as const;

const TOP_CLUB_COUNT = 5;

/**
 * Bind a JS instant as a naive UTC timestamp, which is how Prisma stores
 * DateTime. Comparing the column against a `timestamptz` would make the result
 * depend on the session's TimeZone setting, and computing an expression on the
 * column instead would give up the index.
 */
function at(date: Date) {
  return Prisma.sql`${date.toISOString()}::timestamptz AT TIME ZONE 'UTC'`;
}

/**
 * The instant a bucket began, in Georgian local time. The unit is a bound
 * parameter (`date_trunc` takes text), so no request-derived string is ever
 * interpolated into SQL.
 */
function bucketOf(column: Prisma.Sql, unit: BucketUnit) {
  return Prisma.sql`(date_trunc(${unit}, (${column} AT TIME ZONE 'UTC') AT TIME ZONE ${STATS_TIME_ZONE}) AT TIME ZONE ${STATS_TIME_ZONE})`;
}

type UserFactsRow = {
  new_current: unknown;
  new_previous: unknown;
  total: unknown;
  signed_in: unknown;
  never_seen: unknown;
  players_without_club: unknown;
};

type AuditFactsRow = { action: string; current: unknown; previous: unknown };

type SeriesRow = { series: string; bucket_start: Date; value: unknown };

type RegistrationFactsRow = {
  entries_current: unknown;
  entries_previous: unknown;
  decided: unknown;
  median_hours: unknown;
  p90_hours: unknown;
};

type EventHealthRow = { overdue: unknown; published_without_draw: unknown };

type InviteFactsRow = { sent: unknown; accepted: unknown; expired_unused: unknown };

type ClubFactsRow = { total: unknown; created: unknown };

type OutboxRow = { status: string; value: unknown; oldest: Date | null };

export async function getPlatformStats(rawRange: unknown): Promise<PlatformStats> {
  const { range, bucket, from, to, previousFrom } = resolveRange(rawRange);

  const cached = readStatsCache<PlatformStats>(range);
  if (cached) return cached;

  const stats = await withTimeout(readPlatformStats(range, bucket, from, to, previousFrom), 8_000, 'platform statistics');
  return writeStatsCache(range, stats);
}

async function readPlatformStats(
  range: StatsRange,
  bucket: BucketUnit,
  from: Date,
  to: Date,
  previousFrom: Date,
): Promise<PlatformStats> {
  const window = { gte: from, lt: to };

  const [
    userFacts,
    roleStatusGroups,
    auditFacts,
    seriesRows,
    registrationFacts,
    entryStatusGroups,
    eventGroups,
    eventHealth,
    matchGroups,
    requestGroups,
    clubEntryGroups,
    deliveryGroups,
    failedAfterRetries,
    outboxRows,
    inviteFacts,
    clubFacts,
    waitingApplications,
    googleSignups,
  ] = await Promise.all([
    // One pass over User answers six questions; six separate counts would be six.
    prisma.$queryRaw<UserFactsRow[]>`
      SELECT
        count(*) FILTER (WHERE u."createdAt" >= ${at(from)} AND u."createdAt" < ${at(to)}) AS new_current,
        count(*) FILTER (WHERE u."createdAt" >= ${at(previousFrom)} AND u."createdAt" < ${at(from)}) AS new_previous,
        count(*) AS total,
        count(*) FILTER (WHERE u."lastLoginAt" >= ${at(from)}) AS signed_in,
        count(*) FILTER (WHERE u."lastLoginAt" IS NULL) AS never_seen,
        count(*) FILTER (
          WHERE u."role" = ${UserRole.USER}::"UserRole"
            AND NOT EXISTS (SELECT 1 FROM "ClubMember" cm WHERE cm."userId" = u."id")
        ) AS players_without_club
      FROM "User" u
    `,
    prisma.user.groupBy({ by: ['role', 'status'], _count: { _all: true } }),
    prisma.$queryRaw<AuditFactsRow[]>`
      SELECT
        a."action" AS action,
        count(*) FILTER (WHERE a."createdAt" >= ${at(from)} AND a."createdAt" < ${at(to)}) AS current,
        count(*) FILTER (WHERE a."createdAt" >= ${at(previousFrom)} AND a."createdAt" < ${at(from)}) AS previous
      FROM "AuditLog" a
      WHERE a."action" IN (${Prisma.join(Object.values(AUDIT_ACTIONS))})
        AND a."createdAt" >= ${at(previousFrom)}
        AND a."createdAt" < ${at(to)}
      GROUP BY a."action"
    `,
    // All three series in one statement; each arm hits its own index.
    prisma.$queryRaw<SeriesRow[]>`
      SELECT 'joined' AS series, ${bucketOf(Prisma.sql`u."createdAt"`, bucket)} AS bucket_start, count(*) AS value
      FROM "User" u
      WHERE u."createdAt" >= ${at(from)} AND u."createdAt" < ${at(to)}
      GROUP BY 1, 2
      UNION ALL
      SELECT 'deleted', ${bucketOf(Prisma.sql`a."createdAt"`, bucket)}, count(*)
      FROM "AuditLog" a
      WHERE a."action" = ${AUDIT_ACTIONS.userDeleted}
        AND a."createdAt" >= ${at(from)} AND a."createdAt" < ${at(to)}
      GROUP BY 1, 2
      UNION ALL
      SELECT 'entries', ${bucketOf(Prisma.sql`r."createdAt"`, bucket)}, count(*)
      FROM "EventRegistration" r
      WHERE r."createdAt" >= ${at(from)} AND r."createdAt" < ${at(to)}
      GROUP BY 1, 2
    `,
    prisma.$queryRaw<RegistrationFactsRow[]>`
      SELECT
        count(*) FILTER (WHERE r."createdAt" >= ${at(from)} AND r."createdAt" < ${at(to)}) AS entries_current,
        count(*) FILTER (WHERE r."createdAt" >= ${at(previousFrom)} AND r."createdAt" < ${at(from)}) AS entries_previous,
        count(*) FILTER (WHERE r."reviewedAt" >= ${at(from)} AND r."reviewedAt" < ${at(to)}) AS decided,
        percentile_cont(0.5) WITHIN GROUP (
          ORDER BY EXTRACT(EPOCH FROM (r."reviewedAt" - r."createdAt")) / 3600
        ) FILTER (WHERE r."reviewedAt" >= ${at(from)} AND r."reviewedAt" < ${at(to)}) AS median_hours,
        percentile_cont(0.9) WITHIN GROUP (
          ORDER BY EXTRACT(EPOCH FROM (r."reviewedAt" - r."createdAt")) / 3600
        ) FILTER (WHERE r."reviewedAt" >= ${at(from)} AND r."reviewedAt" < ${at(to)}) AS p90_hours
      FROM "EventRegistration" r
      WHERE (r."createdAt" >= ${at(previousFrom)} AND r."createdAt" < ${at(to)})
         OR (r."reviewedAt" >= ${at(from)} AND r."reviewedAt" < ${at(to)})
    `,
    prisma.eventRegistration.groupBy({ by: ['status'], where: { createdAt: window }, _count: { _all: true } }),
    prisma.event.groupBy({ by: ['status', 'isPublished'], _count: { _all: true } }),
    prisma.$queryRaw<EventHealthRow[]>`
      SELECT
        count(*) FILTER (WHERE e."date" < now() AND e."status" <> 'COMPLETED') AS overdue,
        count(*) FILTER (
          WHERE e."isPublished"
            AND e."status" IN ('REGISTRATION_CLOSED', 'ONGOING')
            AND NOT EXISTS (SELECT 1 FROM "Bracket" b WHERE b."eventId" = e."id")
        ) AS published_without_draw
      FROM "Event" e
    `,
    // The existing [status, completedAt, id] index serves this because status is pinned.
    prisma.match.groupBy({
      by: ['resultType'],
      where: { status: MatchStatus.COMPLETED, completedAt: window },
      _count: { _all: true },
    }),
    prisma.opponentRequest.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.eventRegistration.groupBy({
      by: ['clubId'],
      where: { createdAt: window, clubId: { not: null } },
      _count: { _all: true },
    }),
    prisma.emailDelivery.groupBy({ by: ['status'], where: { createdAt: window }, _count: { _all: true } }),
    prisma.emailDelivery.count({
      where: { status: DeliveryStatus.FAILED, attemptCount: { gte: 3 } },
    }),
    prisma.$queryRaw<OutboxRow[]>`
      SELECT o."status"::text AS status, count(*) AS value, min(o."createdAt") AS oldest
      FROM "OutboxMessage" o
      GROUP BY o."status"
    `,
    prisma.$queryRaw<InviteFactsRow[]>`
      SELECT
        count(*) FILTER (WHERE i."createdAt" >= ${at(from)} AND i."createdAt" < ${at(to)}) AS sent,
        count(*) FILTER (WHERE i."usedAt" >= ${at(from)} AND i."usedAt" < ${at(to)}) AS accepted,
        count(*) FILTER (WHERE i."usedAt" IS NULL AND i."expiresAt" < now()) AS expired_unused
      FROM "InviteToken" i
    `,
    prisma.$queryRaw<ClubFactsRow[]>`
      SELECT
        count(*) AS total,
        count(*) FILTER (WHERE c."createdAt" >= ${at(from)} AND c."createdAt" < ${at(to)}) AS created
      FROM "Club" c
    `,
    prisma.clubApplication.count({ where: { status: ClubApplicationStatus.SUBMITTED } }),
    prisma.oAuthAccount.count({ where: { provider: AccountProvider.GOOGLE, createdAt: window } }),
  ]);

  const users = userFacts[0];
  const registrations = registrationFacts[0];
  const health = eventHealth[0];
  const invites = inviteFacts[0];
  const clubs = clubFacts[0];

  const audit = (action: string) => {
    const row = auditFacts.find((candidate) => candidate.action === action);
    return { current: toCount(row?.current), previous: toCount(row?.previous) };
  };
  const deletions = audit(AUDIT_ACTIONS.userDeleted);

  const { buckets } = rangeShape(range);
  const seriesFor = (name: string, trackedSince?: Date) =>
    fillBuckets(
      seriesRows
        .filter((row) => row.series === name)
        .map((row) => ({ bucketStart: row.bucket_start, value: toCount(row.value) })),
      { from, unit: bucket, buckets, trackedSince },
    );

  const newAccounts = toCount(users?.new_current);
  const entriesCurrent = toCount(registrations?.entries_current);
  const trackedSince = TRACKING_STARTED_AT.toISOString();

  // Top clubs: bounded by the club count, sliced to five *before* the only
  // statement that reads club rows.
  const topClubRows = topN(
    clubEntryGroups.filter((row): row is typeof row & { clubId: string } => Boolean(row.clubId)),
    TOP_CLUB_COUNT,
    (row) => row._count._all,
  );
  const clubNames = topClubRows.length
    ? await prisma.club.findMany({
        where: { id: { in: topClubRows.map((row) => row.clubId) } },
        select: { id: true, name: true },
      })
    : [];
  const nameOfClub = new Map(clubNames.map((club) => [club.id, club.name]));

  const outboxCount = (status: OutboxStatus) =>
    toCount(outboxRows.find((row) => row.status === status)?.value);
  const oldestPending = outboxRows.find((row) => row.status === OutboxStatus.PENDING)?.oldest ?? null;

  return {
    range,
    bucket,
    from: from.toISOString(),
    to: to.toISOString(),
    timeZone: STATS_TIME_ZONE,
    generatedAt: new Date().toISOString(),

    headline: {
      newAccounts: delta(newAccounts, toCount(users?.new_previous)),
      deletedAccounts: { ...delta(deletions.current, deletions.previous), trackedSince },
      signedIn: {
        count: toCount(users?.signed_in),
        totalAccounts: toCount(users?.total),
        neverSeen: toCount(users?.never_seen),
        trackedSince,
      },
      entries: delta(entriesCurrent, toCount(registrations?.entries_previous)),
    },

    people: {
      joinedAndLeft: {
        joined: seriesFor('joined'),
        // Deletions were not recorded before tracking began, so those buckets
        // must read "unknown" rather than draw a flat zero line.
        deleted: seriesFor('deleted', TRACKING_STARTED_AT),
      },
      composition: foldRoleStatus(
        roleStatusGroups.map((row) => ({
          role: row.role,
          status: row.status,
          count: row._count._all,
        })),
      ),
      signupRoute: {
        google: googleSignups,
        password: Math.max(newAccounts - googleSignups, 0),
      },
      invites: {
        sent: toCount(invites?.sent),
        accepted: toCount(invites?.accepted),
        expiredUnused: toCount(invites?.expired_unused),
      },
      clubs: {
        total: toCount(clubs?.total),
        created: toCount(clubs?.created),
        playersWithoutClub: toCount(users?.players_without_club),
      },
      applications: {
        approved: audit(AUDIT_ACTIONS.applicationApproved).current,
        rejected: audit(AUDIT_ACTIONS.applicationRejected).current,
        waiting: waitingApplications,
      },
      // No `trackedSince` here on purpose: club.member_removed predates this
      // feature, so its history is genuinely complete.
      clubMembersRemoved: audit(AUDIT_ACTIONS.memberRemoved).current,
    },

    tournaments: {
      entriesPerBucket: seriesFor('entries'),
      entryOutcomes: toDistribution(
        entryStatusGroups.map((row) => ({ key: row.status, value: row._count._all })),
      ),
      reviewLatency: {
        decided: toCount(registrations?.decided),
        medianHours: roundHours(toNullableNumber(registrations?.median_hours)),
        p90Hours: roundHours(toNullableNumber(registrations?.p90_hours)),
      },
      events: {
        byStatus: toDistribution(
          eventGroups.map((row) => ({ key: row.status, value: row._count._all })),
        ),
        drafts: eventGroups
          .filter((row) => !row.isPublished)
          .reduce((total, row) => total + row._count._all, 0),
        overdue: toCount(health?.overdue),
        publishedWithoutDraw: toCount(health?.published_without_draw),
      },
      matches: {
        finished: matchGroups.reduce((total, row) => total + row._count._all, 0),
        byResultType: toDistribution(
          matchGroups.map((row) => ({ key: row.resultType ?? 'NORMAL', value: row._count._all })),
        ),
      },
      opponentRequests: toDistribution(
        requestGroups.map((row) => ({ key: row.status, value: row._count._all })),
      ),
      topClubs: topClubRows.map((row) => ({
        clubId: row.clubId,
        name: nameOfClub.get(row.clubId) ?? '—',
        entries: row._count._all,
      })),
    },

    operations: {
      email: {
        byStatus: toDistribution(
          deliveryGroups.map((row) => ({ key: row.status, value: row._count._all })),
        ),
        failedAfterRetries,
      },
      outbox: {
        pending: outboxCount(OutboxStatus.PENDING),
        failed: outboxCount(OutboxStatus.FAILED),
        oldestPendingAgeSeconds: oldestPending
          ? Math.max(Math.round((Date.now() - new Date(oldestPending).getTime()) / 1000), 0)
          : null,
      },
    },
  };
}

/** One decimal is as much precision as a latency figure can honestly carry. */
function roundHours(value: number | null) {
  if (value === null) return null;
  return Math.round(value * 10) / 10;
}
