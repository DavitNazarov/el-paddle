import { eventInclude, registrationInclude } from '../../common/includes.js';
import { prisma } from '../../database/prisma.js';
import { ClubApplicationStatus, EventStatus } from '../../generated/prisma/client.js';

export async function getPlayerDashboard(userId: string) {
  const currentMembership = await prisma.clubMember.findUnique({
    where: { userId },
    select: { clubId: true, membershipRole: true },
  });

  const registrationScope = currentMembership
    ? { clubId: currentMembership.clubId }
    : { OR: [{ ownerId: userId }, { teammateId: userId }] };

  const [events, registrations, clubMembers] = await Promise.all([
    prisma.event.findMany({
      where: {
        isPublished: true,
        OR: [
          { status: EventStatus.REGISTRATION_OPEN },
          { registrations: { some: registrationScope } },
        ],
      },
      orderBy: { date: 'asc' },
      include: eventInclude,
    }),
    prisma.eventRegistration.findMany({
      where: registrationScope,
      orderBy: { createdAt: 'desc' },
      include: registrationInclude,
    }),
    currentMembership
      ? prisma.user.findMany({
          where: {
            id: { not: userId },
            role: 'USER',
            clubMemberships: { some: { clubId: currentMembership.clubId } },
            status: { not: 'INACTIVE' },
          },
          orderBy: [{ name: 'asc' }, { surname: 'asc' }, { email: 'asc' }],
          // Only the columns serializeTeammateOption reads (F7) — no clubMemberships,
          // stats, status, or disqualification for the saved-teammate dropdown.
          select: { id: true, email: true, name: true, surname: true, phone: true },
        })
      : Promise.resolve([]),
  ]);

  return {
    events,
    registrations,
    clubMembers,
    clubMembershipRole: currentMembership?.membershipRole ?? null,
  };
}

/**
 * Counts for the admin overview. An organiser sees the same shape narrowed to
 * the events handed to them, and never platform-wide club, category, or
 * application totals they have no power over.
 */
export async function getAdminSummary(organiserId?: string) {
  const eventScope = organiserId
    ? { organisers: { some: { userId: organiserId, revokedAt: null } } }
    : {};
  const registrationScope = organiserId ? { event: eventScope } : {};

  const [registrationGroups, eventGroups, events, clubs, categories, applications] = await Promise.all([
    prisma.eventRegistration.groupBy({ by: ['status'], where: registrationScope, _count: { _all: true } }),
    prisma.event.groupBy({ by: ['isPublished'], where: eventScope, _count: { _all: true } }),
    prisma.event.count({ where: eventScope }),
    organiserId ? Promise.resolve(0) : prisma.club.count(),
    organiserId ? Promise.resolve(0) : prisma.category.count(),
    organiserId
      ? Promise.resolve(0)
      : prisma.clubApplication.count({ where: { status: ClubApplicationStatus.SUBMITTED } }),
  ]);

  const registrationCount = (status: string) =>
    registrationGroups.find((group) => group.status === status)?._count._all ?? 0;
  const eventCount = (isPublished: boolean) =>
    eventGroups.find((group) => group.isPublished === isPublished)?._count._all ?? 0;

  return {
    pending: registrationCount('PENDING'),
    approved: registrationCount('APPROVED'),
    declined: registrationCount('DECLINED'),
    published: eventCount(true),
    drafts: eventCount(false),
    events,
    clubs,
    categories,
    applications,
  };
}

/** Opponent-request states still sitting in an administrator's decision queue. */
const AWAITING_ADMIN_DECISION = ['ACCEPTED_BY_OPPONENT', 'REFUSED_BY_OPPONENT', 'CONFLICTED'];

export type EventOperations = {
  eventId: string;
  registrations: { pending: number; approved: number; total: number };
  requests: { awaiting: number; total: number };
  brackets: { total: number; locked: number; published: number };
  courts: { total: number; staffed: number };
  schedule: { queued: number };
  matches: { total: number; live: number; completed: number };
};

