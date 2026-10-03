import { expect } from 'chai';
import request from 'supertest';
import { buildTestApp, openInfra, type Infra } from './support';

describe('HTTP app', () => {
  let infra: Infra;

  before(async () => {
    infra = await openInfra();
  });
  after(async () => {
    await infra.close();
  });

  const build = (
    opts: { verbose?: boolean; shuttingDown?: boolean; pingRedis?: () => Promise<void> } = {},
  ) =>
    buildTestApp(infra, {
      config: { health: { verbose: opts.verbose ?? false } },
      pingRedis: opts.pingRedis,
      shuttingDown: opts.shuttingDown,
    });

  describe('GET /health', () => {
    it('reports ok with db and redis connections healthy', async () => {
      const res = await request(build()).get('/health').expect(200);

      expect(res.body.status).to.equal('ok');
      expect(res.body.connections).to.deep.equal({
        db: 'ok',
        redis: 'ok',
        'accepting-traffic': 'ok',
      });
    });

    it('hides environment, cwd and git details by default', async () => {
      const res = await request(build()).get('/health').expect(200);

      expect(res.body).to.not.have.any.keys('env', 'git', 'service');
    });

    it('ignores client filters that would reveal hidden fields', async () => {
      const res = await request(build()).get('/health?filter=env.cwd').expect(200);

      expect(res.body).to.not.have.property('env');
    });

    it('serves the full payload when verbose is enabled', async () => {
      const res = await request(build({ verbose: true }))
        .get('/health')
        .expect(200);

      expect(res.body).to.have.property('env');
      expect(res.body).to.have.property('service');
    });

    it('fails when redis is unreachable', async () => {
      const broken = async () => {
        throw new Error('connection refused');
      };

      const res = await request(build({ pingRedis: broken }))
        .get('/health')
        .expect(500);

      expect(res.body.status).to.equal('fail:redis');
      expect(res.body.connections.db).to.equal('ok');
    });

    it('fails once shutdown has started so load balancers drain traffic', async () => {
      const res = await request(build({ shuttingDown: true }))
        .get('/health')
        .expect(500);

      expect(res.body.status).to.equal('fail:accepting-traffic');
    });
  });

  describe('request handling', () => {
    it('answers unknown routes with a JSON 404 carrying the request id', async () => {
      const res = await request(build()).get('/nope').set('x-request-id', 'abc-123').expect(404);

      expect(res.body.error).to.deep.include({ message: 'Not Found', requestId: 'abc-123' });
      expect(res.headers['x-request-id']).to.equal('abc-123');
    });

    it('generates a request id when none is sent or the inbound one is unsafe', async () => {
      const res = await request(build()).get('/nope').set('x-request-id', 'bad id!').expect(404);

      expect(res.headers['x-request-id']).to.match(/^[0-9a-f-]{36}$/);
    });

    it('does not advertise the framework', async () => {
      const res = await request(build()).get('/health');

      expect(res.headers).to.not.have.property('x-powered-by');
    });

    it('rejects malformed JSON bodies with a 400', async () => {
      const res = await request(build())
        .post('/anything')
        .set('content-type', 'application/json')
        .send('{"broken":')
        .expect(400);

      expect(res.body.error.requestId).to.be.a('string');
    });
  });
});
