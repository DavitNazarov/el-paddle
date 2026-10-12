import { MatchResultType, MatchStatus } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';

export type PlayerStats = {
  matchesPlayed: number;
  wins: number;
  losses: number;
};

type PlayerStatMatch = {
  winnerEntryId: string | null;
  snapshots: Array<{
    entryId: string;
    ownerUserId: string;
    teammateUserId: string;
  }>;
};

export function calculatePlayerStats(
  playerIds: string[],
  matches: PlayerStatMatch[],
) {
  const stats = new Map<string, PlayerStats>(
    playerIds.map((playerId) => [playerId, { matchesPlayed: 0, wins: 0, losses: 0 }]),
  );

  for (const match of matches) {
    for (const snapshot of match.snapshots) {
      const participantIds = new Set([snapshot.ownerUserId, snapshot.teammateUserId]);
      for (const playerId of participantIds) {
        const record = stats.get(playerId);
        if (!record) continue;
        record.matchesPlayed += 1;
        if (snapshot.entryId === match.winnerEntryId) record.wins += 1;
        else record.losses += 1;
      }
    }
  }

  return stats;
}

/**
 * How two players have fared against each other.
 *
 * Both sides are read off the same match's snapshots: a match counts when one
 * player's frozen entry and the other's are the two sides of it. Snapshots are
 * why this survives a club deletion or a name change — and why it can only see
 * matches from a locked draw, which is every played match there is.
 */
export async function getHeadToHead(playerId: string, opponentId: string) {
  const matches = await prisma.match.findMany({
    where: {
      status: MatchStatus.COMPLETED,
      resultType: { not: MatchResultType.BYE },
      bracket: { event: { resultsPublishedAt: { not: null } } },
      AND: [
        { snapshots: { some: { OR: [{ ownerUserId: playerId }, { teammateUserId: playerId }] } } },
        { snapshots: { some: { OR: [{ ownerUserId: opponentId }, { teammateUserId: opponentId }] } } },
      ],
    },
    orderBy: [{ completedAt: 'desc' }],
    select: {
      id: true,
      round: true,
      scoreA: true,
      scoreB: true,
      winnerEntryId: true,
      completedAt: true,
      bracket: { select: { event: { select: { id: true, title: true, date: true } } } },
      snapshots: { select: { entryId: true, ownerUserId: true, teammateUserId: true } },
    },
  });

  let wins = 0;
  let losses = 0;
  const played = matches.flatMap((match) => {
    const mine = match.snapshots.find(
      (snapshot) => snapshot.ownerUserId === playerId || snapshot.teammateUserId === playerId,
    );
    const theirs = match.snapshots.find(
      (snapshot) => snapshot.ownerUserId === opponentId || snapshot.teammateUserId === opponentId,
    );
    // Both on the same side of the draw is a partnership, not a meeting.
    if (!mine || !theirs || mine.entryId === theirs.entryId) return [];
    const won = match.winnerEntryId === mine.entryId;
    if (won) wins += 1;
    else losses += 1;
    return [{
      id: match.id,
      round: match.round,
      won,
      eventId: match.bracket.event.id,
      eventTitle: match.bracket.event.title,
      completedAt: match.completedAt?.toISOString() ?? null,
    }];
  });

  return { wins, losses, played: played.length, matches: played };
}

export async function getPlayerStats(
  playerIds: string[],
  options: { publicOnly?: boolean } = {},
) {
  if (!playerIds.length) return calculatePlayerStats([], []);

  const matches = await prisma.match.findMany({
    where: {
      status: MatchStatus.COMPLETED,
      resultType: { not: MatchResultType.BYE },
      ...(options.publicOnly
        ? { bracket: { event: { resultsPublishedAt: { not: null } } } }
        : {}),
      snapshots: {
        some: {
          OR: [
            { ownerUserId: { in: playerIds } },
            { teammateUserId: { in: playerIds } },
          ],
        },
      },
    },
    select: {
      winnerEntryId: true,
      snapshots: {
        where: {
          OR: [
            { ownerUserId: { in: playerIds } },
            { teammateUserId: { in: playerIds } },
          ],
        },
        select: {
          entryId: true,
          ownerUserId: true,
          teammateUserId: true,
        },
      },
    },
  });

  return calculatePlayerStats(playerIds, matches);
}
