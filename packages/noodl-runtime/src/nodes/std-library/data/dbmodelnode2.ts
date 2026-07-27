'use strict';

import type {
  EditorConnectionLike,
  GraphModelLike,
  GraphNodeModel,
  InspectInfo,
  ModelLike,
  ModelModule,
  NodeContextLike,
  NodeDefinitionOptions,
  NodeInstance,
  NodeModule,
  RuntimeDiscoveredPort
} from '@noodl/types';

import Node = require('../../../node');
import EdgeTriggeredInput = require('../../../edgetriggeredinput');
import ModelImport = require('../../../model');
import CloudStore = require('../../../api/cloudstore');

const Model = ModelImport as unknown as ModelModule;

/** One class in the project's `dbCollections` metadata. */
interface DbCollectionMeta {
  name: string;
  schema?: {
    properties?: Record<string, { type?: string; [extra: string]: unknown }>;
  };
}

/**
 * `this` inside the Record node.
 *
 * Structurally the Object node's backend twin, but the `prop-…` ports it publishes are
 * *outputs only* (see `updatePorts`) — a Record is read here and written by the Set Record
 * Properties node. That is why `inputValues`, `userInputSetter` and `scheduleStore` below
 * are never exercised: they are the input half of a symmetry the editor does not offer.
 */
interface DbModelNodeInstance extends NodeInstance {
  _internal: {
    model?: ModelLike;
    modelId?: string;
    collectionId?: string;
    error?: string;
    inputValues: Record<string, unknown>;
    /** Assigned an empty object in `initialize` and read nowhere. Dead. */
    relationModelIds?: Record<string, unknown>;
    onModelChangedCallback?: (args: { name: string }) => void;
    /** `scheduleOnce` writes `hasScheduled<Type>` flags here. */
    [extra: string]: unknown;
  };
  setCollectionID(id: string): void;
  setModelID(id: string): void;
  setModel(model: ModelLike): void;
  scheduleOnce(type: string, cb: () => void): void;
  setError(err: string): void;
  clearWarnings(): void;
  scheduleFetch(): void;
  scheduleStore(): void;
}

