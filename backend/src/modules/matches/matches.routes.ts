import { Router } from 'express';
import { Capability, MatchResultType, MatchSide, ScoreAction, UserRole } from '../../generated/prisma/client.js';
import { requireCapability } from '../../common/capabilities.js';
import { requireCommandId } from '../../common/commands.js';
import { asyncHandler, cleanString, jsonError, requireParamId } from '../../common/http.js';
import { serializeMatch, serializeMatchDetail, serializeMatchList } from '../../common/serializers.js';
import { getCurrentUser, requireUser } from '../auth/auth.service.js';
import { completeMatchByDecision, correctCompletedMatch, decideSet, getJudgeMatch, getMatchDetail, listMatchHistory, recordSetResult, requireScoringRole, scoreMatch, setMatchSetConfig, startMatch, undoLastSet } from './matches.service.js';

export const matchesRouter = Router();

matchesRouter.get('/api/judge/matches/:matchId', asyncHandler(async (request, response) => {
  const judge = await requireUser(request);
  requireScoringRole(judge.role);
  response.json({ match: serializeMatch(await getJudgeMatch(judge.id, judge.role, requireParamId(request.params.matchId))) });
}));

matchesRouter.post('/api/judge/matches/:matchId/start', asyncHandler(async (request, response) => {
  const judge = await requireUser(request);
  requireScoringRole(judge.role);
  response.json({ match: serializeMatch(await startMatch({ judgeId: judge.id, judgeRole: judge.role, matchId: requireParamId(request.params.matchId), expectedVersion: Number(request.body.expectedVersion), commandId: requireCommandId(request.body.commandId) })) });
}));

matchesRouter.post('/api/judge/matches/:matchId/score', asyncHandler(async (request, response) => {
  const judge = await requireUser(request);
  requireScoringRole(judge.role);
  const side = cleanString(request.body.side).toUpperCase() as MatchSide;
  const action = cleanString(request.body.action).toUpperCase() as ScoreAction;
  if (!Object.values(MatchSide).includes(side) || !Object.values(ScoreAction).includes(action)) jsonError('Invalid score command.');
  response.json({ match: serializeMatch(await scoreMatch({ judgeId: judge.id, judgeRole: judge.role, matchId: requireParamId(request.params.matchId), side, action, expectedVersion: Number(request.body.expectedVersion), commandId: requireCommandId(request.body.commandId) })) });
}));

matchesRouter.post('/api/judge/matches/:matchId/sets', asyncHandler(async (request, response) => {
  const judge = await requireUser(request);
  requireScoringRole(judge.role);
  const winnerSide = cleanString(request.body.winnerSide).toUpperCase() as MatchSide;
  const setNumber = Number(request.body.setNumber);
  if (!Object.values(MatchSide).includes(winnerSide) || !Number.isInteger(setNumber) || setNumber < 1) jsonError('Invalid set command.');
  response.json({ match: serializeMatch(await decideSet({ judgeId: judge.id, judgeRole: judge.role, matchId: requireParamId(request.params.matchId), setNumber, winnerSide, expectedVersion: Number(request.body.expectedVersion), commandId: requireCommandId(request.body.commandId) })) });
}));

matchesRouter.post('/api/judge/matches/:matchId/result', asyncHandler(async (request, response) => {
  const actor = await requireUser(request);
  requireScoringRole(actor.role);
  const setsA = Number(request.body.setsA);
  const setsB = Number(request.body.setsB);
  if (![setsA, setsB].every((value) => Number.isInteger(value) && value >= 0)) jsonError('Set wins must be whole numbers.');
  response.json({ match: serializeMatch(await recordSetResult({ actorId: actor.id, actorRole: actor.role, matchId: requireParamId(request.params.matchId), setsA, setsB, expectedVersion: Number(request.body.expectedVersion), commandId: requireCommandId(request.body.commandId) })) });
}));

matchesRouter.post('/api/judge/matches/:matchId/sets/undo', asyncHandler(async (request, response) => {
  const judge = await requireUser(request);
  requireScoringRole(judge.role);
  response.json({ match: serializeMatch(await undoLastSet({ actorId: judge.id, actorRole: judge.role, matchId: requireParamId(request.params.matchId), expectedVersion: Number(request.body.expectedVersion), commandId: requireCommandId(request.body.commandId), judgeMode: true })) });
}));

matchesRouter.post('/api/admin/matches/:matchId/sets/undo', asyncHandler(async (request, response) => {
  const admin = await requireCapability(request, Capability.MATCH_RESULT_CORRECT);
  response.json({ match: serializeMatch(await undoLastSet({ actorId: admin.id, actorRole: admin.role, matchId: requireParamId(request.params.matchId), reason: cleanString(request.body.reason), expectedVersion: Number(request.body.expectedVersion), commandId: requireCommandId(request.body.commandId), judgeMode: false })) });
}));

