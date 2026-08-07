import {
  BracketStatus,
  ClubMembershipRole,
  EventStatus,
  NotificationType,
  RegistrationStatus,
  UserRole,
  UserStatus,
  type Prisma,
  type User,
} from '../../generated/prisma/client.js';
import { clubSummarySelect, registrationInclude } from '../../common/includes.js';
import { isUniqueConstraintError, jsonError } from '../../common/http.js';
import { sendTeammateAddedEmail } from '../../common/notifications.js';
import { prisma } from '../../database/prisma.js';
import { roleForEmail } from '../auth/auth.service.js';
import { assertNotDisqualified, isDisqualified } from '../users/users.service.js';
import { findCommandReceipt, payloadHash, saveCommandReceipt } from '../../common/commands.js';
import { queueNotifications, queueOutbox, writeAudit } from '../../common/domain-events.js';
import { PARTICIPATION_TERMS_VERSION, REFUND_POLICY_VERSION } from '../../common/legal.js';
import { cursorArgs, toPage, type ListRange } from '../../common/pagination.js';

type CreateRegistrationInput = {
  userId: string;
  eventId: string;
  categoryId: string;
  ownerPhone: string;
  teammatePhone: string;
  teammateEmail: string;
  legalAcceptedAt: Date;
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

type TeammateIdentity = Pick<User, 'status' | 'name' | 'surname' | 'email'>;

/**
 * A teammate has to be a player in their own right before their club can enter
 * them. Registration used to create the account itself and email an invitation,
 * which is how an entry could be approved around someone who never accepted and
 * then stall at the first thing needing two present players — opponent requests.
 * Invitations now belong to the club, and registration only reads the result.
 */
export function requireActiveTeammate<T extends TeammateIdentity>(teammate: T | null): T {
  if (!teammate) {
    jsonError(
      'This teammate does not have an El Padel account yet. Invite them to your club and wait for them to accept before entering them in an event.',
      403,
    );
  }
  if (teammate.status === UserStatus.ACTIVE) return teammate;
  const who = [teammate.name, teammate.surname].filter(Boolean).join(' ') || teammate.email;
  jsonError(
    teammate.status === UserStatus.INVITED
      ? `${who} has not accepted their invitation yet, so they cannot be entered in an event. They can be added once they accept.`
      : teammate.status === UserStatus.PENDING_VERIFICATION
        ? `${who} has not verified their email address yet, so they cannot be entered in an event.`
        : `${who} does not have an active account, so they cannot be entered in an event.`,
    403,
  );
}

export function assertClubCanRegisterForEvent(existingRegistration: { id: string } | null) {
  if (existingRegistration) {
    jsonError(
      'Your club already has a registered team for this event. The club leader can edit it.',
      409,
    );
  }
}

export async function createRegistration(input: CreateRegistrationInput) {
  const { userId, eventId, categoryId, ownerPhone, teammatePhone, teammateEmail, legalAcceptedAt } = input;

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
    if (event.status !== EventStatus.REGISTRATION_OPEN) jsonError('Registration is closed for this event.', 409);
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

    const teammateAccount = requireActiveTeammate(existingTeammate);

    // An active account must already share the owner's club — never force-join them.
    const teammateClubId = teammateAccount.clubMemberships[0]?.clubId;
    if (!teammateClubId) {
      jsonError('This teammate must join a club before being registered.', 403);
    }
    if (teammateClubId !== ownerMembership.clubId) {
      jsonError('Teammates must belong to the same club.', 403);
    }

    const registration = await prisma.$transaction(async (tx) => {
      // Serialize concurrent registrations that touch the same players for this event.
      // Lock order is stable (sorted ids) to avoid deadlocks.
      const lockIds = [owner.id, teammateAccount.id].sort();
      for (const id of lockIds) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`reg:${eventId}:${id}`}))`;
      }

      // Re-read disqualification / club under the lock (fresh DB state).
      const freshOwner = await tx.user.findUnique({ where: { id: owner.id } });
      if (!freshOwner) jsonError('User not found.', 404);
      assertNotDisqualified(freshOwner);

      const freshOwnerMembership = await tx.clubMember.findUnique({ where: { userId: owner.id } });
      if (!freshOwnerMembership) jsonError('Join a club before registering for events.', 403);

      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`reg-club:${eventId}:${freshOwnerMembership.clubId}`}))`;
      const existingClubRegistration = await tx.eventRegistration.findFirst({
        where: { eventId, clubId: freshOwnerMembership.clubId },
        select: { id: true },
      });
      assertClubCanRegisterForEvent(existingClubRegistration);

      await assertPlayerFreeForEvent(tx, eventId, owner.id, false);

      // Re-read the teammate under the lock: acceptance, disqualification and club
      // can all have moved since the checks above.
      const freshTeammate = await tx.user.findUnique({
        where: { id: teammateAccount.id },
        include: { clubMemberships: { take: 1 } },
      });
      if (!freshTeammate) jsonError('Teammate not found.', 404);
      if (isDisqualified(freshTeammate)) {
        jsonError('This teammate is currently disqualified.', 403);
      }
      const teammate = requireActiveTeammate(freshTeammate);
      const freshTeammateClubId = teammate.clubMemberships[0]?.clubId;
      if (!freshTeammateClubId) {
        jsonError('This teammate must join a club before being registered.', 403);
      }
      if (freshTeammateClubId !== freshOwnerMembership.clubId) {
        jsonError('Teammates must belong to the same club.', 403);
      }

      await assertPlayerFreeForEvent(tx, eventId, teammate.id, true);

      return tx.eventRegistration.create({
        data: {
          clubId: freshOwnerMembership.clubId,
          eventId,
          categoryId,
          ownerId: owner.id,
          teammateId: teammate.id,
          teammateEmail,
          ownerPhone: freshOwner.phone || ownerPhone,
          teammatePhone: teammate.phone || teammatePhone || null,
          participationTermsAcceptedAt: legalAcceptedAt,
          participationTermsVersion: PARTICIPATION_TERMS_VERSION,
          refundPolicyAcknowledgedAt: legalAcceptedAt,
          refundPolicyVersion: REFUND_POLICY_VERSION,
          riskAcknowledgedAt: legalAcceptedAt,
        },
        include: {
          event: true,
          teammate: true,
        },
      });
    });

    await sendRegistrationNotification(() =>
      sendTeammateAddedEmail(registration.teammate, owner, registration.event),
    );
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const message = error instanceof Error ? error.message : '';
      if (message.includes('clubId') || message.includes('eventId_clubId')) {
        jsonError(
          'Your club already has a registered team for this event. The club leader can edit it.',
          409,
        );
      }
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

