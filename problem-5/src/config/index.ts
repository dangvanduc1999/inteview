import { deepMerge, type PlainObject } from '../utils/merge';
import { readSecrets } from '../utils/read-secrets';
import { Config } from './config';
import { defaultConfig } from './default';
import { devConfig } from './dev';
import { localConfig } from './local';
import { prodConfig } from './prod';
import { stageConfig } from './stage';
import { testConfig } from './test';
import { APP_ENVS, type AppEnv, type DeepPartial, type Settings } from './types';

export { Config } from './config';
export type { AppEnv, Secrets, Settings } from './types';

const ENV_OVERRIDES: Record<AppEnv, DeepPartial<Settings>> = {
  local: localConfig,
  dev: devConfig,
  stage: stageConfig,
  prod: prodConfig,
  test: testConfig,
};

/**
 * Picks the override file for NODE_ENV. It must be set explicitly: guessing a default could
 * start a production process with the permissive `local` settings.
 */
export function resolveEnv(raw: string | undefined): AppEnv {
  if ((APP_ENVS as readonly string[]).includes(raw ?? '')) return raw as AppEnv;
  const got = raw ? `got "${raw}"` : 'it is not set';
  throw new Error(`NODE_ENV must be one of ${APP_ENVS.join(', ')} (${got})`);
}

/**
 * Deep-merges, in order: default settings, the environment's overrides, then secrets
 * (which are not split by environment). Read values with `config.get('path.to.value')`.
 */
export function buildConfig(env: AppEnv, secrets: PlainObject): Config {
  const withEnv = deepMerge(
    defaultConfig as unknown as PlainObject,
    ENV_OVERRIDES[env] as PlainObject,
  );
  return new Config(env, deepMerge(withEnv, secrets));
}

export function loadConfig(): Config {
  return buildConfig(resolveEnv(process.env.NODE_ENV), readSecrets());
}

const AUTO_MIGRATE_ENVS: readonly AppEnv[] = ['local', 'test'];

/**
 * Whether to apply migrations at boot (`database.autoMigrate`). Turning it on outside `local`
 * and `test` is refused: other environments run `prisma migrate deploy` as a deploy step.
 */
export function autoMigrateEnabled(config: Config): boolean {
  const enabled = config.get<boolean>('database.autoMigrate', false);
  if (enabled && !AUTO_MIGRATE_ENVS.includes(config.env)) {
    throw new Error(
      `database.autoMigrate is only allowed in ${AUTO_MIGRATE_ENVS.join(' and ')}, not "${config.env}"`,
    );
  }
  return enabled;
}
