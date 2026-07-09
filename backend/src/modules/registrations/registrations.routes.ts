import { Router } from 'express';
import { RegistrationStatus, UserRole } from '../../generated/prisma/client.js';
import { requireAdmin, requireUser } from '../auth/auth.service.js';
import {
  asyncHandler,
  cleanEmail,
  cleanString,
  isValidEmail,
  jsonError,
  requireParamId,
} from '../../common/http.js';
import { auditLog, requestIp } from '../../common/audit.js';
import { serializeRegistration } from '../../common/serializers.js';
import {
  createRegistration,
  listAdminRegistrations,
  updateRegistrationStatus,
} from './registrations.service.js';

export const registrationsRouter = Router();

function isRegistrationStatus(status: string): status is RegistrationStatus {
  return Object.values(RegistrationStatus).includes(status as RegistrationStatus);
}

registrationsRouter.post('/api/registrations', asyncHandler(async (request, response) => {
  const currentUser = await requireUser(request);
  const eventId = cleanString(request.body.eventId);
  const categoryId = cleanString(request.body.categoryId);
  const ownerPhone = cleanString(request.body.ownerPhone);
  const teammatePhone = cleanString(request.body.teammatePhone);
  const teammateEmail = cleanEmail(request.body.teammateEmail);

  if (currentUser.role === UserRole.ADMIN) jsonError('Admins cannot register as athletes.', 403);
  if (!eventId || !categoryId) jsonError('Select an event and category.');
  if (ownerPhone.length < 5) jsonError('Your phone number is required.');
  if (!isValidEmail(teammateEmail)) jsonError('Enter teammate email.');
  if (teammateEmail === currentUser.email) {
    jsonError('Teammate email must be different from your email.');
  }

  await createRegistration({
    userId: currentUser.id,
    eventId,
    categoryId,
    ownerPhone,
    teammatePhone,
    teammateEmail,
  });

  response.status(201).json({ ok: true });
}));

registrationsRouter.get('/api/admin/registrations', asyncHandler(async (request, response) => {
  await requireAdmin(request);
  const registrations = await listAdminRegistrations();
  response.json({ registrations: registrations.map(serializeRegistration) });
}));

registrationsRouter.patch('/api/admin/registrations/:id', asyncHandler(async (request, response) => {
  const admin = await requireAdmin(request);
  const status = cleanString(request.body.status).toUpperCase();
  const declineReason = cleanString(request.body.declineReason);

  if (!isRegistrationStatus(status)) jsonError('Invalid registration status.');
  if (status === RegistrationStatus.DECLINED && !declineReason) {
    jsonError('Decline reason is required.');
  }

  const registration = await updateRegistrationStatus(
    requireParamId(request.params.id),
    status,
    declineReason,
    admin.id,
  );

  auditLog({
    event: 'admin.registration_status',
    outcome: 'success',
    userId: admin.id,
    ip: requestIp(request),
    detail: `${registration.id}:${status}`,
  });

  response.json({ registration: serializeRegistration(registration) });
}));
