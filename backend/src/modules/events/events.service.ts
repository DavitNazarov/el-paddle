import { startOfToday } from '../../common/dates.js';
import { eventInclude, entryUserSelect } from '../../common/includes.js';
import { isNotFoundError, jsonError } from '../../common/http.js';
import { prisma } from '../../database/prisma.js';
import { EventStatus, NotificationType, type Prisma } from '../../generated/prisma/client.js';
import { queueNotifications, queueOutbox, writeAudit } from '../../common/domain-events.js';
import { findCommandReceipt, payloadHash, saveCommandReceipt } from '../../common/commands.js';

// Bound both scopes so a large event history can never trigger an unbounded
// scan (F8). Far above any realistic tournament count; the admin list is not
// paginated, so this is a safety cap rather than a page size.
const EVENT_LIST_CAP = 1000;

export async function listEvents({ adminScope, organiserId }: { adminScope: boolean; organiserId?: string }) {
  return prisma.event.findMany({
    where: organiserId
      ? { organisers: { some: { userId: organiserId, revokedAt: null } } }
      : adminScope
        ? {}
        : {
            isPublished: true,
            date: { gte: startOfToday() },
          },
    orderBy: { date: 'asc' },
    include: eventInclude,
    take: EVENT_LIST_CAP,
  });
}

export async function getEventById(id: string, adminScope = false) {
  const event = await prisma.event.findFirst({
    where: { id, ...(adminScope ? {} : { isPublished: true }) },
    include: eventInclude,
  });
  if (!event) jsonError('Event not found.', 404);
  return event;
}

type CreateEventInput = {
  title: string;
  date: Date;
  location: string;
  description: string;
  arrivalTime: Date | null | undefined;
  participationFee: number;
  bankAccountIban: string;
  bankAccountReceiver: string;
  categoryIds: string[];
  createdById: string;
};

type UpdateEventInput = {
  title?: string;
  date?: Date;
  location?: string;
  description?: string | null;
  arrivalTime?: Date | null;
  participationFee?: number;
  bankAccountIban?: string;
  bankAccountReceiver?: string;
  isPublished?: boolean;
  categoryIds?: string[];
};

const eventTransitions: Record<EventStatus, EventStatus[]> = {
  REGISTRATION_OPEN: [EventStatus.REGISTRATION_CLOSED],
  REGISTRATION_CLOSED: [EventStatus.ONGOING],
  ONGOING: [EventStatus.COMPLETED],
  // Completion locks event operations, but an administrator can explicitly
  // reopen the event to correct or update tournament data.
  COMPLETED: [EventStatus.ONGOING],
};

export function canTransitionEvent(from: EventStatus, to: EventStatus) {
  return eventTransitions[from].includes(to);
}

