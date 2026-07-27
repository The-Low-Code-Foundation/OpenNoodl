/**
 * Server-Sent Events connection lifecycle (AGENT-001).
 *
 * Opening an SSE stream is trivial; the hard parts are closing it when the user
 * navigates away mid-stream, reconnecting after a blip without replaying messages
 * the graph has already seen, and never failing quietly. So this file is a state
 * machine over a transport seam rather than a wrapper around `EventSource`:
 *
 *   SseConnection  — one reconnect/backoff/dedupe policy, transport-agnostic
 *     ├── EventSourceTransport  — the platform `EventSource`, which reconnects itself
 *     └── FetchStreamTransport  — `fetch` + a readable body, parsed with parseSseChunk
 *
 * Every external dependency (EventSource, fetch, AbortController, timers, clock) is
 * an injectable option, so the whole lifecycle matrix — network drop, server EOF,
 * cancel in flight, rapid open/close, teardown — is unit-testable with no server and
 * no DOM. That is not a testing nicety: the runtime's own test environment is `node`,
 * where none of those globals exist.
 *
 * ## Why two transports
 *
 * `EventSource` cannot set request headers, cannot POST, and delivers named events
 * only to listeners registered in advance. Agent backends need all three (bearer
 * auth, a prompt in the request body, `event: token` / `event: tool_call` frames), so
 * the fetch transport is the default and `EventSource` is available when an author
 * wants the browser's own reconnection instead. See NOTES for the full reasoning.
 *
 * ## Delivery semantics
 *
 * Deliberately explicit, because a streaming client that is vague about this is a
 * streaming client that loses messages:
 *
 * - **No `id:` fields on the stream** — a reconnect cannot resume, so events emitted
 *   during the gap are gone: *at-most-once*.
 * - **`id:` fields present** — the resume point is sent on reconnect
 *   (`Last-Event-ID` header for fetch; the browser does it for EventSource), so the
 *   server may replay events the graph already saw: *at-least-once*.
 * - **`id:` fields present and `dedupeById` on (the default)** — replays inside a
 *   bounded window of recently-seen ids are dropped, so the graph sees each id once.
 *
 * `SseConnection.deliverySemantics` reports which of the three is in force, and the
 * node surfaces it as an output. It is derived from what the server actually sent,
 * not from configuration.
 *
 * @module noodl-runtime
 * @since 2.0.0
 */

import { describeError, parseSseChunk, SseFrame } from './stream-parsers';

/**
 * Connection lifecycle states, shared with the WebSocket node so the two read alike.
 *
 * - `idle` — never connected.
 * - `connecting` — first attempt of this connect() in flight.
 * - `open` — stream established; frames may arrive.
 * - `reconnecting` — an attempt failed and another is scheduled or under way.
 * - `closed` — stopped on purpose, or the server ended a stream we were told not to
 *   resume. Nothing further will happen without a new `connect`.
 * - `error` — terminal failure: unretryable, or the retry budget is spent.
 *   `lastError` says which.
 */
export type SseConnectionState = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed' | 'error';

export type SseDeliverySemantics = 'at-most-once' | 'at-least-once' | 'at-least-once-deduped';

export type SseTransportKind = 'eventsource' | 'fetch';
export type SseTransportPreference = 'auto' | SseTransportKind;

/** Backoff base and ceiling, matching byob-realtime.js so the two agree by default. */
export const RECONNECT_BASE_DELAY = 1000;
export const RECONNECT_MAX_DELAY = 30000;
/** How many recently-seen event ids the duplicate filter remembers. */
export const DEFAULT_DEDUPE_WINDOW = 512;

/**
 * Exponential backoff: `base`, `base*2`, `base*4`, … capped at `max`.
 *
 * `backoffDelay(n, 1000, 30000)` is byob-realtime.js's `nextReconnectDelay(n)`; that
 * function is not reused directly only because its base and ceiling are constants and
 * this node exposes both as inputs. `agent-sse-connection.test.ts` asserts the two
 * agree for the default parameters, so the duplication cannot drift silently.
 */
