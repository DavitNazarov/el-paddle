import os from 'os';
import { DeliveryStatus, NotificationType, OpponentRequestStatus, OutboxStatus, type Prisma } from '../generated/prisma/client.js';
import { prisma } from '../database/prisma.js';
import { appUrl, emailButton, emailLayout, escapeHtml, sendEmail } from '../common/email.js';
import { emitToRoom } from '../realtime/socket.js';
import { queueNotification, queueOutbox, writeAudit } from '../common/domain-events.js';

const workerId = `${os.hostname()}:${process.pid}`;
let timer: NodeJS.Timeout | null = null;

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

function emitOutbox(topic: string, payload: Prisma.JsonValue) {
  const value = payload as Record<string, unknown>;
  if (typeof value.recipientUserId === 'string') emitToRoom(`user:${value.recipientUserId}`, topic, value);
  if (typeof value.eventId === 'string') emitToRoom(`event:${value.eventId}`, topic, value);
  if (typeof value.matchId === 'string') emitToRoom(`match:${value.matchId}`, topic, value);
  if (typeof value.courtId === 'string') emitToRoom(`court:${value.courtId}`, topic, value);
  emitToRoom('admins', topic, value);
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

export async function processOutboxBatch(limit = 25, options: ProcessOutboxOptions = {}) {
  const mode = options.mode ?? 'all';
  if (options.expireOpponentRequests ?? true) await expireOpponentRequests();
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

async function expireOpponentRequests() {
  const expired = await prisma.opponentRequest.findMany({ where: { status: OpponentRequestStatus.PENDING_RESPONSE, expiresAt: { lte: new Date() } }, include: { requestingEntry: { include: { owner: true, teammate: true } }, targetEntry: { include: { owner: true, teammate: true } } }, take: 50 });
  for (const request of expired) {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.opponentRequest.updateMany({ where: { id: request.id, status: OpponentRequestStatus.PENDING_RESPONSE, version: request.version }, data: { status: OpponentRequestStatus.EXPIRED, version: { increment: 1 } } });
      if (!updated.count) return;
      for (const entry of [request.requestingEntry, request.targetEntry]) for (const user of [entry.owner, entry.teammate]) await queueNotification(tx, { recipientUserId: user.id, recipientEmail: user.email, type: NotificationType.OPPONENT_REQUEST_EXPIRED, title: 'Opponent request expired', message: 'The opponent request deadline passed without a response.', entityType: 'OpponentRequest', entityId: request.id, eventId: request.eventId, actionPath: `/dashboard/events/${request.eventId}`, version: request.version + 1 });
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

export function stopOutboxWorker() {
  if (timer) clearTimeout(timer);
  timer = null;
}
