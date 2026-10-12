import { Router } from 'express';
import { Capability } from '../../generated/prisma/client.js';
import { requireEventReadCapability } from '../../common/capabilities.js';
import { asyncHandler, requireParamId, setPublicCache } from '../../common/http.js';
import { csvFilename, sendCsv, wantsCsv } from '../../common/csv.js';
import { getEventResults } from './results.service.js';

export const resultsRouter = Router();

type EventResults = Awaited<ReturnType<typeof getEventResults>>;

const resultsCsvHeader = ['Category', 'Place', 'Player 1', 'Player 2', 'Club'];

function resultsCsvRows(results: EventResults) {
  return results.categories.flatMap((category) =>
    category.standings.map((standing) => [
      category.categoryName,
      standing.place,
      standing.team.ownerName,
      standing.team.teammateName,
      standing.team.clubName ?? '',
    ]),
  );
}

resultsRouter.get('/api/public/events/:eventId/results', asyncHandler(async (request, response) => {
  const results = await getEventResults(
    requireParamId(request.params.eventId, 'event id'),
    { publicOnly: true },
  );
  if (wantsCsv(request)) {
    sendCsv(response, csvFilename(results.event.title, 'results'), resultsCsvHeader, resultsCsvRows(results));
    return;
  }
  setPublicCache(response);
  response.json(results);
}));

/**
 * The same podium before it is published, so an organiser can read the result
 * they are about to publish. Read-only for an organiser, like the entry roster.
 */
resultsRouter.get('/api/admin/events/:eventId/results', asyncHandler(async (request, response) => {
  const eventId = requireParamId(request.params.eventId, 'event id');
  await requireEventReadCapability(request, eventId, Capability.EVENT_PUBLISH);
  const results = await getEventResults(eventId, { publicOnly: false });
  if (wantsCsv(request)) {
    sendCsv(response, csvFilename(results.event.title, 'results'), resultsCsvHeader, resultsCsvRows(results));
    return;
  }
  response.json(results);
}));
