import type { Settings } from './types';

export const defaultConfig: Settings = {
  service: { name: 'problem-4' },
  server: {
    port: 3000,
    shutdownTimeoutMs: 10_000,
    keepAliveTimeoutMs: 65_000,
    headersTimeoutMs: 66_000,
    defaultVersion: '0.1.0',
    bodyLimit: '100kb',
    apiPrefix: '/api',
    openApiPath: '/openapi.json',
    docsPath: '/docs',
  },
  pagination: { defaultLimit: 20, maxLimit: 100 },
  cors: {
    origins: [],
    allowedHeaders: ['content-type', 'authorization', 'x-version', 'x-request-id'],
    exposedHeaders: ['x-request-id'],
  },
  auth: {
    accessTokenTtlSeconds: 3600,
    userCacheTtlSeconds: 60,
    passwordMinLength: 8,
    passwordMaxLength: 72,
    passwordHash: { cost: 16384, keyLength: 64, saltBytes: 16 },
  },
  logger: { level: 'info', pretty: false },
  featureFlags: {},
  health: { verbose: false, checkTimeoutMs: 2000 },
  database: { name: 'db-app', ssl: false, autoMigrate: false },
  redis: { db: 0, tls: false },
};
