import type { PublicUser } from '@/types/auth';

export type CategoryDto = {
  id: string;
  name: string;
  description: string;
};

export type EventDto = {
  id: string;
  title: string;
  date: string;
  location: string;
  description: string;
  arrivalTime?: string | null;
  participationFee: number;
  // Financial PII (F3): present only on authenticated single-event and admin
  // responses. List payloads omit it — fetch a single event when it is needed.
  bankAccountIban?: string;
  bankAccountReceiver?: string;
  categories: CategoryDto[];
  status: 'REGISTRATION_OPEN' | 'REGISTRATION_CLOSED' | 'ONGOING' | 'COMPLETED';
  version: number;
  timeZone: string;
  isPublished?: boolean;
  registrationRosterPublishedAt?: string | null;
  schedulePublishedAt?: string | null;
  publicLiveScoringEnabled?: boolean;
  resultsPublishedAt?: string | null;
};

export type RegistrationDto = {
  id: string;
  clubId: string | null;
  event: { id: string; title: string; date: string; location: string };
  category: CategoryDto;
  owner: PublicUser;
  teammate: PublicUser;
  ownerPhone: string;
  teammatePhone: string;
  status: 'PENDING' | 'APPROVED' | 'DECLINED' | 'NEEDS_CHANGES' | 'WAITLISTED' | 'WITHDRAWN' | 'CANCELLED';
  version: number;
  publicStatusReason: string;
  declineReason: string;
};

/** Saved-teammate dropdown option — the only club-member fields the dashboard uses (F7). */
export type TeammateOption = {
  id: string;
  email: string;
  fullName: string;
  phone: string;
};

export type DashboardData = {
  user: PublicUser;
  events: EventDto[];
  registrations: RegistrationDto[];
  clubMembers: TeammateOption[];
  clubMembershipRole: 'LEADER' | 'MEMBER' | null;
};

export type RegistrationFormState = {
  categoryId: string;
  ownerPhone: string;
  teammateEmail: string;
  teammatePhone: string;
  /** Empty = no selection; otherwise the selected club member user id. */
  savedTeammateId: string;
};

export type StatusFilter = 'ALL' | RegistrationDto['status'];
