/**
 * One SSE connection per backend, shared by every subscription on it — D46.
 *
 * ## The measurement this file exists because of
 *
 * `SseTransport`'s header called one stream per subscription "the honest trade", and
 * priced it at "one connection per subscribing node". That price was measured on
 * SBR-011's drive and it is not one connection — it is **the whole app**:
 *
 * | streams open | 1 | 2 | 3 | 4 | 5 | **6** |
 * |---|---:|---:|---:|---:|---:|---:|
 * | an ordinary same-origin request | 6ms | 3ms | 2ms | 2ms | 2ms | **never sent** |
 *
 * A browser holds six connections per origin. An SSE stream never ends, so six
 * subscriptions hold all six, and every *other* request to that backend — the app's
 * queries, its writes, and **the registration POSTs those very streams are waiting
 * for** — sits in the browser's queue. The site-builder template reached it with three,
 * because the page's own boot traffic occupies the rest.
 *
 * ⚠️ It presents as a *timeout*, never as a failure: Resource Timing read
 * `queued 15007ms, waited 5ms` — the POST was not slow and the server was not slow, the
 * request was never sent. The confirmation deadline then closed a stream, the freed slot
 * let the POST out, and `RealtimeSubscription` discarded the `200` because it belonged to
 * a generation that had already been replaced. A page went live only when a retry cycle
 * happened to win the race, which is why the same code read 6 streams on one run and 15
 * on the next.
 *
 * ## What is shared, and what deliberately is not
 *
 * **The key is the host, the dialect, the base URL, the token — and the filter.** Every
 * *unfiltered* subscription on one backend shares one stream; the union of their
 * collections goes in one POST, which is why `POST /realtime/subscriptions` taking an
 * array is the whole reason this is small.
 *
 * 🔴 **A subscription with a `where` gets its own connection, and that is not laziness.**
 * A shared stream delivers the union, and a consumer here filters only by collection name
 * (`SseDialect.parseChange`) — so a filtered subscriber sharing with an unfiltered one
 * would silently receive rows it asked not to see. Client-side evaluation of the
 * Parse-style `$` grammar is the only alternative and it is a second filter engine to
 * keep in step with `nodegx-backend/src/realtime/filter.ts`. So the boundary is drawn
 * where correctness is free: subscriptions with the **same** `(collection, filter)` still
 * share, subscriptions with different ones do not. An app with six *differently* filtered
 * subscriptions on one origin still reaches the ceiling, and that is recorded rather than
 * papered over.
 *
 * **The host is part of the key**, not decoration: `RealtimeDeps` is the environment — its
 * `EventSource` and its `fetch` — and two subscriptions given different ones are not on
 * the same wire whatever their URL says. Production passes no deps at all and therefore
 * shares one pool; a test passing its own doubles is isolated by construction.
 *
 * ## The two things a registry has to get right
 *
 * **1. The POST replaces the set.** Both servers' subscription POST *replaces* everything
 * registered for a `clientId` — which is what made a shared stream unsafe before there was
 * a registry, and is exactly why one is mandatory rather than an optimisation. So every
 * membership change re-POSTs the union, at most one POST is in flight at a time, and a
 * POST that completes against a superseded `clientId` (or a stale revision) re-posts
 * instead of settling anybody.
 *
 * **2. PocketBase names its change event after the collection.** A shared stream therefore
 * needs a *listener per collection*, added when the first member of that collection joins —
 * including joining a stream that is already open. Listeners are not removed when the last
 * member of a collection leaves: `RealtimeEventSourceLike` has no `removeEventListener`
 * (and adding one to the contract would buy nothing), the re-POST stops the server sending
 * that collection at all, and the listener set dies with the `EventSource`.
 *
 * @module api/backends/realtime/SseConnectionPool
 */

import type { RealtimeEventSourceLike, RealtimeFilter } from '@noodl/backend-contract/realtime';

import { errorMessage, type RealtimeFetch } from './RealtimeSubscription';
import type { SseDialect, SseSubscribeVerdict } from './SseTransport';

/** One entry in the union a registration POST carries. */
export interface SseSubscriptionRequest {
  collection: string;
  /** The backend's own filter dialect, absent on an unfiltered subscription. */
  where?: RealtimeFilter;
}

/**
 * What a shared connection needs of the subscription riding on it.
 *
 * Everything here is a report *into* the member's own state machine — the connection owns
 * the socket and the registration, the member owns its generation, deadline and backoff.
 */
export interface SseMember {
  readonly collection: string;
  readonly where: RealtimeFilter | undefined;
  /** A change frame arrived on this member's collection; `raw` is the parsed payload. */
  receiveFrame(raw: unknown): void;
  /** The server sent the dialect's resync frame. */
  receiveResync(): void;
  /** The union POST came back, and this is what it said about *this* member. */
  settle(verdict: SseSubscribeVerdict): void;
  /** The stream errored. `EventSource` retries on its own, so this is not a teardown. */
  interrupt(): void;
  /** The registration could not be made at all. */
  abort(message: string): void;
}

