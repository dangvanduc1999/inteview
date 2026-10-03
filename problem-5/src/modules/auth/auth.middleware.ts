import type { Request, RequestHandler } from 'express';
import { cache } from '../../core/cache';
import { badRequest, conflict, unauthorized } from '../../core/http/errors';
import { model } from '../../core/model';
import { userCacheKey } from '../../core/model/user/user.model';
import { toPublicUser, type PublicUser } from './auth.service';
import type { AuthSettings } from '../types';
import { verifyAccessToken } from './token';

/** Reads `Authorization: Bearer <token>` and sets `req.auth`. */
export const authenticate =
  (secret: string): RequestHandler =>
  (req, _res, next) => {
    const [scheme, token] = (req.headers.authorization ?? '').split(' ');
    const userId = scheme === 'Bearer' && token ? verifyAccessToken(token, secret) : null;
    if (!userId) return next(unauthorized('Invalid or missing access token'));
    req.auth = { userId };
    next();
  };

/**
 * Loads the authenticated user into `req.user` (cached for `userCacheTtlSeconds`) and adds the
 * user id to the request logger. `model.user.update`/`remove` drop the cached entry, so a deleted
 * user's token stops working immediately.
 */
export const assertUser =
  ({ userCacheTtlSeconds }: Pick<AuthSettings, 'userCacheTtlSeconds'>): RequestHandler =>
  async (req, _res, next) => {
    if (!req.auth) return next(unauthorized('Not authenticated'));
    const userId = req.auth.userId;
    const user = await cache.wrap<PublicUser>(
      userCacheKey(userId),
      userCacheTtlSeconds,
      async () => {
        const row = await model.user.findById(userId);
        return row ? toPublicUser(row) : null;
      },
    );
    if (!user) return next(unauthorized('User no longer exists'));
    req.user = user;
    req.log = req.log.child({ userId: user.id });
    next();
  };

/** Registration needs an email nobody uses yet (the model still answers 409 on a race). */
export const assertEmailFree: RequestHandler = async (req, _res, next) => {
  const email = req.valid.body.email;
  if (typeof email !== 'string') return next(badRequest('email is required'));
  if (await model.user.findByEmail(email)) return next(conflict('Email is already registered'));
  next();
};

/** What `auth: true` runs, in order. */
export const authChain = (auth: AuthSettings): RequestHandler[] => [
  authenticate(auth.jwtSecret),
  assertUser(auth),
];

/** The authenticated user; fails with 401 when no auth middleware ran for this request. */
export function requireUser(req: Request): PublicUser {
  if (!req.user) throw unauthorized('Not authenticated');
  return req.user;
}
