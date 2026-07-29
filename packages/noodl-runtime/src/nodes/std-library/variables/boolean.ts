'use strict';

import type { NodeModule } from '@noodl/types';

import VariableBase from './variablebase';

const BooleanNode = VariableBase.createDefinition({
  name: 'Boolean',
  docs: 'https://docs.noodl.net/nodes/data/boolean',
  startValue: false,
  type: {
    name: 'boolean'
  },
  // `null`/`undefined` are handled generically by `variablebase` per the empty-value
  // contract — this only has to cast a genuinely present value.
  cast: function (value: unknown) {
    return Boolean(value);
  },
  emptyOptions: [
    { value: 'null', label: 'Null (default)', coerce: null },
    { value: 'false', label: 'False', coerce: false }
  ]
});

const BooleanNodeModule: NodeModule = {
  node: BooleanNode
};

export = BooleanNodeModule;
