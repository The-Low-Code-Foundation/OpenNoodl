'use strict';

import type { InspectInfo, NodeDefinitionOptions, NodeInstance, NodeModule } from '@noodl/types';

/**
 * `this` inside the Condition node.
 *
 * The node keeps no state of its own — every output reads the `condition` input back
 * through `getInputValue`, which is why `initialize` is empty and there is no `_internal`
 * shape to describe.
 */
interface ConditionNodeInstance extends NodeInstance {
  scheduleEvaluate(): void;
}

const ConditionNode: NodeDefinitionOptions = {
  name: 'Condition',
  docs: 'https://docs.noodl.net/nodes/utilities/logic/condition',
  category: 'Logic',
  initialize: function () {},
  getInspectInfo(this: ConditionNodeInstance): InspectInfo {
    const condition = this.getInputValue('condition');
    let value;
    if (condition === undefined) {
      value = '[No input]';
    }
    // Kept verbatim, and it is a defect: this assignment is unconditional, so it
    // overwrites the `'[No input]'` branch above on the very next line and that message
    // has never reached the inspector — an unset Condition shows blank instead. Same
    // family as the `getInspectInfo` findings DEBT-006 ruled on. Not fixed here: this is
    // a typing slice (PLAT-003 NOTES §25).
    value = condition;
    return [
      {
        type: 'value',
        value
      }
    ];
  },
  inputs: {
    condition: {
      type: 'boolean',
      displayName: 'Condition',
      group: 'General',
      description: 'Value to test for truth; it is re-tested on every change unless Evaluate is connected',
      // The incoming value is deliberately unused — the setter's only job is to decide
      // whether to evaluate now or wait for the `eval` signal. Every reader goes back
      // through `getInputValue('condition')`.
      set(this: ConditionNodeInstance) {
        if (!this.isInputConnected('eval')) {
          // Evaluate right away
          this.scheduleEvaluate();
        }
      }
    },
    eval: {
      type: 'signal',
      displayName: 'Evaluate',
      group: 'Actions',
      description:
        'Tests Condition now; connecting this stops the node testing on every change, so nothing happens until it fires',
      valueChangedToTrue(this: ConditionNodeInstance) {
        this.scheduleEvaluate();
      }
    }
  },
  outputs: {
    ontrue: {
      type: 'signal',
      displayName: 'On True',
      group: 'Events',
      description: 'Fires each time Condition is tested and found true — exactly one of On True and On False fires per test'
    },
    onfalse: {
      type: 'signal',
      displayName: 'On False',
      group: 'Events',
      description: 'Fires each time Condition is tested and found false, including while Condition has never been set'
    },
    result: {
      type: 'boolean',
      displayName: 'Is True',
      group: 'Booleans',
      description: 'Whether the last test found Condition true, for wiring into a value rather than branching on a signal',
      get(this: ConditionNodeInstance) {
        return !!this.getInputValue('condition');
      }
    },
    isfalse: {
      type: 'boolean',
      displayName: 'Is False',
      group: 'Booleans',
      description: 'The opposite of Is True, so a false branch needs no Inverter',
      get(this: ConditionNodeInstance) {
        return !this.getInputValue('condition');
      }
    }
  },
  methods: {
    scheduleEvaluate(this: ConditionNodeInstance) {
      this.scheduleAfterInputsHaveUpdated(() => {
        this.flagOutputDirty('result');
        this.flagOutputDirty('isfalse');

        const condition = this.getInputValue('condition');
        this.sendSignalOnOutput(condition ? 'ontrue' : 'onfalse');
      });
    }
  }
};

const ConditionNodeModule: NodeModule = {
  node: ConditionNode
};

export = ConditionNodeModule;
