import type { LogLevel } from '../core/logger/logger';

export const APP_ENVS = ['local', 'dev', 'stage', 'prod', 'test'] as const;
export type AppEnv = (typeof APP_ENVS)[number];

/** Non-sensitive settings, defined in code and overridden per environment. */
export interface Settings {
  service: { name: string };
  server: {
    port: number;
    shutdownTimeoutMs: number;
    keepAliveTimeoutMs: number;
    headersTimeoutMs: number;
    /** Used when a request has no `x-version` header. */
    defaultVersion: string;
    /** Max JSON request body size, as understood by `express.json`. */
    bodyLimit: string;
    /** Prefix for all API routes. */
    apiPrefix: string;
    /** Path of the generated OpenAPI document, relative to `apiPrefix`. */
    openApiPath: string;
    /** Path of the Redoc API docs page, relative to `apiPrefix`. */
    docsPath: string;
  };
  pagination: { defaultLimit: number; maxLimit: number };
  cors: {
    /** Allowed origins; `['*']` allows any origin, `[]` allows none. */
    origins: string[];
    /** Request headers browsers may send. */
    allowedHeaders: string[];
    /** Response headers browsers may read. */
    exposedHeaders: string[];
  };
  auth: {
    accessTokenTtlSeconds: number;
    /** How long the authenticated user is cached, so most requests skip the database lookup. */
    userCacheTtlSeconds: number;
    passwordMinLength: number;
    passwordMaxLength: number;
    /** scrypt parameters for new password hashes (stored hashes carry their own cost). */
    passwordHash: { cost: number; keyLength: number; saltBytes: number };
  };
  logger: { level: LogLevel; pretty: boolean };
  featureFlags: Record<string, unknown>;
  health: {
    verbose: boolean;
    /** A dependency check slower than this counts as failed. */
    checkTimeoutMs: number;
  };
  database: {
    name: string;
    /** Require TLS (`sslmode=require`) for the database connection. */
    ssl: boolean;
    /** Apply pending migrations at boot. Only allowed in the `local` and `test` environments. */
    autoMigrate: boolean;
  };
  redis: {
    db: number;
    /** Connect to Redis over TLS. */
    tls: boolean;
  };
}

/** Sensitive values, loaded from the secrets file; identical for every environment. */
export interface Secrets {
  database: { host: string; port: number; user: string; password: string };
  redis: { host: string; port: number; password?: string };
  auth: { jwtSecret: string };
}

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Record<string, unknown> ? DeepPartial<T[K]> : T[K];
};
