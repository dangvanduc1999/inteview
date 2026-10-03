import type { DeepPartial, Settings } from './types';

export const testConfig: DeepPartial<Settings> = {
  server: { port: 0, shutdownTimeoutMs: 2_000 },
  logger: { level: 'silent' },
  database: { name: 'db-app-test', autoMigrate: true },
  redis: { db: 1 },
};
