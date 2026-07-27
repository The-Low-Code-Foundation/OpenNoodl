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
  cast: function (value: unknown) {
    return Boolean(value);
  }
});

const BooleanNodeModule: NodeModule = {
  node: BooleanNode
};

export = BooleanNodeModule;
