import { describe, expect, it } from 'vitest';
import { ScheduleItemStatus } from '../../generated/prisma/client.js';
import { firstMovablePosition, isQueueFinished, validateQueueReorder, type QueueItem } from './queueOrdering.js';

const item = (id: string, queuePosition: number, status: ScheduleItemStatus, version = 0): QueueItem => ({ id, queuePosition, status, version });

const queue: QueueItem[] = [
  item('a', 1, ScheduleItemStatus.COMPLETED),
  item('b', 2, ScheduleItemStatus.IN_PROGRESS),
  item('c', 3, ScheduleItemStatus.READY),
  item('d', 4, ScheduleItemStatus.TENTATIVE),
];

const asRequest = (ids: string[], versions: Record<string, number> = {}) => ids.map((id) => ({ id, version: versions[id] ?? 0 }));

describe('queue reorder validation', () => {
  it('accepts a reorder that keeps the frozen head in place', () => {
    expect(validateQueueReorder(queue, asRequest(['a', 'b', 'd', 'c']))).toBeNull();
  });

  it('rejects moving a started or completed match', () => {
    expect(validateQueueReorder(queue, asRequest(['b', 'a', 'c', 'd']))).toEqual({ kind: 'frozen' });
    expect(validateQueueReorder(queue, asRequest(['a', 'c', 'b', 'd']))).toEqual({ kind: 'frozen' });
  });

  it('rejects a partial or duplicated list', () => {
    expect(validateQueueReorder(queue, asRequest(['a', 'b', 'c']))).toEqual({ kind: 'incomplete' });
    expect(validateQueueReorder(queue, asRequest(['a', 'b', 'c', 'c']))).toEqual({ kind: 'incomplete' });
    expect(validateQueueReorder(queue, asRequest(['a', 'b', 'c', 'z']))).toEqual({ kind: 'incomplete' });
  });

  it('rejects a stale item version', () => {
    expect(validateQueueReorder(queue, asRequest(['a', 'b', 'd', 'c'], { d: 3 }))).toEqual({ kind: 'stale' });
  });

  it('rejects any change to a finished court queue', () => {
    const finished = [item('a', 1, ScheduleItemStatus.COMPLETED), item('b', 2, ScheduleItemStatus.CANCELLED)];
    expect(validateQueueReorder(finished, asRequest(['b', 'a']))).toEqual({ kind: 'finished' });
  });
});

describe('queue helpers', () => {
  it('treats an empty queue as unfinished', () => {
    expect(isQueueFinished([])).toBe(false);
  });

  it('finds the first position a movable match may take', () => {
    expect(firstMovablePosition(queue)).toBe(3);
    expect(firstMovablePosition([item('x', 1, ScheduleItemStatus.READY)])).toBe(1);
    expect(firstMovablePosition([])).toBe(1);
  });
});
