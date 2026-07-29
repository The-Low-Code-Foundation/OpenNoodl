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
import Node = require('../../../node');

import { forgetForEachItem, resolveForEachItem } from '../../../foreachitem';

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

/**
 * NDA-004 §2 — the failure surface for the Object family.
 *
 * Applied per node rather than folded into {@link _addModelId}, because {@link _addModelId} also
 * reaches `Create New Object`, which builds its own object and therefore cannot fail to find
 * one. A `Failure` output on a node that cannot fail is worse than no output at all (Failure
 * Contract), so the mixin is opt-in and every consumer states its own code prefix.
 */
function _addFailure(def: MixinNodeModule, codePrefix: string) {
  Object.assign(def.node, {
    outputs: def.node.outputs || {},
    methods: def.node.methods || {}
  });

  Object.assign(def.node.outputs, {
    failure: {
      type: 'signal',
      displayName: 'Failure',
      group: 'Events'
    },
    error: {
      type: 'string',
      displayName: 'Error',
      group: 'Error',
      getter: function (this: FailableNodeInstance) {
        return this._internal.error;
      }
    }
  });

  Object.assign(def.node.methods, {
    /**
     * The node was asked to act and had no object to act on.
     *
     * `codePrefix` is passed in rather than derived from `this.name`, so the raised code reads
     * as the contract's examples do (`set-object-properties/no-object`) instead of echoing an
     * internal type name, and so a rename of either cannot silently change the other.
     */
    _failNoModel: function (this: FailableNodeInstance, action: string) {
      const fromRepeater = this._internal.idSource === 'foreach';
      const message = fromRepeater
        ? 'Nothing to ' + action + ' — Id Source is "From repeater" and no item resolved.'
        : 'Nothing to ' +
          action +
          ' — no object is bound. Set the Id input, or connect one, before triggering this node.';

      this._internal.error = message;
      this.flagOutputDirty('error');

      // Raise only in `explicit` mode. In `foreach` mode `foreachitem.ts` already raised the
      // precise diagnosis when the binding missed (`repeater-item/no-item-in-scope` and
      // friends), and a second, vaguer event about the same root cause is exactly the "two
      // wordings of one failure" the Failure Contract calls noise. The graph surface still
      // fires in both modes, because branching on "the write did not happen" is a different
      // question from "why did the binding miss" and the author may only have wired one.
      if (!fromRepeater) {
        this.raiseRuntimeError(codePrefix + '/no-object', message, { idSource: 'explicit' });
      }

      this.sendSignalOnOutput('failure');
    }
  });
}

/** `this` inside a node that has had {@link _addFailure} mixed in. */
interface FailableNodeInstance extends NodeInstance {
  _internal: {
    error?: string;
    idSource?: unknown;
  };
}

/** `this` inside a node that has had {@link _addModelId} mixed in. */
interface ModelIdNodeInstance extends NodeInstance {
  _internal: {
    model?: ModelLike;
    modelId?: string;
    inputValues?: Record<string, unknown>;
    inputTypes?: Record<string, string>;
    /** Latest `idSource`, so the explicit-target input knows whether it is the live mode. */
    idSource?: unknown;
    /** The `Repeater Component` input: an item component named explicitly (BINDING-CONTRACT §a). */
    repeaterComponent?: string;
  };
  setModelID(id: string): void;
  setModel(model: ModelLike | undefined): void;
  bindToRepeaterItem(): void;
}

/**
 * `this` inside a node that has had {@link _addInputProperties} mixed in as well.
 *
 * `_failNoModel` comes from {@link _addFailure}, which is applied separately — every consumer
 * of `addInputProperties` whose `Do` can find no object also applies it. The optional marker
 * is what keeps `Create New Object`, which applies one mixin and not the other, honest.
 */
