import type { BracketDto, CourtDto, MatchDto, ScheduleItemDto } from '@/types/tournament';
import { isFrozen, isSettled } from '../schedule/scheduleModel';
import { minutesLate, plannedStartOf } from './controlModel';

/**
 * The console's reading of a whole event day.
 *
 * A draw of any size is still only ever played on a handful of courts, so the
 * court — not the round — is what an operator navigates by. Everything here
 * turns brackets plus courts into that shape: one row per match that knows its
 * category, court, place in the queue and how late it is running, and one lane
 * per court that knows what is on, what is next, and what is still waiting.
 *
 * Two sources are joined on purpose. The brackets carry the full match — sets,
 * snapshots, participants — and the schedule carries the authoritative queue,
 * including courts with nothing on them at all, which is exactly the state an
 * operator most needs to see.
 */

/** One match as every view of the console reads it. */
export type ControlMatch = {
  match: MatchDto;
  categoryId: string;
  categoryName: string;
  court: { id: string; name: string } | null;
  item: ScheduleItemDto | null;
  plannedStartAt: string | null;
  queuePosition: number | null;
  /** Minutes past the planned start, or null when the match is not running late. */
  lateBy: number | null;
};

/**
 * Where a match stands, in the four words an operator sorts by. `upcoming` is a
 * match whose players are not settled yet, so it cannot be acted on at all.
 */
export type MatchBand = 'live' | 'ready' | 'upcoming' | 'done';

export function bandOf(match: MatchDto): MatchBand {
  if (match.status === 'IN_PROGRESS') return 'live';
  if (match.status === 'READY') return 'ready';
  if (match.status === 'COMPLETED' || match.status === 'CANCELLED') return 'done';
  return 'upcoming';
}

export function buildControlMatches(brackets: BracketDto[], now: number): ControlMatch[] {
  return brackets.flatMap((bracket) => bracket.matches.map((match) => {
    const item = match.scheduleItem ?? null;
    return {
      match,
      categoryId: bracket.eventCategory?.category.id ?? bracket.categoryId,
      categoryName: bracket.eventCategory?.category.name ?? '',
      court: item?.court ? { id: item.court.id, name: item.court.name } : null,
      item,
      plannedStartAt: plannedStartOf(match),
      queuePosition: item?.queuePosition ?? null,
      lateBy: minutesLate(match, now),
    };
  }));
}

/**
 * Run order: the sequence the day is actually played in. A planned time beats a
 * queue position, because a time is a promise made to players; matches with no
 * time yet follow, in the order their courts will reach them.
 */
export function byRunOrder(left: ControlMatch, right: ControlMatch) {
  const leftTime = left.plannedStartAt ? new Date(left.plannedStartAt).getTime() : Number.MAX_SAFE_INTEGER;
  const rightTime = right.plannedStartAt ? new Date(right.plannedStartAt).getTime() : Number.MAX_SAFE_INTEGER;
  if (leftTime !== rightTime) return leftTime - rightTime;
  // A match with no court has no place in the running order either, so it sorts
  // behind every match that does rather than against a sentinel court name.
  if (Boolean(left.court) !== Boolean(right.court)) return left.court ? -1 : 1;
  if (left.court && right.court && left.court.name !== right.court.name) {
    return left.court.name.localeCompare(right.court.name);
  }
  const leftQueue = left.queuePosition ?? Number.MAX_SAFE_INTEGER;
  const rightQueue = right.queuePosition ?? Number.MAX_SAFE_INTEGER;
  if (leftQueue !== rightQueue) return leftQueue - rightQueue;
  return left.match.matchNumber - right.match.matchNumber;
}

/** What a court is doing, in the one word that decides whether it needs the operator. */
export type LaneState = 'live' | 'open' | 'done' | 'empty';

/** One queued match on a court, with the two moves the queue rules allow it. */
export type LaneEntry = ControlMatch & {
  item: ScheduleItemDto;
  canMoveEarlier: boolean;
  canMoveLater: boolean;
};

export type CourtLane = {
  court: CourtDto;
  state: LaneState;
  /** The match being played on this court. */
  live: LaneEntry | null;
  /** The one that follows it — the only match a court can be told to start. */
  next: LaneEntry | null;
  /** Everything queued behind `next`, in queue order. */
  later: LaneEntry[];
  played: LaneEntry[];
  /** Minutes the court's next match is behind its planned start. */
  lateBy: number | null;
};

/**
 * A court's lane. The queue comes from the schedule, which is where order is
 * decided; a started or finished match is pinned there and so is pinned here,
 * and nothing may be moved above the last pinned one.
 */
