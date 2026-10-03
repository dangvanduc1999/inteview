import type { Config } from '../config';
import type { ModuleDeps } from './types';

const MIN_JWT_SECRET_LENGTH = 32;

/** Reads the module settings from config; the JWT secret must come from the secrets file. */
export function moduleDepsFromConfig(config: Config): ModuleDeps {
  const jwtSecret = config.get<string | undefined>('auth.jwtSecret');
  if (!jwtSecret || jwtSecret.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(
      `auth.jwtSecret in the secrets file must be at least ${MIN_JWT_SECRET_LENGTH} characters`,
    );
  }
  return {
    auth: {
      jwtSecret,
      accessTokenTtlSeconds: config.get('auth.accessTokenTtlSeconds'),
      userCacheTtlSeconds: config.get('auth.userCacheTtlSeconds'),
      passwordMinLength: config.get('auth.passwordMinLength'),
      passwordMaxLength: config.get('auth.passwordMaxLength'),
      passwordHash: config.get('auth.passwordHash'),
    },
    pagination: config.get('pagination'),
  };
}
