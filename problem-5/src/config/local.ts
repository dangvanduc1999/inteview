import type { DeepPartial, Settings } from './types';

export const localConfig: DeepPartial<Settings> = {
  cors: { origins: ['*'] },
  logger: { level: 'debug', pretty: true },
  health: { verbose: true },
  // Set to false to run migrations yourself with `pnpm run prisma:deploy`.
  database: { autoMigrate: true },
};