export function backoffDelay(attempt: number, base: number, max: number): number {
  const b = base > 0 ? base : RECONNECT_BASE_DELAY;
  const m = max > 0 ? max : RECONNECT_MAX_DELAY;
  const n = attempt > 0 ? attempt : 0;
  // Cheap guard against Infinity from a large attempt count.
  if (n > 30) return m;
  return Math.min(m, b * Math.pow(2, n));
}

/**
 * A bounded set of recently-seen event ids, oldest evicted first.
 *
 * Bounded rather than unbounded because a long-lived agent UI is exactly the place an
 * ever-growing Set would be a leak, and a replay window only ever needs to cover the
 * events around a reconnect.
 */
export class RecentIds {
  private readonly _limit: number;
  private readonly _order: string[] = [];
  private readonly _set = new Set<string>();

  constructor(limit?: number) {
    this._limit = limit && limit > 0 ? limit : DEFAULT_DEDUPE_WINDOW;
  }

  has(id: string): boolean {
    return this._set.has(id);
  }

  /** Records `id`; returns false when it was already known. */
  add(id: string): boolean {
    if (this._set.has(id)) return false;
    this._set.add(id);
    this._order.push(id);
    if (this._order.length > this._limit) {
      const evicted = this._order.shift() as string;
      this._set.delete(evicted);
    }
    return true;
  }

  get size(): number {
    return this._set.size;
  }

  clear(): void {
    this._order.length = 0;
    this._set.clear();
  }
}

// ============================================================================
// Transport seam
// ============================================================================

export interface SseTransportCallbacks {
  /** The stream is established. */
  onOpen(): void;
  /** One dispatched SSE event. */
  onFrame(frame: SseFrame): void;
  /**
   * The transport failed. `fatal` means retrying the same request cannot help — a
   * malformed URL, a 4xx, an environment with no usable API.
   */
  onFailure(message: string, fatal: boolean): void;
  /** The server ended the stream cleanly. Only the fetch transport can detect this. */
  onEnd(): void;
  /** The transport is retrying by itself (EventSource only). */
  onSelfRetry(): void;
}

export interface SseTransport {
  open(): void;
  close(): void;
}

/**
 * The fields this file reads off a delivered event.
 *
 * A real `EventSource` sends `MessageEvent`s, but only two of their members are ever
 * touched, and both are read defensively — so a test double is a two-key object rather
 * than a DOM event.
 */
export interface SseMessageEventLike {
  data?: unknown;
  lastEventId?: unknown;
}

/**
 * The `EventSource` surface this transport uses.
 *
 * Structural rather than the DOM `EventSource` for the same reason
 * {@link WebSocketLike} is: the runtime's test environment is `node`, where the global
 * does not exist, and a double that had to implement the whole DOM interface could not
 * be written in a test.
 */
export interface EventSourceLike {
  /** 0 CONNECTING / 1 OPEN / 2 CLOSED. Read numerically — see `onerror` below. */
  readyState?: number;
  onopen: ((...args: unknown[]) => void) | null;
  onmessage: ((ev: SseMessageEventLike) => void) | null;
  onerror: ((...args: unknown[]) => void) | null;
  addEventListener(type: string, listener: (ev: SseMessageEventLike) => void): void;
  close(): void;
}

export type EventSourceConstructorLike = new (url: string, init?: { withCredentials?: boolean }) => EventSourceLike;

/** One `read()` from a streaming response body. */
export interface StreamReadResultLike {
  value?: unknown;
  done?: boolean;
}

export interface StreamReaderLike {
  read(): Promise<StreamReadResultLike>;
  cancel?(): unknown;
}

/**
 * A streaming response body, in either of the two forms this code accepts: a reader
 * (browsers, undici) or an async iterable (Node streams).
 */
export interface StreamBodyLike {
  getReader?(): StreamReaderLike;
  [Symbol.asyncIterator]?(): AsyncIterator<unknown>;
}

export interface StreamResponseLike {
  ok?: boolean;
  status?: number;
  body?: StreamBodyLike | null;
}

