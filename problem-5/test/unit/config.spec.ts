import { expect } from 'chai';
import { autoMigrateEnabled, buildConfig, resolveEnv } from '../../src/config';

const secrets = {
  database: { host: 'db.internal', port: 5433, user: 'svc', password: 'pw' },
  redis: { host: 'cache.internal', port: 6380 },
};

describe('config', () => {
  describe('resolveEnv', () => {
    it('requires NODE_ENV instead of guessing a default', () => {
      expect(() => resolveEnv(undefined)).to.throw(/it is not set/);
      expect(() => resolveEnv('')).to.throw(/it is not set/);
    });

    it('accepts every known environment', () => {
      for (const env of ['local', 'dev', 'stage', 'prod', 'test']) {
        expect(resolveEnv(env)).to.equal(env);
      }
    });

    it('rejects an unknown environment and lists the valid ones', () => {
      expect(() => resolveEnv('production')).to.throw(/local, dev, stage, prod, test/);
    });
  });

  describe('buildConfig', () => {
    it('starts from the default settings', () => {
      const config = buildConfig('dev', secrets);
      expect(config.get('service.name')).to.equal('problem-4');
      expect(config.get('server.port')).to.equal(3000);
      expect(config.get('database.name')).to.equal('db-app');
      expect(config.get('redis.db')).to.equal(0);
    });

    it('records the environment it was built for', () => {
      expect(buildConfig('stage', secrets).env).to.equal('stage');
    });

    it('overrides defaults with the environment file, key by key', () => {
      const config = buildConfig('local', secrets);
      expect(config.get('logger')).to.deep.equal({ level: 'debug', pretty: true });
      expect(config.get('health.verbose')).to.equal(true);
      // Untouched keys keep their default values.
      expect(config.get('server.shutdownTimeoutMs')).to.equal(10_000);
    });

    it('applies a different override per environment', () => {
      expect(buildConfig('dev', secrets).get('logger.level')).to.equal('debug');
      expect(buildConfig('prod', secrets).get('logger.level')).to.equal('info');
      expect(buildConfig('prod', secrets).get('health.verbose')).to.equal(false);
    });

    it('uses the test database and Redis DB in the test environment', () => {
      const config = buildConfig('test', secrets);
      expect(config.get('database.name')).to.equal('db-app-test');
      expect(config.get('redis.db')).to.equal(1);
      expect(config.get('logger.level')).to.equal('silent');
    });

    it('merges secrets over the settings, for every environment alike', () => {
      for (const env of ['local', 'prod', 'test'] as const) {
        const config = buildConfig(env, secrets);
        expect(config.get('database')).to.include({ host: 'db.internal', port: 5433, user: 'svc' });
        expect(config.get('redis')).to.include({ host: 'cache.internal', port: 6380 });
      }
    });

    it('keeps settings and secrets that share a section side by side', () => {
      const database = buildConfig('test', secrets).get('database');
      expect(database).to.deep.equal({
        ...secrets.database,
        name: 'db-app-test',
        ssl: false,
        autoMigrate: true,
      });
    });

    it('does not mutate the default settings between calls', () => {
      buildConfig('test', secrets);
      expect(buildConfig('dev', secrets).get('database.name')).to.equal('db-app');
    });

    describe('cors', () => {
      const headers = ['content-type', 'authorization', 'x-version', 'x-request-id'];

      it('is defined once in the default settings and allows no origin', () => {
        for (const env of ['dev', 'stage', 'prod', 'test'] as const) {
          const config = buildConfig(env, secrets);
          expect(config.get('cors.origins')).to.deep.equal([]);
          expect(config.get('cors.allowedHeaders')).to.deep.equal(headers);
          expect(config.get('cors.exposedHeaders')).to.deep.equal(['x-request-id']);
        }
      });

      it('lets an environment override only what differs', () => {
        const config = buildConfig('local', secrets);
        expect(config.get('cors.origins')).to.deep.equal(['*']);
        // Headers are not repeated in local.ts, so the default applies.
        expect(config.get('cors.allowedHeaders')).to.deep.equal(headers);
        expect(config.get('cors.exposedHeaders')).to.deep.equal(['x-request-id']);
      });
    });
  });

  describe('Config.get', () => {
    const config = buildConfig('dev', {
      ...secrets,
      featureFlags: { beta: false, list: [{ id: 7 }] },
    });

    it('reads nested values by dot path, including array indexes', () => {
      expect(config.get('server.port')).to.equal(3000);
      expect(config.get('featureFlags.list.0.id')).to.equal(7);
    });

    it('returns undefined for a missing path', () => {
      expect(config.get('server.missing')).to.equal(undefined);
      expect(config.get('nope.deeper.still')).to.equal(undefined);
    });

    it('returns the default only when the value is undefined', () => {
      expect(config.get('featureFlags.absent', true)).to.equal(true);
      expect(config.get('featureFlags.beta', true)).to.equal(false);
    });

    it('does not throw when walking through a primitive', () => {
      expect(config.get('server.port.deeper', 'd')).to.equal('d');
    });
  });

  describe('autoMigrateEnabled', () => {
    it('is on for local and test, off elsewhere by default', () => {
      expect(autoMigrateEnabled(buildConfig('local', secrets))).to.equal(true);
      expect(autoMigrateEnabled(buildConfig('test', secrets))).to.equal(true);
      for (const env of ['dev', 'stage', 'prod'] as const) {
        expect(autoMigrateEnabled(buildConfig(env, secrets))).to.equal(false);
      }
    });

    it('refuses to be turned on outside local and test', () => {
      const on = { ...secrets, database: { ...secrets.database, autoMigrate: true } };
      expect(() => autoMigrateEnabled(buildConfig('prod', on))).to.throw(
        /only allowed in local and test/,
      );
      expect(() => autoMigrateEnabled(buildConfig('dev', on))).to.throw();
    });

    it('can be turned off in local', () => {
      const off = { ...secrets, database: { ...secrets.database, autoMigrate: false } };
      expect(autoMigrateEnabled(buildConfig('local', off))).to.equal(false);
    });
  });
});
