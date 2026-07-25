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

const { Node } = require('../../../../noodl-runtime');
const ByobUtils = require('./byob-utils');
const { RealtimeConnection, buildWebSocketUrl } = require('./byob-realtime');

var SubscribeToChangesNode = {
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

  initialize: function () {
    this._internal.enabled = true;
    this._internal.subscribed = false;
    this._internal.error = null;
    this._internal.eventType = '';
    this._internal.changedRecord = null;
    this._internal.changedRecords = [];
    this._internal.changedRecordId = '';
    this._internal.connection = null;
  },

  getInspectInfo() {
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
      getter: function () {
        return this._internal.subscribed;
      }
    },
    error: {
      type: 'object',
      displayName: 'Error',
      group: 'Status',
      getter: function () {
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
      getter: function () {
        return this._internal.eventType;
      }
    },
    changedRecord: {
      type: 'object',
      displayName: 'Changed Record',
      group: 'Event',
      getter: function () {
        return this._internal.changedRecord;
      }
    },
    changedRecords: {
      type: 'array',
      displayName: 'Changed Records',
      group: 'Event',
      getter: function () {
        return this._internal.changedRecords;
      }
    },
    changedRecordId: {
      type: 'string',
      displayName: 'Changed Record Id',
      group: 'Event',
      getter: function () {
        return this._internal.changedRecordId;
      }
    }
  },

  prototypeExtensions: {
    resolveBackend: function () {
      const backendId = this._internal.backendId || '_active_';
      return ByobUtils.resolveBackend(backendId);
    },

    /**
     * Tear down and rebuild the connection to match the current inputs.
     * Scheduled after inputs have updated so a backend+collection change
     * arriving together only reconnects once.
     */
    scheduleReconfigure: function () {
      if (this._internal.hasScheduledReconfigure) return;
      this._internal.hasScheduledReconfigure = true;
      this.scheduleAfterInputsHaveUpdated(() => {
        this._internal.hasScheduledReconfigure = false;
        this.reconfigure();
      });
    },

    reconfigure: function () {
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

      const url = buildWebSocketUrl(backendConfig.url);
      if (!url) {
        this.setError({ message: 'Backend URL is not a valid http(s) URL: ' + backendConfig.url });
        return;
      }

      console.log('[BYOB Subscribe] Connecting:', { url, collection });

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

    teardownConnection: function () {
      if (this._internal.connection) {
        this._internal.connection.dispose();
        this._internal.connection = null;
      }
      if (this._internal.subscribed) {
        this._internal.subscribed = false;
        this.flagOutputDirty('subscribed');
      }
    },

    setError: function (error) {
      console.warn('[BYOB Subscribe] Error:', error);
      this._internal.error = error;
      this.flagOutputDirty('error');
    },

    /**
     * The primary key field name of the subscribed collection, from the
     * cached schema. Delete events carry only keys, so this is what lets
     * Changed Record Id stay populated across all three event types.
     */
    getPrimaryKeyName: function () {
      const backend = this.resolveBackend();
      const collection = backend?.collections?.find((c) => c.name === this._internal.collection);
      return collection?.primaryKey || 'id';
    },

    handleRealtimeStatus: function (subscribed) {
      this._internal.subscribed = subscribed;
      if (subscribed) {
        this._internal.error = null;
        this.flagOutputDirty('error');
      }
      this.flagOutputDirty('subscribed');
    },

    handleRealtimeError: function (error) {
      this.setError(error);
    },

    handleRealtimeEvent: function (event, data) {
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
        this._internal.changedRecord = data.length > 0 ? data[0] : null;
        this._internal.changedRecords = data;
        const pkValue = this._internal.changedRecord?.[pkName];
        this._internal.changedRecordId = pkValue !== undefined && pkValue !== null ? String(pkValue) : '';
      }

      this._internal.eventType = event;

      this.flagOutputDirty('eventType');
      this.flagOutputDirty('changedRecord');
      this.flagOutputDirty('changedRecords');
      this.flagOutputDirty('changedRecordId');

      const eventSignals = { create: 'created', update: 'updated', delete: 'deleted' };
      this.sendSignalOnOutput(eventSignals[event]);
      this.sendSignalOnOutput('changed');
    },

    registerInputIfNeeded: function (name) {
      if (this.hasInput(name)) return;

      const dynamicInputSetters = {
        backendId: (value) => {
          this._internal.backendId = value;
          this.scheduleReconfigure();
        },
        collection: (value) => {
          this._internal.collection = value;
          this.scheduleReconfigure();
        },
        enabled: (value) => {
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

    _onNodeDeleted: function () {
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
function updatePorts(nodeId, parameters, editorConnection, graphModel) {
  const ports = [];

  const backendServices = graphModel.getMetaData('backendServices') || { backends: [] };
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

module.exports = {
  node: SubscribeToChangesNode,
  setup: function (context, graphModel) {
    if (!context.editorConnection || !context.editorConnection.isRunningLocally()) {
      return;
    }

    function _managePortsForNode(node) {
      updatePorts(node.id, node.parameters || {}, context.editorConnection, graphModel);

      node.on('parameterUpdated', function () {
        updatePorts(node.id, node.parameters, context.editorConnection, graphModel);
      });

      graphModel.on('metadataChanged.backendServices', function () {
        updatePorts(node.id, node.parameters, context.editorConnection, graphModel);
      });
    }

    graphModel.on('editorImportComplete', () => {
      graphModel.on('nodeAdded.noodl.byob.SubscribeToChanges', function (node) {
        _managePortsForNode(node);
      });

      for (const node of graphModel.getNodesWithType('noodl.byob.SubscribeToChanges')) {
        _managePortsForNode(node);
      }
    });
  }
};
