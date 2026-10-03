import type { Server } from 'node:http';
import type { Logger } from '../logger/logger';

export interface Closer {
  name: string;
  close: () => Promise<void>;
}

export interface GracefulShutdownOptions {
  server: Pick<Server, 'close' | 'closeIdleConnections'>;
  logger: Logger;
  timeoutMs: number;
  closers: Closer[];
  exit?: (code: number) => void;
  proc?: Pick<NodeJS.Process, 'on'>;
}

/**
 * On SIGTERM/SIGINT: stop accepting connections, let in-flight requests finish, close the
 * resources, exit 0. Unhandled rejections and uncaught exceptions do the same with exit code 1.
 * Returns a function telling whether shutdown has started (for health checks).
 */
export function registerGracefulShutdown(options: GracefulShutdownOptions): () => boolean {
  const { server, logger, timeoutMs, closers } = options;
  const exit = options.exit ?? ((code: number) => process.exit(code));
  const proc = options.proc ?? process;
  let shuttingDown = false;

  const shutdown = async (reason: string, exitCode = 0): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info('shutdown started', { reason });

    setTimeout(() => {
      logger.error('shutdown timed out, forcing exit', { timeoutMs });
      exit(1);
    }, timeoutMs).unref();

    let code = exitCode;
    // Keep-alive sockets that go idle after close() would otherwise keep the server open.
    const sweep = setInterval(() => server.closeIdleConnections(), 100);
    try {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
      logger.info('http server closed');
    } catch (err) {
      code = 1;
      logger.error('http server close failed', { err });
    } finally {
      clearInterval(sweep);
    }

    for (const closer of closers) {
      try {
        await closer.close();
        logger.info('closed', { resource: closer.name });
      } catch (err) {
        code = 1;
        logger.error('close failed', { resource: closer.name, err });
      }
    }

    logger.info('shutdown complete', { exitCode: code });
    exit(code);
  };

  proc.on('SIGTERM', () => shutdown('SIGTERM'));
  proc.on('SIGINT', () => shutdown('SIGINT'));

  proc.on('unhandledRejection', (reason) => {
    logger.error('unhandled rejection', { err: reason });
    shutdown('unhandledRejection', 1);
  });

  proc.on('uncaughtException', (err) => {
    logger.error('uncaught exception', { err });
    shutdown('uncaughtException', 1);
  });

  return () => shuttingDown;
}