export async function listAdminRegistrations(eventId?: string, range: ListRange = {}) {
  const { take, pageSize, ...cursor } = cursorArgs(range);
  const rows = await prisma.eventRegistration.findMany({
    where: eventId ? { eventId } : undefined,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    include: registrationInclude,
    take,
    ...cursor,
  });
  return toPage(rows, pageSize);
}

/**
 * Public roster is an unauthenticated surface (F2): load only the identity the
 * roster renders — id, category, and each player's name + single club. No full
 * user rows (no passwordHash/phone/email), no reviewer, no event, no contact.
 */
const rosterMemberSelect = {
  id: true,
  name: true,
  surname: true,
  clubMemberships: { select: { club: { select: clubSummarySelect } }, take: 1 },
} satisfies Prisma.UserSelect;

const publicRosterInclude = {
  category: true,
  owner: { select: rosterMemberSelect },
  teammate: { select: rosterMemberSelect },
} satisfies Prisma.EventRegistrationInclude;

export async function listPublicRegistrationRoster(eventId: string) {
  return prisma.eventRegistration.findMany({
    where: {
      eventId,
      status: RegistrationStatus.APPROVED,
      event: {
        isPublished: true,
        registrationRosterPublishedAt: { not: null },
      },
    },
    orderBy: [{ category: { name: 'asc' } }, { createdAt: 'asc' }, { id: 'asc' }],
    include: publicRosterInclude,
  });
}

