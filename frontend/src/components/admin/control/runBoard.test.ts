import { describe, expect, it } from 'vitest';
import type { BracketDto, CourtDto, MatchDto, ScheduleItemDto } from '@/types/tournament';
import { buildRunBoard, byRunOrder, reorderedQueue, type ControlMatch } from './runBoard';

const now = new Date('2026-08-05T12:00:00.000Z').getTime();
const at = (minutes: number) => new Date(now + minutes * 60_000).toISOString();

function item(courtId: string, matchId: string, queuePosition: number, status = 'READY', plannedStartAt: string | null = null) {
  return {
    id: `item-${matchId}`,
    matchId,
    courtId,
    queuePosition,
    plannedStartAt,
    status,
    version: 3,
    court: { id: courtId, name: courtId.toUpperCase(), location: null },
    match: { id: matchId } as MatchDto,
  } as unknown as ScheduleItemDto;
}

function match(id: string, fields: Partial<MatchDto> = {}) {
  return {
    id,
    matchNumber: Number(id.slice(1)),
    round: 'QUARTERFINAL',
    roundPosition: 1,
    status: 'READY',
    sets: [],
    snapshots: [],
    ...fields,
  } as unknown as MatchDto;
}

function bracket(matches: MatchDto[], categoryName = 'Open'): BracketDto {
  return {
    id: 'b1',
    categoryId: 'cat1',
    eventCategory: { category: { id: 'cat1', name: categoryName } },
    matches,
  } as unknown as BracketDto;
}

function court(id: string, scheduleItems: ScheduleItemDto[]): CourtDto {
  return { id, name: id.toUpperCase(), scheduleItems } as unknown as CourtDto;
}

describe('a court lane', () => {
  it('reads top to bottom the way the court runs: on, next, then, played', () => {
    const items = [
      item('c1', 'm1', 1, 'COMPLETED'),
      item('c1', 'm2', 2, 'IN_PROGRESS'),
      item('c1', 'm3', 3),
      item('c1', 'm4', 4),
    ];
    const matches = [
      match('m1', { status: 'COMPLETED', scheduleItem: items[0] }),
      match('m2', { status: 'IN_PROGRESS', scheduleItem: items[1] }),
      match('m3', { scheduleItem: items[2] }),
      match('m4', { scheduleItem: items[3] }),
    ];

    const [lane] = buildRunBoard([bracket(matches)], [court('c1', items)], now).lanes;

    expect(lane!.state).toBe('live');
    expect(lane!.live?.match.id).toBe('m2');
    expect(lane!.next?.match.id).toBe('m3');
    expect(lane!.later.map((entry) => entry.match.id)).toEqual(['m4']);
    expect(lane!.played.map((entry) => entry.match.id)).toEqual(['m1']);
  });

  it('is the state that needs the operator when it is free with a queue still waiting', () => {
    const queued = [item('c1', 'm1', 1)];
    const finished = [item('c2', 'm2', 1, 'COMPLETED')];
    const board = buildRunBoard(
      [bracket([match('m1', { scheduleItem: queued[0] }), match('m2', { status: 'COMPLETED', scheduleItem: finished[0] })])],
      [court('c1', queued), court('c2', finished), court('c3', [])],
      now,
    );

    expect(board.lanes.map((lane) => lane.state)).toEqual(['open', 'done', 'empty']);
    expect(board.summary.courtsOpen).toBe(1);
    expect(board.summary.courtsLive).toBe(0);
  });

  it('pins a started or finished match and lets nothing move above it', () => {
    const items = [item('c1', 'm1', 1, 'COMPLETED'), item('c1', 'm2', 2), item('c1', 'm3', 3)];
    const matches = [
      match('m1', { status: 'COMPLETED', scheduleItem: items[0] }),
      match('m2', { scheduleItem: items[1] }),
      match('m3', { scheduleItem: items[2] }),
    ];

    const [lane] = buildRunBoard([bracket(matches)], [court('c1', items)], now).lanes;
    const moves = [lane!.next!, ...lane!.later].map((entry) => ({
      id: entry.match.id,
      earlier: entry.canMoveEarlier,
      later: entry.canMoveLater,
    }));

    expect(moves).toEqual([
      { id: 'm2', earlier: false, later: true },
      { id: 'm3', earlier: true, later: false },
    ]);
    // The played match is not offered either move at all.
    expect(lane!.played[0]!.canMoveEarlier).toBe(false);
    expect(lane!.played[0]!.canMoveLater).toBe(false);
  });
});

describe('the day in numbers', () => {
  it('counts what is playable, flags matches with nowhere to play, and counts the ones running late', () => {
    const placed = item('c1', 'm1', 1, 'READY', at(-30));
    const board = buildRunBoard(
      [bracket([
        match('m1', { scheduleItem: placed }),
        match('m2', { status: 'READY' }),
        match('m3', { status: 'COMPLETED' }),
        match('m4', { status: 'CANCELLED' }),
      ])],
      [court('c1', [placed])],
      now,
    );

    expect(board.summary).toMatchObject({ ready: 2, completed: 1, total: 3, awaitingCourt: 1, behind: 1 });
    expect(board.waiting.map((entry) => entry.match.id)).toEqual(['m2']);
  });
});

describe('run order', () => {
  it('puts a planned time first and sends the unplanned to the back', () => {
    const entry = (id: string, plannedStartAt: string | null, courtName: string, queuePosition: number) => ({
      match: match(id),
      plannedStartAt,
      court: { id: courtName, name: courtName },
      queuePosition,
    } as ControlMatch);

    const ordered = [
      entry('m3', null, 'C1', 9),
      entry('m2', at(60), 'C1', 2),
      entry('m1', at(10), 'C2', 5),
    ].sort(byRunOrder);

    expect(ordered.map((item) => item.match.id)).toEqual(['m1', 'm2', 'm3']);
  });
});

describe('nudging the court order', () => {
  it('hands the server the court’s whole order, one place moved', () => {
    const items = [item('c1', 'm1', 1), item('c1', 'm2', 2), item('c1', 'm3', 3)];
    const [lane] = buildRunBoard(
      [bracket(items.map((entry, index) => match(`m${index + 1}`, { scheduleItem: entry })))],
      [court('c1', items)],
      now,
    ).lanes;

    expect(reorderedQueue(lane!, 'item-m3', -1)).toEqual(['item-m1', 'item-m3', 'item-m2']);
    expect(reorderedQueue(lane!, 'item-m1', -1)).toBeNull();
    expect(reorderedQueue(lane!, 'item-m3', 1)).toBeNull();
  });
});
