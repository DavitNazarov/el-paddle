import { Router } from 'express';
import { Capability, UserRole } from '../../generated/prisma/client.js';
import { requireUser } from '../auth/auth.service.js';
import { requireCapability } from '../../common/capabilities.js';
import { asyncHandler } from '../../common/http.js';
import { serializeEvent, serializeRegistration, serializeTeammateOption } from '../../common/serializers.js';
import { getAdminSummary, getEventOperations, getPlayerDashboard, getPlayerStats, getPlayerSummary } from './dashboard.service.js';
import { getPlatformStats } from './dashboard.stats.service.js';

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

/**
 * Platform statistics for the administrator home screen.
 *
 * Deliberately unlike its two neighbours above: there is no organiser
 * short-circuit, because there is nothing to narrow. The whole payload *is*
 * platform totals, which an organiser holds no power over, and showing then
 * refusing is worse than hiding. The admin screen never mounts the section for
 * an organiser, so this 403 is the server-side backstop rather than a normal
 * path.
 */
dashboardRouter.get('/api/admin/stats/platform', asyncHandler(async (request, response) => {
  await requireCapability(request, Capability.DASHBOARD_READ);
  response.json({ stats: await getPlatformStats(request.query.range) });
}));

dashboardRouter.get('/api/dashboard', asyncHandler(async (request, response) => {
  const user = await requireUser(request);
  if (user.role === UserRole.ADMIN) {
    response.json({ user, events: [], registrations: [], clubMembers: [] });
    return;
  }

  const {
    events,
    registrations,
    clubMembers,
    clubMembershipRole,
    inDrawEntryIds,
    teamCounts,
    nextMatch,
    receivedRequests,
    sentRequests,
    requestWindows,
  } = await getPlayerDashboard(user.id);

  response.json({
    user,
    events: events.map((event) => ({
      ...serializeEvent(event),
      teamsIn: teamCounts.get(event.id) ?? 0,
    })),
    registrations: registrations.map((registration) => ({
      ...serializeRegistration(registration),
      inDraw: inDrawEntryIds.has(registration.id),
    })),
    clubMembers: clubMembers.map(serializeTeammateOption),
    clubMembershipRole,
    nextMatch,
    receivedRequests,
    sentRequests,
    requestWindows,
  });
}));

// The counts the player shell shows on every page — bell and entries badge.
// Judges and admins have no registrations, so they simply get zero back.
dashboardRouter.get('/api/me/summary', asyncHandler(async (request, response) => {
  const user = await requireUser(request);
  response.json(await getPlayerSummary(user.id));
}));

// The reader's own competitive record — streaks, best finish, partner records.
// Read-only and always scoped to the signed-in user; there is nothing here
// another player could not eventually see on a public profile.
dashboardRouter.get('/api/me/stats', asyncHandler(async (request, response) => {
  const user = await requireUser(request);
  response.json({ stats: await getPlayerStats(user.id) });
}));
