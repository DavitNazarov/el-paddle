import { Router } from 'express';
import { Capability, MatchResultType, MatchSide, ScoreAction, UserRole } from '../../generated/prisma/client.js';
import { requireCapability } from '../../common/capabilities.js';
import { requireCommandId } from '../../common/commands.js';
import { asyncHandler, cleanString, jsonError, requireParamId } from '../../common/http.js';
import { serializeMatch, serializeMatchDetail } from '../../common/serializers.js';
import { getCurrentUser, requireUser } from '../auth/auth.service.js';
import { completeMatchByDecision, correctCompletedMatch, getJudgeMatch, getMatchDetail, listMatchHistory, scoreMatch, startMatch } from './matches.service.js';

export const matchesRouter = Router();

function requireJudgeRole(role: UserRole) {
  if (role !== UserRole.JUDGE) jsonError('Forbidden', 403);
}

matchesRouter.get('/api/judge/matches/:matchId', asyncHandler(async (request, response) => {
  const judge = await requireUser(request);
  requireJudgeRole(judge.role);
  response.json({ match: serializeMatch(await getJudgeMatch(judge.id, requireParamId(request.params.matchId))) });
}));

matchesRouter.post('/api/judge/matches/:matchId/start', asyncHandler(async (request, response) => {
  const judge = await requireUser(request);
  requireJudgeRole(judge.role);
  response.json({ match: serializeMatch(await startMatch({ judgeId: judge.id, matchId: requireParamId(request.params.matchId), expectedVersion: Number(request.body.expectedVersion), commandId: requireCommandId(request.body.commandId) })) });
}));

matchesRouter.post('/api/judge/matches/:matchId/score', asyncHandler(async (request, response) => {
  const judge = await requireUser(request);
  requireJudgeRole(judge.role);
  const side = cleanString(request.body.side).toUpperCase() as MatchSide;
  const action = cleanString(request.body.action).toUpperCase() as ScoreAction;
  if (!Object.values(MatchSide).includes(side) || !Object.values(ScoreAction).includes(action)) jsonError('Invalid score command.');
  response.json({ match: serializeMatch(await scoreMatch({ judgeId: judge.id, matchId: requireParamId(request.params.matchId), side, action, expectedVersion: Number(request.body.expectedVersion), commandId: requireCommandId(request.body.commandId) })) });
}));

matchesRouter.post('/api/judge/matches/:matchId/complete', asyncHandler(async (request, response) => {
  const judge = await requireUser(request);
  requireJudgeRole(judge.role);
  const resultType = cleanString(request.body.resultType).toUpperCase() as MatchResultType;
  if (resultType !== MatchResultType.WALKOVER && resultType !== MatchResultType.WITHDRAWAL) jsonError('This result requires an administrator.', 403);
  response.json({ match: serializeMatch(await completeMatchByDecision({ actorId: judge.id, matchId: requireParamId(request.params.matchId), winnerEntryId: requireParamId(request.body.winnerEntryId), resultType, reason: cleanString(request.body.reason), expectedVersion: Number(request.body.expectedVersion), commandId: requireCommandId(request.body.commandId), judgeMode: true })) });
}));

matchesRouter.post('/api/admin/matches/:matchId/complete', asyncHandler(async (request, response) => {
  const admin = await requireCapability(request, Capability.MATCH_RESULT_ADMIN);
  const resultType = cleanString(request.body.resultType).toUpperCase() as MatchResultType;
  if (!Object.values(MatchResultType).includes(resultType)) jsonError('Invalid result type.');
  response.json({ match: serializeMatch(await completeMatchByDecision({ actorId: admin.id, matchId: requireParamId(request.params.matchId), winnerEntryId: requireParamId(request.body.winnerEntryId), resultType, reason: cleanString(request.body.reason), expectedVersion: Number(request.body.expectedVersion), commandId: requireCommandId(request.body.commandId), judgeMode: false })) });
}));

matchesRouter.post('/api/admin/matches/:matchId/corrections', asyncHandler(async (request, response) => {
  const admin = await requireCapability(request, Capability.MATCH_RESULT_CORRECT);
  response.json({ match: serializeMatch(await correctCompletedMatch({ actorId: admin.id, matchId: requireParamId(request.params.matchId), winnerEntryId: requireParamId(request.body.winnerEntryId), scoreA: Number(request.body.scoreA), scoreB: Number(request.body.scoreB), reason: cleanString(request.body.reason), expectedVersion: Number(request.body.expectedVersion), commandId: requireCommandId(request.body.commandId) })) });
}));

matchesRouter.get('/api/matches', asyncHandler(async (request, response) => {
  const user = await getCurrentUser(request);
  const matches = await listMatchHistory({ eventId: cleanString(request.query.eventId) || undefined, clubId: cleanString(request.query.clubId) || undefined, playerId: cleanString(request.query.playerId) || undefined, publicOnly: user?.role !== UserRole.ADMIN, take: Number(request.query.take) || 50 });
  response.json({ matches: matches.map(serializeMatch) });
}));

matchesRouter.get('/api/matches/:matchId', asyncHandler(async (request, response) => {
  const user = await getCurrentUser(request);
  const detail = await getMatchDetail(requireParamId(request.params.matchId), user ? { id: user.id, role: user.role } : undefined);
  response.json({ match: serializeMatchDetail(detail.match, detail.redactResult) });
}));

matchesRouter.get('/api/me/matches', asyncHandler(async (request, response) => {
  const user = await requireUser(request);
  const matches = await listMatchHistory({ ownUserId: user.id, take: Number(request.query.take) || 50 });
  response.json({ matches: matches.map(serializeMatch) });
}));

matchesRouter.get('/api/players/:playerId/matches', asyncHandler(async (request, response) => {
  const matches = await listMatchHistory({ playerId: requireParamId(request.params.playerId), publicOnly: true, take: Number(request.query.take) || 50 });
  response.json({ matches: matches.map(serializeMatch) });
}));

matchesRouter.get('/api/clubs/:clubId/matches', asyncHandler(async (request, response) => {
  const matches = await listMatchHistory({ clubId: requireParamId(request.params.clubId), publicOnly: true, take: Number(request.query.take) || 50 });
  response.json({ matches: matches.map(serializeMatch) });
}));
