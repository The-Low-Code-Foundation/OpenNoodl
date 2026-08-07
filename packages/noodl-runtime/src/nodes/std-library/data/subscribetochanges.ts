'use strict';

/**
 * Subscribe To Changes — the standalone realtime node (FH-021, decided in TALK-005).
 *
 * A five-transport realtime layer has shipped since BCN-008 behind exactly **one** door:
 * a checkbox on Query Records. That is a capability nobody can find, which is what the
 * report this task came from demonstrated. This node is the door: drop it, pick a class,
 * and the built-in backend is already selected.
 *
 * ## Why this is not a second Query Records, and not the WebSocket node
 *
 * It fires signals and publishes the changed row. It does **not** hold a collection, run
 * a query, or re-query on a change — Query Records' checkbox stays as the
 * query-refreshing form and the two are not alternatives (TALK-005 Q1).
 *
 * `net.noodl.WebSocket` stays a raw third-party transport. Our backend has no WebSocket
 * server at all — realtime is the SSE `/realtime` endpoint (BAK-001) — so a
 * "connect to my backend" mode on it was never merely the wrong abstraction, it was
 * unbuildable for the one backend it was asked for (TALK-005 correction 4).
 *
 * ## The argument in the code against this node, and why it does not hold any more
 *
 * `dbcollectionnode2.ts` says the subscription lives on the query "because a subscription
 * without a query is a stream of ids nobody can render". That was true of the retired
 * Directus-only node and the BCN-008 fold is what retired it: `changedRecord` /
 * `changedRecords` carry the whole row on every transport that sends one, which is all of
 * them except a Directus **delete** (key only, measured). So the residue of the argument
 * is one event on one backend, and `Changed Record Id` — which every backend fills — is
 * the output for it. Both facts are on the ports rather than in a comment.
 *
 * ## Three rules this file exists to hold
 *
 * **1. Active by default, and never gated.** `recordBackendPickerPorts` defaults to
 * `_active_` and hides itself in a one-backend project, so the built-in backend is the
 * zero-configuration path. The Realtime ports are declared whatever the backend is —
 * `realtimeSupportFor` answers at runtime and the reason lands on `Realtime Error`. A
 * capability that vanishes from the panel when the picker moves is worse than one that
 * says why it cannot connect (the reasoning `dbcollectionnode2.ts` records at its own
 * push site, and `nodeCapabilities.ts` records against `DbCollection2.realtime`).
 *
 * **2. `Enabled` is read as `!== false`, not off a `default`.** A port declared with a
 * `default` never runs its setter, so `_internal.enabled` is `undefined` on a node nobody
 * has touched — and this is a node that is supposed to work untouched. {@link isEnabled}
 * is the only reader.
 *
 * **3. The filter is nodegx-only, disclosed, and never applied client-side.** See
 * {@link subscriptionFilter}.
 *
 * `ssr: { compat: 'client-only' }` is the whole SSR story here — the seam Query Records
 * could not use, because it has to run during a server render and so had to gate the
 * *capability* instead. There is deliberately no second `platform.isSSRServer()` check in
 * this file: one rule, one mechanism.
 *
 * @module noodl-runtime
 */

import type {
  EditorConnectionLike,
  GraphModelLike,
  GraphNodeModel,
  NodeContextLike,
  NodeDefinitionOptions,
  NodeInstance,
  NodeModule,
  RuntimeDiscoveredPort
} from '@noodl/types';

import type { RealtimeChange, RealtimeError, RealtimeFilter, RealtimeStatus } from '@noodl/backend-contract';

import Node = require('../../../node');
import QueryUtils = require('../../../api/queryutils');
import type { VisualFilterQuery } from '../../../api/queryutils';

import { resolveBackendFromRuntime } from '../../../api/backends/resolveBackend';
import {
  createRealtimeSubscription,
  realtimeSupportFor,
  type RealtimeSubscription
} from '../../../api/backends/realtime';

import {
  recordBackendPickerPorts,
  recordClassPorts,
  recordFilterBackendType,
  recordFilterSchema,
  recordSchemaContext,
  type SchemaCollection
} from './record-ports';
import { sendSchemaPorts, staticPortNames } from './schema-ports';

/**
 * Its own code, not Query Records'.
 *
 * `query-records/realtime-failed` names the node it is reported from, and an `On App
 * Error` graph filtering on it must not start receiving this node's failures as well.
 */
const REALTIME_ERROR_CODE = 'subscribe-to-changes/realtime-failed';

