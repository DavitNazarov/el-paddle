import { beforeEach, describe, expect, it } from 'vitest';
import {
  EventStatus,
  NotificationType,
  OpponentRequestStatus,
} from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';
import { createOpponentRequest, respondToOpponentRequest } from './opponent-requests.service.js';
import { expireOpponentRequests } from '../../workers/outbox.worker.js';
import { createCategory, createEvent, createTeam, createUser, registerTeam, resetDb } from '../../test/helpers.js';

beforeEach(resetDb);

/** Event (registration closed) with an open opponent-request window and two approved entries. */
async function setupScenario() {
  const category = await createCategory();
  const event = await createEvent({ status: EventStatus.REGISTRATION_CLOSED, categoryId: category.id });
  const deadline = new Date(Date.now() + 60 * 60 * 1000);
  await prisma.eventCategory.update({
    where: { eventId_categoryId: { eventId: event.id, categoryId: category.id } },
    data: { opponentRequestsOpenedAt: new Date(), opponentRequestDeadline: deadline },
  });
  const teamA = await createTeam('Alpha');
  const teamB = await createTeam('Bravo');
  const entryA = await registerTeam(event, category.id, teamA);
  const entryB = await registerTeam(event, category.id, teamB);
  return { event, category, teamA, teamB, entryA, entryB };
}

describe('opponent-request expiry (integration, H-2)', () => {
  it('stamps expiresAt from the category deadline on creation', async () => {
    const s = await setupScenario();
    const request = await createOpponentRequest({
      userId: s.teamA.owner.id,
      eventId: s.event.id,
      requestingEntryId: s.entryA.id,
      targetEntryId: s.entryB.id,
      commandId: 'cmd-oppreq-0001',
    });

    expect(request.status).toBe(OpponentRequestStatus.PENDING_RESPONSE);
    const link = await prisma.eventCategory.findUniqueOrThrow({
      where: { eventId_categoryId: { eventId: s.event.id, categoryId: s.category.id } },
    });
    expect(request.expiresAt).not.toBeNull();
    expect(request.expiresAt?.getTime()).toBe(link.opponentRequestDeadline?.getTime());
  });

  it('the worker transitions a past-deadline pending request to EXPIRED and notifies both entries', async () => {
    const s = await setupScenario();
    const request = await createOpponentRequest({
      userId: s.teamA.owner.id,
      eventId: s.event.id,
      requestingEntryId: s.entryA.id,
      targetEntryId: s.entryB.id,
      commandId: 'cmd-oppreq-0002',
    });

    // Simulate the deadline passing.
    await prisma.opponentRequest.update({
      where: { id: request.id },
      data: { expiresAt: new Date(Date.now() - 60 * 1000) },
    });

    await expireOpponentRequests();

    const after = await prisma.opponentRequest.findUniqueOrThrow({ where: { id: request.id } });
    expect(after.status).toBe(OpponentRequestStatus.EXPIRED);

    const notifications = await prisma.notification.findMany({
      where: { type: NotificationType.OPPONENT_REQUEST_EXPIRED, entityId: request.id },
    });
    // owner + teammate of both the requesting and target entry.
    expect(notifications.map((n) => n.recipientUserId).sort()).toEqual(
      [s.teamA.owner.id, s.teamA.teammate.id, s.teamB.owner.id, s.teamB.teammate.id].sort(),
    );
  });

  it('does not expire a pending request whose deadline has not passed', async () => {
    const s = await setupScenario();
    const request = await createOpponentRequest({
      userId: s.teamA.owner.id,
      eventId: s.event.id,
      requestingEntryId: s.entryA.id,
      targetEntryId: s.entryB.id,
      commandId: 'cmd-oppreq-0003',
    });

    await expireOpponentRequests();

    const after = await prisma.opponentRequest.findUniqueOrThrow({ where: { id: request.id } });
    expect(after.status).toBe(OpponentRequestStatus.PENDING_RESPONSE);
  });
});

describe('opponent-request ownership / IDOR (integration)', () => {
  it('only the target entry may respond', async () => {
    const s = await setupScenario();
    const request = await createOpponentRequest({
      userId: s.teamA.owner.id,
      eventId: s.event.id,
      requestingEntryId: s.entryA.id,
      targetEntryId: s.entryB.id,
      commandId: 'cmd-oppreq-0004',
    });

    const stranger = await createUser();
    const respond = (userId: string) =>
      respondToOpponentRequest({
        userId,
        eventId: s.event.id,
        requestId: request.id,
        accept: true,
        expectedVersion: request.version,
        commandId: `cmd-resp-${userId.slice(0, 8)}`,
      });

    // A user with no stake in either entry, and the requester (not the target), are both rejected.
    await expect(respond(stranger.id)).rejects.toMatchObject({ status: 404 });
    await expect(respond(s.teamA.owner.id)).rejects.toMatchObject({ status: 404 });

    // The target entry's owner can accept.
    const accepted = await respond(s.teamB.owner.id);
    expect(accepted.status).toBe(OpponentRequestStatus.ACCEPTED_BY_OPPONENT);
  });
});
