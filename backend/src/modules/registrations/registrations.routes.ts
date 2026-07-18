import { Router } from 'express';
import { Capability, RegistrationStatus, UserRole } from '../../generated/prisma/client.js';
import { requireUser } from '../auth/auth.service.js';
import {
  asyncHandler,
  cleanEmail,
  cleanString,
  isValidEmail,
  jsonError,
  requireParamId,
} from '../../common/http.js';
import { auditLog, requestIp } from '../../common/audit.js';
import { requireParticipationLegalAcceptance } from '../../common/legal.js';
import { requireCapability } from '../../common/capabilities.js';
import { requireCommandId } from '../../common/commands.js';
import { serializeEvent, serializePublicRegistrationTeam, serializeRegistration } from '../../common/serializers.js';
import {
  createRegistration,
  listAdminRegistrations,
  listPublicRegistrationRoster,
  replaceRegistrationPlayer,
  updateRegistrationRosterPublication,
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
  requireParticipationLegalAcceptance({
    participationTermsAccepted: request.body.participationTermsAccepted,
    refundPolicyAcknowledged: request.body.refundPolicyAcknowledged,
    riskAcknowledged: request.body.riskAcknowledged,
  });

  await createRegistration({
    userId: currentUser.id,
    eventId,
    categoryId,
    ownerPhone,
    teammatePhone,
    teammateEmail,
    legalAcceptedAt: new Date(),
  });

  response.status(201).json({ ok: true });
}));

registrationsRouter.patch('/api/registrations/:id/lineup', asyncHandler(async (request, response) => {
  const currentUser = await requireUser(request);
  if (currentUser.role !== UserRole.USER) {
    jsonError('Only club players can manage a registered team.', 403);
  }
  const slot = cleanString(request.body.slot);
  if (slot !== 'owner' && slot !== 'teammate') {
    jsonError('Choose the player position to replace.');
  }
  const expectedVersion = Number(request.body.expectedVersion);
  if (!Number.isInteger(expectedVersion) || expectedVersion < 0) {
    jsonError('A valid registration version is required.');
  }

  const registration = await replaceRegistrationPlayer({
    registrationId: requireParamId(request.params.id, 'registration id'),
    actorId: currentUser.id,
    slot,
    replacementUserId: requireParamId(request.body.replacementUserId, 'replacement user id'),
    expectedVersion,
    commandId: requireCommandId(request.body.commandId),
  });
  response.json({ registration: serializeRegistration(registration) });
}));

registrationsRouter.get('/api/admin/registrations', asyncHandler(async (request, response) => {
  await requireCapability(request, Capability.REGISTRATION_REVIEW);
  const registrations = await listAdminRegistrations();
  response.json({ registrations: registrations.map(serializeRegistration) });
}));

registrationsRouter.patch('/api/admin/registrations/:id', asyncHandler(async (request, response) => {
  const admin = await requireCapability(request, Capability.REGISTRATION_REVIEW);
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

registrationsRouter.get('/api/admin/events/:eventId/registrations', asyncHandler(async (request, response) => {
  await requireCapability(request, Capability.REGISTRATION_REVIEW);
  const eventId = requireParamId(request.params.eventId, 'event id');
  const registrations = await listAdminRegistrations(eventId);
  response.json({ registrations: registrations.map(serializeRegistration) });
}));

registrationsRouter.patch('/api/admin/events/:eventId/registration-roster-publication', asyncHandler(async (request, response) => {
  const admin = await requireCapability(request, Capability.EVENT_PUBLISH);
  if (typeof request.body.published !== 'boolean') jsonError('Published must be a boolean.');
  const event = await updateRegistrationRosterPublication({
    eventId: requireParamId(request.params.eventId, 'event id'),
    actorId: admin.id,
    published: request.body.published === true,
    expectedVersion: Number(request.body.expectedVersion),
    commandId: requireCommandId(request.body.commandId),
  });
  response.json({ event: serializeEvent(event) });
}));

registrationsRouter.get('/api/public/events/:eventId/registered-teams', asyncHandler(async (request, response) => {
  const registrations = await listPublicRegistrationRoster(requireParamId(request.params.eventId, 'event id'));
  response.json({ teams: registrations.map(serializePublicRegistrationTeam) });
}));

registrationsRouter.patch('/api/admin/events/:eventId/registrations/:id/status', asyncHandler(async (request, response) => {
  const admin = await requireCapability(request, Capability.REGISTRATION_REVIEW);
  const status = cleanString(request.body.status).toUpperCase();
  if (!isRegistrationStatus(status)) jsonError('Invalid registration status.');
  const registration = await updateRegistrationStatus(
    requireParamId(request.params.id),
    status,
    cleanString(request.body.publicReason),
    admin.id,
    {
      eventId: requireParamId(request.params.eventId, 'event id'),
      internalNote: cleanString(request.body.internalNote),
      expectedVersion: Number(request.body.expectedVersion),
      commandId: requireCommandId(request.body.commandId),
    },
  );
  response.json({ registration: serializeRegistration(registration) });
}));