export function buildCourtLane(court: CourtDto, byMatchId: Map<string, ControlMatch>): CourtLane {
  const entries = [...court.scheduleItems]
    .sort((left, right) => left.queuePosition - right.queuePosition)
    .map((item) => toLaneEntry(item, byMatchId));

  const movable = entries.filter((entry) => !isFrozen(entry.item));
  const firstMovableId = movable[0]?.item.id ?? null;
  const lastMovableId = movable[movable.length - 1]?.item.id ?? null;
  for (const entry of movable) {
    entry.canMoveEarlier = entry.item.id !== firstMovableId;
    entry.canMoveLater = entry.item.id !== lastMovableId;
  }

  const played = entries.filter((entry) => isSettled(entry.item));
  const pending = entries.filter((entry) => !isSettled(entry.item));
  const live = pending.find((entry) => entry.item.status === 'IN_PROGRESS') ?? null;
  const queued = pending.filter((entry) => entry !== live);

  return {
    court,
    state: live ? 'live' : pending.length ? 'open' : entries.length ? 'done' : 'empty',
    live,
    next: queued[0] ?? null,
    later: queued.slice(1),
    played,
    lateBy: queued[0]?.lateBy ?? null,
  };
}

/**
 * The item's own match is the fallback, not the source: it is a lighter include
 * without sets or snapshots, so a lane never loses a row even if a match is
 * missing from the bracket payload.
 */
function toLaneEntry(item: ScheduleItemDto, byMatchId: Map<string, ControlMatch>): LaneEntry {
  const known = byMatchId.get(item.matchId);
  const base: ControlMatch = known ?? {
    match: item.match,
    categoryId: item.match.bracket?.eventCategory.category.id ?? '',
    categoryName: item.match.bracket?.eventCategory.category.name ?? '',
    court: item.court ? { id: item.court.id, name: item.court.name } : null,
    item,
    plannedStartAt: item.plannedStartAt,
    queuePosition: item.queuePosition,
    lateBy: null,
  };
  return { ...base, item, canMoveEarlier: false, canMoveLater: false };
}

export type ControlSummary = {
  live: number;
  ready: number;
  completed: number;
  total: number;
  /** Courts with a match in progress right now. */
  courtsLive: number;
  /** Courts standing free with a queue still waiting — the ones that need the operator. */
  courtsOpen: number;
  /** Matches that are ready to run but have nowhere to be played. */
  awaitingCourt: number;
  /** Matches past their planned start and still not begun. */
  behind: number;
};

export function buildSummary(matches: ControlMatch[], lanes: CourtLane[]): ControlSummary {
  const playable = matches.filter(({ match }) => match.status !== 'CANCELLED');
  return {
    live: playable.filter(({ match }) => match.status === 'IN_PROGRESS').length,
    ready: playable.filter(({ match }) => match.status === 'READY').length,
    completed: playable.filter(({ match }) => match.status === 'COMPLETED').length,
    total: playable.length,
    courtsLive: lanes.filter((lane) => lane.state === 'live').length,
    courtsOpen: lanes.filter((lane) => lane.state === 'open').length,
    awaitingCourt: playable.filter(({ match, item }) => match.status === 'READY' && !item).length,
    behind: playable.filter((entry) => entry.lateBy !== null).length,
  };
}

export type RunBoard = {
  matches: ControlMatch[];
  byMatchId: Map<string, ControlMatch>;
  lanes: CourtLane[];
  /** Ready matches with no court at all — they belong to no lane, so they get their own. */
  waiting: ControlMatch[];
  summary: ControlSummary;
};

export function buildRunBoard(brackets: BracketDto[], courts: CourtDto[], now: number): RunBoard {
  const matches = buildControlMatches(brackets, now);
  const byMatchId = new Map(matches.map((entry) => [entry.match.id, entry]));
  const lanes = courts.map((court) => buildCourtLane(court, byMatchId));
  const waiting = matches
    .filter(({ match, item }) => !item && match.status !== 'COMPLETED' && match.status !== 'CANCELLED')
    .sort((left, right) => left.match.matchNumber - right.match.matchNumber);
  return { matches, byMatchId, lanes, waiting, summary: buildSummary(matches, lanes) };
}

/** Every match on a lane, in queue order — what a filter has to look through. */
export function laneEntries(lane: CourtLane): LaneEntry[] {
  return [...(lane.live ? [lane.live] : []), ...(lane.next ? [lane.next] : []), ...lane.later, ...lane.played];
}

/** The complete court order a nudge asks the server for, one place either way. */
export function reorderedQueue(lane: CourtLane, itemId: string, delta: number): string[] | null {
  const ids = [...lane.court.scheduleItems]
    .sort((left, right) => left.queuePosition - right.queuePosition)
    .map((item) => item.id);
  const from = ids.indexOf(itemId);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= ids.length) return null;
  ids.splice(to, 0, ids.splice(from, 1)[0]!);
  return ids;
}