/**
 * The sentence the Filter port carries, and the same one the enrichment corpus repeats.
 *
 * Richard's decision (TALK-005) was to ship the port anyway rather than omit it: our own
 * backend does accept a filter and it is useful today. The disclosure is the whole of
 * what makes that a knowing asymmetry rather than a fourth twin of the filter semantics
 * BCN-003 spent a task collapsing.
 */
const FILTER_DISCLOSURE =
  'Evaluated by the server on the built-in NodeGX backend only. PocketBase, Directus and Parse ' +
  'take no filter on a subscription, so on those backends every change in the class is delivered ' +
  'and this filter is ignored. It is never applied on the client: events you never received are ' +
  'not events a filter excluded, and pretending otherwise would make two backends disagree about ' +
  'what one setting means.';

interface SubscribeToChangesInstance extends NodeInstance {
  _internal: {
    /** The Class dropdown. */
    name?: string;
    /** The `Backend` picker: a backend id, `'_endpoint_'`, `'_active_'`, or absent. */
    backendId?: string;
    /**
     * The `Enabled` input **as the author left it**.
     *
     * `undefined` means untouched, which is the common case and means *on* — read it
     * through {@link isEnabled} and never directly. See rule 2 in the module docblock.
     */
    enabled?: boolean;
    visualFilter?: unknown;
    queryParameters: Record<string, unknown>;

    subscription?: RealtimeSubscription | null;
    reconfigureScheduled?: boolean;
    realtimeStatus?: RealtimeStatus;
    realtimeError?: RealtimeError | null;
    realtimeEvent?: string;
    changedRecord?: Record<string, unknown> | null;
    changedRecords?: unknown[];
    changedRecordId?: string;
  };
  isEnabled(): boolean;
  setCollectionName(name: string): void;
  setEnabled(value: boolean): void;
  setVisualFilter(value: unknown): void;
  setQueryParameter(name: string, value: unknown): void;
  subscriptionFilter(): RealtimeFilter | undefined;
  scheduleReconfigure(): void;
  reconfigure(): void;
  teardown(): void;
  realtimePrimaryKey(collections: SchemaCollection[] | undefined, isParseWire: boolean): string;
  handleRealtimeChange(change: RealtimeChange): void;
  handleRealtimeStatus(status: RealtimeStatus): void;
  handleRealtimeError(error: RealtimeError): void;
}

