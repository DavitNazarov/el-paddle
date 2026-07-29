import { UserRole, UserStatus } from '../../generated/prisma/client.js';
import { jsonError } from '../../common/http.js';
import { prisma } from '../../database/prisma.js';
import { entryUserSelect } from '../../common/includes.js';
import { writeAudit } from '../../common/domain-events.js';
import { notifyAfterCommit, sendEventOrganiserAssignedEmail } from '../../common/notifications.js';

/** Everyone an admin can hand an event to. */
export async function listOrganiserCandidates() {
  return prisma.user.findMany({
    where: { role: UserRole.ORGANISER, status: { not: UserStatus.INACTIVE } },
    select: { ...entryUserSelect, status: true },
    orderBy: [{ name: 'asc' }, { surname: 'asc' }, { id: 'asc' }],
  });
}

export async function listEventOrganisers(eventId: string) {
  const links = await prisma.eventOrganiser.findMany({
    where: { eventId, revokedAt: null },
    include: { user: { select: entryUserSelect } },
    orderBy: { assignedAt: 'asc' },
  });
  return links.map((link) => ({ ...link.user, assignedAt: link.assignedAt.toISOString() }));
}

/** Hand one event to one organiser. Assigning power is an admin act. */
export async function assignEventOrganiser(input: {
  eventId: string;
  userId: string;
  actorId: string;
  ip?: string | null;
}) {
  const event = await prisma.event.findUnique({
    where: { id: input.eventId },
    select: { id: true, title: true },
  });
  if (!event) jsonError('Event not found.', 404);

  const organiser = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!organiser || organiser.role !== UserRole.ORGANISER) {
    jsonError('Pick an organiser account.', 400);
  }
  if (organiser.status === UserStatus.INACTIVE) jsonError('That organiser account is inactive.', 409);

  const link = await prisma.$transaction(async (tx) => {
    const assignment = await tx.eventOrganiser.upsert({
      where: { eventId_userId: { eventId: event.id, userId: organiser.id } },
      update: { revokedAt: null, assignedById: input.actorId, assignedAt: new Date() },
      create: { eventId: event.id, userId: organiser.id, assignedById: input.actorId },
    });
    await writeAudit(tx, {
      action: 'event.organiser.assigned',
      actorId: input.actorId,
      eventId: event.id,
      entityType: 'EventOrganiser',
      entityId: assignment.id,
      after: { userId: organiser.id },
      ip: input.ip,
    });
    return assignment;
  });

  const emailed = await notifyAfterCommit('event.organiser.assigned', () =>
    sendEventOrganiserAssignedEmail(organiser.email, event.title, event.id));
  return { ...link, emailed };
}

export async function revokeEventOrganiser(input: {
  eventId: string;
  userId: string;
  actorId: string;
  ip?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const link = await tx.eventOrganiser.findUnique({
      where: { eventId_userId: { eventId: input.eventId, userId: input.userId } },
    });
    if (!link || link.revokedAt) jsonError('That organiser is not assigned to this event.', 404);

    await tx.eventOrganiser.update({ where: { id: link.id }, data: { revokedAt: new Date() } });
    await writeAudit(tx, {
      action: 'event.organiser.revoked',
      actorId: input.actorId,
      eventId: input.eventId,
      entityType: 'EventOrganiser',
      entityId: link.id,
      after: { userId: input.userId },
      ip: input.ip,
    });
    return { ok: true };
  });
}
