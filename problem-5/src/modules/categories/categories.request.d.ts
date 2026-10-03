import type { Category } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      /** Set by `loadOwnCategory`. Read it through `requireCategory(req)`. */
      category?: Category;
    }
  }
}

export {};
