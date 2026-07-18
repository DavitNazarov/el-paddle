import { describe, expect, it } from 'vitest';
import type { RegistrationFull } from './serializers.js';
import { serializePublicRegistrationTeam } from './serializers.js';

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
