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

import type { InspectInfo, NodeDefinitionOptions, NodeInstance, NodeModule, OutcomeToken } from '@noodl/types';

import { outcomeOutputs } from '../../../outcome';
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

import Node = require('../../../node');

/** The failure this node reports when a `Connect` cannot open, or gives up trying. */
const WS_ERROR_CONNECT_FAILED = 'websocket/connect-failed';

/** The node's slice of `_internal`. */
interface WebSocketNodeInternal {
  /** Built lazily so a node that never connects never allocates one. */
  connection: WebSocketConnection | null;
  /** Current input values, and the seed for the next connection. */
  config: WebSocketConnectionConfig;
  /** True when `autoConnect` should open the socket as soon as a url exists. */
  autoConnect: boolean;
  hasScheduledRebuild: boolean;

  /**
   * The `Connect` invocation still waiting for its handshake, if there is one.
   *
   * ERG-001. `Connect` is the async case the contract's token shape was built for: it returns
   * with the socket still in `connecting`, so "has this invocation reported yet" cannot live on
   * the node — the same `PendingNavigation` shape `router-navigate.ts` uses.
   *
   * ⚠️ **Optional, and that is the load-bearing part.** `rebuild()` and auto-connect also call
   * `connect()`, and neither is an invocation of the `Connect` port. They mint no token, so they
   * report nothing — the mount-path rule the navigation slice established for `Router.reset`.
   */
  pendingConnect: OutcomeToken | null;

  message: unknown;
  received: unknown;
  receivedRaw: string;
  receivedIsBinary: boolean;
}

function internalOf(node: NodeInstance): WebSocketNodeInternal {
  return node._internal as unknown as WebSocketNodeInternal;
}

