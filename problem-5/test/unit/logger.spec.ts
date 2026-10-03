import { expect } from 'chai';
import { Logger, REDACTED, type LogLevel } from '../../src/core/logger/logger';

function capture(level: LogLevel = 'debug', pretty = false) {
  const lines: Array<{ line: string; level: string }> = [];
  const logger = new Logger({
    level,
    pretty,
    sink: (line, lvl) => lines.push({ line, level: lvl }),
  });
  const parsed = () => lines.map((l) => JSON.parse(l.line) as Record<string, unknown>);
  return { logger, lines, parsed };
}

describe('logger', () => {
  describe('level filtering', () => {
    it('drops entries below the configured level', () => {
      const { logger, parsed } = capture('warn');
      logger.debug('d');
      logger.info('i');
      logger.warn('w');
      logger.error('e');
      expect(parsed().map((l) => l.msg)).to.deep.equal(['w', 'e']);
    });

    it('emits nothing when silent', () => {
      const { logger, lines } = capture('silent');
      logger.error('boom');
      expect(lines).to.have.length(0);
    });
  });

  describe('JSON output', () => {
    it('writes time, level, msg and fields', () => {
      const { logger, parsed } = capture();
      logger.info('hello', { userId: 7 });
      const [entry] = parsed();
      expect(entry).to.include({ level: 'info', msg: 'hello', userId: 7 });
      expect(new Date(entry?.time as string).toString()).to.not.equal('Invalid Date');
    });

    it('does not let fields overwrite core keys', () => {
      const { logger, parsed } = capture();
      logger.info('real', { msg: 'fake', level: 'error' });
      expect(parsed()[0]).to.include({ msg: 'real', level: 'info' });
    });

    it('routes errors to the error stream', () => {
      const { logger, lines } = capture();
      logger.info('a');
      logger.error('b');
      expect(lines.map((l) => l.level)).to.deep.equal(['info', 'error']);
    });
  });

  describe('child loggers', () => {
    it('merges bindings and keeps the parent unchanged', () => {
      const { logger, parsed } = capture();
      const child = logger.child({ requestId: 'r1' }).child({ route: '/x' });
      child.info('in child', { extra: true });
      logger.info('in parent');
      const [fromChild, fromParent] = parsed();
      expect(fromChild).to.include({ requestId: 'r1', route: '/x', extra: true });
      expect(fromParent).to.not.have.property('requestId');
    });
  });

  describe('error serialization', () => {
    it('expands Error objects into name, message and stack', () => {
      const { logger, parsed } = capture();
      logger.error('failed', { err: new TypeError('bad input') });
      const err = parsed()[0]?.err as Record<string, unknown>;
      expect(err).to.include({ name: 'TypeError', message: 'bad input' });
      expect(err.stack).to.be.a('string');
    });
  });

  describe('redaction', () => {
    it('masks sensitive keys at any depth', () => {
      const { logger, parsed } = capture();
      logger.info('login', {
        password: 'hunter2',
        headers: { Authorization: 'Bearer abc', accept: 'json' },
        list: [{ apiKey: 'k' }],
      });
      const entry = parsed()[0] as {
        password: string;
        headers: Record<string, string>;
        list: Array<Record<string, string>>;
      };
      expect(entry.password).to.equal(REDACTED);
      expect(entry.headers.Authorization).to.equal(REDACTED);
      expect(entry.headers.accept).to.equal('json');
      expect(entry.list[0]?.apiKey).to.equal(REDACTED);
    });
  });

  describe('pretty output', () => {
    it('writes a single readable line instead of JSON', () => {
      const { logger, lines } = capture('debug', true);
      logger.warn('careful', { a: 1 });
      expect(lines).to.have.length(1);
      expect(lines[0]?.line).to.include('WARN').and.include('careful').and.include('{"a":1}');
    });
  });
});