/** Exactly what {@link FetchStreamTransport} passes as the second argument. */
export interface SseRequestInit {
  method: string;
  headers: Record<string, string>;
  credentials: 'include' | 'same-origin';
  body?: unknown;
  signal?: unknown;
}

export type FetchLike = (url: string, init?: SseRequestInit) => Promise<StreamResponseLike>;

export interface AbortControllerLike {
  signal: unknown;
  abort(): void;
}

export type AbortControllerConstructorLike = new () => AbortControllerLike;

/**
 * Every platform dependency, injectable.
 *
 * One declaration rather than one per consumer: {@link SseConnectionOptions}, both
 * transports and the SSE node's own `_internal.seams` all describe this same set, and
 * three descriptions of one object is how the three come apart.
 */
export interface SseTransportEnv {
  EventSourceImpl?: EventSourceConstructorLike | null;
  fetchImpl?: FetchLike | null;
  AbortControllerImpl?: AbortControllerConstructorLike | null;
  setTimeoutImpl?(handler: () => void, timeout: number): unknown;
  clearTimeoutImpl?(handle: unknown): void;
  nowImpl?(): number;
}

/**
 * The platform `EventSource`.
 *
 * Two behaviours are inherited rather than chosen, and both are reported honestly
 * instead of papered over:
 *
 * 1. It reconnects on its own. An `error` while `readyState` is `CONNECTING` means
 *    "already retrying", which surfaces as `onSelfRetry` — issuing our own reconnect
 *    there would open a second stream.
 * 2. It cannot distinguish a server that closed the stream cleanly from a network
 *    drop; the HTML spec says reconnect in both cases. So a finite agent response
 *    stream looks like a reconnect loop under this transport, which is one more
 *    reason the fetch transport is the default.
 */
export class EventSourceTransport implements SseTransport {
  private readonly _url: string;
  private readonly _withCredentials: boolean;
  private readonly _eventTypes: string[];
  private readonly _EventSource: EventSourceConstructorLike | null;
  private readonly _cb: SseTransportCallbacks;
  private _es: EventSourceLike | null = null;
  private _closed = false;
  private _everOpen = false;

  constructor(
    options: {
      url: string;
      withCredentials?: boolean;
      eventTypes?: string[];
      EventSourceImpl?: EventSourceConstructorLike | null;
    },
    callbacks: SseTransportCallbacks
  ) {
    this._url = options.url;
    this._withCredentials = !!options.withCredentials;
    this._eventTypes = options.eventTypes || [];
    // An explicit key wins even when null, so a test can represent "no EventSource
    // here" despite a global one existing.
    this._EventSource =
      'EventSourceImpl' in options
        ? options.EventSourceImpl
        : typeof EventSource !== 'undefined'
          ? (EventSource as unknown as EventSourceConstructorLike)
          : null;
    this._cb = callbacks;
  }

  open(): void {
    if (this._closed) return;
    if (!this._EventSource) {
      this._cb.onFailure('EventSource is not available in this environment', true);
      return;
    }

    let es: EventSourceLike;
    try {
      es = new this._EventSource(this._url, { withCredentials: this._withCredentials });
    } catch (e) {
      this._cb.onFailure('Could not open EventSource for ' + this._url + ': ' + describeError(e), true);
      return;
    }
    this._es = es;

    es.onopen = () => {
      if (this._closed) return;
      this._everOpen = true;
      this._cb.onOpen();
    };

    es.onmessage = (ev: SseMessageEventLike) => {
      if (this._closed) return;
      this._cb.onFrame({ event: 'message', data: ev && ev.data != null ? String(ev.data) : '', id: idOf(ev) });
    };

    // Named events reach a listener only if one was registered for that exact name,
    // so the author has to declare which ones they want. The fetch transport has no
    // such restriction because it parses the wire format itself.
    for (const type of this._eventTypes) {
      if (!type || type === 'message') continue;
      es.addEventListener(type, (ev: SseMessageEventLike) => {
        if (this._closed) return;
        this._cb.onFrame({ event: type, data: ev && ev.data != null ? String(ev.data) : '', id: idOf(ev) });
      });
    }

    es.onerror = () => {
      if (this._closed) return;
      // 0 CONNECTING / 1 OPEN / 2 CLOSED. Read numerically: an injected double may
      // not carry the static constants, and the numbers are fixed by the spec.
      if (es.readyState === 2) {
        // EventSource has given up. Retrying is still worth a try (the server may
        // have been briefly unavailable) so this is not flagged fatal — but if the
        // stream never opened at all, the endpoint is the likely problem and saying
        // so beats an anonymous retry loop.
        this._cb.onFailure(
          this._everOpen
            ? 'The event stream closed and the browser stopped retrying'
            : 'Could not open the event stream (check the URL, CORS, and that the response is text/event-stream)',
          false
        );
        return;
      }
      this._cb.onSelfRetry();
    };
  }

