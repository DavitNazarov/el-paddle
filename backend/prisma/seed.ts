import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import {
  PrismaClient,
  RegistrationStatus,
  UserRole,
  UserStatus,
} from '../src/generated/prisma/client';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

const seedPassword = 'Password123!';

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function daysFromNow(days: number, hour = 18) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date;
}

async function upsertUser({
  email,
  name,
  surname,
  role = UserRole.USER,
  status = UserStatus.ACTIVE,
  matchesPlayed = 0,
  wins = 0,
  losses = 0,
}: {
  email: string;
  name?: string;
  surname?: string;
  role?: UserRole;
  status?: UserStatus;
  matchesPlayed?: number;
  wins?: number;
  losses?: number;
}) {
  const passwordHash =
    status === UserStatus.INVITED ? null : await bcrypt.hash(seedPassword, 12);

  return prisma.user.upsert({
    where: { email },
    update: {
      name,
      surname,
      role,
      status,
      passwordHash,
      emailVerifiedAt: status === UserStatus.ACTIVE ? new Date() : null,
      matchesPlayed,
      wins,
      losses,
    },
    create: {
      email,
      name,
      surname,
      role,
      status,
      passwordHash,
      emailVerifiedAt: status === UserStatus.ACTIVE ? new Date() : null,
      matchesPlayed,
      wins,
      losses,
    },
  });
}

async function upsertEvent({
  id,
  title,
  date,
  location,
  description,
  arrivalTime,
  participationFee,
  bankAccountIban,
  bankAccountReceiver,
  isPublished,
  createdById,
  categoryIds,
}: {
  id: string;
  title: string;
  date: Date;
  location: string;
  description: string;
  arrivalTime?: Date | null;
  participationFee: number;
  bankAccountIban: string;
  bankAccountReceiver: string;
  isPublished: boolean;
  createdById: string;
  categoryIds: string[];
}) {
  const event = await prisma.event.upsert({
    where: { id },
    update: {
      title,
      date,
      location,
      description,
      arrivalTime: arrivalTime ?? null,
      participationFee,
      bankAccountIban,
      bankAccountReceiver,
      isPublished,
      createdById,
    },
    create: {
      id,
      title,
      date,
      location,
      description,
      arrivalTime: arrivalTime ?? null,
      participationFee,
      bankAccountIban,
      bankAccountReceiver,
      isPublished,
      createdById,
    },
  });

  await prisma.eventCategory.deleteMany({
    where: {
      eventId: event.id,
      categoryId: { notIn: categoryIds },
    },
  });

  await Promise.all(
    categoryIds.map((categoryId) =>
      prisma.eventCategory.upsert({
        where: {
          eventId_categoryId: {
            eventId: event.id,
            categoryId,
          },
        },
        update: {},
        create: {
          eventId: event.id,
          categoryId,
        },
      }),
    ),
  );

  return event;
}

