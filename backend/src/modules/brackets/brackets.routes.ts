import { Router } from 'express';
import { Capability } from '../../generated/prisma/client.js';
import { requireCapability } from '../../common/capabilities.js';
import { requireCommandId } from '../../common/commands.js';
import { asyncHandler, requireParamId } from '../../common/http.js';
import { serializeBracket } from '../../common/serializers.js';
import { createBracket, generateBracket, listBrackets, lockBracket, publishBracket } from './brackets.service.js';

export const bracketsRouter = Router();

bracketsRouter.post('/api/admin/events/:eventId/brackets', asyncHandler(async (request, response) => {
  const admin = await requireCapability(request, Capability.BRACKET_MANAGE);
  const bracket = await createBracket({ eventId: requireParamId(request.params.eventId), categoryId: requireParamId(request.body.categoryId), actorId: admin.id, commandId: requireCommandId(request.body.commandId) });
  response.status(201).json({ bracket: serializeBracket(bracket) });
}));

bracketsRouter.post('/api/admin/events/:eventId/brackets/:bracketId/generate', asyncHandler(async (request, response) => {
  const admin = await requireCapability(request, Capability.BRACKET_MANAGE);
  const bracket = await generateBracket({ eventId: requireParamId(request.params.eventId), bracketId: requireParamId(request.params.bracketId), actorId: admin.id, requestIds: Array.isArray(request.body.requestIds) ? request.body.requestIds.filter((id: unknown): id is string => typeof id === 'string') : [], expectedVersion: Number(request.body.expectedVersion), commandId: requireCommandId(request.body.commandId) });
  response.json({ bracket: serializeBracket(bracket) });
}));

bracketsRouter.post('/api/admin/events/:eventId/brackets/:bracketId/lock', asyncHandler(async (request, response) => {
  const admin = await requireCapability(request, Capability.BRACKET_MANAGE);
  response.json({ bracket: serializeBracket(await lockBracket({ eventId: requireParamId(request.params.eventId), bracketId: requireParamId(request.params.bracketId), actorId: admin.id, expectedVersion: Number(request.body.expectedVersion), commandId: requireCommandId(request.body.commandId) })) });
}));

bracketsRouter.patch('/api/admin/events/:eventId/brackets/:bracketId/publication', asyncHandler(async (request, response) => {
  const admin = await requireCapability(request, Capability.BRACKET_PUBLISH);
  response.json({ bracket: serializeBracket(await publishBracket({ eventId: requireParamId(request.params.eventId), bracketId: requireParamId(request.params.bracketId), actorId: admin.id, published: request.body.published === true, expectedVersion: Number(request.body.expectedVersion), commandId: requireCommandId(request.body.commandId) })) });
}));

bracketsRouter.get('/api/admin/events/:eventId/brackets', asyncHandler(async (request, response) => {
  await requireCapability(request, Capability.BRACKET_MANAGE);
  const brackets = await listBrackets(requireParamId(request.params.eventId));
  response.json({ brackets: brackets.map(serializeBracket) });
}));

bracketsRouter.get('/api/public/events/:eventId/brackets', asyncHandler(async (request, response) => {
  const brackets = await listBrackets(requireParamId(request.params.eventId), true);
  response.json({ brackets: brackets.map(serializeBracket) });
}));

bracketsRouter.get('/api/events/:eventId/brackets', asyncHandler(async (request, response) => {
  const brackets = await listBrackets(requireParamId(request.params.eventId), true);
  response.json({ brackets: brackets.map(serializeBracket) });
}));
