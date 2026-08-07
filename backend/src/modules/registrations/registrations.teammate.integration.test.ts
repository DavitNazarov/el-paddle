import { beforeEach, describe, expect, it } from 'vitest';
import { EventStatus, RegistrationStatus, UserStatus } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';
import { createRegistration } from './registrations.service.js';
import { createCategory, createEvent, createTeam, resetDb } from '../../test/helpers.js';

beforeEach(resetDb);

/**
 * An open event plus a club whose owner is entering. `createTeam` gives both
 * players an active account in one club, which each test then spoils.
 */
async function setupRegistration() {
  const category = await createCategory();
  const event = await createEvent({ status: EventStatus.REGISTRATION_OPEN, isPublished: true, categoryId: category.id });
  const team = await createTeam('Alpha');
  return { category, event, team };
}

function register(
  s: Awaited<ReturnType<typeof setupRegistration>>,
  teammateEmail: string,
) {
  return createRegistration({
    userId: s.team.owner.id,
    eventId: s.event.id,
    categoryId: s.category.id,
    ownerPhone: '+995500000001',
    teammatePhone: '+995500000002',
    teammateEmail,
    legalAcceptedAt: new Date(),
  });
}

describe('registration requires an accepted teammate', () => {
  it('registers a teammate who has an active account in the same club', async () => {
    const s = await setupRegistration();

    await register(s, s.team.teammate.email);

    const entry = await prisma.eventRegistration.findFirstOrThrow({ where: { eventId: s.event.id } });
    expect(entry.teammateId).toBe(s.team.teammate.id);
    expect(entry.status).toBe(RegistrationStatus.PENDING);
  });

  it('refuses a teammate who has not accepted their club invitation', async () => {
    const s = await setupRegistration();
    await prisma.user.update({ where: { id: s.team.teammate.id }, data: { status: UserStatus.INVITED } });

    await expect(register(s, s.team.teammate.email)).rejects.toMatchObject({
      status: 403,
      message: expect.stringContaining('has not accepted their invitation yet'),
    });
    expect(await prisma.eventRegistration.count({ where: { eventId: s.event.id } })).toBe(0);
  });

  it('refuses a teammate who has not verified their email', async () => {
    const s = await setupRegistration();
    await prisma.user.update({
      where: { id: s.team.teammate.id },
      data: { status: UserStatus.PENDING_VERIFICATION },
    });

    await expect(register(s, s.team.teammate.email)).rejects.toMatchObject({
      status: 403,
      message: expect.stringContaining('has not verified their email address yet'),
    });
  });

  it('refuses an email that belongs to nobody instead of creating the account', async () => {
    const s = await setupRegistration();

    await expect(register(s, 'stranger@example.test')).rejects.toMatchObject({
      status: 403,
      message: expect.stringContaining('does not have an El Padel account yet'),
    });

    // The old flow created the teammate here and emailed them an invitation.
    // Registration must no longer be a way to bring an account into existence.
    expect(await prisma.user.count({ where: { email: 'stranger@example.test' } })).toBe(0);
    expect(await prisma.eventRegistration.count({ where: { eventId: s.event.id } })).toBe(0);
  });

  it('never issues an invite token from the registration path', async () => {
    const s = await setupRegistration();

    await register(s, s.team.teammate.email);

    expect(await prisma.inviteToken.count()).toBe(0);
  });

  it('still refuses a teammate from another club', async () => {
    const s = await setupRegistration();
    const outsider = await createTeam('Bravo');

    await expect(register(s, outsider.owner.email)).rejects.toMatchObject({
      status: 403,
      message: 'Teammates must belong to the same club.',
    });
  });
});
