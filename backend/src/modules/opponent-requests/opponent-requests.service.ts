import {
  NotificationType,
  OpponentRequestStatus,
  RegistrationStatus,
  UserStatus,
  type Prisma,
} from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';
import { jsonError } from '../../common/http.js';
import { findCommandReceipt, payloadHash, saveCommandReceipt } from '../../common/commands.js';
import { queueNotifications, queueOutbox, writeAudit } from '../../common/domain-events.js';
import { entryUserSelect } from '../../common/includes.js';

export const opponentRequestInclude = {
  requestingEntry: { include: { owner: { select: entryUserSelect }, teammate: { select: entryUserSelect }, category: true } },
  targetEntry: { include: { owner: { select: entryUserSelect }, teammate: { select: entryUserSelect }, category: true } },
} satisfies Prisma.OpponentRequestInclude;

type OpponentRequestGraph = Prisma.OpponentRequestGetPayload<{ include: typeof opponentRequestInclude }>;

function serializeRequestEntry(entry: OpponentRequestGraph['requestingEntry']) {
  const identity = (user: typeof entry.owner) => ({
    id: user.id,
    fullName: [user.name, user.surname].filter(Boolean).join(' ') || 'Player',
  });

  return {
    id: entry.id,
    eventId: entry.eventId,
    categoryId: entry.categoryId,
    status: entry.status,
    version: entry.version,
    category: {
      id: entry.category.id,
      name: entry.category.name,
      description: entry.category.description ?? '',
    },
    owner: identity(entry.owner),
    teammate: identity(entry.teammate),
  };
}

/** Allow-listed request DTO. Player responses never contain admin-only notes or user records. */
export function serializeOpponentRequest(request: OpponentRequestGraph, admin = false) {
  return {
    id: request.id,
    eventId: request.eventId,
    categoryId: request.categoryId,
    requestingEntryId: request.requestingEntryId,
    targetEntryId: request.targetEntryId,
    status: request.status,
    requestMessage: request.requestMessage,
    responseReason: request.responseReason,
    adminPublicReason: request.adminPublicReason,
    ...(admin ? { adminInternalNote: request.adminInternalNote } : {}),
    version: request.version,
    expiresAt: request.expiresAt?.toISOString() ?? null,
    createdAt: request.createdAt.toISOString(),
    requestingEntry: serializeRequestEntry(request.requestingEntry),
    targetEntry: serializeRequestEntry(request.targetEntry),
  };
}

export function serializeOpponentRequestWindow(window: Awaited<ReturnType<typeof listOpponentRequestWindows>>[number]) {
  return {
    eventId: window.eventId,
    categoryId: window.categoryId,
    opponentRequestsOpenedAt: window.opponentRequestsOpenedAt?.toISOString() ?? null,
    opponentRequestsClosedAt: window.opponentRequestsClosedAt?.toISOString() ?? null,
    opponentRequestDeadline: window.opponentRequestDeadline?.toISOString() ?? null,
    opponentRequestVersion: window.opponentRequestVersion,
    category: {
      id: window.category.id,
      name: window.category.name,
      description: window.category.description ?? '',
    },
  };
}

const activeStatuses = [
  OpponentRequestStatus.PENDING_RESPONSE,
  OpponentRequestStatus.ACCEPTED_BY_OPPONENT,
  OpponentRequestStatus.APPROVED_BY_ADMIN,
  OpponentRequestStatus.OVERRIDDEN_BY_ADMIN,
] as const;

/**
 * A pending opponent request auto-expires at its category's opponent-request
 * deadline. The outbox worker transitions rows whose `expiresAt <= now` to
 * EXPIRED, so this value MUST be persisted for the expiry workflow to run.
 * `null` means no deadline is configured and the request never auto-expires.
 */
export function resolveOpponentRequestExpiry(link: { opponentRequestDeadline: Date | null }) {
  return link.opponentRequestDeadline ?? null;
}

function canonicalPair(a: string, b: string) {
  return [a, b].sort().join(':');
}

export async function requireEntryContact(userId: string, entryId: string, eventId?: string) {
  const entry = await prisma.eventRegistration.findFirst({
    where: { id: entryId, ...(eventId ? { eventId } : {}), OR: [{ ownerId: userId }, { teammateId: userId }] },
    include: { owner: true, teammate: true, category: true, event: true },
  });
  if (!entry) jsonError('Entry not found.', 404);
  return entry;
}

