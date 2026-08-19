/**
 * NAT-005 — the words a community row says about *when* and *how answered*.
 *
 * ## Why these are pure functions in core-ui and not inline in a renderer
 *
 * Two surfaces draw these rows — the launcher's Community tab and the editor's rail panel — and
 * `noodl-core-ui` cannot import `noodl-editor`, so the shared half has to live here. It is also
 * the only half a test can reach: this checkout's jest runs have **no DOM**, so a string these
 * functions return is gradeable and a pixel is not. Everything with a decision in it is therefore
 * a function here, and the components below this file only place what these return.
 *
 * ## 🔴 A timestamp off this API is NOT reliably ISO-8601
 *
 * NAT-006 (2026-08-19) found a column declared `Date` arriving as Postgres's own text —
 * `2026-08-19 18:58:53.754123+00` — because postgres.js resolves type parsers per *connection*,
 * so the same query answers differently once the pool opens a second one. The platform's page
 * code met this first and defended locally without recording it (`lists.ts` wraps every date
 * comparator in `new Date(...)`), and one site that had not — `/people`'s "recently active" sort
 * — was a 500 waiting for a pooled connection.
 *
 * ⚠️ **So nothing here trusts the shape of its input.** V8 happens to parse both spellings, which
 * is *why* this is dangerous: the failure is not a throw, it is `NaN` reaching a user as
 * "NaN days ago". Every function returns `null` for anything it could not read, and the row draws
 * no meta line rather than a wrong one. `nat-005/community-meta.test.ts` feeds them the exact
 * Postgres string from that finding, plus a control that must still come back `null`.
 *
 * ## ⚠️ Formatting is fixed, not localised
 *
 * `toLocaleDateString` reads as the polite choice and would make every assertion below a fact
 * about the machine that ran it. The editor ships one English UI; a date that renders one way in
 * CI and another on a French laptop is a spec that passes everywhere and describes nowhere.
 *
 * @module noodl-core-ui/components/community/communityMeta
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Parse a timestamp the API sent, or give up.
 *
 * 🔴 The give-up is the point. See the header: both spellings parse, garbage yields `NaN`, and
 * `NaN` is what reaches a reader as words if nothing checks.
 */
function parse(value: string | null | undefined): Date | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const at = new Date(value);
  return Number.isNaN(at.getTime()) ? null : at;
}

/** `14 Mar 2026` — fixed spelling, see the header on why this is not `toLocaleDateString`. */
export function absoluteDate(value: string | null | undefined): string | null {
  const at = parse(value);
  if (!at) return null;
  return `${at.getDate()} ${MONTHS[at.getMonth()]} ${at.getFullYear()}`;
}

/**
 * How long ago, in the vocabulary a person would use out loud.
 *
 * ⚠️ **A future timestamp reads as "just now", never as a negative.** Clock skew between a
 * laptop and the platform is ordinary, and "in −3 minutes" is the kind of string that makes a
 * reader distrust the whole surface for a fault that is nobody's.
 *
 * Past ~4 weeks it stops counting and states the date: "7 weeks ago" is a number a reader has to
 * convert, and the conversion is the thing they wanted in the first place.
 */
export function relativeTime(value: string | null | undefined, now: Date | number = Date.now()): string | null {
  const at = parse(value);
  if (!at) return null;

  const delta = (typeof now === 'number' ? now : now.getTime()) - at.getTime();
  if (delta < MINUTE) return 'just now';
  if (delta < HOUR) return plural(Math.floor(delta / MINUTE), 'minute');
  if (delta < DAY) return plural(Math.floor(delta / HOUR), 'hour');
  if (delta < 2 * DAY) return 'yesterday';
  if (delta < WEEK) return plural(Math.floor(delta / DAY), 'day');
  if (delta < 4 * WEEK) return plural(Math.floor(delta / WEEK), 'week');
  return absoluteDate(value);
}

function plural(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? '' : 's'} ago`;
}

/**
 * What happened to a question — the half of a thread row a reader actually scans for.
 *
 * 🔴 **`null` minutes means nobody has answered, and that is the row worth drawing loudest.**
 * It is also the value the health readout counts as `unreplied`, so a row that stayed silent
 * about it would leave the tab quoting a number no row on the page accounts for.
 */
export function replyLatency(minutes: number | null | undefined): string | null {
  if (minutes === null || minutes === undefined) return 'no reply yet';
  if (!Number.isFinite(minutes) || minutes < 0) return null;
  if (minutes < 60) return `answered in ${Math.round(minutes)} min`;
  if (minutes < 48 * 60) return `answered in ${Math.round(minutes / 60)}h`;
  return `answered in ${Math.round(minutes / (60 * 24))} days`;
}

/**
 * "Tutorial", "Tip" — the `kind` column's raw value is a lower-case slug.
 *
 * ⚠️ This is deliberately the same rule as the platform's own `kindLabel` in `src/lib/articles.ts`
 * and deliberately not an import of it: the column is open text with a default of `tutorial`, so
 * a closed map here would render a new kind as nothing at all the day somebody adds one.
 */
export function kindLabel(kind: string | null | undefined): string | null {
  if (typeof kind !== 'string') return null;
  const trimmed = kind.trim();
  if (trimmed === '') return null;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/**
 * Join the parts of a meta line, dropping the ones that came back `null`.
 *
 * ⚠️ Separator is a middle dot with spaces — the same one the viewer line already uses. A row
 * whose every part was unreadable returns `null` and draws no line, rather than a lone bullet.
 */
export function metaLine(parts: (string | null | undefined)[]): string | null {
  const kept = parts.filter((p): p is string => typeof p === 'string' && p !== '');
  return kept.length === 0 ? null : kept.join(' · ');
}
