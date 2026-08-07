import os from 'os';
import { DeliveryStatus, NotificationType, OpponentRequestStatus, OutboxStatus, type Prisma } from '../generated/prisma/client.js';
import { prisma } from '../database/prisma.js';
import { appUrl, emailButton, emailLayout, escapeHtml, sendEmail } from '../common/email.js';
import { emitToRoom, eventRoom, eventStaffRoom } from '../realtime/socket.js';
import { queueNotifications, queueOutbox, writeAudit } from '../common/domain-events.js';

const workerId = `${os.hostname()}:${process.pid}`;
let timer: NodeJS.Timeout | null = null;

/** How often the background loop purges expired auth/command bookkeeping rows. */
const RETENTION_CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;
let lastRetentionCleanupAt = 0;

type OutboxMode = 'all' | 'email' | 'realtime';

type ProcessOutboxOptions = {
  mode?: OutboxMode;
  expireOpponentRequests?: boolean;
};

async function sendQueuedEmail(notificationId: string) {
  const delivery = await prisma.emailDelivery.findFirst({ where: { notificationId, status: { in: [DeliveryStatus.QUEUED, DeliveryStatus.FAILED] }, nextAttemptAt: { lte: new Date() } } });
  if (!delivery) return;
  await prisma.emailDelivery.update({ where: { id: delivery.id }, data: { status: DeliveryStatus.PROCESSING, attemptCount: { increment: 1 } } });
  const payload = delivery.payload as {
    title?: string;
    message?: string;
    actionPath?: string;
    emailEyebrow?: string;
    emailActionLabel?: string;
  };
  try {
    const title = payload.title ?? 'El Padel update';
    const message = payload.message ?? '';
    const actionUrl = appUrl(payload.actionPath?.startsWith('/') ? payload.actionPath : '/dashboard');
    await sendEmail({
      to: delivery.recipientEmail,
      subject: title,
      text: `${title}\n\n${message}\n\nView details: ${actionUrl}`,
      html: emailLayout(
        title,
        `<p style="margin:0">${escapeHtml(message)}</p>${emailButton(payload.emailActionLabel ?? 'View details', actionUrl)}`,
        { eyebrow: payload.emailEyebrow ?? 'Tournament update', preheader: message || title },
      ),
    });
    await prisma.emailDelivery.update({ where: { id: delivery.id }, data: { status: DeliveryStatus.SENT, sentAt: new Date(), lastError: null } });
  } catch (error) {
    const attempt = delivery.attemptCount + 1;
    const permanent = attempt >= 8;
    const delay = Math.min(6 * 60 * 60 * 1000, 60_000 * 2 ** Math.max(attempt - 1, 0));
    await prisma.emailDelivery.update({ where: { id: delivery.id }, data: { status: DeliveryStatus.FAILED, lastError: error instanceof Error ? error.message.slice(0, 500) : 'Unknown delivery error', failedAt: permanent ? new Date() : null, nextAttemptAt: new Date(Date.now() + delay) } });
    if (!permanent) throw error;
  }
}

type Emission = { room: string; payload: Record<string, unknown> };

/**
 * Fan one outbox row out to the rooms that should hear it.
 *
 * `event:<id>` is joinable by an anonymous socket on any published event, which
 * is a far coarser gate than the REST reads: those check bracket and schedule
 * publication, `publicLiveScoringEnabled` and `resultsPublishedAt` per match.
 * Broadcasting the raw payload there therefore leaked live scores, winners and
 * registration decisions ahead of publication. The room now hears the topic
 * with the payload stripped to the event id; every score, winner and decision
 * field rides only in the authenticated staff room.
 *
 * This costs the public UI nothing: consumers treat a topic purely as an
 * invalidation signal and refetch the authoritative record through the API,
 * which applies the publication and redaction rules the socket cannot.
 */
export function outboxEmissions(topic: string, payload: Prisma.JsonValue): Emission[] {
  const value = payload as Record<string, unknown>;
  const emissions: Emission[] = [];
  if (typeof value.recipientUserId === 'string') emissions.push({ room: `user:${value.recipientUserId}`, payload: value });
  if (typeof value.eventId === 'string') {
    emissions.push({ room: eventStaffRoom(value.eventId), payload: value });
    emissions.push({ room: eventRoom(value.eventId), payload: { eventId: value.eventId } });
  }
  if (typeof value.matchId === 'string') emissions.push({ room: `match:${value.matchId}`, payload: value });
  if (typeof value.courtId === 'string') emissions.push({ room: `court:${value.courtId}`, payload: value });
  // The admin room mirrors operational activity. It used to mirror personal
  // topics too, so every admin socket received other people's notifications —
  // authorized, since an admin can read them anyway, but a copy of someone
  // else's inbox is not what this room is for. An admin's own notifications
  // still arrive on their `user:<id>` room.
  if (typeof value.recipientUserId !== 'string') emissions.push({ room: 'admins', payload: value });
  return emissions;
}

function emitOutbox(topic: string, payload: Prisma.JsonValue) {
  for (const { room, payload: body } of outboxEmissions(topic, payload)) emitToRoom(room, topic, body);
}

function outboxWhere(mode: OutboxMode): Prisma.OutboxMessageWhereInput {
  const base: Prisma.OutboxMessageWhereInput = {
    status: { in: [OutboxStatus.PENDING, OutboxStatus.FAILED] },
    availableAt: { lte: new Date() },
  };
  if (mode === 'email') return { ...base, topic: 'email.send' };
  if (mode === 'realtime') return { ...base, topic: { not: 'email.send' } };
  return base;
}

/**
 * Delete bookkeeping rows that are safe to forget: command receipts past their
 * TTL, plus consumed or expired email-verification codes and invite tokens.
 * Without this these tables grow monotonically (DB-1).
 */