/** The definition's own `methods`, so a call site inside it is checked rather than cast to `any`. */
interface WebSocketNodeMethods {
  getConnection(): WebSocketConnection;
  applyConfig(config: WebSocketConnectionConfig): void;
  scheduleRebuild(): void;
  rebuild(): void;
  settleConnect(outcome: 'done' | 'unchanged' | 'failure', code?: string, message?: string): void;
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
    internal.pendingConnect = null;
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
      description:
        'Endpoint to connect to, which must start with ws:// or wss://; changing it reconnects to the new one',
      group: 'Connection',
      set(this: NodeInstance, value: string) {
        internalOf(this).config.url = typeof value === 'string' ? value : '';
        (this as NodeInstance & { scheduleRebuild(): void }).scheduleRebuild();
      }
    },
    autoConnect: {
      type: 'boolean',
      displayName: 'Auto Connect',
      description: 'Connect as soon as a URL is available, without waiting for a Connect signal',
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
      description: 'Comma-separated WebSocket subprotocols to offer during the handshake',
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
      description:
        'Retries after an unsolicited close with a growing backoff; turning it off reports the close as an error',
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
      description: 'First backoff delay in milliseconds; each further attempt doubles it up to Max Reconnect Delay',
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
      description: 'Ceiling on the backoff in milliseconds, however many attempts there have been',
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
      description: 'Reconnect attempts allowed per outage; 0 disables retrying and a negative value means unlimited',
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
      description:
        'Spreads reconnect attempts randomly across the second half of each backoff window, so a fleet does not return in lockstep',
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
      description:
        'Milliseconds between heartbeats while the socket is open; 0 disables it, and only enable it if your server expects the message',
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
      description: 'Application text sent as the heartbeat; it is not a protocol ping frame',
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
      description:
        'Exact text the server answers a heartbeat with; it is measured as Latency, hidden from On Message, and its absence is treated as a dead connection',
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
      description: 'Opens the socket, replacing one already open without reporting a close',
      group: 'Actions',
      valueChangedToTrue(this: NodeInstance) {
        const self = this as NodeInstance & WebSocketNodeMethods;
        // ERG-001. The token is minted here — at the port — and nowhere else, so the
        // auto-connect and rebuild paths that also call `connect()` stay silent.
        //
        // A `Connect` fired while an earlier one is still shaking hands supersedes it: the old
        // socket is torn down by `connect()` a line later, so that invocation never reaches an
        // open connection and never will.
        self.settleConnect('unchanged');
        internalOf(this).pendingConnect = this.beginOutcome();
        self.getConnection().connect();
      }
    },
    disconnect: {
      displayName: 'Disconnect',
      description: 'Closes the socket and cancels any pending reconnect',
      group: 'Actions',
      valueChangedToTrue(this: NodeInstance) {
        const self = this as NodeInstance & WebSocketNodeMethods;
        const outcome = this.beginOutcome();
        const connection = internalOf(this).connection;
        // A `Connect` still in flight is being cancelled, not failed — the author asked for
        // this. It is a separate invocation with its own token, so both report.
        self.settleConnect('unchanged');
        // §0.3's measured entry: a `Disconnect` with nothing open used to be the silent path
        // out of this node. It is `Unchanged`, and a Disconnect cannot fail.
        const closedSomething = connection ? connection.disconnect() : false;
        this.reportOutcome(outcome, closedSomething ? 'done' : 'unchanged');
      }
    },
    send: {
      displayName: 'Send',
      description: 'Hands the current Message to the socket, or applies the When Disconnected policy',
      group: 'Actions',
      valueChangedToTrue(this: NodeInstance) {
        const self = this as NodeInstance & WebSocketNodeMethods;
        const outcome = this.beginOutcome();
        // `send` sets `lastError` and `droppedCount` and fires `On Error` before it returns, so
        // by the time the outcome goes out every value it is about is already on the wire.
        const result = self.getConnection().send(internalOf(this).message);

        if (result.kind === 'failed') {
          this.reportOutcome(outcome, 'failure', { code: result.code, message: result.message });
          return;
        }
        // ⚠️ A queued message is `Done`, a dropped one is `Unchanged`. The postcondition of
        // `Send` is that the value is owed to the wire: a queued one is owed and will go out on
        // the next open, whereas the `Drop` policy is the author saying "throw it away", so
        // neither `Done` (which would be `Insert Object Into Array`'s lie) nor `Failure` (which
        // fires on a graph working exactly as written) is honest for it.
        this.reportOutcome(outcome, result.kind === 'dropped' ? 'unchanged' : 'done');
      }
    },

    // ── Message ─────────────────────────────────────────────────────────────
    message: {
      type: '*',
      displayName: 'Message',
      description: 'Value to send; objects are JSON-serialised, and ArrayBuffers and typed arrays go as binary frames',
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
      description:
        'Auto sends binary values as binary and everything else as text; Binary encodes text and objects as UTF-8 first',
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
      description:
        'What a Send does while the socket is not open: hold it in order, discard and count it, or also report an error',
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
      description:
        'Messages the queue holds before further Sends are refused and counted as dropped; 0 or less is unlimited and can grow during a long outage',
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
      description: 'Where the connection is: idle, connecting, open, reconnecting, closed or error',
      group: 'Status',
      get(this: NodeInstance) {
        const connection = internalOf(this).connection;
        return connection ? connection.state : 'idle';
      }
    },
    connected: {
      type: 'boolean',
      displayName: 'Connected',
      description: 'True only while the socket is open and messages can be sent without queueing',
      group: 'Status',
      get(this: NodeInstance) {
        const connection = internalOf(this).connection;
        return connection ? connection.connected : false;
      }
    },
    retryCount: {
      type: 'number',
      displayName: 'Retry Count',
      description: 'Attempts made during the current outage; back to zero once the socket opens',
      group: 'Status',
      get(this: NodeInstance) {
        const connection = internalOf(this).connection;
        return connection ? connection.retryCount : 0;
      }
    },
    lastError: {
      type: 'string',
      displayName: 'Last Error',
      description: 'What went wrong most recently, including why a reconnect was scheduled or abandoned',
      group: 'Status',
      get(this: NodeInstance) {
        const connection = internalOf(this).connection;
        return connection ? connection.lastError : '';
      }
    },
    queueSize: {
      type: 'number',
      displayName: 'Queue Size',
      description: 'Messages held because the socket was not open when Send ran',
      group: 'Status',
      get(this: NodeInstance) {
        const connection = internalOf(this).connection;
        return connection ? connection.queueSize : 0;
      }
    },
    droppedCount: {
      type: 'number',
      displayName: 'Dropped',
      description:
        'Messages that will never be sent, whether discarded by policy, by a full queue, or by the node being removed',
      group: 'Status',
      get(this: NodeInstance) {
        const connection = internalOf(this).connection;
        return connection ? connection.droppedCount : 0;
      }
    },
    latency: {
      type: 'number',
      displayName: 'Latency (ms)',
      description: 'Round trip of the last heartbeat in milliseconds; 0 until one has been measured',
      group: 'Status',
      get(this: NodeInstance) {
        const connection = internalOf(this).connection;
        return connection ? connection.latency : 0;
      }
    },
    closeCode: {
      type: 'number',
      displayName: 'Close Code',
      description: 'WebSocket close code from the last close, or 1006 when the socket died without one',
      group: 'Status',
      get(this: NodeInstance) {
        const connection = internalOf(this).connection;
        return connection ? connection.closeCode : 0;
      }
    },
    closeReason: {
      type: 'string',
      displayName: 'Close Reason',
      description: 'Reason the server gave for closing, which is often blank',
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
      description: 'The last message, parsed as JSON when it is JSON and handed over as text when it is not',
      group: 'Data',
      get(this: NodeInstance) {
        return internalOf(this).received;
      }
    },
    receivedRaw: {
      type: 'string',
      displayName: 'Received Raw',
      description: 'The last text message exactly as it arrived; blank for a binary frame',
      group: 'Data',
      get(this: NodeInstance) {
        return internalOf(this).receivedRaw;
      }
    },
    receivedIsBinary: {
      type: 'boolean',
      displayName: 'Received Is Binary',
      description: 'True when the last message was a binary frame, in which case Received holds the buffer',
      group: 'Data',
      get(this: NodeInstance) {
        return internalOf(this).receivedIsBinary;
      }
    },

    // ── Events ──────────────────────────────────────────────────────────────
    onOpen: {
      type: 'signal',
      displayName: 'On Open',
      description: 'Fires every time the socket opens, including after a reconnect',
      group: 'Events'
    },
    onMessage: {
      type: 'signal',
      displayName: 'On Message',
      description: 'Fires once per message, after Received already holds it; heartbeat replies are not messages',
      group: 'Events'
    },
    onMessageSent: {
      type: 'signal',
      displayName: 'On Message Sent',
      description:
        'Fires when a message has been handed to the socket, including a queued one flushed on reopen; not for heartbeats',
      group: 'Events'
    },
    onError: {
      type: 'signal',
      displayName: 'On Error',
      description: 'Fires when something went wrong: a failed connect, a refused send, a dead heartbeat, or a give-up',
      group: 'Events'
    },
    onClose: {
      type: 'signal',
      displayName: 'On Close',
      description: 'Fires whenever the socket goes down, whether or not a reconnect is going to follow',
      group: 'Events'
    },
    onReconnect: {
      type: 'signal',
      displayName: 'On Reconnect',
      description:
        'Fires on every open after the first; a WebSocket cannot resume, so this is the cue to re-fetch rather than assume continuity',
      group: 'Events'
    },

    // ── the outcome contract ────────────────────────────────────────────────
    //
    // ERG-001. Three actions, one port set — an outcome describes an *invocation*, and which
    // input it came from is already visible on the canvas as the wire that fired.
    //
    // ⚠️ These are not the lifecycle signals above and do not replace them. `On Open` says the
    // socket is up however it got there (auto-connect, a retry, a rebuild); `Done` says *this
    // Connect* finished. An author sequencing a chain wants the second; an author reacting to
    // the connection wants the first.
    ...outcomeOutputs({
      done:
        'Fires when the action finished: a Connect whose socket opened, a Send accepted for ' +
        'delivery (sent, or queued for the next open), or a Disconnect that closed something',
      unchanged:
        'Fires when there was nothing to do: a Disconnect with nothing open, a Send discarded ' +
        'by the Drop policy, or a Connect a later Connect or Disconnect superseded before it opened',
      failure:
        'Fires when the action could not be performed — no URL, a URL that is not ws:// or ' +
        'wss://, a connection that gave up, or a refused Send. Last Error carries the reason'
    })
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
          // ERG-001. `error` is the connection's one terminal failure state — `_fail` for a
          // connect that cannot even start, and the give-up branch of `_handleSocketDown` when
          // the retries are spent or turned off. `onError` is *not* the discriminator: it also
          // fires for a transient drop that is about to be retried, and for a refused send.
          if (connection.state === 'error') {
            (this as NodeInstance & WebSocketNodeMethods).settleConnect(
              'failure',
              WS_ERROR_CONNECT_FAILED,
              connection.lastError || 'The connection could not be opened'
            );
          }
        },
        onOpen: (isReconnect: boolean) => {
          this.sendSignalOnOutput('onOpen');
          // The one thing a WebSocket reconnect cannot tell you is what you
          // missed: RFC 6455 has no resume, so this is the app's cue to
          // re-fetch rather than assume the stream was continuous. Same role as
          // the NodeGX backend's SSE `resync` frame (BAK-001).
          if (isReconnect) this.sendSignalOnOutput('onReconnect');
          // Last, after the lifecycle signal and the status values it is about. ⚠️ A first
          // attempt that dropped and a retry that then opened is one `Done`, not a `Failure`
          // followed by a `Done`: the token rides the whole outage, and ending an author's
          // chain dead on a connection that is in the end open is the class this contract closes.
          (this as NodeInstance & WebSocketNodeMethods).settleConnect('done');
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
     * End the `Connect` invocation that is still waiting, if there is one.
     *
     * ERG-001. The one place the pending token is read, so "exactly one outcome per invocation"
     * is a property of this method rather than of every caller remembering to clear the slot.
     * Called from four places — the socket opening, the connection reaching `error`, a later
     * `Connect`, and a `Disconnect` — and a no-op from all four when nothing is pending, which
     * is what keeps the auto-connect and rebuild paths silent.
     */
    settleConnect(this: NodeInstance, outcome: 'done' | 'unchanged' | 'failure', code?: string, message?: string) {
      const internal = internalOf(this);
      const token = internal.pendingConnect;
      if (!token) return;
      internal.pendingConnect = null;
      this.reportOutcome(token, outcome, outcome === 'failure' ? { code, message } : undefined);
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
        // ERG-001. A `Connect` still shaking hands against the *old* endpoint will never open
        // it — the url moved underneath it. That invocation is superseded, not failed; the
        // reconnect below is the rebuild's, not the author's, and mints no token of its own.
        (this as NodeInstance & WebSocketNodeMethods).settleConnect('unchanged');
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
      // ⚠️ A `Connect` still pending here reports nothing, and there is nowhere for it to
      // report to: the node has been deleted, so its outputs are unreadable and every wire off
      // it is gone. This is the navigation exception's shape — the graph that would observe the
      // signal no longer exists — rather than a silent path inside a live graph.
      if (internal) internal.pendingConnect = null;
    }
  }
};

const module_: NodeModule = { node: WebSocketNode };

export = module_;