  close(): void {
    this._closed = true;
    const es = this._es;
    if (!es) return;
    this._es = null;
    // Three statements rather than a chained assignment: the handlers have distinct
    // signatures, so one `= null` cannot stand for all three once they are typed.
    es.onopen = null;
    es.onmessage = null;
    es.onerror = null;
    try {
      es.close();
    } catch (e) {
      // Already closed, or never finished connecting.
    }
  }
}

function idOf(ev: SseMessageEventLike): string {
  const id = ev && ev.lastEventId;
  return typeof id === 'string' ? id : '';
}

/**
 * `fetch` with a streamed response body, parsed with `parseSseChunk`.
 *
 * Handles what `EventSource` cannot: request headers, non-GET methods, a request
 * body, every event type without pre-registration, an explicit `Last-Event-ID` on
 * resume, and — the one that matters most for agent UIs — telling a *finished* stream
 * apart from a *dropped* one.
 *
 * Cancellation goes through `AbortController`, so an in-flight request is actually
 * cancelled on teardown rather than left to finish into a dead handler.
 */
export class FetchStreamTransport implements SseTransport {
  private readonly _url: string;
  private readonly _method: string;
  private readonly _headers: Record<string, string>;
  private readonly _body: unknown;
  private readonly _withCredentials: boolean;
  private readonly _lastEventId: string;
  private readonly _fetch: FetchLike | null;
  private readonly _AbortController: AbortControllerConstructorLike | null;
  private readonly _cb: SseTransportCallbacks;
  private _controller: AbortControllerLike | null = null;
  private _reader: StreamReaderLike | null = null;
  private _closed = false;

  constructor(
    options: {
      url: string;
      method?: string;
      headers?: Record<string, string>;
      body?: unknown;
      withCredentials?: boolean;
      lastEventId?: string;
      fetchImpl?: FetchLike | null;
      AbortControllerImpl?: AbortControllerConstructorLike | null;
    },
    callbacks: SseTransportCallbacks
  ) {
    this._url = options.url;
    this._method = (options.method || 'GET').toUpperCase();
    this._headers = options.headers || {};
    this._body = options.body;
    this._withCredentials = !!options.withCredentials;
    this._lastEventId = options.lastEventId || '';
    this._fetch =
      'fetchImpl' in options
        ? options.fetchImpl
        : typeof fetch !== 'undefined'
          ? (fetch as unknown as FetchLike)
          : null;
    this._AbortController =
      'AbortControllerImpl' in options
        ? options.AbortControllerImpl
        : typeof AbortController !== 'undefined'
          ? (AbortController as unknown as AbortControllerConstructorLike)
          : null;
    this._cb = callbacks;
  }

