import type { Validated } from '../core/http/validate';
import type { Logger } from '../core/logger/logger';

// Only what the core itself sets. Modules add their own fields (`user`, `book`, ...) next to
// their middleware, as optional properties.
declare global {
  namespace Express {
    interface Request {
      id: string;
      log: Logger;
      /** From the `x-version` header, or the configured default; unset for /health. */
      apiVersion?: string;
      /** Joi-cleaned request parts; see `Validated` and `controller<Body, Query, Params>()`. */
      valid: Validated;
    }
  }
}

export {};
