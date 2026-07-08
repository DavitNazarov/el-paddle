import crypto from 'crypto';
import { Router } from 'express';
import {
  AccountProvider,
  RegistrationStatus,
  UserRole,
  UserStatus,
} from './generated/prisma/client.js';
import {
  clearOAuthStateCookie,
  clearSessionCookie,
  getCurrentUser,
  OAUTH_STATE_COOKIE,
  requireAdmin,
  requireUser,
  roleForEmail,
  setOAuthStateCookie,
  setSessionCookie,
  toPublicUser,
} from './auth.js';
import { config } from './env.js';
import {
  asyncHandler,
  cleanEmail,
  cleanString,
  cleanStringArray,
  isDatabaseConnectionError,
  isUniqueConstraintError,
  isValidEmail,
  jsonError,
} from './http.js';
import {
  sendRegistrationStatusEmail,
  sendTeammateAddedEmail,
  sendTeammateInviteEmail,
  sendVerificationCodeEmail,
} from './notifications.js';
import { prisma } from './prisma.js';
import {
  addDays,
  addHours,
  compareSecret,
  createInviteToken,
  createVerificationCode,
  hashSecret,
  hashToken,
} from './security.js';
import {
  serializeCategory,
  serializeClub,
  serializeEvent,
  serializeRegistration,
} from './serializers.js';

export const router = Router();

const eventInclude = {
  categories: {
    include: {
      category: true,
    },
  },
} as const;

const registrationInclude = {
  event: true,
  category: true,
  owner: true,
  teammate: true,
  reviewedBy: true,
} as const;

const ADMIN_BOOTSTRAP_LOCK_ID = 730_127_001;

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function frontendRedirect(path: string) {
  return new URL(path, config.frontendUrl).toString();
}

function isRegistrationStatus(status: string): status is RegistrationStatus {
  return Object.values(RegistrationStatus).includes(status as RegistrationStatus);
}

function hashForTiming(value: string) {
  return crypto.createHash('sha256').update(value).digest();
}

