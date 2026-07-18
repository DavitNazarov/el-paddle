import { Router } from 'express';
import { Capability } from '../../generated/prisma/client.js';
import { requireCapability } from '../../common/capabilities.js';
import {
  asyncHandler,
  cleanString,
  jsonError,
  requireParamId,
} from '../../common/http.js';
import { serializeCategory } from '../../common/serializers.js';
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from './categories.service.js';

export const categoriesRouter = Router();

categoriesRouter.get('/api/categories', asyncHandler(async (_request, response) => {
  const categories = await listCategories();
  response.json({ categories: categories.map(serializeCategory) });
}));

categoriesRouter.post('/api/categories', asyncHandler(async (request, response) => {
  const admin = await requireCapability(request, Capability.CATEGORY_MANAGE);
  const name = cleanString(request.body.name);
  const description = cleanString(request.body.description);

  if (name.length < 2) jsonError('Category name is too short.');

  const category = await createCategory(name, description, admin.id);
  response.status(201).json({ category: serializeCategory(category) });
}));

categoriesRouter.patch('/api/categories/:id', asyncHandler(async (request, response) => {
  await requireCapability(request, Capability.CATEGORY_MANAGE);
  const name = cleanString(request.body.name);
  const description = cleanString(request.body.description);

  if (name.length < 2) jsonError('Category name is too short.');

  const category = await updateCategory(requireParamId(request.params.id), name, description);
  response.json({ category: serializeCategory(category) });
}));

categoriesRouter.delete('/api/categories/:id', asyncHandler(async (request, response) => {
  await requireCapability(request, Capability.CATEGORY_MANAGE);
  await deleteCategory(requireParamId(request.params.id));
  response.json({ ok: true });
}));
