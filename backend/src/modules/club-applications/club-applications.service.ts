import crypto from 'crypto';
import {
  ClubApplicationStatus,
  UserStatus,
  type ClubApplication,
  type Prisma,
} from '../../generated/prisma/client.js';
import { isValidEmail, jsonError } from '../../common/http.js';
import { prisma } from '../../database/prisma.js';
import {
  addDays,
  addMinutes,
  compareSecret,
  createVerificationCode,
  hashSecret,
  passwordValidationError,
} from '../../common/security.js';
import {
  ACCOUNT_TERMS_VERSION,
  PRIVACY_POLICY_VERSION,
  requireAccountLegalAcceptance,
} from '../../common/legal.js';
import {
  notifyAfterCommit,
  sendClubApplicationApprovedEmail,
  sendClubApplicationMessageEmail,
  sendClubApplicationReceivedEmail,
  sendClubApplicationRejectedEmail,
  sendVerificationCodeEmail,
} from '../../common/notifications.js';
import { cursorArgs, toPage, type ListRange } from '../../common/pagination.js';
import { roleForEmail } from '../auth/auth.service.js';
import { inviteClubMate, resolveClubSlug, setPlayerClub } from '../clubs/clubs.service.js';
import { ClubMembershipRole } from '../../generated/prisma/client.js';

/** Unsubmitted drafts live this long before the purge sweep removes them. */
const DRAFT_LIFETIME_DAYS = 7;
const CODE_LIFETIME_MINUTES = 30;

export type ApplicantView = {
  id: string;
  email: string;
  name: string;
  surname: string;
  phone: string;
  status: ClubApplicationStatus;
  emailVerified: boolean;
  clubName: string;
  clubDescription: string;
  mateEmail: string;
  mateName: string;
  mateSurname: string;
  matePhone: string;
  submittedAt: string | null;
};

export function toApplicantView(application: ClubApplication): ApplicantView {
  return {
    id: application.id,
    email: application.email,
    name: application.name,
    surname: application.surname,
    phone: application.phone,
    status: application.status,
    emailVerified: Boolean(application.emailVerifiedAt),
    clubName: application.clubName ?? '',
    clubDescription: application.clubDescription ?? '',
    mateEmail: application.mateEmail ?? '',
    mateName: application.mateName ?? '',
    mateSurname: application.mateSurname ?? '',
    matePhone: application.matePhone ?? '',
    submittedAt: application.submittedAt?.toISOString() ?? null,
  };
}

/**
 * Drop drafts nobody finished. Called opportunistically from the endpoints that
 * touch the table, so no extra worker is needed to keep it small.
 */
export async function purgeExpiredApplications() {
  await prisma.clubApplication.deleteMany({
    where: {
      status: ClubApplicationStatus.PENDING_VERIFICATION,
      expiresAt: { lt: new Date() },
    },
  });
}

/**
 * Any active account owns its address, password-based or Google-only. Checking
 * for a password hash too would let an application be filed against a Google
 * user and then fail on the unique index at approval time.
 */
async function requireEmailIsFree(email: string) {
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { status: true },
  });
  if (existing?.status === UserStatus.ACTIVE) {
    jsonError('This email is already registered.', 409);
  }
}

type StartApplicationInput = {
  email: string;
  name: string;
  surname: string;
  phone: string;
  password: string;
  legalAccepted: unknown;
  eligibilityConfirmed: unknown;
};

