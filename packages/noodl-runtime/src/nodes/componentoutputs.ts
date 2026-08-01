'use strict';

import type { ComponentInstanceLike, NodeDefinitionOptions, NodeInstance, NodeModule } from '@noodl/types';

/**
 * `this` inside the Component Outputs node.
 *
 * The port set is `component-ports`: the ports are the ones the *component* declares, so
 * they are known only per project. `registerInputIfNeeded` is overridden so any name the
 * editor asks for becomes an input that writes straight through to the component owner.
 */
interface ComponentOutputsNodeInstance extends NodeInstance {
  nodeScope: NodeInstance['nodeScope'] & {
    componentOwner: ComponentInstanceLike & {
      setOutputFromComponentOutput(name: string, value: unknown): void;
    };
  };
}

const ComponentOutputsNode: NodeDefinitionOptions = {
  category: 'Component Utilities',
  name: 'Component Outputs',
  docs: 'https://docs.noodl.net/nodes/component-utilities/component-outputs',
  panels: [
    {
      name: 'PortEditor',
      context: ['select', 'connectTo'],
      title: 'Outputs',
      plug: 'input',
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
  color: 'component',
  haveComponentPorts: true,
  prototypeExtensions: {
    registerInputIfNeeded: function (this: ComponentOutputsNodeInstance, name: string) {
      if (this.hasInput(name)) {
        return;
      }

      this.registerInput(name, {
        set: function (this: ComponentOutputsNodeInstance, value: unknown) {
          this.nodeScope.componentOwner.setOutputFromComponentOutput(name, value);
        }
      });
    }
  }
};

const ComponentOutputsNodeModule: NodeModule = {
  node: ComponentOutputsNode
};

export = ComponentOutputsNodeModule;
