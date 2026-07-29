import type { MatchDto, MatchSlotDto } from '@/types/tournament';
import { fillTemplate, tournamentCopy } from '@/lib/i18n/tournament';
import type { Locale } from '@/lib/i18n/types';

type ResultShape = Pick<MatchDto, 'scoringMode' | 'resultType'> & { scoreA: number | null; scoreB: number | null; slots?: MatchSlotDto[] };

/** Reads "2–1 in slots" for slot matches and a plain score for the historical point matches. */
export function formatMatchResult(match: ResultShape, locale: Locale) {
  if (match.scoreA === null || match.scoreB === null) return null;
  if (match.scoringMode !== 'SLOTS') return `${match.scoreA}–${match.scoreB}`;
  return fillTemplate(tournamentCopy[locale].matchDetail.slotResult, { a: match.scoreA, b: match.scoreB });
}

/**
 * Per-slot winners, or an empty list when there is nothing trustworthy to show: point matches,
 * redacted results, and admin decisions whose recorded slots no longer match the official tally.
 */
export function visibleSlots(match: ResultShape) {
  if (match.scoringMode !== 'SLOTS' || match.resultType === 'ADMIN_DECISION') return [];
  return match.slots ?? [];
}
