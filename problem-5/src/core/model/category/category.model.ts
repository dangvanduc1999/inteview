import { conflict, notFound } from '../../http/errors';
import type { CoreDb } from '../core-db';
import { translateDbErrors } from '../db-errors';

/** Case-insensitive uniqueness key for a category name. */
export const toNameKey = (name: string) => name.trim().toLowerCase();

const nameTaken = () => conflict('Category name already exists');
const categoryNotFound = () => notFound('Category not found');

export class CategoryModel {
  constructor(private readonly core: CoreDb) {}

  create(ownerId: string, name: string) {
    return translateDbErrors(
      this.core.client.category.create({ data: { ownerId, name, nameKey: toNameKey(name) } }),
      { P2002: nameTaken },
    );
  }

  update(id: string, name: string) {
    return translateDbErrors(
      this.core.client.category.update({
        where: { id },
        data: { name, nameKey: toNameKey(name) },
      }),
      { P2002: nameTaken, P2025: categoryNotFound },
    );
  }

  remove(id: string) {
    return translateDbErrors(this.core.client.category.delete({ where: { id } }), {
      P2025: categoryNotFound,
    });
  }

  findById(id: string) {
    return this.core.client.category.findUnique({ where: { id } });
  }

  findByName(ownerId: string, name: string) {
    return this.core.client.category.findUnique({
      where: { ownerId_nameKey: { ownerId, nameKey: toNameKey(name) } },
    });
  }

  listByOwner(ownerId: string) {
    return this.core.client.category.findMany({ where: { ownerId }, orderBy: { name: 'asc' } });
  }

  findByIds(ownerId: string, ids: string[]) {
    return this.core.client.category.findMany({ where: { ownerId, id: { in: ids } } });
  }
}
