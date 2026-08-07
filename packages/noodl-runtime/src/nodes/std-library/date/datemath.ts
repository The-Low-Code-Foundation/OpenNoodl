/**
 * Date arithmetic, decided once (CWF-011).
 *
 * ## What a `date` port carries
 *
 * A `Date`. `Date To String` — the whole date vocabulary before this task — declares
 * `type: { name: 'date' }` and its setter reads `typeof value === 'string' ? new Date(value) :
 * value`, so a string arriving on a date port has always been parsed. {@link toDate} keeps that
 * contract and widens it by one case: a **number** is epoch milliseconds. That matters because a
 * JSON round trip through a Request or Response node turns a `Date` into a string, and a
 * timestamp column turns it into a number — a date family that only worked while the value never
 * left the graph would be half a family.
 *
 * ## ⚠️ Months and years clamp. They do not overflow.
 *
 * "Add 1 month to 31 January" is **28 February** (29 in a leap year), not 2/3 March. Both answers
 * are defensible and the classic date bug is not knowing which one you have, so it is written
 * here, on both node pages, and in the name of the test that holds it. Same rule for years:
 * 29 February plus 1 year is 28 February.
 *
 * Every other unit is a fixed duration and is exact.
 */

/** The units every date node offers, in the order they appear in the enums. */
export type DateUnit = 'milliseconds' | 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'years';

/** Fixed-length units, in milliseconds. `months` and `years` are deliberately absent. */
const FIXED_MS: Partial<Record<DateUnit, number>> = {
  milliseconds: 1,
  seconds: 1000,
  minutes: 60 * 1000,
  hours: 60 * 60 * 1000,
  days: 24 * 60 * 60 * 1000,
  weeks: 7 * 24 * 60 * 60 * 1000
};

/** The enum options, declared once so four nodes cannot drift apart. */
export const UNIT_ENUMS = [
  { label: 'Milliseconds', value: 'milliseconds' },
  { label: 'Seconds', value: 'seconds' },
  { label: 'Minutes', value: 'minutes' },
  { label: 'Hours', value: 'hours' },
  { label: 'Days', value: 'days' },
  { label: 'Weeks', value: 'weeks' },
  { label: 'Months', value: 'months' },
  { label: 'Years', value: 'years' }
];

/**
 * Read anything a port might carry as a `Date`, or `undefined` when it cannot be read.
 *
 * `undefined` is the node's only validity check and is what drives the `Invalid Date` signal —
 * the failure shape `Date To String` already set.
 */
export function toDate(value: unknown): Date | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return undefined;
    const fromNumber = new Date(value);
    return Number.isNaN(fromNumber.getTime()) ? undefined : fromNumber;
  }
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }
  return undefined;
}

/**
 * `date` plus `amount` of `unit`.
 *
 * Months and years clamp to the end of the target month — see the module comment.
 */
export function addToDate(date: Date, amount: number, unit: DateUnit): Date {
  const fixed = FIXED_MS[unit];
  if (fixed !== undefined) return new Date(date.getTime() + amount * fixed);

  const whole = Math.trunc(amount);
  const result = new Date(date.getTime());
  const dayOfMonth = result.getDate();

  // Move to the 1st before shifting the month, so the shift itself can never roll over: setting
  // month 0 (January) on the 31st would otherwise land in March all by itself.
  result.setDate(1);
  if (unit === 'months') result.setMonth(result.getMonth() + whole);
  else if (unit === 'years') result.setFullYear(result.getFullYear() + whole);
  else throw new Error(`Unknown unit "${unit}".`);

  const lastDayOfTargetMonth = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(dayOfMonth, lastDayOfTargetMonth));
  return result;
}

/**
 * How much of `unit` separates `from` and `to` — positive when `to` is later.
 *
 * Fixed units divide exactly and are returned unrounded, so 36 hours is 1.5 days. Months and
 * years are counted in whole calendar steps, because "2.4 months" is not a quantity anyone can
 * check: the answer is the number of whole months you could `addToDate` and not overshoot.
 */
export function differenceBetween(from: Date, to: Date, unit: DateUnit): number {
  const fixed = FIXED_MS[unit];
  if (fixed !== undefined) return (to.getTime() - from.getTime()) / fixed;

  const sign = to.getTime() >= from.getTime() ? 1 : -1;
  const monthsApart =
    (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()) - (sign > 0 ? 0 : 0);

  // Trim the last step when it overshoots. The invariant this keeps is the one that matters:
  // `addToDate(from, differenceBetween(from, to, unit), unit)` never lands past `to`. So
  // 31 Jan → 28 Feb is **1** month (clamping puts Add(31 Jan, 1 month) exactly on 28 Feb), and
  // 31 Jan → 27 Feb is **0** (it would overshoot).
  let whole = monthsApart;
  if (sign > 0 && addToDate(from, whole, 'months').getTime() > to.getTime()) whole -= 1;
  if (sign < 0 && addToDate(from, whole, 'months').getTime() < to.getTime()) whole += 1;

  return unit === 'months' ? whole : Math.trunc(whole / 12);
}

/** Granularities `Date Compare` can compare at. */
export type CompareGranularity = 'millisecond' | 'second' | 'minute' | 'hour' | 'day' | 'month' | 'year';

/**
 * Truncate a date to a granularity, in the **host's local zone**.
 *
 * Local rather than UTC because "the same day" is a question about a calendar somebody is
 * looking at. On a server that calendar is whatever the container's TZ says — which is exactly
 * the trap `Date To String`'s new Timezone input exists for, and the reason this is stated here.
 */
export function truncateTo(date: Date, granularity: CompareGranularity): number {
  const d = new Date(date.getTime());
  switch (granularity) {
    case 'year':
      d.setMonth(0);
    // falls through
    case 'month':
      d.setDate(1);
    // falls through
    case 'day':
      d.setHours(0);
    // falls through
    case 'hour':
      d.setMinutes(0);
    // falls through
    case 'minute':
      d.setSeconds(0);
    // falls through
    case 'second':
      d.setMilliseconds(0);
      break;
    case 'millisecond':
      break;
  }
  return d.getTime();
}

/** ISO week number (1-53), ISO-8601: weeks start Monday and week 1 holds the first Thursday. */
export function isoWeek(date: Date): number {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  // Thursday of this ISO week decides which year the week belongs to.
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const firstThursday = new Date(d.getFullYear(), 0, 4);
  firstThursday.setDate(firstThursday.getDate() + 3 - ((firstThursday.getDay() + 6) % 7));
  return 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000));
}
