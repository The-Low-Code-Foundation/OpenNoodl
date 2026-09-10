/**
 * CMP-005 — `Date To String` gains the tokens an app actually needs, and a Locale.
 *
 * The node shipped eight tokens, all zero-padded, all English, none of them a weekday — and its
 * own catalog `whenToUse` told the author to go and write a Function node with `Intl`. This suite
 * grades the two halves of that fix:
 *
 * - **AC2/AC4** — every new token and the Locale port, asserted as RENDERED STRINGS off one fixed
 *   instant. Not by reading the source for token names: a token that is listed in the port
 *   description and never substituted would pass that and fail a user.
 * - 🔴 **AC3** — the eight original tokens and the default format render EXACTLY what they
 *   rendered before, in both the local-zone and the `timeZone` branch. The expectations in
 *   `THE ORIGINAL RENDERINGS` below were captured by running the UNMODIFIED node at
 *   `aedcc4d79`, before a line of this task's code existed, and pasted here verbatim. That is the
 *   only honest form of a before/after when the "before" is already gone.
 *
 * ⚠️ Every local-zone case is built with `new Date(y, m, d, …)`, so the fields the node reads back
 * are the fields it was given whatever `TZ` the runner has. The zone cases use a UTC instant and a
 * named IANA zone, which is the same instant everywhere.
 */

import { createNode } from '../helpers/node-harness';

import DateToStringModule = require('../../src/nodes/std-library/datetostring');

const local = (y: number, m: number, d: number, h = 0, min = 0, s = 0) => new Date(y, m - 1, d, h, min, s);

const render = (date: Date, format?: string, timeZone?: string, locale?: string) => {
  const node = createNode(DateToStringModule, 'Date To String');
  if (format) node.node.setInputValue('formatString', format);
  if (timeZone !== undefined) node.node.setInputValue('timeZone', timeZone);
  if (locale !== undefined) node.node.setInputValue('locale', locale);
  node.node.setInputValue('input', date);
  return node.out('currentValue');
};

/** Thursday 10 September 2026, 15:05:07 — one instant, every assertion below reads it. */
const INSTANT = local(2026, 9, 10, 15, 5, 7);
/** The same, with every field a single digit, which is where padding shows. */
const SINGLE_DIGITS = local(2026, 3, 4, 9, 8, 7);

const ALL_ORIGINAL = '{date}|{month}|{monthShort}|{year}|{yearShort}|{hours}|{minutes}|{seconds}';

describe('AC3 — the original tokens render byte-identically (CMP-005)', () => {
  /**
   * 🔴 Captured from the node as it stood BEFORE this task, at `aedcc4d79`. If one of these
   * moves, a shipped project's dates have changed and the AC has failed — this is the only
   * assertion in the phase whose failure reaches somebody else's app.
   */
  it('renders the default format and all eight tokens as it always did', () => {
    expect(render(INSTANT)).toBe('2026-09-10');
    expect(render(INSTANT, ALL_ORIGINAL)).toBe('10|09|Sep|2026|26|15|05|07');
    expect(render(SINGLE_DIGITS, ALL_ORIGINAL)).toBe('04|03|Mar|2026|26|09|08|07');
    expect(render(local(2026, 9, 10, 0, 0, 0), ALL_ORIGINAL)).toBe('10|09|Sep|2026|26|00|00|00');
    expect(render(local(2026, 9, 10, 12, 0, 0), ALL_ORIGINAL)).toBe('10|09|Sep|2026|26|12|00|00');
  });

  it('renders them identically in the timeZone branch too', () => {
    // 22:30 UTC on the 10th: already the 11th in Tokyo, still the afternoon in New York.
    const instant = new Date('2026-09-10T22:30:00.000Z');
    expect(render(instant, ALL_ORIGINAL, 'Asia/Tokyo')).toBe('11|09|Sep|2026|26|07|30|00');
    expect(render(instant, ALL_ORIGINAL, 'UTC')).toBe('10|09|Sep|2026|26|22|30|00');
    expect(render(instant, ALL_ORIGINAL, 'America/New_York')).toBe('10|09|Sep|2026|26|18|30|00');
  });

  it('still blanks the output and fires Invalid Date for an unreadable date', () => {
    const node = createNode(DateToStringModule, 'Date To String');
    node.node.setInputValue('formatString', '{dayName} {monthName} {ordinal}');
    node.node.setInputValue('input', new Date('nonsense'));
    expect(node.out('currentValue')).toBe('');
    expect(node.signals).toContain('onError');
  });

  it('leaves an unknown token alone, which is how the new ones used to render', () => {
    // "everything else is copied through" — the node's own contract, and the reason a project
    // written before this change that happens to contain `{dayName}` was printing it literally.
    expect(render(INSTANT, 'x {notAToken} y')).toBe('x {notAToken} y');
  });
});

