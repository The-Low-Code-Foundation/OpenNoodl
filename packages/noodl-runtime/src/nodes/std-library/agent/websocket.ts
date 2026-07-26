/**
 * WebSocket node (AGENT-002 / AIX-005).
 *
 * Bidirectional real-time transport for a Noodl graph: send text, JSON or
 * binary, receive the same, and see the connection's whole state — connecting,
 * open, reconnecting, retry count, last error, queue depth, dropped count — as
 * ordinary outputs you can wire to the canvas.
 *
 * That last part is the point of the node rather than a nicety. An app author
 * working in a visual editor cannot step through code, so a reconnection that
 * quietly stopped happening is the worst failure this node could have. Nothing
 * here is swallowed: every message that does not reach the wire is either in the
 * queue or counted, and every give-up sets `lastError` and fires `onError`.
 *
 * The lifecycle itself lives in `websocket-connection.ts`, which takes its
 * socket and its timers through injectable seams so the transitions can be
 * unit-tested without a server. This file is the node shell: ports, plumbing
 * and the input-change policy.
 *
 * ## Port summary
 *
 * Inputs — Connection: `url`, `autoConnect`, `protocols`, `autoReconnect`,
 * `reconnectDelay`, `maxReconnectDelay`, `maxRetries`, `jitter`,
 * `heartbeatInterval`, `heartbeatMessage`, `heartbeatReply`.
 * Inputs — Actions: `connect`, `disconnect`, `send`.
 * Inputs — Message: `message`, `messageType`, `whenDisconnected`, `maxQueueSize`.
 *
 * Outputs — Status: `connectionState`, `connected`, `retryCount`, `lastError`,
 * `queueSize`, `droppedCount`, `latency`, `closeCode`, `closeReason`.
 * Outputs — Data: `received`, `receivedRaw`, `receivedIsBinary`.
 * Outputs — Events: `onOpen`, `onMessage`, `onMessageSent`, `onError`,
 * `onClose`, `onReconnect`.
 *
 * @module noodl-runtime
 * @since 2.0.0
 */

import type { InspectInfo, NodeDefinitionOptions, NodeInstance, NodeModule } from '@noodl/types';

import Node = require('../../../node');
import {
  DEFAULT_MAX_QUEUE_SIZE,
  DEFAULT_MAX_RECONNECT_DELAY,
  DEFAULT_MAX_RETRIES,
  DEFAULT_RECONNECT_DELAY,
  MessageEncoding,
  SendWhenDisconnected,
  WebSocketConnection,
  WebSocketConnectionConfig
} from './websocket-connection';

/** The node's slice of `_internal`. */
interface WebSocketNodeInternal {
  /** Built lazily so a node that never connects never allocates one. */
  connection: WebSocketConnection | null;
  /** Current input values, and the seed for the next connection. */
  config: WebSocketConnectionConfig;
  /** True when `autoConnect` should open the socket as soon as a url exists. */
  autoConnect: boolean;
  hasScheduledRebuild: boolean;

  message: unknown;
  received: unknown;
  receivedRaw: string;
  receivedIsBinary: boolean;
}

function internalOf(node: NodeInstance): WebSocketNodeInternal {
  return node._internal as unknown as WebSocketNodeInternal;
}

/** Status outputs are flagged as a set — see `onStatus` in the connection. */
const STATUS_OUTPUTS = [
  'connectionState',
  'connected',
  'retryCount',
  'lastError',
  'queueSize',
  'droppedCount',
  'latency',
  'closeCode',
  'closeReason'
];

/**
 * Whether a live connection is pointed somewhere other than where the node's
 * inputs now say. Only `url` and `protocols` count — everything else is tuning,
 * and tuning is applied in place.
 */
function identityChanged(built: WebSocketConnectionConfig, wanted: WebSocketConnectionConfig): boolean {
  if ((built.url || '') !== (wanted.url || '')) return true;
  const a = built.protocols || [];
  const b = wanted.protocols || [];
  return a.length !== b.length || a.some((protocol, index) => protocol !== b[index]);
}

