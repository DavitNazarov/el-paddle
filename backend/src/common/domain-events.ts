import type { NotificationType, Prisma } from '../generated/prisma/client.js';

type NotifyInput = {
  recipientUserId: string;
  recipientEmail?: string | null;
  type: NotificationType;
  title: string;
  message: string;
  entityType: string;
  entityId: string;
  eventId?: string;
  actionPath: string;
  version: number;
  metadata?: Prisma.InputJsonValue;
  emailEyebrow?: string;
  emailActionLabel?: string;
};

export async function queueNotification(tx: Prisma.TransactionClient, input: NotifyInput) {
  const deduplicationKey = `${input.entityType}:${input.entityId}:${input.type}:v${input.version}:user:${input.recipientUserId}`;
  const notification = await tx.notification.upsert({
    where: { deduplicationKey },
    update: {},
    create: {
      recipientUserId: input.recipientUserId,
      type: input.type,
      title: input.title,
      message: input.message,
      entityType: input.entityType,
      entityId: input.entityId,
      eventId: input.eventId,
      actionPath: input.actionPath,
      metadata: input.metadata,
      deduplicationKey,
    },
  });

  if (input.recipientEmail) {
    await tx.emailDelivery.upsert({
      where: { deduplicationKey },
      update: {},
      create: {
        notificationId: notification.id,
        recipientEmail: input.recipientEmail,
        template: input.type,
        payload: {
          title: input.title,
          message: input.message,
          actionPath: input.actionPath,
          emailEyebrow: input.emailEyebrow,
          emailActionLabel: input.emailActionLabel,
        },
        deduplicationKey,
      },
    });
    await queueOutbox(tx, {
      topic: 'email.send',
      aggregateType: 'Notification',
      aggregateId: notification.id,
      payload: { notificationId: notification.id },
      deduplicationKey: `email:${deduplicationKey}`,
    });
  }

  await queueOutbox(tx, {
    topic: 'notification.created',
    aggregateType: 'Notification',
    aggregateId: notification.id,
    payload: { notificationId: notification.id, recipientUserId: input.recipientUserId },
    deduplicationKey: `ws:${deduplicationKey}`,
  });
  return notification;
}

/**
 * Batched fan-out of {@link queueNotification}. Instead of N × (upsert + upserts +
 * outbox) round-trips inside the transaction, this issues a fixed handful of
 * `createMany` statements. `skipDuplicates` preserves the same idempotency the
 * single-row upsert path relies on. Prefer this for multi-recipient notifications
 * (event-status fan-out, bracket publish, etc.) to keep transactions short.
 */
export async function queueNotifications(tx: Prisma.TransactionClient, inputs: NotifyInput[]) {
  if (!inputs.length) return;
  const entries = inputs.map((input) => ({
    input,
    deduplicationKey: `${input.entityType}:${input.entityId}:${input.type}:v${input.version}:user:${input.recipientUserId}`,
  }));

  await tx.notification.createMany({
    data: entries.map(({ input, deduplicationKey }) => ({
      recipientUserId: input.recipientUserId,
      type: input.type,
      title: input.title,
      message: input.message,
      entityType: input.entityType,
      entityId: input.entityId,
      eventId: input.eventId,
      actionPath: input.actionPath,
      metadata: input.metadata,
      deduplicationKey,
    })),
    skipDuplicates: true,
  });

  const notifications = await tx.notification.findMany({
    where: { deduplicationKey: { in: entries.map((entry) => entry.deduplicationKey) } },
    select: { id: true, deduplicationKey: true },
  });
  const idByKey = new Map(notifications.map((notification) => [notification.deduplicationKey, notification.id]));

  const emailRows: Prisma.EmailDeliveryCreateManyInput[] = [];
  const outboxRows: Prisma.OutboxMessageCreateManyInput[] = [];
  for (const { input, deduplicationKey } of entries) {
    const notificationId = idByKey.get(deduplicationKey);
    if (!notificationId) continue;
    if (input.recipientEmail) {
      emailRows.push({
        notificationId,
        recipientEmail: input.recipientEmail,
        template: input.type,
        payload: {
          title: input.title,
          message: input.message,
          actionPath: input.actionPath,
          emailEyebrow: input.emailEyebrow,
          emailActionLabel: input.emailActionLabel,
        },
        deduplicationKey,
      });
      outboxRows.push({
        topic: 'email.send',
        aggregateType: 'Notification',
        aggregateId: notificationId,
        payload: { notificationId },
        deduplicationKey: `email:${deduplicationKey}`,
      });
    }
    outboxRows.push({
      topic: 'notification.created',
      aggregateType: 'Notification',
      aggregateId: notificationId,
      payload: { notificationId, recipientUserId: input.recipientUserId },
      deduplicationKey: `ws:${deduplicationKey}`,
    });
  }

  if (emailRows.length) await tx.emailDelivery.createMany({ data: emailRows, skipDuplicates: true });
  if (outboxRows.length) await tx.outboxMessage.createMany({ data: outboxRows, skipDuplicates: true });
}

export async function queueOutbox(
  tx: Prisma.TransactionClient,
  input: {
    topic: string;
    aggregateType: string;
    aggregateId: string;
    payload: Prisma.InputJsonValue;
    deduplicationKey: string;
  },
) {
  return tx.outboxMessage.upsert({
    where: { deduplicationKey: input.deduplicationKey },
    update: {},
    create: input,
  });
}

export async function writeAudit(
  tx: Prisma.TransactionClient,
  input: {
    action: string;
    actorId?: string;
    eventId?: string;
    entityType: string;
    entityId: string;
    before?: Prisma.InputJsonValue;
    after?: Prisma.InputJsonValue;
    publicReason?: string;
    internalReason?: string;
    ip?: string | null;
  },
) {
  return tx.auditLog.create({ data: { ...input, ip: input.ip ?? undefined } });
}
