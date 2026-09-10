'use strict';

import type { NodeDefinitionOptions, NodeInstance, NodeModule } from '@noodl/types';

interface DateToStringNodeInstance extends NodeInstance {
  _internal: {
    formatString: string;
    currentInput?: Date;
    dateString?: string;
    /** CWF-011 slice 4. Empty/unset means "the host's local zone", which is today's behaviour. */
    timeZone?: string;
    /** CMP-005. Empty/unset means `en-US`, which is what the one `Intl` call used to hardcode. */
    locale?: string;
  };
  _format(): void;
}

/** The fields `_format` needs, whichever zone they were read in. */
interface DateFields {
  date: number;
  month: number;
  year: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/**
 * CWF-011 slice 4 — read a date's fields in a named IANA zone.
 *
 * `Intl.DateTimeFormat` already takes a `timeZone`, so this is a re-read of the same instant
 * rather than any arithmetic: no offset table, no DST rules of our own.
 *
 * An unknown zone name makes the constructor throw `RangeError`, which lands in `_format`'s
 * existing catch and surfaces as `Invalid Date` — the same failure shape this node has always
 * had for a date it could not read.
 */
function fieldsInZone(t: Date, timeZone: string): DateFields {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(t);

  const read = (type: string) => {
    const part = parts.find((p) => p.type === type);
    return part ? parseInt(part.value, 10) : NaN;
  };

  // `hour12: false` renders midnight as 24 in some ICU versions; 24:xx is not an hour anybody
  // wants printed, and `% 24` is the documented normalisation.
  return {
    date: read('day'),
    month: read('month'),
    year: read('year'),
    hours: read('hour') % 24,
    minutes: read('minute'),
    seconds: read('second')
  };
}

/**
 * CMP-005 — the English ordinal suffix for a day of the month.
 *
 * ⚠️ **English only, on purpose, and it stays English when a Locale is set.** The suffix is not
 * derivable from `Intl` without a per-language table of its own (`Intl.PluralRules` gives the
 * ordinal CATEGORY — one/two/few/other — not the string), and inventing one for forty languages
 * inside a format token is a bigger promise than this node should make. `{ordinal}` is documented
 * as English; the localised route is `{dayName} {d} {monthName}`, which needs no suffix in most
 * languages anyway.
 */
function ordinalSuffix(day: number): string {
  // 11th, 12th, 13th — the exception every naive implementation gets wrong.
  if (day >= 11 && day <= 13) return 'th';
  switch (day % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
}

const DateToStringNode: NodeDefinitionOptions = {
  name: 'Date To String',
  docs: 'https://docs.noodl.net/nodes/utilities/date-to-string',
  category: 'Utilities',
  initialize: function (this: DateToStringNodeInstance) {
    this._internal.formatString = '{year}-{month}-{date}';
    // CWF-011 slice 4. ⚠️ A declared `default` never runs its setter, so the empty string that
    // means "local zone" is written here as well as declared below. An existing project that
    // has never heard of this port therefore formats exactly as it did before.
    this._internal.timeZone = '';
    // CMP-005, same reasoning as `timeZone` above: a declared `default` never runs its setter,
    // so the empty string that means "en-US" is written here too. A project that has never heard
    // of Locale renders its month and day names in English, exactly as it always has.
    this._internal.locale = '';
  },
  inputs: {
    formatString: {
      group: 'Values',
      displayName: 'Format',
      type: 'string',
      default: '{year}-{month}-{date}',
      description:
        'Template in which these tokens are replaced and everything else is copied through. ' +
        'Date: {date} 09, {d} 9, {ordinal} 9th. ' +
        'Month: {month} 09, {m} 9, {monthShort} Sep, {monthName} September. ' +
        'Year: {year} 2026, {yearShort} 26. ' +
        'Weekday: {dayName} Thursday, {dayShort} Thu. ' +
        'Time: {hours} 15, {h} 15, {hours12} 03, {h12} 3, {minutes} 05, {min} 5, {seconds} 07, ' +
        '{s} 7, {ampm} pm, {AMPM} PM. ' +
        'Names follow Locale; {ordinal} is English',
      set: function (this: DateToStringNodeInstance, value: string) {
        if (this._internal.formatString === value) return;
        this._internal.formatString = value;

        if (this._internal.currentInput !== undefined) {
          this._format();
          this.flagOutputDirty('currentValue');
        }
      }
    },
    timeZone: {
      group: 'Values',
      displayName: 'Timezone',
      type: 'string',
      default: '',
      description:
        'IANA zone name to render in, such as Europe/London or America/New_York. Leave empty for the ' +
        'host machine\'s zone — which on a server is whatever the container says, and is the usual ' +
        'reason a date is an hour out in production but right on your laptop',
      set: function (this: DateToStringNodeInstance, value: string) {
        const next = value || '';
        if (this._internal.timeZone === next) return;
        this._internal.timeZone = next;

        if (this._internal.currentInput !== undefined) {
          this._format();
          this.flagOutputDirty('currentValue');
        }
      }
    },
    locale: {
      group: 'Values',
      displayName: 'Locale',
      type: 'string',
      default: '',
      description:
        'BCP 47 language tag for the month and day names — fr-FR, de-DE, ja-JP. Leave empty for ' +
        'English (en-US), which is what every project rendered before this port existed. It does ' +
        'not change the digits, the padding or {ordinal}, only the words',
      set: function (this: DateToStringNodeInstance, value: string) {
        const next = value || '';
        if (this._internal.locale === next) return;
        this._internal.locale = next;

        if (this._internal.currentInput !== undefined) {
          this._format();
          this.flagOutputDirty('currentValue');
        }
      }
    },
    input: {
      group: 'Values',
      type: { name: 'date' },
      displayName: 'Date',
      description: 'The instant to render; a string arriving here is parsed as a date first',
      set: function (this: DateToStringNodeInstance, value: string | Date) {
        const _value = typeof value === 'string' ? new Date(value) : value;
        // Reference equality, so a `Date` object is never equal to a previous one even
        // for the same instant — every set re-formats. Kept verbatim.
        if (this._internal.currentInput === _value) return;

        this._internal.currentInput = _value;
        this._format();
      }
    }
  },
  outputs: {
    currentValue: {
      type: 'string',
      displayName: 'Date String',
      group: 'Values',
      description: 'Date rendered through Format, or blank when the date could not be read',
      getter: function (this: DateToStringNodeInstance) {
        return this._internal.dateString;
      }
    },
    inputChanged: {
      type: 'signal',
      displayName: 'Date Changed',
      group: 'Events',
      description: 'Fires whenever a new Date arrives or Format changes, after Date String has been updated'
    },
    onError: {
      type: 'signal',
      displayName: 'Invalid Date',
      group: 'Events',
      description: 'Fires when the Date could not be read, leaving Date String blank'
    }
  },
  methods: {
    _format(this: DateToStringNodeInstance) {
      try {
        // An unset or invalid `currentInput` throws out of `getDate()` and lands in the
        // catch below — that is the node's only validity check, so the try is load-bearing.
        const t = this._internal.currentInput;
        const format = this._internal.formatString;
        const zone = this._internal.timeZone;
        // CMP-005. `''` is the "never touched this port" value seeded in `initialize`, and it has
        // to resolve to the string that used to be written into the `Intl` call below, or every
        // existing project's {monthShort} changes.
        const locale = this._internal.locale || 'en-US';

        // ⚠️ The no-zone branch is the ORIGINAL code, unchanged, and it has to be: an existing
        // project must produce byte-identical output. `getDate()` on an unset or invalid
        // `currentInput` is still this node's only validity check, so the throw is load-bearing
        // in both branches — `fieldsInZone` reaches `formatToParts`, which throws `RangeError`
        // on an invalid date just as readily.
        const fields: DateFields = zone
          ? fieldsInZone(t, zone)
          : {
              date: t.getDate(),
              month: t.getMonth() + 1,
              year: t.getFullYear(),
              hours: t.getHours(),
              minutes: t.getMinutes(),
              seconds: t.getSeconds()
            };
        if (Number.isNaN(fields.year)) throw new RangeError('Invalid date');

        const date = ('0' + fields.date).slice(-2);
        const month = ('0' + fields.month).slice(-2);
        const monthShortOptions: Intl.DateTimeFormatOptions = zone
          ? { month: 'short', timeZone: zone }
          : { month: 'short' };
        const monthShort = new Intl.DateTimeFormat(locale, monthShortOptions).format(t);
        const year = fields.year;
        const yearShort = year.toString().substring(2);
        const hours = ('0' + fields.hours).slice(-2);
        const minutes = ('0' + fields.minutes).slice(-2);
        const seconds = ('0' + fields.seconds).slice(-2);

        // ⚠️ These eight are the ORIGINAL chain, character for character, so that a format string
        // using only them renders what it always rendered. CMP-005's tokens are appended below
        // rather than folded in.
        //
        // The order of the two passes is NOT load-bearing, and that was measured rather than
        // assumed: no token's rendered value contains a `{`, so neither pass can create or
        // destroy a needle for the other, and running the CMP-005 pass first leaves all 18 specs
        // green. The chain stays first because it is easier to review an untouched block than to
        // re-derive that it is untouched.
        let rendered = format
          .replace(/\{date\}/g, date)
          .replace(/\{month\}/g, month)
          .replace(/\{monthShort\}/g, monthShort)
          // `year` is a number; `replace` coerces it, and `String(...)` is that coercion
          // written out so the call typechecks. No behaviour change.
          .replace(/\{year\}/g, String(year))
          .replace(/\{yearShort\}/g, yearShort)
          .replace(/\{hours\}/g, hours)
          .replace(/\{minutes\}/g, minutes)
          .replace(/\{seconds\}/g, seconds);

        /**
         * CMP-005 — the tokens an app actually needs.
         *
         * Each one is rendered LAZILY: a format that does not mention `{dayName}` never
         * constructs the `Intl.DateTimeFormat` that would produce it, so the common case
         * (`{year}-{month}-{date}`) makes exactly the one `Intl` call it always made.
         */
        const substitute = (token: string, render: () => string) => {
          const needle = '{' + token + '}';
          if (rendered.indexOf(needle) === -1) return;
          // `split`/`join` on a literal is `replace` with a `/g` regex, without having to
          // escape the braces into a pattern.
          rendered = rendered.split(needle).join(render());
        };

        /** A name read in the same zone the numbers were read in, in the chosen language. */
        const named = (options: Intl.DateTimeFormatOptions) =>
          new Intl.DateTimeFormat(locale, zone ? { ...options, timeZone: zone } : options).format(t);

        // 0 is midnight and prints as 12; 13 prints as 1. `(h + 11) % 12 + 1` is that in one line.
        const hours12 = ((fields.hours + 11) % 12) + 1;
        // Derived from the hour, not from `Intl`, so it is the same two letters in every locale —
        // a French app rendering a 12-hour clock is already an odd thing to ask for, and a
        // localised day period would make `{ampm}` unpredictable rather than translated.
        const meridiem = fields.hours < 12 ? 'am' : 'pm';

        substitute('dayName', () => named({ weekday: 'long' }));
        substitute('dayShort', () => named({ weekday: 'short' }));
        substitute('monthName', () => named({ month: 'long' }));
        substitute('hours12', () => ('0' + hours12).slice(-2));
        substitute('h12', () => String(hours12));
        substitute('ampm', () => meridiem);
        substitute('AMPM', () => meridiem.toUpperCase());
        substitute('ordinal', () => String(fields.date) + ordinalSuffix(fields.date));
        // The unpadded halves of the six numeric fields. `{hours}` stays 24-hour and padded.
        substitute('d', () => String(fields.date));
        substitute('m', () => String(fields.month));
        substitute('h', () => String(fields.hours));
        substitute('min', () => String(fields.minutes));
        substitute('s', () => String(fields.seconds));

        this._internal.dateString = rendered;
      } catch (error) {
        // Set the output to be blank, makes it easier to handle.
        this._internal.dateString = '';
        /**
         * NDA-012 (Utilities). This was `flagOutputDirty('onError')`, and PLAT-003 NOTES §25
         * recorded that as a curiosity kept verbatim. It is not a curiosity: `flagOutputDirty`
         * is `sendValue(name, output.value)` (`node.ts:647-650`), and a signal output's `value`
         * is `undefined`, so every receiver got `undefined` on a signal input instead of the
         * `true`/`false` pair that `sendPulse` delivers. **`Invalid Date` had never fired.**
         *
         * Which made this node's only failure surface inert: the two ways in are an unset
         * `Date` (`getDate()` on `undefined` throws `TypeError`) and a malformed one — a bad
         * date string reaches here through `Intl.DateTimeFormat.format`'s `RangeError`, not
         * through `getDate()`, which returns `NaN` quite happily. Either way the author saw
         * `Date String` go blank and nothing else.
         */
        this.sendSignalOnOutput('onError');
      }

      // Flag that the value have changed
      this.flagOutputDirty('currentValue');
      this.sendSignalOnOutput('inputChanged');
    }
  }
};

const DateToStringNodeModule: NodeModule = {
  node: DateToStringNode
};

export = DateToStringNodeModule;