  open(): void {
    if (this._closed) return;
    if (!this._fetch) {
      this._cb.onFailure('fetch is not available in this environment', true);
      return;
    }

    const headers: Record<string, string> = { Accept: 'text/event-stream', 'Cache-Control': 'no-store' };
    for (const key in this._headers) {
      if (this._headers[key] !== undefined && this._headers[key] !== null) {
        headers[key] = String(this._headers[key]);
      }
    }
    // Resume point. The browser sets this automatically for EventSource; here it is
    // ours to send, which is also what makes resume work for POST streams.
    if (this._lastEventId) headers['Last-Event-ID'] = this._lastEventId;

    const init: SseRequestInit = {
      method: this._method,
      headers,
      credentials: this._withCredentials ? 'include' : 'same-origin'
    };

    if (this._body !== undefined && this._body !== null && this._method !== 'GET' && this._method !== 'HEAD') {
      if (typeof this._body === 'string') {
        init.body = this._body;
      } else {
        init.body = JSON.stringify(this._body);
        if (!hasHeaderNamed(headers, 'content-type')) headers['Content-Type'] = 'application/json';
      }
    }

    if (this._AbortController) {
      try {
        this._controller = new this._AbortController();
        init.signal = this._controller.signal;
      } catch (e) {
        this._controller = null;
      }
    }

    let promise: Promise<StreamResponseLike>;
    try {
      // Detached deliberately. `this._fetch(...)` is a method call on the transport,
      // and a browser's `fetch` brand-checks its receiver — it rejects with
      // "Illegal invocation" for any `this` that is not a Window. Node's `fetch` is an
      // ordinary function and does not care, which is why every test passed and the
      // first real browser run failed on the first token. Calling through a local
      // leaves `this` undefined, which the browser resolves to the global.
      const fetchImpl = this._fetch;
      promise = fetchImpl(this._url, init);
    } catch (e) {
      this._cb.onFailure('Could not start the request: ' + describeError(e), true);
      return;
    }

    Promise.resolve(promise)
      .then((res) => this._onResponse(res))
      .catch((e) => {
        if (this._closed || isAbort(e)) return;
        this._cb.onFailure('Stream request failed: ' + describeError(e), false);
      });
  }

  private async _onResponse(res: StreamResponseLike | null | undefined): Promise<void> {
    if (this._closed) return;
    if (!res) {
      this._cb.onFailure('The stream request returned no response', false);
      return;
    }

    if (res.ok === false || (typeof res.status === 'number' && (res.status < 200 || res.status >= 300))) {
      const status = res.status;
      // 4xx is the caller's fault and will fail identically next time — except 408
      // (timeout) and 429 (slow down), which are explicitly retryable.
      const fatal = typeof status === 'number' && status >= 400 && status < 500 && status !== 408 && status !== 429;
      this._cb.onFailure('The stream endpoint returned HTTP ' + status, fatal);
      return;
    }

    this._cb.onOpen();

    const body = res.body;
    if (!body) {
      // No streaming body. Reading the whole response would defeat the point of a
      // stream, so say so rather than pretend.
      this._cb.onFailure('The response has no readable body; this environment cannot stream fetch responses', true);
      return;
    }

    let buffer = '';
    const decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8') : null;

    const consume = (chunk: unknown) => {
      const text =
        typeof chunk === 'string' ? chunk : decoder && chunk ? decoder.decode(chunk as Uint8Array, { stream: true }) : '';
      if (!text) return;
      buffer += text;
      const { frames, rest } = parseSseChunk(buffer);
      buffer = rest;
      for (const frame of frames) {
        if (this._closed) return;
        this._cb.onFrame(frame);
      }
    };

    try {
      if (typeof body.getReader === 'function') {
        const reader = body.getReader();
        this._reader = reader;
        for (;;) {
          const step = await reader.read();
          if (this._closed) return;
          if (step && step.done) break;
          consume(step && step.value);
        }
      } else if (typeof body[Symbol.asyncIterator] === 'function') {
        // Node streams (and undici in some versions) are async-iterable instead.
        for await (const chunk of body as AsyncIterable<unknown>) {
          if (this._closed) return;
          consume(chunk);
        }
      } else {
        this._cb.onFailure('The response body is neither a reader nor async-iterable', true);
        return;
      }
    } catch (e) {
      if (this._closed || isAbort(e)) return;
      this._cb.onFailure('The event stream was interrupted: ' + describeError(e), false);
      return;
    }

    if (this._closed) return;

    // A conforming server ends its last event with a blank line, and the spec says an
    // undispatched partial event at EOF is discarded. Real servers routinely just
    // close, which would silently drop the final — usually most interesting — event.
    // So the tail is dispatched as if the blank line had arrived.
    if (buffer.trim() !== '') {
      const { frames } = parseSseChunk(buffer + '\n\n');
      for (const frame of frames) {
        if (this._closed) return;
        this._cb.onFrame(frame);
      }
    }

    this._cb.onEnd();
  }

