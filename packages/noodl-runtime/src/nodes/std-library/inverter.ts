'use strict';

import type { InspectInfo, NodeDefinitionOptions, NodeInstance, NodeModule } from '@noodl/types';

/**
 * Note the `undefined` passthrough: an Inverter that has never received a value reports
 * `undefined`, not `true`. That distinguishes "not yet set" from "set to false" for
 * downstream nodes, so it is deliberate rather than a missing default.
 */
function invert(value: unknown): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }
  return !value;
}

interface InverterNodeInstance extends NodeInstance {
  _internal: {
    currentValue: unknown;
  };
}

const InverterNode: NodeDefinitionOptions = {
  name: 'Inverter',
  docs: 'https://docs.noodl.net/nodes/logic/inverter',
  category: 'Logic',
  initialize: function (this: InverterNodeInstance) {
    this._internal.currentValue = undefined;
  },
  getInspectInfo(this: InverterNodeInstance): InspectInfo {
    return String(invert(this._internal.currentValue));
  },
  inputs: {
    value: {
      type: {
        name: 'boolean'
      },
      displayName: 'Value',
      set: function (this: InverterNodeInstance, value: unknown) {
        this._internal.currentValue = value;
        this.flagOutputDirty('result');
      }
    }
  },
  outputs: {
    result: {
      type: 'boolean',
      displayName: 'Result',
      getter: function (this: InverterNodeInstance) {
        return invert(this._internal.currentValue);
      }
    }
  }
};

const InverterNodeModule: NodeModule = {
  node: InverterNode
};

export = InverterNodeModule;
