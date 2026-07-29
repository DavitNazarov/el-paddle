import { Router } from 'express';
import { Capability, EventStatus, UserRole } from '../../generated/prisma/client.js';
import { getCurrentUser } from '../auth/auth.service.js';
import { parseOptionalDateTime } from '../../common/dates.js';
import {
  asyncHandler,
  cleanString,
  cleanStringArray,
  isDatabaseConnectionError,
  jsonError,
  requireParamId,
  setPublicCache,
} from '../../common/http.js';
import { serializeEvent } from '../../common/serializers.js';
import {
  changeEventStatus,
  createEvent,
  deleteEvent,
  getEventById,
  listEvents,
  listPublicEvents,
  listPublishedEventsForSitemap,
  updateEvent,
  updateTournamentPublication,
} from './events.service.js';
import { requireCapability, requireEventCapability, requireEventReadCapability, userHasCapability } from '../../common/capabilities.js';
import { requestIp } from '../../common/audit.js';
import { assignEventOrganiser, listEventOrganisers, listOrganiserCandidates, revokeEventOrganiser } from './event-organisers.service.js';
import { requireCommandId } from '../../common/commands.js';

export const eventsRouter = Router();

function normalizeGeorgianIban(value: unknown) {
  return cleanString(value).replace(/\s+/g, '').toUpperCase();
}

function isValidGeorgianIban(iban: string) {
  // GE + 2 check digits + 2-letter bank code + 16 digits = 22 chars
  return /^GE\d{2}[A-Z]{2}\d{16}$/.test(iban);
}

function parseEventDetails(body: Record<string, unknown>, { requireAll }: { requireAll: boolean }) {
  const has = (key: string) => key in body;

  const title = has('title') || requireAll ? cleanString(body.title) : undefined;
  const dateText = has('date') || requireAll ? cleanString(body.date) : undefined;
  const location = has('location') || requireAll ? cleanString(body.location) : undefined;
  const description = has('description') || requireAll ? cleanString(body.description) : undefined;
  const categoryIds =
    has('categoryIds') || requireAll ? [...new Set(cleanStringArray(body.categoryIds))] : undefined;

  let date: Date | undefined;
  if (dateText !== undefined) {
    date = new Date(dateText);
    if (!dateText || Number.isNaN(date.getTime())) jsonError('Enter a valid event date.');
  }

  let arrivalTime: Date | null | undefined;
  if (has('arrivalTime') || requireAll) {
    arrivalTime = parseOptionalDateTime(body.arrivalTime);
    if (body.arrivalTime !== undefined && body.arrivalTime !== null && body.arrivalTime !== '' && arrivalTime === undefined) {
      jsonError('Enter a valid arrival time.');
    }
    if (!requireAll && (body.arrivalTime === null || body.arrivalTime === '')) {
      arrivalTime = null;
    }
  }

  let participationFee: number | undefined;
  if (has('participationFee') || requireAll) {
    participationFee = Number(body.participationFee);
    if (!Number.isInteger(participationFee) || participationFee < 0) {
      jsonError('Enter a valid participation fee (GEL).');
    }
  }

  let bankAccountIban: string | undefined;
  if (has('bankAccountIban') || requireAll) {
    bankAccountIban = normalizeGeorgianIban(body.bankAccountIban);
    if (!isValidGeorgianIban(bankAccountIban)) {
      jsonError('Enter a valid Georgian IBAN (GE…).');
    }
  }

  let bankAccountReceiver: string | undefined;
  if (has('bankAccountReceiver') || requireAll) {
    bankAccountReceiver = cleanString(body.bankAccountReceiver);
    if (!bankAccountReceiver || bankAccountReceiver.length < 2) {
      jsonError('Enter the money receiver name.');
    }
  }

  if (title !== undefined && title.length < 3) jsonError('Event title is too short.');
  if (location !== undefined && !location) jsonError('Event location is required.');
  if (categoryIds !== undefined && !categoryIds.length) {
    jsonError('Create and select at least one category first.');
  }

  return {
    title,
    date,
    location,
    description,
    arrivalTime,
    participationFee,
    bankAccountIban,
    bankAccountReceiver,
    categoryIds,
  };
}

