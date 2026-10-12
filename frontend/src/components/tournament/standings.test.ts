import { describe, expect, it } from 'vitest';
import { bracketStandings } from './PublicEventSections';
import type { BracketDto, MatchDto } from '@/types/tournament';

/**
 * The podium is read off the draw, so these fixtures are draws rather than
 * result objects: a final, the semifinals that fed it, and the snapshots the
 * lock froze onto each side.
 */
function match(overrides: Partial<MatchDto> & Pick<MatchDto, 'id' | 'round' | 'matchNumber'>): MatchDto {
  return {
    bracketId: 'bracket-1',
    roundPosition: 1,
    participantAEntryId: null,
    participantBEntryId: null,
    nextMatchId: null,
    nextMatchSlot: null,
    participantA: null,
    participantB: null,
    scoreA: 0,
    scoreB: 0,
    scoringMode: 'SETS',
    setCount: 2,
    setCountOverride: null,
    setsToWin: 2,
    maxSets: 3,
    sets: [],
    status: 'COMPLETED',
    resultType: 'NORMAL',
    resultReason: null,
    winnerEntryId: null,
    version: 1,
    startedAt: null,
    completedAt: null,
    snapshots: [],
    ...overrides,
  };
}

function snapshot(side: 'A' | 'B', owner: string, mate: string, club: string | null = null) {
  return { side, clubId: club ? 'club' : null, clubName: club, ownerName: owner, teammateName: mate };
}

function bracket(matches: MatchDto[]): BracketDto {
  return {
    id: 'bracket-1',
    eventId: 'event-1',
    categoryId: 'category-1',
    size: 4,
    status: 'COMPLETED',
    generation: 1,
    version: 3,
    lockedAt: '2026-08-01T09:00:00.000Z',
    publishedAt: '2026-08-01T09:00:00.000Z',
    setDefaults: {},
    eventCategory: { category: { id: 'category-1', name: 'Open' } },
    matches,
  } as unknown as BracketDto;
}

describe('bracketStandings', () => {
  it('says nothing until the final has been played', () => {
    expect(bracketStandings(bracket([
      match({ id: 'm1', round: 'FINAL', matchNumber: 3, status: 'READY' }),
    ]))).toEqual([]);
  });

  it('reads the champion and runner-up off the final', () => {
    const standings = bracketStandings(bracket([
      match({
        id: 'm3',
        round: 'FINAL',
        matchNumber: 3,
        participantAEntryId: 'entry-a',
        participantBEntryId: 'entry-b',
        winnerEntryId: 'entry-b',
        snapshots: [snapshot('A', 'Ana', 'Beka', 'North'), snapshot('B', 'Cato', 'Dato', 'South')],
      }),
    ]));

    expect(standings).toEqual([
      { place: 1, team: { names: 'Cato / Dato', club: 'South' } },
      { place: 2, team: { names: 'Ana / Beka', club: 'North' } },
    ]);
  });

  it('gives both losing semifinalists the same third place', () => {
    const standings = bracketStandings(bracket([
      match({
        id: 'm1',
        round: 'SEMIFINAL',
        matchNumber: 1,
        participantAEntryId: 'entry-a',
        participantBEntryId: 'entry-c',
        winnerEntryId: 'entry-a',
        snapshots: [snapshot('A', 'Ana', 'Beka'), snapshot('B', 'Eka', 'Fira')],
      }),
      match({
        id: 'm2',
        round: 'SEMIFINAL',
        matchNumber: 2,
        participantAEntryId: 'entry-b',
        participantBEntryId: 'entry-d',
        winnerEntryId: 'entry-b',
        snapshots: [snapshot('A', 'Cato', 'Dato'), snapshot('B', 'Gia', 'Hana')],
      }),
      match({
        id: 'm3',
        round: 'FINAL',
        matchNumber: 3,
        participantAEntryId: 'entry-a',
        participantBEntryId: 'entry-b',
        winnerEntryId: 'entry-b',
        snapshots: [snapshot('A', 'Ana', 'Beka'), snapshot('B', 'Cato', 'Dato')],
      }),
    ]));

    expect(standings.map((standing) => standing.place)).toEqual([1, 2, 3, 3]);
    expect(standings.map((standing) => standing.team.names)).toEqual([
      'Cato / Dato',
      'Ana / Beka',
      'Eka / Fira',
      'Gia / Hana',
    ]);
  });

  /**
   * A club can be deleted while its teams are still playing, which nulls the
   * snapshot's club. Recording "no club" is the honest answer; dropping the team
   * from the podium is not.
   */
  it('keeps a team whose club is gone', () => {
    const standings = bracketStandings(bracket([
      match({
        id: 'm3',
        round: 'FINAL',
        matchNumber: 3,
        participantAEntryId: 'entry-a',
        participantBEntryId: 'entry-b',
        winnerEntryId: 'entry-a',
        snapshots: [snapshot('A', 'Ana', 'Beka', null), snapshot('B', 'Cato', 'Dato', 'South')],
      }),
    ]));

    expect(standings[0]).toEqual({ place: 1, team: { names: 'Ana / Beka', club: null } });
  });

  it('falls back to the score when no winner id was recorded', () => {
    const standings = bracketStandings(bracket([
      match({
        id: 'm3',
        round: 'FINAL',
        matchNumber: 3,
        participantAEntryId: 'entry-a',
        participantBEntryId: 'entry-b',
        scoreA: 2,
        scoreB: 1,
        snapshots: [snapshot('A', 'Ana', 'Beka'), snapshot('B', 'Cato', 'Dato')],
      }),
    ]));

    expect(standings[0]?.team.names).toBe('Ana / Beka');
    expect(standings[1]?.team.names).toBe('Cato / Dato');
  });
});
