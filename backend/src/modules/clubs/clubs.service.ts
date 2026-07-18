import {
  BracketStatus,
  ClubJoinRequestStatus,
  ClubMembershipRole,
  EventStatus,
  NotificationType,
  RegistrationStatus,
  UserRole,
  UserStatus,
  type Club,
  type Prisma,
} from '../../generated/prisma/client.js';
import { clubInclude } from '../../common/includes.js';
import { isUniqueConstraintError, jsonError } from '../../common/http.js';
import { prisma } from '../../database/prisma.js';
import { slugify, isSafeSlug } from '../../common/slug.js';
import { roleForEmail } from '../auth/auth.service.js';
import { queueNotification, queueOutbox, writeAudit } from '../../common/domain-events.js';

export async function listAdminClubs() {
  return prisma.club.findMany({
    orderBy: { name: 'asc' },
    include: clubInclude,
  });
}

export async function listPublicClubs() {
  return prisma.club.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      slug: true,
    },
  });
}

export async function requireClubId(clubId: string) {
  if (!clubId) jsonError('Club is required.');
  const club = await prisma.club.findUnique({
    where: { id: clubId },
    select: { id: true, name: true, slug: true },
  });
  if (!club) jsonError('Club not found.', 404);
  return club;
}

export async function setPlayerClub(
  userId: string,
  clubId: string,
  roleTitle = '',
  client: Prisma.TransactionClient | typeof prisma = prisma,
  membershipRole: ClubMembershipRole = ClubMembershipRole.MEMBER,
) {
  const existingMembership = await client.clubMember.findUnique({ where: { userId } });
  if (
    existingMembership?.membershipRole === ClubMembershipRole.LEADER &&
    existingMembership.clubId !== clubId
  ) {
    jsonError('A club leader cannot move to another club.', 409);
  }

  await client.clubMember.upsert({
    where: { userId },
    update: {
      clubId,
      roleTitle: roleTitle || null,
      membershipRole:
        existingMembership?.clubId === clubId
          ? existingMembership.membershipRole
          : membershipRole,
    },
    create: {
      clubId,
      userId,
      roleTitle: roleTitle || null,
      membershipRole,
    },
  });
}

type CreateClubInput = {
  name: string;
  slug: string;
  description: string;
  logoUrl: string;
};

export async function createClub(input: CreateClubInput) {
  const { name, slug, description, logoUrl } = input;
  if (!isSafeSlug(slug)) jsonError('Club slug is required.');

  try {
    return await prisma.club.create({
      data: {
        name,
        slug,
        description: description || null,
        logoUrl: logoUrl || null,
      },
      include: { members: { include: { user: true } } },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) jsonError('Club slug already exists.', 409);
    throw error;
  }
}

export async function createClubForPlayer(
  userId: string,
  input: { name: string; description?: string },
  client: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const name = input.name.trim();
  if (name.length < 2) jsonError('Club name is required.');

  const baseSlug = slugify(name) || 'club';
  if (!isSafeSlug(baseSlug) && baseSlug !== 'club') jsonError('Club name is invalid.');
  let slug = isSafeSlug(baseSlug) ? baseSlug : 'club';
  let attempt = 0;

  while (attempt < 8) {
    try {
      const club = await client.club.create({
        data: {
          name,
          slug,
          description: input.description?.trim() || null,
        },
      });
      await setPlayerClub(userId, club.id, '', client, ClubMembershipRole.LEADER);
      await client.clubJoinRequest.deleteMany({ where: { userId } });
      return club;
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      attempt += 1;
      slug = `${baseSlug}-${attempt + 1}`;
    }
  }

  jsonError('Could not create club. Try a different name.', 409);
}

export async function addClubMember(clubId: string, email: string, roleTitle: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) jsonError('User not found. The member needs an account first.', 404);
  if (roleForEmail(user.email, user.role) === UserRole.ADMIN) {
    jsonError('Admins cannot be added to club rosters.', 403);
  }
  if (user.disqualifiedUntil && user.disqualifiedUntil.getTime() > Date.now()) {
    jsonError('This user is currently disqualified.', 403);
  }

  await requireClubId(clubId);
  const memberCount = await prisma.clubMember.count({ where: { clubId } });
  await setPlayerClub(
    user.id,
    clubId,
    roleTitle,
    prisma,
    memberCount === 0 ? ClubMembershipRole.LEADER : ClubMembershipRole.MEMBER,
  );

  const club = await prisma.club.findUnique({
    where: { id: clubId },
    include: clubInclude,
  });

  if (!club) jsonError('Club not found.', 404);
  return club;
}

