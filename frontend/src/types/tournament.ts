import type { EventDto, RegistrationDto } from './dashboard';

export type PublicRegistrationTeamDto = {
  id: string;
  category: { id: string; name: string; description: string };
  owner: { id: string; fullName: string };
  teammate: { id: string; fullName: string };
  club: { id: string; name: string; slug: string } | null;
};

export type OpponentRequestStatus =
  | 'PENDING_RESPONSE' | 'ACCEPTED_BY_OPPONENT' | 'REFUSED_BY_OPPONENT'
  | 'WITHDRAWN_BY_REQUESTER' | 'EXPIRED' | 'CONFLICTED'
  | 'APPROVED_BY_ADMIN' | 'OVERRIDDEN_BY_ADMIN' | 'REJECTED_BY_ADMIN'
  | 'APPLIED_TO_BRACKET';

export type EntrySummary = RegistrationDto & {
  owner: RegistrationDto['owner'];
  teammate: RegistrationDto['teammate'];
};

export type OpponentRequestDto = {
  id: string;
  eventId: string;
  categoryId: string;
  requestingEntryId: string;
  targetEntryId: string;
  status: OpponentRequestStatus;
  requestMessage: string | null;
  responseReason: string | null;
  adminPublicReason: string | null;
  version: number;
  expiresAt: string | null;
  createdAt: string;
  requestingEntry: EntrySummary;
  targetEntry: EntrySummary;
};

export type MatchRoundDto = 'ROUND_OF_32' | 'ROUND_OF_16' | 'QUARTERFINAL' | 'SEMIFINAL' | 'FINAL';

export type MatchSetDto = {
  setNumber: number;
  winnerSide: 'A' | 'B';
  winnerEntryId: string;
  decidedAt: string;
};

export type MatchDto = {
  id: string;
  bracketId: string;
  round: MatchRoundDto;
  roundPosition: number;
  matchNumber: number;
  participantAEntryId: string | null;
  participantBEntryId: string | null;
  nextMatchId: string | null;
  nextMatchSlot: 'A' | 'B' | null;
  participantA: EntrySummary | null;
  participantB: EntrySummary | null;
  /** For set matches these are the set-win tallies, not points. */
  scoreA: number;
  scoreB: number;
  scoringMode: 'POINTS' | 'SETS';
  /** Set wins needed, snapshotted when the match starts. Null before that and for point matches. */
  setCount: number | null;
  setCountOverride: number | null;
  setsToWin: number | null;
  maxSets: number | null;
  sets: MatchSetDto[];
  status: 'PENDING' | 'READY' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  resultType: string | null;
  resultReason: string | null;
  winnerEntryId: string | null;
  version: number;
  startedAt: string | null;
  completedAt: string | null;
  snapshots: Array<{ side: 'A' | 'B'; clubId: string | null; clubName: string | null; ownerName: string; teammateName: string }>;
  scheduleItem?: ScheduleItemDto | null;
  bracket?: { eventId: string; event: EventDto; eventCategory: { category: { id: string; name: string } } };
};

export type BracketDto = {
  id: string;
  eventId: string;
  categoryId: string;
  size: number;
  status: 'DRAFT' | 'LOCKED' | 'COMPLETED';
  generation: number;
  version: number;
  publishedAt: string | null;
  setDefaults: Partial<Record<MatchRoundDto, number>>;
  eventCategory: { category: { id: string; name: string } };
  matches: MatchDto[];
};

export type ScheduleItemDto = {
  id: string;
  matchId: string;
  courtId: string;
  queuePosition: number;
  plannedStartAt: string | null;
  plannedEndAt: string | null;
  status: 'TENTATIVE' | 'READY' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  version: number;
  court?: { id: string; name: string; location: string | null };
  match: MatchDto;
};

export type CourtDto = {
  id: string;
  eventId: string;
  name: string;
  location: string | null;
  description: string | null;
  active: boolean;
  version: number;
  scheduleItems: ScheduleItemDto[];
};

export type NotificationDto = {
  id: string;
  type: string;
  title: string;
  message: string;
  actionPath: string;
  readAt: string | null;
  createdAt: string;
};
