/**
 * A small, self-contained standard-cron parser (WF-005).
 *
 * The spec suggested "a small, maintained cron-parse library." We deliberately
 * hand-roll a bounded, well-tested parser instead, for one reason: the service
 * ships as a SINGLE esbuild bundle with NO node_modules resolution at runtime
 * (build.js externals only `node:sqlite`), and it must run under system Node on
 * a deploy target and under ELECTRON_RUN_AS_NODE when the editor spawns it.
 * Pulling an npm cron dependency into that artifact — and into the hermetic jest
 * run — buys risk we don't need: standard 5-field cron is a bounded, fully
 * specifiable grammar. This module implements it and is property/unit-tested in
 * tests/cron.test.ts. (Documented as a deliberate spec deviation in the task
 * report so the orchestrator can swap in a library later without touching
 * callers — the surface is just `parseCron` + `CronExpression.next`.)
 *
 * Grammar (Vixie-cron compatible subset):
 *   minute hour day-of-month month day-of-week
 *   fields: `*`, `n`, `a-b`, `a-b/step`, `* /step`, comma-lists of those
 *   month names JAN..DEC and day names SUN..SAT (case-insensitive) accepted
 *   day-of-week 0 or 7 = Sunday
 *   presets: @yearly/@annually @monthly @weekly @daily/@midnight @hourly
 *            @minutely (non-standard convenience)
 *
 * Day-of-month vs day-of-week follows the standard rule: when BOTH are
 * restricted (neither is `*`), a date matches if EITHER field matches.
 *
 * Times are evaluated in the service's LOCAL timezone (documented). `next()`
 * scans minute-by-minute with a hard 4-year cap so an impossible expression
 * (e.g. Feb 30) fails loudly rather than looping forever.
 *
 * @module nodegx-backend/triggers/cron
 */

export class CronParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CronParseError';
  }
}

const MONTH_NAMES: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
};
const DOW_NAMES: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6
};

const PRESETS: Record<string, string> = {
  '@yearly': '0 0 1 1 *',
  '@annually': '0 0 1 1 *',
  '@monthly': '0 0 1 * *',
  '@weekly': '0 0 * * 0',
  '@daily': '0 0 * * *',
  '@midnight': '0 0 * * *',
  '@hourly': '0 * * * *',
  '@minutely': '* * * * *'
};

interface Field {
  /** Every allowed value, expanded. */
  values: Set<number>;
  /** True when the source token was exactly `*` (drives the DOM/DOW OR rule). */
  wildcard: boolean;
}

/** Expand one field token (which may be a comma-list) against [min,max]. */
function parseField(token: string, min: number, max: number, names?: Record<string, number>): Field {
  const values = new Set<number>();
  let wildcard = false;

  for (const part of token.split(',')) {
    const piece = part.trim();
    if (piece === '') throw new CronParseError(`empty term in "${token}"`);

    let range = piece;
    let step = 1;
    const slash = piece.indexOf('/');
    if (slash !== -1) {
      range = piece.slice(0, slash);
      const stepStr = piece.slice(slash + 1);
      step = Number(stepStr);
      if (!Number.isInteger(step) || step <= 0) throw new CronParseError(`invalid step "${stepStr}" in "${token}"`);
    }

    let lo: number;
    let hi: number;
    if (range === '*') {
      lo = min;
      hi = max;
      if (slash === -1) wildcard = true;
    } else {
      const dash = range.indexOf('-');
      if (dash > 0) {
        lo = resolveName(range.slice(0, dash), names);
        hi = resolveName(range.slice(dash + 1), names);
      } else {
        lo = resolveName(range, names);
        hi = slash === -1 ? lo : max; // `n/step` means n, n+step, ... up to max
      }
    }

    if (!Number.isInteger(lo) || !Number.isInteger(hi)) throw new CronParseError(`invalid value in "${token}"`);
    if (lo < min || hi > max || lo > hi) {
      throw new CronParseError(`value out of range [${min}-${max}] in "${token}"`);
    }
    for (let v = lo; v <= hi; v += step) values.add(v);
  }

  if (values.size === 0) throw new CronParseError(`field "${token}" matched no values`);
  return { values, wildcard };
}

