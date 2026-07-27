/**
 * BYOB Realtime Connection
 *
 * WebSocket connection machinery for the Subscribe To Changes node, shaped by
 * a live probe of Directus 11 (RUN-003 slice 7):
 *
 *   → { type: 'auth', access_token }        (handshake mode: required first)
 *   ← { type: 'auth', status: 'ok' }
 *   → { type: 'subscribe', collection, uid }
 *   ← { type: 'subscription', event: 'init', data: [full records], uid }
 *   ← { type: 'subscription', event: 'create'|'update', data: [full records], uid }
 *   ← { type: 'subscription', event: 'delete', data: ['5'], uid }   ← STRING keys,
 *     even when the primary key is numeric
 *   ← { type: 'ping' }  → must answer { type: 'pong' } or the server disconnects
 *   ← { type: 'auth', status: 'error', error: { code: 'AUTH_FAILED' } } then close
 *     (a bad token AND a subscribe-without-auth both land here)
 *
 * The class takes its WebSocket implementation and timers as injectable
 * options so the whole lifecycle is unit-testable without a server.
 *
 * @module noodl-runtime
 * @since 2.0.0
 */

/** What both transports report through `onError`. */
interface RealtimeError {
  message: string;
  code?: string;
}

/** The callback contract both transports share, so the node can pick one by backend type. */
interface RealtimeCallbacks {
  /** `event` is one of `init`/`create`/`update`/`delete`/`resync`. */
  onEvent?: (event: string, records: unknown[]) => void;
  onStatus?: (subscribed: boolean) => void;
  onError?: (error: RealtimeError) => void;
}

/** A socket as this file uses one — the browser and undici shapes agree on this much. */
interface RealtimeSocket {
  onopen: ((...args: unknown[]) => void) | null;
  onmessage: ((event: { data: string }) => void) | null;
  onclose: ((...args: unknown[]) => void) | null;
  onerror: ((...args: unknown[]) => void) | null;
  send(data: string): void;
  close(): void;
  /** Set by `_handleSocketDown` so error-then-close only reconnects once. */
  _downHandled?: boolean;
}

interface RealtimeConnectionOptions extends RealtimeCallbacks {
  url: string;
  token?: string;
  collection: string;
  WebSocketImpl?: (new (url: string) => RealtimeSocket) | null;
  setTimeoutImpl?: (fn: () => void, delay: number) => unknown;
  clearTimeoutImpl?: (handle: unknown) => void;
}

interface RealtimeConnectionInstance {
  _url: string;
  _token: string;
  _collection: string;
  _onEvent: (event: string, records: unknown[]) => void;
  _onStatus: (subscribed: boolean) => void;
  _onError: (error: RealtimeError) => void;
  _WebSocket: (new (url: string) => RealtimeSocket) | null;
  _setTimeout: (fn: () => void, delay: number) => unknown;
  _clearTimeout: (handle: unknown) => void;
  _socket: RealtimeSocket | null;
  _reconnectTimer: unknown;
  _reconnectAttempts: number;
  _disposed: boolean;
  /** Set when retrying cannot help — a bad token, or no WebSocket at all. */
  _fatal: boolean;
  _subscribed: boolean;
  connect(): void;
  dispose(): void;
  _handleSocketDown(socket: RealtimeSocket): void;
  _subscribe(): void;
  _send(msg: unknown): void;
}

/**
 * The `new`-able view of {@link RealtimeConnection}.
 *
 * It stays a constructor function with prototype methods rather than becoming a `class`:
 * a class would make the methods non-enumerable and would refuse a call without `new`,
 * neither of which is a change this conversion is allowed to make.
 */
interface RealtimeConnectionConstructor {
  new (options: RealtimeConnectionOptions): RealtimeConnectionInstance;
  prototype: RealtimeConnectionInstance;
}

/** One frame arriving over the Directus WebSocket. */
interface DirectusRealtimeMessage {
  type?: string;
  status?: string;
  event?: string;
  data?: unknown[];
  error?: { message?: string; code?: string };
}

/** An EventSource as this file uses one. */
interface RealtimeEventSource {
  addEventListener(type: string, listener: (ev: { data: string }) => void): void;
  onerror: ((...args: unknown[]) => void) | null;
  close(): void;
}

