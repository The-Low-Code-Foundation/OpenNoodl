'use strict';

import type { InspectInfo, NodeDefinitionOptions, NodeInstance, NodeModule } from '@noodl/types';

import { outcomeOutputs } from '../../outcome';

/**
 * `this` inside the Counter node.
 *
 * `startValueSet` exists so the *first* Start Value that arrives also seeds the current
 * count, while later ones only change where Reset goes back to. That is why the setter
 * looks asymmetric.
 */
interface CounterNodeInstance extends NodeInstance {
  _internal: {
    currentValue: number;
    startValue: number;
    startValueSet: boolean;
    limitsEnabled: boolean;
    limitsMin: number;
    limitsMax: number;
  };
}

const CounterNode: NodeDefinitionOptions = {
  name: 'Counter',
  docs: 'https://docs.noodl.net/nodes/math/counter',
  category: 'Math',
  initialize: function (this: CounterNodeInstance) {
    this._internal.currentValue = 0;
    this._internal.startValue = 0;
    this._internal.startValueSet = false;

    this._internal.limitsEnabled = false;
    this._internal.limitsMin = 0;
    this._internal.limitsMax = 0;
  },
  getInspectInfo(this: CounterNodeInstance): InspectInfo {
    return 'Count: ' + this._internal.currentValue;
  },
  inputs: {
    increase: {
      group: 'Actions',
      displayName: 'Increase Count',
      description: 'Adds one to the count, or does nothing at all when Limits Enabled and the count is already at Max Value',
      valueChangedToTrue: function (this: CounterNodeInstance) {
        const outcome = this.beginOutcome();
        // ERG-001 §4, §0.3's register. This was a bare `return` — a counter pinned at Max
        // told the graph nothing at all, so "increase, then show the new total" simply
        // stopped. Not a failure: Limits Enabled is what the author asked for.
        if (this._internal.limitsEnabled && this._internal.currentValue >= this._internal.limitsMax) {
          this.reportOutcome(outcome, 'unchanged');
          return;
        }

        this._internal.currentValue++;
        this.flagOutputDirty('currentCount');
        this.sendSignalOnOutput('countChanged');
        this.reportOutcome(outcome, 'done');
      }
    },
    decrease: {
      group: 'Actions',
      displayName: 'Decrease Count',
      description: 'Subtracts one from the count, or does nothing at all when Limits Enabled and the count is already at Min Value',
      valueChangedToTrue: function (this: CounterNodeInstance) {
        const outcome = this.beginOutcome();
        if (this._internal.limitsEnabled && this._internal.currentValue <= this._internal.limitsMin) {
          this.reportOutcome(outcome, 'unchanged');
          return;
        }

        this._internal.currentValue--;
        this.flagOutputDirty('currentCount');
        this.sendSignalOnOutput('countChanged');
        this.reportOutcome(outcome, 'done');
      }
    },
    reset: {
      group: 'Actions',
      displayName: 'Reset To Start',
      description: 'Puts the count back to Start Value',
      valueChangedToTrue: function (this: CounterNodeInstance) {
        // Kept verbatim, and it is a defect: the count lives at
        // `this._internal.currentValue`, so `this.currentValue` is always `undefined`
        // and this early return has never fired. The effect is that Reset always flags
        // the output dirty and signals, even when it changes nothing. Harmless, but the
        // guard does not do what it reads as (PLAT-003 NOTES §25).
        // ⚠️ Still kept verbatim, and deliberately **not** repaired into an `Unchanged`.
        // Making the guard read `_internal.currentValue` would change when `Count Changed`
        // fires, which is a behaviour change dressed as a rename; ERG-001 §4 is adopting the
        // contract, not settling a two-year-old defect. Reset therefore always reports `Done`,
        // which is exactly what it has always done — see PLAT-003 NOTES §25.
        const outcome = this.beginOutcome();
        if ((this as unknown as { currentValue?: number }).currentValue === 0) {
          this.reportOutcome(outcome, 'unchanged');
          return;
        }
        this._internal.currentValue = this._internal.startValue;
        this.flagOutputDirty('currentCount');
        this.sendSignalOnOutput('countChanged');
        this.reportOutcome(outcome, 'done');
      }
    },
    startValue: {
      type: 'number',
      displayName: 'Start Value',
      description: 'Count to begin at and to return to on Reset; setting it announces a change on Count Changed at page load',
      default: 0,
      set: function (this: CounterNodeInstance, value: unknown) {
        this._internal.startValue = Number(value);

        if (this._internal.startValueSet === false) {
          this._internal.startValueSet = true;
          this._internal.currentValue = this._internal.startValue;
          this.flagOutputDirty('currentCount');
          this.sendSignalOnOutput('countChanged');
        }
      }
    },
    limitsMin: {
      type: {
        name: 'number'
      },
      displayName: 'Min Value',
      description: 'Lowest count Decrease will reach, ignored unless Limits Enabled',
      group: 'Limits',
      default: 0,
      set: function (this: CounterNodeInstance, value: unknown) {
        this._internal.limitsMin = Number(value);
      }
    },
    limitsMax: {
      type: {
        name: 'number'
      },
      displayName: 'Max Value',
      description: 'Highest count Increase will reach, ignored unless Limits Enabled',
      group: 'Limits',
      default: 0,
      set: function (this: CounterNodeInstance, value: unknown) {
        this._internal.limitsMax = Number(value);
      }
    },
    limitsEnabled: {
      type: {
        name: 'boolean'
      },
      displayName: 'Limits Enabled',
      description: 'Whether Min Value and Max Value bound the count; without it the count runs unbounded in both directions',
      group: 'Limits',
      default: false,
      set: function (this: CounterNodeInstance, value: unknown) {
        this._internal.limitsEnabled = value ? true : false;
      }
    }
  },
  outputs: {
    currentCount: {
      displayName: 'Current Count',
      type: 'number',
      description: 'The count as it stands',
      getter: function (this: CounterNodeInstance) {
        return this._internal.currentValue;
      }
    },
    countChanged: {
      displayName: 'Count Changed',
      type: 'signal',
      description: 'Fires after the count has moved, and also once at page load when Start Value is set'
    },

    /**
     * ERG-001 §4. Distinct from `Count Changed`, which is about the *value* and also fires at
     * page load when Start Value arrives. These are about the *invocation*: exactly one per
     * Increase / Decrease / Reset, which is what a chain can sequence on.
     */
    ...outcomeOutputs({
      done: 'Fires when the count actually moved',
      unchanged: 'Fires when Limits Enabled held the count where it was, so nothing moved'
    })
  }
};

const CounterNodeModule: NodeModule = {
  node: CounterNode
};

export = CounterNodeModule;
