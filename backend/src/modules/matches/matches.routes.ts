import { Router } from 'express';
import { Capability, MatchResultType, MatchSide, ScoreAction, UserRole } from '../../generated/prisma/client.js';
import { requireCapability } from '../../common/capabilities.js';
import { requireCommandId } from '../../common/commands.js';
import { asyncHandler, cleanString, jsonError, requireParamId } from '../../common/http.js';
import { serializeMatch, serializeMatchDetail, serializeMatchList } from '../../common/serializers.js';
import { getCurrentUser, requireUser } from '../auth/auth.service.js';
import { completeMatchByDecision, correctCompletedMatch, decideSlot, getJudgeMatch, getMatchDetail, listMatchHistory, requireScoringRole, scoreMatch, setMatchSlotConfig, startMatch, undoLastSlot } from './matches.service.js';

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

matchesRouter.post('/api/judge/matches/:matchId/slots', asyncHandler(async (request, response) => {
  const judge = await requireUser(request);
  requireScoringRole(judge.role);
  const winnerSide = cleanString(request.body.winnerSide).toUpperCase() as MatchSide;
  const slotNumber = Number(request.body.slotNumber);
  if (!Object.values(MatchSide).includes(winnerSide) || !Number.isInteger(slotNumber) || slotNumber < 1) jsonError('Invalid slot command.');
  response.json({ match: serializeMatch(await decideSlot({ judgeId: judge.id, judgeRole: judge.role, matchId: requireParamId(request.params.matchId), slotNumber, winnerSide, expectedVersion: Number(request.body.expectedVersion), commandId: requireCommandId(request.body.commandId) })) });
}));

matchesRouter.post('/api/judge/matches/:matchId/slots/undo', asyncHandler(async (request, response) => {
  const judge = await requireUser(request);
  requireScoringRole(judge.role);
  response.json({ match: serializeMatch(await undoLastSlot({ actorId: judge.id, actorRole: judge.role, matchId: requireParamId(request.params.matchId), expectedVersion: Number(request.body.expectedVersion), commandId: requireCommandId(request.body.commandId), judgeMode: true })) });
}));

matchesRouter.post('/api/admin/matches/:matchId/slots/undo', asyncHandler(async (request, response) => {
  const admin = await requireCapability(request, Capability.MATCH_RESULT_CORRECT);
  response.json({ match: serializeMatch(await undoLastSlot({ actorId: admin.id, actorRole: admin.role, matchId: requireParamId(request.params.matchId), reason: cleanString(request.body.reason), expectedVersion: Number(request.body.expectedVersion), commandId: requireCommandId(request.body.commandId), judgeMode: false })) });
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

matchesRouter.patch('/api/admin/matches/:matchId/slot-config', asyncHandler(async (request, response) => {
  const admin = await requireCapability(request, Capability.BRACKET_MANAGE);
  const raw = request.body.slotCountOverride;
  const slotCountOverride = raw === null || raw === undefined || raw === '' ? null : Number(raw);
  response.json({ match: serializeMatch(await setMatchSlotConfig({ actorId: admin.id, matchId: requireParamId(request.params.matchId), slotCountOverride, expectedVersion: Number(request.body.expectedVersion), commandId: requireCommandId(request.body.commandId) })) });
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
