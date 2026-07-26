/**
 * WebSocket connection state machine (AGENT-002 / AIX-005).
 *
 * The transport half of the WebSocket node. It is a plain class rather than
 * part of the node definition for the same reason `byob-realtime.js` is: the
 * lifecycle — reconnection, backoff, heartbeat, send queueing, teardown — is
 * the part that has to be tested exhaustively, and it can only be tested if
 * the socket and the timers come in through the door.
 *
 * Everything external is injectable. The defaults reach for the platform
 * globals, so in a browser the caller passes nothing; in the runtime's Jest
 * environment (`testEnvironment: 'node'`, no global `WebSocket`) the tests pass
 * a fake socket and a fake clock and drive every transition by hand.
 *
 * ## Delivery semantics — read this before relying on the node
 *
 * These are the guarantees the implementation actually makes, not the ones a
 * message broker would make. RFC 6455 has no per-message acknowledgement and
 * no session resume, so a WebSocket client cannot honestly promise more:
 *
 * - **Ordering is FIFO, always.** Queued messages flush in the order they were
 *   submitted, and the flush happens inside the `open` handler before control
 *   returns to the graph, so a queued message can never overtake one sent after
 *   the connection came back.
 * - **Never duplicated.** Nothing that has been handed to `socket.send()` is
 *   ever handed to another socket. A retransmission would be a duplicate and we
 *   have no way to know whether one is needed, so we do not retransmit.
 * - **Loss is possible, and is not always attributable.** `socket.send()` on an
 *   open socket only buffers the frame; if the connection dies before the frame
 *   leaves, the message is gone and the API gives us no way to find out which
 *   messages those were. The connection going to `reconnecting` is the signal
 *   that this may have happened. Applications that cannot tolerate it need
 *   their own acknowledgements — that is a protocol decision, not something
 *   this node can paper over.
 * - **Queued messages are delivered exactly once, or counted.** A message that
 *   is still in the queue has never touched a socket, so it is sent exactly
 *   once on the next open. If it is discarded instead — queue full, or the node
 *   was deleted — it is counted in `droppedCount`.
 * - **Received messages are never de-duplicated and never replayed.** A
 *   reconnect opens a *new* WebSocket session; whether the server repeats
 *   anything is entirely the server's choice. Because a gap is invisible from
 *   here, the node fires a distinct `onReconnect` signal on every open after
 *   the first — the app's cue to re-fetch state rather than assume continuity.
 *   This mirrors the `resync` frame the NodeGX backend's SSE transport sends
 *   (BAK-001), which exists for exactly the same reason.
 *
 * @module noodl-runtime
 * @since 2.0.0
 */

/** Connection state, as the node publishes it on the `connectionState` output. */
export type WebSocketConnectionState = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed' | 'error';

/** What happens to a `send` that arrives while the socket is not open. */
export type SendWhenDisconnected = 'queue' | 'drop' | 'error';

/** How the outgoing payload is turned into a frame. */
export type MessageEncoding = 'auto' | 'text' | 'binary';

/** The `close` event, as much of it as this class reads. */
export interface WebSocketCloseEventLike {
  code?: number;
  reason?: string;
  wasClean?: boolean;
}

/** The `message` event, as much of it as this class reads. */
export interface WebSocketMessageEventLike {
  data: unknown;
}

/**
 * The structural shape of a WebSocket, declared here rather than taken from the
 * DOM lib so the module compiles and runs where no DOM exists.
 */
export interface WebSocketLike {
  binaryType?: string;
  readyState?: number;
  bufferedAmount?: number;
  onopen: ((event?: unknown) => void) | null;
  onmessage: ((event: WebSocketMessageEventLike) => void) | null;
  onerror: ((event?: unknown) => void) | null;
  onclose: ((event?: WebSocketCloseEventLike) => void) | null;
  send(data: unknown): void;
  close(code?: number, reason?: string): void;
}

export type WebSocketConstructorLike = new (url: string, protocols?: string | string[]) => WebSocketLike;

/** Tuning knobs. Every one of them maps to an input port on the node. */
export interface WebSocketConnectionConfig {
  url?: string;
  protocols?: string[];

