'use strict';

import type { InspectInfo, NodeDefinitionOptions, NodeInstance, NodeModule } from '@noodl/types';

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
      valueChangedToTrue: function (this: CounterNodeInstance) {
        if (this._internal.limitsEnabled && this._internal.currentValue >= this._internal.limitsMax) {
          return;
        }

        this._internal.currentValue++;
        this.flagOutputDirty('currentCount');
        this.sendSignalOnOutput('countChanged');
      }
    },
    decrease: {
      group: 'Actions',
      displayName: 'Decrease Count',
      valueChangedToTrue: function (this: CounterNodeInstance) {
        if (this._internal.limitsEnabled && this._internal.currentValue <= this._internal.limitsMin) {
          return;
        }

        this._internal.currentValue--;
        this.flagOutputDirty('currentCount');
        this.sendSignalOnOutput('countChanged');
      }
    },
    reset: {
      group: 'Actions',
      displayName: 'Reset To Start',
      valueChangedToTrue: function (this: CounterNodeInstance) {
        // Kept verbatim, and it is a defect: the count lives at
        // `this._internal.currentValue`, so `this.currentValue` is always `undefined`
        // and this early return has never fired. The effect is that Reset always flags
        // the output dirty and signals, even when it changes nothing. Harmless, but the
        // guard does not do what it reads as (PLAT-003 NOTES §25).
        if ((this as unknown as { currentValue?: number }).currentValue === 0) {
          return;
        }
        this._internal.currentValue = this._internal.startValue;
        this.flagOutputDirty('currentCount');
        this.sendSignalOnOutput('countChanged');
      }
    },
    startValue: {
      type: 'number',
      displayName: 'Start Value',
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
      getter: function (this: CounterNodeInstance) {
        return this._internal.currentValue;
      }
    },
    countChanged: {
      displayName: 'Count Changed',
      type: 'signal'
    }
  }
};

const CounterNodeModule: NodeModule = {
  node: CounterNode
};

export = CounterNodeModule;
