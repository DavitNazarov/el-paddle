import type { Request } from 'express';
import { Capability, CapabilityEffect, UserRole } from '../generated/prisma/client.js';
import { prisma } from '../database/prisma.js';
import { requireUser } from '../modules/auth/auth.service.js';
import { ApiError } from './http.js';

const adminCapabilities = new Set<Capability>(Object.values(Capability));

export function roleHasCapability(role: UserRole, capability: Capability) {
  return role === UserRole.ADMIN && adminCapabilities.has(capability);
}

export async function userHasCapability(userId: string, role: UserRole, capability: Capability) {
  const grant = await prisma.userCapabilityGrant.findUnique({
    where: { userId_capability: { userId, capability } },
    select: { effect: true },
  });
  if (grant) return grant.effect === CapabilityEffect.ALLOW;
  return roleHasCapability(role, capability);
}

export async function requireCapability(request: Request, capability: Capability) {
  const user = await requireUser(request);
  if (!(await userHasCapability(user.id, user.role, capability))) {
    throw new ApiError('Forbidden', 403);
  }
  return user;
}

