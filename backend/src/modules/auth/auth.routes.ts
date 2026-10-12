import crypto from 'crypto';
import { Router } from 'express';
import {
  AccountProvider,
  ClubApplicationStatus,
  UserRole,
  UserStatus,
} from '../../generated/prisma/client.js';
import { config } from '../../config/env.js';
import {
  asyncHandler,
  cleanEmail,
  cleanString,
  isUniqueConstraintError,
  isValidEmail,
  jsonError,
  requireParamId,
} from '../../common/http.js';
import {
  addMinutes,
  compareSecret,
  createInviteToken,
  createVerificationCode,
  hashSecret,
  hashToken,
  passwordValidationError,
  timingSafeEqualString,
} from '../../common/security.js';
import { prisma } from '../../database/prisma.js';
import {
  clearOAuthStateCookie,
  clearOAuthLegalCookie,
  clearSessionCookie,
  getCurrentUser,
  isStaffRole,
  OAUTH_STATE_COOKIE,
  OAUTH_LEGAL_COOKIE,
  reconcileUserRole,
  requireUser,
  revokeSession,
  revokeUserSessions,
  readSessionId,
  roleForEmail,
  setOAuthStateCookie,
  setOAuthLegalCookie,
  setApplicationCookie,
  startSession,
  toPublicUser,
  touchLastLogin,
} from './auth.service.js';
import { createClubForPlayer, inviteClubMate, requireClubId, requireClubLeadership, setPlayerClub } from '../clubs/clubs.service.js';
import { startGoogleApplication } from '../club-applications/club-applications.service.js';
import { serializeClub } from '../../common/serializers.js';
import { clubInclude } from '../../common/includes.js';
import { assertNotDisqualified } from '../../common/disqualification.js';
import { sendPasswordResetEmail, sendVerificationCodeEmail } from '../../common/notifications.js';
import { consumeLimit, rateLimit } from '../../common/rateLimit.js';
import { auditLog, requestIp } from '../../common/audit.js';
import {
  ACCOUNT_TERMS_VERSION,
  PRIVACY_POLICY_VERSION,
  requireAccountLegalAcceptance,
} from '../../common/legal.js';

export const authRouter = Router();

const ADMIN_BOOTSTRAP_LOCK_ID = 730_127_001;

const authStrictLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, keyPrefix: 'auth-strict' });
const bootstrapLimit = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, keyPrefix: 'bootstrap' });

function frontendRedirect(path: string) {
  return new URL(path, config.frontendUrl).toString();
}

