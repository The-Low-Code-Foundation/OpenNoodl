/**
 * The lifecycle every realtime transport shares — BCN-008 step 1.
 *
 * `byob-realtime.ts` had two connection classes that agreed on a callback shape and on
 * nothing else: the WebSocket one owned a backoff and a fatal flag, the SSE one owned
 * neither and leaned on `EventSource`'s built-in retry. Adding PocketBase and Parse to
 * that would have produced four opinions about when to give up. This is the one opinion,
 * and every rule in it is one a measurement produced.
 *
 * ## What the transports do not get to decide
 *
 * **1. Reconnection has one entry.** {@link RealtimeSubscription.transportDownFrom} is it.
 * `close`, `error` and the deadline timer all arrive there, at most once per socket, and
 * a report from a socket that has already been replaced is dropped rather than racing the
 * new one. That last part is what the shipped `_downHandled` flag could not express: it
 * de-duplicated *within* a socket, so a late `close` from generation 1 arriving after
 * generation 2 had connected still scheduled a second reconnect.
 *
 * **2. The deadline is a *confirmation* deadline, not a connect deadline.** BCN-008's
 * measurement pass found a WebSocket opened against a real HTTP server on a path it does
 * not upgrade fires **neither `error` nor `close`** — silent for the full 20s the probe
 * waited. `REALTIME_TIMING.connectTimeoutMs` exists for that. But three of the five
 * backends will also hold an *open* connection that never confirms anything (PocketBase
 * answers `204` to a subscription it will never deliver; our own backend answers `200`
 * carrying a rejection), and "open but never subscribed" is the same silence from the
 * app author's side. So the timer is armed whenever the subscription is not `subscribed`
 * and disarmed only by {@link RealtimeSubscription.confirmed}. One timer, both silences.
 *
 * **3. Fatal is data, not judgement.** `REALTIME_FAILURE_KINDS` classifies every code, so
 * five transports cannot each decide whether a bad token is worth retrying. A transport
 * may override for a case it can *prove* — a malformed backend URL cannot become valid by
 * waiting — and {@link RealtimeSubscription.fail} takes the override explicitly so the
 * deviation is visible at the call site rather than hidden in a table.
 *
 * @module api/backends/realtime/RealtimeSubscription
 */

import type { BackendHandle } from '@noodl/backend-contract';
import {
  REALTIME_FAILURE_KINDS,
  REALTIME_TIMING,
  nextReconnectDelay,
  type RealtimeChange,
  type RealtimeDeps,
  type RealtimeDownReason,
  type RealtimeError,
  type RealtimeErrorCode,
  type RealtimeEventSourceLike,
  type RealtimeFailureKind,
  type RealtimeFilter,
  type RealtimeHandle,
  type RealtimeLifecycle,
  type RealtimeSocketLike,
  type RealtimeStatus,
  type RealtimeSubscribeOptions,
  type RealtimeTiming,
  type RealtimeTransport
} from '@noodl/backend-contract/realtime';

/** `fetch`, as narrowly as a transport uses one. */
export interface RealtimeFetchResponse {
  status?: number;
  ok?: boolean;
  json?(): Promise<unknown>;
  text?(): Promise<string>;
}

export type RealtimeFetch = (url: string, init?: unknown) => Promise<RealtimeFetchResponse>;

/**
 * Everything a subscription is built from.
 *
 * `primaryKey` is here rather than looked up because the id normalisation
 * ({@link RealtimeChange.ids} is `string[]` on every transport, measured from Directus
 * sending `["2"]` for an `integer` pk) needs to know which field to read on the transports
 * that send whole records, and the schema is the node layer's to know.
 */
export interface RealtimeSubscriptionOptions extends RealtimeSubscribeOptions {
  /** Field name carrying the record id. Defaults to `id`. */
  primaryKey?: string;
}

/**
 * How long a subscription may sit un-confirmed before the deadline fires, when the caller
 * has not said. {@link REALTIME_TIMING}'s 15s, kept in one named place.
 */
const DEFAULT_TIMING: RealtimeTiming = REALTIME_TIMING;

/**
 * One subscription, and the state machine it runs.
 *
 * Subclasses implement two methods — open a connection, close it — and report what
 * happens through {@link confirmed}, {@link emitChange}, {@link fail} and
 * {@link transportDownFrom}. Everything else (status, backoff, deadlines, dispose
 * idempotence, the once-per-socket guard) is here, once.
 */
