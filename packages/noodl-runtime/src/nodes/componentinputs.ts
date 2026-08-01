'use strict';

import type { ComponentInstanceLike, InspectInfo, NodeDefinitionOptions, NodeInstance, NodeModule } from '@noodl/types';

/**
 * `this` inside the Component Inputs node.
 *
 * The port set is `component-ports`, the mirror of Component Outputs: every output here is
 * a *read* of the component owner's `_internal.inputValues`, registered on demand under
 * whatever name the editor asks for.
 */
interface ComponentInputsNodeInstance extends NodeInstance {
  nodeScope: NodeInstance['nodeScope'] & {
    componentOwner: ComponentInstanceLike & {
      _internal: { inputValues: Record<string, unknown> };
      update(): void;
    };
  };
}

const ComponentInputsNode: NodeDefinitionOptions = {
  name: 'Component Inputs',
  docs: 'https://docs.noodl.net/nodes/component-utilities/component-inputs',
  panels: [
    {
      name: 'PortEditor',
      context: ['select', 'connectFrom'],
      title: 'Inputs',
      plug: 'output',
      type: {
        name: '*'
      },
      canArrangeInGroups: true
    },
    {
      name: 'PropertyEditor',
      hidden: true
    }
  ],
  getInspectInfo(this: ComponentInputsNodeInstance): InspectInfo {
    return { type: 'value', value: this.nodeScope.componentOwner._internal.inputValues };
  },
  color: 'component',
  haveComponentPorts: true,
  category: 'Component Utilities',
  methods: {
    registerOutputIfNeeded: function (this: ComponentInputsNodeInstance, name: string) {
      if (this.hasOutput(name)) {
        return;
      }

      this.registerOutput(name, {
        getter: function (this: ComponentInputsNodeInstance) {
          return this.nodeScope.componentOwner._internal.inputValues[name];
        }
      });
    },
    _updateDependencies: function (this: ComponentInputsNodeInstance) {
      this.nodeScope.componentOwner.update();
    }
  }
};

const ComponentInputsNodeModule: NodeModule = {
  node: ComponentInputsNode
};

export = ComponentInputsNodeModule;
