'use strict';

import type {
  GraphModelLike,
  GraphNodeModel,
  ModelLike,
  ModelModule,
  ModelScopeLike,
  NodeContextLike,
  PrototypeExtensions,
  RuntimeDiscoveredPort
} from '@noodl/types';

import type {
  AccessControlInstance,
  AccessControlList,
  DbCrudBaseInstance,
  DbCrudNodeModule,
  DbInputPropertiesInstance,
  DbModelIdInstance,
  RelationPropertyInstance
} from './crud-mixins';

import ModelImport = require('../../../model');
import Node = require('../../../node');
import CloudStoreImport = require('../../../api/cloudstore');

import { forgetForEachItem, resolveForEachItem } from '../../../foreachitem';

import {
  recordBackendPickerPorts,
  recordClassPorts,
  recordFieldPorts,
  recordRelationPorts,
  recordSchemaContext
} from './record-ports';
import { sendSchemaPorts, staticPortNames } from './schema-ports';

const Model = ModelImport as unknown as ModelModule;

/** What this file reaches for on `CloudStore`. See `api/cloudstore.js`. */
interface CloudStoreLike {
  currentUserId(): string | undefined;
}
const CloudStore = CloudStoreImport as {
  instance: CloudStoreLike;
  forScope(modelScope: ModelScopeLike | undefined): CloudStoreLike;
  forBackend(modelScope: ModelScopeLike | undefined, backendId: string | undefined): CloudStoreLike | undefined;
  invalidateCollections(): void;
};

/**
 * The shared parts of the Record CRUD nodes — Record, Set/New/Delete Record Properties,
 * Add/Remove Relation, Query Records.
 *
 * See `crud-mixins.d.ts` for what each function contributes and why the instance types
 * live there rather than here: `export =` can carry only one thing, and that one thing is
 * the value object at the bottom.
 */

/**
 * The failure code every Record CRUD node raises — NDA-004 §2.
 *
 * One code for the family rather than one per node type, because `setError` is the family's
 * single failure funnel and the message is what distinguishes the cases. `nodeType` rides on the
 * event, so a subscriber that wants per-node granularity still has it.
 *
 * It is also the editor's warning key, since the bus's editor subscriber keys by `code` — see
 * `clearWarnings`, which must name this same constant or the warning can never be cleared.
 */
const STORAGE_OP_ERROR_CODE = 'record/storage-op-failed';

