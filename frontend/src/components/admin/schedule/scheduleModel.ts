import type { CourtDto, MatchDto, ScheduleItemDto } from '@/types/tournament';
import type { Locale } from '@/lib/i18n/types';
import { tournamentCopy, tournamentRound } from '@/lib/i18n/tournament';

/**
 * Pure schedule reading, plus the drag-and-drop vocabulary. Every id the board
 * hands to dnd-kit is built here, and every drop is resolved here, so the
 * client only has to carry out the intent it is given.
 */

export const COURT_DROPPABLE_PREFIX = 'court:';
/** The open court's own queue panel. A court is on screen twice, so it needs two ids. */
export const QUEUE_DROPPABLE_PREFIX = 'queue:';
export const POOL_DROPPABLE_ID = 'unscheduled-pool';
export const POOL_ITEM_PREFIX = 'match:';

export function courtDroppableId(courtId: string) {
  return `${COURT_DROPPABLE_PREFIX}${courtId}`;
}

export function queueDroppableId(courtId: string) {
  return `${QUEUE_DROPPABLE_PREFIX}${courtId}`;
}

/** True for either of the two ways a court can be dropped on. */
function isCourtDroppable(overId: string) {
  return overId.startsWith(COURT_DROPPABLE_PREFIX) || overId.startsWith(QUEUE_DROPPABLE_PREFIX);
}

export function poolItemId(matchId: string) {
  return `${POOL_ITEM_PREFIX}${matchId}`;
}

/** A judge admitted to this event. Only these may be assigned to its courts. */
export type EventJudge = { id: string; name: string | null; surname: string | null; email: string };

export function judgeName(judge: EventJudge) {
  return [judge.name, judge.surname].filter(Boolean).join(' ') || judge.email;
}

/** Started and finished matches are pinned; the server rejects any attempt to move them. */
export function isFrozen(item: ScheduleItemDto) {
  return item.status === 'IN_PROGRESS' || item.status === 'COMPLETED';
}

/** A settled item is done with — played out or called off — and no longer waiting. */
export function isSettled(item: ScheduleItemDto) {
  return item.status === 'COMPLETED' || item.status === 'CANCELLED';
}

export function isQueueFinished(court: CourtDto) {
  return court.scheduleItems.length > 0 && court.scheduleItems.every(isSettled);
}

/** Lowest 1-based position a movable match may take on a court. */
export function firstMovablePosition(items: ScheduleItemDto[]) {
  const frozen = items.filter(isFrozen);
  return frozen.length ? Math.max(...frozen.map((item) => item.queuePosition)) + 1 : 1;
}

export function courtProgress(court: CourtDto) {
  return { done: court.scheduleItems.filter(isSettled).length, total: court.scheduleItems.length };
}

/**
 * What a court is doing, in one word. The board shows eight of these at once,
 * so each tile has to answer "does this one need me?" before it is read — and
 * the two states that mean *yes* (`unstaffed`, `idle`) are the ones that carry
 * the amber flag.
 */
export type CourtState = 'done' | 'live' | 'unstaffed' | 'idle' | 'ready';

export function courtState(court: CourtDto): CourtState {
  if (isQueueFinished(court)) return 'done';
  if (court.scheduleItems.some((item) => item.status === 'IN_PROGRESS')) return 'live';
  if (!court.judgeAssignments.length) return 'unstaffed';
  if (!court.scheduleItems.some((item) => !isSettled(item))) return 'idle';
  return 'ready';
}

/** A court state the operator still has to act on. */
export function courtNeedsAttention(state: CourtState) {
  return state === 'unstaffed' || state === 'idle';
}

/**
 * The one or two matches a court tile can afford to name: the match being
 * played, and the one that follows it. Everything else is a count.
 */
export function courtFocus(court: CourtDto) {
  const pending = court.scheduleItems.filter((item) => !isSettled(item));
  const live = pending.find((item) => item.status === 'IN_PROGRESS') ?? null;
  const next = pending.find((item) => item.status !== 'IN_PROGRESS') ?? null;
  return { live, next, waiting: pending.length - (live ? 1 : 0) };
}

export function matchTitle(locale: Locale, match: MatchDto) {
  return `${tournamentRound(locale, match.round)} · ${tournamentCopy[locale].common.match} ${match.matchNumber}`;
}

export function matchPair(locale: Locale, match: MatchDto) {
  const common = tournamentCopy[locale].common;
  const name = (entry: MatchDto['participantA']) => entry ? `${entry.owner.fullName} / ${entry.teammate.fullName}` : common.tbd;
  return `${name(match.participantA)} ${common.versus} ${name(match.participantB)}`;
}

