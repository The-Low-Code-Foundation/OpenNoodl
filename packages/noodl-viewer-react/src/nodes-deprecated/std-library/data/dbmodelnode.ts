'use strict';

import isEqual from 'lodash.isequal';
import { EdgeTriggeredInput, Node } from '@noodl/runtime';
import CloudStore from '@noodl/runtime/src/api/cloudstore';
import ModelImport from '@noodl/runtime/src/model';
import type {
  EditorConnectionLike,
  GraphModelLike,
  GraphNodeModel,
  InspectInfo,
  ModelChangeEvent,
  ModelLike,
  ModelModule,
  NodeContextLike,
  NodeDefinitionOptions,
  NodeInstance,
  NodeModule
} from '@noodl/types';

const Model = ModelImport as ModelModule;

/** A class in the backend schema, as the editor reports it in `dbCollections` metadata. */
interface DbCollectionMeta {
  name: string;
  schema?: { properties?: Record<string, { type?: string }> };
}

/** A port rename the editor should follow rather than treat as delete-plus-add. */
interface PortRename {
  plug: string;
  patterns: string[];
  before: string;
  after: string;
}

/**
 * Last port list sent per node, hashed, so an unchanged set is not resent.
 *
 * Both of these are module-level and keyed by node id, so they outlive the node —
 * nothing removes an entry when a node is deleted.
 */
const modelPortsHash: Record<string, string> = {};
const previousProperties: Record<string, string[]> = {};

/**
 * `this` inside the deprecated Model node — the predecessor of Record.
 *
 * Its ports are `runtime-discovered` twice over: from the `properties` the author
 * typed, and from the *backend* schema, which `setup` reads out of the graph
 * model's `dbCollections` metadata.
 */
interface DbModelNodeInstance extends NodeInstance {
  _internal: {
    /** Latest value of each property input, keyed by port name. */
    inputValues: Record<string, unknown>;
    /** Target record id per relation key, set by the `$relation-modelid-…` inputs. */
    relationModelIds: Record<string, string | undefined>;
    /** The record this node is bound to. Absent until fetched or created. */
    model?: ModelLike;
    modelId?: string;
    /** The backend class name, from the `$ndlCollectionName` port. */
    collectionId?: string;
    /** User JavaScript run over a new record's initial data. */
    modelInitCode?: string;
    error?: string;
    onModelChangedCallback(args: ModelChangeEvent): void;
    /** `hasScheduled<Type>` flags, written by {@link scheduleOnce}. */
    [flag: string]: unknown;
  };
  setCollectionID(id: string): void;
  setModelID(id: string | undefined): void;
  setModel(model: ModelLike): void;
  scheduleOnce(type: string, cb: () => void): void;
  _hasChangesPending(): boolean;
  scheduleFetch(): void;
  scheduleStore(): void;
  storageSave(): void;
  storageDelete(): void;
  storageInsert(): void;
  checkWarningsBeforeCloudOp(): boolean;
  setError(err: string): void;
  clearWarnings(): void;
  onRelationAdd(key: string): void;
  onRelationRemove(key: string): void;
  setRelationModelId(key: string, modelId: string): void;
  _getModelInitData(): Record<string, unknown>;
  setModelInitCode(code: string): void;
}

