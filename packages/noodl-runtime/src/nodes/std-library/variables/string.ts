'use strict';

import type { NodeModule } from '@noodl/types';

import VariableBase, { type VariableNodeInstance } from './variablebase';

// `noodl-runtime.js` is still JavaScript, so `NodeDefinition` arrives untyped. It is
// reached through the package root rather than `src/nodedefinition` directly because that
// is how the file has always resolved it, and the two are the same object.
const { NodeDefinition } = require('../../../../noodl-runtime');

const StringNode = VariableBase.createDefinition({
  name: 'String',
  docs: 'https://docs.noodl.net/nodes/data/string',
  shortDesc: 'Contains a string (text).',
  startValue: '',
  nodeDoubleClickAction: {
    focusPort: 'value'
  },
  type: {
    name: 'string'
  },
  cast: function (value: unknown) {
    return String(value);
  },
  onChanged: function (this: VariableNodeInstance) {
    this.flagOutputDirty('length');
  }
});

NodeDefinition.extend(StringNode, {
  usePortAsLabel: 'value',
  portLabelTruncationMode: 'length',
  outputs: {
    length: {
      type: 'number',
      displayName: 'Length',
      getter: function (this: VariableNodeInstance) {
        // `cast` is `String(value)`, so `currentValue` is always a string by the time it
        // is stored — but it is typed `unknown` on the shared instance because the other
        // Variable nodes store numbers, booleans and colours in the same field.
        return (this._internal.currentValue as string).length;
      }
    }
  }
});

const StringNodeModule: NodeModule = {
  node: StringNode
};

export = StringNodeModule;