  autoReconnect?: boolean;
  reconnectDelay?: number;
  maxReconnectDelay?: number;
  /** Attempts allowed per outage. Negative means unlimited; `0` means none. */
  maxRetries?: number;
  jitter?: boolean;

  /** `0` (the default) disables the heartbeat entirely. */
  heartbeatInterval?: number;
  heartbeatMessage?: string;
  /** Empty disables both latency measurement and dead-connection detection. */
  heartbeatReply?: string;

  sendWhenDisconnected?: SendWhenDisconnected;
  /** `0` or negative means unlimited, which is not recommended. */
  maxQueueSize?: number;
  messageEncoding?: MessageEncoding;
}

/** What the connection tells its owner about. */
export interface WebSocketConnectionCallbacks {
  /**
   * Any observable status field changed. Coarse on purpose: the node responds
   * by flagging all of its status outputs dirty, which costs nothing and
   * removes a whole class of "forgot to flag that one" bugs.
   */
  onStatus?(): void;
  /** The socket opened. `isReconnect` is false only for the very first open. */
  onOpen?(isReconnect: boolean): void;
  onMessage?(value: unknown, raw: string, isBinary: boolean): void;
  /** Something went wrong. `lastError` already carries the same text. */
  onError?(message: string): void;
  onClose?(code: number, reason: string, willReconnect: boolean): void;
  /** A message was handed to the socket. Not fired for heartbeats. */
  onSent?(value: unknown): void;
}

/** The seams. Tests replace all of these; browsers replace none of them. */
export interface WebSocketConnectionSeams {
  /**
   * Explicit key wins even when null, so a test (or an exotic host) can say
   * "there is no WebSocket here" despite a global one existing. Same trick
   * `byob-realtime.js` uses.
   */
  WebSocketImpl?: WebSocketConstructorLike | null;
  setTimeoutImpl?(handler: () => void, timeout: number): unknown;
  clearTimeoutImpl?(handle: unknown): void;
  nowImpl?(): number;
  randomImpl?(): number;
}

export type WebSocketConnectionOptions = WebSocketConnectionConfig &
  WebSocketConnectionCallbacks &
  WebSocketConnectionSeams;

export const DEFAULT_RECONNECT_DELAY = 1000;
export const DEFAULT_MAX_RECONNECT_DELAY = 30000;
export const DEFAULT_MAX_RETRIES = 10;
export const DEFAULT_MAX_QUEUE_SIZE = 100;

/** Code reported when the socket died without a close frame (or errored). */
const CLOSE_CODE_ABNORMAL = 1006;

/**
 * Close codes where reconnecting cannot possibly help: the client and server
 * disagree about the protocol, the payload or the policy, so the next attempt
 * fails identically and a retry loop is pure noise. Same reasoning as the
 * `AUTH_FAILED` fatal case in `byob-realtime.js`.
 *
 * Deliberately *not* in the list: 1000/1001 (see `shouldReconnectAfter`), 1006
 * (the ordinary network drop), 1011/1012/1013 (server-side trouble, which is
 * exactly what backoff is for), and the 4000–4999 application range, whose
 * meaning is defined by the server and unknowable from here.
 */
const FATAL_CLOSE_CODES = [1002, 1003, 1007, 1008, 1009, 1010, 1015];

/**
 * Whether an unsolicited close should be retried.
 *
 * Note what this deliberately does *not* consult: `event.wasClean`. That flag
 * is true for any completed closing handshake — including a server saying
 * goodbye at an idle timeout, which is the single most common case where an
 * app author wants reconnection — and false for the ordinary 1006 network drop.
 * Gating reconnection on it, as the phase-3.5 draft did, fires the feature in
 * roughly the least useful subset of cases. So instead: retry anything the
 * client did not ask for, except the codes where retrying is provably futile.
 */
export function isFatalCloseCode(code: number): boolean {
  return FATAL_CLOSE_CODES.indexOf(code) !== -1;
}

/**
 * Backoff delay for attempt `attempt` (0-based).
 *
 * `base * 2^attempt`, capped at `max`, then — with jitter on — scaled into
 * [50%, 100%] of that. Equal jitter rather than full jitter: it keeps a fleet
 * of clients from returning in lockstep after a server restart without ever
 * making the retry arrive sooner than half the intended backoff.
 */
