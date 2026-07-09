import { RegistrationStatus, UserRole, UserStatus, type Prisma } from '../../generated/prisma/client.js';
import { registrationInclude } from '../../common/includes.js';
import { isUniqueConstraintError, jsonError } from '../../common/http.js';
import {
  sendRegistrationStatusEmail,
  sendTeammateAddedEmail,
  sendTeammateInviteEmail,
} from '../../common/notifications.js';
import {
  addDays,
  createInviteToken,
  hashToken,
} from '../../common/security.js';
import { prisma } from '../../database/prisma.js';
import { roleForEmail } from '../auth/auth.service.js';
import { assertNotDisqualified, isDisqualified } from '../users/users.service.js';

type CreateRegistrationInput = {
  userId: string;
  eventId: string;
  categoryId: string;
  ownerPhone: string;
  teammatePhone: string;
  teammateEmail: string;
};

async function assertPlayerFreeForEvent(
  tx: Prisma.TransactionClient,
  eventId: string,
  userId: string,
  asTeammate: boolean,
) {
  const existing = await tx.eventRegistration.findFirst({
    where: {
      eventId,
      OR: [{ ownerId: userId }, { teammateId: userId }],
    },
    select: { id: true },
  });
  if (!existing) return;
  jsonError(
    asTeammate
      ? 'This teammate is already registered for this event.'
      : 'You can only register for one category per event.',
    409,
  );
}

