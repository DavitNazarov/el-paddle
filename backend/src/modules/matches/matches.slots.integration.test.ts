import { beforeEach, describe, expect, it } from 'vitest';
import { EventStatus, MatchRound, MatchStatus } from '../../generated/prisma/client.js';
import { createApp } from '../../app.js';
import { prisma } from '../../database/prisma.js';
import { authedSend, createAdmin, createCategory, createEvent, createJudge, createTeam, registerTeam, resetDb } from '../../test/helpers.js';

const app = createApp();

beforeEach(resetDb);

/**
 * Builds a locked two-entry bracket whose final is scheduled on a court with an assigned judge,
 * i.e. the state a judge sees when they open a match.
 */
async function buildScheduledFinal(slotDefault: number) {
  const admin = await createAdmin();
  const judge = await createJudge();
  const category = await createCategory();
  const event = await createEvent({ categoryId: category.id, status: EventStatus.REGISTRATION_CLOSED });
  const teamA = await createTeam('Alpha');
  const teamB = await createTeam('Bravo');
  const entryA = await registerTeam(event, category.id, teamA);
  const entryB = await registerTeam(event, category.id, teamB);

  const created = await authedSend(app, 'post', `/api/admin/events/${event.id}/brackets`, admin, { categoryId: category.id, commandId: 'cmd-bracket-create-01' });
  const bracketId = created.body.bracket.id as string;
  await authedSend(app, 'put', `/api/admin/events/${event.id}/brackets/${bracketId}/slot-defaults`, admin, {
    defaults: { [MatchRound.FINAL]: slotDefault },
    expectedVersion: created.body.bracket.version,
    commandId: 'cmd-slot-defaults-01',
  });
  const afterDefaults = await prisma.bracket.findUniqueOrThrow({ where: { id: bracketId } });
  const generated = await authedSend(app, 'post', `/api/admin/events/${event.id}/brackets/${bracketId}/generate`, admin, { requestIds: [], expectedVersion: afterDefaults.version, commandId: 'cmd-bracket-generate-01' });
  await authedSend(app, 'post', `/api/admin/events/${event.id}/brackets/${bracketId}/lock`, admin, { expectedVersion: generated.body.bracket.version, commandId: 'cmd-bracket-lock-01' });

  const court = await authedSend(app, 'post', `/api/admin/events/${event.id}/courts`, admin, { name: 'Court 1' });
  const courtId = court.body.court.id as string;
  const now = new Date();
  await authedSend(app, 'post', `/api/admin/events/${event.id}/courts/${courtId}/judge-assignments`, admin, {
    judgeId: judge.id,
    startsAt: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
    endsAt: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
  });
  const match = await prisma.match.findFirstOrThrow({ where: { bracketId, round: MatchRound.FINAL } });
  await authedSend(app, 'post', `/api/admin/events/${event.id}/schedule/items`, admin, { matchId: match.id, courtId, judgeId: judge.id });
  await prisma.event.update({ where: { id: event.id }, data: { status: EventStatus.ONGOING } });

  return { admin, judge, event, bracketId, courtId, matchId: match.id, entryA, entryB };
}

async function startMatch(judge: { id: string; sessionVersion: number }, matchId: string, commandId: string) {
  const current = await prisma.match.findUniqueOrThrow({ where: { id: matchId } });
  return authedSend(app, 'post', `/api/judge/matches/${matchId}/start`, judge, { expectedVersion: current.version, commandId });
}

async function decideSlot(judge: { id: string; sessionVersion: number }, matchId: string, slotNumber: number, winnerSide: 'A' | 'B', commandId: string) {
  const current = await prisma.match.findUniqueOrThrow({ where: { id: matchId } });
  return authedSend(app, 'post', `/api/judge/matches/${matchId}/slots`, judge, { slotNumber, winnerSide, expectedVersion: current.version, commandId });
}

