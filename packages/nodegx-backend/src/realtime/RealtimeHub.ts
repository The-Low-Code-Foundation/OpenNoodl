/**
 * RealtimeHub — SSE connection registry and delivery engine (BAK-001).
 *
 * One `GET /realtime` opens a Server-Sent-Events stream; the first frame hands
 * the client a server-generated `clientId`. `POST /realtime/subscriptions`
 * REPLACES that connection's subscription set (Pocketbase-style, idempotent).
 * Change events arrive from the {@link ChangeBus} and are delivered to a
 * connection only when, for one of its subscriptions:
 *   - the collection matches,
 *   - the record satisfies the subscription filter ({@link matchesFilter}), and
 *   - `canReadRecord(principal, record)` is true — the SAME row-level predicate
 *     the query routes enforce, so realtime can never leak a row a query hides.
 *
 * Design commitments from the spec (do not relitigate):
 *   - **Events-only, no replay.** The hub keeps no event log. Per-connection
 *     event ids are monotonic so a `Last-Event-ID` reconnect is *detectable*; a
 *     reconnect (or a slow-client queue overflow) yields a `resync` event and
 *     the client re-runs its query. That is the entire gap contract.
 *   - **Bounded per-connection queue.** A client that stops reading backs up
 *     into a bounded queue; on overflow the queue is dropped, a single `resync`
 *     is enqueued, and the connection is kept. Never buffer unboundedly, never
 *     silently drop a single event.
 *   - Subscription CREATION is gated on the collection's `find` CLP; delivery is
 *     gated per-event per-subscriber on the row ACL.
 *
 * @module nodegx-backend/realtime/RealtimeHub
 */

import * as crypto from 'crypto';

import { Principal, ClpOp, canReadRecord } from '../security/model';
import { ChangeAction, ChangeBus, ChangeEvent } from './ChangeBus';
import { Where, matchesFilter, assertFilterSupported, UnsupportedFilterError } from './filter';

/** The subset of http.ServerResponse the hub writes to (test-injectable). */
export interface SSEResponse {
  writeHead(status: number, headers: Record<string, string>): void;
  write(chunk: string): boolean;
  end(): void;
  on(event: 'close' | 'drain' | 'error', cb: () => void): void;
}

/** The security surface the hub needs — structurally satisfied by SecurityState. */
export interface HubSecurity {
  readonly devOpenActive: boolean;
  checkClp(principal: Principal, collection: string, op: ClpOp): { allowed: boolean; reason: string };
}

export interface Subscription {
  collection: string;
  filter?: Where;
}

export interface HubOptions {
  /** Max events buffered per connection before overflow → drop + resync. */
  maxQueue?: number;
  /**
   * BAK-009: max SIMULTANEOUS streams. This is the realtime tier's rate limit —
   * a request-rate bucket makes no sense for a connection that stays open for
   * hours, so the resource that is actually finite (sockets and their queues)
   * is what gets capped. Read live from ops.json, so an operator can raise it
   * without a restart. 0 = unlimited.
   */
  maxConnections?: () => number;
  /** Heartbeat comment-frame interval (ms); 0 disables (tests). */
  heartbeatMs?: number;
}

interface Connection {
  clientId: string;
  res: SSEResponse;
  principal: Principal;
  subscriptions: Subscription[];
  queue: OutFrame[];
  nextId: number;
  writable: boolean;
  closed: boolean;
  heartbeat: ReturnType<typeof setInterval> | null;
}

/**
 * The wire payloads this hub emits, one interface per `event`.
 *
 * These were a single `data: unknown` until PLAT-004. That is the shape the
 * ratchet keeps finding: three distinct payloads built as inline literals with
 * nothing naming them, so every reader — the specs above all, which are the
 * closest thing this package has to a contract test for the SSE wire — paid
 * for it with a cast, and a field rename on either side would have gone
 * unnoticed. The union is exported so a consumer can narrow on `event` and get
 * the payload, instead of asserting one.
 */
export interface ConnectedFrameData {
  clientId: string;
}

export interface ChangeFrameData {
  action: ChangeAction;
  collection: string;
  /** The record post-write, or as it was just before deletion. */
  record: Record<string, unknown>;
}

export interface ResyncFrameData {
  /** Why the client must re-query: no replay buffer exists. */
  reason: 'reconnect' | 'overflow' | 'shutdown' | (string & {});
}

/** Why one requested subscription was refused. */
export interface RejectedSubscription {
  collection: string;
  reason: string;
}

