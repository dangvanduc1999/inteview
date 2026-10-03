import { EventEmitter } from 'node:events';
import { expect } from 'chai';
import { Logger } from '../../src/core/logger/logger';
import { registerGracefulShutdown, type Closer } from '../../src/core/server/shutdown';

function setup(closers?: (events: string[]) => Closer[], timeoutMs = 1_000) {
  const events: string[] = [];
  const proc = new EventEmitter();
  const server = {
    close: (cb?: (err?: Error) => void) => {
      events.push('server');
      setImmediate(() => cb?.());
      return server as never;
    },
    closeIdleConnections: () => undefined,
  };
  let onExit!: (code: number) => void;
  const exited = new Promise<number>((resolve) => (onExit = resolve));
  const isShuttingDown = registerGracefulShutdown({
    server,
    logger: new Logger({ level: 'silent' }),
    timeoutMs,
    closers: closers?.(events) ?? [
      { name: 'db', close: async () => void events.push('db') },
      { name: 'redis', close: async () => void events.push('redis') },
    ],
    exit: onExit,
    proc: proc as unknown as NodeJS.Process,
  });
  return { proc, events, exited, isShuttingDown };
}

describe('graceful shutdown', () => {
  it('on SIGTERM closes the server first, then resources in order, and exits 0', async () => {
    const { proc, events, exited, isShuttingDown } = setup();
    expect(isShuttingDown()).to.equal(false);

    proc.emit('SIGTERM');

    expect(await exited).to.equal(0);
    expect(events).to.deep.equal(['server', 'db', 'redis']);
    expect(isShuttingDown()).to.equal(true);
  });

  it('handles SIGINT the same way', async () => {
    const { proc, exited } = setup();
    proc.emit('SIGINT');
    expect(await exited).to.equal(0);
  });

  it('runs only once when signalled repeatedly', async () => {
    const { proc, events, exited } = setup();

    proc.emit('SIGTERM');
    proc.emit('SIGINT');
    proc.emit('SIGTERM');
    await exited;

    expect(events.filter((e) => e === 'server')).to.have.length(1);
  });

  it('keeps closing the remaining resources when one fails, and exits 1', async () => {
    const { proc, events, exited } = setup((e) => [
      {
        name: 'db',
        close: async () => {
          throw new Error('disconnect failed');
        },
      },
      { name: 'redis', close: async () => void e.push('redis') },
    ]);

    proc.emit('SIGTERM');

    expect(await exited).to.equal(1);
    expect(events).to.include('redis');
  });

  it('exits 1 after an unhandled rejection or an uncaught exception', async () => {
    const rejection = setup();
    rejection.proc.emit('unhandledRejection', new Error('boom'));
    expect(await rejection.exited).to.equal(1);

    const exception = setup();
    exception.proc.emit('uncaughtException', new Error('boom'));
    expect(await exception.exited).to.equal(1);
  });

  it('forces exit 1 when a closer hangs past the timeout', async () => {
    const { proc, exited } = setup(
      () => [{ name: 'stuck', close: () => new Promise(() => {}) }],
      50,
    );

    proc.emit('SIGTERM');

    expect(await exited).to.equal(1);
  });
});
