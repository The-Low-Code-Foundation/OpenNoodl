'use strict';

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
  NodeModule,
  OutcomeToken,
  RuntimeDiscoveredPort
} from '@noodl/types';

/**
 * NDA-004 §2 / FINDINGS B-iv — the code this node raises when it cannot fetch the logged-in user.
 *
 * The graph half was always right: `failure` and `error` are real ports. The *diagnosis*
 * went to `editorConnection.sendWarning` and therefore existed only on the canvas.
 *
 * Per node rather than one code for the family (`record/storage-op-failed`'s choice),
 * because there the family shares a single `setError` funnel and the message is what
 * distinguishes the cases; here every node has its own funnel and the *operation* is the
 * distinguishing fact, so the code should carry it.
 *
 * It is also the editor's warning key — the bus's editor subscriber keys by `code` — so
 * `clearWarnings` names this same constant. Raise and clear move together, always.
 */
const USER_FETCH_ERROR_CODE = 'user/fetch-failed';

const NoodlRuntime = require('../../../../noodl-runtime');
const { Node } = require('../../../../noodl-runtime');

import { outcomeOutputs, reportOutcomes } from '../../../outcome';
import { sendSchemaPorts, staticPortNames } from '../data/schema-ports';
import {
  USER_OUTPUT_IGNORE_PARSE,
  USER_OUTPUT_IGNORE_REST,
  userBackendPickerPorts,
  userPropertyPorts,
  userSchemaContext
} from './user-ports';
import { isParseWireContext } from '../data/record-ports';

/**
 * `this` inside the User node.
 *
 * The port set is `runtime-discovered` on the *output* side: every readable column of the
 * `_User` class becomes a `prop-<key>` output plus a `changed-<key>` signal, and three
 * session signals (`loggedIn`/`loggedOut`/`sessionLost`) exist only in the browser. Those
 * three are declared nowhere in `outputs` — the commented-out block there is the original
 * static declaration, superseded by `registerOutputIfNeeded` and `updatePorts`.
 */
interface UserNodeInstance extends NodeInstance {
  _internal: {
    model?: ModelLike;
    error?: string;
    /** The `Backend` picker's value. Absent and `_active_` both mean "the default". */
    backendId?: string;
    onModelChangedCallback(args: ModelChangeEvent): void;
    /**
     * ERG-001. Invocations of `Fetch` that have not reported yet — an array because
     * `scheduleOnce` coalesces two pulses in an update pass into one read, and two invocations
     * must still produce two outcomes.
     */
    pendingFetch?: OutcomeToken[];
    /** `hasScheduled<Type>` flags, written by {@link scheduleOnce}. */
    [flag: string]: unknown;
  };
  scheduleOnce(type: string, cb: () => void): void;
  currentUserModel(): ModelLike | undefined;
  setError(err: string, tokens?: OutcomeToken[]): void;
  clearWarnings(): void;
  setUserModel(model: ModelLike | undefined): void;
  scheduleFetch(): void;
  getUserProperty(name: string): unknown;
}

