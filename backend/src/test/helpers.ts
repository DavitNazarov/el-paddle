import { randomUUID } from 'crypto';
import request from 'supertest';
import type { Express } from 'express';
import {
  ClubMembershipRole,
  EventStatus,
  RegistrationStatus,
  UserRole,
  UserStatus,
  type Event,
  type User,
} from '../generated/prisma/client.js';
import { prisma } from '../database/prisma.js';
import { createSessionToken, SESSION_COOKIE } from '../modules/auth/auth.service.js';
import { CSRF_COOKIE } from '../common/csrf.js';

/**
 * Truncate every application table between tests. Guarded so it can only ever
 * run against a database whose name contains "test".
 */
export async function resetDb() {
  const url = process.env.DATABASE_URL ?? '';
  if (!/test/i.test(url)) {
    throw new Error(`Refusing to reset a database whose URL does not look like a test DB: ${url}`);
  }
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  if (!tables.length) return;
  const list = tables.map((t) => `"public"."${t.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
}

let seq = 0;
const uniqueEmail = (prefix: string) => `${prefix}-${seq++}-${randomUUID().slice(0, 8)}@example.test`;

export async function createUser(overrides: Partial<User> = {}) {
  return prisma.user.create({
    data: {
      email: overrides.email ?? uniqueEmail('user'),
      name: overrides.name ?? 'Test',
      surname: overrides.surname ?? 'Player',
      role: overrides.role ?? UserRole.USER,
      status: overrides.status ?? UserStatus.ACTIVE,
      emailVerifiedAt: overrides.emailVerifiedAt ?? new Date(),
      sessionVersion: overrides.sessionVersion ?? 0,
      phone: overrides.phone ?? '+995500000000',
      // Statistics tests need accounts placed in a past window.
      ...(overrides.createdAt ? { createdAt: overrides.createdAt } : {}),
      ...(overrides.lastLoginAt ? { lastLoginAt: overrides.lastLoginAt } : {}),
    },
  });
}

export const createAdmin = () => createUser({ role: UserRole.ADMIN });
export const createJudge = () => createUser({ role: UserRole.JUDGE });

/** A club with an owner (LEADER) + teammate (MEMBER), both active players. */
export async function createTeam(label: string) {
  const club = await prisma.club.create({
    data: { name: `${label} Club ${seq}`, slug: `${label.toLowerCase()}-${seq++}-${randomUUID().slice(0, 6)}` },
  });
  const owner = await createUser({ name: label, surname: 'Owner' });
  const teammate = await createUser({ name: label, surname: 'Teammate' });
  await prisma.clubMember.create({ data: { clubId: club.id, userId: owner.id, membershipRole: ClubMembershipRole.LEADER } });
  await prisma.clubMember.create({ data: { clubId: club.id, userId: teammate.id, membershipRole: ClubMembershipRole.MEMBER } });
  return { club, owner, teammate };
}

export async function createCategory(name = `Category ${seq++}-${randomUUID().slice(0, 6)}`) {
  return prisma.category.create({ data: { name } });
}

export async function createEvent(overrides: Partial<Event> & { categoryId?: string } = {}) {
  const { categoryId, ...rest } = overrides;
  return prisma.event.create({
    data: {
      title: rest.title ?? 'Test Open',
      date: rest.date ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      location: rest.location ?? 'Tbilisi',
      participationFee: rest.participationFee ?? 100,
      bankAccountIban: rest.bankAccountIban ?? 'GE00TB0000000000000000',
      bankAccountReceiver: rest.bankAccountReceiver ?? 'Test Receiver',
      status: rest.status ?? EventStatus.REGISTRATION_OPEN,
      isPublished: rest.isPublished ?? false,
      ...(categoryId ? { categories: { create: [{ categoryId }] } } : {}),
    },
  });
}

export async function registerTeam(
  event: Event,
  categoryId: string,
  team: Awaited<ReturnType<typeof createTeam>>,
  status: RegistrationStatus = RegistrationStatus.APPROVED,
) {
  return prisma.eventRegistration.create({
    data: {
      eventId: event.id,
      categoryId,
      clubId: team.club.id,
      ownerId: team.owner.id,
      teammateId: team.teammate.id,
      teammateEmail: team.teammate.email,
      ownerPhone: '+995500000001',
      status,
    },
  });
}

// --- HTTP auth helpers (real session JWT + CSRF double-submit) ---

export function sessionCookie(user: Pick<User, 'id' | 'sessionVersion'>) {
  return `${SESSION_COOKIE}=${createSessionToken(user)}`;
}

/** Fetch a fresh CSRF token + cookie pair from the running app. */
export async function getCsrf(app: Express) {
  const res = await request(app).get('/api/auth/csrf');
  const setCookie = res.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = (setCookie ?? []).find((c) => c.startsWith(`${CSRF_COOKIE}=`)) ?? '';
  return { token: res.body.token as string, cookie: cookie.split(';')[0] };
}

/** GET with an authenticated session cookie. */
export function authedGet(app: Express, path: string, user?: Pick<User, 'id' | 'sessionVersion'>) {
  const req = request(app).get(path);
  return user ? req.set('Cookie', sessionCookie(user)) : req;
}

/** Unsafe method with a valid CSRF double-submit and optional session cookie. */
export async function authedSend(
  app: Express,
  method: 'post' | 'put' | 'patch' | 'delete',
  path: string,
  user: Pick<User, 'id' | 'sessionVersion'> | undefined,
  body: Record<string, unknown> = {},
) {
  const csrf = await getCsrf(app);
  const cookies = [csrf.cookie, ...(user ? [sessionCookie(user)] : [])].join('; ');
  return request(app)[method](path).set('Cookie', cookies).set('x-csrf-token', csrf.token).send(body);
}
