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

/**
 * Byes, read off the draw's shape rather than its recorded state. A slot no team
 * can ever arrive at decides the match beside it: whoever stands there walks into
 * the next round, and walks again if the branch feeding that round is empty too.
 * The server applies exactly this when the bracket locks, so a draft reads the way
 * the locked draw will.
 */
export type DrawByes = {
  /** Matches decided without being played. */
  byeMatchIds: Set<string>;
  /** Matches no team can ever reach — the hole a rearranged draw leaves behind. */
  emptyMatchIds: Set<string>;
  /** Entry standing at `matchId:side` once every bye below it is applied. */
  occupants: Map<string, string>;
};

export function byeSlotKey(matchId: string, side: 'A' | 'B') {
  return `${matchId}:${side}`;
}

export function readByes(bracket: BracketDto): DrawByes {
  // Match numbers run straight through the draw, so playing order is also the
  // order in which a bye can be known: every feeder is read before its target.
  const ordered = [...bracket.matches].sort((a, b) => a.matchNumber - b.matchNumber);
  const feeders = new Map<string, Partial<Record<'A' | 'B', MatchDto>>>();
  for (const match of ordered) {
    if (!match.nextMatchId || !match.nextMatchSlot) continue;
    const target = feeders.get(match.nextMatchId) ?? {};
    target[match.nextMatchSlot] = match;
    feeders.set(match.nextMatchId, target);
  }

  const byes: DrawByes = { byeMatchIds: new Set(), emptyMatchIds: new Set(), occupants: new Map() };
  const producesWinner = new Map<string, boolean>();
  const occupantOf = (match: MatchDto, side: 'A' | 'B') =>
    (side === 'A' ? match.participantAEntryId : match.participantBEntryId) ?? byes.occupants.get(byeSlotKey(match.id, side)) ?? null;

  for (const match of ordered) {
    if (match.status === 'CANCELLED') {
      byes.emptyMatchIds.add(match.id);
      producesWinner.set(match.id, false);
      continue;
    }
    if (match.resultType === 'BYE') byes.byeMatchIds.add(match.id);
    if (match.status !== 'PENDING' && match.status !== 'READY') {
      producesWinner.set(match.id, true);
      continue;
    }
    const feeder = feeders.get(match.id) ?? {};
    const isLive = (side: 'A' | 'B') => {
      const source = feeder[side];
      return Boolean(occupantOf(match, side)) || Boolean(source && producesWinner.get(source.id));
    };
    const liveA = isLive('A');
    const liveB = isLive('B');
    if (!liveA && !liveB) {
      byes.emptyMatchIds.add(match.id);
      producesWinner.set(match.id, false);
      continue;
    }
    producesWinner.set(match.id, true);
    if (liveA && liveB) continue;
    const side = liveA ? 'A' : 'B';
    const entryId = occupantOf(match, side);
    // The live side is a match still to be played: this becomes a bye when that
    // match produces a winner, not now.
    if (!entryId) continue;
    byes.byeMatchIds.add(match.id);
    if (match.nextMatchId && match.nextMatchSlot) byes.occupants.set(byeSlotKey(match.nextMatchId, match.nextMatchSlot), entryId);
  }
  return byes;
}

/** Team names by entry id, so a slot a bye fills can be named before the server fills it. */
export function entryNames(bracket: BracketDto) {
  const names = new Map<string, string>();
  for (const match of bracket.matches) {
    for (const entry of [match.participantA, match.participantB]) {
      if (entry) names.set(entry.id, `${entry.owner.fullName} / ${entry.teammate.fullName}`);
    }
  }
  return names;
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
export type DrawSummary = {
  categoryId: string;
  categoryName: string;
  /** False when no bracket row exists yet — the draw has not entered the sequence. */
  created: boolean;
  entries: number;
  matchCount: number;
  completedCount: number;
  champion: string | null;
};

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
      entries: bracket.size,
      matchCount: bracket.matches.length,
      completedCount: bracket.matches.filter((match) => match.status === 'COMPLETED').length,
      champion: final && finalWinner ? pairLabel(bracket, final, finalWinner, locale) : null,
    };
  });
}
