import type { PaginationSettings } from '../core/http/pagination';
import type { PasswordHashParams } from './auth/password';

export interface AuthSettings {
  /** Secret: comes from the secrets file. */
  jwtSecret: string;
  accessTokenTtlSeconds: number;
  userCacheTtlSeconds: number;
  passwordMinLength: number;
  passwordMaxLength: number;
  passwordHash: PasswordHashParams;
}

/** What the modules need from configuration. */
export interface ModuleDeps {
  auth: AuthSettings;
  pagination: PaginationSettings;
}
