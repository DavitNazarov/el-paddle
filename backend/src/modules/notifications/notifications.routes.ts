import { Router } from 'express';
import { asyncHandler, requireParamId } from '../../common/http.js';
import { requireUser } from '../auth/auth.service.js';
import { listNotifications, markAllNotificationsRead, markNotificationRead } from './notifications.service.js';

export const notificationsRouter = Router();

notificationsRouter.get('/api/notifications', asyncHandler(async (request, response) => {
  const user = await requireUser(request);
  response.json(await listNotifications(user.id, request.query.unread === 'true', Number(request.query.take) || 50));
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

notificationsRouter.post('/api/notifications/read-all', asyncHandler(async (request, response) => {
  const user = await requireUser(request);
  const result = await markAllNotificationsRead(user.id);
  response.json({ updated: result.count });
}));

