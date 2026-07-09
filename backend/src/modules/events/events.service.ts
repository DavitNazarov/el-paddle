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
  participationFee: number;
  bankAccountIban: string;
  bankAccountReceiver: string;
  categoryIds: string[];
  createdById: string;
};

type UpdateEventInput = {
  title?: string;
  date?: Date;
  location?: string;
  description?: string | null;
  arrivalTime?: Date | null;
  participationFee?: number;
  bankAccountIban?: string;
  bankAccountReceiver?: string;
  isPublished?: boolean;
  categoryIds?: string[];
};

async function assertCategoriesExist(categoryIds: string[]) {
  const categories = await prisma.category.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true },
  });

  if (categories.length !== categoryIds.length) {
    jsonError('One or more selected categories were not found.');
  }
}

export async function createEvent(input: CreateEventInput) {
  const {
    title,
    date,
    location,
    description,
    arrivalTime,
    participationFee,
    bankAccountIban,
    bankAccountReceiver,
    categoryIds,
    createdById,
  } = input;

  await assertCategoriesExist(categoryIds);

  return prisma.event.create({
    data: {
      title,
      date,
      location,
      description: description || null,
      arrivalTime,
      participationFee,
      bankAccountIban,
      bankAccountReceiver,
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

export async function updateEvent(id: string, input: UpdateEventInput) {
  const existing = await prisma.event.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) jsonError('Event not found.', 404);

  if (input.categoryIds) {
    await assertCategoriesExist(input.categoryIds);

    const linkedWithEntries = await prisma.eventRegistration.findMany({
      where: {
        eventId: id,
        categoryId: { notIn: input.categoryIds },
      },
      select: { categoryId: true },
      distinct: ['categoryId'],
    });
    if (linkedWithEntries.length) {
      jsonError('Cannot remove a category that already has registrations for this event.');
    }
  }

  return prisma.$transaction(async (tx) => {
    if (input.categoryIds) {
      const categoryIds = input.categoryIds;
      await tx.eventCategory.deleteMany({
        where: {
          eventId: id,
          categoryId: { notIn: categoryIds },
        },
      });
      await Promise.all(
        categoryIds.map((categoryId) =>
          tx.eventCategory.upsert({
            where: {
              eventId_categoryId: { eventId: id, categoryId },
            },
            update: {},
            create: { eventId: id, categoryId },
          }),
        ),
      );
    }

    return tx.event.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.date !== undefined ? { date: input.date } : {}),
        ...(input.location !== undefined ? { location: input.location } : {}),
        ...(input.description !== undefined ? { description: input.description || null } : {}),
        ...(input.arrivalTime !== undefined ? { arrivalTime: input.arrivalTime } : {}),
        ...(input.participationFee !== undefined ? { participationFee: input.participationFee } : {}),
        ...(input.bankAccountIban !== undefined ? { bankAccountIban: input.bankAccountIban } : {}),
        ...(input.bankAccountReceiver !== undefined ? { bankAccountReceiver: input.bankAccountReceiver } : {}),
        ...(input.isPublished !== undefined ? { isPublished: input.isPublished } : {}),
      },
      include: eventInclude,
    });
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
