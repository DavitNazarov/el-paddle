import { Router } from 'express';
import { requireAdmin } from '../auth/auth.service.js';
import {
  asyncHandler,
  cleanEmail,
  cleanString,
  isSafeHttpUrl,
  isValidEmail,
  jsonError,
  requireParamId,
} from '../../common/http.js';
import { serializeClub, serializePublicClub } from '../../common/serializers.js';
import { isSafeSlug, slugify } from '../../common/slug.js';
import {
  addClubMember,
  createClub,
  getPublicClubBySlug,
  listAdminClubs,
  listPublicClubs,
  serializeClubOption,
} from './clubs.service.js';

export const clubsRouter = Router();

clubsRouter.get('/api/public/clubs', asyncHandler(async (_request, response) => {
  const clubs = await listPublicClubs();
  response.json({ clubs: clubs.map(serializeClubOption) });
}));

clubsRouter.get('/api/admin/clubs', asyncHandler(async (request, response) => {
  await requireAdmin(request);
  const clubs = await listAdminClubs();
  response.json({ clubs: clubs.map(serializeClub) });
}));

clubsRouter.post('/api/admin/clubs', asyncHandler(async (request, response) => {
  await requireAdmin(request);
  const name = cleanString(request.body.name);
  const description = cleanString(request.body.description);
  const logoUrl = cleanString(request.body.logoUrl);
  const slug = slugify(cleanString(request.body.slug) || name);

  if (name.length < 2) jsonError('Club name is required.');
  if (!isSafeSlug(slug)) jsonError('Club slug is required.');
  if (!isSafeHttpUrl(logoUrl)) jsonError('Logo URL must be an http(s) link.');

  const club = await createClub({ name, slug, description, logoUrl });
  response.status(201).json({ club: serializeClub(club) });
}));

clubsRouter.post('/api/admin/clubs/:id/members', asyncHandler(async (request, response) => {
  await requireAdmin(request);
  const email = cleanEmail(request.body.email);
  const roleTitle = cleanString(request.body.roleTitle);

  if (!isValidEmail(email)) jsonError('Enter a valid user email.');

  const club = await addClubMember(requireParamId(request.params.id), email, roleTitle);
  response.json({ club: serializeClub(club) });
}));

clubsRouter.get('/api/public/clubs/:slug', asyncHandler(async (request, response) => {
  const slug = slugify(cleanString(request.params.slug));
  if (!isSafeSlug(slug)) jsonError('Club not found.', 404);
  const club = await getPublicClubBySlug(slug);
  response.json({ club: serializePublicClub(club) });
}));