export async function createRegistration(input: CreateRegistrationInput) {
  const { userId, eventId, categoryId, ownerPhone, teammatePhone, teammateEmail } = input;

  try {
    const [owner, event] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.event.findUnique({ where: { id: eventId }, include: { categories: true } }),
    ]);

    if (!owner) jsonError('User not found.', 404);
    if (roleForEmail(owner.email, owner.role) === UserRole.ADMIN) {
      jsonError('Admins cannot register as athletes.', 403);
    }
    assertNotDisqualified(owner);
    if (!event?.isPublished) jsonError('This event is not available.', 404);
    if (!event.categories.some((link) => link.categoryId === categoryId)) {
      jsonError('This category is not available for the selected event.');
    }

    const ownerMembership = await prisma.clubMember.findUnique({ where: { userId: owner.id } });
    if (!ownerMembership) jsonError('Join a club before registering for events.', 403);

    const existingTeammate = await prisma.user.findUnique({
      where: { email: teammateEmail },
      include: { clubMemberships: { take: 1 } },
    });

    if (roleForEmail(teammateEmail, existingTeammate?.role) === UserRole.ADMIN) {
      jsonError('Admins cannot be added as teammates.', 403);
    }
    if (existingTeammate && isDisqualified(existingTeammate)) {
      jsonError('This teammate is currently disqualified.', 403);
    }

    // Existing active accounts must already share the owner's club — never force-join them.
    if (existingTeammate?.status === UserStatus.ACTIVE) {
      const teammateClubId = existingTeammate.clubMemberships[0]?.clubId;
      if (!teammateClubId) {
        jsonError('This teammate must join a club before being registered.', 403);
      }
      if (teammateClubId !== ownerMembership.clubId) {
        jsonError('Teammates must belong to the same club.', 403);
      }
    } else if (
      existingTeammate?.clubMemberships.length &&
      existingTeammate.clubMemberships[0].clubId !== ownerMembership.clubId
    ) {
      jsonError('This teammate already belongs to another club.', 409);
    }

    // Wrap invite + registration creation so a unique-constraint failure
    // cannot leave an orphan invite token / invited user behind.
    let inviteToken = '';
    const registration = await prisma.$transaction(async (tx) => {
      // Serialize concurrent registrations that touch the same players for this event.
      // Lock order is stable (sorted ids) to avoid deadlocks.
      const lockIds = [owner.id, existingTeammate?.id].filter(Boolean).sort() as string[];
      for (const id of lockIds) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`reg:${eventId}:${id}`}))`;
      }

      // Re-read disqualification / club under the lock (fresh DB state).
      const freshOwner = await tx.user.findUnique({ where: { id: owner.id } });
      if (!freshOwner) jsonError('User not found.', 404);
      assertNotDisqualified(freshOwner);

      const freshOwnerMembership = await tx.clubMember.findUnique({ where: { userId: owner.id } });
      if (!freshOwnerMembership) jsonError('Join a club before registering for events.', 403);

      await assertPlayerFreeForEvent(tx, eventId, owner.id, false);

      const teammate =
        existingTeammate ??
        (await tx.user.create({
          data: {
            email: teammateEmail,
            status: UserStatus.INVITED,
            clubMemberships: {
              create: { clubId: freshOwnerMembership.clubId },
            },
          },
        }));

      if (existingTeammate) {
        const freshTeammate = await tx.user.findUnique({
          where: { id: existingTeammate.id },
          include: { clubMemberships: { take: 1 } },
        });
        if (!freshTeammate) jsonError('Teammate not found.', 404);
        if (isDisqualified(freshTeammate)) {
          jsonError('This teammate is currently disqualified.', 403);
        }
        if (freshTeammate.status === UserStatus.ACTIVE) {
          const teammateClubId = freshTeammate.clubMemberships[0]?.clubId;
          if (!teammateClubId) {
            jsonError('This teammate must join a club before being registered.', 403);
          }
          if (teammateClubId !== freshOwnerMembership.clubId) {
            jsonError('Teammates must belong to the same club.', 403);
          }
        }

        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`reg:${eventId}:${teammate.id}`}))`;
        await assertPlayerFreeForEvent(tx, eventId, teammate.id, true);

        // Only auto-join still-invited accounts into the owner's club.
        if (freshTeammate.status === UserStatus.INVITED) {
          const teammateMembership = await tx.clubMember.findUnique({
            where: { userId: freshTeammate.id },
          });
          if (!teammateMembership) {
            await tx.clubMember.create({
              data: {
                clubId: freshOwnerMembership.clubId,
                userId: freshTeammate.id,
              },
            });
          } else if (teammateMembership.clubId !== freshOwnerMembership.clubId) {
            jsonError('This teammate already belongs to another club.', 409);
          }
        }
      } else {
        await assertPlayerFreeForEvent(tx, eventId, teammate.id, true);
      }

      if (!existingTeammate || teammate.status === UserStatus.INVITED) {
        inviteToken = createInviteToken();
        await tx.inviteToken.create({
          data: {
            userId: teammate.id,
            tokenHash: hashToken(inviteToken),
            expiresAt: addDays(14),
          },
        });
      }

      return tx.eventRegistration.create({
        data: {
          eventId,
          categoryId,
          ownerId: owner.id,
          teammateId: teammate.id,
          teammateEmail,
          ownerPhone,
          teammatePhone: teammatePhone || null,
        },
        include: {
          event: true,
          teammate: true,
        },
      });
    });

    if (inviteToken) {
      await sendTeammateInviteEmail(teammateEmail, owner, registration.event, inviteToken);
    } else {
      await sendTeammateAddedEmail(registration.teammate, owner, registration.event);
    }
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const message = error instanceof Error ? error.message : '';
      if (message.includes('teammateId') || message.includes('teammate')) {
        jsonError('This teammate is already registered for this event.', 409);
      }
      if (message.includes('Player already registered')) {
        jsonError('A player in this team is already registered for this event.', 409);
      }
      jsonError('You can only register for one category per event.', 409);
    }
    throw error;
  }
}

export async function listAdminRegistrations() {
  return prisma.eventRegistration.findMany({
    orderBy: { createdAt: 'desc' },
    include: registrationInclude,
  });
}

export async function updateRegistrationStatus(
  id: string,
  status: RegistrationStatus,
  declineReason: string,
  adminId: string,
) {
  const registration = await prisma.eventRegistration.update({
    where: { id },
    data: {
      status,
      declineReason: status === RegistrationStatus.DECLINED ? declineReason : null,
      reviewedById: adminId,
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

  return registration;
}