export abstract class RealtimeSubscription implements RealtimeLifecycle, RealtimeHandle {
  readonly collection: string;
  /** Which wire this subclass speaks. Read by the node layer for its disclosure text. */
  abstract readonly transport: RealtimeTransport;

  protected readonly handle: BackendHandle;
  /** The backend's own filter dialect — see `RealtimeFilter`, not the neutral `Filter`. */
  protected readonly where?: RealtimeFilter;
  protected readonly primaryKey: string;
  protected readonly timing: RealtimeTiming;
  private readonly _deps: RealtimeDeps;

  private readonly _onEvent?: (change: RealtimeChange) => void;
  private readonly _onStatus?: (status: RealtimeStatus) => void;
  private readonly _onError?: (error: RealtimeError) => void;

  private _status: RealtimeStatus = 'connecting';
  private _attempt = 0;
  /**
   * Which socket is current. Incremented on every {@link connect}; a report tagged with
   * an older number is a straggler from a connection that has already been replaced.
   */
  private _generation = 0;
  private _downGeneration = -1;
  /** The last generation that reached `subscribed`. See {@link transportDownFrom}. */
  private _confirmedGeneration = -1;
  /** The last generation a transport reported a reason for, so it is not reported twice. */
  private _reportedGeneration = -1;
  private _reconnectTimer: unknown = null;
  private _deadlineTimer: unknown = null;
  private _disposed = false;

  constructor(handle: BackendHandle, options: RealtimeSubscriptionOptions) {
    this.handle = handle;
    this.collection = options.collection;
    this.where = options.where;
    this.primaryKey = options.primaryKey || 'id';
    this.timing = options.timing || DEFAULT_TIMING;
    this._deps = options.deps || {};
    this._onEvent = options.onEvent;
    this._onStatus = options.onStatus;
    this._onError = options.onError;
  }

  get status(): RealtimeStatus {
    return this._status;
  }

  // ── the state machine ────────────────────────────────────────────────────

  connect(): void {
    if (this._disposed || this._status === 'stopped') return;

    this._clearTimer('_reconnectTimer');
    const generation = ++this._generation;
    this._setStatus(this._attempt === 0 ? 'connecting' : 'interrupted');
    this._armDeadline(generation);

    try {
      this.openTransport(generation);
    } catch (e) {
      // A constructor that throws (an unparseable URL is the measured case) is not a
      // socket that will ever report anything, so it has to be reported here.
      this.fail('CONNECT_FAILED', 'Could not open a realtime connection: ' + errorMessage(e));
      this.transportDownFrom(generation, 'errored');
    }
  }

  /**
   * The server acknowledged the subscription.
   *
   * Not "the socket opened" — see the module docblock, rule 2. Resets the backoff counter,
   * which is why a flapping backend does not walk the delay up to 30s and stay there.
   */
  confirmed(): void {
    if (this._disposed || this._status === 'stopped') return;
    this._clearTimer('_deadlineTimer');
    this._attempt = 0;
    this._confirmedGeneration = this._generation;
    this._setStatus('subscribed');
  }

  /** {@link RealtimeLifecycle}'s signature: the current socket went down. */
  transportDown(reason: RealtimeDownReason): void {
    this.transportDownFrom(this._generation, reason);
  }

  /**
   * The single funnel, tagged with the socket that is reporting.
   *
   * Drops a report from a superseded socket, and drops a second report from the current
   * one — the browser fires `error` *and* `close` for the same failure, and undici fires
   * only `error`, so both orders have to be harmless.
   */
  protected transportDownFrom(generation: number, reason: RealtimeDownReason): void {
    if (generation !== this._generation) return;
    if (this._downGeneration === generation) return;
    this._downGeneration = generation;

    this._clearTimer('_deadlineTimer');
    this._safeClose();

    if (this._disposed || this._status === 'stopped') return;

    this._setStatus('interrupted');
    this.onTransportDown(reason);

    // ⚠️ A connection that goes down having **never confirmed** is a failure, and it needs
    // a reason. A confirmed connection going down is not: a backend restart is an ordinary
    // event and reporting an error for every one would train an app author to ignore them.
    //
    // The measured case this closes: a WebSocket against a listening server that is not a
    // WebSocket server (PostgREST) fires `error` at ~20ms and `close` **never**. Without
    // this, the only observable was a status flipping to `interrupted` — no code, no
    // message, nothing naming the port that is wrong. `connect-timeout` and
    // `heartbeat-missed` are excluded because they have already reported their own.
    if (
      this._confirmedGeneration !== generation &&
      this._reportedGeneration !== generation &&
      (reason === 'errored' || reason === 'closed')
    ) {
      const fatal = this.fail(
        'CONNECT_FAILED',
        `The realtime connection to "${this.collection}" went down before it was confirmed (${reason}).`
      );
      if (fatal) return;
    }

    const delay = nextReconnectDelay(this._attempt++, this.timing);
    this._reconnectTimer = this._setTimeout(() => {
      this._reconnectTimer = null;
      this.connect();
    }, delay);
  }

