import { BookModel } from './book/book.model';
import { CategoryModel } from './category/category.model';
import { CoreDb, type CoreDbConfig } from './core-db';
import { UserModel } from './user/user.model';

/**
 * The data layer. Call `model.init({ ...dbConfig, logger })` once at boot, then use the entity
 * models, e.g. `model.user.findById(id)`. A new entity is a class with the same constructor plus
 * one property here.
 */
export class Model {
  readonly core = new CoreDb();

  readonly user = new UserModel(this.core);
  readonly category = new CategoryModel(this.core);
  readonly book = new BookModel(this.core);

  readonly init = (config: CoreDbConfig) => this.core.init(config);
  readonly migrate = () => this.core.migrate();
  readonly connect = () => this.core.connect();
  readonly ping = () => this.core.ping();
  readonly close = () => this.core.close();
}

export const model = new Model();

export type { CoreDbConfig, DbOptions } from './core-db';
