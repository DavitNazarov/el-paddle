import { Router } from 'express';
import { asyncHandler, cleanString, setPublicCache } from '../../common/http.js';
import { searchPublic } from './search.service.js';

export const searchRouter = Router();

searchRouter.get('/api/public/search', asyncHandler(async (request, response) => {
  const term = cleanString(request.query.q).slice(0, 80);
  const limit = Number(request.query.limit);
  const results = await searchPublic(term, Number.isInteger(limit) ? limit : 5);
  setPublicCache(response, { maxAge: 30, staleWhileRevalidate: 120 });
  response.json(results);
}));