  /**
   * Report a failure, and stop for good if it is a fatal one.
   *
   * `kind` defaults from {@link REALTIME_FAILURE_KINDS} — the one classification — and is
   * only passed explicitly where a transport can *prove* the general rule wrong. There is
   * exactly one such case today: a backend URL that is not http(s) produces
   * `CONNECT_FAILED`, which is retryable in general and is not retryable when the string
   * cannot change without a graph edit.
   */
  protected fail(code: RealtimeErrorCode, message: string, kind?: RealtimeFailureKind): boolean {
    const error: RealtimeError = { message, code, kind: kind || REALTIME_FAILURE_KINDS[code] };
    this._reportedGeneration = this._generation;
    this._notify('onError', () => this._onError && this._onError(error));

    if (error.kind !== 'fatal') return false;

    this._clearTimer('_deadlineTimer');
    this._clearTimer('_reconnectTimer');
    this._safeClose();
    this._setStatus('stopped');
    return true;
  }

  /**
   * The connection is in trouble but is recovering itself, so do not tear it down.
   *
   * The `EventSource` case, and only that case: it reconnects on its own and its retry
   * carries `Last-Event-ID`, which is what earns our backend's `resync` frame. Reporting
   * that down the funnel immediately would replace a measured server behaviour with a
   * uniform-looking one.
   *
   * ⚠️ The deadline is armed **at most once per generation**. Re-arming on every `error`
   * would let a stream that errors every three seconds postpone the funnel forever, which
   * is a subscription that never connects and never reports — the exact silence the
   * deadline exists to end.
   */
  protected interrupted(generation: number): void {
    if (generation !== this._generation) return;
    if (this._disposed || this._status === 'stopped') return;
    this._setStatus('interrupted');
    if (this._deadlineTimer === null) this._armDeadline(generation);
  }

  protected emitChange(change: RealtimeChange): void {
    if (this._disposed) return;
    this._notify('onEvent', () => this._onEvent && this._onEvent(change));
  }

  /**
   * Run a consumer callback without letting it take the transport down with it.
   *
   * ⚠️ **An exception thrown in a subscriber does not stay local.** BCN-004 step 6 found
   * the same shape one layer down: `_addModelAtCorrectIndex` threw inside the store's
   * `create` emit, which the adapter raises *inside* the originating node's success
   * callback, so a Create New Record node never fired `Created` for a record it had
   * already written. A realtime callback runs from inside `onmessage` or an SSE listener,
   * where a throw would skip the transport's own bookkeeping — the pong that keeps the
   * Directus connection alive is dispatched from the very same handler.
   *
   * So the throw is reported and contained. It is **not** swallowed: `console.error` is
   * the only channel available here (this layer has no `raiseRuntimeError`, and inventing
   * a dependency on one would put the node layer inside the transport layer), and the
   * node that owns the callback is where a runtime error belongs.
   */
  private _notify(what: string, run: () => void): void {
    try {
      run();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(
        `[realtime] a ${what} handler for "${this.collection}" threw; the subscription is unaffected.`,
        e
      );
    }
  }

  dispose(): void {
    if (this._disposed) return;
    this._disposed = true;
    this._clearTimer('_deadlineTimer');
    this._clearTimer('_reconnectTimer');
    this._safeClose();
    // Deliberately silent: the caller disposing is the caller that would be told.
    this._status = 'stopped';
  }

  // ── what subclasses implement ────────────────────────────────────────────

  /**
   * Open a connection and wire it to report through {@link transportDownFrom} with
   * `generation`, {@link confirmed}, {@link emitChange} and {@link fail}.
   */
  protected abstract openTransport(generation: number): void;

  /** Close whatever {@link openTransport} opened. Called more than once; must not throw. */
  protected abstract closeTransport(): void;

