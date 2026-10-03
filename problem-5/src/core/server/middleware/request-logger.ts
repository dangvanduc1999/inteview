import type { NextFunction, Request, Response } from 'express';

/** Logs a `request` event on arrival and a `response` event when the exchange ends. */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startedAt = process.hrtime.bigint();
  const path = req.originalUrl.split('?')[0];

  req.log.info('request', {
    method: req.method,
    path,
    ip: req.ip,
    userAgent: req.header('user-agent'),
  });

  // `close` fires for every exchange, including ones the client aborted.
  res.on('close', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    req.log.info('response', {
      method: req.method,
      path,
      status: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
      ...(!res.writableFinished && { aborted: true }),
    });
  });
  next();
}
