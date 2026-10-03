// Writes docs/openapi.json and a standalone docs/openapi.html (Redoc) from the registered routes.
// It builds the app without connecting to the database or Redis: no services are needed.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createApp } from '../src/app';
import { loadConfig } from '../src/config';
import { redocStandalonePage } from '../src/core/http/docs-html';
import { Logger } from '../src/core/logger/logger';

const outDir = path.resolve(process.argv[2] ?? 'docs');

const config = loadConfig();
const server = createApp(config, {
  logger: new Logger({ level: 'silent' }),
  // Health checks never run here, so these are never called.
  pingDb: async () => {},
  pingRedis: async () => {},
  isShuttingDown: () => false,
});

const spec = server.openApiDocument();
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, 'openapi.json'), `${JSON.stringify(spec, null, 2)}\n`);
writeFileSync(
  path.join(outDir, 'openapi.html'),
  redocStandalonePage(`${config.get<string>('service.name')} API`, spec),
);
process.stdout.write(`wrote ${outDir}/openapi.json and ${outDir}/openapi.html\n`);