/** Step one: capture the applicant and email them a verification code. */
export async function startApplication(input: StartApplicationInput) {
  const { email, name, surname, phone, password } = input;

  requireAccountLegalAcceptance({
    legalAccepted: input.legalAccepted,
    eligibilityConfirmed: input.eligibilityConfirmed,
  });

  if (!isValidEmail(email)) jsonError('Enter a valid email.');
  if (!name || !surname) jsonError('Name and surname are required.');
  if (phone.length < 5) jsonError('Phone number is required.');
  const passwordError = passwordValidationError(password);
  if (passwordError) jsonError(passwordError);

  await purgeExpiredApplications();
  await requireEmailIsFree(email);

  const pending = await prisma.clubApplication.findUnique({ where: { email } });
  if (pending?.status === ClubApplicationStatus.SUBMITTED) {
    jsonError('A request for this email is already awaiting review.', 409);
  }

  const acceptedAt = new Date();
  const data = {
    name,
    surname,
    phone,
    passwordHash: await hashSecret(password),
    termsAcceptedAt: acceptedAt,
    termsVersion: ACCOUNT_TERMS_VERSION,
    privacyAcknowledgedAt: acceptedAt,
    privacyVersion: PRIVACY_POLICY_VERSION,
    eligibilityConfirmedAt: acceptedAt,
    status: ClubApplicationStatus.PENDING_VERIFICATION,
    emailVerifiedAt: null,
    expiresAt: addDays(DRAFT_LIFETIME_DAYS),
  };

  const application = await prisma.clubApplication.upsert({
    where: { email },
    update: data,
    create: { email, ...data },
  });

  const code = createVerificationCode();
  await prisma.clubApplicationCode.create({
    data: {
      applicationId: application.id,
      codeHash: await hashSecret(code),
      expiresAt: addMinutes(CODE_LIFETIME_MINUTES),
    },
  });

  await sendVerificationCodeEmail(email, code);
  return application;
}

/**
 * Google has already proven the address, so a Google applicant skips the code
 * step and lands straight on the club form. An unfinished request for the same
 * address is reused rather than duplicated.
 */
export async function startGoogleApplication(input: {
  email: string;
  name: string;
  surname: string;
  googleAccountId: string;
}) {
  await purgeExpiredApplications();
  await requireEmailIsFree(input.email);

  const existing = await prisma.clubApplication.findUnique({ where: { email: input.email } });
  if (existing?.status === ClubApplicationStatus.SUBMITTED) return existing;

  const acceptedAt = new Date();
  const verifiedAt = existing?.emailVerifiedAt ?? acceptedAt;
  const data = {
    name: existing?.name || input.name,
    surname: existing?.surname || input.surname,
    googleAccountId: input.googleAccountId,
    termsAcceptedAt: existing?.termsAcceptedAt ?? acceptedAt,
    termsVersion: ACCOUNT_TERMS_VERSION,
    privacyAcknowledgedAt: existing?.privacyAcknowledgedAt ?? acceptedAt,
    privacyVersion: PRIVACY_POLICY_VERSION,
    eligibilityConfirmedAt: existing?.eligibilityConfirmedAt ?? acceptedAt,
    emailVerifiedAt: verifiedAt,
    expiresAt: addDays(DRAFT_LIFETIME_DAYS),
  };

  return prisma.clubApplication.upsert({
    where: { email: input.email },
    update: data,
    create: { email: input.email, phone: '', ...data },
  });
}

/** Step two: prove the address, so admins only ever review reachable applicants. */
export async function verifyApplicationEmail(email: string, code: string) {
  if (!email || !code) jsonError('Email and code are required.');

  const application = await prisma.clubApplication.findUnique({ where: { email } });
  if (!application) jsonError('Request not found. Start again to receive a new code.', 404);

  const verification = await prisma.clubApplicationCode.findFirst({
    where: { applicationId: application.id, usedAt: null },
    orderBy: { createdAt: 'desc' },
  });

  if (!verification) {
    jsonError('No verification code found. Start again to receive a new code.');
  }
  if (verification.expiresAt.getTime() <= Date.now()) {
    jsonError('Verification code expired. Start again to receive a new code.');
  }
  if (!(await compareSecret(code, verification.codeHash))) {
    jsonError('Incorrect verification code.', 401);
  }

  return prisma.$transaction(async (tx) => {
    await tx.clubApplicationCode.update({
      where: { id: verification.id },
      data: { usedAt: new Date() },
    });
    return tx.clubApplication.update({
      where: { id: application.id },
      data: { emailVerifiedAt: application.emailVerifiedAt ?? new Date() },
    });
  });
}

export async function getOpenApplication(applicationId: string) {
  const application = await prisma.clubApplication.findUnique({ where: { id: applicationId } });
  if (!application) jsonError('Request not found.', 404);
  if (!application.emailVerifiedAt) jsonError('Confirm your email address first.', 403);
  return application;
}

type ApplicationDraftInput = {
  clubName?: string;
  clubDescription?: string;
  mateEmail?: string;
  mateName?: string;
  mateSurname?: string;
  matePhone?: string;
};

