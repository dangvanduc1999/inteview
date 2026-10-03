import type { Category } from '@prisma/client';
import type { Request, RequestHandler } from 'express';
import { badRequest, conflict, internal, notFound } from '../../core/http/errors';
import { model } from '../../core/model';
import { requireUser } from '../auth/auth.middleware';

/**
 * Loads the category named by `:id` into `req.category`. Categories are private to their owner,
 * so someone else's id looks like a missing one.
 */
export const loadOwnCategory: RequestHandler = async (req, _res, next) => {
  const id = req.valid.params.id;
  if (!id) return next(badRequest('Category id is required'));
  const category = await model.category.findById(id);
  if (!category || category.ownerId !== requireUser(req).id) {
    return next(notFound('Category not found'));
  }
  req.category = category;
  next();
};

/**
 * The user must not already have a category with this name (ignoring case). On rename, run it
 * after `loadOwnCategory`, so keeping the same name is allowed.
 */
export const assertCategoryNameFree: RequestHandler = async (req, _res, next) => {
  const name = req.valid.body.name;
  if (typeof name !== 'string') return next(badRequest('name is required'));
  const existing = await model.category.findByName(requireUser(req).id, name);
  if (existing && existing.id !== req.category?.id) {
    return next(conflict('Category name already exists'));
  }
  next();
};

/** The category loaded by `loadOwnCategory`; fails when the route does not run that middleware. */
export function requireCategory(req: Request): Category {
  if (!req.category) throw internal('loadOwnCategory middleware did not run for this route');
  return req.category;
}
