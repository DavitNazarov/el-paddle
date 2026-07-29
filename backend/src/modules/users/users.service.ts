import { UserRole, UserStatus, type User } from '../../generated/prisma/client.js';
import { jsonError } from '../../common/http.js';
import { sendAccountInviteEmail } from '../../common/notifications.js';
import {
  addDays,
  compareSecret,
  createInviteToken,
  hashSecret,
  hashToken,
} from '../../common/security.js';
import { prisma } from '../../database/prisma.js';
import { roleForEmail } from '../auth/auth.service.js';
import { requireClubId, setPlayerClub } from '../clubs/clubs.service.js';
import { getPlayerStats } from './player-stats.js';
import { cursorArgs, toPage, type ListRange } from '../../common/pagination.js';

export { calculatePlayerStats as calculatePublicPlayerStats } from './player-stats.js';

export { assertNotDisqualified, isDisqualified } from '../../common/disqualification.js';

const userWithClubInclude = {
  clubMemberships: {
    include: {
      club: {
        select: { id: true, name: true, slug: true },
      },
    },
    take: 1,
  },
} as const;

const publicPlayerSelect = {
  id: true,
  name: true,
  surname: true,
  clubMemberships: {
    take: 1,
    select: {
      roleTitle: true,
      club: {
        select: { id: true, name: true, slug: true },
      },
    },
  },
} as const;

async function publicPlayerStats(playerIds: string[]) {
  return getPlayerStats(playerIds, { publicOnly: true });
}

export async function listUsers(role?: UserRole, range: ListRange = {}) {
  const { take, pageSize, ...cursor } = cursorArgs(range);
  const rows = await prisma.user.findMany({
    where: role ? { role } : undefined,
    orderBy: [{ role: 'asc' }, { createdAt: 'desc' }, { id: 'desc' }],
    include: userWithClubInclude,
    take,
    ...cursor,
  });
  return toPage(rows, pageSize);
}

export async function listPublicPlayers(range: ListRange = {}) {
  const { take, pageSize, ...cursor } = cursorArgs(range);
  const rows = await prisma.user.findMany({
    where: {
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
    },
    orderBy: [{ name: 'asc' }, { surname: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    select: publicPlayerSelect,
    take,
    ...cursor,
  });

  const { items, nextCursor } = toPage(rows, pageSize);
  const stats = await publicPlayerStats(items.map((player) => player.id));
  return {
    items: items.map((player) => ({
      ...player,
      stats: stats.get(player.id) ?? { matchesPlayed: 0, wins: 0, losses: 0 },
    })),
    nextCursor,
  };
}

export async function getPublicPlayer(playerId: string) {
  const player = await prisma.user.findFirst({
    where: {
      id: playerId,
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
    },
    select: publicPlayerSelect,
  });

  if (!player) jsonError('Player not found.', 404);
  const stats = await publicPlayerStats([player.id]);
  return {
    ...player,
    stats: stats.get(player.id) ?? { matchesPlayed: 0, wins: 0, losses: 0 },
  };
}

export async function getUserWithClub(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: userWithClubInclude,
  });
}

type CreateUserInput = {
  email: string;
  name: string;
  surname: string;
  role: UserRole;
  password?: string;
  clubId?: string;
};

export async function createUserByAdmin(input: CreateUserInput) {
  const email = input.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) jsonError('This email is already registered.', 409);

  const role =
    input.role === UserRole.ADMIN
      ? UserRole.ADMIN
      : input.role === UserRole.JUDGE
        ? UserRole.JUDGE
        : input.role === UserRole.ORGANISER
          ? UserRole.ORGANISER
          : roleForEmail(email, UserRole.USER);

  let clubId: string | undefined;
  if (role === UserRole.USER) {
    const club = await requireClubId(input.clubId ?? '');
    clubId = club.id;
  }

  if (input.password) {
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          name: input.name,
          surname: input.surname,
          passwordHash: await hashSecret(input.password!),
          role,
          status: UserStatus.ACTIVE,
          emailVerifiedAt: new Date(),
          sessionVersion: 0,
        },
      });
      if (clubId) await setPlayerClub(created.id, clubId, '', tx);
      return created;
    });
    const full = await getUserWithClub(user.id);
    return { user: full!, invited: false as const };
  }

  const inviteToken = createInviteToken();
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email,
        name: input.name,
        surname: input.surname,
        role,
        status: UserStatus.INVITED,
      },
    });
    if (clubId) await setPlayerClub(created.id, clubId, '', tx);
    await tx.inviteToken.create({
      data: {
        userId: created.id,
        tokenHash: hashToken(inviteToken),
        expiresAt: addDays(14),
      },
    });
    return created;
  });

  await sendAccountInviteEmail(email, inviteToken, role);
  const full = await getUserWithClub(user.id);
  return { user: full!, invited: true as const };
}

