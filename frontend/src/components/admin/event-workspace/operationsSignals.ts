import type { EventWorkspaceSignals } from '@/hooks/useEventWorkspaceSignals';
import type { EventOperationsDto } from '@/types/admin';

/**
 * The season board's counts, in the shape the agenda reads.
 *
 * One grouped request backs the whole board, so a row cannot afford the four
 * per-event reads the workspace makes. Everything the agenda ranks on is in
 * that grouped payload already, so the board and the workspace share a single
 * model and never phrase the same situation two different ways.
 */
export function operationsAsSignals(operation: EventOperationsDto): EventWorkspaceSignals {
  return {
    registrations: { approved: operation.registrations.approved, pending: operation.registrations.pending },
    requests: { awaiting: operation.requests.awaiting, total: operation.requests.total },
    brackets: operation.brackets,
    schedule: {
      courts: operation.courts.total,
      queued: operation.schedule.queued,
      courtsIdle: operation.courts.idle,
      // Counted by the grouped read itself now — a match with no schedule item
      // that is neither completed nor cancelled — so the board reports matches
      // without a court instead of staying silent about them.
      unscheduled: operation.schedule.unscheduled,
    },
    control: { live: operation.matches.live, ready: operation.matches.ready },
  };
}
