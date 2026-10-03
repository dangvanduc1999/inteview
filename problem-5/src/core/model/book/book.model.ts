import type { Prisma } from '@prisma/client';
import { badRequest, notFound } from '../../http/errors';
import type { CoreDb } from '../core-db';
import { isMissingRelation, translateDbErrors } from '../db-errors';

// Soft-deleted books are invisible to the rest of the app: every read and write below filters on it.
const notDeleted = { deletedAt: null } as const;

const include = {
  categories: { select: { id: true, name: true }, orderBy: { name: 'asc' } },
  owner: { select: { id: true, name: true } },
} satisfies Prisma.BookInclude;

/** A book with its categories and owner, as returned by the model. */
export type BookWithRelations = Prisma.BookGetPayload<{ include: typeof include }>;

export interface BookFields {
  title: string;
  author: string;
  description?: string | null;
  isbn?: string | null;
  publishedYear?: number | null;
}

export interface BookFilter {
  ownerId: string;
  q?: string;
  categoryId?: string;
  publishedYear?: number;
  sortBy: 'createdAt' | 'title' | 'publishedYear';
  order: 'asc' | 'desc';
  skip: number;
  take: number;
}

/** Makes `%`, `_` and `\` match literally in a LIKE pattern (Prisma's `contains` does not). */
const escapeLike = (text: string) => text.replace(/[\\%_]/g, '\\$&');

const unknownCategories = () => badRequest('Unknown categoryIds');
const bookNotFound = () => notFound('Book not found');

export class BookModel {
  constructor(private readonly core: CoreDb) {}

  create(ownerId: string, data: BookFields, categoryIds: string[]) {
    return translateDbErrors(
      this.core.client.book.create({
        data: { ...data, ownerId, categories: { connect: categoryIds.map((id) => ({ id })) } },
        include,
      }),
      { P2025: unknownCategories },
    );
  }

  update(id: string, data: Partial<BookFields>, categoryIds?: string[]) {
    return translateDbErrors(
      this.core.client.book.update({
        where: { id, ...notDeleted },
        data: {
          ...data,
          ...(categoryIds ? { categories: { set: categoryIds.map((cid) => ({ id: cid })) } } : {}),
        },
        include,
      }),
      { P2025: (err) => (isMissingRelation(err) ? unknownCategories() : bookNotFound()) },
    );
  }

  softDelete(id: string) {
    return translateDbErrors(
      this.core.client.book.update({
        where: { id, ...notDeleted },
        data: { deletedAt: new Date() },
      }),
      { P2025: bookNotFound },
    );
  }

  findById(id: string) {
    return this.core.client.book.findFirst({ where: { id, ...notDeleted }, include });
  }

  async list(f: BookFilter) {
    const db = this.core.client;
    const where: Prisma.BookWhereInput = {
      ...notDeleted,
      ownerId: f.ownerId,
      ...(f.publishedYear !== undefined ? { publishedYear: f.publishedYear } : {}),
      ...(f.categoryId ? { categories: { some: { id: f.categoryId } } } : {}),
      ...(f.q
        ? {
            OR: [
              { title: { contains: escapeLike(f.q), mode: 'insensitive' } },
              { author: { contains: escapeLike(f.q), mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await db.$transaction([
      db.book.findMany({
        where,
        include,
        orderBy: [{ [f.sortBy]: f.order }, { id: 'asc' }],
        skip: f.skip,
        take: f.take,
      }),
      db.book.count({ where }),
    ]);
    return { items, total };
  }
}