function isBootstrapTokenValid(token: string) {
  if (!token || !config.firstAdminBootstrapToken) return false;
  return crypto.timingSafeEqual(
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

router.get('/health', (_request, response) => {
  response.json({ ok: true });
});

router.post('/api/admin/bootstrap', asyncHandler(async (request, response) => {
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

router.post('/api/auth/register', asyncHandler(async (request, response) => {
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

router.post('/api/auth/verify', asyncHandler(async (request, response) => {
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

router.post('/api/auth/login', asyncHandler(async (request, response) => {
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

router.post('/api/auth/logout', (_request, response) => {
  clearSessionCookie(response);
  response.json({ ok: true });
});

router.get('/api/auth/me', asyncHandler(async (request, response) => {
  const user = await getCurrentUser(request);
  response.json({ user });
}));

router.post('/api/auth/invite/complete', asyncHandler(async (request, response) => {
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

router.get('/api/auth/google', (request, response) => {
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

router.get('/api/auth/google/callback', asyncHandler(async (request, response) => {
  const code = cleanString(request.query.code);
  const state = cleanString(request.query.state);
  const storedState = request.cookies?.[OAUTH_STATE_COOKIE] as string | undefined;

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
  clearOAuthStateCookie(response);
  response.redirect(frontendRedirect(roleForEmail(user.email, user.role) === UserRole.ADMIN ? '/admin' : '/dashboard'));
}));

router.get('/api/categories', asyncHandler(async (_request, response) => {
  const categories = await prisma.category.findMany({ orderBy: { name: 'asc' } });
  response.json({ categories: categories.map(serializeCategory) });
}));

router.post('/api/categories', asyncHandler(async (request, response) => {
  try {
    const admin = await requireAdmin(request);
    const name = cleanString(request.body.name);
    const description = cleanString(request.body.description);

    if (name.length < 2) jsonError('Category name is too short.');

    const category = await prisma.category.create({
      data: {
        name,
        description: description || null,
        createdById: admin.id,
      },
    });

    response.status(201).json({ category: serializeCategory(category) });
  } catch (error) {
    if (isUniqueConstraintError(error)) jsonError('Category already exists.', 409);
    throw error;
  }
}));

router.get('/api/events', asyncHandler(async (request, response) => {
  const user = await getCurrentUser(request);
  const adminScope = request.query.scope === 'admin' && user?.role === UserRole.ADMIN;

  const events = await prisma.event.findMany({
    where: adminScope
      ? {}
      : {
          isPublished: true,
          date: { gte: startOfToday() },
        },
    orderBy: { date: 'asc' },
    include: eventInclude,
  });

  response.json({ events: events.map(serializeEvent) });
}));

function parseOptionalDateTime(value: unknown) {
  if (value === null || value === '') return null;
  if (typeof value !== 'string') return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
}

router.post('/api/events', asyncHandler(async (request, response) => {
  const admin = await requireAdmin(request);
  const title = cleanString(request.body.title);
  const dateText = cleanString(request.body.date);
  const location = cleanString(request.body.location);
  const description = cleanString(request.body.description);
  const categoryIds = [...new Set(cleanStringArray(request.body.categoryIds))];
  const date = new Date(dateText);
  const arrivalTime = parseOptionalDateTime(request.body.arrivalTime);

  if (title.length < 3) jsonError('Event title is too short.');
  if (!dateText || Number.isNaN(date.getTime())) jsonError('Enter a valid event date.');
  if (!location) jsonError('Event location is required.');
  if (!categoryIds.length) jsonError('Create and select at least one category first.');
  if (request.body.arrivalTime !== undefined && request.body.arrivalTime !== null && request.body.arrivalTime !== '' && arrivalTime === undefined) {
    jsonError('Enter a valid arrival time.');
  }

  const categories = await prisma.category.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true },
  });

  if (categories.length !== categoryIds.length) {
    jsonError('One or more selected categories were not found.');
  }

  const event = await prisma.event.create({
    data: {
      title,
      date,
      location,
      description: description || null,
      arrivalTime,
      createdById: admin.id,
      categories: {
        create: categoryIds.map((categoryId) => ({
          category: { connect: { id: categoryId } },
        })),
      },
    },
    include: eventInclude,
  });

  response.status(201).json({ event: serializeEvent(event) });
}));

router.patch('/api/events/:id', asyncHandler(async (request, response) => {
  await requireAdmin(request);

  const data: { isPublished?: boolean; arrivalTime?: Date | null } = {};

  if (typeof request.body.isPublished === 'boolean') {
    data.isPublished = request.body.isPublished;
  }

  if ('arrivalTime' in request.body) {
    const arrivalTime = parseOptionalDateTime(request.body.arrivalTime);
    if (request.body.arrivalTime !== null && request.body.arrivalTime !== '' && arrivalTime === undefined) {
      jsonError('Enter a valid arrival time.');
    }
    data.arrivalTime = arrivalTime ?? null;
  }

  if (!Object.keys(data).length) {
    jsonError('No valid event fields to update.');
  }

  const event = await prisma.event.update({
    where: { id: request.params.id },
    data,
    include: eventInclude,
  });

  response.json({ event: serializeEvent(event) });
}));

router.get('/api/dashboard', asyncHandler(async (request, response) => {
  const user = await requireUser(request);
  if (user.role === UserRole.ADMIN) {
    response.json({ user, events: [], registrations: [] });
    return;
  }

  const [events, registrations] = await Promise.all([
    prisma.event.findMany({
      where: { isPublished: true, date: { gte: startOfToday() } },
      orderBy: { date: 'asc' },
      include: eventInclude,
    }),
    prisma.eventRegistration.findMany({
      where: { OR: [{ ownerId: user.id }, { teammateId: user.id }] },
      orderBy: { createdAt: 'desc' },
      include: registrationInclude,
    }),
  ]);

  response.json({
    user,
    events: events.map(serializeEvent),
    registrations: registrations.map(serializeRegistration),
  });
}));

router.post('/api/registrations', asyncHandler(async (request, response) => {
  try {
    const currentUser = await requireUser(request);
    const eventId = cleanString(request.body.eventId);
    const categoryId = cleanString(request.body.categoryId);
    const ownerPhone = cleanString(request.body.ownerPhone);
    const teammatePhone = cleanString(request.body.teammatePhone);
    const teammateEmail = cleanEmail(request.body.teammateEmail);

    if (currentUser.role === UserRole.ADMIN) jsonError('Admins cannot register as athletes.', 403);
    if (!eventId || !categoryId) jsonError('Select an event and category.');
    if (ownerPhone.length < 5) jsonError('Your phone number is required.');
    if (!isValidEmail(teammateEmail)) jsonError('Enter teammate email.');
    if (teammateEmail === currentUser.email) {
      jsonError('Teammate email must be different from your email.');
    }

    const [owner, event] = await Promise.all([
      prisma.user.findUnique({ where: { id: currentUser.id } }),
      prisma.event.findUnique({ where: { id: eventId }, include: { categories: true } }),
    ]);

    if (!owner) jsonError('User not found.', 404);
    if (roleForEmail(owner.email, owner.role) === UserRole.ADMIN) {
      jsonError('Admins cannot register as athletes.', 403);
    }
    if (!event?.isPublished) jsonError('This event is not available.', 404);
    if (!event.categories.some((link) => link.categoryId === categoryId)) {
      jsonError('This category is not available for the selected event.');
    }

    const existingTeammate = await prisma.user.findUnique({ where: { email: teammateEmail } });

    if (roleForEmail(teammateEmail, existingTeammate?.role) === UserRole.ADMIN) {
      jsonError('Admins cannot be added as teammates.', 403);
    }

    let inviteToken = '';
    const teammate =
      existingTeammate ??
      (await prisma.user.create({
        data: {
          email: teammateEmail,
          status: UserStatus.INVITED,
        },
      }));

    if (!existingTeammate || teammate.status === UserStatus.INVITED) {
      inviteToken = createInviteToken();
      await prisma.inviteToken.create({
        data: {
          userId: teammate.id,
          tokenHash: hashToken(inviteToken),
          expiresAt: addDays(14),
        },
      });
    }

    await prisma.eventRegistration.create({
      data: {
        eventId,
        categoryId,
        ownerId: owner.id,
        teammateId: teammate.id,
        teammateEmail,
        ownerPhone,
        teammatePhone: teammatePhone || null,
      },
    });

    if (inviteToken) {
      await sendTeammateInviteEmail(teammateEmail, owner, event, inviteToken);
    } else {
      await sendTeammateAddedEmail(teammate, owner, event);
    }

    response.status(201).json({ ok: true });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      jsonError('You already registered for this event category.', 409);
    }
    throw error;
  }
}));

router.get('/api/admin/registrations', asyncHandler(async (request, response) => {
  await requireAdmin(request);
  const registrations = await prisma.eventRegistration.findMany({
    orderBy: { createdAt: 'desc' },
    include: registrationInclude,
  });

  response.json({ registrations: registrations.map(serializeRegistration) });
}));

router.patch('/api/admin/registrations/:id', asyncHandler(async (request, response) => {
  const admin = await requireAdmin(request);
  const status = cleanString(request.body.status).toUpperCase();
  const declineReason = cleanString(request.body.declineReason);

  if (!isRegistrationStatus(status)) jsonError('Invalid registration status.');
  if (status === RegistrationStatus.DECLINED && !declineReason) {
    jsonError('Decline reason is required.');
  }

  const registration = await prisma.eventRegistration.update({
    where: { id: request.params.id },
    data: {
      status,
      declineReason: status === RegistrationStatus.DECLINED ? declineReason : null,
      reviewedById: admin.id,
      reviewedAt: new Date(),
    },
    include: registrationInclude,
  });

  await sendRegistrationStatusEmail(
    [registration.owner, registration.teammate],
    registration.event,
    registration.status,
    registration.declineReason,
  );

  response.json({ registration: serializeRegistration(registration) });
}));

router.get('/api/admin/clubs', asyncHandler(async (request, response) => {
  await requireAdmin(request);
  const clubs = await prisma.club.findMany({
    orderBy: { name: 'asc' },
    include: { members: { include: { user: true }, orderBy: { createdAt: 'asc' } } },
  });
  response.json({ clubs: clubs.map(serializeClub) });
}));

router.post('/api/admin/clubs', asyncHandler(async (request, response) => {
  try {
    await requireAdmin(request);
    const name = cleanString(request.body.name);
    const description = cleanString(request.body.description);
    const logoUrl = cleanString(request.body.logoUrl);
    const slug = slugify(cleanString(request.body.slug) || name);

    if (name.length < 2) jsonError('Club name is required.');
    if (slug.length < 2) jsonError('Club slug is required.');

    const club = await prisma.club.create({
      data: {
        name,
        slug,
        description: description || null,
        logoUrl: logoUrl || null,
      },
      include: { members: { include: { user: true } } },
    });

    response.status(201).json({ club: serializeClub(club) });
  } catch (error) {
    if (isUniqueConstraintError(error)) jsonError('Club slug already exists.', 409);
    throw error;
  }
}));

router.post('/api/admin/clubs/:id/members', asyncHandler(async (request, response) => {
  await requireAdmin(request);
  const email = cleanEmail(request.body.email);
  const roleTitle = cleanString(request.body.roleTitle);

  if (!isValidEmail(email)) jsonError('Enter a valid user email.');

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) jsonError('User not found. The member needs an account first.', 404);
  if (roleForEmail(user.email, user.role) === UserRole.ADMIN) {
    jsonError('Admins cannot be added to club rosters.', 403);
  }

  await prisma.clubMember.upsert({
    where: {
      clubId_userId: {
        clubId: request.params.id,
        userId: user.id,
      },
    },
    update: { roleTitle: roleTitle || null },
    create: {
      clubId: request.params.id,
      userId: user.id,
      roleTitle: roleTitle || null,
    },
  });

  const club = await prisma.club.findUnique({
    where: { id: request.params.id },
    include: { members: { include: { user: true }, orderBy: { createdAt: 'asc' } } },
  });

  if (!club) jsonError('Club not found.', 404);
  response.json({ club: serializeClub(club) });
}));

router.get('/api/public/events', asyncHandler(async (_request, response) => {
  try {
    const today = startOfToday();
    const [upcoming, previous] = await Promise.all([
      prisma.event.findMany({
        where: { isPublished: true, date: { gte: today } },
        orderBy: { date: 'asc' },
        take: 1,
        include: eventInclude,
      }),
      prisma.event.findMany({
        where: { isPublished: true, date: { lt: today } },
        orderBy: { date: 'desc' },
        take: 6,
        include: eventInclude,
      }),
    ]);

    response.json({
      upcoming: upcoming[0] ? serializeEvent(upcoming[0]) : null,
      previous: previous.map(serializeEvent),
    });
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      response.json({ upcoming: null, previous: [], databaseUnavailable: true });
      return;
    }
    throw error;
  }
}));

router.get('/api/public/clubs/:slug', asyncHandler(async (request, response) => {
  const club = await prisma.club.findUnique({
    where: { slug: request.params.slug },
    include: { members: { include: { user: true }, orderBy: { createdAt: 'asc' } } },
  });

  if (!club) jsonError('Club not found.', 404);
  response.json({ club: serializeClub(club) });
}));
