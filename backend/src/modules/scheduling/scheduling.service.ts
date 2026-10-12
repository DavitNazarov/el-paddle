import { MatchStatus, NotificationType, ScheduleItemStatus, UserRole, UserStatus, type Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';
import { isValidEmail, jsonError } from '../../common/http.js';
import { createUserByAdmin } from '../users/users.service.js';
import { findCommandReceipt, payloadHash, saveCommandReceipt } from '../../common/commands.js';
import { queueNotifications, queueOutbox, writeAudit } from '../../common/domain-events.js';
import { entryUserSelect } from '../../common/includes.js';
import { firstMovablePosition, isFrozen, isQueueFinished, validateQueueReorder } from './queueOrdering.js';

const scheduleMatchInclude = {
  participantA: { include: { owner: { select: entryUserSelect }, teammate: { select: entryUserSelect } } },
  participantB: { include: { owner: { select: entryUserSelect }, teammate: { select: entryUserSelect } } },
  bracket: { include: { eventCategory: { include: { category: true } } } },
} satisfies Prisma.MatchInclude;

export const scheduleInclude = {
  judgeAssignments: { include: { judge: { select: entryUserSelect } }, where: { revokedAt: null }, orderBy: { startsAt: 'asc' as const } },
  scheduleItems: {
    include: { match: { include: scheduleMatchInclude } },
    orderBy: { queuePosition: 'asc' as const },
  },
} satisfies Prisma.CourtInclude;

async function assertEventEditable(tx: Prisma.TransactionClient, eventId: string) {
  const event = await tx.event.findUnique({ where: { id: eventId }, select: { status: true } });
  if (!event) jsonError('Event not found.', 404);
  if (event.status === 'COMPLETED') jsonError('Reopen the completed event before changing its schedule.', 409);
  return event;
}

/**
 * A judge may only work an event they have been admitted to. Admins holding
 * global JUDGE_MANAGE are admitted implicitly — picking a judge from the global
 * roster stays one click for them — but an organiser is confined to the pool
 * they built, which is what keeps one event's judges out of another's schedule.
 */
export async function ensureEventJudge(
  tx: Prisma.TransactionClient,
  eventId: string,
  judgeId: string,
  actor: { id: string; canManageAllJudges: boolean },
) {
  const link = await tx.eventJudge.findUnique({
    where: { eventId_userId: { eventId, userId: judgeId } },
  });
  if (link && !link.revokedAt) return;
  if (!actor.canManageAllJudges) {
    jsonError('That judge is not part of this event. Add them to the event first.', 403);
  }

  const judge = await tx.user.findFirst({ where: { id: judgeId, role: UserRole.JUDGE } });
  if (!judge) jsonError('Judge not found.', 404);

  await tx.eventJudge.upsert({
    where: { eventId_userId: { eventId, userId: judgeId } },
    update: { revokedAt: null, createdById: actor.id },
    create: { eventId, userId: judgeId, createdById: actor.id },
  });
}

export async function listEventJudges(eventId: string) {
  const links = await prisma.eventJudge.findMany({
    where: { eventId, revokedAt: null },
    include: { user: { select: entryUserSelect } },
    orderBy: { createdAt: 'asc' },
  });
  return links.map((link) => ({ ...link.user, addedAt: link.createdAt.toISOString() }));
}

/**
 * Admit a judge to one event, inviting them if they have no account yet. Role
 * changes stay out of reach: an address already belonging to a player or admin
 * is refused rather than converted.
 */
export async function addEventJudge(input: {
  eventId: string;
  actorId: string;
  email: string;
  name: string;
  surname: string;
}) {
  const email = input.email.trim().toLowerCase();
  if (!isValidEmail(email)) jsonError('Enter a valid judge email.');
  if (!input.name.trim() || !input.surname.trim()) jsonError('Judge name and surname are required.');

  const event = await prisma.event.findUnique({ where: { id: input.eventId }, select: { id: true } });
  if (!event) jsonError('Event not found.', 404);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && existing.role !== UserRole.JUDGE) {
    jsonError('This email already belongs to another account. An admin must change its role.', 409);
  }

  const created = existing
    ? { user: existing, invited: false }
    : await createUserByAdmin({
        email,
        name: input.name.trim(),
        surname: input.surname.trim(),
        role: UserRole.JUDGE,
      });

  await prisma.eventJudge.upsert({
    where: { eventId_userId: { eventId: input.eventId, userId: created.user.id } },
    update: { revokedAt: null, createdById: input.actorId },
    create: { eventId: input.eventId, userId: created.user.id, createdById: input.actorId },
  });

  return created;
}

