import type { Prisma } from '../generated/prisma/client.js';

export const eventInclude = {
  categories: {
    include: {
      category: true,
    },
  },
} as const;

/** Club identity shown by rosters and toPublicUser. */
export const clubSummarySelect = {
  id: true,
  name: true,
  slug: true,
} satisfies Prisma.ClubSelect;

/**
 * The exact columns `toPublicUser` and the registration serializers read from a
 * player row. Deliberately excludes `passwordHash`, OAuth, verification, and
 * session columns — on a read path a user should be `select`ed, never
 * `include`d whole (F1). Never add `passwordHash` here.
 */
export const playerIdentitySelect = {
  id: true,
  name: true,
  surname: true,
  email: true,
  phone: true,
  role: true,
  status: true,
  emailVerifiedAt: true,
  matchesPlayed: true,
  wins: true,
  losses: true,
  disqualifiedUntil: true,
  disqualificationReason: true,
} satisfies Prisma.UserSelect;

/** Player identity plus the single club membership `toPublicUser` resolves. */
export const playerWithClubSelect = {
  ...playerIdentitySelect,
  clubMemberships: {
    select: { club: { select: clubSummarySelect } },
    take: 1,
  },
} satisfies Prisma.UserSelect;

/**
 * Bracket / match / schedule participant identity — only what
 * `serializeEntrySummary` (id/name/surname) and the notification paths (email)
 * read. No stats, no phone, no `passwordHash`.
 */
export const entryUserSelect = {
  id: true,
  name: true,
  surname: true,
  email: true,
} satisfies Prisma.UserSelect;

/** Event fields the registration serializers read — no bank columns, no heavy text. */
export const registrationEventSelect = {
  id: true,
  title: true,
  date: true,
  location: true,
  status: true,
} satisfies Prisma.EventSelect;

export const registrationInclude = {
  event: { select: registrationEventSelect },
  category: true,
  owner: { select: playerWithClubSelect },
  teammate: { select: playerWithClubSelect },
  reviewedBy: { select: playerIdentitySelect },
} satisfies Prisma.EventRegistrationInclude;

export const clubInclude = {
  members: {
    include: { user: { select: playerIdentitySelect } },
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.ClubInclude;
