import type { NextFunction, Request, RequestHandler, Response } from 'express';
import Joi from 'joi';
import { httpError } from './errors';
import type { RouteConfig, ValidateSchemas } from './types';

const PARTS = ['body', 'query', 'params', 'headers'] as const;

/**
 * What `validateRequest` stores on `req.valid`: the Joi-cleaned parts. Middlewares read the
 * loose defaults and check what they need (`const id = req.valid.params.id; if (!id) ...`);
 * controllers type them with `controller<Body, Query, Params>()`, using the same types as the
 * route's `Joi.object<T>()` schemas.
 */
export interface Validated<
  B = Record<string, unknown>,
  Q = Record<string, unknown>,
  P = Record<string, string>,
> {
  body: B;
  query: Q;
  params: P;
}

export type ValidatedRequest<B, Q, P> = Request & { valid: Validated<B, Q, P> };

/** Normalizes the `validate` option: a bare Joi schema means `body`. */
export function toSchemas(validate: RouteConfig['validate']): ValidateSchemas {
  if (!validate) return {};
  return Joi.isSchema(validate) ? { body: validate } : validate;
}

/** Validates each declared part and stores the cleaned values on `req.valid`. */
export function validateRequest(schemas: ValidateSchemas): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const valid: Record<string, unknown> = {};
    const details: Array<{ in: string; path: string; message: string }> = [];

    for (const part of PARTS) {
      const schema = schemas[part];
      if (!schema) continue;
      const { value, error } = schema.validate(req[part], {
        abortEarly: false,
        stripUnknown: part !== 'headers',
        allowUnknown: part === 'headers',
        convert: true,
      });
      if (error) {
        for (const d of error.details) {
          details.push({ in: part, path: d.path.join('.'), message: d.message });
        }
      } else {
        valid[part] = value;
      }
    }

    if (details.length > 0) {
      return next(httpError(400, 'VALIDATION_ERROR', 'Validation failed', details));
    }
    req.valid = valid as unknown as Validated;
    next();
  };
}
