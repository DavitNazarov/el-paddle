import type { Request, Response } from 'express';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { UserRole, UserStatus, type User } from './generated/prisma/client.js';
import { config } from './env.js';
import { ApiError } from './http.js';
import { prisma } from './prisma.js';

export const SESSION_COOKIE = 'elpadel_session';
export const OAUTH_STATE_COOKIE = 'elpadel_oauth_state';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  surname: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
  isVerified: boolean;
  stats: {
    matchesPlayed: number;
    wins: number;
    losses: number;
  };
};

type SessionPayload = JwtPayload & {
  sub: string;
};

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: SESSION_MAX_AGE_SECONDS * 1000,
};

function getSessionSecret() {
  if (!config.jwtSecret) {
    throw new Error('JWT_SECRET is not configured.');
  }
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

export function roleForEmail(email: string, currentRole?: UserRole) {
  if (currentRole === UserRole.ADMIN) return UserRole.ADMIN;
  return adminEmails().has(email.trim().toLowerCase())
    ? UserRole.ADMIN
    : UserRole.USER;
}

export function toPublicUser(user: User): PublicUser {
  const name = user.name ?? '';
  const surname = user.surname ?? '';
  const fullName = [name, surname].filter(Boolean).join(' ') || user.email;
  const role = roleForEmail(user.email, user.role);
  const stats =
    role === UserRole.ADMIN
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
    role,
    status: user.status,
    isVerified: Boolean(user.emailVerifiedAt) && user.status === UserStatus.ACTIVE,
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

export function createSessionToken(user: User) {
  return jwt.sign({}, getSessionSecret(), {
    subject: user.id,
    expiresIn: SESSION_MAX_AGE_SECONDS,
  });
}

export function setSessionCookie(response: Response, user: User) {
  response.cookie(SESSION_COOKIE, createSessionToken(user), cookieOptions);
}

export function setOAuthStateCookie(response: Response, state: string) {
  response.cookie(OAUTH_STATE_COOKIE, state, {
    ...cookieOptions,
    maxAge: 10 * 60 * 1000,
  });
}

export function clearSessionCookie(response: Response) {
  response.clearCookie(SESSION_COOKIE, { path: '/' });
}

export function clearOAuthStateCookie(response: Response) {
  response.clearCookie(OAUTH_STATE_COOKIE, { path: '/' });
}

export async function getCurrentUser(request: Request) {
  const token = request.cookies?.[SESSION_COOKIE] as string | undefined;
  if (!token) return null;

  let payload: SessionPayload;
  try {
    payload = jwt.verify(token, getSessionSecret()) as SessionPayload;
  } catch {
    return null;
  }

  if (!payload.sub) return null;

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) return null;

  const nextRole = roleForEmail(user.email, user.role);
  const current =
    nextRole === user.role
      ? user
      : await prisma.user.update({
          where: { id: user.id },
          data: { role: nextRole },
        });

  if (nextRole === UserRole.ADMIN) {
    await removeAdminAthleteLinks(current.id);
  }

  return toPublicUser(current);
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