/** The account fields a user may read and edit about themselves. */
export async function getOwnAccount(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, surname: true, phone: true, passwordHash: true },
  });
  if (!user) jsonError('User not found.', 404);
  return {
    email: user.email,
    name: user.name ?? '',
    surname: user.surname ?? '',
    phone: user.phone ?? '',
    // Google-only accounts have no password yet, so the form must not ask for
    // a current one. The hash itself never leaves the server.
    hasPassword: Boolean(user.passwordHash),
  };
}

type OwnProfileInput = {
  name: string;
  surname: string;
  phone: string;
};

/**
 * Self-service profile edit. Email, role, and status stay out of reach: they
 * are verification- and admin-controlled.
 */
export async function updateOwnProfile(userId: string, input: OwnProfileInput) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });
  if (!user) jsonError('User not found.', 404);
  // Players are contacted by phone about their registrations, so they cannot
  // clear it. Staff accounts never needed one.
  if (user.role === UserRole.USER && !input.phone) {
    jsonError('Phone number is required.');
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      name: input.name,
      surname: input.surname,
      phone: input.phone || null,
    },
  });

  const full = await getUserWithClub(userId);
  if (!full) jsonError('User not found.', 404);
  return full;
}

type OwnPasswordInput = {
  currentPassword: string;
  newPassword: string;
};

/**
 * Change the caller's own password. Every outstanding session is invalidated in
 * the same write; the route re-issues a cookie for the device that made the
 * change.
 */
export async function changeOwnPassword(userId: string, input: OwnPasswordInput) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, passwordHash: true },
  });
  if (!user) jsonError('User not found.', 404);

  if (user.passwordHash) {
    if (!input.currentPassword) jsonError('Enter your current password.');
    const ok = await compareSecret(input.currentPassword, user.passwordHash);
    if (!ok) jsonError('Current password is incorrect.', 401);
  }

  return prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash: await hashSecret(input.newPassword),
      sessionVersion: { increment: 1 },
    },
    select: { id: true, sessionVersion: true },
  });
}

export async function deleteUserAccount(userId: string, actorId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) jsonError('User not found.', 404);

  if (user.role === UserRole.ADMIN) {
    const adminCount = await prisma.user.count({ where: { role: UserRole.ADMIN } });
    if (adminCount <= 1) {
      jsonError('Cannot delete the last admin account.', 409);
    }
  }

  await prisma.user.delete({ where: { id: userId } });
  return { deletedSelf: userId === actorId };
}

type DisqualifyInput = {
  until: Date | null;
  reason?: string;
};

export async function setUserDisqualification(userId: string, input: DisqualifyInput) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) jsonError('User not found.', 404);
  if (user.role !== UserRole.USER) {
    jsonError('Only players can be disqualified.', 400);
  }

  if (input.until && input.until.getTime() <= Date.now()) {
    jsonError('Disqualification end date must be in the future.');
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      disqualifiedUntil: input.until,
      disqualificationReason: input.until ? (input.reason?.trim() || null) : null,
    },
  });

  const full = await getUserWithClub(userId);
  if (!full) jsonError('User not found.', 404);
  return full;
}

export async function setJudgeActive(judgeId: string, active: boolean) {
  const judge = await prisma.user.findFirst({ where: { id: judgeId, role: UserRole.JUDGE } });
  if (!judge) jsonError('Judge not found.', 404);
  if (!active) {
    const activeMatch = await prisma.scheduleItem.findFirst({ where: { assignedJudgeId: judgeId, status: 'IN_PROGRESS' } });
    if (activeMatch) jsonError('Reassign or complete the active match before deactivating this judge.', 409);
  }
  return prisma.user.update({
    where: { id: judgeId },
    data: { status: active ? UserStatus.ACTIVE : UserStatus.INACTIVE, sessionVersion: { increment: 1 } },
  });
}
