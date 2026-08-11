'use strict';

/**
 * Date Compare (CWF-011 slice 3) — is this before, after or the same as that.
 *
 * ⚠️ **Granularity is the whole point.** Two instants are almost never the same millisecond, so a
 * bare `===` on dates answers "no" to the question people are actually asking, which is usually
 * "same *day*". `Granularity` truncates both sides before comparing, in the host's local zone —
 * because "the same day" is a question about a calendar somebody is looking at.
 *
 * Both a boolean triple and signals: the booleans wire into a Condition, the signals wire into a
 * flow, and neither is a second-class way to ask.
 */

import type { NodeDefinitionOptions, NodeInstance, NodeModule } from '@noodl/types';

import { CompareGranularity, toDate, truncateTo } from './datemath';

interface DateCompareNodeInstance extends NodeInstance {
  _internal: {
    a?: Date;
    b?: Date;
    aSupplied?: boolean;
    bSupplied?: boolean;
    granularity: CompareGranularity;
    before?: boolean;
    after?: boolean;
    same?: boolean;
  };
  _recompute(): void;
}

const DateCompareNode: NodeDefinitionOptions = {
  name: 'net.noodl.DateCompare',
  displayNodeName: 'Date Compare',
  docs: 'https://docs.noodl.net/nodes/utilities/date-compare',
  category: 'Utilities',
  color: 'data',
  /** ⚠️ A declared `default` never runs its setter — this line is the real default. */
  initialize: function (this: DateCompareNodeInstance) {
    this._internal.granularity = 'millisecond';
  },
  inputs: {
    a: {
      type: { name: 'date' },
      displayName: 'Date',
      group: 'General',
      description: 'The instant being asked about',
      set: function (this: DateCompareNodeInstance, value: unknown) {
        this._internal.aSupplied = value !== undefined && value !== null && value !== '';
        this._internal.a = toDate(value);
        this._recompute();
      }
    },
    b: {
      type: { name: 'date' },
      displayName: 'Compare To',
      group: 'General',
      description: 'The instant it is compared against',
      set: function (this: DateCompareNodeInstance, value: unknown) {
        this._internal.bSupplied = value !== undefined && value !== null && value !== '';
        this._internal.b = toDate(value);
        this._recompute();
      }
    },
    granularity: {
      type: {
        name: 'enum',
        enums: [
          { label: 'Millisecond (exact)', value: 'millisecond' },
          { label: 'Second', value: 'second' },
          { label: 'Minute', value: 'minute' },
          { label: 'Hour', value: 'hour' },
          { label: 'Day', value: 'day' },
          { label: 'Month', value: 'month' },
          { label: 'Year', value: 'year' }
        ]
      },
      displayName: 'Granularity',
      group: 'General',
      default: 'millisecond',
      description:
        'How coarsely to compare. Day answers "is this the same day", which is almost always the ' +
        'question — two instants are hardly ever the same millisecond',
      set: function (this: DateCompareNodeInstance, value: CompareGranularity) {
        this._internal.granularity = value;
        this._recompute();
      }
    }
  },
  outputs: {
    before: {
      type: 'boolean',
      displayName: 'Is Before',
      group: 'Values',
      description: 'True when Date is earlier than Compare To, at this Granularity',
      getter: function (this: DateCompareNodeInstance) {
        return this._internal.before;
      }
    },
    after: {
      type: 'boolean',
      displayName: 'Is After',
      group: 'Values',
      description: 'True when Date is later than Compare To, at this Granularity',
      getter: function (this: DateCompareNodeInstance) {
        return this._internal.after;
      }
    },
    same: {
      type: 'boolean',
      displayName: 'Is Same',
      group: 'Values',
      description: 'True when the two land in the same Granularity bucket — the same day, month or year',
      getter: function (this: DateCompareNodeInstance) {
        return this._internal.same;
      }
    },
    isBefore: {
      type: 'signal',
      displayName: 'On Before',
      group: 'Events',
      description: 'Fires after a comparison that came out Before'
    },
    isAfter: {
      type: 'signal',
      displayName: 'On After',
      group: 'Events',
      description: 'Fires after a comparison that came out After'
    },
    isSame: {
      type: 'signal',
      displayName: 'On Same',
      group: 'Events',
      description: 'Fires after a comparison that came out Same'
    },
    failure: {
      type: 'signal',
      displayName: 'Invalid Date',
      group: 'Events',
      description: 'Fires when a date arrived that could not be read, leaving all three answers unset'
    }
  },
  methods: {
    _recompute: function (this: DateCompareNodeInstance) {
      if (!this._internal.aSupplied || !this._internal.bSupplied) return;

      const a = this._internal.a;
      const b = this._internal.b;
      if (a === undefined || b === undefined) {
        this._internal.before = undefined;
        this._internal.after = undefined;
        this._internal.same = undefined;
        this.flagOutputDirty('before');
        this.flagOutputDirty('after');
        this.flagOutputDirty('same');
        this.sendSignalOnOutput('failure');
        return;
      }

      const granularity = this._internal.granularity || 'millisecond';
      const left = truncateTo(a, granularity);
      const right = truncateTo(b, granularity);

      this._internal.before = left < right;
      this._internal.after = left > right;
      this._internal.same = left === right;
      this.flagOutputDirty('before');
      this.flagOutputDirty('after');
      this.flagOutputDirty('same');

      // Values first, then exactly one signal — so a receiver reading `Is Same` inside the
      // handler for `On Same` sees the answer it was told about.
      if (this._internal.same) this.sendSignalOnOutput('isSame');
      else if (this._internal.before) this.sendSignalOnOutput('isBefore');
      else this.sendSignalOnOutput('isAfter');
    }
  }
};

const DateCompareNodeModule: NodeModule = { node: DateCompareNode };

export = DateCompareNodeModule;