async function requireOpenWindow(tx: Prisma.TransactionClient, eventId: string, categoryId: string) {
  const link = await tx.eventCategory.findUnique({ where: { eventId_categoryId: { eventId, categoryId } } });
  if (!link || !link.opponentRequestsOpenedAt || link.opponentRequestsClosedAt) jsonError('Opponent requests are not open.', 409);
  if (link.opponentRequestDeadline && link.opponentRequestDeadline < new Date()) jsonError('Opponent request period has ended.', 409);
  const bracket = await tx.bracket.findFirst({ where: { eventId, categoryId, status: { in: ['LOCKED', 'COMPLETED'] } } });
  if (bracket) jsonError('Bracket is locked.', 409);
  return link;
}

async function assertEligibleEntry(tx: Prisma.TransactionClient, entryId: string, eventId: string, categoryId: string) {
  const entry = await tx.eventRegistration.findFirst({
    where: { id: entryId, eventId, categoryId, status: RegistrationStatus.APPROVED },
    include: { owner: true, teammate: true },
  });
  if (!entry || entry.owner.status !== UserStatus.ACTIVE || entry.teammate.status !== UserStatus.ACTIVE) jsonError('Entry is not eligible.', 409);
  const now = Date.now();
  if ((entry.owner.disqualifiedUntil?.getTime() ?? 0) > now || (entry.teammate.disqualifiedUntil?.getTime() ?? 0) > now) jsonError('Entry is not eligible.', 409);
  return entry;
}

async function notifyEntry(
  tx: Prisma.TransactionClient,
  entry: Awaited<ReturnType<typeof assertEligibleEntry>>,
  input: { type: NotificationType; title: string; message: string; requestId: string; eventId: string; version: number },
) {
  await queueNotifications(tx, [entry.owner, entry.teammate].map((user) => ({
    recipientUserId: user.id,
    recipientEmail: user.email,
    type: input.type,
    title: input.title,
    message: input.message,
    entityType: 'OpponentRequest',
    entityId: input.requestId,
    eventId: input.eventId,
    actionPath: `/dashboard/events/${input.eventId}?request=${input.requestId}`,
    version: input.version,
  })));
}

export async function setOpponentRequestWindow(input: { eventId: string; categoryId: string; actorId: string; open: boolean; deadline?: Date; expectedVersion: number; commandId: string }) {
  const hash = payloadHash(input);
  return prisma.$transaction(async (tx) => {
    const replay = await findCommandReceipt(tx, input.actorId, `opponent.window.${input.open ? 'open' : 'close'}`, input.commandId, hash);
    if (replay) return tx.eventCategory.findUniqueOrThrow({ where: { eventId_categoryId: { eventId: input.eventId, categoryId: input.categoryId } } });
    const event = await tx.event.findUnique({ where: { id: input.eventId } });
    if (!event || event.status !== 'REGISTRATION_CLOSED') jsonError('Registration must be closed first.', 409);
    const link = await tx.eventCategory.findUnique({ where: { eventId_categoryId: { eventId: input.eventId, categoryId: input.categoryId } } });
    if (!link) jsonError('Event category not found.', 404);
    if (link.opponentRequestVersion !== input.expectedVersion) jsonError('Request window changed. Refresh and try again.', 409);
    const eligibleCount = await tx.eventRegistration.count({ where: { eventId: input.eventId, categoryId: input.categoryId, status: 'APPROVED' } });
    if (input.open && eligibleCount < 2) jsonError('At least two approved entries are required.', 409);
    const now = new Date();
    const updated = await tx.eventCategory.update({
      where: { eventId_categoryId: { eventId: input.eventId, categoryId: input.categoryId } },
      data: input.open
        ? { opponentRequestsOpenedAt: now, opponentRequestsClosedAt: null, opponentRequestDeadline: input.deadline, opponentRequestVersion: { increment: 1 } }
        : { opponentRequestsClosedAt: now, opponentRequestVersion: { increment: 1 } },
    });
    if (input.open) {
      // Keep pending requests' auto-expiry aligned with the (possibly changed) deadline.
      await tx.opponentRequest.updateMany({
        where: { eventId: input.eventId, categoryId: input.categoryId, status: OpponentRequestStatus.PENDING_RESPONSE },
        data: { expiresAt: input.deadline ?? null },
      });
    }
    await writeAudit(tx, { action: input.open ? 'opponent-request.window.opened' : 'opponent-request.window.closed', actorId: input.actorId, eventId: input.eventId, entityType: 'EventCategory', entityId: input.categoryId, after: { open: input.open, deadline: input.deadline?.toISOString() } });
    await queueOutbox(tx, { topic: 'opponent-request.window.updated', aggregateType: 'EventCategory', aggregateId: input.categoryId, payload: { eventId: input.eventId, categoryId: input.categoryId, open: input.open, version: updated.opponentRequestVersion }, deduplicationKey: `opponent-window:${input.eventId}:${input.categoryId}:v${updated.opponentRequestVersion}` });
    await saveCommandReceipt(tx, { actorId: input.actorId, action: `opponent.window.${input.open ? 'open' : 'close'}`, commandId: input.commandId, hash });
    return updated;
  });
}