const SubscribeToChangesNode: NodeDefinitionOptions = {
  name: 'SubscribeToChanges',
  docs: 'https://docs.noodl.net/nodes/data/cloud-data/subscribe-to-changes',
  displayNodeName: 'Subscribe To Changes',
  category: 'Cloud Services',
  color: 'data',
  usePortAsLabel: 'collectionName',
  searchTags: [
    'realtime',
    'subscribe',
    'subscription',
    'live',
    'changes',
    'push',
    'sync',
    'sse',
    // ⚠️ Deliberate. An author looking for "a websocket bound to my backend" is looking
    // for this node — that is the report this task came from — and the raw WebSocket node
    // is what they would otherwise find.
    'websocket',
    'socket',
    'backend'
  ],

  // A live subscription cannot be opened during a server render and would hold one per
  // request; two of the three transports cannot even be constructed under Node (it has
  // `WebSocket` and no `EventSource`, measured). Ports still exist, so connections stay
  // valid and the node runs in the browser after hydration.
  ssr: {
    compat: 'client-only',
    note:
      'A realtime subscription cannot be opened during a server render and would hold one connection per ' +
      'request; the node subscribes in the browser after hydration.'
  },

  inputs: {
    enabled: {
      type: 'boolean',
      displayName: 'Enabled',
      group: 'General',
      default: true,
      description:
        'Hold the subscription open. Turn it off to stop receiving changes without deleting the node — the ' +
        'connection is closed and Subscribed goes false. On by default: this node has nothing else to do',
      set: function (this: SubscribeToChangesInstance, value: boolean) {
        this.setEnabled(value);
      }
    }
  },

  // Copied from Query Records' Realtime group, names and descriptions included. Two nodes
  // disagreeing about what "Changed Record Id" means is the twin this task must not make.
  outputs: {
    subscribed: {
      type: 'boolean',
      displayName: 'Subscribed',
      group: 'Realtime',
      description: 'True while the backend has confirmed the subscription and is delivering changes',
      getter: function (this: SubscribeToChangesInstance) {
        return this._internal.realtimeStatus === 'subscribed';
      }
    },
    realtimeStatus: {
      type: 'string',
      displayName: 'Realtime Status',
      group: 'Realtime',
      description:
        'connecting, subscribed, interrupted or stopped. Four states rather than a boolean, because ' +
        '"connecting for the first time" and "dropped and retrying" want different things on screen',
      getter: function (this: SubscribeToChangesInstance) {
        return this._internal.realtimeStatus || '';
      }
    },
    realtimeError: {
      type: 'object',
      displayName: 'Realtime Error',
      group: 'Realtime',
      description: 'The last realtime failure, with a code and whether retrying can help; null until one happens',
      getter: function (this: SubscribeToChangesInstance) {
        return this._internal.realtimeError || null;
      }
    },
    realtimeFailure: {
      type: 'signal',
      displayName: 'Realtime Failure',
      group: 'Realtime',
      description: 'Fires when a subscription cannot connect, is rejected, or has been given up on'
    },
    created: {
      type: 'signal',
      displayName: 'Record Created',
      group: 'Realtime',
      description: 'Another client created a record in this collection'
    },
    updated: {
      type: 'signal',
      displayName: 'Record Updated',
      group: 'Realtime',
      description: 'Another client updated a record in this collection'
    },
    deleted: {
      type: 'signal',
      displayName: 'Record Deleted',
      group: 'Realtime',
      description: 'Another client deleted a record from this collection'
    },
    changed: {
      type: 'signal',
      displayName: 'Records Changed',
      group: 'Realtime',
      description:
        'Any of the three, and also the backend saying the view may be stale after a reconnect — the one to ' +
        'react to if you do not care which happened'
    },
    changedEvent: {
      type: 'string',
      displayName: 'Change Type',
      group: 'Realtime',
      description: 'create, update, delete, init or resync',
      getter: function (this: SubscribeToChangesInstance) {
        return this._internal.realtimeEvent || '';
      }
    },
    changedRecord: {
      type: 'object',
      displayName: 'Changed Record',
      group: 'Realtime',
      description:
        'The record the change was about. ⚠️ Null on a delete against Directus, which sends only the key — ' +
        'use Changed Record Id, which every backend fills',
      getter: function (this: SubscribeToChangesInstance) {
        return this._internal.changedRecord || null;
      }
    },
    changedRecords: {
      type: 'array',
      displayName: 'Changed Records',
      group: 'Realtime',
      description: 'Every record in the change frame; some backends batch',
      getter: function (this: SubscribeToChangesInstance) {
        return this._internal.changedRecords || [];
      }
    },
    changedRecordId: {
      type: 'string',
      displayName: 'Changed Record Id',
      group: 'Realtime',
      description:
        "The id of the changed record, always a string — even where the backend's primary key is an integer",
      getter: function (this: SubscribeToChangesInstance) {
        return this._internal.changedRecordId || '';
      }
    }
  },

  initialize: function (this: SubscribeToChangesInstance) {
    this._internal.queryParameters = {};
  },

  prototypeExtensions: {
    /**
     * Rule 2 in the module docblock, and the only reader of `_internal.enabled`.
     *
     * `default: true` on the port is what the panel shows; it is **not** what the runtime
     * was told, because a declared default never runs its setter. On a node whose whole
     * point is working with nothing configured, reading the field directly would mean it
     * never subscribes until somebody toggles a checkbox twice.
     */
    isEnabled: function (this: SubscribeToChangesInstance) {
      return this._internal.enabled !== false;
    },

    setEnabled: function (this: SubscribeToChangesInstance, value: boolean) {
      this._internal.enabled = !!value;
      this.scheduleReconfigure();
    },

    setCollectionName: function (this: SubscribeToChangesInstance, name: string) {
      this._internal.name = name;
      // A subscription is to a named class; the old one is watching the wrong thing.
      this.scheduleReconfigure();
    },

    setVisualFilter: function (this: SubscribeToChangesInstance, value: unknown) {
      this._internal.visualFilter = value;
      this.scheduleReconfigure();
    },

    setQueryParameter: function (this: SubscribeToChangesInstance, name: string, value: unknown) {
      this._internal.queryParameters[name] = value;
      // A filter value moving means a different subscription, not a different local view:
      // the server decides what is delivered, so it has to be told again.
      this.scheduleReconfigure();
    },

    /**
     * The filter to send, in the **backend's own dialect**.
     *
     * ⚠️ Two things here are easy to get wrong and both are silent when you do.
     *
     * `QueryUtils.convertVisualFilter` is the Parse-shaped half of the conversion, and
     * that is deliberately the half we want: `RealtimeFilter` is the wire's dialect, and
     * our backend evaluates a subscription filter with the same `$eq`/`$gte` grammar its
     * query routes use. The *neutral* document (`convertVisualFilterToNeutral`) is what
     * `RestDataAdapter` translates for a REST backend, and handing it to `/realtime`
     * produces a subscription that confirms and then delivers nothing, because
     * `RealtimeHub` fails closed on an operator it cannot evaluate.
     *
     * And the translation is never applied locally. Only `NODEGX_SSE` reads this;
     * `POCKETBASE_SSE` and `DirectusWebSocketTransport` ignore it, and the port says so
     * ({@link FILTER_DISCLOSURE}). Filtering client-side instead would be a fifth filter
     * dialect implemented in a node — worse than an unfiltered stream, because the two
     * would look identical from the graph.
     */
    subscriptionFilter: function (this: SubscribeToChangesInstance) {
      if (this._internal.visualFilter === undefined) return undefined;

      try {
        return QueryUtils.convertVisualFilter(this._internal.visualFilter as VisualFilterQuery, {
          queryParameters: this._internal.queryParameters,
          collectionName: this._internal.name,
          valuePortPrefix: 'qp-'
        }) as RealtimeFilter | undefined;
      } catch (e) {
        // BCN-003: the translator refuses an operator the backend cannot express rather
        // than dropping it. Reported where the author is looking, and the subscription
        // then opens unfiltered rather than not at all — which is the disclosed
        // behaviour on three of the five backends anyway.
        if (this.context.editorConnection) {
          this.context.editorConnection.sendWarning(this.nodeScope.componentOwner.name, this.id, 'subscribe-filter', {
            message: (e as Error).message
          });
        }
        return undefined;
      }
    },

    /** Coalesce: a backend, a class and a filter arriving in one update reconnect once. */
    scheduleReconfigure: function (this: SubscribeToChangesInstance) {
      if (this._internal.reconfigureScheduled) return;
      this._internal.reconfigureScheduled = true;
      this.scheduleAfterInputsHaveUpdated(() => {
        this._internal.reconfigureScheduled = false;
        this.reconfigure();
      });
    },

    reconfigure: function (this: SubscribeToChangesInstance) {
      this.teardown();

      if (!this.isEnabled()) return;
      const collection = this._internal.name;
      if (!collection) return;

      // `backendId` is `undefined` on a node nobody has touched — either because the
      // picker defaulted to `_active_` (and a default runs no setter) or because
      // `hideWhenSingleBackend` never drew it at all. `resolveBackendTarget` treats
      // both the same as `_active_`, which is what makes "drop it and go" work.
      const target = resolveBackendFromRuntime(this._internal.backendId);
      if (!target) {
        this.handleRealtimeError({
          message: `The backend this node is set to ("${this._internal.backendId || '_active_'}") is not configured in this project.`,
          code: 'CAPABILITY_UNAVAILABLE',
          kind: 'fatal'
        });
        return;
      }

      // Answered without opening anything, so Supabase and a custom backend report a
      // sentence at once rather than sitting `connecting` — the failure `conditional` was
      // invented to make impossible. Note this is the *only* place support is consulted:
      // no port was hidden on the way here.
      const support = realtimeSupportFor(target.handle.type);
      if (support.state === 'unsupported') {
        this.handleRealtimeError({
          message: support.reason || 'This backend does not support realtime.',
          code: 'CAPABILITY_UNAVAILABLE',
          kind: 'fatal'
        });
        return;
      }

      this._internal.subscription = createRealtimeSubscription(target.handle, {
        collection,
        where: this.subscriptionFilter(),
        primaryKey: this.realtimePrimaryKey(target.collections, target.isParseWire),
        onEvent: this.handleRealtimeChange.bind(this),
        onStatus: this.handleRealtimeStatus.bind(this),
        onError: this.handleRealtimeError.bind(this)
      });

      // ⚠️ `RealtimeSubscription` notifies on a status *change*, and its first status is
      // the one it was constructed with — so `connecting` is never pushed and a graph
      // reading `Realtime Status` sees an empty string until the backend answers. Read it
      // off the handle instead. (A `connect` that failed fatally on the way in — Supabase,
      // a custom backend — has already reported, and this publishes its `stopped`.)
      this.handleRealtimeStatus(this._internal.subscription.status);
    },

    teardown: function (this: SubscribeToChangesInstance) {
      if (this._internal.subscription) {
        this._internal.subscription.dispose();
        this._internal.subscription = null;
      }
      if (this._internal.realtimeStatus) {
        this._internal.realtimeStatus = undefined;
        this.flagOutputDirty('subscribed');
        this.flagOutputDirty('realtimeStatus');
      }
    },

    /**
     * Which field carries the id, for the transports that send whole records.
     *
     * The schema knows, when it has been introspected. The fallbacks are the two wires'
     * conventions and not a guess: the Parse wire's key is `objectId` and every REST
     * backend in the rig calls it `id`.
     */
    realtimePrimaryKey: function (
      this: SubscribeToChangesInstance,
      collections: SchemaCollection[] | undefined,
      isParseWire: boolean
    ) {
      const schema = (collections || []).find((c) => c.name === this._internal.name);
      return schema?.primaryKey || (isParseWire ? 'objectId' : 'id');
    },

    handleRealtimeChange: function (this: SubscribeToChangesInstance, change: RealtimeChange) {
      this._internal.realtimeEvent = change.type;
      // ⚠️ `recordsComplete` is the gate, not `records.length`. The latter cannot tell a
      // key-only delete (Directus) from an empty frame, so "Changed Record" would publish
      // `{}` on one backend and a full row on another with nothing saying why.
      this._internal.changedRecord =
        change.recordsComplete && change.records.length > 0 ? (change.records[0] as Record<string, unknown>) : null;
      this._internal.changedRecords = change.recordsComplete ? change.records : [];
      this._internal.changedRecordId = change.ids.length > 0 ? change.ids[0] : '';

      this.flagOutputDirty('changedEvent');
      this.flagOutputDirty('changedRecord');
      this.flagOutputDirty('changedRecords');
      this.flagOutputDirty('changedRecordId');

      // `init` is the subscription's confirmation snapshot, not a change: firing `created`
      // for every row already in the class would make a subscription look like a burst of
      // writes the moment it connects.
      if (change.type === 'init') return;

      // `resync` means the server thinks we may have missed something and keeps no replay
      // log. It is not a create/update/delete and must not pretend to be one — but it IS a
      // reason to go and look, which is what `changed` is for.
      const signals: Record<string, string> = { create: 'created', update: 'updated', delete: 'deleted' };
      if (signals[change.type]) this.sendSignalOnOutput(signals[change.type]);
      this.sendSignalOnOutput('changed');

      // ⚠️ No `runOnValueChange` guard, deliberately. Query Records has one because a
      // change there triggers a re-query it may not want. This node fires signals and
      // publishes values; there is nothing to suppress, and a checkbox that governs
      // nothing is a control that does nothing.
    },

    handleRealtimeStatus: function (this: SubscribeToChangesInstance, status: RealtimeStatus) {
      this._internal.realtimeStatus = status;
      if (status === 'subscribed' && this._internal.realtimeError) {
        this._internal.realtimeError = null;
        this.flagOutputDirty('realtimeError');
      }
      this.flagOutputDirty('subscribed');
      this.flagOutputDirty('realtimeStatus');
    },

    /**
     * A structured code, a signal, and the runtime error bus (NDA-004 §2).
     *
     * `console.warn` survives deployment but carries no code and is invisible to
     * `On App Error` and to every error subscriber — which is precisely the state the
     * retired Subscribe To Changes node was in.
     */
    handleRealtimeError: function (this: SubscribeToChangesInstance, error: RealtimeError) {
      this._internal.realtimeError = error;
      this.flagOutputDirty('realtimeError');
      this.sendSignalOnOutput('realtimeFailure');
      this.raiseRuntimeError(REALTIME_ERROR_CODE, error.message || 'The realtime subscription failed.', error);
    },

    _onNodeDeleted: function (this: SubscribeToChangesInstance) {
      Node.prototype._onNodeDeleted.call(this);
      this.teardown();
    },

    /**
     * Every input but `Enabled` is minted here, because every one of them is discovered:
     * the picker's entries come from the project's backends and the Class list from the
     * selected backend's schema.
     *
     * ⚠️ A saved project applies a parameter **before** the port exists, so this is the
     * only place a port's setter can be attached. Anything not named here falls through
     * to a no-op rather than a crash — `qp-` ports in particular arrive with whatever
     * names the author's filter gave them.
     */
    registerInputIfNeeded: function (this: SubscribeToChangesInstance, name: string) {
      if (this.hasInput(name)) return;

      if (name.startsWith('qp-')) {
        this.registerInput(name, {
          set: this.setQueryParameter.bind(this, name.substring('qp-'.length))
        });
        return;
      }

      const setters: Record<string, (value: never) => void> = {
        collectionName: this.setCollectionName.bind(this) as (value: never) => void,
        visualFilter: this.setVisualFilter.bind(this) as (value: never) => void,
        backendId: ((value: string) => {
          this._internal.backendId = value;
          // Or it stays connected to whichever backend happened to be selected when the
          // node first ran.
          this.scheduleReconfigure();
        }) as (value: never) => void
      };

      this.registerInput(name, {
        set:
          setters[name] ||
          function () {
            /* a port this node does not read; see the docblock */
          }
      });
    }
  }
};

