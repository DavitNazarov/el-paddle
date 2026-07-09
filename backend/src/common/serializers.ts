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

export function serializeCategory(category: Category) {
  return {
    id: category.id,
    name: category.name,
    description: category.description ?? '',
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
