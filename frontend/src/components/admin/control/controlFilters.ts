import type { CourtDto, MatchRoundDto } from '@/types/tournament';
import { clubNameOf } from './matchModel';
import { bandOf, laneEntries, type ControlMatch, type CourtLane, type MatchBand } from './runBoard';

/**
 * Narrowing a full event day down to the handful of matches in front of you.
 *
 * The four axes are the four ways an operator is interrupted: by a court ("what
 * is on three?"), by a category ("where are the women's doubles?"), by a round
 * ("are the quarters done?"), and by a name ("when does Ana play?"). They
 * combine, and every view of the console reads the same filter, so switching
 * view never loses the question being asked.
 */

/** The court value that means "not on a court at all", which is a real answer here. */
export const NO_COURT = 'none';

export type ControlFilters = {
  search: string;
  courtId: string | null;
  categoryId: string | null;
  round: MatchRoundDto | null;
  band: MatchBand | null;
  /** Only matches past their planned start — the day's actual problem list. */
  late: boolean;
};

export const emptyFilters: ControlFilters = {
  search: '',
  courtId: null,
  categoryId: null,
  round: null,
  band: null,
  late: false,
};

export function activeFilterCount(filters: ControlFilters) {
  return [
    filters.search.trim() ? 1 : 0,
    filters.courtId ? 1 : 0,
    filters.categoryId ? 1 : 0,
    filters.round ? 1 : 0,
    filters.band ? 1 : 0,
    filters.late ? 1 : 0,
  ].reduce((total, one) => total + one, 0);
}

export function hasActiveFilters(filters: ControlFilters) {
  return activeFilterCount(filters) > 0;
}

/**
 * Whether a court lane is worth drawing at all. A court filter names one court
 * outright; any other filter leaves the lane standing only if something on it
 * survives, so narrowing to "behind schedule" produces the two courts that are,
 * not eight lanes reporting that they are not.
 *
 * With nothing asked, every lane stays — including the empty ones, because a
 * court with nothing on it is exactly the thing an operator is looking for.
 */
export function laneIsVisible(filters: ControlFilters, lane: CourtLane) {
  if (filters.courtId && filters.courtId !== lane.court.id) return false;
  if (!hasActiveFilters(filters)) return true;
  return laneEntries(lane).some((entry) => matchesFilters(entry, filters));
}

export function matchesFilters(entry: ControlMatch, filters: ControlFilters) {
  if (filters.late && entry.lateBy === null) return false;
  if (filters.categoryId && entry.categoryId !== filters.categoryId) return false;
  if (filters.round && entry.match.round !== filters.round) return false;
  if (filters.band && bandOf(entry.match) !== filters.band) return false;
  if (filters.courtId) {
    const courtId = entry.court?.id ?? NO_COURT;
    if (courtId !== filters.courtId) return false;
  }
  return matchesSearch(entry, filters.search);
}

/**
 * One field for every name on the card. An operator is given a player, a club or
 * a match number and has to find the match; which of the three it was is not
 * worth a second control.
 */
export function matchesSearch(entry: ControlMatch, search: string) {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;
  return searchableText(entry).some((text) => text.toLowerCase().includes(needle));
}

function searchableText(entry: ControlMatch) {
  const { match } = entry;
  const names = [match.participantA, match.participantB].flatMap((side) =>
    side ? [side.owner.fullName, side.teammate.fullName] : []);
  return [
    ...names,
    clubNameOf(match, 'A'),
    clubNameOf(match, 'B'),
    entry.categoryName,
    entry.court?.name ?? '',
    String(match.matchNumber),
    `#${match.matchNumber}`,
  ].filter(Boolean);
}

export type FilterOption = { value: string; label: string; count: number };

/**
 * The options a filter is worth offering, each with what it would leave. A count
 * of zero still appears when it is the current choice, so the control never
 * disappears out from under the person using it.
 */
export function optionsWithCounts(
  entries: ControlMatch[],
  keyOf: (entry: ControlMatch) => string | null,
  labels: Map<string, string>,
  selected: string | null,
): FilterOption[] {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    const key = keyOf(entry);
    if (key !== null) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...labels.entries()]
    .map(([value, label]) => ({ value, label, count: counts.get(value) ?? 0 }))
    .filter((option) => option.count > 0 || option.value === selected);
}

export function courtLabels(courts: CourtDto[], noCourtLabel: string) {
  const labels = new Map(courts.map((court) => [court.id, court.name]));
  labels.set(NO_COURT, noCourtLabel);
  return labels;
}

export function categoryLabels(entries: ControlMatch[]) {
  return new Map(entries.map((entry) => [entry.categoryId, entry.categoryName]));
}
