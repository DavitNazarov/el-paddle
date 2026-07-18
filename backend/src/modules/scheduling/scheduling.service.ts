import { MatchStatus, NotificationType, ScheduleItemStatus, UserRole, UserStatus, type Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';
import { jsonError } from '../../common/http.js';
import { queueNotification, queueOutbox, writeAudit } from '../../common/domain-events.js';

export const scheduleInclude = {
  judgeAssignments: { include: { judge: true }, where: { revokedAt: null }, orderBy: { startsAt: 'asc' as const } },
  scheduleItems: {
    include: { match: { include: { participantA: { include: { owner: true, teammate: true } }, participantB: { include: { owner: true, teammate: true } }, bracket: { include: { eventCategory: { include: { category: true } } } } } } },
    orderBy: { queuePosition: 'asc' as const },
  },
} satisfies Prisma.CourtInclude;

async function assertEventEditable(tx: Prisma.TransactionClient, eventId: string) {
  const event = await tx.event.findUnique({ where: { id: eventId }, select: { status: true } });
  if (!event) jsonError('Event not found.', 404);
  if (event.status === 'COMPLETED') jsonError('Reopen the completed event before changing its schedule.', 409);
  return event;
}

export async function listEventSchedule(eventId: string, publicOnly = false) {
  if (publicOnly) {
    const event = await prisma.event.findUnique({ where: { id: eventId }, select: { schedulePublishedAt: true } });
    if (!event?.schedulePublishedAt) jsonError('Schedule not found.', 404);
  }
  return prisma.court.findMany({ where: { eventId, active: true }, include: scheduleInclude, orderBy: { name: 'asc' } });
}

export async function createCourt(input: { eventId: string; actorId: string; name: string; location?: string; description?: string }) {
  if (input.name.trim().length < 2) jsonError('Court name is required.');
  return prisma.$transaction(async (tx) => {
    await assertEventEditable(tx, input.eventId);
    const court = await tx.court.create({ data: { eventId: input.eventId, name: input.name.trim(), location: input.location?.trim() || null, description: input.description?.trim() || null } });
    await writeAudit(tx, { action: 'court.created', actorId: input.actorId, eventId: input.eventId, entityType: 'Court', entityId: court.id, after: { name: court.name } });
    await queueOutbox(tx, { topic: 'schedule.updated', aggregateType: 'Court', aggregateId: court.id, payload: { eventId: input.eventId, courtId: court.id, version: court.version }, deduplicationKey: `court:${court.id}:created` });
    return court;
  });
}

export async function updateCourt(input: { eventId: string; courtId: string; actorId: string; name?: string; location?: string; description?: string; active?: boolean; expectedVersion: number }) {
  return prisma.$transaction(async (tx) => {
    await assertEventEditable(tx, input.eventId);
    const court = await tx.court.findFirst({ where: { id: input.courtId, eventId: input.eventId } });
    if (!court) jsonError('Court not found.', 404);
    if (court.version !== input.expectedVersion) jsonError('Court changed. Refresh and try again.', 409);
    if (input.active === false) {
      const referenced = await tx.scheduleItem.count({ where: { courtId: court.id, status: { in: [ScheduleItemStatus.READY, ScheduleItemStatus.IN_PROGRESS] } } });
      if (referenced) jsonError('Move active schedule items before removing this court.', 409);
    }
    const updated = await tx.court.update({ where: { id: court.id }, data: { ...(input.name !== undefined ? { name: input.name.trim() } : {}), ...(input.location !== undefined ? { location: input.location.trim() || null } : {}), ...(input.description !== undefined ? { description: input.description.trim() || null } : {}), ...(input.active !== undefined ? { active: input.active } : {}), version: { increment: 1 } } });
    await writeAudit(tx, { action: 'court.updated', actorId: input.actorId, eventId: input.eventId, entityType: 'Court', entityId: court.id, before: { name: court.name, active: court.active }, after: { name: updated.name, active: updated.active } });
    return updated;
  });
}

export async function assignJudge(input: { eventId: string; courtId: string; judgeId: string; actorId: string; startsAt: Date; endsAt: Date }) {
  if (!(input.startsAt < input.endsAt)) jsonError('Assignment end must be after start.');
  return prisma.$transaction(async (tx) => {
    await assertEventEditable(tx, input.eventId);
    const court = await tx.court.findFirst({ where: { id: input.courtId, eventId: input.eventId, active: true } });
    if (!court) jsonError('Court not found.', 404);
    const judge = await tx.user.findFirst({ where: { id: input.judgeId, role: UserRole.JUDGE, status: UserStatus.ACTIVE } });
    if (!judge) jsonError('Active judge not found.', 404);
    const overlap = await tx.courtJudgeAssignment.findFirst({ where: { judgeUserId: input.judgeId, revokedAt: null, startsAt: { lt: input.endsAt }, endsAt: { gt: input.startsAt } } });
    if (overlap) jsonError('Judge already has an overlapping court assignment.', 409);
    const assignment = await tx.courtJudgeAssignment.create({ data: { courtId: court.id, judgeUserId: judge.id, startsAt: input.startsAt, endsAt: input.endsAt, assignedById: input.actorId } });
    await writeAudit(tx, { action: 'court.judge.assigned', actorId: input.actorId, eventId: input.eventId, entityType: 'CourtJudgeAssignment', entityId: assignment.id, after: { courtId: court.id, judgeId: judge.id, startsAt: input.startsAt.toISOString(), endsAt: input.endsAt.toISOString() } });
    await queueOutbox(tx, { topic: 'court.assignment.updated', aggregateType: 'Court', aggregateId: court.id, payload: { eventId: input.eventId, courtId: court.id, judgeId: judge.id }, deduplicationKey: `court:${court.id}:judge:${assignment.id}` });
    return assignment;
  });
}

export async function scheduleMatch(input: { eventId: string; matchId: string; courtId: string; judgeId?: string; plannedStartAt?: Date; plannedEndAt?: Date; actorId: string }) {
  return prisma.$transaction(async (tx) => {
    await assertEventEditable(tx, input.eventId);
    const court = await tx.court.findFirst({ where: { id: input.courtId, eventId: input.eventId, active: true } });
    const match = await tx.match.findFirst({ where: { id: input.matchId, bracket: { eventId: input.eventId } }, include: { participantA: { include: { owner: true, teammate: true } }, participantB: { include: { owner: true, teammate: true } } } });
    if (!court || !match) jsonError('Court or match not found.', 404);
    if (match.status === MatchStatus.COMPLETED) jsonError('Completed matches cannot be scheduled.', 409);
    if (await tx.scheduleItem.findUnique({ where: { matchId: match.id } })) jsonError('Match is already scheduled.', 409);
    if (input.judgeId) {
      const assignment = await tx.courtJudgeAssignment.findFirst({ where: { courtId: court.id, judgeUserId: input.judgeId, revokedAt: null, ...(input.plannedStartAt ? { startsAt: { lte: input.plannedStartAt }, endsAt: { gte: input.plannedStartAt } } : {}) } });
      if (!assignment) jsonError('Judge is not assigned to this court at that time.', 409);
    }
    const last = await tx.scheduleItem.aggregate({ where: { courtId: court.id }, _max: { queuePosition: true } });
    const resolved = Boolean(match.participantAEntryId && match.participantBEntryId);
    const item = await tx.scheduleItem.create({ data: { matchId: match.id, courtId: court.id, assignedJudgeId: input.judgeId, queuePosition: (last._max.queuePosition ?? 0) + 1, plannedStartAt: input.plannedStartAt, plannedEndAt: input.plannedEndAt, status: resolved ? ScheduleItemStatus.READY : ScheduleItemStatus.TENTATIVE } });
    await writeAudit(tx, { action: 'match.scheduled', actorId: input.actorId, eventId: input.eventId, entityType: 'ScheduleItem', entityId: item.id, after: { matchId: match.id, courtId: court.id, judgeId: input.judgeId } });
    await queueOutbox(tx, { topic: 'court.queue.updated', aggregateType: 'Court', aggregateId: court.id, payload: { eventId: input.eventId, courtId: court.id }, deduplicationKey: `schedule-item:${item.id}:created` });
    for (const entry of [match.participantA, match.participantB].filter(Boolean)) for (const user of [entry!.owner, entry!.teammate]) await queueNotification(tx, { recipientUserId: user.id, recipientEmail: user.email, type: NotificationType.MATCH_SCHEDULED, title: 'Match scheduled', message: `Your match has been scheduled on ${court.name}.`, entityType: 'Match', entityId: match.id, eventId: input.eventId, actionPath: `/dashboard/events/${input.eventId}`, version: item.version });
    return item;
  });
}

export async function reorderSchedule(input: { eventId: string; courtId: string; actorId: string; itemIds: string[] }) {
  return prisma.$transaction(async (tx) => {
    await assertEventEditable(tx, input.eventId);
    const items = await tx.scheduleItem.findMany({ where: { courtId: input.courtId, court: { eventId: input.eventId } } });
    if (items.length !== input.itemIds.length || new Set(input.itemIds).size !== items.length || input.itemIds.some((id) => !items.some((item) => item.id === id))) jsonError('Queue list is incomplete.', 409);
    for (const item of items) await tx.scheduleItem.update({ where: { id: item.id }, data: { queuePosition: item.queuePosition + 1000 } });
    for (const [index, id] of input.itemIds.entries()) await tx.scheduleItem.update({ where: { id }, data: { queuePosition: index + 1, version: { increment: 1 } } });
    await writeAudit(tx, { action: 'schedule.reordered', actorId: input.actorId, eventId: input.eventId, entityType: 'Court', entityId: input.courtId, after: { itemIds: input.itemIds } });
    await queueOutbox(tx, { topic: 'court.queue.updated', aggregateType: 'Court', aggregateId: input.courtId, payload: { eventId: input.eventId, courtId: input.courtId }, deduplicationKey: `court:${input.courtId}:reorder:${Date.now()}` });
  });
}

export async function updateScheduleItem(input: { eventId: string; itemId: string; actorId: string; courtId?: string; judgeId?: string | null; plannedStartAt?: Date | null; plannedEndAt?: Date | null; expectedVersion: number }) {
  return prisma.$transaction(async (tx) => {
    await assertEventEditable(tx, input.eventId);
    const item = await tx.scheduleItem.findFirst({ where: { id: input.itemId, court: { eventId: input.eventId } } });
    if (!item) jsonError('Schedule item not found.', 404);
    if (item.version !== input.expectedVersion) jsonError('Schedule item changed. Refresh and try again.', 409);
    if (item.status === ScheduleItemStatus.IN_PROGRESS || item.status === ScheduleItemStatus.COMPLETED) jsonError('Active or completed schedule items cannot be moved.', 409);
    let queuePosition = item.queuePosition;
    if (input.courtId && input.courtId !== item.courtId) {
      const court = await tx.court.findFirst({ where: { id: input.courtId, eventId: input.eventId, active: true } });
      if (!court) jsonError('Court not found.', 404);
      const last = await tx.scheduleItem.aggregate({ where: { courtId: court.id }, _max: { queuePosition: true } });
      queuePosition = (last._max.queuePosition ?? 0) + 1;
    }
    const updated = await tx.scheduleItem.update({ where: { id: item.id }, data: { ...(input.courtId ? { courtId: input.courtId, queuePosition } : {}), ...(input.judgeId !== undefined ? { assignedJudgeId: input.judgeId } : {}), ...(input.plannedStartAt !== undefined ? { plannedStartAt: input.plannedStartAt } : {}), ...(input.plannedEndAt !== undefined ? { plannedEndAt: input.plannedEndAt } : {}), version: { increment: 1 } } });
    await writeAudit(tx, { action: 'match.rescheduled', actorId: input.actorId, eventId: input.eventId, entityType: 'ScheduleItem', entityId: item.id, before: { courtId: item.courtId, plannedStartAt: item.plannedStartAt?.toISOString() }, after: { courtId: updated.courtId, plannedStartAt: updated.plannedStartAt?.toISOString() } });
    await queueOutbox(tx, { topic: 'schedule.updated', aggregateType: 'ScheduleItem', aggregateId: item.id, payload: { eventId: input.eventId, courtId: updated.courtId, itemId: item.id, version: updated.version }, deduplicationKey: `schedule-item:${item.id}:v${updated.version}` });
    return updated;
  });
}

export async function removeScheduleItem(input: { eventId: string; itemId: string; actorId: string }) {
  return prisma.$transaction(async (tx) => {
    await assertEventEditable(tx, input.eventId);
    const item = await tx.scheduleItem.findFirst({ where: { id: input.itemId, court: { eventId: input.eventId } } });
    if (!item) jsonError('Schedule item not found.', 404);
    if (item.status === ScheduleItemStatus.IN_PROGRESS || item.status === ScheduleItemStatus.COMPLETED) jsonError('Active or completed schedule items cannot be removed.', 409);
    await tx.scheduleItem.delete({ where: { id: item.id } });
    const remaining = await tx.scheduleItem.findMany({ where: { courtId: item.courtId }, orderBy: { queuePosition: 'asc' } });
    for (const [index, current] of remaining.entries()) if (current.queuePosition !== index + 1) await tx.scheduleItem.update({ where: { id: current.id }, data: { queuePosition: index + 1, version: { increment: 1 } } });
    await writeAudit(tx, { action: 'match.unscheduled', actorId: input.actorId, eventId: input.eventId, entityType: 'ScheduleItem', entityId: item.id, before: { matchId: item.matchId, courtId: item.courtId } });
    await queueOutbox(tx, { topic: 'court.queue.updated', aggregateType: 'Court', aggregateId: item.courtId, payload: { eventId: input.eventId, courtId: item.courtId }, deduplicationKey: `schedule-item:${item.id}:removed` });
  });
}

export async function publishSchedule(input: { eventId: string; actorId: string; published: boolean }) {
  return prisma.$transaction(async (tx) => {
    await assertEventEditable(tx, input.eventId);
    const itemCount = await tx.scheduleItem.count({ where: { court: { eventId: input.eventId } } });
    if (input.published && !itemCount) jsonError('Add at least one match before publishing.', 409);
    const updated = await tx.event.update({ where: { id: input.eventId }, data: { schedulePublishedAt: input.published ? new Date() : null, version: { increment: 1 } } });
    await writeAudit(tx, { action: input.published ? 'schedule.published' : 'schedule.unpublished', actorId: input.actorId, eventId: input.eventId, entityType: 'Event', entityId: input.eventId, after: { published: input.published } });
    await queueOutbox(tx, { topic: 'schedule.published', aggregateType: 'Event', aggregateId: input.eventId, payload: { eventId: input.eventId, published: input.published, version: updated.version }, deduplicationKey: `event:${input.eventId}:schedule:v${updated.version}` });
    return updated;
  });
}

export async function listJudgeAssignments(judgeId: string) {
  return prisma.courtJudgeAssignment.findMany({ where: { judgeUserId: judgeId, revokedAt: null, endsAt: { gte: new Date() } }, include: { court: { include: { event: true } } }, orderBy: { startsAt: 'asc' } });
}

export async function requireJudgeQueue(judgeId: string, eventId: string, courtId: string) {
  const now = new Date();
  const assignment = await prisma.courtJudgeAssignment.findFirst({ where: { judgeUserId: judgeId, courtId, court: { eventId }, revokedAt: null, startsAt: { lte: now }, endsAt: { gte: now } } });
  if (!assignment) jsonError('Court assignment not found.', 404);
  return prisma.scheduleItem.findMany({ where: { courtId }, include: { match: { include: { participantA: { include: { owner: true, teammate: true } }, participantB: { include: { owner: true, teammate: true } }, bracket: { include: { eventCategory: { include: { category: true } } } } } }, court: true }, orderBy: { queuePosition: 'asc' } });
}
