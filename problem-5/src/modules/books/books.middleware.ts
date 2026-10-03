import type { Request, RequestHandler } from 'express';
import { badRequest, forbidden, internal, notFound } from '../../core/http/errors';
import { model } from '../../core/model';
import type { BookWithRelations } from '../../core/model/book/book.model';
import { requireUser } from '../auth/auth.middleware';

/** Loads the (not deleted) book named by `:id` into `req.book`; anyone may read it. */
export const loadBook: RequestHandler = async (req, _res, next) => {
  const id = req.valid.params.id;
  if (!id) return next(badRequest('bookID is required'));
  const book = await model.book.findById(id);
  if (!book) return next(notFound('book not found'));
  req.book = book;
  next();
};

/** Only the owner may change a book. Run after `loadBook`. */
export const assertBookOwner: RequestHandler = (req, _res, next) => {
  if (requireBook(req).ownerId !== requireUser(req).id) {
    return next(forbidden('Only the owner can change this book'));
  }
  next();
};

/**
 * Every id in `body.categoryIds` must be a category of the current user (skipped when the body
 * has none). On update, run it after `assertBookOwner`, so the user is the book's owner.
 */
export const assertOwnCategories: RequestHandler = async (req, _res, next) => {
  const ids = req.valid.body.categoryIds;
  if (!Array.isArray(ids)) return next();
  const found = await model.category.findByIds(requireUser(req).id, ids);
  if (found.length !== ids.length) return next(badRequest('Unknown categoryIds'));
  next();
};

/** The book loaded by `loadBook`; fails when the route does not run that middleware. */
export function requireBook(req: Request): BookWithRelations {
  if (!req.book) throw internal('loadBook middleware did not run for this route');
  return req.book;
}