async function main() {
  const admin = await upsertUser({
    email: 'admin@example.com',
    name: 'Ana',
    surname: 'Matadori',
    role: UserRole.ADMIN,
  });

  const nika = await upsertUser({
    email: 'nika.beridze@example.com',
    name: 'Nika',
    surname: 'Beridze',
    matchesPlayed: 12,
    wins: 8,
    losses: 4,
  });
  const mariam = await upsertUser({
    email: 'mariam.lomidze@example.com',
    name: 'Mariam',
    surname: 'Lomidze',
    matchesPlayed: 15,
    wins: 10,
    losses: 5,
  });
  const dato = await upsertUser({
    email: 'dato.kapanadze@example.com',
    name: 'Dato',
    surname: 'Kapanadze',
    matchesPlayed: 9,
    wins: 5,
    losses: 4,
  });
  const salome = await upsertUser({
    email: 'salome.gelashvili@example.com',
    name: 'Salome',
    surname: 'Gelashvili',
    matchesPlayed: 21,
    wins: 14,
    losses: 7,
  });
  const giorgi = await upsertUser({
    email: 'giorgi.tskitishvili@example.com',
    name: 'Giorgi',
    surname: 'Tskitishvili',
    matchesPlayed: 7,
    wins: 3,
    losses: 4,
  });
  const lukaInvited = await upsertUser({
    email: 'luka.invited@example.com',
    status: UserStatus.INVITED,
  });

  const categories = await Promise.all(
    [
      {
        name: 'Pro Doubles',
        description: 'High-tempo teams with tournament experience.',
      },
      {
        name: 'Amateur Doubles',
        description: 'Competitive, welcoming category for newer teams.',
      },
      {
        name: 'Mixed Doubles',
        description: 'Balanced mixed teams with group and bracket play.',
      },
      {
        name: 'Women Open',
        description: 'Open women category for club and independent teams.',
      },
      {
        name: 'Junior Showcase',
        description: 'Short-format showcase for emerging players.',
      },
    ].map((category) =>
      prisma.category.upsert({
        where: { name: category.name },
        update: {
          description: category.description,
          createdById: admin.id,
        },
        create: {
          ...category,
          createdById: admin.id,
        },
      }),
    ),
  );

  const byName = new Map(categories.map((category) => [category.name, category]));

  const summerOpen = await upsertEvent({
    id: 'event_tbilisi_summer_open_2026',
    title: 'Tbilisi Summer Open',
    date: daysFromNow(12, 19),
    location: 'KUS TBA Padel Courts',
    arrivalTime: daysFromNow(12, 17),
    participationFee: 300,
    bankAccountIban: 'GE29NB0000000101904917',
    bankAccountReceiver: 'El Padel Georgia',
    description:
      'The next public tournament with verified two-player entries, admin approval and categories for serious but welcoming match play.',
    isPublished: true,
    createdById: admin.id,
    categoryIds: [
      byName.get('Pro Doubles')!.id,
      byName.get('Amateur Doubles')!.id,
      byName.get('Mixed Doubles')!.id,
      byName.get('Women Open')!.id,
    ],
  });

  const nightCup = await upsertEvent({
    id: 'event_night_cup_2026',
    title: 'El Padel Night Cup',
    date: daysFromNow(34, 21),
    location: 'Vake Padel Arena',
    participationFee: 250,
    bankAccountIban: 'GE33BG0000000101904928',
    bankAccountReceiver: 'El Padel Night Cup',
    description:
      'A late-evening cup built for club teams, lights-on rallies and quick category brackets.',
    isPublished: true,
    createdById: admin.id,
    categoryIds: [
      byName.get('Amateur Doubles')!.id,
      byName.get('Mixed Doubles')!.id,
    ],
  });

  await upsertEvent({
    id: 'event_admin_draft_2026',
    title: 'Autumn Club Draft',
    date: daysFromNow(72, 18),
    location: 'Lisi Padel Club',
    participationFee: 200,
    bankAccountIban: 'GE45TB0000000101904939',
    bankAccountReceiver: 'Lisi Padel Club',
    description: 'Draft event hidden from players until the admin publishes it.',
    isPublished: false,
    createdById: admin.id,
    categoryIds: [
      byName.get('Pro Doubles')!.id,
      byName.get('Junior Showcase')!.id,
    ],
  });

  const springClassic = await upsertEvent({
    id: 'event_spring_classic_2026',
    title: 'Spring Classic',
    date: daysFromNow(-44, 17),
    location: 'Lisi Padel Club',
    participationFee: 280,
    bankAccountIban: 'GE67LB0000000101904940',
    bankAccountReceiver: 'El Padel Georgia',
    description:
      'A past published event used by the landing-page previous-events archive.',
    isPublished: true,
    createdById: admin.id,
    categoryIds: [
      byName.get('Amateur Doubles')!.id,
      byName.get('Women Open')!.id,
    ],
  });

  await upsertEvent({
    id: 'event_winter_court_2026',
    title: 'Winter Court Session',
    date: daysFromNow(-96, 16),
    location: 'Saburtalo Indoor Courts',
    participationFee: 180,
    bankAccountIban: 'GE11VT0000000101904951',
    bankAccountReceiver: 'Saburtalo Indoor Courts',
    description:
      'A compact winter event for testing the previous events archive.',
    isPublished: true,
    createdById: admin.id,
    categoryIds: [
      byName.get('Pro Doubles')!.id,
      byName.get('Mixed Doubles')!.id,
    ],
  });

  // One category per event per player (owner or teammate). Each person appears
  // in at most one registration row for a given eventId.
  const registrations = [
    {
      // Summer Open · Mixed Doubles — Aurum club pair (nika + mariam)
      eventId: summerOpen.id,
      categoryId: byName.get('Mixed Doubles')!.id,
      ownerId: nika.id,
      teammateId: mariam.id,
      teammateEmail: mariam.email,
      ownerPhone: '+995 555 100 101',
      teammatePhone: '+995 555 100 102',
      status: RegistrationStatus.PENDING,
    },
    {
      // Summer Open · Amateur Doubles — separate team (dato + giorgi)
      eventId: summerOpen.id,
      categoryId: byName.get('Amateur Doubles')!.id,
      ownerId: dato.id,
      teammateId: giorgi.id,
      teammateEmail: giorgi.email,
      ownerPhone: '+995 555 200 201',
      teammatePhone: '+995 555 200 202',
      status: RegistrationStatus.APPROVED,
      reviewedById: admin.id,
      reviewedAt: new Date(),
    },
    {
      // Night Cup · Mixed Doubles — salome + invited teammate
      eventId: nightCup.id,
      categoryId: byName.get('Mixed Doubles')!.id,
      ownerId: salome.id,
      teammateId: lukaInvited.id,
      teammateEmail: lukaInvited.email,
      ownerPhone: '+995 555 300 301',
      teammatePhone: null,
      status: RegistrationStatus.PENDING,
    },
    {
      // Spring Classic · Women Open — past declined entry (mariam + salome)
      eventId: springClassic.id,
      categoryId: byName.get('Women Open')!.id,
      ownerId: mariam.id,
      teammateId: salome.id,
      teammateEmail: salome.email,
      ownerPhone: '+995 555 400 401',
      teammatePhone: '+995 555 400 402',
      status: RegistrationStatus.DECLINED,
      declineReason: 'Category was already full.',
      reviewedById: admin.id,
      reviewedAt: daysFromNow(-42, 12),
    },
    {
      // Winter Court · Pro Doubles — gives nika a second saved teammate (giorgi)
      eventId: 'event_winter_court_2026',
      categoryId: byName.get('Pro Doubles')!.id,
      ownerId: nika.id,
      teammateId: giorgi.id,
      teammateEmail: giorgi.email,
      ownerPhone: '+995 555 100 101',
      teammatePhone: '+995 555 200 202',
      status: RegistrationStatus.APPROVED,
      reviewedById: admin.id,
      reviewedAt: daysFromNow(-90, 12),
    },
  ];

  const playerIdsInSeed = [
    nika.id,
    mariam.id,
    dato.id,
    giorgi.id,
    salome.id,
    lukaInvited.id,
  ];

  // Drop prior mock entries so re-seeds cannot leave multi-category leftovers.
  await prisma.eventRegistration.deleteMany({
    where: {
      OR: [
        { ownerId: { in: playerIdsInSeed } },
        { teammateId: { in: playerIdsInSeed } },
      ],
    },
  });

  const seenEventPlayers = new Set<string>();
  for (const registration of registrations) {
    for (const playerId of [registration.ownerId, registration.teammateId]) {
      const key = `${registration.eventId}:${playerId}`;
      if (seenEventPlayers.has(key)) {
        throw new Error(
          `Seed violates one-category-per-event: player ${playerId} appears twice in event ${registration.eventId}`,
        );
      }
      seenEventPlayers.add(key);
    }
  }

  await Promise.all(
    registrations.map((registration) =>
      prisma.eventRegistration.create({
        data: registration,
      }),
    ),
  );

  await prisma.inviteToken.deleteMany({
    where: { userId: lukaInvited.id, usedAt: null },
  });
  await prisma.inviteToken.create({
    data: {
      userId: lukaInvited.id,
      tokenHash: hashToken('mock-invite-token'),
      expiresAt: daysFromNow(14),
    },
  });

  const clubs = await Promise.all([
    prisma.club.upsert({
      where: { slug: 'aurum-padel-club' },
      update: {
        name: 'Aurum Padel Club',
        description:
          'A club for composed, technical doubles teams training around Tbilisi.',
      },
      create: {
        name: 'Aurum Padel Club',
        slug: 'aurum-padel-club',
        description:
          'A club for composed, technical doubles teams training around Tbilisi.',
      },
    }),
    prisma.club.upsert({
      where: { slug: 'velvet-court-team' },
      update: {
        name: 'Velvet Court Team',
        description:
          'A mixed-format club with a strong social match calendar.',
      },
      create: {
        name: 'Velvet Court Team',
        slug: 'velvet-court-team',
        description:
          'A mixed-format club with a strong social match calendar.',
      },
    }),
  ]);

  await Promise.all([
    prisma.clubMember.upsert({
      where: { userId: nika.id },
      update: { clubId: clubs[0].id, roleTitle: 'Captain' },
      create: { clubId: clubs[0].id, userId: nika.id, roleTitle: 'Captain' },
    }),
    prisma.clubMember.upsert({
      where: { userId: mariam.id },
      update: { clubId: clubs[0].id, roleTitle: 'Doubles player' },
      create: { clubId: clubs[0].id, userId: mariam.id, roleTitle: 'Doubles player' },
    }),
    prisma.clubMember.upsert({
      where: { userId: salome.id },
      update: { clubId: clubs[1].id, roleTitle: 'Captain' },
      create: { clubId: clubs[1].id, userId: salome.id, roleTitle: 'Captain' },
    }),
    prisma.clubMember.upsert({
      where: { userId: dato.id },
      update: { clubId: clubs[1].id, roleTitle: 'Right-side player' },
      create: { clubId: clubs[1].id, userId: dato.id, roleTitle: 'Right-side player' },
    }),
    prisma.clubMember.upsert({
      where: { userId: giorgi.id },
      update: { clubId: clubs[0].id, roleTitle: 'Left-side player' },
      create: { clubId: clubs[0].id, userId: giorgi.id, roleTitle: 'Left-side player' },
    }),
    prisma.clubMember.upsert({
      where: { userId: lukaInvited.id },
      update: { clubId: clubs[1].id },
      create: { clubId: clubs[1].id, userId: lukaInvited.id },
    }),
  ]);

  const adminUsers = await prisma.user.findMany({
    where: { role: UserRole.ADMIN },
    select: { id: true },
  });
  const adminIds = adminUsers.map((user) => user.id);

  if (adminIds.length) {
    await prisma.eventRegistration.deleteMany({
      where: {
        OR: [{ ownerId: { in: adminIds } }, { teammateId: { in: adminIds } }],
      },
    });
    await prisma.clubMember.deleteMany({
      where: { userId: { in: adminIds } },
    });
  }

  console.log('Mock data created.');
  console.log(`Login password for active mock users: ${seedPassword}`);
  console.log('Admin login: admin@example.com');
  console.log('Sample player: nika.beridze@example.com');
  console.log('Sample invite URL: /invite?token=mock-invite-token');
  console.log('Club pages: /clubs/aurum-padel-club and /clubs/velvet-court-team');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
