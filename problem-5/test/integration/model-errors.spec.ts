import { expect } from 'chai';
import { model } from '../../src/core/model';
import { openInfra, resetData, type Infra } from './support';

const NO_SUCH_ID = '3f2b8c1e-5d4a-4c1b-9a47-1f2e3d4c5b6a';

async function status(promise: Promise<unknown>): Promise<number | undefined> {
  try {
    await promise;
  } catch (err) {
    return (err as { status?: number }).status;
  }
  return undefined;
}

describe('model error translation', () => {
  let infra: Infra;
  let ownerId: string;
  let categoryId: string;

  before(async () => {
    infra = await openInfra();
  });
  after(async () => {
    await infra.close();
  });
  beforeEach(async () => {
    await resetData(infra.db);
    const owner = await model.user.create({ email: 'o@x.com', name: 'O', passwordHash: 'x' });
    ownerId = owner.id;
    categoryId = (await model.category.create(ownerId, 'C')).id;
  });

  const fields = { title: 'T', author: 'A' };

  it('answers 400 when a category vanished between the check and the book insert', async () => {
    expect(await status(model.book.create(ownerId, fields, [NO_SUCH_ID]))).to.equal(400);
  });

  it('answers 409 for a duplicate category name and a duplicate email', async () => {
    expect(await status(model.category.create(ownerId, 'c'))).to.equal(409);
    expect(
      await status(model.user.create({ email: 'o@x.com', name: 'X', passwordHash: 'x' })),
    ).to.equal(409);
  });

  it('does not update or delete a book that is already soft-deleted', async () => {
    const book = await model.book.create(ownerId, fields, [categoryId]);
    await model.book.softDelete(book.id);

    expect(await status(model.book.update(book.id, { title: 'New' }))).to.equal(404);
    expect(await status(model.book.softDelete(book.id))).to.equal(404);
    const row = await infra.db.book.findUnique({ where: { id: book.id } });
    expect(row?.title).to.equal('T');
  });

  it('tells a missing category apart from a missing book on update', async () => {
    const book = await model.book.create(ownerId, fields, [categoryId]);
    expect(await status(model.book.update(book.id, {}, [NO_SUCH_ID]))).to.equal(400);
    expect(await status(model.book.update(NO_SUCH_ID, { title: 'x' }))).to.equal(404);
  });
});