/** The body of `POST /realtime/subscriptions`'s 200. */
export interface SubscriptionResult {
  accepted: Subscription[];
  rejected: RejectedSubscription[];
}

export type OutFrame =
  | { event: 'connected'; data: ConnectedFrameData }
  | { event: 'change'; data: ChangeFrameData }
  | { event: 'resync'; data: ResyncFrameData };

const DEFAULT_MAX_QUEUE = 1000;
const DEFAULT_HEARTBEAT_MS = 25000;

const SSE_HEADERS: Record<string, string> = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  // Defeat nginx/proxy response buffering that would hold the stream (WF-003
  // deploy notes cover reverse proxies).
  'X-Accel-Buffering': 'no'
  // No Access-Control-Allow-Origin here since BAK-009: the dispatcher has
  // already set the configured one on this response, and repeating `*` in
  // writeHead would override it.
};

export class RealtimeHub {
  private readonly security: HubSecurity;
  private readonly connections = new Map<string, Connection>();
  private readonly maxQueue: number;
  private readonly heartbeatMs: number;
  private readonly maxConnections: () => number;
  private readonly unsubscribeBus: () => void;

  constructor(bus: ChangeBus, security: HubSecurity, options: HubOptions = {}) {
    this.security = security;
    this.maxQueue = options.maxQueue ?? DEFAULT_MAX_QUEUE;
    this.maxConnections = options.maxConnections ?? (() => 0);
    this.heartbeatMs = options.heartbeatMs ?? DEFAULT_HEARTBEAT_MS;
    this.unsubscribeBus = bus.subscribe((event) => this.onChange(event));
  }

  /** Number of live connections (introspection / tests). */
  get connectionCount(): number {
    return this.connections.size;
  }

  // ==========================================================================
  // Connection lifecycle
  // ==========================================================================

  /**
   * Open an SSE stream. Writes the stream headers, registers the connection,
   * and sends the `connected` frame carrying the new clientId. When `lastEventId`
   * is present (a reconnect) an immediate `resync` follows — the hub cannot
   * replay, so it tells the client to re-query.
   *
   * Returns null when the connection cap is reached, having written NOTHING —
   * the caller turns that into a plain 503 with `Retry-After`. Refusing before
   * the stream headers go out matters: a client that has already been told
   * `200 text/event-stream` has no way to learn it was rejected.
   */
  addConnection(res: SSEResponse, principal: Principal, lastEventId?: string): string | null {
    const cap = this.maxConnections();
    if (cap > 0 && this.connections.size >= cap) return null;

    const clientId = crypto.randomBytes(18).toString('base64url');
    res.writeHead(200, SSE_HEADERS);

    const conn: Connection = {
      clientId,
      res,
      principal,
      subscriptions: [],
      queue: [],
      nextId: 1,
      writable: true,
      closed: false,
      heartbeat: null
    };
    this.connections.set(clientId, conn);

    res.on('close', () => this.removeConnection(clientId));
    res.on('error', () => this.removeConnection(clientId));
    res.on('drain', () => {
      conn.writable = true;
      this.drain(conn);
    });

    this.enqueue(conn, { event: 'connected', data: { clientId } });
    if (lastEventId !== undefined && lastEventId !== '') {
      // No replay: any gap is unrecoverable, so a reconnect always resyncs.
      this.enqueue(conn, { event: 'resync', data: { reason: 'reconnect' } });
    }

    if (this.heartbeatMs > 0) {
      conn.heartbeat = setInterval(() => this.sendHeartbeat(conn), this.heartbeatMs);
      // Do not keep the event loop alive for heartbeats alone.
      if (typeof conn.heartbeat.unref === 'function') conn.heartbeat.unref();
    }

    return clientId;
  }

  private removeConnection(clientId: string): void {
    const conn = this.connections.get(clientId);
    if (!conn) return;
    conn.closed = true;
    if (conn.heartbeat) clearInterval(conn.heartbeat);
    this.connections.delete(clientId);
  }

  /**
   * BAK-009 graceful shutdown: tell every client the stream is ending before it
   * ends, then close. `resync` is deliberately reused rather than a new frame
   * type — every client already handles it (it means "re-query, you may have
   * missed something"), which is exactly the right instruction for a client
   * whose stream is about to disappear. A new `goodbye` event would be ignored
   * by every client shipped before it.
   */
  closeWithGoodbye(reason: string): void {
    for (const conn of this.connections.values()) {
      if (conn.closed) continue;
      try {
        this.enqueue(conn, { event: 'resync', data: { reason } });
      } catch {
        /* a stream that cannot take the goodbye is closed below anyway */
      }
    }
    this.close();
  }

