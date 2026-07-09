import { Router } from 'express';
import { UserRole } from '../../generated/prisma/client.js';
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
  requireAdmin,
  requireUser,
  revokeUserSessions,
} from '../auth/auth.service.js';
import { auditLog, requestIp } from '../../common/audit.js';
import {
  createUserByAdmin,
  deleteUserAccount,
  listUsers,
  setUserDisqualification,
} from './users.service.js';

export const usersRouter = Router();

usersRouter.get('/api/admin/users', asyncHandler(async (request, response) => {
  await requireAdmin(request);
  const users = await listUsers();
  response.json({ users: users.map(serializeAdminUser) });
}));

usersRouter.post('/api/admin/users', asyncHandler(async (request, response) => {
  await requireAdmin(request);

  const email = cleanEmail(request.body.email);
  const name = cleanString(request.body.name);
  const surname = cleanString(request.body.surname);
  const roleRaw = cleanString(request.body.role).toUpperCase();
  const password = cleanString(request.body.password);
  const clubId = cleanString(request.body.clubId);
  const role = roleRaw === 'ADMIN' ? UserRole.ADMIN : UserRole.USER;

  if (!isValidEmail(email)) jsonError('Enter a valid email.');
  if (!name || !surname) jsonError('Name and surname are required.');
  if (password && password.length < 8) {
    jsonError('Password must be at least 8 characters.');
  }
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
  const admin = await requireAdmin(request);
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
  const admin = await requireAdmin(request);

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
  const admin = await requireAdmin(request);
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
