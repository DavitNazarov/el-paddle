import type { Request, Response } from 'express';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { UserRole, UserStatus, type User } from '../../generated/prisma/client.js';
import { config } from '../../config/env.js';
import { ApiError } from '../../common/http.js';
import { prisma } from '../../database/prisma.js';
import { getPlayerStats } from '../users/player-stats.js';

export const SESSION_COOKIE = 'elpadel_session';
export const OAUTH_STATE_COOKIE = 'elpadel_oauth_state';
export const OAUTH_LEGAL_COOKIE = 'elpadel_oauth_legal';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

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
  club: { id: string; name: string; slug: string } | null;
  stats: {
    matchesPlayed: number;
    wins: number;
    losses: number;
  };
};

export type UserClubSummary = {
  id: string;
  name: string;
  slug: string;
};

type UserWithOptionalClub = User & {
  clubMemberships?: {
    club: UserClubSummary;
  }[];
};

type SessionPayload = JwtPayload & {
  sub: string;
  sv?: number;
};

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
  return adminEmails().has(email.trim().toLowerCase())
    ? UserRole.ADMIN
    : UserRole.USER;
}

export function toPublicUser(user: UserWithOptionalClub): PublicUser {
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
    role === UserRole.ADMIN || role === UserRole.JUDGE
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
    club: role === UserRole.ADMIN || role === UserRole.JUDGE ? null : club,
    stats,
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

export function createSessionToken(user: Pick<User, 'id' | 'sessionVersion'>) {
  return jwt.sign(
    { sv: user.sessionVersion ?? 0 },
    getSessionSecret(),
    {
      algorithm: 'HS256',
      subject: user.id,
      expiresIn: SESSION_MAX_AGE_SECONDS,
    },
  );
}

export function setSessionCookie(response: Response, user: Pick<User, 'id' | 'sessionVersion'>) {
  clearLegacyHostOnlyCookie(response, SESSION_COOKIE);
  response.cookie(SESSION_COOKIE, createSessionToken(user), cookieOptions);
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

/** Bump sessionVersion so any outstanding JWTs for this user stop working. */
export async function revokeUserSessions(userId: string) {
  return prisma.user.update({
    where: { id: userId },
    data: { sessionVersion: { increment: 1 } },
  });
}

export async function getCurrentUser(request: Request) {
  const token = request.cookies?.[SESSION_COOKIE] as string | undefined;
  if (!token) return null;

  let payload: SessionPayload;
  try {
    payload = jwt.verify(token, getSessionSecret(), {
      algorithms: ['HS256'],
    }) as SessionPayload;
  } catch {
    return null;
  }

  if (!payload.sub) return null;

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
    },
  });
  if (!user) return null;
  if (user.status === UserStatus.INACTIVE) return null;

  const tokenVersion = typeof payload.sv === 'number' ? payload.sv : 0;
  if (tokenVersion !== (user.sessionVersion ?? 0)) {
    return null;
  }

  const nextRole = roleForEmail(user.email, user.role, {
    emailVerified: Boolean(user.emailVerifiedAt),
  });
  const current =
    nextRole === user.role
      ? user
      : await prisma.user.update({
          where: { id: user.id },
          data: { role: nextRole },
          include: {
            clubMemberships: {
              include: {
                club: {
                  select: { id: true, name: true, slug: true },
                },
              },
              take: 1,
            },
          },
        });

  if (nextRole === UserRole.ADMIN) {
    await removeAdminAthleteLinks(current.id);
  }

  const publicUser = toPublicUser(current);
  if (publicUser.role === UserRole.USER) {
    const stats = await getPlayerStats([publicUser.id]);
    publicUser.stats = stats.get(publicUser.id) ?? { matchesPlayed: 0, wins: 0, losses: 0 };
  }

  return publicUser;
}

export async function requireUser(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) throw new ApiError('Unauthorized', 401);
  return user;
}

export async function requireAdmin(request: Request) {
  const user = await requireUser(request);
  if (user.role !== UserRole.ADMIN) throw new ApiError('Forbidden', 403);
  return user;
}
