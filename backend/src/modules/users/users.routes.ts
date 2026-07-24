import { Router } from 'express';
import { Capability, UserRole } from '../../generated/prisma/client.js';
import {
  asyncHandler,
  cleanEmail,
  cleanString,
  isValidEmail,
  jsonError,
  requireParamId,
} from '../../common/http.js';
import { serializeAdminUser } from '../../common/serializers.js';
import {
  clearSessionCookie,
  requireUser,
  revokeUserSessions,
} from '../auth/auth.service.js';
import { auditLog, requestIp } from '../../common/audit.js';
import { passwordValidationError } from '../../common/security.js';
import { requireCapability } from '../../common/capabilities.js';
import { parseListRange } from '../../common/pagination.js';
import {
  createUserByAdmin,
  deleteUserAccount,
  getPublicPlayer,
  listPublicPlayers,
  listUsers,
  setUserDisqualification,
  setJudgeActive,
} from './users.service.js';

export const usersRouter = Router();

type PublicPlayerRecord = Awaited<ReturnType<typeof getPublicPlayer>>;

function serializePublicPlayer(player: PublicPlayerRecord) {
  const clubMembership = player.clubMemberships[0] ?? null;
  return {
    id: player.id,
    fullName: [player.name, player.surname].filter(Boolean).join(' ') || 'Player',
    roleTitle: clubMembership?.roleTitle ?? '',
    club: clubMembership?.club ?? null,
    stats: player.stats,
  };
}

usersRouter.get('/api/public/players', asyncHandler(async (request, response) => {
  const page = await listPublicPlayers(parseListRange(request.query));
  response.json({
    players: page.items.map(serializePublicPlayer),
    nextCursor: page.nextCursor,
  });
}));

usersRouter.get('/api/public/players/:id', asyncHandler(async (request, response) => {
  const player = await getPublicPlayer(requireParamId(request.params.id, 'player id'));
  response.json({ player: serializePublicPlayer(player) });
}));

usersRouter.get('/api/admin/users', asyncHandler(async (request, response) => {
  await requireCapability(request, Capability.USER_MANAGE);
  const page = await listUsers(undefined, parseListRange(request.query));
  response.json({ users: page.items.map(serializeAdminUser), nextCursor: page.nextCursor });
}));

usersRouter.get('/api/admin/judges', asyncHandler(async (request, response) => {
  await requireCapability(request, Capability.JUDGE_MANAGE);
  const page = await listUsers(UserRole.JUDGE, parseListRange(request.query));
  response.json({ judges: page.items.map(serializeAdminUser), nextCursor: page.nextCursor });
}));

for (const action of ['activate', 'deactivate'] as const) {
  usersRouter.post(`/api/admin/judges/:id/${action}`, asyncHandler(async (request, response) => {
    await requireCapability(request, Capability.JUDGE_MANAGE);
    const judge = await setJudgeActive(requireParamId(request.params.id), action === 'activate');
    response.json({ judge: serializeAdminUser(judge) });
  }));
}

usersRouter.post('/api/admin/users', asyncHandler(async (request, response) => {
  await requireCapability(request, Capability.USER_MANAGE);

  const email = cleanEmail(request.body.email);
  const name = cleanString(request.body.name);
  const surname = cleanString(request.body.surname);
  const roleRaw = cleanString(request.body.role).toUpperCase();
  const password = cleanString(request.body.password);
  const clubId = cleanString(request.body.clubId);
  const role = roleRaw === 'ADMIN' ? UserRole.ADMIN : roleRaw === 'JUDGE' ? UserRole.JUDGE : UserRole.USER;

  if (!isValidEmail(email)) jsonError('Enter a valid email.');
  if (!name || !surname) jsonError('Name and surname are required.');
  const passwordError = password ? passwordValidationError(password) : '';
  if (passwordError) jsonError(passwordError);
  if (role === UserRole.USER && !clubId) jsonError('Club is required for players.');

  const result = await createUserByAdmin({
    email,
    name,
    surname,
    role,
    password: password || undefined,
    clubId: clubId || undefined,
  });

  response.status(201).json({
    user: serializeAdminUser(result.user),
    invited: result.invited,
  });
}));

usersRouter.delete('/api/admin/users/:id', asyncHandler(async (request, response) => {
  const admin = await requireCapability(request, Capability.USER_MANAGE);
  const targetId = requireParamId(request.params.id);
  const result = await deleteUserAccount(targetId, admin.id);
  auditLog({
    event: 'admin.user_delete',
    outcome: 'success',
    userId: admin.id,
    ip: requestIp(request),
    detail: targetId,
  });
  if (result.deletedSelf) clearSessionCookie(response);
  response.json({ ok: true });
}));

usersRouter.post('/api/admin/users/:id/disqualify', asyncHandler(async (request, response) => {
  const admin = await requireCapability(request, Capability.USER_MANAGE);

  const untilRaw = cleanString(request.body.until);
  const reason = cleanString(request.body.reason);
  if (!untilRaw) jsonError('Disqualification end date is required.');

  const until = new Date(`${untilRaw}T23:59:59`);
  if (Number.isNaN(until.getTime())) jsonError('Enter a valid end date.');

  const targetId = requireParamId(request.params.id);
  const user = await setUserDisqualification(targetId, { until, reason });
  await revokeUserSessions(targetId);
  auditLog({
    event: 'admin.user_disqualify',
    outcome: 'success',
    userId: admin.id,
    ip: requestIp(request),
    detail: targetId,
  });
  response.json({ user: serializeAdminUser(user) });
}));

usersRouter.delete('/api/admin/users/:id/disqualify', asyncHandler(async (request, response) => {
  const admin = await requireCapability(request, Capability.USER_MANAGE);
  const targetId = requireParamId(request.params.id);
  const user = await setUserDisqualification(targetId, { until: null });
  auditLog({
    event: 'admin.user_undisqualify',
    outcome: 'success',
    userId: admin.id,
    ip: requestIp(request),
    detail: targetId,
  });
  response.json({ user: serializeAdminUser(user) });
}));

usersRouter.delete('/api/account', asyncHandler(async (request, response) => {
  const current = await requireUser(request);
  await deleteUserAccount(current.id, current.id);
  auditLog({
    event: 'account.delete',
    outcome: 'success',
    userId: current.id,
    email: current.email,
    ip: requestIp(request),
  });
  clearSessionCookie(response);
  response.json({ ok: true });
}));