describe('slot scoring (integration)', () => {
  it('snapshots the round default when the match starts', async () => {
    const scenario = await buildScheduledFinal(3);
    const started = await startMatch(scenario.judge, scenario.matchId, 'cmd-start-01');
    expect(started.status).toBe(200);
    expect(started.body.match.slotCount).toBe(3);
    expect(started.body.match.slotsToWin).toBe(3);
    expect(started.body.match.maxSlots).toBe(5);
  });

  it('records slot winners and completes the match at the required wins', async () => {
    const scenario = await buildScheduledFinal(2);
    await startMatch(scenario.judge, scenario.matchId, 'cmd-start-02');

    const first = await decideSlot(scenario.judge, scenario.matchId, 1, 'A', 'cmd-slot-a1');
    expect(first.status).toBe(200);
    expect([first.body.match.scoreA, first.body.match.scoreB]).toEqual([1, 0]);
    expect(first.body.match.status).toBe(MatchStatus.IN_PROGRESS);

    const second = await decideSlot(scenario.judge, scenario.matchId, 2, 'B', 'cmd-slot-b1');
    expect([second.body.match.scoreA, second.body.match.scoreB]).toEqual([1, 1]);
    expect(second.body.match.status).toBe(MatchStatus.IN_PROGRESS);

    const decider = await decideSlot(scenario.judge, scenario.matchId, 3, 'A', 'cmd-slot-a2');
    expect([decider.body.match.scoreA, decider.body.match.scoreB]).toEqual([2, 1]);
    expect(decider.body.match.status).toBe(MatchStatus.COMPLETED);
    expect(decider.body.match.winnerEntryId).toBe(scenario.entryA.id);
    expect(decider.body.match.slots.map((slot: { winnerSide: string }) => slot.winnerSide)).toEqual(['A', 'B', 'A']);
  });

  it('rejects a stale slot number and replays an identical command', async () => {
    const scenario = await buildScheduledFinal(3);
    await startMatch(scenario.judge, scenario.matchId, 'cmd-start-03');
    await decideSlot(scenario.judge, scenario.matchId, 1, 'A', 'cmd-slot-dup');

    const stale = await decideSlot(scenario.judge, scenario.matchId, 1, 'B', 'cmd-slot-stale');
    expect(stale.status).toBe(409);

    // Same command id and payload: the receipt replays instead of recording a second slot.
    const current = await prisma.match.findUniqueOrThrow({ where: { id: scenario.matchId } });
    const replay = await authedSend(app, 'post', `/api/judge/matches/${scenario.matchId}/slots`, scenario.judge, { slotNumber: 1, winnerSide: 'A', expectedVersion: current.version - 1, commandId: 'cmd-slot-dup' });
    expect(replay.status).toBe(200);
    expect(await prisma.matchSlot.count({ where: { matchId: scenario.matchId } })).toBe(1);
  });

  it('lets the judge undo the last slot while the match runs', async () => {
    const scenario = await buildScheduledFinal(3);
    await startMatch(scenario.judge, scenario.matchId, 'cmd-start-04');
    await decideSlot(scenario.judge, scenario.matchId, 1, 'A', 'cmd-slot-u1');

    const current = await prisma.match.findUniqueOrThrow({ where: { id: scenario.matchId } });
    const undone = await authedSend(app, 'post', `/api/judge/matches/${scenario.matchId}/slots/undo`, scenario.judge, { expectedVersion: current.version, commandId: 'cmd-undo-01' });
    expect(undone.status).toBe(200);
    expect([undone.body.match.scoreA, undone.body.match.scoreB]).toEqual([0, 0]);
    expect(undone.body.match.slots).toHaveLength(0);
    expect(await prisma.slotEvent.count({ where: { matchId: scenario.matchId } })).toBe(2);
  });

  it('refuses a judge undo once the match is complete and lets an admin reopen it', async () => {
    const scenario = await buildScheduledFinal(1);
    await startMatch(scenario.judge, scenario.matchId, 'cmd-start-05');
    const completed = await decideSlot(scenario.judge, scenario.matchId, 1, 'A', 'cmd-slot-final');
    expect(completed.body.match.status).toBe(MatchStatus.COMPLETED);
    const winnerAfterWin = await prisma.user.findUniqueOrThrow({ where: { id: scenario.entryA.ownerId } });
    expect(winnerAfterWin.wins).toBe(1);

    const judgeUndo = await authedSend(app, 'post', `/api/judge/matches/${scenario.matchId}/slots/undo`, scenario.judge, { expectedVersion: completed.body.match.version, commandId: 'cmd-undo-judge' });
    expect(judgeUndo.status).toBe(409);

    const noReason = await authedSend(app, 'post', `/api/admin/matches/${scenario.matchId}/slots/undo`, scenario.admin, { reason: '', expectedVersion: completed.body.match.version, commandId: 'cmd-undo-noreason' });
    expect(noReason.status).toBe(400);

    const reopened = await authedSend(app, 'post', `/api/admin/matches/${scenario.matchId}/slots/undo`, scenario.admin, { reason: 'Scoring error', expectedVersion: completed.body.match.version, commandId: 'cmd-undo-admin' });
    expect(reopened.status).toBe(200);
    expect(reopened.body.match.status).toBe(MatchStatus.IN_PROGRESS);
    expect(reopened.body.match.winnerEntryId).toBeNull();
    expect(reopened.body.match.slots).toHaveLength(0);

    const winnerAfterUndo = await prisma.user.findUniqueOrThrow({ where: { id: scenario.entryA.ownerId } });
    expect(winnerAfterUndo.wins).toBe(0);
    expect(winnerAfterUndo.matchesPlayed).toBe(0);
    const bracket = await prisma.bracket.findUniqueOrThrow({ where: { id: scenario.bracketId } });
    expect(bracket.status).toBe('LOCKED');
    const scheduleItem = await prisma.scheduleItem.findUniqueOrThrow({ where: { matchId: scenario.matchId } });
    expect(scheduleItem.status).toBe('IN_PROGRESS');
  });

  it('locks the slot format once the match has started', async () => {
    const scenario = await buildScheduledFinal(2);
    const before = await prisma.match.findUniqueOrThrow({ where: { id: scenario.matchId } });
    const allowed = await authedSend(app, 'patch', `/api/admin/matches/${scenario.matchId}/slot-config`, scenario.admin, { slotCountOverride: 3, expectedVersion: before.version, commandId: 'cmd-config-01' });
    expect(allowed.status).toBe(200);
    expect(allowed.body.match.slotCountOverride).toBe(3);

    const started = await startMatch(scenario.judge, scenario.matchId, 'cmd-start-06');
    expect(started.body.match.slotCount).toBe(3);

    const rejected = await authedSend(app, 'patch', `/api/admin/matches/${scenario.matchId}/slot-config`, scenario.admin, { slotCountOverride: 1, expectedVersion: started.body.match.version, commandId: 'cmd-config-02' });
    expect(rejected.status).toBe(409);
  });

  it('rejects a slot count outside one to three', async () => {
    const scenario = await buildScheduledFinal(1);
    const current = await prisma.match.findUniqueOrThrow({ where: { id: scenario.matchId } });
    const response = await authedSend(app, 'patch', `/api/admin/matches/${scenario.matchId}/slot-config`, scenario.admin, { slotCountOverride: 4, expectedVersion: current.version, commandId: 'cmd-config-03' });
    expect(response.status).toBe(400);
  });
});
