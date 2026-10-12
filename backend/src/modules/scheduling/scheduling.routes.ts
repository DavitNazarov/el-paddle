import { Router } from 'express';
import { Capability, UserRole } from '../../generated/prisma/client.js';
import { isEventOrganiser, requireEventCapability, userHasCapability } from '../../common/capabilities.js';
import { requireCommandId } from '../../common/commands.js';
import { asyncHandler, cleanEmail, cleanString, jsonError, requireParamId, setPublicCache } from '../../common/http.js';
import { csvFilename, sendCsv, wantsCsv } from '../../common/csv.js';
import { serializeAdminUser, serializeCourtSchedule, serializeScheduleItem } from '../../common/serializers.js';
import { requireUser } from '../auth/auth.service.js';
import { addEventJudge, assignJudge, autoFillSchedule, createCourt, getJudgeHome, listEventJudges, listEventSchedule, listJudgeAssignments, listUnscheduledMatches, publishSchedule, removeScheduleItem, reorderSchedule, requireEventCourtQueue, requireJudgeQueue, revokeCourtJudgeAssignment, revokeEventJudge, scheduleMatch, updateCourt, updateScheduleItem } from './scheduling.service.js';

export const schedulingRouter = Router();

/** Both players of an entry on one line, for a printed sheet. */
function teamLabel(entry: { owner: { name: string | null; surname: string | null }; teammate: { name: string | null; surname: string | null } } | null) {
  if (!entry) return '';
  const name = (player: { name: string | null; surname: string | null }) =>
    [player.name, player.surname].filter(Boolean).join(' ');
  return `${name(entry.owner)} / ${name(entry.teammate)}`;
}

function dateValue(value: unknown) {
  if (!value) return undefined;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) jsonError('Invalid date.');
  return date;
}

schedulingRouter.get('/api/admin/events/:eventId/schedule', asyncHandler(async (request, response) => {
  const eventId = requireParamId(request.params.eventId);
  await requireEventCapability(request, eventId, Capability.SCHEDULE_MANAGE);
  const courts = await listEventSchedule(eventId);
  if (wantsCsv(request)) {
    // Court order, then queue order — the order the day is actually played in,
    // which is what a printed court sheet has to be.
    sendCsv(
      response,
      csvFilename('schedule', eventId),
      ['Court', 'Position', 'Match', 'Round', 'Category', 'Status', 'Planned start', 'Team A', 'Team B'],
      courts.flatMap((court) =>
        court.scheduleItems.map((item) => [
          court.name,
          item.queuePosition,
          item.match.matchNumber,
          item.match.round,
          item.match.bracket.eventCategory.category.name,
          item.status,
          item.plannedStartAt?.toISOString() ?? '',
          teamLabel(item.match.participantA),
          teamLabel(item.match.participantB),
        ]),
      ),
    );
    return;
  }
  response.json({ courts: courts.map((court) => serializeCourtSchedule(court, true)) });
}));

schedulingRouter.get('/api/admin/events/:eventId/judges', asyncHandler(async (request, response) => {
  const eventId = requireParamId(request.params.eventId);
  await requireEventCapability(request, eventId, Capability.JUDGE_MANAGE);
  response.json({ judges: await listEventJudges(eventId) });
}));

schedulingRouter.post('/api/admin/events/:eventId/judges', asyncHandler(async (request, response) => {
  const eventId = requireParamId(request.params.eventId);
  const actor = await requireEventCapability(request, eventId, Capability.JUDGE_MANAGE);
  const result = await addEventJudge({
    eventId,
    actorId: actor.id,
    email: cleanEmail(request.body.email),
    name: cleanString(request.body.name),
    surname: cleanString(request.body.surname),
  });
  response.status(201).json({ judge: serializeAdminUser(result.user), invited: result.invited });
}));

schedulingRouter.delete('/api/admin/events/:eventId/judges/:userId', asyncHandler(async (request, response) => {
  const eventId = requireParamId(request.params.eventId);
  const actor = await requireEventCapability(request, eventId, Capability.JUDGE_MANAGE);
  await revokeEventJudge({ eventId, userId: requireParamId(request.params.userId), actorId: actor.id });
  response.json({ ok: true });
}));

schedulingRouter.post('/api/admin/events/:eventId/courts', asyncHandler(async (request, response) => {
  const eventId = requireParamId(request.params.eventId);
  const admin = await requireEventCapability(request, eventId, Capability.SCHEDULE_MANAGE);
  response.status(201).json({ court: await createCourt({ eventId, actorId: admin.id, name: cleanString(request.body.name), location: cleanString(request.body.location), description: cleanString(request.body.description) }) });
}));