  close(): void {
    this._closed = true;
    const controller = this._controller;
    this._controller = null;
    if (controller) {
      try {
        controller.abort();
      } catch (e) {
        // Nothing to abort.
      }
    }
    const reader = this._reader;
    this._reader = null;
    if (reader && typeof reader.cancel === 'function') {
      try {
        // A rejected cancel is not actionable and must not become an unhandled
        // rejection during teardown. `cancel` is declared as returning `unknown`
        // because a double may return nothing at all, so the thenable is sniffed
        // rather than assumed.
        const p = reader.cancel() as { catch?: (onRejected: () => void) => unknown } | undefined;
        if (p && typeof p.catch === 'function') p.catch(() => {});
      } catch (e) {
        // Already released.
      }
    }
  }
}

function hasHeaderNamed(headers: Record<string, string>, name: string): boolean {
  const lower = name.toLowerCase();
  for (const key in headers) if (key.toLowerCase() === lower) return true;
  return false;
}

function isAbort(e: unknown): boolean {
  const name = e && (e as { name?: string }).name;
  return name === 'AbortError';
}

// ============================================================================
// Connection
// ============================================================================

export interface SseConnectionOptions extends SseTransportEnv {
  url: string;

  /** `'auto'` prefers fetch when it exists, because it is strictly more capable. */
  transport?: SseTransportPreference;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  withCredentials?: boolean;
  /** Named events to subscribe to. EventSource transport only; fetch gets them all. */
  eventTypes?: string[];

  /** Retry after a failure. Default true. */
  autoReconnect?: boolean;
  /**
   * Reconnect when the server ends the stream cleanly. Default **false**, unlike the
   * SSE protocol's own default, because an agent response stream is finite: resuming
   * it would re-issue the request and start the generation again, forever. Detectable
   * only under the fetch transport.
   */
  reconnectOnStreamEnd?: boolean;
  /** First backoff delay in ms; doubles per attempt. A server `retry:` field wins. */
  reconnectDelay?: number;
  maxReconnectDelay?: number;
  /** Consecutive failures allowed before giving up. 0 (default) means never give up. */
  maxRetries?: number;

  /** Suppress replayed events that carry an id already seen. Default true. */
  dedupeById?: boolean;
  dedupeWindow?: number;

  onState?: (state: SseConnectionState) => void;
  onFrame?: (frame: SseFrame) => void;
  onError?: (message: string) => void;
  onDuplicate?: (frame: SseFrame) => void;

  // The injectable environment (tests, and hosts without one of these globals) is
  // inherited from SseTransportEnv above.
}

export class SseConnection {
  private readonly _options: SseConnectionOptions;
  private readonly _setTimeout: (fn: () => void, ms: number) => unknown;
  private readonly _clearTimeout: (handle: unknown) => void;
  private readonly _now: () => number;
  private readonly _recentIds: RecentIds;

  private _transport: SseTransport | null = null;
  private _reconnectTimer: unknown = null;
  private _disposed = false;

  state: SseConnectionState = 'idle';
  retryCount = 0;
  lastError = '';
  lastEventId = '';
  lastEventType = '';
  messageCount = 0;
  duplicatesSuppressed = 0;
  lastMessageTime = 0;
  /** Delay the server asked for via `retry:`, when it sent one. */
  serverRetryMs: number | undefined;

  private _sawEventIds = false;

  constructor(options: SseConnectionOptions) {
    this._options = options;
    this._setTimeout = options.setTimeoutImpl || ((fn, ms) => setTimeout(fn, ms));
    this._clearTimeout = options.clearTimeoutImpl || ((h) => clearTimeout(h as never));
    this._now = options.nowImpl || (() => Date.now());
    this._recentIds = new RecentIds(options.dedupeWindow);
  }

