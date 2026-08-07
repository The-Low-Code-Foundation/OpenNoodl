/**
 * Directus 11 realtime, over its WebSocket interface — BCN-008.
 *
 * The protocol, measured (RUN-003 slice 7, re-measured by BCN-008's probe):
 *
 * ```
 *   → { type: 'auth', access_token }             (handshake mode: required first)
 *   ← { type: 'auth', status: 'ok' }
 *   → { type: 'subscribe', collection, uid }
 *   ← { type: 'subscription', event: 'init',   data: [ …full rows ], uid }
 *   ← { type: 'subscription', event: 'create', data: [ …full rows ], uid }
 *   ← { type: 'subscription', event: 'delete', data: [ '2' ], uid }   ← ⚠️ STRING keys,
 *     for an `integer` primary key. Measured twice, on a column confirmed `integer` via
 *     GET /fields/…/id. This is the reason RealtimeChange.ids is string[] everywhere.
 *   ← { type: 'ping' }   → must answer { type: 'pong' }
 *   ← { type: 'auth', status: 'error', error: { code: 'AUTH_FAILED' } } then close ~2ms later
 * ```
 *
 * ## The two rules that are not optional
 *
 * **Answer the ping.** Measured: the server pings at 30 016ms and closes a client that
 * ignored one at 60 035ms, code 1005, empty reason. A client that treats `ping` as an
 * unknown frame therefore works perfectly for a minute and then drops, forever, on a
 * cycle — which reads as a flaky network rather than a missing three-line branch.
 *
 * **Do not build reconnection on `close`.** Node's undici WebSocket fires only `error`
 * when the connect fails before establishing, and against a path Directus does not
 * upgrade it fires *neither* — silent for 20s. Both events and the base class's deadline
 * all go to one `transportDownFrom`; see `RealtimeSubscription`'s docblock.
 *
 * @module api/backends/realtime/DirectusWebSocketTransport
 */

import type { RealtimeDownReason, RealtimeSocketLike, RealtimeTransport } from '@noodl/backend-contract/realtime';

import { RealtimeSubscription, idsFromRecords, webSocketBase } from './RealtimeSubscription';

/** One frame arriving over the Directus WebSocket. */
interface DirectusFrame {
  type?: string;
  status?: string;
  event?: string;
  data?: unknown[];
  error?: { message?: string; code?: string };
}

/**
 * How long without *any* frame counts as a dead connection.
 *
 * Three missed pings at the measured 30s interval. A TCP connection that has gone away
 * without a FIN — a laptop lid, a NAT timeout, a container killed with `-9` — leaves a
 * WebSocket that fires nothing at all, and this is the only thing that notices.
 *
 * ⚠️ Directus is the only transport that gets one, and that is a measurement rather than
 * an omission: SSE keepalives are `:` comment lines, which `EventSource` does not surface
 * to any listener, so an SSE watchdog would be counting frames it cannot see.
 */
const HEARTBEAT_DEADLINE_MS = 3 * 30000;

/** The `uid` we tag our subscription with, so the server echoes it back on every frame. */
const SUBSCRIPTION_UID = 'nodegx-realtime';

export class DirectusWebSocketTransport extends RealtimeSubscription {
  readonly transport: RealtimeTransport = 'websocket';

  private _socket: RealtimeSocketLike | null = null;
  private _heartbeatTimer: unknown = null;

  protected openTransport(generation: number): void {
    const WebSocketImpl = this.resolveWebSocket();
    if (!WebSocketImpl) {
      this.fail('TRANSPORT_UNAVAILABLE', 'WebSocket is not available in this environment.');
      return;
    }

    const base = webSocketBase(this.handle.url);
    if (!base) {
      // Overriding the table's `retryable`: a URL that is not http(s) cannot become one
      // without a graph edit, so retrying it every 30s until the tab closes is noise.
      this.fail('CONNECT_FAILED', `Backend URL is not a valid http(s) URL: ${this.handle.url}`, 'fatal');
      return;
    }

    const socket = new WebSocketImpl(base + '/websocket');
    this._socket = socket;

    socket.onopen = () => {
      if (this._socket !== socket) return;
      if (this.token) {
        this._send({ type: 'auth', access_token: this.token });
      } else {
        // WEBSOCKETS_AUTH=public subscribes directly.
        this._subscribe();
      }
    };

    socket.onmessage = (event) => {
      if (this._socket !== socket) return;
      this._touchHeartbeat(generation);

      let frame: DirectusFrame;
      try {
        frame = JSON.parse(event.data);
      } catch (e) {
        return;
      }
      this._handleFrame(generation, frame);
    };

    socket.onclose = () => this.transportDownFrom(generation, 'closed');
    socket.onerror = () => this.transportDownFrom(generation, 'errored');
  }

