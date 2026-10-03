import { expect } from 'chai';
import express, { Router, type Request, type RequestHandler } from 'express';
import Joi from 'joi';
import request from 'supertest';
import { Api } from '../../../src/core/http/api';
import { notFound } from '../../../src/core/http/errors';
import { OpenApiRegistry } from '../../../src/core/http/openapi';
import { errorHandler } from '../../../src/core/server/middleware/error-handler';

function build() {
  const router = Router();
  const registry = new OpenApiRegistry();
  const calls: string[] = [];
  const authenticate: RequestHandler = (req, _res, next) => {
    calls.push('auth');
    req.user = { id: 'u1' } as Request['user'];
    next();
  };
  const api = new Api(router, registry, [authenticate]);

  api.post(
    {
      path: '/items/:id',
      auth: true,
      validate: {
        params: Joi.object({ id: Joi.string().uuid().required() }),
        query: Joi.object({ page: Joi.number().integer().min(1).default(1) }),
        body: Joi.object({ name: Joi.string().required() }),
      },
      specs: { summary: 'Create item', tags: ['items'] },
    },
    [
      (_req, _res, next) => {
        calls.push('middleware');
        next();
      },
      (req, res) => {
        calls.push('handler');
        res.json({ valid: req.valid, user: req.user });
      },
    ],
  );

  api.get({ path: '/shorthand', validate: Joi.object({}) }, [() => undefined]);
  api.post({ path: '/shorthand', validate: Joi.object({ n: Joi.number().required() }) }, [
    (req, res) => {
      res.json(req.valid.body);
    },
  ]);
  api.get({ path: '/missing' }, [
    async () => {
      throw notFound('nope');
    },
  ]);

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.id = 'rid';
    req.log = { error() {}, warn() {} } as never;
    next();
  });
  app.use(router);
  app.use(errorHandler('test'));
  return { app, calls, registry };
}

const ID = '3f2b8c1e-5d4a-4c1b-9a47-1f2e3d4c5b6a';

describe('route api', () => {
  it('validates, authenticates, runs middlewares then the handler, in order', async () => {
    const { app, calls } = build();
    const res = await request(app)
      .post(`/items/${ID}?page=2&extra=1`)
      .send({ name: 'x', unknown: true })
      .expect(200);

    expect(calls).to.deep.equal(['auth', 'middleware', 'handler']);
    expect(res.body.valid).to.deep.equal({
      params: { id: ID },
      query: { page: 2 },
      body: { name: 'x' },
    });
    expect(res.body.user).to.deep.equal({ id: 'u1' });
  });

  it('returns 400 with details for every invalid part and skips auth', async () => {
    const { app, calls } = build();
    const res = await request(app).post('/items/not-a-uuid?page=0').send({}).expect(400);

    expect(res.body.error.code).to.equal('VALIDATION_ERROR');
    const where = res.body.error.details.map((d: { in: string }) => d.in).sort();
    expect(where).to.deep.equal(['body', 'params', 'query']);
    expect(calls).to.deep.equal([]);
  });

  it('treats a bare Joi schema as the body schema', async () => {
    const { app } = build();
    await request(app).post('/shorthand').send({}).expect(400);
    const res = await request(app).post('/shorthand').send({ n: '5' }).expect(200);
    expect(res.body).to.deep.equal({ n: 5 });
  });

  it('maps a thrown async http error to its status and code', async () => {
    const { app } = build();
    const res = await request(app).get('/missing').expect(404);
    expect(res.body.error).to.include({ code: 'NOT_FOUND', message: 'nope', requestId: 'rid' });
  });
});

describe('openapi registry', () => {
  it('builds paths, parameters, request body and security from the routes', () => {
    const doc = build().registry.build({ title: 't', version: '1' }, '/api') as {
      openapi: string;
      paths: Record<string, Record<string, Record<string, unknown>>>;
      components: { securitySchemes: Record<string, unknown> };
    };

    expect(doc.openapi).to.match(/^3\./);
    expect(doc.components.securitySchemes).to.have.property('bearerAuth');

    const op = doc.paths['/items/{id}']?.post as {
      summary: string;
      security: unknown;
      parameters: Array<{ name: string; in: string }>;
      requestBody: { content: { 'application/json': { schema: { required: string[] } } } };
    };
    expect(op.summary).to.equal('Create item');
    expect(op.security).to.deep.equal([{ bearerAuth: [] }]);
    expect(
      op.parameters.map((p: { name: string; in: string }) => `${p.in}:${p.name}`),
    ).to.have.members(['path:id', 'query:page']);
    expect(op.requestBody.content['application/json'].schema.required).to.deep.equal(['name']);

    expect(doc.paths['/missing']?.get).to.not.have.property('security');
  });
});
