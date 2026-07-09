import { Router } from 'express';
import { UserRole } from '../../generated/prisma/client.js';
import { getCurrentUser, requireAdmin } from '../auth/auth.service.js';
import { parseOptionalDateTime } from '../../common/dates.js';
import {
  asyncHandler,
  cleanString,
  cleanStringArray,
  isDatabaseConnectionError,
  jsonError,
} from '../../common/http.js';
import { serializeEvent } from '../../common/serializers.js';
import {
  createEvent,
  listEvents,
  listPublicEvents,
  updateEvent,
} from './events.service.js';

export const eventsRouter = Router();

eventsRouter.get('/api/events', asyncHandler(async (request, response) => {
  const user = await getCurrentUser(request);
  const adminScope = request.query.scope === 'admin' && user?.role === UserRole.ADMIN;
  const events = await listEvents({ adminScope });
  response.json({ events: events.map(serializeEvent) });
}));

eventsRouter.post('/api/events', asyncHandler(async (request, response) => {
  const admin = await requireAdmin(request);
  const title = cleanString(request.body.title);
  const dateText = cleanString(request.body.date);
  const location = cleanString(request.body.location);
  const description = cleanString(request.body.description);
  const categoryIds = [...new Set(cleanStringArray(request.body.categoryIds))];
  const date = new Date(dateText);
  const arrivalTime = parseOptionalDateTime(request.body.arrivalTime);

  if (title.length < 3) jsonError('Event title is too short.');
  if (!dateText || Number.isNaN(date.getTime())) jsonError('Enter a valid event date.');
  if (!location) jsonError('Event location is required.');
  if (!categoryIds.length) jsonError('Create and select at least one category first.');
  if (request.body.arrivalTime !== undefined && request.body.arrivalTime !== null && request.body.arrivalTime !== '' && arrivalTime === undefined) {
    jsonError('Enter a valid arrival time.');
  }

  const event = await createEvent({
    title,
    date,
    location,
    description,
    arrivalTime,
    categoryIds,
    createdById: admin.id,
  });

  response.status(201).json({ event: serializeEvent(event) });
}));

eventsRouter.patch('/api/events/:id', asyncHandler(async (request, response) => {
  await requireAdmin(request);

  const data: { isPublished?: boolean; arrivalTime?: Date | null } = {};

  if (typeof request.body.isPublished === 'boolean') {
    data.isPublished = request.body.isPublished;
  }

  if ('arrivalTime' in request.body) {
    const arrivalTime = parseOptionalDateTime(request.body.arrivalTime);
    if (request.body.arrivalTime !== null && request.body.arrivalTime !== '' && arrivalTime === undefined) {
      jsonError('Enter a valid arrival time.');
    }
    data.arrivalTime = arrivalTime ?? null;
  }

  if (!Object.keys(data).length) {
    jsonError('No valid event fields to update.');
  }

  const event = await updateEvent(request.params.id, data);
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
