/**
 * Server-Sent Events node (AGENT-001).
 *
 * A node shell over `SseConnection`. All of the lifecycle — backoff, cancellation,
 * duplicate suppression, transport selection — lives there and is unit-tested there;
 * this file's whole job is to make that lifecycle *visible in the graph*, which is the
 * point of the node: an app author who cannot step through code has to be able to see
 * that a reconnection is happening, and how many times it has failed.
 *
 * Hence `connectionState`, `retryCount`, `lastError` and `deliverySemantics` as
 * outputs rather than console noise, and hence no state that is only inspectable in
 * the devtools.
 *
 * The port shape (`url`/`autoConnect`/`connect`/`disconnect` in,
 * `connectionState`/`connected`/`lastError`/`retryCount` +
 * `onOpen`/`onMessage`/`onError`/`onClose` out) is shared with the WebSocket node so
 * the two are interchangeable at a glance.
 *
 * @module noodl-runtime
 * @since 2.0.0
 */

import type { NodeDefinitionOptions, NodeInstance } from '@noodl/types';

import { parseJsonOrText, textForPath } from './stream-parsers';
import { SseConnection, SseConnectionOptions, SseConnectionState } from './sse-connection';

import Node = require('../../../node');

/**
 * Injectable environment, read once per connect.
 *
 * Production leaves this empty and the connection falls through to the platform
 * globals. Tests assign to `node._internal.seams` before connecting; `_internal` is
 * the sanctioned per-instance scratch space, and the runtime's test environment is
 * `node`, where `EventSource` and streaming `fetch` do not exist — so a seam is the
 * only way the lifecycle matrix can be exercised at all.
 */
interface SseNodeSeams {
  EventSourceImpl?: any;
  fetchImpl?: any;
  AbortControllerImpl?: any;
  setTimeoutImpl?: (fn: () => void, ms: number) => any;
  clearTimeoutImpl?: (handle: any) => void;
  nowImpl?: () => number;
}

interface SseInternal {
  url: string;
  transport: 'auto' | 'eventsource' | 'fetch';
  method: string;
  headers: Record<string, string> | null;
  body: unknown;
  withCredentials: boolean;
  eventTypes: string;
  textPath: string;
  autoConnect: boolean;
  autoReconnect: boolean;
  reconnectOnStreamEnd: boolean;
  reconnectDelay: number;
  maxReconnectDelay: number;
  maxRetries: number;
  dedupeById: boolean;

  connection: SseConnection | null;
  connectionState: SseConnectionState;
  data: unknown;
  raw: string;
  eventType: string;
  autoConnectScheduled: boolean;
  seams: SseNodeSeams;
}

function internalOf(node: NodeInstance): SseInternal {
  return node._internal as unknown as SseInternal;
}

/** Reads the live connection's counter, or the resting value when there is none. */
function counter(node: NodeInstance, key: 'retryCount' | 'messageCount' | 'duplicatesSuppressed' | 'lastMessageTime') {
  const conn = internalOf(node).connection;
  return conn ? conn[key] : 0;
}