export async function changeEventStatus(input: {
  eventId: string;
	  status: EventStatus;
	  actorId: string;
	  canRollbackCompleted: boolean;
	  reason?: string;
  expectedVersion: number;
  commandId: string;
}) {
  const hash = payloadHash(input);
  return prisma.$transaction(async (tx) => {
    const replay = await findCommandReceipt(tx, input.actorId, 'event.status', input.commandId, hash);
    if (replay) {
      const current = await tx.event.findUnique({ where: { id: input.eventId }, include: eventInclude });
      if (!current) jsonError('Event not found.', 404);
      return current;
    }
    const event = await tx.event.findUnique({ where: { id: input.eventId }, include: eventInclude });
    if (!event) jsonError('Event not found.', 404);
    if (event.version !== input.expectedVersion) jsonError('Event changed. Refresh and try again.', 409);
    if (event.status === input.status) return event;
    if (!canTransitionEvent(event.status, input.status)) jsonError('Invalid event status transition.', 409);
    if (event.status === EventStatus.COMPLETED && input.status === EventStatus.ONGOING && !input.canRollbackCompleted) {
      jsonError('Event correction capability is required to reopen a completed event.', 403);
    }

    if (input.status === EventStatus.ONGOING) {
      const lockedBrackets = await tx.bracket.count({ where: { eventId: event.id, status: { in: ['LOCKED', 'COMPLETED'] } } });
      if (!lockedBrackets) jsonError('Lock at least one bracket before starting the event.', 409);
    }
    if (input.status === EventStatus.COMPLETED) {
      const unfinished = await tx.match.count({ where: { bracket: { eventId: event.id }, status: { notIn: ['COMPLETED', 'CANCELLED'] } } });
      if (unfinished) jsonError('Complete or cancel every match before completing the event.', 409);
    }

    const now = new Date();
    const updateResult = await tx.event.updateMany({
      where: { id: event.id, version: input.expectedVersion, status: event.status },
      data: {
        status: input.status,
        version: { increment: 1 },
        ...(input.status === EventStatus.REGISTRATION_CLOSED ? { registrationClosedAt: now } : {}),
        ...(input.status === EventStatus.ONGOING ? { startedAt: now } : {}),
        ...(input.status === EventStatus.COMPLETED ? { completedAt: now } : {}),
      },
    });
    if (updateResult.count !== 1) jsonError('Event changed. Refresh and try again.', 409);
    const updated = await tx.event.findUniqueOrThrow({ where: { id: event.id }, include: eventInclude });
    await tx.eventStatusHistory.create({
      data: { eventId: event.id, fromStatus: event.status, toStatus: input.status, actorId: input.actorId, reason: input.reason, commandId: input.commandId },
    });
    await writeAudit(tx, { action: 'event.status.updated', actorId: input.actorId, eventId: event.id, entityType: 'Event', entityId: event.id, before: { status: event.status }, after: { status: input.status }, publicReason: input.reason });
    await queueOutbox(tx, { topic: 'event.status.updated', aggregateType: 'Event', aggregateId: event.id, payload: { eventId: event.id, status: input.status, version: updated.version }, deduplicationKey: `event:${event.id}:status:v${updated.version}` });

    const registrations = await tx.eventRegistration.findMany({ where: { eventId: event.id, status: 'APPROVED' }, include: { owner: { select: entryUserSelect }, teammate: { select: entryUserSelect } } });
    const contacts = new Map(registrations.flatMap((entry) => [entry.owner, entry.teammate]).map((user) => [user.id, user]));
    await queueNotifications(tx, [...contacts.values()].map((user) => ({ recipientUserId: user.id, recipientEmail: user.email, type: NotificationType.EVENT_STATUS_CHANGED, title: `Event status: ${input.status.replaceAll('_', ' ')}`, message: `${event.title} has moved to ${input.status.replaceAll('_', ' ').toLowerCase()}.`, entityType: 'Event', entityId: event.id, eventId: event.id, actionPath: `/dashboard/events/${event.id}`, version: updated.version })));
    await saveCommandReceipt(tx, { actorId: input.actorId, action: 'event.status', commandId: input.commandId, hash, response: { eventId: event.id, version: updated.version } });
    return updated;
  });
}

async function assertCategoriesExist(categoryIds: string[]) {
  const categories = await prisma.category.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true },
  });

  if (categories.length !== categoryIds.length) {
    jsonError('One or more selected categories were not found.');
  }
}

export async function createEvent(input: CreateEventInput) {
  const {
    title,
    date,
    location,
    description,
    arrivalTime,
    participationFee,
    bankAccountIban,
    bankAccountReceiver,
    categoryIds,
    createdById,
  } = input;

  await assertCategoriesExist(categoryIds);

  return prisma.event.create({
    data: {
      title,
      date,
      location,
      description: description || null,
      arrivalTime,
      participationFee,
      bankAccountIban,
      bankAccountReceiver,
      createdById,
      categories: {
        create: categoryIds.map((categoryId) => ({
          category: { connect: { id: categoryId } },
        })),
      },
    },
    include: eventInclude,
  });
}

export async function deleteEvent(id: string, actorId: string) {
  try {
    await prisma.$transaction(async (tx) => {
      const event = await tx.event.findUnique({
        where: { id },
        select: { id: true, title: true, status: true, isPublished: true },
      });
      if (!event) jsonError('Event not found.', 404);
      if (event.status === EventStatus.COMPLETED) jsonError('Reopen the completed event before editing it.', 409);

      // Remove registration references in a deterministic order before the
      // event-level cascades delete the remaining owned records.
      await tx.bracket.deleteMany({ where: { eventId: id } });
      await tx.opponentRequest.deleteMany({ where: { eventId: id } });
      await tx.eventRegistration.deleteMany({ where: { eventId: id } });
      await tx.event.delete({ where: { id } });
      await writeAudit(tx, {
        action: 'event.deleted',
        actorId,
        eventId: id,
        entityType: 'Event',
        entityId: id,
        before: event,
      });
    });
  } catch (error) {
    if (isNotFoundError(error)) jsonError('Event not found.', 404);
    throw error;
  }
}

