import {
  UserRole,
  type Category,
  type Bracket,
  type Club,
  type ClubMember,
  type Court,
  type Event,
  type EventRegistration,
  type Match,
  type ScheduleItem,
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
    status: event.status,
    version: event.version,
    timeZone: event.timeZone,
    registrationRosterPublishedAt: event.registrationRosterPublishedAt?.toISOString() ?? null,
    schedulePublishedAt: event.schedulePublishedAt?.toISOString() ?? null,
    publicLiveScoringEnabled: event.publicLiveScoringEnabled,
    resultsPublishedAt: event.resultsPublishedAt?.toISOString() ?? null,
    categories: event.categories.map((link) => serializeCategory(link.category)),
  };
}

export type RegistrationFull = EventRegistration & {
  event: Event;
  category: Category;
  owner: User & { clubMemberships?: { club: { id: string; name: string; slug: string } }[] };
  teammate: User & { clubMemberships?: { club: { id: string; name: string; slug: string } }[] };
  reviewedBy?: User | null;
};

export function serializeRegistration(registration: RegistrationFull) {
  return {
    id: registration.id,
    clubId: registration.clubId,
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
    version: registration.version,
    publicStatusReason: registration.publicStatusReason ?? registration.declineReason ?? '',
    declineReason: registration.declineReason ?? '',
    reviewedAt: registration.reviewedAt?.toISOString() ?? '',
    reviewedBy: registration.reviewedBy ? toPublicUser(registration.reviewedBy) : null,
    createdAt: registration.createdAt.toISOString(),
  };
}

/** Public event roster — deliberately excludes contact and review details. */
export function serializePublicRegistrationTeam(registration: RegistrationFull) {
  const ownerClub = registration.owner.clubMemberships?.[0]?.club;
  const teammateClub = registration.teammate.clubMemberships?.[0]?.club;
  const club = ownerClub ?? teammateClub ?? null;

  return {
    id: registration.id,
    category: serializeCategory(registration.category),
    owner: {
      id: registration.owner.id,
      fullName: [registration.owner.name, registration.owner.surname].filter(Boolean).join(' ') || 'Player',
    },
    teammate: {
      id: registration.teammate.id,
      fullName: [registration.teammate.name, registration.teammate.surname].filter(Boolean).join(' ') || 'Player',
    },
    club: club ? { id: club.id, name: club.name, slug: club.slug } : null,
  };
}

type EntryWithUsers = EventRegistration & {
  owner: User;
  teammate: User;
  category?: Category;
};

type MatchWithEntries = Match & {
  participantA?: EntryWithUsers | null;
  participantB?: EntryWithUsers | null;
  winner?: EntryWithUsers | null;
  loser?: EntryWithUsers | null;
  snapshots?: {
    side: 'A' | 'B';
    clubId: string;
    clubName: string;
    ownerName: string;
    teammateName: string;
  }[];
  scheduleItem?: (ScheduleItem & { court?: Court }) | null;
  bracket?: {
    eventId: string;
    categoryId: string;
    status: string;
    generation: number;
    version: number;
    publishedAt: Date | null;
    event?: Event & { categories?: { category: Category }[] };
    eventCategory?: { category: Category };
  };
};

type BracketWithMatches = Bracket & {
  matches?: MatchWithEntries[];
  eventCategory?: { category: Category };
};

function serializePlayerIdentity(user: User) {
  return {
    id: user.id,
    fullName: [user.name, user.surname].filter(Boolean).join(' ') || 'Player',
  };
}

export function serializeEntrySummary(entry: EntryWithUsers | null | undefined) {
  if (!entry) return null;
  return {
    id: entry.id,
    eventId: entry.eventId,
    categoryId: entry.categoryId,
    status: entry.status,
    version: entry.version,
    category: entry.category ? serializeCategory(entry.category) : undefined,
    owner: serializePlayerIdentity(entry.owner),
    teammate: serializePlayerIdentity(entry.teammate),
  };
}

