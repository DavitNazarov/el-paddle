import { Router } from 'express';
import { requireAdmin } from '../auth/auth.service.js';
import {
  asyncHandler,
  cleanEmail,
  cleanString,
  isValidEmail,
  jsonError,
} from '../../common/http.js';
import { serializeClub } from '../../common/serializers.js';
import { slugify } from '../../common/slug.js';
import {
  addClubMember,
  createClub,
  getPublicClubBySlug,
  listAdminClubs,
} from './clubs.service.js';

export const clubsRouter = Router();

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
  if (slug.length < 2) jsonError('Club slug is required.');

  const club = await createClub({ name, slug, description, logoUrl });
  response.status(201).json({ club: serializeClub(club) });
}));

clubsRouter.post('/api/admin/clubs/:id/members', asyncHandler(async (request, response) => {
  await requireAdmin(request);
  const email = cleanEmail(request.body.email);
  const roleTitle = cleanString(request.body.roleTitle);

  if (!isValidEmail(email)) jsonError('Enter a valid user email.');

  const club = await addClubMember(request.params.id, email, roleTitle);
  response.json({ club: serializeClub(club) });
}));

clubsRouter.get('/api/public/clubs/:slug', asyncHandler(async (request, response) => {
  const club = await getPublicClubBySlug(request.params.slug);
  response.json({ club: serializeClub(club) });
}));
