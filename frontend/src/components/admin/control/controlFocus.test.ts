import { describe, expect, it } from 'vitest';
import type { CourtDto, MatchDto, ScheduleItemDto } from '@/types/tournament';
import { buildRunBoard } from './runBoard';
import { controlFocus } from './controlFocus';

/**
 * The header's single instruction. What it chooses is the product decision on
 * this screen, so it is pinned here rather than left to the component.
 */

const NOW = Date.UTC(2026, 7, 9, 12, 0, 0);

function match(id: string, number: number, status: MatchDto['status'], scheduled = true): MatchDto {
  return {
    id,
    matchNumber: number,
    round: 'FINAL',
    status,
    scoringMode: 'SETS',
    scoreA: 0,
    scoreB: 0,
    sets: [],
    snapshots: [],
    participantAEntryId: 'a',
    participantBEntryId: 'b',
    ...(scheduled ? { scheduleItem: { id: `s-${id}`, status: 'READY', version: 1 } } : {}),
  } as unknown as MatchDto;
}

function court(id: string, name: string, items: Array<{ matchId: string; status: ScheduleItemDto['status'] }>): CourtDto {
  return {
    id,
    name,
    scheduleItems: items.map((item, index) => ({
      id: `s-${item.matchId}`,
      matchId: item.matchId,
      status: item.status,
      queuePosition: index + 1,
      version: 1,
      plannedStartAt: null,
      match: { id: item.matchId, matchNumber: 1 },
    })),
  } as unknown as CourtDto;
}

const bracket = (matches: MatchDto[]) => [{ id: 'b1', matches, eventCategory: { category: { id: 'c', name: 'Open' } } }] as never;

describe('what the console leads with', () => {
  it('names a free court and offers the match it is waiting on', () => {
    const board = buildRunBoard(
      bracket([match('m1', 4, 'READY')]),
      [court('c1', 'Court 1', [{ matchId: 'm1', status: 'READY' }])],
      NOW,
    );
    const focus = controlFocus(board);
    expect(focus.kind).toBe('start');
    if (focus.kind === 'start') {
      expect(focus.lane.court.name).toBe('Court 1');
      expect(focus.lane.next?.match.matchNumber).toBe(4);
      expect(focus.otherIdleCourts).toBe(0);
    }
  });

  it('counts the other free courts without listing them', () => {
    const board = buildRunBoard(
      bracket([match('m1', 1, 'READY'), match('m2', 2, 'READY'), match('m3', 3, 'READY')]),
      [
        court('c1', 'Court 1', [{ matchId: 'm1', status: 'READY' }]),
        court('c2', 'Court 2', [{ matchId: 'm2', status: 'READY' }]),
        court('c3', 'Court 3', [{ matchId: 'm3', status: 'READY' }]),
      ],
      NOW,
    );
    const focus = controlFocus(board);
    expect(focus.kind === 'start' && focus.otherIdleCourts).toBe(2);
  });

  it('sends the reader to the court rather than offering Start the server would refuse', () => {
    // Its players are not settled yet, so the match cannot be started.
    const board = buildRunBoard(
      bracket([match('m1', 4, 'PENDING')]),
      [court('c1', 'Court 1', [{ matchId: 'm1', status: 'TENTATIVE' }])],
      NOW,
    );
    expect(controlFocus(board).kind).toBe('court');
  });

  it('says nothing about free courts while every court is busy', () => {
    const board = buildRunBoard(
      bracket([match('m1', 1, 'IN_PROGRESS')]),
      [court('c1', 'Court 1', [{ matchId: 'm1', status: 'IN_PROGRESS' }])],
      NOW,
    );
    const focus = controlFocus(board);
    expect(focus.kind).toBe('running');
    expect(focus.kind === 'running' && focus.live).toBe(1);
  });

  it('reports matches that are ready with nowhere to play them', () => {
    const board = buildRunBoard(bracket([match('m1', 1, 'READY', false)]), [], NOW);
    const focus = controlFocus(board);
    expect(focus.kind).toBe('no-court');
    expect(focus.kind === 'no-court' && focus.count).toBe(1);
  });

  it('reports a finished day, and an empty one, differently', () => {
    const finished = buildRunBoard(
      bracket([match('m1', 1, 'COMPLETED')]),
      [court('c1', 'Court 1', [{ matchId: 'm1', status: 'COMPLETED' }])],
      NOW,
    );
    expect(controlFocus(finished).kind).toBe('done');
    expect(controlFocus(buildRunBoard(bracket([]), [], NOW)).kind).toBe('idle');
  });
});
