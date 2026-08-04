import { describe, expect, it } from 'vitest';
import type { BracketDto, CourtDto, MatchDto, OpponentRequestDto } from '@/types/tournament';
import {
  canRespond,
  canWithdraw,
  didWin,
  hasScore,
  opponentOf,
  ownEntryIds,
  playerMatches,
  receivedRequests,
  requestReason,
  sentRequests,
} from './playerEventModel';

const pair = (name: string) => ({ owner: { fullName: name }, teammate: { fullName: `${name} mate` } });

const request = (overrides: Partial<OpponentRequestDto> = {}): OpponentRequestDto => ({
  id: 'r1',
  requestingEntryId: 'mine',
  targetEntryId: 'theirs',
  requestingEntry: pair('Ana'),
  targetEntry: pair('Beka'),
  status: 'PENDING_RESPONSE',
  responseReason: '',
  adminPublicReason: '',
  version: 1,
  ...overrides,
}) as OpponentRequestDto;

const match = (overrides: Partial<MatchDto> = {}): MatchDto => ({
  id: 'm1',
  matchNumber: 1,
  participantAEntryId: null,
  participantBEntryId: null,
  scoreA: 0,
  scoreB: 0,
  status: 'READY',
  round: 'FINAL',
  ...overrides,
}) as MatchDto;

const bracketOf = (matches: MatchDto[]) => [{ matches } as BracketDto];

const courtWith = (name: string, items: Array<{ matchId: string; plannedStartAt: string | null; status?: string }>) =>
  [{
    name,
    scheduleItems: items.map((item, index) => ({
      id: `s${index}`,
      matchId: item.matchId,
      plannedStartAt: item.plannedStartAt,
      status: item.status ?? 'PENDING',
    })),
  }] as unknown as CourtDto[];

describe('own entries', () => {
  it('collects the reader’s entry ids', () => {
    const mine = ownEntryIds([{ id: 'a' }, { id: 'b' }] as never);
    expect([...mine]).toEqual(['a', 'b']);
  });
});

describe('opponent requests', () => {
  const mine = new Set(['mine']);

  it('splits requests by which side the reader is on', () => {
    const rows = [
      request({ id: 'out', requestingEntryId: 'mine', targetEntryId: 'other' }),
      request({ id: 'in', requestingEntryId: 'other', targetEntryId: 'mine' }),
    ];
    expect(sentRequests(rows, mine).map((row) => row.id)).toEqual(['out']);
    expect(receivedRequests(rows, mine).map((row) => row.id)).toEqual(['in']);
  });

  it('offers a response only while the request is unanswered', () => {
    expect(canRespond(request({ status: 'PENDING_RESPONSE' }))).toBe(true);
    expect(canRespond(request({ status: 'ACCEPTED_BY_OPPONENT' }))).toBe(false);
    expect(canRespond(request({ status: 'APPROVED_BY_ADMIN' }))).toBe(false);
  });

  it('allows withdrawal until an admin has acted on it', () => {
    expect(canWithdraw(request({ status: 'PENDING_RESPONSE' }))).toBe(true);
    expect(canWithdraw(request({ status: 'ACCEPTED_BY_OPPONENT' }))).toBe(true);
    expect(canWithdraw(request({ status: 'APPROVED_BY_ADMIN' }))).toBe(false);
    expect(canWithdraw(request({ status: 'APPLIED_TO_BRACKET' }))).toBe(false);
  });

  it('names the other pair from the reader’s side', () => {
    expect(opponentOf(request(), 'sent').owner.fullName).toBe('Beka');
    expect(opponentOf(request(), 'received').owner.fullName).toBe('Ana');
  });

  it('prefers the responder’s reason over the admin’s, and copes with neither', () => {
    expect(requestReason(request({ responseReason: 'Busy' , adminPublicReason: 'Conflict' }))).toBe('Busy');
    expect(requestReason(request({ responseReason: '', adminPublicReason: 'Conflict' }))).toBe('Conflict');
    expect(requestReason(request())).toBe('');
  });
});

describe('the reader’s own matches', () => {
  const mine = new Set(['mine']);

  it('keeps only matches the reader is in, and records which side', () => {
    const brackets = bracketOf([
      match({ id: 'theirs', participantAEntryId: 'x', participantBEntryId: 'y' }),
      match({ id: 'ours', participantBEntryId: 'mine' }),
    ]);
    const found = playerMatches(brackets, [], mine);
    expect(found).toHaveLength(1);
    expect(found[0]!.match.id).toBe('ours');
    expect(found[0]!.side).toBe('B');
  });

  it('attaches the court and time from the schedule', () => {
    const brackets = bracketOf([match({ id: 'ours', participantAEntryId: 'mine' })]);
    const courts = courtWith('Centre court', [{ matchId: 'ours', plannedStartAt: '2026-09-01T10:00:00.000Z' }]);
    const [found] = playerMatches(brackets, courts, mine);
    expect(found).toMatchObject({ courtName: 'Centre court', plannedStartAt: '2026-09-01T10:00:00.000Z' });
  });

  it('leaves court and time unknown rather than inventing them', () => {
    const brackets = bracketOf([match({ id: 'ours', participantAEntryId: 'mine' })]);
    const [found] = playerMatches(brackets, [], mine);
    expect(found).toMatchObject({ courtName: null, plannedStartAt: null, scheduleStatus: null });
  });

  it('puts a running match first, then upcoming, then finished', () => {
    const brackets = bracketOf([
      match({ id: 'done', participantAEntryId: 'mine', status: 'COMPLETED', matchNumber: 1 }),
      match({ id: 'live', participantAEntryId: 'mine', status: 'IN_PROGRESS', matchNumber: 2 }),
      match({ id: 'next', participantAEntryId: 'mine', status: 'READY', matchNumber: 3 }),
    ]);
    expect(playerMatches(brackets, [], mine).map((row) => row.match.id)).toEqual(['live', 'next', 'done']);
  });

  it('orders same-status matches by their planned time, timed ones first', () => {
    const brackets = bracketOf([
      match({ id: 'late', participantAEntryId: 'mine', matchNumber: 1 }),
      match({ id: 'early', participantAEntryId: 'mine', matchNumber: 2 }),
      match({ id: 'untimed', participantAEntryId: 'mine', matchNumber: 3 }),
    ]);
    const courts = courtWith('C1', [
      { matchId: 'late', plannedStartAt: '2026-09-01T14:00:00.000Z' },
      { matchId: 'early', plannedStartAt: '2026-09-01T09:00:00.000Z' },
    ]);
    expect(playerMatches(brackets, courts, mine).map((row) => row.match.id)).toEqual(['early', 'late', 'untimed']);
  });
});

describe('score reading', () => {
  it('shows a score only once the match has started', () => {
    expect(hasScore(match({ status: 'READY' }))).toBe(false);
    expect(hasScore(match({ status: 'IN_PROGRESS' }))).toBe(true);
    expect(hasScore(match({ status: 'COMPLETED' }))).toBe(true);
  });

  it('reports the outcome from the reader’s own side', () => {
    const won = { match: match({ status: 'COMPLETED', scoreA: 2, scoreB: 1 }), side: 'A' } as never;
    const lost = { match: match({ status: 'COMPLETED', scoreA: 2, scoreB: 1 }), side: 'B' } as never;
    expect(didWin(won)).toBe(true);
    expect(didWin(lost)).toBe(false);
  });

  it('withholds an outcome while the match is unfinished', () => {
    expect(didWin({ match: match({ status: 'IN_PROGRESS', scoreA: 1 }), side: 'A' } as never)).toBeNull();
  });
});
