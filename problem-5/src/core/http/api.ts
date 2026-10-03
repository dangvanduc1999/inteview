import type { RequestHandler, Router } from 'express';
import type { OpenApiRegistry } from './openapi';
import type { HttpMethod, RouteChain, RouteConfig } from './types';
import { toSchemas, validateRequest } from './validate';

/**
 * Wraps an Express router so a route reads
 * `api.get({ path, validate, specs, auth }, [...middlewares, handler])`.
 * Order: validation, authentication (when `auth: true`), middlewares, handler.
 * Every route is also recorded in the OpenAPI registry.
 */
export class Api {
  /**
   * @param authChain middlewares that run for routes declared with `auth: true`
   */
  constructor(
    private readonly router: Router,
    private readonly registry: OpenApiRegistry,
    private readonly authChain: RequestHandler[],
  ) {}

  get(config: RouteConfig, chain: RouteChain): void {
    this.add('get', config, chain);
  }

  post(config: RouteConfig, chain: RouteChain): void {
    this.add('post', config, chain);
  }

  put(config: RouteConfig, chain: RouteChain): void {
    this.add('put', config, chain);
  }

  patch(config: RouteConfig, chain: RouteChain): void {
    this.add('patch', config, chain);
  }

  delete(config: RouteConfig, chain: RouteChain): void {
    this.add('delete', config, chain);
  }

  private add(method: HttpMethod, config: RouteConfig, chain: RouteChain): void {
    const schemas = toSchemas(config.validate);
    const stack: RequestHandler[] = [];
    stack.push(validateRequest(schemas));
    if (config.auth) stack.push(...this.authChain);
    stack.push(...(chain as RequestHandler[]));

    this.router[method](config.path, ...stack);
    this.registry.add({
      method,
      path: config.path,
      schemas,
      specs: config.specs,
      auth: config.auth,
    });
  }
}
