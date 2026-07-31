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
 * **3. One stream per subscription, deliberately.** Both servers' subscription POST
 * *replaces* the set for a `clientId`. Two subscriptions sharing a stream would silently
 * clobber each other, so each owns its own `EventSource`. The cost is one connection per
 * subscribing node, which is the honest trade: the alternative is a shared registry that
 * has to be right about ordering, and a wrong one presents as "the other node stopped
 * receiving" with nothing in any log.
 *
 * @module api/backends/realtime/SseTransport
 */

import type { BackendHandle } from '@noodl/backend-contract';
import type { Filter } from '@noodl/backend-contract/translators';
import type {
  RealtimeChange,
  RealtimeEventSourceLike,
  RealtimeTransport
} from '@noodl/backend-contract/realtime';

import {
  RealtimeSubscription,
  errorMessage,
  normalizedHttpBase,
  type RealtimeFetch,
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
  /** The subscription registration request. */
  subscribeRequest(
    base: string,
    token: string,
    clientId: string,
    collection: string,
    where: Filter | undefined
  ): { url: string; init: Record<string, unknown> };
  /** Whether the registration actually took, from the status **and** the body. */
  readVerdict(status: number | undefined, body: unknown): SseSubscribeVerdict;
  /** One change frame, normalised. `null` for a frame this dialect ignores. */
  parseChange(collection: string, primaryKey: string, raw: unknown): RealtimeChange | null;
}

// ── NodeGX (BAK-001's ChangeBus, over SSE) ─────────────────────────────────

/** `{accepted, rejected}` — the body our own backend answers a subscription POST with. */
interface NodeGXVerdictBody {
  accepted?: unknown[];
  rejected?: { reason?: string }[];
}

