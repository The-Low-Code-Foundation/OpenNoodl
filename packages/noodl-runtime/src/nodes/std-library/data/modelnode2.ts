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
import ModelImport = require('../../../model');

import { forgetForEachItem, resolveForEachItem } from '../../../foreachitem';
import { outcomeOutputs, reportOutcomes } from '../../../outcome';

const Model = ModelImport as unknown as ModelModule;

/**
 * ERG-001 §4 / NDA-004 §2 — the code `Fetch` raises when it has nothing to bind to.
 *
 * The Object node had no error channel at all before this, so this is a new key rather than one
 * borrowed from a sibling: the Record family's `record/storage-op-failed` names a *backend*
 * operation, and this node never talks to one.
 */
const OBJECT_FETCH_ERROR_CODE = 'object/fetch-failed';

/**
 * `this` inside the Object node.
 *
 * Every `prop-…` port is dynamic, derived from the `properties` string list, so the node's
 * whole data surface is registered at runtime rather than declared. The `fetch` input
 * changes the node's mode: connected, an id no longer resolves immediately — it waits to be
 * pulled — which is why `modelId`'s setter branches on `isInputConnected('fetch')`.
 */
interface ModelNodeInstance extends NodeInstance {
  _internal: {
    model?: ModelLike;
    modelId?: string;
    inputValues: Record<string, unknown>;
    /** Which inputs have changed since the last store, so unchanged ones are not rewritten. */
    dirtyValues: Record<string, boolean>;
    onModelChangedCallback?: (args: { name: string }) => void;
    /** Latest `idSource`, so the explicit-target input knows whether it is the live mode. */
    idSource?: unknown;
    /** The `Repeater Component` input: an item component named explicitly (BINDING-CONTRACT §a). */
    repeaterComponent?: string;
    /**
     * ERG-001 §4. Invocations of `Fetch` that have not reported yet.
     *
     * An array because `scheduleSetModel` coalesces: two presses in one update pass do one
     * rebind and must still produce two outcomes. Lazily created in that method, not here.
     */
    pendingFetch?: OutcomeToken[];
  };
  /** On the instance rather than in `_internal` — these guard the two schedulers. */
  hasScheduledStore?: boolean;
  hasScheduledSetModel?: boolean;
  scheduleStore(): void;
  scheduleSetModel(): void;
  setModelID(id: string): void;
  setModel(model: ModelLike | undefined): void;
  bindToRepeaterItem(): void;
}

