import {
  UserRole,
  type Category,
  type Club,
  type ClubMember,
  type Event,
  type EventRegistration,
  type User,
} from '../generated/prisma/client.js';
import { toPublicUser } from '../modules/auth/auth.service.js';

type CategoryWithEventCount = Category & {
  _count?: { eventLinks: number };
};

export function serializeCategory(category: CategoryWithEventCount) {
  return {
    id: category.id,
    name: category.name,
    description: category.description ?? '',
    eventCount: category._count?.eventLinks ?? 0,
  };
}

export type EventWithCategoryLinks = Event & {
  categories: {
    category: Category;
  }[];
};

export function serializeEvent(event: EventWithCategoryLinks) {
  return {
    id: event.id,
    title: event.title,
    date: event.date.toISOString(),
    location: event.location,
    description: event.description ?? '',
    arrivalTime: event.arrivalTime?.toISOString() ?? null,
    participationFee: event.participationFee,
    bankAccountIban: event.bankAccountIban,
    bankAccountReceiver: event.bankAccountReceiver,
    isPublished: event.isPublished,
    categories: event.categories.map((link) => serializeCategory(link.category)),
  };
}

export type RegistrationFull = EventRegistration & {
  event: Event;
  category: Category;
  owner: User;
  teammate: User;
  reviewedBy?: User | null;
};

export function serializeRegistration(registration: RegistrationFull) {
  return {
    id: registration.id,
    event: {
      id: registration.event.id,
      title: registration.event.title,
      date: registration.event.date.toISOString(),
      location: registration.event.location,
    },
    category: serializeCategory(registration.category),
    owner: toPublicUser(registration.owner),
    teammate: toPublicUser(registration.teammate),
    teammateEmail: registration.teammateEmail,
    ownerPhone: registration.ownerPhone,
    teammatePhone: registration.teammatePhone ?? '',
    status: registration.status,
    declineReason: registration.declineReason ?? '',
    reviewedAt: registration.reviewedAt?.toISOString() ?? '',
    reviewedBy: registration.reviewedBy ? toPublicUser(registration.reviewedBy) : null,
    createdAt: registration.createdAt.toISOString(),
  };
}

export type ClubFull = Club & {
  members: (ClubMember & { user: User })[];
};

function serializeClubMemberPublic(member: ClubMember & { user: User }) {
  const user = toPublicUser(member.user);
  if (user.role === UserRole.ADMIN) return null;
  return {
    id: member.id,
    roleTitle: member.roleTitle ?? '',
    user: {
      fullName: user.fullName,
    },
  };
}

/** Public club pages — names only, no emails/phones. */
export function serializePublicClub(club: ClubFull) {
  const members = club.members
    .map(serializeClubMemberPublic)
    .filter((member): member is NonNullable<typeof member> => Boolean(member));

  return {
    id: club.id,
    name: club.name,
    slug: club.slug,
    description: club.description ?? '',
    logoUrl: club.logoUrl ?? '',
    members,
  };
}

/** Admin club management — full member profiles. */
export function serializeClub(club: ClubFull) {
  const members = club.members
    .map((member) => ({ member, user: toPublicUser(member.user) }))
    .filter(({ user }) => user.role !== UserRole.ADMIN);

  return {
    id: club.id,
    name: club.name,
    slug: club.slug,
    description: club.description ?? '',
    logoUrl: club.logoUrl ?? '',
    members: members.map(({ member, user }) => ({
      id: member.id,
      roleTitle: member.roleTitle ?? '',
      user,
    })),
  };
}

export function serializeAdminUser(
  user: User & {
    clubMemberships?: {
      club: { id: string; name: string; slug: string };
    }[];
  },
) {
  const publicUser = toPublicUser(user);
  const disqualifiedUntil =
    user.disqualifiedUntil && user.disqualifiedUntil.getTime() > Date.now()
      ? user.disqualifiedUntil.toISOString()
      : null;

  return {
    ...publicUser,
    createdAt: user.createdAt.toISOString(),
    disqualifiedUntil,
    disqualificationReason: disqualifiedUntil ? (user.disqualificationReason ?? '') : '',
    isDisqualified: Boolean(disqualifiedUntil),
  };
}