const UserNodeDefinition: NodeDefinitionOptions = {
  name: 'net.noodl.user.User',
  docs: 'https://docs.noodl.net/nodes/data/user/user-node',
  displayNodeName: 'User',
  category: 'Cloud Services',
  color: 'data',
  ssr: {
    compat: 'partial',
    note: 'Sessions live in browser storage; a server render always sees a logged-out user.'
  },
  // NDA-017 §2. `Fetch` is this family's control signal, and what it silenced here is not a
  // value setter — the User node has no value input to suppress. It silenced the node's
  // *subscription to the user record*, so an author who wired `Fetch` to control when the
  // user was loaded also, invisibly, stopped every property port updating when the user
  // changed underneath them.
  runOnValueChange: {
    controlSignal: 'fetch',
    sources: [{ name: 'user', displayName: 'User properties' }]
  },
  initialize: function (this: UserNodeInstance) {
    const _this = this;
    this._internal.onModelChangedCallback = function (args: ModelChangeEvent) {
      // Was `if (_this.isInputConnected('fetch')) return;`.
      if (!_this.shouldRunOnValueChange('user')) return;

      if (_this.hasOutput('prop-' + args.name)) _this.flagOutputDirty('prop-' + args.name);

      if (_this.hasOutput('changed-' + args.name)) _this.sendSignalOnOutput('changed-' + args.name);

      _this.sendSignalOnOutput('changed');
    };

    const userService = NoodlRuntime.Services.UserService.forScope(this.nodeScope.modelScope);

    this.setUserModel(this.currentUserModel());
    userService.on('loggedIn', () => {
      this.setUserModel(this.currentUserModel());

      if (this.hasOutput('loggedIn')) this.sendSignalOnOutput('loggedIn');
    });

    userService.on('sessionGained', () => {
      this.setUserModel(this.currentUserModel());
    });

    // ⚠️ `currentUserModel()` rather than `undefined`, and this is the one place
    // the picker changes an existing behaviour rather than adding to it. A
    // logout on the project's default backend used to mean "nobody is signed in"
    // full stop; with a picker it means "nobody is signed in **there**", and a
    // `User` node pointed at a second backend must keep reporting its own
    // account. Re-reading is identical for every node with no picker set, which
    // is every node in every project that exists today: the session has already
    // been cleared by the time this fires, so the re-read answers `undefined`.
    //
    // ⚠️ **The signals are still global**, deliberately. `Logged Out` fires on
    // every `User` node whichever backend signed out, and narrowing that would
    // change when an existing project's graph runs. Recorded as a residual in
    // BCN-006-NOTES-STEP5-6 rather than fixed quietly here.
    userService.on('loggedOut', () => {
      this.setUserModel(this.currentUserModel());
      if (this.hasOutput('loggedOut')) this.sendSignalOnOutput('loggedOut');
    });

    userService.on('sessionLost', () => {
      this.setUserModel(this.currentUserModel());
      if (this.hasOutput('sessionLost')) this.sendSignalOnOutput('sessionLost');
    });
  },
  getInspectInfo(this: UserNodeInstance): InspectInfo {
    const model = this._internal.model;
    if (!model) return '[No Model]';

    return [
      { type: 'text', value: 'Id: ' + model.getId() },
      { type: 'value', value: this._internal.model.data }
    ];
  },
  outputs: {
    id: {
      type: 'string',
      displayName: 'Id',
      group: 'General',
      description: 'Id of the signed-in user record; empty while nobody is signed in',
      getter: function (this: UserNodeInstance) {
        return this._internal.model !== undefined ? this._internal.model.getId() : undefined;
      }
    },
    fetched: {
      type: 'signal',
      displayName: 'Fetched',
      group: 'Events',
      description: 'Fires once the user record has been re-read and the outputs below are up to date'
    },
    changed: {
      type: 'signal',
      displayName: 'Changed',
      group: 'Events',
      description: 'Fires when a property of the signed-in user changes, including a change another node made'
    },
    // ── the outcome contract ────────────────────────────────────────────────
    //
    // ERG-001 §4. `Done` is **added**, not renamed from `Fetched`, so that this node and its
    // documented twin `Record` publish one port set. On `Record` the two genuinely come apart —
    // `Fetched` fires from the `Id` **setter**, where there is no invocation — and splitting the
    // family so that one says `Fetched` and the other `Done` for the same author gesture is the
    // per-node divergence `outcome.ts`'s docstring exists to prevent.
    //
    // ⚠️ **On this node they co-fire**, because `User` has no bind path, and that is recorded
    // rather than designed away: it is a property of there being one path here, not of the two
    // ports meaning the same thing. A corpus row asserts the co-firing and its order.
    //
    // ⚠️ **No `Unchanged`.** `Fetch` always re-reads the backend — it is "how an expired session
    // is discovered" — so it cannot no-op.
    ...outcomeOutputs({
      done: 'Fires when a Fetch finished and the outputs below are up to date',
      failure:
        'Fires when the user record could not be read, after the reason has been reported on the error channel'
    }),
    error: {
      type: 'string',
      displayName: 'Error',
      group: 'Error',
      description: 'Why the last read failed; empty until one does',
      getter: function (this: UserNodeInstance) {
        return this._internal.error;
      }
    },
    username: {
      type: 'string',
      displayName: 'Username',
      group: 'General',
      description: 'Username of the signed-in user; empty while nobody is signed in',
      getter: function (this: UserNodeInstance) {
        return this._internal.model !== undefined ? this._internal.model.get('username') : undefined;
      }
    },
    email: {
      type: 'string',
      displayName: 'Email',
      group: 'General',
      description: 'Email address of the signed-in user; empty while nobody is signed in',
      getter: function (this: UserNodeInstance) {
        return this._internal.model !== undefined ? this._internal.model.get('email') : undefined;
      }
    },
    authenticated: {
      type: 'boolean',
      displayName: 'Authenticated',
      group: 'General',
      description: 'True while somebody is signed in on this device; a server render always sees false',
      getter: function (this: UserNodeInstance) {
        return this._internal.model !== undefined;
      }
    }
    /*    loggedIn:{
            type:'signal',
            displayName:'Logged In',
            group:'Events'
        },
        loggedOut:{
            type:'signal',
            displayName:'Logged Out',
            group:'Events'
        },
        sessionLost:{
            type:'signal',
            displayName:'Session Lost',
            group:'Events'
        },         */
  },
  inputs: {
    fetch: {
      displayName: 'Fetch',
      group: 'Actions',
      description: 'Re-reads the signed-in user from the backend, which is also how an expired session is discovered',
      valueChangedToTrue: function (this: UserNodeInstance) {
        this.scheduleFetch();
      }
    }
  },
  methods: {
    _onNodeDeleted: function (this: UserNodeInstance) {
      Node.prototype._onNodeDeleted.call(this);
      if (this._internal.model) this._internal.model.off('change', this._internal.onModelChangedCallback);
    },
    scheduleOnce: function (this: UserNodeInstance, type: string, cb: () => void) {
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
     * ERG-001: the `failure` pulse and the raise both go through `reportOutcome`, so the outcome
     * and its reason cannot drift apart and `Completed` follows automatically. `tokens` is
     * optional because NDA-004's rows call this funnel directly — minting one here keeps that a
     * real, complete failure rather than a branch where a reason reaches the channel with no
     * outcome behind it.
     */
    setError: function (this: UserNodeInstance, err: string, tokens?: OutcomeToken[]) {
      this._internal.error = err;
      this.flagOutputDirty('error');

      reportOutcomes(this, tokens || [this.beginOutcome()], 'failure', {
        code: USER_FETCH_ERROR_CODE,
        message: err
      });
    },
    clearWarnings(this: UserNodeInstance) {
      if (this.context.editorConnection) {
        const component = this.nodeScope.componentOwner.name;
        this.context.editorConnection.clearWarning(component, this.id, USER_FETCH_ERROR_CODE);
        this.context.editorConnection.clearWarning(component, this.id, 'user-warning');
      }
    },
    setUserModel(this: UserNodeInstance, model: ModelLike | undefined) {
      const internal = this._internal;

      if (internal.model !== model) {
        // Check if we need to change model
        if (internal.model)
          // Remove old listener if existing
          internal.model.off('change', internal.onModelChangedCallback);

        internal.model = model;
        if (model) model.on('change', internal.onModelChangedCallback);
      }
      this.flagOutputDirty('id');
      this.flagOutputDirty('authenticated');
      this.flagOutputDirty('email');
      this.flagOutputDirty('username');

      // Notify all properties changed
      if (model)
        for (const key in model.data) {
          if (this.hasOutput('prop-' + key)) this.flagOutputDirty('prop-' + key);
        }
    },
    /**
     * The signed-in user of **this node's** backend — BCN-009 step 4.
     *
     * With no `Backend` input set this is `userService.current` by another route:
     * `currentFor(undefined)` resolves the default backend, which is what
     * `current` holds. The indirection is what lets a second `User` node on the
     * same page report a different account.
     */
    currentUserModel: function (this: UserNodeInstance): ModelLike | undefined {
      const userService = NoodlRuntime.Services.UserService.forScope(this.nodeScope.modelScope);
      // `currentFor` is the viewer's. The cloud runtime has its own `UserService`
      // with one request-scoped user and no picker, so fall back to `current`
      // rather than requiring both to grow the same method.
      if (typeof userService.currentFor === 'function') return userService.currentFor(this._internal.backendId);
      return userService.current;
    },
    scheduleFetch: function (this: UserNodeInstance) {
      // ERG-001. Minted here, in the only method the `Fetch` port reaches. The four session
      // events this node subscribes to in `initialize` all run `setUserModel` with no invocation
      // behind them, and none of them reports.
      const pending = this._internal.pendingFetch || (this._internal.pendingFetch = []);
      pending.push(this.beginOutcome());

      this.scheduleOnce('Fetch', () => {
        // Taken into a local before the request goes out, so a second `Fetch` arriving in
        // flight owns its own batch rather than being settled by this one's answer.
        const tokens = this._internal.pendingFetch || [];
        this._internal.pendingFetch = [];

        const userService = NoodlRuntime.Services.UserService.forScope(this.nodeScope.modelScope);
        userService.fetchCurrentUser({
          backendId: this._internal.backendId,
          // The response is deliberately unused — the stored session is the source
          // of truth and the callback only signals that it has settled.
          success: () => {
            this.setUserModel(this.currentUserModel());

            // The value-level announcement first, then the invocation's outcome last.
            this.sendSignalOnOutput('fetched');
            reportOutcomes(this, tokens, 'done');
          },
          error: (err: string) => {
            this.setError(err || 'Failed to fetch.', tokens);
          }
        });
      });
    },
    /**
     * The `Backend` picker's setter — BCN-009 step 4.
     *
     * A dynamic port with no `registerInput` branch silently drops its value, so
     * this is what makes the dropdown do anything at all. Re-reading the model on
     * change matters as much: the picker is an *edit-only* enum, but a saved
     * project applies it at load, and without this the node would show the
     * default backend's user until the first session event.
     */
    registerInputIfNeeded: function (this: UserNodeInstance, name: string) {
      if (this.hasInput(name)) return;

      if (name === 'backendId')
        this.registerInput(name, {
          set: (value: unknown) => {
            this._internal.backendId = value as string;
            this.setUserModel(this.currentUserModel());
          }
        });
    },
    registerOutputIfNeeded: function (this: UserNodeInstance, name: string) {
      if (this.hasOutput(name)) {
        return;
      }

      if (name === 'loggedOut' || name === 'loggedIn' || name === 'sessionLost') {
        this.registerOutput(name, {
          getter: () => {} /* No getter needed, signal */
        });
        return;
      }

      if (name.startsWith('prop-'))
        this.registerOutput(name, {
          getter: this.getUserProperty.bind(this, name.substring('prop-'.length))
        });
    },
    getUserProperty: function (this: UserNodeInstance, name: string) {
      return this._internal.model !== undefined ? this._internal.model.get(name) : undefined;
    }
  }
};

/**
 * The node's ports, from whichever backend the `Backend` input names —
 * BCN-006 step 6.
 *
 * What this replaced looked up `_User` in `systemCollections` by name and read
 * Parse's own type words out of it. That is correct on the two backends that
 * speak the Parse wire and produces **no properties at all** on the other three,
 * with nothing anywhere saying why. `user-ports.ts` holds the three rules that
 * make the same ports come out for a Parse-wire backend and real ones come out
 * for the rest.
 */
function updatePorts(
  nodeId: string,
  parameters: Record<string, unknown>,
  editorConnection: EditorConnectionLike,
  graphModel: GraphModelLike
) {
  const ctx = userSchemaContext(graphModel, parameters);

  const ports: RuntimeDiscoveredPort[] = ([] as RuntimeDiscoveredPort[])
    .concat(userBackendPickerPorts(ctx))
    .concat(
      userPropertyPorts(ctx, {
        plug: 'output',
        includeChangedSignals: true,
        ignore: isParseWireContext(ctx) ? USER_OUTPUT_IGNORE_PARSE : USER_OUTPUT_IGNORE_REST
      })
    );

  if (typeof _noodl_cloud_runtime_version === 'undefined') {
    // On the client we have some extra outputs
    ports.push({
      plug: 'output',
      name: 'loggedIn',
      type: 'signal',
      displayName: 'Logged In',
      group: 'Events'
    });

    ports.push({
      plug: 'output',
      name: 'loggedOut',
      type: 'signal',
      displayName: 'Logged Out',
      group: 'Events'
    });

    ports.push({
      plug: 'output',
      name: 'sessionLost',
      type: 'signal',
      displayName: 'Session Lost',
      group: 'Events'
    });
  }

  // `sendSchemaPorts` rather than `sendDynamicPorts`, so the static/dynamic
  // collision guard cannot be skipped — see `schema-ports.ts`.
  sendSchemaPorts(editorConnection, nodeId, ports, {
    staticPorts: staticPortNames(UserNodeDefinition as { inputs?: Record<string, unknown>; outputs?: Record<string, unknown> })
  });
}

const UserNodeModule: NodeModule = {
  node: UserNodeDefinition,
  setup: function (context: NodeContextLike, graphModel: GraphModelLike) {
    if (!context.editorConnection || !context.editorConnection.isRunningLocally()) {
      return;
    }

    function _managePortsForNode(node: GraphNodeModel) {
      const rebuild = () => updatePorts(node.id, node.parameters, context.editorConnection, graphModel);

      rebuild();
      node.on('parameterUpdated', rebuild);

      // ⚠️ **Three metadata keys, not one.** The port set used to depend only on
      // `systemCollections`; it now depends on which backend is selected
      // (`backendServices`), on that backend's introspected schema (also
      // `backendServices`), and on the Parse-wire cache the fallback reads. A
      // subscription to one of the three leaves the ports stale after a Backend
      // Services refresh, which looks exactly like the introspection failing.
      graphModel.on('metadataChanged.systemCollections', rebuild);
      graphModel.on('metadataChanged.dbCollections', rebuild);
      graphModel.on('metadataChanged.backendServices', rebuild);
    }

    graphModel.on('editorImportComplete', () => {
      graphModel.on('nodeAdded.net.noodl.user.User', function (node: GraphNodeModel) {
        _managePortsForNode(node);
      });

      for (const node of graphModel.getNodesWithType('net.noodl.user.User')) {
        _managePortsForNode(node);
      }
    });
  }
};

export = UserNodeModule;
