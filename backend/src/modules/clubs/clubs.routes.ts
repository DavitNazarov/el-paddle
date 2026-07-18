import { Router } from 'express';
import { requireUser } from '../auth/auth.service.js';
import { Capability } from '../../generated/prisma/client.js';
import { requireCapability } from '../../common/capabilities.js';
import { auditLog, requestIp } from '../../common/audit.js';
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
  decideClubJoinRequest,
  getPendingClubRequest,
  getPlayerClubDetails,
  getClubMemberRemovalImpact,
  getPublicClubBySlug,
  listAdminClubs,
  listPublicClubs,
  removeClubMember,
  requestClubMembership,
  serializeClubOption,
} from './clubs.service.js';

export const clubsRouter = Router();

clubsRouter.get('/api/public/clubs', asyncHandler(async (_request, response) => {
  const clubs = await listPublicClubs();
  response.json({ clubs: clubs.map(serializeClubOption) });
}));

clubsRouter.get('/api/account/club-details', asyncHandler(async (request, response) => {
  const current = await requireUser(request);
  const club = await getPlayerClubDetails(current.id);
  response.json({ club });
}));

clubsRouter.get('/api/account/club-requests/current', asyncHandler(async (request, response) => {
  const current = await requireUser(request);
  const clubRequest = await getPendingClubRequest(current.id);
  response.json({ clubRequest });
}));

clubsRouter.post('/api/account/club-requests', asyncHandler(async (request, response) => {
  const current = await requireUser(request);
  if (current.role !== 'USER') jsonError('Only players can join clubs.', 403);
  if (current.club) jsonError('You already belong to a club.', 409);

  const clubId = requireParamId(request.body.clubId, 'club id');
  const clubRequest = await requestClubMembership(current.id, clubId);
  auditLog({
    event: 'club.join_request_created',
    userId: current.id,
    email: current.email,
    ip: requestIp(request),
    detail: `clubId=${clubId}`,
  });
  response.status(201).json({
    clubRequest: {
      id: clubRequest.id,
      createdAt: clubRequest.createdAt.toISOString(),
      club: clubRequest.club,
    },
  });
}));

clubsRouter.get('/api/account/club/members/:id/removal-impact', asyncHandler(async (request, response) => {
  const current = await requireUser(request);
  const memberId = requireParamId(request.params.id, 'member id');
  response.json({ impact: await getClubMemberRemovalImpact(current.id, memberId) });
}));

clubsRouter.delete('/api/account/club/members/:id', asyncHandler(async (request, response) => {
  const current = await requireUser(request);
  const memberId = requireParamId(request.params.id, 'member id');
  const rawResolutions = Array.isArray(request.body.resolutions) ? request.body.resolutions : [];
  const resolutions = rawResolutions.map((resolution: unknown) => {
    if (!resolution || typeof resolution !== 'object') {
      jsonError('Invalid registration resolution.');
    }
    const value = resolution as Record<string, unknown>;
    const action = cleanString(value.action).toUpperCase();
    if (action !== 'REPLACE' && action !== 'WITHDRAW') {
      jsonError('Choose whether to replace the player or withdraw the team.');
    }
    const expectedVersion = Number(value.expectedVersion);
    if (!Number.isInteger(expectedVersion) || expectedVersion < 0) {
      jsonError('A valid registration version is required.');
    }
    return {
      registrationId: requireParamId(value.registrationId, 'registration id'),
      expectedVersion,
      action,
      replacementUserId:
        action === 'REPLACE'
          ? requireParamId(value.replacementUserId, 'replacement user id')
          : undefined,
    };
  });
  const removed = await removeClubMember(current.id, memberId, resolutions);
  auditLog({
    event: 'club.member_removed',
    userId: current.id,
    email: current.email,
    ip: requestIp(request),
    detail: `clubId=${removed.clubId};memberId=${removed.id};removedUserId=${removed.userId}`,
  });
  response.json({ club: await getPlayerClubDetails(current.id) });
}));

clubsRouter.patch('/api/account/club/join-requests/:id', asyncHandler(async (request, response) => {
  const current = await requireUser(request);
  const requestId = requireParamId(request.params.id, 'request id');
  const decision = cleanString(request.body.decision);
  if (decision !== 'approve' && decision !== 'reject') {
    jsonError('Decision must be approve or reject.');
  }

  await decideClubJoinRequest(current.id, requestId, decision);
  auditLog({
    event: 'club.join_request_reviewed',
    userId: current.id,
    email: current.email,
    ip: requestIp(request),
    detail: `requestId=${requestId};decision=${decision}`,
  });
  response.json({ club: await getPlayerClubDetails(current.id) });
}));

clubsRouter.get('/api/admin/clubs', asyncHandler(async (request, response) => {
  await requireCapability(request, Capability.CLUB_MANAGE);
  const clubs = await listAdminClubs();
  response.json({ clubs: clubs.map(serializeClub) });
}));

clubsRouter.post('/api/admin/clubs', asyncHandler(async (request, response) => {
  await requireCapability(request, Capability.CLUB_MANAGE);
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
  await requireCapability(request, Capability.CLUB_MANAGE);
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
