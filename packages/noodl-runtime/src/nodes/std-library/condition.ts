'use strict';

import type { InspectInfo, NodeDefinitionOptions, NodeInstance, NodeModule } from '@noodl/types';

/**
 * `this` inside the Condition node.
 *
 * The node keeps almost no state of its own — both value outputs read the `condition` input
 * back through `getInputValue` rather than caching anything. NDA-017 §2 added the two flags
 * below, which are the only `_internal` this node has.
 */
interface ConditionNodeInstance extends NodeInstance {
  _internal: {
    /** NDA-017 §2 constraint 3 — coalesce a frame's triggers into one test. */
    hasScheduledEvaluation: boolean;
    /** NDA-017 §2 constraint 4 — false until the node has actually tested something. */
    hasEvaluated: boolean;
  };
  scheduleEvaluate(): void;
}

const ConditionNode: NodeDefinitionOptions = {
  name: 'Condition',
  docs: 'https://docs.noodl.net/nodes/utilities/logic/condition',
  category: 'Logic',
  // NDA-017 §2. `Evaluate` is this family's control signal; `condition` is the one value
  // input it used to silence.
  runOnValueChange: { controlSignal: 'eval', inputs: ['condition'] },
  initialize: function (this: ConditionNodeInstance) {
    this._internal.hasScheduledEvaluation = false;
    this._internal.hasEvaluated = false;
  },
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
      description: 'Value to test for truth; it is re-tested on every change unless you untick it below',
      // The incoming value is deliberately unused — the setter's only job is to decide
      // whether to evaluate now or wait for the `eval` signal. Every reader goes back
      // through `getInputValue('condition')`.
      set(this: ConditionNodeInstance) {
        // NDA-017 §2. Was `if (!this.isInputConnected('eval'))`.
        if (this.shouldRunOnValueChange('condition')) {
          this.scheduleEvaluate();
        }
      }
    },
    eval: {
      type: 'signal',
      displayName: 'Evaluate',
      group: 'Actions',
      // NDA-017 §2. The old sentence — "connecting this stops the node testing on every
      // change, so nothing happens until it fires" — was the trap stated as documentation.
      description:
        'Tests Condition now. This is additional to Condition re-testing on change; untick it under Run On Value Change to stop that',
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
    /**
     * NDA-017 §2 constraint 4. Both of these read the input back rather than caching, so
     * before anything has been tested they answered `false` and `true` respectively — and
     * `Is False` answering `true` is a *claim* that the condition is false, made by a node
     * that has never looked at one. `connectInput` pushes that claim down the wire the moment
     * it is made. Same shape as Expression's, and the same treatment: abstain until there has
     * been a test.
     */
    result: {
      type: 'boolean',
      displayName: 'Is True',
      group: 'Booleans',
      description:
        'Whether the last test found Condition true, for wiring into a value rather than branching on a signal; null until the first test',
      get(this: ConditionNodeInstance) {
        if (!this._internal.hasEvaluated) return null;
        return !!this.getInputValue('condition');
      }
    },
    isfalse: {
      type: 'boolean',
      displayName: 'Is False',
      group: 'Booleans',
      description: 'The opposite of Is True, so a false branch needs no Inverter; null until the first test',
      get(this: ConditionNodeInstance) {
        if (!this._internal.hasEvaluated) return null;
        return !this.getInputValue('condition');
      }
    }
  },
  methods: {
    scheduleEvaluate(this: ConditionNodeInstance) {
      // NDA-017 §2 constraint 3. This node had no coalescing at all, which cost nothing while
      // wiring `Evaluate` silenced the value setter — only one of the two could ever fire in a
      // frame. Now that `Evaluate` is additive both can, and without this flag a graph that
      // pulses `Evaluate` on the same frame the condition changes gets two `On True` pulses
      // where it used to get one. That is a new defect created by the fix, so the fix carries
      // its own guard.
      if (this._internal.hasScheduledEvaluation) return;
      this._internal.hasScheduledEvaluation = true;

      this.scheduleAfterInputsHaveUpdated(() => {
        this._internal.hasScheduledEvaluation = false;
        this._internal.hasEvaluated = true;
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
