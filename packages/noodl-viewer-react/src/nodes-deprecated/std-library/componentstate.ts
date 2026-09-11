'use strict';

import { Node } from '@noodl/runtime';
import Model from '@noodl/runtime/src/model';
import type {
  EditorConnectionLike,
  GraphModelLike,
  GraphNodeModel,
  InspectInfo,
  ModelChangeEvent,
  ModelLike,
  NodeContextLike,
  NodeDefinitionOptions,
  NodeInstance,
  NodeModule
} from '@noodl/types';

/**
 * `this` inside the Component State node — the predecessor of Component Object,
 * whose storage it shares: both key their record on the *component instance* id,
 * so `componentState<instanceId>` is the same record either node reaches.
 */
interface ComponentStateInstance extends NodeInstance {
  _internal: {
    /** Latest value of each `value-…` input, keyed without the prefix. */
    inputValues: Record<string, unknown>;
    model: ModelLike;
    onModelChangedCallback(args: ModelChangeEvent): void;
  };
  hasScheduledStore?: boolean;
  hasScheduledFetch?: boolean;
  scheduleStore(): void;
  scheduleFetch(): void;
  fetch(): void;
}

const ComponentState: NodeDefinitionOptions = {
  name: 'Component State',
  displayNodeName: 'Component Object',
  category: 'Component Utilities',
  color: 'component',
  docs: 'https://docs.noodl.net/nodes/component-utilities/component-object',
  deprecated: true,
  initialize: function (this: ComponentStateInstance) {
    this._internal.inputValues = {};

    this._internal.onModelChangedCallback = (args: ModelChangeEvent) => {
      if (this.isInputConnected('fetch') !== false) return;

      if (this.hasOutput('value-' + args.name)) {
        this.flagOutputDirty('value-' + args.name);
      }

      if (this.hasOutput('changed-' + args.name)) {
        this.sendSignalOnOutput('changed-' + args.name);
      }

      this.sendSignalOnOutput('changed');
    };

    const model: ModelLike = Model.get('componentState' + this.nodeScope.componentOwner.getInstanceId());
    this._internal.model = model;

    model.on('change', this._internal.onModelChangedCallback);

    //    if(this.isInputConnected('fetch') === false)
    //      this.fetch();
  },
  getInspectInfo(this: ComponentStateInstance): InspectInfo {
    const data = this._internal.model.data;
    return Object.keys(data).map((key) => {
      return { type: 'text', value: key + ': ' + data[key] };
    });
  },
  inputs: {
    properties: {
      type: {
        name: 'stringlist',
        allowEditOnly: true
      },
      displayName: 'Properties',
      group: 'Properties',
      description: 'Names of the values this component keeps, each becoming a matching input and output',
      // Edit-only: the value is read from the node's parameters by `updatePorts`,
      // never at runtime, so the setter is deliberately empty.
      set() {}
    },
    store: {
      displayName: 'Set',
      group: 'Actions',
      description: 'Writes the supplied property values into the component object',
      valueChangedToTrue(this: ComponentStateInstance) {
        this.scheduleStore();
      }
    },
    fetch: {
      displayName: 'Fetch',
      group: 'Actions',
      description: 'Republishes every property; connecting this stops the outputs updating on their own',
      valueChangedToTrue(this: ComponentStateInstance) {
        this.scheduleFetch();
      }
    }
  },
  outputs: {
    changed: {
      type: 'signal',
      displayName: 'Changed',
      group: 'Events',
      description: 'Fires when any property is written, unless Fetch is connected'
    },
    fetched: {
      type: 'signal',
      displayName: 'Fetched',
      group: 'Events',
      description: 'Fires once Fetch has republished every property'
    },
    stored: {
      type: 'signal',
      displayName: 'Stored',
      group: 'Events',
      description: 'Fires once Set has written every property'
    }
  },
  methods: {
    scheduleStore(this: ComponentStateInstance) {
      if (this.hasScheduledStore) return;
      this.hasScheduledStore = true;

      const internal = this._internal;
      this.scheduleAfterInputsHaveUpdated(() => {
        this.hasScheduledStore = false;
        for (const i in internal.inputValues) {
          internal.model.set(i, internal.inputValues[i], { resolve: true });
        }
        this.sendSignalOnOutput('stored');
      });
    },
    scheduleFetch(this: ComponentStateInstance) {
      if (this.hasScheduledFetch) return;
      this.hasScheduledFetch = true;

      this.scheduleAfterInputsHaveUpdated(() => {
        this.hasScheduledFetch = false;
        this.fetch();
      });
    },
    fetch(this: ComponentStateInstance) {
      for (const key in this._internal.model.data) {
        if (this.hasOutput('value-' + key)) {
          this.flagOutputDirty('value-' + key);
          if (this.hasOutput('changed-' + key)) {
            this.sendSignalOnOutput('changed-' + key);
          }
        }
      }
      this.sendSignalOnOutput('fetched');
    },
    _onNodeDeleted(this: ComponentStateInstance) {
      Node.prototype._onNodeDeleted.call(this);
      this._internal.model.off('change', this._internal.onModelChangedCallback);
    },
    registerOutputIfNeeded(this: ComponentStateInstance, name: string) {
      if (this.hasOutput(name)) {
        return;
      }

      const split = name.split('-');
      const propertyName = split[split.length - 1];

      this.registerOutput(name, {
        get(this: ComponentStateInstance) {
          return this._internal.model.get(propertyName, { resolve: true });
        }
      });
    },
    registerInputIfNeeded: function (this: ComponentStateInstance, name: string) {
      if (this.hasInput(name)) {
        return;
      }

      const split = name.split('-');
      const propertyName = split[split.length - 1];

      if (name.startsWith('value-')) {
        this.registerInput(name, {
          set(this: ComponentStateInstance, value: unknown) {
            this._internal.inputValues[propertyName] = value;

            if (this.isInputConnected('store') === false)
              // Lazy set
              this.scheduleStore();
          }
        });
      }
      /*  else if (name.startsWith('start-value-')) {
                this.registerInput(name, {
                    set(value) {
                        this._internal.model.set(propertyName, value)
                    }
                });
            }
            else if (name.startsWith('type-')) {
                this.registerInput(name, {
                    set(value) {}
                });
            }*/
    }
  }
};