export async function getPublicClubBySlug(slug: string) {
  const club = await prisma.club.findUnique({
    where: { slug },
    include: clubInclude,
  });

  if (!club) jsonError('Club not found.', 404);
  return club;
}

type MembershipSummary = {
  clubId: string;
  membershipRole: ClubMembershipRole;
};

export function assertClubKickAllowed(
  actor: MembershipSummary | null,
  target: MembershipSummary | null,
) {
  if (!actor || actor.membershipRole !== ClubMembershipRole.LEADER) {
    jsonError('Only the club leader can remove a player.', 403);
  }
  if (!target || target.clubId !== actor.clubId) {
    jsonError('Club member not found.', 404);
  }
  if (target.membershipRole === ClubMembershipRole.LEADER) {
    jsonError('The club leader cannot be removed.', 409);
  }
}

const activeClubRegistrationStatuses = [
  RegistrationStatus.PENDING,
  RegistrationStatus.APPROVED,
  RegistrationStatus.NEEDS_CHANGES,
  RegistrationStatus.WAITLISTED,
] as const;

type MemberRemovalResolution = {
  registrationId: string;
  expectedVersion: number;
  action: 'REPLACE' | 'WITHDRAW';
  replacementUserId?: string;
};

export function assertMemberRemovalResolutionsComplete(
  affectedRegistrationIds: string[],
  resolutions: MemberRemovalResolution[],
) {
  const resolutionIds = resolutions.map((resolution) => resolution.registrationId);
  if (new Set(resolutionIds).size !== resolutionIds.length) {
    jsonError('Each affected registration can only be resolved once.');
  }
  const expected = new Set(affectedRegistrationIds);
  if (
    resolutionIds.length !== affectedRegistrationIds.length ||
    resolutionIds.some((registrationId) => !expected.has(registrationId))
  ) {
    jsonError(
      'Resolve every unfinished registration before removing this player.',
      409,
    );
  }
}

function memberRemovalBlockReason(registration: {
  event: { status: EventStatus; brackets: { categoryId: string; status: BracketStatus }[] };
  categoryId: string;
}) {
  if (registration.event.status === EventStatus.ONGOING) return 'EVENT_ONGOING' as const;
  if (
    registration.event.brackets.some(
      (bracket) =>
        bracket.categoryId === registration.categoryId &&
        bracket.status === BracketStatus.LOCKED,
    )
  ) {
    return 'BRACKET_LOCKED' as const;
  }
  return null;
}

async function findAffectedMemberRegistrations(
  client: Prisma.TransactionClient | typeof prisma,
  clubId: string,
  userId: string,
) {
  return client.eventRegistration.findMany({
    where: {
      clubId,
      status: { in: [...activeClubRegistrationStatuses] },
      event: { status: { not: EventStatus.COMPLETED } },
      OR: [{ ownerId: userId }, { teammateId: userId }],
    },
    orderBy: [{ event: { date: 'asc' } }, { createdAt: 'asc' }],
    include: {
      event: {
        include: {
          brackets: { select: { categoryId: true, status: true } },
        },
      },
      category: true,
      owner: true,
      teammate: true,
    },
  });
}