/** Steps three and four: the club, then the optional group mate. */
export async function updateApplicationDraft(applicationId: string, input: ApplicationDraftInput) {
  const application = await getOpenApplication(applicationId);
  if (application.status === ClubApplicationStatus.SUBMITTED) {
    jsonError('This request is already awaiting review.', 409);
  }

  const data: Prisma.ClubApplicationUpdateInput = {};

  if (input.clubName !== undefined) {
    if (input.clubName.trim().length < 2) jsonError('Club name is required.');
    data.clubName = input.clubName.trim();
  }
  if (input.clubDescription !== undefined) {
    data.clubDescription = input.clubDescription.trim() || null;
  }

  if (input.mateEmail !== undefined) {
    const mateEmail = input.mateEmail.trim().toLowerCase();
    if (mateEmail) {
      if (!isValidEmail(mateEmail)) jsonError('Enter a valid teammate email.');
      if (mateEmail === application.email) jsonError('You cannot add yourself as a group mate.');
      if (!input.mateName?.trim() || !input.mateSurname?.trim()) {
        jsonError('Teammate name and surname are required.');
      }
      // Fail here rather than at approval, while the applicant can still fix it.
      const existing = await prisma.user.findUnique({
        where: { email: mateEmail },
        select: { status: true },
      });
      if (existing?.status === UserStatus.ACTIVE) {
        jsonError('This user already has an account. They must join the club themselves.', 409);
      }
    }
    data.mateEmail = mateEmail || null;
    data.mateName = input.mateName?.trim() || null;
    data.mateSurname = input.mateSurname?.trim() || null;
    data.matePhone = input.matePhone?.trim() || null;
  }

  return prisma.clubApplication.update({ where: { id: application.id }, data });
}

/** Hand the finished request to the admins. */
export async function submitApplication(applicationId: string) {
  const application = await getOpenApplication(applicationId);
  if (application.status === ClubApplicationStatus.SUBMITTED) return application;
  if (!application.clubName) jsonError('Create your club first.', 400);

  await requireEmailIsFree(application.email);

  const submitted = await prisma.clubApplication.update({
    where: { id: application.id },
    data: {
      status: ClubApplicationStatus.SUBMITTED,
      submittedAt: new Date(),
      // Submitted requests are never purged; only admins clear them.
      expiresAt: addDays(365),
    },
  });

  // The request is filed either way; a bounced confirmation must not show the
  // applicant an error for something that actually went through.
  await notifyAfterCommit('club_application.received', () =>
    sendClubApplicationReceivedEmail(submitted.email, submitted.clubName!, submitted.mateEmail));
  return submitted;
}

export async function listSubmittedApplications(range: ListRange = {}) {
  await purgeExpiredApplications();
  const { take, pageSize, ...cursor } = cursorArgs(range);
  const rows = await prisma.clubApplication.findMany({
    where: { status: ClubApplicationStatus.SUBMITTED },
    orderBy: [{ submittedAt: 'asc' }, { id: 'asc' }],
    take,
    ...cursor,
  });
  return toPage(rows, pageSize);
}

export async function countSubmittedApplications() {
  return prisma.clubApplication.count({ where: { status: ClubApplicationStatus.SUBMITTED } });
}

export async function requireSubmittedApplication(applicationId: string) {
  const application = await prisma.clubApplication.findUnique({
    where: { id: applicationId },
    include: { messages: { orderBy: { sentAt: 'desc' } } },
  });
  if (!application) jsonError('Request not found.', 404);
  if (application.status !== ClubApplicationStatus.SUBMITTED) {
    jsonError('This request is not awaiting review.', 409);
  }
  return application;
}

/**
 * Turn an approved request into the real records. Everything the applicant
 * entered moves across in one transaction, then the request itself is deleted:
 * it was only ever a holding pen.
 */
