/**
 * `IRealtimeAdapter` — server-pushed change notification, across transports that
 * agree on almost nothing.
 *
 * **This is not `events.ts`.** That fires on our own completed writes and needs
 * nothing from the server. This one is the change another user made in another
 * browser, and every backend delivers it differently: a WebSocket with an auth
 * handshake, an SSE stream with a POSTed subscription set, a Phoenix channel, or
 * — on most Parse deployments — nothing at all.
 *
 * Everything below was measured against live servers by
 * `dev-docs/tasks/phase-16-runtime-deploy-health/uba-e2e/bcn-008-realtime-probe.mjs`,
 * whose recorded output is `BCN-008-REALTIME-OUTPUT.txt` beside it. Where a fact
 * could not be measured it says so in the type, in prose, rather than being
 * quietly filled in from a manual — that habit is what BCN-002 and BCN-003 both
 * had to un-do.
 *
 * **No I/O here.** Types and frozen data, like the rest of this package. The
 * transports themselves are BCN-008 proper.
 *
 * @module backend-contract/realtime
 */

import type { BackendType, BackendHandle } from './backends';
import type { AdapterRecord } from './data';
import type { Filter } from './filter';

// ── What arrives ───────────────────────────────────────────────────────────

/**
 * The five things a subscription can report.
 *
 * `init` and `resync` are not writes and that is exactly why they are in the
 * union. `init` is Directus confirming a subscription and handing over the
 * current rows; `resync` is our own backend saying "you may have missed
 * something, re-run your query" — it has no replay log and neither will anything
 * else. A consumer that models only create/update/delete silently ignores the
 * one frame that tells it its view is stale.
 */
export type RealtimeEventType = 'init' | 'create' | 'update' | 'delete' | 'resync';

export const REALTIME_EVENT_TYPES: readonly RealtimeEventType[] = Object.freeze([
  'init',
  'create',
  'update',
  'delete',
  'resync'
]);

/**
 * One change, normalised.
 *
 * The shape is decided by the delete event, because the delete event is where the
 * transports disagree most and where the disagreement is invisible:
 *
 * | transport | delete carries | measured |
 * |---|---|---|
 * | Directus WS | `data: ["1"]` — the key alone, **as a string**, for an `integer` pk | yes |
 * | PocketBase SSE | the whole record, `id` a 15-char string | yes |
 * | NodeGX SSE | the whole record as it was immediately before deletion | yes |
 * | Supabase Realtime | `old_record`, primary key only unless `REPLICA IDENTITY FULL` | **no — see {@link RealtimeTransportProfile.measured}** |
 *
 * So {@link ids} is the guarantee and {@link records} is the bonus. An app author
 * can always answer "which row went away"; they can only sometimes answer "what
 * was in it". Making that difference a boolean field instead of a doc page is the
 * whole point — `records.length === 0` is ambiguous (an empty page? a
 * key-only delete?) and {@link recordsComplete} is not.
 */
export interface RealtimeChange {
  type: RealtimeEventType;
  collection: string;
  /**
   * Record ids, **always strings, always present** for create/update/delete.
   *
   * Strings even where the backend's primary key is an integer. Directus made
   * that choice for us — its delete frame carries `["1"]` for row `id: 1`
   * (measured) — and normalising the other way would mean guessing which
   * transports have numeric keys, so every transport coerces up. An app author
   * comparing this to a `Number` id from a query gets `false` and no error; the
   * record family is where that coercion belongs, and it belongs there once.
   */
  ids: string[];
  /**
   * The records themselves, where the transport sends them. Empty on a
   * key-only delete, and empty on `resync`.
   */
  records: AdapterRecord[];
  /**
   * Whether {@link records} is the whole story for this event.
   *
   * `false` means the transport told us less than the event implies — a Directus
   * delete, or a Supabase delete without `REPLICA IDENTITY FULL`. A node that
   * publishes a "deleted record" output must gate it on this, or it publishes an
   * empty object on one backend and a full record on another with nothing saying
   * why.
   */
  recordsComplete: boolean;
}

// ── Failure ────────────────────────────────────────────────────────────────

/**
 * Whether retrying could ever help.
 *
 * The distinction is not cosmetic: `byob-realtime.ts` marks `AUTH_FAILED` fatal
 * precisely because reconnecting with the same bad token loops forever, at one
 * attempt per backoff step, for as long as the page is open.
 */
