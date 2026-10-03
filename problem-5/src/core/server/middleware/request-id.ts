import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { Logger } from '../../logger/logger';

const HEADER = 'x-request-id';
// Only trust inbound ids that are short and printable, so they are safe to log and echo.
const SAFE_ID = /^[\w.-]{1,128}$/;

export function requestId(logger: Logger) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const inbound = req.header(HEADER);
    req.id = inbound && SAFE_ID.test(inbound) ? inbound : randomUUID();
    req.log = logger.child({ requestId: req.id });
    res.setHeader(HEADER, req.id);
    next();
  };
}
