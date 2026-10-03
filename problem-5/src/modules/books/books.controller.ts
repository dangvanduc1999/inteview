import { controller } from '../../core/http/controller';
import { requireUser } from '../auth/auth.middleware';
import { requireBook } from './books.middleware';
import type { CreateBookInput, ListBooksQuery, UpdateBookInput } from './books.schema';
import { create, list, remove, update } from './books.service';

export const createBook = controller<CreateBookInput>('createBook', async (req, res) => {
  const user = requireUser(req);
  const book = await create(user.id, req.valid.body);
  req.log.info('book created', { bookId: book.id });
  res.status(201).json({ book });
});

export const listMyBooks = controller<unknown, ListBooksQuery>('listMyBooks', async (req, res) => {
  res.json(await list(requireUser(req).id, req.valid.query));
});

// `loadBook` has put the book on the request.
export const getBook = controller('getBook', (req, res) => {
  res.json({ book: requireBook(req) });
});

export const updateBook = controller<UpdateBookInput>('updateBook', async (req, res) => {
  res.json({ book: await update(requireBook(req), req.valid.body) });
});

export const deleteBook = controller('deleteBook', async (req, res) => {
  const book = requireBook(req);
  await remove(book);
  req.log.info('book-deleted', { bookId: book.id });
  res.status(204).end();
});