const ModelNodeDefinition: NodeDefinitionOptions = {
  name: 'DbModel2',
  docs: 'https://docs.noodl.net/nodes/data/cloud-data/record',
  displayNodeName: 'Record',
  shortDesc: 'Database model',
  category: 'Cloud Services',
  usePortAsLabel: 'collectionName',
  color: 'data',
  dynamicports: [
    {
      name: 'conditionalports/extended',
      condition: 'idSource = explicit OR idSource NOT SET',
      inputs: ['modelId']
    }
  ],
  initialize: function (this: DbModelNodeInstance) {
    const internal = this._internal;
    internal.inputValues = {};
    internal.relationModelIds = {};

    const _this = this;
    this._internal.onModelChangedCallback = function (args: { name: string }) {
      if (_this.isInputConnected('fetch')) return;

      if (_this.hasOutput('prop-' + args.name)) _this.flagOutputDirty('prop-' + args.name);

      if (_this.hasOutput('changed-' + args.name)) _this.sendSignalOnOutput('changed-' + args.name);

      _this.sendSignalOnOutput('changed');
    };
  },
  getInspectInfo(this: DbModelNodeInstance): InspectInfo {
    const model = this._internal.model;
    if (!model) return '[No Record]';

    return [
      { type: 'text', value: 'Id: ' + model.getId() },
      { type: 'value', value: model.data }
    ];
  },
  outputs: {
    id: {
      type: 'string',
      displayName: 'Id',
      group: 'General',
      getter: function (this: DbModelNodeInstance) {
        return this._internal.model ? this._internal.model.getId() : this._internal.modelId;
      }
    },
    fetched: {
      type: 'signal',
      displayName: 'Fetched',
      group: 'Events'
    },
    changed: {
      type: 'signal',
      displayName: 'Changed',
      group: 'Events'
    },
    failure: {
      type: 'signal',
      displayName: 'Failure',
      group: 'Events'
    },
    error: {
      type: 'string',
      displayName: 'Error',
      group: 'Error',
      getter: function (this: DbModelNodeInstance) {
        return this._internal.error;
      }
    }
  },
  inputs: {
    idSource: {
      type: {
        name: 'enum',
        enums: [
          { label: 'Specify explicitly', value: 'explicit' },
          { label: 'From repeater', value: 'foreach' }
        ],
        allowEditOnly: true
      },
      default: 'explicit',
      displayName: 'Id Source',
      group: 'General',
      set: function (this: DbModelNodeInstance, value: unknown) {
        if (value === 'foreach') {
          this.scheduleAfterInputsHaveUpdated(() => {
            // Find closest nodescope that have a _forEachModel
            let component = this.nodeScope.componentOwner;
            while (component !== undefined && component._forEachModel === undefined && component.parentNodeScope) {
              component = component.parentNodeScope.componentOwner;
            }
            // DEFECT (PLAT-003 NOTES §27.3), left verbatim: when the walk finds no repeater
            // this passes `undefined`, and `setModel` below dereferences its argument
            // without a guard — so a Record node set to "From repeater" outside one throws
            // a `TypeError`. The Object node's otherwise-identical `setModel` *does* guard
            // (`modelnode2.ts`), and its comment says the undefined case is expected.
            this.setModel(component !== undefined ? component._forEachModel : undefined);
          });
        }
      }
    },
    modelId: {
      type: { name: 'string', allowConnectionsOnly: true },
      displayName: 'Id',
      group: 'General',
      set: function (this: DbModelNodeInstance, value: unknown) {
        if (value instanceof Model) value = (value as ModelLike).getId();
        // Can be passed as model as well
        else if (typeof value === 'object') value = Model.create(value as Record<string, unknown>).getId(); // If this is an js object, dereference it

        this._internal.modelId = value as string; // Wait to fetch data
        if (this.isInputConnected('fetch') === false) this.setModelID(value as string);
        else {
          this.flagOutputDirty('id');
        }
      }
    },
    fetch: {
      displayName: 'Fetch',
      group: 'Actions',
      valueChangedToTrue: function (this: DbModelNodeInstance) {
        this.scheduleFetch();
      }
    }
  },
  methods: {
    setCollectionID: function (this: DbModelNodeInstance, id: string) {
      this._internal.collectionId = id;
    },
    setModelID: function (this: DbModelNodeInstance, id: string) {
      const model = (this.nodeScope.modelScope || Model).get(id);
      // this._internal.modelIsNew = false;
      this.setModel(model);
    },
    setModel: function (this: DbModelNodeInstance, model: ModelLike) {
      if (this._internal.model)
        // Remove old listener if existing
        this._internal.model.off('change', this._internal.onModelChangedCallback);

      this._internal.model = model;
      this.flagOutputDirty('id');
      model.on('change', this._internal.onModelChangedCallback);

      // We have a new model, mark all outputs as dirty
      for (const key in model.data) {
        if (this.hasOutput('prop-' + key)) this.flagOutputDirty('prop-' + key);
      }
      this.sendSignalOnOutput('fetched');
    },
    _onNodeDeleted: function (this: DbModelNodeInstance) {
      Node.prototype._onNodeDeleted.call(this);
      if (this._internal.model) this._internal.model.off('change', this._internal.onModelChangedCallback);
    },
    scheduleOnce: function (this: DbModelNodeInstance, type: string, cb: () => void) {
      const _this = this;
      const _type = 'hasScheduled' + type;
      if (this._internal[_type]) return;
      this._internal[_type] = true;
      this.scheduleAfterInputsHaveUpdated(function () {
        _this._internal[_type] = false;
        cb();
      });
    },
    setError: function (this: DbModelNodeInstance, err: string) {
      this._internal.error = err;
      this.flagOutputDirty('error');
      this.sendSignalOnOutput('failure');

      if (this.context.editorConnection) {
        this.context.editorConnection.sendWarning(this.nodeScope.componentOwner.name, this.id, 'storage-op-warning', {
          message: err,
          showGlobally: true
        });
      }
    },
    clearWarnings(this: DbModelNodeInstance) {
      if (this.context.editorConnection) {
        this.context.editorConnection.clearWarning(this.nodeScope.componentOwner.name, this.id, 'storage-op-warning');
      }
    },
    scheduleFetch: function (this: DbModelNodeInstance) {
      const _this = this;
      const internal = this._internal;

      this.scheduleOnce('Fetch', function () {
        // Don't do fetch if no id
        if (internal.modelId === undefined || internal.modelId === '') {
          _this.setError('Missing Id.');
          return;
        }

        const cloudstore = CloudStore.forScope(_this.nodeScope.modelScope);
        cloudstore.fetch({
          collection: internal.collectionId,
          objectId: internal.modelId, // Get the objectId part of the model id
          success: function (response: Record<string, unknown>) {
            const model = cloudstore._fromJSON(response, internal.collectionId);
            if (internal.model !== model) {
              // Check if we need to change model
              if (internal.model)
                // Remove old listener if existing
                internal.model.off('change', internal.onModelChangedCallback);

              internal.model = model;
              model.on('change', internal.onModelChangedCallback);
            }
            _this.flagOutputDirty('id');

            delete response.objectId;

            for (const key in response) {
              if (_this.hasOutput('prop-' + key)) _this.flagOutputDirty('prop-' + key);
            }

            _this.sendSignalOnOutput('fetched');
          },
          error: function (err: string) {
            _this.setError(err || 'Failed to fetch.');
          }
        });
      });
    },
    // Dead: nothing calls this. `userInputSetter` — the only writer of `inputValues` — is
    // reached only through a `prop-` *input*, and `updatePorts` publishes the `prop-` ports
    // as outputs. Kept because deleting a method is an edit to a shipping definition.
    scheduleStore: function (this: DbModelNodeInstance) {
      const internal = this._internal;
      if (!internal.model) return;

      this.scheduleOnce('Store', function () {
        for (const i in internal.inputValues) {
          internal.model.set(i, internal.inputValues[i], { resolve: true });
        }
      });
    },
    registerOutputIfNeeded: function (this: DbModelNodeInstance, name: string) {
      if (this.hasOutput(name)) {
        return;
      }

      if (name.startsWith('prop-'))
        this.registerOutput(name, {
          getter: userOutputGetter.bind(this, name.substring('prop-'.length))
        });
    },
    registerInputIfNeeded: function (this: DbModelNodeInstance, name: string) {
      if (this.hasInput(name)) {
        return;
      }

      // DEFECT (PLAT-003 NOTES §27.3), left verbatim: `dynamicSignals` is an empty literal
      // declared one line above the lookup that consults it, so the guard is always false
      // and this whole `EdgeTriggeredInput` branch is unreachable. It is the shape of a
      // table a sibling node fills in, emptied without removing the machinery.
      const dynamicSignals: Record<string, () => void> = {};

      if (dynamicSignals[name])
        return this.registerInput(name, {
          set: EdgeTriggeredInput.createSetter({
            valueChangedToTrue: dynamicSignals[name]
          })
        });

      const dynamicSetters: Record<string, (value: unknown) => void> = {
        collectionName: this.setCollectionID.bind(this)
      };

      if (dynamicSetters[name])
        return this.registerInput(name, {
          set: dynamicSetters[name]
        });

      if (name.startsWith('prop-'))
        this.registerInput(name, {
          set: userInputSetter.bind(this, name.substring('prop-'.length))
        });
    }
  }
};

