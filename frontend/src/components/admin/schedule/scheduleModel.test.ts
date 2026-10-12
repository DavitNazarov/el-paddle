import { describe, expect, it } from 'vitest';
import type { BracketDto, CourtDto, MatchDto, ScheduleItemDto } from '@/types/tournament';
import {
  courtDroppableId,
  courtNeedsAttention,
  courtState,
  poolItemId,
  resolveDrop,
  POOL_DROPPABLE_ID,
  firstMovablePosition,
  nudgeOrder,
  categoryNamer,
} from './scheduleModel';

function item(id: string, queuePosition: number, status: ScheduleItemDto['status'] = 'READY') {
  return { id, queuePosition, status, version: 1 } as ScheduleItemDto;
}

function court(id: string, items: ScheduleItemDto[]) {
  return { id, name: id, scheduleItems: items } as unknown as CourtDto;
}

describe('drop resolution', () => {
  const courtA = court('a', [item('a1', 1), item('a2', 2), item('a3', 3)]);
  const courtB = court('b', [item('b1', 1, 'IN_PROGRESS'), item('b2', 2)]);
  const courts = [courtA, courtB];

  it('reorders within the court the match already belongs to', () => {
    expect(resolveDrop(courts, 'a3', 'a1')).toEqual({ kind: 'reorder', courtId: 'a', orderedIds: ['a3', 'a1', 'a2'] });
  });

  it('moves across courts below every frozen match', () => {
    const intent = resolveDrop(courts, 'a1', 'b1');
    // b1 is in progress, so position 1 is pinned and the drop lands at 2.
    expect(intent).toMatchObject({ kind: 'move', targetCourtId: 'b', queuePosition: 2 });
  });

  it('appends to the queue when dropped on the column rather than a row', () => {
    expect(resolveDrop(courts, 'a1', courtDroppableId('b'))).toMatchObject({ kind: 'move', targetCourtId: 'b', queuePosition: 3 });
  });

  it('schedules a match dragged out of the holding area', () => {
    expect(resolveDrop(courts, poolItemId('m9'), courtDroppableId('a'))).toEqual({ kind: 'schedule', matchId: 'm9', targetCourtId: 'a' });
  });

  it('unschedules a movable match dragged back into the holding area', () => {
    expect(resolveDrop(courts, 'a2', POOL_DROPPABLE_ID)).toMatchObject({ kind: 'unschedule' });
  });

  it('refuses to unschedule a match that has already started', () => {
    expect(resolveDrop(courts, 'b1', POOL_DROPPABLE_ID)).toEqual({ kind: 'none' });
  });

  it('refuses a drop onto a queue that is already finished', () => {
    const done = [courtA, court('c', [item('c1', 1, 'COMPLETED')])];
    expect(resolveDrop(done, 'a1', courtDroppableId('c'))).toEqual({ kind: 'none' });
    expect(resolveDrop(done, poolItemId('m9'), courtDroppableId('c'))).toEqual({ kind: 'none' });
  });

  it('ignores a drop on nothing, on itself, or from an unknown source', () => {
    expect(resolveDrop(courts, 'a1', '')).toEqual({ kind: 'none' });
    expect(resolveDrop(courts, 'a1', 'a1')).toEqual({ kind: 'none' });
    expect(resolveDrop(courts, 'ghost', courtDroppableId('a'))).toEqual({ kind: 'none' });
  });
});

describe('queue positions', () => {
  it('keeps movable matches below the last started or finished one', () => {
    expect(firstMovablePosition([item('x', 1, 'COMPLETED'), item('y', 2, 'IN_PROGRESS'), item('z', 3)])).toBe(3);
    expect(firstMovablePosition([item('z', 1)])).toBe(1);
  });

  it('nudges a match one step and refuses to run off either end', () => {
    const target = court('a', [item('a1', 1), item('a2', 2)]);
    expect(nudgeOrder(target, target.scheduleItems[1]!, -1)).toEqual(['a2', 'a1']);
    expect(nudgeOrder(target, target.scheduleItems[0]!, -1)).toBeNull();
    expect(nudgeOrder(target, target.scheduleItems[1]!, 1)).toBeNull();
  });
});

describe('court state', () => {
  it('reads finished before anything else', () => {
    expect(courtState(court('a', [item('a1', 1, 'COMPLETED'), item('a2', 2, 'CANCELLED')]))).toBe('done');
  });

  it('reads a running match as live', () => {
    expect(courtState(court('a', [item('a1', 1, 'IN_PROGRESS')]))).toBe('live');
  });

  it('flags a court with nothing left to play, and reads a waiting queue as ready', () => {
    expect(courtState(court('a', []))).toBe('idle');
    expect(courtState(court('a', [item('a1', 1)]))).toBe('ready');
  });

  it('asks for the operator only where a decision is outstanding', () => {
    expect(courtNeedsAttention('idle')).toBe(true);
    expect((['done', 'live', 'ready'] as const).map((state) => courtNeedsAttention(state))).toEqual([false, false, false]);
  });
});

describe('naming the category a row belongs to', () => {
  const bracket = (name: string, matchIds: string[]) => ({
    eventCategory: { category: { id: name, name } },
    matches: matchIds.map((id) => ({ id })),
  }) as unknown as BracketDto;

  const match = (id: string) => ({ id }) as MatchDto;

  it('says nothing when the event runs a single category', () => {
    const namer = categoryNamer([bracket('Men’s Open', ['m1', 'm2'])]);
    expect(namer(match('m1'))).toBe('');
  });

  it('names the draw once more than one category is in play', () => {
    const namer = categoryNamer([bracket('Men’s Open', ['m1']), bracket('Mixed', ['m2'])]);
    expect(namer(match('m1'))).toBe('Men’s Open');
    expect(namer(match('m2'))).toBe('Mixed');
  });

  it('falls back to the copy of the bracket a schedule item carries', () => {
    const namer = categoryNamer([bracket('Men’s Open', ['m1']), bracket('Mixed', ['m2'])]);
    const fromSchedule = { id: 'm9', bracket: { eventCategory: { category: { id: 'x', name: 'Women’s Open' } } } } as MatchDto;
    expect(namer(fromSchedule)).toBe('Women’s Open');
  });
});
