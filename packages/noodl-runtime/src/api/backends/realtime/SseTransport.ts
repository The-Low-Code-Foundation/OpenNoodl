/**
 * Realtime over Server-Sent Events — our own backend and PocketBase.
 *
 * Both follow the same three-step shape and **agree on none of the details**, which is why
 * this is one class plus a dialect rather than two classes or one class with two `if`s:
 *
 * | | **NodeGX** (BAK-001) | **PocketBase 0.30** |
 * |---|---|---|
 * | stream | `GET /realtime?token=` | `GET /api/realtime` |
 * | hello frame | `event: connected`, `{clientId}` | `event: PB_CONNECT`, `{clientId}` |
 * | register | `POST /realtime/subscriptions {clientId, subscriptions:[{collection, filter?}]}` | `POST /api/realtime {clientId, subscriptions:['coll']}` |
 * | confirmed by | `200` **with a non-empty `accepted[]`** | `204` |
 * | change frame name | `change` | ⚠️ **the collection's own name** |
 * | change payload | `{action, collection, record}` | `{action, record}` |
 * | delete carries | the whole pre-delete record | the whole record |
 * | keepalive | `: heartbeat` comment at 25s, client owes nothing | none observed in 130s |
 *
 * Every cell there is measured (BCN-008's probe, output in `BCN-008-REALTIME-OUTPUT.txt`).
 * The two that would have been guessed wrong are the ones in bold.
 *
 * ## Three things this file exists to get right
 *
 * **1. Read the body, not the status.** Our backend answers `200` to a subscription it has
 * *rejected*: `{accepted: [], rejected: [{reason}]}` for a filter it cannot evaluate. A
 * transport that trusts `res.ok` reports a live subscription that will never deliver
 * anything. PocketBase does the mirror image — `204` for an anonymous subscription to a
 * superuser-only collection, and then silence — and there `204` is genuinely all the
 * information the wire carries, so the base class's confirmation deadline is the only
 * thing standing between an app author and a spinner that never resolves. Recorded as a
 * limit rather than papered over.
 *
 * **2. Re-register on every hello frame.** Both servers mint a *fresh* `clientId` per
 * connection — measured: a `Last-Event-ID` reconnect to our backend answers `connected`
 * with a new id and then `resync{reason:'reconnect'}` — so the POST is mandatory after
 * every reconnect, not an optimisation. `EventSource` reconnecting on its own is the
 * common case, and it does not tell us; the hello frame does.
 *
 * **3. One stream per BACKEND, shared — and it took a measurement to get here.** Both
 * servers' subscription POST *replaces* the set for a `clientId`, and this file used to
 * read that as a reason for one `EventSource` per subscription: *"the cost is one
 * connection per subscribing node, which is the honest trade"*. 🔴 **The cost was measured
 * on SBR-011's drive and it is not one connection, it is the app** — a browser holds six
 * per origin, an SSE stream never ends, and the sixth one stops every other request to
 * that backend from being *sent*, including the registration POSTs the streams themselves
 * are waiting for (D46). So the registry the old note called the alternative is now
 * {@link SseConnectionPool}, and "replaces the set" is the reason it is mandatory rather
 * than an argument against it. What this class still owns is one subscription's state
 * machine; what it no longer owns is the socket.
 *
 * @module api/backends/realtime/SseTransport
 */

import type { BackendHandle } from '@noodl/backend-contract';
import type {
  RealtimeChange,
  RealtimeEventSourceLike,
  RealtimeFilter,
  RealtimeTransport
} from '@noodl/backend-contract/realtime';

import {
  connectionFor,
  type SharedSseConnection,
  type SseMember,
  type SseSubscriptionRequest
} from './SseConnectionPool';
import {
  RealtimeSubscription,
  normalizedHttpBase,
  type RealtimeSubscriptionOptions
} from './RealtimeSubscription';

/** What the subscription POST said, once the body has been read. */
export interface SseSubscribeVerdict {
  ok: boolean;
  /** Present when `ok` is false and the server said why. */
  reason?: string;
}

