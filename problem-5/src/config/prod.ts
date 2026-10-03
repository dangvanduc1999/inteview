import type { DeepPartial, Settings } from './types';

export const prodConfig: DeepPartial<Settings> = {
  logger: { level: 'info' },
  database: { ssl: true },
  redis: { tls: true },
};
