import { Router } from 'express';
import { Capability, UserRole } from '../../generated/prisma/client.js';
import { requireCapability } from '../../common/capabilities.js';
import { asyncHandler, cleanString, jsonError, requireParamId } from '../../common/http.js';
import { serializeCourtSchedule, serializeScheduleItem } from '../../common/serializers.js';
import { requireUser } from '../auth/auth.service.js';
import { assignJudge, createCourt, listEventSchedule, listJudgeAssignments, publishSchedule, removeScheduleItem, reorderSchedule, requireJudgeQueue, scheduleMatch, updateCourt, updateScheduleItem } from './scheduling.service.js';

export const schedulingRouter = Router();

function dateValue(value: unknown) {
  if (!value) return undefined;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) jsonError('Invalid date.');
  return date;
}

schedulingRouter.get('/api/admin/events/:eventId/schedule', asyncHandler(async (request, response) => {
  await requireCapability(request, Capability.SCHEDULE_MANAGE);
  const courts = await listEventSchedule(requireParamId(request.params.eventId));
  response.json({ courts: courts.map((court) => serializeCourtSchedule(court, true)) });
}));

schedulingRouter.post('/api/admin/events/:eventId/courts', asyncHandler(async (request, response) => {
  const admin = await requireCapability(request, Capability.SCHEDULE_MANAGE);
  response.status(201).json({ court: await createCourt({ eventId: requireParamId(request.params.eventId), actorId: admin.id, name: cleanString(request.body.name), location: cleanString(request.body.location), description: cleanString(request.body.description) }) });
}));

schedulingRouter.patch('/api/admin/events/:eventId/courts/:courtId', asyncHandler(async (request, response) => {
  const admin = await requireCapability(request, Capability.SCHEDULE_MANAGE);
  response.json({ court: await updateCourt({ eventId: requireParamId(request.params.eventId), courtId: requireParamId(request.params.courtId), actorId: admin.id, name: request.body.name === undefined ? undefined : cleanString(request.body.name), location: request.body.location === undefined ? undefined : cleanString(request.body.location), description: request.body.description === undefined ? undefined : cleanString(request.body.description), active: typeof request.body.active === 'boolean' ? request.body.active : undefined, expectedVersion: Number(request.body.expectedVersion) }) });
}));

schedulingRouter.delete('/api/admin/events/:eventId/courts/:courtId', asyncHandler(async (request, response) => {
  const admin = await requireCapability(request, Capability.SCHEDULE_MANAGE);
  response.json({ court: await updateCourt({ eventId: requireParamId(request.params.eventId), courtId: requireParamId(request.params.courtId), actorId: admin.id, active: false, expectedVersion: Number(request.body.expectedVersion) }) });
}));

schedulingRouter.post('/api/admin/events/:eventId/courts/:courtId/judge-assignments', asyncHandler(async (request, response) => {
  const admin = await requireCapability(request, Capability.SCHEDULE_MANAGE);
  response.status(201).json({ assignment: await assignJudge({ eventId: requireParamId(request.params.eventId), courtId: requireParamId(request.params.courtId), judgeId: requireParamId(request.body.judgeId), actorId: admin.id, startsAt: dateValue(request.body.startsAt)!, endsAt: dateValue(request.body.endsAt)! }) });
}));

schedulingRouter.post('/api/admin/events/:eventId/schedule/items', asyncHandler(async (request, response) => {
  const admin = await requireCapability(request, Capability.SCHEDULE_MANAGE);
  response.status(201).json({ item: await scheduleMatch({ eventId: requireParamId(request.params.eventId), matchId: requireParamId(request.body.matchId), courtId: requireParamId(request.body.courtId), judgeId: cleanString(request.body.judgeId) || undefined, plannedStartAt: dateValue(request.body.plannedStartAt), plannedEndAt: dateValue(request.body.plannedEndAt), actorId: admin.id }) });
}));

schedulingRouter.patch('/api/admin/events/:eventId/schedule/items/:itemId', asyncHandler(async (request, response) => {
  const admin = await requireCapability(request, Capability.SCHEDULE_MANAGE);
  response.json({ item: await updateScheduleItem({ eventId: requireParamId(request.params.eventId), itemId: requireParamId(request.params.itemId), actorId: admin.id, courtId: cleanString(request.body.courtId) || undefined, judgeId: request.body.judgeId === null ? null : cleanString(request.body.judgeId) || undefined, plannedStartAt: request.body.plannedStartAt === null ? null : dateValue(request.body.plannedStartAt), plannedEndAt: request.body.plannedEndAt === null ? null : dateValue(request.body.plannedEndAt), expectedVersion: Number(request.body.expectedVersion) }) });
}));

schedulingRouter.delete('/api/admin/events/:eventId/schedule/items/:itemId', asyncHandler(async (request, response) => {
  const admin = await requireCapability(request, Capability.SCHEDULE_MANAGE);
  await removeScheduleItem({ eventId: requireParamId(request.params.eventId), itemId: requireParamId(request.params.itemId), actorId: admin.id });
  response.json({ ok: true });
}));

schedulingRouter.post('/api/admin/events/:eventId/schedule/reorder', asyncHandler(async (request, response) => {
  const admin = await requireCapability(request, Capability.SCHEDULE_MANAGE);
  const itemIds = Array.isArray(request.body.itemIds) ? request.body.itemIds.filter((id: unknown): id is string => typeof id === 'string') : [];
  await reorderSchedule({ eventId: requireParamId(request.params.eventId), courtId: requireParamId(request.body.courtId), actorId: admin.id, itemIds });
  response.json({ ok: true });
}));

schedulingRouter.patch('/api/admin/events/:eventId/schedule/publication', asyncHandler(async (request, response) => {
  const admin = await requireCapability(request, Capability.SCHEDULE_PUBLISH);
  response.json({ event: await publishSchedule({ eventId: requireParamId(request.params.eventId), actorId: admin.id, published: request.body.published === true }) });
}));

schedulingRouter.get('/api/public/events/:eventId/schedule', asyncHandler(async (request, response) => {
  const courts = await listEventSchedule(requireParamId(request.params.eventId), true);
  response.json({ courts: courts.map((court) => serializeCourtSchedule(court)) });
}));

schedulingRouter.get('/api/judge/assignments', asyncHandler(async (request, response) => {
  const judge = await requireUser(request);
  if (judge.role !== UserRole.JUDGE) jsonError('Forbidden', 403);
  response.json({ assignments: await listJudgeAssignments(judge.id) });
}));

schedulingRouter.get('/api/judge/events/:eventId/courts/:courtId/queue', asyncHandler(async (request, response) => {
  const judge = await requireUser(request);
  if (judge.role !== UserRole.JUDGE) jsonError('Forbidden', 403);
  const items = await requireJudgeQueue(judge.id, requireParamId(request.params.eventId), requireParamId(request.params.courtId));
  response.json({ items: items.map(serializeScheduleItem) });
}));
