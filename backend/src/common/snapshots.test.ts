import { describe, expect, it } from 'vitest';
import { MatchSide, type Prisma } from '../generated/prisma/client.js';
import { backfillParticipantSnapshots, carryParticipantSnapshot, writeParticipantSnapshot } from './snapshots.js';

/**
 * The identity frozen onto a draw, tested against a stand-in for the
 * transaction. Every rule here is a decision about which club and which name a
 * match records, which is exactly what these four calls are for — the database
 * only stores what they decide.
 */

type Registration = {
  id: string;
  clubId: string | null;
  club: { id: string; name: string } | null;
  owner: { id: string; name: string | null; surname: string | null; email: string; clubMemberships: { club: { id: string; name: string } }[] };
  teammate: { id: string; name: string | null; surname: string | null; email: string };
};

type SnapshotRow = { matchId: string; side: MatchSide; entryId: string; clubId: string | null; clubName: string | null; ownerName: string; ownerUserId: string; teammateName: string; teammateUserId: string };

type MatchRow = { id: string; bracketId: string; participantAEntryId: string | null; participantBEntryId: string | null };

function registration(id: string, club: { id: string; name: string } | null, owned = club): Registration {
  return {
    id,
    clubId: club?.id ?? null,
    club,
    owner: { id: `${id}-owner`, name: 'Ana', surname: 'B', email: 'ana@example.com', clubMemberships: owned ? [{ club: owned }] : [] },
    teammate: { id: `${id}-mate`, name: null, surname: null, email: 'nino@example.com' },
  };
}

/** Only the four calls snapshots.ts makes; anything else should fail loudly. */
function fakeTx(input: { registrations: Registration[]; matches?: MatchRow[]; snapshots?: SnapshotRow[] }) {
  const snapshots = [...(input.snapshots ?? [])];
  const tx = {
    eventRegistration: {
      findUnique: async ({ where }: { where: { id: string } }) => input.registrations.find((entry) => entry.id === where.id) ?? null,
    },
    matchParticipantSnapshot: {
      findFirst: async ({ where }: { where: { matchId: string; entryId: string } }) =>
        snapshots.find((row) => row.matchId === where.matchId && row.entryId === where.entryId) ?? null,
      upsert: async ({ where, update, create }: { where: { matchId_side: { matchId: string; side: MatchSide } }; update: Partial<SnapshotRow>; create: SnapshotRow }) => {
        const key = where.matchId_side;
        const existing = snapshots.find((row) => row.matchId === key.matchId && row.side === key.side);
        if (existing) Object.assign(existing, update);
        else snapshots.push(create);
      },
    },
    match: {
      findMany: async () => (input.matches ?? []).map((match) => ({
        ...match,
        snapshots: snapshots.filter((row) => row.matchId === match.id).map((row) => ({ side: row.side })),
      })),
    },
  };
  return { tx: tx as unknown as Prisma.TransactionClient, snapshots };
}

describe('freezing who is on court', () => {
  it('records the club the team entered under, not the owner’s current one', async () => {
    const { tx, snapshots } = fakeTx({
      registrations: [registration('e1', { id: 'c1', name: 'Vake Padel' }, { id: 'c2', name: 'Somewhere Else' })],
    });
    await writeParticipantSnapshot(tx, { matchId: 'm1', side: MatchSide.A, entryId: 'e1' });
    expect(snapshots[0]).toMatchObject({ clubId: 'c1', clubName: 'Vake Padel', ownerName: 'Ana B' });
  });

  it('falls back to the owner’s membership when the entry carries no club of its own', async () => {
    const { tx, snapshots } = fakeTx({
      registrations: [registration('e1', null, { id: 'c2', name: 'Vera Padel' })],
    });
    await writeParticipantSnapshot(tx, { matchId: 'm1', side: MatchSide.A, entryId: 'e1' });
    expect(snapshots[0]).toMatchObject({ clubId: 'c2', clubName: 'Vera Padel' });
  });

  it('records a team whose club was deleted rather than refusing to write it', async () => {
    const { tx, snapshots } = fakeTx({ registrations: [registration('e1', null, null)] });
    await writeParticipantSnapshot(tx, { matchId: 'm1', side: MatchSide.A, entryId: 'e1' });
    expect(snapshots[0]).toMatchObject({ clubId: null, clubName: null, entryId: 'e1' });
  });

  it('names a player by their email when they have no name on file', async () => {
    const { tx, snapshots } = fakeTx({ registrations: [registration('e1', { id: 'c1', name: 'Vake Padel' })] });
    await writeParticipantSnapshot(tx, { matchId: 'm1', side: MatchSide.A, entryId: 'e1' });
    expect(snapshots[0]).toMatchObject({ teammateName: 'nino@example.com' });
  });

  it('refuses an entry that no longer exists', async () => {
    const { tx } = fakeTx({ registrations: [] });
    await expect(writeParticipantSnapshot(tx, { matchId: 'm1', side: MatchSide.A, entryId: 'gone' })).rejects.toThrow(/Bracket entry not found/);
  });
});