  protected closeTransport(): void {
    this._clearHeartbeat();
    const socket = this._socket;
    if (!socket) return;
    this._socket = null;
    socket.onopen = socket.onmessage = socket.onclose = socket.onerror = null;
    socket.close();
  }

  protected onTransportDown(_reason: RealtimeDownReason): void {
    this._clearHeartbeat();
  }

  // ── frames ───────────────────────────────────────────────────────────────

  private _handleFrame(generation: number, frame: DirectusFrame): void {
    if (frame.type === 'ping') {
      this._send({ type: 'pong' });
      return;
    }

    if (frame.type === 'auth') {
      if (frame.status === 'ok') {
        this._subscribe();
      } else if (frame.status === 'error') {
        // Measured: the server closes ~2ms after this frame. Reconnecting with the same
        // token can only fail the same way, so `AUTH_FAILED` is fatal in the table.
        this.fail('AUTH_FAILED', frame.error?.message || 'Authentication failed.');
      }
      return;
    }

    if (frame.type === 'subscription') {
      const rows = Array.isArray(frame.data) ? frame.data : [];

      if (frame.event === 'init') {
        this.confirmed();
        this._touchHeartbeat(generation);
        this.emitChange({
          type: 'init',
          collection: this.collection,
          ids: idsFromRecords(rows, this.primaryKey),
          records: rows as Record<string, unknown>[],
          recordsComplete: true
        });
        return;
      }

      if (frame.event === 'delete') {
        // ⚠️ Keys only, and already strings. `records` stays empty and
        // `recordsComplete: false` says why — a node publishing a "deleted record" must
        // gate on it or it publishes `{}` here and a full row on PocketBase.
        this.emitChange({
          type: 'delete',
          collection: this.collection,
          ids: rows.map((v) => String(v)),
          records: [],
          recordsComplete: false
        });
        return;
      }

      if (frame.event === 'create' || frame.event === 'update') {
        this.emitChange({
          type: frame.event,
          collection: this.collection,
          ids: idsFromRecords(rows, this.primaryKey),
          records: rows as Record<string, unknown>[],
          recordsComplete: true
        });
      }
      return;
    }

    if (frame.status === 'error') {
      this.fail('SUBSCRIPTION_REJECTED', frame.error?.message || 'The subscription was rejected.');
    }
  }

  private _subscribe(): void {
    this._send({ type: 'subscribe', collection: this.collection, uid: SUBSCRIPTION_UID });
  }

  private _send(message: unknown): void {
    try {
      if (this._socket) this._socket.send(JSON.stringify(message));
    } catch (e) {
      // A racing close is reported by onclose/onerror; there is nothing useful here.
    }
  }

  // ── heartbeat watchdog ───────────────────────────────────────────────────

  private _touchHeartbeat(generation: number): void {
    this._clearHeartbeat();
    this._heartbeatTimer = this._setTimeout(() => {
      this._heartbeatTimer = null;
      this.fail('HEARTBEAT_MISSED', `No frame from Directus for ${HEARTBEAT_DEADLINE_MS}ms; reconnecting.`);
      this.transportDownFrom(generation, 'heartbeat-missed');
    }, HEARTBEAT_DEADLINE_MS);
  }

  private _clearHeartbeat(): void {
    if (this._heartbeatTimer === null || this._heartbeatTimer === undefined) return;
    const handle = this._heartbeatTimer;
    this._heartbeatTimer = null;
    this._clearTimeout(handle);
  }
}
