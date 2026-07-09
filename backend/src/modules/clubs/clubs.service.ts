import { UserRole } from '../../generated/prisma/client.js';
import { clubInclude } from '../../common/includes.js';
import { isUniqueConstraintError, jsonError } from '../../common/http.js';
import { prisma } from '../../database/prisma.js';
import { roleForEmail } from '../auth/auth.service.js';

export async function listAdminClubs() {
  return prisma.club.findMany({
    orderBy: { name: 'asc' },
    include: clubInclude,
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

export async function addClubMember(clubId: string, email: string, roleTitle: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) jsonError('User not found. The member needs an account first.', 404);
  if (roleForEmail(user.email, user.role) === UserRole.ADMIN) {
    jsonError('Admins cannot be added to club rosters.', 403);
  }

  const clubExists = await prisma.club.findUnique({
    where: { id: clubId },
    select: { id: true },
  });
  if (!clubExists) jsonError('Club not found.', 404);

  await prisma.clubMember.upsert({
    where: {
      clubId_userId: {
        clubId,
        userId: user.id,
      },
    },
    update: { roleTitle: roleTitle || null },
    create: {
      clubId,
      userId: user.id,
      roleTitle: roleTitle || null,
    },
  });

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
