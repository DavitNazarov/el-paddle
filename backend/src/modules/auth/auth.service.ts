import type { Request, Response } from 'express';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { UserRole, UserStatus, type User } from '../../generated/prisma/client.js';
import { config } from '../../config/env.js';
import { ApiError } from '../../common/http.js';
import { prisma } from '../../database/prisma.js';

export const SESSION_COOKIE = 'elpadel_session';
export const OAUTH_STATE_COOKIE = 'elpadel_oauth_state';
export const OAUTH_LEGAL_COOKIE = 'elpadel_oauth_legal';
/** Carries a pending club application; it is not a session and grants no account access. */
export const APPLICATION_COOKIE = 'elpadel_application';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
export const APPLICATION_MAX_AGE_SECONDS = 60 * 60 * 2;

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  surname: string;
  fullName: string;
  phone: string;
  role: UserRole;
  status: UserStatus;
  isVerified: boolean;
  disqualifiedUntil: string | null;
  disqualificationReason: string;
  isDisqualified: boolean;
  club: { id: string; name: string; slug: string; logoUrl?: string } | null;
  stats: {
    matchesPlayed: number;
    wins: number;
    losses: number;
  };
  /** Events an organiser currently runs. Empty for every other role. */
  organiserEventIds: string[];
};

export type UserClubSummary = {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
};

/**
 * The exact columns `toPublicUser` reads. Declared structurally (a `Pick`, not
 * the full `User`) so slim `select` contracts — which never load `passwordHash`
 * — satisfy it just as a fully-loaded row does (F1). A full `User` is still
 * assignable here; the extra columns are simply ignored.
 */
export type PublicUserSource = Pick<
  User,
  | 'id'
  | 'email'
  | 'name'
  | 'surname'
  | 'phone'
  | 'role'
  | 'status'
  | 'emailVerifiedAt'
  | 'matchesPlayed'
  | 'wins'
  | 'losses'
  | 'disqualifiedUntil'
  | 'disqualificationReason'
> & {
  clubMemberships?: {
    club: UserClubSummary;
  }[];
  organiserEvents?: { eventId: string }[];
};

type SessionPayload = JwtPayload & {
  sub: string;
  sv?: number;
  /** The `Session` row this device signed in with. */
  sid?: string;
};

/** The session id carried by the request's cookie, without re-reading the user. */
export function readSessionId(request: Request) {
  const token = request.cookies?.[SESSION_COOKIE] as string | undefined;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, getSessionSecret(), {
      algorithms: ['HS256'],
      audience: SESSION_AUDIENCE,
    }) as SessionPayload;
    return typeof payload.sid === 'string' && payload.sid ? payload.sid : null;
  } catch {
    return null;
  }
}

const baseCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: config.isProduction,
  path: '/',
  ...(config.cookieDomain ? { domain: config.cookieDomain } : {}),
};

const hostOnlyCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: config.isProduction,
  path: '/',
};

const cookieOptions = {
  ...baseCookieOptions,
  maxAge: SESSION_MAX_AGE_SECONDS * 1000,
};

function clearLegacyHostOnlyCookie(response: Response, name: string) {
  if (!config.cookieDomain) return;
  response.clearCookie(name, hostOnlyCookieOptions);
}

function getSessionSecret() {
  return config.jwtSecret;
}

