/**
 * Parse LiveQuery — a probe, and a reason. Not a protocol implementation.
 *
 * ## What was measured
 *
 * Parse Server 7.3.0 in the rig, asked three ways with the master key (BCN-008's probe):
 *
 * - `GET /parse/serverInfo` advertises `globalConfig, hooks, cloudCode, logs, push,
 *   schemas, settings`. **No LiveQuery entry of any kind** — and, importantly, none appears
 *   when LiveQuery *is* running either, so a `/serverInfo` probe answers "no" on every
 *   Parse server in existence. The descriptor used to say to look there; it does not now.
 * - `ws://localhost:8092/parse` fires `error` at **20ms** ("Received network error or
 *   non-101 status code") and — as with every other failure mode measured — `close`
 *   **never** fires.
 * - A raw TCP upgrade request to the same path is answered `403` by the ordinary Express
 *   app, which is what "the socket is not a LiveQuery server" looks like from underneath.
 *
 * That is a measurement that LiveQuery is **absent**, which is a different and more useful
 * result than "we did not get to it". Its absence is also silent by nature: a client
 * connects to a URL that is not serving and nothing errors anywhere an app author looks.
 *
 * ## Why this file does not speak the protocol
 *
 * Because nothing here has ever seen it. `{op:'connect'}` → `{op:'connected'}` →
 * `{op:'subscribe'}` → `{op:'subscribed'}` is what the documentation says, and writing an
 * event decoder from documentation is precisely what cost RUN-003 a rewrite on Directus's
 * delete frame and what BCN-002 and BCN-003 each had to un-do. So this transport does the
 * one thing it can do honestly: it **asks**, with a deadline sized to the measured answer,
 * and reports `CAPABILITY_UNAVAILABLE` with a sentence naming what it found.
 *
 * That is the whole point of BCN-001's `conditional` state, and the 20ms measurement is
 * what makes it affordable — the probe settles before anything renders.
 *
 * ⚠️ **A node using this gets a disabled capability and a reason, not silence.** That is
 * the success criterion for the Parse row, and it is met. What is *not* met, and cannot be
 * until a LiveQuery server is in the rig, is realtime working on Parse.
 *
 * @module api/backends/realtime/ParseLiveQueryTransport
 */

import type { RealtimeSocketLike, RealtimeTransport } from '@noodl/backend-contract/realtime';

import { RealtimeSubscription, webSocketBase } from './RealtimeSubscription';

/**
 * How long to wait for the socket to say anything.
 *
 * The measured definite answer was 20ms; every other failure mode in the probe answered
 * inside 20ms too. 2s is a hundredfold margin and still fast enough to run before a page
 * paints — which is the property that makes `conditional` a usable state rather than a
 * synonym for "assume yes".
 */
const PROBE_DEADLINE_MS = 2000;

/** What the probe learned, for the message and for a caller that wants to cache it. */
export interface ParseLiveQueryProbeResult {
  available: boolean;
  /** `absent` · `unimplemented` · `no-websocket` */
  reason: 'absent' | 'unimplemented' | 'no-websocket';
  detail: string;
  elapsedMs: number;
}

export class ParseLiveQueryTransport extends RealtimeSubscription {
  /**
   * `'none'`, not `'websocket'`.
   *
   * The profile in the contract says `transport: 'none'` for Parse because what is there
   * is nothing, and claiming `websocket` would invite reusing the Directus transport — the
   * exact mistake `transport: 'phoenix-channel'` exists to prevent for Supabase.
   */
  readonly transport: RealtimeTransport = 'none';

  private _socket: RealtimeSocketLike | null = null;
  private _probeTimer: unknown = null;
  private _startedAt = 0;

  protected openTransport(_generation: number): void {
    const WebSocketImpl = this.resolveWebSocket();
    if (!WebSocketImpl) {
      this._report({
        available: false,
        reason: 'no-websocket',
        detail: 'WebSocket is not available in this environment, so LiveQuery cannot even be asked about.',
        elapsedMs: 0
      });
      return;
    }

    const base = webSocketBase(this.handle.url);
    if (!base) {
      this._report({
        available: false,
        reason: 'absent',
        detail: `Backend URL is not a valid http(s) URL: ${this.handle.url}`,
        elapsedMs: 0
      });
      return;
    }

    this._startedAt = Date.now();

    let socket: RealtimeSocketLike;
    try {
      socket = new WebSocketImpl(base);
    } catch (e) {
      this._report({
        available: false,
        reason: 'absent',
        detail: 'The LiveQuery socket could not be opened at all.',
        elapsedMs: Date.now() - this._startedAt
      });
      return;
    }
    this._socket = socket;

    const settle = (result: ParseLiveQueryProbeResult) => {
      if (this._socket !== socket) return;
      this._report(result);
    };

    socket.onopen = () => {
      // Never observed in the rig. A server that gets this far is running *something*, and
      // the honest answer is still no: no NodeGX code has ever spoken this protocol.
      settle({
        available: true,
        reason: 'unimplemented',
        detail:
          'A socket at this address accepted a connection, so a LiveQuery server may be running — but NodeGX has ' +
          'never spoken the LiveQuery protocol and BCN-008 declined to write a decoder from documentation. ' +
          'Realtime stays off for Parse backends.',
        elapsedMs: Date.now() - this._startedAt
      });
    };

    // ⚠️ `error` is the only event this ever fires. `close` never did, in any of the four
    // failure modes measured — which is why the deadline below exists as well.
    socket.onerror = () =>
      settle({
        available: false,
        reason: 'absent',
        detail:
          'No LiveQuery server answered. Parse LiveQuery runs as a separate server and most deployments do not ' +
          'start one; `/serverInfo` never mentions it either way, so the socket is the only thing that can say.',
        elapsedMs: Date.now() - this._startedAt
      });
    socket.onclose = () =>
      settle({
        available: false,
        reason: 'absent',
        detail: 'The LiveQuery socket closed before answering.',
        elapsedMs: Date.now() - this._startedAt
      });

    this._probeTimer = this._setTimeout(() => {
      this._probeTimer = null;
      settle({
        available: false,
        reason: 'absent',
        detail:
          `Nothing answered on the LiveQuery socket within ${PROBE_DEADLINE_MS}ms. A socket that fires neither ` +
          '`error` nor `close` is a measured failure mode (BCN-008 §2), not an impossibility.',
        elapsedMs: Date.now() - this._startedAt
      });
    }, PROBE_DEADLINE_MS);
  }

  protected closeTransport(): void {
    if (this._probeTimer !== null && this._probeTimer !== undefined) {
      const timer = this._probeTimer;
      this._probeTimer = null;
      this._clearTimeout(timer);
    }
    const socket = this._socket;
    if (!socket) return;
    this._socket = null;
    socket.onopen = socket.onmessage = socket.onclose = socket.onerror = null;
    socket.close();
  }

  /** `CAPABILITY_UNAVAILABLE` is fatal in the one classification, so this stops for good. */
  private _report(result: ParseLiveQueryProbeResult): void {
    this.lastProbe = result;
    this.fail('CAPABILITY_UNAVAILABLE', result.detail);
  }

  /** The probe's finding, for a caller that wants to show it rather than only log it. */
  lastProbe: ParseLiveQueryProbeResult | null = null;
}