  /** A hook for per-transport teardown that is not closing the socket (heartbeat timers). */
  protected onTransportDown(_reason: RealtimeDownReason): void {
    /* nothing by default */
  }

  // ── deps, resolved the way the shipped node did ──────────────────────────
  //
  // An explicit `null` means "this host has none", which is a case tests need and which
  // `undefined` cannot express — hence `'X' in deps` rather than `deps.X ?? global`.

  protected resolveWebSocket(): (new (url: string) => RealtimeSocketLike) | null {
    if ('WebSocketImpl' in this._deps) return this._deps.WebSocketImpl || null;
    return typeof WebSocket !== 'undefined' ? (WebSocket as unknown as new (url: string) => RealtimeSocketLike) : null;
  }

  protected resolveEventSource(): (new (url: string) => RealtimeEventSourceLike) | null {
    if ('EventSourceImpl' in this._deps) return this._deps.EventSourceImpl || null;
    return typeof EventSource !== 'undefined'
      ? (EventSource as unknown as new (url: string) => RealtimeEventSourceLike)
      : null;
  }

  protected resolveFetch(): RealtimeFetch | null {
    if (this._deps.fetchImpl) return this._deps.fetchImpl as RealtimeFetch;
    return typeof fetch !== 'undefined' ? (fetch.bind(globalThis) as RealtimeFetch) : null;
  }

  protected _setTimeout(fn: () => void, delay: number): unknown {
    const impl = this._deps.setTimeoutImpl || setTimeout.bind(globalThis);
    return impl(fn, delay);
  }

  protected _clearTimeout(handle: unknown): void {
    const impl = this._deps.clearTimeoutImpl || clearTimeout.bind(globalThis);
    impl(handle);
  }

  // ── internals ────────────────────────────────────────────────────────────

  /** The token a subscription carries: the session's if signed in, else the public one. */
  protected get token(): string {
    return this.handle.sessionToken || this.handle.publicToken || '';
  }

  private _armDeadline(generation: number): void {
    this._clearTimer('_deadlineTimer');
    this._deadlineTimer = this._setTimeout(() => {
      this._deadlineTimer = null;
      this.fail(
        'CONNECT_TIMEOUT',
        `The realtime subscription to "${this.collection}" was not confirmed within ${this.timing.connectTimeoutMs}ms.`
      );
      this.transportDownFrom(generation, 'connect-timeout');
    }, this.timing.connectTimeoutMs);
  }

  private _clearTimer(which: '_reconnectTimer' | '_deadlineTimer'): void {
    const handle = this[which];
    if (handle === null || handle === undefined) return;
    this[which] = null;
    this._clearTimeout(handle);
  }

  private _safeClose(): void {
    try {
      this.closeTransport();
    } catch (e) {
      /* already closed, or never finished connecting */
    }
  }

  private _setStatus(status: RealtimeStatus): void {
    if (this._status === status) return;
    this._status = status;
    this._notify('onStatus', () => this._onStatus && this._onStatus(status));
  }
}

export function errorMessage(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message);
  return String(e);
}

/** `http(s)://host/path` with any trailing slashes removed, or `null` if it is not one. */
export function normalizedHttpBase(url: string | undefined): string | null {
  if (!url || typeof url !== 'string') return null;
  const cleaned = url.trim().replace(/\/+$/, '');
  return /^https?:\/\//i.test(cleaned) ? cleaned : null;
}

/** `http://` → `ws://`, `https://` → `wss://`. Returns `null` for anything else. */
export function webSocketBase(url: string | undefined): string | null {
  const cleaned = normalizedHttpBase(url);
  if (!cleaned) return null;
  return cleaned.replace(/^http/i, (m) => (m === 'HTTP' ? 'WS' : 'ws'));
}

/**
 * Record ids as {@link RealtimeChange.ids} promises them: strings, always.
 *
 * Directus decided this for every transport — its delete frame carries `["2"]` for row
 * `id: 2`, a real `integer` column (measured twice, BCN-008) — and normalising the other
 * way would mean guessing which backends have numeric keys.
 */
export function idsFromRecords(records: unknown[], primaryKey: string): string[] {
  const ids: string[] = [];
  for (const record of records) {
    if (!record || typeof record !== 'object') continue;
    const value = (record as Record<string, unknown>)[primaryKey];
    if (value === undefined || value === null) continue;
    ids.push(String(value));
  }
  return ids;
}
