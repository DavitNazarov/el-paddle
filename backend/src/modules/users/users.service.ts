import { UserRole, UserStatus, type User } from '../../generated/prisma/client.js';
import { jsonError } from '../../common/http.js';
import { sendAccountInviteEmail } from '../../common/notifications.js';
import {
  addDays,
  createInviteToken,
  hashSecret,
  hashToken,
} from '../../common/security.js';
import { prisma } from '../../database/prisma.js';
import { roleForEmail } from '../auth/auth.service.js';
import { requireClubId, setPlayerClub } from '../clubs/clubs.service.js';
import { getPlayerStats } from './player-stats.js';

export { calculatePlayerStats as calculatePublicPlayerStats } from './player-stats.js';

export function isDisqualified(user: Pick<User, 'disqualifiedUntil'>) {
  return Boolean(user.disqualifiedUntil && user.disqualifiedUntil.getTime() > Date.now());
}

export function assertNotDisqualified(user: Pick<User, 'disqualifiedUntil' | 'disqualificationReason'>) {
  if (!isDisqualified(user)) return;
  const until = user.disqualifiedUntil!.toISOString().slice(0, 10);
  const reason = user.disqualificationReason?.trim();
  jsonError(
    reason
      ? `You are disqualified until ${until}. Reason: ${reason}`
      : `You are disqualified until ${until}.`,
    403,
  );
}

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

export async function listUsers(role?: UserRole) {
  return prisma.user.findMany({
    where: role ? { role } : undefined,
    orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
    include: userWithClubInclude,
  });
}

export async function listPublicPlayers() {
  const players = await prisma.user.findMany({
    where: {
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
    },
    orderBy: [{ name: 'asc' }, { surname: 'asc' }, { createdAt: 'asc' }],
    select: publicPlayerSelect,
  });

  const stats = await publicPlayerStats(players.map((player) => player.id));
  return players.map((player) => ({
    ...player,
    stats: stats.get(player.id) ?? { matchesPlayed: 0, wins: 0, losses: 0 },
  }));
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
  if (user.role === UserRole.ADMIN || user.role === UserRole.JUDGE) {
    jsonError('Admins cannot be disqualified.', 400);
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
