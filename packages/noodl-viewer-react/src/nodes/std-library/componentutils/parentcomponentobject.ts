'use strict';

import { EventEmitter } from 'events';
import { Node } from '@noodl/runtime';
import Model from '@noodl/runtime/src/model';
import type {
  ComponentInstanceLike,
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

const graphEventEmitter = new EventEmitter();
graphEventEmitter.setMaxListeners(1000000);

/** `this` inside the Parent Component Object node. */
interface ParentComponentObjectInstance extends NodeInstance {
  _internal: {
    /** Latest value of each `value-…` input, keyed without the prefix. */
    inputValues: Record<string, unknown>;
    /** Id of the parent's record. `undefined` until a parent with one is found. */
    modelId?: string;
    /** The parent's record. Absent while no parent has been resolved. */
    model?: ModelLike;
    /** Shown in the inspector so the author can see *which* parent was found. */
    parentComponentName?: string;
    onModelChangedCallback(args: ModelChangeEvent): void;
  };
  hasScheduledStore?: boolean;
  /** Instance-bound listener, kept so it can be removed again on delete. */
  onComponentStateNodesChanged(): void;
  updateComponentState(): void;
  findParentComponentStateModelId(): string | undefined;
  setModelId(id: string | undefined): void;
  scheduleStore(): void;
}

const ParentComponentObject: NodeDefinitionOptions = {
  name: 'net.noodl.ParentComponentObject',
  displayNodeName: 'Parent Component Object',
  category: 'Component Utilities',
  color: 'component',
  docs: 'https://docs.noodl.net/nodes/component-utilities/parent-component-object',
  initialize(this: ParentComponentObjectInstance) {
    this._internal.inputValues = {};

    this._internal.onModelChangedCallback = (args) => {
      if (this.isInputConnected('fetch') !== false) return;

      if (this.hasOutput('value-' + args.name)) {
        this.flagOutputDirty('value-' + args.name);
      }

      if (this.hasOutput('changed-' + args.name)) {
        this.sendSignalOnOutput('changed-' + args.name);
      }

      this.sendSignalOnOutput('changed');
    };

    //TODO: don't listen for delta updates when running deployed
    this.onComponentStateNodesChanged = () => {
      const id = this.findParentComponentStateModelId();

      if (this._internal.modelId !== id) {
        this._internal.modelId = id;

        if (this.isInputConnected('fetch') === false) {
          this.setModelId(this._internal.modelId);
        }
      }
    };

    graphEventEmitter.on('componentStateNodesChanged', this.onComponentStateNodesChanged);

    this.updateComponentState();
  },
  //to search up the tree the root nodes in this component must have been initialized
  //we also need the connections to be setup so we can use isInputConnected
  //nodeScopeDidInitialize takes care of that
  nodeScopeDidInitialize(this: ParentComponentObjectInstance) {
    //FIXME: temporary hack. Our parent's node scope might not have finished created yet
    //so just wait until after this update. It'll make the parent component state
    //have a delay in propagating outputs which can cause subtle bugs.
    //The fix is to call this code when the entire node tree has been created,
    //before running updating the next update.
    if (!this._internal.modelId) {
      this.context.scheduleAfterUpdate(() => {
        this.updateComponentState();
      });
    }
  },
  getInspectInfo(this: ParentComponentObjectInstance): InspectInfo {
    const model = this._internal.model;
    if (!model) return 'No parent component state found';

    const modelInfo = [{ type: 'text', value: this._internal.parentComponentName }];

    const data = this._internal.model.data;
    return modelInfo.concat(
      Object.keys(data).map((key) => {
        return { type: 'text', value: key + ': ' + data[key] };
      })
    );
  },
  inputs: {
    properties: {
      type: {
        name: 'stringlist',
        allowEditOnly: true
      },
      displayName: 'Properties',
      group: 'Properties',
      set() {}
    },
    fetch: {
      displayName: 'Fetch',
      group: 'Actions',
      valueChangedToTrue: function (this: ParentComponentObjectInstance) {
        this.setModelId(this._internal.modelId);
      }
    }
  },
  outputs: {
    changed: {
      type: 'signal',
      displayName: 'Changed',
      group: 'Events'
    },
    fetched: {
      type: 'signal',
      displayName: 'Fetched',
      group: 'Events'
    }
  },
  methods: {
    updateComponentState(this: ParentComponentObjectInstance) {
      this._internal.modelId = this.findParentComponentStateModelId();
      if (this.isInputConnected('fetch') === false) {
        this.setModelId(this._internal.modelId);
      }
    },
    findParentComponentStateModelId(this: ParentComponentObjectInstance): string | undefined {
      function getParentComponent(component: ComponentInstanceLike): ComponentInstanceLike | undefined {
        let parent: ComponentInstanceLike | undefined;
        if (component.getRoots().length > 0) {
          //visual
          const root = component.getRoots()[0];

          if (root.getVisualParentNode) {
            //regular visual node
            if (root.getVisualParentNode()) {
              parent = root.getVisualParentNode().nodeScope.componentOwner;
            }
          } else if (root.parentNodeScope) {
            //component instance node
            parent = component.parentNodeScope.componentOwner;
          }
        } else if (component.parentNodeScope) {
          parent = component.parentNodeScope.componentOwner;
        }

        //check that a parent exists and that the component is different
        if (parent && parent.nodeScope && parent.nodeScope.componentOwner !== component) {
          //check if parent has a Component State node
          if (parent.nodeScope.getNodesWithType('net.noodl.ComponentObject').length > 0) {
            return parent;
          }

          //if not, continue searching up the tree
          return getParentComponent(parent);
        }
      }

      const parent = getParentComponent(this.nodeScope.componentOwner);
      if (!parent) return;

      this._internal.parentComponentName = parent.name;

      return 'componentState' + parent.getInstanceId();
    },
    setModelId(this: ParentComponentObjectInstance, id: string | undefined) {
      this._internal.model && this._internal.model.off('change', this._internal.onModelChangedCallback);
      this._internal.model = undefined;

      if (!id) return;

      const model: ModelLike = Model.get(id);
      this._internal.model = model;

      model.on('change', this._internal.onModelChangedCallback);

      for (const key in model.data) {
        if (this.hasOutput('value-' + key)) {
          this.flagOutputDirty('value-' + key);
        }
        if (this.hasOutput('changed-' + key)) {
          this.sendSignalOnOutput('changed-' + key);
        }
      }

      this.sendSignalOnOutput('changed');
      this.sendSignalOnOutput('fetched');
    },
    scheduleStore(this: ParentComponentObjectInstance) {
      if (this.hasScheduledStore) return;
      this.hasScheduledStore = true;

      const internal = this._internal;
      this.scheduleAfterInputsHaveUpdated(() => {
        this.hasScheduledStore = false;
        if (!internal.model) return;
        for (const i in internal.inputValues) {
          internal.model.set(i, internal.inputValues[i], { resolve: true });
        }
      });
    },
    _onNodeDeleted(this: ParentComponentObjectInstance) {
      Node.prototype._onNodeDeleted.call(this);

      graphEventEmitter.off('componentStateNodesChanged', this.onComponentStateNodesChanged);
      this._internal.model && this._internal.model.off('change', this._internal.onModelChangedCallback);
    },
    registerOutputIfNeeded(this: ParentComponentObjectInstance, name: string) {
      if (this.hasOutput(name)) {
        return;
      }

      const propertyName = name.substring('value-'.length);

      this.registerOutput(name, {
        get(this: ParentComponentObjectInstance) {
          if (!this._internal.model) return undefined;
          return this._internal.model.get(propertyName, { resolve: true });
        }
      });
    },
    registerInputIfNeeded: function (this: ParentComponentObjectInstance, name: string) {
      if (this.hasInput(name)) {
        return;
      }

      if (name.startsWith('value-')) {
        const propertyName = name.substring('value-'.length);
        this.registerInput(name, {
          set(this: ParentComponentObjectInstance, value: unknown) {
            this._internal.inputValues[propertyName] = value;

            this.scheduleStore();
          }
        });
      }
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
  const propertiesParam = parameters.properties as string | undefined;
  const properties = propertiesParam && propertiesParam.split(',');

  // `properties` is falsy when the author has typed none. The original iterated it with
  // `for…in`, which tolerates that; `for…of` would throw, hence the `|| []`.
  for (const p of properties || []) {
    ports.push({
      type: {
        name: '*', //parameters['type-' + p] || 'string',
        allowConnectionsOnly: true
      },
      plug: 'input/output',
      group: 'Properties',
      name: 'value-' + p,
      displayName: p
    });

    ports.push({
      type: 'signal',
      plug: 'output',
      group: 'Changed Events',
      displayName: p + ' Changed',
      name: 'changed-' + p
    });
  }

  editorConnection.sendDynamicPorts(nodeId, ports, {
    detectRenamed: {
      plug: 'input/output'
    }
  });
}

const ParentComponentObjectModule: NodeModule = {
  node: ParentComponentObject,
  setup: function (context: NodeContextLike, graphModel) {
    const editorConnection = context.editorConnection;
    if (!editorConnection || !editorConnection.isRunningLocally()) {
      return;
    }

    graphModel.on('nodeAdded.net.noodl.ParentComponentObject', (node: GraphNodeModel) => {
      updatePorts(node.id, node.parameters, editorConnection);

      node.on('parameterUpdated', () => {
        updatePorts(node.id, node.parameters, editorConnection);
      });
    });

    //TODO: handle additional delta update event:
    // - visual parent changed

    //this are the same events that'll create and delete the Comopent State instance node
    //it might not have had a chance to run yet if we're first in the event list, so
    //use a setTimeout
    graphModel.on('nodeAdded.net.noodl.ComponentObject', () => {
      setTimeout(() => {
        graphEventEmitter.emit('componentStateNodesChanged');
      }, 0);
    });
    graphModel.on('nodeRemoved.net.noodl.ComponentObject', () => {
      setTimeout(() => {
        graphEventEmitter.emit('componentStateNodesChanged');
      });
    });
  }
};

export default ParentComponentObjectModule;
