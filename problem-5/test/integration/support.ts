import type { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';
import type { Express } from 'express';
import request from 'supertest';
import { createApp } from '../../src/app';
import { cache } from '../../src/core/cache';
import { autoMigrateEnabled, buildConfig, loadConfig } from '../../src/config';
import { Logger } from '../../src/core/logger/logger';
import { model, type DbOptions } from '../../src/core/model';
import { deepMerge, type PlainObject } from '../../src/utils/merge';
import { readSecrets } from '../../src/utils/read-secrets';

export interface Infra {
  dbOptions: DbOptions;
  /** The client behind `model`, for raw queries in tests. */
  db: PrismaClient;
  redis: Redis;
  cache: typeof cache;
  close: () => Promise<void>;
}

/** Connects using the `test` environment config (db-app-test, Redis DB 1) and secrets.json. */
export async function openInfra(): Promise<Infra> {
  const config = loadConfig();
  const logger = new Logger({ level: 'silent' });

  const dbOptions: DbOptions = {
    host: config.get('database.host'),
    port: config.get('database.port'),
    user: config.get('database.user'),
    password: config.get('database.password'),
    name: config.get('database.name'),
    ssl: config.get('database.ssl'),
  };
  model.init({ ...dbOptions, logger });
  cache.init({
    host: config.get('redis.host'),
    port: config.get('redis.port'),
    password: config.get('redis.password'),
    db: config.get('redis.db'),
    tls: config.get('redis.tls'),
    logger,
  });
  if (autoMigrateEnabled(config)) await model.migrate();
  await model.connect();
  await cache.connect();
  return {
    dbOptions,
    db: model.core.client,
    redis: cache.client,
    cache,
    close: async () => {
      await Promise.allSettled([model.close(), cache.close()]);
    },
  };
}

/**
 * Full app wired to the test database and Redis, for API tests. `config` overrides settings
 * (merged last, like secrets); `pingRedis` and `shuttingDown` replace the live dependencies.
 */
export function buildTestApp(
  infra: Infra,
  opts: { config?: PlainObject; pingRedis?: () => Promise<void>; shuttingDown?: boolean } = {},
): Express {
  const config = buildConfig('test', deepMerge(readSecrets(), opts.config ?? {}));
  return createApp(config, {
    logger: new Logger({ level: 'silent' }),
    pingDb: model.ping,
    pingRedis: opts.pingRedis ?? (() => infra.cache.ping()),
    isShuttingDown: () => opts.shuttingDown ?? false,
  }).app;
}

/** Registers a user through the API and returns its token and an `Authorization` header value. */
export async function registerUser(app: Express, email: string, name = 'Test User') {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password: 'password123', name })
    .expect(201);
  return { id: res.body.user.id as string, auth: `Bearer ${res.body.accessToken as string}` };
}

/** Empties the app tables between tests. */
export async function resetData(db: PrismaClient): Promise<void> {
  await db.$executeRawUnsafe('TRUNCATE "books", "categories", "users" CASCADE');
}
