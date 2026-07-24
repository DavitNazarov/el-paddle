import { BracketStatus, MatchResultType, MatchRound, MatchSide, MatchStatus, NotificationType, ScheduleItemStatus, ScoreAction, UserRole, type Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';
import { jsonError } from '../../common/http.js';
import { findCommandReceipt, payloadHash, saveCommandReceipt } from '../../common/commands.js';
import { queueNotifications, queueOutbox, writeAudit } from '../../common/domain-events.js';

export const matchInclude = {
  bracket: { include: { event: true, eventCategory: { include: { category: true } } } },
  participantA: { include: { owner: true, teammate: true } },
  participantB: { include: { owner: true, teammate: true } },
  winner: { include: { owner: true, teammate: true } },
  loser: { include: { owner: true, teammate: true } },
  scheduleItem: { include: { court: true } },
  snapshots: true,
} satisfies Prisma.MatchInclude;

export function applyScoreAction(current: number, action: ScoreAction) {
  const next = current + (action === ScoreAction.INCREMENT ? 1 : -1);
  if (next < 0 || next > 6) jsonError('Score must stay between 0 and 6.', 409);
  return next;
}

export function canViewMatchDetail(input: {
  status: MatchStatus;
  isAdmin: boolean;
  isParticipant: boolean;
  bracketPublished: boolean;
  schedulePublished: boolean;
  publicLiveScoringEnabled: boolean;
  resultsPublished: boolean;
}) {
  const supportedStatus = input.status === MatchStatus.READY
    || input.status === MatchStatus.IN_PROGRESS
    || input.status === MatchStatus.COMPLETED;
  if (!supportedStatus) return false;
  if (input.isAdmin || input.isParticipant) return true;
  const isPubliclyListed = input.bracketPublished || input.schedulePublished;
  if (input.status === MatchStatus.COMPLETED) return input.resultsPublished || isPubliclyListed;
  if (input.status === MatchStatus.READY) return isPubliclyListed;
  return isPubliclyListed && input.publicLiveScoringEnabled;
}

export function shouldRedactMatchResult(input: {
  status: MatchStatus;
  isAdmin: boolean;
  isParticipant: boolean;
  resultsPublished: boolean;
}) {
  return input.status === MatchStatus.COMPLETED
    && !input.resultsPublished
    && !input.isAdmin
    && !input.isParticipant;
}

async function requireAssignedJudge(tx: Prisma.TransactionClient, judgeId: string, matchId: string) {
  const match = await tx.match.findUnique({ where: { id: matchId }, include: matchInclude });
  if (!match?.scheduleItem) jsonError('Assigned match not found.', 404);
  const now = new Date();
  const assigned = match.scheduleItem.assignedJudgeId === judgeId || Boolean(await tx.courtJudgeAssignment.findFirst({ where: { courtId: match.scheduleItem.courtId, judgeUserId: judgeId, revokedAt: null, startsAt: { lte: now }, endsAt: { gte: now } } }));
  if (!assigned) jsonError('Assigned match not found.', 404);
  return match;
}

export async function getJudgeMatch(judgeId: string, matchId: string) {
  return prisma.$transaction((tx) => requireAssignedJudge(tx, judgeId, matchId));
}

export async function startMatch(input: { judgeId: string; matchId: string; expectedVersion: number; commandId: string }) {
  const hash = payloadHash(input);
  return prisma.$transaction(async (tx) => {
    const replay = await findCommandReceipt(tx, input.judgeId, 'match.start', input.commandId, hash);
    if (replay) return tx.match.findUniqueOrThrow({ where: { id: input.matchId }, include: matchInclude });
    const match = await requireAssignedJudge(tx, input.judgeId, input.matchId);
    if (match.bracket.event.status !== 'ONGOING') jsonError('Event is not ongoing.', 409);
    if (match.status !== MatchStatus.READY || !match.participantAEntryId || !match.participantBEntryId) jsonError('Match is not ready.', 409);
    if (match.version !== input.expectedVersion) jsonError('Match changed. Refresh and try again.', 409);
    const earlier = await tx.scheduleItem.findFirst({ where: { courtId: match.scheduleItem!.courtId, queuePosition: { lt: match.scheduleItem!.queuePosition }, status: { in: [ScheduleItemStatus.READY, ScheduleItemStatus.IN_PROGRESS] } } });
    if (earlier) jsonError('An earlier court match must be completed first.', 409);
    const courtActive = await tx.scheduleItem.findFirst({ where: { courtId: match.scheduleItem!.courtId, status: ScheduleItemStatus.IN_PROGRESS, id: { not: match.scheduleItem!.id } } });
    if (courtActive) jsonError('This court already has an active match.', 409);
    const judgeActive = await tx.scheduleItem.findFirst({ where: { assignedJudgeId: input.judgeId, status: ScheduleItemStatus.IN_PROGRESS, id: { not: match.scheduleItem!.id } } });
    if (judgeActive) jsonError('You already have an active match.', 409);
    const startResult = await tx.match.updateMany({
      where: { id: match.id, status: MatchStatus.READY, version: input.expectedVersion },
      data: { status: MatchStatus.IN_PROGRESS, startedAt: new Date(), version: { increment: 1 } },
    });
    if (startResult.count !== 1) jsonError('Match changed. Refresh and try again.', 409);
    const scheduleResult = await tx.scheduleItem.updateMany({
      where: { id: match.scheduleItem!.id, version: match.scheduleItem!.version, status: { not: ScheduleItemStatus.IN_PROGRESS } },
      data: { status: ScheduleItemStatus.IN_PROGRESS, assignedJudgeId: input.judgeId, version: { increment: 1 } },
    });
    if (scheduleResult.count !== 1) jsonError('Schedule changed. Refresh and try again.', 409);
    const updated = await tx.match.findUniqueOrThrow({ where: { id: match.id }, include: matchInclude });
    await writeAudit(tx, { action: 'match.started', actorId: input.judgeId, eventId: match.bracket.eventId, entityType: 'Match', entityId: match.id, before: { status: match.status }, after: { status: updated.status } });
    await queueOutbox(tx, { topic: 'match.started', aggregateType: 'Match', aggregateId: match.id, payload: { eventId: match.bracket.eventId, matchId: match.id, version: updated.version }, deduplicationKey: `match:${match.id}:started:v${updated.version}` });
    await queueNotifications(tx, [updated.participantA, updated.participantB].flatMap((entry) => [entry!.owner, entry!.teammate].map((user) => ({ recipientUserId: user.id, type: NotificationType.MATCH_STARTED, title: 'Match started', message: 'Your match is now in progress.', entityType: 'Match', entityId: match.id, eventId: match.bracket.eventId, actionPath: `/matches/${match.id}`, version: updated.version }))));
    await saveCommandReceipt(tx, { actorId: input.judgeId, action: 'match.start', commandId: input.commandId, hash });
    return updated;
  });
}

async function copyWinnerSnapshot(tx: Prisma.TransactionClient, sourceMatchId: string, winnerEntryId: string, targetMatchId: string, targetSide: MatchSide) {
  const snapshot = await tx.matchParticipantSnapshot.findFirst({ where: { matchId: sourceMatchId, entryId: winnerEntryId } });
  if (!snapshot) jsonError('Participant history snapshot is missing.', 500);
  const snapshotData = { entryId: snapshot.entryId, ownerUserId: snapshot.ownerUserId, ownerName: snapshot.ownerName, teammateUserId: snapshot.teammateUserId, teammateName: snapshot.teammateName, clubId: snapshot.clubId, clubName: snapshot.clubName };
  await tx.matchParticipantSnapshot.upsert({ where: { matchId_side: { matchId: targetMatchId, side: targetSide } }, update: snapshotData, create: { matchId: targetMatchId, side: targetSide, ...snapshotData } });
}

async function advanceWinner(tx: Prisma.TransactionClient, match: Awaited<ReturnType<typeof requireAssignedJudge>>, winnerEntryId: string) {
  if (!match.nextMatchId || !match.nextMatchSlot) return;
  const nextBefore = await tx.match.findUniqueOrThrow({ where: { id: match.nextMatchId } });
  const occupied = match.nextMatchSlot === MatchSide.A ? nextBefore.participantAEntryId : nextBefore.participantBEntryId;
  if (occupied && occupied !== winnerEntryId) jsonError('Winner slot is already occupied.', 409);
  const data = match.nextMatchSlot === MatchSide.A ? { participantAEntryId: winnerEntryId } : { participantBEntryId: winnerEntryId };
  const next = await tx.match.update({ where: { id: match.nextMatchId }, data: { ...data, version: { increment: 1 } } });
  await copyWinnerSnapshot(tx, match.id, winnerEntryId, next.id, match.nextMatchSlot);
  if (next.participantAEntryId && next.participantBEntryId) {
    await tx.match.update({ where: { id: next.id }, data: { status: MatchStatus.READY, version: { increment: 1 } } });
    const nextSchedule = await tx.scheduleItem.findUnique({ where: { matchId: next.id } });
    if (nextSchedule) await tx.scheduleItem.update({ where: { id: nextSchedule.id }, data: { status: ScheduleItemStatus.READY, version: { increment: 1 } } });
  }
}

async function completeMatch(
  tx: Prisma.TransactionClient,
  match: Awaited<ReturnType<typeof requireAssignedJudge>>,
  input: { actorId: string; winnerEntryId: string; resultType: MatchResultType; reason?: string },
) {
  const loserEntryId = match.participantAEntryId === input.winnerEntryId ? match.participantBEntryId : match.participantAEntryId;
  if (!loserEntryId || ![match.participantAEntryId, match.participantBEntryId].includes(input.winnerEntryId)) jsonError('Winner must be a match participant.', 409);
  const completeResult = await tx.match.updateMany({
    where: { id: match.id, status: match.status, version: match.version },
    data: { status: MatchStatus.COMPLETED, resultType: input.resultType, resultReason: input.reason || null, winnerEntryId: input.winnerEntryId, loserEntryId, completedAt: new Date(), version: { increment: 1 } },
  });
  if (completeResult.count !== 1) jsonError('Match changed. Refresh and try again.', 409);
  const completed = await tx.match.findUniqueOrThrow({ where: { id: match.id }, include: matchInclude });
  if (match.scheduleItem) {
    const scheduleResult = await tx.scheduleItem.updateMany({
      where: { id: match.scheduleItem.id, version: match.scheduleItem.version },
      data: { status: ScheduleItemStatus.COMPLETED, version: { increment: 1 } },
    });
    if (scheduleResult.count !== 1) jsonError('Schedule changed. Refresh and try again.', 409);
  }
  await advanceWinner(tx, match, input.winnerEntryId);
  const winner = completed.winner!;
  const loser = completed.loser!;
  await tx.user.updateMany({ where: { id: { in: [winner.ownerId, winner.teammateId] } }, data: { matchesPlayed: { increment: 1 }, wins: { increment: 1 } } });
  await tx.user.updateMany({ where: { id: { in: [loser.ownerId, loser.teammateId] } }, data: { matchesPlayed: { increment: 1 }, losses: { increment: 1 } } });
  if (match.round === MatchRound.FINAL) await tx.bracket.update({ where: { id: match.bracketId }, data: { status: BracketStatus.COMPLETED, completedAt: new Date(), version: { increment: 1 } } });
  await writeAudit(tx, { action: 'match.completed', actorId: input.actorId, eventId: match.bracket.eventId, entityType: 'Match', entityId: match.id, before: { status: match.status, scoreA: match.scoreA, scoreB: match.scoreB }, after: { status: MatchStatus.COMPLETED, winnerEntryId: input.winnerEntryId, resultType: input.resultType } , publicReason: input.reason });
  await queueOutbox(tx, { topic: 'match.completed', aggregateType: 'Match', aggregateId: match.id, payload: { eventId: match.bracket.eventId, bracketId: match.bracketId, matchId: match.id, winnerEntryId: input.winnerEntryId, version: completed.version }, deduplicationKey: `match:${match.id}:completed:v${completed.version}` });
  await queueNotifications(tx, [winner, loser].flatMap((entry) => [entry.owner, entry.teammate].map((user) => ({ recipientUserId: user.id, recipientEmail: user.email, type: NotificationType.MATCH_COMPLETED, title: 'Match completed', message: `Final score: ${completed.scoreA}–${completed.scoreB}.`, entityType: 'Match', entityId: match.id, eventId: match.bracket.eventId, actionPath: `/matches/${match.id}`, version: completed.version }))));
  return completed;
}

export async function scoreMatch(input: { judgeId: string; matchId: string; side: MatchSide; action: ScoreAction; expectedVersion: number; commandId: string }) {
  const hash = payloadHash(input);
  return prisma.$transaction(async (tx) => {
    const replay = await findCommandReceipt(tx, input.judgeId, 'match.score', input.commandId, hash);
    if (replay) return tx.match.findUniqueOrThrow({ where: { id: input.matchId }, include: matchInclude });
    const match = await requireAssignedJudge(tx, input.judgeId, input.matchId);
    if (match.status !== MatchStatus.IN_PROGRESS) jsonError('Match is not in progress.', 409);
    if (match.version !== input.expectedVersion) jsonError('Score changed. Refresh and try again.', 409);
    const current = input.side === MatchSide.A ? match.scoreA : match.scoreB;
    const next = applyScoreAction(current, input.action);
    const scoreA = input.side === MatchSide.A ? next : match.scoreA;
    const scoreB = input.side === MatchSide.B ? next : match.scoreB;
    const scoreResult = await tx.match.updateMany({
      where: { id: match.id, status: MatchStatus.IN_PROGRESS, version: input.expectedVersion },
      data: { scoreA, scoreB, version: { increment: 1 } },
    });
    if (scoreResult.count !== 1) jsonError('Score changed. Refresh and try again.', 409);
    let updated = await tx.match.findUniqueOrThrow({ where: { id: match.id }, include: matchInclude });
    await tx.scoreEvent.create({ data: { matchId: match.id, judgeUserId: input.judgeId, action: input.action, side: input.side, scoreABefore: match.scoreA, scoreAAfter: scoreA, scoreBBefore: match.scoreB, scoreBAfter: scoreB, matchVersion: updated.version, commandId: input.commandId } });
    await queueOutbox(tx, { topic: 'match.score.updated', aggregateType: 'Match', aggregateId: match.id, payload: { eventId: match.bracket.eventId, matchId: match.id, scoreA, scoreB, version: updated.version }, deduplicationKey: `match:${match.id}:score:v${updated.version}` });
    if (next === 6) {
      const winnerEntryId = input.side === MatchSide.A ? match.participantAEntryId : match.participantBEntryId;
      if (!winnerEntryId) jsonError('Winner entry is missing.', 409);
      updated = await completeMatch(tx, { ...match, scoreA, scoreB, version: updated.version }, { actorId: input.judgeId, winnerEntryId, resultType: MatchResultType.NORMAL });
    }
    await saveCommandReceipt(tx, { actorId: input.judgeId, action: 'match.score', commandId: input.commandId, hash, response: { matchId: match.id, version: updated.version } });
    return updated;
  });
}

export async function completeMatchByDecision(input: { actorId: string; matchId: string; winnerEntryId: string; resultType: MatchResultType; reason: string; expectedVersion: number; commandId: string; judgeMode: boolean }) {
  if (input.resultType === MatchResultType.NORMAL || input.resultType === MatchResultType.BYE) jsonError('Use score controls for a normal result.');
  if (!input.reason.trim()) jsonError('A result reason is required.');
  const hash = payloadHash(input);
  return prisma.$transaction(async (tx) => {
    const action = 'match.complete.decision';
    const replay = await findCommandReceipt(tx, input.actorId, action, input.commandId, hash);
    if (replay) return tx.match.findUniqueOrThrow({ where: { id: input.matchId }, include: matchInclude });
    const match = input.judgeMode ? await requireAssignedJudge(tx, input.actorId, input.matchId) : await tx.match.findUnique({ where: { id: input.matchId }, include: matchInclude });
    if (!match) jsonError('Match not found.', 404);
    if (match.status !== MatchStatus.READY && match.status !== MatchStatus.IN_PROGRESS) jsonError('Match cannot be completed.', 409);
    if (match.version !== input.expectedVersion) jsonError('Match changed. Refresh and try again.', 409);
    const completed = await completeMatch(tx, match, { actorId: input.actorId, winnerEntryId: input.winnerEntryId, resultType: input.resultType, reason: input.reason });
    await saveCommandReceipt(tx, { actorId: input.actorId, action, commandId: input.commandId, hash });
    return completed;
  });
}

export async function listMatchHistory(input: { eventId?: string; clubId?: string; playerId?: string; ownUserId?: string; publicOnly?: boolean; take?: number }) {
  const playerId = input.ownUserId ?? input.playerId;
  return prisma.match.findMany({
    where: {
      status: MatchStatus.COMPLETED,
      ...(input.eventId ? { bracket: { eventId: input.eventId } } : {}),
      ...(input.publicOnly ? { bracket: { event: { resultsPublishedAt: { not: null } } } } : {}),
      ...(input.clubId ? { snapshots: { some: { clubId: input.clubId } } } : {}),
      ...(playerId ? { snapshots: { some: { OR: [{ ownerUserId: playerId }, { teammateUserId: playerId }] } } } : {}),
    },
    include: matchInclude,
    orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
    take: Math.min(Math.max(input.take ?? 50, 1), 100),
  });
}

export async function getMatchDetail(matchId: string, viewer?: { id: string; role: UserRole }) {
  const match = await prisma.match.findUnique({ where: { id: matchId }, include: matchInclude });
  if (!match) jsonError('Match not found.', 404);
  const isParticipant = Boolean(viewer && [match.participantA, match.participantB].some((entry) => entry?.ownerId === viewer.id || entry?.teammateId === viewer.id));
  const access = {
    status: match.status,
    isAdmin: viewer?.role === UserRole.ADMIN,
    isParticipant,
    bracketPublished: Boolean(match.bracket.publishedAt),
    schedulePublished: Boolean(match.scheduleItem && match.bracket.event.schedulePublishedAt),
    publicLiveScoringEnabled: match.bracket.event.publicLiveScoringEnabled,
    resultsPublished: Boolean(match.bracket.event.resultsPublishedAt),
  };
  if (!canViewMatchDetail(access)) jsonError('Match not found.', 404);
  return { match, redactResult: shouldRedactMatchResult(access) };
}

export async function correctCompletedMatch(input: { actorId: string; matchId: string; winnerEntryId: string; scoreA: number; scoreB: number; reason: string; expectedVersion: number; commandId: string }) {
  if (!input.reason.trim()) jsonError('A correction reason is required.');
  if (![input.scoreA, input.scoreB].every((score) => Number.isInteger(score) && score >= 0 && score <= 6)) jsonError('Scores must be between 0 and 6.');
  const hash = payloadHash(input);
  return prisma.$transaction(async (tx) => {
    const replay = await findCommandReceipt(tx, input.actorId, 'match.correct', input.commandId, hash);
    if (replay) return tx.match.findUniqueOrThrow({ where: { id: input.matchId }, include: matchInclude });
    const match = await tx.match.findUnique({ where: { id: input.matchId }, include: matchInclude });
    if (!match || match.status !== MatchStatus.COMPLETED || !match.winnerEntryId || !match.loserEntryId) jsonError('Completed match not found.', 404);
    if (match.bracket.event.status === 'COMPLETED') jsonError('Reopen the completed event before correcting a match.', 409);
    if (match.version !== input.expectedVersion) jsonError('Match changed. Refresh and try again.', 409);
    if (![match.participantAEntryId, match.participantBEntryId].includes(input.winnerEntryId)) jsonError('Winner must be a match participant.');
    const newLoserId = match.participantAEntryId === input.winnerEntryId ? match.participantBEntryId : match.participantAEntryId;
    if (!newLoserId) jsonError('Loser entry is missing.', 409);
    if (match.nextMatchId && match.nextMatchSlot) {
      const next = await tx.match.findUniqueOrThrow({ where: { id: match.nextMatchId } });
      if (next.status === MatchStatus.IN_PROGRESS || next.status === MatchStatus.COMPLETED || next.startedAt) jsonError('A downstream match has already started. Use a bracket repair procedure.', 409);
      const data = match.nextMatchSlot === MatchSide.A ? { participantAEntryId: input.winnerEntryId } : { participantBEntryId: input.winnerEntryId };
      await tx.match.update({ where: { id: next.id }, data: { ...data, version: { increment: 1 } } });
      await copyWinnerSnapshot(tx, match.id, input.winnerEntryId, next.id, match.nextMatchSlot);
    }
    if (match.winnerEntryId !== input.winnerEntryId) {
      const oldWinner = await tx.eventRegistration.findUniqueOrThrow({ where: { id: match.winnerEntryId } });
      const oldLoser = await tx.eventRegistration.findUniqueOrThrow({ where: { id: match.loserEntryId } });
      await tx.user.updateMany({ where: { id: { in: [oldWinner.ownerId, oldWinner.teammateId] } }, data: { wins: { decrement: 1 }, losses: { increment: 1 } } });
      await tx.user.updateMany({ where: { id: { in: [oldLoser.ownerId, oldLoser.teammateId] } }, data: { losses: { decrement: 1 }, wins: { increment: 1 } } });
    }
    const correctionResult = await tx.match.updateMany({
      where: { id: match.id, status: MatchStatus.COMPLETED, version: input.expectedVersion },
      data: { winnerEntryId: input.winnerEntryId, loserEntryId: newLoserId, scoreA: input.scoreA, scoreB: input.scoreB, resultType: MatchResultType.ADMIN_DECISION, resultReason: input.reason, version: { increment: 1 } },
    });
    if (correctionResult.count !== 1) jsonError('Match changed. Refresh and try again.', 409);
    const corrected = await tx.match.findUniqueOrThrow({ where: { id: match.id }, include: matchInclude });
    await writeAudit(tx, { action: 'match.corrected', actorId: input.actorId, eventId: match.bracket.eventId, entityType: 'Match', entityId: match.id, before: { winnerEntryId: match.winnerEntryId, loserEntryId: match.loserEntryId, scoreA: match.scoreA, scoreB: match.scoreB }, after: { winnerEntryId: corrected.winnerEntryId, loserEntryId: corrected.loserEntryId, scoreA: corrected.scoreA, scoreB: corrected.scoreB }, publicReason: input.reason });
    await queueOutbox(tx, { topic: 'match.corrected', aggregateType: 'Match', aggregateId: match.id, payload: { eventId: match.bracket.eventId, matchId: match.id, version: corrected.version }, deduplicationKey: `match:${match.id}:corrected:v${corrected.version}` });
    await saveCommandReceipt(tx, { actorId: input.actorId, action: 'match.correct', commandId: input.commandId, hash });
    return corrected;
  });
}
