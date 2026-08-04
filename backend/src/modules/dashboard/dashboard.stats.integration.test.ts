import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { prisma } from '../../database/prisma.js';
import {
  BracketStatus,
  MatchRound,
  MatchStatus,
  RegistrationStatus,
  UserRole,
} from '../../generated/prisma/client.js';
import {
  authedGet,
  authedSend,
  createAdmin,
  createCategory,
  createEvent,
  createTeam,
  createUser,
  registerTeam,
  resetDb,
} from '../../test/helpers.js';
import { hashSecret } from '../../common/security.js';
import { USER_DELETION_AUDIT_ACTION } from '../users/users.service.js';
import { resetStatsCache } from './statsCache.js';
import { TRACKING_STARTED_AT } from './statsModel.js';

const app = createApp();

beforeEach(async () => {
  await resetDb();
  // `resetDb` truncates tables but cannot clear an in-process Map, so without
  // this every test after the first would read the previous test's numbers.
  resetStatsCache();
});

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000);

async function readStats(range?: string) {
  const admin = await createAdmin();
  const path = range ? `/api/admin/stats/platform?range=${range}` : '/api/admin/stats/platform';
  const res = await authedGet(app, path, admin);
  expect(res.status).toBe(200);
  return res.body.stats as {
    range: string;
    bucket: string;
    from: string;
    to: string;
    generatedAt: string;
    headline: Record<string, { current: number; previous: number } & Record<string, unknown>>;
    people: Record<string, never> & {
      joinedAndLeft: { joined: { value: number | null }[]; deleted: { value: number | null }[] };
      clubs: { total: number; created: number; playersWithoutClub: number };
      applications: { approved: number; rejected: number; waiting: number };
    };
    tournaments: {
      reviewLatency: { decided: number; medianHours: number | null; p90Hours: number | null };
      events: { overdue: number; publishedWithoutDraw: number; drafts: number };
      entriesPerBucket: { value: number | null }[];
    };
    operations: { outbox: { pending: number } };
  };
}

describe('GET /api/admin/stats/platform (integration)', () => {
  it('counts new accounts in the window separately from the one before it', async () => {
    // Inside the 30-day window.
    await createUser({ createdAt: daysAgo(2) });
    await createUser({ createdAt: daysAgo(20) });
    // Inside the previous 30-day window.
    await createUser({ createdAt: daysAgo(40) });
    // Older than both.
    await createUser({ createdAt: daysAgo(200) });

    const stats = await readStats('30d');
    // The admin created by readStats itself lands in the current window.
    expect(stats.headline.newAccounts.current).toBe(3);
    expect(stats.headline.newAccounts.previous).toBe(1);
  });

  it('reconciles the joined series with the headline count', async () => {
    await createUser({ createdAt: daysAgo(1) });
    await createUser({ createdAt: daysAgo(3) });

    const stats = await readStats('30d');
    const seriesTotal = stats.people.joinedAndLeft.joined.reduce(
      (total, point) => total + (point.value ?? 0),
      0,
    );
    // A series whose buckets do not add up to the headline is the classic
    // timezone/bucket-key bug; this is the guard against it.
    expect(seriesTotal).toBe(stats.headline.newAccounts.current);
  });

  it('emits one point per bucket, with zero for a quiet day', async () => {
    const stats = await readStats('7d');
    expect(stats.people.joinedAndLeft.joined).toHaveLength(7);
    expect(stats.tournaments.entriesPerBucket).toHaveLength(7);
    // Nothing was registered, so every entry bucket is a real zero.
    expect(stats.tournaments.entriesPerBucket.every((point) => point.value === 0)).toBe(true);
  });

  it('marks pre-tracking deletion buckets as unknown rather than zero', async () => {
    const stats = await readStats('12m');
    const deleted = stats.people.joinedAndLeft.deleted;
    // Deletions were not recorded before the tracking migration, so those months
    // must be null. Rendering them as 0 would claim nobody ever left.
    expect(deleted.some((point) => point.value === null)).toBe(true);
    const trackedMonths = deleted.filter((point) => point.value !== null);
    expect(trackedMonths.length).toBeGreaterThan(0);
    expect(new Date(stats.headline.deletedAccounts.trackedSince as string).getTime()).toBe(
      TRACKING_STARTED_AT.getTime(),
    );
  });

  it('rejects an unknown range and defaults a missing one', async () => {
    const admin = await createAdmin();
    const bad = await authedGet(app, '/api/admin/stats/platform?range=42d', admin);
    expect(bad.status).toBe(400);
    expect(bad.body.error).toMatch(/range/i);

    const missing = await readStats();
    expect(missing.range).toBe('30d');
    expect(missing.bucket).toBe('day');
  });

  it('serves a cached payload within the TTL, per range', async () => {
    const first = await readStats('7d');
    const second = await readStats('7d');
    expect(second.generatedAt).toBe(first.generatedAt);

    const other = await readStats('30d');
    expect(other.generatedAt).not.toBe(first.generatedAt);
  });

  it('measures how long entries waited for a decision', async () => {
    const category = await createCategory();
    const event = await createEvent({ categoryId: category.id });
    const team = await createTeam('Latency');
    const registration = await registerTeam(event, category.id, team, RegistrationStatus.APPROVED);
    const createdAt = daysAgo(1);
    await prisma.eventRegistration.update({
      where: { id: registration.id },
      data: { createdAt, reviewedAt: new Date(createdAt.getTime() + 2 * 3_600_000) },
    });

    const stats = await readStats('30d');
    expect(stats.tournaments.reviewLatency.decided).toBe(1);
    expect(stats.tournaments.reviewLatency.medianHours).toBeCloseTo(2, 1);
  });

  it('flags events past their date and published events with no draw', async () => {
    const category = await createCategory();
    await createEvent({ categoryId: category.id, date: daysAgo(3) });
    await createEvent({
      categoryId: category.id,
      date: daysAgo(1),
      isPublished: true,
      status: 'REGISTRATION_CLOSED',
    });

    const stats = await readStats('30d');
    expect(stats.tournaments.events.overdue).toBe(2);
    expect(stats.tournaments.events.publishedWithoutDraw).toBe(1);
  });

  it('counts players who cannot enter anything because they hold no club', async () => {
    await createUser();
    await createTeam('Clubbed'); // owner + teammate, both in a club

    const stats = await readStats('30d');
    // The lone player plus the admin readStats created; club members excluded.
    expect(stats.people.clubs.playersWithoutClub).toBe(1);
    expect(stats.people.clubs.total).toBe(1);
  });
});

