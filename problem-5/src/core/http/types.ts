import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type Joi from 'joi';

export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

/** Joi schemas per request part. */
export interface ValidateSchemas {
  body?: Joi.Schema;
  query?: Joi.Schema;
  params?: Joi.Schema;
  headers?: Joi.Schema;
}

/** OpenAPI operation fields (summary, tags, responses, ...). Request parts come from `validate`. */
export type OpenApiOperation = Record<string, unknown>;

export interface RouteConfig {
  path: string;
  /** A bare Joi schema validates the body. */
  validate?: Joi.Schema | ValidateSchemas;
  specs?: OpenApiOperation;
  /** Requires a valid bearer token; sets `req.user`. */
  auth?: boolean;
}

export type RouteHandler = (req: Request, res: Response, next: NextFunction) => unknown;

/** Middlewares first, the handler last. */
export type RouteChain = RouteHandler[];

export type { RequestHandler };
