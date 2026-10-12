import { Router } from 'express';
import { asyncHandler, cleanString, requireParamId } from '../../common/http.js';
import { requireUser } from '../auth/auth.service.js';
import {
  deleteNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationUnread,
} from './notifications.service.js';

export const notificationsRouter = Router();

notificationsRouter.get('/api/notifications', asyncHandler(async (request, response) => {
  const user = await requireUser(request);
  response.json(await listNotifications(
    user.id,
    request.query.unread === 'true',
    Number(request.query.take) || 50,
    cleanString(request.query.cursor) || undefined,
  ));
}));

notificationsRouter.get('/api/notifications/unread-count', asyncHandler(async (request, response) => {
  const user = await requireUser(request);
  const result = await listNotifications(user.id, true, 1);
  response.json({ count: result.unreadCount });
}));

notificationsRouter.patch('/api/notifications/:id/read', asyncHandler(async (request, response) => {
  const user = await requireUser(request);
  await markNotificationRead(user.id, requireParamId(request.params.id));
  response.json({ ok: true });
}));

notificationsRouter.patch('/api/notifications/:id/unread', asyncHandler(async (request, response) => {
  const user = await requireUser(request);
  await markNotificationUnread(user.id, requireParamId(request.params.id));
  response.json({ ok: true });
}));

notificationsRouter.delete('/api/notifications/:id', asyncHandler(async (request, response) => {
  const user = await requireUser(request);
  await deleteNotification(user.id, requireParamId(request.params.id));
  response.json({ ok: true });
}));

notificationsRouter.post('/api/notifications/read-all', asyncHandler(async (request, response) => {
  const user = await requireUser(request);
  const result = await markAllNotificationsRead(user.id);
  response.json({ updated: result.count });
}));