export async function listEligibleOpponents(userId: string, eventId: string, requestingEntryId: string) {
  const own = await requireEntryContact(userId, requestingEntryId, eventId);
  if (own.status !== RegistrationStatus.APPROVED) jsonError('Entry is not approved.', 409);
  await requireOpenWindow(prisma as unknown as Prisma.TransactionClient, eventId, own.categoryId);
  const entries = await prisma.eventRegistration.findMany({
    where: { eventId, categoryId: own.categoryId, status: RegistrationStatus.APPROVED, id: { not: own.id } },
    include: { owner: true, teammate: true },
    orderBy: { createdAt: 'asc' },
  });
  return entries.map((entry) => ({ id: entry.id, owner: { id: entry.owner.id, fullName: [entry.owner.name, entry.owner.surname].filter(Boolean).join(' ') || entry.owner.email }, teammate: { id: entry.teammate.id, fullName: [entry.teammate.name, entry.teammate.surname].filter(Boolean).join(' ') || entry.teammate.email } }));
}

export async function createOpponentRequest(input: { userId: string; eventId: string; requestingEntryId: string; targetEntryId: string; message?: string; commandId: string }) {
  if (input.requestingEntryId === input.targetEntryId) jsonError('An entry cannot request itself.');
  const own = await requireEntryContact(input.userId, input.requestingEntryId, input.eventId);
  const hash = payloadHash(input);
  return prisma.$transaction(async (tx) => {
    const replay = await findCommandReceipt(tx, input.userId, 'opponent.create', input.commandId, hash);
    if (replay) return tx.opponentRequest.findFirstOrThrow({ where: { requestingEntryId: input.requestingEntryId, canonicalPairKey: canonicalPair(input.requestingEntryId, input.targetEntryId) }, include: opponentRequestInclude });
    const link = await requireOpenWindow(tx, input.eventId, own.categoryId);
    const requester = await assertEligibleEntry(tx, own.id, input.eventId, own.categoryId);
    const target = await assertEligibleEntry(tx, input.targetEntryId, input.eventId, own.categoryId);
    const pairKey = canonicalPair(requester.id, target.id);
    const existingPair = await tx.opponentRequest.findFirst({ where: { eventId: input.eventId, categoryId: own.categoryId, canonicalPairKey: pairKey, status: { in: [...activeStatuses] } }, include: opponentRequestInclude });
    if (existingPair) return existingPair;
    const outgoing = await tx.opponentRequest.findFirst({ where: { requestingEntryId: requester.id, status: { in: [...activeStatuses] } } });
    if (outgoing) jsonError('This entry already has an active opponent request.', 409);
    // Pending requests auto-expire at the category's opponent-request deadline so the
    // outbox worker can transition them to EXPIRED (see workers/outbox.worker expireOpponentRequests).
    const request = await tx.opponentRequest.create({ data: { eventId: input.eventId, categoryId: own.categoryId, requestingEntryId: requester.id, targetEntryId: target.id, requestedByUserId: input.userId, requestMessage: input.message || null, canonicalPairKey: pairKey, expiresAt: resolveOpponentRequestExpiry(link) }, include: opponentRequestInclude });
    await notifyEntry(tx, target, { type: NotificationType.OPPONENT_REQUEST_CREATED, title: 'Opponent request received', message: `${requester.owner.name ?? requester.owner.email} and their teammate requested your entry.`, requestId: request.id, eventId: input.eventId, version: request.version });
    await writeAudit(tx, { action: 'opponent-request.created', actorId: input.userId, eventId: input.eventId, entityType: 'OpponentRequest', entityId: request.id, after: { requestingEntryId: requester.id, targetEntryId: target.id, status: request.status } });
    await queueOutbox(tx, { topic: 'opponent-request.created', aggregateType: 'OpponentRequest', aggregateId: request.id, payload: { eventId: input.eventId, requestId: request.id, version: request.version }, deduplicationKey: `opponent:${request.id}:created:v${request.version}` });
    await saveCommandReceipt(tx, { actorId: input.userId, action: 'opponent.create', commandId: input.commandId, hash, response: { requestId: request.id } });
    return request;
  });
}

