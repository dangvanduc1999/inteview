import { Redis } from 'ioredis';
import type { Logger } from '../logger/logger';

export interface RedisOptions {
  host: string;
  port: number;
  password?: string;
  /** Logical database index. */
  db: number;
  /** Connect over TLS, verifying the server certificate. */
  tls: boolean;
}

export function createRedis(options: RedisOptions, logger: Logger): Redis {
  const { host, port, password, db, tls } = options;
  const redis = new Redis({
    host,
    port,
    password,
    db,
    ...(tls && { tls: {} }),
    lazyConnect: true,
    maxRetriesPerRequest: 2,
    retryStrategy: (attempt) => Math.min(attempt * 200, 2_000),
  });

  redis.on('error', (err) => logger.error('redis error', { err }));
  redis.on('reconnecting', () => logger.warn('redis reconnecting'));
  return redis;
}

export async function connectRedis(redis: Redis): Promise<void> {
  // lazyConnect clients start in "wait"; any other status means a connect is already underway.
  if (redis.status === 'wait') await redis.connect();
}

export async function pingRedis(redis: Redis): Promise<void> {
  const reply = await redis.ping();
  if (reply !== 'PONG') throw new Error(`unexpected redis ping reply: ${reply}`);
}

export async function closeRedis(redis: Redis): Promise<void> {
  try {
    await redis.quit();
  } catch {
    redis.disconnect();
  }
}
