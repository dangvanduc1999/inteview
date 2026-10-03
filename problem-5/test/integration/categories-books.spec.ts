import { expect } from 'chai';
import type { Express } from 'express';
import request from 'supertest';
import { buildTestApp, openInfra, registerUser, resetData, type Infra } from './support';

describe('categories and books API', () => {
  let infra: Infra;
  let app: Express;
  let ann: { id: string; auth: string };
  let bob: { id: string; auth: string };

  before(async () => {
    infra = await openInfra();
    app = buildTestApp(infra);
  });
  after(async () => {
    await infra.close();
  });
  beforeEach(async () => {
    await resetData(infra.db);
    ann = await registerUser(app, 'ann@example.com', 'Ann');
    bob = await registerUser(app, 'bob@example.com', 'Bob');
  });

  const post = (path: string, who: { auth: string }, body: object) =>
    request(app).post(path).set('Authorization', who.auth).send(body);
  const get = (path: string, who: { auth: string }) =>
    request(app).get(path).set('Authorization', who.auth);
  const patch = (path: string, who: { auth: string }, body: object) =>
    request(app).patch(path).set('Authorization', who.auth).send(body);
  const del = (path: string, who: { auth: string }) =>
    request(app).delete(path).set('Authorization', who.auth);

  const newCategory = async (who: { auth: string }, name: string): Promise<string> =>
    (await post('/api/categories', who, { name }).expect(201)).body.category.id;
  const newBook = async (who: { auth: string }, body: object) =>
    (await post('/api/books', who, body).expect(201)).body.book;

  describe('categories', () => {
    it('creates, lists, renames and deletes own categories', async () => {
      const id = await newCategory(ann, 'Sci-Fi');
      const renamed = await patch(`/api/categories/${id}`, ann, { name: 'Science Fiction' }).expect(
        200,
      );
      expect(renamed.body.category.name).to.equal('Science Fiction');

      const list = await get('/api/categories', ann).expect(200);
      expect(list.body.data.map((c: { name: string }) => c.name)).to.deep.equal([
        'Science Fiction',
      ]);

      await del(`/api/categories/${id}`, ann).expect(204);
      expect((await get('/api/categories', ann)).body.data).to.have.length(0);
    });

    it('rejects duplicate names per user ignoring case, but allows them across users', async () => {
      await newCategory(ann, 'History');
      await post('/api/categories', ann, { name: 'history' }).expect(409);
      await newCategory(bob, 'History');
    });

    it('hides other users categories behind 404', async () => {
      const id = await newCategory(ann, 'Private');
      await patch(`/api/categories/${id}`, bob, { name: 'Mine' }).expect(404);
      await del(`/api/categories/${id}`, bob).expect(404);
      expect((await get('/api/categories', bob)).body.data).to.have.length(0);
    });

    it('untags books but keeps them when a category is deleted', async () => {
      const keep = await newCategory(ann, 'Keep');
      const drop = await newCategory(ann, 'Drop');
      const book = await newBook(ann, { title: 'T', author: 'A', categoryIds: [keep, drop] });

      await del(`/api/categories/${drop}`, ann).expect(204);
      const res = await get(`/api/books/${book.id}`, ann).expect(200);
      expect(res.body.book.categories.map((c: { id: string }) => c.id)).to.deep.equal([keep]);
    });
  });

  describe('books', () => {
    it('creates a book with several categories and exposes owner + categories', async () => {
      const a = await newCategory(ann, 'A');
      const b = await newCategory(ann, 'B');
      const book = await newBook(ann, {
        title: 'Dune',
        author: 'Herbert',
        publishedYear: 1965,
        categoryIds: [a, b],
      });
      expect(book.owner).to.deep.equal({ id: ann.id, name: 'Ann' });
      expect(book.categories).to.have.length(2);
    });

    it('rejects missing, duplicate, or foreign categoryIds', async () => {
      const mine = await newCategory(ann, 'Mine');
      const theirs = await newCategory(bob, 'Theirs');
      await post('/api/books', ann, { title: 'T', author: 'A' }).expect(400);
      await post('/api/books', ann, { title: 'T', author: 'A', categoryIds: [] }).expect(400);
      await post('/api/books', ann, { title: 'T', author: 'A', categoryIds: [mine, mine] }).expect(
        400,
      );
      await post('/api/books', ann, { title: 'T', author: 'A', categoryIds: [theirs] }).expect(400);
    });

    it('lets anyone read a book but only the owner change it', async () => {
      const cat = await newCategory(ann, 'C');
      const book = await newBook(ann, { title: 'T', author: 'A', categoryIds: [cat] });

      await get(`/api/books/${book.id}`, bob).expect(200);
      await patch(`/api/books/${book.id}`, bob, { title: 'Hacked' }).expect(403);
      await del(`/api/books/${book.id}`, bob).expect(403);
      expect((await get('/api/books', bob)).body.data).to.have.length(0);
      expect((await get('/api/books', ann)).body.data).to.have.length(1);
    });

    it('updates fields and replaces the category set', async () => {
      const a = await newCategory(ann, 'A');
      const b = await newCategory(ann, 'B');
      const book = await newBook(ann, { title: 'Old', author: 'A', categoryIds: [a] });

      const res = await patch(`/api/books/${book.id}`, ann, {
        title: 'New',
        categoryIds: [b],
      }).expect(200);
      expect(res.body.book.title).to.equal('New');
      expect(res.body.book.categories.map((c: { id: string }) => c.id)).to.deep.equal([b]);

      await patch(`/api/books/${book.id}`, ann, {}).expect(400);
    });

    it('soft deletes: row kept, hidden everywhere, further writes are 404', async () => {
      const cat = await newCategory(ann, 'C');
      const book = await newBook(ann, { title: 'T', author: 'A', categoryIds: [cat] });

      await del(`/api/books/${book.id}`, ann).expect(204);

      const row = await infra.db.book.findUnique({ where: { id: book.id } });
      expect(row?.deletedAt).to.be.instanceOf(Date);
      await get(`/api/books/${book.id}`, ann).expect(404);
      await get(`/api/books/${book.id}`, bob).expect(404);
      await patch(`/api/books/${book.id}`, ann, { title: 'x' }).expect(404);
      await del(`/api/books/${book.id}`, ann).expect(404);
      const list = await get('/api/books', ann).expect(200);
      expect(list.body.data).to.have.length(0);
      expect(list.body.meta.total).to.equal(0);
    });

    describe('list', () => {
      let sci: string;
      let hist: string;

      beforeEach(async () => {
        sci = await newCategory(ann, 'Sci');
        hist = await newCategory(ann, 'Hist');
        await newBook(ann, {
          title: 'Dune',
          author: 'Frank Herbert',
          publishedYear: 1965,
          categoryIds: [sci],
        });
        await newBook(ann, {
          title: 'Foundation',
          author: 'Isaac Asimov',
          publishedYear: 1951,
          categoryIds: [sci, hist],
        });
        await newBook(ann, {
          title: 'SPQR',
          author: 'Mary Beard',
          publishedYear: 2015,
          categoryIds: [hist],
        });
      });

      const titles = (res: request.Response) =>
        res.body.data.map((b: { title: string }) => b.title);

      it('searches title and author case-insensitively', async () => {
        expect(titles(await get('/api/books?q=dUnE', ann))).to.deep.equal(['Dune']);
        expect(titles(await get('/api/books?q=asimov', ann))).to.deep.equal(['Foundation']);
      });

      it('filters by category (many-to-many) and published year, and combines filters', async () => {
        expect(
          titles(await get(`/api/books?categoryId=${hist}&sortBy=title&order=asc`, ann)),
        ).to.deep.equal(['Foundation', 'SPQR']);
        expect(titles(await get('/api/books?publishedYear=1965', ann))).to.deep.equal(['Dune']);
        expect(titles(await get(`/api/books?categoryId=${sci}&q=found`, ann))).to.deep.equal([
          'Foundation',
        ]);
      });

      it('sorts', async () => {
        expect(titles(await get('/api/books?sortBy=publishedYear&order=asc', ann))).to.deep.equal([
          'Foundation',
          'Dune',
          'SPQR',
        ]);
      });

      it('paginates with stable, non-overlapping pages and meta', async () => {
        const seen: string[] = [];
        for (const page of [1, 2]) {
          const res = await get(
            `/api/books?limit=2&page=${page}&sortBy=title&order=asc`,
            ann,
          ).expect(200);
          expect(res.body.meta).to.deep.equal({ page, limit: 2, total: 3, totalPages: 2 });
          seen.push(...titles(res));
        }
        expect(seen).to.deep.equal(['Dune', 'Foundation', 'SPQR']);
      });

      it('treats % and _ in q literally', async () => {
        expect(titles(await get('/api/books?q=%25', ann))).to.deep.equal([]);
        expect(titles(await get('/api/books?q=D_ne', ann))).to.deep.equal([]);
      });

      it('rejects an out-of-range publishedYear filter with 400, not a database error', async () => {
        await get('/api/books?publishedYear=99999999999', ann).expect(400);
        await get('/api/books?publishedYear=-1', ann).expect(400);
      });

      it('rejects out-of-range pagination and unknown sort fields', async () => {
        await get('/api/books?limit=101', ann).expect(400);
        await get('/api/books?page=0', ann).expect(400);
        await get('/api/books?sortBy=password', ann).expect(400);
      });
    });
  });

  describe('api docs page', () => {
    it('serves Redoc pointing at the spec, with a CSP that allows the Redoc CDN', async () => {
      const res = await request(app).get('/api/docs').expect(200);
      expect(res.headers['content-type']).to.match(/text\/html/);
      expect(res.text).to.include('<redoc spec-url="/api/openapi.json">');
      expect(res.headers['content-security-policy']).to.include('https://cdn.redoc.ly');
    });
  });

  describe('openapi document', () => {
    it('describes every route with parameters, bodies and security', async () => {
      const doc = (await request(app).get('/api/openapi.json').expect(200)).body;
      expect(doc.openapi).to.match(/^3\./);

      const paths = Object.keys(doc.paths);
      for (const p of [
        '/auth/register',
        '/auth/login',
        '/users/me',
        '/categories',
        '/categories/{id}',
        '/books',
        '/books/{id}',
      ]) {
        expect(paths).to.include(p);
      }
      const list = doc.paths['/books'].get;
      expect(list.security).to.deep.equal([{ bearerAuth: [] }]);
      expect(list.parameters.map((p: { name: string }) => p.name)).to.include.members([
        'q',
        'categoryId',
        'page',
        'limit',
      ]);
      expect(doc.paths['/auth/register'].post).to.not.have.property('security');
      expect(
        doc.paths['/auth/register'].post.requestBody.content['application/json'].schema.required,
      ).to.include('email');
    });
  });
});