export async function updateOpponentRequest(input: { userId: string; eventId: string; requestId: string; targetEntryId: string; message?: string; expectedVersion: number; commandId: string }) {
  const hash = payloadHash(input);
  return prisma.$transaction(async (tx) => {
    const replay = await findCommandReceipt(tx, input.userId, 'opponent.update', input.commandId, hash);
    if (replay) return tx.opponentRequest.findUniqueOrThrow({ where: { id: input.requestId }, include: opponentRequestInclude });
    const request = await tx.opponentRequest.findFirst({ where: { id: input.requestId, eventId: input.eventId }, include: opponentRequestInclude });
    if (!request || (request.requestingEntry.ownerId !== input.userId && request.requestingEntry.teammateId !== input.userId)) jsonError('Opponent request not found.', 404);
    if (request.status !== OpponentRequestStatus.PENDING_RESPONSE || request.version !== input.expectedVersion) jsonError('Request can no longer be changed.', 409);
    if (request.requestingEntryId === input.targetEntryId) jsonError('An entry cannot request itself.');
    const link = await requireOpenWindow(tx, request.eventId, request.categoryId);
    const target = await assertEligibleEntry(tx, input.targetEntryId, request.eventId, request.categoryId);
    const updated = await tx.opponentRequest.update({ where: { id: request.id }, data: { targetEntryId: target.id, canonicalPairKey: canonicalPair(request.requestingEntryId, target.id), requestMessage: input.message || null, responseReason: null, expiresAt: resolveOpponentRequestExpiry(link), version: { increment: 1 } }, include: opponentRequestInclude });
    await notifyEntry(tx, target, { type: NotificationType.OPPONENT_REQUEST_CREATED, title: 'Opponent request received', message: 'An approved entry selected your team as a requested opponent.', requestId: request.id, eventId: request.eventId, version: updated.version });
    await writeAudit(tx, { action: 'opponent-request.updated', actorId: input.userId, eventId: request.eventId, entityType: 'OpponentRequest', entityId: request.id, before: { targetEntryId: request.targetEntryId }, after: { targetEntryId: target.id } });
    await queueOutbox(tx, { topic: 'opponent-request.updated', aggregateType: 'OpponentRequest', aggregateId: request.id, payload: { eventId: request.eventId, requestId: request.id, version: updated.version }, deduplicationKey: `opponent:${request.id}:updated:v${updated.version}` });
    await saveCommandReceipt(tx, { actorId: input.userId, action: 'opponent.update', commandId: input.commandId, hash });
    return updated;
  });
}

