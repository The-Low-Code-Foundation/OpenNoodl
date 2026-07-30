/**
 * BYOB Subscribe To Changes Node
 *
 * Subscribes to live collection changes over the backend's WebSocket
 * interface (Directus: ws://…/websocket — requires WEBSOCKETS_ENABLED on the
 * server). Emits a signal per change event with the changed record, so flows
 * can react to creates/updates/deletes made by other clients without polling.
 *
 * Connection lifecycle (auth handshake, ping/pong heartbeat, exponential
 * backoff reconnect) lives in byob-realtime.js; this file is the node shell:
 * schema-aware dropdowns, ports, and output plumbing.
 *
 * @module noodl-runtime
 * @since 2.0.0
 */

import type {
  GraphModelLike,
  GraphNodeModel,
  InspectInfo,
  NodeContextLike,
  NodeDefinitionOptions,
  NodeInstance,
  NodeModule,
  RuntimeDiscoveredPort
} from '@noodl/types';

import type { BackendServicesMetaData, ResolvedBackend, SchemaCollection } from './byob-types';

import Node = require('../../../node');
import ByobUtils = require('./byob-utils');
import ByobRealtime = require('./byob-realtime');

const { RealtimeConnection, RealtimeSSEConnection, buildWebSocketUrl, isNodeGXRealtime } = ByobRealtime;

/** What both realtime transports report through `onError`. */
interface RealtimeError {
  message: string;
  code?: string;
}

/**
 * The part of a realtime connection this node uses.
 *
 * Deliberately structural rather than a union of the two concrete transports: picking one
 * by backend type is the whole point, and the node is written to not care which it got.
 */
interface RealtimeTransport {
  connect(): void;
  dispose(): void;
}

/**
 * `this` inside the BYOB Subscribe To Changes node.
 *
 * The node is a shell around one live subscription — the socket lifecycle (auth handshake,
 * ping/pong, backoff reconnect) is in `byob-realtime.ts`. Every input is dynamic, so all
 * three setters route through `scheduleReconfigure`: a backend and collection arriving in
 * the same update tear down and rebuild the connection exactly once.
 */
interface SubscribeToChangesInstance extends NodeInstance {
  _internal: {
    enabled: boolean;
    subscribed: boolean;
    error: RealtimeError | null;
    eventType: string;
    changedRecord: Record<string, unknown> | null;
    changedRecords: unknown[];
    changedRecordId: string;
    connection: RealtimeTransport | null;
    backendId?: string;
    collection?: string;
    hasScheduledReconfigure?: boolean;
  };
  resolveBackend(): ResolvedBackend | null;
  scheduleReconfigure(): void;
  reconfigure(): void;
  teardownConnection(): void;
  setError(error: RealtimeError): void;
  getPrimaryKeyName(): string;
  handleRealtimeStatus(subscribed: boolean): void;
  handleRealtimeError(error: RealtimeError): void;
  handleRealtimeEvent(event: string, data: unknown[]): void;
}

/** NDA-004 §2 — see `setError`. Also the editor's warning key; the bus keys by `code`. */
const REALTIME_ERROR_CODE = 'subscribe-to-changes/realtime-failed';

