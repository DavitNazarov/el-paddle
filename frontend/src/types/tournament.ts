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

export type MatchRoundDto = 'ROUND_OF_16' | 'QUARTERFINAL' | 'SEMIFINAL' | 'FINAL';

export type MatchSlotDto = {
  slotNumber: number;
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
  /** For slot matches these are the slot-win tallies, not points. */
  scoreA: number;
  scoreB: number;
  scoringMode: 'POINTS' | 'SLOTS';
  /** Slot wins needed, snapshotted when the match starts. Null before that and for point matches. */
  slotCount: number | null;
  slotCountOverride: number | null;
  slotsToWin: number | null;
  maxSlots: number | null;
  slots: MatchSlotDto[];
  status: 'PENDING' | 'READY' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  resultType: string | null;
  resultReason: string | null;
  winnerEntryId: string | null;
  version: number;
  startedAt: string | null;
  completedAt: string | null;
  snapshots: Array<{ side: 'A' | 'B'; clubId: string; clubName: string; ownerName: string; teammateName: string }>;
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
  slotDefaults: Partial<Record<MatchRoundDto, number>>;
  eventCategory: { category: { id: string; name: string } };
  matches: MatchDto[];
};

export type JudgeAssignmentDto = {
  id: string;
  startsAt: string;
  endsAt: string;
  court: { id: string; name: string; eventId: string; event: EventDto };
};

export type ScheduleItemDto = {
  id: string;
  matchId: string;
  courtId: string;
  assignedJudgeId: string | null;
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
  judgeAssignments: Array<{ id: string; startsAt: string; endsAt: string; judge: { id: string; name: string | null; surname: string | null; email: string } }>;
  scheduleItems: ScheduleItemDto[];
};

/** One court a judge is assigned to, with the live state of its queue. */
export type JudgeCourtDto = {
  assignmentId: string;
  startsAt: string;
  endsAt: string;
  court: { id: string; name: string; location: string | null };
  event: { id: string; title: string; location: string; date: string; status: EventDto['status'] };
  items: ScheduleItemDto[];
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
