import { beforeEach, describe, expect, it } from 'vitest';
import { EventStatus } from '../../generated/prisma/client.js';
import { ApiError } from '../../common/http.js';
import { changeEventStatus, updateEvent } from './events.service.js';
import { createAdmin, createEvent, resetDb } from '../../test/helpers.js';

beforeEach(resetDb);

async function expectApiError(promise: Promise<unknown>, status: number) {
  await expect(promise).rejects.toMatchObject({ status });
  await promise.catch((error) => {
    expect(error).toBeInstanceOf(ApiError);
  });
}

describe('optimistic concurrency (integration)', () => {
  it('updateEvent rejects a stale expectedVersion with 409 (M-1)', async () => {
    const event = await createEvent();
    const updated = await updateEvent(event.id, { title: 'First Rename' }, 0);
    expect(updated.version).toBe(1);
    expect(updated.title).toBe('First Rename');

    await expectApiError(updateEvent(event.id, { title: 'Stale Rename' }, 0), 409);
    const after = await updateEvent(event.id, { title: 'Second Rename' }, 1);
    expect(after.title).toBe('Second Rename');
    expect(after.version).toBe(2);
  });

  it('changeEventStatus rejects a stale expectedVersion with 409', async () => {
    const admin = await createAdmin();
    const event = await createEvent({ status: EventStatus.REGISTRATION_OPEN });
    await expectApiError(
      changeEventStatus({
        eventId: event.id,
        status: EventStatus.REGISTRATION_CLOSED,
        actorId: admin.id,
        canRollbackCompleted: false,
        expectedVersion: 99,
        commandId: 'cmd-stale-0001',
      }),
      409,
    );
  });
});

describe('command idempotency (integration)', () => {
  it('replays the same commandId without re-applying, and rejects a reused id with new data (409)', async () => {
    const admin = await createAdmin();
    const event = await createEvent({ status: EventStatus.REGISTRATION_OPEN });

    const first = await changeEventStatus({
      eventId: event.id,
      status: EventStatus.REGISTRATION_CLOSED,
      actorId: admin.id,
      canRollbackCompleted: false,
      reason: 'closing',
      expectedVersion: 0,
      commandId: 'cmd-idem-0001',
    });
    expect(first.status).toBe(EventStatus.REGISTRATION_CLOSED);
    expect(first.version).toBe(1);

    // Identical retry ⇒ receipt replay ⇒ no second increment.
    const replay = await changeEventStatus({
      eventId: event.id,
      status: EventStatus.REGISTRATION_CLOSED,
      actorId: admin.id,
      canRollbackCompleted: false,
      reason: 'closing',
      expectedVersion: 0,
      commandId: 'cmd-idem-0001',
    });
    expect(replay.status).toBe(EventStatus.REGISTRATION_CLOSED);
    expect(replay.version).toBe(1);

    // Same commandId, different payload ⇒ payload-hash mismatch ⇒ 409.
    await expectApiError(
      changeEventStatus({
        eventId: event.id,
        status: EventStatus.REGISTRATION_CLOSED,
        actorId: admin.id,
        canRollbackCompleted: false,
        reason: 'different reason',
        expectedVersion: 0,
        commandId: 'cmd-idem-0001',
      }),
      409,
    );
  });
});

describe('event lifecycle invariants (integration)', () => {
  it('rejects an illegal forward transition with 409', async () => {
    const admin = await createAdmin();
    const event = await createEvent({ status: EventStatus.REGISTRATION_OPEN });
    await expectApiError(
      changeEventStatus({
        eventId: event.id,
        status: EventStatus.ONGOING,
        actorId: admin.id,
        canRollbackCompleted: false,
        expectedVersion: 0,
        commandId: 'cmd-life-0001',
      }),
      409,
    );
  });

  it('requires the reopen capability to move a COMPLETED event back to ONGOING (403)', async () => {
    const admin = await createAdmin();
    const event = await createEvent({ status: EventStatus.COMPLETED });
    await expectApiError(
      changeEventStatus({
        eventId: event.id,
        status: EventStatus.ONGOING,
        actorId: admin.id,
        canRollbackCompleted: false,
        expectedVersion: 0,
        commandId: 'cmd-life-0002',
      }),
      403,
    );
  });
});