const SubscribeToChangesNode: NodeDefinitionOptions = {
  name: 'noodl.byob.SubscribeToChanges',
  displayNodeName: 'Subscribe To Changes',
  docs: 'https://docs.noodl.net/nodes/data/byob/subscribe-to-changes',
  category: 'Data',
  color: 'data',
  searchTags: ['byob', 'realtime', 'subscribe', 'websocket', 'live', 'changes', 'events', 'directus', 'backend'],
  ssr: {
    compat: 'client-only',
    note: 'A live subscription is meaningless in a server render and would leak a socket per request; the node activates in the browser after hydration.'
  },

  initialize: function (this: SubscribeToChangesInstance) {
    this._internal.enabled = true;
    this._internal.subscribed = false;
    this._internal.error = null;
    this._internal.eventType = '';
    this._internal.changedRecord = null;
    this._internal.changedRecords = [];
    this._internal.changedRecordId = '';
    this._internal.connection = null;
  },

  getInspectInfo(this: SubscribeToChangesInstance): InspectInfo {
    const internal = this._internal;
    if (!internal.collection) {
      return { type: 'text', value: '[No collection selected]' };
    }
    return {
      type: 'value',
      value: {
        collection: internal.collection,
        subscribed: internal.subscribed,
        lastEvent: internal.eventType || null,
        lastRecord: internal.changedRecord,
        error: internal.error
      }
    };
  },

  // All inputs are defined dynamically in updatePorts() to support
  // schema-driven dropdowns — see registerInputIfNeeded.
  inputs: {},

  outputs: {
    subscribed: {
      type: 'boolean',
      displayName: 'Subscribed',
      group: 'Status',
      getter: function (this: SubscribeToChangesInstance) {
        return this._internal.subscribed;
      }
    },
    failure: {
      type: 'signal',
      displayName: 'Failure',
      group: 'Events'
    },
    error: {
      type: 'object',
      displayName: 'Error',
      group: 'Status',
      getter: function (this: SubscribeToChangesInstance) {
        return this._internal.error;
      }
    },
    created: {
      type: 'signal',
      displayName: 'Created',
      group: 'Events'
    },
    updated: {
      type: 'signal',
      displayName: 'Updated',
      group: 'Events'
    },
    deleted: {
      type: 'signal',
      displayName: 'Deleted',
      group: 'Events'
    },
    changed: {
      type: 'signal',
      displayName: 'Changed',
      group: 'Events'
    },
    eventType: {
      type: 'string',
      displayName: 'Event Type',
      group: 'Event',
      getter: function (this: SubscribeToChangesInstance) {
        return this._internal.eventType;
      }
    },
    changedRecord: {
      type: 'object',
      displayName: 'Changed Record',
      group: 'Event',
      getter: function (this: SubscribeToChangesInstance) {
        return this._internal.changedRecord;
      }
    },
    changedRecords: {
      type: 'array',
      displayName: 'Changed Records',
      group: 'Event',
      getter: function (this: SubscribeToChangesInstance) {
        return this._internal.changedRecords;
      }
    },
    changedRecordId: {
      type: 'string',
      displayName: 'Changed Record Id',
      group: 'Event',
      getter: function (this: SubscribeToChangesInstance) {
        return this._internal.changedRecordId;
      }
    }
  },

  prototypeExtensions: {
    resolveBackend: function (this: SubscribeToChangesInstance) {
      const backendId = this._internal.backendId || '_active_';
      return ByobUtils.resolveBackend(backendId);
    },

    /**
     * Tear down and rebuild the connection to match the current inputs.
     * Scheduled after inputs have updated so a backend+collection change
     * arriving together only reconnects once.
     */
    scheduleReconfigure: function (this: SubscribeToChangesInstance) {
      if (this._internal.hasScheduledReconfigure) return;
      this._internal.hasScheduledReconfigure = true;
      this.scheduleAfterInputsHaveUpdated(() => {
        this._internal.hasScheduledReconfigure = false;
        this.reconfigure();
      });
    },

    reconfigure: function (this: SubscribeToChangesInstance) {
      this.teardownConnection();

      if (this._internal.enabled === false) return;

      const collection = this._internal.collection;
      if (!collection) return;

      const backendConfig = this.resolveBackend();
      if (!backendConfig) {
        this.setError({
          message: 'No backend configured. Please add a backend in the Backend Services panel.'
        });
        return;
      }

      // Provider selection: the NodeGX standalone backend speaks SSE; Directus
      // (and other BYOB backends) speak the WebSocket protocol. Both transports
      // share the onEvent/onStatus/onError contract, so only construction differs.
      if (isNodeGXRealtime(backendConfig.type)) {
        console.log('[BYOB Subscribe] Connecting (NodeGX SSE):', { url: backendConfig.url, collection });
        this._internal.connection = new RealtimeSSEConnection({
          baseUrl: backendConfig.url,
          token: backendConfig.token,
          collection,
          onEvent: this.handleRealtimeEvent.bind(this),
          onStatus: this.handleRealtimeStatus.bind(this),
          onError: this.handleRealtimeError.bind(this)
        });
        this._internal.connection.connect();
        return;
      }

      const url = buildWebSocketUrl(backendConfig.url);
      if (!url) {
        this.setError({ message: 'Backend URL is not a valid http(s) URL: ' + backendConfig.url });
        return;
      }

      console.log('[BYOB Subscribe] Connecting (WebSocket):', { url, collection });

      this._internal.connection = new RealtimeConnection({
        url,
        token: backendConfig.token,
        collection,
        onEvent: this.handleRealtimeEvent.bind(this),
        onStatus: this.handleRealtimeStatus.bind(this),
        onError: this.handleRealtimeError.bind(this)
      });
      this._internal.connection.connect();
    },

    teardownConnection: function (this: SubscribeToChangesInstance) {
      if (this._internal.connection) {
        this._internal.connection.dispose();
        this._internal.connection = null;
      }
      if (this._internal.subscribed) {
        this._internal.subscribed = false;
        this.flagOutputDirty('subscribed');
      }
    },

    /**
     * NDA-004 §2 / FINDINGS B-iv. Two defects, and neither is the one B-iv predicted.
     *
     * The finding read all twenty-two `setError`s as copies of one that posted to
     * `editorConnection.sendWarning`. This one posted to `console.warn` — which does at least
     * survive deployment, unlike the editor channel, but is unstructured, carries no code, and
     * is invisible to `On App Error` and to every error subscriber. And the node had **no
     * `Failure` signal at all**: a subscription that could not connect was observable only as an
     * `Error` object appearing on a value port, which nothing downstream can sequence off.
     *
     * On whether the port is safe: `reconfigure` returns silently for the two unconfigured
     * states — `enabled === false` and no collection — so `setError` is reached only once a
     * collection has been asked for and the *backend* is missing or malformed, plus from the
     * transport's own `onError`. Neither is a "values have not arrived yet" state, which is the
     * question the Object node's trap poses to every node reached from a value setter.
     */
    setError: function (this: SubscribeToChangesInstance, error: RealtimeError) {
      this._internal.error = error;
      this.flagOutputDirty('error');
      this.sendSignalOnOutput('failure');

      this.raiseRuntimeError(REALTIME_ERROR_CODE, error.message || 'Realtime subscription failed', error);
    },

    /**
     * The primary key field name of the subscribed collection, from the
     * cached schema. Delete events carry only keys, so this is what lets
     * Changed Record Id stay populated across all three event types.
     */
    getPrimaryKeyName: function (this: SubscribeToChangesInstance) {
      const backend = this.resolveBackend();
      const collection = backend?.collections?.find((c: SchemaCollection) => c.name === this._internal.collection);
      return collection?.primaryKey || 'id';
    },

    handleRealtimeStatus: function (this: SubscribeToChangesInstance, subscribed: boolean) {
      this._internal.subscribed = subscribed;
      if (subscribed) {
        this._internal.error = null;
        this.flagOutputDirty('error');
      }
      this.flagOutputDirty('subscribed');
    },

    handleRealtimeError: function (this: SubscribeToChangesInstance, error: RealtimeError) {
      this.setError(error);
    },

    handleRealtimeEvent: function (this: SubscribeToChangesInstance, event: string, data: unknown[]) {
      // 'resync' (NodeGX SSE): the stream may have missed events (reconnect or a
      // slow-client overflow) and the server keeps no replay log — signal a
      // generic 'changed' so downstream re-queries, without firing a spurious
      // create/update/delete.
      if (event === 'resync') {
        this._internal.eventType = 'resync';
        this.flagOutputDirty('eventType');
        this.sendSignalOnOutput('changed');
        return;
      }

      // 'init' is the subscription confirmation snapshot, not a change
      if (event !== 'create' && event !== 'update' && event !== 'delete') return;

      const pkName = this.getPrimaryKeyName();

      if (event === 'delete') {
        // Delete events carry primary keys, as STRINGS even for numeric pks
        this._internal.changedRecord = null;
        this._internal.changedRecords = data;
        this._internal.changedRecordId = data.length > 0 ? String(data[0]) : '';
      } else {
        // Create/update events carry full records
        this._internal.changedRecord = data.length > 0 ? (data[0] as Record<string, unknown>) : null;
        this._internal.changedRecords = data;
        const pkValue = this._internal.changedRecord?.[pkName];
        this._internal.changedRecordId = pkValue !== undefined && pkValue !== null ? String(pkValue) : '';
      }

      this._internal.eventType = event;

      this.flagOutputDirty('eventType');
      this.flagOutputDirty('changedRecord');
      this.flagOutputDirty('changedRecords');
      this.flagOutputDirty('changedRecordId');

      const eventSignals: Record<string, string> = { create: 'created', update: 'updated', delete: 'deleted' };
      this.sendSignalOnOutput(eventSignals[event]);
      this.sendSignalOnOutput('changed');
    },

    registerInputIfNeeded: function (this: SubscribeToChangesInstance, name: string) {
      if (this.hasInput(name)) return;

      const dynamicInputSetters: Record<string, (value: never) => void> = {
        backendId: (value: never) => {
          this._internal.backendId = value;
          this.scheduleReconfigure();
        },
        collection: (value: never) => {
          this._internal.collection = value;
          this.scheduleReconfigure();
        },
        enabled: (value: never) => {
          this._internal.enabled = !!value;
          this.scheduleReconfigure();
        }
      };

      if (dynamicInputSetters[name]) {
        return this.registerInput(name, {
          set: dynamicInputSetters[name]
        });
      }
    },

    _onNodeDeleted: function (this: SubscribeToChangesInstance) {
      Node.prototype._onNodeDeleted.call(this);
      this.teardownConnection();
    }
  }
};

