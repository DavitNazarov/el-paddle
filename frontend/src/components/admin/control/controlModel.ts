import type { BracketDto, MatchDto } from '@/types/tournament';

/**
 * Pure reading for the match control console. The console answers one question —
 * what is happening on which court, between whom, and when — so everything here
 * turns a bracket into that answer. The brackets endpoint already carries each
 * match's schedule item and court, so no second fetch has to be joined in.
 */

/** The court a match sits on, or null while it is still waiting for one. */
export function courtOf(match: MatchDto) {
  return match.scheduleItem?.court ?? null;
}

export function plannedStartOf(match: MatchDto) {
  return match.scheduleItem?.plannedStartAt ?? null;
}

/**
 * The server freezes a started or finished schedule item, so its time can no
 * longer be moved. Offering the field anyway would only produce a 409.
 */
export function canEditTime(match: MatchDto) {
  const item = match.scheduleItem;
  return Boolean(item) && item!.status !== 'IN_PROGRESS' && item!.status !== 'COMPLETED';
}

/**
 * `datetime-local` speaks wall-clock text, the API speaks ISO. Both conversions
 * go through the browser's own zone, which is the zone the operator is standing in.
 */
export function toLocalInputValue(iso: string | null) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Empty input means "clear the time", which the API accepts as an explicit null. */
export function fromLocalInputValue(value: string): string | null {
  if (!value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function formatPlannedTime(iso: string | null, locale: string) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(locale === 'ka' ? 'ka-GE' : 'en-GB', { hour: '2-digit', minute: '2-digit' }).format(date);
}

export type ControlSummary = {
  live: number;
  ready: number;
  completed: number;
  total: number;
  /** Distinct courts with a match in progress right now. */
  courtsInPlay: number;
  /** Matches that are ready to run but have nowhere to be played. */
  awaitingCourt: number;
};

export function buildControlSummary(brackets: BracketDto[]): ControlSummary {
  const matches = brackets.flatMap((bracket) => bracket.matches);
  const playable = matches.filter((match) => match.status !== 'CANCELLED');
  const liveMatches = playable.filter((match) => match.status === 'IN_PROGRESS');
  return {
    live: liveMatches.length,
    ready: playable.filter((match) => match.status === 'READY').length,
    completed: playable.filter((match) => match.status === 'COMPLETED').length,
    total: playable.length,
    courtsInPlay: new Set(liveMatches.map((match) => courtOf(match)?.id).filter(Boolean)).size,
    awaitingCourt: playable.filter((match) => match.status === 'READY' && !match.scheduleItem).length,
  };
}

/**
 * Matches an operator can act on right now, most urgent first: what is running,
 * then what is ready to start. This is the console's "act on me" list, kept
 * separate from the bracket so it can lead the page.
 */
export function actionableMatches(brackets: BracketDto[]) {
  const rank = (match: MatchDto) => (match.status === 'IN_PROGRESS' ? 0 : 1);
  return brackets
    .flatMap((bracket) => bracket.matches.map((match) => ({ bracket, match })))
    .filter(({ match }) => match.status === 'IN_PROGRESS' || match.status === 'READY')
    .sort((left, right) => {
      const byStatus = rank(left.match) - rank(right.match);
      if (byStatus !== 0) return byStatus;
      const leftQueue = left.match.scheduleItem?.queuePosition ?? Number.MAX_SAFE_INTEGER;
      const rightQueue = right.match.scheduleItem?.queuePosition ?? Number.MAX_SAFE_INTEGER;
      if (leftQueue !== rightQueue) return leftQueue - rightQueue;
      return left.match.matchNumber - right.match.matchNumber;
    });
}
