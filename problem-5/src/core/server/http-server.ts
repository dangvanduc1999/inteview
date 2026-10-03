import type { Server } from 'node:http';
import cors from 'cors';
import express, { Router, type Express, type RequestHandler } from 'express';
import helmet from 'helmet';
import type { AppEnv } from '../../config';
import { Api } from '../http/api';
import { DOCS_CSP, redocPage } from '../http/docs-html';
import { OpenApiRegistry } from '../http/openapi';
import type { Logger } from '../logger/logger';
import { HEALTH_PATH, registerHealth } from './health';
import { apiVersion } from './middleware/api-version';
import { errorHandler } from './middleware/error-handler';
import { notFound } from './middleware/not-found';
import { requestId } from './middleware/request-id';
import { requestLogger } from './middleware/request-logger';

export interface HttpServerOptions {
  env: AppEnv;
  logger: Logger;
  /** Title of the generated OpenAPI document. */
  serviceName: string;
  /** Used when a request has no `x-version` header. */
  defaultVersion: string;
  bodyLimit: string;
  apiPrefix: string;
  /** Path of the OpenAPI document, relative to `apiPrefix`. */
  openApiPath: string;
  /** Path of the Redoc page, relative to `apiPrefix`. */
  docsPath: string;
  cors: {
    /** `['*']` allows any origin, `[]` allows none. */
    origins: string[];
    allowedHeaders: string[];
    exposedHeaders: string[];
  };
  health: {
    verbose: boolean;
    checkTimeoutMs: number;
    ping: Record<string, () => Promise<void>>;
    isShuttingDown: () => boolean;
  };
  /** Runs for routes declared with `auth: true`. */
  authChain: RequestHandler[];
  /** Declares the application's routes. */
  registerRoutes: (api: Api) => void;
}

export interface ListenOptions {
  port: number;
  keepAliveTimeoutMs: number;
  headersTimeoutMs: number;
}

/**
 * The HTTP server instance: builds the Express app with the standard middleware order
 * (request id, version, logging, helmet, cors, health, body parser, API routes, 404, errors)
 * and listens on request.
 */
export class HttpServer {
  readonly app: Express;
  readonly registry = new OpenApiRegistry();
  private server: Server | undefined;

  constructor(private readonly options: HttpServerOptions) {
    const { logger, cors: corsConfig, health } = options;
    const app = express();

    app.use(requestId(logger));
    app.use(apiVersion(options.defaultVersion, [HEALTH_PATH]));
    app.use(requestLogger);

    app.use(helmet());
    app.use(
      cors({
        origin: corsConfig.origins.includes('*') ? '*' : corsConfig.origins,
        allowedHeaders: corsConfig.allowedHeaders,
        exposedHeaders: corsConfig.exposedHeaders,
      }),
    );

    registerHealth(app, health);

    app.use(express.json({ limit: options.bodyLimit }));
    app.use(options.apiPrefix, this.buildRouter());

    app.use(notFound);
    app.use(errorHandler(options.env));
    this.app = app;
  }

  private doc: Record<string, unknown> | undefined;

  /** The OpenAPI document for the registered routes (built once). */
  openApiDocument(): Record<string, unknown> {
    this.doc ??= this.registry.build(
      { title: this.options.serviceName, version: this.options.defaultVersion },
      this.options.apiPrefix,
    );
    return this.doc;
  }

  private buildRouter(): Router {
    const { authChain, registerRoutes } = this.options;
    const router = Router();
    registerRoutes(new Api(router, this.registry, authChain));

    router.get(this.options.openApiPath, (_req, res) => {
      res.json(this.openApiDocument());
    });

    const { apiPrefix, openApiPath, docsPath, serviceName } = this.options;
    const page = redocPage(`${serviceName} API`, `${apiPrefix}${openApiPath}`);
    router.get(docsPath, (_req, res) => {
      res.setHeader('Content-Security-Policy', DOCS_CSP);
      res.type('html').send(page);
    });
    return router;
  }

  /** Starts listening; rejects if the port cannot be bound. */
  async listen(opts: ListenOptions): Promise<Server> {
    const server = await new Promise<Server>((resolve, reject) => {
      const listening = this.app.listen(opts.port, (err?: Error) =>
        err ? reject(err) : resolve(listening),
      );
    });
    server.keepAliveTimeout = opts.keepAliveTimeoutMs;
    server.headersTimeout = opts.headersTimeoutMs;
    this.server = server;
    return server;
  }

  /** The listening `http.Server`, once `listen` has resolved. */
  get httpServer(): Server | undefined {
    return this.server;
  }
}