export const NODEGX_SSE: SseDialect = {
  name: 'nodegx',
  // EventSource cannot set headers, so the token rides in the query string. This is the
  // shipped BAK-001 behaviour and the server reads it there.
  streamUrl: (base, token) => base + '/realtime' + (token ? '?token=' + encodeURIComponent(token) : ''),
  helloEvent: 'connected',
  changeEvents: () => ['change'],
  resyncEvent: 'resync',
  subscribeRequest(base, token, clientId, collection, where) {
    const subscription: { collection: string; filter?: unknown } = { collection };
    if (where) subscription.filter = where;
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (token) headers['authorization'] = 'Bearer ' + token;
    return {
      url: base + '/realtime/subscriptions',
      init: {
        method: 'POST',
        headers,
        body: JSON.stringify({ clientId, subscriptions: [subscription] })
      }
    };
  },
  readVerdict(_status, body) {
    // ⚠️ The status is 200 either way. `accepted[]` is the answer.
    const verdict = (body || {}) as NodeGXVerdictBody;
    if (Array.isArray(verdict.accepted) && verdict.accepted.length > 0) return { ok: true };
    const reason = verdict.rejected && verdict.rejected[0] && verdict.rejected[0].reason;
    return { ok: false, reason: reason || undefined };
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
  subscribeRequest(base, token, clientId, collection) {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (token) headers['authorization'] = token;
    return {
      url: base + '/api/realtime',
      init: {
        method: 'POST',
        headers,
        // A flat list of names, not objects, and it REPLACES the set for this clientId.
        body: JSON.stringify({ clientId, subscriptions: [collection] })
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

// ── the transport ──────────────────────────────────────────────────────────

export class SseTransport extends RealtimeSubscription {
  readonly transport: RealtimeTransport = 'sse';

  private readonly _dialect: SseDialect;
  private _es: RealtimeEventSourceLike | null = null;
  private _clientId: string | null = null;

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

    const base = normalizedHttpBase(this.handle.url);
    if (!base) {
      this.fail('CONNECT_FAILED', `Backend URL is not a valid http(s) URL: ${this.handle.url}`, 'fatal');
      return;
    }

    const dialect = this._dialect;
    const es = new EventSourceImpl(dialect.streamUrl(base, this.token));
    this._es = es;
    this._clientId = null;

    es.addEventListener(dialect.helloEvent, (event) => {
      if (this._es !== es) return;
      let clientId: string | undefined;
      try {
        clientId = (JSON.parse(event.data) as { clientId?: string }).clientId;
      } catch (e) {
        return;
      }
      if (!clientId) return;
      // A fresh id on every connection, including an EventSource-initiated reconnect the
      // base class never saw — so registering again is mandatory, not an optimisation.
      this._clientId = clientId;
      this._register(generation, base, clientId);
    });

    for (const name of dialect.changeEvents(this.collection)) {
      es.addEventListener(name, (event) => {
        if (this._es !== es) return;
        let raw: unknown;
        try {
          raw = JSON.parse(event.data);
        } catch (e) {
          return;
        }
        const change = dialect.parseChange(this.collection, this.primaryKey, raw);
        if (change) this.emitChange(change);
      });
    }

    if (dialect.resyncEvent) {
      es.addEventListener(dialect.resyncEvent, () => {
        if (this._es !== es) return;
        // No replay log on either server. `resync` is the frame that says "your view may
        // be stale, re-run your query" — a consumer modelling only create/update/delete
        // ignores the one message that tells it so.
        this.emitChange({ type: 'resync', collection: this.collection, ids: [], records: [], recordsComplete: false });
      });
    }

    es.onerror = () => {
      if (this._es !== es) return;
      // ⚠️ `EventSource` reconnects on its own, and its retry keeps `Last-Event-ID` — which
      // is what earns our backend's `resync` frame. So an error is NOT reported down the
      // funnel immediately: the base class's confirmation deadline is re-armed instead, and
      // if the stream has not delivered a fresh hello frame by the time it fires, the
      // funnel runs and our own backoff takes over. Closing here would trade a measured
      // server behaviour for a uniform-looking one.
      this.interrupted(generation);
    };
  }

  protected closeTransport(): void {
    const es = this._es;
    this._clientId = null;
    if (!es) return;
    this._es = null;
    es.onerror = null;
    es.close();
  }

  /**
   * Register (or re-register) this subscription, and read the *body* for the verdict.
   */
  private _register(generation: number, base: string, clientId: string): void {
    const fetchImpl: RealtimeFetch | null = this.resolveFetch();
    if (!fetchImpl) {
      this.fail('TRANSPORT_UNAVAILABLE', 'fetch is not available to register the realtime subscription.');
      return;
    }

    const { url, init } = this._dialect.subscribeRequest(base, this.token, clientId, this.collection, this.where);

    fetchImpl(url, init)
      .then((response) => {
        const status = response ? response.status : undefined;
        const readBody = response && typeof response.json === 'function' ? response.json() : Promise.resolve(null);
        // A 204 has no body; a rejected JSON parse must not look like a rejected
        // subscription.
        return readBody.catch(() => null).then((body) => ({ status, body }));
      })
      .then(({ status, body }) => {
        // A reply for a connection we have already replaced says nothing about this one.
        if (this._clientId !== clientId) return;

        const verdict = this._dialect.readVerdict(status, body);
        if (verdict.ok) {
          this.confirmed();
          return;
        }
        this.fail(
          'SUBSCRIPTION_REJECTED',
          `The subscription to "${this.collection}" was rejected: ${verdict.reason || 'no reason given'}`
        );
        // Retryable in the table, so hand it to the one backoff rather than leaving an
        // open stream that will never deliver until the deadline notices.
        this.transportDownFrom(generation, 'closed');
      })
      .catch((e) => {
        if (this._clientId !== clientId) return;
        this.fail('CONNECT_FAILED', 'Could not register the realtime subscription: ' + errorMessage(e));
        this.transportDownFrom(generation, 'closed');
      });
  }
}