export type RealtimeFailureKind = 'fatal' | 'retryable';

/**
 * Why a subscription is not delivering.
 *
 * Every code here is one a measured failure produced, not a category invented for
 * symmetry:
 *
 * - `TRANSPORT_UNAVAILABLE` — no `WebSocket`/`EventSource` in this host. Node 22
 *   has `WebSocket` and **no `EventSource`** (measured), which is one of the two
 *   independent reasons {@link REALTIME_SSR_COMPAT} is what it is.
 * - `CONNECT_FAILED` — the socket never established. Directus, PostgREST and a
 *   dead port all produce this, and on undici they produce it as `error` with no
 *   `close` ever following. See {@link RealtimeLifecycle}.
 * - `CONNECT_TIMEOUT` — nothing at all happened. A WebSocket opened against a
 *   real HTTP server on a path it does not upgrade fires **neither** `error` nor
 *   `close`; measured silent for the full 20s the probe waited. Without a timer
 *   this is a subscription that never connects and never reports.
 * - `AUTH_FAILED` — fatal by construction. Directus answers
 *   `{type:'auth',status:'error',error:{code:'AUTH_FAILED'}}` and closes 2ms
 *   later (measured).
 * - `SUBSCRIPTION_REJECTED` — connected, but this subscription was refused. Our
 *   own backend answers `200 {accepted:[],rejected:[{reason}]}` for an
 *   unsupported filter (measured) — a success status carrying a refusal, which
 *   is why the adapter has to read the body rather than the status.
 * - `HEARTBEAT_MISSED` — the connection is up and the server has stopped
 *   answering, or we have stopped answering the server. Directus closes a client
 *   that ignores one `ping`, 60s after the subscription (measured, code 1005).
 * - `CAPABILITY_UNAVAILABLE` — this backend has no realtime to connect to. The
 *   Parse-LiveQuery case: the probe's WebSocket errored in under 20ms and
 *   `/parse/serverInfo` never mentioned LiveQuery at all.
 */
export type RealtimeErrorCode =
  | 'TRANSPORT_UNAVAILABLE'
  | 'CONNECT_FAILED'
  | 'CONNECT_TIMEOUT'
  | 'AUTH_FAILED'
  | 'SUBSCRIPTION_REJECTED'
  | 'HEARTBEAT_MISSED'
  | 'CAPABILITY_UNAVAILABLE';

/**
 * A realtime failure.
 *
 * `kind` is **required**, for the same reason `Capability` makes `reason`
 * required: a transport that reports a failure without saying whether to retry
 * has handed the decision to whoever is least able to make it. The default
 * classification lives in {@link REALTIME_FAILURE_KINDS} so five transports
 * cannot each decide differently.
 */
export interface RealtimeError {
  message: string;
  code: RealtimeErrorCode;
  kind: RealtimeFailureKind;
}

/**
 * The one classification, as data.
 *
 * `AUTH_FAILED` and `CAPABILITY_UNAVAILABLE` are the fatal pair: a bad token
 * cannot become good by waiting, and a LiveQuery server that is not running will
 * not start because we reconnected. Everything else is worth another go —
 * including `SUBSCRIPTION_REJECTED`, which is retryable because the rejection may
 * be a permission that a subsequent login fixes. A transport is free to override
 * for a case it can prove (a filter the server will never accept is fatal), and
 * `undefined` here would mean "no default", which is not a thing any code should
 * have to handle.
 */
export const REALTIME_FAILURE_KINDS: Readonly<Record<RealtimeErrorCode, RealtimeFailureKind>> = Object.freeze({
  TRANSPORT_UNAVAILABLE: 'fatal',
  CONNECT_FAILED: 'retryable',
  CONNECT_TIMEOUT: 'retryable',
  AUTH_FAILED: 'fatal',
  SUBSCRIPTION_REJECTED: 'retryable',
  HEARTBEAT_MISSED: 'retryable',
  CAPABILITY_UNAVAILABLE: 'fatal'
});

// ── Lifecycle ──────────────────────────────────────────────────────────────

/**
 * What a subscription is doing right now.
 *
 * Four states, not the `subscribed: boolean` the shipped node uses. The boolean
 * cannot tell "connecting for the first time" from "dropped and retrying", and
 * those want different things on screen: a spinner and a warning respectively. It
 * also cannot express `stopped`, so a fatal `AUTH_FAILED` currently reads
 * identically to a slow connect that will succeed in a second.
 */
