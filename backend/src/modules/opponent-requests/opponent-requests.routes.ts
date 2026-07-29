import { Router } from 'express';
import { Capability } from '../../generated/prisma/client.js';
import { requireEventCapability } from '../../common/capabilities.js';
import { requireCommandId } from '../../common/commands.js';
import { asyncHandler, cleanString, jsonError, requireParamId } from '../../common/http.js';
import { requireUser } from '../auth/auth.service.js';
import { createOpponentRequest, decideOpponentRequest, listEligibleOpponents, listOpponentRequests, listOpponentRequestWindows, respondToOpponentRequest, serializeOpponentRequest, serializeOpponentRequestWindow, setOpponentRequestWindow, updateOpponentRequest, withdrawOpponentRequest } from './opponent-requests.service.js';

export const opponentRequestsRouter = Router();

opponentRequestsRouter.post('/api/admin/events/:eventId/categories/:categoryId/opponent-requests/:action(open|close)', asyncHandler(async (request, response) => {
  const eventId = requireParamId(request.params.eventId);
  const admin = await requireEventCapability(request, eventId, Capability.OPPONENT_REQUEST_MANAGE);
  const deadlineText = cleanString(request.body.deadline);
  const deadline = deadlineText ? new Date(deadlineText) : undefined;
  if (deadline && Number.isNaN(deadline.getTime())) jsonError('Invalid deadline.');
  const window = await setOpponentRequestWindow({ eventId, categoryId: requireParamId(request.params.categoryId), actorId: admin.id, open: request.params.action === 'open', deadline, expectedVersion: Number(request.body.expectedVersion), commandId: requireCommandId(request.body.commandId) });
  response.json({ window });
}));

opponentRequestsRouter.get('/api/admin/events/:eventId/opponent-requests', asyncHandler(async (request, response) => {
  const eventId = requireParamId(request.params.eventId);
  await requireEventCapability(request, eventId, Capability.OPPONENT_REQUEST_DECIDE);
  const [requests, windows] = await Promise.all([listOpponentRequests(eventId), listOpponentRequestWindows(eventId)]);
  response.json({ requests: requests.map((item) => serializeOpponentRequest(item, true)), windows: windows.map(serializeOpponentRequestWindow) });
}));

opponentRequestsRouter.get('/api/events/:eventId/opponent-request-state', asyncHandler(async (request, response) => {
  const user = await requireUser(request);
  const requests = await listOpponentRequests(requireParamId(request.params.eventId), user.id);
  response.json({ requests: requests.map((item) => serializeOpponentRequest(item)) });
}));

opponentRequestsRouter.get('/api/events/:eventId/eligible-opponents', asyncHandler(async (request, response) => {
  const user = await requireUser(request);
  response.json({ entries: await listEligibleOpponents(user.id, requireParamId(request.params.eventId), requireParamId(request.query.requestingEntryId, 'requesting entry id')) });
}));

opponentRequestsRouter.post('/api/events/:eventId/opponent-requests', asyncHandler(async (request, response) => {
  const user = await requireUser(request);
  const opponentRequest = await createOpponentRequest({ userId: user.id, eventId: requireParamId(request.params.eventId), requestingEntryId: requireParamId(request.body.requestingEntryId), targetEntryId: requireParamId(request.body.targetEntryId), message: cleanString(request.body.message), commandId: requireCommandId(request.body.commandId) });
  response.status(201).json({ request: serializeOpponentRequest(opponentRequest) });
}));

opponentRequestsRouter.patch('/api/events/:eventId/opponent-requests/:requestId', asyncHandler(async (request, response) => {
  const user = await requireUser(request);
  response.json({ request: serializeOpponentRequest(await updateOpponentRequest({ userId: user.id, eventId: requireParamId(request.params.eventId), requestId: requireParamId(request.params.requestId), targetEntryId: requireParamId(request.body.targetEntryId), message: cleanString(request.body.message), expectedVersion: Number(request.body.expectedVersion), commandId: requireCommandId(request.body.commandId) })) });
}));

opponentRequestsRouter.delete('/api/events/:eventId/opponent-requests/:requestId', asyncHandler(async (request, response) => {
  const user = await requireUser(request);
  response.json({ request: serializeOpponentRequest(await withdrawOpponentRequest({ userId: user.id, eventId: requireParamId(request.params.eventId), requestId: requireParamId(request.params.requestId), expectedVersion: Number(request.body.expectedVersion), commandId: requireCommandId(request.body.commandId) })) });
}));

for (const action of ['accept', 'refuse'] as const) {
  opponentRequestsRouter.post(`/api/events/:eventId/opponent-requests/:requestId/${action}`, asyncHandler(async (request, response) => {
    const user = await requireUser(request);
    response.json({ request: serializeOpponentRequest(await respondToOpponentRequest({ userId: user.id, eventId: requireParamId(request.params.eventId), requestId: requireParamId(request.params.requestId), accept: action === 'accept', reason: cleanString(request.body.reason), expectedVersion: Number(request.body.expectedVersion), commandId: requireCommandId(request.body.commandId) })) });
  }));
}

for (const action of ['approve', 'reject', 'override-refusal'] as const) {
  opponentRequestsRouter.post(`/api/admin/events/:eventId/opponent-requests/:requestId/${action}`, asyncHandler(async (request, response) => {
    const capability = action === 'override-refusal' ? Capability.OPPONENT_REQUEST_OVERRIDE : Capability.OPPONENT_REQUEST_DECIDE;
    const eventId = requireParamId(request.params.eventId);
    const admin = await requireEventCapability(request, eventId, capability);
    response.json({ request: serializeOpponentRequest(await decideOpponentRequest({ actorId: admin.id, eventId, requestId: requireParamId(request.params.requestId), decision: action === 'override-refusal' ? 'override' : action, publicReason: cleanString(request.body.reason), internalNote: cleanString(request.body.internalNote), expectedVersion: Number(request.body.expectedVersion), commandId: requireCommandId(request.body.commandId) }), true) });
  }));
}
