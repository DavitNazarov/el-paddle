import { Router } from 'express';
import { Capability, DeliveryStatus, OutboxStatus } from '../../generated/prisma/client.js';
import { requireCapability } from '../../common/capabilities.js';
import { asyncHandler, cleanString, jsonError, requireParamId } from '../../common/http.js';
import { csvFilename, sendCsv, wantsCsv } from '../../common/csv.js';
import { prisma } from '../../database/prisma.js';

export const operationsRouter = Router();

operationsRouter.get('/api/admin/audit', asyncHandler(async (request, response) => {
  await requireCapability(request, Capability.AUDIT_READ);
  const eventId = cleanString(request.query.eventId);
  const action = cleanString(request.query.action);
  const logs = await prisma.auditLog.findMany({ where: { ...(eventId ? { eventId } : {}), ...(action ? { action: { contains: action } } : {}) }, orderBy: { createdAt: 'desc' }, take: Math.min(Number(request.query.take) || 100, 250) });
  if (wantsCsv(request)) {
    sendCsv(
      response,
      csvFilename('audit', eventId || action || 'all'),
      ['When', 'Action', 'Actor', 'Event', 'Entity', 'Entity ID', 'Public reason', 'IP'],
      logs.map((log) => [
        log.createdAt.toISOString(),
        log.action,
        log.actorId ?? '',
        log.eventId ?? '',
        log.entityType,
        log.entityId,
        log.publicReason ?? '',
        log.ip ?? '',
      ]),
    );
    return;
  }
  response.json({ logs });
}));

/**
 * The transactional outbox, which is what actually carries every notification,
 * every email and every realtime topic out of the transaction that wrote them.
 *
 * Email deliveries have had a monitor and a retry since they existed; the queue
 * they ride on has had neither, so a message stuck in FAILED was invisible — the
 * event simply never reached anyone, and nothing on any screen said so. The
 * summary is deliberately first: the question is "is anything stuck", and a page
 * of rows answers it slower than a count does.
 */
operationsRouter.get('/api/admin/outbox', asyncHandler(async (request, response) => {
  await requireCapability(request, Capability.DELIVERY_MONITOR);
  const status = cleanString(request.query.status).toUpperCase() as OutboxStatus;
  const topic = cleanString(request.query.topic);

  const [counts, oldestPending, messages] = await Promise.all([
    prisma.outboxMessage.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.outboxMessage.findFirst({
      where: { status: OutboxStatus.PENDING },
      orderBy: { availableAt: 'asc' },
      select: { availableAt: true },
    }),
    prisma.outboxMessage.findMany({
      where: {
        ...(Object.values(OutboxStatus).includes(status) ? { status } : {}),
        ...(topic ? { topic: { contains: topic } } : {}),
      },
      // Failures first, then the oldest work: both orderings answer "what is
      // stuck", and neither is the plain insert order a queue is written in.
      orderBy: [{ status: 'desc' }, { createdAt: 'asc' }],
      take: Math.min(Number(request.query.take) || 100, 250),
      select: {
        id: true, topic: true, aggregateType: true, aggregateId: true, status: true,
        attemptCount: true, availableAt: true, processedAt: true, lastError: true, createdAt: true,
      },
    }),
  ]);

  const countOf = (value: OutboxStatus) =>
    counts.find((row) => row.status === value)?._count._all ?? 0;

  response.json({
    summary: {
      pending: countOf(OutboxStatus.PENDING),
      processing: countOf(OutboxStatus.PROCESSING),
      processed: countOf(OutboxStatus.PROCESSED),
      failed: countOf(OutboxStatus.FAILED),
      oldestPendingAt: oldestPending?.availableAt?.toISOString() ?? null,
    },
    messages,
  });
}));

operationsRouter.post('/api/admin/outbox/:id/retry', asyncHandler(async (request, response) => {
  await requireCapability(request, Capability.DELIVERY_MONITOR);
  const message = await prisma.outboxMessage.findUnique({ where: { id: requireParamId(request.params.id) } });
  if (!message) jsonError('Outbox message not found.', 404);
  if (message.status === OutboxStatus.PROCESSED) jsonError('This message was already delivered.', 409);
  if (message.status === OutboxStatus.PROCESSING) {
    jsonError('A worker holds this message right now. Try again once it releases.', 409);
  }
  const retried = await prisma.outboxMessage.update({
    where: { id: message.id },
    data: { status: OutboxStatus.PENDING, availableAt: new Date(), lockedAt: null, lockedBy: null, lastError: null },
    select: { id: true, topic: true, status: true, attemptCount: true },
  });
  response.json({ message: retried });
}));

operationsRouter.get('/api/admin/notifications/email-deliveries', asyncHandler(async (request, response) => {
  await requireCapability(request, Capability.DELIVERY_MONITOR);
  const status = cleanString(request.query.status).toUpperCase() as DeliveryStatus;
  const deliveries = await prisma.emailDelivery.findMany({ where: Object.values(DeliveryStatus).includes(status) ? { status } : {}, orderBy: { createdAt: 'desc' }, take: Math.min(Number(request.query.take) || 100, 250), select: { id: true, recipientEmail: true, template: true, status: true, attemptCount: true, lastError: true, queuedAt: true, sentAt: true, failedAt: true, notificationId: true } });
  response.json({ deliveries });
}));

operationsRouter.post('/api/admin/notifications/email-deliveries/:id/retry', asyncHandler(async (request, response) => {
  await requireCapability(request, Capability.DELIVERY_MONITOR);
  const delivery = await prisma.emailDelivery.findUnique({ where: { id: requireParamId(request.params.id) } });
  if (!delivery) jsonError('Delivery not found.', 404);
  if (delivery.status === DeliveryStatus.SENT) jsonError('Sent deliveries cannot be retried.', 409);
  await prisma.$transaction(async (tx) => {
    await tx.emailDelivery.update({ where: { id: delivery.id }, data: { status: DeliveryStatus.QUEUED, nextAttemptAt: new Date(), failedAt: null, lastError: null } });
    await tx.outboxMessage.upsert({ where: { deduplicationKey: `email-retry:${delivery.id}:${delivery.attemptCount}` }, update: { status: OutboxStatus.PENDING, availableAt: new Date() }, create: { topic: 'email.send', aggregateType: 'EmailDelivery', aggregateId: delivery.id, payload: { notificationId: delivery.notificationId }, deduplicationKey: `email-retry:${delivery.id}:${delivery.attemptCount}` } });
  });
  response.json({ ok: true });
}));

