'use strict';

/**
 * Date Add (CWF-011 slice 2) — a date shifted by an amount of a unit.
 *
 * ⚠️ **Months and years clamp.** 31 January + 1 month is **28 February** (29 in a leap year), not
 * 2 March. See `datemath.ts` for why that is written down rather than left to whoever reads the
 * code next.
 *
 * Value-driven, like `Date To String`: it recomputes whenever Date, Amount or Unit changes and
 * announces itself on `Changed`. There is no `Do` because there is no action — nothing outside
 * this node is different afterwards, which is the test the outcome contract's Rule 1 applies.
 * `Invalid Date` is the same failure shape `Date To String` already established.
 */

import type { NodeDefinitionOptions, NodeInstance, NodeModule } from '@noodl/types';

import { addToDate, DateUnit, toDate, UNIT_ENUMS } from './datemath';

interface DateAddNodeInstance extends NodeInstance {
  _internal: {
    input?: Date;
    /** Whether anything has ever arrived on `Date`. See `_recompute` — this is the abstain. */
    inputSupplied?: boolean;
    amount: number;
    unit: DateUnit;
    result?: Date;
  };
  _recompute(): void;
}

const DateAddNode: NodeDefinitionOptions = {
  name: 'net.noodl.DateAdd',
  displayNodeName: 'Date Add',
  docs: 'https://docs.noodl.net/nodes/utilities/date-add',
  category: 'Utilities',
  color: 'data',
  /** ⚠️ A declared `default` never runs its setter — these two lines are the real defaults. */
  initialize: function (this: DateAddNodeInstance) {
    this._internal.amount = 0;
    this._internal.unit = 'days';
  },
  inputs: {
    input: {
      type: { name: 'date' },
      displayName: 'Date',
      group: 'General',
      description: 'The instant to shift. A string or a millisecond timestamp arriving here is read as a date',
      set: function (this: DateAddNodeInstance, value: unknown) {
        // An unset input is not a failure (Failure Contract §2), and an empty date port is the
        // ordinary state of a graph that has not run yet. Only a value that ARRIVED and could
        // not be read counts.
        this._internal.inputSupplied = value !== undefined && value !== null && value !== '';
        this._internal.input = toDate(value);
        this._recompute();
      }
    },
    amount: {
      type: 'number',
      displayName: 'Amount',
      group: 'General',
      default: 0,
      description: 'How much to add. Negative subtracts. Months and years use whole steps',
      set: function (this: DateAddNodeInstance, value: number) {
        this._internal.amount = Number(value);
        this._recompute();
      }
    },
    unit: {
      type: { name: 'enum', enums: UNIT_ENUMS },
      displayName: 'Unit',
      group: 'General',
      default: 'days',
      description:
        'What Amount counts. Months and years are calendar steps and CLAMP: 31 January plus one month ' +
        'is 28 (or 29) February, never 2 March',
      set: function (this: DateAddNodeInstance, value: DateUnit) {
        this._internal.unit = value;
        this._recompute();
      }
    }
  },
  outputs: {
    result: {
      type: 'date',
      displayName: 'Result',
      group: 'Value',
      description: 'Date shifted by Amount of Unit, or unset when Date could not be read',
      getter: function (this: DateAddNodeInstance) {
        return this._internal.result;
      }
    },
    changed: {
      type: 'signal',
      displayName: 'Changed',
      group: 'Events',
      description: 'Fires after Result has been recomputed, whichever input caused it'
    },
    failure: {
      type: 'signal',
      displayName: 'Invalid Date',
      group: 'Events',
      description: 'Fires when Date could not be read, leaving Result unset'
    }
  },
  methods: {
    _recompute: function (this: DateAddNodeInstance) {
      // Nothing has arrived on Date yet: abstain entirely. Firing `Invalid Date` here would make
      // every graph report a failure at load, which is the noise that teaches authors to ignore
      // the port.
      if (!this._internal.inputSupplied) return;

      const input = this._internal.input;
      if (input === undefined) {
        this._internal.result = undefined;
        this.flagOutputDirty('result');
        this.sendSignalOnOutput('failure');
        return;
      }

      const amount = Number.isFinite(this._internal.amount) ? this._internal.amount : 0;
      this._internal.result = addToDate(input, amount, this._internal.unit || 'days');
      this.flagOutputDirty('result');
      this.sendSignalOnOutput('changed');
    }
  }
};

const DateAddNodeModule: NodeModule = { node: DateAddNode };

export = DateAddNodeModule;