export async function respondToOpponentRequest(input: { userId: string; eventId: string; requestId: string; accept: boolean; reason?: string; expectedVersion: number; commandId: string }) {
  const hash = payloadHash(input);
  return prisma.$transaction(async (tx) => {
    const action = input.accept ? 'opponent.accept' : 'opponent.refuse';
    const replay = await findCommandReceipt(tx, input.userId, action, input.commandId, hash);
    if (replay) return tx.opponentRequest.findUniqueOrThrow({ where: { id: input.requestId }, include: opponentRequestInclude });
    const request = await tx.opponentRequest.findFirst({ where: { id: input.requestId, eventId: input.eventId }, include: opponentRequestInclude });
    if (!request) jsonError('Opponent request not found.', 404);
    if (request.targetEntry.ownerId !== input.userId && request.targetEntry.teammateId !== input.userId) jsonError('Opponent request not found.', 404);
    await requireOpenWindow(tx, input.eventId, request.categoryId);
    if (request.status !== OpponentRequestStatus.PENDING_RESPONSE) jsonError('Request has already been answered.', 409);
    if (request.version !== input.expectedVersion) jsonError('Request changed. Refresh and try again.', 409);
    const nextStatus = input.accept ? OpponentRequestStatus.ACCEPTED_BY_OPPONENT : OpponentRequestStatus.REFUSED_BY_OPPONENT;
    const updated = await tx.opponentRequest.update({ where: { id: request.id }, data: { status: nextStatus, responseReason: input.reason || null, respondedByUserId: input.userId, respondedAt: new Date(), version: { increment: 1 } }, include: opponentRequestInclude });
    if (input.accept) {
      await tx.opponentRequest.updateMany({ where: { id: { not: request.id }, status: OpponentRequestStatus.PENDING_RESPONSE, OR: [{ requestingEntryId: request.targetEntryId }, { targetEntryId: request.targetEntryId }] }, data: { status: OpponentRequestStatus.CONFLICTED, version: { increment: 1 } } });
    }
    const requester = await assertEligibleEntry(tx, request.requestingEntryId, request.eventId, request.categoryId);
    await notifyEntry(tx, requester, { type: input.accept ? NotificationType.OPPONENT_REQUEST_ACCEPTED : NotificationType.OPPONENT_REQUEST_REFUSED, title: input.accept ? 'Opponent request accepted' : 'Opponent request refused', message: input.accept ? 'The requested entry accepted. Admin approval is still required.' : `The requested entry refused.${input.reason ? ` ${input.reason}` : ''}`, requestId: request.id, eventId: request.eventId, version: updated.version });
    await writeAudit(tx, { action: input.accept ? 'opponent-request.accepted' : 'opponent-request.refused', actorId: input.userId, eventId: request.eventId, entityType: 'OpponentRequest', entityId: request.id, before: { status: request.status }, after: { status: nextStatus }, publicReason: input.reason });
    await queueOutbox(tx, { topic: input.accept ? 'opponent-request.accepted' : 'opponent-request.refused', aggregateType: 'OpponentRequest', aggregateId: request.id, payload: { eventId: request.eventId, requestId: request.id, status: nextStatus, version: updated.version }, deduplicationKey: `opponent:${request.id}:${nextStatus}:v${updated.version}` });
    await saveCommandReceipt(tx, { actorId: input.userId, action, commandId: input.commandId, hash, response: { requestId: request.id, version: updated.version } });
    return updated;
  });
}

export async function withdrawOpponentRequest(input: { userId: string; eventId: string; requestId: string; expectedVersion: number; commandId: string }) {
  const hash = payloadHash(input);
  return prisma.$transaction(async (tx) => {
    const replay = await findCommandReceipt(tx, input.userId, 'opponent.withdraw', input.commandId, hash);
    if (replay) return tx.opponentRequest.findUniqueOrThrow({ where: { id: input.requestId }, include: opponentRequestInclude });
    const request = await tx.opponentRequest.findFirst({ where: { id: input.requestId, eventId: input.eventId }, include: opponentRequestInclude });
    if (!request || (request.requestingEntry.ownerId !== input.userId && request.requestingEntry.teammateId !== input.userId)) jsonError('Opponent request not found.', 404);
    await requireOpenWindow(tx, request.eventId, request.categoryId);
    if (request.status !== OpponentRequestStatus.PENDING_RESPONSE && request.status !== OpponentRequestStatus.ACCEPTED_BY_OPPONENT) jsonError('Request can no longer be withdrawn.', 409);
    if (request.version !== input.expectedVersion) jsonError('Request changed. Refresh and try again.', 409);
    const updated = await tx.opponentRequest.update({ where: { id: request.id }, data: { status: OpponentRequestStatus.WITHDRAWN_BY_REQUESTER, version: { increment: 1 } }, include: opponentRequestInclude });
    const target = await assertEligibleEntry(tx, request.targetEntryId, request.eventId, request.categoryId);
    await notifyEntry(tx, target, { type: NotificationType.OPPONENT_REQUEST_WITHDRAWN, title: 'Opponent request withdrawn', message: 'The requesting entry withdrew its opponent request.', requestId: request.id, eventId: request.eventId, version: updated.version });
    await writeAudit(tx, { action: 'opponent-request.withdrawn', actorId: input.userId, eventId: request.eventId, entityType: 'OpponentRequest', entityId: request.id, before: { status: request.status }, after: { status: updated.status } });
    await queueOutbox(tx, { topic: 'opponent-request.withdrawn', aggregateType: 'OpponentRequest', aggregateId: request.id, payload: { eventId: request.eventId, requestId: request.id, version: updated.version }, deduplicationKey: `opponent:${request.id}:withdrawn:v${updated.version}` });
    await saveCommandReceipt(tx, { actorId: input.userId, action: 'opponent.withdraw', commandId: input.commandId, hash });
    return updated;
  });
}

