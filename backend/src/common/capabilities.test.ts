import { describe, expect, it } from 'vitest';
import { Capability, UserRole } from '../generated/prisma/client.js';
import { roleHasCapability } from './capabilities.js';

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
    }
  });
});
