'use strict';

import type { InspectInfo, NodeDefinitionOptions, NodeInstance, NodeModule } from '@noodl/types';

/**
 * `this` inside the Or node.
 *
 * The port set is `numbered-inputs`: the runtime synthesises `"Input 0"`, `"Input 1"`, …
 * on demand, so `inputs` is a sparse array indexed by port number rather than a fixed
 * record — and it is sparse, because nothing fills the gap when a middle input is left
 * unconnected. `some`/`every` skip holes, which is what makes that safe here.
 */
interface OrNodeInstance extends NodeInstance {
  _internal: {
    inputs: boolean[];
  };
}

const OrNode: NodeDefinitionOptions = {
  name: 'Or',
  docs: 'https://docs.noodl.net/nodes/logic/or',
  category: 'Logic',
  initialize: function (this: OrNodeInstance) {
    this._internal.inputs = [];
  },
  getInspectInfo(this: OrNodeInstance): InspectInfo {
    // Wrapped: a bare boolean renders as nothing in the inspector (DEBT-006).
    return [{ type: 'value', value: this._internal.inputs.some(isTrue) }];
  },
  numberedInputs: {
    input: {
      type: 'boolean',
      displayPrefix: 'Input',
      createSetter(index: number) {
        return function (this: OrNodeInstance, value: boolean) {
          if (this._internal.inputs[index] === value) {
            return;
          }

          this._internal.inputs[index] = value;
          this.flagOutputDirty('result');
        };
      }
    }
  },
  outputs: {
    result: {
      type: 'boolean',
      displayName: 'Result',
      getter: function (this: OrNodeInstance) {
        return this._internal.inputs.some(isTrue);
      }
    }
  }
};

const OrNodeModule: NodeModule = {
  node: OrNode
};

export = OrNodeModule;

function isTrue(value: unknown): boolean {
  return value ? true : false;
}