export function nextReconnectDelay(
  attempt: number,
  base: number,
  max: number,
  jitter: boolean,
  random: () => number
): number {
  const safeBase = base > 0 ? base : DEFAULT_RECONNECT_DELAY;
  const safeMax = max > 0 ? max : DEFAULT_MAX_RECONNECT_DELAY;
  // 2^attempt overflows to Infinity well before attempt 1024; Math.min still
  // does the right thing, but clamp the exponent so the arithmetic stays finite.
  const exponent = Math.min(attempt, 30);
  const raw = Math.min(safeMax, safeBase * Math.pow(2, exponent));
  if (!jitter) return Math.round(raw);
  return Math.round(raw * (0.5 + 0.5 * random()));
}

/** True for values a WebSocket can send as a binary frame unchanged. */
function isBinaryPayload(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof ArrayBuffer !== 'undefined') {
    if (value instanceof ArrayBuffer) return true;
    if (ArrayBuffer.isView(value)) return true;
  }
  if (typeof Blob !== 'undefined' && value instanceof Blob) return true;
  return false;
}

/** Text form of an outgoing value: strings pass through, objects become JSON. */
function toText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/**
 * Parse a received text frame if it is JSON, otherwise hand back the string.
 *
 * Note the consequence, which is intended but worth knowing: a frame whose
 * whole body is `null`, `12` or `true` is valid JSON and arrives as that value
 * rather than as those characters.
 */
function parseIncoming(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (e) {
    return text;
  }
}

/**
 * One WebSocket connection, with its reconnection, heartbeat and send-queue
 * policy.
 *
 * Lifecycle:
 *
 * ```
 *   idle ──connect()──▶ connecting ──open──▶ open
 *                           │                 │
 *                    (open fails)      (socket down, unsolicited)
 *                           │                 │
 *                           ▼                 ▼
 *                     reconnecting ◀──────────┘   (autoReconnect, retryable,
 *                           │                      retries not exhausted)
 *                     ┌─────┴─────┐
 *                  open           error          (fatal code, retries spent,
 *                                                 or autoReconnect off)
 *
 *   any state ──disconnect()──▶ closed
 * ```
 *
 * `reconnecting` spans the whole outage — from the moment the connection is
 * lost, across the backoff wait and every attempt, until one succeeds. It does
 * not flicker back to `connecting` per attempt, because "we lost it and we are
 * working on it" is the thing an app author needs to render, and `retryCount`
 * already says how hard we are working.
 */
export class WebSocketConnection {
  // ── observable status; the node's output getters read these ────────────────
  state: WebSocketConnectionState = 'idle';
  connected = false;
  /** Attempts made during the current outage. Reset on open and on connect(). */
  retryCount = 0;
  lastError = '';
  queueSize = 0;
  /** Messages discarded rather than sent, since the node was created. */
  droppedCount = 0;
  /** Last measured heartbeat round-trip, in ms. `0` until measured. */
  latency = 0;
  closeCode = 0;
  closeReason = '';

  private _config: WebSocketConnectionConfig;
  private _callbacks: WebSocketConnectionCallbacks;

  private _WebSocket: WebSocketConstructorLike | null;
  private _setTimeout: (handler: () => void, timeout: number) => unknown;
  private _clearTimeout: (handle: unknown) => void;
  private _now: () => number;
  private _random: () => number;

  private _socket: WebSocketLike | null = null;
  private _reconnectTimer: unknown = null;
  private _heartbeatTimer: unknown = null;
  /** Set while a heartbeat is awaiting its reply; `0` when nothing is pending. */
  private _pendingPingAt = 0;
  private _queue: unknown[] = [];
  private _disposed = false;
  /** True between `disconnect()` and the resulting teardown. */
  private _intentionalClose = false;
  /** False until the first successful open; drives `isReconnect`. */
  private _hasEverOpened = false;

