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
  OutcomeToken,
  RuntimeDiscoveredPort
} from '@noodl/types';

import Node = require('../../../node');
import EdgeTriggeredInput = require('../../../edgetriggeredinput');

import { forgetForEachItem, resolveForEachItem } from '../../../foreachitem';
import ModelImport = require('../../../model');
import CloudStore = require('../../../api/cloudstore');
import { outcomeOutputs, reportOutcomes } from '../../../outcome';

import {
  recordBackendPickerPorts,
  recordClassPorts,
  recordFieldPorts,
  recordSchemaContext,
  recordWiredFieldPorts
} from './record-ports';
import { sendSchemaPorts, staticPortNames } from './schema-ports';

const Model = ModelImport as unknown as ModelModule;

/**
 * NDA-004 §2 — the same constant `dbmodelcrudbase` raises, deliberately.
 *
 * One code for the Record family, because these two `setError`s are the same funnel written
 * twice; the message is what distinguishes the cases and `nodeType` rides on the event. It is
 * also the editor's warning key, since the bus's editor subscriber keys by `code` — see
 * `clearWarnings`, which must name this or the warning can never be cleared.
 */
const STORAGE_OP_ERROR_CODE = 'record/storage-op-failed';

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
    /** Latest `idSource`, so the explicit-target input knows whether it is the live mode. */
    idSource?: unknown;
    /** The `Repeater Component` input: an item component named explicitly (BINDING-CONTRACT §a). */
    repeaterComponent?: string;
    /** The `Backend` picker's value: a backend id, `'_endpoint_'`, or `'_active_'`. */
    backendId?: string;
    /**
     * ERG-001. Invocations of `Fetch` that have not reported yet.
     *
     * An array because `scheduleOnce` coalesces — two `Fetch` pulses in one update pass do one
     * read, and must still produce two outcomes. `foreach.tsx`'s `pendingRefreshOutcomes` is the
     * same shape for the same reason.
     *
     * ⚠️ Lazily created in `scheduleFetch` rather than in `initialize`, and that is not
     * defensiveness for its own sake: several suites build this node as a bag of bound methods
     * and never call `initialize`, so an eager field is `undefined` exactly where the first
     * `Fetch` reads it.
     */
    pendingFetch?: OutcomeToken[];
    /** `scheduleOnce` writes `hasScheduled<Type>` flags here. */
    [extra: string]: unknown;
  };
  setCollectionID(id: string): void;
  setModelID(id: string): void;
  setModel(model: ModelLike | undefined): void;
  bindToRepeaterItem(): void;
  scheduleOnce(type: string, cb: () => void): void;
  setError(err: string, tokens?: OutcomeToken[]): void;
  clearWarnings(): void;
  scheduleFetch(): void;
  scheduleStore(): void;
}