describe('carrying identity into the next round', () => {
  it('takes the frozen identity from the match won, not from the registration', async () => {
    const { tx, snapshots } = fakeTx({
      // The club was renamed after the draw locked; the draw keeps the old name.
      registrations: [registration('e1', { id: 'c1', name: 'Renamed Padel' })],
      snapshots: [{ matchId: 'm1', side: MatchSide.A, entryId: 'e1', clubId: 'c1', clubName: 'Vake Padel', ownerName: 'Ana B', ownerUserId: 'u1', teammateName: 'Nino C', teammateUserId: 'u2' }],
    });
    await carryParticipantSnapshot(tx, { sourceMatchId: 'm1', entryId: 'e1', targetMatchId: 'm9', targetSide: MatchSide.B });
    expect(snapshots.find((row) => row.matchId === 'm9')).toMatchObject({ clubName: 'Vake Padel', ownerName: 'Ana B' });
  });

  it('advances a winner whose match was never given a snapshot', async () => {
    // The state that stopped a live event: a draw locked before byes carried
    // identity forward leaves real teams standing with nothing frozen beside
    // them, and the advancement used to fail outright.
    const { tx, snapshots } = fakeTx({ registrations: [registration('e1', { id: 'c1', name: 'Vake Padel' })] });
    await carryParticipantSnapshot(tx, { sourceMatchId: 'm1', entryId: 'e1', targetMatchId: 'm9', targetSide: MatchSide.A });
    expect(snapshots.find((row) => row.matchId === 'm9')).toMatchObject({ entryId: 'e1', clubName: 'Vake Padel' });
  });
});

describe('closing the gaps an older draw left', () => {
  it('writes identity for every occupied side that has none, and leaves the rest alone', async () => {
    const { tx, snapshots } = fakeTx({
      registrations: [registration('e1', { id: 'c1', name: 'Vake Padel' }), registration('e2', { id: 'c2', name: 'Vera Padel' })],
      matches: [{ id: 'm1', bracketId: 'b1', participantAEntryId: 'e1', participantBEntryId: 'e2' }],
      snapshots: [{ matchId: 'm1', side: MatchSide.A, entryId: 'e1', clubId: 'c1', clubName: 'Old Name', ownerName: 'Ana B', ownerUserId: 'u1', teammateName: 'Nino C', teammateUserId: 'u2' }],
    });
    await backfillParticipantSnapshots(tx, 'b1');
    expect(snapshots).toHaveLength(2);
    // The side that already had one keeps exactly what it had frozen.
    expect(snapshots.find((row) => row.side === MatchSide.A)).toMatchObject({ clubName: 'Old Name' });
    expect(snapshots.find((row) => row.side === MatchSide.B)).toMatchObject({ entryId: 'e2', clubName: 'Vera Padel' });
  });

  it('leaves an empty side empty', async () => {
    const { tx, snapshots } = fakeTx({
      registrations: [registration('e1', { id: 'c1', name: 'Vake Padel' })],
      matches: [{ id: 'm1', bracketId: 'b1', participantAEntryId: 'e1', participantBEntryId: null }],
    });
    await backfillParticipantSnapshots(tx, 'b1');
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]).toMatchObject({ side: MatchSide.A });
  });
});
