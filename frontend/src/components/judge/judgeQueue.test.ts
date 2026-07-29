import { describe, expect, it } from 'vitest';
import type { ScheduleItemDto } from '@/types/tournament';
import { courtQueueState, findNextCourtMatchId } from './judgeQueue';

function item(overrides: Partial<ScheduleItemDto> & Pick<ScheduleItemDto, 'matchId' | 'courtId' | 'queuePosition' | 'status'>) {
  return overrides as ScheduleItemDto;
}

describe('judge court queue navigation', () => {
  const current = { courtId: 'court-a', queuePosition: 2 };

  it('selects the next actionable fight by court queue position', () => {
    const items = [
      item({ matchId: 'later', courtId: 'court-a', queuePosition: 5, status: 'READY' }),
      item({ matchId: 'next', courtId: 'court-a', queuePosition: 3, status: 'READY' }),
      item({ matchId: 'earlier', courtId: 'court-a', queuePosition: 1, status: 'COMPLETED' }),
    ];

    expect(findNextCourtMatchId(items, current)).toBe('next');
  });

  it('does not skip to another court or a fight that is not ready', () => {
    const items = [
      item({ matchId: 'other-court', courtId: 'court-b', queuePosition: 3, status: 'READY' }),
      item({ matchId: 'pending', courtId: 'court-a', queuePosition: 3, status: 'TENTATIVE' }),
      item({ matchId: 'active', courtId: 'court-a', queuePosition: 4, status: 'IN_PROGRESS' }),
    ];

    expect(findNextCourtMatchId(items, current)).toBe('active');
  });

  it('returns no target when the court has no remaining actionable fight', () => {
    expect(findNextCourtMatchId([
      item({ matchId: 'done', courtId: 'court-a', queuePosition: 3, status: 'COMPLETED' }),
    ], current)).toBeNull();
  });
});

describe('court queue state', () => {
  it('leads with the match already in progress and offers nothing else', () => {
    const state = courtQueueState([
      item({ matchId: 'done', courtId: 'court-a', queuePosition: 1, status: 'COMPLETED' }),
      item({ matchId: 'running', courtId: 'court-a', queuePosition: 2, status: 'IN_PROGRESS' }),
      item({ matchId: 'ready', courtId: 'court-a', queuePosition: 3, status: 'READY' }),
    ]);

    expect(state.current?.matchId).toBe('running');
    expect(state.next).toBeNull();
    expect(state).toMatchObject({ done: 1, total: 3 });
  });

  it('offers only the earliest ready match when the court is idle', () => {
    const state = courtQueueState([
      item({ matchId: 'later', courtId: 'court-a', queuePosition: 3, status: 'READY' }),
      item({ matchId: 'earliest', courtId: 'court-a', queuePosition: 2, status: 'READY' }),
    ]);

    expect(state.current).toBeNull();
    expect(state.next?.matchId).toBe('earliest');
  });

  it('excludes cancelled items from the queue totals', () => {
    const state = courtQueueState([
      item({ matchId: 'done', courtId: 'court-a', queuePosition: 1, status: 'COMPLETED' }),
      item({ matchId: 'dropped', courtId: 'court-a', queuePosition: 2, status: 'CANCELLED' }),
    ]);

    expect(state).toMatchObject({ done: 1, total: 1 });
    expect(state.next).toBeNull();
  });
});
