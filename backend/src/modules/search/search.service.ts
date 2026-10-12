import { EventStatus, UserRole, UserStatus } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';

/**
 * One query across the three things a visitor arrives looking for: a player, a
 * club, or an event. Everything it can return is already public through a
 * dedicated route — the directory, the club page, the calendar — so this adds a
 * way in, not a way past a publication rule.
 *
 * Deliberately small: an unpublished event, an invited-but-not-accepted player
 * and an inactive account are all invisible here, exactly as they are in the
 * lists this searches over.
 */
export async function searchPublic(term: string, limit = 5) {
  const query = term.trim();
  if (query.length < 2) return { players: [], clubs: [], events: [] };
  const take = Math.min(Math.max(limit, 1), 20);
  const contains = { contains: query, mode: 'insensitive' as const };

  const [players, clubs, events] = await Promise.all([
    prisma.user.findMany({
      where: {
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        OR: [{ name: contains }, { surname: contains }],
      },
      select: {
        id: true,
        name: true,
        surname: true,
        clubMemberships: { select: { club: { select: { id: true, name: true, slug: true } } }, take: 1 },
      },
      orderBy: [{ name: 'asc' }, { surname: 'asc' }],
      take,
    }),
    prisma.club.findMany({
      where: { OR: [{ name: contains }, { slug: contains }] },
      select: { id: true, name: true, slug: true, logoUrl: true },
      orderBy: { name: 'asc' },
      take,
    }),
    prisma.event.findMany({
      where: {
        isPublished: true,
        OR: [{ title: contains }, { location: contains }],
      },
      select: { id: true, title: true, date: true, location: true, status: true },
      // Whatever is still to come first, because a search for an event is
      // nearly always a search for one you can still enter or attend.
      orderBy: [{ status: 'asc' }, { date: 'desc' }],
      take,
    }),
  ]);

  return {
    players: players.map((player) => ({
      id: player.id,
      name: [player.name, player.surname].filter(Boolean).join(' '),
      club: player.clubMemberships[0]?.club ?? null,
    })),
    clubs,
    events: events.map((event) => ({
      id: event.id,
      title: event.title,
      date: event.date.toISOString(),
      location: event.location,
      status: event.status,
      upcoming: event.status !== EventStatus.COMPLETED,
    })),
  };
}
