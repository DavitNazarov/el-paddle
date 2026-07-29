import { ScheduleItemStatus } from '../../generated/prisma/client.js';

export type QueueItem = { id: string; queuePosition: number; status: ScheduleItemStatus; version: number };

/** A court whose every match is finished or cancelled is history and must not be rearranged. */
export function isQueueFinished(items: Pick<QueueItem, 'status'>[]) {
  return items.length > 0 && items.every((item) => item.status === ScheduleItemStatus.COMPLETED || item.status === ScheduleItemStatus.CANCELLED);
}

/** Started and finished matches are pinned: their queue position is a historical fact. */
export function isFrozen(item: Pick<QueueItem, 'status'>) {
  return item.status === ScheduleItemStatus.IN_PROGRESS || item.status === ScheduleItemStatus.COMPLETED;
}

/** Lowest 1-based position a movable match may take, i.e. after the frozen head of the queue. */
export function firstMovablePosition(items: Pick<QueueItem, 'status' | 'queuePosition'>[]) {
  const frozen = items.filter(isFrozen);
  return frozen.length ? Math.max(...frozen.map((item) => item.queuePosition)) + 1 : 1;
}

export type ReorderProblem =
  | { kind: 'finished' }
  | { kind: 'incomplete' }
  | { kind: 'stale' }
  | { kind: 'frozen' };

/**
 * Validates a full-queue reorder request against the stored queue. Pure so the rules can be
 * unit-tested without a database; the caller maps each problem to an HTTP error.
 */
export function validateQueueReorder(current: QueueItem[], requested: { id: string; version: number }[]): ReorderProblem | null {
  if (isQueueFinished(current)) return { kind: 'finished' };
  const requestedIds = requested.map((item) => item.id);
  if (requested.length !== current.length || new Set(requestedIds).size !== requested.length) return { kind: 'incomplete' };
  const byId = new Map(current.map((item) => [item.id, item]));
  if (requestedIds.some((id) => !byId.has(id))) return { kind: 'incomplete' };
  if (requested.some((item) => byId.get(item.id)!.version !== item.version)) return { kind: 'stale' };
  const brokenFreeze = requested.some((item, index) => {
    const stored = byId.get(item.id)!;
    return isFrozen(stored) && stored.queuePosition !== index + 1;
  });
  return brokenFreeze ? { kind: 'frozen' } : null;
}
