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

import type { NodeDefinitionOptions, NodeOutcome, OutcomeToken } from '@noodl/types';

import { outcomeOutputs } from '../../../outcome';
import type { SseInternal, SseNodeInstance } from './node-instances';
import { SseConnection, SseConnectionOptions, SseConnectionState } from './sse-connection';
import { parseJsonOrText, textForPath } from './stream-parsers';

import Node = require('../../../node');

/** The failure this node reports when a `Connect` cannot open the stream, or gives up. */
const SSE_ERROR_CONNECT_FAILED = 'sse/connect-failed';

function internalOf(node: SseNodeInstance): SseInternal {
  return node._internal;
}

/** Reads the live connection's counter, or the resting value when there is none. */
function counter(
  node: SseNodeInstance,
  key: 'retryCount' | 'messageCount' | 'duplicatesSuppressed' | 'lastMessageTime'
) {
  const conn = internalOf(node).connection;
  return conn ? conn[key] : 0;
}

const SSENode: NodeDefinitionOptions = {
  name: 'net.noodl.SSE',
  displayNodeName: 'Server-Sent Events',
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

  initialize(this: SseNodeInstance) {
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
    internal.pendingConnect = null;
    internal.seams = {};
  },

  getInspectInfo(this: SseNodeInstance) {
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
      description: 'Endpoint to stream from; changing it while connected reconnects to the new one',
      group: 'Connection',
      set(this: SseNodeInstance, value: string) {
        internalOf(this).url = value === undefined || value === null ? '' : String(value);
        this.scheduleAutoConnect();
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
      description:
        'How the stream is fetched: Fetch carries headers and a body, EventSource lets the browser handle reconnection, Auto prefers Fetch',
      group: 'Connection',
      set(this: SseNodeInstance, value: string) {
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
      description: 'HTTP method for the request; anything other than GET needs the Fetch transport',
      group: 'Request',
      set(this: SseNodeInstance, value: string) {
        internalOf(this).method = value || 'GET';
      }
    },

    headers: {
      type: 'object',
      displayName: 'Headers',
      description:
        'Request headers as an object, for bearer tokens and the like; ignored by the EventSource transport, which cannot set them',
      group: 'Request',
      set(this: SseNodeInstance, value: Record<string, string>) {
        internalOf(this).headers = value && typeof value === 'object' ? value : null;
      }
    },

    body: {
      type: '*',
      displayName: 'Body',
      description: 'Request body, sent as JSON unless it is already a string; ignored for GET and HEAD',
      group: 'Request',
      set(this: SseNodeInstance, value: unknown) {
        internalOf(this).body = value;
      }
    },

    withCredentials: {
      type: 'boolean',
      default: false,
      displayName: 'With Credentials',
      description: 'Sends cookies and HTTP auth to a cross-origin endpoint, which the server must also allow',
      group: 'Request',
      set(this: SseNodeInstance, value: boolean) {
        internalOf(this).withCredentials = !!value;
      }
    },

    eventTypes: {
      type: 'string',
      displayName: 'Event Types',
      description:
        'Comma-separated named event types to subscribe to; only needed for the EventSource transport, as Fetch delivers every type',
      group: 'Connection',
      tooltip:
        'Comma-separated named event types to subscribe to. Only needed for the EventSource transport, which delivers a named event only to a listener registered in advance; the Fetch transport delivers every event type.',
      set(this: SseNodeInstance, value: string) {
        internalOf(this).eventTypes = value || '';
      }
    },

    textPath: {
      type: 'string',
      displayName: 'Text Path',
      description:
        'Where the text lives inside a JSON payload, as a dot path such as choices.0.delta.content; leave blank for a stream of bare text',
      group: 'Data',
      tooltip:
        'Where the text lives inside a JSON payload, as a dot path — for an OpenAI-compatible endpoint, ' +
        'choices.0.delta.content. Leave blank for a stream that sends bare text. Whatever it names ends up ' +
        'on the Text output, which is always a string.',
      set(this: SseNodeInstance, value: string) {
        internalOf(this).textPath = value === undefined || value === null ? '' : String(value);
        this.flagOutputDirty('text');
      }
    },

    autoConnect: {
      type: 'boolean',
      default: false,
      displayName: 'Auto Connect',
      description: 'Opens the stream as soon as a URL is available, without waiting for a Connect signal',
      group: 'Connection',
      set(this: SseNodeInstance, value: boolean) {
        internalOf(this).autoConnect = !!value;
        this.scheduleAutoConnect();
      }
    },

    autoReconnect: {
      type: 'boolean',
      default: true,
      displayName: 'Auto Reconnect',
      description: 'Retries after a failure with a growing backoff; turning it off reports the failure and stops',
      group: 'Reconnection',
      set(this: SseNodeInstance, value: boolean) {
        internalOf(this).autoReconnect = !!value;
      }
    },

    reconnectOnStreamEnd: {
      type: 'boolean',
      default: false,
      displayName: 'Reconnect On Stream End',
      description:
        'Reconnects when the server closes the stream cleanly; off by default because reconnecting an agent stream re-issues the request',
      group: 'Reconnection',
      tooltip:
        'Reconnect when the server closes the stream cleanly. Off by default: an agent response stream is finite, and reconnecting would re-issue the request and start the response again.',
      set(this: SseNodeInstance, value: boolean) {
        internalOf(this).reconnectOnStreamEnd = !!value;
      }
    },

    reconnectDelay: {
      type: 'number',
      default: 1000,
      displayName: 'Reconnect Delay (ms)',
      description: 'First retry delay in milliseconds, doubling per consecutive failure up to Max Reconnect Delay',
      group: 'Reconnection',
      tooltip: 'First retry delay. Doubles per consecutive failure, up to the maximum.',
      set(this: SseNodeInstance, value: number) {
        internalOf(this).reconnectDelay = Number(value) > 0 ? Number(value) : 1000;
      }
    },

    maxReconnectDelay: {
      type: 'number',
      default: 30000,
      displayName: 'Max Reconnect Delay (ms)',
      description: 'Ceiling on the backoff in milliseconds, however many failures there have been',
      group: 'Reconnection',
      set(this: SseNodeInstance, value: number) {
        internalOf(this).maxReconnectDelay = Number(value) > 0 ? Number(value) : 30000;
      }
    },

    maxRetries: {
      type: 'number',
      default: 0,
      displayName: 'Max Retries',
      description: 'Consecutive failures allowed before the connection gives up and reports an error; 0 keeps retrying',
      group: 'Reconnection',
      tooltip: '0 means keep retrying. Otherwise the connection reports an error after this many consecutive failures.',
      set(this: SseNodeInstance, value: number) {
        internalOf(this).maxRetries = Number(value) > 0 ? Number(value) : 0;
      }
    },

    dedupeById: {
      type: 'boolean',
      default: true,
      displayName: 'Dedupe By Id',
      description:
        'Drops events whose id has already been seen, so a reconnect that resumes cannot re-deliver messages',
      group: 'Reconnection',
      tooltip:
        'Drop events whose id has already been seen, so a reconnect that resumes from the last event id cannot re-deliver messages. Turn off if your server reuses ids for distinct events.',
      set(this: SseNodeInstance, value: boolean) {
        internalOf(this).dedupeById = !!value;
      }
    },

    connect: {
      displayName: 'Connect',
      description: 'Opens the stream, replacing any connection already open and resetting the retry count',
      group: 'Actions',
      valueChangedToTrue(this: SseNodeInstance) {
        // ERG-001. Minted at the port and nowhere else, so `scheduleAutoConnect`'s route into
        // `doConnect` stays silent. A `Connect` fired while an earlier one is still in flight
        // supersedes it — `doConnect` tears the old request down a line later.
        this.doConnect(this.beginOutcome());
      }
    },

    disconnect: {
      displayName: 'Disconnect',
      description: 'Closes the stream and stops retrying',
      group: 'Actions',
      valueChangedToTrue(this: SseNodeInstance) {
        const outcome = this.beginOutcome();
        // A `Connect` still in flight is being cancelled, not failed. Separate invocation,
        // separate token, so both report.
        this.settleConnect('unchanged');
        // §0.3's measured entry. A `Disconnect` with no stream running used to be the silent
        // path out of this node, and a Disconnect cannot fail.
        this.reportOutcome(outcome, this.doDisconnect() ? 'done' : 'unchanged');
      }
    }
  },

  outputs: {
    // --- lifecycle, shared with the WebSocket node -------------------------
    connectionState: {
      type: 'string',
      displayName: 'Connection State',
      description: 'Where the connection is: idle, connecting, open, reconnecting, closed or error',
      group: 'Status',
      get(this: SseNodeInstance) {
        return internalOf(this).connectionState;
      }
    },
    connected: {
      type: 'boolean',
      displayName: 'Connected',
      description: 'True only while the stream is open and frames may arrive',
      group: 'Status',
      get(this: SseNodeInstance) {
        return internalOf(this).connectionState === 'open';
      }
    },
    lastError: {
      type: 'string',
      displayName: 'Last Error',
      description: 'What went wrong most recently, including the reason a retry was scheduled',
      group: 'Status',
      get(this: SseNodeInstance) {
        const conn = internalOf(this).connection;
        return conn ? conn.lastError : '';
      }
    },
    retryCount: {
      type: 'number',
      displayName: 'Retry Count',
      description: 'Consecutive failed attempts in the current outage; back to zero once the stream opens',
      group: 'Status',
      get(this: SseNodeInstance) {
        return counter(this, 'retryCount');
      }
    },

    onOpen: {
      type: 'signal',
      displayName: 'On Open',
      description: 'Fires when the stream has been established',
      group: 'Events'
    },
    onMessage: {
      type: 'signal',
      displayName: 'On Message',
      description: 'Fires once per event, after Data, Raw and Text already hold it',
      group: 'Events'
    },
    onError: {
      type: 'signal',
      displayName: 'On Error',
      description: 'Fires when the stream failed or dropped, whether or not a retry is going to follow',
      group: 'Events'
    },
    onClose: {
      type: 'signal',
      displayName: 'On Close',
      description: 'Fires when the stream has stopped for good, whether it ended cleanly or gave up',
      group: 'Events'
    },

    // --- the outcome contract ----------------------------------------------
    //
    // ERG-001, and the same shape as the WebSocket node's, because the two are meant to read
    // alike. ⚠️ These do not replace the lifecycle signals above: `On Open` says the stream is
    // up however it got there, `Done` says *this Connect* finished.
    //
    // No `Send` here, so `Unchanged` has fewer ways to happen than on the WebSocket node — but
    // it has one, and a node that can no-op gets the port.
    ...outcomeOutputs({
      done: 'Fires when the action finished: a Connect whose stream opened, or a Disconnect that stopped one',
      unchanged:
        'Fires when there was nothing to do: a Disconnect with no stream running, or a Connect ' +
        'a later Connect or Disconnect superseded before it opened',
      failure:
        'Fires when the stream could not be opened, or gave up retrying. Last Error carries the reason'
    }),

    // --- stream data ------------------------------------------------------
    data: {
      type: '*',
      displayName: 'Data',
      description: 'The event payload, parsed as JSON when it is JSON and handed over as text when it is not',
      group: 'Data',
      get(this: SseNodeInstance) {
        return internalOf(this).data;
      }
    },
    raw: {
      type: 'string',
      displayName: 'Raw',
      description: 'The event payload exactly as it arrived, before any parsing',
      group: 'Data',
      get(this: SseNodeInstance) {
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
      description:
        'The one data output guaranteed to be a string: Raw when no Text Path is set, the field at that path when one is, blank when it does not resolve',
      group: 'Data',
      get(this: SseNodeInstance) {
        const internal = internalOf(this);
        return textForPath(internal.raw, internal.data, internal.textPath);
      }
    },
    eventType: {
      type: 'string',
      displayName: 'Event Type',
      description: 'The event name the server sent, or message when it sent none',
      group: 'Data',
      get(this: SseNodeInstance) {
        return internalOf(this).eventType;
      }
    },
    lastEventId: {
      type: 'string',
      displayName: 'Last Event Id',
      description: 'The furthest id the server has reported, which is the point a reconnect resumes from',
      group: 'Data',
      get(this: SseNodeInstance) {
        const conn = internalOf(this).connection;
        return conn ? conn.lastEventId : '';
      }
    },
    messageCount: {
      type: 'number',
      displayName: 'Message Count',
      description: 'How many events have been delivered on this connection, not counting suppressed duplicates',
      group: 'Status',
      get(this: SseNodeInstance) {
        return counter(this, 'messageCount');
      }
    },
    lastMessageTime: {
      type: 'number',
      displayName: 'Last Message Time',
      description: 'When the last event arrived, as milliseconds since the epoch; useful for spotting a stalled stream',
      group: 'Status',
      get(this: SseNodeInstance) {
        return counter(this, 'lastMessageTime');
      }
    },
    duplicatesSuppressed: {
      type: 'number',
      displayName: 'Duplicates Suppressed',
      description: 'How many replayed events Dedupe By Id has dropped on this connection',
      group: 'Status',
      get(this: SseNodeInstance) {
        return counter(this, 'duplicatesSuppressed');
      }
    },
    deliverySemantics: {
      type: 'string',
      displayName: 'Delivery Semantics',
      description:
        'What this stream actually guarantees, derived from whether the server sends ids: at-most-once, at-least-once or at-least-once-deduped',
      group: 'Status',
      get(this: SseNodeInstance) {
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
     *
     * ⚠️ **A live connection is not a reason to stop.** NDA-012: this used to return early
     * whenever a connection existed and was not disposed, so a `URL` that changed — from a
     * page parameter, a variable, a Function node — left the stream pointed at the *old*
     * endpoint for the life of the node, silently. `websocket.ts`'s `rebuild()` has always
     * handled this and says why twenty lines from here: *"Silently landing on `idle` after a
     * url change is exactly the invisible failure this node is supposed to prevent."* The two
     * nodes share a port shape deliberately; they now share this behaviour too.
     *
     * The identity check is what keeps it from being the opposite bug. Every input on this
     * node schedules this pass, and reopening an agent stream re-issues the prompt, so a
     * rebuild triggered by a change to `Max Retries` would be worse than the defect it fixes.
     */
    scheduleAutoConnect(this: SseNodeInstance) {
      const internal = internalOf(this);
      if (internal.autoConnectScheduled) return;
      internal.autoConnectScheduled = true;
      this.scheduleAfterInputsHaveUpdated(function (this: SseNodeInstance) {
        const inner = internalOf(this);
        inner.autoConnectScheduled = false;

        const live = inner.connection && !inner.connection.disposed ? inner.connection : null;

        if (live) {
          // Only `url` decides *what* this node is connected to; everything else is tuning
          // and is picked up by the next connection without disturbing this one.
          if (inner.connectedUrl === inner.url) return;

          // The app had asked to be streaming, so it still wants to be — from the new
          // endpoint. `teardownConnection` is silent by design, and `doConnect` immediately
          // moves the state to `connecting`, so the graph sees the transition rather than a
          // gap.
          //
          // ERG-001: a `Connect` still in flight against the *old* url is superseded here even
          // when nothing reopens, so the settle cannot be left to `doConnect` alone.
          this.settleConnect('unchanged');
          this.teardownConnection();
          if (inner.autoConnect && inner.url) this.doConnect();
          return;
        }

        if (!inner.autoConnect || !inner.url) return;
        this.doConnect();
      });
    },

    /**
     * End the `Connect` invocation that is still waiting, if there is one.
     *
     * ERG-001. The one place the pending token is read, so "exactly one outcome per invocation"
     * is a property of this method rather than of every caller remembering to clear the slot —
     * and a no-op when nothing is pending, which is what keeps the auto-connect path silent.
     */
    settleConnect(this: SseNodeInstance, outcome: NodeOutcome, code?: string, message?: string) {
      const internal = internalOf(this);
      const token = internal.pendingConnect;
      if (!token) return;
      internal.pendingConnect = null;
      this.reportOutcome(token, outcome, outcome === 'failure' ? { code, message } : undefined);
    },

    doConnect(this: SseNodeInstance, outcome?: OutcomeToken) {
      const internal = internalOf(this);
      // A request already in flight is superseded, whether by another `Connect` or by a url
      // change — `teardownConnection` below aborts it, so it will never reach an open stream.
      // Settled *before* the new token is installed, or this would report the wrong invocation.
      this.settleConnect('unchanged');
      // Present only when an author's `Connect` port started this. `scheduleAutoConnect` and
      // the url-change rebuild pass nothing, and so report nothing.
      internal.pendingConnect = outcome || null;
      this.teardownConnection();

      // The endpoint this connection was opened against, so a later `URL` change can be told
      // from a change to one of the tuning inputs. Recorded here rather than read off the
      // connection because `SseConnectionOptions.url` is a copy taken at construction.
      internal.connectedUrl = internal.url;

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
        onState: (state) => this.handleState(state),
        onFrame: (frame) => this.handleFrame(frame),
        onError: (message) => this.handleError(message),
        ...internal.seams
      };

      const connection = new SseConnection(options);
      internal.connection = connection;
      connection.connect();
    },

    /** @returns whether there was a stream to stop — `Done` versus `Unchanged`. */
    doDisconnect(this: SseNodeInstance): boolean {
      const connection = internalOf(this).connection;
      return connection ? connection.disconnect() : false;
    },

    /** Releases the connection without emitting anything. Used on delete. */
    teardownConnection(this: SseNodeInstance) {
      const internal = internalOf(this);
      const connection = internal.connection;
      internal.connection = null;
      if (connection) connection.dispose();
    },

    handleState(this: SseNodeInstance, state: SseConnectionState) {
      const internal = internalOf(this);
      internal.connectionState = state;
      this.flagOutputDirty('connectionState');
      this.flagOutputDirty('connected');
      this.flagOutputDirty('retryCount');

      if (state === 'open') this.sendSignalOnOutput('onOpen');
      // 'error' is terminal, so it closes the stream from the graph's point of view
      // too — a Close handler must run whether the stream stopped cleanly or not.
      if (state === 'closed' || state === 'error') this.sendSignalOnOutput('onClose');

      // ERG-001. The two terminal states of a `Connect`, and the outcome goes last — after the
      // status values and after the lifecycle signal they belong to.
      //
      // ⚠️ `'reconnecting'` is deliberately not one of them: a first attempt that failed and a
      // retry that then opens is one `Done`, not a `Failure` followed by a `Done`. The token
      // rides the whole outage. ⚠️ `'closed'` is not one either — a stream the server ended
      // cleanly opened first, so its `Connect` already reported `Done`.
      if (state === 'open') this.settleConnect('done');
      if (state === 'error') {
        const conn = internalOf(this).connection;
        this.settleConnect(
          'failure',
          SSE_ERROR_CONNECT_FAILED,
          (conn && conn.lastError) || 'The stream could not be opened'
        );
      }
    },

    handleFrame(this: SseNodeInstance, frame: { event: string; data: string; id: string }) {
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

    handleError(this: SseNodeInstance, message: string) {
      this.flagOutputDirty('lastError');
      this.flagOutputDirty('retryCount');
      this.flagOutputDirty('duplicatesSuppressed');
      this.sendSignalOnOutput('onError');
    },

    _onNodeDeleted(this: SseNodeInstance) {
      Node.prototype._onNodeDeleted.call(this);
      this.teardownConnection();
      // ⚠️ A `Connect` still pending here reports nothing, and there is nowhere for it to
      // report to: the node is gone and every wire off it with it. The navigation exception's
      // shape, not a silent path inside a live graph.
      const internal = internalOf(this);
      if (internal) internal.pendingConnect = null;
    }
  }
};

export = {
  node: SSENode
};