/** One SSE server's dialect. Every field is a place the two measured servers differ. */
export interface SseDialect {
  readonly name: string;
  /** The stream URL, token included where the server takes one in the query string. */
  streamUrl(base: string, token: string): string;
  /** The event name carrying `{clientId}`. */
  readonly helloEvent: string;
  /** The event names carrying changes. PocketBase's is the collection name. */
  changeEvents(collection: string): string[];
  /** Extra event names to listen for, mapped straight to a {@link RealtimeChange} type. */
  readonly resyncEvent?: string;
  /**
   * The registration request for **every** subscription on this stream at once.
   *
   * ⚠️ An array, not one collection, because the POST *replaces* the set for a
   * `clientId` — see {@link SseConnectionPool}. Both measured servers already take one.
   */
  subscribeRequest(
    base: string,
    token: string,
    clientId: string,
    subscriptions: readonly SseSubscriptionRequest[]
  ): { url: string; init: Record<string, unknown> };
  /**
   * Whether the registration took **for one collection**, from the status and the body.
   *
   * Per collection rather than per response, because a union POST can be answered with
   * some accepted and some rejected — our own backend gates each entry on that
   * collection's `find` CLP independently (`RealtimeHub.setSubscriptions`).
   */
  readVerdict(status: number | undefined, body: unknown, collection: string): SseSubscribeVerdict;
  /** One change frame, normalised. `null` for a frame this dialect ignores. */
  parseChange(collection: string, primaryKey: string, raw: unknown): RealtimeChange | null;
}

// ── NodeGX (BAK-001's ChangeBus, over SSE) ─────────────────────────────────

/** `{accepted, rejected}` — the body our own backend answers a subscription POST with. */
interface NodeGXVerdictBody {
  accepted?: unknown[];
  rejected?: { collection?: string; reason?: string }[];
}

/**
 * Whether an `accepted[]` / `rejected[]` entry is about `collection`.
 *
 * `RealtimeHub.setSubscriptions` names the collection on **every** entry it pushes, which
 * is what makes a union POST readable per member at all. An entry that names nothing is
 * treated as being about whatever is asking — the only producer of one is a fixture, and
 * a fixture that means "the POST was accepted" should not have to say which of one
 * collection it meant.
 */
function entryIsAbout(entry: unknown, collection: string): boolean {
  if (!entry || typeof entry !== 'object') return true;
  const named = (entry as { collection?: unknown }).collection;
  if (typeof named !== 'string') return true;
  return named === collection;
}

export const NODEGX_SSE: SseDialect = {
  name: 'nodegx',
  // EventSource cannot set headers, so the token rides in the query string. This is the
  // shipped BAK-001 behaviour and the server reads it there.
  streamUrl: (base, token) => base + '/realtime' + (token ? '?token=' + encodeURIComponent(token) : ''),
  helloEvent: 'connected',
  changeEvents: () => ['change'],
  resyncEvent: 'resync',
  subscribeRequest(base, token, clientId, subscriptions) {
    // ⚠️ `where` is the **Parse-style `$` grammar**, not the neutral `Filter` — see
    // `RealtimeFilter`. `nodegx-backend/src/realtime/filter.ts` evaluates it with
    // `matchOperator`, which throws on any other operator name, and `RealtimeHub` then
    // fails closed: a confirmed subscription that delivers nothing, forever, silently.
    const body = subscriptions.map((subscription) =>
      subscription.where === undefined
        ? { collection: subscription.collection }
        : { collection: subscription.collection, filter: subscription.where }
    );
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (token) headers['authorization'] = 'Bearer ' + token;
    return {
      url: base + '/realtime/subscriptions',
      init: {
        method: 'POST',
        headers,
        body: JSON.stringify({ clientId, subscriptions: body })
      }
    };
  },
  readVerdict(_status, body, collection) {
    // ⚠️ The status is 200 either way. `accepted[]` is the answer — and on a union POST it
    // is the answer for some collections and not others, so read the entries, not the
    // length.
    const verdict = (body || {}) as NodeGXVerdictBody;
    const accepted = Array.isArray(verdict.accepted) ? verdict.accepted : [];
    if (accepted.some((entry) => entryIsAbout(entry, collection))) return { ok: true };
    const rejected = Array.isArray(verdict.rejected) ? verdict.rejected : [];
    const mine = rejected.filter((entry) => entryIsAbout(entry, collection))[0];
    return { ok: false, reason: (mine && mine.reason) || undefined };
  },
  parseChange(collection, primaryKey, raw) {
    const payload = raw as { action?: string; collection?: string; record?: Record<string, unknown> };
    const action = payload && payload.action;
    if (action !== 'create' && action !== 'update' && action !== 'delete') return null;
    // A shared stream would deliver other collections; ours does not today, but the
    // frame carries the name so the check is free.
    if (payload.collection && payload.collection !== collection) return null;

    const record = payload.record;
    const id = record ? record.objectId ?? record[primaryKey] : undefined;
    return {
      type: action,
      collection,
      ids: id === undefined || id === null ? [] : [String(id)],
      // Measured: a delete carries the whole record as it was immediately before.
      records: record ? [record] : [],
      recordsComplete: !!record
    };
  }
};

