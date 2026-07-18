import { Router } from 'express';
import { Capability, UserRole } from '../../generated/prisma/client.js';
import { requireUser, toPublicUser } from '../auth/auth.service.js';
import { requireCapability } from '../../common/capabilities.js';
import { asyncHandler } from '../../common/http.js';
import { serializeEvent, serializeRegistration } from '../../common/serializers.js';
import { getAdminSummary, getPlayerDashboard } from './dashboard.service.js';

export const dashboardRouter = Router();

dashboardRouter.get('/api/admin/summary', asyncHandler(async (request, response) => {
  await requireCapability(request, Capability.DASHBOARD_READ);
  response.json({ counts: await getAdminSummary() });
}));

dashboardRouter.get('/api/dashboard', asyncHandler(async (request, response) => {
  const user = await requireUser(request);
  if (user.role === UserRole.ADMIN) {
    response.json({ user, events: [], registrations: [], clubMembers: [] });
    return;
  }

  const { events, registrations, clubMembers, clubMembershipRole } = await getPlayerDashboard(user.id);

  response.json({
    user,
    events: events.map(serializeEvent),
    registrations: registrations.map(serializeRegistration),
    clubMembers: clubMembers.map(toPublicUser),
    clubMembershipRole,
  });
}));
