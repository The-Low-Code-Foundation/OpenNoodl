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
      group: 'Values',
      type: {
        name: 'boolean'
      },
      displayName: 'Value',
      description: 'Value to negate; anything falsy counts as false, and leaving it unset keeps Result unset too',
      set: function (this: InverterNodeInstance, value: unknown) {
        this._internal.currentValue = value;
        this.flagOutputDirty('result');
      }
    }
  },
  outputs: {
    result: {
      group: 'Values',
      type: 'boolean',
      displayName: 'Result',
      description: 'The opposite of Value, and unset rather than true while Value has never been set',
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