interface RealtimeSSEOptions extends RealtimeCallbacks {
  baseUrl: string;
  token?: string;
  collection: string;
  filter?: unknown;
  EventSourceImpl?: (new (url: string) => RealtimeEventSource) | null;
  fetchImpl?: (url: string, init: unknown) => Promise<{ json?(): Promise<unknown> }>;
}

interface RealtimeSSEInstance {
  _baseUrl: string;
  _token: string;
  _collection: string;
  _filter?: unknown;
  _onEvent: (event: string, records: unknown[]) => void;
  _onStatus: (subscribed: boolean) => void;
  _onError: (error: RealtimeError) => void;
  _EventSource: (new (url: string) => RealtimeEventSource) | null;
  _fetch: ((url: string, init: unknown) => Promise<{ json?(): Promise<unknown> }>) | null;
  _es: RealtimeEventSource | null;
  /** Minted by the server in the first `connected` frame; scopes the subscription POST. */
  _clientId: string | null;
  _disposed: boolean;
  connect(): void;
  dispose(): void;
  _postSubscriptions(): void;
}

interface RealtimeSSEConstructor {
  new (options: RealtimeSSEOptions): RealtimeSSEInstance;
  prototype: RealtimeSSEInstance;
}

/** The `subscriptions` POST's reply. */
interface SubscriptionResult {
  accepted?: unknown[];
  rejected?: { reason?: string }[];
}

const RECONNECT_BASE_DELAY = 1000;
const RECONNECT_MAX_DELAY = 30000;

/**
 * Exponential backoff: 1s, 2s, 4s, ... capped at 30s.
 * @param {number} attempt - 0-based reconnect attempt counter
 * @returns {number} Delay in milliseconds
 */
function nextReconnectDelay(attempt: number): number {
  return Math.min(RECONNECT_MAX_DELAY, RECONNECT_BASE_DELAY * Math.pow(2, attempt));
}

/**
 * Derive the Directus WebSocket URL from a backend's HTTP base URL.
 * http://host:8055 → ws://host:8055/websocket (https → wss).
 * @param {string} baseUrl - Backend HTTP(S) base URL
 * @returns {string|null} WebSocket URL or null if the base URL is unusable
 */
