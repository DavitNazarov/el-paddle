import { describe, expect, it } from 'vitest';
import type { Prisma } from '../generated/prisma/client.js';
import { outboxEmissions } from './outbox.worker.js';

// `event:<id>` is joinable by an anonymous socket on any published event, so
// the fan-out must not put anything there that the REST reads would withhold.
// These are pure payload assertions: no database, no socket server.
const roomsOf = (topic: string, payload: Prisma.JsonObject) =>
  Object.fromEntries(outboxEmissions(topic, payload).map((e) => [e.room, e.payload]));

describe('outboxEmissions', () => {
  it('keeps a live score out of the public event room', () => {
    const rooms = roomsOf('match.score.updated', {
      eventId: 'evt1', matchId: 'mat1', scoreA: 2, scoreB: 1, version: 7,
    });
    expect(rooms['event:evt1']).toEqual({ eventId: 'evt1' });
    expect(rooms['event-staff:evt1']).toMatchObject({ scoreA: 2, scoreB: 1 });
    // The per-match room has its own publication gate, so it keeps the detail.
    expect(rooms['match:mat1']).toMatchObject({ scoreA: 2, scoreB: 1 });
  });

  it('keeps a winner out of the public event room before results publish', () => {
    const rooms = roomsOf('match.completed', {
      eventId: 'evt1', bracketId: 'brk1', matchId: 'mat1', winnerEntryId: 'ent9',
    });
    expect(rooms['event:evt1']).toEqual({ eventId: 'evt1' });
    expect(JSON.stringify(rooms['event:evt1'])).not.toContain('ent9');
    expect(rooms['event-staff:evt1']).toMatchObject({ winnerEntryId: 'ent9' });
  });

  it('keeps a registration decision out of the public event room', () => {
    const rooms = roomsOf('registration.status.updated', {
      eventId: 'evt1', registrationId: 'reg1', status: 'DECLINED',
    });
    expect(rooms['event:evt1']).toEqual({ eventId: 'evt1' });
    expect(rooms['event-staff:evt1']).toMatchObject({ status: 'DECLINED' });
  });

  it('never lets a payload field other than eventId reach the public room', () => {
    for (const topic of ['match.set.decided', 'bracket.generated', 'notification.created']) {
      const emission = outboxEmissions(topic, {
        eventId: 'evt1', secret: 'leak', recipientUserId: 'usr1', scoreA: 3,
      }).find((e) => e.room === 'event:evt1');
      expect(Object.keys(emission?.payload ?? {})).toEqual(['eventId']);
    }
  });

  it('delivers a personal topic to its owner but not to the admin room', () => {
    const rooms = roomsOf('notification.created', { recipientUserId: 'usr1', eventId: 'evt1', title: 'Entry declined' });
    expect(rooms['user:usr1']).toMatchObject({ title: 'Entry declined' });
    // An admin can read anyone's notifications through the API; broadcasting a
    // copy of someone else's inbox to every admin socket is a different thing.
    expect(rooms.admins).toBeUndefined();
  });

  it('delivers an operational topic to the admin room in full', () => {
    const rooms = roomsOf('match.completed', { eventId: 'evt1', matchId: 'mat1', winnerEntryId: 'ent9' });
    expect(rooms.admins).toMatchObject({ winnerEntryId: 'ent9' });
  });

  it('addresses no event room when the payload carries no event', () => {
    const rooms = roomsOf('user.deleted', { recipientUserId: 'usr1' });
    expect(Object.keys(rooms)).toEqual(['user:usr1']);
  });
});
