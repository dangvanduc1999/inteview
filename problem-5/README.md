# problem-4

A REST API for users and books on Express 5 + TypeScript. Users register and log in, create categories, and manage their own books (create, list with filter and pagination, update, soft delete). Books and categories are many-to-many. Data is in Postgres (Prisma), Redis backs a small cache and the health check, and the API documents itself with OpenAPI.

## Goal

The goal of this project is a **robust backend** that is easy to debug and observe, shuts down gracefully when something goes wrong, and can be split into separate modules as it scales. The books API is only the example that exercises it.

**Kept simple on purpose.** To keep development simple, these are left out for now: idempotency keys, API keys, rate limiting, and real secret management (`secrets.json` holds fake local values; real secrets are meant to come from Vault or AWS Secrets Manager).

## Prerequisites

- **Node 22** (`>=22.12`, see `.nvmrc`). Activate it yourself (for example `nvm use`).
- **pnpm 10**, pinned by the `packageManager` field.
- **Docker** with Compose, for Postgres and Redis only. The app runs on your machine.

## Quick start

```bash
scripts/bootstrap.sh     # checks Node, enables pnpm, installs dependencies, creates secrets.json, runs lint
pnpm run docker:up       # starts Postgres 16 and Redis 7 and waits until they are healthy
pnpm run dev             # starts the API with file watching (NODE_ENV=local)
```

`pnpm run dev` applies the database migrations by itself. Then open:

- Health check: <http://localhost:3000/health>
- API docs (Redoc): <http://localhost:3000/api/docs>
- OpenAPI JSON: <http://localhost:3000/api/openapi.json>

![img.png](img.png)

## Commands

| Command                                                  | What it does                                                                      |
| -------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `pnpm run dev`                                           | Run with file watching (`NODE_ENV=local`)                                         |
| `pnpm run build`                                         | Compile `src/` to `dist/`                                                         |
| `NODE_ENV=<env> pnpm start`                              | Run the compiled server; `NODE_ENV` is required (`local`, `dev`, `stage`, `prod`) |
| `pnpm run typecheck` / `lint` / `lint:fix` / `format`    | TypeScript check / ESLint / ESLint with fixes / Prettier                          |
| `scripts/test.sh [unit\|integration] [files] [-g title]` | Run the tests                                                                     |
| `pnpm run docker:up` / `docker:down` / `docker:reset`    | Start / stop / stop and delete the Postgres and Redis data                        |
| `pnpm run prisma:migrate -- --name <change>`             | Create a migration from schema changes and apply it to your dev database          |
| `pnpm run prisma:deploy`                                 | Apply the existing migrations (what deployments run)                              |
| `pnpm run openapi:html`                                  | Write `docs/openapi.json` and a standalone `docs/openapi.html`                    |

## Running tests

```bash
scripts/test.sh                              # everything
scripts/test.sh unit                         # unit tests only, no services needed
scripts/test.sh integration                  # integration tests, needs `pnpm run docker:up`
scripts/test.sh test/unit/logger.spec.ts     # specific file(s)
scripts/test.sh -g "soft deletes"            # one test or describe block, by title
```

Tests run with `NODE_ENV=test`: they use the `db-app-test` database and Redis DB 1, so your app data is never touched. Integration tests migrate `db-app-test` themselves and empty the tables between tests.

## Migrations

The schema is `prisma/schema.prisma`; migrations are SQL files in `prisma/migrations/` and are committed.

**Changing the schema**

```bash
# edit prisma/schema.prisma, then:
DATABASE_URL=postgresql://app:app@localhost:5432/db-app pnpm run prisma:migrate -- --name add_something
# commit the new folder in prisma/migrations/ with the schema change
```

**Applying migrations**

| Where                  | How                                                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `local`, `test`        | Automatic at boot: `database.autoMigrate` is `true`. Set it to `false` in `src/config/local.ts` to migrate by hand |
| `dev`, `stage`, `prod` | A deploy step: `DATABASE_URL=<url> pnpm run prisma:deploy`, before starting the new version                        |