/** Matches that exist in a draw but sit in no court queue yet. */
export function unscheduledMatches(matches: MatchDto[], courts: CourtDto[]) {
  const placed = new Set(courts.flatMap((court) => court.scheduleItems.map((item) => item.matchId)));
  return matches.filter((match) => !placed.has(match.id) && match.status !== 'COMPLETED');
}

export type DaySummary = {
  courtCount: number;
  staffedCourts: number;
  placed: number;
  settled: number;
  unscheduled: number;
  published: boolean;
};

export function buildDaySummary(courts: CourtDto[], unscheduledCount: number, published: boolean): DaySummary {
  const items = courts.flatMap((court) => court.scheduleItems);
  return {
    courtCount: courts.length,
    staffedCourts: courts.filter((court) => court.judgeAssignments.length > 0).length,
    placed: items.length,
    settled: items.filter(isSettled).length,
    unscheduled: unscheduledCount,
    published,
  };
}

/**
 * What a drop means. Resolving to an intent rather than firing a request from
 * inside the drag handler keeps every rule about frozen items and finished
 * queues in one testable place.
 */
export type DropIntent =
  | { kind: 'none' }
  | { kind: 'reorder'; courtId: string; orderedIds: string[] }
  | { kind: 'move'; item: ScheduleItemDto; targetCourtId: string; queuePosition: number }
  | { kind: 'schedule'; matchId: string; targetCourtId: string }
  | { kind: 'unschedule'; item: ScheduleItemDto };

function courtOf(courts: CourtDto[], itemId: string) {
  return courts.find((court) => court.scheduleItems.some((entry) => entry.id === itemId)) ?? null;
}

/** The court a drop landed on, whether it was dropped on the court itself or on a row inside it. */
function targetCourtOf(courts: CourtDto[], overId: string) {
  if (isCourtDroppable(overId)) {
    const courtId = overId.slice(overId.indexOf(':') + 1);
    return courts.find((court) => court.id === courtId) ?? null;
  }
  return courtOf(courts, overId);
}

export function resolveDrop(courts: CourtDto[], activeId: string, overId: string): DropIntent {
  if (!overId || activeId === overId) return { kind: 'none' };

  // Dragged out of the holding area: place the match at the end of a court queue.
  if (activeId.startsWith(POOL_ITEM_PREFIX)) {
    if (overId === POOL_DROPPABLE_ID) return { kind: 'none' };
    const targetCourt = targetCourtOf(courts, overId);
    if (!targetCourt || isQueueFinished(targetCourt)) return { kind: 'none' };
    return { kind: 'schedule', matchId: activeId.slice(POOL_ITEM_PREFIX.length), targetCourtId: targetCourt.id };
  }

  const sourceCourt = courtOf(courts, activeId);
  const item = sourceCourt?.scheduleItems.find((entry) => entry.id === activeId);
  if (!sourceCourt || !item) return { kind: 'none' };

  // Dragged back into the holding area: take it off the schedule entirely.
  if (overId === POOL_DROPPABLE_ID) {
    return isFrozen(item) ? { kind: 'none' } : { kind: 'unschedule', item };
  }

  const targetCourt = targetCourtOf(courts, overId);
  if (!targetCourt || isQueueFinished(targetCourt)) return { kind: 'none' };

  if (targetCourt.id === sourceCourt.id) {
    const ids = sourceCourt.scheduleItems.map((entry) => entry.id);
    const from = ids.indexOf(activeId);
    const to = isCourtDroppable(overId) ? ids.length - 1 : ids.indexOf(overId);
    if (from < 0 || to < 0 || from === to) return { kind: 'none' };
    ids.splice(to, 0, ids.splice(from, 1)[0]!);
    return { kind: 'reorder', courtId: sourceCourt.id, orderedIds: ids };
  }

  const targetIds = targetCourt.scheduleItems.map((entry) => entry.id);
  const dropIndex = isCourtDroppable(overId) ? targetIds.length : targetIds.indexOf(overId);
  return {
    kind: 'move',
    item,
    targetCourtId: targetCourt.id,
    queuePosition: Math.max(dropIndex + 1, firstMovablePosition(targetCourt.scheduleItems)),
  };
}

/** Reorder produced by the keyboard nudge buttons, so it obeys the same rules as a drag. */
export function nudgeOrder(court: CourtDto, item: ScheduleItemDto, delta: number): string[] | null {
  const ids = court.scheduleItems.map((entry) => entry.id);
  const from = ids.indexOf(item.id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= ids.length) return null;
  ids.splice(to, 0, ids.splice(from, 1)[0]!);
  return ids;
}
