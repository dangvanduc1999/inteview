import { expect } from 'chai';
import { CoreDb } from '../../src/core/model/core-db';
import { Logger } from '../../src/core/logger/logger';
import { model } from '../../src/core/model';
import { openInfra, type Infra } from './support';

describe('db (prisma)', () => {
  let infra: Infra;

  before(async () => {
    infra = await openInfra();
  });
  after(async () => {
    await infra.close();
  });

  it('connects to the test database, not the app database', async () => {
    const rows = await infra.db.$queryRaw<Array<{ db: string }>>`SELECT current_database() AS db`;
    expect(rows[0]?.db).to.equal('db-app-test');
  });

  it('applies migrations (idempotent), so the app tables exist', async () => {
    await model.migrate();
    const rows = await infra.db.$queryRaw<Array<{ name: string }>>`
      SELECT table_name AS name FROM information_schema.tables WHERE table_schema = 'public'`;
    expect(rows.map((r) => r.name)).to.include.members(['users', 'categories', 'books']);
  });

  it('answers a ping', async () => {
    await model.ping();
  });

  it('rejects an unreachable database instead of hanging', async () => {
    const wrong = new CoreDb();
    wrong.init({ ...infra.dbOptions, port: 1, logger: new Logger({ level: 'silent' }) });
    try {
      let failed = false;
      try {
        await wrong.connect();
      } catch {
        failed = true;
      }
      expect(failed).to.equal(true);
    } finally {
      await wrong.close();
    }
  });
});