export async function updateEvent(id: string, input: UpdateEventInput, expectedVersion: number) {
  const existing = await prisma.event.findUnique({
    where: { id },
    select: { id: true, status: true, version: true },
  });
  if (!existing) jsonError('Event not found.', 404);
  if (existing.status === EventStatus.COMPLETED) jsonError('Reopen the completed event before editing it.', 409);
  if (existing.version !== expectedVersion) jsonError('Event changed. Refresh and try again.', 409);

  if (input.categoryIds) {
    await assertCategoriesExist(input.categoryIds);

    const linkedWithEntries = await prisma.eventRegistration.findMany({
      where: {
        eventId: id,
        categoryId: { notIn: input.categoryIds },
      },
      select: { categoryId: true },
      distinct: ['categoryId'],
    });
    if (linkedWithEntries.length) {
      jsonError('Cannot remove a category that already has registrations for this event.');
    }
  }

  return prisma.$transaction(async (tx) => {
    if (input.categoryIds) {
      const categoryIds = input.categoryIds;
      await tx.eventCategory.deleteMany({
        where: {
          eventId: id,
          categoryId: { notIn: categoryIds },
        },
      });
      await Promise.all(
        categoryIds.map((categoryId) =>
          tx.eventCategory.upsert({
            where: {
              eventId_categoryId: { eventId: id, categoryId },
            },
            update: {},
            create: { eventId: id, categoryId },
          }),
        ),
      );
    }

    // Optimistic-concurrency guard: only apply if no concurrent admin edit landed
    // first, matching the sibling event mutations (status / tournament-publication).
    const updateResult = await tx.event.updateMany({
      where: { id, version: expectedVersion },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.date !== undefined ? { date: input.date } : {}),
        ...(input.location !== undefined ? { location: input.location } : {}),
        ...(input.description !== undefined ? { description: input.description || null } : {}),
        ...(input.arrivalTime !== undefined ? { arrivalTime: input.arrivalTime } : {}),
        ...(input.participationFee !== undefined ? { participationFee: input.participationFee } : {}),
        ...(input.bankAccountIban !== undefined ? { bankAccountIban: input.bankAccountIban } : {}),
        ...(input.bankAccountReceiver !== undefined ? { bankAccountReceiver: input.bankAccountReceiver } : {}),
        ...(input.isPublished !== undefined ? { isPublished: input.isPublished } : {}),
        version: { increment: 1 },
      },
    });
    if (updateResult.count !== 1) jsonError('Event changed. Refresh and try again.', 409);
    return tx.event.findUniqueOrThrow({ where: { id }, include: eventInclude });
  });
}

export async function listPublicEvents() {
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

  return { upcoming: upcoming[0] ?? null, previous };
}

/** Lightweight published-event index for SEO sitemaps (not truncated like listPublicEvents). */
export async function listPublishedEventsForSitemap() {
  return prisma.event.findMany({
    where: { isPublished: true },
    select: { id: true, date: true, updatedAt: true },
    orderBy: { date: 'desc' },
  });
}

export async function updateTournamentPublication(input: {
  eventId: string;
  actorId: string;
  publicLiveScoringEnabled?: boolean;
  resultsPublished?: boolean;
  expectedVersion: number;
}) {
  return prisma.$transaction(async (tx) => {
    const event = await tx.event.findUnique({ where: { id: input.eventId } });
    if (!event) jsonError('Event not found.', 404);
    if (event.version !== input.expectedVersion) jsonError('Event changed. Refresh and try again.', 409);
    if (input.publicLiveScoringEnabled && event.status !== 'ONGOING') jsonError('Public live scoring is available only while the event is ongoing.', 409);
    if (input.resultsPublished && event.status !== 'COMPLETED') jsonError('Complete the event before publishing final results.', 409);
    const updated = await tx.event.update({ where: { id: event.id }, data: { ...(input.publicLiveScoringEnabled !== undefined ? { publicLiveScoringEnabled: input.publicLiveScoringEnabled } : {}), ...(input.resultsPublished !== undefined ? { resultsPublishedAt: input.resultsPublished ? new Date() : null } : {}), version: { increment: 1 } }, include: eventInclude });
    await writeAudit(tx, { action: 'event.tournament-publication.updated', actorId: input.actorId, eventId: event.id, entityType: 'Event', entityId: event.id, before: { publicLiveScoringEnabled: event.publicLiveScoringEnabled, resultsPublishedAt: event.resultsPublishedAt?.toISOString() }, after: { publicLiveScoringEnabled: updated.publicLiveScoringEnabled, resultsPublishedAt: updated.resultsPublishedAt?.toISOString() } });
    await queueOutbox(tx, { topic: 'event.publication.updated', aggregateType: 'Event', aggregateId: event.id, payload: { eventId: event.id, publicLiveScoringEnabled: updated.publicLiveScoringEnabled, resultsPublished: Boolean(updated.resultsPublishedAt), version: updated.version }, deduplicationKey: `event:${event.id}:tournament-publication:v${updated.version}` });
    return updated;
  });
}
