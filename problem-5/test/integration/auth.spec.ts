import { expect } from 'chai';
import type { Express } from 'express';
import request from 'supertest';
import { model } from '../../src/core/model';
import { userCacheKey } from '../../src/core/model/user/user.model';
import { buildTestApp, openInfra, resetData, type Infra } from './support';

describe('auth API', () => {
  let infra: Infra;
  let app: Express;

  before(async () => {
    infra = await openInfra();
    app = buildTestApp(infra);
  });
  after(async () => {
    await infra.close();
  });
  beforeEach(() => resetData(infra.db));

  const credentials = { email: 'ann@example.com', password: 'password123', name: 'Ann' };

  it('registers, logs in, and reads the current user', async () => {
    const registered = await request(app).post('/api/auth/register').send(credentials).expect(201);
    expect(registered.body.user).to.include({ email: 'ann@example.com', name: 'Ann' });
    expect(registered.body.user).to.not.have.property('passwordHash');

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ann@example.com', password: 'password123' })
      .expect(200);

    const me = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200);
    expect(me.body.user.id).to.equal(registered.body.user.id);
  });

  it('rejects a duplicate email regardless of case', async () => {
    await request(app).post('/api/auth/register').send(credentials).expect(201);
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...credentials, email: 'ANN@example.com' })
      .expect(409);
    expect(res.body.error.code).to.equal('CONFLICT');
  });

  it('rejects wrong password and unknown email with the same 401', async () => {
    await request(app).post('/api/auth/register').send(credentials).expect(201);
    const wrong = await request(app)
      .post('/api/auth/login')
      .send({ email: credentials.email, password: 'nope-nope' })
      .expect(401);
    const unknown = await request(app)
      .post('/api/auth/login')
      .send({ email: 'who@example.com', password: 'password123' })
      .expect(401);
    expect(wrong.body.error.message).to.equal(unknown.body.error.message);
  });

  it('requires a valid bearer token', async () => {
    await request(app).get('/api/users/me').expect(401);
    await request(app).get('/api/users/me').set('Authorization', 'Bearer garbage').expect(401);
  });

  it('rejects the token of a user that no longer exists', async () => {
    const registered = await request(app).post('/api/auth/register').send(credentials).expect(201);
    await infra.db.user.delete({ where: { id: registered.body.user.id } });

    await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${registered.body.accessToken}`)
      .expect(401);
  });

  it('caches the authenticated user until the entry is dropped', async () => {
    const registered = await request(app).post('/api/auth/register').send(credentials).expect(201);
    const bearer = `Bearer ${registered.body.accessToken}`;
    const id = registered.body.user.id;

    await request(app).get('/api/users/me').set('Authorization', bearer).expect(200);
    await infra.db.user.delete({ where: { id } });
    // Still served from the cache.
    await request(app).get('/api/users/me').set('Authorization', bearer).expect(200);

    await infra.cache.del(userCacheKey(id));
    await request(app).get('/api/users/me').set('Authorization', bearer).expect(401);
  });

  it('cuts access at once when the user is removed through the model', async () => {
    const registered = await request(app).post('/api/auth/register').send(credentials).expect(201);
    const bearer = `Bearer ${registered.body.accessToken}`;

    await request(app).get('/api/users/me').set('Authorization', bearer).expect(200);
    await model.user.remove(registered.body.user.id);
    await request(app).get('/api/users/me').set('Authorization', bearer).expect(401);
  });

  it('shows a renamed user right away', async () => {
    const registered = await request(app).post('/api/auth/register').send(credentials).expect(201);
    const bearer = `Bearer ${registered.body.accessToken}`;

    await request(app).get('/api/users/me').set('Authorization', bearer).expect(200);
    await model.user.update(registered.body.user.id, { name: 'Renamed' });
    const me = await request(app).get('/api/users/me').set('Authorization', bearer).expect(200);
    expect(me.body.user.name).to.equal('Renamed');
  });

  it('validates the register body', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'not-an-email', password: 'short' })
      .expect(400);
    const paths = res.body.error.details.map((d: { path: string }) => d.path);
    expect(paths).to.have.members(['email', 'password', 'name']);
  });
});
