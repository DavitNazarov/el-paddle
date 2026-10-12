import { describe, expect, it } from 'vitest';
import type { MatchDto } from '@/types/tournament';
import { finishedTallies, maxSetsFor, setsToWin } from './setEngine';

const match = (fields: Partial<MatchDto>) => fields as MatchDto;

describe('set race, as the console reads it', () => {
  it('prefers the snapshotted race a running match was started with', () => {
    expect(setsToWin(match({ setCount: 1, setsToWin: 3 }))).toBe(3);
  });

  it('falls back to the configured count, then to a single set', () => {
    expect(setsToWin(match({ setCount: 2, setsToWin: null }))).toBe(2);
    expect(setsToWin(match({ setCount: null, setsToWin: null }))).toBe(1);
  });

  it('derives the ceiling when the server has not sent one', () => {
    expect(maxSetsFor(match({ setCount: 2, setsToWin: null, maxSets: null }))).toBe(3);
    expect(maxSetsFor(match({ setCount: 3, setsToWin: null, maxSets: null }))).toBe(5);
    expect(maxSetsFor(match({ setCount: 1, setsToWin: null, maxSets: 9 }))).toBe(9);
  });

});

describe('the results a race can end on', () => {
  const read = (winsNeeded: number) => finishedTallies(winsNeeded).map(({ a, b }) => `${a}-${b}`);

  it('lists every finish of the race, in scoreboard order', () => {
    expect(read(1)).toEqual(['1-0', '0-1']);
    expect(read(2)).toEqual(['2-0', '2-1', '1-2', '0-2']);
    expect(read(3)).toEqual(['3-0', '3-1', '3-2', '2-3', '1-3', '0-3']);
  });

  it('offers nothing that leaves the match undecided or overruns the race', () => {
    // A draw and an overrun are the two shapes a typed tally used to take.
    expect(read(2)).not.toContain('1-1');
    expect(read(2)).not.toContain('2-2');
    expect(read(2)).not.toContain('3-1');
  });

  it('has nothing to offer for a race that is not a whole number of sets', () => {
    expect(finishedTallies(0)).toEqual([]);
    expect(finishedTallies(-1)).toEqual([]);
    expect(finishedTallies(1.5)).toEqual([]);
  });
});
