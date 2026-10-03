import j2s from 'joi-to-swagger';
import type Joi from 'joi';
import type { HttpMethod, OpenApiOperation, ValidateSchemas } from './types';

export interface RouteEntry {
  method: HttpMethod;
  path: string;
  schemas: ValidateSchemas;
  specs?: OpenApiOperation;
  auth?: boolean;
}

type JsonSchema = {
  properties?: Record<string, unknown>;
  required?: string[];
  [key: string]: unknown;
};

const toJsonSchema = (schema: Joi.Schema): JsonSchema => j2s(schema).swagger as JsonSchema;

/** `/books/:id` -> `/books/{id}` */
const toOpenApiPath = (path: string) => path.replace(/:([A-Za-z0-9_]+)/g, '{$1}');

function toParameters(location: 'query' | 'path' | 'header', schema?: Joi.Schema) {
  if (!schema) return [];
  const { properties = {}, required = [] } = toJsonSchema(schema);
  return Object.entries(properties).map(([name, propSchema]) => ({
    name,
    in: location,
    required: location === 'path' || required.includes(name),
    schema: propSchema,
  }));
}

/** Collects the routes declared through `Api` and renders them as an OpenAPI 3 document. */
export class OpenApiRegistry {
  private readonly entries: RouteEntry[] = [];

  add(entry: RouteEntry): void {
    this.entries.push(entry);
  }

  build(info: { title: string; version: string }, serverUrl: string): Record<string, unknown> {
    const paths: Record<string, Record<string, unknown>> = {};
    for (const entry of this.entries) {
      const key = toOpenApiPath(entry.path);
      (paths[key] ??= {})[entry.method] = this.toOperation(entry);
    }
    return {
      openapi: '3.0.3',
      info,
      servers: [{ url: serverUrl }],
      paths,
      components: {
        securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
      },
    };
  }

  private toOperation(entry: RouteEntry): Record<string, unknown> {
    const { schemas } = entry;
    const parameters = [
      ...toParameters('path', schemas.params),
      ...toParameters('query', schemas.query),
      ...toParameters('header', schemas.headers),
    ];
    return {
      responses: { '200': { description: 'OK' } },
      ...entry.specs,
      ...(parameters.length > 0 ? { parameters } : {}),
      ...(schemas.body
        ? {
            requestBody: {
              required: true,
              content: { 'application/json': { schema: toJsonSchema(schemas.body) } },
            },
          }
        : {}),
      ...(entry.auth ? { security: [{ bearerAuth: [] }] } : {}),
    };
  }
}
