import { Router } from 'express';
import { UserRole } from '../../generated/prisma/client.js';
import { requireUser } from '../auth/auth.service.js';
import { asyncHandler } from '../../common/http.js';
import { serializeEvent, serializeRegistration } from '../../common/serializers.js';
import { getPlayerDashboard } from './dashboard.service.js';

export const dashboardRouter = Router();

dashboardRouter.get('/api/dashboard', asyncHandler(async (request, response) => {
  const user = await requireUser(request);
  if (user.role === UserRole.ADMIN) {
    response.json({ user, events: [], registrations: [] });
    return;
  }

  const { events, registrations } = await getPlayerDashboard(user.id);

  response.json({
    user,
    events: events.map(serializeEvent),
    registrations: registrations.map(serializeRegistration),
  });
}));