/**
 * Update dynamic ports: backend + collection dropdowns from the synced schema
 * (same pattern as the other byob-* nodes). Realtime subscriptions target
 * user collections; Directus system collections are left out of the dropdown.
 */
function updatePorts(
  nodeId: string,
  parameters: Record<string, unknown>,
  editorConnection: NodeContextLike['editorConnection'],
  graphModel: GraphModelLike
) {
  const ports: RuntimeDiscoveredPort[] = [];

  const backendServices = (graphModel.getMetaData('backendServices') as BackendServicesMetaData) || {
    backends: []
  };
  const backends = backendServices.backends || [];

  const backendEnums = [{ label: 'Active Backend', value: '_active_' }];
  backends.forEach((b) => {
    backendEnums.push({ label: b.name, value: b.id });
  });

  ports.push({
    name: 'backendId',
    displayName: 'Backend',
    type: {
      name: 'enum',
      enums: backendEnums,
      allowEditOnly: true
    },
    default: '_active_',
    plug: 'input',
    group: 'Backend'
  });

  const selectedBackendId =
    parameters.backendId === '_active_' || !parameters.backendId
      ? backendServices.activeBackendId
      : parameters.backendId;
  const selectedBackend = backends.find((b) => b.id === selectedBackendId);
  const allCollections = selectedBackend?.schema?.collections || [];
  const userCollections = ByobUtils.filterCollectionsByMode(allCollections, 'items');

  const collectionEnums = [{ label: '(Select collection)', value: '' }];
  userCollections.forEach((c) => {
    collectionEnums.push({ label: c.displayName || c.name, value: c.name });
  });

  ports.push({
    name: 'collection',
    displayName: 'Collection',
    type: {
      name: 'enum',
      enums: collectionEnums,
      allowEditOnly: true
    },
    plug: 'input',
    group: 'Subscription'
  });

  ports.push({
    name: 'enabled',
    displayName: 'Enabled',
    type: 'boolean',
    default: true,
    plug: 'input',
    group: 'Subscription'
  });

  // Outputs are all static (declared on the node definition) — pushing them
  // here too would list every output twice in getPorts().

  editorConnection.sendDynamicPorts(nodeId, ports);
}

const SubscribeToChangesNodeModule: NodeModule = {
  node: SubscribeToChangesNode,
  setup: function (context: NodeContextLike, graphModel: GraphModelLike) {
    if (!context.editorConnection || !context.editorConnection.isRunningLocally()) {
      return;
    }

    function _managePortsForNode(node: GraphNodeModel) {
      updatePorts(node.id, node.parameters || {}, context.editorConnection, graphModel);

      node.on('parameterUpdated', function () {
        updatePorts(node.id, node.parameters, context.editorConnection, graphModel);
      });

      graphModel.on('metadataChanged.backendServices', function () {
        updatePorts(node.id, node.parameters, context.editorConnection, graphModel);
      });
    }

    graphModel.on('editorImportComplete', () => {
      graphModel.on('nodeAdded.noodl.byob.SubscribeToChanges', function (node: GraphNodeModel) {
        _managePortsForNode(node);
      });

      for (const node of graphModel.getNodesWithType('noodl.byob.SubscribeToChanges')) {
        _managePortsForNode(node);
      }
    });
  }
};

export = SubscribeToChangesNodeModule;
