import { beforeEach, describe, expect, it } from 'vitest';
import { ClubApplicationStatus, ClubMembershipRole, UserStatus } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';
import { createAdmin, createUser, resetDb } from '../../test/helpers.js';
import {
  approveApplication,
  rejectApplication,
  startApplication,
  submitApplication,
  updateApplicationDraft,
  verifyApplicationEmail,
} from './club-applications.service.js';
import { resolveClubSlug } from '../clubs/clubs.service.js';

const APPLICANT = {
  email: 'applicant@example.test',
  name: 'Nia',
  surname: 'Beridze',
  phone: '+995500111222',
  password: 'a-long-enough-password',
  legalAccepted: true,
  eligibilityConfirmed: true,
};

/** Walk an applicant to the point an admin can decide on them. */
async function submitFullApplication(overrides: Partial<typeof APPLICANT> = {}, mateEmail?: string) {
  const input = { ...APPLICANT, ...overrides };
  await startApplication(input);

  // The stored code is hashed, so verify through the row we just created.
  const application = await prisma.clubApplication.findUniqueOrThrow({ where: { email: input.email } });
  await prisma.clubApplication.update({
    where: { id: application.id },
    data: { emailVerifiedAt: new Date() },
  });

  await updateApplicationDraft(application.id, {
    clubName: 'Vake Padel',
    clubDescription: 'A club from Vake.',
    ...(mateEmail ? { mateEmail, mateName: 'Gio', mateSurname: 'Kapanadze' } : {}),
  });
  return submitApplication(application.id);
}

describe('club applications', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('creates no user, club, or membership before approval', async () => {
    const submitted = await submitFullApplication();

    expect(submitted.status).toBe(ClubApplicationStatus.SUBMITTED);
    expect(await prisma.user.count({ where: { email: APPLICANT.email } })).toBe(0);
    expect(await prisma.club.count()).toBe(0);
    expect(await prisma.clubMember.count()).toBe(0);
  });

  it('materialises the account, club, and leader membership on approval', async () => {
    const admin = await createAdmin();
    const application = await submitFullApplication();

    const result = await approveApplication({ applicationId: application.id, actorId: admin.id });

    const user = await prisma.user.findUniqueOrThrow({ where: { email: APPLICANT.email } });
    expect(user.status).toBe(UserStatus.ACTIVE);
    expect(user.passwordHash).toBeTruthy();
    expect(user.phone).toBe(APPLICANT.phone);

    const membership = await prisma.clubMember.findUniqueOrThrow({ where: { userId: user.id } });
    expect(membership.clubId).toBe(result.club.id);
    expect(membership.membershipRole).toBe(ClubMembershipRole.LEADER);

    // The holding pen is emptied once its contents are real records.
    expect(await prisma.clubApplication.count()).toBe(0);
  });

  it('invites the group mate named on an approved request', async () => {
    const admin = await createAdmin();
    const application = await submitFullApplication({}, 'mate@example.test');

    const result = await approveApplication({ applicationId: application.id, actorId: admin.id });
    expect(result.mateInvited).toBe(true);

    const mate = await prisma.user.findUniqueOrThrow({ where: { email: 'mate@example.test' } });
    expect(mate.status).toBe(UserStatus.INVITED);
    const membership = await prisma.clubMember.findUniqueOrThrow({ where: { userId: mate.id } });
    expect(membership.clubId).toBe(result.club.id);
    expect(await prisma.inviteToken.count({ where: { userId: mate.id } })).toBe(1);
  });

  it('erases everything on rejection and frees the email to apply again', async () => {
    const admin = await createAdmin();
    const application = await submitFullApplication();

    await rejectApplication({
      applicationId: application.id,
      actorId: admin.id,
      reason: 'Club name is already in use offline.',
    });

    expect(await prisma.clubApplication.count()).toBe(0);
    expect(await prisma.clubApplicationCode.count()).toBe(0);
    expect(await prisma.user.count({ where: { email: APPLICANT.email } })).toBe(0);

    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: 'club_application.reject' } });
    expect(audit.publicReason).toBe('Club name is already in use offline.');
    // Accountability without keeping the rejected applicant's details.
    expect(JSON.stringify(audit.after)).not.toContain(APPLICANT.email);

    // The whole point: the same address can apply again immediately.
    const retry = await submitFullApplication();
    expect(retry.status).toBe(ClubApplicationStatus.SUBMITTED);
  });

  it('refuses a request for an address that already has an account', async () => {
    await createUser({ email: APPLICANT.email });
    await expect(startApplication(APPLICANT)).rejects.toMatchObject({ status: 409 });
  });

  it('resolves a free club slug when the obvious one is taken', async () => {
    await prisma.club.create({ data: { name: 'Vake Padel', slug: 'vake-padel' } });
    expect(await resolveClubSlug('Vake Padel')).toBe('vake-padel-2');

    await prisma.club.create({ data: { name: 'Vake Padel', slug: 'vake-padel-2' } });
    expect(await resolveClubSlug('Vake Padel')).toBe('vake-padel-3');
  });
});