  /** Shut the hub down: detach from the bus and close every stream. */
  close(): void {
    this.unsubscribeBus();
    for (const conn of Array.from(this.connections.values())) {
      conn.closed = true;
      if (conn.heartbeat) clearInterval(conn.heartbeat);
      try {
        conn.res.end();
      } catch {
        /* already closed */
      }
    }
    this.connections.clear();
  }

  // ==========================================================================
  // Subscription management (POST /realtime/subscriptions) — replace semantics
  // ==========================================================================

  /**
   * Replace `clientId`'s subscription set. Each requested subscription is gated
   * on the collection's `find` CLP for the connection's principal and validated
   * for filter support; accepted ones become the new set, rejected ones are
   * reported. Returns null when the clientId is unknown (caller → 404).
   */
  setSubscriptions(clientId: string, requested: Subscription[]): SubscriptionResult | null {
    const conn = this.connections.get(clientId);
    if (!conn) return null;

    const accepted: Subscription[] = [];
    const rejected: RejectedSubscription[] = [];

    for (const sub of requested) {
      const collection = sub && typeof sub.collection === 'string' ? sub.collection : '';
      if (!collection) {
        rejected.push({ collection: String(sub && sub.collection), reason: 'collection is required' });
        continue;
      }
      try {
        assertFilterSupported(sub.filter);
      } catch (e) {
        rejected.push({ collection, reason: e instanceof UnsupportedFilterError ? e.message : 'invalid filter' });
        continue;
      }
      if (!this.security.devOpenActive) {
        const decision = this.security.checkClp(conn.principal, collection, 'find');
        if (!decision.allowed) {
          rejected.push({ collection, reason: decision.reason });
          continue;
        }
      }
      accepted.push({ collection, filter: sub.filter });
    }

    conn.subscriptions = accepted;
    return { accepted, rejected };
  }

  // ==========================================================================
  // Delivery
  // ==========================================================================

  private onChange(event: ChangeEvent): void {
    for (const conn of this.connections.values()) {
      if (conn.closed) continue;
      for (const sub of conn.subscriptions) {
        if (sub.collection !== event.collection) continue;
        let matches: boolean;
        try {
          matches = matchesFilter(sub.filter, event.record);
        } catch {
          // A filter that slipped past assertFilterSupported: fail closed.
          matches = false;
        }
        if (!matches) continue;
        // Delivery-time row-level permission — the twin of the query ACL filter.
        // In dev-open the query routes bypass row ACLs (aclFor → undefined), so
        // realtime must bypass them too or the twin property breaks locally.
        if (!this.security.devOpenActive && !canReadRecord(conn.principal, event.record)) continue;
        this.enqueue(conn, {
          event: 'change',
          data: { action: event.action, collection: event.collection, record: event.record }
        });
        break; // at most one delivery per connection per change
      }
    }
  }

  // ==========================================================================
  // The bounded queue + drain
  // ==========================================================================

  private enqueue(conn: Connection, frame: OutFrame): void {
    if (conn.closed) return;
    conn.queue.push(frame);
    if (conn.queue.length > this.maxQueue) {
      // Overflow: a slow reader has backed up past the bound. Drop everything
      // pending and collapse to a single resync — the client re-queries and is
      // whole again. Bounded memory, no silent single-event loss.
      conn.queue = [{ event: 'resync', data: { reason: 'overflow' } }];
    }
    this.drain(conn);
  }

  private drain(conn: Connection): void {
    while (!conn.closed && conn.writable && conn.queue.length > 0) {
      const frame = conn.queue.shift() as OutFrame;
      const id = conn.nextId++;
      const ok = conn.res.write(serializeFrame(frame, id));
      if (!ok) {
        // Backpressure: the socket buffer is full. Stop feeding it and wait for
        // 'drain'. Frames still in conn.queue are what the bound protects.
        conn.writable = false;
      }
    }
  }

  private sendHeartbeat(conn: Connection): void {
    if (conn.closed || !conn.writable) return;
    // A comment frame keeps idle proxies from closing the stream. No id.
    const ok = conn.res.write(': heartbeat\n\n');
    if (!ok) conn.writable = false;
  }
}

/** Serialize one frame to the SSE wire, stamping a monotonic per-connection id. */
function serializeFrame(frame: OutFrame, id: number): string {
  return `id: ${id}\nevent: ${frame.event}\ndata: ${JSON.stringify(frame.data)}\n\n`;
}
