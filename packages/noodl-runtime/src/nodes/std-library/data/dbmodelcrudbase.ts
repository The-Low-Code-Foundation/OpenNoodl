/// <reference path="../../../globals.d.ts" />
//
// Same rule as `TokenLifecycle.ts` and `ParseWireAdapter`, and the same reason: this file is
// compiled by every consumer's program, `_noodl_cloud_runtime_version` (used by
// `_getCurrentUser` below) is declared only in this package's `src/globals.d.ts`, and the
// identifier must stay **bare** for webpack's DefinePlugin to substitute it.
//
// 🔴 P77 SBR-008 s16 — without this line the file does not COMPILE under a consumer's
// program, and `tests-unit/sb-017/the-browser-half-drops-every-record-field.test.ts` was
// requiring it from noodl-editor's jest: six of the seven Record nodes in the site-builder
// template threw `TS2304` at require time, and the spec's central assertion — *"the runtime
// announces NO `prop-` port"* — had been passing its own throw off as an empty port list.
// ts-jest renders that TSError with a blank message, so the red said nothing at all.

'use strict';

import type {
  GraphModelLike,
  GraphNodeModel,
  ModelLike,
  ModelModule,
  ModelScopeLike,
  NodeContextLike,
  OutcomeToken,
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
import { outcomeOutputs, reportOutcomes } from '../../../outcome';

import {
  recordBackendPickerPorts,
  recordClassPorts,
  recordFieldPorts,
  recordWiredFieldPorts,
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

/**
 * ## ⚠️ Why the two port flags are no longer options — AAQ-002, and it cost a year
 *
 * This used to take `includeInputProperties` and `includeRelations`, defaulted with
 * `opts === undefined || opts.includeInputProperties`. That expression is only ever right
 * while **no other option exists**: the moment ERG-001 §4 added the `done` sentence below,
 * `addBaseInfo(def, { done })` made `opts` defined, `opts.includeInputProperties` was
 * `undefined`, and the whole expression went falsy.
 *
 * The consequence was invisible and total. **Create Record and Update Record stopped
 * emitting a single `prop-<field>` port** — on every backend, in every project, from commit
 * `67d2c339` onward. The Class dropdown kept working, which is exactly what made it look
 * like a schema problem: the node knew the collection existed and offered no way to write to
 * it. It is Richard's finding #7 (*"'prop-age' 'prop-bio' with errors, saying those ports
 * don't exist"*) and it is the **fourth** mechanism proposed for that report — after
 * "provisioning is late" (wrong), "the schema cache is never written" (right, fixed in this
 * phase's Layer 1) and "the backend was reused and its columns never reconciled" (right,
 * fixed as AAQ-002 F4/F5). All three were real. None of them could have made the ports
 * appear, because the generator was switched off underneath them.
 *
 * So the flags are gone, and each one is now derived from **the mixin that actually builds
 * the thing it gates**: `addInputProperties` is what gives a node `prop-*` inputs, and
 * `addRelationProperty` is what gives it a `relationProperty` dropdown. That is the
 * one-fact-in-two-places bug class this phase keeps paying for, removed rather than
 * re-defaulted — a corrected default would leave the next option added here armed with the
 * same trap. They are read inside `_updatePorts` rather than captured here because
 * `addBaseInfo` is called **first** in every one of these files and the mixins that set them
 * have not run yet.
 */
function _addBaseInfo(
  def: DbCrudNodeModule,
  opts?: {
    /**
     * ERG-001 §4 — what this node's `Done` means, in this node's own words.
     *
     * The *ports* are declared once here for all five nodes; only the sentence differs, and it
     * arrives as an option rather than being written into each node's `outputs` because
     * `addBaseInfo` runs **last** (it is called at the bottom of each file) and would clobber
     * anything a node had declared for itself.
     */
    done?: string;
  }
) {

  Object.assign(def.node, {
    category: 'Data',
    color: 'data',
    inputs: def.node.inputs || {},
    outputs: def.node.outputs || {},
    methods: def.node.methods || {}
  });

  // Outputs
  Object.assign(def.node.outputs, {
    /**
     * ── the outcome contract ────────────────────────────────────────────────────────────────
     *
     * ERG-001 §4, declared **once** for all five nodes this base assembles — Create / Update /
     * Delete Record and the two relation nodes. That is the opposite of the Cloud Services
     * shape, where each of the eleven owned its own funnel; here one funnel already served five,
     * and §0.2 Result 2's finding is precisely what happens when five nodes each name the same
     * outcome for themselves (`created`, `stored`, `deleted`, `relationAdded`,
     * `relationRemoved`, all displaying as one word).
     *
     * ⚠️ **No `Unchanged` on any of the five.** Each absence is measured rather than argued —
     * see `erg-001-record-crud-outcomes.test.ts`. The closest call is Remove Record Relation,
     * whose own description says it succeeds when the relation was never there: the backend
     * answers identically either way, so the node has nothing to tell the two apart with, and a
     * port that can never fire is what §5's dead-end check exists to complain about.
     */
    ...outcomeOutputs({
      done: opts && opts.done,
      failure:
        'Fires when the backend refused the operation or the node had nothing valid to send, with the reason on Error'
    }),
    error: {
      type: 'string',
      displayName: 'Error',
      group: 'Error',
      description: 'Why the most recent attempt failed, kept after a later attempt succeeds',
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
    /**
     * ERG-001 §4 — the invocations of one operation kind that have not reported yet.
     *
     * `scheduleOnce` coalesces: two `Do` pulses in one update pass do one request, and must
     * still produce two outcomes, because two invocations are two invocations.
     * `foreach.tsx`'s `pendingRefreshOutcomes` is the same shape and `outcome.ts`'s
     * `reportOutcomes` is the drain, so this is the array rather than a fifth copy of the idea.
     *
     * ⚠️ **Created lazily, here, rather than in `initialize`.** Several suites build these nodes
     * as a bag of bound methods and never call `initialize`, so an eager field is `undefined`
     * exactly where the first invocation reads it — `record-backend-routing.test.ts` is one.
     */
    pendingOutcomes: function (this: DbCrudBaseInstance, kind: string): OutcomeToken[] {
      const field = 'pendingOutcomes' + kind;
      return (
        (this._internal[field] as OutcomeToken[]) || ((this._internal[field] = [] as OutcomeToken[]) as OutcomeToken[])
      );
    },
    /**
     * The batch, taken into the caller's hands and cleared.
     *
     * Drained **before** the request goes out, so a second `Do` arriving mid-flight owns its own
     * batch rather than being settled by the first request's answer.
     */
    takeOutcomes: function (this: DbCrudBaseInstance, kind: string): OutcomeToken[] {
      const field = 'pendingOutcomes' + kind;
      const tokens = (this._internal[field] as OutcomeToken[]) || [];
      this._internal[field] = [] as OutcomeToken[];
      return tokens;
    },
    /**
     * ERG-001 §4: `tokens` is the caller's invocation, not a new one.
     *
     * This runs *before* the deferral, so it used to reach a `setError` that minted and spent a
     * token nobody else knew about while the real invocation stayed open forever. The damage is
     * invisible in the invocation that caused it and shows up in the *next* one, which drains a
     * token this one never spent and reports twice.
     */
    checkWarningsBeforeCloudOp(this: DbCrudBaseInstance, tokens?: OutcomeToken[]) {
      //clear all errors first
      this.clearWarnings();

      if (!this._internal.collectionId) {
        this.setError('No class name specified', tokens);
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
    cloudStore: function (this: DbCrudBaseInstance, tokens?: OutcomeToken[]): CloudStoreLike | undefined {
      return (
        this as unknown as {
          cloudStoreForScope(s: ModelScopeLike | undefined, t?: OutcomeToken[]): CloudStoreLike | undefined;
        }
      ).cloudStoreForScope(this.nodeScope.modelScope, tokens);
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
      modelScope: ModelScopeLike | undefined,
      tokens?: OutcomeToken[]
    ): CloudStoreLike | undefined {
      const store = CloudStore.forBackend(modelScope, this._internal.backendId as string | undefined);

      if (!store) {
        // ERG-001 §4: the caller's invocation, settled here — the caller only has to stop. A
        // token of its own here would have reported one failure and left the real invocation
        // open, which `outcome/duplicate` then catches on the next pulse rather than this one.
        this.setError(
          `The backend this node is set to ("${this._internal.backendId}") is not configured in this project.`,
          tokens
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
     *
     * ERG-001 §4: the `failure` pulse and the raise now both go through `reportOutcome`, so the
     * outcome and its reason cannot drift apart and `Completed` follows automatically. The error
     * value is flagged dirty *first* — "the outcome is the last thing an action does", because a
     * graph wiring `Failure -> show` must already be able to read `Error` when the pulse lands.
     *
     * `tokens` is optional because NDA-004's rows call this funnel directly; minting one here
     * keeps that a real, complete failure rather than a branch where a reason reaches the
     * channel with no outcome behind it. Every *product* caller passes its own.
     */
    setError: function (this: DbCrudBaseInstance, err: string, tokens?: OutcomeToken[]) {
      this._internal.error = err;
      this.flagOutputDirty('error');

      // Spelled exactly as `dbmodelnode2`'s copy of this funnel spells it. Two funnels for one
      // family is the finding this file's header is about; two funnels that also *disagree*
      // about the no-token case would be that finding with a second edge.
      reportOutcomes(this, tokens || [this.beginOutcome()], 'failure', {
        code: STORAGE_OP_ERROR_CODE,
        message: err
      });
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

          // Read off `def` here, not captured at mixin time — see the `_addBaseInfo` note.
          if (def._hasRelationProperty && ctx.selectedCollection) {
            ports.push(...recordRelationPorts(ctx));
          }

          if (def._hasInputProperties) {
            // Two producers of one family, in this order on purpose. The schema half
            // knows the column's type; the wire half only knows the name, and returns
            // nothing the schema half already covered — see `recordWiredFieldPorts`
            // (P77 SBR-008) for why the second one has to exist at all.
            const fieldPorts = ctx.selectedCollection ? recordFieldPorts(ctx, { plug: 'input' }) : [];
            ports.push(...fieldPorts);
            ports.push(...recordWiredFieldPorts(node, fieldPorts, { plug: 'input' }));
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

        // P77 SBR-008 — the wire-derived half of `prop-*` changes when a WIRE changes, and
        // nothing above fires for that. Both events are needed and neither covers the other:
        // `inputConnectionAdded` reaches only the wire's TARGET node
        // (`models/componentmodel.ts:149-158`), which is the write nodes' case and not the
        // Record node's, whose `prop-*` are outputs. The component-level event carries both
        // ends, so it is filtered to wires touching this node.
        node.on('inputConnectionAdded', function () {
          _updatePorts();
        });

        node.on('inputConnectionRemoved', function () {
          _updatePorts();
        });

        const onConnectionChanged = function (connection: { sourceId?: string; targetId?: string }) {
          if (!connection) return;
          if (connection.sourceId !== node.id && connection.targetId !== node.id) return;
          _updatePorts();
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
        description: 'Whether the record comes from the Id input or from the record the surrounding Repeater is on',
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
        description:
          'Names which Repeater supplies the current record when Id Source is From repeater; leave blank to use the nearest enclosing one',
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
        description: 'Id of the record this node acts on; a record itself is accepted here as well as its Id',
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
        description: 'Id of the record this node last acted on, which on Create Record is the Id the backend assigned',
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
    /**
     * NDA-012 (Data) **OB-ii**, the Record family's half — the same shape the Object family
     * carried in `modelcrudbase.ts`, and here it is worse.
     *
     * `Model.get` is create-on-read, and `Model.get('')` / `Model.get(null)` land in the
     * **named** tier (`model.ts:213-236`): one process-wide record per spelling, strong-held
     * for the life of the page. So a blank `Id` used to bind every Record node in the app to
     * the *same* record, write into it, and answer **`Success`** — measured
     * `Model._models['null'].data === {name:'Ada'}` with `signals ['stored']` and no error.
     *
     * For the Record family that is DA-ii's mechanism by a second road: a minted record has
     * `_class === undefined`, which is the value proved to burn a Parse class schema
     * (`Relation<undefined>`) when it reaches a relation write, and `Update`/`Delete Record`
     * would address `objectId: ''` against `className: undefined`.
     *
     * Clearing the binding rather than refusing here is deliberate, and it is why this needs
     * no new failure path: every verb already answers a missing model with
     * `setError('Missing Record Id')`, which fires `Failure`, fills `Error` and raises on the
     * runtime bus. The empty spellings now reach the message that was always waiting for them.
     *
     * ⚠️ The create-on-read for a *real* id is the family's feature and had to survive — a
     * named record that nothing has loaded is supposed to spring into existence. A control row
     * holds that line.
     */
    setModelID: function (this: DbModelIdInstance, id: string) {
      if (id === undefined || id === null || id === '') {
        this.setModel(undefined);
        return;
      }

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

  // The `prop-<field>` ports exist because *this* mixin registers their setters, so this is
  // the only honest place to say a node has them. See `_addBaseInfo`.
  def._hasInputProperties = true;

  /**
   * P77 SBR-008 §9 — the wire is the declaration, said where the EDITOR can hear it.
   *
   * `recordWiredFieldPorts` mints `prop-<field>` from this node's own wires, which is what
   * lets a fresh site name a column nothing has written yet. But it reads those wires off
   * the component the *runtime* holds, and that component reached it through
   * `exportComponent`, which has already dropped every wire the editor called unhealthy —
   * and a wire into a port the editor does not know about is exactly that. So the wire half
   * could only ever recover the fields that are also saved parameters, and the bootstrap
   * case it was built for stayed deadlocked: measured on a wizard-fresh site, this node
   * announced `prop-published/showInNav/navOrder` (its three parameters) and neither of the
   * two that arrive only over a wire.
   *
   * The loop is `editor health → exported wires → runtime ports → editor health`, and it has
   * to be broken exactly once. Not in the exporter (§4's trap: the filter keeps meaning what
   * it says) and not by minting these ports in the editor (§2: `setDynamicPorts` replaces, so
   * a second writer erases the first). What is left is the *verdict*: a wire into a
   * `prop-` port on this family is not a wire into a port that does not exist — it is the
   * author declaring the field, which is this whole task's ruling. The editor reads this to
   * say so, and the runtime stays the only thing that mints a port.
   */
  def.node.wireDeclaredPortPrefix = 'prop-';

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

  // The `relationProperty` dropdown belongs to the nodes that read it. See `_addBaseInfo`.
  def._hasRelationProperty = true;

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
      description:
        'Id of the record at the other end of the relation, which must come from a Query Records or Record output so that its class is known',
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
      description:
        'Read and write rules stored on the record as it is written, each rule adding its own Target, Read and Write ports; the NodeGX backend enforces them on every query and every realtime event, and backends with no per-record access control ignore them',
      /**
       * SPR-001 §1 (F87). Richard asked, while looking at this exact row, whether these
       * rules "actually work … or is it a vestige of the Parse Server nodes". They work.
       * The answer took forty minutes to re-derive from source, which is why it now lives
       * where the question gets asked rather than only in `BAK-003-SECURITY-MODEL.md`.
       *
       * The chain, if you need to re-verify it: `_getACL` below → `newdbmodelpropertiesnode`
       * / `setdbmodelpropertiesnode` → `ParseWireAdapter` `{ ACL: … }` →
       * `nodegx-backend/src/security/model.ts`, whose JS predicate is property-tested
       * against its SQL twin and shared with realtime delivery so query filtering and
       * event filtering cannot drift apart.
       */
      tooltip:
        'Access Control Rules\n' +
        '\n' +
        'Rules written onto the record itself and enforced by the backend, not by your app.\n' +
        '\n' +
        'On the NodeGX backend a record you have no Read rule for is never returned by a query, and its changes are never delivered to you over realtime. It is a real permission boundary, not a display filter.\n' +
        '\n' +
        'Backends that control access another way — Supabase, PostgREST, Directus, PocketBase — have no per-record ACL and ignore these rules. On those this port is disabled, with the reason on the row.',
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
            return;
          }

          /**
           * NDA-012 (Data) — an unset `Target` means `user`, because that is what the port
           * builder already decided it means.
           *
           * `_additionalDynamicPorts` above tests
           * `parameters['acl-…-target'] === undefined || === 'user'` when choosing whether to
           * offer the `User Id` port, so the author-facing half of this node has always read
           * an untouched dropdown as "the current user". The runtime half did not: it fell
           * through `everyone`/`user`/`role` and contributed **nothing**.
           *
           * The reachable case is not an exotic one. The `-target` port is dynamic, so its
           * declared `default: 'user'` never runs a setter unless the author opens the
           * dropdown — while toggling `Read` or `Write` *does* create the rule object. So
           * "add a rule, untick Write" produced an ACL identical to having added no rule at
           * all, and the record was written with no access control whatsoever. Measured on
           * the real mixin before the change: `{accessControlRules:[{id}], accessControl:
           * {id:{read:true,write:false}}}` → `undefined`.
           */
          const target = rule.target === undefined ? 'user' : rule.target;

          if (target === 'everyone') {
            acl['*'] = _rule(rule);
          } else if (target === 'user') {
            const userId = rule.userid || currentUserId;
            /**
             * NDA-012 (Data) — and an unresolvable user is not a user.
             *
             * With no `User Id` wired and nobody signed in, `userId` is `undefined` and this
             * used to write the key `acl['undefined']` — the four-character string. Two things
             * follow, both bad: the record is locked to a principal that cannot exist, and
             * because `Object.keys(acl).length > 0` is then true, the function returns that
             * ACL instead of `undefined`, so the "no rules, no ACL" path cannot rescue it.
             * A record created that way is unreadable by everyone, including its author.
             *
             * The `rule === undefined` branch ten lines up has always guarded exactly this.
             * The two branches simply disagreed.
             */
            if (userId !== undefined) acl[userId] = _rule(rule);
          } else if (target === 'role') {
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
