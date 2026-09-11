'use strict';

/**
 * Date Difference (CWF-011 slice 2) — how far apart two instants are.
 *
 * Signed: positive when `To` is later than `From`, which is the reading that makes "days until"
 * and "days since" the same node. `Absolute` is the flag for the cases that only want a distance.
 *
 * ⚠️ Fixed units divide exactly and are NOT rounded — 36 hours is `1.5` days, not `1` or `2`.
 * Months and years are whole calendar steps, because "2.4 months" is a number nobody can check;
 * the answer is how many whole months you could `Date Add` without overshooting.
 */

import type { NodeDefinitionOptions, NodeInstance, NodeModule } from '@noodl/types';

import { DateUnit, differenceBetween, toDate, UNIT_ENUMS } from './datemath';

interface DateDifferenceNodeInstance extends NodeInstance {
  _internal: {
    from?: Date;
    to?: Date;
    fromSupplied?: boolean;
    toSupplied?: boolean;
    unit: DateUnit;
    absolute: boolean;
    difference?: number;
  };
  _recompute(): void;
}

const DateDifferenceNode: NodeDefinitionOptions = {
  name: 'net.noodl.DateDifference',
  displayNodeName: 'Date Difference',
  docs: 'https://docs.noodl.net/nodes/utilities/date-difference',
  category: 'Utilities',
  color: 'data',
  /** ⚠️ A declared `default` never runs its setter — these two lines are the real defaults. */
  initialize: function (this: DateDifferenceNodeInstance) {
    this._internal.unit = 'days';
    this._internal.absolute = false;
  },
  inputs: {
    from: {
      type: { name: 'date' },
      displayName: 'From',
      group: 'General',
      description: 'The earlier instant, in the reading that makes Difference positive',
      set: function (this: DateDifferenceNodeInstance, value: unknown) {
        this._internal.fromSupplied = value !== undefined && value !== null && value !== '';
        this._internal.from = toDate(value);
        this._recompute();
      }
    },
    to: {
      type: { name: 'date' },
      displayName: 'To',
      group: 'General',
      description: 'The later instant. Difference is negative when this is actually earlier than From',
      set: function (this: DateDifferenceNodeInstance, value: unknown) {
        this._internal.toSupplied = value !== undefined && value !== null && value !== '';
        this._internal.to = toDate(value);
        this._recompute();
      }
    },
    unit: {
      type: { name: 'enum', enums: UNIT_ENUMS },
      displayName: 'Unit',
      group: 'General',
      default: 'days',
      description:
        'What Difference counts. Fixed units are exact and fractional (36 hours is 1.5 days); months ' +
        'and years are whole calendar steps',
      set: function (this: DateDifferenceNodeInstance, value: DateUnit) {
        this._internal.unit = value;
        this._recompute();
      }
    },
    absolute: {
      type: 'boolean',
      displayName: 'Absolute',
      group: 'General',
      default: false,
      description: 'Drop the sign, so the output is a distance rather than a direction',
      set: function (this: DateDifferenceNodeInstance, value: boolean) {
        this._internal.absolute = !!value;
        this._recompute();
      }
    }
  },
  outputs: {
    difference: {
      type: 'number',
      displayName: 'Difference',
      group: 'Values',
      description: 'To minus From, counted in Unit. Unset while either date is missing or unreadable',
      getter: function (this: DateDifferenceNodeInstance) {
        return this._internal.difference;
      }
    },
    changed: {
      type: 'signal',
      displayName: 'Changed',
      group: 'Events',
      description: 'Fires after Difference has been recomputed'
    },
    failure: {
      type: 'signal',
      displayName: 'Invalid Date',
      group: 'Events',
      description: 'Fires when a date arrived that could not be read, leaving Difference unset'
    }
  },
  methods: {
    _recompute: function (this: DateDifferenceNodeInstance) {
      // Abstain until both dates have actually been supplied — a half-wired graph is not a failure.
      if (!this._internal.fromSupplied || !this._internal.toSupplied) return;

      const from = this._internal.from;
      const to = this._internal.to;
      if (from === undefined || to === undefined) {
        this._internal.difference = undefined;
        this.flagOutputDirty('difference');
        this.sendSignalOnOutput('failure');
        return;
      }

      const value = differenceBetween(from, to, this._internal.unit || 'days');
      this._internal.difference = this._internal.absolute ? Math.abs(value) : value;
      this.flagOutputDirty('difference');
      this.sendSignalOnOutput('changed');
    }
  }
};

const DateDifferenceNodeModule: NodeModule = { node: DateDifferenceNode };

export = DateDifferenceNodeModule;
