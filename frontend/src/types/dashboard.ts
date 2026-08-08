import type { PublicUser, UserStatus } from '@/types/auth';

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
  /** Active teams (pending, approved, waitlisted, needs-changes) in this event. */
  teamsIn?: number;
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
  /** True when this entry appears in a published draw. */
  inDraw?: boolean;
};

/** The player's next playable match: the running one, else the earliest scheduled one. */
export type NextMatchDto = {
  id: string;
  eventId: string;
  eventTitle: string;
  round: 'ROUND_OF_32' | 'ROUND_OF_16' | 'QUARTERFINAL' | 'SEMIFINAL' | 'FINAL';
  status: 'PENDING' | 'READY' | 'IN_PROGRESS';
  scoreA: number;
  scoreB: number;
  yourSide: 'A' | 'B';
  you: { ownerName: string; teammateName: string } | null;
  opponent: { ownerName: string; teammateName: string } | null;
  court: { name: string; location: string } | null;
  plannedStartAt: string | null;
};

/** Saved-teammate dropdown option — the only club-member fields the dashboard uses (F7). */
export type TeammateOption = {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  /** Only an ACTIVE club mate can be entered in an event; the rest are shown but not selectable. */
  status: UserStatus;
};

/** An opponent request waiting on this player's answer. */
export type ReceivedRequestDto = {
  id: string;
  eventId: string;
  eventTitle: string;
  from: { ownerName: string; teammateName: string } | null;
};

/**
 * The opponent-request states a player's own request can still be in. Settled
 * ones — refused, rejected, expired, withdrawn — release the entry to ask
 * someone else, so the dashboard never sends them and the home screen goes back
 * to offering the request action.
 */
export type LiveRequestStatus =
  | 'PENDING_RESPONSE'
  | 'ACCEPTED_BY_OPPONENT'
  | 'CONFLICTED'
  | 'APPROVED_BY_ADMIN'
  | 'OVERRIDDEN_BY_ADMIN'
  | 'APPLIED_TO_BRACKET';

/** An opponent request this player's team sent, and where it has reached. */
export type SentRequestDto = {
  id: string;
  eventId: string;
  categoryId: string;
  status: LiveRequestStatus;
  to: { ownerName: string; teammateName: string };
};

/** Whether one category of one event is currently accepting opponent requests. */
export type RequestWindowDto = {
  eventId: string;
  categoryId: string;
  open: boolean;
};

export type DashboardData = {
  user: PublicUser;
  events: EventDto[];
  registrations: RegistrationDto[];
  clubMembers: TeammateOption[];
  clubMembershipRole: 'LEADER' | 'MEMBER' | null;
  nextMatch?: NextMatchDto | null;
  receivedRequests?: ReceivedRequestDto[];
  sentRequests?: SentRequestDto[];
  requestWindows?: RequestWindowDto[];
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
