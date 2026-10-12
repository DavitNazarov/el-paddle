import { BracketStatus, MatchResultType, MatchRound, MatchSide, MatchStatus, NotificationType, ScheduleItemStatus, ScoreAction, ScoringMode, SetEventAction, UserRole, type Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';
import { jsonError } from '../../common/http.js';
import { findCommandReceipt, payloadHash, saveCommandReceipt } from '../../common/commands.js';
import { queueNotifications, queueOutbox, writeAudit } from '../../common/domain-events.js';
import { entryUserSelect } from '../../common/includes.js';
import { carryParticipantSnapshot } from '../../common/snapshots.js';
import { applyByes } from '../brackets/byes.js';
import { isTerminalTally, isValidSetCount, maxSets, nextSetNumber, setMatchWinner, setsToReachTally, tallySets, terminalTallyExample } from './set-engine.js';

/** Event fields serializeMatch emits plus the publication flags getMatchDetail gates on. No bank columns. */
const matchEventSelect = {
  id: true,
  title: true,
  date: true,
  location: true,
  description: true,
  status: true,
  timeZone: true,
  publicLiveScoringEnabled: true,
  resultsPublishedAt: true,
  schedulePublishedAt: true,
  categories: { include: { category: true } },
} satisfies Prisma.EventSelect;

export const matchInclude = {
  bracket: { include: { event: { select: matchEventSelect }, eventCategory: { include: { category: true } } } },
  participantA: { include: { owner: { select: entryUserSelect }, teammate: { select: entryUserSelect } } },
  participantB: { include: { owner: { select: entryUserSelect }, teammate: { select: entryUserSelect } } },
  winner: { include: { owner: { select: entryUserSelect }, teammate: { select: entryUserSelect } } },
  loser: { include: { owner: { select: entryUserSelect }, teammate: { select: entryUserSelect } } },
  scheduleItem: { include: { court: true } },
  sets: { orderBy: { setNumber: 'asc' as const } },
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

/**
 * A scorer is bound to one court at a time; an admin or the event's organiser is
 * not. Unbound scorers may run several matches at once and do not take over the
 * schedule item's judge slot, so stepping in never erases the judge roster.
 */
export function isUnboundScorer(role: UserRole) {
  return role === UserRole.ADMIN || role === UserRole.ORGANISER;
}

export function requireScoringRole(role: UserRole) {
  if (role !== UserRole.JUDGE && !isUnboundScorer(role)) jsonError('Judge access required.', 403);
}

/**
 * Authorize one actor to score one match:
 * - a judge, exactly as before: named on the schedule item, or holding a live
 *   court assignment;
 * - an admin, always;
 * - an organiser, when this event was handed to them.
 */
async function requireMatchScorer(
  tx: Prisma.TransactionClient,
  actorId: string,
  actorRole: UserRole,
  matchId: string,
) {
  const match = await tx.match.findUnique({ where: { id: matchId }, include: matchInclude });
  if (!match?.scheduleItem) jsonError('Assigned match not found.', 404);

  if (actorRole === UserRole.ADMIN) return match;
  if (actorRole === UserRole.ORGANISER) {
    const assignment = await tx.eventOrganiser.findUnique({
      where: { eventId_userId: { eventId: match.bracket.eventId, userId: actorId } },
      select: { revokedAt: true },
    });
    if (!assignment || assignment.revokedAt) jsonError('Assigned match not found.', 404);
    return match;
  }

  const now = new Date();
  const assigned = match.scheduleItem.assignedJudgeId === actorId || Boolean(await tx.courtJudgeAssignment.findFirst({ where: { courtId: match.scheduleItem.courtId, judgeUserId: actorId, revokedAt: null, startsAt: { lte: now }, endsAt: { gte: now } } }));
  if (!assigned) jsonError('Assigned match not found.', 404);
  return match;
}

export async function getJudgeMatch(judgeId: string, judgeRole: UserRole, matchId: string) {
  return prisma.$transaction((tx) => requireMatchScorer(tx, judgeId, judgeRole, matchId));
}

/** Set wins this match races to: the admin override, else the bracket round default, else one. */
async function resolveSetCount(tx: Prisma.TransactionClient, match: { bracketId: string; round: MatchRound; setCountOverride: number | null }) {
  if (match.setCountOverride !== null) return match.setCountOverride;
  const config = await tx.bracketRoundConfig.findUnique({ where: { bracketId_round: { bracketId: match.bracketId, round: match.round } } });
  return config?.setCount ?? 1;
}

export async function setMatchSetConfig(input: { actorId: string; matchId: string; setCountOverride: number | null; expectedVersion: number; commandId: string }) {
  if (input.setCountOverride !== null && !isValidSetCount(input.setCountOverride)) jsonError('Set count must be 1, 2, or 3.');
  const hash = payloadHash(input);
  return prisma.$transaction(async (tx) => {
    const replay = await findCommandReceipt(tx, input.actorId, 'match.set-config', input.commandId, hash);
    if (replay) return tx.match.findUniqueOrThrow({ where: { id: input.matchId }, include: matchInclude });
    const match = await tx.match.findUnique({ where: { id: input.matchId }, include: matchInclude });
    if (!match) jsonError('Match not found.', 404);
    if (match.bracket.event.status === 'COMPLETED') jsonError('Reopen the completed event before editing its bracket.', 409);
    if (match.startedAt || (match.status !== MatchStatus.PENDING && match.status !== MatchStatus.READY)) jsonError('Match already started. Set settings are locked.', 409);
    if (match.version !== input.expectedVersion) jsonError('Match changed. Refresh and try again.', 409);
    const configResult = await tx.match.updateMany({
      where: { id: match.id, version: input.expectedVersion, startedAt: null },
      data: { setCountOverride: input.setCountOverride, version: { increment: 1 } },
    });
    if (configResult.count !== 1) jsonError('Match changed. Refresh and try again.', 409);
    const updated = await tx.match.findUniqueOrThrow({ where: { id: match.id }, include: matchInclude });
    await writeAudit(tx, { action: 'match.set-config.updated', actorId: input.actorId, eventId: match.bracket.eventId, entityType: 'Match', entityId: match.id, before: { setCountOverride: match.setCountOverride }, after: { setCountOverride: updated.setCountOverride } });
    await queueOutbox(tx, { topic: 'match.config.updated', aggregateType: 'Match', aggregateId: match.id, payload: { eventId: match.bracket.eventId, matchId: match.id, version: updated.version }, deduplicationKey: `match:${match.id}:set-config:v${updated.version}` });
    await saveCommandReceipt(tx, { actorId: input.actorId, action: 'match.set-config', commandId: input.commandId, hash });
    return updated;
  });
}

export async function startMatch(input: { judgeId: string; judgeRole: UserRole; matchId: string; expectedVersion: number; commandId: string }) {
  const hash = payloadHash(input);
  return prisma.$transaction(async (tx) => {
    const replay = await findCommandReceipt(tx, input.judgeId, 'match.start', input.commandId, hash);
    if (replay) return tx.match.findUniqueOrThrow({ where: { id: input.matchId }, include: matchInclude });
    const match = await requireMatchScorer(tx, input.judgeId, input.judgeRole, input.matchId);
    const unbound = isUnboundScorer(input.judgeRole);
    if (match.bracket.event.status !== 'ONGOING') jsonError('Event is not ongoing.', 409);
    if (match.status !== MatchStatus.READY || !match.participantAEntryId || !match.participantBEntryId) jsonError('Match is not ready.', 409);
    if (match.version !== input.expectedVersion) jsonError('Match changed. Refresh and try again.', 409);
    const earlier = await tx.scheduleItem.findFirst({ where: { courtId: match.scheduleItem!.courtId, queuePosition: { lt: match.scheduleItem!.queuePosition }, status: { in: [ScheduleItemStatus.READY, ScheduleItemStatus.IN_PROGRESS] } } });
    if (earlier) jsonError('An earlier court match must be completed first.', 409);
    const courtActive = await tx.scheduleItem.findFirst({ where: { courtId: match.scheduleItem!.courtId, status: ScheduleItemStatus.IN_PROGRESS, id: { not: match.scheduleItem!.id } } });
    if (courtActive) jsonError('This court already has an active match.', 409);
    // An unbound scorer runs as many courts at once as the event needs.
    const judgeActive = unbound ? null : await tx.scheduleItem.findFirst({ where: { assignedJudgeId: input.judgeId, status: ScheduleItemStatus.IN_PROGRESS, id: { not: match.scheduleItem!.id } } });
    if (judgeActive) jsonError('You already have an active match.', 409);
    // Freeze the set format for the running match so later config edits cannot change it.
    const setCount = match.scoringMode === ScoringMode.SETS ? await resolveSetCount(tx, match) : null;
    const startResult = await tx.match.updateMany({
      where: { id: match.id, status: MatchStatus.READY, version: input.expectedVersion },
      data: { status: MatchStatus.IN_PROGRESS, startedAt: new Date(), ...(setCount === null ? {} : { setCount }), version: { increment: 1 } },
    });
    if (startResult.count !== 1) jsonError('Match changed. Refresh and try again.', 409);
    const scheduleResult = await tx.scheduleItem.updateMany({
      where: { id: match.scheduleItem!.id, version: match.scheduleItem!.version, status: { not: ScheduleItemStatus.IN_PROGRESS } },
      // Keep whatever judge the schedule names when an admin or organiser starts it.
      data: { status: ScheduleItemStatus.IN_PROGRESS, ...(unbound ? {} : { assignedJudgeId: input.judgeId }), version: { increment: 1 } },
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

async function advanceWinner(tx: Prisma.TransactionClient, match: Awaited<ReturnType<typeof requireMatchScorer>>, winnerEntryId: string) {
  if (!match.nextMatchId || !match.nextMatchSlot) return;
  const nextBefore = await tx.match.findUniqueOrThrow({ where: { id: match.nextMatchId } });
  const occupied = match.nextMatchSlot === MatchSide.A ? nextBefore.participantAEntryId : nextBefore.participantBEntryId;
  if (occupied && occupied !== winnerEntryId) jsonError('Winner slot is already occupied.', 409);
  const data = match.nextMatchSlot === MatchSide.A ? { participantAEntryId: winnerEntryId } : { participantBEntryId: winnerEntryId };
  const next = await tx.match.update({ where: { id: match.nextMatchId }, data: { ...data, version: { increment: 1 } } });
  await carryParticipantSnapshot(tx, { sourceMatchId: match.id, entryId: winnerEntryId, targetMatchId: next.id, targetSide: match.nextMatchSlot });
  if (next.participantAEntryId && next.participantBEntryId) {
    await tx.match.update({ where: { id: next.id }, data: { status: MatchStatus.READY, version: { increment: 1 } } });
    const nextSchedule = await tx.scheduleItem.findUnique({ where: { matchId: next.id } });
    if (nextSchedule) await tx.scheduleItem.update({ where: { id: nextSchedule.id }, data: { status: ScheduleItemStatus.READY, version: { increment: 1 } } });
  }
  // The winner may have walked into a round whose other side is empty, which is
  // only knowable now — that is another bye, and it can carry on up the draw.
  await applyByes(tx, match.bracketId);
}

async function completeMatch(
  tx: Prisma.TransactionClient,
  match: Awaited<ReturnType<typeof requireMatchScorer>>,
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
  const resultMessage = match.scoringMode === ScoringMode.SETS
    ? `Set result: ${completed.scoreA}–${completed.scoreB}.`
    : `Final score: ${completed.scoreA}–${completed.scoreB}.`;
  await queueNotifications(tx, [winner, loser].flatMap((entry) => [entry.owner, entry.teammate].map((user) => ({ recipientUserId: user.id, recipientEmail: user.email, type: NotificationType.MATCH_COMPLETED, title: 'Match completed', message: resultMessage, entityType: 'Match', entityId: match.id, eventId: match.bracket.eventId, actionPath: `/matches/${match.id}`, version: completed.version }))));
  return completed;
}

/** Loads a set match ready for a judge command, or the plain record for an admin one. */
async function loadSetMatch(tx: Prisma.TransactionClient, actorId: string, actorRole: UserRole, matchId: string, judgeMode: boolean) {
  const match = judgeMode
    ? await requireMatchScorer(tx, actorId, actorRole, matchId)
    : await tx.match.findUnique({ where: { id: matchId }, include: matchInclude });
  if (!match) jsonError('Match not found.', 404);
  if (match.scoringMode !== ScoringMode.SETS) jsonError('This match does not use set scoring.', 409);
  return match;
}

function entryIdForSide(match: { participantAEntryId: string | null; participantBEntryId: string | null }, side: MatchSide) {
  const entryId = side === MatchSide.A ? match.participantAEntryId : match.participantBEntryId;
  if (!entryId) jsonError('Match participants are not set.', 409);
  return entryId;
}

export async function decideSet(input: { judgeId: string; judgeRole: UserRole; matchId: string; setNumber: number; winnerSide: MatchSide; expectedVersion: number; commandId: string }) {
  const hash = payloadHash(input);
  return prisma.$transaction(async (tx) => {
    const replay = await findCommandReceipt(tx, input.judgeId, 'match.set.decide', input.commandId, hash);
    if (replay) return tx.match.findUniqueOrThrow({ where: { id: input.matchId }, include: matchInclude });
    const match = await loadSetMatch(tx, input.judgeId, input.judgeRole, input.matchId, true);
    if (match.status !== MatchStatus.IN_PROGRESS) jsonError('Match is not in progress.', 409);
    if (match.version !== input.expectedVersion) jsonError('Set changed. Refresh and try again.', 409);
    const setCount = match.setCount;
    if (setCount === null) jsonError('Set format is not set for this match.', 409);
    // The client names the set it is deciding, so a stale retry fails loudly instead of
    // silently recording the next one.
    if (input.setNumber !== nextSetNumber(match.sets)) jsonError('This set was already decided. Refresh and try again.', 409);
    if (input.setNumber > maxSets(setCount)) jsonError('This match has no further sets.', 409);
    const winnerEntryId = entryIdForSide(match, input.winnerSide);
    const before = tallySets(match.sets);
    await tx.matchSet.create({ data: { matchId: match.id, setNumber: input.setNumber, winnerSide: input.winnerSide, winnerEntryId, decidedById: input.judgeId } });
    const after = tallySets([...match.sets, { winnerSide: input.winnerSide }]);
    const setResult = await tx.match.updateMany({
      where: { id: match.id, status: MatchStatus.IN_PROGRESS, version: input.expectedVersion },
      data: { scoreA: after.setsA, scoreB: after.setsB, version: { increment: 1 } },
    });
    if (setResult.count !== 1) jsonError('Set changed. Refresh and try again.', 409);
    let updated = await tx.match.findUniqueOrThrow({ where: { id: match.id }, include: matchInclude });
    await tx.setEvent.create({ data: { matchId: match.id, actorId: input.judgeId, action: SetEventAction.DECIDED, setNumber: input.setNumber, winnerSide: input.winnerSide, winnerEntryId, setsABefore: before.setsA, setsBBefore: before.setsB, setsAAfter: after.setsA, setsBAfter: after.setsB, matchVersion: updated.version, commandId: input.commandId } });
    await queueOutbox(tx, { topic: 'match.set.decided', aggregateType: 'Match', aggregateId: match.id, payload: { eventId: match.bracket.eventId, matchId: match.id, setNumber: input.setNumber, scoreA: after.setsA, scoreB: after.setsB, version: updated.version }, deduplicationKey: `match:${match.id}:set:v${updated.version}` });
    const matchWinnerSide = setMatchWinner(after.setsA, after.setsB, setCount);
    if (matchWinnerSide) {
      updated = await completeMatch(
        tx,
        { ...match, scoreA: after.setsA, scoreB: after.setsB, version: updated.version },
        { actorId: input.judgeId, winnerEntryId: entryIdForSide(match, matchWinnerSide), resultType: MatchResultType.NORMAL },
      );
    }
    await saveCommandReceipt(tx, { actorId: input.judgeId, action: 'match.set.decide', commandId: input.commandId, hash, response: { matchId: match.id, version: updated.version } });
    return updated;
  });
}

/**
 * Records a whole match result as a tally: two numbers, one command, one completed
 * match. This is how the match control console scores, because that is how an
 * operator hears a result — "one two", not a set-by-set account.
 *
 * The set rows are still what the tally is made of, so they are written here in the
 * derived order `setsToReachTally` gives. A tally may only add to sets a courtside
 * judge already recorded; taking one back is an undo, which has its own command.
 */
export async function recordSetResult(input: { actorId: string; actorRole: UserRole; matchId: string; setsA: number; setsB: number; expectedVersion: number; commandId: string }) {
  const hash = payloadHash(input);
  return prisma.$transaction(async (tx) => {
    const replay = await findCommandReceipt(tx, input.actorId, 'match.result.record', input.commandId, hash);
    if (replay) return tx.match.findUniqueOrThrow({ where: { id: input.matchId }, include: matchInclude });
    const match = await loadSetMatch(tx, input.actorId, input.actorRole, input.matchId, true);
    if (match.status !== MatchStatus.IN_PROGRESS) jsonError('Match is not in progress.', 409);
    if (match.version !== input.expectedVersion) jsonError('Match changed. Refresh and try again.', 409);
    const setCount = match.setCount;
    if (setCount === null) jsonError('Set format is not set for this match.', 409);
    if (!isTerminalTally(input.setsA, input.setsB, setCount)) jsonError(`The result must be a finished set tally (for example ${terminalTallyExample(setCount)}).`);
    const before = tallySets(match.sets);
    if (input.setsA < before.setsA || input.setsB < before.setsB) jsonError('The result is lower than the sets already recorded. Undo those first.', 409);
    const after = { setsA: input.setsA, setsB: input.setsB };
    const pending = setsToReachTally(before, after);
    const decidedAt = new Date();
    await tx.matchSet.createMany({
      data: pending.map((winnerSide, index) => ({
        matchId: match.id,
        setNumber: nextSetNumber(match.sets) + index,
        winnerSide,
        winnerEntryId: entryIdForSide(match, winnerSide),
        decidedById: input.actorId,
        decidedAt,
      })),
    });
    const resultUpdate = await tx.match.updateMany({
      where: { id: match.id, status: MatchStatus.IN_PROGRESS, version: input.expectedVersion },
      data: { scoreA: after.setsA, scoreB: after.setsB, version: { increment: 1 } },
    });
    if (resultUpdate.count !== 1) jsonError('Match changed. Refresh and try again.', 409);
    const scored = await tx.match.findUniqueOrThrow({ where: { id: match.id }, include: matchInclude });
    const winnerSide = setMatchWinner(after.setsA, after.setsB, setCount)!;
    const winnerEntryId = entryIdForSide(match, winnerSide);
    // One history row for one command: the operator entered a result, not a run of sets.
    await tx.setEvent.create({ data: { matchId: match.id, actorId: input.actorId, action: SetEventAction.DECIDED, setNumber: match.sets.length + pending.length, winnerSide, winnerEntryId, setsABefore: before.setsA, setsBBefore: before.setsB, setsAAfter: after.setsA, setsBAfter: after.setsB, matchVersion: scored.version, commandId: input.commandId } });
    await queueOutbox(tx, { topic: 'match.result.recorded', aggregateType: 'Match', aggregateId: match.id, payload: { eventId: match.bracket.eventId, matchId: match.id, scoreA: after.setsA, scoreB: after.setsB, version: scored.version }, deduplicationKey: `match:${match.id}:result:v${scored.version}` });
    const completed = await completeMatch(
      tx,
      { ...match, scoreA: after.setsA, scoreB: after.setsB, version: scored.version },
      { actorId: input.actorId, winnerEntryId, resultType: MatchResultType.NORMAL },
    );
    await saveCommandReceipt(tx, { actorId: input.actorId, action: 'match.result.record', commandId: input.commandId, hash, response: { matchId: match.id, version: completed.version } });
    return completed;
  });
}

/**
 * Withdraws the last decided set. A judge may do this while the match runs; reopening a
 * completed match is admin-only and additionally retracts the winner from the next round.
 */
export async function undoLastSet(input: { actorId: string; actorRole: UserRole; matchId: string; reason?: string; expectedVersion: number; commandId: string; judgeMode: boolean }) {
  const action = input.judgeMode ? 'match.set.undo' : 'match.set.undo.admin';
  if (!input.judgeMode && !input.reason?.trim()) jsonError('An undo reason is required.');
  const hash = payloadHash(input);
  return prisma.$transaction(async (tx) => {
    const replay = await findCommandReceipt(tx, input.actorId, action, input.commandId, hash);
    if (replay) return tx.match.findUniqueOrThrow({ where: { id: input.matchId }, include: matchInclude });
    const match = await loadSetMatch(tx, input.actorId, input.actorRole, input.matchId, input.judgeMode);
    if (match.bracket.event.status === 'COMPLETED') jsonError('Reopen the completed event before correcting a match.', 409);
    if (match.version !== input.expectedVersion) jsonError('Match changed. Refresh and try again.', 409);
    const lastSet = match.sets.at(-1);
    if (!lastSet) jsonError('No set result to undo.', 409);
    const reopening = match.status === MatchStatus.COMPLETED;
    if (reopening) {
      if (input.judgeMode) jsonError('The match is complete. Ask an administrator to reopen it.', 409);
      if (match.resultType !== MatchResultType.NORMAL) jsonError('Only a normally scored set match can be reopened. Use a correction instead.', 409);
      await assertCourtAndJudgeFree(tx, match);
      await retractAdvancedWinner(tx, match);
    } else if (match.status !== MatchStatus.IN_PROGRESS) {
      jsonError('Match is not in progress.', 409);
    }

    const before = tallySets(match.sets);
    await tx.matchSet.delete({ where: { matchId_setNumber: { matchId: match.id, setNumber: lastSet.setNumber } } });
    const after = tallySets(match.sets.filter((set) => set.setNumber !== lastSet.setNumber));
    const undoResult = await tx.match.updateMany({
      where: { id: match.id, status: match.status, version: input.expectedVersion },
      data: {
        scoreA: after.setsA,
        scoreB: after.setsB,
        version: { increment: 1 },
        ...(reopening
          ? { status: MatchStatus.IN_PROGRESS, winnerEntryId: null, loserEntryId: null, resultType: null, resultReason: null, completedAt: null }
          : {}),
      },
    });
    if (undoResult.count !== 1) jsonError('Match changed. Refresh and try again.', 409);
    if (reopening) {
      await reverseCompletionEffects(tx, match);
      if (match.scheduleItem) await tx.scheduleItem.update({ where: { id: match.scheduleItem.id }, data: { status: ScheduleItemStatus.IN_PROGRESS, version: { increment: 1 } } });
    }
    const updated = await tx.match.findUniqueOrThrow({ where: { id: match.id }, include: matchInclude });
    await tx.setEvent.create({ data: { matchId: match.id, actorId: input.actorId, action: SetEventAction.UNDONE, setNumber: lastSet.setNumber, winnerSide: lastSet.winnerSide, winnerEntryId: lastSet.winnerEntryId, setsABefore: before.setsA, setsBBefore: before.setsB, setsAAfter: after.setsA, setsBAfter: after.setsB, matchVersion: updated.version, commandId: input.commandId, reason: input.reason?.trim() || null } });
    await writeAudit(tx, { action: reopening ? 'match.reopened' : 'match.set.undone', actorId: input.actorId, eventId: match.bracket.eventId, entityType: 'Match', entityId: match.id, before: { status: match.status, scoreA: match.scoreA, scoreB: match.scoreB, winnerEntryId: match.winnerEntryId }, after: { status: updated.status, scoreA: updated.scoreA, scoreB: updated.scoreB, winnerEntryId: updated.winnerEntryId }, publicReason: input.reason?.trim() || undefined });
    await queueOutbox(tx, { topic: reopening ? 'match.reopened' : 'match.set.undone', aggregateType: 'Match', aggregateId: match.id, payload: { eventId: match.bracket.eventId, matchId: match.id, version: updated.version }, deduplicationKey: `match:${match.id}:set-undo:v${updated.version}` });
    if (reopening) {
      const affected = [match.participantA, match.participantB].filter((entry) => entry !== null);
      await queueNotifications(tx, affected.flatMap((entry) => [entry.owner, entry.teammate].map((user) => ({ recipientUserId: user.id, type: NotificationType.MATCH_REOPENED, title: 'Match reopened', message: 'An administrator reopened your match. The last set result was withdrawn.', entityType: 'Match', entityId: match.id, eventId: match.bracket.eventId, actionPath: `/matches/${match.id}`, version: updated.version }))));
    }
    await saveCommandReceipt(tx, { actorId: input.actorId, action, commandId: input.commandId, hash, response: { matchId: match.id, version: updated.version } });
    return updated;
  });
}

/** Pulls the advanced winner back out of the next round. Refuses once that match has started. */
async function retractAdvancedWinner(tx: Prisma.TransactionClient, match: Awaited<ReturnType<typeof requireMatchScorer>>) {
  if (!match.nextMatchId || !match.nextMatchSlot) return;
  const next = await tx.match.findUniqueOrThrow({ where: { id: match.nextMatchId } });
  if (next.status === MatchStatus.IN_PROGRESS || next.status === MatchStatus.COMPLETED || next.startedAt) jsonError('A downstream match has already started. Use a bracket repair procedure.', 409);
  const occupied = match.nextMatchSlot === MatchSide.A ? next.participantAEntryId : next.participantBEntryId;
  if (occupied !== match.winnerEntryId) return;
  const cleared = match.nextMatchSlot === MatchSide.A ? { participantAEntryId: null } : { participantBEntryId: null };
  await tx.match.update({ where: { id: next.id }, data: { ...cleared, status: MatchStatus.PENDING, version: { increment: 1 } } });
  await tx.matchParticipantSnapshot.deleteMany({ where: { matchId: next.id, side: match.nextMatchSlot } });
  const nextSchedule = await tx.scheduleItem.findUnique({ where: { matchId: next.id } });
  if (nextSchedule && nextSchedule.status === ScheduleItemStatus.READY) await tx.scheduleItem.update({ where: { id: nextSchedule.id }, data: { status: ScheduleItemStatus.TENTATIVE, version: { increment: 1 } } });
}

/** A reopened match becomes active again, so its court and judge must not already be busy. */
async function assertCourtAndJudgeFree(tx: Prisma.TransactionClient, match: Awaited<ReturnType<typeof requireMatchScorer>>) {
  if (!match.scheduleItem) return;
  const courtActive = await tx.scheduleItem.findFirst({ where: { courtId: match.scheduleItem.courtId, status: ScheduleItemStatus.IN_PROGRESS, id: { not: match.scheduleItem.id } } });
  if (courtActive) jsonError('Another match is already in progress on this court. Finish it before reopening this match.', 409);
  if (match.scheduleItem.assignedJudgeId) {
    const judgeActive = await tx.scheduleItem.findFirst({ where: { assignedJudgeId: match.scheduleItem.assignedJudgeId, status: ScheduleItemStatus.IN_PROGRESS, id: { not: match.scheduleItem.id } } });
    if (judgeActive) jsonError('The assigned judge already has an active match. Finish it before reopening this match.', 409);
  }
}

/** Rolls back the player record and bracket completion that completing the match applied. */
async function reverseCompletionEffects(tx: Prisma.TransactionClient, match: Awaited<ReturnType<typeof requireMatchScorer>>) {
  if (match.winner) await tx.user.updateMany({ where: { id: { in: [match.winner.ownerId, match.winner.teammateId] } }, data: { matchesPlayed: { decrement: 1 }, wins: { decrement: 1 } } });
  if (match.loser) await tx.user.updateMany({ where: { id: { in: [match.loser.ownerId, match.loser.teammateId] } }, data: { matchesPlayed: { decrement: 1 }, losses: { decrement: 1 } } });
  if (match.round === MatchRound.FINAL) await tx.bracket.update({ where: { id: match.bracketId }, data: { status: BracketStatus.LOCKED, completedAt: null, version: { increment: 1 } } });
}

export async function scoreMatch(input: { judgeId: string; judgeRole: UserRole; matchId: string; side: MatchSide; action: ScoreAction; expectedVersion: number; commandId: string }) {
  const hash = payloadHash(input);
  return prisma.$transaction(async (tx) => {
    const replay = await findCommandReceipt(tx, input.judgeId, 'match.score', input.commandId, hash);
    if (replay) return tx.match.findUniqueOrThrow({ where: { id: input.matchId }, include: matchInclude });
    const match = await requireMatchScorer(tx, input.judgeId, input.judgeRole, input.matchId);
    if (match.scoringMode !== ScoringMode.POINTS) jsonError('This match uses set scoring.', 409);
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

export async function completeMatchByDecision(input: { actorId: string; actorRole: UserRole; matchId: string; winnerEntryId: string; resultType: MatchResultType; reason: string; expectedVersion: number; commandId: string; judgeMode: boolean }) {
  if (input.resultType === MatchResultType.NORMAL || input.resultType === MatchResultType.BYE) jsonError('Use score controls for a normal result.');
  if (!input.reason.trim()) jsonError('A result reason is required.');
  const hash = payloadHash(input);
  return prisma.$transaction(async (tx) => {
    const action = 'match.complete.decision';
    const replay = await findCommandReceipt(tx, input.actorId, action, input.commandId, hash);
    if (replay) return tx.match.findUniqueOrThrow({ where: { id: input.matchId }, include: matchInclude });
    const match = input.judgeMode ? await requireMatchScorer(tx, input.actorId, input.actorRole, input.matchId) : await tx.match.findUnique({ where: { id: input.matchId }, include: matchInclude });
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

/**
 * Every match of one event, filtered the way the match-day screens ask for it.
 *
 * The control console used to rebuild this list in the browser by reading every
 * bracket and every court and joining them, which meant two large reads and a
 * join that had to agree with the server's own idea of which match is on which
 * court. The join belongs where the rows are.
 */
export async function listEventMatches(input: {
  eventId: string;
  status?: MatchStatus[];
  round?: MatchRound;
  categoryId?: string;
  courtId?: string;
  unscheduledOnly?: boolean;
}) {
  return prisma.match.findMany({
    where: {
      bracket: {
        eventId: input.eventId,
        ...(input.categoryId ? { categoryId: input.categoryId } : {}),
      },
      ...(input.status?.length ? { status: { in: input.status } } : {}),
      ...(input.round ? { round: input.round } : {}),
      ...(input.unscheduledOnly ? { scheduleItem: { is: null } } : {}),
      ...(input.courtId ? { scheduleItem: { is: { courtId: input.courtId } } } : {}),
    },
    orderBy: [{ bracket: { categoryId: 'asc' } }, { matchNumber: 'asc' }],
    include: matchInclude,
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
  const hash = payloadHash(input);
  return prisma.$transaction(async (tx) => {
    const replay = await findCommandReceipt(tx, input.actorId, 'match.correct', input.commandId, hash);
    if (replay) return tx.match.findUniqueOrThrow({ where: { id: input.matchId }, include: matchInclude });
    const match = await tx.match.findUnique({ where: { id: input.matchId }, include: matchInclude });
    if (!match || match.status !== MatchStatus.COMPLETED || !match.winnerEntryId || !match.loserEntryId) jsonError('Completed match not found.', 404);
    // Point matches keep the 0-6 rule; set matches must land on a finished tally instead.
    if (match.scoringMode === ScoringMode.SETS) {
      const setCount = match.setCount ?? 1;
      if (!isTerminalTally(input.scoreA, input.scoreB, setCount)) jsonError(`Set tallies must form a finished result (for example ${terminalTallyExample(setCount)}).`);
      const leadingSide = input.scoreA > input.scoreB ? MatchSide.A : MatchSide.B;
      if (entryIdForSide(match, leadingSide) !== input.winnerEntryId) jsonError('The winner must be the side with more set wins.');
    } else if (![input.scoreA, input.scoreB].every((score) => Number.isInteger(score) && score >= 0 && score <= 6)) {
      jsonError('Scores must be between 0 and 6.');
    }
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
      await carryParticipantSnapshot(tx, { sourceMatchId: match.id, entryId: input.winnerEntryId, targetMatchId: next.id, targetSide: match.nextMatchSlot });
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
