import { Router } from 'express';
import { Capability, DeliveryStatus, OutboxStatus } from '../../generated/prisma/client.js';
import { requireCapability } from '../../common/capabilities.js';
import { asyncHandler, cleanString, jsonError, requireParamId } from '../../common/http.js';
import { prisma } from '../../database/prisma.js';

export const operationsRouter = Router();

operationsRouter.get('/api/admin/audit', asyncHandler(async (request, response) => {
  await requireCapability(request, Capability.AUDIT_READ);
  const eventId = cleanString(request.query.eventId);
  const action = cleanString(request.query.action);
  const logs = await prisma.auditLog.findMany({ where: { ...(eventId ? { eventId } : {}), ...(action ? { action: { contains: action } } : {}) }, orderBy: { createdAt: 'desc' }, take: Math.min(Number(request.query.take) || 100, 250) });
  response.json({ logs });
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