const SSENode: NodeDefinitionOptions = {
  name: 'net.noodl.SSE',
  displayNodeName: 'Server-Sent Events',
  shortDesc: 'Consumes a server-sent-events stream, with connection state and errors as outputs.',
  category: 'Data',
  color: 'data',
  docs: 'https://docs.noodl.net/nodes/data/sse',
  searchTags: [
    'sse',
    'stream',
    'streaming',
    'server-sent',
    'events',
    'eventsource',
    'realtime',
    'agent',
    'ai',
    'chat',
    'tokens'
  ],

  // A live stream is meaningless in a server render and would leak one connection per
  // request. The SSR server creates the node inert; the browser runs it after hydration.
  ssr: {
    compat: 'client-only',
    note: 'An event stream cannot be consumed during a server render; the node connects in the browser after hydration.'
  },

  initialize(this: NodeInstance) {
    const internal = internalOf(this);
    internal.url = '';
    internal.transport = 'auto';
    internal.method = 'GET';
    internal.headers = null;
    internal.body = undefined;
    internal.withCredentials = false;
    internal.eventTypes = '';
    internal.textPath = '';
    internal.autoConnect = false;
    internal.autoReconnect = true;
    internal.reconnectOnStreamEnd = false;
    internal.reconnectDelay = 1000;
    internal.maxReconnectDelay = 30000;
    internal.maxRetries = 0;
    internal.dedupeById = true;

    internal.connection = null;
    internal.connectionState = 'idle';
    internal.data = undefined;
    internal.raw = '';
    internal.eventType = '';
    internal.autoConnectScheduled = false;
    internal.seams = {};
  },

  getInspectInfo(this: NodeInstance) {
    const internal = internalOf(this);
    const conn = internal.connection;
    if (!internal.url) return { type: 'text', value: '[No URL set]' };
    return {
      type: 'value',
      value: {
        state: internal.connectionState,
        url: internal.url,
        transport: conn ? conn.transportKind : internal.transport,
        retryCount: conn ? conn.retryCount : 0,
        messages: conn ? conn.messageCount : 0,
        duplicatesSuppressed: conn ? conn.duplicatesSuppressed : 0,
        lastEventId: conn ? conn.lastEventId : '',
        deliverySemantics: conn ? conn.deliverySemantics : 'at-most-once',
        lastEvent: internal.data,
        // Shown next to the event it came from: a `textPath` that does not match the
        // server's shape is otherwise only visible as a Text node that never fills in.
        lastText: textForPath(internal.raw, internal.data, internal.textPath),
        lastError: conn ? conn.lastError : ''
      }
    };
  },

  inputs: {
    url: {
      type: 'string',
      displayName: 'URL',
      group: 'Connection',
      set(this: NodeInstance, value: string) {
        internalOf(this).url = value === undefined || value === null ? '' : String(value);
        (this as any).scheduleAutoConnect();
      }
    },

    transport: {
      type: {
        name: 'enum',
        enums: [
          { label: 'Auto', value: 'auto' },
          { label: 'Fetch (headers, POST)', value: 'fetch' },
          { label: 'EventSource', value: 'eventsource' }
        ]
      },
      default: 'auto',
      displayName: 'Transport',
      group: 'Connection',
      set(this: NodeInstance, value: string) {
        internalOf(this).transport = (value as SseInternal['transport']) || 'auto';
      }
    },

    method: {
      type: {
        name: 'enum',
        enums: [
          { label: 'GET', value: 'GET' },
          { label: 'POST', value: 'POST' },
          { label: 'PUT', value: 'PUT' },
          { label: 'PATCH', value: 'PATCH' }
        ]
      },
      default: 'GET',
      displayName: 'Method',
      group: 'Request',
      set(this: NodeInstance, value: string) {
        internalOf(this).method = value || 'GET';
      }
    },

    headers: {
      type: 'object',
      displayName: 'Headers',
      group: 'Request',
      set(this: NodeInstance, value: Record<string, string>) {
        internalOf(this).headers = value && typeof value === 'object' ? value : null;
      }
    },

    body: {
      type: '*',
      displayName: 'Body',
      group: 'Request',
      set(this: NodeInstance, value: unknown) {
        internalOf(this).body = value;
      }
    },

    withCredentials: {
      type: 'boolean',
      default: false,
      displayName: 'With Credentials',
      group: 'Request',
      set(this: NodeInstance, value: boolean) {
        internalOf(this).withCredentials = !!value;
      }
    },

    eventTypes: {
      type: 'string',
      displayName: 'Event Types',
      group: 'Connection',
      tooltip:
        'Comma-separated named event types to subscribe to. Only needed for the EventSource transport, which delivers a named event only to a listener registered in advance; the Fetch transport delivers every event type.',
      set(this: NodeInstance, value: string) {
        internalOf(this).eventTypes = value || '';
      }
    },

    textPath: {
      type: 'string',
      displayName: 'Text Path',
      group: 'Data',
      tooltip:
        'Where the text lives inside a JSON payload, as a dot path — for an OpenAI-compatible endpoint, ' +
        'choices.0.delta.content. Leave blank for a stream that sends bare text. Whatever it names ends up ' +
        'on the Text output, which is always a string.',
      set(this: NodeInstance, value: string) {
        internalOf(this).textPath = value === undefined || value === null ? '' : String(value);
        this.flagOutputDirty('text');
      }
    },

    autoConnect: {
      type: 'boolean',
      default: false,
      displayName: 'Auto Connect',
      group: 'Connection',
      set(this: NodeInstance, value: boolean) {
        internalOf(this).autoConnect = !!value;
        (this as any).scheduleAutoConnect();
      }
    },

    autoReconnect: {
      type: 'boolean',
      default: true,
      displayName: 'Auto Reconnect',
      group: 'Reconnection',
      set(this: NodeInstance, value: boolean) {
        internalOf(this).autoReconnect = !!value;
      }
    },

    reconnectOnStreamEnd: {
      type: 'boolean',
      default: false,
      displayName: 'Reconnect On Stream End',
      group: 'Reconnection',
      tooltip:
        'Reconnect when the server closes the stream cleanly. Off by default: an agent response stream is finite, and reconnecting would re-issue the request and start the response again.',
      set(this: NodeInstance, value: boolean) {
        internalOf(this).reconnectOnStreamEnd = !!value;
      }
    },

    reconnectDelay: {
      type: 'number',
      default: 1000,
      displayName: 'Reconnect Delay (ms)',
      group: 'Reconnection',
      tooltip: 'First retry delay. Doubles per consecutive failure, up to the maximum.',
      set(this: NodeInstance, value: number) {
        internalOf(this).reconnectDelay = Number(value) > 0 ? Number(value) : 1000;
      }
    },

    maxReconnectDelay: {
      type: 'number',
      default: 30000,
      displayName: 'Max Reconnect Delay (ms)',
      group: 'Reconnection',
      set(this: NodeInstance, value: number) {
        internalOf(this).maxReconnectDelay = Number(value) > 0 ? Number(value) : 30000;
      }
    },

    maxRetries: {
      type: 'number',
      default: 0,
      displayName: 'Max Retries',
      group: 'Reconnection',
      tooltip: '0 means keep retrying. Otherwise the connection reports an error after this many consecutive failures.',
      set(this: NodeInstance, value: number) {
        internalOf(this).maxRetries = Number(value) > 0 ? Number(value) : 0;
      }
    },

    dedupeById: {
      type: 'boolean',
      default: true,
      displayName: 'Dedupe By Id',
      group: 'Reconnection',
      tooltip:
        'Drop events whose id has already been seen, so a reconnect that resumes from the last event id cannot re-deliver messages. Turn off if your server reuses ids for distinct events.',
      set(this: NodeInstance, value: boolean) {
        internalOf(this).dedupeById = !!value;
      }
    },

    connect: {
      displayName: 'Connect',
      group: 'Actions',
      valueChangedToTrue(this: NodeInstance) {
        (this as any).doConnect();
      }
    },

    disconnect: {
      displayName: 'Disconnect',
      group: 'Actions',
      valueChangedToTrue(this: NodeInstance) {
        (this as any).doDisconnect();
      }
    }
  },

  outputs: {
    // --- lifecycle, shared with the WebSocket node -------------------------
    connectionState: {
      type: 'string',
      displayName: 'Connection State',
      group: 'Status',
      get(this: NodeInstance) {
        return internalOf(this).connectionState;
      }
    },
    connected: {
      type: 'boolean',
      displayName: 'Connected',
      group: 'Status',
      get(this: NodeInstance) {
        return internalOf(this).connectionState === 'open';
      }
    },
    lastError: {
      type: 'string',
      displayName: 'Last Error',
      group: 'Status',
      get(this: NodeInstance) {
        const conn = internalOf(this).connection;
        return conn ? conn.lastError : '';
      }
    },
    retryCount: {
      type: 'number',
      displayName: 'Retry Count',
      group: 'Status',
      get(this: NodeInstance) {
        return counter(this, 'retryCount');
      }
    },

    onOpen: { type: 'signal', displayName: 'On Open', group: 'Events' },
    onMessage: { type: 'signal', displayName: 'On Message', group: 'Events' },
    onError: { type: 'signal', displayName: 'On Error', group: 'Events' },
    onClose: { type: 'signal', displayName: 'On Close', group: 'Events' },

    // --- stream data ------------------------------------------------------
    data: {
      type: '*',
      displayName: 'Data',
      group: 'Data',
      get(this: NodeInstance) {
        return internalOf(this).data;
      }
    },
    raw: {
      type: 'string',
      displayName: 'Raw',
      group: 'Data',
      get(this: NodeInstance) {
        return internalOf(this).raw;
      }
    },
    /**
     * The one data output that is guaranteed to be a string.
     *
     * `data` is `parseJsonOrText`'d, which is right — a stream mixes JSON frames and bare
     * sentinels — but it means `data` is an *object* for the commonest agent shape
     * (`data: {"delta":"Hi"}`), and objects are not text. `text` is what a Text node or a
     * Text Accumulator should be wired to: the raw payload when no `textPath` is set, and
     * the field at that path when one is, with anything non-primitive (a missing field, a
     * `[DONE]` sentinel that never parsed) reported as `''` — which every consumer in this
     * family already treats as "nothing arrived" rather than appending it.
     */
    text: {
      type: 'string',
      displayName: 'Text',
      group: 'Data',
      get(this: NodeInstance) {
        const internal = internalOf(this);
        return textForPath(internal.raw, internal.data, internal.textPath);
      }
    },
    eventType: {
      type: 'string',
      displayName: 'Event Type',
      group: 'Data',
      get(this: NodeInstance) {
        return internalOf(this).eventType;
      }
    },
    lastEventId: {
      type: 'string',
      displayName: 'Last Event Id',
      group: 'Data',
      get(this: NodeInstance) {
        const conn = internalOf(this).connection;
        return conn ? conn.lastEventId : '';
      }
    },
    messageCount: {
      type: 'number',
      displayName: 'Message Count',
      group: 'Status',
      get(this: NodeInstance) {
        return counter(this, 'messageCount');
      }
    },
    lastMessageTime: {
      type: 'number',
      displayName: 'Last Message Time',
      group: 'Status',
      get(this: NodeInstance) {
        return counter(this, 'lastMessageTime');
      }
    },
    duplicatesSuppressed: {
      type: 'number',
      displayName: 'Duplicates Suppressed',
      group: 'Status',
      get(this: NodeInstance) {
        return counter(this, 'duplicatesSuppressed');
      }
    },
    deliverySemantics: {
      type: 'string',
      displayName: 'Delivery Semantics',
      group: 'Status',
      get(this: NodeInstance) {
        const conn = internalOf(this).connection;
        return conn ? conn.deliverySemantics : 'at-most-once';
      }
    }
  },

  methods: {
    /**
     * Connects once every input has landed, if `autoConnect` is on.
     *
     * Deferred rather than immediate because `url` and `autoConnect` arrive as separate
     * input writes: connecting from the `url` setter would fire a request against a
     * half-configured node, and connecting from the `autoConnect` setter would miss a
     * `url` that arrives afterwards.
     */
    scheduleAutoConnect(this: NodeInstance) {
      const internal = internalOf(this);
      if (internal.autoConnectScheduled) return;
      internal.autoConnectScheduled = true;
      this.scheduleAfterInputsHaveUpdated(function (this: NodeInstance) {
        const inner = internalOf(this);
        inner.autoConnectScheduled = false;
        if (!inner.autoConnect || !inner.url) return;
        if (inner.connection && !inner.connection.disposed) return;
        (this as any).doConnect();
      });
    },

    doConnect(this: NodeInstance) {
      const internal = internalOf(this);
      (this as any).teardownConnection();

      const options: SseConnectionOptions = {
        url: internal.url,
        transport: internal.transport,
        method: internal.method,
        headers: internal.headers || undefined,
        body: internal.body,
        withCredentials: internal.withCredentials,
        eventTypes: internal.eventTypes
          ? internal.eventTypes
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
        autoReconnect: internal.autoReconnect,
        reconnectOnStreamEnd: internal.reconnectOnStreamEnd,
        reconnectDelay: internal.reconnectDelay,
        maxReconnectDelay: internal.maxReconnectDelay,
        maxRetries: internal.maxRetries,
        dedupeById: internal.dedupeById,
        onState: (state) => (this as any).handleState(state),
        onFrame: (frame) => (this as any).handleFrame(frame),
        onError: (message) => (this as any).handleError(message),
        ...internal.seams
      };

      const connection = new SseConnection(options);
      internal.connection = connection;
      connection.connect();
    },

    doDisconnect(this: NodeInstance) {
      const connection = internalOf(this).connection;
      if (connection) connection.disconnect();
    },

    /** Releases the connection without emitting anything. Used on delete. */
    teardownConnection(this: NodeInstance) {
      const internal = internalOf(this);
      const connection = internal.connection;
      internal.connection = null;
      if (connection) connection.dispose();
    },

    handleState(this: NodeInstance, state: SseConnectionState) {
      const internal = internalOf(this);
      internal.connectionState = state;
      this.flagOutputDirty('connectionState');
      this.flagOutputDirty('connected');
      this.flagOutputDirty('retryCount');

      if (state === 'open') this.sendSignalOnOutput('onOpen');
      // 'error' is terminal, so it closes the stream from the graph's point of view
      // too — a Close handler must run whether the stream stopped cleanly or not.
      if (state === 'closed' || state === 'error') this.sendSignalOnOutput('onClose');
    },

    handleFrame(this: NodeInstance, frame: { event: string; data: string; id: string }) {
      const internal = internalOf(this);
      internal.raw = frame.data;
      internal.data = parseJsonOrText(frame.data);
      internal.eventType = frame.event;

      // Values first, signal last: `flagOutputDirty` queues the new value on every
      // connected input, and a downstream node drains that queue in insertion order —
      // so an accumulator wired `text -> chunk`, `onMessage -> add` sees the chunk
      // before the signal that consumes it.
      this.flagOutputDirty('data');
      this.flagOutputDirty('raw');
      this.flagOutputDirty('text');
      this.flagOutputDirty('eventType');
      this.flagOutputDirty('lastEventId');
      this.flagOutputDirty('messageCount');
      this.flagOutputDirty('lastMessageTime');
      this.flagOutputDirty('deliverySemantics');
      this.sendSignalOnOutput('onMessage');
    },

    handleError(this: NodeInstance, message: string) {
      this.flagOutputDirty('lastError');
      this.flagOutputDirty('retryCount');
      this.flagOutputDirty('duplicatesSuppressed');
      this.sendSignalOnOutput('onError');
    },

    _onNodeDeleted(this: NodeInstance) {
      Node.prototype._onNodeDeleted.call(this);
      (this as any).teardownConnection();
    }
  }
};

export = {
  node: SSENode
};
