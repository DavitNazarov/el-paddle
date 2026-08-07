import type { MatchDto } from '@/types/tournament';
import { isFinishedTally, maxSetsFor, setsToWin } from './setEngine';

/**
 * Pure reading for the match control console. The server stays authoritative for
 * every rule; this only decides what the console is allowed to *offer*, so an
 * operator is never shown a control the server would refuse.
 */

export type Side = 'A' | 'B';

export const SIDES: readonly Side[] = ['A', 'B'];

export function participantOf(match: MatchDto, side: Side) {
  return side === 'A' ? match.participantA : match.participantB;
}

export function tallyOf(match: MatchDto, side: Side) {
  return side === 'A' ? match.scoreA : match.scoreB;
}

/** Both names, because an operator checks them against the two people on court. */
export function pairName(entry: MatchDto['participantA'], fallback: string) {
  return entry ? `${entry.owner.fullName} / ${entry.teammate.fullName}` : fallback;
}

/**
 * Club shown beside a pair. Snapshots are written when the bracket locks, so every
 * match the console can act on carries one; before that there is nothing to show.
 */
export function clubNameOf(match: MatchDto, side: Side) {
  return match.snapshots?.find((snapshot) => snapshot.side === side)?.clubName ?? '';
}

export function isLive(match: MatchDto) {
  return match.status === 'IN_PROGRESS';
}

export function usesSets(match: MatchDto) {
  return match.scoringMode === 'SETS';
}

/**
 * A result can only be written onto a running match. Anything else — ready,
 * completed, cancelled — means the server would refuse, so the fields are off.
 */
export function canRecordResult(match: MatchDto) {
  return usesSets(match) && isLive(match);
}

/**
 * Starting needs a court: the server reads the match through its schedule item and
 * 404s without one. The console says so rather than offering a button that fails.
 */
export function canStart(match: MatchDto) {
  return match.status === 'READY' && Boolean(match.scheduleItem);
}

/** An abnormal finish (walkover, retirement) is offered while the match is open. */
export function canFinishEarly(match: MatchDto) {
  return (match.status === 'READY' || match.status === 'IN_PROGRESS')
    && Boolean(match.participantAEntryId)
    && Boolean(match.participantBEntryId);
}

export type SetProgress = {
  /** Sets played so far. */
  played: number;
  /** The most sets this match can ever run to, so a decider always exists. */
  max: number;
  /** Set wins needed to take the match. */
  winsNeeded: number;
};

export function setProgress(match: MatchDto): SetProgress {
  return { played: match.sets.length, max: maxSetsFor(match), winsNeeded: setsToWin(match) };
}

/** The two numbers as typed, before they are known to mean anything. */
export type ResultDraft = Record<Side, string>;

export const emptyResultDraft: ResultDraft = { A: '', B: '' };

/**
 * What the two typed numbers amount to. A result completes the match outright,
 * so the console reads it before it asks: only a finished tally is offered, and
 * one that would take back a set already recorded is refused here rather than by
 * the server.
 */
export type ResultReading = {
  a: number;
  b: number;
  winner: Side | null;
  /** Both numbers form a result the server would accept. */
  finished: boolean;
  /** The tally drops below sets already recorded, which is an undo, not a result. */
  regresses: boolean;
};

export function readResult(match: MatchDto, draft: ResultDraft): ResultReading {
  const a = tallyNumber(draft.A);
  const b = tallyNumber(draft.B);
  const finished = isFinishedTally(a, b, setsToWin(match));
  return {
    a,
    b,
    winner: finished ? (a > b ? 'A' : 'B') : null,
    finished,
    regresses: a < match.scoreA || b < match.scoreB,
  };
}

/** An empty or non-numeric field is not a zero; it is nothing yet. */
function tallyNumber(value: string) {
  return /^\d+$/.test(value.trim()) ? Number(value) : Number.NaN;
}
