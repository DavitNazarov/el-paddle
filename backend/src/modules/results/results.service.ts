import {
  BracketStatus,
  MatchRound,
  MatchStatus,
  type Prisma,
} from '../../generated/prisma/client.js';
import { entryUserSelect } from '../../common/includes.js';
import { jsonError } from '../../common/http.js';
import { prisma } from '../../database/prisma.js';

/**
 * Who finished where.
 *
 * `Event.resultsPublishedAt` has always been a publication switch with nothing
 * behind it: the flag gated match *history*, but the one thing a tournament is
 * read for afterwards — who won it — was never computed anywhere. It is not new
 * information, it is the draw read backwards: the final's winner and loser, and
 * the teams the semifinals eliminated.
 *
 * Identity comes from the snapshot the draw froze at lock, exactly like every
 * other read of a played match, so a result stays correct after a player changes
 * their name or their club is deleted.
 */

const resultsBracketInclude = {
  eventCategory: { include: { category: true } },
  matches: {
    select: {
      id: true,
      round: true,
      matchNumber: true,
      status: true,
      scoreA: true,
      scoreB: true,
      resultType: true,
      completedAt: true,
      participantAEntryId: true,
      participantBEntryId: true,
      winnerEntryId: true,
      loserEntryId: true,
      snapshots: true,
      participantA: { include: { club: { select: { id: true, name: true } }, owner: { select: entryUserSelect }, teammate: { select: entryUserSelect } } },
      participantB: { include: { club: { select: { id: true, name: true } }, owner: { select: entryUserSelect }, teammate: { select: entryUserSelect } } },
    },
  },
} satisfies Prisma.BracketInclude;

type ResultsBracket = Prisma.BracketGetPayload<{ include: typeof resultsBracketInclude }>;
type ResultsMatch = ResultsBracket['matches'][number];

export type ResultTeam = {
  entryId: string;
  ownerName: string;
  teammateName: string;
  clubId: string | null;
  clubName: string | null;
};

function displayName(user: { name: string | null; surname: string | null; email: string }) {
  return [user.name, user.surname].filter(Boolean).join(' ') || user.email;
}

/**
 * Every team the draw knows about, by entry. The frozen snapshot wins wherever
 * one exists; the live registration is the fallback for a draw locked under
 * older code, which is the same order `carryParticipantSnapshot` reads in.
 */
function teamsByEntry(matches: ResultsMatch[]) {
  const teams = new Map<string, ResultTeam>();

  for (const match of matches) {
    for (const entry of [match.participantA, match.participantB]) {
      if (!entry || teams.has(entry.id)) continue;
      teams.set(entry.id, {
        entryId: entry.id,
        ownerName: displayName(entry.owner),
        teammateName: displayName(entry.teammate),
        clubId: entry.club?.id ?? null,
        clubName: entry.club?.name ?? null,
      });
    }
  }

  for (const match of matches) {
    for (const snapshot of match.snapshots) {
      teams.set(snapshot.entryId, {
        entryId: snapshot.entryId,
        ownerName: snapshot.ownerName,
        teammateName: snapshot.teammateName,
        clubId: snapshot.clubId,
        clubName: snapshot.clubName,
      });
    }
  }

  return teams;
}

function serializeResultMatch(match: ResultsMatch) {
  return {
    id: match.id,
    matchNumber: match.matchNumber,
    round: match.round,
    status: match.status,
    scoreA: match.scoreA,
    scoreB: match.scoreB,
    resultType: match.resultType,
    completedAt: match.completedAt?.toISOString() ?? null,
  };
}

function bracketResult(bracket: ResultsBracket) {
  const teams = teamsByEntry(bracket.matches);
  const team = (entryId: string | null) => (entryId ? teams.get(entryId) ?? null : null);

  const final = bracket.matches.find((match) => match.round === MatchRound.FINAL) ?? null;
  const decided = final?.status === MatchStatus.COMPLETED;
  const semifinals = bracket.matches
    .filter((match) => match.round === MatchRound.SEMIFINAL && match.status === MatchStatus.COMPLETED)
    .sort((left, right) => left.matchNumber - right.matchNumber);

  const champion = decided ? team(final!.winnerEntryId) : null;
  const runnerUp = decided ? team(final!.loserEntryId) : null;
  // Third place is not played, so both losing semifinalists share it. Saying so
  // is more honest than ordering them by a match that never happened.
  const semifinalists = semifinals
    .map((match) => team(match.loserEntryId))
    .filter((entry): entry is ResultTeam => Boolean(entry));

  const standings = [
    ...(champion ? [{ place: 1, team: champion }] : []),
    ...(runnerUp ? [{ place: 2, team: runnerUp }] : []),
    ...semifinalists.map((entry) => ({ place: 3, team: entry })),
  ];

  return {
    bracketId: bracket.id,
    categoryId: bracket.categoryId,
    categoryName: bracket.eventCategory.category.name,
    size: bracket.size,
    status: bracket.status,
    decided,
    champion,
    runnerUp,
    semifinalists,
    standings,
    finalMatch: final ? serializeResultMatch(final) : null,
    semifinalMatches: semifinals.map(serializeResultMatch),
  };
}

/**
 * `publicOnly` is the same gate the public match history uses: the event has to
 * have published its final results. A draft draw is never a result, so only
 * locked and completed brackets are read either way.
 */
export async function getEventResults(eventId: string, { publicOnly }: { publicOnly: boolean }) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      date: true,
      status: true,
      isPublished: true,
      resultsPublishedAt: true,
    },
  });
  if (!event) jsonError('Event not found.', 404);
  if (publicOnly && (!event.isPublished || !event.resultsPublishedAt)) {
    jsonError('Event not found.', 404);
  }

  const brackets = await prisma.bracket.findMany({
    where: {
      eventId,
      status: { in: [BracketStatus.LOCKED, BracketStatus.COMPLETED] },
    },
    orderBy: { createdAt: 'asc' },
    include: resultsBracketInclude,
  });

  const categories = brackets.map(bracketResult);
  return {
    event: {
      id: event.id,
      title: event.title,
      date: event.date.toISOString(),
      status: event.status,
      resultsPublished: Boolean(event.resultsPublishedAt),
      resultsPublishedAt: event.resultsPublishedAt?.toISOString() ?? null,
    },
    categories,
    decided: categories.length > 0 && categories.every((category) => category.decided),
  };
}