const ModelNodeDefinition: NodeDefinitionOptions = {
  name: 'Model2',
  docs: 'https://docs.noodl.net/nodes/data/object/object-node',
  displayNodeName: 'Object',
  category: 'Data',
  usePortAsLabel: 'modelId',
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
  // NDA-017 §2. `Fetch` is this family's control signal, and it silenced two different
  // things — which is exactly why the old `fetch` description below had to describe a "pull
  // mode" rather than an action. `Id` is a value setter; the object subscription is not a
  // port at all. Both are governed now, and separately.
  runOnValueChange: {
    controlSignal: 'fetch',
    inputs: ['modelId'],
    sources: [{ name: 'object', displayName: 'Object properties' }]
  },
  initialize: function (this: ModelNodeInstance) {
    const internal = this._internal;
    internal.inputValues = {};
    internal.dirtyValues = {};

    const _this = this;
    this._internal.onModelChangedCallback = function (args: { name: string }) {
      // Was `if (_this.isInputConnected('fetch') === true) return;`.
      if (!_this.shouldRunOnValueChange('object')) return;

      if (_this.hasOutput('prop-' + args.name)) _this.flagOutputDirty('prop-' + args.name);

      if (_this.hasOutput('changed-' + args.name)) _this.sendSignalOnOutput('changed-' + args.name);

      _this.sendSignalOnOutput('changed');
    };
  },
  getInspectInfo(this: ModelNodeInstance): InspectInfo {
    const model = this._internal.model;
    if (!model) return '[No Object]';

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
      description:
        'Id of the object this node is bound to, whether that came from the Id input or from a repeater item. This names the object; the Object output carries the object itself, which is what a node that watches or reads it wants',
      getter: function (this: ModelNodeInstance) {
        return this._internal.model ? this._internal.model.getId() : this._internal.modelId;
      }
    },
    /**
     * ERG-004 §7.4 / FH-004 — the object itself, not its name.
     *
     * ✅ Decided by Richard, 2026-08-02. Before this port the whole Data category could only
     * identify an object by **string id**, and `Object Changed` — whose input wants a live
     * `Model` — had no producer anywhere in the node library. The obvious wiring
     * (`Object.Id → Object Changed.Object`) is *permitted* by the `string → object` typecast and
     * then fails silently-ish: `node.ts` `eval`s the id as a JS literal, the `ReferenceError`
     * is caught, `{}` is substituted, and the watcher watches nothing for the life of the app.
     * With this port that wire is a genuine `object → object` connection with no cast at all.
     *
     * ⚠️ **A getter, not a setter side effect.** The most-repeated trap in this repo is that a
     * declared `default` never runs its setter, so anything produced only as a side effect of
     * an input arriving is absent on a graph that never touches that input. The value is pulled
     * from `_internal.model`, and the single place that model changes — `setModel` — flags this
     * port alongside `id`, so the two can never disagree about which object is bound.
     *
     * ⚠️ **`null`, never `undefined`, when nothing is bound.** `Node.prototype.sendValue`
     * returns early on `undefined` (`node.ts:687-689`), so an unbound Object emitting
     * `undefined` would send *nothing* — and a downstream `Object Changed` would go on watching
     * the object it was given before, forever, with no way to be told the binding was cleared.
     * `null` is the Empty-Value Contract's explicit clear and is what "there is no object here"
     * actually means; `undefined` means "no opinion", which this node always has.
     */
    object: {
      type: 'object',
      displayName: 'Object',
      group: 'General',
      description:
        'The bound object itself, for Object Changed or anything else that reads or watches the object rather than naming it; empty while nothing is bound',
      getter: function (this: ModelNodeInstance) {
        return this._internal.model || null;
      }
    },
    changed: {
      type: 'signal',
      displayName: 'Changed',
      group: 'Events',
      description: 'Fires whenever any property of the bound object changes, from this node or from anywhere else'
    },
    fetched: {
      type: 'signal',
      displayName: 'Fetched',
      group: 'Events',
      description: 'Fires once a new object has been bound and its property outputs are up to date'
    },
    // ── the outcome contract ────────────────────────────────────────────────
    //
    // ERG-001 §4. `Done` is **added**, not renamed from `Fetched`, and that is measured rather
    // than argued: `setModelID` fires `Fetched` straight from the `Id` **input setter**, where
    // there is no invocation to have an outcome. Folding it in would report `Done` for a value
    // binding — the same shape `Record` carries.
    //
    // ⚠️ **`Failure` is new**, and it closes a dead end rather than merely adopting a contract.
    // `setModelID` returns early for a blank `Id` and rightly sends no `Fetched` — but that left
    // `Fetch` with a blank `Id` emitting *nothing at all*, which is the contract's own opening
    // sentence about itself. See `scheduleSetModel`.
    // ⚠️ **No `Unchanged`.** `Fetch` rebinds unconditionally.
    ...outcomeOutputs({
      done: 'Fires when a Fetch finished and the property outputs are up to date',
      failure: 'Fires when Fetch was pressed with no Id to bind to, with the reason on the error channel'
    })
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
      displayName: 'Get Id from',
      group: 'General',
      description: 'Where the object comes from: the Id input, or the item of the Repeater this node sits inside',
      set: function (this: ModelNodeInstance, value: unknown) {
        this._internal.idSource = value;
        if (value === 'foreach') this.bindToRepeaterItem();
      }
    },
    /**
     * BINDING-CONTRACT §(a) — which Repeater's item, when nesting makes "the nearest one"
     * ambiguous. Optional: unset keeps the historical nearest-wins resolution exactly.
     *
     * A component name rather than a hop count, for the same reason as everywhere else in the
     * contract — "two levels up" breaks the moment somebody wraps a component in a Group.
     */
    repeaterComponent: {
      type: 'component',
      displayName: 'Repeater Component',
      group: 'General',
      description:
        'Which Repeater to take the item from when several are nested; leave blank to use the nearest one, and ignored unless Get Id from is From repeater',
      set: function (this: ModelNodeInstance, value: string) {
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
      description:
        'Id of the object to bind to, which is created the first time it is named; an Object or a plain JS object may be wired here instead, and null or blank binds nothing',
      set: function (this: ModelNodeInstance, value: unknown) {
        if (value instanceof Model) value = (value as ModelLike).getId();
        // Can be passed as model as well
        //
        // NDA-012 (Data): `value !== null` is load-bearing. `typeof null === 'object'`, so a
        // cleared Id used to reach `Model.create(null)`, whose `data ? data : {}` then read
        // `Model.get(undefined)` — a brand-new anonymous record, minted afresh on *every*
        // `null`. The node then reported `Fetched` and bound an object nothing can name.
        // `null` is the Empty-Value Contract's "clear it", and `setModelID` now honours that.
        else if (typeof value === 'object' && value !== null)
          value = Model.create(value as Record<string, unknown>).getId(); // If this is an js object, dereference it

        // DEF-046: read before write. ⚠️ AFTER the object→id dereference above, so an
        // identical record handed over twice compares as the same id rather than as two
        // freshly-minted objects.
        const previous = this._internal.modelId;
        this._internal.modelId = value as string; // Wait to fetch data
        // NDA-017 §2. Was `if (this.isInputConnected('fetch') === false)`.
        if (this.shouldRunOnValueChanged('modelId', previous, value)) this.setModelID(value as string);
        else {
          this.flagOutputDirty('id');
        }
      }
    },
    properties: {
      type: { name: 'stringlist', allowEditOnly: true },
      displayName: 'Properties',
      group: 'Properties',
      description: 'Names the properties to read and write; each name listed here gets an input, an output and a Changed signal',
      set: function () {}
    },
    fetch: {
      displayName: 'Fetch',
      group: 'Actions',
      // NDA-017 §2. The old sentence had to invent a name ("pull mode") for a state the
      // author never chose and could not see. There is no mode any more: the two things it
      // used to switch off are two checkboxes, and this port only ever adds a trigger.
      description:
        'Re-reads the object named by Id now. This is additional to Id rebinding on change and to changes being announced; untick either under Run On Value Change to stop it',
      valueChangedToTrue: function (this: ModelNodeInstance) {
        this.scheduleSetModel();
      }
    }
  },
  prototypeExtensions: {
    /**
     * Bind to the current Repeater/Run Tasks item — BINDING-CONTRACT, via `foreachitem.ts`.
     *
     * The deferral is the one this node always had: the walk needs the component tree in
     * place, and `scheduleAfterInputsHaveUpdated` is where it was. What is new is that a walk
     * finding nothing now reports instead of setting `undefined` and falling silent.
     */
    bindToRepeaterItem: function (this: ModelNodeInstance) {
      this.scheduleAfterInputsHaveUpdated(() => {
        this.setModel(resolveForEachItem(this, { target: this._internal.repeaterComponent }));
      });
    },
    scheduleStore: function (this: ModelNodeInstance) {
      if (this.hasScheduledStore) return;
      this.hasScheduledStore = true;

      const internal = this._internal;
      this.scheduleAfterInputsHaveUpdated(() => {
        this.hasScheduledStore = false;

        // NDA-004 §2 examined this `return` and left it silent, deliberately — it looks like
        // the "Do that did nothing" defect fixed in `modelcrudbase.scheduleStore` and is not.
        //
        // This node has no `Do`. `scheduleStore` is reached from `userInputSetter`, i.e. from
        // *any* value arriving at a `prop-…` input, so an Object node whose Id has not shown
        // up yet reaches here once per incoming value as the app boots. Nobody asked it to
        // act; the values are being accumulated, `dirtyValues` deliberately keeps them, and
        // they are written the moment an object arrives. Firing `Failure` here would report a
        // failure on the ordinary path and train authors to ignore the port — which the
        // Failure Contract names as worse than no port at all.
        if (!internal.model) return;

        for (const i in internal.dirtyValues) {
          internal.model.set(i, internal.inputValues[i], { resolve: true });
        }
        internal.dirtyValues = {}; // Reset dirty values
      });
    },
    /**
     * The `Fetch` port's method, and the only place this node opens an invocation.
     *
     * ⚠️ ERG-001 §4: minted **before** the guard, which coalesces the *work* — two presses in
     * one pass do one rebind — because dropping the second press's outcome with it would be
     * Rule 1 broken by an optimisation. The array is created lazily here rather than in
     * `initialize`, for suites that build this node without calling it.
     *
     * ⚠️ **The empty-Id branch is where this node's dead end was.** `setModelID` returns early
     * for `undefined` / `null` / `''` and correctly sends no `Fetched` — nothing was fetched.
     * With no failure path either, `Fetch` on a blank `Id` emitted *nothing*, so a chain hanging
     * off this node stopped with no diagnosis anywhere. The check is repeated here rather than
     * moved into `setModelID`, deliberately: a blank `Id` **arriving on the setter** is not a
     * failure of anything — nobody asked for anything — while pressing `Fetch` with nothing to
     * fetch is a request the node cannot honour. Two corpus rows hold that line apart.
     */
    scheduleSetModel: function (this: ModelNodeInstance) {
      const pending = this._internal.pendingFetch || (this._internal.pendingFetch = []);
      pending.push(this.beginOutcome());

      if (this.hasScheduledSetModel) return;
      this.hasScheduledSetModel = true;

      this.scheduleAfterInputsHaveUpdated(() => {
        this.hasScheduledSetModel = false;
        const tokens = this._internal.pendingFetch || [];
        this._internal.pendingFetch = [];

        const id = this._internal.modelId;
        if (id === undefined || id === null || id === '') {
          reportOutcomes(this, tokens, 'failure', {
            code: OBJECT_FETCH_ERROR_CODE,
            message: 'Fetch was triggered with no Id, so there is no object to bind to'
          });
          return;
        }

        // `setModelID` flags the values dirty and announces `Fetched`; the outcome goes last.
        this.setModelID(id);
        reportOutcomes(this, tokens, 'done');
      });
    },
    /**
     * NDA-012 (Data) — an empty Id is *no object*, not a new one.
     *
     * `Model.get` is create-on-read (`model.ts:213-236`), and the id it is handed here comes
     * straight off a wire. Two empty values reach it on ordinary graphs and neither used to
     * be filtered:
     *
     * - `''` — a Text Input the user has cleared. `Model.get('')` is a **named** record keyed
     *   on the empty string, so every Object node in the app whose Id is momentarily blank
     *   rendezvouses on one shared record, and it can never be read back by any real id.
     * - `null` — the Empty-Value Contract's explicit clear. Measured before this guard: the
     *   node minted a fresh anonymous record per `null` and announced `Fetched` for it.
     *
     * `undefined` cannot arrive over a connection (`node.ts:635` drops it in `sendValue`), but
     * it is guarded too, because a parameter or a direct `setInputValue` still can.
     *
     * `Fetched` is not sent on this path: nothing was fetched, and a completion signal for
     * work that went nowhere is what the Failure Contract exists to forbid.
     */
    setModelID: function (this: ModelNodeInstance, id: string) {
      if (id === undefined || id === null || id === '') {
        this.setModel(undefined);
        return;
      }

      const model = (this.nodeScope.modelScope || Model).get(id);
      this.setModel(model);
      this.sendSignalOnOutput('fetched');
    },
    setModel: function (this: ModelNodeInstance, model: ModelLike | undefined) {
      if (this._internal.model)
        // Remove old listener if existing
        this._internal.model.off('change', this._internal.onModelChangedCallback);

      this._internal.model = model;
      this.flagOutputDirty('id');
      // FH-004. The one place the bound object changes, so the one place `object` is sent —
      // and it is sent here, *before* `setModelID` announces `Fetched`, because a signal
      // arriving ahead of the value it describes is phase 30's most-repeated defect (NV-ii).
      this.flagOutputDirty('object');

      // In set idSource, we are calling setModel with undefined
      if (model) {
        model.on('change', this._internal.onModelChangedCallback);

        // We have a new model, mark all outputs as dirty
        for (const key in model.data) {
          if (this.hasOutput('prop-' + key)) this.flagOutputDirty('prop-' + key);
        }

        /**
         * NDA-012 (Data) — flush what arrived before the object did.
         *
         * `scheduleStore` returns without writing when no object is bound, and keeps the
         * values in `dirtyValues` so they can be written later. Nothing ever wrote them.
         * `setModel` was the only place that could, and it did not, so a `prop-…` value that
         * arrived in an *earlier frame* than the Id was silently dropped — measured: an
         * Object node fed `name` on one frame and its Id on the next ended up with `{}`.
         *
         * The comment in `scheduleStore` (and NDA-004 §2's corpus docstring, which cites it)
         * has claimed since NDA-004 that these "are written the moment an object arrives".
         * This is the line that makes that true.
         *
         * Same-frame arrival always worked — `scheduleAfterInputsHaveUpdated` runs after
         * every input in the pass — which is why the gap survived a careful read of this file.
         */
        if (Object.keys(this._internal.dirtyValues).length > 0) this.scheduleStore();
      }
    },
    _onNodeDeleted: function (this: ModelNodeInstance) {
      Node.prototype._onNodeDeleted.call(this);
      if (this._internal.model) this._internal.model.off('change', this._internal.onModelChangedCallback);
      // Not optional — the resolved-target reporter holds instances strongly, and a Repeater
      // churning its template creates and destroys these constantly.
      forgetForEachItem(this);
    },
    registerOutputIfNeeded: function (this: ModelNodeInstance, name: string) {
      if (this.hasOutput(name)) {
        return;
      }

      if (name.startsWith('prop-'))
        this.registerOutput(name, {
          getter: userOutputGetter.bind(this, name.substring('prop-'.length))
        });
    },
    registerInputIfNeeded: function (this: ModelNodeInstance, name: string) {
      if (this.hasInput(name)) {
        return;
      }

      if (name.startsWith('prop-'))
        this.registerInput(name, {
          set: userInputSetter.bind(this, name.substring('prop-'.length))
        });
    }
  }
};