// ── PocketBase 0.30 ────────────────────────────────────────────────────────

export const POCKETBASE_SSE: SseDialect = {
  name: 'pocketbase',
  // ⚠️ No token in the URL: PocketBase does not read one there, and the whole measured
  // probe ran anonymously and worked. The POST carries `Authorization` when we have one.
  streamUrl: (base) => base + '/api/realtime',
  helloEvent: 'PB_CONNECT',
  // ⚠️ THE surprise in this dialect: the SSE event name is the collection's own name.
  // A listener on 'change' receives nothing, forever, with no error anywhere.
  changeEvents: (collection) => [collection],
  subscribeRequest(base, token, clientId, subscriptions) {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (token) headers['authorization'] = token;
    // A flat list of names, not objects, and it REPLACES the set for this clientId.
    // ⚠️ PocketBase carries no filter on the wire at all, so two members of the same
    // collection collapse to one name here even though the pool keeps them apart.
    const names: string[] = [];
    for (const subscription of subscriptions) {
      if (names.indexOf(subscription.collection) === -1) names.push(subscription.collection);
    }
    return {
      url: base + '/api/realtime',
      init: {
        method: 'POST',
        headers,
        body: JSON.stringify({ clientId, subscriptions: names })
      }
    };
  },
  readVerdict(status, body) {
    if (status === 204 || status === 200) return { ok: true };
    const message = body && typeof body === 'object' ? (body as { message?: string }).message : undefined;
    // Measured: an unknown clientId is `404 {"message":"Missing or invalid client id."}`.
    return { ok: false, reason: message || (status === undefined ? undefined : 'HTTP ' + status) };
  },
  parseChange(collection, primaryKey, raw) {
    const payload = raw as { action?: string; record?: Record<string, unknown> };
    const action = payload && payload.action;
    if (action !== 'create' && action !== 'update' && action !== 'delete') return null;

    const record = payload.record;
    const id = record ? record[primaryKey] ?? record.id : undefined;
    return {
      type: action,
      collection,
      ids: id === undefined || id === null ? [] : [String(id)],
      records: record ? [record] : [],
      recordsComplete: !!record
    };
  }
};

// -- the transport ----------------------------------------------------------

/**
 * One subscription, riding a stream it shares with every other subscription on the same
 * backend.
 *
 * The split is the whole point of D46's fix: {@link SharedSseConnection} owns the socket,
 * the client id and the union registration; this class owns one subscription's state
 * machine — its generation, its confirmation deadline, its backoff — exactly as before.
 * A member reports *into* itself through the four callbacks below, which is why a
 * rejection takes one subscription down and leaves its neighbours subscribed.
 */
export class SseTransport extends RealtimeSubscription {
  readonly transport: RealtimeTransport = 'sse';

  private readonly _dialect: SseDialect;
  private _connection: SharedSseConnection | null = null;
  private _member: SseMember | null = null;

