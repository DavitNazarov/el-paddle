import { beforeEach, describe, expect, it } from 'vitest';
import { EventStatus, UserStatus } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';
import { createOpponentRequest, listEligibleOpponents } from './opponent-requests.service.js';
import { createCategory, createEvent, createTeam, registerTeam, resetDb } from '../../test/helpers.js';

beforeEach(resetDb);

/**
 * One requesting entry plus one other approved entry in the same category, with
 * the request window open. Each test then spoils a player on the other entry and
 * asserts the picker and the write path agree about it.
 */
async function setupPair() {
  const category = await createCategory();
  const event = await createEvent({ status: EventStatus.REGISTRATION_CLOSED, categoryId: category.id });
  await prisma.eventCategory.update({
    where: { eventId_categoryId: { eventId: event.id, categoryId: category.id } },
    data: { opponentRequestsOpenedAt: new Date() },
  });

  const alpha = await createTeam('Alpha');
  const bravo = await createTeam('Bravo');
  const entryAlpha = await registerTeam(event, category.id, alpha);
  const entryBravo = await registerTeam(event, category.id, bravo);

  return { event, category, alpha, bravo, entryAlpha, entryBravo };
}

describe('eligible opponent listing', () => {
  it('offers an approved entry whose players are both active', async () => {
    const s = await setupPair();

    const entries = await listEligibleOpponents(s.alpha.owner.id, s.event.id, s.entryAlpha.id);

    expect(entries.map((entry) => entry.id)).toEqual([s.entryBravo.id]);
  });

  it('hides an entry whose teammate has not accepted their invitation', async () => {
    const s = await setupPair();
    // Registering with a teammate who is not on the platform creates them as
    // INVITED, and their entry is still APPROVED — the exact shape that used to
    // be listed and then refused.
    await prisma.user.update({ where: { id: s.bravo.teammate.id }, data: { status: UserStatus.INVITED } });

    const entries = await listEligibleOpponents(s.alpha.owner.id, s.event.id, s.entryAlpha.id);

    expect(entries).toEqual([]);
  });

  it('hides an entry with a currently disqualified player', async () => {
    const s = await setupPair();
    await prisma.user.update({
      where: { id: s.bravo.owner.id },
      data: { disqualifiedUntil: new Date(Date.now() + 24 * 60 * 60 * 1000) },
    });

    const entries = await listEligibleOpponents(s.alpha.owner.id, s.event.id, s.entryAlpha.id);

    expect(entries).toEqual([]);
  });

  it('offers an entry again once the disqualification has lapsed', async () => {
    const s = await setupPair();
    await prisma.user.update({
      where: { id: s.bravo.owner.id },
      data: { disqualifiedUntil: new Date(Date.now() - 60 * 1000) },
    });

    const entries = await listEligibleOpponents(s.alpha.owner.id, s.event.id, s.entryAlpha.id);

    expect(entries.map((entry) => entry.id)).toEqual([s.entryBravo.id]);
  });

  it('never lists an entry the create path would refuse', async () => {
    const s = await setupPair();
    await prisma.user.update({ where: { id: s.bravo.teammate.id }, data: { status: UserStatus.INVITED } });

    const entries = await listEligibleOpponents(s.alpha.owner.id, s.event.id, s.entryAlpha.id);
    expect(entries).toEqual([]);

    // The picker and the command have to agree: submitting the hidden entry is
    // still refused, and the refusal says which side is the problem.
    await expect(createOpponentRequest({
      userId: s.alpha.owner.id,
      eventId: s.event.id,
      requestingEntryId: s.entryAlpha.id,
      targetEntryId: s.entryBravo.id,
      commandId: 'cmd-elig-0001',
    })).rejects.toMatchObject({ status: 409, message: 'That entry is no longer eligible for opponent requests.' });
  });

  it('names the requesting side when it is the requester who became ineligible', async () => {
    const s = await setupPair();
    await prisma.user.update({ where: { id: s.alpha.teammate.id }, data: { status: UserStatus.INVITED } });

    await expect(createOpponentRequest({
      userId: s.alpha.owner.id,
      eventId: s.event.id,
      requestingEntryId: s.entryAlpha.id,
      targetEntryId: s.entryBravo.id,
      commandId: 'cmd-elig-0002',
    })).rejects.toMatchObject({
      status: 409,
      message: 'Your entry cannot request an opponent. Alpha Teammate has not accepted their invitation yet.',
    });
  });
});

describe('requesting entry eligibility', () => {
  it('refuses to list opponents for an entry whose teammate has not accepted', async () => {
    const s = await setupPair();
    await prisma.user.update({ where: { id: s.alpha.teammate.id }, data: { status: UserStatus.INVITED } });

    // The refusal has to arrive when the picker opens. Returning opponents here
    // is what let a captain fill the form in and only then be refused.
    await expect(listEligibleOpponents(s.alpha.owner.id, s.event.id, s.entryAlpha.id)).rejects.toMatchObject({
      status: 409,
      message: 'Your entry cannot request an opponent. Alpha Teammate has not accepted their invitation yet.',
    });
  });

  it('names a disqualified player and the date they are free', async () => {
    const s = await setupPair();
    await prisma.user.update({
      where: { id: s.alpha.owner.id },
      data: { disqualifiedUntil: new Date('2026-09-01T00:00:00.000Z') },
    });

    await expect(listEligibleOpponents(s.alpha.owner.id, s.event.id, s.entryAlpha.id)).rejects.toMatchObject({
      status: 409,
      message: 'Your entry cannot request an opponent. Alpha Owner is disqualified until 2026-09-01.',
    });
  });

  it('names an inactive account without calling it an unaccepted invitation', async () => {
    const s = await setupPair();
    await prisma.user.update({ where: { id: s.alpha.teammate.id }, data: { status: UserStatus.INACTIVE } });

    await expect(listEligibleOpponents(s.alpha.owner.id, s.event.id, s.entryAlpha.id)).rejects.toMatchObject({
      status: 409,
      message: 'Your entry cannot request an opponent. Alpha Teammate does not have an active account.',
    });
  });

  it('still lists opponents for an entry whose players are both fine', async () => {
    const s = await setupPair();

    await expect(listEligibleOpponents(s.alpha.owner.id, s.event.id, s.entryAlpha.id)).resolves.toHaveLength(1);
  });
});
