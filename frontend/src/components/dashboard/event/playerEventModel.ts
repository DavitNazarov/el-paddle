import type { RegistrationDto } from '@/types/dashboard';
import type { BracketDto, CourtDto, MatchDto, OpponentRequestDto, ScheduleItemDto } from '@/types/tournament';

/**
 * Pure reading for a player's own event page. Everything here answers a
 * question in the player's words — am I in, who am I playing, when do I play —
 * rather than exposing the bracket and schedule tables wholesale. A player has
 * no use for other people's matches.
 */

export function ownEntryIds(entries: RegistrationDto[]) {
  return new Set(entries.map((entry) => entry.id));
}

export function approvedEntries(entries: RegistrationDto[]) {
  return entries.filter((entry) => entry.status === 'APPROVED');
}

/* ---- Opponent requests ---- */

export function receivedRequests(requests: OpponentRequestDto[], mine: Set<string>) {
  return requests.filter((request) => mine.has(request.targetEntryId));
}

export function sentRequests(requests: OpponentRequestDto[], mine: Set<string>) {
  return requests.filter((request) => mine.has(request.requestingEntryId));
}

/** A request only awaits an answer while nobody has given one. */
export function canRespond(request: OpponentRequestDto) {
  return request.status === 'PENDING_RESPONSE';
}

/**
 * The sender may pull a request back until an admin has acted on it. Once it is
 * approved, overridden or applied to the bracket it belongs to the draw.
 */
export function canWithdraw(request: OpponentRequestDto) {
  return request.status === 'PENDING_RESPONSE' || request.status === 'ACCEPTED_BY_OPPONENT';
}

/** The other pair in the request, from the reader's side of it. */
export function opponentOf(request: OpponentRequestDto, side: 'sent' | 'received') {
  return side === 'sent' ? request.targetEntry : request.requestingEntry;
}

export function requestReason(request: OpponentRequestDto) {
  return request.responseReason || request.adminPublicReason || '';
}

/* ---- Their matches ---- */

export type PlayerMatch = {
  match: MatchDto;
  /** Which side of the match the reader is on, so their own pair can be marked. */
  side: 'A' | 'B';
  courtName: string | null;
  plannedStartAt: string | null;
  scheduleStatus: ScheduleItemDto['status'] | null;
};

function sideOf(match: MatchDto, mine: Set<string>): 'A' | 'B' | null {
  if (match.participantAEntryId && mine.has(match.participantAEntryId)) return 'A';
  if (match.participantBEntryId && mine.has(match.participantBEntryId)) return 'B';
  return null;
}

/**
 * Only the matches the reader is actually in, each carrying where and when it
 * is played. The old page listed every match in every draw, which is the
 * tournament's view of the event, not the competitor's.
 */
export function playerMatches(brackets: BracketDto[], courts: CourtDto[], mine: Set<string>): PlayerMatch[] {
  const placement = new Map<string, { courtName: string; item: ScheduleItemDto }>();
  for (const court of courts) {
    for (const item of court.scheduleItems) {
      placement.set(item.matchId, { courtName: court.name, item });
    }
  }

  const found: PlayerMatch[] = [];
  for (const bracket of brackets) {
    for (const match of bracket.matches) {
      const side = sideOf(match, mine);
      if (!side) continue;
      const placed = placement.get(match.id);
      found.push({
        match,
        side,
        courtName: placed?.courtName ?? null,
        plannedStartAt: placed?.item.plannedStartAt ?? null,
        scheduleStatus: placed?.item.status ?? null,
      });
    }
  }

  return found.sort(compareMatches);
}

/**
 * What is happening now, then what is next, then what is done — a competitor
 * reads this page to find out when they are on.
 */
const statusWeight: Record<string, number> = { IN_PROGRESS: 0, READY: 1, PENDING: 2, COMPLETED: 3, CANCELLED: 4 };

function compareMatches(left: PlayerMatch, right: PlayerMatch) {
  const byStatus = (statusWeight[left.match.status] ?? 9) - (statusWeight[right.match.status] ?? 9);
  if (byStatus) return byStatus;

  // A match with a time beats one without: the reader can act on a time.
  if (left.plannedStartAt && right.plannedStartAt) {
    return new Date(left.plannedStartAt).getTime() - new Date(right.plannedStartAt).getTime();
  }
  if (left.plannedStartAt) return -1;
  if (right.plannedStartAt) return 1;
  return left.match.matchNumber - right.match.matchNumber;
}

/** Whether a score is worth showing at all: nothing has been played before the match starts. */
export function hasScore(match: MatchDto) {
  return match.status === 'IN_PROGRESS' || match.status === 'COMPLETED';
}

/** Did the reader's side win? Null while that is not yet decided. */
export function didWin(entry: PlayerMatch): boolean | null {
  if (entry.match.status !== 'COMPLETED') return null;
  const mine = entry.side === 'A' ? entry.match.scoreA : entry.match.scoreB;
  const theirs = entry.side === 'A' ? entry.match.scoreB : entry.match.scoreA;
  if (mine === theirs) return null;
  return mine > theirs;
}