function userOutputGetter(this: ModelNodeInstance, name: string) {
  /* jshint validthis:true */
  return this._internal.model ? this._internal.model.get(name, { resolve: true }) : undefined;
}

function userInputSetter(this: ModelNodeInstance, name: string, value: unknown) {
  /* jshint validthis:true */
  this._internal.inputValues[name] = value;

  // Store on change if no connection to store or new
  const model = this._internal.model;
  const valueChanged = model ? model.get(name) !== value : true;
  if (valueChanged) {
    this._internal.dirtyValues[name] = true;
    this.scheduleStore();
  }
}

function updatePorts(nodeId: string, parameters: Record<string, unknown>, editorConnection: EditorConnectionLike) {
  const ports: RuntimeDiscoveredPort[] = [];

  // Add value outputs
  let properties = parameters.properties as string | string[] | undefined;
  if (properties) {
    properties = properties ? (properties as string).split(',') : undefined;
    for (const i in properties) {
      const p = properties[i];

      ports.push({
        type: {
          name: '*',
          allowConnectionsOnly: true
        },
        plug: 'input/output',
        group: 'Properties',
        name: 'prop-' + p,
        displayName: p,
        description:
          'Reads and writes the ' +
          p +
          ' property of the bound object; a value arriving before an object is bound is held and written once one is'
      });

      ports.push({
        type: 'signal',
        plug: 'output',
        group: 'Events',
        displayName: p + ' Changed',
        name: 'changed-' + p,
        description: 'Fires when the ' + p + ' property changes, from this node or from anywhere else'
      });
    }
  }

  editorConnection.sendDynamicPorts(nodeId, ports, {
    detectRenamed: {
      plug: 'input/output'
    }
  });
}

const ModelNodeModule: NodeModule = {
  node: ModelNodeDefinition,
  setup: function (context: NodeContextLike, graphModel: GraphModelLike) {
    if (!context.editorConnection || !context.editorConnection.isRunningLocally()) {
      return;
    }

    graphModel.on('nodeAdded.Model2', function (node: GraphNodeModel) {
      updatePorts(node.id, node.parameters, context.editorConnection);

      node.on('parameterUpdated', function () {
        updatePorts(node.id, node.parameters, context.editorConnection);
      });
    });
  }
};

export = ModelNodeModule;