export async function decideOpponentRequest(input: { actorId: string; eventId: string; requestId: string; decision: 'approve' | 'reject' | 'override'; publicReason?: string; internalNote?: string; expectedVersion: number; commandId: string }) {
  const hash = payloadHash(input);
  return prisma.$transaction(async (tx) => {
    const action = `opponent.admin.${input.decision}`;
    const replay = await findCommandReceipt(tx, input.actorId, action, input.commandId, hash);
    if (replay) return tx.opponentRequest.findUniqueOrThrow({ where: { id: input.requestId }, include: opponentRequestInclude });
    const request = await tx.opponentRequest.findFirst({ where: { id: input.requestId, eventId: input.eventId }, include: opponentRequestInclude });
    if (!request) jsonError('Opponent request not found.', 404);
    const event = await tx.event.findUnique({ where: { id: input.eventId }, select: { status: true } });
    if (event?.status === 'COMPLETED') jsonError('Reopen the completed event before changing opponent requests.', 409);
    if (request.version !== input.expectedVersion) jsonError('Request changed. Refresh and try again.', 409);
    if (input.decision === 'approve' && request.status !== OpponentRequestStatus.ACCEPTED_BY_OPPONENT) jsonError('Only an accepted request can be approved.', 409);
    if (input.decision === 'override' && request.status !== OpponentRequestStatus.REFUSED_BY_OPPONENT) jsonError('Only a refused request can be overridden.', 409);
    if ((input.decision === 'reject' || input.decision === 'override') && !input.publicReason?.trim()) jsonError('A public reason is required.');
    await assertEligibleEntry(tx, request.requestingEntryId, request.eventId, request.categoryId);
    await assertEligibleEntry(tx, request.targetEntryId, request.eventId, request.categoryId);
    const status = input.decision === 'approve' ? OpponentRequestStatus.APPROVED_BY_ADMIN : input.decision === 'override' ? OpponentRequestStatus.OVERRIDDEN_BY_ADMIN : OpponentRequestStatus.REJECTED_BY_ADMIN;
    const updated = await tx.opponentRequest.update({ where: { id: request.id }, data: { status, adminDecisionByUserId: input.actorId, adminDecisionAt: new Date(), adminPublicReason: input.publicReason || null, adminInternalNote: input.internalNote || null, version: { increment: 1 } }, include: opponentRequestInclude });
    const type = input.decision === 'approve' ? NotificationType.OPPONENT_REQUEST_APPROVED_BY_ADMIN : input.decision === 'override' ? NotificationType.OPPONENT_REQUEST_OVERRIDDEN_BY_ADMIN : NotificationType.OPPONENT_REQUEST_REJECTED_BY_ADMIN;
    const entries = [await assertEligibleEntry(tx, request.requestingEntryId, request.eventId, request.categoryId), await assertEligibleEntry(tx, request.targetEntryId, request.eventId, request.categoryId)];
    for (const entry of entries) await notifyEntry(tx, entry, { type, title: input.decision === 'override' ? 'Admin approved a refused pairing' : `Opponent request ${input.decision}d`, message: `${input.decision === 'override' ? 'Admin reviewed the refusal and approved the pairing.' : `Admin ${input.decision}d the pairing.`}${input.publicReason ? ` ${input.publicReason}` : ''}`, requestId: request.id, eventId: request.eventId, version: updated.version });
    await writeAudit(tx, { action, actorId: input.actorId, eventId: request.eventId, entityType: 'OpponentRequest', entityId: request.id, before: { status: request.status }, after: { status }, publicReason: input.publicReason, internalReason: input.internalNote });
    await queueOutbox(tx, { topic: `opponent-request.admin-${input.decision}`, aggregateType: 'OpponentRequest', aggregateId: request.id, payload: { eventId: request.eventId, requestId: request.id, status, version: updated.version }, deduplicationKey: `opponent:${request.id}:${status}:v${updated.version}` });
    await saveCommandReceipt(tx, { actorId: input.actorId, action, commandId: input.commandId, hash });
    return updated;
  });
}

export async function listOpponentRequests(eventId: string, userId?: string) {
  return prisma.opponentRequest.findMany({
    where: { eventId, ...(userId ? { OR: [{ requestingEntry: { OR: [{ ownerId: userId }, { teammateId: userId }] } }, { targetEntry: { OR: [{ ownerId: userId }, { teammateId: userId }] } }] } : {}) },
    include: opponentRequestInclude,
    orderBy: { createdAt: 'desc' },
  });
}

export async function listOpponentRequestWindows(eventId: string) {
  return prisma.eventCategory.findMany({ where: { eventId }, include: { category: true }, orderBy: { category: { name: 'asc' } } });
}
