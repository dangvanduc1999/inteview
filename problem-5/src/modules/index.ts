import type { Api } from '../core/http/api';
import { registerAuthRoutes } from './auth/auth.routes';
import { registerBookRoutes } from './books/books.routes';
import { registerCategoryRoutes } from './categories/categories.routes';
import type { ModuleDeps } from './types';
import { registerUserRoutes } from './users/users.routes';

export type { ModuleDeps } from './types';

export function registerModules(api: Api, deps: ModuleDeps): void {
  registerAuthRoutes(api, deps);
  registerUserRoutes(api);
  registerCategoryRoutes(api);
  registerBookRoutes(api, deps);
}
