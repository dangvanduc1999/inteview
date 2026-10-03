import { expect } from 'chai';
import { createRedis } from '../../src/core/cache';
import { buildConfig } from '../../src/config';
import { buildDbUrl, type DbOptions } from '../../src/core/model/core-db';
import { Logger } from '../../src/core/logger/logger';

const secrets = {
  database: { host: 'db.internal', port: 5432, user: 'svc', password: 'pw' },
  redis: { host: 'cache.internal', port: 6379 },
};

describe('TLS settings', () => {
  describe('per environment', () => {
    it('are off by default, so local, dev and test connect without TLS', () => {
      for (const env of ['local', 'dev', 'test'] as const) {
        const config = buildConfig(env, secrets);
        expect(config.get('database.ssl')).to.equal(false);
        expect(config.get('redis.tls')).to.equal(false);
      }
    });

    it('are overridden to on for stage and prod', () => {
      for (const env of ['stage', 'prod'] as const) {
        const config = buildConfig(env, secrets);
        expect(config.get('database.ssl')).to.equal(true);
        expect(config.get('redis.tls')).to.equal(true);
      }
    });
  });

  describe('buildDbUrl', () => {
    const options: DbOptions = {
      host: 'db.internal',
      port: 5432,
      user: 'svc',
      password: 'p@ss/w:rd',
      name: 'db-app',
      ssl: false,
    };

    it('builds a plain connection url and encodes credentials', () => {
      expect(buildDbUrl(options)).to.equal(
        'postgresql://svc:p%40ss%2Fw%3Ard@db.internal:5432/db-app',
      );
    });

    it('requires TLS when ssl is true', () => {
      expect(buildDbUrl({ ...options, ssl: true })).to.equal(
        'postgresql://svc:p%40ss%2Fw%3Ard@db.internal:5432/db-app?sslmode=require',
      );
    });
  });

  describe('createRedis', () => {
    const base = { host: 'cache.internal', port: 6379, db: 0 };
    const logger = new Logger({ level: 'silent' });

    it('enables TLS when tls is true', () => {
      const redis = createRedis({ ...base, tls: true }, logger);
      expect(redis.options.tls).to.deep.equal({});
      redis.disconnect();
    });

    it('does not use TLS when tls is false', () => {
      const redis = createRedis({ ...base, tls: false }, logger);
      expect(redis.options.tls).to.equal(undefined);
      redis.disconnect();
    });
  });
});