interface InputPropertiesNodeInstance extends ModelIdNodeInstance {
  _failNoModel?(action: string): void;
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
      },
      {
        name: 'conditionalports/extended',
        condition: 'idSource = foreach',
        inputs: ['repeaterComponent']
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
          this._internal.idSource = value;
          if (value === 'foreach') this.bindToRepeaterItem();
        }
      },
      /**
       * BINDING-CONTRACT §(a) — which Repeater's item, when nesting makes "the nearest one"
       * ambiguous. Optional: unset keeps the historical nearest-wins resolution exactly.
       */
      repeaterComponent: {
        type: 'component',
        displayName: 'Repeater Component',
        group: 'General',
        set: function (this: ModelIdNodeInstance, value: string) {
          this._internal.repeaterComponent = value || undefined;
          // Only re-resolve in the mode this input belongs to; in `explicit` mode the model
          // comes from `modelId` and rebinding here would quietly overwrite it.
          if (this._internal.idSource === 'foreach') this.bindToRepeaterItem();
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
    /**
     * Bind to the current Repeater/Run Tasks item — BINDING-CONTRACT, via `foreachitem.ts`.
     * The deferral is the one these nodes always had; the reporting is new.
     */
    bindToRepeaterItem: function (this: ModelIdNodeInstance) {
      this.scheduleAfterInputsHaveUpdated(() => {
        this.setModel(resolveForEachItem(this, { target: this._internal.repeaterComponent }));
      });
    },
    setModelID: function (this: ModelIdNodeInstance, id: string) {
      const model = (this.nodeScope.modelScope || Model).get(id);
      this.setModel(model);
    },
    setModel: function (this: ModelIdNodeInstance, model: ModelLike | undefined) {
      this._internal.model = model;
      this.flagOutputDirty('id');
    },
    /**
     * No consumer of this mixin defines its own, so this is the only one — but it still
     * chains to `Node.prototype`, because a future consumer that adds one must not have to
     * remember this. The reporter holds instances strongly and these nodes live inside
     * Repeater templates, which is exactly where instances churn.
     */
    _onNodeDeleted: function (this: ModelIdNodeInstance) {
      Node.prototype._onNodeDeleted.call(this);
      forgetForEachItem(this);
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
                name: 'prop-' + p,
                // Empty-value contract (dev-docs/reference/EMPTY-VALUE-CONTRACT.md): `undefined`
                // abstains — the key is left as it is on the record (including "never set" at
                // all). `null` is a real value — it clears the key and notifies.
                description:
                  'undefined leaves this property on the record unchanged. null clears it (writes ' +
                  'null onto the record and notifies).'
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

      const _allKeys: Record<string, boolean> = {};
      for (const key in internal.inputTypes) _allKeys[key] = true;
      for (const key in internal.inputValues) _allKeys[key] = true;

      const properties = (this.model.parameters.properties as string) || '';

      const validProperties = properties.split(',');

      const keysToSet = Object.keys(_allKeys).filter((key) => validProperties.indexOf(key) !== -1);

      for (const i of keysToSet) {
        let value: unknown = internal.inputValues[i];

        // Empty-value contract (dev-docs/reference/EMPTY-VALUE-CONTRACT.md): `undefined`
        // abstains — no property was supplied, so the key is left exactly as it was on the
        // record (corpus E6/E6'). `undefined` is also every key's value before it has ever
        // been set, which is what makes this the right guard for "never touched" too.
        //
        // Was: the `else` branch wrote `_defaultValueForType[type]` here, which meant an
        // `undefined` write did not skip the key — it overwrote the record's real content
        // with the type's zero value (`''`/`false`/`0`/`new Date()`), or with `undefined`
        // itself for an untyped property. `null` never took this branch (`null !==
        // undefined`), which is why E5 — `null` clearing the key — already worked.
        if (value === undefined) continue;

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

        // `null` is a real value here (contract corollary 1): it reaches `model.set`
        // unmodified — neither of the two resolutions above match it (both require
        // `typeof value === 'string'`) — which clears the key and notifies. Pinned by E5.
        model.set(i, value, { resolve: true });
      }
    },
    scheduleStore: function (this: InputPropertiesNodeInstance) {
      if (this.hasScheduledStore) return;
      this.hasScheduledStore = true;

      const internal = this._internal;
      this.scheduleAfterInputsHaveUpdated(() => {
        this.hasScheduledStore = false;

        // NDA-004 §2: `Do` on a node with no object bound used to return here — no write, no
        // `Done`, no report. From the graph that is indistinguishable from a write that
        // happened, which is the whole complaint the Failure Contract exists to answer.
        //
        // Reached in `explicit` mode when no Id was ever supplied; in `foreach` mode
        // `foreachitem.ts` has already raised the more specific "not inside a Repeater", and
        // the `Failure` output still fires here so the graph can branch either way.
        if (!internal.model) {
          // The guard is not paranoia about `_addFailure`: TypeScript cannot check which
          // mixins a node composed, so without it a consumer that forgot `addFailure` would
          // get a `TypeError` thrown out of a scheduler — the least legible failure there is,
          // and precisely what this task exists to remove. Named instead.
          if (this._failNoModel) this._failNoModel('store');
          else this.raiseRuntimeError('data/mixin-missing', 'This node cannot report failures: addFailure was not applied');
          return;
        }

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
  addBaseInfo: _addBaseInfo,
  addFailure: _addFailure
};

export = ModelCRUDBase;
