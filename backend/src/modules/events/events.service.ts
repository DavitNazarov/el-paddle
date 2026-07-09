import { startOfToday } from '../../common/dates.js';
import { eventInclude } from '../../common/includes.js';
import { jsonError } from '../../common/http.js';
import { prisma } from '../../database/prisma.js';

export async function listEvents({ adminScope }: { adminScope: boolean }) {
  return prisma.event.findMany({
    where: adminScope
      ? {}
      : {
          isPublished: true,
          date: { gte: startOfToday() },
        },
    orderBy: { date: 'asc' },
    include: eventInclude,
  });
}

type CreateEventInput = {
  title: string;
  date: Date;
  location: string;
  description: string;
  arrivalTime: Date | null | undefined;
  categoryIds: string[];
  createdById: string;
};

export async function createEvent(input: CreateEventInput) {
  const { title, date, location, description, arrivalTime, categoryIds, createdById } = input;

  const categories = await prisma.category.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true },
  });

  if (categories.length !== categoryIds.length) {
    jsonError('One or more selected categories were not found.');
  }

  return prisma.event.create({
    data: {
      title,
      date,
      location,
      description: description || null,
      arrivalTime,
      createdById,
      categories: {
        create: categoryIds.map((categoryId) => ({
          category: { connect: { id: categoryId } },
        })),
      },
    },
    include: eventInclude,
  });
}

export async function updateEvent(
  id: string,
  data: { isPublished?: boolean; arrivalTime?: Date | null },
) {
  return prisma.event.update({
    where: { id },
    data,
    include: eventInclude,
  });
}

export async function listPublicEvents() {
  const today = startOfToday();
  const [upcoming, previous] = await Promise.all([
    prisma.event.findMany({
      where: { isPublished: true, date: { gte: today } },
      orderBy: { date: 'asc' },
      take: 1,
      include: eventInclude,
    }),
    prisma.event.findMany({
      where: { isPublished: true, date: { lt: today } },
      orderBy: { date: 'desc' },
      take: 6,
      include: eventInclude,
    }),
  ]);

  return { upcoming: upcoming[0] ?? null, previous };
}
