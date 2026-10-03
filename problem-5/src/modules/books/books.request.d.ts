import type { BookWithRelations } from '../../core/model/book/book.model';

declare global {
  namespace Express {
    interface Request {
      /** Set by `loadBook`. Read it through `requireBook(req)`. */
      book?: BookWithRelations;
    }
  }
}

export {};
