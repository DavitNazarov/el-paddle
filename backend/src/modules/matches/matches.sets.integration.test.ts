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
async function buildScheduledFinal(setDefault: number) {
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
  await authedSend(app, 'put', `/api/admin/events/${event.id}/brackets/${bracketId}/set-defaults`, admin, {
    defaults: { [MatchRound.FINAL]: setDefault },
    expectedVersion: created.body.bracket.version,
    commandId: 'cmd-set-defaults-01',
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

async function decideSet(judge: { id: string; sessionVersion: number }, matchId: string, setNumber: number, winnerSide: 'A' | 'B', commandId: string) {
  const current = await prisma.match.findUniqueOrThrow({ where: { id: matchId } });
  return authedSend(app, 'post', `/api/judge/matches/${matchId}/sets`, judge, { setNumber, winnerSide, expectedVersion: current.version, commandId });
}

async function recordResult(actor: { id: string; sessionVersion: number }, matchId: string, setsA: number, setsB: number, commandId: string) {
  const current = await prisma.match.findUniqueOrThrow({ where: { id: matchId } });
  return authedSend(app, 'post', `/api/judge/matches/${matchId}/result`, actor, { setsA, setsB, expectedVersion: current.version, commandId });
}

describe('set scoring (integration)', () => {
  it('snapshots the round default when the match starts', async () => {
    const scenario = await buildScheduledFinal(3);
    const started = await startMatch(scenario.judge, scenario.matchId, 'cmd-start-01');
    expect(started.status).toBe(200);
    expect(started.body.match.setCount).toBe(3);
    expect(started.body.match.setsToWin).toBe(3);
    expect(started.body.match.maxSets).toBe(5);
  });

  it('records set winners and completes the match at the required wins', async () => {
    const scenario = await buildScheduledFinal(2);
    await startMatch(scenario.judge, scenario.matchId, 'cmd-start-02');

    const first = await decideSet(scenario.judge, scenario.matchId, 1, 'A', 'cmd-set-a1');
    expect(first.status).toBe(200);
    expect([first.body.match.scoreA, first.body.match.scoreB]).toEqual([1, 0]);
    expect(first.body.match.status).toBe(MatchStatus.IN_PROGRESS);

    const second = await decideSet(scenario.judge, scenario.matchId, 2, 'B', 'cmd-set-b1');
    expect([second.body.match.scoreA, second.body.match.scoreB]).toEqual([1, 1]);
    expect(second.body.match.status).toBe(MatchStatus.IN_PROGRESS);

    const decider = await decideSet(scenario.judge, scenario.matchId, 3, 'A', 'cmd-set-a2');
    expect([decider.body.match.scoreA, decider.body.match.scoreB]).toEqual([2, 1]);
    expect(decider.body.match.status).toBe(MatchStatus.COMPLETED);
    expect(decider.body.match.winnerEntryId).toBe(scenario.entryA.id);
    expect(decider.body.match.sets.map((set: { winnerSide: string }) => set.winnerSide)).toEqual(['A', 'B', 'A']);
  });

  it('rejects a stale set number and replays an identical command', async () => {
    const scenario = await buildScheduledFinal(3);
    await startMatch(scenario.judge, scenario.matchId, 'cmd-start-03');
    await decideSet(scenario.judge, scenario.matchId, 1, 'A', 'cmd-set-dup');

    const stale = await decideSet(scenario.judge, scenario.matchId, 1, 'B', 'cmd-set-stale');
    expect(stale.status).toBe(409);

    // Same command id and payload: the receipt replays instead of recording a second set.
    const current = await prisma.match.findUniqueOrThrow({ where: { id: scenario.matchId } });
    const replay = await authedSend(app, 'post', `/api/judge/matches/${scenario.matchId}/sets`, scenario.judge, { setNumber: 1, winnerSide: 'A', expectedVersion: current.version - 1, commandId: 'cmd-set-dup' });
    expect(replay.status).toBe(200);
    expect(await prisma.matchSet.count({ where: { matchId: scenario.matchId } })).toBe(1);
  });

  it('lets the judge undo the last set while the match runs', async () => {
    const scenario = await buildScheduledFinal(3);
    await startMatch(scenario.judge, scenario.matchId, 'cmd-start-04');
    await decideSet(scenario.judge, scenario.matchId, 1, 'A', 'cmd-set-u1');

    const current = await prisma.match.findUniqueOrThrow({ where: { id: scenario.matchId } });
    const undone = await authedSend(app, 'post', `/api/judge/matches/${scenario.matchId}/sets/undo`, scenario.judge, { expectedVersion: current.version, commandId: 'cmd-undo-01' });
    expect(undone.status).toBe(200);
    expect([undone.body.match.scoreA, undone.body.match.scoreB]).toEqual([0, 0]);
    expect(undone.body.match.sets).toHaveLength(0);
    expect(await prisma.setEvent.count({ where: { matchId: scenario.matchId } })).toBe(2);
  });

  it('refuses a judge undo once the match is complete and lets an admin reopen it', async () => {
    const scenario = await buildScheduledFinal(1);
    await startMatch(scenario.judge, scenario.matchId, 'cmd-start-05');
    const completed = await decideSet(scenario.judge, scenario.matchId, 1, 'A', 'cmd-set-final');
    expect(completed.body.match.status).toBe(MatchStatus.COMPLETED);
    const winnerAfterWin = await prisma.user.findUniqueOrThrow({ where: { id: scenario.entryA.ownerId } });
    expect(winnerAfterWin.wins).toBe(1);

    const judgeUndo = await authedSend(app, 'post', `/api/judge/matches/${scenario.matchId}/sets/undo`, scenario.judge, { expectedVersion: completed.body.match.version, commandId: 'cmd-undo-judge' });
    expect(judgeUndo.status).toBe(409);

    const noReason = await authedSend(app, 'post', `/api/admin/matches/${scenario.matchId}/sets/undo`, scenario.admin, { reason: '', expectedVersion: completed.body.match.version, commandId: 'cmd-undo-noreason' });
    expect(noReason.status).toBe(400);

    const reopened = await authedSend(app, 'post', `/api/admin/matches/${scenario.matchId}/sets/undo`, scenario.admin, { reason: 'Scoring error', expectedVersion: completed.body.match.version, commandId: 'cmd-undo-admin' });
    expect(reopened.status).toBe(200);
    expect(reopened.body.match.status).toBe(MatchStatus.IN_PROGRESS);
    expect(reopened.body.match.winnerEntryId).toBeNull();
    expect(reopened.body.match.sets).toHaveLength(0);

    const winnerAfterUndo = await prisma.user.findUniqueOrThrow({ where: { id: scenario.entryA.ownerId } });
    expect(winnerAfterUndo.wins).toBe(0);
    expect(winnerAfterUndo.matchesPlayed).toBe(0);
    const bracket = await prisma.bracket.findUniqueOrThrow({ where: { id: scenario.bracketId } });
    expect(bracket.status).toBe('LOCKED');
    const scheduleItem = await prisma.scheduleItem.findUniqueOrThrow({ where: { matchId: scenario.matchId } });
    expect(scheduleItem.status).toBe('IN_PROGRESS');
  });

  it('locks the set format once the match has started', async () => {
    const scenario = await buildScheduledFinal(2);
    const before = await prisma.match.findUniqueOrThrow({ where: { id: scenario.matchId } });
    const allowed = await authedSend(app, 'patch', `/api/admin/matches/${scenario.matchId}/set-config`, scenario.admin, { setCountOverride: 3, expectedVersion: before.version, commandId: 'cmd-config-01' });
    expect(allowed.status).toBe(200);
    expect(allowed.body.match.setCountOverride).toBe(3);

    const started = await startMatch(scenario.judge, scenario.matchId, 'cmd-start-06');
    expect(started.body.match.setCount).toBe(3);

    const rejected = await authedSend(app, 'patch', `/api/admin/matches/${scenario.matchId}/set-config`, scenario.admin, { setCountOverride: 1, expectedVersion: started.body.match.version, commandId: 'cmd-config-02' });
    expect(rejected.status).toBe(409);
  });

  it('completes the match from a tally entered as two numbers', async () => {
    const scenario = await buildScheduledFinal(2);
    await startMatch(scenario.judge, scenario.matchId, 'cmd-start-07');

    const recorded = await recordResult(scenario.admin, scenario.matchId, 1, 2, 'cmd-result-01');
    expect(recorded.status).toBe(200);
    expect([recorded.body.match.scoreA, recorded.body.match.scoreB]).toEqual([1, 2]);
    expect(recorded.body.match.status).toBe(MatchStatus.COMPLETED);
    expect(recorded.body.match.winnerEntryId).toBe(scenario.entryB.id);
    // The loser's set comes first, so the decider belongs to the winner.
    expect(recorded.body.match.sets.map((set: { winnerSide: string }) => set.winnerSide)).toEqual(['A', 'B', 'B']);
    // One command, one history row.
    expect(await prisma.setEvent.count({ where: { matchId: scenario.matchId } })).toBe(1);
  });

  it('tops up sets a judge already recorded and refuses a result below them', async () => {
    const scenario = await buildScheduledFinal(3);
    await startMatch(scenario.judge, scenario.matchId, 'cmd-start-08');
    await decideSet(scenario.judge, scenario.matchId, 1, 'B', 'cmd-set-mix');

    const lower = await recordResult(scenario.admin, scenario.matchId, 3, 0, 'cmd-result-low');
    expect(lower.status).toBe(409);

    const recorded = await recordResult(scenario.admin, scenario.matchId, 3, 1, 'cmd-result-02');
    expect(recorded.status).toBe(200);
    expect(recorded.body.match.sets.map((set: { winnerSide: string }) => set.winnerSide)).toEqual(['B', 'A', 'A', 'A']);
    expect(recorded.body.match.winnerEntryId).toBe(scenario.entryA.id);
  });

  it('refuses a tally that is not a finished result', async () => {
    const scenario = await buildScheduledFinal(2);
    await startMatch(scenario.judge, scenario.matchId, 'cmd-start-09');

    const unfinished = await recordResult(scenario.admin, scenario.matchId, 1, 1, 'cmd-result-unfinished');
    expect(unfinished.status).toBe(400);

    const overrun = await recordResult(scenario.admin, scenario.matchId, 3, 1, 'cmd-result-overrun');
    expect(overrun.status).toBe(400);

    const negative = await recordResult(scenario.admin, scenario.matchId, 2, -1, 'cmd-result-negative');
    expect(negative.status).toBe(400);
    expect(await prisma.matchSet.count({ where: { matchId: scenario.matchId } })).toBe(0);
  });

  it('rejects a set count outside one to three', async () => {
    const scenario = await buildScheduledFinal(1);
    const current = await prisma.match.findUniqueOrThrow({ where: { id: scenario.matchId } });
    const response = await authedSend(app, 'patch', `/api/admin/matches/${scenario.matchId}/set-config`, scenario.admin, { setCountOverride: 4, expectedVersion: current.version, commandId: 'cmd-config-03' });
    expect(response.status).toBe(400);
  });
});
