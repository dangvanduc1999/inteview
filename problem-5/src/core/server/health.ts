import type { Express, NextFunction, Request, Response } from 'express';
import { addConnectionCheck, exposeHealthEndpoint, resetConnectionCheck } from 'server-health';
import { withTimeout } from '../../utils/with-timeout';

export const HEALTH_PATH = '/health';
// Fields served when the full server-health payload (env, cwd, git) is not allowed.
const SAFE_FILTER = 'status,uptime,connections';

export interface HealthDeps {
  ping: Record<string, () => Promise<void>>;
  isShuttingDown: () => boolean;
  verbose: boolean;
  /** A check slower than this counts as failed. */
  checkTimeoutMs: number;
}

/** server-health requires booleans; a rejected or slow ping means "not healthy". */
function toCheck(
  name: string,
  ping: () => Promise<void>,
  timeoutMs: number,
): () => Promise<boolean> {
  return async () => {
    try {
      await withTimeout(ping(), timeoutMs, name);
      return true;
    } catch {
      return false;
    }
  };
}

/**
 * Registers dependency checks and exposes GET /health through server-health.
 * Checks are global in that library, so they are reset first to keep this idempotent.
 */
export function registerHealth(app: Express, deps: HealthDeps): void {
  resetConnectionCheck();

  for (const [name, ping] of Object.entries(deps.ping)) {
    addConnectionCheck(name, toCheck(name, ping, deps.checkTimeoutMs));
  }
  // Reports failure once shutdown begins so load balancers stop routing here.
  addConnectionCheck('accepting-traffic', () => !deps.isShuttingDown());

  if (!deps.verbose) {
    app.get(HEALTH_PATH, (req: Request, _res: Response, next: NextFunction) => {
      req.url = `${HEALTH_PATH}?filter=${SAFE_FILTER}`;
      next();
    });
  }
  exposeHealthEndpoint(app, HEALTH_PATH, 'express');
}
