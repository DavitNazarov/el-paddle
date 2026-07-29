import { describe, expect, it } from 'vitest';
import { Capability, UserRole } from '../generated/prisma/client.js';
import { isOrganiserEventCapability, roleHasCapability } from './capabilities.js';

describe('roleHasCapability', () => {
  it('grants every capability to admins', () => {
    for (const capability of Object.values(Capability)) {
      expect(roleHasCapability(UserRole.ADMIN, capability)).toBe(true);
    }
  });

  it('denies all capabilities to non-admin roles', () => {
    for (const capability of Object.values(Capability)) {
      expect(roleHasCapability(UserRole.USER, capability)).toBe(false);
      expect(roleHasCapability(UserRole.JUDGE, capability)).toBe(false);
      // Organisers are authorized per event, never globally.
      expect(roleHasCapability(UserRole.ORGANISER, capability)).toBe(false);
    }
  });
});

describe('organiser event capabilities', () => {
  // Pinned exactly, so adding a capability later forces a deliberate decision
  // about whether an organiser should have it.
  const expected: Capability[] = [
    Capability.BRACKET_MANAGE,
    Capability.BRACKET_PUBLISH,
    Capability.SCHEDULE_MANAGE,
    Capability.SCHEDULE_PUBLISH,
    Capability.OPPONENT_REQUEST_MANAGE,
    Capability.OPPONENT_REQUEST_DECIDE,
    Capability.OPPONENT_REQUEST_OVERRIDE,
    Capability.EVENT_STATUS_MANAGE,
    Capability.JUDGE_MANAGE,
  ];

  it('covers exactly the event-running capabilities', () => {
    const granted = Object.values(Capability).filter(isOrganiserEventCapability);
    expect(granted.sort()).toEqual([...expected].sort());
  });

  it('withholds account, setup, and correction powers', () => {
    for (const capability of [
      Capability.USER_MANAGE,
      Capability.CLUB_MANAGE,
      Capability.CLUB_APPLICATION_REVIEW,
      Capability.EVENT_MANAGE,
      Capability.EVENT_PUBLISH,
      Capability.CATEGORY_MANAGE,
      Capability.REGISTRATION_REVIEW,
      Capability.REGISTRATION_CORRECT,
      Capability.EVENT_STATE_CORRECT,
      Capability.MATCH_RESULT_ADMIN,
      Capability.MATCH_RESULT_CORRECT,
      Capability.AUDIT_READ,
      Capability.DELIVERY_MONITOR,
    ]) {
      expect(isOrganiserEventCapability(capability)).toBe(false);
    }
  });
});
