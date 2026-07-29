import { beforeEach, describe, expect, it } from 'vitest';
import { EventStatus, MatchRound, ScheduleItemStatus } from '../../generated/prisma/client.js';
import { createApp } from '../../app.js';
import { prisma } from '../../database/prisma.js';
import { authedSend, createAdmin, createCategory, createEvent, createTeam, registerTeam, resetDb } from '../../test/helpers.js';

const app = createApp();

beforeEach(resetDb);

/** A four-entry locked bracket with two courts, so queues can be built and rearranged. */
async function buildSchedule() {
  const admin = await createAdmin();
  const category = await createCategory();
  const event = await createEvent({ categoryId: category.id, status: EventStatus.REGISTRATION_CLOSED });
  for (const label of ['Alpha', 'Bravo', 'Charlie', 'Delta']) {
    await registerTeam(event, category.id, await createTeam(label));
  }

  const created = await authedSend(app, 'post', `/api/admin/events/${event.id}/brackets`, admin, { categoryId: category.id, commandId: 'cmd-bracket-create-s1' });
  const bracketId = created.body.bracket.id as string;
  const generated = await authedSend(app, 'post', `/api/admin/events/${event.id}/brackets/${bracketId}/generate`, admin, { requestIds: [], expectedVersion: created.body.bracket.version, commandId: 'cmd-bracket-generate-s1' });

  const courtOne = await authedSend(app, 'post', `/api/admin/events/${event.id}/courts`, admin, { name: 'Court 1' });
  const courtTwo = await authedSend(app, 'post', `/api/admin/events/${event.id}/courts`, admin, { name: 'Court 2' });
  const semis = await prisma.match.findMany({ where: { bracketId, round: MatchRound.SEMIFINAL }, orderBy: { matchNumber: 'asc' } });
  const final = await prisma.match.findFirstOrThrow({ where: { bracketId, round: MatchRound.FINAL } });
  for (const match of [...semis, final]) {
    await authedSend(app, 'post', `/api/admin/events/${event.id}/schedule/items`, admin, { matchId: match.id, courtId: courtOne.body.court.id });
  }

  return { admin, event, bracketId, bracketVersion: generated.body.bracket.version as number, courtOneId: courtOne.body.court.id as string, courtTwoId: courtTwo.body.court.id as string };
}

const queueOf = (courtId: string) => prisma.scheduleItem.findMany({ where: { courtId }, orderBy: { queuePosition: 'asc' } });

describe('court queue reordering (integration)', () => {
  it('reorders a queue and renumbers positions to one through n', async () => {
    const scenario = await buildSchedule();
    const before = await queueOf(scenario.courtOneId);
    const reversed = [...before].reverse();

    const response = await authedSend(app, 'post', `/api/admin/events/${scenario.event.id}/schedule/reorder`, scenario.admin, {
      courtId: scenario.courtOneId,
      items: reversed.map((item) => ({ id: item.id, version: item.version })),
      commandId: 'cmd-reorder-01',
    });
    expect(response.status).toBe(200);

    const after = await queueOf(scenario.courtOneId);
    expect(after.map((item) => item.id)).toEqual(reversed.map((item) => item.id));
    expect(after.map((item) => item.queuePosition)).toEqual([1, 2, 3]);
  });

  it('rejects a stale item version and an incomplete list', async () => {
    const scenario = await buildSchedule();
    const items = await queueOf(scenario.courtOneId);

    const stale = await authedSend(app, 'post', `/api/admin/events/${scenario.event.id}/schedule/reorder`, scenario.admin, {
      courtId: scenario.courtOneId,
      items: items.map((item) => ({ id: item.id, version: item.version + 5 })),
      commandId: 'cmd-reorder-stale',
    });
    expect(stale.status).toBe(409);

    const partial = await authedSend(app, 'post', `/api/admin/events/${scenario.event.id}/schedule/reorder`, scenario.admin, {
      courtId: scenario.courtOneId,
      items: items.slice(0, 2).map((item) => ({ id: item.id, version: item.version })),
      commandId: 'cmd-reorder-partial',
    });
    expect(partial.status).toBe(409);
  });

  it('pins a started match to its queue position', async () => {
    const scenario = await buildSchedule();
    const items = await queueOf(scenario.courtOneId);
    await prisma.scheduleItem.update({ where: { id: items[0]!.id }, data: { status: ScheduleItemStatus.IN_PROGRESS, version: { increment: 1 } } });
    const current = await queueOf(scenario.courtOneId);

    const response = await authedSend(app, 'post', `/api/admin/events/${scenario.event.id}/schedule/reorder`, scenario.admin, {
      courtId: scenario.courtOneId,
      items: [current[1]!, current[0]!, current[2]!].map((item) => ({ id: item.id, version: item.version })),
      commandId: 'cmd-reorder-frozen',
    });
    expect(response.status).toBe(409);
    expect(response.body.error).toMatch(/keep their queue position/i);
  });

  it('moves a match to another court at a chosen position and renumbers both queues', async () => {
    const scenario = await buildSchedule();
    const source = await queueOf(scenario.courtOneId);
    const moving = source[1]!;

    const response = await authedSend(app, 'patch', `/api/admin/events/${scenario.event.id}/schedule/items/${moving.id}`, scenario.admin, {
      courtId: scenario.courtTwoId,
      queuePosition: 1,
      expectedVersion: moving.version,
      commandId: 'cmd-move-01',
    });
    expect(response.status).toBe(200);

    const remaining = await queueOf(scenario.courtOneId);
    expect(remaining.map((item) => item.queuePosition)).toEqual([1, 2]);
    expect(remaining.some((item) => item.id === moving.id)).toBe(false);
    const target = await queueOf(scenario.courtTwoId);
    expect(target.map((item) => ({ id: item.id, queuePosition: item.queuePosition }))).toEqual([{ id: moving.id, queuePosition: 1 }]);
  });

  it('refuses to place a match before the active one', async () => {
    const scenario = await buildSchedule();
    const source = await queueOf(scenario.courtOneId);
    // Court two already has a match under way at position 1.
    const active = source[0]!;
    await authedSend(app, 'patch', `/api/admin/events/${scenario.event.id}/schedule/items/${active.id}`, scenario.admin, { courtId: scenario.courtTwoId, expectedVersion: active.version, commandId: 'cmd-move-seed' });
    const movedActive = await prisma.scheduleItem.findUniqueOrThrow({ where: { id: active.id } });
    await prisma.scheduleItem.update({ where: { id: movedActive.id }, data: { status: ScheduleItemStatus.IN_PROGRESS, version: { increment: 1 } } });

    const other = (await queueOf(scenario.courtOneId))[0]!;
    const response = await authedSend(app, 'patch', `/api/admin/events/${scenario.event.id}/schedule/items/${other.id}`, scenario.admin, {
      courtId: scenario.courtTwoId,
      queuePosition: 1,
      expectedVersion: other.version,
      commandId: 'cmd-move-before-active',
    });
    expect(response.status).toBe(409);
    expect(response.body.error).toMatch(/before the active match/i);
  });

  it('freezes a court queue once every match is finished', async () => {
    const scenario = await buildSchedule();
    const items = await queueOf(scenario.courtOneId);
    await prisma.scheduleItem.updateMany({ where: { courtId: scenario.courtOneId }, data: { status: ScheduleItemStatus.COMPLETED } });

    const response = await authedSend(app, 'post', `/api/admin/events/${scenario.event.id}/schedule/reorder`, scenario.admin, {
      courtId: scenario.courtOneId,
      items: [...items].reverse().map((item) => ({ id: item.id, version: item.version })),
      commandId: 'cmd-reorder-finished',
    });
    expect(response.status).toBe(409);
    expect(response.body.error).toMatch(/finished/i);
  });
});