/**
 * Per-event operational counts for every event the caller runs. The role home
 * screens need to say which event needs a decision, and answering that per
 * event with separate list reads is one request per stage per event; these are
 * grouped counts instead, so the cost does not grow with the roster.
 *
 * Scoping matches `getAdminSummary`: an organiser sees only the events handed
 * to them, an admin sees every event.
 */
export async function getEventOperations(organiserId?: string): Promise<EventOperations[]> {
  const eventScope = organiserId
    ? { organisers: { some: { userId: organiserId, revokedAt: null } } }
    : {};

  const [events, registrationGroups, requestGroups, brackets, courts, staffedCourts, scheduleGroups, matchGroups] =
    await Promise.all([
      prisma.event.findMany({ where: eventScope, select: { id: true } }),
      prisma.eventRegistration.groupBy({
        by: ['eventId', 'status'],
        where: { event: eventScope },
        _count: { _all: true },
      }),
      prisma.opponentRequest.groupBy({
        by: ['eventId', 'status'],
        where: { event: eventScope },
        _count: { _all: true },
      }),
      prisma.bracket.findMany({
        where: { event: eventScope },
        select: { id: true, eventId: true, status: true, publishedAt: true },
      }),
      prisma.court.findMany({ where: { event: eventScope }, select: { id: true, eventId: true } }),
      // groupBy collapses to one row per court, so this counts distinct courts
      // that still hold a live judge assignment.
      prisma.courtJudgeAssignment.groupBy({
        by: ['courtId'],
        where: { revokedAt: null, court: { event: eventScope } },
      }),
      prisma.scheduleItem.groupBy({
        by: ['courtId'],
        where: { court: { event: eventScope } },
        _count: { _all: true },
      }),
      prisma.match.groupBy({
        by: ['bracketId', 'status'],
        where: { bracket: { event: eventScope } },
        _count: { _all: true },
      }),
    ]);

  const eventOfBracket = new Map(brackets.map((bracket) => [bracket.id, bracket.eventId]));
  const eventOfCourt = new Map(courts.map((court) => [court.id, court.eventId]));
  const staffedCourtIds = new Set(staffedCourts.map((row) => row.courtId));

  return events.map((event) => {
    const registrationsFor = registrationGroups.filter((row) => row.eventId === event.id);
    const requestsFor = requestGroups.filter((row) => row.eventId === event.id);
    const bracketsFor = brackets.filter((row) => row.eventId === event.id);
    const courtsFor = courts.filter((row) => row.eventId === event.id);
    const matchesFor = matchGroups.filter((row) => eventOfBracket.get(row.bracketId) === event.id);
    const total = (rows: Array<{ _count: { _all: number } }>) =>
      rows.reduce((sum, row) => sum + row._count._all, 0);

    return {
      eventId: event.id,
      registrations: {
        pending: total(registrationsFor.filter((row) => row.status === 'PENDING')),
        approved: total(registrationsFor.filter((row) => row.status === 'APPROVED')),
        total: total(registrationsFor),
      },
      requests: {
        awaiting: total(requestsFor.filter((row) => AWAITING_ADMIN_DECISION.includes(row.status))),
        total: total(requestsFor),
      },
      brackets: {
        total: bracketsFor.length,
        locked: bracketsFor.filter((row) => row.status !== 'DRAFT').length,
        published: bracketsFor.filter((row) => row.publishedAt).length,
      },
      courts: {
        total: courtsFor.length,
        staffed: courtsFor.filter((court) => staffedCourtIds.has(court.id)).length,
      },
      schedule: {
        queued: total(scheduleGroups.filter((row) => eventOfCourt.get(row.courtId) === event.id)),
      },
      matches: {
        total: total(matchesFor),
        live: total(matchesFor.filter((row) => row.status === 'IN_PROGRESS')),
        completed: total(matchesFor.filter((row) => row.status === 'COMPLETED')),
      },
    };
  });
}
