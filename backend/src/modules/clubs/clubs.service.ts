import { UserRole, type Club, type Prisma } from '../../generated/prisma/client.js';
import { clubInclude } from '../../common/includes.js';
import { isUniqueConstraintError, jsonError } from '../../common/http.js';
import { prisma } from '../../database/prisma.js';
import { slugify, isSafeSlug } from '../../common/slug.js';
import { roleForEmail } from '../auth/auth.service.js';

export async function listAdminClubs() {
  return prisma.club.findMany({
    orderBy: { name: 'asc' },
    include: clubInclude,
  });
}

export async function listPublicClubs() {
  return prisma.club.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      slug: true,
    },
  });
}

export async function requireClubId(clubId: string) {
  if (!clubId) jsonError('Club is required.');
  const club = await prisma.club.findUnique({
    where: { id: clubId },
    select: { id: true, name: true, slug: true },
  });
  if (!club) jsonError('Club not found.', 404);
  return club;
}

export async function setPlayerClub(
  userId: string,
  clubId: string,
  roleTitle = '',
  client: Prisma.TransactionClient | typeof prisma = prisma,
) {
  await client.clubMember.upsert({
    where: { userId },
    update: {
      clubId,
      roleTitle: roleTitle || null,
    },
    create: {
      clubId,
      userId,
      roleTitle: roleTitle || null,
    },
  });
}

type CreateClubInput = {
  name: string;
  slug: string;
  description: string;
  logoUrl: string;
};

export async function createClub(input: CreateClubInput) {
  const { name, slug, description, logoUrl } = input;
  if (!isSafeSlug(slug)) jsonError('Club slug is required.');

  try {
    return await prisma.club.create({
      data: {
        name,
        slug,
        description: description || null,
        logoUrl: logoUrl || null,
      },
      include: { members: { include: { user: true } } },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) jsonError('Club slug already exists.', 409);
    throw error;
  }
}

export async function createClubForPlayer(
  userId: string,
  input: { name: string; description?: string },
  client: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const name = input.name.trim();
  if (name.length < 2) jsonError('Club name is required.');

  const baseSlug = slugify(name) || 'club';
  if (!isSafeSlug(baseSlug) && baseSlug !== 'club') jsonError('Club name is invalid.');
  let slug = isSafeSlug(baseSlug) ? baseSlug : 'club';
  let attempt = 0;

  while (attempt < 8) {
    try {
      const club = await client.club.create({
        data: {
          name,
          slug,
          description: input.description?.trim() || null,
        },
      });
      await setPlayerClub(userId, club.id, '', client);
      return club;
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      attempt += 1;
      slug = `${baseSlug}-${attempt + 1}`;
    }
  }

  jsonError('Could not create club. Try a different name.', 409);
}

export async function addClubMember(clubId: string, email: string, roleTitle: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) jsonError('User not found. The member needs an account first.', 404);
  if (roleForEmail(user.email, user.role) === UserRole.ADMIN) {
    jsonError('Admins cannot be added to club rosters.', 403);
  }
  if (user.disqualifiedUntil && user.disqualifiedUntil.getTime() > Date.now()) {
    jsonError('This user is currently disqualified.', 403);
  }

  await requireClubId(clubId);
  await setPlayerClub(user.id, clubId, roleTitle);

  const club = await prisma.club.findUnique({
    where: { id: clubId },
    include: clubInclude,
  });

  if (!club) jsonError('Club not found.', 404);
  return club;
}

export async function getPublicClubBySlug(slug: string) {
  const club = await prisma.club.findUnique({
    where: { slug },
    include: clubInclude,
  });

  if (!club) jsonError('Club not found.', 404);
  return club;
}

export function serializeClubOption(club: Pick<Club, 'id' | 'name' | 'slug'>) {
  return {
    id: club.id,
    name: club.name,
    slug: club.slug,
  };
}