export type RealtimeStatus = 'connecting' | 'subscribed' | 'interrupted' | 'stopped';

/**
 * Why a connection went down — and the reason this enum exists at all.
 *
 * ⚠️ **`onclose` alone is not enough, and `onclose` + `onerror` is not enough
 * either.** Measured, four ways, in one run:
 *
 * | connecting to | `open` | `error` | `close` |
 * |---|---|---|---|
 * | a port with nothing listening | — | 1ms | **never** |
 * | a listening server that is not a WebSocket server | — | 20ms | **never** |
 * | a real WebSocket server on a path it does not upgrade | — | **never** | **never** |
 * | an unresolvable host | — | 16ms | **never** |
 *
 * (The milliseconds move between runs; the pattern did not, across two.)
 *
 * Node's undici WebSocket never fires `close` for a connect that fails before
 * establishing — that is RUN-003's trap, and it reproduces on every failure mode
 * tried. The fourth row is worse and was not previously known: a socket that
 * neither errors nor closes, silent for the whole 20s budget. A raw TCP upgrade
 * request to the same path confirmed why — Directus accepts the connection and
 * then sends no bytes at all, ever. Reconnect logic built on events alone cannot
 * recover from it.
 *
 * So the contract names all three paths. A transport satisfies
 * {@link RealtimeLifecycle} only by funnelling `close`, `error` **and** a
 * connect-deadline timer into one `transportDown`, once per socket.
 */
export type RealtimeDownReason =
  /** The `close`/`end` path — a clean or server-initiated shutdown. */
  | 'closed'
  /** The `error` path. On undici this is the ONLY path a failed connect takes. */
  | 'errored'
  /** Neither fired before {@link RealtimeTiming.connectTimeoutMs}. */
  | 'connect-timeout'
  /** A keepalive obligation was missed, in either direction. */
  | 'heartbeat-missed';

/**
 * The lifecycle every transport implements identically.
 *
 * Not a base class and not sugar: it is the list of the five things that were
 * each got wrong once, written down so the sixth transport cannot get them wrong
 * a sixth time.
 *
 * 1. `connect()` starts, and arms a connect deadline. Always. See
 *    {@link RealtimeDownReason} for the socket that fires nothing.
 * 2. `confirmed()` is the *server's* acknowledgement — Directus's `init` frame,
 *    PocketBase's `204` on the subscription POST, our own `accepted[]`. A socket
 *    being open is not a subscription being live, and three of the five backends
 *    will hold an open connection that delivers nothing.
 * 3. `transportDown(reason)` is the **only** entry to reconnection, and runs at
 *    most once per underlying socket. Every failure path leads here.
 * 4. `heartbeat` obligations run in whichever direction the backend demands, and
 *    they are not symmetrical: Directus **requires the client to answer** its
 *    `ping` and disconnects a silent client (measured: closed at 60s with code
 *    1005 after ignoring one ping), while our own backend and PocketBase require
 *    nothing of the client at all.
 * 5. `dispose()` is idempotent and stops everything, including timers.
 */
export interface RealtimeLifecycle {
  connect(): void;
  /** The server confirmed the subscription. Resets the backoff counter. */
  confirmed(): void;
  /** The single funnel. `reason` says which of the three paths got here. */
  transportDown(reason: RealtimeDownReason): void;
  dispose(): void;
  readonly status: RealtimeStatus;
}

/**
 * Timing, in one place, so "1s doubling to 30s" is a fact rather than a habit.
 *
 * `connectTimeoutMs` is the new one and it is not optional. RUN-003's
 * implementation has no connect deadline, which was survivable while Directus was
 * the only transport and it happened to always fire `error`; the measured
 * fires-nothing case means every transport needs one.
 */
export interface RealtimeTiming {
  readonly reconnectBaseMs: number;
  readonly reconnectMaxMs: number;
  /** How long to wait for `open` before calling it {@link RealtimeDownReason}. */
  readonly connectTimeoutMs: number;
}

/**
 * The shipped defaults.
 *
 * The backoff pair is `byob-realtime.ts`'s, unchanged — it survived a live
 * Directus restart and there is no reason to move it. `connectTimeoutMs` is 15s:
 * comfortably above every measured connect (the slowest definite answer in the
 * probe was 20ms) and comfortably below a user deciding the app is broken.
 */
