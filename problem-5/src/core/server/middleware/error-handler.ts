import type { NextFunction, Request, Response } from 'express';
import type { AppEnv } from '../../../config';

function statusOf(err: unknown): number {
  const status = (err as { status?: unknown; statusCode?: unknown } | null)?.status;
  const statusCode = (err as { statusCode?: unknown } | null)?.statusCode;
  const candidate = typeof status === 'number' ? status : statusCode;
  return typeof candidate === 'number' && candidate >= 400 && candidate <= 599 ? candidate : 500;
}

export function errorHandler(env: AppEnv) {
  return (err: unknown, req: Request, res: Response, _next: NextFunction): void => {
    const status = statusOf(err);

    if (!(err as { logged?: boolean } | null)?.logged) {
      if (status >= 500) req.log.error('request failed', { err });
      else req.log.warn('request rejected', { status, message: (err as Error)?.message });
    }

    if (res.headersSent) {
      res.destroy();
      return;
    }

    const message =
      status < 500 || env === 'local' || env === 'dev'
        ? ((err as Error)?.message ?? 'Error')
        : 'Internal Server Error';
    const { code, details } = err as { code?: unknown; details?: unknown };
    res.status(status).json({
      error: {
        message,
        ...(status < 500 && typeof code === 'string' ? { code } : {}),
        ...(status < 500 && details !== undefined ? { details } : {}),
        requestId: req.id,
      },
    });
  };
}
