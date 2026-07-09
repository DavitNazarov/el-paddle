import { startOfToday } from '../../common/dates.js';
import { eventInclude, registrationInclude } from '../../common/includes.js';
import { prisma } from '../../database/prisma.js';

export async function getPlayerDashboard(userId: string) {
  const [events, registrations] = await Promise.all([
    prisma.event.findMany({
      where: { isPublished: true, date: { gte: startOfToday() } },
      orderBy: { date: 'asc' },
      include: eventInclude,
    }),
    prisma.eventRegistration.findMany({
      where: { OR: [{ ownerId: userId }, { teammateId: userId }] },
      orderBy: { createdAt: 'desc' },
      include: registrationInclude,
    }),
  ]);

  return { events, registrations };
}