export const REALTIME_TIMING: RealtimeTiming = Object.freeze({
  reconnectBaseMs: 1000,
  reconnectMaxMs: 30000,
  connectTimeoutMs: 15000
});

/**
 * Exponential backoff: 1s, 2s, 4s … capped at 30s.
 *
 * Exported as a function rather than left inside a transport because all of them
 * must agree, and because a doubling that overflows or a cap that is missed are
 * both silent — a subscription that retries every 4ms looks exactly like a
 * subscription that is working, from the outside.
 */
export function nextReconnectDelay(attempt: number, timing: RealtimeTiming = REALTIME_TIMING): number {
  const n = Number.isFinite(attempt) && attempt > 0 ? Math.floor(attempt) : 0;
  return Math.min(timing.reconnectMaxMs, timing.reconnectBaseMs * Math.pow(2, Math.min(n, 30)));
}

// ── Injectable dependencies ────────────────────────────────────────────────

/** A socket as a transport uses one — the browser and undici shapes agree this far. */
export interface RealtimeSocketLike {
  onopen: ((...args: unknown[]) => void) | null;
  onmessage: ((event: { data: string }) => void) | null;
  onclose: ((...args: unknown[]) => void) | null;
  onerror: ((...args: unknown[]) => void) | null;
  send(data: string): void;
  close(): void;
}

/** An `EventSource` as a transport uses one. */
export interface RealtimeEventSourceLike {
  addEventListener(type: string, listener: (event: { data: string }) => void): void;
  onerror: ((...args: unknown[]) => void) | null;
  close(): void;
}

/**
 * Everything a transport touches that is not its own logic.
 *
 * This is the property that made RUN-003's connection machinery testable at all —
 * 25 unit tests, no server — and it is in the contract so it cannot be dropped by
 * the next transport in a hurry. Every field is optional and falls back to the
 * host global; an explicit `null` means "this host has none", which is a case
 * tests need and which `undefined` cannot express (`'WebSocketImpl' in options`
 * is how the shipped code distinguishes them).
 */
export interface RealtimeDeps {
  WebSocketImpl?: (new (url: string) => RealtimeSocketLike) | null;
  EventSourceImpl?: (new (url: string) => RealtimeEventSourceLike) | null;
  fetchImpl?: (url: string, init?: unknown) => Promise<unknown>;
  setTimeoutImpl?: (fn: () => void, delay: number) => unknown;
  clearTimeoutImpl?: (handle: unknown) => void;
}

// ── The contract ───────────────────────────────────────────────────────────

export interface RealtimeCallbacks {
  onEvent?: (change: RealtimeChange) => void;
  onStatus?: (status: RealtimeStatus) => void;
  onError?: (error: RealtimeError) => void;
}

/**
 * What to watch.
 *
 * `filter` is server-side where the backend has one — ours accepts a `Filter` and
 * rejects what it cannot evaluate by name (measured: `"$nonsense" is not
 * supported in realtime subscription filters`), PocketBase takes an expression,
 * Directus takes none on a subscribe at all. A transport that cannot filter
 * server-side must **not** filter client-side and call it the same thing: the
 * events it never receives are not events it filtered out, and BCN-008 proper
 * declares that difference rather than papering over it.
 */
export interface RealtimeSubscribeOptions extends RealtimeCallbacks {
  collection: string;
  where?: Filter;
  /** See {@link RealtimeDeps}. */
  deps?: RealtimeDeps;
  timing?: RealtimeTiming;
}

/** The handle a caller holds. `dispose` is idempotent and the only way out. */
export interface RealtimeHandle extends Pick<RealtimeLifecycle, 'dispose' | 'status'> {
  readonly collection: string;
}

/**
 * One method.
 *
 * `IDataAdapter` has fourteen because `CloudStore` had fourteen. This has one
 * because there is one thing to do, and the interesting content is in the
 * lifecycle the returned handle obeys rather than in a method list. A `subscribe`
 * that returns a handle (rather than taking an `unsubscribe` callback, the
 * `{success, error}` idiom's nearest equivalent) is the one deviation from the
 * house style in this package, and it is deliberate: a subscription outlives the
 * call that made it, so something has to be holdable.
 */
