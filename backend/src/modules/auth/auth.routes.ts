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
  isValidEmail,
  jsonError,
} from '../../common/http.js';
import { sendVerificationCodeEmail } from '../../common/notifications.js';
import {
  addMinutes,
  compareSecret,
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
  revokeUserSessions,
  roleForEmail,
  setOAuthStateCookie,
  setOAuthLegalCookie,
  setApplicationCookie,
  setSessionCookie,
  toPublicUser,
  touchLastLogin,
} from './auth.service.js';
import { createClubForPlayer, inviteClubMate, requireClubId, setPlayerClub } from '../clubs/clubs.service.js';
import { startGoogleApplication } from '../club-applications/club-applications.service.js';
import { serializeClub } from '../../common/serializers.js';
import { clubInclude } from '../../common/includes.js';
import { assertNotDisqualified } from '../../common/disqualification.js';
import { rateLimit } from '../../common/rateLimit.js';
import { auditLog, requestIp } from '../../common/audit.js';
import {
  ACCOUNT_TERMS_VERSION,
  PRIVACY_POLICY_VERSION,
  requireAccountLegalAcceptance,
} from '../../common/legal.js';

export const authRouter = Router();

const ADMIN_BOOTSTRAP_LOCK_ID = 730_127_001;

const authBurstLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, keyPrefix: 'auth' });
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
  setSessionCookie(response, result.user);
  response.status(result.created ? 201 : 200).json({
    created: result.created,
    user: toPublicUser(result.user),
  });
}));

authRouter.post('/api/auth/register', authBurstLimit, asyncHandler(async (request, response) => {
  const email = cleanEmail(request.body.email);
  const name = cleanString(request.body.name);
  const surname = cleanString(request.body.surname);
  const phone = cleanString(request.body.phone);
  const password = cleanString(request.body.password);

  requireAccountLegalAcceptance({
    legalAccepted: request.body.legalAccepted,
    eligibilityConfirmed: request.body.eligibilityConfirmed,
  });

  if (!isValidEmail(email)) jsonError('Enter a valid email.');
  if (!name || !surname) jsonError('Name and surname are required.');
  if (phone.length < 5) jsonError('Phone number is required.');
  const passwordError = passwordValidationError(password);
  if (passwordError) jsonError(passwordError);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing?.status === UserStatus.ACTIVE && existing.passwordHash) {
    jsonError('This email is already registered.', 409);
  }

  // Do not elevate via ADMIN_EMAILS until the email is verified.
  const role =
    existing?.role === UserRole.ADMIN ? UserRole.ADMIN : UserRole.USER;

  const passwordHash = await hashSecret(password);
  const acceptedAt = new Date();
  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          name,
          surname,
          phone,
          passwordHash,
          role,
          status: UserStatus.PENDING_VERIFICATION,
          termsAcceptedAt: acceptedAt,
          termsVersion: ACCOUNT_TERMS_VERSION,
          privacyAcknowledgedAt: acceptedAt,
          privacyVersion: PRIVACY_POLICY_VERSION,
          eligibilityConfirmedAt: acceptedAt,
        },
      })
    : await prisma.user.create({
        data: {
          email,
          name,
          surname,
          phone,
          passwordHash,
          role,
          status: UserStatus.PENDING_VERIFICATION,
          termsAcceptedAt: acceptedAt,
          termsVersion: ACCOUNT_TERMS_VERSION,
          privacyAcknowledgedAt: acceptedAt,
          privacyVersion: PRIVACY_POLICY_VERSION,
          eligibilityConfirmedAt: acceptedAt,
        },
      });

  const code = createVerificationCode();
  await prisma.emailVerificationCode.create({
    data: {
      userId: user.id,
      codeHash: await hashSecret(code),
      expiresAt: addMinutes(30),
    },
  });

  await sendVerificationCodeEmail(email, code);
  response.status(201).json({ ok: true, email, message: 'Verification code sent.' });
}));

authRouter.post('/api/auth/verify', authStrictLimit, asyncHandler(async (request, response) => {
  const email = cleanEmail(request.body.email);
  const code = cleanString(request.body.code);

  if (!email || !code) jsonError('Email and code are required.');

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) jsonError('User not found.', 404);

  const verification = await prisma.emailVerificationCode.findFirst({
    where: {
      userId: user.id,
      usedAt: null,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!verification) {
    jsonError('No verification code found. Sign up again to receive a new code.');
  }

  if (verification.expiresAt.getTime() <= Date.now()) {
    jsonError('Verification code expired. Sign up again to receive a new code.');
  }

  const codeOk = await compareSecret(code, verification.codeHash);
  if (!codeOk) jsonError('Incorrect verification code.', 401);

  const verifiedUser = await prisma.$transaction(async (tx) => {
    await tx.emailVerificationCode.update({
      where: { id: verification.id },
      data: { usedAt: new Date() },
    });
    return tx.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: new Date(),
        status: UserStatus.ACTIVE,
        role: roleForEmail(user.email, user.role, { emailVerified: true }),
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
  });

  await reconcileUserRole(verifiedUser.id);
  touchLastLogin(verifiedUser.id);
  setSessionCookie(response, verifiedUser);
  response.json({ user: toPublicUser(verifiedUser) });
}));

authRouter.post('/api/auth/login', authStrictLimit, asyncHandler(async (request, response) => {
  const email = cleanEmail(request.body.email);
  const password = cleanString(request.body.password);
  const ip = requestIp(request);

  if (!email || !password) jsonError('Email and password are required.');

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
  setSessionCookie(response, user);
  response.json({ user: toPublicUser(user) });
}));

authRouter.post('/api/auth/logout', asyncHandler(async (request, response) => {
  const current = await getCurrentUser(request);
  if (current) {
    await revokeUserSessions(current.id);
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
  setSessionCookie(response, user);
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
  setSessionCookie(response, user);
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