  /** Which transport `resolveTransport` would pick, for display and for tests. */
  get transportKind(): SseTransportKind {
    return resolveTransport(this._options);
  }

  get connected(): boolean {
    return this.state === 'open';
  }

  get deliverySemantics(): SseDeliverySemantics {
    if (!this._sawEventIds) return 'at-most-once';
    return this._options.dedupeById === false ? 'at-least-once' : 'at-least-once-deduped';
  }

  /** True while a reconnect is pending. Tests assert this is false after teardown. */
  hasPendingTimer(): boolean {
    return this._reconnectTimer !== null;
  }

  /**
   * Starts (or restarts) the stream.
   *
   * A live transport is torn down first, so a graph that fires `connect` twice — or
   * an author hammering it — ends up with one stream, not two. The retry budget
   * resets: this is a deliberate act by the app, not a recovery attempt.
   */
  connect(): void {
    if (this._disposed) return;

    this._clearReconnectTimer();
    this._closeTransport();

    const url = this._options.url;
    if (!url) {
      this._fail('No URL was set on the stream', true);
      return;
    }

    this.retryCount = 0;
    this.lastError = '';
    this._setState('connecting');
    this._openTransport();
  }

  /** Stops the stream and stays stopped. */
  disconnect(): void {
    if (this._disposed) return;
    this._clearReconnectTimer();
    const wasActive = this._transport !== null || this.state === 'connecting' || this.state === 'reconnecting';
    this._closeTransport();
    if (wasActive || this.state !== 'closed') this._setState('closed');
  }

  /**
   * Releases everything and stops reporting. Idempotent, and safe to call from
   * teardown while a request is in flight.
   */
  dispose(): void {
    this._disposed = true;
    this._clearReconnectTimer();
    this._closeTransport();
    this._recentIds.clear();
  }

  get disposed(): boolean {
    return this._disposed;
  }

  // -- internals -----------------------------------------------------------

  private _openTransport(): void {
    const kind = resolveTransport(this._options);
    const callbacks: SseTransportCallbacks = {
      onOpen: () => this._onOpen(),
      onFrame: (frame) => this._onFrame(frame),
      onFailure: (message, fatal) => this._fail(message, fatal),
      onEnd: () => this._onEnd(),
      onSelfRetry: () => this._onSelfRetry()
    };

    if (kind === 'eventsource') {
      this._transport = new EventSourceTransport(
        {
          url: this._options.url,
          withCredentials: this._options.withCredentials,
          eventTypes: this._options.eventTypes,
          ...('EventSourceImpl' in this._options ? { EventSourceImpl: this._options.EventSourceImpl } : {})
        },
        callbacks
      );
    } else {
      this._transport = new FetchStreamTransport(
        {
          url: this._options.url,
          method: this._options.method,
          headers: this._options.headers,
          body: this._options.body,
          withCredentials: this._options.withCredentials,
          lastEventId: this.lastEventId,
          ...('fetchImpl' in this._options ? { fetchImpl: this._options.fetchImpl } : {}),
          ...('AbortControllerImpl' in this._options
            ? { AbortControllerImpl: this._options.AbortControllerImpl }
            : {})
        },
        callbacks
      );
    }

    this._transport.open();
  }

  private _closeTransport(): void {
    const transport = this._transport;
    this._transport = null;
    if (transport) transport.close();
  }

