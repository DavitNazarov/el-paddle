import { beforeEach, describe, expect, it } from 'vitest';
import { ClubMembershipRole, UserStatus } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';
import {
  appointClubLeader,
  listLeaderlessClubs,
  transferClubLeadership,
} from './clubs.service.js';
import { createTeam, createUser, resetDb } from '../../test/helpers.js';

beforeEach(resetDb);

/** Strip the club of its leader — the state a membership row written without a role produces. */
async function makeLeaderless(clubId: string) {
  await prisma.clubMember.updateMany({
    where: { clubId },
    data: { membershipRole: ClubMembershipRole.MEMBER },
  });
}

describe('a club with no leader', () => {
  it('is listed for an administrator to fix', async () => {
    const team = await createTeam('Alpha');
    expect(await listLeaderlessClubs()).toEqual([]);

    await makeLeaderless(team.club.id);

    const leaderless = await listLeaderlessClubs();
    expect(leaderless).toHaveLength(1);
    expect(leaderless[0]).toMatchObject({ id: team.club.id, members: 2 });
  });

  /**
   * The member-facing transfer is a leader handing over, so it cannot rescue a
   * club that has nobody to hand anything over. That is the whole reason the
   * administrator path exists.
   */
  it('cannot be rescued by a member transferring leadership', async () => {
    const team = await createTeam('Alpha');
    await makeLeaderless(team.club.id);
    const target = await prisma.clubMember.findUniqueOrThrow({ where: { userId: team.teammate.id } });

    await expect(transferClubLeadership(team.owner.id, target.id)).rejects.toMatchObject({ status: 403 });
  });

  it('is rescued by an administrator appointing one', async () => {
    const admin = await createUser({ name: 'Admin', surname: 'One' });
    const team = await createTeam('Alpha');
    await makeLeaderless(team.club.id);
    const target = await prisma.clubMember.findUniqueOrThrow({ where: { userId: team.owner.id } });

    await appointClubLeader({ clubId: team.club.id, memberId: target.id, actorId: admin.id });

    const promoted = await prisma.clubMember.findUniqueOrThrow({ where: { id: target.id } });
    expect(promoted.membershipRole).toBe(ClubMembershipRole.LEADER);
    expect(await listLeaderlessClubs()).toEqual([]);

    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: 'club.leader_appointed' } });
    expect(audit.entityId).toBe(team.club.id);
  });
});

describe('appointing a leader over an existing one', () => {
  it('stands the previous leader down in the same write', async () => {
    const admin = await createUser({ name: 'Admin', surname: 'Two' });
    const team = await createTeam('Alpha');
    const target = await prisma.clubMember.findUniqueOrThrow({ where: { userId: team.teammate.id } });

    await appointClubLeader({ clubId: team.club.id, memberId: target.id, actorId: admin.id });

    const roles = await prisma.clubMember.findMany({
      where: { clubId: team.club.id },
      select: { userId: true, membershipRole: true },
    });
    expect(roles.filter((row) => row.membershipRole === ClubMembershipRole.LEADER)).toHaveLength(1);
    expect(roles.find((row) => row.userId === team.teammate.id)?.membershipRole)
      .toBe(ClubMembershipRole.LEADER);
    expect(roles.find((row) => row.userId === team.owner.id)?.membershipRole)
      .toBe(ClubMembershipRole.MEMBER);
  });

  it('refuses a member who has not accepted their invitation', async () => {
    const admin = await createUser({ name: 'Admin', surname: 'Three' });
    const team = await createTeam('Alpha');
    await prisma.user.update({ where: { id: team.teammate.id }, data: { status: UserStatus.INVITED } });
    const target = await prisma.clubMember.findUniqueOrThrow({ where: { userId: team.teammate.id } });

    await expect(appointClubLeader({ clubId: team.club.id, memberId: target.id, actorId: admin.id }))
      .rejects.toMatchObject({ status: 409 });
  });

  it('refuses a member of another club', async () => {
    const admin = await createUser({ name: 'Admin', surname: 'Four' });
    const alpha = await createTeam('Alpha');
    const beta = await createTeam('Beta');
    const outsider = await prisma.clubMember.findUniqueOrThrow({ where: { userId: beta.owner.id } });

    await expect(appointClubLeader({ clubId: alpha.club.id, memberId: outsider.id, actorId: admin.id }))
      .rejects.toMatchObject({ status: 404 });
  });
});
