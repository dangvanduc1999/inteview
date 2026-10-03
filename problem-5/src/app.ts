import type { Config } from './config';
import type { Logger } from './core/logger/logger';
import { HttpServer, type HttpServerOptions } from './core/server/http-server';
import { authChain } from './modules/auth/auth.middleware';
import { registerModules } from './modules';
import { moduleDepsFromConfig } from './modules/settings';

export { HttpServer } from './core/server/http-server';

/** The live dependencies the app runs against. */
export interface RuntimeDeps {
  logger: Logger;
  /** Redis health check, normally `() => cache.ping()`. */
  pingRedis: () => Promise<void>;
  /** Database health check, normally `model.ping`. */
  pingDb: () => Promise<void>;
  isShuttingDown: () => boolean;
}

/**
 * Builds the HTTP server from configuration: every non-secret setting is read from `config`.
 * `overrides` replaces whole options (used by tests).
 */
export function createApp(
  config: Config,
  runtime: RuntimeDeps,
  overrides: Partial<HttpServerOptions> = {},
): HttpServer {
  const modules = moduleDepsFromConfig(config);
  return new HttpServer({
    env: config.env,
    logger: runtime.logger,
    serviceName: config.get('service.name'),
    defaultVersion: config.get('server.defaultVersion'),
    bodyLimit: config.get('server.bodyLimit'),
    apiPrefix: config.get('server.apiPrefix'),
    openApiPath: config.get('server.openApiPath'),
    docsPath: config.get('server.docsPath'),
    cors: {
      origins: config.get('cors.origins'),
      allowedHeaders: config.get('cors.allowedHeaders'),
      exposedHeaders: config.get('cors.exposedHeaders'),
    },
    health: {
      verbose: config.get('health.verbose'),
      checkTimeoutMs: config.get('health.checkTimeoutMs'),
      ping: { db: runtime.pingDb, redis: runtime.pingRedis },
      isShuttingDown: runtime.isShuttingDown,
    },
    authChain: authChain(modules.auth),
    registerRoutes: (api) => registerModules(api, modules),
    ...overrides,
  });
}
