'use strict';

import type { InspectInfo, NodeDefinitionOptions, NodeInstance, NodeModule } from '@noodl/types';

/**
 * `this` inside the And node.
 *
 * `numbered-inputs`, like Or — but unlike Or this one caches `result`, because its setter
 * only flags the output dirty when the *answer* changes rather than when an input does.
 */
interface AndNodeInstance extends NodeInstance {
  _internal: {
    inputs: boolean[];
    result?: boolean;
  };
}

const AndNode: NodeDefinitionOptions = {
  name: 'And',
  docs: 'https://docs.noodl.net/nodes/logic/and',
  category: 'Logic',
  initialize: function (this: AndNodeInstance) {
    this._internal.inputs = [];
  },
  getInspectInfo(this: AndNodeInstance): InspectInfo {
    // Wrapped: a bare boolean renders as nothing in the inspector (DEBT-006).
    return [{ type: 'value', value: and(this._internal.inputs) }];
  },
  numberedInputs: {
    input: {
      displayPrefix: 'Input',
      type: 'boolean',
      createSetter(index: number) {
        return function (this: AndNodeInstance, value: unknown) {
          const next = value ? true : false;

          if (this._internal.inputs[index] === next) {
            return;
          }

          this._internal.inputs[index] = next;
          const result = and(this._internal.inputs);

          if (this._internal.result !== result) {
            this._internal.result = result;
            this.flagOutputDirty('result');
          }
        };
      }
    }
  },
  outputs: {
    result: {
      type: 'boolean',
      displayName: 'Result',
      // `get` and `getter` are both honoured — `node.ts` reads `output.get || output.getter`.
      get(this: AndNodeInstance) {
        return this._internal.result;
      }
    }
  }
};

const AndNodeModule: NodeModule = {
  node: AndNode
};

export = AndNodeModule;

function and(values: boolean[]): boolean {
  //if none are false, then return true
  return values.length > 0 && values.some((v) => !v) === false;
}
