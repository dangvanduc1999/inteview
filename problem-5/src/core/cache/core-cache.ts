import type { Redis } from 'ioredis';
import type { Logger } from '../logger/logger';
import { closeRedis, connectRedis, createRedis, pingRedis, type RedisOptions } from './redis';

export type CoreCacheConfig = RedisOptions & { logger: Logger };

/**
 * Owns the Redis connection and offers a small JSON cache on top of it. Cache reads and writes
 * never fail the caller: when Redis is unavailable, `wrap` simply runs the loader.
 */
export class CoreCache {
  private redis: Redis | undefined;
  private logger: Logger | undefined;

  /** Creates the client from config; call once at boot. */
  init({ logger, ...options }: CoreCacheConfig): void {
    this.logger = logger;
    this.redis = createRedis(options, logger);
  }

  get client(): Redis {
    if (!this.redis) throw new Error('cache.init() must be called before using the cache');
    return this.redis;
  }

  connect(): Promise<void> {
    return connectRedis(this.client);
  }

  ping(): Promise<void> {
    return pingRedis(this.client);
  }

  close(): Promise<void> {
    return closeRedis(this.client);
  }

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.client.get(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  /** Drops a key after the data behind it changed. Never throws: the TTL bounds staleness if Redis is down. */
  async invalidate(key: string): Promise<void> {
    try {
      await this.del(key);
    } catch (err) {
      this.logger?.warn('cache invalidation failed', { key, err });
    }
  }

  /**
   * Returns the cached value for `key`, or runs `loader`, caches a non-null result for
   * `ttlSeconds` and returns it. `null` results are not cached.
   */
  async wrap<T>(
    key: string,
    ttlSeconds: number,
    loader: () => Promise<T | null>,
  ): Promise<T | null> {
    try {
      const hit = await this.get<T>(key);
      if (hit !== null) return hit;
    } catch (err) {
      this.logger?.warn('cache read failed', { key, err });
    }

    const value = await loader();
    if (value !== null) {
      try {
        await this.set(key, value, ttlSeconds);
      } catch (err) {
        this.logger?.warn('cache write failed', { key, err });
      }
    }
    return value;
  }
}
