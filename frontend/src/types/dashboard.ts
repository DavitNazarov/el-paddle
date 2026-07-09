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
  categories: CategoryDto[];
};

export type RegistrationDto = {
  id: string;
  event: { id: string; title: string; date: string; location: string };
  category: CategoryDto;
  owner: PublicUser;
  teammate: PublicUser;
  ownerPhone: string;
  teammatePhone: string;
  status: 'PENDING' | 'APPROVED' | 'DECLINED';
  declineReason: string;
};

export type DashboardData = {
  user: PublicUser;
  events: EventDto[];
  registrations: RegistrationDto[];
};

export type RegistrationFormState = {
  categoryId: string;
  ownerPhone: string;
  teammateEmail: string;
  teammatePhone: string;
};

export type StatusFilter = 'ALL' | RegistrationDto['status'];