describe('bracket placement (integration)', () => {
  it('swaps two first-round entries and keeps match readiness consistent', async () => {
    const scenario = await buildSchedule();
    const semis = await prisma.match.findMany({ where: { bracketId: scenario.bracketId, round: MatchRound.SEMIFINAL }, orderBy: { matchNumber: 'asc' } });
    const [first, second] = semis;
    const originalA = first!.participantAEntryId;
    const originalB = second!.participantBEntryId;

    const response = await authedSend(app, 'post', `/api/admin/events/${scenario.event.id}/brackets/${scenario.bracketId}/placements`, scenario.admin, {
      sourceMatchId: first!.id,
      sourceSide: 'A',
      targetMatchId: second!.id,
      targetSide: 'B',
      expectedVersion: scenario.bracketVersion,
      commandId: 'cmd-place-01',
    });
    expect(response.status).toBe(200);
    expect(response.body.revertedRequestIds).toEqual([]);

    const movedFirst = await prisma.match.findUniqueOrThrow({ where: { id: first!.id } });
    const movedSecond = await prisma.match.findUniqueOrThrow({ where: { id: second!.id } });
    expect(movedFirst.participantAEntryId).toBe(originalB);
    expect(movedSecond.participantBEntryId).toBe(originalA);
    expect(movedFirst.status).toBe('READY');
    expect(movedSecond.status).toBe('READY');
  });

  it('refuses placements outside the first round and on a locked bracket', async () => {
    const scenario = await buildSchedule();
    const semi = await prisma.match.findFirstOrThrow({ where: { bracketId: scenario.bracketId, round: MatchRound.SEMIFINAL } });
    const final = await prisma.match.findFirstOrThrow({ where: { bracketId: scenario.bracketId, round: MatchRound.FINAL } });

    const wrongRound = await authedSend(app, 'post', `/api/admin/events/${scenario.event.id}/brackets/${scenario.bracketId}/placements`, scenario.admin, {
      sourceMatchId: semi.id, sourceSide: 'A', targetMatchId: final.id, targetSide: 'A', expectedVersion: scenario.bracketVersion, commandId: 'cmd-place-round',
    });
    expect(wrongRound.status).toBe(400);

    await authedSend(app, 'post', `/api/admin/events/${scenario.event.id}/brackets/${scenario.bracketId}/lock`, scenario.admin, { expectedVersion: scenario.bracketVersion, commandId: 'cmd-lock-place' });
    const locked = await prisma.bracket.findUniqueOrThrow({ where: { id: scenario.bracketId } });
    const semis = await prisma.match.findMany({ where: { bracketId: scenario.bracketId, round: MatchRound.SEMIFINAL }, orderBy: { matchNumber: 'asc' } });
    const afterLock = await authedSend(app, 'post', `/api/admin/events/${scenario.event.id}/brackets/${scenario.bracketId}/placements`, scenario.admin, {
      sourceMatchId: semis[0]!.id, sourceSide: 'A', targetMatchId: semis[1]!.id, targetSide: 'A', expectedVersion: locked.version, commandId: 'cmd-place-locked',
    });
    expect(afterLock.status).toBe(409);
    expect(afterLock.body.error).toMatch(/draft bracket/i);
  });
});