  constructor(options: WebSocketConnectionOptions = {}) {
    this._config = {
      url: options.url || '',
      protocols: options.protocols || [],
      autoReconnect: options.autoReconnect !== false,
      reconnectDelay: options.reconnectDelay !== undefined ? options.reconnectDelay : DEFAULT_RECONNECT_DELAY,
      maxReconnectDelay:
        options.maxReconnectDelay !== undefined ? options.maxReconnectDelay : DEFAULT_MAX_RECONNECT_DELAY,
      maxRetries: options.maxRetries !== undefined ? options.maxRetries : DEFAULT_MAX_RETRIES,
      jitter: options.jitter !== false,
      heartbeatInterval: options.heartbeatInterval || 0,
      heartbeatMessage: options.heartbeatMessage !== undefined ? options.heartbeatMessage : 'ping',
      heartbeatReply: options.heartbeatReply !== undefined ? options.heartbeatReply : 'pong',
      sendWhenDisconnected: options.sendWhenDisconnected || 'queue',
      maxQueueSize: options.maxQueueSize !== undefined ? options.maxQueueSize : DEFAULT_MAX_QUEUE_SIZE,
      messageEncoding: options.messageEncoding || 'auto'
    };

    this._callbacks = {
      onStatus: options.onStatus,
      onOpen: options.onOpen,
      onMessage: options.onMessage,
      onError: options.onError,
      onClose: options.onClose,
      onSent: options.onSent
    };

    this._WebSocket =
      'WebSocketImpl' in options
        ? options.WebSocketImpl
        : typeof WebSocket !== 'undefined'
        ? (WebSocket as unknown as WebSocketConstructorLike)
        : null;
    this._setTimeout = options.setTimeoutImpl || ((fn, ms) => setTimeout(fn, ms));
    this._clearTimeout = options.clearTimeoutImpl || ((handle) => clearTimeout(handle as never));
    this._now = options.nowImpl || (() => Date.now());
    this._random = options.randomImpl || (() => Math.random());
  }

  // ── configuration ─────────────────────────────────────────────────────────

  /**
   * Update tuning parameters on a live connection.
   *
   * Only the knobs that do not change the connection's identity belong here —
   * `url` and `protocols` decide *what* we are connected to, so the node
   * rebuilds the whole connection for those rather than mutating this one.
   */
  configure(config: WebSocketConnectionConfig): void {
    const previousHeartbeat = this._config.heartbeatInterval;
    Object.keys(config).forEach((key) => {
      const value = (config as Record<string, unknown>)[key];
      if (value !== undefined) (this._config as Record<string, unknown>)[key] = value;
    });

    // A new heartbeat interval takes effect immediately rather than after the
    // current one elapses, which is what an author changing it expects to see.
    if (this._config.heartbeatInterval !== previousHeartbeat && this.state === 'open') {
      this._startHeartbeat();
    }
  }

  getConfig(): Readonly<WebSocketConnectionConfig> {
    return this._config;
  }

  // ── lifecycle ─────────────────────────────────────────────────────────────

  /**
   * Open (or reopen) the connection.
   *
   * Called both by the app — a `Connect` signal, or auto-connect — and by the
   * reconnect timer. `isRetry` distinguishes them: an app-initiated connect is
   * a fresh intent, so it resets the retry counter and the state, while a retry
   * stays in `reconnecting` and keeps counting.
   *
   * Connecting while already open replaces the socket. The old one is torn down
   * without an `onClose` signal, because the app asked for the replacement — it
   * is not a connection failure and reporting it as one would train authors to
   * ignore the signal.
   */
  connect(isRetry = false): void {
    if (this._disposed) return;

    this._clearReconnectTimer();
    this._stopHeartbeat();
    this._teardownSocket();
    this._intentionalClose = false;

    if (!isRetry) {
      this.retryCount = 0;
    }

    if (!this._WebSocket) {
      this._fail('WebSocket is not available in this environment');
      return;
    }

    const url = (this._config.url || '').trim();
    if (!url) {
      this._fail('URL is required to connect');
      return;
    }
    if (!/^wss?:\/\//i.test(url)) {
      this._fail('URL must start with ws:// or wss:// — got: ' + url);
      return;
    }

    this.state = isRetry ? 'reconnecting' : 'connecting';
    this.connected = false;
    this.closeCode = 0;
    this.closeReason = '';
    this._emitStatus();

    const protocols = this._config.protocols && this._config.protocols.length ? this._config.protocols : undefined;

    let socket: WebSocketLike;
    try {
      socket = new this._WebSocket(url, protocols);
    } catch (e) {
      // A constructor throw is a permanent problem with the url or the
      // subprotocol list, not a transient one — retrying is futile.
      this._fail('Could not open WebSocket: ' + this._describe(e));
      return;
    }

    this._socket = socket;

    // ArrayBuffer is far more useful to a node graph than the spec's default
    // Blob, which cannot be read synchronously. Guarded because not every
    // implementation exposes the property.
    try {
      if ('binaryType' in socket) socket.binaryType = 'arraybuffer';
    } catch (e) {
      // Read-only or unsupported; received binary just arrives in whatever
      // form the implementation prefers.
    }

    socket.onopen = () => this._handleOpen(socket);
    socket.onmessage = (event) => this._handleMessage(socket, event);
    // Browsers fire error-then-close, but Node's undici WebSocket fires *only*
    // error when the connection never establishes (observed live in RUN-003).
    // Both funnel into one once-per-socket handler so neither host duplicates
    // nor skips the reconnect decision.
    socket.onerror = () => this._handleSocketError(socket);
    socket.onclose = (event) => this._handleSocketDown(socket, event);
  }

