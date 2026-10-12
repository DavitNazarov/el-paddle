import { describe, expect, it } from 'vitest';
import type { MatchDto } from '@/types/tournament';
import {
  canFinishEarly,
  canRecordResult,
  canStart,
  clubNameOf,
  pairName,
  resultOptions,
  setProgress,
} from './matchModel';

const base = {
  id: 'm1',
  status: 'IN_PROGRESS',
  scoringMode: 'SETS',
  scoreA: 0,
  scoreB: 0,
  setCount: 2,
  setsToWin: 2,
  maxSets: 3,
  sets: [],
  participantAEntryId: 'a',
  participantBEntryId: 'b',
  scheduleItem: { id: 's1', status: 'READY', version: 1 },
  snapshots: [],
} as unknown as MatchDto;

const match = (fields: Partial<MatchDto>) => ({ ...base, ...fields }) as MatchDto;

describe('what the console may offer', () => {
  it('starts only a ready match that already has a court', () => {
    expect(canStart(match({ status: 'READY' }))).toBe(true);
    expect(canStart(match({ status: 'READY', scheduleItem: null }))).toBe(false);
    expect(canStart(match({ status: 'IN_PROGRESS' }))).toBe(false);
  });

  it('records a result only on a running set-scored match', () => {
    expect(canRecordResult(match({}))).toBe(true);
    expect(canRecordResult(match({ status: 'READY' }))).toBe(false);
    expect(canRecordResult(match({ scoringMode: 'POINTS' }))).toBe(false);
  });

  it('offers an early finish while both sides are known and the match is open', () => {
    expect(canFinishEarly(match({ status: 'READY' }))).toBe(true);
    expect(canFinishEarly(match({}))).toBe(true);
    expect(canFinishEarly(match({ status: 'COMPLETED' }))).toBe(false);
    expect(canFinishEarly(match({ participantBEntryId: null }))).toBe(false);
  });
});

describe('reading a match', () => {
  it('reports progress against the race the match is running', () => {
    expect(setProgress(match({ sets: [{ setNumber: 1 }] as MatchDto['sets'] }))).toEqual({ played: 1, max: 3, winsNeeded: 2 });
  });

  it('names both players, and says so when a side is not settled', () => {
    const entry = { owner: { fullName: 'Ana B' }, teammate: { fullName: 'Nino C' } } as MatchDto['participantA'];
    expect(pairName(entry, 'TBD')).toBe('Ana B / Nino C');
    expect(pairName(null, 'TBD')).toBe('TBD');
  });

  it('reads a club from the locked snapshot, and empty before the bracket locks', () => {
    const withClub = match({ snapshots: [{ side: 'A', clubId: 'c1', clubName: 'Padel Tbilisi', ownerName: 'x', teammateName: 'y' }] });
    expect(clubNameOf(withClub, 'A')).toBe('Padel Tbilisi');
    expect(clubNameOf(withClub, 'B')).toBe('');
    expect(clubNameOf(match({}), 'A')).toBe('');
  });
});

describe('the results a match can end on', () => {
  it('offers every finish of the race, and only finishes', () => {
    expect(resultOptions(match({})).map(({ a, b }) => `${a}-${b}`)).toEqual(['2-0', '2-1', '1-2', '0-2']);
  });

  it('follows the set format rather than a fixed list', () => {
    const raceToOne = match({ setCount: 1, setsToWin: 1, maxSets: 1 });
    expect(resultOptions(raceToOne).map(({ a, b }) => `${a}-${b}`)).toEqual(['1-0', '0-1']);
  });

  it('names the side each result gives the match to', () => {
    expect(resultOptions(match({})).map((option) => option.winner)).toEqual(['A', 'A', 'B', 'B']);
  });

  it('bars only the results that would take back a set already recorded', () => {
    // B took the first set, so nothing that leaves B on zero is a result.
    const played = match({ scoreA: 0, scoreB: 1, sets: [{ setNumber: 1 }] as MatchDto['sets'] });
    const reading = resultOptions(played).map((option) => `${option.a}-${option.b}:${option.regresses}`);
    expect(reading).toEqual(['2-0:true', '2-1:false', '1-2:false', '0-2:false']);
    expect(resultOptions(match({})).some((option) => option.regresses)).toBe(false);
  });
});