const ModelNodeDefinition: NodeDefinitionOptions = {
  name: 'DbModel2',
  docs: 'https://docs.noodl.net/nodes/data/cloud-data/record',
  displayNodeName: 'Record',
  category: 'Cloud Services',
  usePortAsLabel: 'collectionName',
  color: 'data',
  dynamicports: [
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
  ],
  // NDA-017 §2. Same two-governed-things shape as the Object node it mirrors: `Id` is a value
  // setter, the record subscription is not a port.
  runOnValueChange: {
    controlSignal: 'fetch',
    inputs: ['modelId'],
    sources: [{ name: 'record', displayName: 'Record properties' }]
  },
  initialize: function (this: DbModelNodeInstance) {
    const internal = this._internal;
    internal.inputValues = {};
    internal.relationModelIds = {};

    const _this = this;
    this._internal.onModelChangedCallback = function (args: { name: string }) {
      // Was `if (_this.isInputConnected('fetch')) return;`.
      if (!_this.shouldRunOnValueChange('record')) return;

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
      description: 'Id of the record this node is bound to, whether or not it has been read yet',
      getter: function (this: DbModelNodeInstance) {
        return this._internal.model ? this._internal.model.getId() : this._internal.modelId;
      }
    },
    fetched: {
      type: 'signal',
      displayName: 'Fetched',
      group: 'Events',
      description: 'Fires once the record has been read and the property outputs are up to date'
    },
    changed: {
      type: 'signal',
      displayName: 'Changed',
      group: 'Events',
      description: 'Fires when a property of the bound record changes, including a change another node made'
    },
    // ── the outcome contract ────────────────────────────────────────────────
    //
    // ERG-001 §4. `Done` is **added**, not renamed from `Fetched`.
    //
    // ⚠️ `Fetched` and `Changed` are value-level announcements, in the relationship
    // `Items Rendered` has to the Repeater's `Refresh`: `setModel` fires `Fetched` straight
    // from the **`Id` input setter**, where there is no invocation to have an outcome. Folding
    // it in would report `Done` for a value binding. A corpus row pins that path as silent.
    //
    // ⚠️ **No `Unchanged`.** `Fetch` always re-reads the backend — "replacing the copy held in
    // memory" is the input's own description — so it cannot no-op.
    ...outcomeOutputs({
      done: 'Fires when a Fetch finished and the property outputs are up to date',
      failure: 'Fires when the record could not be read, after the reason has been reported on the error channel'
    }),
    error: {
      type: 'string',
      displayName: 'Error',
      group: 'Error',
      description: 'Why the last read failed; empty until one does',
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
      description: 'Whether the record is named by Id or taken from the repeater this node sits inside',
      set: function (this: DbModelNodeInstance, value: unknown) {
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
      description:
        'Which repeater to take the current item from when nesting makes the nearest one ambiguous; leave blank for the nearest, and ignored unless Id Source is From repeater',
      set: function (this: DbModelNodeInstance, value: string) {
        this._internal.repeaterComponent = value || undefined;
        // Only re-resolve in the mode this input belongs to; in `explicit` mode the record
        // comes from `modelId` and rebinding here would quietly overwrite it.
        if (this._internal.idSource === 'foreach') this.bindToRepeaterItem();
      }
    },
    modelId: {
      type: { name: 'string', allowConnectionsOnly: true },
      displayName: 'Id',
      group: 'General',
      description: 'Id of the record to read; ignored unless Id Source is Specify explicitly',
      set: function (this: DbModelNodeInstance, value: unknown) {
        if (value instanceof Model) value = (value as ModelLike).getId();
        // Can be passed as model as well
        //
        // NDA-012 (Data) **OB-ii**, third route: `value !== null` is load-bearing.
        // `typeof null === 'object'`, so a cleared Id used to reach `Model.create(null)`,
        // whose `data ? data : {}` then reads `Model.get(undefined)` — a brand-new
        // **anonymous** record, minted afresh on *every* `null`. Measured: `null` bound
        // `k5OLL681g0`, a record nothing in the graph can name and no backend has ever seen.
        // This runs *before* `setModelID`, so the guard added there cannot see it.
        else if (typeof value === 'object' && value !== null)
          value = Model.create(value as Record<string, unknown>).getId(); // If this is an js object, dereference it

        this._internal.modelId = value as string; // Wait to fetch data
        // NDA-017 §2. Was `if (this.isInputConnected('fetch') === false)`.
        if (this.shouldRunOnValueChange('modelId')) this.setModelID(value as string);
        else {
          this.flagOutputDirty('id');
        }
      }
    },
    fetch: {
      displayName: 'Fetch',
      group: 'Actions',
      description:
        'Re-reads the record from the backend now, replacing the copy held in memory. This is additional to Id rebinding on change and to changes being announced; untick either under Run On Value Change to stop it',
      valueChangedToTrue: function (this: DbModelNodeInstance) {
        this.scheduleFetch();
      }
    }
  },
  methods: {
    /**
     * Bind to the current Repeater/Run Tasks item — BINDING-CONTRACT, via `foreachitem.ts`.
     * The deferral is the one this node always had; the reporting is new.
     */
    bindToRepeaterItem: function (this: DbModelNodeInstance) {
      this.scheduleAfterInputsHaveUpdated(() => {
        this.setModel(resolveForEachItem(this, { target: this._internal.repeaterComponent }));
      });
    },
    setCollectionID: function (this: DbModelNodeInstance, id: string) {
      this._internal.collectionId = id;
    },
    /**
     * NDA-012 (Data) **OB-ii** — see `dbmodelcrudbase.ts`'s `setModelID` for the full shape.
     * An empty `Id` bound the process-wide record named by that spelling (`Model.get('')`)
     * rather than binding nothing, so every Record node with a blank Id shared one record.
     *
     * `setModel(undefined)` is the right answer here rather than an error: this node has no
     * action port to fail on, and its `setModel` already handles an absent model (the
     * PLAT-003 §27.3 guard). It simply binds nothing and stays quiet, which is what a value
     * input being cleared should do.
     */
    setModelID: function (this: DbModelNodeInstance, id: string) {
      if (id === undefined || id === null || id === '') {
        this.setModel(undefined);
        return;
      }

      const model = (this.nodeScope.modelScope || Model).get(id);
      // this._internal.modelIsNew = false;
      this.setModel(model);
    },
    setModel: function (this: DbModelNodeInstance, model: ModelLike | undefined) {
      if (this._internal.model)
        // Remove old listener if existing
        this._internal.model.off('change', this._internal.onModelChangedCallback);

      this._internal.model = model;
      this.flagOutputDirty('id');

      // DEFECT (PLAT-003 NOTES §27.3), now fixed. This dereferenced its argument unguarded,
      // so a Record set to "From repeater" *outside* a repeater threw a `TypeError` from
      // inside an input setter rather than binding to nothing — the same walk that merely
      // fell silent on the Object node crashed here. The Object node's `setModel` always
      // guarded; the two are twins and now agree. The miss itself is reported by
      // `foreachitem.ts`, which is where a failed binding belongs.
      if (!model) return;

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
      // Not optional — the resolved-target reporter holds instances strongly.
      forgetForEachItem(this);
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
    /**
     * NDA-004 §2 / FINDINGS B-iv — the Record family's *second* `setError`.
     *
     * `dbmodelcrudbase` owns the funnel for Set/New/Delete Record Properties and the relation
     * nodes, and moved to the bus first. This node kept its own byte-identical copy, which is
     * the finding's whole point one layer down: a helper that looks shared, copied. Same
     * family, same code, so a subscriber sees one kind of event with `nodeType` to separate
     * them by.
     *
     * ERG-001: the `failure` pulse and the raise both go through `reportOutcome`, so the outcome
     * and its reason cannot drift apart and `Completed` follows automatically. `tokens` is
     * optional because NDA-004's rows call this funnel directly — minting one here keeps that a
     * real, complete failure rather than a branch where a reason reaches the channel with no
     * outcome behind it.
     */
    setError: function (this: DbModelNodeInstance, err: string, tokens?: OutcomeToken[]) {
      this._internal.error = err;
      this.flagOutputDirty('error');

      reportOutcomes(this, tokens || [this.beginOutcome()], 'failure', {
        code: STORAGE_OP_ERROR_CODE,
        message: err
      });
    },
    clearWarnings(this: DbModelNodeInstance) {
      if (this.context.editorConnection) {
        // The bus's editor subscriber keys by the raised `code`, so the clear has to name it or
        // this node accumulates a warning it can never shed. The legacy key goes too, for an
        // editor session that was already open when this landed.
        const component = this.nodeScope.componentOwner.name;
        this.context.editorConnection.clearWarning(component, this.id, STORAGE_OP_ERROR_CODE);
        this.context.editorConnection.clearWarning(component, this.id, 'storage-op-warning');
      }
    },
    scheduleFetch: function (this: DbModelNodeInstance) {
      const _this = this;
      const internal = this._internal;

      // ERG-001. Minted here, in the only method the `Fetch` port reaches. Every other route
      // into this node's record — `setModelID` from the `Id` setter, `bindToRepeaterItem`, a
      // `change` on the bound model — is a value binding with no invocation behind it, and
      // reports nothing. That claim is what a corpus row reads directly.
      const pending = internal.pendingFetch || (internal.pendingFetch = []);
      pending.push(this.beginOutcome());

      this.scheduleOnce('Fetch', function () {
        // Taken into a local before any async work: a second `Fetch` arriving while this read
        // is in flight owns its own batch rather than being settled by this request's answer.
        const tokens = internal.pendingFetch || [];
        internal.pendingFetch = [];

        // Don't do fetch if no id
        if (internal.modelId === undefined || internal.modelId === '') {
          _this.setError('Missing Id.', tokens);
          return;
        }

        // BCN-004 step 5: the store the `Backend` input names, not the singleton. With
        // nothing selected this resolves to exactly the store `forScope` used to return.
        const cloudstore = CloudStore.forBackend(_this.nodeScope.modelScope, internal.backendId as string | undefined);
        if (!cloudstore) {
          _this.setError(
            `The backend this node is set to ("${internal.backendId}") is not configured in this project.`,
            tokens
          );
          return;
        }

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

            // The value-level announcement first, then the invocation's outcome last.
            _this.sendSignalOnOutput('fetched');
            reportOutcomes(_this, tokens, 'done');
          },
          error: function (err: string) {
            _this.setError(err || 'Failed to fetch.', tokens);
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
        collectionName: this.setCollectionID.bind(this),
        // BCN-004 step 5. A dynamic port with no branch here silently drops its value.
        backendId: (value: unknown) => {
          this._internal.backendId = value as string;
        }
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

/**
 * BCN-004 step 5: the Class dropdown and the property outputs come from the selected
 * backend's introspected schema, through the shared generator, for every backend.
 *
 * The property ports are **outputs** here — a Record is read by this node and written by
 * Set Record Properties — and each one still gets its `changed-<field>` signal beside it.
 * `Relation` columns are still absent: they are reached through the Add/Remove Relation
 * nodes rather than as a port.
 */
function updatePorts(
  node: GraphNodeModel,
  editorConnection: EditorConnectionLike,
  graphModel: GraphModelLike
) {
  const ctx = recordSchemaContext(graphModel, node.parameters);
  const ports: RuntimeDiscoveredPort[] = [];

  ports.push(...recordBackendPickerPorts(ctx));
  ports.push(...recordClassPorts(ctx));

  // Two producers of one family, in this order on purpose — the schema half knows the
  // column's type, the wire half only its name and returns nothing the schema half
  // already covered. See `recordWiredFieldPorts` (P77 SBR-008) for why it exists.
  const fieldPorts = ctx.selectedCollection
    ? recordFieldPorts(ctx, {
        plug: 'output',
        skipRelationColumns: true,
        includeChangedSignals: true
      })
    : [];
  ports.push(...fieldPorts);
  ports.push(...recordWiredFieldPorts(node, fieldPorts, { plug: 'output' }));

  sendSchemaPorts(editorConnection, node.id, ports, { staticPorts: staticPortNames(ModelNodeDefinition) });
}

const DbModelNodeModule: NodeModule = {
  node: ModelNodeDefinition,
  setup: function (context: NodeContextLike, graphModel: GraphModelLike) {
    if (!context.editorConnection || !context.editorConnection.isRunningLocally()) {
      return;
    }

    function _managePortsForNode(node: GraphNodeModel) {
      updatePorts(node, context.editorConnection, graphModel);

      node.on('parameterUpdated', function () {
        updatePorts(node, context.editorConnection, graphModel);
      });

      // P77 SBR-008 — the wire-derived half of `prop-*` changes when a WIRE changes, and
      // nothing above fires for that. Both events are needed and neither covers the other:
      // `inputConnectionAdded` reaches only the wire's TARGET node
      // (`models/componentmodel.ts:149-158`), which is the write nodes' case and not the
      // Record node's, whose `prop-*` are outputs. The component-level event carries both
      // ends, so it is filtered to wires touching this node.
      node.on('inputConnectionAdded', function () {
        updatePorts(node, context.editorConnection, graphModel);
      });

      node.on('inputConnectionRemoved', function () {
        updatePorts(node, context.editorConnection, graphModel);
      });

      const onConnectionChanged = function (connection: { sourceId?: string; targetId?: string }) {
        if (!connection) return;
        if (connection.sourceId !== node.id && connection.targetId !== node.id) return;
        updatePorts(node, context.editorConnection, graphModel);
      };

      // `on` rather than the component being present: every real `ComponentModel` is an
      // `EventSender`, but a node reaching here without one must not take the whole
      // `setup()` down — it would cost the node every OTHER port on this list too.
      if (typeof node.component?.on === 'function') {
        node.component.on('connectionAdded', onConnectionChanged, node);
        node.component.on('connectionRemoved', onConnectionChanged, node);
      }

      graphModel.on('metadataChanged.dbCollections', function () {
        CloudStore.invalidateCollections();
        updatePorts(node, context.editorConnection, graphModel);
      });

      graphModel.on('metadataChanged.systemCollections', function () {
        CloudStore.invalidateCollections();
        updatePorts(node, context.editorConnection, graphModel);
      });

      // The two keys the picker and the schema-driven ports actually read now.
      graphModel.on('metadataChanged.backendServices', function () {
        updatePorts(node, context.editorConnection, graphModel);
      });

      graphModel.on('metadataChanged.cloudservices', function () {
        updatePorts(node, context.editorConnection, graphModel);
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