function updatePorts(
  nodeId: string,
  parameters: Record<string, unknown>,
  editorConnection: EditorConnectionLike,
  graphModel: GraphModelLike
) {
  const ports: RuntimeDiscoveredPort[] = [];

  const ctx = recordSchemaContext(graphModel, parameters);
  // Hidden when the project has one backend, and `_active_` when it is not — which is
  // rule 1: choosing our own backend is the path with nothing to choose.
  ports.push(...recordBackendPickerPorts(ctx));
  ports.push(...recordClassPorts(ctx));

  if (parameters.collectionName !== undefined) {
    // `null` means there is nothing to build a filter from, and the port is then not
    // declared at all rather than declared empty.
    const schema = recordFilterSchema(ctx);
    if (schema) {
      ports.push({
        name: 'visualFilter',
        plug: 'input',
        type: {
          name: 'query-filter',
          schema: schema,
          allowEditOnly: true,
          // The builder greys out what this backend cannot express, using the same
          // descriptor cell the translator refuses on — and it is *this node's* backend,
          // not the singleton's.
          backend: recordFilterBackendType(ctx, QueryUtils.backendType()),
          valuePortPrefix: 'qp-'
        },
        displayName: 'Filter',
        group: 'Filter',
        // Rendered as the row's tooltip by `Ports.renderParams` — the seam every property
        // row passes through. This is where an author reads that three of the five
        // backends ignore it.
        description: FILTER_DISCLOSURE
      });
    }

    if (parameters.visualFilter !== undefined) {
      // Both saved shapes are read: a project not opened since BCN-003b still holds
      // `{combinator, rules}`, and a port that stops being declared takes its wire.
      QueryUtils.collectFilterParameters(parameters.visualFilter as VisualFilterQuery, 'qp-').forEach((input) => {
        ports.push({
          name: 'qp-' + input,
          plug: 'input',
          type: '*',
          displayName: input,
          group: 'Query Parameters'
        });
      });
    }
  }

  sendSchemaPorts(editorConnection, nodeId, ports, { staticPorts: staticPortNames(SubscribeToChangesNode) });
}

