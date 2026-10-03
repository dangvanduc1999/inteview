import { controller } from '../../core/http/controller';
import { model } from '../../core/model';
import { requireUser } from '../auth/auth.middleware';
import { requireCategory } from './categories.middleware';
import type { CategoryInput } from './categories.schema';

// The rules (ownership, unique name) are middleware on the routes, so these call the model directly.

export const listCategories = controller('listCategories', async (req, res) => {
  res.json({ data: await model.category.listByOwner(requireUser(req).id) });
});

export const createCategory = controller<CategoryInput>('createCategory', async (req, res) => {
  const category = await model.category.create(requireUser(req).id, req.valid.body.name);
  req.log.info('category created', { categoryId: category.id });
  res.status(201).json({ category });
});

export const renameCategory = controller<CategoryInput>('renameCategory', async (req, res) => {
  const category = await model.category.update(requireCategory(req).id, req.valid.body.name);
  res.json({ category });
});

export const deleteCategory = controller('deleteCategory', async (req, res) => {
  const category = requireCategory(req);
  await model.category.remove(category.id);
  req.log.info('category deleted', { categoryId: category.id });
  res.status(204).end();
});
