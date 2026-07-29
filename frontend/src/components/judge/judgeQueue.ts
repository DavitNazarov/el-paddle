import type { ScheduleItemDto } from '@/types/tournament';

type CurrentCourtPosition = Pick<ScheduleItemDto, 'courtId' | 'queuePosition'>;

export type CourtQueueState = {
  /** The match running on this court right now, if any. */
  current: ScheduleItemDto | null;
  /** The one match the judge may open next — null while another is running. */
  next: ScheduleItemDto | null;
  done: number;
  total: number;
};

/**
 * What a court queue looks like to the judge standing at it. A judge works the
 * queue in order, so exactly one match is ever openable: whatever is already in
 * progress, otherwise the earliest ready match. Cancelled items are dropped
 * rather than counted, so "4 of 11" always refers to matches that will be played.
 */
export function courtQueueState(items: ScheduleItemDto[]): CourtQueueState {
  const live = items
    .filter((item) => item.status !== 'CANCELLED')
    .sort((left, right) => left.queuePosition - right.queuePosition);
  const current = live.find((item) => item.status === 'IN_PROGRESS') ?? null;
  return {
    current,
    next: current ? null : live.find((item) => item.status === 'READY') ?? null,
    done: live.filter((item) => item.status === 'COMPLETED').length,
    total: live.length,
  };
}

export function findNextCourtMatchId(items: ScheduleItemDto[], current: CurrentCourtPosition) {
  return items
    .filter((item) => item.courtId === current.courtId
      && item.queuePosition > current.queuePosition
      && (item.status === 'READY' || item.status === 'IN_PROGRESS'))
    .sort((left, right) => left.queuePosition - right.queuePosition)[0]?.matchId ?? null;
}
