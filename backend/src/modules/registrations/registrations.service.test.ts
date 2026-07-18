import { describe, expect, it } from 'vitest';
import { ClubMembershipRole, RegistrationStatus } from '../../generated/prisma/client.js';
import { ApiError } from '../../common/http.js';
import {
  assertClubCanRegisterForEvent,
  assertClubLeaderCanManageRegistration,
  assertLeaderEditableRegistrationStatus,
  assertRegistrationTransition,
} from './registrations.service.js';

function expectApiStatus(action: () => void, status: number) {
  try {
    action();
    throw new Error(`Expected an API error with status ${status}.`);
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(status);
  }
}

describe('registration lifecycle', () => {
  it('allows review actions from pending', () => {
    expect(() => assertRegistrationTransition(RegistrationStatus.PENDING, RegistrationStatus.APPROVED)).not.toThrow();
    expect(() => assertRegistrationTransition(RegistrationStatus.PENDING, RegistrationStatus.NEEDS_CHANGES)).not.toThrow();
  });

  it('allows an admin to decline an approved registration', () => {
    expect(() => assertRegistrationTransition(RegistrationStatus.APPROVED, RegistrationStatus.DECLINED)).not.toThrow();
  });

  it('keeps routine terminal states terminal', () => {
    expect(() => assertRegistrationTransition(RegistrationStatus.DECLINED, RegistrationStatus.APPROVED)).toThrow();
    expect(() => assertRegistrationTransition(RegistrationStatus.CANCELLED, RegistrationStatus.PENDING)).toThrow();
  });
});

describe('club leader lineup management', () => {
  const leader = {
    clubId: 'club-a',
    membershipRole: ClubMembershipRole.LEADER,
  };

  it('allows a leader to manage a registration owned by their club', () => {
    expect(() => assertClubLeaderCanManageRegistration(leader, 'club-a')).not.toThrow();
  });

  it('rejects a regular member', () => {
    expectApiStatus(
      () =>
        assertClubLeaderCanManageRegistration(
          { clubId: 'club-a', membershipRole: ClubMembershipRole.MEMBER },
          'club-a',
        ),
      403,
    );
  });

  it('does not reveal registrations belonging to another club', () => {
    expectApiStatus(() => assertClubLeaderCanManageRegistration(leader, 'club-b'), 404);
  });

  it('allows replacement while an entry can still be reviewed', () => {
    for (const status of [
      RegistrationStatus.PENDING,
      RegistrationStatus.APPROVED,
      RegistrationStatus.NEEDS_CHANGES,
      RegistrationStatus.WAITLISTED,
    ]) {
      expect(() => assertLeaderEditableRegistrationStatus(status)).not.toThrow();
    }
  });

  it('blocks replacement after an entry reaches a terminal status', () => {
    for (const status of [
      RegistrationStatus.DECLINED,
      RegistrationStatus.CANCELLED,
      RegistrationStatus.WITHDRAWN,
    ]) {
      expectApiStatus(() => assertLeaderEditableRegistrationStatus(status), 409);
    }
  });
});

describe('club event registration limit', () => {
  it('allows a club without an entry to register', () => {
    expect(() => assertClubCanRegisterForEvent(null)).not.toThrow();
  });

  it('requires an existing club entry to be edited instead of duplicated', () => {
    expectApiStatus(() => assertClubCanRegisterForEvent({ id: 'registration-a' }), 409);
  });
});