export interface IRealtimeAdapter {
  /** Which wire this adapter speaks. Read by the editor for its disclosure text. */
  readonly transport: RealtimeTransport;
  subscribe(handle: BackendHandle, options: RealtimeSubscribeOptions): RealtimeHandle;
}

export const REALTIME_ADAPTER_METHODS = Object.freeze(['subscribe'] as const) satisfies readonly (keyof IRealtimeAdapter)[];

/**
 * ⚠️ **`client-only`, on every transport, for two independent reasons.**
 *
 * The one the spec gives: a server render must not open a socket per request —
 * an SSR process answering a thousand requests would hold a thousand live
 * subscriptions to a change stream nobody will ever read.
 *
 * The one the probe found: Node 22.22 has **no global `EventSource`** (measured:
 * `typeof EventSource === 'undefined'`). Two of the three transports are written
 * against it, so they cannot construct one server-side even if the first reason
 * did not apply. Which means an SSR render does not fail loudly here — it fails
 * with `EventSource is not available in this environment` on a path nothing
 * renders, or not at all. `client-only` is the mechanism that makes it a
 * non-event.
 */
export const REALTIME_SSR_COMPAT = 'client-only' as const;

// ── The measured transport profiles ────────────────────────────────────────

export type RealtimeTransport = 'websocket' | 'sse' | 'phoenix-channel' | 'none';

/** Who owes whom a keepalive, and how often. */
export interface RealtimeKeepalive {
  /**
   * - `server-ping-client-pong` — the server sends, the **client must answer**,
   *   or it is disconnected. Directus.
   * - `server-comment` — the server sends a keepalive the client ignores.
   * - `none-observed` — nothing arrived on an idle stream for the whole watch.
   */
  readonly rule: 'server-ping-client-pong' | 'server-comment' | 'none-observed';
  /** Measured interval in ms, or `null` when nothing was observed. */
  readonly intervalMs: number | null;
  /** How long an idle stream was watched, so `none-observed` has a bound on it. */
  readonly observedForMs: number;
  /** Measured ms from subscription to a server-side close when the client stays silent. */
  readonly disconnectsSilentClientAfterMs?: number;
}

/** What a delete event carries — the question this whole file is shaped around. */
export interface RealtimeDeleteContract {
  readonly carries: 'keys-only' | 'full-record';
  /** The type of the key **on the wire**, before normalisation. */
  readonly wireKeyType: 'string' | 'number' | 'unknown';
  /** True when the wire key type differs from the same backend's REST key type. */
  readonly coercedFromRest: boolean;
}

/**
 * One backend's realtime surface, as measured.
 *
 * `measured` is the field that matters. BCN-001 shipped a table of realtime cells
 * written from documentation and every one of them was a guess; two turned out to
 * be about services that are not in the rig. A profile that cannot say it was
 * measured says so.
 */
export interface RealtimeTransportProfile {
  readonly type: BackendType;
  readonly transport: RealtimeTransport;
  /** Path from the backend's base URL, or `null` when there is nothing to open. */
  readonly streamPath: string | null;
  /** How a client says what it wants, in one phrase. */
  readonly subscribe: string;
  /** What confirms the subscription is actually live. */
  readonly confirmation: string;
  readonly deleteEvent: RealtimeDeleteContract | null;
  readonly keepalive: RealtimeKeepalive | null;
  /** How a failed connect presents, in the observed order. */
  readonly connectFailure: string;
  /**
   * Whether this row came from a live server.
   *
   * `false` is not a defect — it is the honest state for a service the rig does
   * not run — but it **must** keep the matching descriptor cell out of
   * `supported`. See BCN-008-NOTES.md's could-not-verify list.
   */
  readonly measured: boolean;
  readonly evidence: string;
}

const PROBE = 'bcn-008-realtime-probe.mjs, 2026-07-31';

/**
 * The second run, and the one that closed BCN-008's success criterion 2.
 *
 * The probe above asked the servers what they do. This one drove the **shipped**
 * transports (`noodl-runtime/src/api/backends/realtime`) against the same servers and then
 * **restarted the backend underneath each live subscription** — which the measurement pass
 * could not do, because two other workers shared the rig. Reconnect-and-resubscribe was
 * unverified for every transport until this run, the shipped Directus one included.
 */
const DRIVER = 'bcn-008-realtime-driver.ts + bcn-008-node-driver.ts, 2026-08-01';

