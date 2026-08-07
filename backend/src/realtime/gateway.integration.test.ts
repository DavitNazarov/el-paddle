import { beforeEach, describe, expect, it } from 'vitest';
import { UserRole } from '../generated/prisma/client.js';
import { prisma } from '../database/prisma.js';
import { createAdmin, createCategory, createEvent, createJudge, createTeam, createUser, registerTeam, resetDb } from '../test/helpers.js';
import { eventRoomFor } from './gateway.js';

/**
 * The event room a subscriber lands in decides what the outbox is allowed to
 * tell them: `event-staff:<id>` carries unpublished scores, winners and
 * registration decisions, `event:<id>` carries a bare invalidation signal.
 * Anyone who is not staff on this event must land in the public room or be
 * refused outright — never in the staff room.
 */
describe('eventRoomFor', () => {
  beforeEach(resetDb);

  it('refuses an anonymous socket on an unpublished event', async () => {
    const event = await createEvent({ isPublished: false });
    expect(await eventRoomFor(undefined, event.id)).toBeNull();
  });

  it('puts an anonymous socket on a published event in the public room', async () => {
    const event = await createEvent({ isPublished: true });
    expect(await eventRoomFor(undefined, event.id)).toBe(`event:${event.id}`);
  });

  it('refuses any subscriber for an event that does not exist', async () => {
    const admin = await createAdmin();
    expect(await eventRoomFor({ id: admin.id, role: admin.role }, 'nosuchevent')).toBeNull();
  });

  it('puts an admin in the staff room', async () => {
    const event = await createEvent({ isPublished: true });
    const admin = await createAdmin();
    expect(await eventRoomFor({ id: admin.id, role: admin.role }, event.id)).toBe(`event-staff:${event.id}`);
  });

  it('puts an organiser of this event in the staff room, and one of another event in the public room', async () => {
    const [mine, theirs] = await Promise.all([createEvent({ isPublished: true }), createEvent({ isPublished: true })]);
    const organiser = await createUser({ role: UserRole.ORGANISER });
    await prisma.eventOrganiser.create({ data: { eventId: mine.id, userId: organiser.id } });
    const socketUser = { id: organiser.id, role: organiser.role };

    expect(await eventRoomFor(socketUser, mine.id)).toBe(`event-staff:${mine.id}`);
    // Published, so they may still listen — but only to the redacted room.
    expect(await eventRoomFor(socketUser, theirs.id)).toBe(`event:${theirs.id}`);
  });

  it('drops a revoked organiser back to the public room', async () => {
    const event = await createEvent({ isPublished: true });
    const organiser = await createUser({ role: UserRole.ORGANISER });
    await prisma.eventOrganiser.create({ data: { eventId: event.id, userId: organiser.id, revokedAt: new Date() } });
    expect(await eventRoomFor({ id: organiser.id, role: organiser.role }, event.id)).toBe(`event:${event.id}`);
  });

  it('puts a judge with a live court assignment in the staff room', async () => {
    const event = await createEvent({ isPublished: true });
    const judge = await createJudge();
    const admin = await createAdmin();
    const court = await prisma.court.create({ data: { eventId: event.id, name: 'Court 1' } });
    await prisma.courtJudgeAssignment.create({
      data: {
        courtId: court.id,
        judgeUserId: judge.id,
        assignedById: admin.id,
        startsAt: new Date(Date.now() - 60_000),
        endsAt: new Date(Date.now() + 60 * 60_000),
      },
    });
    expect(await eventRoomFor({ id: judge.id, role: judge.role }, event.id)).toBe(`event-staff:${event.id}`);
  });

  it('drops a judge whose assignment has ended back to the public room', async () => {
    const event = await createEvent({ isPublished: true });
    const judge = await createJudge();
    const admin = await createAdmin();
    const court = await prisma.court.create({ data: { eventId: event.id, name: 'Court 1' } });
    await prisma.courtJudgeAssignment.create({
      data: {
        courtId: court.id,
        judgeUserId: judge.id,
        assignedById: admin.id,
        startsAt: new Date(Date.now() - 2 * 60 * 60_000),
        endsAt: new Date(Date.now() - 60 * 60_000),
      },
    });
    expect(await eventRoomFor({ id: judge.id, role: judge.role }, event.id)).toBe(`event:${event.id}`);
  });

  it('keeps a participant in the public room even on an unpublished event', async () => {
    const category = await createCategory();
    const event = await createEvent({ isPublished: false, categoryId: category.id });
    const team = await createTeam('Alpha');
    await registerTeam(event, category.id, team);
    expect(await eventRoomFor({ id: team.owner.id, role: team.owner.role }, event.id)).toBe(`event:${event.id}`);
  });

  it('refuses an unrelated player on an unpublished event', async () => {
    const event = await createEvent({ isPublished: false });
    const outsider = await createUser();
    expect(await eventRoomFor({ id: outsider.id, role: outsider.role }, event.id)).toBeNull();
  });
});