function _addBaseInfo(def: DbCrudNodeModule, opts?: { includeInputProperties?: boolean; includeRelations?: boolean }) {
  const _includeInputProperties = opts === undefined || opts.includeInputProperties;
  const _includeRelations = opts !== undefined && opts.includeRelations;

  Object.assign(def.node, {
    category: 'Data',
    color: 'data',
    inputs: def.node.inputs || {},
    outputs: def.node.outputs || {},
    methods: def.node.methods || {}
  });

  // Outputs
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
      getter: function (this: DbCrudBaseInstance) {
        return this._internal.error;
      }
    }
  });

  // Methods
  Object.assign(def.node.methods, {
    /**
     * The `Backend` picker's setter — BCN-004 step 5.
     *
     * Declared on the *base* rather than in each node so that every member of the family
     * that gets the port also gets the setter; a dynamic port with no `registerInput`
     * branch silently drops its value. The mixins applied after this one snapshot and
     * chain to it, which is why `addBaseInfo` must stay the first call in each node file.
     */
    registerInputIfNeeded: function (this: DbCrudBaseInstance, name: string) {
      if (this.hasInput(name)) return;

      if (name === 'backendId')
        this.registerInput(name, {
          set: (value: unknown) => {
            this._internal.backendId = value as string;
          }
        });
    },
    scheduleOnce: function (this: DbCrudBaseInstance, type: string, cb: () => void) {
      const _this = this;
      const _type = 'hasScheduled' + type;
      if (this._internal[_type]) return;
      this._internal[_type] = true;
      this.scheduleAfterInputsHaveUpdated(function () {
        _this._internal[_type] = false;
        cb();
      });
    },
    checkWarningsBeforeCloudOp(this: DbCrudBaseInstance) {
      //clear all errors first
      this.clearWarnings();

      if (!this._internal.collectionId) {
        this.setError('No class name specified');
        return false;
      }

      return true;
    },
    /**
     * The store this node writes through — BCN-004 step 5.
     *
     * `CloudStore.forScope` resolved nothing and always spoke the Parse wire; this resolves
     * the `Backend` input (or `_active_`, which is what an unset one means) and hands back
     * a store bound to that backend's adapter. With no picker set and no `backendServices`
     * metadata, resolution lands back on the same singleton these nodes have always used.
     *
     * `undefined` means the graph names a backend the project no longer has. Reporting that
     * rather than falling back is the point: a silent fallback writes the record to a
     * different backend than the one the graph says.
     */
    cloudStore: function (this: DbCrudBaseInstance): CloudStoreLike | undefined {
      return (this as unknown as { cloudStoreForScope(s: ModelScopeLike | undefined): CloudStoreLike | undefined })
        .cloudStoreForScope(this.nodeScope.modelScope);
    },
    /**
     * The same resolution against an explicitly given scope — including `undefined`.
     *
     * It exists for exactly one caller: `deletedbmodelpropertiesnode` reads
     * `nodeScope.ModelScope` (capital M, a documented defect left verbatim since PLAT-003)
     * and therefore hands over `undefined` on purpose. A default parameter could not tell
     * that apart from "not passed", and would have quietly fixed the defect as a side
     * effect of this task.
     */
    cloudStoreForScope: function (
      this: DbCrudBaseInstance,
      modelScope: ModelScopeLike | undefined
    ): CloudStoreLike | undefined {
      const store = CloudStore.forBackend(modelScope, this._internal.backendId as string | undefined);

      if (!store) {
        this.setError(
          `The backend this node is set to ("${this._internal.backendId}") is not configured in this project.`
        );
      }

      return store;
    },
    /**
     * NDA-004 §2 — the Record family's failures reach every runtime now, not just the editor.
     *
     * The graph half of this was always right: `error` and `failure` are real ports and fire
     * wherever the node runs. The *diagnosis* was not. It went straight to
     * `editorConnection.sendWarning`, which is the exact pattern the Failure Contract names as
     * the defect — a Record node that could not store said so in the editor and vanished into
     * silence the moment the app shipped, invisible to `On App Error` and to a deployed console.
     *
     * Raising on the bus instead reaches all four contexts, and the editor keeps what it had:
     * `createEditorWarningSubscriber` forwards to `sendWarning` with `{ showGlobally: true,
     * message }` — the identical payload this used to build by hand.
     */
    setError: function (this: DbCrudBaseInstance, err: string) {
      this._internal.error = err;
      this.flagOutputDirty('error');
      this.sendSignalOnOutput('failure');

      this.raiseRuntimeError(STORAGE_OP_ERROR_CODE, err);
    },
    /**
     * The clear has to move with the raise, and that is the whole reason these two are one commit.
     *
     * The bus's editor subscriber keys its warning by the raised **`code`**, not by a key the
     * call site chooses. So the moment `setError` raises, the warning the editor holds is filed
     * under `STORAGE_OP_ERROR_CODE`, and a `clearWarning` still naming `'storage-op-warning'`
     * would clear nothing — every Record node would accumulate a warning it could never shed.
     *
     * The legacy key is cleared as well, and deliberately: an editor session that was already
     * open when this landed can be holding a warning filed under the old name, and nothing else
     * will ever come along to remove it.
     */
    clearWarnings(this: DbCrudBaseInstance) {
      if (this.context.editorConnection) {
        const component = this.nodeScope.componentOwner.name;
        this.context.editorConnection.clearWarning(component, this.id, STORAGE_OP_ERROR_CODE);
        this.context.editorConnection.clearWarning(component, this.id, 'storage-op-warning');
      }
    }
  });

  // Setup
  Object.assign(def, {
    setup: function (context: NodeContextLike, graphModel: GraphModelLike) {
      if (!context.editorConnection || !context.editorConnection.isRunningLocally()) {
        return;
      }

      function _managePortsForNode(node: GraphNodeModel) {
        /**
         * BCN-004 step 5: the Class dropdown and the property ports come from the selected
         * backend's introspected schema, through the shared generator, for every backend —
         * not from the legacy `dbCollections` metadata, which has had nothing writing it
         * since WF-007 gutted `schemahandler.ts`. A Parse-wire backend with no cached
         * schema still finds that metadata (`resolveSchemaPortContext`'s fallback), so a
         * project holding it keeps its ports.
         */
        function _updatePorts() {
          const ctx = recordSchemaContext(graphModel, node.parameters);
          const ports: RuntimeDiscoveredPort[] = [];

          ports.push(...recordBackendPickerPorts(ctx));
          ports.push(...recordClassPorts(ctx));

          if (_includeRelations && ctx.selectedCollection) {
            ports.push(...recordRelationPorts(ctx));
          }

          if (_includeInputProperties && ctx.selectedCollection) {
            ports.push(...recordFieldPorts(ctx, { plug: 'input' }));
          }

          def._additionalDynamicPorts && def._additionalDynamicPorts(node, ports, graphModel);

          // The family's `_additionalDynamicPorts` hook pushes ports too, so the dedupe has
          // to cover the whole list rather than the generated half — see `sendSchemaPorts`.
          sendSchemaPorts(context.editorConnection, node.id, ports, {
            staticPorts: staticPortNames(def.node)
          });
        }

        _updatePorts();

        node.on('parameterUpdated', function () {
          _updatePorts();
        });

        graphModel.on('metadataChanged.dbCollections', function () {
          CloudStore.invalidateCollections();
          _updatePorts();
        });

        graphModel.on('metadataChanged.systemCollections', function () {
          CloudStore.invalidateCollections();
          _updatePorts();
        });

        // The two keys the picker and the schema-driven ports actually read now.
        graphModel.on('metadataChanged.backendServices', function () {
          _updatePorts();
        });

        graphModel.on('metadataChanged.cloudservices', function () {
          _updatePorts();
        });
      }

      graphModel.on('editorImportComplete', () => {
        graphModel.on('nodeAdded.' + def.node.name, function (node: GraphNodeModel) {
          _managePortsForNode(node);
        });

        for (const node of graphModel.getNodesWithType(def.node.name)) {
          _managePortsForNode(node);
        }
      });
    }
  });
}