export async function getClubMemberRemovalImpact(actorUserId: string, memberId: string) {
  const [actor, target] = await Promise.all([
    prisma.clubMember.findUnique({ where: { userId: actorUserId } }),
    prisma.clubMember.findUnique({
      where: { id: memberId },
      include: { user: true },
    }),
  ]);
  assertClubKickAllowed(actor, target);

  const [registrations, replacementMemberships] = await Promise.all([
    findAffectedMemberRegistrations(prisma, target!.clubId, target!.userId),
    prisma.clubMember.findMany({
      where: {
        clubId: target!.clubId,
        userId: { not: target!.userId },
        user: { status: { not: UserStatus.INACTIVE } },
      },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  const eligibleReplacements = replacementMemberships
    .filter(
      (membership) =>
        roleForEmail(membership.user.email, membership.user.role) === UserRole.USER &&
        (!membership.user.disqualifiedUntil ||
          membership.user.disqualifiedUntil.getTime() <= Date.now()),
    )
    .map((membership) => ({
      id: membership.user.id,
      fullName:
        [membership.user.name, membership.user.surname].filter(Boolean).join(' ') ||
        membership.user.email,
      hasPhone: Boolean(membership.user.phone),
    }));

  return {
    member: {
      id: target!.id,
      userId: target!.userId,
      fullName:
        [target!.user.name, target!.user.surname].filter(Boolean).join(' ') ||
        target!.user.email,
    },
    affectedRegistrations: registrations.map((registration) => ({
      id: registration.id,
      version: registration.version,
      status: registration.status,
      removedSlot:
        registration.ownerId === target!.userId ? ('owner' as const) : ('teammate' as const),
      owner: { id: registration.owner.id, fullName: [registration.owner.name, registration.owner.surname].filter(Boolean).join(' ') || registration.owner.email },
      teammate: { id: registration.teammate.id, fullName: [registration.teammate.name, registration.teammate.surname].filter(Boolean).join(' ') || registration.teammate.email },
      event: {
        id: registration.event.id,
        title: registration.event.title,
        date: registration.event.date.toISOString(),
        status: registration.event.status,
      },
      category: { id: registration.category.id, name: registration.category.name },
      blockedReason: memberRemovalBlockReason(registration),
    })),
    eligibleReplacements,
  };
}

export async function getPlayerClubDetails(userId: string) {
  const membership = await prisma.clubMember.findUnique({
    where: { userId },
    include: {
      club: {
        include: {
          members: {
            include: { user: true },
            orderBy: { createdAt: 'asc' },
          },
          joinRequests: {
            where: { status: ClubJoinRequestStatus.PENDING },
            include: { user: true },
            orderBy: { createdAt: 'asc' },
          },
        },
      },
    },
  });

  if (!membership) jsonError('You do not belong to a club.', 404);
  const isLeader = membership.membershipRole === ClubMembershipRole.LEADER;

  return {
    id: membership.club.id,
    name: membership.club.name,
    slug: membership.club.slug,
    description: membership.club.description ?? '',
    logoUrl: membership.club.logoUrl ?? '',
    currentUserMembershipRole: membership.membershipRole,
    members: membership.club.members
      .filter((member) => roleForEmail(member.user.email, member.user.role) !== UserRole.ADMIN)
      .map((member) => ({
        id: member.id,
        membershipRole: member.membershipRole,
        roleTitle: member.roleTitle ?? '',
        user: {
          id: member.user.id,
          fullName:
            [member.user.name, member.user.surname].filter(Boolean).join(' ') ||
            member.user.email,
        },
      })),
    joinRequests: isLeader
      ? membership.club.joinRequests.map((request) => ({
          id: request.id,
          createdAt: request.createdAt.toISOString(),
          user: {
            id: request.user.id,
            fullName:
              [request.user.name, request.user.surname].filter(Boolean).join(' ') ||
              request.user.email,
          },
        }))
      : [],
  };
}

export async function removeClubMember(
  actorUserId: string,
  memberId: string,
  resolutions: MemberRemovalResolution[] = [],
) {
  return prisma.$transaction(async (tx) => {
    const [actor, target] = await Promise.all([
      tx.clubMember.findUnique({ where: { userId: actorUserId } }),
      tx.clubMember.findUnique({
        where: { id: memberId },
        include: {
          club: { select: { name: true } },
          user: { select: { id: true, email: true } },
        },
      }),
    ]);

    assertClubKickAllowed(actor, target);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`club-member-removal:${target!.userId}`}))`;

    const affectedRegistrations = await findAffectedMemberRegistrations(
      tx,
      target!.clubId,
      target!.userId,
    );
    assertMemberRemovalResolutionsComplete(
      affectedRegistrations.map((registration) => registration.id),
      resolutions,
    );

    for (const registration of affectedRegistrations) {
      const resolution = resolutions.find(
        (candidate) => candidate.registrationId === registration.id,
      )!;
      if (registration.version !== resolution.expectedVersion) {
        jsonError('A registration changed. Review the affected events and try again.', 409);
      }
      const blockedReason = memberRemovalBlockReason(registration);
      if (blockedReason === 'EVENT_ONGOING') {
        jsonError('This player is in an ongoing event and cannot be removed yet.', 409);
      }
      if (blockedReason === 'BRACKET_LOCKED') {
        jsonError('This player is in a locked bracket and cannot be removed yet.', 409);
      }

      if (resolution.action === 'REPLACE') {
        if (!resolution.replacementUserId) jsonError('Choose a replacement player.');
        const replacementMembership = await tx.clubMember.findUnique({
          where: { userId: resolution.replacementUserId },
          include: { user: true },
        });
        if (
          !replacementMembership ||
          replacementMembership.clubId !== target!.clubId ||
          replacementMembership.userId === target!.userId
        ) {
          jsonError('The replacement must be an active member of this club.', 403);
        }
        if (
          replacementMembership.user.status === UserStatus.INACTIVE ||
          roleForEmail(replacementMembership.user.email, replacementMembership.user.role) !==
            UserRole.USER ||
          (replacementMembership.user.disqualifiedUntil &&
            replacementMembership.user.disqualifiedUntil.getTime() > Date.now())
        ) {
          jsonError('The replacement player is not eligible.', 403);
        }

        const removedFromOwnerSlot = registration.ownerId === target!.userId;
        const retainedPlayerId = removedFromOwnerSlot
          ? registration.teammateId
          : registration.ownerId;
        if (replacementMembership.userId === retainedPlayerId) {
          jsonError('A player cannot occupy both team positions.', 409);
        }
        if (removedFromOwnerSlot && !replacementMembership.user.phone) {
          jsonError('The replacement player must add a phone number first.', 409);
        }

        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`reg:${registration.eventId}:${replacementMembership.userId}`}))`;
        const existingPlayerRegistration = await tx.eventRegistration.findFirst({
          where: {
            id: { not: registration.id },
            eventId: registration.eventId,
            OR: [
              { ownerId: replacementMembership.userId },
              { teammateId: replacementMembership.userId },
            ],
          },
          select: { id: true },
        });
        if (existingPlayerRegistration) {
          jsonError('The replacement player is already registered for this event.', 409);
        }

        const updated = await tx.eventRegistration.update({
          where: { id: registration.id },
          data: {
            ...(removedFromOwnerSlot
              ? {
                  ownerId: replacementMembership.userId,
                  ownerPhone: replacementMembership.user.phone!,
                }
              : {
                  teammateId: replacementMembership.userId,
                  teammateEmail: replacementMembership.user.email,
                  teammatePhone: replacementMembership.user.phone,
                }),
            status: RegistrationStatus.PENDING,
            publicStatusReason: null,
            internalReviewNote: null,
            declineReason: null,
            reviewedById: null,
            reviewedAt: null,
            withdrawnAt: null,
            version: { increment: 1 },
          },
          include: { owner: true, teammate: true },
        });

        if (registration.status !== RegistrationStatus.PENDING) {
          await tx.registrationStatusHistory.create({
            data: {
              registrationId: registration.id,
              fromStatus: registration.status,
              toStatus: RegistrationStatus.PENDING,
              actorId: actorUserId,
              publicReason: 'Club leader replaced a departing player.',
              commandId: `club-removal:${target!.id}:${registration.id}:${registration.version}`,
            },
          });
        }
        await writeAudit(tx, {
          action: 'registration.lineup.replaced_for_member_removal',
          actorId: actorUserId,
          eventId: registration.eventId,
          entityType: 'EventRegistration',
          entityId: registration.id,
          before: {
            ownerId: registration.ownerId,
            teammateId: registration.teammateId,
            status: registration.status,
          },
          after: {
            ownerId: updated.ownerId,
            teammateId: updated.teammateId,
            status: updated.status,
          },
          publicReason: 'Club leader replaced a departing player.',
        });
        for (const player of [updated.owner, updated.teammate]) {
          await queueNotification(tx, {
            recipientUserId: player.id,
            recipientEmail: player.email,
            type: NotificationType.REGISTRATION_PENDING,
            title: 'Club team updated',
            message: `${registration.event.title} has a new lineup and is pending administrator review.`,
            entityType: 'EventRegistration',
            entityId: registration.id,
            eventId: registration.eventId,
            actionPath: `/dashboard/entries?entry=${registration.id}`,
            version: updated.version,
            metadata: {
              status: RegistrationStatus.PENDING,
              removedUserId: target!.userId,
              replacementUserId: replacementMembership.userId,
            },
          });
        }
        await queueOutbox(tx, {
          topic: 'registration.lineup.replaced',
          aggregateType: 'EventRegistration',
          aggregateId: registration.id,
          payload: {
            eventId: registration.eventId,
            registrationId: registration.id,
            ownerId: updated.ownerId,
            teammateId: updated.teammateId,
            status: updated.status,
            version: updated.version,
          },
          deduplicationKey: `registration:${registration.id}:lineup:v${updated.version}`,
        });
      } else {
        const updated = await tx.eventRegistration.update({
          where: { id: registration.id },
          data: {
            status: RegistrationStatus.WITHDRAWN,
            publicStatusReason: 'Club withdrew the team while removing a participant.',
            internalReviewNote: null,
            declineReason: null,
            reviewedById: null,
            reviewedAt: null,
            withdrawnAt: new Date(),
            version: { increment: 1 },
          },
          include: { owner: true, teammate: true },
        });
        await tx.registrationStatusHistory.create({
          data: {
            registrationId: registration.id,
            fromStatus: registration.status,
            toStatus: RegistrationStatus.WITHDRAWN,
            actorId: actorUserId,
            publicReason: 'Club withdrew the team while removing a participant.',
            commandId: `club-removal:${target!.id}:${registration.id}:${registration.version}`,
          },
        });
        await writeAudit(tx, {
          action: 'registration.withdrawn_for_member_removal',
          actorId: actorUserId,
          eventId: registration.eventId,
          entityType: 'EventRegistration',
          entityId: registration.id,
          before: { status: registration.status },
          after: { status: updated.status },
          publicReason: 'Club withdrew the team while removing a participant.',
        });
        for (const player of [updated.owner, updated.teammate]) {
          await queueNotification(tx, {
            recipientUserId: player.id,
            recipientEmail: player.email,
            type: NotificationType.REGISTRATION_WITHDRAWN,
            title: 'Club team withdrawn',
            message: `Your club withdrew its team from ${registration.event.title}.`,
            entityType: 'EventRegistration',
            entityId: registration.id,
            eventId: registration.eventId,
            actionPath: `/dashboard/entries?entry=${registration.id}`,
            version: updated.version,
            metadata: {
              previousStatus: registration.status,
              status: RegistrationStatus.WITHDRAWN,
              removedUserId: target!.userId,
            },
          });
        }
        await queueOutbox(tx, {
          topic: 'registration.status.updated',
          aggregateType: 'EventRegistration',
          aggregateId: registration.id,
          payload: {
            eventId: registration.eventId,
            registrationId: registration.id,
            status: RegistrationStatus.WITHDRAWN,
            version: updated.version,
          },
          deduplicationKey: `registration:${registration.id}:status:v${updated.version}`,
        });
      }
    }

    const removed = await tx.clubMember.delete({ where: { id: target!.id } });
    await writeAudit(tx, {
      action: 'club.member_removed',
      actorId: actorUserId,
      entityType: 'ClubMembership',
      entityId: removed.id,
      before: { clubId: removed.clubId, userId: removed.userId },
      after: { removed: true },
    });
    await queueNotification(tx, {
      recipientUserId: target!.user.id,
      recipientEmail: target!.user.email,
      type: NotificationType.CLUB_MEMBERSHIP_REMOVED,
      title: `You were removed from ${target!.club.name}`,
      message: `You are no longer a member of ${target!.club.name}. You can request to join another club or create your own club.`,
      entityType: 'ClubMembership',
      entityId: removed.id,
      actionPath: '/complete-club',
      version: target!.createdAt.getTime(),
      metadata: { clubId: removed.clubId },
      emailEyebrow: 'Club membership',
      emailActionLabel: 'Choose a club',
    });
    await queueOutbox(tx, {
      topic: 'club.member.removed',
      aggregateType: 'ClubMembership',
      aggregateId: removed.id,
      payload: {
        clubId: removed.clubId,
        userId: removed.userId,
        resolvedRegistrationIds: affectedRegistrations.map(
          (registration) => registration.id,
        ),
      },
      deduplicationKey: `club-membership:${removed.id}:removed`,
    });
    return removed;
  });
}

