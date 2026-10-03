import { expect } from 'chai';
import request from 'supertest';
import { createApp } from '../../src/app';
import { buildConfig } from '../../src/config';
import { Logger } from '../../src/core/logger/logger';

function build(corsOrigins: string[] = []) {
  const entries: Array<Record<string, unknown>> = [];
  const logger = new Logger({
    level: 'info',
    sink: (line) => entries.push(JSON.parse(line) as Record<string, unknown>),
  });
  const config = buildConfig('test', {
    database: { host: 'x', port: 5432, user: 'x', password: 'x' },
    redis: { host: 'x', port: 6379 },
    auth: { jwtSecret: 'x'.repeat(32) },
    cors: {
      origins: corsOrigins,
      allowedHeaders: ['content-type', 'x-version'],
      exposedHeaders: ['x-request-id'],
    },
  });
  const app = createApp(config, {
    logger,
    pingDb: async () => {},
    pingRedis: async () => {},
    isShuttingDown: () => false,
  }).app;
  return { app, entries };
}

describe('app middleware', () => {
  describe('security headers (helmet)', () => {
    it('sets protective headers and hides the framework', async () => {
      const res = await request(build().app).get('/nope');

      expect(res.headers).to.not.have.property('x-powered-by');
      expect(res.headers['x-content-type-options']).to.equal('nosniff');
      expect(res.headers['content-security-policy']).to.be.a('string');
      expect(res.headers['strict-transport-security']).to.be.a('string');
    });
  });

  describe('CORS', () => {
    const origin = 'https://app.example.com';

    it('allows only listed origins', async () => {
      const { app } = build([origin]);

      const allowed = await request(app).get('/nope').set('Origin', origin);
      const denied = await request(app).get('/nope').set('Origin', 'https://evil.example.com');

      expect(allowed.headers['access-control-allow-origin']).to.equal(origin);
      expect(denied.headers).to.not.have.property('access-control-allow-origin');
    });

    it('allows every origin when configured with *', async () => {
      const res = await request(build(['*']).app)
        .get('/nope')
        .set('Origin', origin);
      expect(res.headers['access-control-allow-origin']).to.equal('*');
    });

    it('allows no origin when the list is empty', async () => {
      const res = await request(build([]).app).get('/nope').set('Origin', origin);
      expect(res.headers).to.not.have.property('access-control-allow-origin');
    });

    it('answers preflight requests and permits the x-version header', async () => {
      const res = await request(build([origin]).app)
        .options('/anything')
        .set('Origin', origin)
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'x-version,content-type');

      expect(res.status).to.equal(204);
      expect(res.headers['access-control-allow-headers']).to.include('x-version');
    });
  });

  describe('x-version', () => {
    it('defaults to 0.1.0 when the header is missing', async () => {
      const { app, entries } = build();
      await request(app).get('/nope');
      expect(entries.find((e) => e.msg === 'request')?.version).to.equal('0.1.0');
    });

    it('uses the header value when present', async () => {
      const { app, entries } = build();
      await request(app).get('/nope').set('x-version', '2.3.4');
      expect(entries.find((e) => e.msg === 'response')?.version).to.equal('2.3.4');
    });

    it('is not applied to /health', async () => {
      const { app, entries } = build();
      await request(app).get('/health').expect(200);
      expect(entries.find((e) => e.msg === 'request')).to.not.have.property('version');
    });
  });

  describe('request and response logging', () => {
    it('logs a request event and then a response event for every request', async () => {
      const { app, entries } = build();

      await request(app).get('/nope?secret=1').set('x-request-id', 'rid-1').expect(404);

      const http = entries.filter((e) => e.msg === 'request' || e.msg === 'response');
      expect(http.map((e) => e.msg)).to.deep.equal(['request', 'response']);
      expect(http[0]).to.include({ method: 'GET', path: '/nope', requestId: 'rid-1' });
      expect(http[1]).to.include({ status: 404, path: '/nope', requestId: 'rid-1' });
      expect(http[1]?.durationMs).to.be.a('number');
    });

    it('does not log query string values', async () => {
      const { app, entries } = build();
      await request(app).get('/nope?token=abc123');
      expect(JSON.stringify(entries)).to.not.include('abc123');
    });

    it('also logs /health', async () => {
      const { app, entries } = build();
      await request(app).get('/health').expect(200);
      expect(entries.filter((e) => e.path === '/health').map((e) => e.msg)).to.deep.equal([
        'request',
        'response',
      ]);
    });
  });
});