  /**
   * Close the connection at the app's request.
   *
   * Cancels any pending reconnect — a manual disconnect is a statement that we
   * should stop trying, and the phase-3.5 draft's own checklist calls this out.
   * Teardown is done inline rather than waiting for the `close` event, so the
   * node reaches `closed` deterministically even if the socket never fires one
   * (a socket still in CONNECTING is the case that bites).
   */
  disconnect(): void {
    if (this._disposed) return;

    this._clearReconnectTimer();
    this._stopHeartbeat();

    // A live socket, or a backoff wait we are cancelling. Deliberately excludes
    // `idle`/`closed`/`error`, so disconnecting twice does not emit On Close
    // twice.
    const hadSomethingToClose =
      this._socket !== null ||
      this.state === 'connecting' ||
      this.state === 'reconnecting' ||
      this.state === 'open';
    this._intentionalClose = true;
    this._teardownSocket(1000, 'Client disconnect');

    this.connected = false;
    this.retryCount = 0;
    this.closeCode = 1000;
    this.closeReason = 'Client disconnect';

    if (!hadSomethingToClose) {
      // Never connected and not trying to: nothing happened, so say nothing.
      this.state = 'closed';
      this._emitStatus();
      return;
    }

    this.state = 'closed';
    this._emitStatus();
    this._invoke(() => this._callbacks.onClose && this._callbacks.onClose(1000, 'Client disconnect', false));
  }

  /**
   * Release everything. Called from the node's `_onNodeDeleted`, which is what
   * runs when a component unmounts or the user navigates away.
   *
   * Fires no callbacks: the node is gone, its outputs are unreadable, and a
   * signal emitted into a deleted graph is at best wasted work.
   */
  dispose(): void {
    if (this._disposed) return;
    this._disposed = true;

    this._clearReconnectTimer();
    this._stopHeartbeat();
    this._teardownSocket(1000, 'Node deleted');

    // Anything still queued is never going to be sent; count it so the number
    // is right if something does read it before teardown completes.
    this.droppedCount += this._queue.length;
    this._queue = [];
    this.queueSize = 0;
    this.connected = false;
    this.state = 'closed';
  }

  get isDisposed(): boolean {
    return this._disposed;
  }

  // ── sending ───────────────────────────────────────────────────────────────

  /**
   * Send `value`, or apply the send-while-disconnected policy.
   *
   * Returns whether the value reached a socket. Everything that did not is
   * either in the queue (`queueSize`) or counted as lost (`droppedCount`) —
   * there is no third, invisible outcome.
   */
  send(value: unknown): boolean {
    if (this._disposed) return false;

    if (value === undefined || value === null) {
      // Almost always a wiring mistake, and the phase-3.5 draft returned
      // silently here. Say so instead.
      this._reportError('Nothing to send: the Message input is empty');
      return false;
    }

    if (this.state !== 'open' || !this._socket) {
      switch (this._config.sendWhenDisconnected) {
        case 'drop':
          // The requested behaviour, so not an error — but still counted, so
          // "where did my messages go" has an answer on the canvas.
          this.droppedCount++;
          this._emitStatus();
          return false;

        case 'error':
          this.droppedCount++;
          this._reportError('Cannot send: the connection is not open (state: ' + this.state + ')');
          return false;

        case 'queue':
        default: {
          const limit = this._config.maxQueueSize;
          if (limit > 0 && this._queue.length >= limit) {
            // Refuse the newest rather than evicting the oldest: the queue is
            // an ordered prefix of what the app tried to say, and a prefix that
            // stops is far easier to reason about than one with a hole in the
            // middle. It also makes the loss attributable to a specific send.
            this.droppedCount++;
            this._reportError('Send queue is full (' + limit + ' messages); this message was dropped');
            return false;
          }
          this._queue.push(value);
          this.queueSize = this._queue.length;
          this._emitStatus();
          return false;
        }
      }
    }

    return this._sendNow(value, true);
  }