export async function runRetentionCleanup(now = new Date()) {
  const [commandReceipts, verificationCodes, inviteTokens, passwordResets, sessions] = await prisma.$transaction([
    prisma.commandReceipt.deleteMany({ where: { expiresAt: { lt: now } } }),
    prisma.emailVerificationCode.deleteMany({ where: { OR: [{ expiresAt: { lt: now } }, { usedAt: { not: null } }] } }),
    prisma.inviteToken.deleteMany({ where: { OR: [{ expiresAt: { lt: now } }, { usedAt: { not: null } }] } }),
    prisma.passwordResetToken.deleteMany({ where: { OR: [{ expiresAt: { lt: now } }, { usedAt: { not: null } }] } }),
    // A session row outlives nothing once its token has expired: the JWT is
    // already unusable, and the row only existed to make revocation possible.
    prisma.session.deleteMany({ where: { expiresAt: { lt: now } } }),
  ]);
  return {
    commandReceipts: commandReceipts.count,
    verificationCodes: verificationCodes.count,
    inviteTokens: inviteTokens.count,
    passwordResets: passwordResets.count,
    sessions: sessions.count,
  };
}

async function runRetentionCleanupIfDue() {
  const now = Date.now();
  if (now - lastRetentionCleanupAt < RETENTION_CLEANUP_INTERVAL_MS) return;
  lastRetentionCleanupAt = now;
  try {
    await runRetentionCleanup(new Date(now));
  } catch (error) {
    console.error('[retention]', error);
  }
}

export async function processOutboxBatch(limit = 25, options: ProcessOutboxOptions = {}) {
  const mode = options.mode ?? 'all';
  // Retention cleanup is throttled internally and pinned to the same process that
  // owns opponent-request expiry, so it runs in exactly one place per deployment.
  if (options.expireOpponentRequests ?? true) {
    await expireOpponentRequests();
    await runRetentionCleanupIfDue();
  }
  await prisma.outboxMessage.updateMany({ where: { status: OutboxStatus.PROCESSING, lockedAt: { lt: new Date(Date.now() - 5 * 60_000) } }, data: { status: OutboxStatus.FAILED, lockedAt: null, lockedBy: null, availableAt: new Date(), lastError: 'Recovered expired worker lease.' } });
  const rows = await prisma.outboxMessage.findMany({ where: outboxWhere(mode), orderBy: { createdAt: 'asc' }, take: limit });
  for (const row of rows) {
    const claimed = await prisma.outboxMessage.updateMany({ where: { id: row.id, status: row.status }, data: { status: OutboxStatus.PROCESSING, lockedAt: new Date(), lockedBy: workerId, attemptCount: { increment: 1 } } });
    if (!claimed.count) continue;
    try {
      if (row.topic === 'email.send') {
        const payload = row.payload as { notificationId?: string };
        if (payload.notificationId) await sendQueuedEmail(payload.notificationId);
      } else {
        emitOutbox(row.topic, row.payload);
      }
      await prisma.outboxMessage.update({ where: { id: row.id }, data: { status: OutboxStatus.PROCESSED, processedAt: new Date(), lockedAt: null, lockedBy: null, lastError: null } });
    } catch (error) {
      const delay = Math.min(6 * 60 * 60 * 1000, 60_000 * 2 ** Math.max(row.attemptCount, 0));
      await prisma.outboxMessage.update({ where: { id: row.id }, data: { status: OutboxStatus.FAILED, availableAt: new Date(Date.now() + delay), lockedAt: null, lockedBy: null, lastError: error instanceof Error ? error.message.slice(0, 500) : 'Worker error' } });
    }
  }
  return rows.length;
}

export async function expireOpponentRequests() {
  const expired = await prisma.opponentRequest.findMany({ where: { status: OpponentRequestStatus.PENDING_RESPONSE, expiresAt: { lte: new Date() } }, include: { requestingEntry: { include: { owner: true, teammate: true } }, targetEntry: { include: { owner: true, teammate: true } } }, take: 50 });
  for (const request of expired) {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.opponentRequest.updateMany({ where: { id: request.id, status: OpponentRequestStatus.PENDING_RESPONSE, version: request.version }, data: { status: OpponentRequestStatus.EXPIRED, version: { increment: 1 } } });
      if (!updated.count) return;
      await queueNotifications(tx, [request.requestingEntry, request.targetEntry].flatMap((entry) => [entry.owner, entry.teammate].map((user) => ({ recipientUserId: user.id, recipientEmail: user.email, type: NotificationType.OPPONENT_REQUEST_EXPIRED, title: 'Opponent request expired', message: 'The opponent request deadline passed without a response.', entityType: 'OpponentRequest', entityId: request.id, eventId: request.eventId, actionPath: `/dashboard/events/${request.eventId}`, version: request.version + 1 }))));
      await writeAudit(tx, { action: 'opponent-request.expired', eventId: request.eventId, entityType: 'OpponentRequest', entityId: request.id, before: { status: request.status }, after: { status: OpponentRequestStatus.EXPIRED } });
      await queueOutbox(tx, { topic: 'opponent-request.expired', aggregateType: 'OpponentRequest', aggregateId: request.id, payload: { eventId: request.eventId, requestId: request.id, version: request.version + 1 }, deduplicationKey: `opponent:${request.id}:expired:v${request.version + 1}` });
    });
  }
}

export function startOutboxWorker(options: ProcessOutboxOptions = {}) {
  if (timer) return;
  const tick = async () => {
    await processOutboxBatch(25, options).catch((error) => console.error('[outbox]', error));
    timer = setTimeout(tick, 2_000);
  };
  void tick();
}