type ClubRegistrationManager = {
  clubId: string;
  membershipRole: ClubMembershipRole;
};

export function assertClubLeaderCanManageRegistration(
  actorMembership: ClubRegistrationManager | null,
  registrationClubId: string | null,
) {
  if (!actorMembership || actorMembership.membershipRole !== ClubMembershipRole.LEADER) {
    jsonError('Only the club leader can change a registered team.', 403);
  }
  if (!registrationClubId || registrationClubId !== actorMembership.clubId) {
    jsonError('Registration not found.', 404);
  }
}

const leaderEditableRegistrationStatuses = new Set<RegistrationStatus>([
  RegistrationStatus.PENDING,
  RegistrationStatus.APPROVED,
  RegistrationStatus.NEEDS_CHANGES,
  RegistrationStatus.WAITLISTED,
]);

export function assertLeaderEditableRegistrationStatus(status: RegistrationStatus) {
  if (!leaderEditableRegistrationStatuses.has(status)) {
    jsonError('This registration can no longer be changed.', 409);
  }
}

export async function replaceRegistrationPlayer(input: {
  registrationId: string;
  actorId: string;
  slot: 'owner' | 'teammate';
  replacementUserId: string;
  expectedVersion: number;
  commandId: string;
}) {
  const hash = payloadHash(input);

  return prisma.$transaction(async (tx) => {
    const replay = await findCommandReceipt(
      tx,
      input.actorId,
      'registration.lineup.replace',
      input.commandId,
      hash,
    );
    if (replay) {
      const current = await tx.eventRegistration.findUnique({
        where: { id: input.registrationId },
        include: registrationInclude,
      });
      if (!current) jsonError('Registration not found.', 404);
      return current;
    }

    const [actorMembership, registration] = await Promise.all([
      tx.clubMember.findUnique({ where: { userId: input.actorId } }),
      tx.eventRegistration.findUnique({
        where: { id: input.registrationId },
        include: registrationInclude,
      }),
    ]);

    assertClubLeaderCanManageRegistration(actorMembership, registration?.clubId ?? null);
    if (!registration) jsonError('Registration not found.', 404);
    if (registration.version !== input.expectedVersion) {
      jsonError('Registration changed. Refresh and try again.', 409);
    }
    assertLeaderEditableRegistrationStatus(registration.status);
    if (
      registration.event.status === EventStatus.ONGOING ||
      registration.event.status === EventStatus.COMPLETED
    ) {
      jsonError('The event has already started, so its teams cannot be changed.', 409);
    }

    const lockedBracket = await tx.bracket.findFirst({
      where: {
        eventId: registration.eventId,
        categoryId: registration.categoryId,
        status: BracketStatus.LOCKED,
      },
      select: { id: true },
    });
    if (lockedBracket) {
      jsonError('The bracket is locked, so this team cannot be changed.', 409);
    }

    const currentSlotUserId =
      input.slot === 'owner' ? registration.ownerId : registration.teammateId;
    const otherSlotUserId =
      input.slot === 'owner' ? registration.teammateId : registration.ownerId;
    if (input.replacementUserId === currentSlotUserId) {
      jsonError('Choose a different replacement player.', 409);
    }
    if (input.replacementUserId === otherSlotUserId) {
      jsonError('A player cannot occupy both team positions.', 409);
    }

    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`reg:${registration.eventId}:${input.replacementUserId}`}))`;

    const replacementMembership = await tx.clubMember.findUnique({
      where: { userId: input.replacementUserId },
      include: { user: true },
    });
    if (!replacementMembership || replacementMembership.clubId !== actorMembership!.clubId) {
      jsonError('The replacement must be an active member of your club.', 403);
    }
    if (
      replacementMembership.user.status === UserStatus.INACTIVE ||
      roleForEmail(replacementMembership.user.email, replacementMembership.user.role) !== UserRole.USER
    ) {
      jsonError('The replacement player is not eligible.', 403);
    }
    assertNotDisqualified(replacementMembership.user);
    if (input.slot === 'owner' && !replacementMembership.user.phone) {
      jsonError('The replacement player must add a phone number first.', 409);
    }
    await assertPlayerFreeForEvent(
      tx,
      registration.eventId,
      replacementMembership.userId,
      true,
    );

    const nextStatus = RegistrationStatus.PENDING;
    const updated = await tx.eventRegistration.update({
      where: { id: registration.id },
      data: {
        ...(input.slot === 'owner'
          ? {
              ownerId: replacementMembership.userId,
              ownerPhone: replacementMembership.user.phone!,
            }
          : {
              teammateId: replacementMembership.userId,
              teammateEmail: replacementMembership.user.email,
              teammatePhone: replacementMembership.user.phone,
            }),
        status: nextStatus,
        publicStatusReason: null,
        internalReviewNote: null,
        declineReason: null,
        reviewedById: null,
        reviewedAt: null,
        version: { increment: 1 },
      },
      include: registrationInclude,
    });

    if (registration.status !== nextStatus) {
      await tx.registrationStatusHistory.create({
        data: {
          registrationId: registration.id,
          fromStatus: registration.status,
          toStatus: nextStatus,
          actorId: input.actorId,
          publicReason: 'Club leader changed the registered team.',
          commandId: input.commandId,
        },
      });
    }

    await writeAudit(tx, {
      action: 'registration.lineup.replaced',
      actorId: input.actorId,
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
      publicReason: 'Club leader changed the registered team.',
    });

    await queueNotifications(tx, [updated.owner, updated.teammate].map((player) => ({
      recipientUserId: player.id,
      recipientEmail: player.email,
      type: NotificationType.REGISTRATION_PENDING,
      title: 'Club team updated',
      message: `Your club changed the team for ${updated.event.title}. The entry is pending administrator review.`,
      entityType: 'EventRegistration',
      entityId: updated.id,
      eventId: updated.eventId,
      actionPath: `/dashboard/entries?entry=${updated.id}`,
      version: updated.version,
      metadata: {
        previousStatus: registration.status,
        status: updated.status,
        replacementUserId: replacementMembership.userId,
      },
    })));

    await queueOutbox(tx, {
      topic: 'registration.lineup.replaced',
      aggregateType: 'EventRegistration',
      aggregateId: updated.id,
      payload: {
        eventId: updated.eventId,
        registrationId: updated.id,
        ownerId: updated.ownerId,
        teammateId: updated.teammateId,
        status: updated.status,
        version: updated.version,
      },
      deduplicationKey: `registration:${updated.id}:lineup:v${updated.version}`,
    });
    await saveCommandReceipt(tx, {
      actorId: input.actorId,
      action: 'registration.lineup.replace',
      commandId: input.commandId,
      hash,
      response: { registrationId: updated.id, version: updated.version },
    });

    return updated;
  });
}

export async function updateRegistrationRosterPublication(input: {
  eventId: string;
  actorId: string;
  published: boolean;
  expectedVersion: number;
  commandId: string;
}) {
  const hash = payloadHash(input);
  return prisma.$transaction(async (tx) => {
    const replay = await findCommandReceipt(tx, input.actorId, 'registration-roster.publish', input.commandId, hash);
    if (replay) {
      const current = await tx.event.findUnique({ where: { id: input.eventId }, include: { categories: { include: { category: true } } } });
      if (!current) jsonError('Event not found.', 404);
      return current;
    }

    const event = await tx.event.findUnique({ where: { id: input.eventId }, include: { categories: { include: { category: true } } } });
    if (!event) jsonError('Event not found.', 404);
    if (event.version !== input.expectedVersion) jsonError('Event changed. Refresh and try again.', 409);

    const currentlyPublished = Boolean(event.registrationRosterPublishedAt);
    if (currentlyPublished === input.published) {
      await saveCommandReceipt(tx, {
        actorId: input.actorId,
        action: 'registration-roster.publish',
        commandId: input.commandId,
        hash,
        response: { eventId: event.id, version: event.version },
      });
      return event;
    }

    if (input.published) {
      const approvedCount = await tx.eventRegistration.count({
        where: { eventId: event.id, status: RegistrationStatus.APPROVED },
      });
      if (!approvedCount) jsonError('Approve at least one team before publishing the registered teams.', 409);
    }

    const updated = await tx.event.update({
      where: { id: event.id },
      data: {
        registrationRosterPublishedAt: input.published ? new Date() : null,
        version: { increment: 1 },
      },
      include: { categories: { include: { category: true } } },
    });

    await writeAudit(tx, {
      action: input.published ? 'registration-roster.published' : 'registration-roster.unpublished',
      actorId: input.actorId,
      eventId: event.id,
      entityType: 'Event',
      entityId: event.id,
      before: { published: currentlyPublished },
      after: { published: input.published },
    });
    await queueOutbox(tx, {
      topic: 'registration-roster.publication.updated',
      aggregateType: 'Event',
      aggregateId: event.id,
      payload: { eventId: event.id, published: input.published, version: updated.version },
      deduplicationKey: `event:${event.id}:registration-roster-publication:v${updated.version}`,
    });
    await saveCommandReceipt(tx, {
      actorId: input.actorId,
      action: 'registration-roster.publish',
      commandId: input.commandId,
      hash,
      response: { eventId: event.id, version: updated.version },
    });
    return updated;
  });
}

export async function updateRegistrationStatus(
  id: string,
  status: RegistrationStatus,
  publicReason: string,
  adminId: string,
  options?: { eventId?: string; internalNote?: string; expectedVersion?: number; commandId?: string },
) {
  const commandId = options?.commandId ?? `legacy-${Date.now()}-${id}`;
  const hash = payloadHash({ id, status, publicReason, internalNote: options?.internalNote });
  return prisma.$transaction(async (tx) => {
    const replay = await findCommandReceipt(tx, adminId, 'registration.status', commandId, hash);
    if (replay) {
      const current = await tx.eventRegistration.findUnique({ where: { id }, include: registrationInclude });
      if (!current) jsonError('Registration not found.', 404);
      return current;
    }
    const registration = await tx.eventRegistration.findUnique({ where: { id }, include: registrationInclude });
    if (!registration || (options?.eventId && registration.eventId !== options.eventId)) jsonError('Registration not found.', 404);
    if (registration.event.status === EventStatus.COMPLETED) jsonError('Reopen the completed event before changing registrations.', 409);
    if (options?.expectedVersion !== undefined && registration.version !== options.expectedVersion) jsonError('Registration changed. Refresh and try again.', 409);
    if (registration.status === status) return registration;
    assertRegistrationTransition(registration.status, status);
    if ((status === RegistrationStatus.DECLINED || status === RegistrationStatus.NEEDS_CHANGES || status === RegistrationStatus.WAITLISTED || status === RegistrationStatus.CANCELLED) && !publicReason.trim()) {
      jsonError('A public reason is required.');
    }

    const updated = await tx.eventRegistration.update({
      where: { id },
      data: {
        status,
        publicStatusReason: publicReason || null,
        internalReviewNote: options?.internalNote || null,
        declineReason: status === RegistrationStatus.DECLINED ? publicReason : null,
        reviewedById: adminId,
        reviewedAt: new Date(),
        withdrawnAt: status === RegistrationStatus.WITHDRAWN ? new Date() : null,
        version: { increment: 1 },
      },
      include: registrationInclude,
    });
    await tx.registrationStatusHistory.create({ data: { registrationId: id, fromStatus: registration.status, toStatus: status, actorId: adminId, publicReason: publicReason || null, internalNote: options?.internalNote || null, commandId } });
    await writeAudit(tx, { action: 'registration.status.updated', actorId: adminId, eventId: registration.eventId, entityType: 'EventRegistration', entityId: id, before: { status: registration.status }, after: { status }, publicReason, internalReason: options?.internalNote });

    const type = registrationNotificationType(status);
    await queueNotifications(tx, [updated.owner, updated.teammate].map((user) => ({ recipientUserId: user.id, recipientEmail: user.email, type, title: `Registration ${status.replaceAll('_', ' ').toLowerCase()}`, message: `Your entry for ${updated.event.title} is now ${status.replaceAll('_', ' ').toLowerCase()}.${publicReason ? ` ${publicReason}` : ''}`, entityType: 'EventRegistration', entityId: id, eventId: updated.eventId, actionPath: `/dashboard/entries?entry=${id}`, version: updated.version, metadata: { previousStatus: registration.status, status, categoryId: updated.categoryId } })));
    await queueOutbox(tx, { topic: 'registration.status.updated', aggregateType: 'EventRegistration', aggregateId: id, payload: { eventId: updated.eventId, registrationId: id, status, version: updated.version }, deduplicationKey: `registration:${id}:status:v${updated.version}` });
    await saveCommandReceipt(tx, { actorId: adminId, action: 'registration.status', commandId, hash, response: { registrationId: id, version: updated.version } });
    return updated;
  });
}

const allowedRegistrationTransitions: Record<RegistrationStatus, RegistrationStatus[]> = {
  PENDING: [RegistrationStatus.APPROVED, RegistrationStatus.DECLINED, RegistrationStatus.NEEDS_CHANGES, RegistrationStatus.WAITLISTED, RegistrationStatus.CANCELLED],
  APPROVED: [RegistrationStatus.DECLINED, RegistrationStatus.WITHDRAWN, RegistrationStatus.CANCELLED],
  DECLINED: [],
  NEEDS_CHANGES: [RegistrationStatus.PENDING, RegistrationStatus.APPROVED, RegistrationStatus.DECLINED, RegistrationStatus.WAITLISTED, RegistrationStatus.CANCELLED, RegistrationStatus.WITHDRAWN],
  WAITLISTED: [RegistrationStatus.APPROVED, RegistrationStatus.DECLINED, RegistrationStatus.CANCELLED, RegistrationStatus.WITHDRAWN],
  WITHDRAWN: [],
  CANCELLED: [],
};

export function assertRegistrationTransition(from: RegistrationStatus, to: RegistrationStatus) {
  if (!allowedRegistrationTransitions[from].includes(to)) jsonError('Invalid registration status transition.', 409);
}

async function sendRegistrationNotification(action: () => Promise<void>) {
  try {
    await action();
  } catch (error) {
    console.warn(
      '[registration:email]',
      error instanceof Error ? error.message : 'Could not send registration email.',
    );
  }
}

function registrationNotificationType(status: RegistrationStatus) {
  const types: Record<RegistrationStatus, NotificationType> = {
    PENDING: NotificationType.REGISTRATION_PENDING,
    APPROVED: NotificationType.REGISTRATION_APPROVED,
    DECLINED: NotificationType.REGISTRATION_REJECTED,
    NEEDS_CHANGES: NotificationType.REGISTRATION_NEEDS_CHANGES,
    WAITLISTED: NotificationType.REGISTRATION_WAITLISTED,
    WITHDRAWN: NotificationType.REGISTRATION_WITHDRAWN,
    CANCELLED: NotificationType.REGISTRATION_CANCELLED,
  };
  return types[status];
}
