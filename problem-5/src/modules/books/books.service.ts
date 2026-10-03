import { buildMeta, toSkipTake } from '../../core/http/pagination';
import { model } from '../../core/model';
import type { BookWithRelations } from '../../core/model/book/book.model';
import type { CreateBookInput, ListBooksQuery, UpdateBookInput } from './books.schema';

// The rules (ownership, categories) are middleware on the routes; this only shapes the calls.

export function create(ownerId: string, input: CreateBookInput) {
  const { categoryIds, ...fields } = input;
  return model.book.create(ownerId, fields, categoryIds);
}

export async function list(ownerId: string, query: ListBooksQuery) {
  const { items, total } = await model.book.list({ ownerId, ...query, ...toSkipTake(query) });
  return { data: items, meta: buildMeta(total, query) };
}

export function update(book: BookWithRelations, input: UpdateBookInput) {
  const { categoryIds, ...fields } = input;
  return model.book.update(book.id, fields, categoryIds);
}

export async function remove(book: BookWithRelations): Promise<void> {
  await model.book.softDelete(book.id);
}
