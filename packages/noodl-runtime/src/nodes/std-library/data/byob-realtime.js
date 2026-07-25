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

const RECONNECT_BASE_DELAY = 1000;
const RECONNECT_MAX_DELAY = 30000;

/**
 * Exponential backoff: 1s, 2s, 4s, ... capped at 30s.
 * @param {number} attempt - 0-based reconnect attempt counter
 * @returns {number} Delay in milliseconds
 */
function nextReconnectDelay(attempt) {
  return Math.min(RECONNECT_MAX_DELAY, RECONNECT_BASE_DELAY * Math.pow(2, attempt));
}

/**
 * Derive the Directus WebSocket URL from a backend's HTTP base URL.
 * http://host:8055 → ws://host:8055/websocket (https → wss).
 * @param {string} baseUrl - Backend HTTP(S) base URL
 * @returns {string|null} WebSocket URL or null if the base URL is unusable
 */
function buildWebSocketUrl(baseUrl) {
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
function RealtimeConnection(options) {
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

RealtimeConnection.prototype.connect = function () {
  if (this._disposed || this._fatal) return;

  if (!this._WebSocket) {
    this._fatal = true;
    this._onError({ message: 'WebSocket is not available in this environment' });
    return;
  }

  let socket;
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

    let msg;
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

RealtimeConnection.prototype._handleSocketDown = function (socket) {
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

RealtimeConnection.prototype._subscribe = function () {
  this._send({ type: 'subscribe', collection: this._collection, uid: 'noodl-byob-subscribe' });
};

RealtimeConnection.prototype._send = function (msg) {
  try {
    this._socket.send(JSON.stringify(msg));
  } catch (e) {
    // A racing close is handled by onclose; nothing useful to do here
  }
};

RealtimeConnection.prototype.dispose = function () {
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

module.exports = {
  RealtimeConnection,
  buildWebSocketUrl,
  nextReconnectDelay,
  RECONNECT_BASE_DELAY,
  RECONNECT_MAX_DELAY
};
