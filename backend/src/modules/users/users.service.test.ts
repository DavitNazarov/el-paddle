import { describe, expect, it } from 'vitest';
import { calculatePublicPlayerStats } from './users.service.js';

describe('public player records', () => {
  it('derives wins and losses from event match snapshots', () => {
    const stats = calculatePublicPlayerStats(['player-a', 'player-b'], [
      {
        winnerEntryId: 'entry-a',
        snapshots: [
          { entryId: 'entry-a', ownerUserId: 'player-a', teammateUserId: 'teammate-a' },
          { entryId: 'entry-b', ownerUserId: 'player-b', teammateUserId: 'teammate-b' },
        ],
      },
      {
        winnerEntryId: 'entry-c',
        snapshots: [
          { entryId: 'entry-c', ownerUserId: 'player-b', teammateUserId: 'teammate-c' },
          { entryId: 'entry-d', ownerUserId: 'player-a', teammateUserId: 'teammate-d' },
        ],
      },
    ]);

    expect(stats.get('player-a')).toEqual({ matchesPlayed: 2, wins: 1, losses: 1 });
    expect(stats.get('player-b')).toEqual({ matchesPlayed: 2, wins: 1, losses: 1 });
  });

  it('counts a player only once per match snapshot', () => {
    const stats = calculatePublicPlayerStats(['player-a'], [
      {
        winnerEntryId: 'entry-a',
        snapshots: [
          { entryId: 'entry-a', ownerUserId: 'player-a', teammateUserId: 'player-a' },
        ],
      },
    ]);

    expect(stats.get('player-a')).toEqual({ matchesPlayed: 1, wins: 1, losses: 0 });
  });
});
