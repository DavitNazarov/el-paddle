import { describe, expect, it } from 'vitest';
import { ClubMembershipRole } from '../../generated/prisma/client.js';
import { ApiError } from '../../common/http.js';
import {
  assertClubKickAllowed,
  assertMemberRemovalResolutionsComplete,
} from './clubs.service.js';

const leader = {
  clubId: 'club-a',
  membershipRole: ClubMembershipRole.LEADER,
};

const member = {
  clubId: 'club-a',
  membershipRole: ClubMembershipRole.MEMBER,
};

function expectStatus(action: () => void, status: number) {
  try {
    action();
    throw new Error('Expected action to fail.');
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(status);
  }
}

describe('club member removal authorization', () => {
  it('allows a leader to remove a member of the same club', () => {
    expect(() => assertClubKickAllowed(leader, member)).not.toThrow();
  });

  it('does not allow a regular member to remove another player', () => {
    expectStatus(() => assertClubKickAllowed(member, member), 403);
  });

  it('does not allow a leader to be removed', () => {
    expectStatus(() => assertClubKickAllowed(leader, leader), 409);
  });

  it('does not expose members from another club', () => {
    expectStatus(
      () => assertClubKickAllowed(leader, { ...member, clubId: 'club-b' }),
      404,
    );
  });
});

describe('club member registration resolutions', () => {
  const replacement = {
    registrationId: 'registration-a',
    expectedVersion: 2,
    action: 'REPLACE' as const,
    replacementUserId: 'user-b',
  };

  it('accepts one resolution for every affected registration', () => {
    expect(() =>
      assertMemberRemovalResolutionsComplete(['registration-a'], [replacement]),
    ).not.toThrow();
  });

  it('blocks removal when an affected registration is unresolved', () => {
    expectStatus(
      () => assertMemberRemovalResolutionsComplete(['registration-a'], []),
      409,
    );
  });

  it('rejects duplicate registration resolutions', () => {
    expectStatus(
      () =>
        assertMemberRemovalResolutionsComplete(
          ['registration-a'],
          [replacement, replacement],
        ),
      400,
    );
  });
});
