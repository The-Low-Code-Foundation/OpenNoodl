'use strict';

import type { NodeModule } from '@noodl/types';

import VariableBase from './variablebase';

const NumberNode = VariableBase.createDefinition({
  name: 'Number',
  docs: 'https://docs.noodl.net/nodes/data/number',
  startValue: 0,
  nodeDoubleClickAction: {
    focusPort: 'value'
  },
  type: {
    name: 'number'
  },
  // `null`/`undefined` are handled generically by `variablebase` per the empty-value
  // contract — this only has to cast a genuinely present value. `Number('abc')` (and any
  // other unparseable input) produces `NaN`; `variablebase` catches that and substitutes
  // the `Treat empty as` value instead of ever storing it, since `NaN !== NaN` breaks the
  // `changed` guard permanently once it lands.
  cast: function (value: unknown) {
    return Number(value);
  },
  emptyOptions: [
    { value: 'null', label: 'Null (default)', coerce: null },
    { value: 'zero', label: 'Zero (0)', coerce: 0 }
  ]
});

const NumberNodeModule: NodeModule = {
  node: NumberNode
};

export = NumberNodeModule;