/** `"json, chat.v1"` → `['json', 'chat.v1']`. */
function parseProtocols(value: unknown): string[] {
  if (typeof value !== 'string' || value.trim() === '') return [];
  return value
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

const WebSocketNode: NodeDefinitionOptions = {
  name: 'net.noodl.WebSocket',
  displayNodeName: 'WebSocket',
  docs: 'https://docs.noodl.net/nodes/data/websocket',
  category: 'Data',
  color: 'data',
  shortDesc: 'Two-way real-time connection to a WebSocket server, with visible connection state.',
  searchTags: [
    'websocket',
    'ws',
    'wss',
    'realtime',
    'bidirectional',
    'socket',
    'stream',
    'streaming',
    'agent',
    'chat',
    'live'
  ],
  usePortAsLabel: 'url',
  portLabelTruncationMode: 'path',

  // Same reasoning as Subscribe To Changes: a live socket is meaningless in a
  // server render and would leak one per request. Ports still exist so
  // connections stay valid; the node runs in the browser after hydration.
  ssr: {
    compat: 'client-only',
    note: 'A WebSocket cannot be meaningfully opened during a server render and would leak a socket per request; the node connects in the browser after hydration.'
  },

  initialize(this: NodeInstance) {
    const internal = internalOf(this);
    internal.connection = null;
    internal.autoConnect = true;
    internal.hasScheduledRebuild = false;
    internal.message = undefined;
    internal.received = undefined;
    internal.receivedRaw = '';
    internal.receivedIsBinary = false;
    internal.config = {
      url: '',
      protocols: [],
      autoReconnect: true,
      reconnectDelay: DEFAULT_RECONNECT_DELAY,
      maxReconnectDelay: DEFAULT_MAX_RECONNECT_DELAY,
      maxRetries: DEFAULT_MAX_RETRIES,
      jitter: true,
      heartbeatInterval: 0,
      heartbeatMessage: 'ping',
      heartbeatReply: 'pong',
      sendWhenDisconnected: 'queue',
      maxQueueSize: DEFAULT_MAX_QUEUE_SIZE,
      messageEncoding: 'auto'
    };
  },

  getInspectInfo(this: NodeInstance): InspectInfo {
    const internal = internalOf(this);
    const connection = internal.connection;
    if (!connection) {
      return { type: 'text', value: internal.config.url ? '[Not connected]' : '[No URL set]' };
    }
    return {
      type: 'value',
      value: {
        state: connection.state,
        url: internal.config.url,
        retryCount: connection.retryCount,
        queueSize: connection.queueSize,
        droppedCount: connection.droppedCount,
        latency: connection.latency,
        lastError: connection.lastError || null,
        lastReceived: internal.received
      }
    };
  },

  inputs: {
    // ── Connection ──────────────────────────────────────────────────────────
    url: {
      type: 'string',
      displayName: 'URL',
      group: 'Connection',
      set(this: NodeInstance, value: string) {
        internalOf(this).config.url = typeof value === 'string' ? value : '';
        (this as NodeInstance & { scheduleRebuild(): void }).scheduleRebuild();
      }
    },
    autoConnect: {
      type: 'boolean',
      displayName: 'Auto Connect',
      group: 'Connection',
      default: true,
      tooltip: 'Connect as soon as a URL is available, without waiting for a Connect signal.',
      set(this: NodeInstance, value: boolean) {
        internalOf(this).autoConnect = !!value;
        (this as NodeInstance & { scheduleRebuild(): void }).scheduleRebuild();
      }
    },
    protocols: {
      type: 'string',
      displayName: 'Protocols',
      group: 'Connection',
      tooltip: 'Comma-separated WebSocket subprotocols to offer during the handshake.',
      set(this: NodeInstance, value: string) {
        internalOf(this).config.protocols = parseProtocols(value);
        (this as NodeInstance & { scheduleRebuild(): void }).scheduleRebuild();
      }
    },
    autoReconnect: {
      type: 'boolean',
      displayName: 'Auto Reconnect',
      group: 'Connection',
      default: true,
      set(this: NodeInstance, value: boolean) {
        (this as NodeInstance & { applyConfig(c: WebSocketConnectionConfig): void }).applyConfig({
          autoReconnect: !!value
        });
      }
    },
    reconnectDelay: {
      type: 'number',
      displayName: 'Reconnect Delay (ms)',
      group: 'Connection',
      default: DEFAULT_RECONNECT_DELAY,
      tooltip: 'First backoff delay. Each further attempt doubles it, up to Max Reconnect Delay.',
      set(this: NodeInstance, value: number) {
        (this as NodeInstance & { applyConfig(c: WebSocketConnectionConfig): void }).applyConfig({
          reconnectDelay: Number(value)
        });
      }
    },
    maxReconnectDelay: {
      type: 'number',
      displayName: 'Max Reconnect Delay (ms)',
      group: 'Connection',
      default: DEFAULT_MAX_RECONNECT_DELAY,
      set(this: NodeInstance, value: number) {
        (this as NodeInstance & { applyConfig(c: WebSocketConnectionConfig): void }).applyConfig({
          maxReconnectDelay: Number(value)
        });
      }
    },
    maxRetries: {
      type: 'number',
      displayName: 'Max Retries',
      group: 'Connection',
      default: DEFAULT_MAX_RETRIES,
      tooltip: 'Reconnect attempts allowed per outage. 0 disables retrying; a negative value means unlimited.',
      set(this: NodeInstance, value: number) {
        (this as NodeInstance & { applyConfig(c: WebSocketConnectionConfig): void }).applyConfig({
          maxRetries: Number(value)
        });
      }
    },
    jitter: {
      type: 'boolean',
      displayName: 'Backoff Jitter',
      group: 'Connection',
      default: true,
      tooltip: 'Spread reconnect attempts randomly across the second half of each backoff window.',
      set(this: NodeInstance, value: boolean) {
        (this as NodeInstance & { applyConfig(c: WebSocketConnectionConfig): void }).applyConfig({ jitter: !!value });
      }
    },
    heartbeatInterval: {
      type: 'number',
      displayName: 'Heartbeat Interval (ms)',
      group: 'Connection',
      default: 0,
      tooltip:
        'Send Heartbeat Message this often while open. 0 disables it. Only enable this if your server expects the message — it is application data, not a protocol ping frame.',
      set(this: NodeInstance, value: number) {
        (this as NodeInstance & { applyConfig(c: WebSocketConnectionConfig): void }).applyConfig({
          heartbeatInterval: Number(value)
        });
      }
    },
    heartbeatMessage: {
      type: 'string',
      displayName: 'Heartbeat Message',
      group: 'Connection',
      default: 'ping',
      set(this: NodeInstance, value: string) {
        (this as NodeInstance & { applyConfig(c: WebSocketConnectionConfig): void }).applyConfig({
          heartbeatMessage: typeof value === 'string' ? value : ''
        });
      }
    },
    heartbeatReply: {
      type: 'string',
      displayName: 'Heartbeat Reply',
      group: 'Connection',
      default: 'pong',
      tooltip:
        'Exact text the server answers a heartbeat with. It is measured as Latency, hidden from On Message, and — if it stops arriving — treated as a dead connection. Leave empty to only send heartbeats.',
      set(this: NodeInstance, value: string) {
        (this as NodeInstance & { applyConfig(c: WebSocketConnectionConfig): void }).applyConfig({
          heartbeatReply: typeof value === 'string' ? value : ''
        });
      }
    },

    // ── Actions ─────────────────────────────────────────────────────────────
    connect: {
      displayName: 'Connect',
      group: 'Actions',
      valueChangedToTrue(this: NodeInstance) {
        (this as NodeInstance & { getConnection(): WebSocketConnection }).getConnection().connect();
      }
    },
    disconnect: {
      displayName: 'Disconnect',
      group: 'Actions',
      valueChangedToTrue(this: NodeInstance) {
        const connection = internalOf(this).connection;
        if (connection) connection.disconnect();
      }
    },
    send: {
      displayName: 'Send',
      group: 'Actions',
      valueChangedToTrue(this: NodeInstance) {
        const self = this as NodeInstance & { getConnection(): WebSocketConnection };
        self.getConnection().send(internalOf(this).message);
      }
    },

    // ── Message ─────────────────────────────────────────────────────────────
    message: {
      type: '*',
      displayName: 'Message',
      group: 'Message',
      tooltip: 'Value to send. Objects are JSON-serialized; ArrayBuffers and typed arrays are sent as binary frames.',
      set(this: NodeInstance, value: unknown) {
        internalOf(this).message = value;
      }
    },
    messageType: {
      type: {
        name: 'enum',
        enums: [
          { label: 'Auto', value: 'auto' },
          { label: 'Text', value: 'text' },
          { label: 'Binary', value: 'binary' }
        ]
      },
      displayName: 'Message Type',
      group: 'Message',
      default: 'auto',
      tooltip:
        'Auto sends binary values as binary and everything else as text. Binary forces text and objects to be UTF-8 encoded first.',
      set(this: NodeInstance, value: MessageEncoding) {
        (this as NodeInstance & { applyConfig(c: WebSocketConnectionConfig): void }).applyConfig({
          messageEncoding: value || 'auto'
        });
      }
    },
    whenDisconnected: {
      type: {
        name: 'enum',
        enums: [
          { label: 'Queue', value: 'queue' },
          { label: 'Drop', value: 'drop' },
          { label: 'Report Error', value: 'error' }
        ]
      },
      displayName: 'When Disconnected',
      group: 'Message',
      default: 'queue',
      tooltip:
        'What a Send does while the connection is not open. Queue holds it (in order) until the socket reopens; Drop discards it and counts it; Report Error also sets Last Error and fires On Error.',
      set(this: NodeInstance, value: SendWhenDisconnected) {
        (this as NodeInstance & { applyConfig(c: WebSocketConnectionConfig): void }).applyConfig({
          sendWhenDisconnected: value || 'queue'
        });
      }
    },
    maxQueueSize: {
      type: 'number',
      displayName: 'Max Queue Size',
      group: 'Message',
      default: DEFAULT_MAX_QUEUE_SIZE,
      tooltip:
        'Messages the queue holds before further Sends are refused and counted in Dropped. 0 or less means unlimited, which can grow without bound during a long outage.',
      set(this: NodeInstance, value: number) {
        (this as NodeInstance & { applyConfig(c: WebSocketConnectionConfig): void }).applyConfig({
          maxQueueSize: Number(value)
        });
      }
    }
  },

  outputs: {
    // ── Status ──────────────────────────────────────────────────────────────
    connectionState: {
      type: 'string',
      displayName: 'Connection State',
      group: 'Status',
      get(this: NodeInstance) {
        const connection = internalOf(this).connection;
        return connection ? connection.state : 'idle';
      }
    },
    connected: {
      type: 'boolean',
      displayName: 'Connected',
      group: 'Status',
      get(this: NodeInstance) {
        const connection = internalOf(this).connection;
        return connection ? connection.connected : false;
      }
    },
    retryCount: {
      type: 'number',
      displayName: 'Retry Count',
      group: 'Status',
      get(this: NodeInstance) {
        const connection = internalOf(this).connection;
        return connection ? connection.retryCount : 0;
      }
    },
    lastError: {
      type: 'string',
      displayName: 'Last Error',
      group: 'Status',
      get(this: NodeInstance) {
        const connection = internalOf(this).connection;
        return connection ? connection.lastError : '';
      }
    },
    queueSize: {
      type: 'number',
      displayName: 'Queue Size',
      group: 'Status',
      get(this: NodeInstance) {
        const connection = internalOf(this).connection;
        return connection ? connection.queueSize : 0;
      }
    },
    droppedCount: {
      type: 'number',
      displayName: 'Dropped',
      group: 'Status',
      get(this: NodeInstance) {
        const connection = internalOf(this).connection;
        return connection ? connection.droppedCount : 0;
      }
    },
    latency: {
      type: 'number',
      displayName: 'Latency (ms)',
      group: 'Status',
      get(this: NodeInstance) {
        const connection = internalOf(this).connection;
        return connection ? connection.latency : 0;
      }
    },
    closeCode: {
      type: 'number',
      displayName: 'Close Code',
      group: 'Status',
      get(this: NodeInstance) {
        const connection = internalOf(this).connection;
        return connection ? connection.closeCode : 0;
      }
    },
    closeReason: {
      type: 'string',
      displayName: 'Close Reason',
      group: 'Status',
      get(this: NodeInstance) {
        const connection = internalOf(this).connection;
        return connection ? connection.closeReason : '';
      }
    },

    // ── Data ────────────────────────────────────────────────────────────────
    received: {
      type: '*',
      displayName: 'Received',
      group: 'Data',
      get(this: NodeInstance) {
        return internalOf(this).received;
      }
    },
    receivedRaw: {
      type: 'string',
      displayName: 'Received Raw',
      group: 'Data',
      get(this: NodeInstance) {
        return internalOf(this).receivedRaw;
      }
    },
    receivedIsBinary: {
      type: 'boolean',
      displayName: 'Received Is Binary',
      group: 'Data',
      get(this: NodeInstance) {
        return internalOf(this).receivedIsBinary;
      }
    },

    // ── Events ──────────────────────────────────────────────────────────────
    onOpen: { type: 'signal', displayName: 'On Open', group: 'Events' },
    onMessage: { type: 'signal', displayName: 'On Message', group: 'Events' },
    onMessageSent: { type: 'signal', displayName: 'On Message Sent', group: 'Events' },
    onError: { type: 'signal', displayName: 'On Error', group: 'Events' },
    onClose: { type: 'signal', displayName: 'On Close', group: 'Events' },
    onReconnect: {
      type: 'signal',
      displayName: 'On Reconnect',
      group: 'Events'
    }
  },

  methods: {
    /**
     * The live connection, built on first use from the current inputs.
     *
     * Lazy so that a node sitting unconnected in a graph costs nothing, and so
     * that the connection is always constructed with a complete configuration
     * rather than being reconfigured field by field as inputs arrive.
     */
    getConnection(this: NodeInstance): WebSocketConnection {
      const internal = internalOf(this);
      if (internal.connection && !internal.connection.isDisposed) return internal.connection;

      const connection = new WebSocketConnection({
        ...internal.config,
        onStatus: () => {
          for (const name of STATUS_OUTPUTS) this.flagOutputDirty(name);
        },
        onOpen: (isReconnect: boolean) => {
          this.sendSignalOnOutput('onOpen');
          // The one thing a WebSocket reconnect cannot tell you is what you
          // missed: RFC 6455 has no resume, so this is the app's cue to
          // re-fetch rather than assume the stream was continuous. Same role as
          // the NodeGX backend's SSE `resync` frame (BAK-001).
          if (isReconnect) this.sendSignalOnOutput('onReconnect');
        },
        onMessage: (value: unknown, raw: string, isBinary: boolean) => {
          internal.received = value;
          internal.receivedRaw = raw;
          internal.receivedIsBinary = isBinary;
          this.flagOutputDirty('received');
          this.flagOutputDirty('receivedRaw');
          this.flagOutputDirty('receivedIsBinary');
          this.sendSignalOnOutput('onMessage');
        },
        onError: () => {
          this.sendSignalOnOutput('onError');
        },
        onClose: () => {
          this.sendSignalOnOutput('onClose');
        },
        onSent: () => {
          this.sendSignalOnOutput('onMessageSent');
        },
        // Test seam. Production leaves it undefined, so the connection reaches
        // for the platform globals; a spec assigns a factory before the node's
        // first connect to run the whole lifecycle against a fake socket.
        ...((this as NodeInstance & { _webSocketTestSeams?: object })._webSocketTestSeams || {})
      });

      internal.connection = connection;
      return connection;
    },

    /**
     * Push tuning values onto the live connection without disturbing it.
     *
     * Kept separate from {@link scheduleRebuild} because these inputs — backoff,
     * heartbeat, queue policy, encoding — say *how* to behave, not *what* to
     * connect to. Changing one mid-stream must not drop the stream.
     */
    applyConfig(this: NodeInstance, config: WebSocketConnectionConfig): void {
      const internal = internalOf(this);
      Object.keys(config).forEach((key) => {
        const value = (config as Record<string, unknown>)[key];
        if (value !== undefined) (internal.config as Record<string, unknown>)[key] = value;
      });
      if (internal.connection && !internal.connection.isDisposed) {
        internal.connection.configure(config);
      }
    },

    /**
     * Rebuild the connection because its identity changed (`url`, `protocols`)
     * or because `autoConnect` did.
     *
     * Scheduled after inputs have updated so a url and a protocol list arriving
     * in the same frame produce one connection rather than two — the same
     * batching `byob-subscribe.js` needs for its backend + collection pair.
     */
    scheduleRebuild(this: NodeInstance): void {
      const internal = internalOf(this);
      if (internal.hasScheduledRebuild) return;
      internal.hasScheduledRebuild = true;
      this.scheduleAfterInputsHaveUpdated(() => {
        internal.hasScheduledRebuild = false;
        (this as NodeInstance & { rebuild(): void }).rebuild();
      });
    },

    rebuild(this: NodeInstance): void {
      const internal = internalOf(this);
      const existing = internal.connection && !internal.connection.isDisposed ? internal.connection : null;

      // A rebuild is scheduled by *any* of url, protocols and autoConnect, and
      // all three can arrive in the same frame as a Connect or a Send. Doing
      // nothing when nothing identifying has actually changed is what keeps
      // that frame's work — a queued message, a connection in progress — from
      // being thrown away by a rebuild that had no reason to run.
      if (existing && !identityChanged(existing.getConfig(), internal.config)) {
        return;
      }

      if (existing) {
        // The app had asked to be connected, so it still wants to be — to the
        // new endpoint. Silently landing on `idle` after a url change is
        // exactly the invisible failure this node is supposed to prevent.
        const wasActive =
          existing.state === 'connecting' || existing.state === 'open' || existing.state === 'reconnecting';

        // Drop the old connection rather than re-pointing it: retry count,
        // queue, latency and close code all describe a *particular* session,
        // and carrying them onto a different endpoint would be a lie.
        existing.dispose();
        internal.connection = null;
        for (const name of STATUS_OUTPUTS) this.flagOutputDirty(name);

        if (internal.config.url && (internal.autoConnect || wasActive)) {
          (this as NodeInstance & { getConnection(): WebSocketConnection }).getConnection().connect();
        }
        return;
      }

      // Nothing built yet. Auto-connect with no url is not an error, just an
      // unconfigured node — it stays idle until a url arrives. An explicit
      // Connect signal with no url *is* an error, and says so.
      if (internal.autoConnect && internal.config.url) {
        (this as NodeInstance & { getConnection(): WebSocketConnection }).getConnection().connect();
      }
    },

    /**
     * Component unmount, navigation, or the node being deleted in the editor.
     * All three arrive here, and all three must leave nothing behind: no
     * socket, no reconnect timer, no heartbeat timer.
     */
    _onNodeDeleted(this: NodeInstance) {
      Node.prototype._onNodeDeleted.call(this);
      // `initialize` is skipped for client-only nodes on the SSR server, so
      // `_internal` may have none of our fields.
      const internal = internalOf(this);
      if (internal && internal.connection) {
        internal.connection.dispose();
        internal.connection = null;
      }
    }
  }
};

const module_: NodeModule = { node: WebSocketNode };

export = module_;
