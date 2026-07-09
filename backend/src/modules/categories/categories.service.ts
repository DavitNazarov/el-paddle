import { isUniqueConstraintError, jsonError } from '../../common/http.js';
import { prisma } from '../../database/prisma.js';

export async function listCategories() {
  return prisma.category.findMany({ orderBy: { name: 'asc' } });
}

export async function createCategory(name: string, description: string, createdById: string) {
  try {
    return await prisma.category.create({
      data: {
        name,
        description: description || null,
        createdById,
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) jsonError('Category already exists.', 409);
    throw error;
  }
}
