import { Router } from 'express';
import { requireUser } from '../auth/auth.service.js';
import { Capability, ClubMembershipRole } from '../../generated/prisma/client.js';
import { requireCapability } from '../../common/capabilities.js';
import { parseListRange } from '../../common/pagination.js';
import { auditLog, requestIp } from '../../common/audit.js';
import {
  asyncHandler,
  cleanEmail,
  cleanString,
  isSafeHttpUrl,
  isValidEmail,
  jsonError,
  requireParamId,
  setPublicCache,
} from '../../common/http.js';
import { serializeClub, serializePublicClub } from '../../common/serializers.js';
import { clubInclude } from '../../common/includes.js';
import { prisma } from '../../database/prisma.js';
import { isSafeSlug, slugify } from '../../common/slug.js';
import {
  addClubMember,
  appointClubLeader,
  cancelOwnClubRequest,
  createClub,
  decideClubJoinRequest,
  deleteClub,
  getOwnClubDepartureImpact,
  getPendingClubRequest,
  getPlayerClubDetails,
  getClubMemberRemovalImpact,
  getPublicClubBySlug,
  getPublicClubStats,
  leaveClub,
  listAdminClubs,
  listLeaderlessClubs,
  listPublicClubs,
  removeClubMember,
  requestClubMembership,
  resendClubMateInvite,
  revokeClubMateInvite,
  serializeClubOption,
  transferClubLeadership,
  updateClub,
  updateOwnClub,
  type MemberRemovalResolution,
} from './clubs.service.js';

export const clubsRouter = Router();

/** The four editable profile fields, read and validated the same way for create and edit. */
function readClubProfile(body: Record<string, unknown>) {
  const name = cleanString(body.name);
  const description = cleanString(body.description);
  const logoUrl = cleanString(body.logoUrl);
  const slug = slugify(cleanString(body.slug) || name);

  if (name.length < 2) jsonError('Club name is required.');
  if (!isSafeSlug(slug)) jsonError('Club slug is required.');
  if (!isSafeHttpUrl(logoUrl)) jsonError('Logo URL must be an http(s) link.');

  return { name, slug, description, logoUrl };
}

/**
 * How each unfinished entry a departing player appears in is resolved. Read the
 * same way whether the leader is removing someone or someone is leaving: the
 * entries do not care which of the two it was.
 */
