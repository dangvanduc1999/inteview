import { expect } from 'chai';
import express from 'express';
import request from 'supertest';
import { controller } from '../../../src/core/http/controller';
import { notFound } from '../../../src/core/http/errors';
import { Logger } from '../../../src/core/logger/logger';
import { errorHandler } from '../../../src/core/server/middleware/error-handler';
import { requestId } from '../../../src/core/server/middleware/request-id';

function build() {
  const entries: Array<Record<string, unknown>> = [];
  const logger = new Logger({
    level: 'debug',
    sink: (line) => entries.push(JSON.parse(line) as Record<string, unknown>),
  });
  const app = express();
  app.use(requestId(logger));
  app.get(
    '/ok',
    controller('okController', (_req, res) => {
      res.json({ ok: true });
    }),
  );
  app.get(
    '/client-error',
    controller('clientError', () => {
      throw notFound('nope');
    }),
  );
  app.get(
    '/crash',
    controller('crash', async () => {
      throw new Error('boom');
    }),
  );
  app.use(errorHandler('test'));
  const named = (name: string) => entries.filter((e) => String(e.msg).startsWith(name));
  return { app, entries, named };
}

describe('controller()', () => {
  it('logs success with the controller name', async () => {
    const { app, named } = build();
    await request(app).get('/ok').expect(200);
    expect(named('okController').map((e) => e.msg)).to.deep.equal([
      'okController started',
      'okController ok',
    ]);
  });

  it('logs client errors as warn, once, and still answers with the error', async () => {
    const { app, entries, named } = build();
    const res = await request(app).get('/client-error').expect(404);

    expect(res.body.error.code).to.equal('NOT_FOUND');
    const failed = named('clientError failed');
    expect(failed).to.have.length(1);
    expect(failed[0]?.level).to.equal('warn');
    expect(entries.filter((e) => e.msg === 'request rejected')).to.have.length(0);
  });

  it('logs unexpected errors as error, once, and hides the details from the client', async () => {
    const { app, entries, named } = build();
    const res = await request(app).get('/crash').expect(500);

    expect(res.body.error.message).to.equal('Internal Server Error');
    const failed = named('crash failed');
    expect(failed).to.have.length(1);
    expect(failed[0]?.level).to.equal('error');
    expect(entries.filter((e) => e.msg === 'request failed')).to.have.length(0);
  });
});
