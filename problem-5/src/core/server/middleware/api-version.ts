import type { NextFunction, Request, Response } from 'express';

const HEADER = 'x-version';

/**
 * Sets `req.apiVersion` from the `x-version` header, falling back to `defaultVersion`, and
 * adds it to the request logger. Paths in `skip` (e.g. /health) are left untouched.
 */
export function apiVersion(defaultVersion: string, skip: string[] = []) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!skip.includes(req.path)) {
      req.apiVersion = req.header(HEADER)?.trim() || defaultVersion;
      req.log = req.log.child({ version: req.apiVersion });
    }
    next();
  };
}
