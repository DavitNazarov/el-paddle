import { describe, expect, it } from 'vitest';
import { MatchSide, MatchStatus } from '../../generated/prisma/client.js';
import { roundPlan } from './brackets.service.js';
import { planByes, type ByeMatch } from './byes.js';

/**
 * Builds the same match graph `createMatchGraph` writes, so a draw can be
 * described by who stands in its first round and nothing else.
 */
function draw(size: number, firstRound: (string | null)[]): ByeMatch[] {
  const plan = roundPlan(size);
  const matches: ByeMatch[] = [];
  const byRound = new Map<number, ByeMatch[]>();
  for (let index = plan.length - 1; index >= 0; index -= 1) {
    const current = plan[index]!;
    const next = byRound.get(index + 1) ?? [];
    const created: ByeMatch[] = [];
    for (let position = 1; position <= current.count; position += 1) {
      const target = next[Math.floor((position - 1) / 2)];
      created.push({
        id: `m${current.firstMatchNumber + position - 1}`,
        matchNumber: current.firstMatchNumber + position - 1,
        status: MatchStatus.PENDING,
        participantAEntryId: null,
        participantBEntryId: null,
        nextMatchId: target?.id ?? null,
        nextMatchSlot: target ? (position % 2 === 1 ? MatchSide.A : MatchSide.B) : null,
      });
    }
    byRound.set(index, created);
    matches.unshift(...created);
  }
  const opening = byRound.get(0)!;
  firstRound.forEach((entryId, slot) => {
    const match = opening[Math.floor(slot / 2)]!;
    if (slot % 2 === 0) match.participantAEntryId = entryId;
    else match.participantBEntryId = entryId;
    if (match.participantAEntryId && match.participantBEntryId) match.status = MatchStatus.READY;
  });
  return matches;
}

/** Writes a plan back onto the draw the way `applyByes` writes it to the database. */
function apply(matches: ByeMatch[], plan: ReturnType<typeof planByes>) {
  for (const id of plan.empties) matches.find((match) => match.id === id)!.status = MatchStatus.CANCELLED;
  for (const bye of plan.byes) {
    matches.find((match) => match.id === bye.matchId)!.status = MatchStatus.COMPLETED;
    if (!bye.nextMatchId || !bye.nextMatchSlot) continue;
    const next = matches.find((match) => match.id === bye.nextMatchId)!;
    if (bye.nextMatchSlot === MatchSide.A) next.participantAEntryId = bye.entryId;
    else next.participantBEntryId = bye.entryId;
    if (next.participantAEntryId && next.participantBEntryId) next.status = MatchStatus.READY;
  }
  return matches;
}

describe('reading byes off a draw', () => {
  it('leaves a full draw alone', () => {
    const plan = planByes(draw(8, ['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8']));
    expect(plan).toEqual({ byes: [], empties: [] });
  });

  it('gives every team with no opponent a bye into the next round', () => {
    const matches = draw(8, ['t1', 't2', 't3', null, 't4', null, 't5', null]);
    const plan = planByes(matches);
    expect(plan.empties).toEqual([]);
    expect(plan.byes).toEqual([
      { matchId: 'm2', entryId: 't3', nextMatchId: 'm5', nextMatchSlot: MatchSide.B },
      { matchId: 'm3', entryId: 't4', nextMatchId: 'm6', nextMatchSlot: MatchSide.A },
      { matchId: 'm4', entryId: 't5', nextMatchId: 'm6', nextMatchSlot: MatchSide.B },
    ]);
  });

  it('reads a bye in any round, not only the first', () => {
    // Both semifinalists on one side walked through, so the semifinal is playable;
    // an empty quarter leaves the other semifinal with nobody to play.
    const matches = draw(8, [null, null, 't1', null, 't2', 't3', 't4', null]);
    const plan = planByes(matches);
    expect(plan.empties).toEqual(['m1']);
    expect(plan.byes).toEqual([
      { matchId: 'm2', entryId: 't1', nextMatchId: 'm5', nextMatchSlot: MatchSide.B },
      { matchId: 'm4', entryId: 't4', nextMatchId: 'm6', nextMatchSlot: MatchSide.B },
      { matchId: 'm5', entryId: 't1', nextMatchId: 'm7', nextMatchSlot: MatchSide.A },
    ]);
  });

  it('waits for a match that is still to be played before calling the round above it a bye', () => {
    // m1 is dead and m2 is a real match, so the semifinal it feeds becomes a bye
    // only once m2 has a winner.
    const matches = draw(8, [null, null, 't1', 't2', 't3', 't4', 't5', 't6']);
    const plan = planByes(matches);
    expect(plan.empties).toEqual(['m1']);
    expect(plan.byes).toEqual([]);

    const played = matches.map((match) => (match.id === 'm2' ? { ...match, status: MatchStatus.COMPLETED } : match));
    played.find((match) => match.id === 'm5')!.participantBEntryId = 't1';
    expect(planByes(played).byes).toEqual([
      { matchId: 'm5', entryId: 't1', nextMatchId: 'm7', nextMatchSlot: MatchSide.A },
    ]);
  });

  it('carries a team through a final nobody else can reach', () => {
    const matches = draw(4, ['t1', null, null, null]);
    const plan = planByes(matches);
    expect(plan.empties).toEqual(['m2']);
    expect(plan.byes).toEqual([
      { matchId: 'm1', entryId: 't1', nextMatchId: 'm3', nextMatchSlot: MatchSide.A },
      { matchId: 'm3', entryId: 't1', nextMatchId: null, nextMatchSlot: null },
    ]);
  });

  it('finds nothing left to do once the plan has been applied', () => {
    const matches = draw(16, ['t1', 't2', 't3', null, 't4', null, 't5', null, 't6', null, 't7', null, 't8', null, 't9', null]);
    const applied = apply(matches, planByes(matches));
    expect(planByes(applied)).toEqual({ byes: [], empties: [] });
  });
});
