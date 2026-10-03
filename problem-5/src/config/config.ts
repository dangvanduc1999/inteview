import type { PlainObject } from '../utils/merge';
import type { AppEnv } from './types';

export class Config {
  constructor(
    readonly env: AppEnv,
    private readonly data: PlainObject,
  ) {}

  /**
   * Reads a nested value by dot path, like lodash `get`: `config.get<number>('server.port')`.
   * Returns `defaultValue` when the path does not resolve to a value.
   */
  get<T = unknown>(path: string, defaultValue?: T): T {
    let value: unknown = this.data;
    for (const key of path.split('.')) {
      if (value === null || value === undefined) return defaultValue as T;
      value = (value as Record<string, unknown>)[key];
    }
    return (value === undefined ? defaultValue : value) as T;
  }
}
