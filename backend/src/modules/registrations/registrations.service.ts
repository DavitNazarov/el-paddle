import { RegistrationStatus, UserRole, UserStatus } from '../../generated/prisma/client.js';
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

type CreateRegistrationInput = {
  userId: string;
  eventId: string;
  categoryId: string;
  ownerPhone: string;
  teammatePhone: string;
  teammateEmail: string;
};

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
    if (!event?.isPublished) jsonError('This event is not available.', 404);
    if (!event.categories.some((link) => link.categoryId === categoryId)) {
      jsonError('This category is not available for the selected event.');
    }

    const existingTeammate = await prisma.user.findUnique({ where: { email: teammateEmail } });

    if (roleForEmail(teammateEmail, existingTeammate?.role) === UserRole.ADMIN) {
      jsonError('Admins cannot be added as teammates.', 403);
    }

    // Wrap invite + registration creation so a unique-constraint failure
    // cannot leave an orphan invite token / invited user behind.
    let inviteToken = '';
    const registration = await prisma.$transaction(async (tx) => {
      const teammate =
        existingTeammate ??
        (await tx.user.create({
          data: {
            email: teammateEmail,
            status: UserStatus.INVITED,
          },
        }));

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
      jsonError('You already registered for this event category.', 409);
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
