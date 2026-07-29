'use strict';

import { EventEmitter } from 'events';
import { Node } from '@noodl/runtime';
import Model from '@noodl/runtime/src/model';
import { findAncestorWithNodeType } from '@noodl/runtime/src/componentwalk';
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

const graphEventEmitter = new EventEmitter();
graphEventEmitter.setMaxListeners(1000000);

/**
 * `this` inside the Parent Component State node — the predecessor of Parent
 * Component Object. It walks the same tree and reads the same `componentState…`
 * records, but looks for a `'Component State'` node rather than a
 * `'net.noodl.ComponentObject'` one, and exposes its properties as bare port
 * names rather than `value-…`.
 */
interface ParentComponentStateInstance extends NodeInstance {
  _internal: {
    /** Latest value of each property input, keyed by port name. */
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

const ParentComponentState: NodeDefinitionOptions = {
  name: 'Parent Component State',
  displayNodeName: 'Parent Component Object',
  category: 'Component Utilities',
  color: 'component',
  docs: 'https://docs.noodl.net/nodes/component-utilities/parent-component-object',
  deprecated: true,
  initialize(this: ParentComponentStateInstance) {
    this._internal.inputValues = {};

    this._internal.onModelChangedCallback = (args: ModelChangeEvent) => {
      if (this.isInputConnected('fetch') === true) return;

      if (this.hasOutput(args.name)) {
        this.flagOutputDirty(args.name);
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
  nodeScopeDidInitialize(this: ParentComponentStateInstance) {
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
  getInspectInfo(this: ParentComponentStateInstance): InspectInfo {
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
      // Edit-only: the value is read from the node's parameters by `updatePorts`,
      // never at runtime, so the setter is deliberately empty.
      set() {}
    },
    store: {
      displayName: 'Set',
      group: 'Actions',
      valueChangedToTrue(this: ParentComponentStateInstance) {
        this.scheduleStore();
      }
    },
    fetch: {
      displayName: 'Fetch',
      group: 'Actions',
      valueChangedToTrue: function (this: ParentComponentStateInstance) {
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
    },
    stored: {
      type: 'signal',
      displayName: 'Stored',
      group: 'Events'
    }
  },
  methods: {
    updateComponentState(this: ParentComponentStateInstance) {
      this._internal.modelId = this.findParentComponentStateModelId();
      if (this.isInputConnected('fetch') === false) {
        this.setModelId(this._internal.modelId);
      }
    },
    /**
     * The last of the four hand-copied walks, now sharing the one implementation.
     *
     * Its type list stays **narrower than {@link COMPONENT_OBJECT_TYPES} on purpose**: this is
     * the deprecated node, and it has only ever bound to the deprecated `'Component State'`.
     * Widening it to accept modern Component Objects too would look like the same tidy-up as
     * everywhere else and would quietly *move* bindings — a project with a Component Object on
     * a nearer ancestor than its Component State would start resolving to the nearer one. So
     * the walk is shared and the list is not.
     */
    findParentComponentStateModelId(this: ParentComponentStateInstance): string | undefined {
      const parent = findAncestorWithNodeType(this.nodeScope.componentOwner, ['Component State']);
      if (!parent) return;

      this._internal.parentComponentName = parent.name;

      return 'componentState' + parent.getInstanceId();
    },
    setModelId(this: ParentComponentStateInstance, id: string | undefined) {
      this._internal.model && this._internal.model.off('change', this._internal.onModelChangedCallback);
      this._internal.model = undefined;

      if (!id) return;

      const model: ModelLike = Model.get(id);
      this._internal.model = model;

      model.on('change', this._internal.onModelChangedCallback);

      for (const key in model.data) {
        if (this.hasOutput(key)) {
          this.flagOutputDirty(key);
        }
        if (this.hasOutput('changed-' + key)) {
          this.sendSignalOnOutput('changed-' + key);
        }
      }

      this.sendSignalOnOutput('changed');
      this.sendSignalOnOutput('fetched');
    },
    scheduleStore(this: ParentComponentStateInstance) {
      if (this.hasScheduledStore) return;
      this.hasScheduledStore = true;

      const internal = this._internal;
      this.scheduleAfterInputsHaveUpdated(() => {
        this.hasScheduledStore = false;
        if (!internal.model) return;
        for (const i in internal.inputValues) {
          internal.model.set(i, internal.inputValues[i], { resolve: true });
        }
        this.sendSignalOnOutput('stored');
      });
    },
    _onNodeDeleted(this: ParentComponentStateInstance) {
      Node.prototype._onNodeDeleted.call(this);

      graphEventEmitter.off('componentStateNodesChanged', this.onComponentStateNodesChanged);
      this._internal.model && this._internal.model.off('change', this._internal.onModelChangedCallback);
    },
    registerOutputIfNeeded(this: ParentComponentStateInstance, name: string) {
      if (this.hasOutput(name)) {
        return;
      }

      this.registerOutput(name, {
        get(this: ParentComponentStateInstance) {
          if (!this._internal.model) return undefined;
          return this._internal.model.get(name, { resolve: true });
        }
      });
    },
    registerInputIfNeeded: function (this: ParentComponentStateInstance, name: string) {
      if (this.hasInput(name)) {
        return;
      }

      this.registerInput(name, {
        set(this: ParentComponentStateInstance, value: unknown) {
          this._internal.inputValues[name] = value;

          if (this.isInputConnected('store') === false)
            // Lazy set
            this.scheduleStore();
        }
      });
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
  const properties = parameters.properties && (parameters.properties as string).split(',');
  for (const i in properties) {
    const p = properties[i];

    ports.push({
      type: {
        name: '*', //parameters['type-' + p] || 'string',
        allowConnectionsOnly: true
      },
      plug: 'input/output',
      group: 'Properties',
      name: p,
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

const ParentComponentStateModule: NodeModule = {
  node: ParentComponentState,
  setup: function (context: NodeContextLike, graphModel: GraphModelLike) {
    const editorConnection = context.editorConnection;
    if (!editorConnection || !editorConnection.isRunningLocally()) {
      return;
    }

    graphModel.on('nodeAdded.Parent Component State', (node: GraphNodeModel) => {
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
    graphModel.on('nodeAdded.Component State', () => {
      setTimeout(() => {
        graphEventEmitter.emit('componentStateNodesChanged');
      }, 0);
    });
    graphModel.on('nodeRemoved.Component State', () => {
      setTimeout(() => {
        graphEventEmitter.emit('componentStateNodesChanged');
      });
    });
  }
};

export default ParentComponentStateModule;
