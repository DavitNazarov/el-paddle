import { describe, expect, it } from 'vitest';
import type { MatchDto } from '@/types/tournament';
import {
  canFinishEarly,
  canRecordResult,
  canStart,
  clubNameOf,
  pairName,
  readResult,
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

describe('reading the two numbers an operator types', () => {
  it('names the winner of a finished tally', () => {
    expect(readResult(match({}), { A: '1', B: '2' })).toMatchObject({ a: 1, b: 2, winner: 'B', finished: true });
    expect(readResult(match({}), { A: '2', B: '0' })).toMatchObject({ winner: 'A', finished: true });
  });

  it('withholds a winner until both numbers form a result', () => {
    expect(readResult(match({}), { A: '1', B: '' })).toMatchObject({ winner: null, finished: false });
    expect(readResult(match({}), { A: '1', B: '1' })).toMatchObject({ winner: null, finished: false });
    expect(readResult(match({}), { A: '3', B: '1' })).toMatchObject({ winner: null, finished: false });
    expect(readResult(match({}), { A: 'x', B: '1' })).toMatchObject({ winner: null, finished: false });
  });

  it('flags a tally that would take back a set already recorded', () => {
    const played = match({ scoreA: 0, scoreB: 2, sets: [{ setNumber: 1 }, { setNumber: 2 }] as MatchDto['sets'] });
    expect(readResult(played, { A: '2', B: '1' }).regresses).toBe(true);
    expect(readResult(match({}), { A: '2', B: '1' }).regresses).toBe(false);
  });
});