eventsRouter.get('/api/events', asyncHandler(async (request, response) => {
  const user = await getCurrentUser(request);
  const wantsAdminScope = request.query.scope === 'admin';
  const adminScope = wantsAdminScope && user?.role === UserRole.ADMIN;
  // An organiser's "admin" list is exactly the events handed to them.
  const organiserId = wantsAdminScope && user?.role === UserRole.ORGANISER ? user.id : undefined;
  const events = await listEvents({ adminScope, organiserId });
  // Bank details are only for admin management of an event, never the browse list (F3).
  response.json({ events: events.map((event) => serializeEvent(event, { includeBankDetails: adminScope })) });
}));

eventsRouter.get('/api/admin/organisers', asyncHandler(async (request, response) => {
  await requireCapability(request, Capability.USER_MANAGE);
  response.json({ organisers: await listOrganiserCandidates() });
}));

eventsRouter.get('/api/admin/events/:eventId/organisers', asyncHandler(async (request, response) => {
  const eventId = requireParamId(request.params.eventId);
  // Organisers may see who else is running the event with them.
  await requireEventReadCapability(request, eventId, Capability.USER_MANAGE);
  response.json({ organisers: await listEventOrganisers(eventId) });
}));

// Handing an event over grants power, so it stays an admin act even though the
// organiser's own work is scoped to the event.
eventsRouter.post('/api/admin/events/:eventId/organisers', asyncHandler(async (request, response) => {
  const admin = await requireCapability(request, Capability.USER_MANAGE);
  const eventId = requireParamId(request.params.eventId);
  await assignEventOrganiser({
    eventId,
    userId: requireParamId(request.body.userId, 'organiser id'),
    actorId: admin.id,
    ip: requestIp(request),
  });
  response.status(201).json({ organisers: await listEventOrganisers(eventId) });
}));

eventsRouter.delete('/api/admin/events/:eventId/organisers/:userId', asyncHandler(async (request, response) => {
  const admin = await requireCapability(request, Capability.USER_MANAGE);
  const eventId = requireParamId(request.params.eventId);
  await revokeEventOrganiser({
    eventId,
    userId: requireParamId(request.params.userId),
    actorId: admin.id,
    ip: requestIp(request),
  });
  response.json({ organisers: await listEventOrganisers(eventId) });
}));

eventsRouter.patch('/api/admin/events/:id/tournament-publication', asyncHandler(async (request, response) => {
  const admin = await requireCapability(request, Capability.EVENT_PUBLISH);
  const event = await updateTournamentPublication({ eventId: requireParamId(request.params.id), actorId: admin.id, publicLiveScoringEnabled: typeof request.body.publicLiveScoringEnabled === 'boolean' ? request.body.publicLiveScoringEnabled : undefined, resultsPublished: typeof request.body.resultsPublished === 'boolean' ? request.body.resultsPublished : undefined, expectedVersion: Number(request.body.expectedVersion) });
  response.json({ event: serializeEvent(event, { includeBankDetails: true }) });
}));

eventsRouter.get('/api/events/:id', asyncHandler(async (request, response) => {
  const user = await getCurrentUser(request);
  const event = await getEventById(requireParamId(request.params.id), user?.role === UserRole.ADMIN);
  // Authenticated single-event view carries bank details so the register modal can render them (F3).
  response.json({ event: serializeEvent(event, { includeBankDetails: Boolean(user) }) });
}));

eventsRouter.get('/api/public/events/:id', asyncHandler(async (request, response) => {
  const event = await getEventById(requireParamId(request.params.id), false);
  setPublicCache(response);
  response.json({ event: serializeEvent(event) });
}));

