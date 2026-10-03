import type { Api } from '../../core/http/api';
import type { ModuleDeps } from '../types';
import { createBook, deleteBook, getBook, listMyBooks, updateBook } from './books.controller';
import { assertBookOwner, assertOwnCategories, loadBook } from './books.middleware';
import {
  bookParamsSchema,
  createBookSchema,
  listBooksQuerySchema,
  updateBookSchema,
} from './books.schema';

const tags = ['books'];

export function registerBookRoutes(api: Api, { pagination }: ModuleDeps): void {
  api.post(
    {
      path: '/books',
      auth: true,
      validate: createBookSchema,
      specs: { summary: 'Create a book', tags },
    },
    [assertOwnCategories, createBook],
  );

  api.get(
    {
      path: '/books',
      auth: true,
      validate: { query: listBooksQuerySchema(pagination) },
      specs: { summary: 'List my books (filter, sort, paginate)', tags },
    },
    [listMyBooks],
  );

  api.get(
    {
      path: '/books/:id',
      auth: true,
      validate: { params: bookParamsSchema },
      specs: { summary: 'Get any book by id', tags },
    },
    [loadBook, getBook],
  );

  api.patch(
    {
      path: '/books/:id',
      auth: true,
      validate: { params: bookParamsSchema, body: updateBookSchema },
      specs: { summary: 'Update my book', tags },
    },
    [loadBook, assertBookOwner, assertOwnCategories, updateBook],
  );

  api.delete(
    {
      path: '/books/:id',
      auth: true,
      validate: { params: bookParamsSchema },
      specs: {
        summary: 'Delete my book',
        tags,
        responses: { '204': { description: 'Deleted' } },
      },
    },
    [loadBook, assertBookOwner, deleteBook],
  );
}
