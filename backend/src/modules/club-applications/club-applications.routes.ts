import { Router } from 'express';
import { Capability } from '../../generated/prisma/client.js';
import {
  asyncHandler,
  cleanEmail,
  cleanString,
  jsonError,
  requireParamId,
} from '../../common/http.js';
import { consumeLimit, rateLimit } from '../../common/rateLimit.js';
import { requireCapability } from '../../common/capabilities.js';
import { parseListRange } from '../../common/pagination.js';
import { auditLog, requestIp } from '../../common/audit.js';
import {
  clearApplicationCookie,
  readApplicationId,
  setApplicationCookie,
} from '../auth/auth.service.js';
import {
  approveApplication,
  getOpenApplication,
  listSubmittedApplications,
  messageApplicant,
  rejectApplication,
  requireSubmittedApplication,
  resendApplicationVerificationCode,
  startApplication,
  submitApplication,
  toApplicantView,
  toReviewerView,
  updateApplicationDraft,
  verifyApplicationEmail,
} from './club-applications.service.js';

export const clubApplicationsRouter = Router();

const applicationBurstLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, keyPrefix: 'application' });
const applicationStrictLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, keyPrefix: 'application-strict' });

function requireApplicationId(request: Parameters<typeof readApplicationId>[0]) {
  const applicationId = readApplicationId(request);
  if (!applicationId) jsonError('Start your request again.', 401);
  return applicationId;
}

function serializeMessage(message: { id: string; subject: string; body: string; sentAt: Date }) {
  return {
    id: message.id,
    subject: message.subject,
    body: message.body,
    sentAt: message.sentAt.toISOString(),
  };
}

clubApplicationsRouter.post('/api/applications', applicationBurstLimit, asyncHandler(async (request, response) => {
  const email = cleanEmail(request.body.email);
  await startApplication({
    email,
    name: cleanString(request.body.name),
    surname: cleanString(request.body.surname),
    phone: cleanString(request.body.phone),
    password: cleanString(request.body.password),
    legalAccepted: request.body.legalAccepted,
    eligibilityConfirmed: request.body.eligibilityConfirmed,
  });
  response.status(201).json({ ok: true, email, message: 'Verification code sent.' });
}));

clubApplicationsRouter.post('/api/applications/verify', applicationStrictLimit, asyncHandler(async (request, response) => {
  const email = cleanEmail(request.body.email);
  // A six-digit code is a 900k space, and an address-keyed limiter counts an
  // attacker's addresses rather than their guesses at one address. Ten tries per
  // window against a given application is the bound that makes the code's size
  // mean something; a real applicant needs one or two.
  consumeLimit({ windowMs: 15 * 60 * 1000, max: 10, keyPrefix: 'application-verify', subject: email });

  const application = await verifyApplicationEmail(
    email,
    cleanString(request.body.code),
  );
  setApplicationCookie(response, application.id);
  response.json({ application: toApplicantView(application) });
}));

clubApplicationsRouter.post('/api/applications/resend-code', applicationStrictLimit, asyncHandler(async (request, response) => {
  const email = cleanEmail(request.body.email);
  // One code every 30 seconds per address. The UI countdown mirrors this; the
  // subject-keyed limiter is what stops a script from burning the mailbox.
  consumeLimit({ windowMs: 30_000, max: 1, keyPrefix: 'application-resend', subject: email });

  await resendApplicationVerificationCode(email);
  response.json({ ok: true, email, message: 'Verification code sent.' });
}));

clubApplicationsRouter.get('/api/applications/current', asyncHandler(async (request, response) => {
  const applicationId = readApplicationId(request);
  if (!applicationId) {
    response.json({ application: null });
    return;
  }
  const application = await getOpenApplication(applicationId);
  response.json({ application: toApplicantView(application) });
}));

clubApplicationsRouter.patch('/api/applications/current', asyncHandler(async (request, response) => {
  const body = request.body as Record<string, unknown>;
  const application = await updateApplicationDraft(requireApplicationId(request), {
    clubName: body.clubName === undefined ? undefined : cleanString(body.clubName),
    clubDescription: body.clubDescription === undefined ? undefined : cleanString(body.clubDescription),
    mateEmail: body.mateEmail === undefined ? undefined : cleanEmail(body.mateEmail),
    mateName: body.mateName === undefined ? undefined : cleanString(body.mateName),
    mateSurname: body.mateSurname === undefined ? undefined : cleanString(body.mateSurname),
    matePhone: body.matePhone === undefined ? undefined : cleanString(body.matePhone),
  });
  response.json({ application: toApplicantView(application) });
}));

clubApplicationsRouter.post('/api/applications/current/submit', asyncHandler(async (request, response) => {
  const application = await submitApplication(requireApplicationId(request));
  response.json({ application: toApplicantView(application) });
}));

clubApplicationsRouter.post('/api/applications/current/abandon', asyncHandler(async (request, response) => {
  clearApplicationCookie(response);
  response.json({ ok: true });
}));

clubApplicationsRouter.get('/api/admin/club-applications', asyncHandler(async (request, response) => {
  await requireCapability(request, Capability.CLUB_APPLICATION_REVIEW);
  const page = await listSubmittedApplications(parseListRange(request.query));
  response.json({
    applications: page.items.map(toReviewerView),
    nextCursor: page.nextCursor,
  });
}));

clubApplicationsRouter.get('/api/admin/club-applications/:id', asyncHandler(async (request, response) => {
  await requireCapability(request, Capability.CLUB_APPLICATION_REVIEW);
  const application = await requireSubmittedApplication(requireParamId(request.params.id));
  response.json({
    application: toReviewerView(application),
    messages: application.messages.map(serializeMessage),
  });
}));

clubApplicationsRouter.post('/api/admin/club-applications/:id/approve', asyncHandler(async (request, response) => {
  const admin = await requireCapability(request, Capability.CLUB_APPLICATION_REVIEW);
  const result = await approveApplication({
    applicationId: requireParamId(request.params.id),
    actorId: admin.id,
    ip: requestIp(request),
  });
  auditLog({
    event: 'admin.club_application_approve',
    outcome: 'success',
    userId: admin.id,
    ip: requestIp(request),
    detail: result.club.id,
  });
  response.json({ ok: true, clubId: result.club.id, mateInvited: result.mateInvited });
}));

clubApplicationsRouter.post('/api/admin/club-applications/:id/reject', asyncHandler(async (request, response) => {
  const admin = await requireCapability(request, Capability.CLUB_APPLICATION_REVIEW);
  const reason = cleanString(request.body.reason);
  if (!reason) jsonError('A reason is required so the applicant knows why.');

  const applicationId = requireParamId(request.params.id);
  await rejectApplication({
    applicationId,
    actorId: admin.id,
    reason,
    ip: requestIp(request),
  });
  auditLog({
    event: 'admin.club_application_reject',
    outcome: 'success',
    userId: admin.id,
    ip: requestIp(request),
    detail: applicationId,
  });
  response.json({ ok: true });
}));

clubApplicationsRouter.post('/api/admin/club-applications/:id/message', asyncHandler(async (request, response) => {
  const admin = await requireCapability(request, Capability.CLUB_APPLICATION_REVIEW);
  const message = await messageApplicant({
    applicationId: requireParamId(request.params.id),
    actorId: admin.id,
    subject: cleanString(request.body.subject),
    body: cleanString(request.body.body),
  });
  response.status(201).json({ message: serializeMessage(message) });
}));
