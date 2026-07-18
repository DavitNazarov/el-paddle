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