function userOutputGetter(this: DbModelNodeInstance, name: string) {
  /* jshint validthis:true */
  return this._internal.model ? this._internal.model.get(name, { resolve: true }) : undefined;
}

function userInputSetter(this: DbModelNodeInstance, name: string, value: unknown) {
  //console.log('dbmodel setter:',name,value)
  /* jshint validthis:true */
  this._internal.inputValues[name] = value;
}

function updatePorts(
  nodeId: string,
  parameters: Record<string, unknown>,
  editorConnection: EditorConnectionLike,
  graphModel: GraphModelLike
) {
  const ports: RuntimeDiscoveredPort[] = [];

  const dbCollections = graphModel.getMetaData('dbCollections') as DbCollectionMeta[] | undefined;
  const systemCollections = graphModel.getMetaData('systemCollections') as DbCollectionMeta[] | undefined;

  const _systemClasses = [
    { label: 'User', value: '_User' },
    { label: 'Role', value: '_Role' }
  ];
  ports.push({
    name: 'collectionName',
    displayName: 'Class',
    group: 'General',
    type: {
      name: 'enum',
      enums: _systemClasses.concat(
        dbCollections !== undefined
          ? dbCollections.map((c) => {
              return { value: c.name, label: c.name };
            })
          : []
      ),
      allowEditOnly: true
    },
    plug: 'input'
  });

  if (parameters.collectionName && dbCollections) {
    // Fetch ports from collection keys
    let c = dbCollections.find((c) => c.name === parameters.collectionName);
    if (c === undefined && systemCollections) c = systemCollections.find((c) => c.name === parameters.collectionName);
    if (c && c.schema && c.schema.properties) {
      const props = c.schema.properties;
      for (const key in props) {
        const p = props[key];
        if (ports.find((_p) => _p.name === key)) continue;

        if (p.type === 'Relation') {
          // Relations are reached through the Add/Remove Relation nodes, not as a port here.
        } else {
          // Other schema type ports
          const _typeMap: Record<string, string> = {
            String: 'string',
            Boolean: 'boolean',
            Number: 'number',
            Date: 'date'
          };

          ports.push({
            type: {
              name: _typeMap[p.type] ? _typeMap[p.type] : '*'
            },
            plug: 'output',
            group: 'Properties',
            name: 'prop-' + key,
            displayName: key
          });

          ports.push({
            type: 'signal',
            plug: 'output',
            group: 'Changed Events',
            displayName: key + ' Changed',
            name: 'changed-' + key
          });
        }
      }
    }
  }

  editorConnection.sendDynamicPorts(nodeId, ports);
}

const DbModelNodeModule: NodeModule = {
  node: ModelNodeDefinition,
  setup: function (context: NodeContextLike, graphModel: GraphModelLike) {
    if (!context.editorConnection || !context.editorConnection.isRunningLocally()) {
      return;
    }

    function _managePortsForNode(node: GraphNodeModel) {
      updatePorts(node.id, node.parameters, context.editorConnection, graphModel);

      node.on('parameterUpdated', function () {
        updatePorts(node.id, node.parameters, context.editorConnection, graphModel);
      });

      graphModel.on('metadataChanged.dbCollections', function () {
        CloudStore.invalidateCollections();
        updatePorts(node.id, node.parameters, context.editorConnection, graphModel);
      });

      graphModel.on('metadataChanged.systemCollections', function () {
        CloudStore.invalidateCollections();
        updatePorts(node.id, node.parameters, context.editorConnection, graphModel);
      });
    }

    graphModel.on('editorImportComplete', () => {
      graphModel.on('nodeAdded.DbModel2', function (node: GraphNodeModel) {
        _managePortsForNode(node);
      });

      for (const node of graphModel.getNodesWithType('DbModel2')) {
        _managePortsForNode(node);
      }
    });
  }
};

export = DbModelNodeModule;
