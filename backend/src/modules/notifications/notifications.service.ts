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

export async function listNotifications(userId: string, unreadOnly: boolean, take = 50) {
  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { recipientUserId: userId, ...(unreadOnly ? { readAt: null } : {}) },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(take, 1), 100),
    }),
    prisma.notification.count({ where: { recipientUserId: userId, readAt: null } }),
  ]);
  return { notifications: notifications.map(serializeNotification), unreadCount };
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