function resolveName(raw: string, names?: Record<string, number>): number {
  const trimmed = raw.trim();
  if (names) {
    const named = names[trimmed.toLowerCase()];
    if (named !== undefined) return named;
  }
  const n = Number(trimmed);
  if (!Number.isInteger(n)) throw new CronParseError(`not a number or known name: "${raw}"`);
  return n;
}

export class CronExpression {
  private readonly minute: Field;
  private readonly hour: Field;
  private readonly dom: Field;
  private readonly month: Field;
  private readonly dow: Field;

  constructor(readonly source: string, fields: [Field, Field, Field, Field, Field]) {
    [this.minute, this.hour, this.dom, this.month, this.dow] = fields;
  }

  /** Does this expression fire during the minute containing `date`? */
  matches(date: Date): boolean {
    if (!this.minute.values.has(date.getMinutes())) return false;
    if (!this.hour.values.has(date.getHours())) return false;
    if (!this.month.values.has(date.getMonth() + 1)) return false;

    const domMatch = this.dom.values.has(date.getDate());
    // getDay(): 0=Sun..6=Sat. Our dow set already normalized 7->0.
    const dowMatch = this.dow.values.has(date.getDay());

    // Standard rule: both restricted => OR; otherwise the restricted one wins.
    if (!this.dom.wildcard && !this.dow.wildcard) return domMatch || dowMatch;
    return domMatch && dowMatch;
  }

  /**
   * The first firing strictly AFTER `after`. Scans minute-by-minute (cheap and
   * exact) with a 4-year cap; an expression that can never fire throws rather
   * than spinning — loud failure over a hang.
   */
  next(after: Date = new Date()): Date {
    const d = new Date(after.getTime());
    d.setSeconds(0, 0);
    d.setMinutes(d.getMinutes() + 1); // strictly after
    const capMs = 366 * 4 * 24 * 60 * 60 * 1000;
    const limit = d.getTime() + capMs;
    while (d.getTime() <= limit) {
      if (this.matches(d)) return d;
      d.setMinutes(d.getMinutes() + 1);
    }
    throw new CronParseError(`cron expression "${this.source}" has no next fire within 4 years — unreachable schedule`);
  }
}

/** Parse a cron string (5-field or @preset) into a CronExpression. Throws on any error. */
export function parseCron(expression: string): CronExpression {
  const raw = (expression || '').trim();
  if (!raw) throw new CronParseError('empty cron expression');

  const normalized = raw.startsWith('@') ? PRESETS[raw.toLowerCase()] : raw;
  if (raw.startsWith('@') && !normalized) {
    throw new CronParseError(`unknown cron preset "${raw}" (known: ${Object.keys(PRESETS).join(', ')})`);
  }

  const parts = normalized.split(/\s+/);
  if (parts.length !== 5) {
    throw new CronParseError(`expected 5 fields (minute hour day-of-month month day-of-week), got ${parts.length}: "${raw}"`);
  }

  const minute = parseField(parts[0], 0, 59);
  const hour = parseField(parts[1], 0, 23);
  const dom = parseField(parts[2], 1, 31);
  const month = parseField(parts[3], 1, 12, MONTH_NAMES);
  const dowRaw = parseField(parts[4], 0, 7, DOW_NAMES);
  // Normalize 7 -> 0 (both mean Sunday) so matches() can use getDay() directly.
  const dowValues = new Set<number>();
  for (const v of dowRaw.values) dowValues.add(v === 7 ? 0 : v);
  const dow: Field = { values: dowValues, wildcard: dowRaw.wildcard };

  return new CronExpression(raw, [minute, hour, dom, month, dow]);
}

/** Validate a cron string; returns an error message or null. IO-free. */
export function validateCron(expression: string): string | null {
  try {
    parseCron(expression);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}