export async function requestClubMembership(userId: string, clubId: string) {
  return prisma.$transaction(async (tx) => {
    const [membership, club, pendingRequest] = await Promise.all([
      tx.clubMember.findUnique({ where: { userId } }),
      tx.club.findUnique({ where: { id: clubId }, select: { id: true, name: true } }),
      tx.clubJoinRequest.findFirst({
        where: { userId, status: ClubJoinRequestStatus.PENDING },
      }),
    ]);

    if (membership) jsonError('You already belong to a club.', 409);
    if (!club) jsonError('Club not found.', 404);
    if (pendingRequest && pendingRequest.clubId !== clubId) {
      jsonError('You already have a pending club request.', 409);
    }

    const request = await tx.clubJoinRequest.upsert({
      where: { clubId_userId: { clubId, userId } },
      update: {
        status: ClubJoinRequestStatus.PENDING,
        respondedAt: null,
        createdAt: new Date(),
      },
      create: { clubId, userId },
    });

    return { ...request, club };
  });
}

export async function getPendingClubRequest(userId: string) {
  const request = await prisma.clubJoinRequest.findFirst({
    where: { userId, status: ClubJoinRequestStatus.PENDING },
    include: { club: { select: { id: true, name: true, slug: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return request
    ? {
        id: request.id,
        createdAt: request.createdAt.toISOString(),
        club: request.club,
      }
    : null;
}

export async function decideClubJoinRequest(
  actorUserId: string,
  requestId: string,
  decision: 'approve' | 'reject',
) {
  return prisma.$transaction(async (tx) => {
    const [actor, request] = await Promise.all([
      tx.clubMember.findUnique({ where: { userId: actorUserId } }),
      tx.clubJoinRequest.findUnique({
        where: { id: requestId },
        include: {
          club: { select: { id: true, name: true } },
          user: { include: { clubMemberships: { take: 1 } } },
        },
      }),
    ]);

    if (!actor || actor.membershipRole !== ClubMembershipRole.LEADER) {
      jsonError('Only the club leader can review club requests.', 403);
    }
    if (!request || request.clubId !== actor.clubId) {
      jsonError('Club request not found.', 404);
    }
    if (request.status !== ClubJoinRequestStatus.PENDING) {
      jsonError('This club request has already been reviewed.', 409);
    }

    if (decision === 'approve') {
      if (request.user.clubMemberships.length) {
        jsonError('This player already belongs to a club.', 409);
      }
      await tx.clubMember.create({
        data: {
          clubId: actor.clubId,
          userId: request.userId,
          membershipRole: ClubMembershipRole.MEMBER,
        },
      });
    }

    const updated = await tx.clubJoinRequest.update({
      where: { id: request.id },
      data: {
        status:
          decision === 'approve'
            ? ClubJoinRequestStatus.APPROVED
            : ClubJoinRequestStatus.REJECTED,
        respondedAt: new Date(),
      },
    });

    if (decision === 'approve') {
      await tx.clubJoinRequest.updateMany({
        where: {
          userId: request.userId,
          id: { not: request.id },
          status: ClubJoinRequestStatus.PENDING,
        },
        data: {
          status: ClubJoinRequestStatus.REJECTED,
          respondedAt: new Date(),
        },
      });
    }

    const approved = decision === 'approve';
    await queueNotification(tx, {
      recipientUserId: request.user.id,
      recipientEmail: request.user.email,
      type: approved
        ? NotificationType.CLUB_JOIN_REQUEST_APPROVED
        : NotificationType.CLUB_JOIN_REQUEST_REJECTED,
      title: approved
        ? `Your request to join ${request.club.name} was approved`
        : `Your request to join ${request.club.name} was not approved`,
      message: approved
        ? `You are now a member of ${request.club.name}. Open your dashboard to view the club and upcoming tournaments.`
        : `The club leader did not approve your request to join ${request.club.name}. You can request to join another club or create your own club.`,
      entityType: 'ClubJoinRequest',
      entityId: updated.id,
      actionPath: approved ? '/dashboard/club' : '/complete-club',
      version: updated.updatedAt.getTime(),
      metadata: {
        clubId: request.club.id,
        decision,
      },
      emailEyebrow: 'Club membership',
      emailActionLabel: approved ? 'Open club dashboard' : 'Choose a club',
    });

    return updated;
  });
}

export function serializeClubOption(club: Pick<Club, 'id' | 'name' | 'slug'>) {
  return {
    id: club.id,
    name: club.name,
    slug: club.slug,
  };
}
