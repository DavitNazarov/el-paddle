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
import { requireCapability, userHasCapability } from '../../common/capabilities.js';
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
  const adminScope = request.query.scope === 'admin' && user?.role === UserRole.ADMIN;
  const events = await listEvents({ adminScope });
  response.json({ events: events.map(serializeEvent) });
}));

eventsRouter.patch('/api/admin/events/:id/tournament-publication', asyncHandler(async (request, response) => {
  const admin = await requireCapability(request, Capability.EVENT_PUBLISH);
  const event = await updateTournamentPublication({ eventId: requireParamId(request.params.id), actorId: admin.id, publicLiveScoringEnabled: typeof request.body.publicLiveScoringEnabled === 'boolean' ? request.body.publicLiveScoringEnabled : undefined, resultsPublished: typeof request.body.resultsPublished === 'boolean' ? request.body.resultsPublished : undefined, expectedVersion: Number(request.body.expectedVersion) });
  response.json({ event: serializeEvent(event) });
}));

eventsRouter.get('/api/events/:id', asyncHandler(async (request, response) => {
  const user = await getCurrentUser(request);
  const event = await getEventById(requireParamId(request.params.id), user?.role === UserRole.ADMIN);
  response.json({ event: serializeEvent(event) });
}));

eventsRouter.get('/api/public/events/:id', asyncHandler(async (request, response) => {
  const event = await getEventById(requireParamId(request.params.id), false);
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

  response.status(201).json({ event: serializeEvent(event) });
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
  response.json({ event: serializeEvent(event) });
}));

eventsRouter.delete('/api/events/:id', asyncHandler(async (request, response) => {
  const admin = await requireCapability(request, Capability.EVENT_MANAGE);
  await deleteEvent(requireParamId(request.params.id), admin.id);
  response.json({ ok: true });
}));

eventsRouter.patch('/api/admin/events/:id/status', asyncHandler(async (request, response) => {
  const admin = await requireCapability(request, Capability.EVENT_STATUS_MANAGE);
  const status = cleanString(request.body.status).toUpperCase() as EventStatus;
  if (!Object.values(EventStatus).includes(status)) jsonError('Invalid event status.');
  const event = await changeEventStatus({
    eventId: requireParamId(request.params.id),
    status,
    actorId: admin.id,
    canRollbackCompleted: await userHasCapability(admin.id, admin.role, Capability.EVENT_STATE_CORRECT),
    reason: cleanString(request.body.reason) || undefined,
    expectedVersion: Number(request.body.expectedVersion),
    commandId: requireCommandId(request.body.commandId),
  });
  response.json({ event: serializeEvent(event) });
}));

eventsRouter.get('/api/public/events', asyncHandler(async (_request, response) => {
  try {
    const { upcoming, previous } = await listPublicEvents();
    response.json({
      upcoming: upcoming ? serializeEvent(upcoming) : null,
      previous: previous.map(serializeEvent),
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
