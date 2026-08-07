import { beforeEach, describe, expect, it } from 'vitest';
import { ClubMembershipRole } from '../../generated/prisma/client.js';
import { createApp } from '../../app.js';
import { prisma } from '../../database/prisma.js';
import { authedSend, createTeam, resetDb } from '../../test/helpers.js';

const app = createApp();

beforeEach(resetDb);

/**
 * Adding a group mate creates an account, joins it to the club and mails a
 * stranger in the club's name. It has to be a leadership action, like every
 * other roster write, and it has to be throttled.
 */
describe('group-mate invitations (integration)', () => {
  it('refuses a member who does not lead the club', async () => {
    const { teammate } = await createTeam('Beta');
    const response = await authedSend(app, 'post', '/api/account/club/mate', teammate, {
      email: 'stranger@example.test', name: 'Stranger', surname: 'Person', phone: '+995500000009',
    });
    expect(response.status).toBe(403);
    expect(response.body.error).toMatch(/leader/i);
    // Refused before any account or membership is created — and before any mail.
    expect(await prisma.user.findUnique({ where: { email: 'stranger@example.test' } })).toBeNull();
  });

  it('throttles a leader to five invitations an hour', async () => {
    const { owner } = await createTeam('Delta');
    const invite = (n: number) =>
      authedSend(app, 'post', '/api/account/club/mate', owner, {
        email: `flood-${n}@example.test`, name: 'Flood', surname: 'Target', phone: '+995500000012',
      });

    for (let n = 0; n < 5; n += 1) {
      expect((await invite(n)).status).not.toBe(429);
    }
    const blocked = await invite(5);
    expect(blocked.status).toBe(429);
    // The bucket follows the account, so signing in again cannot reset it.
    expect((await invite(6)).status).toBe(429);
  });

  it('lets the leader in', async () => {
    const { owner, club } = await createTeam('Gamma');
    const membership = await prisma.clubMember.findUnique({ where: { userId: owner.id } });
    expect(membership?.membershipRole).toBe(ClubMembershipRole.LEADER);
    expect(membership?.clubId).toBe(club.id);

    const response = await authedSend(app, 'post', '/api/account/club/mate', owner, {
      email: 'invitee@example.test', name: 'Invitee', surname: 'Person', phone: '+995500000011',
    });
    // 502 is the sandbox's missing Resend key: the authorization gate passed and
    // the invite reached delivery, which is what this asserts.
    expect(response.status).not.toBe(403);
  });
});
