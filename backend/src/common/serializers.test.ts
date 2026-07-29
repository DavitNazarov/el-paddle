import { describe, expect, it } from 'vitest';
import type { RegistrationFull } from './serializers.js';
import {
  serializeEvent,
  serializeMatchList,
  serializePublicRegistrationTeam,
  serializeTeammateOption,
} from './serializers.js';

type EventArg = Parameters<typeof serializeEvent>[0];
type MatchArg = Parameters<typeof serializeMatchList>[0][number];

function fakeEvent(): EventArg {
  return {
    id: 'event-1',
    title: 'Spring Open',
    date: new Date('2026-05-01T09:00:00.000Z'),
    location: 'Tbilisi',
    description: '',
    arrivalTime: null,
    participationFee: 50,
    bankAccountIban: 'GE29NB0000000101904917',
    bankAccountReceiver: 'El Padel Georgia',
    isPublished: true,
    status: 'REGISTRATION_OPEN',
    version: 1,
    timeZone: 'Asia/Tbilisi',
    registrationRosterPublishedAt: null,
    schedulePublishedAt: null,
    publicLiveScoringEnabled: false,
    resultsPublishedAt: null,
    categories: [],
  } as unknown as EventArg;
}

function fakeMatch(id: string, eventId: string, eventTitle: string): MatchArg {
  return {
    id,
    bracketId: 'bracket-1',
    round: 'FINAL',
    roundPosition: 1,
    matchNumber: 1,
    participantAEntryId: null,
    participantBEntryId: null,
    nextMatchId: null,
    nextMatchSlot: null,
    scoreA: 6,
    scoreB: 3,
    status: 'COMPLETED',
    resultType: 'NORMAL',
    resultReason: null,
    winnerEntryId: null,
    loserEntryId: null,
    version: 1,
    startedAt: null,
    completedAt: null,
    participantA: null,
    participantB: null,
    winner: null,
    loser: null,
    snapshots: [],
    scheduleItem: null,
    bracket: {
      eventId,
      categoryId: 'category-1',
      status: 'COMPLETED',
      generation: 1,
      version: 1,
      publishedAt: null,
      event: {
        id: eventId,
        title: eventTitle,
        date: new Date('2026-05-01T09:00:00.000Z'),
        location: 'Tbilisi',
        description: '',
        status: 'COMPLETED',
        timeZone: 'Asia/Tbilisi',
        publicLiveScoringEnabled: false,
        resultsPublishedAt: null,
        categories: [],
      },
      eventCategory: undefined,
    },
  } as unknown as MatchArg;
}

describe('public registration team serializer', () => {
  it('returns roster identity without contact or review details', () => {
    const registration = {
      id: 'registration-1',
      ownerPhone: '+995500000001',
      teammatePhone: '+995500000002',
      teammateEmail: 'private-teammate@example.com',
      internalReviewNote: 'private review note',
      category: { id: 'category-1', name: 'Open', description: null },
      owner: {
        id: 'player-1',
        name: 'Nino',
        surname: 'Beridze',
        email: 'private-owner@example.com',
        clubMemberships: [{ club: { id: 'club-1', name: 'Tbilisi Padel', slug: 'tbilisi-padel' } }],
      },
      teammate: {
        id: 'player-2',
        name: 'Ana',
        surname: 'Gelashvili',
        email: 'private-teammate@example.com',
        clubMemberships: [{ club: { id: 'club-1', name: 'Tbilisi Padel', slug: 'tbilisi-padel' } }],
      },
    } as unknown as RegistrationFull;

    const serialized = serializePublicRegistrationTeam(registration);

    expect(serialized).toEqual({
      id: 'registration-1',
      category: { id: 'category-1', name: 'Open', description: '', eventCount: 0 },
      owner: { id: 'player-1', fullName: 'Nino Beridze' },
      teammate: { id: 'player-2', fullName: 'Ana Gelashvili' },
      club: { id: 'club-1', name: 'Tbilisi Padel', slug: 'tbilisi-padel' },
    });
    expect(JSON.stringify(serialized)).not.toContain('private-owner@example.com');
    expect(JSON.stringify(serialized)).not.toContain('+995500000001');
    expect(JSON.stringify(serialized)).not.toContain('private review note');
  });
});

describe('serializeEvent bank details (F3)', () => {
  it('omits bank details by default so list payloads never fan them out', () => {
    const serialized = serializeEvent(fakeEvent());
    expect('bankAccountIban' in serialized).toBe(false);
    expect('bankAccountReceiver' in serialized).toBe(false);
    expect(JSON.stringify(serialized)).not.toContain('GE29NB0000000101904917');
  });

  it('includes bank details only when explicitly opted in', () => {
    const serialized = serializeEvent(fakeEvent(), { includeBankDetails: true });
    expect(serialized).toMatchObject({
      bankAccountIban: 'GE29NB0000000101904917',
      bankAccountReceiver: 'El Padel Georgia',
    });
  });
});

describe('serializeMatchList (F4)', () => {
  it('hoists a de-duplicated events array and drops the per-match event embed', () => {
    const { matches, events } = serializeMatchList([
      fakeMatch('match-1', 'event-1', 'Spring Open'),
      fakeMatch('match-2', 'event-1', 'Spring Open'),
    ]);

    // The shared event appears once, not once per match.
    expect(events).toEqual([{ id: 'event-1', title: 'Spring Open' }]);
    expect(matches).toHaveLength(2);
    // Each match references the event by id but no longer embeds a full copy.
    expect(matches[0].bracket?.eventId).toBe('event-1');
    expect('event' in (matches[0].bracket ?? {})).toBe(false);
  });
});

describe('serializeTeammateOption (F7)', () => {
  it('emits only the four dropdown fields, not a full profile', () => {
    const option = serializeTeammateOption({
      id: 'user-1',
      email: 'teammate@example.com',
      name: 'Nino',
      surname: 'Beridze',
      phone: '+995500000003',
    });
    expect(option).toEqual({
      id: 'user-1',
      email: 'teammate@example.com',
      fullName: 'Nino Beridze',
      phone: '+995500000003',
    });
  });
});
