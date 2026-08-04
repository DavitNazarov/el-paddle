import { BracketStatus, MatchResultType, MatchRound, MatchSide, MatchStatus, NotificationType, OpponentRequestStatus, ScoringMode, type Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';
import { jsonError } from '../../common/http.js';
import { findCommandReceipt, payloadHash, saveCommandReceipt } from '../../common/commands.js';
import { queueNotifications, queueOutbox, writeAudit } from '../../common/domain-events.js';
import { entryUserSelect } from '../../common/includes.js';
import { isValidSlotCount } from '../matches/slot-engine.js';

export const bracketInclude = {
  eventCategory: { include: { category: true } },
  roundConfigs: true,
  matches: {
    include: {
      participantA: { include: { owner: { select: entryUserSelect }, teammate: { select: entryUserSelect } } },
      participantB: { include: { owner: { select: entryUserSelect }, teammate: { select: entryUserSelect } } },
      scheduleItem: { include: { court: true } },
      slots: { orderBy: { slotNumber: 'asc' as const } },
    },
    orderBy: { matchNumber: 'asc' as const },
  },
} satisfies Prisma.BracketInclude;

export async function createBracket(input: { eventId: string; categoryId: string; actorId: string; commandId: string }) {
  const hash = payloadHash(input);
  return prisma.$transaction(async (tx) => {
    const replay = await findCommandReceipt(tx, input.actorId, 'bracket.create', input.commandId, hash);
    if (replay) return tx.bracket.findFirstOrThrow({ where: { eventId: input.eventId, categoryId: input.categoryId, status: BracketStatus.DRAFT }, include: bracketInclude });
    const event = await tx.event.findUnique({ where: { id: input.eventId } });
    if (!event || event.status !== 'REGISTRATION_CLOSED') jsonError('Registration must be closed.', 409);
    const linked = await tx.eventCategory.findUnique({ where: { eventId_categoryId: { eventId: input.eventId, categoryId: input.categoryId } } });
    if (!linked) jsonError('Event category not found.', 404);
    const existing = await tx.bracket.findFirst({ where: { eventId: input.eventId, categoryId: input.categoryId, status: { in: [BracketStatus.DRAFT, BracketStatus.LOCKED] } }, include: bracketInclude });
    if (existing) return existing;
    const latest = await tx.bracket.aggregate({ where: { eventId: input.eventId, categoryId: input.categoryId }, _max: { generation: true } });
    const bracket = await tx.bracket.create({ data: { eventId: input.eventId, categoryId: input.categoryId, generation: (latest._max.generation ?? 0) + 1 }, include: bracketInclude });
    await writeAudit(tx, { action: 'bracket.created', actorId: input.actorId, eventId: input.eventId, entityType: 'Bracket', entityId: bracket.id, after: { categoryId: input.categoryId, generation: bracket.generation } });
    await saveCommandReceipt(tx, { actorId: input.actorId, action: 'bracket.create', commandId: input.commandId, hash, response: { bracketId: bracket.id } });
    return bracket;
  });
}

/**
 * Per-round slot defaults. Only bind when a match starts, so they stay editable on a locked
 * bracket; a running match keeps the count it snapshotted.
 */
export async function setBracketSlotDefaults(input: { eventId: string; bracketId: string; actorId: string; defaults: Partial<Record<MatchRound, number>>; expectedVersion: number; commandId: string }) {
  for (const value of Object.values(input.defaults)) if (!isValidSlotCount(value)) jsonError('Slot count must be 1, 2, or 3.');
  const hash = payloadHash(input);
  return prisma.$transaction(async (tx) => {
    const replay = await findCommandReceipt(tx, input.actorId, 'bracket.slot-defaults', input.commandId, hash);
    if (replay) return tx.bracket.findUniqueOrThrow({ where: { id: input.bracketId }, include: bracketInclude });
    const bracket = await tx.bracket.findFirst({ where: { id: input.bracketId, eventId: input.eventId }, include: { roundConfigs: true, event: { select: { status: true } } } });
    if (!bracket) jsonError('Bracket not found.', 404);
    if (bracket.event.status === 'COMPLETED') jsonError('Reopen the completed event before editing its bracket.', 409);
    if (bracket.version !== input.expectedVersion) jsonError('Bracket changed. Refresh and try again.', 409);
    const before = Object.fromEntries(bracket.roundConfigs.map((config) => [config.round, config.slotCount]));
    for (const round of Object.values(MatchRound)) {
      const slotCount = input.defaults[round];
      if (slotCount === undefined) await tx.bracketRoundConfig.deleteMany({ where: { bracketId: bracket.id, round } });
      else await tx.bracketRoundConfig.upsert({ where: { bracketId_round: { bracketId: bracket.id, round } }, update: { slotCount }, create: { bracketId: bracket.id, round, slotCount } });
    }
    const updateResult = await tx.bracket.updateMany({ where: { id: bracket.id, version: input.expectedVersion }, data: { version: { increment: 1 } } });
    if (updateResult.count !== 1) jsonError('Bracket changed. Refresh and try again.', 409);
    const updated = await tx.bracket.findUniqueOrThrow({ where: { id: bracket.id }, include: bracketInclude });
    await writeAudit(tx, { action: 'bracket.slot-defaults.updated', actorId: input.actorId, eventId: input.eventId, entityType: 'Bracket', entityId: bracket.id, before, after: input.defaults });
    await queueOutbox(tx, { topic: 'bracket.updated', aggregateType: 'Bracket', aggregateId: bracket.id, payload: { eventId: input.eventId, bracketId: bracket.id, version: updated.version }, deduplicationKey: `bracket:${bracket.id}:slot-defaults:v${updated.version}` });
    await saveCommandReceipt(tx, { actorId: input.actorId, action: 'bracket.slot-defaults', commandId: input.commandId, hash });
    return updated;
  });
}

type MatchNode = { id: string; round: MatchRound; position: number };

export function bracketSizeForEntryCount(entryCount: number) {
  if (entryCount < 2) jsonError('At least 2 approved entries are required to generate a bracket.', 409);
  if (entryCount > 16) jsonError('Brackets support up to 16 approved entries.', 409);
  if (entryCount <= 2) return 2;
  if (entryCount <= 4) return 4;
  if (entryCount <= 8) return 8;
  return 16;
}

function roundPlan(size: number) {
  const rounds = [
    { size: 16, round: MatchRound.ROUND_OF_16 },
    { size: 8, round: MatchRound.QUARTERFINAL },
    { size: 4, round: MatchRound.SEMIFINAL },
    { size: 2, round: MatchRound.FINAL },
  ];
  return rounds
    .filter((item) => item.size <= size)
    .map((item) => ({ round: item.round, count: item.size / 2, firstMatchNumber: size - item.size + 1 }));
}

function firstRoundForSize(size: number) {
  return roundPlan(size)[0]?.round ?? MatchRound.FINAL;
}

async function createMatchGraph(tx: Prisma.TransactionClient, bracketId: string, size: number) {
  const plan = roundPlan(size);
  let nextRound: MatchNode[] = [];
  let firstRound: MatchNode[] = [];

  for (let index = plan.length - 1; index >= 0; index -= 1) {
    const current = plan[index]!;
    const matches: MatchNode[] = [];
    for (let position = 1; position <= current.count; position += 1) {
      const target = nextRound[Math.floor((position - 1) / 2)];
      const match = await tx.match.create({
        data: {
          bracketId,
          round: current.round,
          roundPosition: position,
          matchNumber: current.firstMatchNumber + position - 1,
          scoringMode: ScoringMode.SLOTS,
          nextMatchId: target?.id,
          nextMatchSlot: target ? (position % 2 === 1 ? MatchSide.A : MatchSide.B) : undefined,
        },
      });
      matches.push({ id: match.id, round: match.round, position });
    }
    firstRound = matches;
    nextRound = matches;
  }

  return firstRound;
}

export async function generateBracket(input: { eventId: string; bracketId: string; actorId: string; requestIds: string[]; expectedVersion: number; commandId: string }) {
  const hash = payloadHash(input);
  return prisma.$transaction(async (tx) => {
    const replay = await findCommandReceipt(tx, input.actorId, 'bracket.generate', input.commandId, hash);
    if (replay) return tx.bracket.findUniqueOrThrow({ where: { id: input.bracketId }, include: bracketInclude });
    const bracket = await tx.bracket.findFirst({ where: { id: input.bracketId, eventId: input.eventId }, include: { matches: true } });
    if (!bracket) jsonError('Bracket not found.', 404);
    const event = await tx.event.findUnique({ where: { id: input.eventId }, select: { status: true } });
    if (event?.status === 'COMPLETED') jsonError('Reopen the completed event before editing its bracket.', 409);
    if (bracket.status !== BracketStatus.DRAFT) jsonError('Only a draft bracket can be generated.', 409);
    if (bracket.version !== input.expectedVersion) jsonError('Bracket changed. Refresh and try again.', 409);
    const entries = await tx.eventRegistration.findMany({ where: { eventId: bracket.eventId, categoryId: bracket.categoryId, status: 'APPROVED' }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
    const size = bracketSizeForEntryCount(entries.length);
    const requests = input.requestIds.length ? await tx.opponentRequest.findMany({ where: { id: { in: input.requestIds }, eventId: bracket.eventId, categoryId: bracket.categoryId, status: { in: [OpponentRequestStatus.APPROVED_BY_ADMIN, OpponentRequestStatus.OVERRIDDEN_BY_ADMIN] } } }) : [];
    if (requests.length !== input.requestIds.length) jsonError('One or more pairing requests are not approved.', 409);
    const pairedIds = new Set<string>();
    for (const request of requests) {
      if (pairedIds.has(request.requestingEntryId) || pairedIds.has(request.targetEntryId)) jsonError('Two approved pairings share the same team. Reject one of them on the opponent requests page, then generate again.', 409);
      pairedIds.add(request.requestingEntryId);
      pairedIds.add(request.targetEntryId);
    }

    if (bracket.matches.length) await tx.match.deleteMany({ where: { bracketId: bracket.id } });
    const firstRound = await createMatchGraph(tx, bracket.id, size);
    const openMatches = [...firstRound];
    for (const request of requests) {
      const slot = openMatches.shift()!;
      await tx.match.update({ where: { id: slot.id }, data: { participantAEntryId: request.requestingEntryId, participantBEntryId: request.targetEntryId, status: MatchStatus.READY } });
      await tx.opponentRequest.update({ where: { id: request.id }, data: { status: OpponentRequestStatus.APPLIED_TO_BRACKET, appliedMatchId: slot.id, version: { increment: 1 } } });
    }
    const remaining = entries.filter((entry) => !pairedIds.has(entry.id));
    for (let index = 0; index < remaining.length; index += 1) {
      const slot = openMatches[index % openMatches.length]!;
      const pass = Math.floor(index / openMatches.length);
      await tx.match.update({ where: { id: slot.id }, data: pass === 0 ? { participantAEntryId: remaining[index]!.id } : { participantBEntryId: remaining[index]!.id, status: MatchStatus.READY } });
    }
    const updated = await tx.bracket.update({ where: { id: bracket.id }, data: { size, generationSeed: entries.map((entry) => entry.id).join(','), version: { increment: 1 } }, include: bracketInclude });
    await writeAudit(tx, { action: 'bracket.generated', actorId: input.actorId, eventId: bracket.eventId, entityType: 'Bracket', entityId: bracket.id, after: { size, entries: entries.map((entry) => entry.id), requestIds: input.requestIds } });
    await queueOutbox(tx, { topic: 'bracket.generated', aggregateType: 'Bracket', aggregateId: bracket.id, payload: { eventId: bracket.eventId, bracketId: bracket.id, version: updated.version }, deduplicationKey: `bracket:${bracket.id}:generated:v${updated.version}` });
    await saveCommandReceipt(tx, { actorId: input.actorId, action: 'bracket.generate', commandId: input.commandId, hash });
    return updated;
  });
}

/**
 * Moves a first-round entry to another slot, swapping with whoever is there. Draft brackets only:
 * locking snapshots participant identity, so placement is frozen from then on.
 */
export async function placeBracketEntry(input: { eventId: string; bracketId: string; actorId: string; sourceMatchId: string; sourceSide: MatchSide; targetMatchId: string; targetSide: MatchSide; expectedVersion: number; commandId: string }) {
  const hash = payloadHash(input);
  return prisma.$transaction(async (tx) => {
    const replay = await findCommandReceipt(tx, input.actorId, 'bracket.place', input.commandId, hash);
    if (replay) {
      const current = await tx.bracket.findUniqueOrThrow({ where: { id: input.bracketId }, include: bracketInclude });
      return { bracket: current, revertedRequestIds: [] as string[] };
    }
    const bracket = await tx.bracket.findFirst({ where: { id: input.bracketId, eventId: input.eventId }, include: { event: { select: { status: true } } } });
    if (!bracket) jsonError('Bracket not found.', 404);
    if (bracket.event.status === 'COMPLETED') jsonError('Reopen the completed event before editing its bracket.', 409);
    if (bracket.status !== BracketStatus.DRAFT) jsonError('Only a draft bracket can be rearranged.', 409);
    if (bracket.version !== input.expectedVersion) jsonError('Bracket changed. Refresh and try again.', 409);
    if (input.sourceMatchId === input.targetMatchId && input.sourceSide === input.targetSide) jsonError('Choose a different slot.');

    const firstRound = firstRoundForSize(bracket.size);
    const matchIds = [...new Set([input.sourceMatchId, input.targetMatchId])];
    const matches = await tx.match.findMany({ where: { id: { in: matchIds }, bracketId: bracket.id } });
    if (matches.length !== matchIds.length) jsonError('Match not found.', 404);
    if (matches.some((match) => match.round !== firstRound)) jsonError('Placements can only change first-round slots.');

    const sourceMatch = matches.find((match) => match.id === input.sourceMatchId)!;
    const targetMatch = matches.find((match) => match.id === input.targetMatchId)!;
    const sourceEntryId = input.sourceSide === MatchSide.A ? sourceMatch.participantAEntryId : sourceMatch.participantBEntryId;
    if (!sourceEntryId) jsonError('That slot is already empty. Refresh and try again.', 409);
    const targetEntryId = input.targetSide === MatchSide.A ? targetMatch.participantAEntryId : targetMatch.participantBEntryId;

    // Build the post-move participants per match, then derive each match's readiness from them.
    const pending = new Map(matches.map((match) => [match.id, { a: match.participantAEntryId, b: match.participantBEntryId }]));
    const setSlot = (matchId: string, side: MatchSide, entryId: string | null) => {
      const slots = pending.get(matchId)!;
      if (side === MatchSide.A) slots.a = entryId; else slots.b = entryId;
    };
    setSlot(input.sourceMatchId, input.sourceSide, targetEntryId);
    setSlot(input.targetMatchId, input.targetSide, sourceEntryId);

    for (const [matchId, slots] of pending) {
      await tx.match.update({
        where: { id: matchId },
        data: {
          participantAEntryId: slots.a,
          participantBEntryId: slots.b,
          status: slots.a && slots.b ? MatchStatus.READY : MatchStatus.PENDING,
          version: { increment: 1 },
        },
      });
    }

    // A pairing request only stays applied while both of its entries share the match it was applied to.
    const appliedRequests = await tx.opponentRequest.findMany({ where: { appliedMatchId: { in: matchIds }, status: OpponentRequestStatus.APPLIED_TO_BRACKET } });
    const revertedRequestIds: string[] = [];
    for (const request of appliedRequests) {
      const slots = pending.get(request.appliedMatchId!)!;
      const stillPaired = [slots.a, slots.b].includes(request.requestingEntryId) && [slots.a, slots.b].includes(request.targetEntryId);
      if (stillPaired) continue;
      await tx.opponentRequest.update({ where: { id: request.id }, data: { status: OpponentRequestStatus.APPROVED_BY_ADMIN, appliedMatchId: null, version: { increment: 1 } } });
      revertedRequestIds.push(request.id);
    }

    const updateResult = await tx.bracket.updateMany({ where: { id: bracket.id, version: input.expectedVersion }, data: { version: { increment: 1 } } });
    if (updateResult.count !== 1) jsonError('Bracket changed. Refresh and try again.', 409);
    const updated = await tx.bracket.findUniqueOrThrow({ where: { id: bracket.id }, include: bracketInclude });
    await writeAudit(tx, { action: 'bracket.placement.updated', actorId: input.actorId, eventId: input.eventId, entityType: 'Bracket', entityId: bracket.id, before: { matchId: input.sourceMatchId, side: input.sourceSide, entryId: sourceEntryId }, after: { matchId: input.targetMatchId, side: input.targetSide, entryId: sourceEntryId, swappedEntryId: targetEntryId, revertedRequestIds } });
    await queueOutbox(tx, { topic: 'bracket.updated', aggregateType: 'Bracket', aggregateId: bracket.id, payload: { eventId: input.eventId, bracketId: bracket.id, version: updated.version }, deduplicationKey: `bracket:${bracket.id}:placement:v${updated.version}` });
    await saveCommandReceipt(tx, { actorId: input.actorId, action: 'bracket.place', commandId: input.commandId, hash });
    return { bracket: updated, revertedRequestIds };
  });
}

async function snapshotEntry(tx: Prisma.TransactionClient, matchId: string, side: MatchSide, entryId: string) {
  const entry = await tx.eventRegistration.findUnique({ where: { id: entryId }, include: { owner: { select: { ...entryUserSelect, clubMemberships: { select: { club: { select: { id: true, name: true } } }, take: 1 } } }, teammate: { select: entryUserSelect } } });
  if (!entry) jsonError('Bracket entry not found.', 409);
  const club = entry.owner.clubMemberships[0]?.club;
  if (!club) jsonError('Bracket entry no longer belongs to a club.', 409);
  const name = (user: typeof entry.owner) => [user.name, user.surname].filter(Boolean).join(' ') || user.email;
  await tx.matchParticipantSnapshot.create({ data: { matchId, side, entryId, ownerUserId: entry.owner.id, ownerName: name(entry.owner), teammateUserId: entry.teammate.id, teammateName: name(entry.teammate as typeof entry.owner), clubId: club.id, clubName: club.name } });
}

async function advanceBye(tx: Prisma.TransactionClient, matchId: string, entryId: string) {
  const match = await tx.match.update({ where: { id: matchId }, data: { winnerEntryId: entryId, status: MatchStatus.COMPLETED, resultType: MatchResultType.BYE, completedAt: new Date(), version: { increment: 1 } } });
  if (match.nextMatchId && match.nextMatchSlot) {
    const data = match.nextMatchSlot === MatchSide.A ? { participantAEntryId: entryId } : { participantBEntryId: entryId };
    const next = await tx.match.update({ where: { id: match.nextMatchId }, data });
    if (next.participantAEntryId && next.participantBEntryId) await tx.match.update({ where: { id: next.id }, data: { status: MatchStatus.READY } });
  }
}

export async function lockBracket(input: { eventId: string; bracketId: string; actorId: string; expectedVersion: number; commandId: string }) {
  const hash = payloadHash(input);
  return prisma.$transaction(async (tx) => {
    const replay = await findCommandReceipt(tx, input.actorId, 'bracket.lock', input.commandId, hash);
    if (replay) return tx.bracket.findUniqueOrThrow({ where: { id: input.bracketId }, include: bracketInclude });
    const bracket = await tx.bracket.findFirst({ where: { id: input.bracketId, eventId: input.eventId }, include: { matches: true } });
    if (!bracket) jsonError('Bracket not found.', 404);
    const event = await tx.event.findUnique({ where: { id: input.eventId }, select: { status: true } });
    if (event?.status === 'COMPLETED') jsonError('Reopen the completed event before editing its bracket.', 409);
    if (bracket.status !== BracketStatus.DRAFT || bracket.version !== input.expectedVersion) jsonError('Bracket is not an editable draft.', 409);
    const firstRound = bracket.matches.filter((match) => match.round === firstRoundForSize(bracket.size));
    const entryIds = firstRound.flatMap((match) => [match.participantAEntryId, match.participantBEntryId]).filter((id): id is string => Boolean(id));
    if (new Set(entryIds).size !== entryIds.length || entryIds.length < 2) jsonError('Bracket contains missing or duplicate entries.', 409);
    for (const match of firstRound) {
      if (match.participantAEntryId) await snapshotEntry(tx, match.id, MatchSide.A, match.participantAEntryId);
      if (match.participantBEntryId) await snapshotEntry(tx, match.id, MatchSide.B, match.participantBEntryId);
      if (match.participantAEntryId && !match.participantBEntryId) await advanceBye(tx, match.id, match.participantAEntryId);
      if (!match.participantAEntryId && match.participantBEntryId) await advanceBye(tx, match.id, match.participantBEntryId);
    }
    const updated = await tx.bracket.update({ where: { id: bracket.id }, data: { status: BracketStatus.LOCKED, lockedAt: new Date(), lockedById: input.actorId, version: { increment: 1 } }, include: bracketInclude });
    await writeAudit(tx, { action: 'bracket.locked', actorId: input.actorId, eventId: bracket.eventId, entityType: 'Bracket', entityId: bracket.id, before: { status: bracket.status }, after: { status: updated.status } });
    await queueOutbox(tx, { topic: 'bracket.locked', aggregateType: 'Bracket', aggregateId: bracket.id, payload: { eventId: bracket.eventId, bracketId: bracket.id, version: updated.version }, deduplicationKey: `bracket:${bracket.id}:locked:v${updated.version}` });
    await saveCommandReceipt(tx, { actorId: input.actorId, action: 'bracket.lock', commandId: input.commandId, hash });
    return updated;
  });
}

export async function publishBracket(input: { eventId: string; bracketId: string; actorId: string; published: boolean; expectedVersion: number; commandId: string }) {
  const hash = payloadHash(input);
  return prisma.$transaction(async (tx) => {
    const replay = await findCommandReceipt(tx, input.actorId, 'bracket.publish', input.commandId, hash);
    if (replay) return tx.bracket.findUniqueOrThrow({ where: { id: input.bracketId }, include: bracketInclude });
    const bracket = await tx.bracket.findFirst({ where: { id: input.bracketId, eventId: input.eventId } });
    if (!bracket) jsonError('Bracket not found.', 404);
    const event = await tx.event.findUnique({ where: { id: input.eventId }, select: { status: true } });
    if (event?.status === 'COMPLETED') jsonError('Reopen the completed event before editing its bracket.', 409);
    if (bracket.status === BracketStatus.DRAFT && input.published) jsonError('Lock the bracket before publishing.', 409);
    if (bracket.version !== input.expectedVersion) jsonError('Bracket changed. Refresh and try again.', 409);
    const updated = await tx.bracket.update({ where: { id: bracket.id }, data: { publishedAt: input.published ? new Date() : null, publishedById: input.published ? input.actorId : null, version: { increment: 1 } }, include: bracketInclude });
    await writeAudit(tx, { action: input.published ? 'bracket.published' : 'bracket.unpublished', actorId: input.actorId, eventId: bracket.eventId, entityType: 'Bracket', entityId: bracket.id, after: { published: input.published } });
    await queueOutbox(tx, { topic: 'bracket.published', aggregateType: 'Bracket', aggregateId: bracket.id, payload: { eventId: bracket.eventId, bracketId: bracket.id, published: input.published, version: updated.version }, deduplicationKey: `bracket:${bracket.id}:publication:v${updated.version}` });
    const entries = await tx.eventRegistration.findMany({ where: { eventId: bracket.eventId, categoryId: bracket.categoryId, status: 'APPROVED' }, include: { owner: { select: entryUserSelect }, teammate: { select: entryUserSelect } } });
    if (input.published) await queueNotifications(tx, entries.flatMap((entry) => [entry.owner, entry.teammate].map((user) => ({ recipientUserId: user.id, recipientEmail: user.email, type: NotificationType.BRACKET_PUBLISHED, title: 'Bracket published', message: 'The tournament bracket is ready to view.', entityType: 'Bracket', entityId: bracket.id, eventId: bracket.eventId, actionPath: `/dashboard/events/${bracket.eventId}`, version: updated.version }))));
    await saveCommandReceipt(tx, { actorId: input.actorId, action: 'bracket.publish', commandId: input.commandId, hash });
    return updated;
  });
}

export async function listBrackets(eventId: string, publicOnly = false) {
  return prisma.bracket.findMany({ where: { eventId, ...(publicOnly ? { publishedAt: { not: null } } : {}) }, include: bracketInclude, orderBy: [{ categoryId: 'asc' }, { generation: 'desc' }] });
}
