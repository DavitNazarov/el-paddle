import type { MatchDto, MatchSetDto } from '@/types/tournament';
import { fillTemplate, tournamentCopy } from '@/lib/i18n/tournament';
import type { Locale } from '@/lib/i18n/types';

type ResultShape = Pick<MatchDto, 'scoringMode' | 'resultType'> & { scoreA: number | null; scoreB: number | null; sets?: MatchSetDto[] };

/** Reads "2–1 in sets" for set matches and a plain score for the historical point matches. */
export function formatMatchResult(match: ResultShape, locale: Locale) {
  if (match.scoreA === null || match.scoreB === null) return null;
  if (match.scoringMode !== 'SETS') return `${match.scoreA}–${match.scoreB}`;
  return fillTemplate(tournamentCopy[locale].matchDetail.setResult, { a: match.scoreA, b: match.scoreB });
}

/**
 * Per-set winners, or an empty list when there is nothing trustworthy to show: point matches,
 * redacted results, and admin decisions whose recorded sets no longer match the official tally.
 */
export function visibleSets(match: ResultShape) {
  if (match.scoringMode !== 'SETS' || match.resultType === 'ADMIN_DECISION') return [];
  return match.sets ?? [];
}