schedulingRouter.patch('/api/admin/events/:eventId/courts/:courtId', asyncHandler(async (request, response) => {
  const eventId = requireParamId(request.params.eventId);
  const admin = await requireEventCapability(request, eventId, Capability.SCHEDULE_MANAGE);
  response.json({ court: await updateCourt({ eventId, courtId: requireParamId(request.params.courtId), actorId: admin.id, name: request.body.name === undefined ? undefined : cleanString(request.body.name), location: request.body.location === undefined ? undefined : cleanString(request.body.location), description: request.body.description === undefined ? undefined : cleanString(request.body.description), active: typeof request.body.active === 'boolean' ? request.body.active : undefined, expectedVersion: Number(request.body.expectedVersion) }) });
}));

schedulingRouter.delete('/api/admin/events/:eventId/courts/:courtId', asyncHandler(async (request, response) => {
  const eventId = requireParamId(request.params.eventId);
  const admin = await requireEventCapability(request, eventId, Capability.SCHEDULE_MANAGE);
  response.json({ court: await updateCourt({ eventId, courtId: requireParamId(request.params.courtId), actorId: admin.id, active: false, expectedVersion: Number(request.body.expectedVersion) }) });
}));

schedulingRouter.post('/api/admin/events/:eventId/courts/:courtId/judge-assignments', asyncHandler(async (request, response) => {
  const eventId = requireParamId(request.params.eventId);
  const admin = await requireEventCapability(request, eventId, Capability.SCHEDULE_MANAGE);
  response.status(201).json({ assignment: await assignJudge({ eventId, courtId: requireParamId(request.params.courtId), judgeId: requireParamId(request.body.judgeId), actorId: admin.id, canManageAllJudges: await userHasCapability(admin.id, admin.role, Capability.JUDGE_MANAGE), startsAt: dateValue(request.body.startsAt)!, endsAt: dateValue(request.body.endsAt)! }) });
}));

schedulingRouter.delete('/api/admin/events/:eventId/courts/:courtId/judge-assignments/:assignmentId', asyncHandler(async (request, response) => {
  const eventId = requireParamId(request.params.eventId);
  const admin = await requireEventCapability(request, eventId, Capability.SCHEDULE_MANAGE);
  await revokeCourtJudgeAssignment({
    eventId,
    courtId: requireParamId(request.params.courtId),
    assignmentId: requireParamId(request.params.assignmentId, 'assignment id'),
    actorId: admin.id,
  });
  response.json({ ok: true });
}));

schedulingRouter.get('/api/admin/events/:eventId/schedule/unscheduled', asyncHandler(async (request, response) => {
  const eventId = requireParamId(request.params.eventId);
  await requireEventCapability(request, eventId, Capability.SCHEDULE_MANAGE);
  const matches = await listUnscheduledMatches(eventId);
  response.json({ matches, total: matches.length });
}));

schedulingRouter.post('/api/admin/events/:eventId/schedule/auto-fill', asyncHandler(async (request, response) => {
  const eventId = requireParamId(request.params.eventId);
  const admin = await requireEventCapability(request, eventId, Capability.SCHEDULE_MANAGE);
  const result = await autoFillSchedule({
    eventId,
    actorId: admin.id,
    // Default to matches whose two teams are known; `readyOnly: false` opts in
    // to laying out the later rounds as placeholders too.
    readyOnly: request.body.readyOnly !== false,
    canManageAllJudges: await userHasCapability(admin.id, admin.role, Capability.JUDGE_MANAGE),
    commandId: requireCommandId(request.body.commandId),
  });
  response.json({ placed: result.placed.length, skipped: result.skipped, items: result.placed });
}));

schedulingRouter.post('/api/admin/events/:eventId/schedule/items', asyncHandler(async (request, response) => {
  const eventId = requireParamId(request.params.eventId);
  const admin = await requireEventCapability(request, eventId, Capability.SCHEDULE_MANAGE);
  response.status(201).json({ item: await scheduleMatch({ eventId, matchId: requireParamId(request.body.matchId), courtId: requireParamId(request.body.courtId), judgeId: cleanString(request.body.judgeId) || undefined, plannedStartAt: dateValue(request.body.plannedStartAt), plannedEndAt: dateValue(request.body.plannedEndAt), actorId: admin.id, canManageAllJudges: await userHasCapability(admin.id, admin.role, Capability.JUDGE_MANAGE) }) });
}));

schedulingRouter.patch('/api/admin/events/:eventId/schedule/items/:itemId', asyncHandler(async (request, response) => {
  const eventId = requireParamId(request.params.eventId);
  const admin = await requireEventCapability(request, eventId, Capability.SCHEDULE_MANAGE);
  const queuePosition = request.body.queuePosition === undefined || request.body.queuePosition === null ? undefined : Number(request.body.queuePosition);
  if (queuePosition !== undefined && (!Number.isInteger(queuePosition) || queuePosition < 1)) jsonError('Queue position must be a positive whole number.');
  response.json({ item: await updateScheduleItem({ eventId, itemId: requireParamId(request.params.itemId), actorId: admin.id, canManageAllJudges: await userHasCapability(admin.id, admin.role, Capability.JUDGE_MANAGE), courtId: cleanString(request.body.courtId) || undefined, queuePosition, judgeId: request.body.judgeId === null ? null : cleanString(request.body.judgeId) || undefined, plannedStartAt: request.body.plannedStartAt === null ? null : dateValue(request.body.plannedStartAt), plannedEndAt: request.body.plannedEndAt === null ? null : dateValue(request.body.plannedEndAt), expectedVersion: Number(request.body.expectedVersion), commandId: requireCommandId(request.body.commandId) }) });
}));

