import { describe, expect, it } from 'vitest';
import type { MatchDto } from '@/types/tournament';
import { finishedTallyExample, isFinishedTally, maxSetsFor, setsToWin } from './setEngine';

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

describe('a result entered as two numbers', () => {
  it('accepts a tally the winner has reached and the loser has not', () => {
    expect(isFinishedTally(2, 1, 2)).toBe(true);
    expect(isFinishedTally(1, 2, 2)).toBe(true);
    expect(isFinishedTally(1, 0, 1)).toBe(true);
  });

  it('rejects a tally that is unfinished, overrun, or not two whole numbers', () => {
    expect(isFinishedTally(1, 1, 2)).toBe(false);
    expect(isFinishedTally(3, 1, 2)).toBe(false);
    expect(isFinishedTally(2, 2, 2)).toBe(false);
    expect(isFinishedTally(-1, 2, 2)).toBe(false);
    expect(isFinishedTally(Number.NaN, 2, 2)).toBe(false);
  });

  it('shows the shortest valid result as the example', () => {
    expect(finishedTallyExample(1)).toBe('1–0');
    expect(finishedTallyExample(2)).toBe('2–1');
  });
});
