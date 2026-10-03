import type { Api } from '../../core/http/api';
import {
  createCategory,
  deleteCategory,
  listCategories,
  renameCategory,
} from './categories.controller';
import { assertCategoryNameFree, loadOwnCategory } from './categories.middleware';
import {
  categoryParamsSchema,
  createCategorySchema,
  updateCategorySchema,
} from './categories.schema';

const tags = ['categories'];

export function registerCategoryRoutes(api: Api): void {
  api.get({ path: '/categories', auth: true, specs: { summary: 'List my categories', tags } }, [
    listCategories,
  ]);

  api.post(
    {
      path: '/categories',
      auth: true,
      validate: createCategorySchema,
      specs: { summary: 'Create a category', tags },
    },
    [assertCategoryNameFree, createCategory],
  );

  api.patch(
    {
      path: '/categories/:id',
      auth: true,
      validate: { params: categoryParamsSchema, body: updateCategorySchema },
      specs: { summary: 'Rename my category', tags },
    },
    [loadOwnCategory, assertCategoryNameFree, renameCategory],
  );

  api.delete(
    {
      path: '/categories/:id',
      auth: true,
      validate: { params: categoryParamsSchema },
      specs: {
        summary: 'Delete my category',
        tags,
        responses: { '204': { description: 'Deleted' } },
      },
    },
    [loadOwnCategory, deleteCategory],
  );
}