const SubscribeToChangesNodeModule: NodeModule = {
  node: SubscribeToChangesNode,
  setup: function (context: NodeContextLike, graphModel: GraphModelLike) {
    if (!context.editorConnection || !context.editorConnection.isRunningLocally()) {
      return;
    }

    function _managePortsForNode(node: GraphNodeModel) {
      updatePorts(node.id, node.parameters, context.editorConnection, graphModel);

      node.on('parameterUpdated', function (event: { name: string }) {
        if (event.name === 'collectionName' || event.name === 'visualFilter' || event.name === 'backendId') {
          updatePorts(node.id, node.parameters, context.editorConnection, graphModel);
        }
      });

      graphModel.on('metadataChanged.dbCollections', function () {
        updatePorts(node.id, node.parameters, context.editorConnection, graphModel);
      });

      graphModel.on('metadataChanged.systemCollections', function () {
        updatePorts(node.id, node.parameters, context.editorConnection, graphModel);
      });

      graphModel.on('metadataChanged.cloudservices', function () {
        updatePorts(node.id, node.parameters, context.editorConnection, graphModel);
      });

      graphModel.on('metadataChanged.backendServices', function () {
        updatePorts(node.id, node.parameters, context.editorConnection, graphModel);
      });
    }

    graphModel.on('editorImportComplete', () => {
      graphModel.on('nodeAdded.SubscribeToChanges', function (node: GraphNodeModel) {
        _managePortsForNode(node);
      });

      for (const node of graphModel.getNodesWithType('SubscribeToChanges')) {
        _managePortsForNode(node);
      }
    });
  }
};

export = SubscribeToChangesNodeModule;