export async function approveApplication(input: {
  applicationId: string;
  actorId: string;
  ip?: string | null;
}) {
  const application = await requireSubmittedApplication(input.applicationId);
  await requireEmailIsFree(application.email);

  // Slug collisions must be resolved before the transaction: a unique violation
  // inside one aborts it, leaving nothing to retry on.
  const slug = (await resolveClubSlug(application.clubName!))!;

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: application.email,
        name: application.name,
        surname: application.surname,
        phone: application.phone,
        passwordHash: application.passwordHash,
        role: roleForEmail(application.email, undefined, { emailVerified: true }),
        status: UserStatus.ACTIVE,
        emailVerifiedAt: application.emailVerifiedAt ?? new Date(),
        termsAcceptedAt: application.termsAcceptedAt,
        termsVersion: application.termsVersion,
        privacyAcknowledgedAt: application.privacyAcknowledgedAt,
        privacyVersion: application.privacyVersion,
        eligibilityConfirmedAt: application.eligibilityConfirmedAt,
      },
    });

    if (application.googleAccountId) {
      await tx.oAuthAccount.create({
        data: {
          userId: user.id,
          provider: 'GOOGLE',
          providerAccountId: application.googleAccountId,
        },
      });
    }

    const club = await tx.club.create({
      data: {
        name: application.clubName!,
        slug,
        description: application.clubDescription,
      },
    });
    await setPlayerClub(user.id, club.id, '', tx, ClubMembershipRole.LEADER);

    await tx.auditLog.create({
      data: {
        action: 'club_application.approve',
        actorId: input.actorId,
        entityType: 'ClubApplication',
        entityId: application.id,
        after: { userId: user.id, clubId: club.id },
        ip: input.ip ?? undefined,
      },
    });

    await tx.clubApplication.delete({ where: { id: application.id } });

    return { user, club };
  });

  // Outside the transaction: the mate invite sends its own email, and a bounced
  // teammate address must not roll back an approval the admin already made.
  let mateInvited = false;
  if (application.mateEmail) {
    try {
      const invite = await inviteClubMate({
        clubId: result.club.id,
        clubName: result.club.name,
        inviterName: [application.name, application.surname].filter(Boolean).join(' '),
        inviterEmail: application.email,
        email: application.mateEmail,
        name: application.mateName ?? '',
        surname: application.mateSurname ?? '',
        phone: application.matePhone ?? undefined,
      });
      mateInvited = invite.invited;
    } catch (error) {
      console.error('[club-application] mate invite failed', {
        clubId: result.club.id,
        error: error instanceof Error ? error.message : error,
      });
    }
  }

  const emailed = await notifyAfterCommit('club_application.approved', () =>
    sendClubApplicationApprovedEmail(result.user.email, result.club.name));
  return { user: result.user, club: result.club, mateInvited, emailed };
}

/**
 * Reject and erase. Nothing the applicant entered survives, so the address is
 * immediately free to apply again; the audit trail keeps only a hash of it.
 */
export async function rejectApplication(input: {
  applicationId: string;
  actorId: string;
  reason: string;
  ip?: string | null;
}) {
  const application = await requireSubmittedApplication(input.applicationId);
  const { email } = application;
  const reason = input.reason.trim();

  await prisma.$transaction(async (tx) => {
    await tx.auditLog.create({
      data: {
        action: 'club_application.reject',
        actorId: input.actorId,
        entityType: 'ClubApplication',
        entityId: application.id,
        // Deliberately a hash: a rejected applicant leaves no personal data behind.
        after: { emailHash: crypto.createHash('sha256').update(email).digest('hex') },
        publicReason: reason || undefined,
        ip: input.ip ?? undefined,
      },
    });
    await tx.clubApplication.delete({ where: { id: application.id } });
  });

  // The request is already gone; a bounced email cannot un-reject it.
  return { emailed: await notifyAfterCommit('club_application.rejected', () =>
    sendClubApplicationRejectedEmail(email, reason)) };
}

/** Write directly to an applicant while their request is still open. */
export async function messageApplicant(input: {
  applicationId: string;
  actorId: string;
  subject: string;
  body: string;
}) {
  const application = await requireSubmittedApplication(input.applicationId);
  const subject = input.subject.trim();
  const body = input.body.trim();

  if (!subject) jsonError('Subject is required.');
  if (!body) jsonError('Message is required.');

  // Send first: the row is a record of what actually reached the applicant, so
  // a failed send must not leave the admin looking at a message they never got.
  await sendClubApplicationMessageEmail(application.email, subject, body);

  return prisma.clubApplicationMessage.create({
    data: {
      applicationId: application.id,
      actorId: input.actorId,
      subject,
      body,
    },
  });
}