function adminEmails() {
  return new Set(
    config.adminEmails
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function roleForEmail(
  email: string,
  currentRole?: UserRole,
  options?: { emailVerified?: boolean },
) {
  // Never elevate (or keep ADMIN_EMAILS elevation) until the address is proven.
  if (options?.emailVerified === false) return UserRole.USER;
  if (currentRole === UserRole.ADMIN) return UserRole.ADMIN;
  if (currentRole === UserRole.JUDGE) return UserRole.JUDGE;
  if (currentRole === UserRole.ORGANISER) return UserRole.ORGANISER;
  return adminEmails().has(email.trim().toLowerCase())
    ? UserRole.ADMIN
    : UserRole.USER;
}

/** Staff never hold a club membership or player statistics. */
export function isStaffRole(role: UserRole) {
  return role === UserRole.ADMIN || role === UserRole.JUDGE || role === UserRole.ORGANISER;
}

export function toPublicUser(user: PublicUserSource): PublicUser {
  const name = user.name ?? '';
  const surname = user.surname ?? '';
  const fullName = [name, surname].filter(Boolean).join(' ') || user.email;
  const role = roleForEmail(user.email, user.role);
  const disqualifiedUntil =
    user.disqualifiedUntil && user.disqualifiedUntil.getTime() > Date.now()
      ? user.disqualifiedUntil.toISOString()
      : null;
  const club = user.clubMemberships?.[0]?.club ?? null;
  const stats =
    isStaffRole(role)
      ? { matchesPlayed: 0, wins: 0, losses: 0 }
      : {
          matchesPlayed: user.matchesPlayed,
          wins: user.wins,
          losses: user.losses,
        };

  return {
    id: user.id,
    email: user.email,
    name,
    surname,
    fullName,
    phone: user.phone ?? '',
    role,
    status: user.status,
    isVerified: Boolean(user.emailVerifiedAt) && user.status === UserStatus.ACTIVE,
    disqualifiedUntil,
    disqualificationReason: disqualifiedUntil ? (user.disqualificationReason ?? '') : '',
    isDisqualified: Boolean(disqualifiedUntil),
    club: isStaffRole(role)
      ? null
      : club
        ? {
            id: club.id,
            name: club.name,
            slug: club.slug,
            logoUrl: club.logoUrl ?? '',
          }
        : null,
    stats,
    organiserEventIds: user.organiserEvents?.map((link) => link.eventId) ?? [],
  };
}

async function removeAdminAthleteLinks(userId: string) {
  await prisma.$transaction([
    prisma.eventRegistration.deleteMany({
      where: { OR: [{ ownerId: userId }, { teammateId: userId }] },
    }),
    prisma.clubMember.deleteMany({ where: { userId } }),
  ]);
}

/**
 * Two different tokens are signed with the same `JWT_SECRET`: a session, which
 * grants account access, and a pending club application, which grants none.
 * Without an audience claim the only thing keeping one from being presented as
 * the other is that `User.id` and `ClubApplication.id` live in different
 * tables — a coincidence, not a check. Every verify below pins its audience.
 */
export const SESSION_AUDIENCE = 'elpadel:session';
export const APPLICATION_AUDIENCE = 'elpadel:application';

export function createSessionToken(user: Pick<User, 'id' | 'sessionVersion'>, sessionId: string) {
  return jwt.sign(
    { sv: user.sessionVersion ?? 0, sid: sessionId },
    getSessionSecret(),
    {
      algorithm: 'HS256',
      subject: user.id,
      audience: SESSION_AUDIENCE,
      expiresIn: SESSION_MAX_AGE_SECONDS,
    },
  );
}

/**
 * Record a signed-in device and hand it a cookie naming that record.
 *
 * The row is what makes a single device revocable: logging out on one browser
 * revokes its own `Session` and leaves the others signed in. Before this, every
 * logout bumped `sessionVersion` and signed the account out everywhere.
 */
export async function startSession(response: Response, user: Pick<User, 'id' | 'sessionVersion'>) {
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      expiresAt: new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000),
    },
    select: { id: true },
  });
  clearLegacyHostOnlyCookie(response, SESSION_COOKIE);
  response.cookie(SESSION_COOKIE, createSessionToken(user, session.id), cookieOptions);
  return session.id;
}

export function setOAuthStateCookie(response: Response, state: string) {
  clearLegacyHostOnlyCookie(response, OAUTH_STATE_COOKIE);
  response.cookie(OAUTH_STATE_COOKIE, state, {
    ...baseCookieOptions,
    maxAge: 10 * 60 * 1000,
  });
}

export function setOAuthLegalCookie(response: Response) {
  clearLegacyHostOnlyCookie(response, OAUTH_LEGAL_COOKIE);
  response.cookie(OAUTH_LEGAL_COOKIE, 'accepted', {
    ...baseCookieOptions,
    maxAge: 10 * 60 * 1000,
  });
}

export function setApplicationCookie(response: Response, applicationId: string) {
  const token = jwt.sign({ app: applicationId }, getSessionSecret(), {
    algorithm: 'HS256',
    subject: applicationId,
    audience: APPLICATION_AUDIENCE,
    expiresIn: APPLICATION_MAX_AGE_SECONDS,
  });
  clearLegacyHostOnlyCookie(response, APPLICATION_COOKIE);
  response.cookie(APPLICATION_COOKIE, token, {
    ...baseCookieOptions,
    maxAge: APPLICATION_MAX_AGE_SECONDS * 1000,
  });
}

/** The pending application this browser is filling in, or null. */
export function readApplicationId(request: Request) {
  const token = request.cookies?.[APPLICATION_COOKIE] as string | undefined;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, getSessionSecret(), {
      algorithms: ['HS256'],
      audience: APPLICATION_AUDIENCE,
    }) as JwtPayload & { app?: string };
    return payload.app ?? null;
  } catch {
    return null;
  }
}

export function clearApplicationCookie(response: Response) {
  response.clearCookie(APPLICATION_COOKIE, baseCookieOptions);
  clearLegacyHostOnlyCookie(response, APPLICATION_COOKIE);
}

export function clearSessionCookie(response: Response) {
  response.clearCookie(SESSION_COOKIE, baseCookieOptions);
  clearLegacyHostOnlyCookie(response, SESSION_COOKIE);
}

export function clearOAuthStateCookie(response: Response) {
  response.clearCookie(OAUTH_STATE_COOKIE, baseCookieOptions);
  clearLegacyHostOnlyCookie(response, OAUTH_STATE_COOKIE);
}

