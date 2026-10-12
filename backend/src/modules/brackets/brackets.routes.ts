import { Router } from 'express';
import { Capability, MatchRound, MatchSide } from '../../generated/prisma/client.js';
import { requireEventCapability } from '../../common/capabilities.js';
import { requireCommandId } from '../../common/commands.js';
import { asyncHandler, cleanString, jsonError, requireParamId, setPublicCache } from '../../common/http.js';
import { serializeBracket } from '../../common/serializers.js';
import { createBracket, deleteBracket, generateBracket, listBrackets, lockBracket, placeBracketEntry, publishBracket, setBracketSetDefaults, unlockBracket } from './brackets.service.js';

export const bracketsRouter = Router();

bracketsRouter.post('/api/admin/events/:eventId/brackets', asyncHandler(async (request, response) => {
  const eventId = requireParamId(request.params.eventId);
  const admin = await requireEventCapability(request, eventId, Capability.BRACKET_MANAGE);
  const bracket = await createBracket({ eventId, categoryId: requireParamId(request.body.categoryId), actorId: admin.id, commandId: requireCommandId(request.body.commandId) });
  response.status(201).json({ bracket: serializeBracket(bracket) });
}));

bracketsRouter.post('/api/admin/events/:eventId/brackets/:bracketId/generate', asyncHandler(async (request, response) => {
  const eventId = requireParamId(request.params.eventId);
  const admin = await requireEventCapability(request, eventId, Capability.BRACKET_MANAGE);
  const bracket = await generateBracket({ eventId, bracketId: requireParamId(request.params.bracketId), actorId: admin.id, requestIds: Array.isArray(request.body.requestIds) ? request.body.requestIds.filter((id: unknown): id is string => typeof id === 'string') : [], expectedVersion: Number(request.body.expectedVersion), commandId: requireCommandId(request.body.commandId) });
  response.json({ bracket: serializeBracket(bracket) });
}));

bracketsRouter.post('/api/admin/events/:eventId/brackets/:bracketId/lock', asyncHandler(async (request, response) => {
  const eventId = requireParamId(request.params.eventId);
  const admin = await requireEventCapability(request, eventId, Capability.BRACKET_MANAGE);
  response.json({ bracket: serializeBracket(await lockBracket({ eventId, bracketId: requireParamId(request.params.bracketId), actorId: admin.id, expectedVersion: Number(request.body.expectedVersion), commandId: requireCommandId(request.body.commandId) })) });
}));

bracketsRouter.post('/api/admin/events/:eventId/brackets/:bracketId/unlock', asyncHandler(async (request, response) => {
  const eventId = requireParamId(request.params.eventId);
  // Rewinding a frozen draw is a correction, not a step forward, so it sits
  // with the completed-event reopen under EVENT_STATE_CORRECT — which an
  // organiser never holds.
  const admin = await requireEventCapability(request, eventId, Capability.EVENT_STATE_CORRECT);
  const reason = cleanString(request.body.reason);
  if (reason.length < 3) jsonError('A reason for unlocking the draw is required.');
  const bracket = await unlockBracket({
    eventId,
    bracketId: requireParamId(request.params.bracketId),
    actorId: admin.id,
    reason,
    expectedVersion: Number(request.body.expectedVersion),
    commandId: requireCommandId(request.body.commandId),
  });
  response.json({ bracket: serializeBracket(bracket) });
}));

bracketsRouter.delete('/api/admin/events/:eventId/brackets/:bracketId', asyncHandler(async (request, response) => {
  const eventId = requireParamId(request.params.eventId);
  const admin = await requireEventCapability(request, eventId, Capability.BRACKET_MANAGE);
  const result = await deleteBracket({
    eventId,
    bracketId: requireParamId(request.params.bracketId),
    actorId: admin.id,
    commandId: requireCommandId(request.body?.commandId ?? request.query.commandId),
  });
  response.json(result);
}));

bracketsRouter.post('/api/admin/events/:eventId/brackets/:bracketId/placements', asyncHandler(async (request, response) => {
  const eventId = requireParamId(request.params.eventId);
  const admin = await requireEventCapability(request, eventId, Capability.BRACKET_MANAGE);
  const sourceSide = cleanString(request.body.sourceSide).toUpperCase() as MatchSide;
  const targetSide = cleanString(request.body.targetSide).toUpperCase() as MatchSide;
  if (!Object.values(MatchSide).includes(sourceSide) || !Object.values(MatchSide).includes(targetSide)) jsonError('Invalid placement side.');
  const result = await placeBracketEntry({
    eventId,
    bracketId: requireParamId(request.params.bracketId),
    actorId: admin.id,
    sourceMatchId: requireParamId(request.body.sourceMatchId),
    sourceSide,
    targetMatchId: requireParamId(request.body.targetMatchId),
    targetSide,
    expectedVersion: Number(request.body.expectedVersion),
    commandId: requireCommandId(request.body.commandId),
  });
  response.json({ bracket: serializeBracket(result.bracket), revertedRequestIds: result.revertedRequestIds });
}));

bracketsRouter.put('/api/admin/events/:eventId/brackets/:bracketId/set-defaults', asyncHandler(async (request, response) => {
  const eventId = requireParamId(request.params.eventId);
  const admin = await requireEventCapability(request, eventId, Capability.BRACKET_MANAGE);
  const body = (request.body.defaults ?? {}) as Record<string, unknown>;
  const defaults: Partial<Record<MatchRound, number>> = {};
  for (const round of Object.values(MatchRound)) if (body[round] !== undefined && body[round] !== null) defaults[round] = Number(body[round]);
  const bracket = await setBracketSetDefaults({ eventId, bracketId: requireParamId(request.params.bracketId), actorId: admin.id, defaults, expectedVersion: Number(request.body.expectedVersion), commandId: requireCommandId(request.body.commandId) });
  response.json({ bracket: serializeBracket(bracket) });
}));

bracketsRouter.patch('/api/admin/events/:eventId/brackets/:bracketId/publication', asyncHandler(async (request, response) => {
  const eventId = requireParamId(request.params.eventId);
  const admin = await requireEventCapability(request, eventId, Capability.BRACKET_PUBLISH);
  response.json({ bracket: serializeBracket(await publishBracket({ eventId, bracketId: requireParamId(request.params.bracketId), actorId: admin.id, published: request.body.published === true, expectedVersion: Number(request.body.expectedVersion), commandId: requireCommandId(request.body.commandId) })) });
}));

bracketsRouter.get('/api/admin/events/:eventId/brackets', asyncHandler(async (request, response) => {
  const eventId = requireParamId(request.params.eventId);
  await requireEventCapability(request, eventId, Capability.BRACKET_MANAGE);
  const brackets = await listBrackets(eventId);
  response.json({ brackets: brackets.map(serializeBracket) });
}));

bracketsRouter.get('/api/public/events/:eventId/brackets', asyncHandler(async (request, response) => {
  const brackets = await listBrackets(requireParamId(request.params.eventId), true);
  // Short TTL: brackets advance during a live event, with realtime updates on top.
  setPublicCache(response, { maxAge: 15, staleWhileRevalidate: 60 });
  response.json({ brackets: brackets.map(serializeBracket) });
}));

bracketsRouter.get('/api/events/:eventId/brackets', asyncHandler(async (request, response) => {
  const brackets = await listBrackets(requireParamId(request.params.eventId), true);
  response.json({ brackets: brackets.map(serializeBracket) });
}));
