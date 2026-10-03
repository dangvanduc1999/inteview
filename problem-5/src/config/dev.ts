import type { DeepPartial, Settings } from './types';

export const devConfig: DeepPartial<Settings> = {
  logger: { level: 'debug' },
};
