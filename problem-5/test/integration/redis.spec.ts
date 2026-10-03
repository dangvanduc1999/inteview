import { expect } from 'chai';
import { openInfra, type Infra } from './support';

describe('redis', () => {
  let infra: Infra;

  before(async () => {
    infra = await openInfra();
  });
  afterEach(async () => {
    // Flushes only the selected logical database (DB 1 in .env.test), never the app's DB 0.
    await infra.redis.flushdb();
  });
  after(async () => {
    await infra.close();
  });

  it('uses the test logical database', () => {
    expect(infra.redis.options.db).to.equal(1);
  });

  it('answers a ping', async () => {
    await infra.cache.ping();
  });

  it('stores and reads back a value', async () => {
    await infra.redis.set('greeting', 'hello');
    expect(await infra.redis.get('greeting')).to.equal('hello');
  });
});