function buildWebSocketUrl(baseUrl: string): string | null {
  if (!baseUrl || typeof baseUrl !== 'string') return null;

  const cleaned = baseUrl.trim().replace(/\/+$/, '');
  if (/^https:\/\//i.test(cleaned)) return cleaned.replace(/^https:/i, 'wss:') + '/websocket';
  if (/^http:\/\//i.test(cleaned)) return cleaned.replace(/^http:/i, 'ws:') + '/websocket';
  return null;
}

/**
 * A single collection subscription over the Directus WebSocket interface.
 *
 * Lifecycle: connect → (auth if token) → subscribe → 'init' confirms the
 * subscription is live. Server pings are answered with pongs. An unexpected
 * close reconnects with exponential backoff and resubscribes; the backoff
 * counter resets once a subscription is confirmed again. AUTH_FAILED is
 * fatal — retrying the same bad token would loop forever, so the connection
 * stops and reports instead (a parameter change builds a fresh connection).
 *
 * @param {Object} options
 * @param {string} options.url - WebSocket URL (from buildWebSocketUrl)
 * @param {string} options.token - Auth token ('' for public/no auth)
 * @param {string} options.collection - Collection to subscribe to
 * @param {Function} options.onEvent - (event, records) for init/create/update/delete
 * @param {Function} options.onStatus - (subscribed: boolean)
 * @param {Function} options.onError - ({ message, code? })
 * @param {Function} [options.WebSocketImpl] - Injectable WebSocket constructor
 * @param {Function} [options.setTimeoutImpl] - Injectable timer (tests)
 * @param {Function} [options.clearTimeoutImpl] - Injectable timer (tests)
 */
function RealtimeConnection(this: RealtimeConnectionInstance, options: RealtimeConnectionOptions) {
  this._url = options.url;
  this._token = options.token || '';
  this._collection = options.collection;
  this._onEvent = options.onEvent || function () {};
  this._onStatus = options.onStatus || function () {};
  this._onError = options.onError || function () {};
  // Explicit key wins even when null, so tests (and exotic hosts) can
  // represent "no WebSocket available" despite a global one existing
  this._WebSocket =
    'WebSocketImpl' in options ? options.WebSocketImpl : typeof WebSocket !== 'undefined' ? WebSocket : null;
  this._setTimeout = options.setTimeoutImpl || setTimeout.bind(globalThis);
  this._clearTimeout = options.clearTimeoutImpl || clearTimeout.bind(globalThis);

  this._socket = null;
  this._reconnectTimer = null;
  this._reconnectAttempts = 0;
  this._disposed = false;
  this._fatal = false;
  this._subscribed = false;
}

RealtimeConnection.prototype.connect = function (this: RealtimeConnectionInstance) {
  if (this._disposed || this._fatal) return;

  if (!this._WebSocket) {
    this._fatal = true;
    this._onError({ message: 'WebSocket is not available in this environment' });
    return;
  }

  let socket: RealtimeSocket;
  try {
    socket = new this._WebSocket(this._url);
  } catch (e) {
    this._fatal = true;
    this._onError({ message: 'Invalid WebSocket URL: ' + this._url });
    return;
  }

  this._socket = socket;

  socket.onopen = () => {
    if (this._disposed) return;
    if (this._token) {
      this._send({ type: 'auth', access_token: this._token });
    } else {
      // Public/no-auth backends (WEBSOCKETS_AUTH=public) subscribe directly
      this._subscribe();
    }
  };

  socket.onmessage = (event) => {
    if (this._disposed) return;

    let msg: DirectusRealtimeMessage;
    try {
      msg = JSON.parse(event.data);
    } catch (e) {
      return;
    }

    if (msg.type === 'ping') {
      this._send({ type: 'pong' });
      return;
    }

    if (msg.type === 'auth') {
      if (msg.status === 'ok') {
        this._subscribe();
      } else if (msg.status === 'error') {
        // Bad token: fatal — the server closes right after this frame, and
        // reconnecting with the same token can only fail the same way
        this._fatal = true;
        this._onError({
          message: msg.error?.message || 'Authentication failed',
          code: msg.error?.code || 'AUTH_FAILED'
        });
      }
      return;
    }

    if (msg.type === 'subscription') {
      if (msg.event === 'init') {
        this._subscribed = true;
        this._reconnectAttempts = 0;
        this._onStatus(true);
      }
      this._onEvent(msg.event, msg.data || []);
      return;
    }

    if (msg.status === 'error') {
      this._onError({
        message: msg.error?.message || 'Subscription error',
        code: msg.error?.code
      });
    }
  };

  // Browsers fire error-then-close, but Node's undici WebSocket fires ONLY
  // error when the connection fails before establishing (observed live during
  // a Directus restart) — so both events funnel into one once-per-socket
  // "socket down" handler instead of reconnect logic living on close alone.
  socket.onclose = () => this._handleSocketDown(socket);
  socket.onerror = () => this._handleSocketDown(socket);
};

RealtimeConnection.prototype._handleSocketDown = function (this: RealtimeConnectionInstance, socket: RealtimeSocket) {
  if (socket._downHandled) return;
  socket._downHandled = true;

  try {
    socket.close();
  } catch (e) {
    // Already closed, or never finished connecting
  }

  if (this._disposed) return;

  if (this._subscribed) {
    this._subscribed = false;
    this._onStatus(false);
  }

  if (this._fatal) return;

  const delay = nextReconnectDelay(this._reconnectAttempts++);
  this._reconnectTimer = this._setTimeout(() => {
    this._reconnectTimer = null;
    this.connect();
  }, delay);
};

RealtimeConnection.prototype._subscribe = function (this: RealtimeConnectionInstance) {
  this._send({ type: 'subscribe', collection: this._collection, uid: 'noodl-byob-subscribe' });
};

RealtimeConnection.prototype._send = function (this: RealtimeConnectionInstance, msg: unknown) {
  try {
    this._socket.send(JSON.stringify(msg));
  } catch (e) {
    // A racing close is handled by onclose; nothing useful to do here
  }
};

RealtimeConnection.prototype.dispose = function (this: RealtimeConnectionInstance) {
  this._disposed = true;
  if (this._reconnectTimer !== null) {
    this._clearTimeout(this._reconnectTimer);
    this._reconnectTimer = null;
  }
  if (this._socket) {
    const socket = this._socket;
    this._socket = null;
    socket.onopen = socket.onmessage = socket.onclose = socket.onerror = null;
    try {
      socket.close();
    } catch (e) {
      // Socket may already be closed or never opened
    }
  }
};

// ============================================================================
// NodeGX Backend transport — SSE (BAK-001)
// ============================================================================
//
// The NodeGX standalone backend (nodegx-backend) speaks Server-Sent Events, not
// WebSocket: GET /realtime opens a stream whose first `connected` frame carries
// a server-minted clientId; POST /realtime/subscriptions {clientId, subscriptions}
// then registers what to watch. Change frames arrive as
// `event: change` / `data: {action, collection, record}`. A `resync` frame means
// "you may have missed events — re-query" (the server keeps no replay log).
//
// This class matches RealtimeConnection's shape ({ onEvent, onStatus, onError },
// connect(), dispose()) so Subscribe To Changes can pick a transport by backend
// type without any other change. EventSource reconnects on its own; each
// reconnect yields a fresh `connected` frame, so we simply re-POST the
// subscription set every time — no manual backoff needed.

/**
 * Derive the NodeGX realtime stream URL from a backend base URL, carrying the
 * auth token as a query param (EventSource cannot set headers).
 * @param {string} baseUrl - Backend HTTP(S) base URL
 * @param {string} [token] - Session/admin/api token ('' for none)
 * @returns {string|null} Stream URL or null if the base URL is unusable
 */
function buildSSEUrl(baseUrl: string, token?: string): string | null {
  if (!baseUrl || typeof baseUrl !== 'string') return null;
  const cleaned = baseUrl.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(cleaned)) return null;
  const url = cleaned + '/realtime';
  return token ? url + '?token=' + encodeURIComponent(token) : url;
}

/**
 * A NodeGX-backend realtime subscription over SSE. Same callback contract as
 * RealtimeConnection: onEvent(event, records) with event in
 * 'create'|'update'|'delete'|'resync'; create/update carry [record];
 * delete carries [recordIdString] (matching the WebSocket transport so the
 * node's event handler is transport-agnostic).
 *
 * @param {Object} options
 * @param {string} options.baseUrl - Backend HTTP base URL
 * @param {string} options.token - Auth token ('' for none)
 * @param {string} options.collection - Collection to watch
 * @param {Object} [options.filter] - Parse-style server-side filter
 * @param {Function} options.onEvent - (event, records)
 * @param {Function} options.onStatus - (subscribed: boolean)
 * @param {Function} options.onError - ({ message, code? })
 * @param {Function} [options.EventSourceImpl] - Injectable EventSource ctor
 * @param {Function} [options.fetchImpl] - Injectable fetch (subscribe POST)
 */
function RealtimeSSEConnection(this: RealtimeSSEInstance, options: RealtimeSSEOptions) {
  this._baseUrl = options.baseUrl;
  this._token = options.token || '';
  this._collection = options.collection;
  this._filter = options.filter || undefined;
  this._onEvent = options.onEvent || function () {};
  this._onStatus = options.onStatus || function () {};
  this._onError = options.onError || function () {};
  this._EventSource =
    'EventSourceImpl' in options ? options.EventSourceImpl : typeof EventSource !== 'undefined' ? EventSource : null;
  this._fetch = options.fetchImpl || (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null);

  this._es = null;
  this._clientId = null;
  this._disposed = false;
}

RealtimeSSEConnection.prototype.connect = function (this: RealtimeSSEInstance) {
  if (this._disposed) return;

  if (!this._EventSource) {
    this._onError({ message: 'EventSource is not available in this environment' });
    return;
  }
  const url = buildSSEUrl(this._baseUrl, this._token);
  if (!url) {
    this._onError({ message: 'Backend URL is not a valid http(s) URL: ' + this._baseUrl });
    return;
  }

  let es: RealtimeEventSource;
  try {
    es = new this._EventSource(url);
  } catch (e) {
    this._onError({ message: 'Could not open realtime stream: ' + (e && e.message) });
    return;
  }
  this._es = es;

  es.addEventListener('connected', (ev) => {
    if (this._disposed) return;
    try {
      this._clientId = JSON.parse(ev.data).clientId;
    } catch (e) {
      return;
    }
    // Fresh connection (or a reconnect with a new clientId): (re)register.
    this._postSubscriptions();
  });

  es.addEventListener('change', (ev) => {
    if (this._disposed) return;
    let payload: { action?: string; record?: { objectId?: unknown } & Record<string, unknown> };
    try {
      payload = JSON.parse(ev.data);
    } catch (e) {
      return;
    }
    const action = payload.action;
    if (action === 'delete') {
      const id = payload.record && payload.record.objectId;
      this._onEvent('delete', id !== undefined && id !== null ? [String(id)] : []);
    } else if (action === 'create' || action === 'update') {
      this._onEvent(action, payload.record ? [payload.record] : []);
    }
  });

  es.addEventListener('resync', () => {
    if (this._disposed) return;
    // No replay: tell consumers to re-run their query.
    this._onEvent('resync', []);
  });

  es.onerror = () => {
    if (this._disposed) return;
    // EventSource reconnects automatically; report the transient drop. A fresh
    // 'connected' frame will re-subscribe and flip status back to true.
    this._onStatus(false);
  };
};

RealtimeSSEConnection.prototype._postSubscriptions = function (this: RealtimeSSEInstance) {
  if (this._disposed || !this._clientId) return;
  if (!this._fetch) {
    this._onError({ message: 'fetch is not available to register the realtime subscription' });
    return;
  }
  const sub: { collection: string; filter?: unknown } = { collection: this._collection };
  if (this._filter) sub.filter = this._filter;

  this._fetch(this._baseUrl.replace(/\/+$/, '') + '/realtime/subscriptions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ clientId: this._clientId, subscriptions: [sub] })
  })
    .then((res) => (res && typeof res.json === 'function' ? res.json() : null))
    .then((result: SubscriptionResult) => {
      if (this._disposed) return;
      if (result && Array.isArray(result.accepted) && result.accepted.length > 0) {
        this._onStatus(true);
      } else {
        const reason = result && result.rejected && result.rejected[0] && result.rejected[0].reason;
        this._onError({ message: 'Subscription was rejected: ' + (reason || 'unknown reason') });
      }
    })
    .catch((e) => {
      if (this._disposed) return;
      this._onError({ message: 'Could not register realtime subscription: ' + (e && e.message) });
    });
};

