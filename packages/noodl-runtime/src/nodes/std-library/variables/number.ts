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
  cast: function (value: unknown) {
    return Number(value);
  }
});

const NumberNodeModule: NodeModule = {
  node: NumberNode
};

export = NumberNodeModule;