function _addModelId(def: DbCrudNodeModule, opts?: { includeInputs?: boolean; includeOutputs?: boolean }) {
  const _methods: PrototypeExtensions = Object.assign({}, def.node.methods);

  const _includeInputs = opts === undefined || opts.includeInputs;
  const _includeOutputs = opts === undefined || opts.includeOutputs;

  Object.assign(def.node, {
    inputs: def.node.inputs || {},
    outputs: def.node.outputs || {},
    methods: def.node.methods || {}
  });

  if (_includeInputs) {
    Object.assign(def.node, {
      usePortAsLabel: 'collectionName'
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
        tooltip:
          'Choose if you want to specify the Id explicitly, \n or if you want it to be that of the current record in a repeater.',
        set: function (this: DbModelIdInstance, value: unknown) {
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
        set: function (this: DbModelIdInstance, value: string) {
          this._internal.repeaterComponent = value || undefined;
          // Only re-resolve in the mode this input belongs to; in `explicit` mode the record
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
        set: function (this: DbModelIdInstance, value: unknown) {
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
        getter: function (this: DbModelIdInstance) {
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
    bindToRepeaterItem: function (this: DbModelIdInstance) {
      this.scheduleAfterInputsHaveUpdated(() => {
        this.setModel(resolveForEachItem(this, { target: this._internal.repeaterComponent }));
      });
    },
    /**
     * Chains to `Node.prototype` so a consumer that later adds its own does not have to
     * remember this. The reporter holds instances strongly and these nodes live inside
     * Repeater templates, which is exactly where instances churn.
     */
    _onNodeDeleted: function (this: DbModelIdInstance) {
      Node.prototype._onNodeDeleted.call(this);
      forgetForEachItem(this);
    },
    setCollectionID: function (this: DbModelIdInstance & DbCrudBaseInstance, id: string) {
      this._internal.collectionId = id;
      this.clearWarnings();
    },
    setModelID: function (this: DbModelIdInstance, id: string) {
      const model = (this.nodeScope.modelScope || Model).get(id);
      this.setModel(model);
    },
    setModel: function (this: DbModelIdInstance, model: ModelLike | undefined) {
      this._internal.model = model;
      this.flagOutputDirty('id');
    },
    registerInputIfNeeded: function (this: DbModelIdInstance, name: string) {
      if (this.hasInput(name)) {
        return;
      }

      if (name === 'collectionName')
        this.registerInput(name, {
          set: (this as DbModelIdInstance & DbCrudBaseInstance).setCollectionID.bind(this)
        });

      _methods && _methods.registerInputIfNeeded && (_methods.registerInputIfNeeded as MixinMethod).call(this, name);
    }
  });
}

/**
 * A method snapshotted off `def.node.methods` before a mixin overwrites it, so the new one
 * can chain to the old. `PrototypeExtensions` says a member may be a `PropertyDescriptor`
 * instead; in this family it is always a plain function, and the guard above proves it is
 * present before the call.
 */
type MixinMethod = (this: unknown, ...args: unknown[]) => unknown;

function _addInputProperties(def: DbCrudNodeModule) {
  const _def: DbCrudNodeModule = { node: Object.assign({}, def.node), setup: def.setup };
  const _methods: PrototypeExtensions = Object.assign({}, def.node.methods);

  Object.assign(def.node, {
    inputs: def.node.inputs || {},
    outputs: def.node.outputs || {},
    methods: def.node.methods || {}
  });

  Object.assign(def.node, {
    initialize: function (this: DbInputPropertiesInstance) {
      const internal = this._internal;
      internal.inputValues = {};

      _def.node.initialize && _def.node.initialize.call(this);
    }
  });

  // Outputs
  Object.assign(def.node.outputs, {});

  // Inputs
  Object.assign(def.node.inputs, {});

  // Methods
  Object.assign(def.node.methods, {
    registerInputIfNeeded: function (this: DbInputPropertiesInstance, name: string) {
      if (this.hasInput(name)) {
        return;
      }

      if (name.startsWith('prop-'))
        this.registerInput(name, {
          set: this._setInputValue.bind(this, name.substring('prop-'.length))
        });

      _methods && _methods.registerInputIfNeeded && (_methods.registerInputIfNeeded as MixinMethod).call(this, name);
    },
    _setInputValue: function (this: DbInputPropertiesInstance, name: string, value: unknown) {
      this._internal.inputValues[name] = value;
    }
  });
}

function _addRelationProperty(def: DbCrudNodeModule) {
  const _methods: PrototypeExtensions = Object.assign({}, def.node.methods);

  Object.assign(def.node, {
    inputs: def.node.inputs || {},
    outputs: def.node.outputs || {},
    methods: def.node.methods || {}
  });

  // Inputs
  Object.assign(def.node.inputs, {
    targetId: {
      type: { name: 'string', allowConnectionsOnly: true },
      displayName: 'Target Record Id',
      group: 'General',
      set: function (this: RelationPropertyInstance, value: unknown) {
        this._internal.targetModelId = value as string;
      }
    }
  });

  // Methods
  Object.assign(def.node.methods, {
    registerInputIfNeeded: function (this: RelationPropertyInstance, name: string) {
      if (this.hasInput(name)) {
        return;
      }

      if (name === 'relationProperty')
        this.registerInput(name, {
          set: this.setRelationProperty.bind(this)
        });

      _methods && _methods.registerInputIfNeeded && (_methods.registerInputIfNeeded as MixinMethod).call(this, name);
    },
    setRelationProperty: function (this: RelationPropertyInstance, value: string) {
      this._internal.relationProperty = value;
    }
  });
}

function _getCurrentUser(modelScope: ModelScopeLike | undefined): string | undefined {
  if (typeof _noodl_cloud_runtime_version === 'undefined') {
    // We are running in browser, try to find the current user.
    //
    // BCN-002: this used to read `localStorage['Parse/' + appId + '/currentUser']`
    // and pick `objectId` out of it — node code that knew the storage key, its
    // Parse-shaped name, and which singleton to get an `appId` from. It was the
    // one genuine leak among the nine Parse-concept references this task
    // triaged, and it now asks the adapter, which is the only layer entitled to
    // know how a backend keeps a session. BCN-006 replaces the mechanism; this
    // call site will not have to change again when it does.
    return CloudStore.instance.currentUserId();
  } else {
    // Assume we are running in cloud runtime
    const request = modelScope.get('Request');
    return request.UserId as string;
  }
}

function _addAccessControl(def: DbCrudNodeModule) {
  const _def: DbCrudNodeModule = { node: Object.assign({}, def.node), setup: def.setup };
  const _methods: PrototypeExtensions = Object.assign({}, def.node.methods);

  Object.assign(def.node, {
    inputs: def.node.inputs || {},
    outputs: def.node.outputs || {},
    methods: def.node.methods || {}
  });

  Object.assign(def.node, {
    initialize: function (this: AccessControlInstance) {
      const internal = this._internal;
      internal.accessControl = {};

      _def.node.initialize && _def.node.initialize.call(this);
    }
  });

  // Inputs
  Object.assign(def.node.inputs, {
    accessControl: {
      type: { name: 'proplist', autoName: 'Rule', allowEditOnly: true },
      index: 1000,
      displayName: 'Access Control Rules',
      group: 'Access Control Rules',
      set: function (this: AccessControlInstance, value: unknown) {
        this._internal.accessControlRules = value as AccessControlInstance['_internal']['accessControlRules'];
      }
    }
  });

  // Dynamic ports
  // Chained rather than assigned: `addBaseInfo`'s port builder calls whatever is here last,
  // and more than one mixin may want to contribute.
  const _super = def._additionalDynamicPorts;
  def._additionalDynamicPorts = function (
    node: GraphNodeModel,
    ports: RuntimeDiscoveredPort[],
    graphModel: GraphModelLike
  ) {
    const rules = node.parameters['accessControl'] as { id: string; label: string }[] | undefined;
    if (rules !== undefined && rules.length > 0) {
      rules.forEach((ac) => {
        const prefix = 'acl-' + ac.id;
        // User or role?
        ports.push({
          name: prefix + '-target',
          displayName: 'Target',
          editorName: ac.label + ' | Target',
          plug: 'input',
          type: {
            name: 'enum',
            enums: [
              { value: 'user', label: 'User' },
              { value: 'everyone', label: 'Everyone' },
              { value: 'role', label: 'Role' }
            ],
            allowEditOnly: true
          },
          group: ac.label + ' Access Rule',
          default: 'user',
          parent: 'accessControl',
          parentItemId: ac.id
        });

        if (node.parameters[prefix + '-target'] === 'role') {
          ports.push({
            name: prefix + '-role',
            displayName: 'Role',
            editorName: ac.label + ' | Role',
            group: ac.label + ' Access Rule',
            plug: 'input',
            type: 'string',
            parent: 'accessControl',
            parentItemId: ac.id
          });
        } else if (
          node.parameters[prefix + '-target'] === undefined ||
          node.parameters[prefix + '-target'] === 'user'
        ) {
          ports.push({
            name: prefix + '-userid',
            displayName: 'User Id',
            group: ac.label + ' Access Rule',
            editorName: ac.label + ' | User Id',
            plug: 'input',
            type: { name: 'string', allowConnectionsOnly: true },
            parent: 'accessControl',
            parentItemId: ac.id
          });
        }

        // Read
        ports.push({
          name: prefix + '-read',
          displayName: 'Read',
          editorName: ac.label + ' | Read',
          group: ac.label + ' Access Rule',
          plug: 'input',
          type: { name: 'boolean' },
          default: true,
          parent: 'accessControl',
          parentItemId: ac.id
        });

        // Write
        ports.push({
          name: prefix + '-write',
          displayName: 'Write',
          editorName: ac.label + ' | Write',
          group: ac.label + ' Access Rule',
          plug: 'input',
          type: { name: 'boolean' },
          default: true,
          parent: 'accessControl',
          parentItemId: ac.id
        });
      });
    }

    _super && _super(node, ports, graphModel);
  };

  // Methods
  Object.assign(def.node.methods, {
    registerInputIfNeeded: function (this: AccessControlInstance, name: string) {
      if (this.hasInput(name)) {
        return;
      }

      if (name.startsWith('acl-'))
        this.registerInput(name, {
          set: this.setAccessControl.bind(this, name)
        });

      _methods && _methods.registerInputIfNeeded && (_methods.registerInputIfNeeded as MixinMethod).call(this, name);
    },
    _getACL: function (this: AccessControlInstance): AccessControlList | undefined {
      const acl: AccessControlList = {};

      function _rule(rule: { read?: boolean; write?: boolean }) {
        return {
          read: rule.read === undefined ? true : rule.read,
          write: rule.write === undefined ? true : rule.write
        };
      }

      const currentUserId = _getCurrentUser(this.nodeScope.modelScope);

      if (this._internal.accessControlRules !== undefined) {
        this._internal.accessControlRules.forEach((r) => {
          const rule = this._internal.accessControl[r.id];

          if (rule === undefined) {
            const userId = currentUserId;
            if (userId !== undefined) acl[userId] = { write: true, read: true };
          } else if (rule.target === 'everyone') {
            acl['*'] = _rule(rule);
          } else if (rule.target === 'user') {
            const userId = rule.userid || currentUserId;
            acl[userId] = _rule(rule);
          } else if (rule.target === 'role') {
            acl['role:' + rule.role] = _rule(rule);
          }
        });
      }

      return Object.keys(acl).length > 0 ? acl : undefined;
    },
    setAccessControl: function (this: AccessControlInstance, name: string, value: unknown) {
      const _parts = name.split('-');

      if (this._internal.accessControl[_parts[1]] === undefined) this._internal.accessControl[_parts[1]] = {};
      this._internal.accessControl[_parts[1]][_parts[2]] = value;
    }
  });
}

const DbModelCRUDBase = {
  addInputProperties: _addInputProperties,
  addModelId: _addModelId,
  addBaseInfo: _addBaseInfo,
  addRelationProperty: _addRelationProperty,
  addAccessControl: _addAccessControl
};

export = DbModelCRUDBase;