function updatePorts(
  nodeId: string,
  parameters: Record<string, unknown>,
  editorConnection: EditorConnectionLike
): void {
  const ports = [];

  // Add value outputs
  if (parameters.properties) {
    const properties = (parameters.properties as string).split(',');
    for (const i in properties) {
      const p = properties[i];

      ports.push({
        type: {
          name: '*',
          allowConnectionsOnly: true
        },
        plug: 'input/output',
        group: 'Properties',
        name: 'value-' + p,
        displayName: p
      });
      /*   ports.push({
                type: {
                    name: parameters['type-' + p] || 'string',
                    allowEditOnly: true
                },
                plug: 'input',
                group: 'Start Values',
                name: 'start-value-' + p,
                displayName: p
            });

            ports.push({
                type: {
                    name: 'enum',
                    enums: [
                        { label: 'Number', value: 'number' },
                        { label: 'String', value: 'string' },
                        { label: 'Boolean', value: 'boolean' },
                        { label: 'Color', value: 'color' },
                        { label: 'Image', value: 'image' }
                    ],
                    allowEditOnly: true
                },
                default: 'string',
                plug: 'input',
                group: 'Types',
                displayName: p,
                name: 'type-' + p,
            });*/

      ports.push({
        type: 'signal',
        plug: 'output',
        group: 'Events',
        displayName: p + ' Changed',
        name: 'changed-' + p
      });
    }
  }

  editorConnection.sendDynamicPorts(nodeId, ports, {
    detectRenamed: {
      plug: 'input/output'
    }
  });
}

const ComponentStateModule: NodeModule = {
  node: ComponentState,
  setup: function (context: NodeContextLike, graphModel: GraphModelLike) {
    const editorConnection = context.editorConnection;
    if (!editorConnection || !editorConnection.isRunningLocally()) {
      return;
    }

    graphModel.on('nodeAdded.Component State', (node: GraphNodeModel) => {
      updatePorts(node.id, node.parameters, editorConnection);

      node.on('parameterUpdated', (event: { name: string }) => {
        if (event.name === 'properties' || event.name.startsWith('type-')) {
          updatePorts(node.id, node.parameters, editorConnection);
        }
      });
    });
  }
};

export default ComponentStateModule;