function hashForTiming(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function isBootstrapTokenValid(token: string) {
  if (!token || !config.firstAdminBootstrapToken) return false;
  return timingSafeEqualString(
    hashForTiming(token),
    hashForTiming(config.firstAdminBootstrapToken),
  );
}

type GoogleTokenResponse = {
  access_token?: string;
  error?: string;
};

type GoogleProfile = {
  id: string;
  email: string;
  verified_email?: boolean;
  given_name?: string;
  family_name?: string;
  name?: string;
};

function splitGoogleName(profile: GoogleProfile) {
  if (profile.given_name || profile.family_name) {
    return {
      name: profile.given_name ?? profile.name?.split(' ')[0] ?? 'Player',
      surname: profile.family_name ?? profile.name?.split(' ').slice(1).join(' ') ?? '',
    };
  }

  const parts = (profile.name ?? 'Player').split(' ').filter(Boolean);
  return {
    name: parts[0] ?? 'Player',
    surname: parts.slice(1).join(' '),
  };
}

authRouter.post('/api/admin/bootstrap', bootstrapLimit, asyncHandler(async (request, response) => {
  const body = typeof request.body === 'object' && request.body !== null
    ? (request.body as Record<string, unknown>)
    : {};
  const token = cleanString(request.get('x-bootstrap-token'));
  const email = cleanEmail(body.email);
  const name = cleanString(body.name);
  const surname = cleanString(body.surname);
  const password = cleanString(body.password);

  const ip = requestIp(request);

  if (!config.firstAdminBootstrapToken) {
    auditLog({ event: 'admin.bootstrap', outcome: 'denied', ip, detail: 'not_configured' });
    jsonError('Admin bootstrap is not configured.', 503);
  }
  if (!isBootstrapTokenValid(token)) {
    auditLog({ event: 'admin.bootstrap', outcome: 'failure', email, ip, detail: 'invalid_token' });
    jsonError('Invalid bootstrap token.', 401);
  }
  if (!isValidEmail(email)) jsonError('Enter a valid email.');
  if (!name || !surname) jsonError('Name and surname are required.');
  const passwordError = passwordValidationError(password);
  if (passwordError) jsonError(passwordError);

  const passwordHash = await hashSecret(password);
  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${ADMIN_BOOTSTRAP_LOCK_ID})`;

    const adminCount = await tx.user.count({ where: { role: UserRole.ADMIN } });
    if (adminCount > 0) {
      auditLog({ event: 'admin.bootstrap', outcome: 'denied', email, ip, detail: 'admin_exists' });
      jsonError('Admin account already exists.', 409);
    }

    const existing = await tx.user.findUnique({ where: { email } });
    const data = {
      email,
      name,
      surname,
      passwordHash,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      emailVerifiedAt: existing?.emailVerifiedAt ?? new Date(),
      sessionVersion: (existing?.sessionVersion ?? 0) + 1,
    };

    if (existing) {
      return {
        created: false,
        user: await tx.user.update({
          where: { id: existing.id },
          data,
        }),
      };
    }

    return {
      created: true,
      user: await tx.user.create({ data }),
    };
  });

  auditLog({
    event: 'admin.bootstrap',
    outcome: 'success',
    userId: result.user.id,
    email,
    ip,
    detail: result.created ? 'created' : 'promoted',
  });
  await reconcileUserRole(result.user.id);
  touchLastLogin(result.user.id);
  await startSession(response, result.user);
  response.status(result.created ? 201 : 200).json({
    created: result.created,
    user: toPublicUser(result.user),
  });
}));

// There is deliberately no direct `/api/auth/register` + `/api/auth/verify`
// pair here. New signups are club applications reviewed by an admin
// (`/api/applications`), and a self-service route that minted an ACTIVE account
// bypassed that gate entirely. It also let an unauthenticated caller write a
// password hash onto any address that was not yet both ACTIVE and
// password-backed, which survived a later Google sign-in as a takeover.

authRouter.post('/api/auth/login', authStrictLimit, asyncHandler(async (request, response) => {
  const email = cleanEmail(request.body.email);
  const password = cleanString(request.body.password);
  const ip = requestIp(request);

  if (!email || !password) jsonError('Email and password are required.');
  // The middleware limiter above counts per address, which a credential-stuffing
  // run spreads across thousands of them. Counting per target account is what
  // actually bounds attempts on any one password. The bucket depends only on
  // the caller's own request count, so it reveals nothing about whether the
  // address has an account.
  consumeLimit({ windowMs: 15 * 60 * 1000, max: 20, keyPrefix: 'login-email', subject: email });

  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      clubMemberships: {
        include: {
          club: { select: { id: true, name: true, slug: true } },
        },
        take: 1,
      },
    },
  });
  const dummyPasswordHash = '$2b$12$z/h1scIxzol03OmOW9jXjuFQJsKy5gJoC63nzQMqnimKqCKneaeQC';
  const ok = await compareSecret(password, user?.passwordHash ?? dummyPasswordHash);
  if (!user?.passwordHash) {
    // An applicant has no account yet, so "invalid password" would just confuse
    // them. Say plainly that their request is still with an admin.
    const application = await prisma.clubApplication.findUnique({
      where: { email },
      select: { status: true },
    });
    if (application?.status === ClubApplicationStatus.SUBMITTED) {
      auditLog({ event: 'auth.login', outcome: 'denied', email, ip, detail: 'application_pending' });
      jsonError('Your club request is still under review. We will email you the decision.', 403);
    }
    auditLog({ event: 'auth.login', outcome: 'failure', email, ip, detail: 'unknown_user' });
    jsonError('Invalid email or password.', 401);
  }

  if (!ok) {
    auditLog({ event: 'auth.login', outcome: 'failure', email, ip, detail: 'bad_password' });
    jsonError('Invalid email or password.', 401);
  }

  if (user.status === UserStatus.PENDING_VERIFICATION) {
    auditLog({ event: 'auth.login', outcome: 'denied', email, ip, detail: 'unverified' });
    jsonError('Verify your email before logging in.', 403);
  }

  if (user.status === UserStatus.INVITED) {
    auditLog({ event: 'auth.login', outcome: 'denied', email, ip, detail: 'invited' });
    jsonError('Finish your invited account setup first.', 403);
  }

  if (user.status === UserStatus.INACTIVE) {
    auditLog({ event: 'auth.login', outcome: 'denied', email, ip, detail: 'inactive' });
    jsonError('This account is inactive.', 403);
  }

  auditLog({ event: 'auth.login', outcome: 'success', userId: user.id, email, ip });
  await reconcileUserRole(user.id);
  touchLastLogin(user.id);
  await startSession(response, user);
  response.json({ user: toPublicUser(user) });
}));

// Signs out this device only. The session id is read from the cookie directly
// rather than via getCurrentUser, so a device whose account was already revoked
// elsewhere can still clean up its own row.
authRouter.post('/api/auth/logout', asyncHandler(async (request, response) => {
  const sessionId = readSessionId(request);
  const current = await getCurrentUser(request);
  if (sessionId) await revokeSession(sessionId);
  if (current) {
    auditLog({
      event: 'auth.logout',
      outcome: 'success',
      userId: current.id,
      email: current.email,
      ip: requestIp(request),
    });
  }
  clearSessionCookie(response);
  response.json({ ok: true });
}));

// Signs out every device, including this one. Separate from logout on purpose:
// one is routine, the other is what you reach for when a device is lost or a
// password may be known — and it should say so rather than happen by surprise.
authRouter.post('/api/auth/logout-all', asyncHandler(async (request, response) => {
  const current = await requireUser(request);
  await revokeUserSessions(current.id);
  auditLog({
    event: 'auth.logout_all',
    outcome: 'success',
    userId: current.id,
    email: current.email,
    ip: requestIp(request),
  });
  clearSessionCookie(response);
  response.json({ ok: true });
}));

/**
 * The devices this account is signed in on.
 *
 * `Session` has been per-device since it existed — signing out revokes one row
 * and leaves the others alone — but nothing ever read the rows back, so the only
 * control anyone had was the all-or-nothing "log out everywhere". This lists
 * what that hammer would hit, and lets one of them be picked off instead.
 *
 * What it deliberately does not claim: which device each row is. No user agent
 * or address is recorded against a session, so a row can honestly say when it
 * started, when it expires, and whether it is the one reading this — and nothing
 * more. Naming devices would need a column.
 */
authRouter.get('/api/account/sessions', asyncHandler(async (request, response) => {
  const current = await requireUser(request);
  const currentSessionId = readSessionId(request);
  const sessions = await prisma.session.findMany({
    where: { userId: current.id, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, createdAt: true, expiresAt: true },
  });
  response.json({
    sessions: sessions.map((session) => ({
      id: session.id,
      createdAt: session.createdAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
      current: session.id === currentSessionId,
    })),
  });
}));

authRouter.delete('/api/account/sessions/:id', asyncHandler(async (request, response) => {
  const current = await requireUser(request);
  const sessionId = requireParamId(request.params.id, 'session id');
  const session = await prisma.session.findFirst({
    where: { id: sessionId, userId: current.id },
    select: { id: true },
  });
  // Scoped to the caller's own rows, and 404 rather than 403 so this cannot be
  // used to ask whether someone else's session id exists.
  if (!session) jsonError('Session not found.', 404);

  await revokeSession(session.id);
  auditLog({
    event: 'auth.session_revoked',
    outcome: 'success',
    userId: current.id,
    email: current.email,
    ip: requestIp(request),
    detail: session.id === readSessionId(request) ? 'self' : 'other',
  });
  // Revoking the device you are reading from signs you out here too, so the
  // cookie goes with it rather than being left to fail on the next request.
  if (session.id === readSessionId(request)) clearSessionCookie(response);
  response.json({ ok: true, signedOut: session.id === readSessionId(request) });
}));

/** How long an email-change code stays usable. */
const EMAIL_CHANGE_LIFETIME_MINUTES = 30;

/**
 * Change the address the account signs in with.
 *
 * The code is mailed to the *new* address, because the thing that has to be
 * proven is control of it. There is no column to park a pending address in, so
 * the address is bound into the code's hash instead: a code is only valid for
 * the address it was issued for, and the caller presents both to redeem it. A
 * code that leaks is useless against any other address.
 *
 * A change that would alter the account's role — an address in `ADMIN_EMAILS` —
 * is refused. Elevation is an administrative act, not a side effect of editing
 * your own profile.
 */
authRouter.post('/api/account/email', authStrictLimit, asyncHandler(async (request, response) => {
  const current = await requireUser(request);
  const email = cleanEmail(request.body.email);
  const password = cleanString(request.body.password);

  if (!isValidEmail(email)) jsonError('Enter a valid email address.');
  if (email === current.email) jsonError('That is already your email address.');
  if (roleForEmail(email, current.role) !== current.role) {
    jsonError('This address cannot be used for your account. Ask an administrator.', 403);
  }

  const account = await prisma.user.findUnique({
    where: { id: current.id },
    select: { passwordHash: true },
  });
  // A password-less account got here through Google, so there is nothing to
  // re-prove beyond the session it is already holding.
  if (account?.passwordHash) {
    if (!password) jsonError('Enter your current password to change your email address.');
    if (!(await compareSecret(password, account.passwordHash))) {
      auditLog({ event: 'account.email_change', outcome: 'denied', userId: current.id, email: current.email, ip: requestIp(request) });
      jsonError('Current password is incorrect.', 403);
    }
  }

  const taken = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (taken) jsonError('That email address is already in use.', 409);

  consumeLimit({ windowMs: 15 * 60 * 1000, max: 5, keyPrefix: 'email-change', subject: current.id });

  const code = createVerificationCode();
  await prisma.$transaction([
    // One live code at a time, exactly like a reset link.
    prisma.emailVerificationCode.updateMany({
      where: { userId: current.id, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.emailVerificationCode.create({
      data: {
        userId: current.id,
        codeHash: hashToken(`${code}:${email}`),
        expiresAt: addMinutes(EMAIL_CHANGE_LIFETIME_MINUTES),
      },
    }),
  ]);

  auditLog({ event: 'account.email_change_requested', outcome: 'success', userId: current.id, email: current.email, ip: requestIp(request) });
  await sendVerificationCodeEmail(email, code);
  response.json({ ok: true, expiresInMinutes: EMAIL_CHANGE_LIFETIME_MINUTES });
}));

authRouter.post('/api/account/email/verify', authStrictLimit, asyncHandler(async (request, response) => {
  const current = await requireUser(request);
  const email = cleanEmail(request.body.email);
  const code = cleanString(request.body.code);
  if (!isValidEmail(email) || !code) jsonError('Enter the code sent to your new address.');
  if (roleForEmail(email, current.role) !== current.role) {
    jsonError('This address cannot be used for your account. Ask an administrator.', 403);
  }

  const verification = await prisma.emailVerificationCode.findFirst({
    where: {
      userId: current.id,
      codeHash: hashToken(`${code}:${email}`),
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { id: true },
  });
  if (!verification) jsonError('That code is not valid. Request a new one.', 400);

  try {
    await prisma.$transaction([
      prisma.emailVerificationCode.updateMany({
        where: { id: verification.id, usedAt: null },
        data: { usedAt: new Date() },
      }),
      prisma.user.update({
        where: { id: current.id },
        // The address is the account's identity, so every other device is signed
        // out — the same rule a password change follows.
        data: { email, emailVerifiedAt: new Date(), sessionVersion: { increment: 1 } },
      }),
      prisma.session.updateMany({
        where: { userId: current.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  } catch (error) {
    if (isUniqueConstraintError(error)) jsonError('That email address is already in use.', 409);
    throw error;
  }

  auditLog({ event: 'account.email_changed', outcome: 'success', userId: current.id, email, ip: requestIp(request) });
  // Every session just died, including this one; hand this device a new cookie
  // so changing an address does not read as being logged out for no reason.
  const updated = await prisma.user.findUniqueOrThrow({
    where: { id: current.id },
    select: { id: true, sessionVersion: true },
  });
  await startSession(response, updated);
  response.json({ ok: true, email });
}));

/** How long a reset link stays usable. Short: it is a bearer token in an inbox. */
const PASSWORD_RESET_LIFETIME_MINUTES = 30;

/**
 * Ask for a reset link.
 *
 * The response never varies. Telling the caller whether an address has an
 * account turns this endpoint into an account-existence oracle, which is worse
 * than the small confusion of a silent no-op for a mistyped address.
 */
authRouter.post('/api/auth/password-reset', authStrictLimit, asyncHandler(async (request, response) => {
  const email = cleanEmail(request.body.email);
  const identical = { ok: true, message: 'If that email has an account, a reset link is on its way.' };

  if (!isValidEmail(email)) {
    response.json(identical);
    return;
  }
  // Per-address, so a script cannot mail-bomb one person's inbox by rotating
  // source addresses. Charged before the lookup so the timing does not differ.
  consumeLimit({ windowMs: 15 * 60 * 1000, max: 3, keyPrefix: 'password-reset', subject: email });

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, status: true },
  });

  // An INVITED account has its own completion link, and an INACTIVE one must not
  // be revivable by email alone.
  if (user && user.status === UserStatus.ACTIVE) {
    const token = createInviteToken();
    await prisma.$transaction([
      // One live link at a time: requesting a new one retires the old.
      prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      }),
      prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(token),
          expiresAt: addMinutes(PASSWORD_RESET_LIFETIME_MINUTES),
        },
      }),
    ]);
    auditLog({
      event: 'auth.password_reset_request',
      outcome: 'success',
      userId: user.id,
      email: user.email,
      ip: requestIp(request),
    });
    await sendPasswordResetEmail(user.email, token, PASSWORD_RESET_LIFETIME_MINUTES);
  }

  response.json(identical);
}));

/**
 * Is this reset link still good?
 *
 * Read-only and never consuming, so the form can say "this link expired, ask
 * for a new one" before the reader types a new password twice and only then
 * learns the link was dead. It answers about the token it was handed and
 * nothing else — no email, no name, no account state — so it reveals no more
 * than trying to redeem the link already would.
 */
authRouter.get('/api/auth/password-reset/validate', authStrictLimit, asyncHandler(async (request, response) => {
  const token = cleanString(request.query.token);
  if (!token) {
    response.json({ valid: false, reason: 'MISSING' });
    return;
  }
  const reset = await prisma.passwordResetToken.findFirst({
    where: { tokenHash: hashToken(token) },
    select: { usedAt: true, expiresAt: true, user: { select: { status: true } } },
  });
  if (!reset) {
    response.json({ valid: false, reason: 'UNKNOWN' });
    return;
  }
  if (reset.usedAt) {
    response.json({ valid: false, reason: 'USED' });
    return;
  }
  if (reset.expiresAt.getTime() <= Date.now()) {
    response.json({ valid: false, reason: 'EXPIRED' });
    return;
  }
  if (reset.user.status !== UserStatus.ACTIVE) {
    response.json({ valid: false, reason: 'UNKNOWN' });
    return;
  }
  response.json({ valid: true, expiresAt: reset.expiresAt.toISOString() });
}));

/**
 * Redeem a reset link.
 *
 * Consuming one bumps `sessionVersion`, so whoever knew the old password — the
 * reason the reset was needed — is signed out of every device. The caller is
 * not signed in here: they log in with the new password, which also proves it
 * reached the right person.
 */
authRouter.post('/api/auth/password-reset/complete', authStrictLimit, asyncHandler(async (request, response) => {
  const token = cleanString(request.body.token);
  const password = cleanString(request.body.password);

  if (!token) jsonError('Reset link is missing or incomplete.');
  const passwordError = passwordValidationError(password);
  if (passwordError) jsonError(passwordError);

  const reset = await prisma.passwordResetToken.findFirst({
    where: { tokenHash: hashToken(token), usedAt: null, expiresAt: { gt: new Date() } },
    include: { user: { select: { id: true, email: true, status: true } } },
  });
  // One message for expired, already-used, and never-existed: distinguishing
  // them tells a holder of a stale link which kind of stale it is.
  if (!reset || reset.user.status !== UserStatus.ACTIVE) {
    jsonError('This reset link is no longer valid. Request a new one.', 400);
  }

  const passwordHash = await hashSecret(password);
  await prisma.$transaction([
    // Guarded on `usedAt` still being null so two submissions of the same link
    // cannot both redeem it.
    prisma.passwordResetToken.updateMany({
      where: { id: reset.id, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: reset.user.id },
      data: { passwordHash, sessionVersion: { increment: 1 } },
    }),
    prisma.session.updateMany({
      where: { userId: reset.user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  auditLog({
    event: 'auth.password_reset_complete',
    outcome: 'success',
    userId: reset.user.id,
    email: reset.user.email,
    ip: requestIp(request),
  });
  response.json({ ok: true });
}));

authRouter.get('/api/auth/me', asyncHandler(async (request, response) => {
  const user = await getCurrentUser(request);
  response.json({ user });
}));

authRouter.post('/api/auth/invite/complete', asyncHandler(async (request, response) => {
  const token = cleanString(request.body.token);
  const name = cleanString(request.body.name);
  const surname = cleanString(request.body.surname);
  const password = cleanString(request.body.password);
  const clubId = cleanString(request.body.clubId);

  requireAccountLegalAcceptance({
    legalAccepted: request.body.legalAccepted,
    eligibilityConfirmed: request.body.eligibilityConfirmed,
  });

  if (!token) jsonError('Invite token is required.');
  if (!name || !surname) jsonError('Name and surname are required.');
  const passwordError = passwordValidationError(password);
  if (passwordError) jsonError(passwordError);

  const invite = await prisma.inviteToken.findFirst({
    where: {
      tokenHash: hashToken(token),
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: {
      user: {
        include: {
          clubMemberships: { take: 1 },
        },
      },
    },
  });

  if (!invite) jsonError('Invite link is invalid or expired.', 404);
  assertNotDisqualified(invite.user);

  const role = roleForEmail(invite.user.email, invite.user.role, { emailVerified: true });
  const hasClub = invite.user.clubMemberships.length > 0;
  let nextClubId: string | null = null;
  if (role === UserRole.USER && !hasClub) {
    nextClubId = (await requireClubId(clubId)).id;
  }

  const user = await prisma.$transaction(async (tx) => {
    const acceptedAt = new Date();
    await tx.inviteToken.update({
      where: { id: invite.id },
      data: { usedAt: new Date() },
    });
    const updated = await tx.user.update({
      where: { id: invite.userId },
      data: {
        name,
        surname,
        passwordHash: await hashSecret(password),
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        role,
        sessionVersion: { increment: 1 },
        termsAcceptedAt: acceptedAt,
        termsVersion: ACCOUNT_TERMS_VERSION,
        privacyAcknowledgedAt: acceptedAt,
        privacyVersion: PRIVACY_POLICY_VERSION,
        eligibilityConfirmedAt: acceptedAt,
      },
      include: {
        clubMemberships: {
          include: {
            club: { select: { id: true, name: true, slug: true } },
          },
          take: 1,
        },
      },
    });
    if (nextClubId) {
      await setPlayerClub(updated.id, nextClubId, '', tx);
      return tx.user.findUniqueOrThrow({
        where: { id: updated.id },
        include: {
          clubMemberships: {
            include: {
              club: { select: { id: true, name: true, slug: true } },
            },
            take: 1,
          },
        },
      });
    }
    return updated;
  });

  auditLog({
    event: 'auth.invite_complete',
    outcome: 'success',
    userId: user.id,
    email: user.email,
    ip: requestIp(request),
  });
  await reconcileUserRole(user.id);
  touchLastLogin(user.id);
  await startSession(response, user);
  response.json({ user: toPublicUser(user) });
}));

authRouter.post('/api/account/club', asyncHandler(async (request, response) => {
  const current = await requireUser(request);
  if (isStaffRole(current.role)) jsonError('Staff accounts do not belong to clubs.', 400);
  if (current.club) jsonError('Club is already set.', 409);
  assertNotDisqualified({
    disqualifiedUntil: current.disqualifiedUntil ? new Date(current.disqualifiedUntil) : null,
    disqualificationReason: current.disqualificationReason,
  });

  const name = cleanString(request.body.name);
  const description = cleanString(request.body.description);
  await createClubForPlayer(current.id, { name, description });
  const user = await getCurrentUser(request);
  response.status(201).json({ user });
}));

authRouter.post('/api/account/club/mate', asyncHandler(async (request, response) => {
  const current = await requireUser(request);
  if (isStaffRole(current.role)) jsonError('Staff accounts do not belong to clubs.', 400);
  if (!current.club) jsonError('Create your club first.', 400);
  await requireClubLeadership(current.id, current.club.id);
  // Each invite mails a caller-supplied address in the club's name, so an
  // unthrottled route is a relay for mail-bombing a stranger and for burning
  // the sender's reputation. Five an hour is generous for a real roster.
  consumeLimit({ windowMs: 60 * 60 * 1000, max: 5, keyPrefix: 'club-mate', subject: current.id });
  assertNotDisqualified({
    disqualifiedUntil: current.disqualifiedUntil ? new Date(current.disqualifiedUntil) : null,
    disqualificationReason: current.disqualificationReason,
  });

  const { mate, invited } = await inviteClubMate({
    clubId: current.club.id,
    clubName: current.club.name,
    inviterName: current.fullName || current.email,
    inviterEmail: current.email,
    email: cleanEmail(request.body.email),
    name: cleanString(request.body.name),
    surname: cleanString(request.body.surname),
    phone: cleanString(request.body.phone),
  });

  const club = await prisma.club.findUnique({
    where: { id: current.club.id },
    include: clubInclude,
  });

  response.status(201).json({
    mate: toPublicUser(mate),
    club: club ? serializeClub(club) : null,
    invited,
  });
}));

authRouter.get('/api/auth/google', (request, response) => {
  if (!config.googleClientId) {
    response.redirect(frontendRedirect('/login?error=google-not-configured'));
    return;
  }

  const state = crypto.randomUUID();
  const legalAccepted = cleanString(request.query.legalAccepted) === 'true';
  const eligibilityConfirmed = cleanString(request.query.eligibilityConfirmed) === 'true';
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', config.googleClientId);
  url.searchParams.set('redirect_uri', config.googleRedirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('prompt', 'select_account');
  url.searchParams.set('state', state);

  setOAuthStateCookie(response, state);
  if (legalAccepted && eligibilityConfirmed) setOAuthLegalCookie(response);
  response.redirect(url.toString());
});

authRouter.get('/api/auth/google/callback', asyncHandler(async (request, response) => {
  const code = cleanString(request.query.code);
  const state = cleanString(request.query.state);
  const storedState = request.cookies?.[OAUTH_STATE_COOKIE] as string | undefined;
  const legalAccepted = request.cookies?.[OAUTH_LEGAL_COOKIE] === 'accepted';

  clearOAuthStateCookie(response);
  clearOAuthLegalCookie(response);

  if (!code || !state || !storedState || !timingSafeEqualString(state, storedState)) {
    response.redirect(frontendRedirect('/login?error=google-state'));
    return;
  }

  if (!config.googleClientId || !config.googleClientSecret) {
    response.redirect(frontendRedirect('/login?error=google-not-configured'));
    return;
  }

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.googleClientId,
      client_secret: config.googleClientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: config.googleRedirectUri,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const tokenData = (await tokenResponse.json()) as GoogleTokenResponse;

  if (!tokenResponse.ok || !tokenData.access_token) {
    response.redirect(frontendRedirect(`/login?error=${tokenData.error ?? 'google-token'}`));
    return;
  }

  const profileResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { authorization: `Bearer ${tokenData.access_token}` },
    signal: AbortSignal.timeout(10_000),
  });
  const profile = (await profileResponse.json()) as GoogleProfile;

  if (!profileResponse.ok || !profile.email || profile.verified_email !== true) {
    response.redirect(frontendRedirect('/login?error=google-profile'));
    return;
  }

  const email = profile.email.toLowerCase();
  const names = splitGoogleName(profile);

  const user = await prisma.$transaction(async (tx) => {
    const account = await tx.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: AccountProvider.GOOGLE,
          providerAccountId: profile.id,
        },
      },
      include: { user: true },
    });

    if (account) {
      if (account.user.status === UserStatus.INACTIVE) {
        response.redirect(frontendRedirect('/login?error=account-inactive'));
        return null;
      }
      return tx.user.update({
        where: { id: account.userId },
        data: {
          status: UserStatus.ACTIVE,
          emailVerifiedAt: account.user.emailVerifiedAt ?? new Date(),
          role: roleForEmail(account.user.email, account.user.role, { emailVerified: true }),
          name: account.user.name ?? names.name,
          surname: account.user.surname ?? names.surname,
        },
      });
    }

    const existing = await tx.user.findUnique({ where: { email } });
    if (existing?.status === UserStatus.INACTIVE) {
      response.redirect(frontendRedirect('/login?error=account-inactive'));
      return null;
    }
    const accountNeedsAcceptance = !existing || existing.status === UserStatus.INVITED;
    if (accountNeedsAcceptance && !legalAccepted) {
      response.redirect(frontendRedirect('/register?error=legal-consent-required'));
      return null;
    }
    // A brand-new Google signup files a club request like anyone else; no User
    // row exists until an admin approves it.
    if (!existing) return { newcomer: true as const };
    const acceptedAt = accountNeedsAcceptance ? new Date() : undefined;
    const nextUser = existing
      ? await tx.user.update({
          where: { id: existing.id },
          data: {
            status: UserStatus.ACTIVE,
            emailVerifiedAt: existing.emailVerifiedAt ?? new Date(),
            role: roleForEmail(email, existing.role, { emailVerified: true }),
            name: existing.name ?? names.name,
            surname: existing.surname ?? names.surname,
            ...(acceptedAt ? {
              termsAcceptedAt: acceptedAt,
              termsVersion: ACCOUNT_TERMS_VERSION,
              privacyAcknowledgedAt: acceptedAt,
              privacyVersion: PRIVACY_POLICY_VERSION,
              eligibilityConfirmedAt: acceptedAt,
            } : {}),
          },
        })
      : await tx.user.create({
          data: {
            email,
            name: names.name,
            surname: names.surname,
            status: UserStatus.ACTIVE,
            emailVerifiedAt: new Date(),
            role: roleForEmail(email, undefined, { emailVerified: true }),
            termsAcceptedAt: acceptedAt,
            termsVersion: ACCOUNT_TERMS_VERSION,
            privacyAcknowledgedAt: acceptedAt,
            privacyVersion: PRIVACY_POLICY_VERSION,
            eligibilityConfirmedAt: acceptedAt,
          },
        });

    await tx.oAuthAccount.create({
      data: {
        userId: nextUser.id,
        provider: AccountProvider.GOOGLE,
        providerAccountId: profile.id,
      },
    });

    return nextUser;
  });

  if (!user) return;

  if ('newcomer' in user) {
    const application = await startGoogleApplication({
      email,
      name: names.name,
      surname: names.surname,
      googleAccountId: profile.id,
    });
    setApplicationCookie(response, application.id);
    response.redirect(frontendRedirect(
      application.status === ClubApplicationStatus.SUBMITTED
        ? '/register/status'
        : '/register?step=club',
    ));
    return;
  }

  await reconcileUserRole(user.id);
  touchLastLogin(user.id);
  await startSession(response, user);
  const role = roleForEmail(user.email, user.role, { emailVerified: true });
  const isStaff = role === UserRole.ADMIN || role === UserRole.JUDGE;
  if (!isStaff) {
    const membership = await prisma.clubMember.findUnique({ where: { userId: user.id } });
    if (!membership) {
      response.redirect(frontendRedirect('/complete-club'));
      return;
    }
  }
  response.redirect(frontendRedirect(role === UserRole.ADMIN ? '/admin' : role === UserRole.JUDGE ? '/judge' : '/dashboard'));
}));