  private _clearReconnectTimer(): void {
    if (this._reconnectTimer !== null) {
      this._clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
  }

  private _setState(state: SseConnectionState): void {
    if (this.state === state) return;
    this.state = state;
    if (!this._disposed && this._options.onState) this._options.onState(state);
  }

  private _onOpen(): void {
    if (this._disposed) return;
    this.retryCount = 0;
    this.lastError = '';
    this._setState('open');
  }

  private _onFrame(frame: SseFrame): void {
    if (this._disposed) return;

    if (frame.retry !== undefined) this.serverRetryMs = frame.retry;

    if (frame.id) {
      this._sawEventIds = true;
      // The resume point advances even for a suppressed duplicate: it is still the
      // furthest the server has told us it has got to.
      this.lastEventId = frame.id;
      if (this._options.dedupeById !== false && !this._recentIds.add(frame.id)) {
        this.duplicatesSuppressed++;
        if (this._options.onDuplicate) this._options.onDuplicate(frame);
        return;
      }
    }

    this.messageCount++;
    this.lastEventType = frame.event;
    this.lastMessageTime = this._now();
    if (this._options.onFrame) this._options.onFrame(frame);
  }

  private _onEnd(): void {
    if (this._disposed) return;
    this._closeTransport();

    if (this._options.reconnectOnStreamEnd) {
      // Treated as a recoverable drop rather than a failure: no error is reported,
      // because nothing went wrong.
      this._scheduleReconnect();
      return;
    }
    this._setState('closed');
  }

  private _onSelfRetry(): void {
    if (this._disposed) return;
    this.retryCount++;

    const max = this._options.maxRetries || 0;
    if (max > 0 && this.retryCount > max) {
      // EventSource will keep trying until it is closed, so enforcing the budget
      // means closing it.
      this._closeTransport();
      this._fail('Gave up after ' + max + ' reconnection attempts', true);
      return;
    }

    this._report('The event stream dropped; the browser is reconnecting');
    this._setState('reconnecting');
  }

  private _fail(message: string, fatal: boolean): void {
    if (this._disposed) return;

    this._report(message);

    if (fatal) {
      this._closeTransport();
      this._setState('error');
      return;
    }

    if (this._options.autoReconnect === false) {
      this._closeTransport();
      this._setState('error');
      return;
    }

    const max = this._options.maxRetries || 0;
    if (max > 0 && this.retryCount >= max) {
      this._closeTransport();
      this.lastError = message + ' (gave up after ' + max + ' attempts)';
      if (this._options.onError) this._options.onError(this.lastError);
      this._setState('error');
      return;
    }

    this._closeTransport();
    this.retryCount++;
    this._scheduleReconnect();
  }

  private _scheduleReconnect(): void {
    this._clearReconnectTimer();
    // A server-specified `retry:` is a direct instruction and outranks the node's
    // configured base delay; the backoff still applies on top of it.
    const base = this.serverRetryMs !== undefined ? this.serverRetryMs : (this._options.reconnectDelay as number);
    const delay = backoffDelay(this.retryCount - 1 > 0 ? this.retryCount - 1 : 0, base, this._options
      .maxReconnectDelay as number);

    this._setState('reconnecting');
    this._reconnectTimer = this._setTimeout(() => {
      this._reconnectTimer = null;
      if (this._disposed) return;
      this._openTransport();
    }, delay);
  }

  private _report(message: string): void {
    this.lastError = message;
    if (!this._disposed && this._options.onError) this._options.onError(message);
  }
}

/**
 * Picks a transport.
 *
 * `auto` prefers fetch whenever it exists. That is the deliberate default: fetch can
 * carry auth headers, POST a prompt, deliver every event type, resume with an
 * explicit `Last-Event-ID`, and tell a finished stream from a dropped one — the four
 * things an agent front-end needs and `EventSource` cannot do. `EventSource` is still
 * chosen when fetch is absent, and can be demanded explicitly.
 */
export function resolveTransport(options: {
  transport?: SseTransportPreference;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  fetchImpl?: FetchLike | null;
  EventSourceImpl?: EventSourceConstructorLike | null;
}): SseTransportKind {
  if (options.transport === 'eventsource') return 'eventsource';
  if (options.transport === 'fetch') return 'fetch';

  const haveFetch = 'fetchImpl' in options ? !!options.fetchImpl : typeof fetch !== 'undefined';
  if (haveFetch) return 'fetch';

  const haveEventSource =
    'EventSourceImpl' in options ? !!options.EventSourceImpl : typeof EventSource !== 'undefined';
  if (haveEventSource) return 'eventsource';

  // Neither exists. Return fetch so the failure names the missing API rather than
  // silently doing nothing.
  return 'fetch';
}