  /** Hand a value straight to the socket. Assumes the socket is open. */
  private _sendNow(value: unknown, notify: boolean): boolean {
    let frame: unknown;
    try {
      frame = this._encode(value);
    } catch (e) {
      this.droppedCount++;
      this._reportError('Could not encode the message: ' + this._describe(e));
      return false;
    }

    try {
      this._socket.send(frame);
    } catch (e) {
      // Usually InvalidStateError from a socket that has just closed. The close
      // handler will deal with the connection; here we only record the loss.
      this.droppedCount++;
      this._reportError('Send failed: ' + this._describe(e));
      return false;
    }

    if (notify) {
      this._invoke(() => this._callbacks.onSent && this._callbacks.onSent(value));
    }
    return true;
  }

  private _encode(value: unknown): unknown {
    // Something already binary is sent as-is whatever the encoding says —
    // re-encoding an ArrayBuffer as text would only corrupt it.
    if (isBinaryPayload(value)) return value;

    if (this._config.messageEncoding === 'binary') {
      if (typeof TextEncoder === 'undefined') {
        throw new Error('binary encoding needs TextEncoder, which this environment does not provide');
      }
      return new TextEncoder().encode(toText(value));
    }

    return toText(value);
  }

  /**
   * Drain the queue into a freshly opened socket, in order.
   *
   * A failing send is put back at the front rather than discarded, which is
   * what keeps the exactly-once promise for queued messages: it never reached
   * the wire, so it is still owed.
   */
  private _flushQueue(): void {
    if (this._queue.length === 0) return;

    while (this._queue.length > 0 && this.state === 'open' && this._socket) {
      const value = this._queue.shift();
      if (!this._sendNow(value, true)) {
        this._queue.unshift(value);
        break;
      }
    }

    this.queueSize = this._queue.length;
    this._emitStatus();
  }

  /** Queue contents, for assertions. Not used by the node. */
  peekQueue(): unknown[] {
    return this._queue.slice();
  }

  // ── socket event handling ─────────────────────────────────────────────────

  private _handleOpen(socket: WebSocketLike): void {
    if (this._disposed || socket !== this._socket) return;

    const isReconnect = this._hasEverOpened;
    this._hasEverOpened = true;

    this.state = 'open';
    this.connected = true;
    this.retryCount = 0;
    this.lastError = '';
    this.closeCode = 0;
    this.closeReason = '';
    this._emitStatus();

    this._invoke(() => this._callbacks.onOpen && this._callbacks.onOpen(isReconnect));

    this._startHeartbeat();
    // After onOpen, so an app that authenticates in its open handler has sent
    // its credentials before the backlog arrives.
    this._flushQueue();
  }

  private _handleMessage(socket: WebSocketLike, event: WebSocketMessageEventLike): void {
    if (this._disposed || socket !== this._socket) return;

    const data = event && event.data;
    const isBinary = typeof data !== 'string';

    if (!isBinary) {
      const text = data as string;
      // Only filter when the heartbeat is actually running: with it off, a
      // server whose protocol happens to use the word "pong" must still see it
      // delivered. The reply marker keeps its default so that turning the
      // heartbeat on needs one input, not three.
      const reply = this._config.heartbeatInterval > 0 ? this._config.heartbeatReply : '';
      if (reply && text === reply) {
        // A heartbeat reply is transport bookkeeping, not application data, so
        // it updates latency and is swallowed rather than emitted.
        if (this._pendingPingAt) {
          this.latency = Math.max(0, this._now() - this._pendingPingAt);
          this._pendingPingAt = 0;
          this._emitStatus();
        }
        return;
      }

      this._invoke(() => this._callbacks.onMessage && this._callbacks.onMessage(parseIncoming(text), text, false));
      return;
    }

    this._invoke(() => this._callbacks.onMessage && this._callbacks.onMessage(data, '', true));
  }

