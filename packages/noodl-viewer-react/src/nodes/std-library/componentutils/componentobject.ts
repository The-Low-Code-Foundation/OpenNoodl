'use strict';

import { Node } from '@noodl/runtime';
import Model from '@noodl/runtime/src/model';
import type {
  EditorConnectionLike,
  GraphNodeModel,
  InspectInfo,
  ModelChangeEvent,
  ModelLike,
  NodeContextLike,
  NodeDefinitionOptions,
  NodeInstance,
  NodeModule
} from '@noodl/types';

/** `this` inside the Component Object node. */
interface ComponentObjectInstance extends NodeInstance {
  _internal: {
    /** Latest value of each `value-…` input, keyed without the prefix. */
    inputValues: Record<string, unknown>;
    /** Which of those still need writing to the model. Cleared after each store. */
    dirtyValues: Record<string, boolean>;
    /** The component-scoped record, keyed on this component *instance*. */
    model: ModelLike;
    onModelChangedCallback(args: ModelChangeEvent): void;
  };
  hasScheduledStore?: boolean;
  hasScheduledFetch?: boolean;
  scheduleStore(): void;
  scheduleFetch(): void;
  fetch(): void;
}

const ComponentObject: NodeDefinitionOptions = {
  name: 'net.noodl.ComponentObject',
  displayNodeName: 'Component Object',
  category: 'Component Utilities',
  color: 'component',
  docs: 'https://docs.noodl.net/nodes/component-utilities/component-object',
  // NDA-017 §2. `Fetch` is this family's control signal. It has no value input to suppress —
  // what it silenced is the node's subscription to the component object, which is why the old
  // `Changed` description had to end "unless Fetch is connected".
  runOnValueChange: {
    controlSignal: 'fetch',
    sources: [{ name: 'object', displayName: 'Object properties' }]
  },
  initialize: function (this: ComponentObjectInstance) {
    this._internal.inputValues = {};
    this._internal.dirtyValues = {};

    this._internal.onModelChangedCallback = (args) => {
      // Was `if (this.isInputConnected('fetch') !== false) return;`.
      if (!this.shouldRunOnValueChange('object')) return;

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
  },
  getInspectInfo(this: ComponentObjectInstance): InspectInfo {
    return {
      type: 'value',
      value: this._internal.model.data
    };
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
      set() {}
    },
    fetch: {
      displayName: 'Fetch',
      group: 'Actions',
      description:
        'Republishes every property now. This is additional to the outputs updating on their own; untick Object properties under Run On Value Change to stop that',
      valueChangedToTrue(this: ComponentObjectInstance) {
        this.scheduleFetch();
      }
    }
  },
  outputs: {
    changed: {
      type: 'signal',
      displayName: 'Changed',
      group: 'Events',
      description: 'Fires when any property is written, unless Object properties is unticked under Run On Value Change'
    },
    fetched: {
      type: 'signal',
      displayName: 'Fetched',
      group: 'Events',
      description: 'Fires once Fetch has republished every property'
    }
  },
  methods: {
    /**
     * NDA-004 §2 — **🔵 by evidence, twice over.**
     *
     * Neither half of the usual test is met. There is no walk to miss: `_internal.model` is
     * `componentState<own instance id>`, built in `initialize` and never reassigned, and
     * `Model.get` is create-on-read, so this node cannot be asked to write and find nothing to
     * write to. And there is no `Do`: this is reached from a `value-…` input's setter, i.e. from
     * any value arriving, which is the trap that stopped the Object node getting a `Failure` port
     * in this same batch — a raise here would fire on the ordinary boot path.
     *
     * Contrast `parentcomponentobject.ts`, which walks and therefore can and does miss, and
     * `setparentcomponentobjectproperties.ts`, which walked, missed, and reported `Done`.
     */
    scheduleStore(this: ComponentObjectInstance) {
      if (this.hasScheduledStore) return;
      this.hasScheduledStore = true;

      const internal = this._internal;
      this.scheduleAfterInputsHaveUpdated(() => {
        this.hasScheduledStore = false;
        for (const i in internal.dirtyValues) {
          internal.model.set(i, internal.inputValues[i], { resolve: true });
        }
        internal.dirtyValues = {};
      });
    },
    scheduleFetch(this: ComponentObjectInstance) {
      if (this.hasScheduledFetch) return;
      this.hasScheduledFetch = true;

      this.scheduleAfterInputsHaveUpdated(() => {
        this.hasScheduledFetch = false;
        this.fetch();
      });
    },
    fetch(this: ComponentObjectInstance) {
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
    _onNodeDeleted(this: ComponentObjectInstance) {
      Node.prototype._onNodeDeleted.call(this);
      this._internal.model.off('change', this._internal.onModelChangedCallback);
    },
    registerOutputIfNeeded(this: ComponentObjectInstance, name: string) {
      if (this.hasOutput(name)) {
        return;
      }

      /**
       * NDA-012 (Component Utilities). This was `name.split('-')` and the **last** segment,
       * while `registerInputIfNeeded` a few lines below strips the `value-` prefix properly.
       * The two therefore disagreed the moment a property name contained a hyphen: with a
       * property called `first-name`, the input wrote `first-name` into the record and the
       * output read `name` out of it, so the port pair that exists to be the same piece of
       * state was a writer and a reader of two different keys — `F-i′` one level down.
       *
       * `fetch()` and the model-change callback were already right, because both key off the
       * record's own names, so the output was the only wrong reader.
       *
       * Property names without a hyphen are unaffected: for those the last segment *is* the
       * whole name, which is why this survived.
       */
      const propertyName = name.startsWith('value-')
        ? name.substring('value-'.length)
        : name.startsWith('changed-')
          ? name.substring('changed-'.length)
          : name;

      this.registerOutput(name, {
        get(this: ComponentObjectInstance) {
          return this._internal.model.get(propertyName, { resolve: true });
        }
      });
    },
    registerInputIfNeeded: function (this: ComponentObjectInstance, name: string) {
      if (this.hasInput(name)) {
        return;
      }

      if (name.startsWith('value-')) {
        const propertyName = name.substring('value-'.length);
        this.registerInput(name, {
          set(this: ComponentObjectInstance, value: unknown) {
            this._internal.inputValues[propertyName] = value;
            this._internal.dirtyValues[propertyName] = true;

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
                    set() {}
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
  const properties = parameters.properties as string | undefined;
  if (properties) {
    for (const p of properties.split(',')) {
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
        group: 'Changed Events',
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

const ComponentObjectModule: NodeModule = {
  node: ComponentObject,
  setup: function (context: NodeContextLike, graphModel) {
    const editorConnection = context.editorConnection;
    if (!editorConnection || !editorConnection.isRunningLocally()) {
      return;
    }

    graphModel.on('nodeAdded.net.noodl.ComponentObject', (node: GraphNodeModel) => {
      updatePorts(node.id, node.parameters, editorConnection);

      node.on('parameterUpdated', (event: { name: string }) => {
        if (event.name === 'properties') {
          updatePorts(node.id, node.parameters, editorConnection);
        }
      });
    });
  }
};

export default ComponentObjectModule;