`prisma:deploy` (`prisma migrate deploy`) only applies migration files that have not run yet. It never creates migrations and never resets data, so it is safe in production. Turning `autoMigrate` on in `dev`, `stage` or `prod` makes the server refuse to start. Back up the database before migrating data you care about.

## Project structure

```
src/
  server.ts            entrypoint: boot, dependencies, listen, graceful shutdown
  app.ts               builds the HTTP server from configuration
  config/              settings per environment (default, local, dev, stage, prod, test) and the loader
  core/                reusable infrastructure, written as classes
    logger/            Logger
    cache/             Redis connection and JSON cache
    model/             database connection and the data layer: core-db.ts, user/, category/, book/
    http/              route wrapper, validation, controller wrapper, errors, OpenAPI, docs page
    server/            HTTP server, health check, graceful shutdown, common middleware
  modules/             the features: auth/, users/, categories/, books/
                       (each has routes, controller, middleware, schema, and a service when needed)
  utils/               small helpers
  types/               TypeScript declarations
prisma/                schema.prisma and migrations/
docker/                database init script for Docker Compose
scripts/               bootstrap.sh, build.sh, test.sh, export-openapi.ts
test/
  unit/                no services needed
  integration/         real Postgres and Redis
docs/                  generated OpenAPI files
```

## Configuration and secrets

Settings are in `src/config/`: `default.ts` first, then the file for `NODE_ENV` (`local.ts`, `dev.ts`, `stage.ts`, `prod.ts`, `test.ts`), which only contains what it changes. They are used as they are; read a value with `config.get('server.port')`. `NODE_ENV` is required.

Secrets are **fake for now**: `secrets.json` (created from `secrets.example.json`, git-ignored) holds local development values only. Real deployments are meant to read secrets from Vault or AWS Secrets Manager instead; set `SECRETS_PATH` to read the file from another location.

## API

Everything is under `/api`. Send `Authorization: Bearer <accessToken>` on every route except register and login.

| Method        | Path                            | Notes                                                                                                                 |
| ------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| POST          | `/auth/register`, `/auth/login` | Returns `{ user, accessToken }`                                                                                       |
| GET           | `/users/me`                     | The current user                                                                                                      |
| GET, POST     | `/categories`                   | List or create your categories                                                                                        |
| PATCH, DELETE | `/categories/:id`               | Owner only                                                                                                            |
| POST          | `/books`                        | `{ title, author, categoryIds, description?, isbn?, publishedYear? }`                                                 |
| GET           | `/books`                        | Your books. Filters: `q`, `categoryId`, `publishedYear`; `sortBy`, `order`; `page`, `limit`. Returns `{ data, meta }` |
| GET           | `/books/:id`                    | Any logged-in user can read a book that is not deleted                                                                |
| PATCH, DELETE | `/books/:id`                    | Owner only. DELETE is a soft delete                                                                                   |

Errors look like `{ "error": { "message", "code", "details", "requestId" } }`. The routes, their validation and the docs page are all generated from the same route declarations:

```ts
api.patch(
  {
    path: '/books/:id',
    auth: true,
    validate: { params: bookParamsSchema, body: updateBookSchema },
    specs: { summary: 'Update my book', tags: ['books'] },
  },
  [loadBook, assertBookOwner, assertOwnCategories, updateBook], // middlewares first, controller last
);
```

## Operations

- **Health:** `GET /health` checks the database, Redis and whether the server is still accepting traffic.
- **Graceful shutdown:** on `SIGTERM`/`SIGINT` the server drains in-flight requests, closes the database and Redis, then exits.
- **Docker image:** `docker build -t problem-4 .`, then run it with `-e NODE_ENV=prod` and `SECRETS_PATH` pointing at a mounted secrets file. The image does not migrate: run `prisma:deploy` as a deploy step first.