  private _handleSocketError(socket: WebSocketLike): void {
    if (socket !== this._socket) return;

    // The browser event carries no detail by design (to avoid leaking
    // cross-origin information), so the message says what we can actually know.
    const message = this._hasEverOpened
      ? 'WebSocket connection error'
      : 'Could not connect to ' + (this._config.url || '(no url)');

    if (!this._disposed) {
      this.lastError = message;
      this._invoke(() => this._callbacks.onError && this._callbacks.onError(message));
    }

    this._handleSocketDown(socket, { code: CLOSE_CODE_ABNORMAL, reason: message, wasClean: false });
  }

  /**
   * The one place a socket's death is processed, whichever event announced it.
   * Guarded per socket so error-then-close does not run it twice.
   */
  private _handleSocketDown(socket: WebSocketLike, event?: WebSocketCloseEventLike): void {
    if (!socket) return;
    const tagged = socket as WebSocketLike & { __nodegxDownHandled?: boolean };
    if (tagged.__nodegxDownHandled) return;
    tagged.__nodegxDownHandled = true;

    this._detach(socket);
    try {
      socket.close();
    } catch (e) {
      // Already closed, or never finished connecting.
    }

    // A socket we have already replaced or torn down has nothing to say about
    // the current connection.
    if (socket !== this._socket) return;
    this._socket = null;

    this._stopHeartbeat();
    if (this._disposed) return;

    const code = event && typeof event.code === 'number' ? event.code : CLOSE_CODE_ABNORMAL;
    const reason = (event && event.reason) || '';

    this.connected = false;
    this.closeCode = code;
    this.closeReason = reason;

    if (this._intentionalClose) {
      // disconnect() owns the state transition and the onClose signal.
      return;
    }

    const willReconnect = this._shouldReconnect(code);

    if (willReconnect) {
      const delay = nextReconnectDelay(
        this.retryCount,
        this._config.reconnectDelay,
        this._config.maxReconnectDelay,
        this._config.jitter,
        this._random
      );
      this.retryCount++;
      this.state = 'reconnecting';
      this.lastError = this._describeClose(code, reason) + '; reconnecting in ' + delay + 'ms';
      this._emitStatus();
      this._invoke(() => this._callbacks.onClose && this._callbacks.onClose(code, reason, true));

      this._reconnectTimer = this._setTimeout(() => {
        this._reconnectTimer = null;
        this.connect(true);
      }, delay);
      return;
    }

    // Not reconnecting. Whether that is an error depends on whether we wanted
    // to stay connected: a server saying a clean goodbye with reconnection
    // switched off is `closed`, everything else is `error` — and must be loud,
    // because a connection that quietly stopped working is the failure mode
    // this whole node exists to prevent.
    const wasGracefulGoodbye = code === 1000 || code === 1001;
    if (wasGracefulGoodbye && !this._config.autoReconnect) {
      this.state = 'closed';
      this._emitStatus();
      this._invoke(() => this._callbacks.onClose && this._callbacks.onClose(code, reason, false));
      return;
    }

    this.state = 'error';
    const why = isFatalCloseCode(code)
      ? this._describeClose(code, reason) + '; this will not be retried'
      : !this._config.autoReconnect
      ? this._describeClose(code, reason) + '; Auto Reconnect is off'
      : this._describeClose(code, reason) + '; gave up after ' + this.retryCount + ' reconnect attempts';
    this.lastError = why;
    this._emitStatus();
    this._invoke(() => this._callbacks.onError && this._callbacks.onError(why));
    this._invoke(() => this._callbacks.onClose && this._callbacks.onClose(code, reason, false));
  }

  private _shouldReconnect(code: number): boolean {
    if (!this._config.autoReconnect) return false;
    if (isFatalCloseCode(code)) return false;
    const max = this._config.maxRetries;
    if (max < 0) return true;
    return this.retryCount < max;
  }

  // ── heartbeat ─────────────────────────────────────────────────────────────

