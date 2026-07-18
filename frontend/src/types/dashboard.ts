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
  bankAccountIban: string;
  bankAccountReceiver: string;
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

export type DashboardData = {
  user: PublicUser;
  events: EventDto[];
  registrations: RegistrationDto[];
  clubMembers: PublicUser[];
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
