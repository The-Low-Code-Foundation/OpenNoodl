'use strict';

import type { NodeDefinitionOptions, NodeInstance, NodeModule } from '@noodl/types';

interface DateToStringNodeInstance extends NodeInstance {
  _internal: {
    formatString: string;
    currentInput?: Date;
    dateString?: string;
  };
  _format(): void;
}

const DateToStringNode: NodeDefinitionOptions = {
  name: 'Date To String',
  docs: 'https://docs.noodl.net/nodes/utilities/date-to-string',
  category: 'Utilities',
  initialize: function (this: DateToStringNodeInstance) {
    this._internal.formatString = '{year}-{month}-{date}';
  },
  inputs: {
    formatString: {
      displayName: 'Format',
      type: 'string',
      default: '{year}-{month}-{date}',
      description:
        'Template in which {year} {yearShort} {month} {monthShort} {date} {hours} {minutes} {seconds} are replaced and everything else is copied through',
      set: function (this: DateToStringNodeInstance, value: string) {
        if (this._internal.formatString === value) return;
        this._internal.formatString = value;

        if (this._internal.currentInput !== undefined) {
          this._format();
          this.flagOutputDirty('currentValue');
        }
      }
    },
    input: {
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
      group: 'Value',
      description: 'Date rendered through Format, or blank when the date could not be read',
      getter: function (this: DateToStringNodeInstance) {
        return this._internal.dateString;
      }
    },
    inputChanged: {
      type: 'signal',
      displayName: 'Date Changed',
      group: 'Signals',
      description: 'Fires whenever a new Date arrives or Format changes, after Date String has been updated'
    },
    onError: {
      type: 'signal',
      displayName: 'Invalid Date',
      group: 'Signals',
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
        const date = ('0' + t.getDate()).slice(-2);
        const month = ('0' + (t.getMonth() + 1)).slice(-2);
        const monthShort = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(t);
        const year = t.getFullYear();
        const yearShort = year.toString().substring(2);
        const hours = ('0' + t.getHours()).slice(-2);
        const minutes = ('0' + t.getMinutes()).slice(-2);
        const seconds = ('0' + t.getSeconds()).slice(-2);

        this._internal.dateString = format
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