const DIRECTUS_RT: RealtimeTransportProfile = {
  type: 'directus',
  transport: 'websocket',
  streamPath: '/websocket',
  subscribe: "{type:'auth',access_token} → {type:'auth',status:'ok'} → {type:'subscribe',collection,uid}",
  confirmation: "{type:'subscription',event:'init',data:[…rows],uid}",
  // ⚠️ THE finding this file exists for. `id: 1` (integer pk) deletes as `["1"]`.
  deleteEvent: { carries: 'keys-only', wireKeyType: 'string', coercedFromRest: true },
  keepalive: {
    rule: 'server-ping-client-pong',
    intervalMs: 30000,
    observedForMs: 45000,
    // One ignored ping, then gone. Measured, code 1005, empty reason.
    disconnectsSilentClientAfterMs: 60000
  },
  connectFailure:
    "open in single-digit ms on success; a bad token gives {type:'auth',status:'error',error:{code:'AUTH_FAILED'}} ~10ms after the send, then close ~2ms later",
  measured: true,
  evidence:
    `${PROBE}: numeric pk 2 arrived as data:["2"]; ping at 30016ms; silent client closed at 60035ms, code 1005. ` +
    `${DRIVER}: \`docker restart uba-e2e-directus-1\` under a live subscription → interrupted → subscribed → a row ` +
    `written AFTER the restart was delivered, at the transport AND through a real Query Records node. 72s of client ` +
    `silence did NOT drop the subscription (removing the pong makes exactly that check fail).`
};

const POCKETBASE_RT: RealtimeTransportProfile = {
  type: 'pocketbase',
  transport: 'sse',
  streamPath: '/api/realtime',
  subscribe: "GET the stream → PB_CONNECT gives clientId → POST /api/realtime {clientId, subscriptions:['coll']} → 204",
  // ⚠️ A 204 is NOT a confirmation that anything will arrive — see the note below.
  confirmation: '204 on the subscription POST (delivery is gated separately, at event time)',
  deleteEvent: { carries: 'full-record', wireKeyType: 'string', coercedFromRest: false },
  // Nothing at all on an idle stream for 130s. Not "there is no keepalive" —
  // "none was observed within the window", which is what the field says.
  keepalive: { rule: 'none-observed', intervalMs: null, observedForMs: 130000 },
  connectFailure:
    'the stream is plain fetch/EventSource: a dead host rejects the request. An unknown clientId on the subscription POST is 404 {"message":"Missing or invalid client id."}',
  measured: true,
  evidence:
    `${PROBE}: SSE event name is the COLLECTION name, not "change"; data is {record,action}; a superuser-only ` +
    `collection accepted an anonymous subscription with 204 and then delivered nothing. ` +
    `${DRIVER}: \`docker restart uba-e2e-pocketbase-1\` under a live subscription → reconnected, re-POSTed the ` +
    `subscription set with the fresh clientId, and delivered a row written after the restart. The accepted-then-silent ` +
    `case was re-measured through the shipped transport: it reports \`subscribed\` and receives nothing.`
};

const NODEGX_RT: RealtimeTransportProfile = {
  type: 'nodegx',
  transport: 'sse',
  streamPath: '/realtime',
  subscribe: "GET the stream → 'connected' gives clientId → POST /realtime/subscriptions {clientId, subscriptions:[{collection, filter?}]}",
  confirmation: '200 with a non-empty `accepted[]` — the body, not the status: a rejection also answers 200',
  deleteEvent: { carries: 'full-record', wireKeyType: 'string', coercedFromRest: false },
  keepalive: { rule: 'server-comment', intervalMs: 25000, observedForMs: 30000 },
  connectFailure:
    'fetch rejects for an unreachable host; an unknown clientId is 404; an unsupported filter is 200 with rejected[].reason',
  measured: true,
  evidence:
    `${PROBE}: heartbeat comment ": heartbeat" at 25026ms; a Last-Event-ID reconnect answers connected then ` +
    `resync{reason:"reconnect"} with a FRESH clientId. ` +
    `${DRIVER}: the backend process killed and relaunched under a live subscription (the rig has no nodegx-backend ` +
    `container) → reconnected, re-registered, delivered a row written after the restart, and raised 2 resync frames. ` +
    `Also confirmed live that a 200 carrying rejected[] is NOT a subscription.`
};

