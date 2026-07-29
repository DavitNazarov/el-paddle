import { beforeEach, describe, expect, it } from 'vitest';
import { UserRole, UserStatus } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';
import { createAdmin, createEvent, createJudge, createUser, resetDb } from '../../test/helpers.js';
import { addEventJudge, assignJudge, listEventJudges, revokeEventJudge } from './scheduling.service.js';

const hourFromNow = (hours: number) => new Date(Date.now() + hours * 60 * 60 * 1000);

async function createCourtFor(eventId: string, name = 'Court 1') {
  return prisma.court.create({ data: { eventId, name } });
}

describe('event judge pool', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('invites a brand-new judge and admits them to the event', async () => {
    const admin = await createAdmin();
    const event = await createEvent();

    const result = await addEventJudge({
      eventId: event.id,
      actorId: admin.id,
      email: 'new.judge@example.test',
      name: 'Tamar',
      surname: 'Kiknadze',
    });

    expect(result.invited).toBe(true);
    expect(result.user.role).toBe(UserRole.JUDGE);
    expect(result.user.status).toBe(UserStatus.INVITED);
    expect(await prisma.inviteToken.count({ where: { userId: result.user.id } })).toBe(1);
    expect(await listEventJudges(event.id)).toHaveLength(1);
  });

  it('refuses an address that already belongs to a player', async () => {
    const admin = await createAdmin();
    const event = await createEvent();
    const player = await createUser();

    await expect(
      addEventJudge({ eventId: event.id, actorId: admin.id, email: player.email, name: 'A', surname: 'B' }),
    ).rejects.toMatchObject({ status: 409 });

    // Changing someone's role stays an admin act under USER_MANAGE.
    const unchanged = await prisma.user.findUniqueOrThrow({ where: { id: player.id } });
    expect(unchanged.role).toBe(UserRole.USER);
  });

  it('keeps one event judges out of another event schedule', async () => {
    const admin = await createAdmin();
    const organiser = await createUser({ role: UserRole.ORGANISER });
    const mine = await createEvent({ title: 'Mine' });
    const theirs = await createEvent({ title: 'Theirs' });
    const court = await createCourtFor(mine.id);

    const foreignJudge = await createJudge();
    await prisma.eventJudge.create({ data: { eventId: theirs.id, userId: foreignJudge.id } });

    // An organiser may only draw from the pool built for their own event.
    await expect(
      assignJudge({
        eventId: mine.id,
        courtId: court.id,
        judgeId: foreignJudge.id,
        actorId: organiser.id,
        canManageAllJudges: false,
        startsAt: hourFromNow(1),
        endsAt: hourFromNow(4),
      }),
    ).rejects.toMatchObject({ status: 403 });

    // An admin holding global JUDGE_MANAGE gets the link created for them.
    const assignment = await assignJudge({
      eventId: mine.id,
      courtId: court.id,
      judgeId: foreignJudge.id,
      actorId: admin.id,
      canManageAllJudges: true,
      startsAt: hourFromNow(1),
      endsAt: hourFromNow(4),
    });
    expect(assignment.judgeUserId).toBe(foreignJudge.id);
    expect(await listEventJudges(mine.id)).toHaveLength(1);
  });

  it('revokes live court assignments when a judge leaves the event', async () => {
    const admin = await createAdmin();
    const event = await createEvent();
    const court = await createCourtFor(event.id);
    const judge = await createJudge();
    await prisma.eventJudge.create({ data: { eventId: event.id, userId: judge.id } });

    await assignJudge({
      eventId: event.id,
      courtId: court.id,
      judgeId: judge.id,
      actorId: admin.id,
      canManageAllJudges: true,
      startsAt: hourFromNow(1),
      endsAt: hourFromNow(4),
    });

    await revokeEventJudge({ eventId: event.id, userId: judge.id, actorId: admin.id });

    expect(await listEventJudges(event.id)).toHaveLength(0);
    const live = await prisma.courtJudgeAssignment.findFirst({
      where: { judgeUserId: judge.id, revokedAt: null },
    });
    expect(live).toBeNull();
    // The account itself survives; only this event's link is gone.
    expect(await prisma.user.findUnique({ where: { id: judge.id } })).not.toBeNull();
  });
});
