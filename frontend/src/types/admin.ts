import type { PublicUser, UserRole, UserStatus } from '@/types/auth';

export type CategoryDto = {
  id: string;
  name: string;
  description: string;
  eventCount?: number;
};

export type EventDto = {
  id: string;
  title: string;
  date: string;
  location: string;
  description: string;
  arrivalTime: string | null;
  participationFee: number;
  bankAccountIban: string;
  bankAccountReceiver: string;
  isPublished: boolean;
  categories: CategoryDto[];
};

export type RegistrationDto = {
  id: string;
  event: { title: string; date: string };
  category: CategoryDto;
  owner: PublicUser;
  teammate: PublicUser;
  ownerPhone: string;
  teammatePhone: string;
  status: 'PENDING' | 'APPROVED' | 'DECLINED';
  declineReason: string;
};

export type ClubDto = {
  id: string;
  name: string;
  slug: string;
  description: string;
  members: {
    id: string;
    roleTitle: string;
    user: PublicUser;
  }[];
};

export type ClubOptionDto = {
  id: string;
  name: string;
  slug: string;
};

export type AdminUserDto = PublicUser & {
  createdAt: string;
};

export type UserRoleFilter = 'ALL' | UserRole;
export type UserStatusFilter = 'ALL' | UserStatus | 'DISQUALIFIED';

export type RegistrationFilter = 'ALL' | RegistrationDto['status'];
export type BusyKey = string | null;

export type AdminCounts = {
  pending: number;
  approved: number;
  declined: number;
  published: number;
  drafts: number;
  events: number;
  clubs: number;
  categories: number;
};
