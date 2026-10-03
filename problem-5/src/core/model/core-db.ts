import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { PrismaClient } from '@prisma/client';
import type { Logger } from '../logger/logger';

export interface DbOptions {
  host: string;
  port: number;
  user: string;
  password: string;
  name: string;
  /** Require TLS for the connection. */
  ssl: boolean;
}

const execFileAsync = promisify(execFile);

export type CoreDbConfig = DbOptions & { logger: Logger };

export function buildDbUrl(options: DbOptions): string {
  const { host, port, user, password, name, ssl } = options;
  const credentials = `${encodeURIComponent(user)}:${encodeURIComponent(password)}`;
  const url = `postgresql://${credentials}@${host}:${port}/${encodeURIComponent(name)}`;
  return ssl ? `${url}?sslmode=require` : url;
}

/** Creates a Prisma client; it connects lazily, so call `connect` to fail fast at boot. */
export function createDb({ logger, ...options }: CoreDbConfig): PrismaClient {
  const db = new PrismaClient({
    datasourceUrl: buildDbUrl(options),
    log: [
      { emit: 'event', level: 'warn' },
      { emit: 'event', level: 'error' },
    ],
  });

  db.$on('warn', (e) => logger.warn('db warning', { message: e.message, target: e.target }));
  db.$on('error', (e) => logger.error('db error', { message: e.message, target: e.target }));
  return db;
}

/**
 * Owns the database connection. Entity models read the client through `client`, so they can be
 * constructed before `init` runs.
 */
export class CoreDb {
  private db: PrismaClient | undefined;
  private url: string | undefined;
  private logger: Logger | undefined;
  private migrating: Promise<void> | undefined;

  /** Creates the client from config; call once at boot. */
  init(config: CoreDbConfig): void {
    this.db = createDb(config);
    this.url = buildDbUrl(config);
    this.logger = config.logger;
  }

  get client(): PrismaClient {
    if (!this.db) throw new Error('model.init() must be called before using models');
    return this.db;
  }

  /**
   * Applies pending migrations (`prisma migrate deploy`) to this database. Safe to call again:
   * it runs at most once per process and applied migrations are skipped. Meant for local and
   * test; other environments migrate as a deploy step (see `autoMigrateEnabled`).
   */
  migrate(): Promise<void> {
    this.migrating ??= this.runMigrations();
    return this.migrating;
  }

  private async runMigrations(): Promise<void> {
    if (!this.url) throw new Error('model.init() must be called before migrate()');
    const prismaCli = require.resolve('prisma/build/index.js');
    const schema = path.resolve(process.cwd(), 'prisma/schema.prisma');
    this.logger?.info('applying migrations');
    try {
      await execFileAsync(process.execPath, [prismaCli, 'migrate', 'deploy', '--schema', schema], {
        env: { ...process.env, DATABASE_URL: this.url },
      });
    } catch (err) {
      this.migrating = undefined;
      const output = String((err as { stderr?: string }).stderr ?? err);
      throw new Error(`prisma migrate deploy failed: ${output.trim()}`, { cause: err });
    }
    this.logger?.info('migrations applied');
  }

  async connect(): Promise<void> {
    await this.client.$connect();
  }

  async ping(): Promise<void> {
    await this.client.$queryRaw`SELECT 1`;
  }

  async close(): Promise<void> {
    await this.client.$disconnect();
  }
}
