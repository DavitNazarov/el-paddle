import type { BracketDto, MatchDto } from '@/types/tournament';
import type { EventDto } from '@/types/admin';
import type { Locale } from '@/lib/i18n/types';
import { fillTemplate, tournamentCopy } from '@/lib/i18n/tournament';

/**
 * Pure bracket reading. Everything here answers a question about a draw without
 * touching React, so the presentational components stay prop-driven and the
 * preview route can build a whole screen from fixtures.
 */

/** Every round a draw can hold, in the order they are played. */
const rounds: MatchDto['round'][] = ['ROUND_OF_32', 'ROUND_OF_16', 'QUARTERFINAL', 'SEMIFINAL', 'FINAL'];

export function activeRounds(matches: MatchDto[]) {
  const present = new Set(matches.map((match) => match.round));
  return rounds.filter((round) => present.has(round));
}

export function pairLabel(bracket: BracketDto, match: MatchDto, side: 'A' | 'B', locale: Locale) {
  const entry = side === 'A' ? match.participantA : match.participantB;
  if (entry) return `${entry.owner.fullName} / ${entry.teammate.fullName}`;
  const source = bracket.matches.find((candidate) => candidate.nextMatchId === match.id && candidate.nextMatchSlot === side);
  const copy = tournamentCopy[locale].publicEvent;
  return source ? fillTemplate(copy.winnerOfMatch, { number: source.matchNumber }) : copy.toBeDetermined;
}

/** Set format an unstarted match would use: its override, else the bracket round default, else one. */
export function effectiveSetCount(bracket: BracketDto, match: MatchDto) {
  return match.setCount ?? match.setCountOverride ?? bracket.setDefaults[match.round] ?? 1;
}

export function winnerSide(match: MatchDto): 'A' | 'B' | null {
  if (match.winnerEntryId && match.winnerEntryId === match.participantAEntryId) return 'A';
  if (match.winnerEntryId && match.winnerEntryId === match.participantBEntryId) return 'B';
  if (match.status !== 'COMPLETED' || match.scoreA === match.scoreB) return null;
  return match.scoreA > match.scoreB ? 'A' : 'B';
}

function decidedEntryId(match: MatchDto): string | null {
  if (match.winnerEntryId) return match.winnerEntryId;
  const side = winnerSide(match);
  if (!side) return null;
  return side === 'A' ? match.participantAEntryId : match.participantBEntryId;
}

export function championEntryId(bracket: BracketDto): string | null {
  const final = bracket.matches.find((match) => match.round === 'FINAL');
  return final ? decidedEntryId(final) : null;
}

/**
 * The matches the champion won — their route through the draw. Emphasising that
 * route is what turns a grid of results back into the story of the tournament.
 */
export function championPathMatchIds(bracket: BracketDto): Set<string> {
  const champion = championEntryId(bracket);
  if (!champion) return new Set<string>();
  return new Set(
    bracket.matches.filter((match) => decidedEntryId(match) === champion).map((match) => match.id),
  );
}

/** A first-round participant slot, addressed as `matchId:side` while dragging. */
export type PlacementSlot = { bracketId: string; matchId: string; side: 'A' | 'B' };

export function slotKey(slot: PlacementSlot) {
  return `${slot.matchId}:${slot.side}`;
}

export function parseSlotKey(key: string, bracketId: string): PlacementSlot | null {
  const [matchId, side] = key.split(':');
  if (!matchId || (side !== 'A' && side !== 'B')) return null;
  return { bracketId, matchId, side };
}

export function firstRoundOf(bracket: BracketDto) {
  return activeRounds(bracket.matches)[0] ?? null;
}

export function slotLabel(brackets: BracketDto[], slot: PlacementSlot, locale: Locale) {
  const bracket = brackets.find((candidate) => candidate.id === slot.bracketId);
  const match = bracket?.matches.find((candidate) => candidate.id === slot.matchId);
  return bracket && match ? pairLabel(bracket, match, slot.side, locale) : '';
}

/** Every other first-round slot in the same bracket, as options for the move-entry fallback. */
export function placementTargets(brackets: BracketDto[], source: PlacementSlot, locale: Locale) {
  const bracket = brackets.find((candidate) => candidate.id === source.bracketId);
  if (!bracket) return [];
  const firstRound = firstRoundOf(bracket);
  const copy = tournamentCopy[locale].admin.bracket;
  return bracket.matches
    .filter((match) => match.round === firstRound)
    .flatMap((match) => (['A', 'B'] as const).map((side) => ({ match, side })))
    .filter(({ match, side }) => !(match.id === source.matchId && side === source.side))
    .map(({ match, side }) => {
      const entryId = side === 'A' ? match.participantAEntryId : match.participantBEntryId;
      return {
        value: `${match.id}:${side}`,
        label: fillTemplate(copy.slotOptionLabel, {
          number: match.matchNumber,
          side,
          occupant: entryId ? pairLabel(bracket, match, side, locale) : copy.slotEmpty,
        }),
      };
    });
}

/**
 * The three stops a draw passes through. Publication is genuinely independent of
 * the lifecycle, but from this screen it is the last thing left to do, so it
 * reads as the final stop rather than a separate switch.
 */
export const drawStages = ['DRAFT', 'LOCKED', 'PUBLISHED'] as const;

export type DrawSummary = {
  categoryId: string;
  categoryName: string;
  /** False when no bracket row exists yet — the draw has not entered the sequence. */
  created: boolean;
  /** Index into `drawStages`, or -1 when the draw has not been created. */
  stageIndex: number;
  entries: number;
  matchCount: number;
  completedCount: number;
  champion: string | null;
};

function stageIndexOf(bracket: BracketDto) {
  if (bracket.publishedAt) return 2;
  return bracket.status === 'DRAFT' ? 0 : 1;
}

/** One summary per category, in the event's own category order. */
export function buildDrawSummaries(
  categories: EventDto['categories'],
  brackets: BracketDto[],
  locale: Locale,
): DrawSummary[] {
  return categories.map((category) => {
    const bracket = brackets.find((candidate) => candidate.categoryId === category.id);
    if (!bracket) {
      return {
        categoryId: category.id,
        categoryName: category.name,
        created: false,
        stageIndex: -1,
        entries: 0,
        matchCount: 0,
        completedCount: 0,
        champion: null,
      };
    }
    const final = bracket.matches.find((match) => match.round === 'FINAL');
    const finalWinner = final ? winnerSide(final) : null;
    return {
      categoryId: category.id,
      categoryName: category.name,
      created: true,
      stageIndex: stageIndexOf(bracket),
      entries: bracket.size,
      matchCount: bracket.matches.length,
      completedCount: bracket.matches.filter((match) => match.status === 'COMPLETED').length,
      champion: final && finalWinner ? pairLabel(bracket, final, finalWinner, locale) : null,
    };
  });
}