RealtimeSSEConnection.prototype.dispose = function (this: RealtimeSSEInstance) {
  this._disposed = true;
  if (this._es) {
    const es = this._es;
    this._es = null;
    es.onerror = null;
    try {
      es.close();
    } catch (e) {
      // Already closed
    }
  }
};

/**
 * Backend types that speak the NodeGX SSE realtime protocol rather than the
 * Directus WebSocket one. The exact type string is assigned by the editor's
 * Backend Services panel (WF-007); this list is the transport-selection seam.
 * @param {string} type - backendConfig.type
 * @returns {boolean}
 */
function isNodeGXRealtime(type: string): boolean {
  return type === 'nodegx' || type === 'nodegx-backend' || type === 'local';
}

const ByobRealtime = {
  // The construct signatures live on the interfaces above; the functions themselves are
  // plain `function`s, so the cast is what hands consumers a `new`-able, typed value.
  RealtimeConnection: RealtimeConnection as unknown as RealtimeConnectionConstructor,
  RealtimeSSEConnection: RealtimeSSEConnection as unknown as RealtimeSSEConstructor,
  buildWebSocketUrl,
  buildSSEUrl,
  isNodeGXRealtime,
  nextReconnectDelay,
  RECONNECT_BASE_DELAY,
  RECONNECT_MAX_DELAY
};

export = ByobRealtime;
