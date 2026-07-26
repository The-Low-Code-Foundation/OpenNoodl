/**
 * Structured logging (BAK-009).
 *
 * One line per event, JSON, on stdout. The service is always supervised —
 * journald under systemd, the docker log driver in a container, the editor's
 * supervisor in dev — so stdout IS the log transport and shipping is somebody
 * else's job (the phase's single-process scope).
 *
 * Shape of every line:
 *
 *   {"ts":"2026-07-26T…Z","level":"info","event":"request","requestId":"…", …}
 *
 * `ts`/`level`/`event` first and always present, so `jq 'select(.level=="error")'`
 * and a plain `grep` both work. Everything else is per-event fields, and every
 * field passes through `redact()` on the way out — a caller cannot log a secret
 * by handing this class a config object, which is the point of routing all
 * logging through one door.
 *
 * `pretty` mode is the same data, laid out for a human reading a terminal. It
 * is not a different log: dropping to pretty never hides a field.
 *
 * @module nodegx-backend/ops/logger
 */

import { LogFormat, LogLevel } from './model';
import { redact } from './redact';

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };

export interface LoggerOptions {
  level?: LogLevel;
  format?: LogFormat;
  /** Where lines go. Defaults to process.stdout.write. Tests capture here. */
  write?: (line: string) => void;
  /** Fields stamped onto every line (backendId, pid). */
  base?: Record<string, unknown>;
  /** Overrides the `format:'auto'` TTY probe (tests). */
  isTTY?: boolean;
}

export type LogFields = Record<string, unknown>;

export class Logger {
  private level: LogLevel;
  private format: 'json' | 'pretty';
  private readonly write: (line: string) => void;
  private readonly base: Record<string, unknown>;

  constructor(options: LoggerOptions = {}) {
    // An explicitly-constructed logger does what its caller asked; the env
    // override fills in only where nothing was specified — which is exactly
    // the process-wide singleton below, the one an operator means when they
    // set NODEGX_LOG_LEVEL.
    this.level = options.level || envLogLevel() || 'info';
    this.format = resolveFormat(options.format || envLogFormat() || 'auto', options.isTTY);
    this.base = options.base || {};
    this.write =
      options.write ||
      ((line: string) => {
        try {
          process.stdout.write(line);
        } catch {
          // A broken pipe (the supervisor went away) must never take the
          // service down with it — the same EPIPE stance as WorkflowRunner.
        }
      });
  }

  /**
   * Reconfigure a live logger — ops.json is editable at runtime.
   *
   * `NODEGX_LOG_LEVEL` / `NODEGX_LOG_FORMAT` win over anything passed here.
   * The env var is the more immediate instruction: it is how an operator turns
   * up the detail on a service that is misbehaving right now, without editing
   * a file inside a container and without a restart loop to get it back.
   */
  configure(options: { level?: LogLevel; format?: LogFormat; isTTY?: boolean }): void {
    const level = envLogLevel() || options.level;
    if (level) this.level = level;
    const format = envLogFormat() || options.format;
    if (format) this.format = resolveFormat(format, options.isTTY);
  }

  get currentLevel(): LogLevel {
    return this.level;
  }

  isEnabled(level: LogLevel): boolean {
    return LEVEL_ORDER[level] >= LEVEL_ORDER[this.level] && this.level !== 'silent';
  }

  debug(event: string, fields?: LogFields): void {
    this.log('debug', event, fields);
  }
  info(event: string, fields?: LogFields): void {
    this.log('info', event, fields);
  }
  warn(event: string, fields?: LogFields): void {
    this.log('warn', event, fields);
  }
  error(event: string, fields?: LogFields): void {
    this.log('error', event, fields);
  }

  log(level: LogLevel, event: string, fields?: LogFields): void {
    if (!this.isEnabled(level)) return;
    const record: Record<string, unknown> = {
      ts: new Date().toISOString(),
      level,
      event,
      ...this.base,
      ...((redact(fields || {}) as Record<string, unknown>) || {})
    };
    this.write(this.format === 'pretty' ? prettyLine(record) : `${safeStringify(record)}\n`);
  }
}

function envLogLevel(): LogLevel | undefined {
  const value = process.env.NODEGX_LOG_LEVEL as LogLevel | undefined;
  return value && value in LEVEL_ORDER ? value : undefined;
}

function envLogFormat(): LogFormat | undefined {
  const value = process.env.NODEGX_LOG_FORMAT;
  return value === 'json' || value === 'pretty' || value === 'auto' ? value : undefined;
}

function resolveFormat(format: LogFormat, isTTY?: boolean): 'json' | 'pretty' {
  if (format === 'json' || format === 'pretty') return format;
  // `auto`: a human is watching a terminal => pretty; anything else (systemd,
  // docker, the editor's supervisor, a pipe into a file) => JSON, because those
  // are the cases where something downstream wants to parse it.
  const tty = isTTY !== undefined ? isTTY : Boolean(process.stdout && process.stdout.isTTY);
  return tty ? 'pretty' : 'json';
}

const LEVEL_LABEL: Record<LogLevel, string> = {
  debug: 'DEBUG',
  info: 'INFO ',
  warn: 'WARN ',
  error: 'ERROR',
  silent: '     '
};

function prettyLine(record: Record<string, unknown>): string {
  const { ts, level, event, ...rest } = record;
  const time = typeof ts === 'string' ? ts.slice(11, 23) : '';
  const detail = Object.entries(rest)
    .map(([k, v]) => `${k}=${formatScalar(v)}`)
    .join(' ');
  return `${time} ${LEVEL_LABEL[level as LogLevel] || level} ${event}${detail ? ' ' + detail : ''}\n`;
}

function formatScalar(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'string') return /\s/.test(value) ? JSON.stringify(value) : value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return safeStringify(value);
}

/** JSON.stringify that survives cycles and BigInt rather than throwing mid-log. */
function safeStringify(value: unknown): string {
  const seen = new WeakSet<object>();
  try {
    return JSON.stringify(value, (_key, v) => {
      if (typeof v === 'bigint') return String(v);
      if (typeof v === 'object' && v !== null) {
        if (seen.has(v as object)) return '[circular]';
        seen.add(v as object);
      }
      return v;
    });
  } catch (e) {
    return JSON.stringify({ logError: e instanceof Error ? e.message : String(e) });
  }
}

/**
 * The process-wide logger. A module-level singleton is right here for the same
 * reason `_noodl_cloudservices` is: one service process serves exactly one
 * backend, and the alternative — threading a logger through every constructor
 * in the tree — would guarantee that the awkward call sites keep using
 * `console.log` instead.
 */
export const logger = new Logger();