/** Remove a judge from one event. The account itself is untouched. */
export async function revokeEventJudge(input: { eventId: string; userId: string; actorId: string }) {
  return prisma.$transaction(async (tx) => {
    const link = await tx.eventJudge.findUnique({
      where: { eventId_userId: { eventId: input.eventId, userId: input.userId } },
    });
    if (!link || link.revokedAt) jsonError('That judge is not part of this event.', 404);

    await tx.eventJudge.update({ where: { id: link.id }, data: { revokedAt: new Date() } });
    // Leaving live assignments behind would let a removed judge keep scoring.
    await tx.courtJudgeAssignment.updateMany({
      where: { judgeUserId: input.userId, revokedAt: null, court: { eventId: input.eventId } },
      data: { revokedAt: new Date() },
    });
    await tx.scheduleItem.updateMany({
      where: { assignedJudgeId: input.userId, court: { eventId: input.eventId } },
      data: { assignedJudgeId: null },
    });
    await writeAudit(tx, {
      action: 'event.judge.revoked',
      actorId: input.actorId,
      eventId: input.eventId,
      entityType: 'EventJudge',
      entityId: link.id,
      after: { userId: input.userId },
    });
    return { ok: true };
  });
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

export async function assignJudge(input: { eventId: string; courtId: string; judgeId: string; actorId: string; canManageAllJudges: boolean; startsAt: Date; endsAt: Date }) {
  if (!(input.startsAt < input.endsAt)) jsonError('Assignment end must be after start.');
  return prisma.$transaction(async (tx) => {
    await assertEventEditable(tx, input.eventId);
    const court = await tx.court.findFirst({ where: { id: input.courtId, eventId: input.eventId, active: true } });
    if (!court) jsonError('Court not found.', 404);
    await ensureEventJudge(tx, input.eventId, input.judgeId, { id: input.actorId, canManageAllJudges: input.canManageAllJudges });
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

/**
 * Ends one court assignment.
 *
 * `revokedAt` was only ever written by removing the judge from the event
 * entirely, so a judge who was put on the wrong court, or on the right one at
 * the wrong hours, had to be taken off the whole tournament to fix it. Revoking
 * is idempotent: an assignment already ended stays ended, and the caller is
 * told rather than refused, because the state they asked for is the state.
 */
export async function revokeCourtJudgeAssignment(input: { eventId: string; courtId: string; assignmentId: string; actorId: string }) {
  return prisma.$transaction(async (tx) => {
    const assignment = await tx.courtJudgeAssignment.findFirst({
      where: { id: input.assignmentId, courtId: input.courtId, court: { eventId: input.eventId } },
    });
    if (!assignment) jsonError('Court assignment not found.', 404);
    if (assignment.revokedAt) return assignment;

    const running = await tx.scheduleItem.findFirst({
      where: { courtId: input.courtId, status: ScheduleItemStatus.IN_PROGRESS },
      select: { id: true },
    });
    if (running) jsonError('A match is running on this court. Finish it before changing the judge.', 409);

    const revoked = await tx.courtJudgeAssignment.update({
      where: { id: assignment.id },
      data: { revokedAt: new Date() },
    });
    // The schedule items this judge was named on lose their judge rather than
    // keeping a name that no longer has the court.
    await tx.scheduleItem.updateMany({
      where: { courtId: input.courtId, assignedJudgeId: assignment.judgeUserId, status: { notIn: [ScheduleItemStatus.COMPLETED, ScheduleItemStatus.CANCELLED] } },
      data: { assignedJudgeId: null },
    });
    await writeAudit(tx, { action: 'court.judge.revoked', actorId: input.actorId, eventId: input.eventId, entityType: 'CourtJudgeAssignment', entityId: assignment.id, before: { courtId: assignment.courtId, judgeId: assignment.judgeUserId }, after: { revoked: true } });
    await queueOutbox(tx, { topic: 'court.assignment.updated', aggregateType: 'Court', aggregateId: input.courtId, payload: { eventId: input.eventId, courtId: input.courtId, judgeId: assignment.judgeUserId, revoked: true }, deduplicationKey: `court:${input.courtId}:judge:${assignment.id}:revoked` });
    return revoked;
  });
}

/** Every playable match in an event that no court is holding yet, in playing order. */
export async function listUnscheduledMatches(eventId: string) {
  return prisma.match.findMany({
    where: {
      bracket: { eventId },
      scheduleItem: { is: null },
      status: { notIn: [MatchStatus.COMPLETED, MatchStatus.CANCELLED] },
    },
    orderBy: [{ bracket: { categoryId: 'asc' } }, { matchNumber: 'asc' }],
    select: { id: true, matchNumber: true, round: true, status: true, bracketId: true },
  });
}

/**
 * Deals the unplaced matches out over the active courts.
 *
 * A 32-entry draw arrives as thirty-odd matches and an empty court strip, and
 * placing them is thirty identical drags before the first ball is hit. The rule
 * it follows is the one an operator would: matches in playing order, dealt round
 * robin so every court gets a similar share, appended to whatever each court is
 * already holding. It never reorders or retimes what is already placed, so it
 * cannot disturb a queue in progress, and a court whose queue is finished is
 * skipped rather than refused.
 *
 * `ready` limits it to matches whose two teams are known — the default, because
 * a court queue full of "winner of match 4" is a plan, not a schedule.
 */
export async function autoFillSchedule(input: { eventId: string; actorId: string; readyOnly: boolean; canManageAllJudges: boolean; commandId: string }) {
  const hash = payloadHash({ eventId: input.eventId, readyOnly: input.readyOnly });
  const receipt = await prisma.commandReceipt.findUnique({
    where: { actorId_action_commandId: { actorId: input.actorId, action: 'schedule.auto-fill', commandId: input.commandId } },
  });
  if (receipt) {
    if (receipt.payloadHash !== hash) jsonError('Command ID was reused with different data.', 409);
    return { placed: [] as { matchId: string; courtId: string }[], skipped: 0 };
  }

  const [courts, pending] = await Promise.all([
    prisma.court.findMany({
      where: { eventId: input.eventId, active: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true, scheduleItems: { select: { status: true } } },
    }),
    listUnscheduledMatches(input.eventId),
  ]);
  if (!courts.length) jsonError('Add a court before filling the schedule.', 409);

  const openCourts = courts.filter((court) => !isQueueFinished(court.scheduleItems));
  if (!openCourts.length) jsonError('Every court queue is finished. Add a court to schedule more matches.', 409);

  const matches = input.readyOnly ? pending.filter((match) => match.status === MatchStatus.READY) : pending;
  const placed: { matchId: string; courtId: string }[] = [];
  let skipped = 0;

  for (const [index, match] of matches.entries()) {
    const court = openCourts[index % openCourts.length]!;
    try {
      await scheduleMatch({
        eventId: input.eventId,
        matchId: match.id,
        courtId: court.id,
        actorId: input.actorId,
        canManageAllJudges: input.canManageAllJudges,
      });
      placed.push({ matchId: match.id, courtId: court.id });
    } catch {
      // A match another operator placed a moment ago, or a court that filled up
      // mid-run. Neither is a reason to abandon the matches after it.
      skipped += 1;
    }
  }

  await prisma.$transaction(async (tx) => {
    await writeAudit(tx, { action: 'schedule.auto-filled', actorId: input.actorId, eventId: input.eventId, entityType: 'Event', entityId: input.eventId, after: { placed: placed.length, skipped, courts: openCourts.length } });
    await saveCommandReceipt(tx, { actorId: input.actorId, action: 'schedule.auto-fill', commandId: input.commandId, hash, response: { placed: placed.length, skipped } });
  });

  return { placed, skipped };
}

export async function scheduleMatch(input: { eventId: string; matchId: string; courtId: string; judgeId?: string; plannedStartAt?: Date; plannedEndAt?: Date; actorId: string; canManageAllJudges: boolean }) {
  return prisma.$transaction(async (tx) => {
    await assertEventEditable(tx, input.eventId);
    const court = await tx.court.findFirst({ where: { id: input.courtId, eventId: input.eventId, active: true } });
    const match = await tx.match.findFirst({ where: { id: input.matchId, bracket: { eventId: input.eventId } }, include: { participantA: { include: { owner: { select: entryUserSelect }, teammate: { select: entryUserSelect } } }, participantB: { include: { owner: { select: entryUserSelect }, teammate: { select: entryUserSelect } } } } });
    if (!court || !match) jsonError('Court or match not found.', 404);
    if (match.status === MatchStatus.COMPLETED) jsonError('Completed matches cannot be scheduled.', 409);
    if (await tx.scheduleItem.findUnique({ where: { matchId: match.id } })) jsonError('Match is already scheduled.', 409);
    await assertCourtQueueMutable(tx, court.id);
    if (input.judgeId) {
      await ensureEventJudge(tx, input.eventId, input.judgeId, { id: input.actorId, canManageAllJudges: input.canManageAllJudges });
      const assignment = await tx.courtJudgeAssignment.findFirst({ where: { courtId: court.id, judgeUserId: input.judgeId, revokedAt: null, ...(input.plannedStartAt ? { startsAt: { lte: input.plannedStartAt }, endsAt: { gte: input.plannedStartAt } } : {}) } });
      if (!assignment) jsonError('Judge is not assigned to this court at that time.', 409);
    }
    const last = await tx.scheduleItem.aggregate({ where: { courtId: court.id }, _max: { queuePosition: true } });
    const resolved = Boolean(match.participantAEntryId && match.participantBEntryId);
    const item = await tx.scheduleItem.create({ data: { matchId: match.id, courtId: court.id, assignedJudgeId: input.judgeId, queuePosition: (last._max.queuePosition ?? 0) + 1, plannedStartAt: input.plannedStartAt, plannedEndAt: input.plannedEndAt, status: resolved ? ScheduleItemStatus.READY : ScheduleItemStatus.TENTATIVE } });
    await writeAudit(tx, { action: 'match.scheduled', actorId: input.actorId, eventId: input.eventId, entityType: 'ScheduleItem', entityId: item.id, after: { matchId: match.id, courtId: court.id, judgeId: input.judgeId } });
    await queueOutbox(tx, { topic: 'court.queue.updated', aggregateType: 'Court', aggregateId: court.id, payload: { eventId: input.eventId, courtId: court.id }, deduplicationKey: `schedule-item:${item.id}:created` });
    await queueNotifications(tx, [match.participantA, match.participantB].filter(Boolean).flatMap((entry) => [entry!.owner, entry!.teammate].map((user) => ({ recipientUserId: user.id, recipientEmail: user.email, type: NotificationType.MATCH_SCHEDULED, title: 'Match scheduled', message: `Your match has been scheduled on ${court.name}.`, entityType: 'Match', entityId: match.id, eventId: input.eventId, actionPath: `/dashboard/events/${input.eventId}`, version: item.version }))));
    return item;
  });
}

/** Renumbers a court queue to 1..n in the given order, dodging the (courtId, queuePosition) unique. */
async function renumberQueue(tx: Prisma.TransactionClient, courtId: string, orderedIds: string[]) {
  const existing = await tx.scheduleItem.findMany({ where: { courtId }, select: { id: true, queuePosition: true } });
  for (const item of existing) await tx.scheduleItem.update({ where: { id: item.id }, data: { queuePosition: item.queuePosition + 1000 } });
  for (const [index, id] of orderedIds.entries()) await tx.scheduleItem.update({ where: { id }, data: { queuePosition: index + 1, version: { increment: 1 } } });
}

async function assertCourtQueueMutable(tx: Prisma.TransactionClient, courtId: string) {
  const items = await tx.scheduleItem.findMany({ where: { courtId }, select: { status: true } });
  if (isQueueFinished(items)) jsonError('This court queue is finished and can no longer be changed.', 409);
}

export async function reorderSchedule(input: { eventId: string; courtId: string; actorId: string; items: { id: string; version: number }[]; commandId: string }) {
  const hash = payloadHash(input);
  return prisma.$transaction(async (tx) => {
    const replay = await findCommandReceipt(tx, input.actorId, 'schedule.reorder', input.commandId, hash);
    if (replay) return;
    await assertEventEditable(tx, input.eventId);
    const current = await tx.scheduleItem.findMany({ where: { courtId: input.courtId, court: { eventId: input.eventId } }, select: { id: true, queuePosition: true, status: true, version: true } });
    const problem = validateQueueReorder(current, input.items);
    if (problem?.kind === 'finished') jsonError('This court queue is finished and can no longer be changed.', 409);
    if (problem?.kind === 'incomplete') jsonError('Queue list is incomplete.', 409);
    if (problem?.kind === 'stale') jsonError('Queue changed. Refresh and try again.', 409);
    if (problem?.kind === 'frozen') jsonError('Active and completed matches keep their queue position.', 409);
    const orderedIds = input.items.map((item) => item.id);
    await renumberQueue(tx, input.courtId, orderedIds);
    const maxVersion = Math.max(...input.items.map((item) => item.version)) + 1;
    await writeAudit(tx, { action: 'schedule.reordered', actorId: input.actorId, eventId: input.eventId, entityType: 'Court', entityId: input.courtId, before: { itemIds: current.sort((a, b) => a.queuePosition - b.queuePosition).map((item) => item.id) }, after: { itemIds: orderedIds } });
    await queueOutbox(tx, { topic: 'court.queue.updated', aggregateType: 'Court', aggregateId: input.courtId, payload: { eventId: input.eventId, courtId: input.courtId }, deduplicationKey: `court:${input.courtId}:reorder:v${maxVersion}` });
    await saveCommandReceipt(tx, { actorId: input.actorId, action: 'schedule.reorder', commandId: input.commandId, hash });
  });
}

export async function updateScheduleItem(input: { eventId: string; itemId: string; actorId: string; canManageAllJudges: boolean; courtId?: string; queuePosition?: number; judgeId?: string | null; plannedStartAt?: Date | null; plannedEndAt?: Date | null; expectedVersion: number; commandId: string }) {
  const hash = payloadHash(input);
  return prisma.$transaction(async (tx) => {
    const replay = await findCommandReceipt(tx, input.actorId, 'schedule.item.update', input.commandId, hash);
    if (replay) return tx.scheduleItem.findUniqueOrThrow({ where: { id: input.itemId } });
    await assertEventEditable(tx, input.eventId);
    const item = await tx.scheduleItem.findFirst({ where: { id: input.itemId, court: { eventId: input.eventId } } });
    if (!item) jsonError('Schedule item not found.', 404);
    if (item.version !== input.expectedVersion) jsonError('Schedule item changed. Refresh and try again.', 409);
    if (isFrozen(item)) jsonError('Active or completed schedule items cannot be moved.', 409);
    const targetCourtId = input.courtId ?? item.courtId;
    const movingCourt = targetCourtId !== item.courtId;
    if (movingCourt) {
      const court = await tx.court.findFirst({ where: { id: targetCourtId, eventId: input.eventId, active: true } });
      if (!court) jsonError('Court not found.', 404);
      await assertCourtQueueMutable(tx, targetCourtId);
    }
    if (input.judgeId) {
      await ensureEventJudge(tx, input.eventId, input.judgeId, { id: input.actorId, canManageAllJudges: input.canManageAllJudges });
    }

    const sourceCourtId = item.courtId;
    const updated = await tx.scheduleItem.update({
      where: { id: item.id },
      data: {
        ...(input.judgeId !== undefined ? { assignedJudgeId: input.judgeId } : {}),
        ...(input.plannedStartAt !== undefined ? { plannedStartAt: input.plannedStartAt } : {}),
        ...(input.plannedEndAt !== undefined ? { plannedEndAt: input.plannedEndAt } : {}),
        version: { increment: 1 },
      },
    });

    if (movingCourt || input.queuePosition !== undefined) {
      // Park the item on a negative position so neither renumber pass collides with it.
      await tx.scheduleItem.update({ where: { id: item.id }, data: { courtId: targetCourtId, queuePosition: -1 } });
      if (movingCourt) {
        const sourceRemaining = await tx.scheduleItem.findMany({ where: { courtId: sourceCourtId, id: { not: item.id } }, orderBy: { queuePosition: 'asc' }, select: { id: true } });
        await renumberQueue(tx, sourceCourtId, sourceRemaining.map((row) => row.id));
      }
      const targetItems = await tx.scheduleItem.findMany({ where: { courtId: targetCourtId, id: { not: item.id } }, orderBy: { queuePosition: 'asc' }, select: { id: true, queuePosition: true, status: true } });
      const lowest = firstMovablePosition(targetItems);
      const requested = input.queuePosition ?? targetItems.length + 1;
      if (requested < lowest) jsonError('Matches cannot be placed before the active match.', 409);
      const insertAt = Math.min(Math.max(requested, lowest), targetItems.length + 1);
      const orderedIds = targetItems.map((row) => row.id);
      orderedIds.splice(insertAt - 1, 0, item.id);
      await renumberQueue(tx, targetCourtId, orderedIds);
    }

    const result = await tx.scheduleItem.findUniqueOrThrow({ where: { id: item.id } });
    await writeAudit(tx, { action: 'match.rescheduled', actorId: input.actorId, eventId: input.eventId, entityType: 'ScheduleItem', entityId: item.id, before: { courtId: item.courtId, queuePosition: item.queuePosition, plannedStartAt: item.plannedStartAt?.toISOString() }, after: { courtId: result.courtId, queuePosition: result.queuePosition, plannedStartAt: result.plannedStartAt?.toISOString() } });
    await queueOutbox(tx, { topic: 'schedule.updated', aggregateType: 'ScheduleItem', aggregateId: item.id, payload: { eventId: input.eventId, courtId: result.courtId, itemId: item.id, version: result.version }, deduplicationKey: `schedule-item:${item.id}:v${result.version}` });
    if (movingCourt) await queueOutbox(tx, { topic: 'court.queue.updated', aggregateType: 'Court', aggregateId: sourceCourtId, payload: { eventId: input.eventId, courtId: sourceCourtId }, deduplicationKey: `court:${sourceCourtId}:vacated:${item.id}:v${result.version}` });
    await saveCommandReceipt(tx, { actorId: input.actorId, action: 'schedule.item.update', commandId: input.commandId, hash });
    return result;
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

/**
 * A judge's match day in one read: every live assignment, plus the state of the
 * court queue behind it. The assignments list alone only answers "where should
 * I be" — it cannot say whether a match is running, so the judge home had no
 * way to lead with the match actually in front of the judge.
 *
 * The queue itself stays authorized per court by `requireJudgeQueue`; this is a
 * read of queues the judge is already assigned to.
 */
export async function getJudgeHome(judgeId: string) {
  const assignments = await listJudgeAssignments(judgeId);
  const queues = await Promise.all(assignments.map((assignment) => courtQueue(assignment.courtId)));
  return assignments.map((assignment, index) => ({ assignment, items: queues[index]! }));
}

function courtQueue(courtId: string) {
  return prisma.scheduleItem.findMany({ where: { courtId }, include: { match: { include: scheduleMatchInclude }, court: true }, orderBy: { queuePosition: 'asc' } });
}

export async function requireJudgeQueue(judgeId: string, eventId: string, courtId: string) {
  const now = new Date();
  const assignment = await prisma.courtJudgeAssignment.findFirst({ where: { judgeUserId: judgeId, courtId, court: { eventId }, revokedAt: null, startsAt: { lte: now }, endsAt: { gte: now } } });
  if (!assignment) jsonError('Court assignment not found.', 404);
  return courtQueue(courtId);
}

/**
 * The same queue for an actor who runs the event rather than a court, so an
 * admin or organiser can score without first assigning themselves to a court.
 */
export async function requireEventCourtQueue(eventId: string, courtId: string) {
  const court = await prisma.court.findFirst({ where: { id: courtId, eventId }, select: { id: true } });
  if (!court) jsonError('Court not found.', 404);
  return courtQueue(courtId);
}
