import { Router } from 'express';
import { Capability, UserRole } from '../../generated/prisma/client.js';
import { requireUser } from '../auth/auth.service.js';
import { requireCapability } from '../../common/capabilities.js';
import { asyncHandler } from '../../common/http.js';
import { serializeEvent, serializeRegistration, serializeTeammateOption } from '../../common/serializers.js';
import { getAdminSummary, getEventOperations, getPlayerDashboard } from './dashboard.service.js';

export const dashboardRouter = Router();

dashboardRouter.get('/api/admin/summary', asyncHandler(async (request, response) => {
  const user = await requireUser(request);
  // Organisers hold no global capability, so they get the same overview scoped
  // to the events handed to them rather than a 403.
  if (user.role === UserRole.ORGANISER) {
    response.json({ counts: await getAdminSummary(user.id) });
    return;
  }
  await requireCapability(request, Capability.DASHBOARD_READ);
  response.json({ counts: await getAdminSummary() });
}));

// Per-event operational counts behind the role home screens. Read-only, and
// scoped exactly like the summary above: organisers never see events they were
// not handed.
dashboardRouter.get('/api/admin/events/operations', asyncHandler(async (request, response) => {
  const user = await requireUser(request);
  if (user.role === UserRole.ORGANISER) {
    response.json({ operations: await getEventOperations(user.id) });
    return;
  }
  await requireCapability(request, Capability.DASHBOARD_READ);
  response.json({ operations: await getEventOperations() });
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
    events: events.map((event) => serializeEvent(event)),
    registrations: registrations.map(serializeRegistration),
    clubMembers: clubMembers.map(serializeTeammateOption),
    clubMembershipRole,
  });
}));
