import { Router } from 'express';
import { requireAdmin } from '../auth/auth.service.js';
import {
  asyncHandler,
  cleanString,
  jsonError,
} from '../../common/http.js';
import { serializeCategory } from '../../common/serializers.js';
import { createCategory, listCategories } from './categories.service.js';

export const categoriesRouter = Router();

categoriesRouter.get('/api/categories', asyncHandler(async (_request, response) => {
  const categories = await listCategories();
  response.json({ categories: categories.map(serializeCategory) });
}));

categoriesRouter.post('/api/categories', asyncHandler(async (request, response) => {
  const admin = await requireAdmin(request);
  const name = cleanString(request.body.name);
  const description = cleanString(request.body.description);

  if (name.length < 2) jsonError('Category name is too short.');

  const category = await createCategory(name, description, admin.id);
  response.status(201).json({ category: serializeCategory(category) });
}));
