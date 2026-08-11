'use strict';

/**
 * Date Parts (CWF-011 slice 3) — the fields of a date, as outputs off one node.
 *
 * One node with nine outputs rather than nine nodes, because an author wanting the year and the
 * month wants them from the same instant, and two nodes reading one date is two places for the
 * date to be wired.
 *
 * ⚠️ **Local zone, like the rest of the date family and like `Date To String`.** On a server that
 * is whatever the container's TZ says, which is the classic off-by-an-hour-in-production defect.
 * When the zone matters, format through `Date To String`'s Timezone input rather than reading
 * parts here.
 *
 * `Month` is 1-12, not JavaScript's 0-11. Every author who has been bitten by `getMonth()` knows
 * why; nobody reading a node called "Month" expects January to be 0.
 */

import type { NodeDefinitionOptions, NodeInstance, NodeModule } from '@noodl/types';

import { isoWeek, toDate } from './datemath';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface DatePartsNodeInstance extends NodeInstance {
  _internal: {
    input?: Date;
    inputSupplied?: boolean;
  };
  _recompute(): void;
}

/** Every derived output, so the getters and the dirty-flagging cannot fall out of step. */
const PART_OUTPUTS = [
  'year',
  'month',
  'date',
  'hours',
  'minutes',
  'seconds',
  'milliseconds',
  'dayOfWeek',
  'dayName',
  'isoWeek',
  'timestamp'
];

const DatePartsNode: NodeDefinitionOptions = {
  name: 'net.noodl.DateParts',
  displayNodeName: 'Date Parts',
  docs: 'https://docs.noodl.net/nodes/utilities/date-parts',
  category: 'Utilities',
  color: 'data',
  inputs: {
    input: {
      type: { name: 'date' },
      displayName: 'Date',
      group: 'General',
      description: 'The instant to take apart. A string or a millisecond timestamp here is read as a date',
      set: function (this: DatePartsNodeInstance, value: unknown) {
        this._internal.inputSupplied = value !== undefined && value !== null && value !== '';
        this._internal.input = toDate(value);
        this._recompute();
      }
    }
  },
  outputs: {
    year: {
      type: 'number',
      displayName: 'Year',
      group: 'Values',
      description: 'Four-digit year, in the host s local zone',
      getter: function (this: DatePartsNodeInstance) {
        return this._internal.input && this._internal.input.getFullYear();
      }
    },
    month: {
      type: 'number',
      displayName: 'Month',
      group: 'Values',
      description: 'Month as 1-12 — January is 1, not 0',
      getter: function (this: DatePartsNodeInstance) {
        return this._internal.input && this._internal.input.getMonth() + 1;
      }
    },
    date: {
      type: 'number',
      displayName: 'Day of Month',
      group: 'Values',
      description: 'Day of the month, 1-31',
      getter: function (this: DatePartsNodeInstance) {
        return this._internal.input && this._internal.input.getDate();
      }
    },
    hours: {
      type: 'number',
      displayName: 'Hours',
      group: 'Values',
      description: 'Hour of the day, 0-23',
      getter: function (this: DatePartsNodeInstance) {
        return this._internal.input && this._internal.input.getHours();
      }
    },
    minutes: {
      type: 'number',
      displayName: 'Minutes',
      group: 'Values',
      description: 'Minutes past the hour, 0-59',
      getter: function (this: DatePartsNodeInstance) {
        return this._internal.input && this._internal.input.getMinutes();
      }
    },
    seconds: {
      type: 'number',
      displayName: 'Seconds',
      group: 'Values',
      description: 'Seconds past the minute, 0-59',
      getter: function (this: DatePartsNodeInstance) {
        return this._internal.input && this._internal.input.getSeconds();
      }
    },
    milliseconds: {
      type: 'number',
      displayName: 'Milliseconds',
      group: 'Values',
      description: 'Milliseconds past the second, 0-999',
      getter: function (this: DatePartsNodeInstance) {
        return this._internal.input && this._internal.input.getMilliseconds();
      }
    },
    dayOfWeek: {
      type: 'number',
      displayName: 'Day of Week',
      group: 'Values',
      description: 'Day of the week as 0-6, Sunday first — JavaScript s own numbering',
      getter: function (this: DatePartsNodeInstance) {
        return this._internal.input && this._internal.input.getDay();
      }
    },
    dayName: {
      type: 'string',
      displayName: 'Day Name',
      group: 'Values',
      description: 'The English name of the weekday. For a localised name, format through Date To String',
      getter: function (this: DatePartsNodeInstance) {
        return this._internal.input && DAY_NAMES[this._internal.input.getDay()];
      }
    },
    isoWeek: {
      type: 'number',
      displayName: 'ISO Week',
      group: 'Values',
      description: 'ISO-8601 week number, 1-53: weeks start on Monday and week 1 holds the first Thursday',
      getter: function (this: DatePartsNodeInstance) {
        return this._internal.input && isoWeek(this._internal.input);
      }
    },
    timestamp: {
      type: 'number',
      displayName: 'Timestamp',
      group: 'Values',
      description: 'The instant as milliseconds since 1 January 1970 UTC',
      getter: function (this: DatePartsNodeInstance) {
        return this._internal.input && this._internal.input.getTime();
      }
    },
    changed: {
      type: 'signal',
      displayName: 'Changed',
      group: 'Events',
      description: 'Fires after a new Date has been taken apart and every part output is up to date'
    },
    failure: {
      type: 'signal',
      displayName: 'Invalid Date',
      group: 'Events',
      description: 'Fires when a date arrived that could not be read, leaving every part unset'
    }
  },
  methods: {
    _recompute: function (this: DatePartsNodeInstance) {
      if (!this._internal.inputSupplied) return;

      for (const name of PART_OUTPUTS) this.flagOutputDirty(name);

      if (this._internal.input === undefined) {
        this.sendSignalOnOutput('failure');
        return;
      }
      this.sendSignalOnOutput('changed');
    }
  }
};

const DatePartsNodeModule: NodeModule = { node: DatePartsNode };

export = DatePartsNodeModule;
