import { beforeEach, describe, expect, it } from 'vitest';
import { EventStatus, OpponentRequestStatus } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';
import {
  createOpponentRequest,
  decideOpponentRequest,
  respondToOpponentRequest,
} from './opponent-requests.service.js';
import { createAdmin, createCategory, createEvent, createTeam, registerTeam, resetDb } from '../../test/helpers.js';

beforeEach(resetDb);

/**
 * Three approved entries with an open request window. Charlie sits in the middle:
 * it requests Alpha and is itself requested by Bravo, which is how one entry ends
 * up accepted in two pairings without any conflict rule firing.
 */
async function setupOverlap() {
  const admin = await createAdmin();
  const category = await createCategory();
  const event = await createEvent({ status: EventStatus.REGISTRATION_CLOSED, categoryId: category.id });
  await prisma.eventCategory.update({
    where: { eventId_categoryId: { eventId: event.id, categoryId: category.id } },
    data: { opponentRequestsOpenedAt: new Date() },
  });

  const alpha = await createTeam('Alpha');
  const bravo = await createTeam('Bravo');
  const charlie = await createTeam('Charlie');
  const entryAlpha = await registerTeam(event, category.id, alpha);
  const entryBravo = await registerTeam(event, category.id, bravo);
  const entryCharlie = await registerTeam(event, category.id, charlie);

  const charlieToAlpha = await createOpponentRequest({
    userId: charlie.owner.id,
    eventId: event.id,
    requestingEntryId: entryCharlie.id,
    targetEntryId: entryAlpha.id,
    commandId: 'cmd-pair-0001',
  });
  const accepted = await respondToOpponentRequest({
    userId: alpha.owner.id,
    eventId: event.id,
    requestId: charlieToAlpha.id,
    accept: true,
    expectedVersion: charlieToAlpha.version,
    commandId: 'cmd-pair-0002',
  });

  const bravoToCharlie = await createOpponentRequest({
    userId: bravo.owner.id,
    eventId: event.id,
    requestingEntryId: entryBravo.id,
    targetEntryId: entryCharlie.id,
    commandId: 'cmd-pair-0003',
  });
  const overlapping = await respondToOpponentRequest({
    userId: charlie.owner.id,
    eventId: event.id,
    requestId: bravoToCharlie.id,
    accept: true,
    expectedVersion: bravoToCharlie.version,
    commandId: 'cmd-pair-0004',
  });

  return { admin, event, first: accepted, second: overlapping };
}

describe('opponent-request approval conflicts', () => {
  it('refuses an approval that would commit an entry to a second pairing', async () => {
    const s = await setupOverlap();

    await decideOpponentRequest({
      actorId: s.admin.id,
      eventId: s.event.id,
      requestId: s.first.id,
      decision: 'approve',
      expectedVersion: s.first.version,
      commandId: 'cmd-pair-0005',
    });

    // Both accepted pairings claim Charlie. Letting the second one through leaves
    // bracket generation permanently blocked, so it has to be refused here.
    await expect(decideOpponentRequest({
      actorId: s.admin.id,
      eventId: s.event.id,
      requestId: s.second.id,
      decision: 'approve',
      expectedVersion: s.second.version,
      commandId: 'cmd-pair-0006',
    })).rejects.toMatchObject({ status: 409, message: expect.stringContaining('already paired with') });

    const after = await prisma.opponentRequest.findUniqueOrThrow({ where: { id: s.second.id } });
    expect(after.status).toBe(OpponentRequestStatus.ACCEPTED_BY_OPPONENT);
  });

  it('releases an approved pairing so the other one can be approved instead', async () => {
    const s = await setupOverlap();

    const approved = await decideOpponentRequest({
      actorId: s.admin.id,
      eventId: s.event.id,
      requestId: s.first.id,
      decision: 'approve',
      expectedVersion: s.first.version,
      commandId: 'cmd-pair-0007',
    });

    await decideOpponentRequest({
      actorId: s.admin.id,
      eventId: s.event.id,
      requestId: approved.id,
      decision: 'reject',
      publicReason: 'Released so the other pairing can stand.',
      expectedVersion: approved.version,
      commandId: 'cmd-pair-0008',
    });

    const second = await decideOpponentRequest({
      actorId: s.admin.id,
      eventId: s.event.id,
      requestId: s.second.id,
      decision: 'approve',
      expectedVersion: s.second.version,
      commandId: 'cmd-pair-0009',
    });

    expect(second.status).toBe(OpponentRequestStatus.APPROVED_BY_ADMIN);
  });

  it('refuses to reject a pairing that is already applied to the bracket', async () => {
    const s = await setupOverlap();
    const approved = await decideOpponentRequest({
      actorId: s.admin.id,
      eventId: s.event.id,
      requestId: s.first.id,
      decision: 'approve',
      expectedVersion: s.first.version,
      commandId: 'cmd-pair-0010',
    });
    await prisma.opponentRequest.update({
      where: { id: approved.id },
      data: { status: OpponentRequestStatus.APPLIED_TO_BRACKET, version: { increment: 1 } },
    });

    await expect(decideOpponentRequest({
      actorId: s.admin.id,
      eventId: s.event.id,
      requestId: approved.id,
      decision: 'reject',
      publicReason: 'Changed my mind.',
      expectedVersion: approved.version + 1,
      commandId: 'cmd-pair-0011',
    })).rejects.toMatchObject({ status: 409 });
  });
});
