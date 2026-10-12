import type { CourtLane, RunBoard } from './runBoard';
import { canStart } from './matchModel';

/**
 * The one thing the match-day desk should do next.
 *
 * The console opened with five counts — playing, ready, courts free, behind,
 * played — and left the operator to work out which of them was the instruction.
 * Four of the five are reports. Only one describes something being lost right
 * now: a court standing free with a match waiting on it, which is the whole job
 * of running a tournament day.
 *
 * So the header states that court and offers its command. Everything the five
 * counts were for is still reachable — the filter bar narrows by state, and the
 * court lanes carry their own progress — but the screen leads with an
 * instruction rather than a dashboard.
 */

export type ControlFocus =
  /** A court is free and the match it is waiting on can be started from here. */
  | { kind: 'start'; lane: CourtLane; otherIdleCourts: number }
  /** A court is free but its next match cannot start yet; the lane explains why. */
  | { kind: 'court'; lane: CourtLane; otherIdleCourts: number }
  /** Matches are ready with nowhere to play them — that is a schedule problem. */
  | { kind: 'no-court'; count: number }
  /** Everything that can run is running. */
  | { kind: 'running'; live: number; completed: number; total: number }
  /** Nothing left to play. */
  | { kind: 'done'; total: number }
  /** No draw on any court yet. */
  | { kind: 'idle' };

/** Courts standing free with matches still queued on them, in court order. */
function idleLanes(board: RunBoard) {
  return board.lanes.filter((lane) => lane.state === 'open' && lane.next);
}

export function controlFocus(board: RunBoard): ControlFocus {
  const idle = idleLanes(board);
  const [first] = idle;

  if (first?.next) {
    const otherIdleCourts = idle.length - 1;
    // Starting is offered only when the server would allow it; anything else
    // sends the reader to the lane, which states what the match is waiting on.
    return canStart(first.next.match)
      ? { kind: 'start', lane: first, otherIdleCourts }
      : { kind: 'court', lane: first, otherIdleCourts };
  }

  // Ready but unplaceable: no court is idle because these matches are on no
  // court at all, which is fixed on the schedule rather than here.
  if (board.summary.awaitingCourt > 0) {
    return { kind: 'no-court', count: board.summary.awaitingCourt };
  }

  if (board.summary.live > 0) {
    return {
      kind: 'running',
      live: board.summary.live,
      completed: board.summary.completed,
      total: board.summary.total,
    };
  }

  if (board.summary.total === 0) return { kind: 'idle' };
  if (board.summary.completed >= board.summary.total) return { kind: 'done', total: board.summary.total };

  // Nothing running, nothing startable, nothing finished: every remaining match
  // is still waiting on an earlier result.
  return { kind: 'running', live: 0, completed: board.summary.completed, total: board.summary.total };
}
