import { describe, expect, it } from 'vitest';
import type { BracketDto, MatchDto } from '@/types/tournament';
import { byeSlotKey, readByes } from './bracketModel';

const rounds: { size: number; round: MatchDto['round'] }[] = [
  { size: 32, round: 'ROUND_OF_32' },
  { size: 16, round: 'ROUND_OF_16' },
  { size: 8, round: 'QUARTERFINAL' },
  { size: 4, round: 'SEMIFINAL' },
  { size: 2, round: 'FINAL' },
];

function match(overrides: Partial<MatchDto> & Pick<MatchDto, 'id' | 'matchNumber' | 'round'>): MatchDto {
  return {
    bracketId: 'b1',
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
    setCount: null,
    setCountOverride: null,
    setsToWin: null,
    maxSets: null,
    sets: [],
    status: 'PENDING',
    resultType: null,
    resultReason: null,
    winnerEntryId: null,
    version: 1,
    startedAt: null,
    completedAt: null,
    snapshots: [],
    ...overrides,
  };
}

/** The same graph `createMatchGraph` writes, described by who stands in its first round. */
function draw(size: number, firstRound: (string | null)[]): BracketDto {
  const plan = rounds.filter((item) => item.size <= size).map((item) => ({ round: item.round, count: item.size / 2, firstMatchNumber: size - item.size + 1 }));
  const byRound = new Map<number, MatchDto[]>();
  const matches: MatchDto[] = [];
  for (let index = plan.length - 1; index >= 0; index -= 1) {
    const current = plan[index]!;
    const next = byRound.get(index + 1) ?? [];
    const created = Array.from({ length: current.count }, (_unused, offset) => {
      const position = offset + 1;
      const target = next[Math.floor(offset / 2)];
      return match({
        id: `m${current.firstMatchNumber + offset}`,
        matchNumber: current.firstMatchNumber + offset,
        round: current.round,
        roundPosition: position,
        nextMatchId: target?.id ?? null,
        nextMatchSlot: target ? (position % 2 === 1 ? 'A' : 'B') : null,
      });
    });
    byRound.set(index, created);
    matches.unshift(...created);
  }
  const opening = byRound.get(0)!;
  firstRound.forEach((entryId, slot) => {
    const target = opening[Math.floor(slot / 2)]!;
    if (slot % 2 === 0) target.participantAEntryId = entryId;
    else target.participantBEntryId = entryId;
    if (target.participantAEntryId && target.participantBEntryId) target.status = 'READY';
  });
  return {
    id: 'b1',
    eventId: 'e1',
    categoryId: 'c1',
    size,
    status: 'DRAFT',
    generation: 1,
    version: 1,
    lockedAt: null,
    publishedAt: null,
    setDefaults: {},
    eventCategory: { category: { id: 'c1', name: "Men's Open", description: '' } },
    matches,
  } as unknown as BracketDto;
}

describe('reading byes off a draft draw', () => {
  it('finds none in a full draw', () => {
    const byes = readByes(draw(8, ['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8']));
    expect(byes.byeMatchIds.size).toBe(0);
    expect(byes.emptyMatchIds.size).toBe(0);
  });

  it('marks every team with no opponent as a bye and seats it in the next round', () => {
    const byes = readByes(draw(8, ['t1', 't2', 't3', null, 't4', null, 't5', null]));
    expect([...byes.byeMatchIds].sort()).toEqual(['m2', 'm3', 'm4']);
    expect(byes.emptyMatchIds.size).toBe(0);
    expect(byes.occupants.get(byeSlotKey('m5', 'B'))).toBe('t3');
    expect(byes.occupants.get(byeSlotKey('m6', 'A'))).toBe('t4');
    expect(byes.occupants.get(byeSlotKey('m6', 'B'))).toBe('t5');
  });

  it('carries a team through more than one empty round', () => {
    const byes = readByes(draw(8, [null, null, 't1', null, 't2', 't3', 't4', null]));
    expect([...byes.emptyMatchIds]).toEqual(['m1']);
    expect([...byes.byeMatchIds].sort()).toEqual(['m2', 'm4', 'm5']);
    expect(byes.occupants.get(byeSlotKey('m7', 'A'))).toBe('t1');
  });

  it('waits for a match still to be played before calling the round above it a bye', () => {
    const byes = readByes(draw(8, [null, null, 't1', 't2', 't3', 't4', 't5', 't6']));
    expect([...byes.emptyMatchIds]).toEqual(['m1']);
    expect(byes.byeMatchIds.size).toBe(0);
  });

  it('keeps reading a bye the server has already recorded', () => {
    const bracket = draw(8, ['t1', 't2', 't3', null, 't4', 't5', 't6', 't7']);
    const recorded = bracket.matches.find((item) => item.id === 'm2')!;
    recorded.status = 'COMPLETED';
    recorded.resultType = 'BYE';
    recorded.winnerEntryId = 't3';
    bracket.matches.find((item) => item.id === 'm5')!.participantBEntryId = 't3';
    const byes = readByes(bracket);
    expect([...byes.byeMatchIds]).toEqual(['m2']);
    expect(byes.emptyMatchIds.size).toBe(0);
  });
});
