import crypto from 'crypto';
import { Router } from 'express';
import {
  AccountProvider,
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
  addHours,
  compareSecret,
  createVerificationCode,
  hashSecret,
  hashToken,
  timingSafeEqualString,
} from '../../common/security.js';
import { prisma } from '../../database/prisma.js';
import {
  clearOAuthStateCookie,
  clearSessionCookie,
  getCurrentUser,
  OAUTH_STATE_COOKIE,
  roleForEmail,
  setOAuthStateCookie,
  setSessionCookie,
  toPublicUser,
} from './auth.service.js';

export const authRouter = Router();

const ADMIN_BOOTSTRAP_LOCK_ID = 730_127_001;

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

authRouter.post('/api/admin/bootstrap', asyncHandler(async (request, response) => {
  const body = typeof request.body === 'object' && request.body !== null
    ? (request.body as Record<string, unknown>)
    : {};
  const token = cleanString(request.get('x-bootstrap-token') ?? body.bootstrapToken);
  const email = cleanEmail(body.email);
  const name = cleanString(body.name);
  const surname = cleanString(body.surname);
  const password = cleanString(body.password);

  if (!config.firstAdminBootstrapToken) {
    jsonError('Admin bootstrap is not configured.', 503);
  }
  if (!isBootstrapTokenValid(token)) jsonError('Invalid bootstrap token.', 401);
  if (!isValidEmail(email)) jsonError('Enter a valid email.');
  if (!name || !surname) jsonError('Name and surname are required.');
  if (password.length < 8) jsonError('Password must be at least 8 characters.');

  const passwordHash = await hashSecret(password);
  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${ADMIN_BOOTSTRAP_LOCK_ID})`;

    const adminCount = await tx.user.count({ where: { role: UserRole.ADMIN } });
    if (adminCount > 0) jsonError('Admin account already exists.', 409);

    const existing = await tx.user.findUnique({ where: { email } });
    const data = {
      email,
      name,
      surname,
      passwordHash,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      emailVerifiedAt: existing?.emailVerifiedAt ?? new Date(),
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

  setSessionCookie(response, result.user);
  response.status(result.created ? 201 : 200).json({
    created: result.created,
    user: toPublicUser(result.user),
  });
}));

authRouter.post('/api/auth/register', asyncHandler(async (request, response) => {
  const email = cleanEmail(request.body.email);
  const name = cleanString(request.body.name);
  const surname = cleanString(request.body.surname);
  const password = cleanString(request.body.password);

  if (!isValidEmail(email)) jsonError('Enter a valid email.');
  if (!name || !surname) jsonError('Name and surname are required.');
  if (password.length < 8) jsonError('Password must be at least 8 characters.');

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing?.status === UserStatus.ACTIVE && existing.passwordHash) {
    jsonError('This email is already registered.', 409);
  }

  const passwordHash = await hashSecret(password);
  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          name,
          surname,
          passwordHash,
          role: roleForEmail(email, existing.role),
          status: UserStatus.PENDING_VERIFICATION,
        },
      })
    : await prisma.user.create({
        data: {
          email,
          name,
          surname,
          passwordHash,
          role: roleForEmail(email),
          status: UserStatus.PENDING_VERIFICATION,
        },
      });

  const code = createVerificationCode();
  await prisma.emailVerificationCode.create({
    data: {
      userId: user.id,
      codeHash: await hashSecret(code),
      expiresAt: addHours(0.5),
    },
  });

  await sendVerificationCodeEmail(email, code);
  response.status(201).json({ ok: true, email, message: 'Verification code sent.' });
}));

authRouter.post('/api/auth/verify', asyncHandler(async (request, response) => {
  const email = cleanEmail(request.body.email);
  const code = cleanString(request.body.code);

  if (!email || !code) jsonError('Email and code are required.');

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) jsonError('User not found.', 404);

  const verification = await prisma.emailVerificationCode.findFirst({
    where: {
      userId: user.id,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!verification) {
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
        role: roleForEmail(user.email, user.role),
      },
    });
  });

  setSessionCookie(response, verifiedUser);
  response.json({ user: toPublicUser(verifiedUser) });
}));

authRouter.post('/api/auth/login', asyncHandler(async (request, response) => {
  const email = cleanEmail(request.body.email);
  const password = cleanString(request.body.password);

  if (!email || !password) jsonError('Email and password are required.');

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.passwordHash) jsonError('Invalid email or password.', 401);

  if (user.status === UserStatus.PENDING_VERIFICATION) {
    jsonError('Verify your email before logging in.', 403);
  }

  if (user.status === UserStatus.INVITED) {
    jsonError('Finish your invited account setup first.', 403);
  }

  const ok = await compareSecret(password, user.passwordHash);
  if (!ok) jsonError('Invalid email or password.', 401);

  setSessionCookie(response, user);
  response.json({ user: toPublicUser(user) });
}));

authRouter.post('/api/auth/logout', (_request, response) => {
  clearSessionCookie(response);
  response.json({ ok: true });
});

authRouter.get('/api/auth/me', asyncHandler(async (request, response) => {
  const user = await getCurrentUser(request);
  response.json({ user });
}));

authRouter.post('/api/auth/invite/complete', asyncHandler(async (request, response) => {
  const token = cleanString(request.body.token);
  const name = cleanString(request.body.name);
  const surname = cleanString(request.body.surname);
  const password = cleanString(request.body.password);

  if (!token) jsonError('Invite token is required.');
  if (!name || !surname) jsonError('Name and surname are required.');
  if (password.length < 8) jsonError('Password must be at least 8 characters.');

  const invite = await prisma.inviteToken.findFirst({
    where: {
      tokenHash: hashToken(token),
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: { user: true },
  });

  if (!invite) jsonError('Invite link is invalid or expired.', 404);

  const user = await prisma.$transaction(async (tx) => {
    await tx.inviteToken.update({
      where: { id: invite.id },
      data: { usedAt: new Date() },
    });
    return tx.user.update({
      where: { id: invite.userId },
      data: {
        name,
        surname,
        passwordHash: await hashSecret(password),
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
      },
    });
  });

  setSessionCookie(response, user);
  response.json({ user: toPublicUser(user) });
}));

authRouter.get('/api/auth/google', (request, response) => {
  if (!config.googleClientId) {
    response.redirect(frontendRedirect('/login?error=google-not-configured'));
    return;
  }

  const state = crypto.randomUUID();
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', config.googleClientId);
  url.searchParams.set('redirect_uri', config.googleRedirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('prompt', 'select_account');
  url.searchParams.set('state', state);

  setOAuthStateCookie(response, state);
  response.redirect(url.toString());
});

authRouter.get('/api/auth/google/callback', asyncHandler(async (request, response) => {
  const code = cleanString(request.query.code);
  const state = cleanString(request.query.state);
  const storedState = request.cookies?.[OAUTH_STATE_COOKIE] as string | undefined;

  clearOAuthStateCookie(response);

  if (!code || !state || !storedState || state !== storedState) {
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
  });
  const tokenData = (await tokenResponse.json()) as GoogleTokenResponse;

  if (!tokenResponse.ok || !tokenData.access_token) {
    response.redirect(frontendRedirect(`/login?error=${tokenData.error ?? 'google-token'}`));
    return;
  }

  const profileResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { authorization: `Bearer ${tokenData.access_token}` },
  });
  const profile = (await profileResponse.json()) as GoogleProfile;

  if (!profileResponse.ok || !profile.email) {
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
      return tx.user.update({
        where: { id: account.userId },
        data: {
          status: UserStatus.ACTIVE,
          emailVerifiedAt: account.user.emailVerifiedAt ?? new Date(),
          role: roleForEmail(account.user.email, account.user.role),
          name: account.user.name ?? names.name,
          surname: account.user.surname ?? names.surname,
        },
      });
    }

    const existing = await tx.user.findUnique({ where: { email } });
    const nextUser = existing
      ? await tx.user.update({
          where: { id: existing.id },
          data: {
            status: UserStatus.ACTIVE,
            emailVerifiedAt: existing.emailVerifiedAt ?? new Date(),
            role: roleForEmail(email, existing.role),
            name: existing.name ?? names.name,
            surname: existing.surname ?? names.surname,
          },
        })
      : await tx.user.create({
          data: {
            email,
            name: names.name,
            surname: names.surname,
            status: UserStatus.ACTIVE,
            emailVerifiedAt: new Date(),
            role: roleForEmail(email),
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

  setSessionCookie(response, user);
  response.redirect(frontendRedirect(roleForEmail(user.email, user.role) === UserRole.ADMIN ? '/admin' : '/dashboard'));
}));
