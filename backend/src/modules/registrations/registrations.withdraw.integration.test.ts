import { beforeEach, describe, expect, it } from 'vitest';
import {
  BracketStatus,
  EventStatus,
  NotificationType,
  RegistrationStatus,
} from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';
import { withdrawRegistration } from './registrations.service.js';
import { createCategory, createEvent, createTeam, resetDb } from '../../test/helpers.js';

beforeEach(resetDb);

/**
 * A club that has entered an open event, ready to pull out of it.
 *
 * Withdrawing is the club's own decision, so these tests are mostly about who
 * is allowed to take it and when it stops being available — which is exactly
 * where an entry sitting in a locked draw would otherwise disappear from a
 * bracket that has already frozen it.
 */
async function enteredTeam(eventOverrides: Parameters<typeof createEvent>[0] = {}) {
  const category = await createCategory();
  const event = await createEvent({
    status: EventStatus.REGISTRATION_OPEN,
    isPublished: true,
    categoryId: category.id,
    ...eventOverrides,
  });
  const team = await createTeam('Alpha');
  const registration = await prisma.eventRegistration.create({
    data: {
      eventId: event.id,
      categoryId: category.id,
      clubId: team.club.id,
      ownerId: team.owner.id,
      teammateId: team.teammate.id,
      ownerPhone: '+995500000001',
      teammateEmail: team.teammate.email,
      teammatePhone: '+995500000002',
      status: RegistrationStatus.APPROVED,
    },
  });
  return { category, event, team, registration };
}

function withdraw(registrationId: string, actorId: string, version: number, reason = '') {
  return withdrawRegistration({
    registrationId,
    actorId,
    reason,
    expectedVersion: version,
    commandId: `withdraw-${registrationId}-${version}`,
  });
}

describe('a club withdrawing its own team', () => {
  it('withdraws the entry, stamps withdrawnAt, and tells both players', async () => {
    const s = await enteredTeam();

    const updated = await withdraw(s.registration.id, s.team.owner.id, s.registration.version, 'Injury');

    expect(updated.status).toBe(RegistrationStatus.WITHDRAWN);
    expect(updated.withdrawnAt).toBeInstanceOf(Date);
    expect(updated.publicStatusReason).toBe('Injury');

    const history = await prisma.registrationStatusHistory.findFirstOrThrow({
      where: { registrationId: s.registration.id },
    });
    expect(history.fromStatus).toBe(RegistrationStatus.APPROVED);
    expect(history.toStatus).toBe(RegistrationStatus.WITHDRAWN);

    const notified = await prisma.notification.findMany({
      where: { entityId: s.registration.id, type: NotificationType.REGISTRATION_WITHDRAWN },
      select: { recipientUserId: true },
    });
    expect(notified.map((row) => row.recipientUserId).sort())
      .toEqual([s.team.owner.id, s.team.teammate.id].sort());

    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: 'registration.withdrawn' } });
    expect(audit.entityId).toBe(s.registration.id);
  });

  it('refuses a member who does not lead the club', async () => {
    const s = await enteredTeam();

    await expect(withdraw(s.registration.id, s.team.teammate.id, s.registration.version))
      .rejects.toMatchObject({ status: 403 });

    const unchanged = await prisma.eventRegistration.findUniqueOrThrow({ where: { id: s.registration.id } });
    expect(unchanged.status).toBe(RegistrationStatus.APPROVED);
  });

  it('does not reveal another club’s entry', async () => {
    const s = await enteredTeam();
    const other = await createTeam('Beta');

    await expect(withdraw(s.registration.id, other.owner.id, s.registration.version))
      .rejects.toMatchObject({ status: 404 });
  });

  it('refuses a stale version rather than acting on it', async () => {
    const s = await enteredTeam();

    await expect(withdraw(s.registration.id, s.team.owner.id, s.registration.version + 5))
      .rejects.toMatchObject({ status: 409 });
  });

  /**
   * The draw has frozen this team into a match by now, so leaving quietly would
   * leave a bracket holding a participant that no longer exists. The way out is
   * a walkover an admin records against the match.
   */
  it('refuses once the draw for that category is locked', async () => {
    const s = await enteredTeam();
    await prisma.bracket.create({
      data: {
        eventId: s.event.id,
        categoryId: s.category.id,
        size: 4,
        status: BracketStatus.LOCKED,
        lockedAt: new Date(),
      },
    });

    await expect(withdraw(s.registration.id, s.team.owner.id, s.registration.version))
      .rejects.toMatchObject({ status: 409, message: expect.stringContaining('draw is locked') });
  });

  it('refuses once the event is under way', async () => {
    const s = await enteredTeam({ status: EventStatus.ONGOING });

    await expect(withdraw(s.registration.id, s.team.owner.id, s.registration.version))
      .rejects.toMatchObject({ status: 409, message: expect.stringContaining('walkover') });
  });

  it('is idempotent on a retry of the same command', async () => {
    const s = await enteredTeam();

    const first = await withdraw(s.registration.id, s.team.owner.id, s.registration.version);
    const replay = await withdraw(s.registration.id, s.team.owner.id, s.registration.version);

    expect(replay.version).toBe(first.version);
    expect(await prisma.registrationStatusHistory.count({ where: { registrationId: s.registration.id } })).toBe(1);
  });
});
