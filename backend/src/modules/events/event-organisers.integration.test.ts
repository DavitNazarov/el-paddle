import { beforeEach, describe, expect, it } from 'vitest';
import { EventStatus, UserRole } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';
import { createApp } from '../../app.js';
import {
  authedGet,
  authedSend,
  createAdmin,
  createCategory,
  createEvent,
  createUser,
  resetDb,
} from '../../test/helpers.js';

const app = createApp();

const createOrganiser = () => createUser({ role: UserRole.ORGANISER });

async function handOver(eventId: string, organiserId: string) {
  return prisma.eventOrganiser.create({ data: { eventId, userId: organiserId } });
}

describe('organiser authorization', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('lets an admin hand an event to an organiser and take it back', async () => {
    const admin = await createAdmin();
    const organiser = await createOrganiser();
    const event = await createEvent();

    const assigned = await authedSend(app, 'post', `/api/admin/events/${event.id}/organisers`, admin, {
      userId: organiser.id,
    });
    expect(assigned.status).toBe(201);
    expect(assigned.body.organisers).toHaveLength(1);

    const revoked = await authedSend(app, 'delete', `/api/admin/events/${event.id}/organisers/${organiser.id}`, admin);
    expect(revoked.status).toBe(200);
    expect(revoked.body.organisers).toHaveLength(0);
  });

  it('does not let an organiser hand out events', async () => {
    const organiser = await createOrganiser();
    const other = await createOrganiser();
    const event = await createEvent();
    await handOver(event.id, organiser.id);

    const response = await authedSend(app, 'post', `/api/admin/events/${event.id}/organisers`, organiser, {
      userId: other.id,
    });
    expect(response.status).toBe(403);
  });

  it('does not let an organiser create, edit, or delete an event', async () => {
    const organiser = await createOrganiser();
    const category = await createCategory();
    const event = await createEvent();
    await handOver(event.id, organiser.id);

    const created = await authedSend(app, 'post', '/api/events', organiser, {
      title: 'Organiser Invitational',
      date: new Date(Date.now() + 86_400_000).toISOString(),
      location: 'Tbilisi',
      description: '',
      participationFee: 100,
      bankAccountIban: 'GE00TB0000000000000000',
      bankAccountReceiver: 'Test Receiver',
      categoryIds: [category.id],
    });
    expect(created.status).toBe(403);
    expect(await prisma.event.count()).toBe(1);

    // Not even on the event they were handed: setup belongs to the admin.
    const edited = await authedSend(app, 'patch', `/api/events/${event.id}`, organiser, {
      title: 'Renamed by organiser',
      expectedVersion: event.version,
    });
    expect(edited.status).toBe(403);

    const deleted = await authedSend(app, 'delete', `/api/events/${event.id}`, organiser);
    expect(deleted.status).toBe(403);
    expect(await prisma.event.findUnique({ where: { id: event.id } })).not.toBeNull();
  });

  it('scopes every event-running power to the event they were handed', async () => {
    const organiser = await createOrganiser();
    const mine = await createEvent({ title: 'Mine' });
    const theirs = await createEvent({ title: 'Theirs' });
    await handOver(mine.id, organiser.id);

    const ownSchedule = await authedGet(app, `/api/admin/events/${mine.id}/schedule`, organiser);
    expect(ownSchedule.status).toBe(200);

    const foreignSchedule = await authedGet(app, `/api/admin/events/${theirs.id}/schedule`, organiser);
    expect(foreignSchedule.status).toBe(403);

    const ownCourt = await authedSend(app, 'post', `/api/admin/events/${mine.id}/courts`, organiser, {
      name: 'Court 1',
    });
    expect(ownCourt.status).toBe(201);

    const foreignCourt = await authedSend(app, 'post', `/api/admin/events/${theirs.id}/courts`, organiser, {
      name: 'Court 1',
    });
    expect(foreignCourt.status).toBe(403);
  });

  it('lets an organiser move their event forward but not backward', async () => {
    const organiser = await createOrganiser();
    const event = await createEvent({ status: EventStatus.REGISTRATION_OPEN });
    await handOver(event.id, organiser.id);

    const forward = await authedSend(app, 'patch', `/api/admin/events/${event.id}/status`, organiser, {
      status: EventStatus.REGISTRATION_CLOSED,
      expectedVersion: event.version,
      commandId: 'cmd-status-forward',
    });
    expect(forward.status).toBe(200);

    const completed = await prisma.event.update({
      where: { id: event.id },
      data: { status: EventStatus.COMPLETED },
    });
    const backward = await authedSend(app, 'patch', `/api/admin/events/${event.id}/status`, organiser, {
      status: EventStatus.ONGOING,
      expectedVersion: completed.version,
      commandId: 'cmd-status-backward',
    });
    // Reopening a finished event is a correction, and stays with the admin.
    expect(backward.status).toBe(403);
  });

  it('keeps accounts, clubs, and club requests beyond an organiser reach', async () => {
    const organiser = await createOrganiser();
    const event = await createEvent();
    await handOver(event.id, organiser.id);

    expect((await authedGet(app, '/api/admin/users', organiser)).status).toBe(403);
    expect((await authedGet(app, '/api/admin/clubs', organiser)).status).toBe(403);
    expect((await authedGet(app, '/api/admin/club-applications', organiser)).status).toBe(403);
  });

  it('shows an organiser only the events they run', async () => {
    const organiser = await createOrganiser();
    const mine = await createEvent({ title: 'Mine' });
    await createEvent({ title: 'Theirs' });
    await handOver(mine.id, organiser.id);

    const response = await authedGet(app, '/api/events?scope=admin', organiser);
    expect(response.status).toBe(200);
    expect(response.body.events.map((event: { id: string }) => event.id)).toEqual([mine.id]);
  });
});
