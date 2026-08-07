import { describe, expect, it } from 'vitest';
import type { RegistrationDto } from '@/types/dashboard';
import { pairingNoteKey, pairingState, type PairingInput } from './pairingModel';

const EVENT = 'event-1';

function entry(overrides: Partial<RegistrationDto> = {}): RegistrationDto {
  return {
    id: 'entry-1',
    clubId: 'club-1',
    event: { id: EVENT, title: 'Preseason Trials', date: '2026-09-27T18:00:00.000Z', location: 'Digomi' },
    category: { id: 'category-1', name: 'C', description: '' },
    owner: { id: 'user-1' } as RegistrationDto['owner'],
    teammate: { id: 'user-2' } as RegistrationDto['teammate'],
    ownerPhone: '',
    teammatePhone: '',
    status: 'APPROVED',
    version: 0,
    publicStatusReason: '',
    declineReason: '',
    ...overrides,
  };
}

function input(overrides: Partial<PairingInput> = {}): PairingInput {
  return {
    eventId: EVENT,
    entries: [entry()],
    received: [],
    sent: [],
    windows: [{ eventId: EVENT, categoryId: 'category-1', open: true }],
    ...overrides,
  };
}

describe('pairingState', () => {
  it('offers the request action only to an approved entry with an open window', () => {
    expect(pairingState(input())).toEqual({ kind: 'ask' });
    expect(pairingState(input({ entries: [entry({ status: 'PENDING' })] }))).toEqual({ kind: 'none' });
  });

  it('refuses to offer a request the server would answer with a 409', () => {
    expect(pairingState(input({ windows: [] }))).toEqual({ kind: 'closed' });
    expect(
      pairingState(input({ windows: [{ eventId: EVENT, categoryId: 'category-1', open: false }] })),
    ).toEqual({ kind: 'closed' });
    // A window belonging to another category of the same event is not this
    // entry's window.
    expect(
      pairingState(input({ windows: [{ eventId: EVENT, categoryId: 'category-2', open: true }] })),
    ).toEqual({ kind: 'closed' });
  });

  it('reports a sent request instead of offering to send another', () => {
    const sent = [{
      id: 'request-1',
      eventId: EVENT,
      categoryId: 'category-1',
      status: 'PENDING_RESPONSE' as const,
      to: { ownerName: 'Luka', teammateName: 'Saba' },
    }];
    expect(pairingState(input({ sent }))).toEqual({
      kind: 'sent',
      status: 'PENDING_RESPONSE',
      opponent: 'Luka / Saba',
    });
  });

  it('puts answering ahead of asking when both are possible', () => {
    const received = [{ id: 'request-2', eventId: EVENT, eventTitle: 'Preseason Trials', from: null }];
    const sent = [{
      id: 'request-1',
      eventId: EVENT,
      categoryId: 'category-1',
      status: 'PENDING_RESPONSE' as const,
      to: { ownerName: 'Luka', teammateName: 'Saba' },
    }];
    expect(pairingState(input({ received, sent }))).toEqual({ kind: 'respond', count: 1 });
  });

  it('ignores requests belonging to another event', () => {
    const received = [{ id: 'request-2', eventId: 'event-2', eventTitle: 'Other', from: null }];
    const sent = [{
      id: 'request-1',
      eventId: 'event-2',
      categoryId: 'category-1',
      status: 'PENDING_RESPONSE' as const,
      to: { ownerName: 'Luka', teammateName: 'Saba' },
    }];
    expect(pairingState(input({ received, sent }))).toEqual({ kind: 'ask' });
  });

  it('says nothing once the draw is published', () => {
    const received = [{ id: 'request-2', eventId: EVENT, eventTitle: 'Preseason Trials', from: null }];
    expect(pairingState(input({ entries: [entry({ inDraw: true })], received }))).toEqual({ kind: 'none' });
  });
});

describe('pairingNoteKey', () => {
  it('explains only the states the player cannot act on', () => {
    expect(pairingNoteKey({ kind: 'ask' })).toBeNull();
    expect(pairingNoteKey({ kind: 'respond', count: 1 })).toBeNull();
    expect(pairingNoteKey({ kind: 'none' })).toBeNull();
    expect(pairingNoteKey({ kind: 'closed' })).toBe('pairingClosed');
  });

  it('gives every live sent state its own sentence', () => {
    const sent = (status: 'PENDING_RESPONSE' | 'ACCEPTED_BY_OPPONENT' | 'CONFLICTED' | 'APPROVED_BY_ADMIN' | 'OVERRIDDEN_BY_ADMIN' | 'APPLIED_TO_BRACKET') =>
      pairingNoteKey({ kind: 'sent', status, opponent: 'Luka / Saba' });
    expect(sent('PENDING_RESPONSE')).toBe('pairingWaiting');
    expect(sent('ACCEPTED_BY_OPPONENT')).toBe('pairingAccepted');
    expect(sent('CONFLICTED')).toBe('pairingConflicted');
    expect(sent('APPROVED_BY_ADMIN')).toBe('pairingConfirmed');
    expect(sent('OVERRIDDEN_BY_ADMIN')).toBe('pairingConfirmed');
    expect(sent('APPLIED_TO_BRACKET')).toBe('pairingConfirmed');
  });
});
