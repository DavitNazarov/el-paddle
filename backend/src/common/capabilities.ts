import type { Request } from 'express';
import { Capability, CapabilityEffect, UserRole } from '../generated/prisma/client.js';
import { prisma } from '../database/prisma.js';
import { requireUser } from '../modules/auth/auth.service.js';
import { ApiError } from './http.js';

const adminCapabilities = new Set<Capability>(Object.values(Capability));

/**
 * What an organiser may do — but only on an event handed to them. Organisers
 * hold no *global* capability, so `roleHasCapability` stays admin-only and
 * every existing `requireCapability` call keeps its original meaning.
 *
 * Deliberately excluded, and each for a reason:
 * - USER_MANAGE / CLUB_MANAGE: organisers run tournaments, not the roster.
 * - CLUB_APPLICATION_REVIEW: deciding who joins the platform is an admin act.
 * - EVENT_MANAGE / EVENT_PUBLISH / CATEGORY_MANAGE: admins set an event up
 *   before handing it over.
 * - REGISTRATION_REVIEW / REGISTRATION_CORRECT: entries are approved by an
 *   admin before hand-off.
 * - EVENT_STATE_CORRECT / MATCH_RESULT_CORRECT: organisers run an event
 *   forward; rewriting a recorded result or reopening a finished event needs
 *   an admin.
 * - MATCH_RESULT_ADMIN: an organiser scores through the judge path instead,
 *   which already covers walkovers and retirements.
 * - AUDIT_READ / DELIVERY_MONITOR: platform-wide operational surfaces.
 */
const organiserEventCapabilities = new Set<Capability>([
  Capability.BRACKET_MANAGE,
  Capability.BRACKET_PUBLISH,
  Capability.SCHEDULE_MANAGE,
  Capability.SCHEDULE_PUBLISH,
  Capability.OPPONENT_REQUEST_MANAGE,
  Capability.OPPONENT_REQUEST_DECIDE,
  Capability.OPPONENT_REQUEST_OVERRIDE,
  Capability.EVENT_STATUS_MANAGE,
  Capability.JUDGE_MANAGE,
]);

export function roleHasCapability(role: UserRole, capability: Capability) {
  return role === UserRole.ADMIN && adminCapabilities.has(capability);
}

export function isOrganiserEventCapability(capability: Capability) {
  return organiserEventCapabilities.has(capability);
}

export async function userHasCapability(userId: string, role: UserRole, capability: Capability) {
  const grant = await prisma.userCapabilityGrant.findUnique({
    where: { userId_capability: { userId, capability } },
    select: { effect: true },
  });
  if (grant) return grant.effect === CapabilityEffect.ALLOW;
  return roleHasCapability(role, capability);
}

/** True when this user currently runs this event. */
export async function isEventOrganiser(userId: string, eventId: string) {
  if (!eventId) return false;
  const assignment = await prisma.eventOrganiser.findUnique({
    where: { eventId_userId: { eventId, userId } },
    select: { revokedAt: true },
  });
  return Boolean(assignment && !assignment.revokedAt);
}

export async function requireCapability(request: Request, capability: Capability) {
  const user = await requireUser(request);
  if (!(await userHasCapability(user.id, user.role, capability))) {
    throw new ApiError('Forbidden', 403);
  }
  return user;
}

/**
 * Authorize an action against one event. Admins and explicit per-user grants
 * pass on their global capability; an organiser passes only when the capability
 * is one of theirs *and* this event was handed to them.
 */
export async function requireEventCapability(
  request: Request,
  eventId: string,
  capability: Capability,
) {
  const user = await requireUser(request);
  if (await userHasCapability(user.id, user.role, capability)) return user;
  if (
    user.role === UserRole.ORGANISER &&
    organiserEventCapabilities.has(capability) &&
    (await isEventOrganiser(user.id, eventId))
  ) {
    return user;
  }
  throw new ApiError('Forbidden', 403);
}

/**
 * Read-only sibling for GET endpoints an organiser needs to see but must not
 * act on — the approved entry roster, for instance, which they seed a bracket
 * from but cannot decide. Never use this to guard a write.
 */
export async function requireEventReadCapability(
  request: Request,
  eventId: string,
  capability: Capability,
) {
  const user = await requireUser(request);
  if (await userHasCapability(user.id, user.role, capability)) return user;
  if (user.role === UserRole.ORGANISER && (await isEventOrganiser(user.id, eventId))) return user;
  throw new ApiError('Forbidden', 403);
}
