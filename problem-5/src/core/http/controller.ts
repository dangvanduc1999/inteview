import type { RequestHandler, Response } from 'express';
import type { ValidatedRequest } from './validate';

export type ControllerFn<B, Q, P> = (req: ValidatedRequest<B, Q, P>, res: Response) => unknown;

/**
 * Wraps a controller body in the standard try/catch with logging, so every controller
 * logs the same way and failures reach the error middleware:
 * - success: `info` "<name> ok";
 * - failure: `warn` (client errors) or `error` (5xx) "<name> failed", then `next(err)`.
 * The error is marked as logged so the error middleware does not log it a second time.
 * `req.log` already carries the request id (and the user id, once the user is loaded).
 *
 * Type the validated input with `controller<Body, Query, Params>(...)`, using the same types
 * as the route's Joi schemas.
 */
export function controller<
  B = Record<string, unknown>,
  Q = Record<string, unknown>,
  P = Record<string, string>,
>(name: string, fn: ControllerFn<B, Q, P>): RequestHandler {
  return async (req, res, next) => {
    req.log.debug(`${name} started`);
    try {
      await fn(req as ValidatedRequest<B, Q, P>, res);
      req.log.info(`${name} ok`, { status: res.statusCode });
    } catch (err) {
      const status = (err as { status?: unknown } | null)?.status;
      const clientError = typeof status === 'number' && status >= 400 && status < 500;
      if (clientError) req.log.warn(`${name} failed`, { status, message: (err as Error).message });
      else req.log.error(`${name} failed`, { err });
      if (err !== null && typeof err === 'object') (err as { logged?: boolean }).logged = true;
      next(err);
    }
  };
}