describe('account deletion tracking (integration)', () => {
  it('records a deletion as an audit row that carries no email', async () => {
    const admin = await createAdmin();
    const victim = await createUser();

    const res = await authedSend(app, 'delete', `/api/admin/users/${victim.id}`, admin);
    expect(res.status).toBe(200);

    const rows = await prisma.auditLog.findMany({
      where: { action: USER_DELETION_AUDIT_ACTION },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].entityId).toBe(victim.id);
    expect(rows[0].entityType).toBe('User');
    expect(rows[0].actorId).toBe(admin.id);
    // The row outlives the account, so it must not carry the address itself.
    expect(JSON.stringify(rows[0])).not.toContain(victim.email);
    expect((rows[0].before as { emailHash?: string }).emailHash).toMatch(/^[a-f0-9]{64}$/);
    expect((rows[0].before as { selfService?: boolean }).selfService).toBe(false);

    resetStatsCache();
    const stats = await readStats('7d');
    expect(stats.headline.deletedAccounts.current).toBe(1);
  });

  it('refuses with 409, not 500, when the account appears in a recorded match', async () => {
    const admin = await createAdmin();
    const category = await createCategory();
    const event = await createEvent({ categoryId: category.id });
    const team = await createTeam('Played');
    const registration = await registerTeam(event, category.id, team, RegistrationStatus.APPROVED);
    const bracket = await prisma.bracket.create({
      data: { eventId: event.id, categoryId: category.id, size: 2, status: BracketStatus.LOCKED },
    });
    await prisma.match.create({
      data: {
        bracketId: bracket.id,
        round: MatchRound.FINAL,
        roundPosition: 1,
        matchNumber: 1,
        participantAEntryId: registration.id,
        status: MatchStatus.PENDING,
      },
    });

    const res = await authedSend(app, 'delete', `/api/admin/users/${team.owner.id}`, admin);
    // Registrations cascade from the user, but a match restricts its
    // participants, so Postgres refuses. Before this change it was a raw 500.
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/recorded match/i);
    // Refused means refused: the account and the audit row both stay absent.
    expect(await prisma.user.count({ where: { id: team.owner.id } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: USER_DELETION_AUDIT_ACTION } })).toBe(0);
  });
});

describe('last sign-in tracking (integration)', () => {
  const password = 'Password123!';

  // `createUser` only writes an allow-list of fields, so the hash is set after,
  // matching the `withPassword` pattern in account.integration.test.ts.
  async function createPasswordUser() {
    const user = await createUser({ role: UserRole.USER });
    return prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashSecret(password) },
    });
  }

  it('records the sign-in on login', async () => {
    const user = await createPasswordUser();
    expect(user.lastLoginAt).toBeNull();

    const res = await authedSend(app, 'post', '/api/auth/login', undefined, {
      email: user.email,
      password,
    });
    expect(res.status).toBe(200);

    // The write is deliberately not awaited by the request, so give it a tick.
    await new Promise((resolve) => setTimeout(resolve, 250));
    const after = await prisma.user.findUnique({ where: { id: user.id } });
    expect(after?.lastLoginAt).not.toBeNull();
  });

  it('does not count a password change as a sign-in', async () => {
    const user = await createPasswordUser();
    const res = await authedSend(app, 'post', '/api/account/password', user, {
      currentPassword: password,
      newPassword: 'AnotherPassword456!',
    });
    expect(res.status).toBe(200);

    await new Promise((resolve) => setTimeout(resolve, 250));
    const after = await prisma.user.findUnique({ where: { id: user.id } });
    // The cookie is re-issued to keep the device signed in; that is not a login,
    // and counting it would inflate "signed in recently".
    expect(after?.lastLoginAt).toBeNull();
  });
});