  /**
   * Start (or restart) the heartbeat. A self-rescheduling timeout rather than
   * an interval, so the class needs one timer primitive instead of two and a
   * leak assertion has one thing to check.
   */
  private _startHeartbeat(): void {
    this._stopHeartbeat();
    this._pendingPingAt = 0;

    const interval = this._config.heartbeatInterval;
    if (!interval || interval <= 0) return;

    this._heartbeatTimer = this._setTimeout(() => this._onHeartbeat(), interval);
  }

  private _onHeartbeat(): void {
    this._heartbeatTimer = null;
    if (this._disposed || this.state !== 'open' || !this._socket) return;

    const reply = this._config.heartbeatReply;

    // Dead-connection detection: the previous heartbeat is still unanswered a
    // whole interval later, so the socket is open in name only. TCP can hold a
    // half-open connection for minutes, which is exactly the silent failure the
    // phase-3.5 checklist wants caught. Only possible when a reply marker is
    // configured — without one there is nothing to be unanswered.
    if (reply && this._pendingPingAt) {
      const waited = this._now() - this._pendingPingAt;
      this._pendingPingAt = 0;
      const message = 'Heartbeat went unanswered for ' + waited + 'ms; treating the connection as dead';
      this.lastError = message;
      this._invoke(() => this._callbacks.onError && this._callbacks.onError(message));
      // Runs the ordinary unsolicited-close path, so backoff and retry limits
      // apply exactly as they do to a real drop.
      this._handleSocketDown(this._socket, { code: CLOSE_CODE_ABNORMAL, reason: message, wasClean: false });
      return;
    }

    const message = this._config.heartbeatMessage;
    if (message) {
      // notify: false — a heartbeat is not an application message and must not
      // fire On Message Sent.
      if (this._sendNow(message, false) && reply) {
        this._pendingPingAt = this._now();
      }
    }

    if (this.state === 'open' && this._socket) {
      this._heartbeatTimer = this._setTimeout(() => this._onHeartbeat(), this._config.heartbeatInterval);
    }
  }

  private _stopHeartbeat(): void {
    if (this._heartbeatTimer !== null) {
      this._clearTimeout(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }
    this._pendingPingAt = 0;
  }

  // ── plumbing ──────────────────────────────────────────────────────────────

  private _clearReconnectTimer(): void {
    if (this._reconnectTimer !== null) {
      this._clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
  }

  /** Detach handlers so a dying socket cannot call back into a live object. */
  private _detach(socket: WebSocketLike): void {
    socket.onopen = null;
    socket.onmessage = null;
    socket.onerror = null;
    socket.onclose = null;
  }

  private _teardownSocket(code?: number, reason?: string): void {
    const socket = this._socket;
    if (!socket) return;
    this._socket = null;
    this._detach(socket);
    try {
      if (code !== undefined) socket.close(code, reason);
      else socket.close();
    } catch (e) {
      // Already closed, or never opened.
    }
  }

  /** A connect attempt that cannot proceed: terminal, loud, and not retried. */
  private _fail(message: string): void {
    this.state = 'error';
    this.connected = false;
    this.lastError = message;
    this._emitStatus();
    this._invoke(() => this._callbacks.onError && this._callbacks.onError(message));
  }

  private _reportError(message: string): void {
    this.lastError = message;
    this._emitStatus();
    this._invoke(() => this._callbacks.onError && this._callbacks.onError(message));
  }

  private _emitStatus(): void {
    this._invoke(() => this._callbacks.onStatus && this._callbacks.onStatus());
  }

  /**
   * Run an owner callback without letting it break the state machine. A throw
   * in a graph's signal handling must not leave the connection half-updated or
   * a timer unscheduled.
   */
  private _invoke(fn: () => void): void {
    try {
      fn();
    } catch (e) {
      console.error('[WebSocket] Error in a graph callback:', e);
    }
  }

  private _describe(e: unknown): string {
    if (e && typeof (e as Error).message === 'string') return (e as Error).message;
    return String(e);
  }

  private _describeClose(code: number, reason: string): string {
    const base = code === CLOSE_CODE_ABNORMAL ? 'Connection lost (no close frame)' : 'Connection closed (' + code + ')';
    return reason ? base + ': ' + reason : base;
  }
}
