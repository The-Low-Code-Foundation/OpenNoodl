/**
 * ALPHA-007 §3 — the error tail.
 *
 * A bug report without the error text costs a round trip, and in an alpha a
 * round trip usually means the report dies. So the composer attaches one — but
 * §3 is explicit that the existing log is **not attachable raw**, and reading
 * the mechanism confirms why:
 *
 * - ~~`bugtracker.ts` tees *every* `console.log` into
 *   `<userData>/debug/log-<date>.txt`, with up to 10,000 characters of attached
 *   data per line. That is project content by the megabyte.~~ True when written;
 *   **fixed by ALPHA-003** — `console.log` is no longer captured at all and
 *   every field goes through this directory's own `redact`.
 * - The same directory holds `git-*-merge-*.json`, which are whole project
 *   graphs written by the merge driver (`PRIVACY.md` §5 says so). Still true,
 *   and still the reason the log is not attachable wholesale.
 * - ~~The file has **no timestamps**.~~ It does now (ALPHA-003). The ring
 *   buffer below stays regardless: it answers "what was on screen just before
 *   the reporter clicked" without reading a file off disk, which is a different
 *   question from "what did this session record".
 * - ~~`bugtracker` is disabled when `Config.devMode` is set, so in a build run
 *   from source the file does not exist.~~ **This was wrong.** `Config.devMode`
 *   has never been set in any build — `config-dev.js` is not referenced by
 *   anything, and the only config swap in the repo
 *   (`scripts/noodl-editor/build-editor.ts:20-21`) copies `config-dist.js`,
 *   which does not declare it. The file exists in a source build too; a `npm run
 *   dev` checkout had accumulated 465 of them. Corrected 2026-08-06, ALPHA-003.
 *
 * So this module keeps its own ring buffer instead: errors and warnings only,
 * timestamped, bounded, in memory, never written anywhere until the reporter
 * sends. It costs one wrapper on `console.error`/`console.warn` and two window
 * listeners, and it makes "the last few minutes" a real query.
 *
 * It deliberately does **not** hook `window.onerror`: `bugtracker` assigns that
 * property directly, and an assignment would silently replace it. The `error`
 * event listener sees the same failures without the fight.
 *
 * @module utils/report/errorTail
 */

import { RedactorOptions, redact } from './redact';

export type ErrorLevel = 'error' | 'warn';

export interface ErrorTailEntry {
  /** `Date.now()` at capture. */
  at: number;
  level: ErrorLevel;
  text: string;
}

/** Bounded so a runaway loop cannot grow the editor's heap. */
const MAX_ENTRIES = 200;
/** Per entry, before redaction. A stack trace is long; a serialised graph is longer. */
const MAX_ENTRY_CHARS = 2000;

const entries: ErrorTailEntry[] = [];
let installed = false;
/** Guards against a handler whose own logging re-enters the wrapper. */
let capturing = false;

/** Render one console argument without throwing on a circular object. */
function stringifyArgument(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.stack || `${value.name}: ${value.message}`;
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  try {
    return JSON.stringify(value);
  } catch (_error) {
    return String(value);
  }
}

export function recordError(level: ErrorLevel, ...args: unknown[]): void {
  const text = args.map(stringifyArgument).join(' ').slice(0, MAX_ENTRY_CHARS);
  if (!text.trim()) return;

  entries.push({ at: Date.now(), level, text });
  if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
}

/** Everything captured. Callers filter; this stays dumb. */
export function getErrorTail(): readonly ErrorTailEntry[] {
  return entries;
}

/** Only used by tests and by the composer's "clear" affordance. */
export function clearErrorTail(): void {
  entries.length = 0;
}

/**
 * Install the capture. Idempotent — HMR re-runs module bodies, and a second
 * wrapper around an already-wrapped `console.error` would double every entry.
 */
export function installErrorCapture(): void {
  if (installed) return;
  installed = true;

  if (typeof console !== 'undefined') {
    const wrap = (level: ErrorLevel, original: (...args: unknown[]) => void) =>
      function (this: unknown, ...args: unknown[]) {
        if (!capturing) {
          capturing = true;
          try {
            recordError(level, ...args);
          } catch (_error) {
            // A reporter that breaks logging is worse than a missing report.
          } finally {
            capturing = false;
          }
        }
        original.apply(console, args);
      };

    console.error = wrap('error', console.error.bind(console));
    console.warn = wrap('warn', console.warn.bind(console));
  }

  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('error', (event: ErrorEvent) => {
      const where = event.filename ? ` (${event.filename}:${event.lineno}:${event.colno})` : '';
      recordError('error', (event.error && event.error.stack) || event.message || 'Uncaught error', where);
    });

    window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
      recordError('error', 'Unhandled promise rejection:', event.reason);
    });
  }
}

export interface FormatErrorTailOptions extends RedactorOptions {
  /** Reference time for the relative stamps. Defaults to now. */
  now?: number;
  /** How far back to look. §3: "from the last few minutes". */
  windowMs?: number;
  /** Cap on the rendered result, newest kept. */
  maxChars?: number;
}

function stamp(deltaMs: number): string {
  const seconds = Math.max(0, Math.round(deltaMs / 1000));
  const minutes = Math.floor(seconds / 60);
  return `-${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

/**
 * Render the tail for the `errors` form field, redacted.
 *
 * Pure over its inputs so the redaction can be demonstrated rather than argued
 * (criterion 4). Returns `''` when there is nothing in the window — an empty
 * `errors` field is a true statement and better than a placeholder.
 */
export function formatErrorTail(
  source: readonly ErrorTailEntry[],
  options: FormatErrorTailOptions = {}
): { text: string; count: number } {
  const now = options.now ?? Date.now();
  const windowMs = options.windowMs ?? 5 * 60 * 1000;
  const maxChars = options.maxChars ?? 3000;

  const recent = source.filter((entry) => now - entry.at <= windowMs);
  if (!recent.length) return { text: '', count: 0 };

  const lines = recent.map(
    (entry) => `${stamp(now - entry.at)}  ${entry.level.toUpperCase()}  ${redact(entry.text, options)}`
  );

  let text = lines.join('\n');
  if (text.length > maxChars) {
    // Newest last, so keep the end and say what was dropped.
    text = '[older lines omitted]\n' + text.slice(text.length - maxChars);
  }

  return { text, count: recent.length };
}