export function clearOAuthLegalCookie(response: Response) {
  response.clearCookie(OAUTH_LEGAL_COOKIE, baseCookieOptions);
  clearLegacyHostOnlyCookie(response, OAUTH_LEGAL_COOKIE);
}

/**
 * Sign one device out. Everything else the account has open stays signed in.
 * Safe to call with an unknown id — a token naming a session that no longer
 * exists is already dead.
 */
export async function revokeSession(sessionId: string) {
  await prisma.session.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/**
 * Sign the account out everywhere: bump `sessionVersion`, which invalidates
 * every outstanding JWT immediately, and mark the device rows revoked so a
 * later "your devices" read tells the truth.
 *
 * This is the account-wide hammer — a password change, a disqualification, a
 * judge deactivation, and the user's own "log out of all devices". An ordinary
 * logout uses `revokeSession` instead.
 */
export async function revokeUserSessions(userId: string) {
  const [user] = await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { sessionVersion: { increment: 1 } },
    }),
    prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
  return user;
}

export async function getCurrentUser(request: Request) {
  const token = request.cookies?.[SESSION_COOKIE] as string | undefined;
  if (!token) return null;

  let payload: SessionPayload;
  try {
    payload = jwt.verify(token, getSessionSecret(), {
      algorithms: ['HS256'],
      audience: SESSION_AUDIENCE,
    }) as SessionPayload;
  } catch {
    return null;
  }

  if (!payload.sub) return null;
  // A token that names no device predates per-device sessions and cannot be
  // revoked individually, so it is not honoured.
  if (typeof payload.sid !== 'string' || !payload.sid) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: {
      clubMemberships: {
        include: {
          club: {
            select: { id: true, name: true, slug: true },
          },
        },
        take: 1,
      },
      // The frontend gates organiser screens per event; loading the links here
      // saves every admin page a second round trip.
      organiserEvents: { where: { revokedAt: null }, select: { eventId: true } },
      // Folded into the same query on purpose: per-device revocation must not
      // cost a second round trip on every authenticated request.
      sessions: { where: { id: payload.sid }, select: { revokedAt: true, expiresAt: true } },
    },
  });
  if (!user) return null;
  if (user.status === UserStatus.INACTIVE) return null;

  const tokenVersion = typeof payload.sv === 'number' ? payload.sv : 0;
  if (tokenVersion !== (user.sessionVersion ?? 0)) {
    return null;
  }

  // The device this token names must still be live. Missing covers a session
  // deleted outright; revoked covers a logout on this device; expired covers a
  // row that outlived its token.
  const session = user.sessions[0];
  if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
    return null;
  }

  // The read path is side-effect free. ADMIN_EMAILS-driven role drift is persisted
  // (and athlete links cleaned) only at explicit authentication points via
  // reconcileUserRole — a GET must never mutate roles or delete registrations (M-3).
  const effectiveRole = roleForEmail(user.email, user.role, {
    emailVerified: Boolean(user.emailVerifiedAt),
  });

  // Player win/loss stats come from the transactionally-maintained denormalized
  // counters on User (see matches.service completeMatch/correctCompletedMatch),
  // exposed by toPublicUser. This keeps a single source of truth and avoids a
  // per-request match aggregation on the hot authenticated path. Point-in-time,
  // publication-gated stats are computed on demand only by the public
  // player/profile endpoints (see users.service getPlayerStats).
  return toPublicUser(effectiveRole === user.role ? user : { ...user, role: effectiveRole });
}

/**
 * Persist ADMIN_EMAILS-driven role drift and, on promotion to admin, drop the
 * user's athlete (registration / club) links. Called at explicit authentication
 * points only — never on the read path (M-3), so a session read can never delete
 * tournament data.
 */
export async function reconcileUserRole(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true, emailVerifiedAt: true },
  });
  if (!user) return;
  const nextRole = roleForEmail(user.email, user.role, {
    emailVerified: Boolean(user.emailVerifiedAt),
  });
  if (nextRole === user.role) return;
  await prisma.user.update({ where: { id: user.id }, data: { role: nextRole } });
  if (nextRole === UserRole.ADMIN) {
    await removeAdminAthleteLinks(user.id);
  }
}

/**
 * Record that this account just signed in, for the "seen recently" statistic.
 *
 * Fire-and-forget on purpose: a sign-in must never fail, nor wait on an extra
 * round trip, because a statistics column did not update.
 *
 * Deliberately not folded into `setSessionCookie`, tempting as that single choke
 * point is — a password change re-issues the cookie to keep the current device
 * signed in, and counting that as a login would inflate the metric. Call this
 * only where a session is issued *as the result of signing in*.
 */
export function touchLastLogin(userId: string) {
  void prisma.user
    .update({ where: { id: userId }, data: { lastLoginAt: new Date() }, select: { id: true } })
    .catch((error: unknown) => {
      console.error('[auth] could not record last login', error);
    });
}

export async function requireUser(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) throw new ApiError('Unauthorized', 401);
  return user;
}