schedulingRouter.delete('/api/admin/events/:eventId/schedule/items/:itemId', asyncHandler(async (request, response) => {
  const eventId = requireParamId(request.params.eventId);
  const admin = await requireEventCapability(request, eventId, Capability.SCHEDULE_MANAGE);
  await removeScheduleItem({ eventId, itemId: requireParamId(request.params.itemId), actorId: admin.id });
  response.json({ ok: true });
}));

schedulingRouter.post('/api/admin/events/:eventId/schedule/reorder', asyncHandler(async (request, response) => {
  const eventId = requireParamId(request.params.eventId);
  const admin = await requireEventCapability(request, eventId, Capability.SCHEDULE_MANAGE);
  const items = Array.isArray(request.body.items)
    ? request.body.items
        .filter((entry: unknown): entry is { id: unknown; version: unknown } => typeof entry === 'object' && entry !== null)
        .map((entry: { id: unknown; version: unknown }) => ({ id: cleanString(entry.id), version: Number(entry.version) }))
    : [];
  if (!items.length || items.some((entry: { id: string; version: number }) => !entry.id || !Number.isInteger(entry.version))) jsonError('A complete queue order is required.');
  await reorderSchedule({ eventId, courtId: requireParamId(request.body.courtId), actorId: admin.id, items, commandId: requireCommandId(request.body.commandId) });
  response.json({ ok: true });
}));

schedulingRouter.patch('/api/admin/events/:eventId/schedule/publication', asyncHandler(async (request, response) => {
  const eventId = requireParamId(request.params.eventId);
  const admin = await requireEventCapability(request, eventId, Capability.SCHEDULE_PUBLISH);
  response.json({ event: await publishSchedule({ eventId, actorId: admin.id, published: request.body.published === true }) });
}));

schedulingRouter.get('/api/public/events/:eventId/schedule', asyncHandler(async (request, response) => {
  const courts = await listEventSchedule(requireParamId(request.params.eventId), true);
  // Short TTL: the schedule shifts during a live event, and realtime pushes updates on top.
  setPublicCache(response, { maxAge: 15, staleWhileRevalidate: 60 });
  response.json({ courts: courts.map((court) => serializeCourtSchedule(court)) });
}));

schedulingRouter.get('/api/judge/assignments', asyncHandler(async (request, response) => {
  const judge = await requireUser(request);
  if (judge.role !== UserRole.JUDGE) jsonError('Forbidden', 403);
  response.json({ assignments: await listJudgeAssignments(judge.id) });
}));

schedulingRouter.get('/api/judge/home', asyncHandler(async (request, response) => {
  const judge = await requireUser(request);
  if (judge.role !== UserRole.JUDGE) jsonError('Forbidden', 403);
  const courts = await getJudgeHome(judge.id);
  response.json({
    courts: courts.map(({ assignment, items }) => ({
      assignmentId: assignment.id,
      startsAt: assignment.startsAt.toISOString(),
      endsAt: assignment.endsAt.toISOString(),
      court: { id: assignment.court.id, name: assignment.court.name, location: assignment.court.location },
      event: {
        id: assignment.court.event.id,
        title: assignment.court.event.title,
        location: assignment.court.event.location,
        date: assignment.court.event.date.toISOString(),
        status: assignment.court.event.status,
      },
      items: items.map(serializeScheduleItem),
    })),
  });
}));

schedulingRouter.get('/api/judge/events/:eventId/courts/:courtId/queue', asyncHandler(async (request, response) => {
  const eventId = requireParamId(request.params.eventId);
  const courtId = requireParamId(request.params.courtId);
  const actor = await requireUser(request);
  // Judges reach a queue through their court assignment; whoever runs the event
  // reaches every court in it without needing one.
  const runsEvent = actor.role === UserRole.ADMIN
    || (actor.role === UserRole.ORGANISER && (await isEventOrganiser(actor.id, eventId)));
  if (!runsEvent && actor.role !== UserRole.JUDGE) jsonError('Forbidden', 403);
  const items = runsEvent
    ? await requireEventCourtQueue(eventId, courtId)
    : await requireJudgeQueue(actor.id, eventId, courtId);
  response.json({ items: items.map(serializeScheduleItem) });
}));
