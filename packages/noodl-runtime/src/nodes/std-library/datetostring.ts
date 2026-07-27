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
      getter: function (this: DateToStringNodeInstance) {
        return this._internal.dateString;
      }
    },
    inputChanged: {
      type: 'signal',
      displayName: 'Date Changed',
      group: 'Signals'
    },
    onError: {
      type: 'signal',
      displayName: 'Invalid Date',
      group: 'Signals'
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
        // Note this *flags* the signal dirty rather than sending it — signals are
        // delivered by `sendSignalOnOutput`, as the line below does for `inputChanged`.
        // Kept verbatim (PLAT-003 NOTES §25).
        this.flagOutputDirty('onError');
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
