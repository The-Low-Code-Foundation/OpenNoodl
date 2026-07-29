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
  // `null`/`undefined` are handled generically by `variablebase` per the empty-value
  // contract — this only has to cast a genuinely present value. `String(null)` → `"null"`
  // was the contract's headline violation; it can no longer reach here.
  cast: function (value: unknown) {
    return String(value);
  },
  onChanged: function (this: VariableNodeInstance) {
    this.flagOutputDirty('length');
  },
  emptyOptions: [
    { value: 'null', label: 'Null (default)', coerce: null },
    { value: 'empty-string', label: 'Empty string ("")', coerce: '' }
  ]
});

NodeDefinition.extend(StringNode, {
  usePortAsLabel: 'value',
  portLabelTruncationMode: 'length',
  outputs: {
    length: {
      type: 'number',
      displayName: 'Length',
      description:
        '0 when the Variable is cleared (`savedValue` is `null`) — there is no text to ' +
        "measure, and 0 is what an author reading this as a plain number expects, rather than " +
        'a thrown error or `null` itself.',
      getter: function (this: VariableNodeInstance) {
        // `cast` is `String(value)`, so `currentValue` is a string whenever it holds a real
        // value — but NDA-003 made Variables nullable, so `null` (the default "cleared"
        // state) reaches here too, and it is typed `unknown` on the shared instance because
        // the other Variable nodes store numbers, booleans and colours in the same field.
        const value = this._internal.currentValue;
        return typeof value === 'string' ? value.length : 0;
      }
    }
  }
});

const StringNodeModule: NodeModule = {
  node: StringNode
};

export = StringNodeModule;
