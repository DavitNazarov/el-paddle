import { eventInclude, registrationInclude } from '../../common/includes.js';
import { prisma } from '../../database/prisma.js';
import { EventStatus } from '../../generated/prisma/client.js';

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
          include: {
            clubMemberships: {
              include: {
                club: { select: { id: true, name: true, slug: true } },
              },
              take: 1,
            },
          },
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

export async function getAdminSummary() {
  const [registrationGroups, eventGroups, events, clubs, categories] = await Promise.all([
    prisma.eventRegistration.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.event.groupBy({ by: ['isPublished'], _count: { _all: true } }),
    prisma.event.count(),
    prisma.club.count(),
    prisma.category.count(),
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
  };
}
