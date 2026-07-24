// `variablebase` is a runtime `.js` module and this package compiles with `allowJs: false`,
// so `createDefinition` arrives untyped. Its return value is a node definition, which is
// what the annotation below asserts.
import VariableBase from '@noodl/runtime/src/nodes/std-library/variables/variablebase';
import type { NodeDefinitionOptions } from '@noodl/types';

const Color: NodeDefinitionOptions = VariableBase.createDefinition({
  name: 'Color',
  docs: 'https://docs.noodl.net/nodes/data/color',
  startValue: '#f1f2f4',
  nodeDoubleClickAction: {
    focusPort: 'value'
  },
  type: {
    name: 'color'
  },
  cast: function (value: unknown) {
    return value;
  }
});

export default {
  node: Color
};
