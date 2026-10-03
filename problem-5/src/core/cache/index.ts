import { CoreCache } from './core-cache';

/** The process-wide cache. Call `cache.init({ ...redisConfig, logger })` once at boot. */
export const cache = new CoreCache();

export { CoreCache, type CoreCacheConfig } from './core-cache';
export { createRedis, type RedisOptions } from './redis';
