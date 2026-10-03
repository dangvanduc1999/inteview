import type { PublicUser } from './auth.service';

declare global {
  namespace Express {
    interface Request {
      /** Set by `authenticate`. Read the user through `requireUser(req)`. */
      auth?: { userId: string };
      /** Set by `assertUser`. Read it through `requireUser(req)`. */
      user?: PublicUser;
    }
  }
}

export {};
