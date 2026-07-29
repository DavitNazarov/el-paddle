import { beforeEach, describe, expect, it } from 'vitest';
import { EventStatus, MatchRound, MatchStatus, UserRole } from '../../generated/prisma/client.js';
import { createApp } from '../../app.js';
import { prisma } from '../../database/prisma.js';
import {
  authedSend,
  createAdmin,
  createCategory,
  createEvent,
  createJudge,
  createTeam,
  createUser,
  registerTeam,
  resetDb,
} from '../../test/helpers.js';

const app = createApp();

beforeEach(resetDb);

/**
 * A locked four-entry bracket whose two semifinals sit on separate courts, so
 * concurrent scoring can be exercised the way a live event actually runs.
 */
async function buildOngoingEvent() {
  const admin = await createAdmin();
  const organiser = await createUser({ role: UserRole.ORGANISER });
  const category = await createCategory();
  const event = await createEvent({ categoryId: category.id, status: EventStatus.REGISTRATION_CLOSED });

  for (const label of ['Alpha', 'Bravo', 'Charlie', 'Delta']) {
    const team = await createTeam(label);
    await registerTeam(event, category.id, team);
  }

  const created = await authedSend(app, 'post', `/api/admin/events/${event.id}/brackets`, admin, {
    categoryId: category.id,
    commandId: 'cmd-bracket-create',
  });
  const bracketId = created.body.bracket.id as string;
  const generated = await authedSend(app, 'post', `/api/admin/events/${event.id}/brackets/${bracketId}/generate`, admin, {
    requestIds: [],
    expectedVersion: created.body.bracket.version,
    commandId: 'cmd-bracket-generate',
  });
  await authedSend(app, 'post', `/api/admin/events/${event.id}/brackets/${bracketId}/lock`, admin, {
    expectedVersion: generated.body.bracket.version,
    commandId: 'cmd-bracket-lock',
  });

  const courtOne = await authedSend(app, 'post', `/api/admin/events/${event.id}/courts`, admin, { name: 'Court 1' });
  const courtTwo = await authedSend(app, 'post', `/api/admin/events/${event.id}/courts`, admin, { name: 'Court 2' });

  const semifinals = await prisma.match.findMany({
    where: { bracketId, round: MatchRound.SEMIFINAL },
    orderBy: { matchNumber: 'asc' },
  });

  // Judge deliberately left empty: an organiser can run a court without one.
  await authedSend(app, 'post', `/api/admin/events/${event.id}/schedule/items`, admin, {
    matchId: semifinals[0].id,
    courtId: courtOne.body.court.id,
  });
  await authedSend(app, 'post', `/api/admin/events/${event.id}/schedule/items`, admin, {
    matchId: semifinals[1].id,
    courtId: courtTwo.body.court.id,
  });

  await prisma.eventOrganiser.create({ data: { eventId: event.id, userId: organiser.id } });
  await prisma.event.update({ where: { id: event.id }, data: { status: EventStatus.ONGOING } });

  return { admin, organiser, event, semifinals, courtOneId: courtOne.body.court.id as string };
}

async function start(actor: { id: string; sessionVersion: number }, matchId: string, commandId: string) {
  const current = await prisma.match.findUniqueOrThrow({ where: { id: matchId } });
  return authedSend(app, 'post', `/api/judge/matches/${matchId}/start`, actor, {
    expectedVersion: current.version,
    commandId,
  });
}

describe('organiser scoring', () => {
  it('runs several matches at once across different courts', async () => {
    const { organiser, semifinals } = await buildOngoingEvent();

    const first = await start(organiser, semifinals[0].id, 'cmd-start-1');
    expect(first.status).toBe(200);

    // A judge would be blocked here by the one-active-match rule; an organiser
    // running the whole event is not.
    const second = await start(organiser, semifinals[1].id, 'cmd-start-2');
    expect(second.status).toBe(200);

    const running = await prisma.match.count({ where: { status: MatchStatus.IN_PROGRESS } });
    expect(running).toBe(2);
  });

  it('does not take over the schedule judge slot when stepping in', async () => {
    const { admin, organiser, event, semifinals } = await buildOngoingEvent();
    const judge = await createJudge();
    await prisma.eventJudge.create({ data: { eventId: event.id, userId: judge.id } });

    const item = await prisma.scheduleItem.findFirstOrThrow({ where: { matchId: semifinals[0].id } });
    await prisma.scheduleItem.update({ where: { id: item.id }, data: { assignedJudgeId: judge.id } });
    expect(admin.role).toBe(UserRole.ADMIN);

    await start(organiser, semifinals[0].id, 'cmd-start-keep-judge');

    const after = await prisma.scheduleItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(after.assignedJudgeId).toBe(judge.id);
  });

  it('still refuses a second match on the same court', async () => {
    const { admin, organiser, event, semifinals, courtOneId } = await buildOngoingEvent();

    await start(organiser, semifinals[0].id, 'cmd-start-court-1');

    // Move the other semifinal onto the busy court, then try to run it too.
    const item = await prisma.scheduleItem.findFirstOrThrow({ where: { matchId: semifinals[1].id } });
    await authedSend(app, 'patch', `/api/admin/events/${event.id}/schedule/items/${item.id}`, admin, {
      courtId: courtOneId,
      expectedVersion: item.version,
      commandId: 'cmd-move-court',
    });

    const clash = await start(organiser, semifinals[1].id, 'cmd-start-court-clash');
    expect(clash.status).toBe(409);
  });

  it('does not let an organiser score a match in an event they were not handed', async () => {
    const { semifinals } = await buildOngoingEvent();
    const stranger = await createUser({ role: UserRole.ORGANISER });

    const response = await start(stranger, semifinals[0].id, 'cmd-start-stranger');
    expect(response.status).toBe(404);
  });

  it('leaves a judge bound to one match at a time', async () => {
    const { event, semifinals } = await buildOngoingEvent();
    const judge = await createJudge();
    await prisma.eventJudge.create({ data: { eventId: event.id, userId: judge.id } });

    for (const semifinal of semifinals) {
      const item = await prisma.scheduleItem.findFirstOrThrow({ where: { matchId: semifinal.id } });
      await prisma.scheduleItem.update({ where: { id: item.id }, data: { assignedJudgeId: judge.id } });
    }

    expect((await start(judge, semifinals[0].id, 'cmd-judge-1')).status).toBe(200);
    expect((await start(judge, semifinals[1].id, 'cmd-judge-2')).status).toBe(409);
  });
});
