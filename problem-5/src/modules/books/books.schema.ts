import Joi from 'joi';
import { paginationKeys, type PaginationSettings } from '../../core/http/pagination';

export interface CreateBookInput {
  title: string;
  author: string;
  description?: string | null;
  isbn?: string | null;
  publishedYear?: number | null;
  categoryIds: string[];
}

export type UpdateBookInput = Partial<CreateBookInput>;

export interface BookParams {
  id: string;
}

export interface ListBooksQuery {
  page: number;
  limit: number;
  q?: string;
  categoryId?: string;
  publishedYear?: number;
  sortBy: 'createdAt' | 'title' | 'publishedYear';
  order: 'asc' | 'desc';
}

const title = Joi.string().trim().min(1).max(200);
const author = Joi.string().trim().min(1).max(200);
const description = Joi.string().trim().max(2000).allow(null);
const isbn = Joi.string().trim().max(20).allow(null);
// The same bounds apply to the filter, so an out-of-range year is a 400, not a database error.
const year = Joi.number().integer().min(0).max(9999);
const categoryIds = Joi.array().items(Joi.string().uuid()).min(1).max(10).unique();

export const createBookSchema = Joi.object<CreateBookInput>({
  title: title.required(),
  author: author.required(),
  description,
  isbn,
  publishedYear: year.allow(null),
  categoryIds: categoryIds.required(),
});

export const updateBookSchema = Joi.object<UpdateBookInput>({
  title,
  author,
  description,
  isbn,
  publishedYear: year.allow(null),
  categoryIds,
}).min(1);

export const bookParamsSchema = Joi.object<BookParams>({ id: Joi.string().uuid().required() });

export const listBooksQuerySchema = (pagination: PaginationSettings) =>
  Joi.object<ListBooksQuery>({
    ...paginationKeys(pagination),
    q: Joi.string().trim().max(100),
    categoryId: Joi.string().uuid(),
    publishedYear: year,
    sortBy: Joi.string().valid('createdAt', 'title', 'publishedYear').default('createdAt'),
    order: Joi.string().valid('asc', 'desc').default('desc'),
  });
