import type { ScheduleItemDto } from '@/types/tournament';

type CurrentCourtPosition = Pick<ScheduleItemDto, 'courtId' | 'queuePosition'>;

export function findNextCourtMatchId(items: ScheduleItemDto[], current: CurrentCourtPosition) {
  return items
    .filter((item) => item.courtId === current.courtId
      && item.queuePosition > current.queuePosition
      && (item.status === 'READY' || item.status === 'IN_PROGRESS'))
    .sort((left, right) => left.queuePosition - right.queuePosition)[0]?.matchId ?? null;
}