const ModelNodeDefinition: NodeDefinitionOptions = {
  name: 'DbModel',
  docs: 'https://docs.noodl.net/nodes/cloud-services/model',
  displayNodeName: 'Model',
  shortDesc: 'Database model',
  category: 'Cloud Services',
  usePortAsLabel: '$ndlCollectionName',
  color: 'data',
  deprecated: true, // Use record node
  initialize: function (this: DbModelNodeInstance) {
    const internal = this._internal;
    internal.inputValues = {};
    internal.relationModelIds = {};

    const _this = this;
    this._internal.onModelChangedCallback = function (args: ModelChangeEvent) {
      if (_this.isInputConnected('fetch')) return;

      if (_this.hasOutput(args.name)) _this.flagOutputDirty(args.name);

      if (_this.hasOutput('changed-' + args.name)) _this.sendSignalOnOutput('changed-' + args.name);

      _this.sendSignalOnOutput('changed');
    };
  },
  getInspectInfo(this: DbModelNodeInstance): InspectInfo {
    const model = this._internal.model;
    if (!model) return '[No Model]';

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
    saved: {
      type: 'signal',
      displayName: 'Saved',
      group: 'Events'
    },
    stored: {
      type: 'signal',
      displayName: 'Stored',
      group: 'Events'
    },
    created: {
      type: 'signal',
      displayName: 'Created',
      group: 'Events'
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
    deleted: {
      type: 'signal',
      displayName: 'Deleted',
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
      group: 'Events',
      getter: function (this: DbModelNodeInstance) {
        return this._internal.error;
      }
    }
  },
  inputs: {
    modelId: {
      type: { name: 'string', allowConnectionsOnly: true },
      displayName: 'Id',
      group: 'General',
      set: function (this: DbModelNodeInstance, value: string | ModelLike) {
        const id = value instanceof Model ? value.getId() : (value as string); // Can be passed as model as well
        this._internal.modelId = id; // Wait to fetch data
        if (this.isInputConnected('fetch') === false) this.setModelID(id);
        else {
          this.flagOutputDirty('id');
        }
      }
    },
    properties: {
      type: { name: 'stringlist', allowEditOnly: true },
      displayName: 'Properties',
      group: 'Properties',
      // Edit-only: read from the node's parameters by `updatePorts`, never at runtime.
      set: function () {}
    },
    fetch: {
      displayName: 'Fetch',
      group: 'Actions',
      valueChangedToTrue: function (this: DbModelNodeInstance) {
        this.scheduleFetch();
      }
    },
    store: {
      displayName: 'Set',
      group: 'Actions',
      valueChangedToTrue: function (this: DbModelNodeInstance) {
        this.scheduleStore();
      }
    },
    save: {
      displayName: 'Save',
      group: 'Actions',
      valueChangedToTrue: function (this: DbModelNodeInstance) {
        this.storageSave();
      }
    },
    delete: {
      displayName: 'Delete',
      group: 'Actions',
      valueChangedToTrue: function (this: DbModelNodeInstance) {
        this.storageDelete();
      }
    },
    new: {
      displayName: 'New',
      group: 'Actions',
      valueChangedToTrue: function (this: DbModelNodeInstance) {
        // `storageNew` is not a method of this node, nor of `Node` — this throws a
        // `TypeError` whenever the New input fires. Kept verbatim: the port has been
        // broken for as long as the file has existed and correcting it is a
        // behaviour change (PLAT-003 NOTES §23.4).
        (this as unknown as { storageNew(): void }).storageNew();
      }
    },
    insert: {
      displayName: 'Insert',
      group: 'Actions',
      valueChangedToTrue: function (this: DbModelNodeInstance) {
        this.storageInsert();
        //  this.storageSave();
      }
    }
  },
  methods: {
    setCollectionID: function (this: DbModelNodeInstance, id: string) {
      this._internal.collectionId = id;
      this.clearWarnings();
    },
    setModelID: function (this: DbModelNodeInstance, id: string | undefined) {
      const model: ModelLike = Model.get(id);
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
        if (this.hasOutput(key)) this.flagOutputDirty(key);
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
    // Unreachable: the only call site is commented out inside `storageSave`. Note
    // also that the test is inverted — it reports "changes pending" for the first
    // property that is *equal*. Kept verbatim (PLAT-003 NOTES §23.4).
    _hasChangesPending: function (this: DbModelNodeInstance) {
      const internal = this._internal;
      const model = internal.model;

      for (const key in internal.inputValues) {
        if (isEqual(model.data[key], internal.inputValues[key])) return true;
      }

      return false;
    },
    scheduleFetch: function (this: DbModelNodeInstance) {
      const _this = this;
      const internal = this._internal;

      if (!this.checkWarningsBeforeCloudOp()) return;

      this.scheduleOnce('Fetch', function () {
        if (internal.modelId === undefined || internal.modelId === '') return; // Don't do fetch if no id

        CloudStore.instance.fetch({
          collection: internal.collectionId,
          objectId: internal.modelId, // Get the objectId part of the model id
          success: function (response: Record<string, unknown>) {
            const model: ModelLike = CloudStore._fromJSON(response, internal.collectionId);
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
              // model.set(key,response[key]);

              if (_this.hasOutput(key)) _this.flagOutputDirty(key);
            }

            _this.sendSignalOnOutput('fetched');
          },
          error: function (err: string) {
            _this.setError(err || 'Failed to fetch.');
          }
        });
      });
    },
    scheduleStore: function (this: DbModelNodeInstance) {
      const _this = this;
      const internal = this._internal;
      if (!internal.model) return;

      if (!this.checkWarningsBeforeCloudOp()) return;

      this.scheduleOnce('Store', function () {
        for (const i in internal.inputValues) {
          internal.model.set(i, internal.inputValues[i], { resolve: true });
        }
        _this.sendSignalOnOutput('stored');
      });
    },
    storageSave: function (this: DbModelNodeInstance) {
      const _this = this;
      const internal = this._internal;

      if (!this.checkWarningsBeforeCloudOp()) return;

      //console.log('dbmodel save scheduled')
      this.scheduleOnce('StorageSave', function () {
        if (!internal.model) return;
        const model = internal.model;
        //console.log('dbmodel save hasChanges='+_this._hasChangesPending())
        //if(!_this._internal.modelIsNew && !_this._hasChangesPending()) return; // No need to save, no changes pending

        for (const i in internal.inputValues) {
          model.set(i, internal.inputValues[i], { resolve: true });
        }

        CloudStore.instance.save({
          collection: internal.collectionId,
          objectId: model.getId(), // Get the objectId part of the model id
          data: model.data,
          success: function (response: Record<string, unknown>) {
            for (const key in response) {
              model.set(key, response[key]);
            }
            //                        _this._internal.modelIsNew = false; // If the model was a new model, it is now saved
            _this.sendSignalOnOutput('saved');
          },
          error: function (err: string) {
            _this.setError(err || 'Failed to save.');
          }
        });
      });
    },
    storageDelete: function (this: DbModelNodeInstance) {
      const _this = this;
      if (!this._internal.model) return;
      const internal = this._internal;

      if (!this.checkWarningsBeforeCloudOp()) return;

      this.scheduleOnce('StorageDelete', function () {
        CloudStore.instance.delete({
          collection: internal.collectionId,
          objectId: internal.model.getId(), // Get the objectId part of the model id,
          success: function () {
            internal.model.notify('delete'); // Notify that this model has been deleted
            _this.sendSignalOnOutput('deleted');
          },
          error: function (err: string) {
            _this.setError(err || 'Failed to delete.');
          }
        });
      });
    },
    storageInsert: function (this: DbModelNodeInstance) {
      const _this = this;
      const internal = this._internal;

      if (!this.checkWarningsBeforeCloudOp()) return;

      this.scheduleOnce('StorageInsert', function () {
        const _data = _this._getModelInitData();

        CloudStore.instance.create({
          collection: internal.collectionId,
          data: _data,
          success: function (data: Record<string, unknown>) {
            // Successfully created
            const m: ModelLike = CloudStore._fromJSON(data, internal.collectionId);
            _this.setModel(m);
            _this.sendSignalOnOutput('created');
            _this.sendSignalOnOutput('saved');
          },
          error: function (err: string) {
            _this.setError(err || 'Failed to insert.');
          }
        });
      });
    },
    checkWarningsBeforeCloudOp(this: DbModelNodeInstance) {
      //clear all errors first
      this.clearWarnings();

      if (!this._internal.collectionId) {
        this.setError('No collection name specified');
        return false;
      }

      return true;
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
    onRelationAdd: function (this: DbModelNodeInstance, key: string) {
      const _this = this;
      const internal = this._internal;

      this.scheduleOnce('StorageAddRelation', function () {
        if (!internal.model) return;
        const model = internal.model;

        const targetModelId = internal.relationModelIds[key];
        if (targetModelId === undefined) return;

        CloudStore.instance.addRelation({
          collection: internal.collectionId,
          objectId: model.getId(),
          key: key,
          targetObjectId: targetModelId,
          targetClass: Model.get(targetModelId)._class,
          success: function (response: Record<string, unknown>) {
            for (const _key in response) {
              model.set(_key, response[_key]);
            }

            // Successfully added relation
            _this.sendSignalOnOutput('$relation-added-' + key);
          },
          error: function (err: string) {
            _this.setError(err || 'Failed to add relation.');
          }
        });
      });
    },
    onRelationRemove: function (this: DbModelNodeInstance, key: string) {
      const _this = this;
      const internal = this._internal;

      this.scheduleOnce('StorageRemoveRelation', function () {
        if (!internal.model) return;
        const model = internal.model;

        const targetModelId = internal.relationModelIds[key];
        if (targetModelId === undefined) return;

        CloudStore.instance.removeRelation({
          collection: internal.collectionId,
          objectId: model.getId(),
          key: key,
          targetObjectId: targetModelId,
          targetClass: Model.get(targetModelId)._class,
          success: function (response: Record<string, unknown>) {
            for (const _key in response) {
              model.set(_key, response[_key]);
            }

            // Successfully removed relation
            _this.sendSignalOnOutput('$relation-removed-' + key);
          },
          error: function (err: string) {
            _this.setError(err || 'Failed to remove relation.');
          }
        });
      });
    },
    setRelationModelId: function (this: DbModelNodeInstance, key: string, modelId: string) {
      this._internal.relationModelIds[key] = modelId;
    },
    registerOutputIfNeeded: function (this: DbModelNodeInstance, name: string) {
      if (this.hasOutput(name)) {
        return;
      }

      if (name.startsWith('$relation-added-'))
        return this.registerOutput(name, {
          getter: function () {
            /** No needed for signals */
          }
        });

      if (name.startsWith('$relation-removed-'))
        return this.registerOutput(name, {
          getter: function () {
            /** No needed for signals */
          }
        });

      this.registerOutput(name, {
        getter: userOutputGetter.bind(this, name)
      });
    },
    _getModelInitData: function (this: DbModelNodeInstance) {
      const internal = this._internal;

      const _data: Record<string, unknown> = {};

      // First copy values from inputs
      for (const i in internal.inputValues) {
        _data[i] = internal.inputValues[i];
      }

      // Then run initialize code
      if (this._internal.modelInitCode) {
        try {
          const initCode = new Function('initialize', this._internal.modelInitCode);
          initCode(function (data: Record<string, unknown>) {
            for (const key in data) {
              if (typeof data[key] === 'function') _data[key] = (data[key] as () => unknown)();
              else _data[key] = data[key];
            }
          });
        } catch (e) {
          console.log('Error while initializing model: ' + e);
        }
      }

      return _data;
    },
    setModelInitCode: function (this: DbModelNodeInstance, code: string) {
      this._internal.modelInitCode = code;
    },
    registerInputIfNeeded: function (this: DbModelNodeInstance, name: string) {
      if (this.hasInput(name)) {
        return;
      }

      // Relation inputs
      if (name.startsWith('$relation-add-'))
        return this.registerInput(name, {
          set: EdgeTriggeredInput.createSetter({
            valueChangedToTrue: this.onRelationAdd.bind(this, name.substring('$relation-add-'.length))
          })
        });

      if (name.startsWith('$relation-remove-'))
        return this.registerInput(name, {
          set: EdgeTriggeredInput.createSetter({
            valueChangedToTrue: this.onRelationRemove.bind(this, name.substring('$relation-remove-'.length))
          })
        });

      if (name.startsWith('$relation-modelid-'))
        return this.registerInput(name, {
          set: this.setRelationModelId.bind(this, name.substring('$relation-modelid-'.length))
        });

      const dynamicSignals: Record<string, () => void> = {};

      if (dynamicSignals[name])
        return this.registerInput(name, {
          set: EdgeTriggeredInput.createSetter({
            valueChangedToTrue: dynamicSignals[name]
          })
        });

      const dynamicSetters: Record<string, (value: never) => void> = {
        $ndlCollectionName: this.setCollectionID.bind(this),
        $ndlModelInitCode: this.setModelInitCode.bind(this)
        //       '$ndlModelValidationCode':this.setModelValidationCode.bind(this),
      };

      if (dynamicSetters[name])
        return this.registerInput(name, {
          set: dynamicSetters[name]
        });

      this.registerInput(name, {
        set: userInputSetter.bind(this, name)
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

function detectRename(before: string[] | undefined, after: string[]): { before?: string; after?: string } | undefined {
  if (!before || !after) return;

  if (before.length !== after.length) return; // Must be of same length

  const res: { before?: string; after?: string } = {};
  for (let i = 0; i < before.length; i++) {
    if (after.indexOf(before[i]) === -1) {
      if (res.before) return; // Can only be one from before that is missing
      res.before = before[i];
    }

    if (before.indexOf(after[i]) === -1) {
      if (res.after) return; // Only one can be missing,otherwise we cannot match
      res.after = after[i];
    }
  }

  return res.before && res.after ? res : undefined;
}

const defaultStorageInitCode =
  'initialize({\n' +
  '\t// Here you can initialize new models\n' +
  "\t//myProperty:'Some init value',\n" +
  "\t//anotherProperty:function() { return 'Some other value' }\n" +
  '})\n';

/*const defaultStorageValidateCode = "validation({\n" +
    "\t// Here you add validation specifications for your model properties.\n" +
    "\t//myProperty: { required:true, length:4 },\n" +
    "\t//anotherProperty: function(value) {\n" +
    "\t//\tif(value !== 'someValue) return 'Error message'\n" +
    "\t//}\n" +
    "})\n";*/

function updatePorts(
  nodeId: string,
  parameters: Record<string, unknown>,
  editorConnection: EditorConnectionLike,
  dbCollections: DbCollectionMeta[] | undefined
): void {
  const ports: Record<string, unknown>[] = [];
  // Declared here rather than in the block below because the original relied on
  // `var` hoisting to read it at the `sendDynamicPorts` call.
  let renamed: PortRename | undefined;

  // Add value outputs
  const propertyList = parameters.properties as string | undefined;
  if (propertyList) {
    const properties = propertyList.split(',');
    for (const i in properties) {
      const p = properties[i];

      ports.push({
        type: {
          name: '*',
          allowConnectionsOnly: true
        },
        plug: 'input/output',
        group: 'Properties',
        name: p
      });

      ports.push({
        type: 'signal',
        plug: 'output',
        group: 'Events',
        displayName: 'Changed ' + p,
        name: 'changed-' + p
      });
    }

    const propertyRenamed = detectRename(previousProperties[nodeId], properties);
    previousProperties[nodeId] = properties;
    if (propertyRenamed) {
      renamed = {
        plug: 'input/output',
        patterns: ['{{*}}'],
        before: propertyRenamed.before,
        after: propertyRenamed.after
      };
    }
  }

  ports.push({
    name: '$ndlCollectionName',
    displayName: 'Class',
    group: 'General',
    type: {
      name: 'enum',
      enums:
        dbCollections !== undefined
          ? dbCollections.map((c) => {
              return { value: c.name, label: c.name };
            })
          : [],
      allowEditOnly: true
    },
    plug: 'input'
  });

  if (parameters.$ndlCollectionName && dbCollections) {
    // Fetch ports from collection keys
    const c = dbCollections.find((c) => c.name === parameters.$ndlCollectionName);
    if (c && c.schema && c.schema.properties) {
      const props = c.schema.properties;
      for (const key in props) {
        const p = props[key];
        if (ports.find((_p) => _p.name === key)) continue;

        if (p.type === 'Relation') {
          // Ports for adding / removing relation
          ports.push({
            type: 'signal',
            plug: 'input',
            group: key + ' Relation',
            name: '$relation-add-' + key,
            displayName: 'Add',
            editorName: key + ' | Add'
          });

          ports.push({
            type: 'signal',
            plug: 'input',
            group: key + ' Relation',
            name: '$relation-remove-' + key,
            displayName: 'Remove',
            editorName: key + ' | Remove'
          });

          ports.push({
            type: { name: 'string', allowConnectionsOnly: true },
            plug: 'input',
            group: key + ' Relation',
            name: '$relation-modelid-' + key,
            displayName: 'Model Id',
            editorName: key + ' | Model Id'
          });

          ports.push({
            type: 'signal',
            plug: 'output',
            group: key + ' Relation',
            name: '$relation-removed-' + key,
            displayName: 'Removed',
            editorName: key + ' | Removed'
          });

          ports.push({
            type: 'signal',
            plug: 'output',
            group: key + ' Relation',
            name: '$relation-added-' + key,
            displayName: 'Added',
            editorName: key + ' | Added'
          });
        } else {
          // Other schema type ports
          ports.push({
            type: {
              name: '*',
              allowConnectionsOnly: true
            },
            plug: 'input/output',
            group: 'Properties',
            name: key
          });

          ports.push({
            type: 'signal',
            plug: 'output',
            group: 'Events',
            displayName: 'Changed ' + key,
            name: 'changed-' + key
          });
        }
      }
    }
  }

  // Storage ports

  ports.push({
    name: '$ndlModelInitCode',
    displayName: 'Initialize',
    group: 'Scripts',
    type: {
      name: 'string',
      allowEditOnly: true,
      codeeditor: 'javascript'
    },
    default: defaultStorageInitCode,
    plug: 'input'
  });

  /*  ports.push({
        name:'$ndlModelValidationCode',
        displayName: "Validate",
        group: "Storage scripts",
        "type": {
            name: "string",
            allowEditOnly: true,
            codeeditor: "javascript"
        },
        default: defaultStorageValidateCode,   
        plug:'input'   
      })  */

  const hash = JSON.stringify(ports);
  if (modelPortsHash[nodeId] !== hash) {
    // Make sure we don't resend the same port data
    modelPortsHash[nodeId] = hash;
    editorConnection.sendDynamicPorts(nodeId, ports, { renamed: renamed });
  }
}

const ModelNodeModule: NodeModule = {
  node: ModelNodeDefinition,
  setup: function (context: NodeContextLike, graphModel: GraphModelLike) {
    const editorConnection = context.editorConnection;
    if (!editorConnection || !editorConnection.isRunningLocally()) {
      return;
    }

    function _managePortsForNode(node: GraphNodeModel) {
      updatePorts(
        node.id,
        node.parameters,
        editorConnection,
        graphModel.getMetaData('dbCollections') as DbCollectionMeta[] | undefined
      );

      node.on('parameterUpdated', function () {
        updatePorts(
          node.id,
          node.parameters,
          editorConnection,
          graphModel.getMetaData('dbCollections') as DbCollectionMeta[] | undefined
        );
      });

      graphModel.on('metadataChanged.dbCollections', function (data: DbCollectionMeta[]) {
        CloudStore.invalidateCollections();
        updatePorts(node.id, node.parameters, editorConnection, data);
      });
    }

    graphModel.on('editorImportComplete', () => {
      graphModel.on('nodeAdded.DbModel', function (node: GraphNodeModel) {
        _managePortsForNode(node);
      });

      for (const node of graphModel.getNodesWithType('DbModel')) {
        _managePortsForNode(node);
      }
    });
  }
};

export default ModelNodeModule;