function readRemovalResolutions(body: Record<string, unknown>): MemberRemovalResolution[] {
  const raw = Array.isArray(body.resolutions) ? body.resolutions : [];
  return raw.map((resolution: unknown) => {
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
}

clubsRouter.get('/api/public/clubs', asyncHandler(async (_request, response) => {
  const clubs = await listPublicClubs();
  setPublicCache(response);
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
  const resolutions = readRemovalResolutions(request.body);
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

clubsRouter.patch('/api/account/club', asyncHandler(async (request, response) => {
  const current = await requireUser(request);
  const club = await updateOwnClub(current.id, readClubProfile(request.body), requestIp(request));
  auditLog({
    event: 'club.profile_updated',
    userId: current.id,
    email: current.email,
    ip: requestIp(request),
    detail: `clubId=${club.id};slug=${club.slug}`,
  });
  response.json({ club: serializeClub(club) });
}));

clubsRouter.patch('/api/account/club/members/:id/role', asyncHandler(async (request, response) => {
  const current = await requireUser(request);
  const membershipRole = cleanString(request.body.membershipRole).toUpperCase();
  if (membershipRole !== ClubMembershipRole.LEADER) {
    jsonError('Only leadership can be handed over. Remove a member to end their membership.');
  }
  const memberId = requireParamId(request.params.id, 'member id');
  await transferClubLeadership(current.id, memberId);
  auditLog({
    event: 'club.leadership_transferred',
    userId: current.id,
    email: current.email,
    ip: requestIp(request),
    detail: `memberId=${memberId}`,
  });
  response.json({ club: await getPlayerClubDetails(current.id) });
}));

clubsRouter.get('/api/account/club/departure-impact', asyncHandler(async (request, response) => {
  const current = await requireUser(request);
  response.json({ impact: await getOwnClubDepartureImpact(current.id) });
}));

clubsRouter.post('/api/account/club/leave', asyncHandler(async (request, response) => {
  const current = await requireUser(request);
  const left = await leaveClub(current.id, readRemovalResolutions(request.body));
  auditLog({
    event: 'club.member_left',
    userId: current.id,
    email: current.email,
    ip: requestIp(request),
    detail: `clubId=${left.clubId}`,
  });
  response.json({ ok: true });
}));

clubsRouter.post('/api/account/club/members/:id/invite/resend', asyncHandler(async (request, response) => {
  const current = await requireUser(request);
  const club = await getPlayerClubDetails(current.id);
  if (!club) jsonError('You do not belong to a club.', 404);
  const { email } = await resendClubMateInvite({
    actorUserId: current.id,
    memberId: requireParamId(request.params.id, 'member id'),
    inviterName: [current.name, current.surname].filter(Boolean).join(' ') || current.email,
    clubName: club.name,
  });
  auditLog({
    event: 'club.mate_invite_resent',
    userId: current.id,
    email: current.email,
    ip: requestIp(request),
    detail: `to=${email}`,
  });
  response.json({ ok: true });
}));

clubsRouter.delete('/api/account/club/members/:id/invite', asyncHandler(async (request, response) => {
  const current = await requireUser(request);
  await revokeClubMateInvite(current.id, requireParamId(request.params.id, 'member id'));
  auditLog({
    event: 'club.mate_invite_revoked',
    userId: current.id,
    email: current.email,
    ip: requestIp(request),
    detail: `memberId=${request.params.id}`,
  });
  response.json({ club: await getPlayerClubDetails(current.id) });
}));

clubsRouter.delete('/api/account/club-requests/current', asyncHandler(async (request, response) => {
  const current = await requireUser(request);
  const { clubId } = await cancelOwnClubRequest(current.id);
  auditLog({
    event: 'club.join_request_cancelled',
    userId: current.id,
    email: current.email,
    ip: requestIp(request),
    detail: `clubId=${clubId}`,
  });
  response.json({ ok: true });
}));

clubsRouter.get('/api/admin/clubs', asyncHandler(async (request, response) => {
  await requireCapability(request, Capability.CLUB_MANAGE);
  const page = await listAdminClubs(parseListRange(request.query));
  response.json({ clubs: page.items.map(serializeClub), nextCursor: page.nextCursor });
}));

clubsRouter.post('/api/admin/clubs', asyncHandler(async (request, response) => {
  await requireCapability(request, Capability.CLUB_MANAGE);
  const club = await createClub(readClubProfile(request.body));
  response.status(201).json({ club: serializeClub(club) });
}));

clubsRouter.patch('/api/admin/clubs/:id', asyncHandler(async (request, response) => {
  const admin = await requireCapability(request, Capability.CLUB_MANAGE);
  const clubId = requireParamId(request.params.id);
  const club = await updateClub(
    clubId,
    readClubProfile(request.body),
    admin.id,
    requestIp(request),
  );
  response.json({ club: serializeClub(club) });
}));

clubsRouter.delete('/api/admin/clubs/:id', asyncHandler(async (request, response) => {
  const admin = await requireCapability(request, Capability.CLUB_MANAGE);
  const clubId = requireParamId(request.params.id);
  const { removedMembers } = await deleteClub(clubId, admin.id, requestIp(request));
  auditLog({
    event: 'club.deleted',
    userId: admin.id,
    email: admin.email,
    ip: requestIp(request),
    detail: `clubId=${clubId};removedMembers=${removedMembers}`,
  });
  response.json({ ok: true });
}));

clubsRouter.get('/api/admin/clubs/leaderless', asyncHandler(async (request, response) => {
  await requireCapability(request, Capability.CLUB_MANAGE);
  const clubs = await listLeaderlessClubs();
  response.json({ clubs, total: clubs.length });
}));

clubsRouter.patch('/api/admin/clubs/:id/members/:memberId/role', asyncHandler(async (request, response) => {
  const admin = await requireCapability(request, Capability.CLUB_MANAGE);
  const membershipRole = cleanString(request.body.membershipRole).toUpperCase();
  if (membershipRole !== ClubMembershipRole.LEADER) {
    jsonError('Only leadership can be appointed. Remove a member to end their membership.');
  }
  const clubId = requireParamId(request.params.id, 'club id');
  await appointClubLeader({
    clubId,
    memberId: requireParamId(request.params.memberId, 'member id'),
    actorId: admin.id,
    ip: requestIp(request),
  });
  auditLog({
    event: 'admin.club_leader_appointed',
    userId: admin.id,
    email: admin.email,
    ip: requestIp(request),
    detail: `clubId=${clubId};memberId=${request.params.memberId}`,
  });
  const club = await prisma.club.findUnique({ where: { id: clubId }, include: clubInclude });
  response.json({ club: club ? serializeClub(club) : null });
}));

clubsRouter.post('/api/admin/clubs/:id/members', asyncHandler(async (request, response) => {
  await requireCapability(request, Capability.CLUB_MANAGE);
  const email = cleanEmail(request.body.email);
  const roleTitle = cleanString(request.body.roleTitle);

  if (!isValidEmail(email)) jsonError('Enter a valid user email.');

  const club = await addClubMember(requireParamId(request.params.id), email, roleTitle);
  response.json({ club: serializeClub(club) });
}));

clubsRouter.get('/api/public/clubs/:slug/stats', asyncHandler(async (request, response) => {
  const slug = slugify(cleanString(request.params.slug));
  if (!isSafeSlug(slug)) jsonError('Club not found.', 404);
  const club = await getPublicClubBySlug(slug);
  const stats = await getPublicClubStats(club.id);
  setPublicCache(response);
  response.json({ club: { id: club.id, name: club.name, slug: club.slug }, stats });
}));

clubsRouter.get('/api/public/clubs/:slug', asyncHandler(async (request, response) => {
  const slug = slugify(cleanString(request.params.slug));
  if (!isSafeSlug(slug)) jsonError('Club not found.', 404);
  const club = await getPublicClubBySlug(slug);
  setPublicCache(response);
  response.json({ club: serializePublicClub(club) });
}));