matchesRouter.post('/api/judge/matches/:matchId/complete', asyncHandler(async (request, response) => {
  const judge = await requireUser(request);
  requireScoringRole(judge.role);
  const resultType = cleanString(request.body.resultType).toUpperCase() as MatchResultType;
  if (resultType !== MatchResultType.WALKOVER && resultType !== MatchResultType.WITHDRAWAL) jsonError('This result requires an administrator.', 403);
  response.json({ match: serializeMatch(await completeMatchByDecision({ actorId: judge.id, actorRole: judge.role, matchId: requireParamId(request.params.matchId), winnerEntryId: requireParamId(request.body.winnerEntryId), resultType, reason: cleanString(request.body.reason), expectedVersion: Number(request.body.expectedVersion), commandId: requireCommandId(request.body.commandId), judgeMode: true })) });
}));

matchesRouter.post('/api/admin/matches/:matchId/complete', asyncHandler(async (request, response) => {
  const admin = await requireCapability(request, Capability.MATCH_RESULT_ADMIN);
  const resultType = cleanString(request.body.resultType).toUpperCase() as MatchResultType;
  if (!Object.values(MatchResultType).includes(resultType)) jsonError('Invalid result type.');
  response.json({ match: serializeMatch(await completeMatchByDecision({ actorId: admin.id, actorRole: admin.role, matchId: requireParamId(request.params.matchId), winnerEntryId: requireParamId(request.body.winnerEntryId), resultType, reason: cleanString(request.body.reason), expectedVersion: Number(request.body.expectedVersion), commandId: requireCommandId(request.body.commandId), judgeMode: false })) });
}));

matchesRouter.patch('/api/admin/matches/:matchId/set-config', asyncHandler(async (request, response) => {
  const admin = await requireCapability(request, Capability.BRACKET_MANAGE);
  const raw = request.body.setCountOverride;
  const setCountOverride = raw === null || raw === undefined || raw === '' ? null : Number(raw);
  response.json({ match: serializeMatch(await setMatchSetConfig({ actorId: admin.id, matchId: requireParamId(request.params.matchId), setCountOverride, expectedVersion: Number(request.body.expectedVersion), commandId: requireCommandId(request.body.commandId) })) });
}));

matchesRouter.post('/api/admin/matches/:matchId/corrections', asyncHandler(async (request, response) => {
  const admin = await requireCapability(request, Capability.MATCH_RESULT_CORRECT);
  response.json({ match: serializeMatch(await correctCompletedMatch({ actorId: admin.id, matchId: requireParamId(request.params.matchId), winnerEntryId: requireParamId(request.body.winnerEntryId), scoreA: Number(request.body.scoreA), scoreB: Number(request.body.scoreB), reason: cleanString(request.body.reason), expectedVersion: Number(request.body.expectedVersion), commandId: requireCommandId(request.body.commandId) })) });
}));

matchesRouter.get('/api/matches', asyncHandler(async (request, response) => {
  const user = await getCurrentUser(request);
  const matches = await listMatchHistory({ eventId: cleanString(request.query.eventId) || undefined, clubId: cleanString(request.query.clubId) || undefined, playerId: cleanString(request.query.playerId) || undefined, publicOnly: user?.role !== UserRole.ADMIN, take: Number(request.query.take) || 50 });
  response.json(serializeMatchList(matches));
}));

matchesRouter.get('/api/matches/:matchId', asyncHandler(async (request, response) => {
  const user = await getCurrentUser(request);
  const detail = await getMatchDetail(requireParamId(request.params.matchId), user ? { id: user.id, role: user.role } : undefined);
  response.json({ match: serializeMatchDetail(detail.match, detail.redactResult) });
}));

matchesRouter.get('/api/me/matches', asyncHandler(async (request, response) => {
  const user = await requireUser(request);
  const matches = await listMatchHistory({ ownUserId: user.id, take: Number(request.query.take) || 50 });
  response.json(serializeMatchList(matches));
}));

matchesRouter.get('/api/players/:playerId/matches', asyncHandler(async (request, response) => {
  const matches = await listMatchHistory({ playerId: requireParamId(request.params.playerId), publicOnly: true, take: Number(request.query.take) || 50 });
  response.json(serializeMatchList(matches));
}));

matchesRouter.get('/api/clubs/:clubId/matches', asyncHandler(async (request, response) => {
  const matches = await listMatchHistory({ clubId: requireParamId(request.params.clubId), publicOnly: true, take: Number(request.query.take) || 50 });
  response.json(serializeMatchList(matches));
}));
