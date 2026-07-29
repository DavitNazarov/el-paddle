import { Router } from 'express';
import { Capability, UserRole } from '../../generated/prisma/client.js';
import {
  asyncHandler,
  cleanEmail,
  cleanString,
  isValidEmail,
  jsonError,
  requireParamId,
  setPublicCache,
} from '../../common/http.js';
import { serializeAdminUser } from '../../common/serializers.js';
import {
  clearSessionCookie,
  getCurrentUser,
  requireUser,
  revokeUserSessions,
  setSessionCookie,
} from '../auth/auth.service.js';
import { auditLog, requestIp } from '../../common/audit.js';
import { passwordValidationError } from '../../common/security.js';
import { requireCapability } from '../../common/capabilities.js';
import { parseListRange } from '../../common/pagination.js';
import { rateLimit } from '../../common/rateLimit.js';
import {
  changeOwnPassword,
  createUserByAdmin,
  deleteUserAccount,
  getOwnAccount,
  getPublicPlayer,
  listPublicPlayers,
  listUsers,
  setUserDisqualification,
  setJudgeActive,
  updateOwnProfile,
} from './users.service.js';

export const usersRouter = Router();

const accountPasswordLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyPrefix: 'account-password',
});

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
  setPublicCache(response);
  response.json({
    players: page.items.map(serializePublicPlayer),
    nextCursor: page.nextCursor,
  });
}));

usersRouter.get('/api/public/players/:id', asyncHandler(async (request, response) => {
  const player = await getPublicPlayer(requireParamId(request.params.id, 'player id'));
  setPublicCache(response);
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
  const role =
    roleRaw === 'ADMIN' ? UserRole.ADMIN
      : roleRaw === 'JUDGE' ? UserRole.JUDGE
        : roleRaw === 'ORGANISER' ? UserRole.ORGANISER
          : UserRole.USER;

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

usersRouter.get('/api/account/profile', asyncHandler(async (request, response) => {
  const current = await requireUser(request);
  response.json({ profile: await getOwnAccount(current.id) });
}));

usersRouter.patch('/api/account/profile', asyncHandler(async (request, response) => {
  const current = await requireUser(request);

  const name = cleanString(request.body.name);
  const surname = cleanString(request.body.surname);
  const phone = cleanString(request.body.phone);

  if (!name || !surname) jsonError('Name and surname are required.');
  if (phone && phone.length < 5) jsonError('Enter a valid phone number.');

  await updateOwnProfile(current.id, { name, surname, phone });
  auditLog({
    event: 'account.profile_update',
    outcome: 'success',
    userId: current.id,
    email: current.email,
    ip: requestIp(request),
  });

  response.json({ user: await getCurrentUser(request) });
}));

usersRouter.post('/api/account/password', accountPasswordLimit, asyncHandler(async (request, response) => {
  const current = await requireUser(request);

  const currentPassword = cleanString(request.body.currentPassword);
  const newPassword = cleanString(request.body.newPassword);

  const passwordError = passwordValidationError(newPassword);
  if (passwordError) jsonError(passwordError);

  const updated = await changeOwnPassword(current.id, { currentPassword, newPassword });
  auditLog({
    event: 'account.password_change',
    outcome: 'success',
    userId: current.id,
    email: current.email,
    ip: requestIp(request),
  });

  // The change revoked every outstanding session; keep this device signed in.
  setSessionCookie(response, updated);
  response.json({ ok: true });
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