export function serializeMatch(match: MatchWithEntries) {
  return {
    id: match.id,
    bracketId: match.bracketId,
    round: match.round,
    roundPosition: match.roundPosition,
    matchNumber: match.matchNumber,
    participantAEntryId: match.participantAEntryId,
    participantBEntryId: match.participantBEntryId,
    nextMatchId: match.nextMatchId,
    nextMatchSlot: match.nextMatchSlot,
    scoreA: match.scoreA,
    scoreB: match.scoreB,
    status: match.status,
    resultType: match.resultType,
    resultReason: match.resultReason,
    winnerEntryId: match.winnerEntryId,
    loserEntryId: match.loserEntryId,
    version: match.version,
    startedAt: match.startedAt?.toISOString() ?? null,
    completedAt: match.completedAt?.toISOString() ?? null,
    participantA: serializeEntrySummary(match.participantA),
    participantB: serializeEntrySummary(match.participantB),
    winner: serializeEntrySummary(match.winner),
    loser: serializeEntrySummary(match.loser),
    snapshots: (match.snapshots ?? []).map((snapshot) => ({
      side: snapshot.side,
      clubId: snapshot.clubId,
      clubName: snapshot.clubName,
      ownerName: snapshot.ownerName,
      teammateName: snapshot.teammateName,
    })),
    scheduleItem: match.scheduleItem
      ? {
          id: match.scheduleItem.id,
          matchId: match.scheduleItem.matchId,
          courtId: match.scheduleItem.courtId,
          assignedJudgeId: match.scheduleItem.assignedJudgeId,
          queuePosition: match.scheduleItem.queuePosition,
          plannedStartAt: match.scheduleItem.plannedStartAt?.toISOString() ?? null,
          plannedEndAt: match.scheduleItem.plannedEndAt?.toISOString() ?? null,
          status: match.scheduleItem.status,
          version: match.scheduleItem.version,
          court: match.scheduleItem.court
            ? {
                id: match.scheduleItem.court.id,
                name: match.scheduleItem.court.name,
                location: match.scheduleItem.court.location,
              }
            : undefined,
        }
      : match.scheduleItem,
    bracket: match.bracket
      ? {
          eventId: match.bracket.eventId,
          categoryId: match.bracket.categoryId,
          status: match.bracket.status,
          generation: match.bracket.generation,
          version: match.bracket.version,
          publishedAt: match.bracket.publishedAt?.toISOString() ?? null,
          event: match.bracket.event
            ? {
                id: match.bracket.event.id,
                title: match.bracket.event.title,
                date: match.bracket.event.date.toISOString(),
                location: match.bracket.event.location,
                description: match.bracket.event.description ?? '',
                status: match.bracket.event.status,
                timeZone: match.bracket.event.timeZone,
                publicLiveScoringEnabled: match.bracket.event.publicLiveScoringEnabled,
                resultsPublishedAt: match.bracket.event.resultsPublishedAt?.toISOString() ?? null,
                categories: (match.bracket.event.categories ?? []).map((link) => serializeCategory(link.category)),
              }
            : undefined,
          eventCategory: match.bracket.eventCategory
            ? { category: serializeCategory(match.bracket.eventCategory.category) }
            : undefined,
        }
      : undefined,
  };
}

export function serializeMatchDetail(match: MatchWithEntries, redactResult = false) {
  const serialized = serializeMatch(match);
  if (!redactResult) return { ...serialized, resultVisible: true };
  return {
    ...serialized,
    scoreA: null,
    scoreB: null,
    resultType: null,
    resultReason: null,
    winnerEntryId: null,
    loserEntryId: null,
    winner: null,
    loser: null,
    resultVisible: false,
  };
}

type ScheduleItemWithMatch = ScheduleItem & {
  match?: MatchWithEntries | null;
};

type CourtWithScheduleItems = Court & {
  scheduleItems?: ScheduleItemWithMatch[];
  judgeAssignments?: {
    id: string;
    startsAt: Date;
    endsAt: Date;
    judge: User;
  }[];
};

export function serializeScheduleItem(item: ScheduleItemWithMatch) {
  return {
    id: item.id,
    matchId: item.matchId,
    courtId: item.courtId,
    assignedJudgeId: item.assignedJudgeId,
    queuePosition: item.queuePosition,
    plannedStartAt: item.plannedStartAt?.toISOString() ?? null,
    plannedEndAt: item.plannedEndAt?.toISOString() ?? null,
    status: item.status,
    version: item.version,
    match: item.match ? serializeMatch(item.match) : item.match,
  };
}

export function serializeCourtSchedule(court: CourtWithScheduleItems, includeAssignments = false) {
  return {
    id: court.id,
    eventId: court.eventId,
    name: court.name,
    location: court.location,
    description: court.description,
    active: court.active,
    version: court.version,
    judgeAssignments: includeAssignments
      ? (court.judgeAssignments ?? []).map((assignment) => ({
          id: assignment.id,
          startsAt: assignment.startsAt.toISOString(),
          endsAt: assignment.endsAt.toISOString(),
          judge: serializePlayerIdentity(assignment.judge),
        }))
      : [],
    scheduleItems: court.scheduleItems?.map(serializeScheduleItem) ?? [],
  };
}

export function serializeBracket(bracket: BracketWithMatches) {
  return {
    id: bracket.id,
    eventId: bracket.eventId,
    categoryId: bracket.categoryId,
    size: bracket.size,
    status: bracket.status,
    generation: bracket.generation,
    version: bracket.version,
    lockedAt: bracket.lockedAt?.toISOString() ?? null,
    publishedAt: bracket.publishedAt?.toISOString() ?? null,
    completedAt: bracket.completedAt?.toISOString() ?? null,
    eventCategory: bracket.eventCategory
      ? { category: serializeCategory(bracket.eventCategory.category) }
      : undefined,
    matches: bracket.matches?.map(serializeMatch) ?? [],
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
    membershipRole: member.membershipRole,
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
      membershipRole: member.membershipRole,
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