/**
 * A filter, as a string that is equal exactly when two filters are.
 *
 * ⚠️ `JSON.stringify` is key-order sensitive, so two equivalent filters written in a
 * different order key differently. That costs an extra connection and never costs
 * correctness, which is the right way round for this to be wrong.
 */
export function filterKey(where: RealtimeFilter | undefined): string {
  if (where === undefined || where === null) return '';
  try {
    return JSON.stringify(where);
  } catch (e) {
    // A cyclic filter cannot be sent to the server either; give it its own connection
    // rather than throwing on the way to finding that out.
    return ' uncomparable ';
  }
}

/** The identity of the connection a member belongs on. See the module docblock. */
export function connectionKey(dialect: string, base: string, token: string, where: RealtimeFilter | undefined): string {
  const filter = filterKey(where);
  return dialect + ' ' + base + ' ' + token + (filter ? ' #' + filter : '');
}

/**
 * One `EventSource`, the registry of who is on it, and the union POST.
 */
export class SharedSseConnection {
  private _es: RealtimeEventSourceLike | null = null;
  private _clientId: string | null = null;
  private readonly _members = new Set<SseMember>();
  /** Collections this stream already has change listeners for. Never shrinks — see docblock. */
  private readonly _listening = new Set<string>();
  /** Bumped by every membership change; what `_postedRevision` is compared against. */
  private _revision = 0;
  private _postedRevision = -1;
  private _inFlight = false;

  constructor(
    private readonly _dialect: SseDialect,
    private readonly _base: string,
    private readonly _token: string,
    private readonly _EventSourceImpl: new (url: string) => RealtimeEventSourceLike,
    private readonly _fetchImpl: RealtimeFetch,
    /** Called when the last member leaves, so the pool can drop this entry. */
    private readonly _onEmpty: () => void
  ) {}

  get size(): number {
    return this._members.size;
  }

  /** The stream's current client id, or `null` while it is waiting for the hello frame. */
  get clientId(): string | null {
    return this._clientId;
  }

  join(member: SseMember): void {
    if (this._members.has(member)) return;
    this._members.add(member);
    this._revision++;
    if (!this._es) {
      this._open();
      return;
    }
    // Joining a stream that is already up: the listener is owed immediately (PocketBase),
    // and the registration is owed as soon as there is a client id to register against.
    this._listen(member.collection);
    this._post();
  }

  leave(member: SseMember): void {
    if (!this._members.delete(member)) return;
    this._revision++;
    if (this._members.size === 0) {
      this._closeStream();
      this._onEmpty();
      return;
    }
    // The POST replaces the set, so a member leaving is a re-POST, not a no-op.
    this._post();
  }

  // -- the stream -----------------------------------------------------------

  private _open(): void {
    const dialect = this._dialect;
    const es = new this._EventSourceImpl(dialect.streamUrl(this._base, this._token));
    this._es = es;
    this._clientId = null;
    this._listening.clear();
    for (const member of this._members) this._listen(member.collection);

    es.addEventListener(dialect.helloEvent, (event) => {
      if (this._es !== es) return;
      let clientId: string | undefined;
      try {
        clientId = (JSON.parse(event.data) as { clientId?: string }).clientId;
      } catch (e) {
        return;
      }
      if (!clientId) return;
      // A fresh id on every connection, including an `EventSource`-initiated reconnect no
      // member ever saw — so registering again is mandatory, not an optimisation.
      this._clientId = clientId;
      this._postedRevision = -1;
      this._post();
    });

    if (dialect.resyncEvent) {
      es.addEventListener(dialect.resyncEvent, () => {
        if (this._es !== es) return;
        for (const member of [...this._members]) member.receiveResync();
      });
    }

    es.onerror = () => {
      if (this._es !== es) return;
      for (const member of [...this._members]) member.interrupt();
    };
  }

  /**
   * Listen for one collection's change frames.
   *
   * The NodeGX dialect names one event for every collection (`change`) and puts the
   * collection in the payload; PocketBase names the event after the collection and puts
   * nothing in the payload. Registering per collection satisfies both: the NodeGX case
   * ends up with one `change` listener per collection, and `parseChange` returns `null`
   * for a frame belonging to a different one, so a member is still delivered to once.
   */
  private _listen(collection: string): void {
    if (this._listening.has(collection)) return;
    this._listening.add(collection);
    const es = this._es;
    if (!es) return;
    for (const name of this._dialect.changeEvents(collection)) {
      es.addEventListener(name, (event) => {
        if (this._es !== es) return;
        let raw: unknown;
        try {
          raw = JSON.parse(event.data);
        } catch (e) {
          return;
        }
        for (const member of [...this._members]) {
          if (member.collection !== collection) continue;
          member.receiveFrame(raw);
        }
      });
    }
  }

  private _closeStream(): void {
    const es = this._es;
    this._es = null;
    this._clientId = null;
    this._listening.clear();
    this._postedRevision = -1;
    if (!es) return;
    es.onerror = null;
    es.close();
  }

  /** Tear the stream down without touching membership — the members' own funnels do that. */
  close(): void {
    this._closeStream();
  }

  // -- the registration -----------------------------------------------------

  /** How a member is matched to the entry it asked for. */
  private static _memberKey(member: SseMember): string {
    return member.collection + ' ' + filterKey(member.where);
  }

