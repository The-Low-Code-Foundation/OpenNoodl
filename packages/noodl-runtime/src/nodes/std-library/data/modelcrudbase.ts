'use strict';

import type {
  CollectionModule,
  GraphModelLike,
  GraphNodeModel,
  InspectInfo,
  ModelLike,
  ModelModule,
  NodeContextLike,
  NodeInstance,
  PrototypeExtensions,
  RuntimeDiscoveredPort
} from '@noodl/types';

import type { MixinNodeModule } from './crud-mixins';

import CollectionImport = require('../../../collection');
import ModelImport = require('../../../model');

const Collection = CollectionImport as unknown as CollectionModule;
const Model = ModelImport as unknown as ModelModule;

/**
 * The shared parts of the Object CRUD nodes (New Object, Set Object Properties).
 *
 * These are *mixins*, not definitions: each takes the node module a caller is building and
 * mutates it in place, adding ports, methods and — in `addInputProperties`' case — a
 * `setup` that wraps whatever `setup` the caller had. That in-place style is why the
 * signatures below take {@link MixinNodeModule} and return nothing.
 *
 * The record-backed siblings live in `dbmodelcrudbase.ts` and are deliberately near-copies.
 */

/** `this` inside a node that has had {@link _addModelId} mixed in. */
interface ModelIdNodeInstance extends NodeInstance {
  _internal: {
    model?: ModelLike;
    modelId?: string;
    inputValues?: Record<string, unknown>;
    inputTypes?: Record<string, string>;
  };
  setModelID(id: string): void;
  setModel(model: ModelLike | undefined): void;
}

/** `this` inside a node that has had {@link _addInputProperties} mixed in as well. */
interface InputPropertiesNodeInstance extends ModelIdNodeInstance {
  /** On the instance rather than in `_internal` — guards {@link scheduleStore}. */
  hasScheduledStore?: boolean;
  _pushInputValues(model: ModelLike): void;
  _setInputValue(name: string, value: unknown): void;
  _setInputType(name: string, value: string): void;
}

function _addBaseInfo(def: MixinNodeModule) {
  Object.assign(def.node, {
    category: 'Data',
    color: 'data'
  });
}

function _addModelId(def: MixinNodeModule, opts?: { includeInputs?: boolean; includeOutputs?: boolean }) {
  const _includeInputs = opts === undefined || opts.includeInputs;
  const _includeOutputs = opts === undefined || opts.includeOutputs;

  Object.assign(def.node, {
    inputs: def.node.inputs || {},
    outputs: def.node.outputs || {},
    methods: def.node.methods || {}
  });

  if (_includeInputs) {
    Object.assign(def.node, {
      usePortAsLabel: 'modelId'
    });

    def.node.dynamicports = (def.node.dynamicports || []).concat([
      {
        name: 'conditionalports/extended',
        condition: 'idSource = explicit OR idSource NOT SET',
        inputs: ['modelId']
      }
    ]);

    // Inputs
    Object.assign(def.node.inputs, {
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
        set: function (this: ModelIdNodeInstance, value: unknown) {
          if (value === 'foreach') {
            this.scheduleAfterInputsHaveUpdated(() => {
              // Find closest nodescope that have a _forEachModel
              let component = this.nodeScope.componentOwner;
              while (component !== undefined && component._forEachModel === undefined && component.parentNodeScope) {
                component = component.parentNodeScope.componentOwner;
              }
              this.setModel(component !== undefined ? component._forEachModel : undefined);
            });
          }
        }
      },
      modelId: {
        type: {
          name: 'string',
          identifierOf: 'ModelName',
          identifierDisplayName: 'Object Ids'
        },
        displayName: 'Id',
        group: 'General',
        set: function (this: ModelIdNodeInstance, value: unknown) {
          if (value instanceof Model) value = (value as ModelLike).getId(); // Can be passed as model as well
          this._internal.modelId = value as string; // Wait to fetch data
          this.setModelID(value as string);
        }
      }
    });
  }

  // Outputs
  if (_includeOutputs) {
    Object.assign(def.node.outputs, {
      id: {
        type: 'string',
        displayName: 'Id',
        group: 'General',
        getter: function (this: ModelIdNodeInstance) {
          return this._internal.model ? this._internal.model.getId() : this._internal.modelId;
        }
      }
    });
  }

  // Methods
  Object.assign(def.node.methods, {
    setModelID: function (this: ModelIdNodeInstance, id: string) {
      const model = (this.nodeScope.modelScope || Model).get(id);
      this.setModel(model);
    },
    setModel: function (this: ModelIdNodeInstance, model: ModelLike | undefined) {
      this._internal.model = model;
      this.flagOutputDirty('id');
    }
  });

  //Inspect model
  if (!def.node.getInspectInfo) {
    def.node.getInspectInfo = function (this: ModelIdNodeInstance): InspectInfo {
      const model = this._internal.model;
      if (!model) return '[No Object]';

      return [
        { type: 'text', value: 'Id: ' + model.getId() },
        { type: 'value', value: model.data }
      ];
    };
  }
}