  constructor(handle: BackendHandle, options: RealtimeSubscriptionOptions, dialect: SseDialect) {
    super(handle, options);
    this._dialect = dialect;
  }

  /** Which SSE server this is talking to — `nodegx` or `pocketbase`. */
  get dialect(): string {
    return this._dialect.name;
  }

  protected openTransport(generation: number): void {
    const EventSourceImpl = this.resolveEventSource();
    if (!EventSourceImpl) {
      // Node 22 has `WebSocket` and no `EventSource` (measured) — which is the second,
      // independent reason `REALTIME_SSR_COMPAT` is `client-only`.
      this.fail('TRANSPORT_UNAVAILABLE', 'EventSource is not available in this environment.');
      return;
    }

    // ⚠️ Resolved here rather than when the hello frame arrives: a shared connection is
    // built from both, and a host with an `EventSource` and no `fetch` cannot register
    // anything, so finding out before opening a stream is strictly better than after.
    const fetchImpl = this.resolveFetch();
    if (!fetchImpl) {
      this.fail('TRANSPORT_UNAVAILABLE', 'fetch is not available to register the realtime subscription.');
      return;
    }

    const base = normalizedHttpBase(this.handle.url);
    if (!base) {
      this.fail('CONNECT_FAILED', `Backend URL is not a valid http(s) URL: ${this.handle.url}`, 'fatal');
      return;
    }

    const connection = connectionFor({
      host: this.hostKey,
      dialect: this._dialect,
      base,
      token: this.token,
      EventSourceImpl,
      fetchImpl,
      where: this.where
    });
    const member = this._buildMember(generation);
    this._connection = connection;
    this._member = member;
    connection.join(member);
  }

  protected closeTransport(): void {
    const connection = this._connection;
    const member = this._member;
    this._connection = null;
    this._member = null;
    // ⚠️ Leaving is not the same as closing: the stream stays up for whoever else is on
    // it, and the registry re-POSTs the union without this one. It closes only when the
    // last member has gone.
    if (connection && member) connection.leave(member);
  }

  /**
   * This subscription's face to the shared connection.
   *
   * A fresh one per generation, so a report that arrives for a connection this
   * subscription has already left is dropped by the registry rather than raced here — the
   * `this._clientId !== clientId` guard the un-shared version needed is now the registry's,
   * and it is the same guard.
   */
  private _buildMember(generation: number): SseMember {
    const dialect = this._dialect;
    return {
      collection: this.collection,
      where: this.where,

      receiveFrame: (raw: unknown): void => {
        const change = dialect.parseChange(this.collection, this.primaryKey, raw);
        if (change) this.emitChange(change);
      },

      receiveResync: (): void => {
        // No replay log on either server. `resync` is the frame that says "your view may
        // be stale, re-run your query" — a consumer modelling only create/update/delete
        // ignores the one message that tells it so.
        this.emitChange({
          type: 'resync',
          collection: this.collection,
          ids: [],
          records: [],
          recordsComplete: false
        });
      },

      settle: (verdict: SseSubscribeVerdict): void => {
        if (verdict.ok) {
          this.confirmed();
          return;
        }
        this.fail(
          'SUBSCRIPTION_REJECTED',
          `The subscription to "${this.collection}" was rejected: ${verdict.reason || 'no reason given'}`
        );
        // Retryable in the table, so hand it to the one backoff rather than staying on a
        // stream that will never deliver to this member until the deadline notices.
        this.transportDownFrom(generation, 'closed');
      },

      interrupt: (): void => {
        // ⚠️ `EventSource` reconnects on its own, and its retry keeps `Last-Event-ID` —
        // which is what earns our backend's `resync` frame. So an error is NOT reported
        // down the funnel immediately: the confirmation deadline is re-armed instead, and
        // if the stream has not delivered a fresh hello frame by the time it fires, the
        // funnel runs and our own backoff takes over. Closing here would trade a measured
        // server behaviour for a uniform-looking one.
        this.interrupted(generation);
      },

      abort: (message: string): void => {
        this.fail('CONNECT_FAILED', message);
        this.transportDownFrom(generation, 'closed');
      }
    };
  }
}