  /** The union, deduplicated: one entry per distinct `(collection, filter)`. */
  private _requested(): { entries: SseSubscriptionRequest[]; keys: Set<string> } {
    const keys = new Set<string>();
    const entries: SseSubscriptionRequest[] = [];
    for (const member of this._members) {
      const key = SharedSseConnection._memberKey(member);
      if (keys.has(key)) continue;
      keys.add(key);
      entries.push(
        member.where === undefined ? { collection: member.collection } : { collection: member.collection, where: member.where }
      );
    }
    return { entries, keys };
  }

  /**
   * POST the union, if there is anything new to say and nothing already in flight.
   *
   * At most one POST is outstanding because the server *replaces* the set: two in flight
   * would land in an order neither end controls, and the loser would silently unsubscribe
   * whoever the winner had just registered.
   */
  private _post(): void {
    const clientId = this._clientId;
    if (!clientId) return;
    if (this._inFlight) return;
    if (this._postedRevision === this._revision) return;
    if (this._members.size === 0) return;

    const revision = this._revision;
    this._inFlight = true;

    // 🔴 What was asked for, kept — because a verdict is only about the members that were
    // in the request. A member that joined while this POST was in flight is not named in
    // the body, so our own backend's `accepted[]` will not name it either; settling it
    // from this answer would report `SUBSCRIPTION_REJECTED` for a subscription nobody had
    // yet asked the server about, and tear it down before its own POST was ever sent.
    const { entries, keys } = this._requested();
    const { url, init } = this._dialect.subscribeRequest(this._base, this._token, clientId, entries);

    this._fetchImpl(url, init)
      .then((response) => {
        const status = response ? response.status : undefined;
        const readBody = response && typeof response.json === 'function' ? response.json() : Promise.resolve(null);
        // A 204 has no body; a rejected JSON parse must not look like a rejected
        // subscription.
        return readBody.catch(() => null).then((body) => ({ status, body }));
      })
      .then(({ status, body }) => {
        if (this._clientId !== clientId) {
          // A reply for a connection that has already been replaced says nothing about
          // this one — but the new one still owes a registration.
          this._inFlight = false;
          this._post();
          return;
        }
        this._postedRevision = revision;
        // ⚠️ Snapshot: settling a rejection takes that member down, which calls `leave`.
        // `_inFlight` stays true across the loop so those calls do not each fire a POST;
        // the one below sends the accumulated change once.
        for (const member of [...this._members]) {
          if (!keys.has(SharedSseConnection._memberKey(member))) continue;
          member.settle(this._dialect.readVerdict(status, body, member.collection));
        }
        this._inFlight = false;
        this._post();
      })
      .catch((e) => {
        const message = 'Could not register the realtime subscription: ' + errorMessage(e);
        if (this._clientId !== clientId) {
          this._inFlight = false;
          this._post();
          return;
        }
        for (const member of [...this._members]) {
          if (!keys.has(SharedSseConnection._memberKey(member))) continue;
          member.abort(message);
        }
        this._inFlight = false;
        this._post();
      });
  }
}

/**
 * The connections a given host is holding, keyed by {@link connectionKey}.
 *
 * A `WeakMap` on the `RealtimeDeps` object the caller passed — production passes none and
 * shares the one pool below; a test passing its own doubles gets its own pool and cannot
 * be contaminated by another test's, which is the reason no `reset()` is exported.
 */
const POOLS = new WeakMap<object, Map<string, SharedSseConnection>>();

/** The pool for every caller that named no host of its own. */
const DEFAULT_HOST: object = {};

export interface SseConnectionRequest {
  host: object | undefined;
  dialect: SseDialect;
  base: string;
  token: string;
  EventSourceImpl: new (url: string) => RealtimeEventSourceLike;
  fetchImpl: RealtimeFetch;
  where: RealtimeFilter | undefined;
}

/**
 * The connection a member belongs on, opening one if this host has none yet.
 *
 * The returned connection is *not* joined — the caller does that, so the member is a
 * complete object before it can be delivered to.
 */
export function connectionFor(request: SseConnectionRequest): SharedSseConnection {
  const host = request.host || DEFAULT_HOST;
  let pool = POOLS.get(host);
  if (!pool) {
    pool = new Map<string, SharedSseConnection>();
    POOLS.set(host, pool);
  }
  const key = connectionKey(request.dialect.name, request.base, request.token, request.where);
  const existing = pool.get(key);
  if (existing) return existing;

  const created = new SharedSseConnection(
    request.dialect,
    request.base,
    request.token,
    request.EventSourceImpl,
    request.fetchImpl,
    () => {
      // Only drop the entry if it is still this connection: a member that left and
      // rejoined within the same turn will have installed a new one.
      const current = POOLS.get(host);
      if (current && current.get(key) === created) current.delete(key);
    }
  );
  pool.set(key, created);
  return created;
}

/** How many connections a host is holding. Exists so a test can count them. */
export function openConnectionCount(host?: object): number {
  const pool = POOLS.get(host || DEFAULT_HOST);
  return pool ? pool.size : 0;
}