/**
 * A method snapshotted off `def.node.methods` before a mixin overwrites it, so the new one
 * can chain to the old. Mirrors the identical alias in `dbmodelcrudbase.ts`.
 */
type MixinMethod = (this: unknown, ...args: unknown[]) => unknown;

function _addInputProperties(def: MixinNodeModule) {
  const _def: MixinNodeModule = { node: Object.assign({}, def.node), setup: def.setup };
  const _methods: PrototypeExtensions = Object.assign({}, def.node.methods);

  Object.assign(def.node, {
    inputs: def.node.inputs || {},
    outputs: def.node.outputs || {},
    methods: def.node.methods || {}
  });

  Object.assign(def, {
    setup: function (context: NodeContextLike, graphModel: GraphModelLike) {
      if (!context.editorConnection || !context.editorConnection.isRunningLocally()) {
        return;
      }

      graphModel.on('nodeAdded.' + def.node.name, function (node: GraphNodeModel) {
        function _updatePorts() {
          const ports: RuntimeDiscoveredPort[] = [];

          const _types = [
            { label: 'String', value: 'string' },
            { label: 'Boolean', value: 'boolean' },
            { label: 'Number', value: 'number' },
            { label: 'Date', value: 'date' },
            { label: 'Array', value: 'array' },
            { label: 'Object', value: 'object' },
            { label: 'Any', value: '*' }
          ];

          // Add value outputs
          let properties = node.parameters.properties as string | string[] | undefined;
          if (properties) {
            properties = properties ? (properties as string).split(',') : undefined;
            for (const i in properties) {
              const p = properties[i];

              // Property input
              ports.push({
                type: {
                  name: node.parameters['type-' + p] === undefined ? '*' : (node.parameters['type-' + p] as string)
                },
                plug: 'input',
                group: 'Property Values',
                displayName: p,
                //  editorName:p,
                name: 'prop-' + p
              });

              // Property type
              ports.push({
                type: {
                  name: 'enum',
                  enums: _types,
                  allowEditOnly: true
                },
                plug: 'input',
                group: 'Property Types',
                displayName: p,
                default: '*',
                name: 'type-' + p
              });
            }
          }

          context.editorConnection.sendDynamicPorts(node.id, ports, {
            detectRenamed: {
              plug: 'input'
            }
          });
        }

        _updatePorts();

        node.on('parameterUpdated', function () {
          _updatePorts();
        });
      });

      _def.setup && _def.setup(context, graphModel);
    }
  });

  // Initilize
  Object.assign(def.node, {
    initialize: function (this: InputPropertiesNodeInstance) {
      const internal = this._internal;
      internal.inputValues = {};
      internal.inputTypes = {};

      _def.node.initialize && _def.node.initialize.call(this);
    }
  });

  // Outputs
  Object.assign(def.node.outputs, {});

  // Inputs
  Object.assign(def.node.inputs, {
    properties: {
      type: { name: 'stringlist', allowEditOnly: true },
      displayName: 'Properties',
      group: 'Properties to set',
      set: function () {}
    }
  });

  // Methods
  Object.assign(def.node.methods, {
    _pushInputValues: function (this: InputPropertiesNodeInstance, model: ModelLike) {
      const internal = this._internal;

      const _defaultValueForType: Record<string, unknown> = {
        boolean: false,
        string: '',
        number: 0,
        date: new Date()
      };

      const _allKeys: Record<string, boolean> = {};
      for (const key in internal.inputTypes) _allKeys[key] = true;
      for (const key in internal.inputValues) _allKeys[key] = true;

      const properties = (this.model.parameters.properties as string) || '';

      const validProperties = properties.split(',');

      const keysToSet = Object.keys(_allKeys).filter((key) => validProperties.indexOf(key) !== -1);

      for (const i of keysToSet) {
        let value: unknown = internal.inputValues[i];

        if (value !== undefined) {
          //Parse array types with string as javascript
          if (internal.inputTypes[i] !== undefined && internal.inputTypes[i] === 'array' && typeof value === 'string') {
            const source = value;
            this.context.editorConnection.clearWarning(
              this.nodeScope.componentOwner.name,
              this.id,
              'invalid-array-' + i
            );

            try {
              value = eval(source); //this might be static data in the form of javascript
            } catch (e) {
              if (source.indexOf('[') !== -1 || source.indexOf('{') !== -1) {
                this.context.editorConnection.sendWarning(
                  this.nodeScope.componentOwner.name,
                  this.id,
                  'invalid-array-' + i,
                  {
                    showGlobally: true,
                    message: 'Invalid array<br>' + e.toString()
                  }
                );
                value = [];
              } else {
                //backwards compability with how this node used to work
                value = Collection.get(source);
              }
            }
          }
          // Resolve object  from IDs
          if (
            internal.inputTypes[i] !== undefined &&
            internal.inputTypes[i] === 'object' &&
            typeof value === 'string'
          ) {
            value = (this.nodeScope.modelScope || Model).get(value);
          }

          model.set(i, value, { resolve: true });
        } else {
          model.set(i, _defaultValueForType[internal.inputTypes[i]], {
            resolve: true
          });
        }
      }
    },
    scheduleStore: function (this: InputPropertiesNodeInstance) {
      if (this.hasScheduledStore) return;
      this.hasScheduledStore = true;

      const internal = this._internal;
      this.scheduleAfterInputsHaveUpdated(() => {
        this.hasScheduledStore = false;
        if (!internal.model) return;

        this._pushInputValues(internal.model);

        this.sendSignalOnOutput('stored');
      });
    },
    registerInputIfNeeded: function (this: InputPropertiesNodeInstance, name: string) {
      if (this.hasInput(name)) {
        return;
      }

      if (name.startsWith('prop-'))
        this.registerInput(name, {
          set: this._setInputValue.bind(this, name.substring('prop-'.length))
        });

      if (name.startsWith('type-'))
        this.registerInput(name, {
          set: this._setInputType.bind(this, name.substring('type-'.length))
        });

      // DEFECT (PLAT-003 NOTES §27.3), left verbatim: the guard tests the *snapshot*
      // `_methods` but the call goes through `_def.node.methods`, and `_def.node` is a
      // shallow copy — so `_def.node.methods` is the very object the `Object.assign` above
      // has just written this function into. If a caller did supply its own
      // `registerInputIfNeeded`, this would recurse into itself until the stack blew.
      // The record-backed sibling calls `_methods.registerInputIfNeeded` in all four of its
      // equivalent places (`dbmodelcrudbase.ts`), which is what this one means. It is
      // latent rather than live: neither caller declares the method, so the guard is
      // always false.
      _methods &&
        _methods.registerInputIfNeeded &&
        (_def.node.methods.registerInputIfNeeded as MixinMethod).call(this, name);
    },
    _setInputValue: function (this: InputPropertiesNodeInstance, name: string, value: unknown) {
      this._internal.inputValues[name] = value;
    },
    _setInputType: function (this: InputPropertiesNodeInstance, name: string, value: string) {
      this._internal.inputTypes[name] = value;
    }
  });
}

const ModelCRUDBase = {
  addInputProperties: _addInputProperties,
  addModelId: _addModelId,
  addBaseInfo: _addBaseInfo
};

export = ModelCRUDBase;
