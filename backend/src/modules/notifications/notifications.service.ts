import { prisma } from '../../database/prisma.js';
import { jsonError } from '../../common/http.js';
import type { Notification } from '../../generated/prisma/client.js';

function serializeNotification(notification: Notification) {
  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    actionPath: notification.actionPath,
    readAt: notification.readAt,
    createdAt: notification.createdAt,
  };
}

/**
 * The reader's notifications, newest first.
 *
 * `cursor` is the id of the last row the caller already has. The list was capped
 * at 100 with no way to ask for the next page, so a busy season simply ended at
 * a hundred notifications and the rest were unreachable. Reading one past the
 * page is how the caller learns whether asking again is worth it.
 */
export async function listNotifications(
  userId: string,
  unreadOnly: boolean,
  take = 50,
  cursor?: string,
) {
  const pageSize = Math.min(Math.max(take, 1), 100);
  const [rows, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { recipientUserId: userId, ...(unreadOnly ? { readAt: null } : {}) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: pageSize + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    }),
    prisma.notification.count({ where: { recipientUserId: userId, readAt: null } }),
  ]);
  const notifications = rows.slice(0, pageSize);
  return {
    notifications: notifications.map(serializeNotification),
    unreadCount,
    nextCursor: rows.length > pageSize ? notifications[notifications.length - 1]!.id : null,
  };
}

/**
 * Put one back as unread — the counterpart of marking it read, for a message
 * opened by accident on the way to another one.
 */
export async function markNotificationUnread(userId: string, notificationId: string) {
  const result = await prisma.notification.updateMany({
    where: { id: notificationId, recipientUserId: userId, readAt: { not: null } },
    data: { readAt: null },
  });
  if (!result.count) {
    const exists = await prisma.notification.findFirst({ where: { id: notificationId, recipientUserId: userId } });
    if (!exists) jsonError('Notification not found.', 404);
  }
}

/**
 * Clear one from the list. The notification is the reader's own copy of an
 * event that happened, so deleting it removes their copy and nothing else — the
 * audit row and the entity it points at are untouched.
 */
export async function deleteNotification(userId: string, notificationId: string) {
  const result = await prisma.notification.deleteMany({
    where: { id: notificationId, recipientUserId: userId },
  });
  if (!result.count) jsonError('Notification not found.', 404);
}

export async function markNotificationRead(userId: string, notificationId: string) {
  const result = await prisma.notification.updateMany({
    where: { id: notificationId, recipientUserId: userId, readAt: null },
    data: { readAt: new Date() },
  });
  if (!result.count) {
    const exists = await prisma.notification.findFirst({ where: { id: notificationId, recipientUserId: userId } });
    if (!exists) jsonError('Notification not found.', 404);
  }
}

export async function markAllNotificationsRead(userId: string, cutoff = new Date()) {
  return prisma.notification.updateMany({
    where: { recipientUserId: userId, readAt: null, createdAt: { lte: cutoff } },
    data: { readAt: new Date() },
  });
}