/**
 * ⚠️ **Not measured, and the rig cannot measure it.**
 *
 * The `supabase` compose profile is one Postgres and one PostgREST container.
 * Supabase Realtime is a separate Elixir service speaking Phoenix channels and it
 * is not in `docker-compose.yml` at all — the probe confirmed there is nothing on
 * `/realtime/v1/websocket` (`error` in 5ms), nothing on the descriptor's own
 * health path (404), and nothing on ports 4000 or 54321.
 *
 * Everything below is therefore **documentation**, kept only so the shape is
 * legible, and `measured: false` is what keeps the descriptor cell honest.
 */
const SUPABASE_RT: RealtimeTransportProfile = {
  type: 'supabase',
  transport: 'phoenix-channel',
  streamPath: '/realtime/v1/websocket',
  subscribe: "phx_join on a topic, with a postgres_changes config — DOCUMENTED, NOT PROBED",
  confirmation: "phx_reply with status 'ok' — DOCUMENTED, NOT PROBED",
  // Documented: `old_record` carries the primary key only unless the table is set
  // to REPLICA IDENTITY FULL. Recorded as unknown rather than guessed, because
  // guessing this exact field is what cost RUN-003 a rewrite on Directus.
  deleteEvent: { carries: 'keys-only', wireKeyType: 'unknown', coercedFromRest: false },
  keepalive: null,
  connectFailure: 'unknown — nothing was listening to fail against',
  measured: false,
  evidence: `${PROBE}: ws://localhost:8056/realtime/v1/websocket → error@5ms; /realtime/v1/api/tenants/realtime/health → 404; ports 4000 and 54321 silent. No Supabase Realtime exists in this rig.`
};

/**
 * ⚠️ **LiveQuery is not running, and its absence is quiet.**
 *
 * Parse Server 7.3.0, master key, `/parse/serverInfo`: the feature list is
 * `globalConfig, hooks, cloudCode, logs, push, schemas, settings` — no LiveQuery
 * entry of any kind. Opening the socket a Parse SDK would open errors in 20ms
 * with "Received network error or non-101 status code", and a raw upgrade request
 * is answered by the ordinary HTTP server.
 *
 * That 20ms is the useful number: `conditional` is affordable. A probe with a
 * short deadline settles this cell before anything renders, and BCN-001's whole
 * argument for the four-state model rests on this row.
 */
const PARSE_RT: RealtimeTransportProfile = {
  type: 'parse',
  transport: 'none',
  streamPath: null,
  subscribe: "{op:'connect',applicationId,…} then {op:'subscribe',requestId,query} — on a LiveQuery server, if one is running",
  confirmation: "{op:'connected'} then {op:'subscribed'} — never reached here",
  deleteEvent: null,
  keepalive: null,
  connectFailure: 'error at 20ms, "Received network error or non-101 status code"; `close` never fires',
  measured: true,
  evidence: `${PROBE}: /parse/serverInfo advertises no liveQuery; ws://localhost:8092/parse errors in 20ms and a raw upgrade request is answered 403 by the ordinary Express app. This is a measurement that LiveQuery is ABSENT, not that it works.`
};

/**
 * `custom` has no row.
 *
 * A user's own API might push changes over anything or nothing, and the descriptor
 * is `declarable` for exactly this reason. Inventing a profile would be inventing
 * a wire we have never seen.
 */
export const REALTIME_TRANSPORT_PROFILES: Readonly<Record<Exclude<BackendType, 'custom'>, RealtimeTransportProfile>> =
  Object.freeze({
    nodegx: NODEGX_RT,
    parse: PARSE_RT,
    directus: DIRECTUS_RT,
    supabase: SUPABASE_RT,
    pocketbase: POCKETBASE_RT
  });

/** The profile for a backend type, or `undefined` for `custom`. */
export function realtimeProfileFor(type: BackendType): RealtimeTransportProfile | undefined {
  return (REALTIME_TRANSPORT_PROFILES as Record<string, RealtimeTransportProfile | undefined>)[type];
}

/**
 * Can an app author rely on a delete event carrying the record's fields?
 *
 * The single question a node's "deleted record" output has to answer, in one
 * place, from measured data — so the answer cannot be different in the editor's
 * disclosure text and in the runtime's event handler.
 */
export function deleteCarriesRecord(type: BackendType): boolean {
  return realtimeProfileFor(type)?.deleteEvent?.carries === 'full-record';
}
