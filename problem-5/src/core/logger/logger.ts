export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';
export type LogFields = Record<string, unknown>;
type EmitLevel = Exclude<LogLevel, 'silent'>;

export interface LoggerOptions {
  level?: LogLevel;
  /** Readable single-line output instead of JSON lines. */
  pretty?: boolean;
  /** Fields added to every entry. */
  bindings?: LogFields;
  /** Output target; defaults to stdout (stderr for errors). */
  sink?: (line: string, level: EmitLevel) => void;
}

const WEIGHT: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };
const COLOR: Record<EmitLevel, string> = {
  debug: '\x1b[90m',
  info: '\x1b[32m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
};
const RESET = '\x1b[0m';
const SENSITIVE_KEY = /password|passwd|secret|token|authorization|api[-_]?key|cookie/i;
const MAX_DEPTH = 5;

export const REDACTED = '[REDACTED]';

export function isLogLevel(value: unknown): value is LogLevel {
  return typeof value === 'string' && value in WEIGHT;
}

/*this is a fake logger, in real project, we will use lib like pino or wind*/
export class Logger {
  private readonly level: LogLevel;
  private readonly pretty: boolean;
  private readonly bindings: LogFields;
  private readonly sink: NonNullable<LoggerOptions['sink']>;

  constructor(options: LoggerOptions = {}) {
    this.level = options.level ?? 'info';
    this.pretty = options.pretty ?? false;
    this.bindings = options.bindings ?? {};
    this.sink =
      options.sink ??
      ((line, level) => (level === 'error' ? process.stderr : process.stdout).write(`${line}\n`));
  }

  debug(msg: string, fields?: LogFields): void {
    this.log('debug', msg, fields);
  }

  info(msg: string, fields?: LogFields): void {
    this.log('info', msg, fields);
  }

  warn(msg: string, fields?: LogFields): void {
    this.log('warn', msg, fields);
  }

  error(msg: string, fields?: LogFields): void {
    this.log('error', msg, fields);
  }

  /** Returns a logger that adds `bindings` to every entry; the parent is unchanged. */
  child(bindings: LogFields): Logger {
    return new Logger({
      level: this.level,
      pretty: this.pretty,
      sink: this.sink,
      bindings: { ...this.bindings, ...bindings },
    });
  }

  private log(level: EmitLevel, msg: string, fields?: LogFields): void {
    if (WEIGHT[level] < WEIGHT[this.level]) return;
    const data = this.sanitize({ ...this.bindings, ...fields }, 0) as LogFields;
    this.sink(this.format(level, msg, data), level);
  }

  private format(level: EmitLevel, msg: string, data: LogFields): string {
    const time = new Date().toISOString();
    if (!this.pretty) {
      return JSON.stringify({ ...data, time, level, msg });
    }
    const color = process.stdout.isTTY ? COLOR[level] : '';
    const reset = color ? RESET : '';
    const extra = Object.keys(data).length > 0 ? ` ${JSON.stringify(data)}` : '';
    return `${time} ${color}${level.toUpperCase().padEnd(5)}${reset} ${msg}${extra}`;
  }

  /** Expands errors, masks sensitive keys, and bounds nesting depth. */
  private sanitize(value: unknown, depth: number): unknown {
    if (value instanceof Error) {
      const { name, message, stack, cause } = value;
      const code = (value as NodeJS.ErrnoException).code;
      return {
        name,
        message,
        stack,
        ...(code !== undefined && { code }),
        ...(cause !== undefined && { cause: this.sanitize(cause, depth + 1) }),
      };
    }
    if (value === null || typeof value !== 'object') {
      return typeof value === 'bigint' ? value.toString() : value;
    }
    if (depth >= MAX_DEPTH) return '[Truncated]';
    if (Array.isArray(value)) return value.map((v) => this.sanitize(v, depth + 1));
    if (value instanceof Date) return value.toISOString();

    const out: LogFields = {};
    for (const [key, val] of Object.entries(value)) {
      out[key] = SENSITIVE_KEY.test(key) ? REDACTED : this.sanitize(val, depth + 1);
    }
    return out;
  }
}