eventsRouter.post('/api/events', asyncHandler(async (request, response) => {
  const admin = await requireCapability(request, Capability.EVENT_MANAGE);
  const details = parseEventDetails(request.body, { requireAll: true });

  const event = await createEvent({
    title: details.title!,
    date: details.date!,
    location: details.location!,
    description: details.description ?? '',
    arrivalTime: details.arrivalTime,
    participationFee: details.participationFee!,
    bankAccountIban: details.bankAccountIban!,
    bankAccountReceiver: details.bankAccountReceiver!,
    categoryIds: details.categoryIds!,
    createdById: admin.id,
  });

  response.status(201).json({ event: serializeEvent(event, { includeBankDetails: true }) });
}));

eventsRouter.patch('/api/events/:id', asyncHandler(async (request, response) => {
  await requireCapability(request, Capability.EVENT_MANAGE);

  const details = parseEventDetails(request.body, { requireAll: false });
  const data: Parameters<typeof updateEvent>[1] = {};

  if (details.title !== undefined) data.title = details.title;
  if (details.date !== undefined) data.date = details.date;
  if (details.location !== undefined) data.location = details.location;
  if (details.description !== undefined) data.description = details.description;
  if (details.arrivalTime !== undefined) data.arrivalTime = details.arrivalTime ?? null;
  if (details.participationFee !== undefined) data.participationFee = details.participationFee;
  if (details.bankAccountIban !== undefined) data.bankAccountIban = details.bankAccountIban;
  if (details.bankAccountReceiver !== undefined) data.bankAccountReceiver = details.bankAccountReceiver;
  if (details.categoryIds !== undefined) data.categoryIds = details.categoryIds;

  if (typeof request.body.isPublished === 'boolean') {
    data.isPublished = request.body.isPublished;
  }

  if (!Object.keys(data).length) {
    jsonError('No valid event fields to update.');
  }

  const expectedVersion = Number(request.body.expectedVersion);
  if (!Number.isInteger(expectedVersion)) {
    jsonError('An event version is required to save changes. Refresh and try again.', 409);
  }

  const event = await updateEvent(requireParamId(request.params.id), data, expectedVersion);
  response.json({ event: serializeEvent(event, { includeBankDetails: true }) });
}));

eventsRouter.delete('/api/events/:id', asyncHandler(async (request, response) => {
  const admin = await requireCapability(request, Capability.EVENT_MANAGE);
  await deleteEvent(requireParamId(request.params.id), admin.id);
  response.json({ ok: true });
}));

eventsRouter.patch('/api/admin/events/:id/status', asyncHandler(async (request, response) => {
  const eventId = requireParamId(request.params.id);
  const admin = await requireEventCapability(request, eventId, Capability.EVENT_STATUS_MANAGE);
  const status = cleanString(request.body.status).toUpperCase() as EventStatus;
  if (!Object.values(EventStatus).includes(status)) jsonError('Invalid event status.');
  const event = await changeEventStatus({
    eventId,
    status,
    actorId: admin.id,
    canRollbackCompleted: await userHasCapability(admin.id, admin.role, Capability.EVENT_STATE_CORRECT),
    reason: cleanString(request.body.reason) || undefined,
    expectedVersion: Number(request.body.expectedVersion),
    commandId: requireCommandId(request.body.commandId),
  });
  response.json({ event: serializeEvent(event, { includeBankDetails: true }) });
}));

eventsRouter.get('/api/public/events', asyncHandler(async (_request, response) => {
  try {
    const { upcoming, previous } = await listPublicEvents();
    setPublicCache(response);
    response.json({
      upcoming: upcoming ? serializeEvent(upcoming) : null,
      previous: previous.map((event) => serializeEvent(event)),
    });
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      response.json({ upcoming: null, previous: [], databaseUnavailable: true });
      return;
    }
    throw error;
  }
}));

eventsRouter.get('/api/public/sitemap-events', asyncHandler(async (_request, response) => {
  try {
    const events = await listPublishedEventsForSitemap();
    setPublicCache(response, { maxAge: 300, staleWhileRevalidate: 3600 });
    response.json({
      events: events.map((event) => ({
        id: event.id,
        date: event.date.toISOString(),
        updatedAt: event.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      response.json({ events: [], databaseUnavailable: true });
      return;
    }
    throw error;
  }
}));