describe('AC2 — the tokens an app actually needs (CMP-005)', () => {
  it('renders a weekday, long and short', () => {
    expect(render(INSTANT, '{dayName}')).toBe('Thursday');
    expect(render(INSTANT, '{dayShort}')).toBe('Thu');
    expect(render(SINGLE_DIGITS, '{dayName} {dayShort}')).toBe('Wednesday Wed');
  });

  it('renders a full month name beside the short one', () => {
    expect(render(INSTANT, '{monthName}')).toBe('September');
    expect(render(INSTANT, '{monthName} {monthShort} {month} {m}')).toBe('September Sep 09 9');
  });

  it('renders a 12-hour clock with a meridiem, and gets midnight and noon right', () => {
    expect(render(INSTANT, '{h12}:{minutes} {ampm}')).toBe('3:05 pm');
    expect(render(INSTANT, '{hours12}:{minutes}{AMPM}')).toBe('03:05PM');
    // 🔴 The two hours a naive `% 12` renders as "0".
    expect(render(local(2026, 9, 10, 0, 30), '{h12}:{minutes} {ampm}')).toBe('12:30 am');
    expect(render(local(2026, 9, 10, 12, 30), '{h12}:{minutes} {ampm}')).toBe('12:30 pm');
    expect(render(local(2026, 9, 10, 23, 59), '{h12}:{minutes} {ampm}')).toBe('11:59 pm');
  });

  it('renders unpadded numbers for every field that has a padded one', () => {
    expect(render(SINGLE_DIGITS, '{d}/{m}/{year} {h}:{min}:{s}')).toBe('4/3/2026 9:8:7');
    // …and the padded ones are still padded in the same string.
    expect(render(SINGLE_DIGITS, '{date}/{month} {hours}:{minutes}:{seconds}')).toBe('04/03 09:08:07');
    expect(render(local(2026, 9, 10, 0, 0, 0), '{h}:{min}:{s}')).toBe('0:0:0');
  });

  it('renders an ordinal, including the three every naive version gets wrong', () => {
    const ordinal = (day: number) => render(local(2026, 1, day), '{ordinal}');
    expect([1, 2, 3, 4].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th']);
    expect([11, 12, 13].map(ordinal)).toEqual(['11th', '12th', '13th']);
    expect([21, 22, 23, 31].map(ordinal)).toEqual(['21st', '22nd', '23rd', '31st']);
  });

  it('🔴 renders a moment/date-fns pattern as LITERAL TEXT — the corpus got this wrong', () => {
    // `docs/node-catalog/examples/logic-autosave-after-typing.json` shipped
    // `"formatString": "HH:mm:ss"`, which is moment syntax. This node substitutes brace tokens
    // and copies everything else through, so that example's status line read
    // "Saved a1b2c3d4 at HH:mm:ss" — the letters, not a time. The example gate checks that
    // `formatString` is a real PORT, never that its VALUE means anything, so it validated clean.
    expect(render(INSTANT, 'HH:mm:ss')).toBe('HH:mm:ss');
    expect(render(INSTANT, 'YYYY-MM-DD')).toBe('YYYY-MM-DD');
    // The fix the corpus now carries.
    expect(render(INSTANT, '{hours}:{minutes}:{seconds}')).toBe('15:05:07');
  });

  it('renders the sentence the task was opened for', () => {
    // Richard's complaint, in one format string: neither of these was reachable before.
    expect(render(INSTANT, '{dayName}, {d} {monthName} {year}')).toBe('Thursday, 10 September 2026');
    expect(render(INSTANT, '{h12}:{minutes} {ampm}')).toBe('3:05 pm');
  });

  it('reads the new tokens in the named zone, not the host zone', () => {
    // 22:30 UTC is the NEXT DAY in Tokyo — so the weekday has to roll with the date.
    const instant = new Date('2026-09-10T22:30:00.000Z');
    expect(render(instant, '{dayName} {d} {monthName} {h12}{ampm}', 'Asia/Tokyo')).toBe('Friday 11 September 7am');
    expect(render(instant, '{dayName} {d} {monthName} {h12}{ampm}', 'America/New_York')).toBe(
      'Thursday 10 September 6pm'
    );
  });

  it('re-renders when Format changes, without a new date arriving', () => {
    const node = createNode(DateToStringModule, 'Date To String');
    node.node.setInputValue('input', INSTANT);
    expect(node.out('currentValue')).toBe('2026-09-10');
    node.node.setInputValue('formatString', '{dayName}');
    expect(node.out('currentValue')).toBe('Thursday');
  });
});

describe('AC4 — the locale stops being hardcoded (CMP-005)', () => {
  it('defaults to en-US, so a project that never touches the port is unchanged', () => {
    expect(render(INSTANT, '{dayName} {monthName} {monthShort}')).toBe('Thursday September Sep');
    // An explicitly empty Locale is the same case as an absent one — the setter's `value || ''`.
    expect(render(INSTANT, '{dayName} {monthName} {monthShort}', undefined, '')).toBe('Thursday September Sep');
  });

  it('renders month and day names in the requested language', () => {
    expect(render(INSTANT, '{dayName} {d} {monthName} {year}', undefined, 'fr-FR')).toBe('jeudi 10 septembre 2026');
    expect(render(INSTANT, '{dayShort}', undefined, 'de-DE')).toBe('Do');
    expect(render(INSTANT, '{monthName}', undefined, 'ja-JP')).toBe('9月');
  });

  it('localises {monthShort} too — the token that used to be hardcoded English', () => {
    // 🔴 This is the assertion that would have been impossible to write before: the node's ONE
    // `Intl` call passed the literal 'en-US'.
    expect(render(INSTANT, '{monthShort}', undefined, 'fr-FR')).toBe('sept.');
  });

  it('combines with a timeZone rather than fighting it', () => {
    const instant = new Date('2026-09-10T22:30:00.000Z');
    expect(render(instant, '{dayName} {d} {monthName}', 'Asia/Tokyo', 'fr-FR')).toBe('vendredi 11 septembre');
  });

  it('leaves the digits, the padding and {ordinal} in English', () => {
    // Documented, not accidental: `{ordinal}` needs a per-language suffix table that `Intl` does
    // not provide, so it is English wherever it is used. See `ordinalSuffix` in the node.
    expect(render(INSTANT, '{ordinal} {date} {hours}:{minutes}', undefined, 'fr-FR')).toBe('10th 10 15:05');
  });

  it('re-renders when Locale changes, without a new date arriving', () => {
    const node = createNode(DateToStringModule, 'Date To String');
    node.node.setInputValue('formatString', '{monthName}');
    node.node.setInputValue('input', INSTANT);
    expect(node.out('currentValue')).toBe('September');
    node.node.setInputValue('locale', 'fr-FR');
    expect(node.out('currentValue')).toBe('septembre');
  });
});
