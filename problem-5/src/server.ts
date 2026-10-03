import type { AddressInfo } from 'node:net';
import { createApp, type HttpServer } from './app';
import { autoMigrateEnabled, loadConfig } from './config';
import { cache } from './core/cache';
import { Logger, type LogLevel } from './core/logger/logger';
import { registerGracefulShutdown } from './core/server/shutdown';
import { model } from './core/model';
import { moduleDepsFromConfig } from './modules/settings';

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = new Logger({
    level: config.get<LogLevel>('logger.level'),
    pretty: config.get<boolean>('logger.pretty'),
    bindings: { service: config.get<string>('service.name') },
  });

  // Fail before connecting to anything when the settings or secrets are unusable.
  moduleDepsFromConfig(config);
  const autoMigrate = autoMigrateEnabled(config);

  model.init({
    host: config.get('database.host'),
    port: config.get('database.port'),
    user: config.get('database.user'),
    password: config.get('database.password'),
    name: config.get('database.name'),
    ssl: config.get('database.ssl'),
    logger,
  });
  cache.init({
    host: config.get('redis.host'),
    port: config.get('redis.port'),
    password: config.get('redis.password'),
    db: config.get('redis.db'),
    tls: config.get('redis.tls'),
    logger,
  });

  // The app only needs to know whether shutdown has begun; the handle is assigned below.
  let shuttingDown = (): boolean => false;
  let httpServer: HttpServer;
  let server: Awaited<ReturnType<HttpServer['listen']>>;

  // Fail fast: an unreachable dependency or a port that cannot be bound stops the boot.
  try {
    if (autoMigrate) await model.migrate();
    await Promise.all([
      model.connect().then(() => model.ping()),
      cache.connect().then(() => cache.ping()),
    ]);
    logger.info('dependencies ready');

    httpServer = createApp(config, {
      logger,
      pingDb: model.ping,
      pingRedis: () => cache.ping(),
      isShuttingDown: () => shuttingDown(),
    });
    server = await httpServer.listen({
      port: config.get<number>('server.port'),
      keepAliveTimeoutMs: config.get<number>('server.keepAliveTimeoutMs'),
      headersTimeoutMs: config.get<number>('server.headersTimeoutMs'),
    });
  } catch (err) {
    logger.error('startup failed', { err });
    await Promise.allSettled([model.close(), cache.close()]);
    process.exit(1);
  }
  logger.info('server listening', {
    port: (server.address() as AddressInfo).port,
    env: config.env,
  });

  shuttingDown = registerGracefulShutdown({
    server,
    logger,
    timeoutMs: config.get<number>('server.shutdownTimeoutMs'),
    closers: [
      { name: 'db', close: () => model.close() },
      { name: 'redis', close: () => cache.close() },
    ],
  });
}

main().catch((err: unknown) => {
  process.stderr.write(`fatal: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
