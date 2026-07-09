import { isNotFoundError, isUniqueConstraintError, jsonError } from '../../common/http.js';
import { prisma } from '../../database/prisma.js';

export async function listCategories() {
  return prisma.category.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { eventLinks: true } },
    },
  });
}

export async function createCategory(name: string, description: string, createdById: string) {
  try {
    return await prisma.category.create({
      data: {
        name,
        description: description || null,
        createdById,
      },
      include: {
        _count: { select: { eventLinks: true } },
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) jsonError('Category already exists.', 409);
    throw error;
  }
}

export async function updateCategory(id: string, name: string, description: string) {
  try {
    return await prisma.category.update({
      where: { id },
      data: {
        name,
        description: description || null,
      },
      include: {
        _count: { select: { eventLinks: true } },
      },
    });
  } catch (error) {
    if (isNotFoundError(error)) jsonError('Category not found.', 404);
    if (isUniqueConstraintError(error)) jsonError('Category already exists.', 409);
    throw error;
  }
}

export async function deleteCategory(id: string) {
  const category = await prisma.category.findUnique({
    where: { id },
    include: {
      _count: { select: { eventLinks: true } },
    },
  });

  if (!category) jsonError('Category not found.', 404);
  if (category._count.eventLinks > 0) {
    jsonError('Cannot delete a category that is used by one or more events.', 409);
  }

  try {
    await prisma.category.delete({ where: { id } });
  } catch (error) {
    if (isNotFoundError(error)) jsonError('Category not found.', 404);
    throw error;
  }
}
