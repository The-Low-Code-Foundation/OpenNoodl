/**
 * BCN-008 — the transports, on injected sockets, streams, `fetch` and timers.
 *
 * Replaces `byob-realtime.test.js` and `byob-realtime-sse.test.js`, whose subjects were
 * deleted: there is one lifecycle now and five wires on top of it.
 *
 * Every case here is a **measured** server behaviour, and the ones that would be tempting
 * to omit are the ones that cost somebody a defect:
 *
 * - a socket that fires `error` and **never** `close` (undici, four failure modes, zero
 *   `close` events between them);
 * - a socket that fires **neither** — silent for 20s against a real WebSocket server on a
 *   path it will not upgrade, which no `onclose`/`onerror` funnel can survive;
 * - a `200` carrying `{accepted: [], rejected: [{reason}]}`, which `res.ok` reads as yes;
 * - a delete frame carrying `["2"]` — a *string* — for an `integer` primary key;
 * - a `ping` that must be answered or the server hangs up 30s later.
 *
 * No network. `RealtimeDeps` is in the contract precisely so this is possible.
 */

import {
  DirectusWebSocketTransport,
  NODEGX_SSE,
  POCKETBASE_SSE,
  ParseLiveQueryTransport,
  SseTransport,
  UnavailableTransport,
  createRealtimeSubscription,
  isNodeGXRealtime,
  realtimeAdapterFor,
  realtimeSupportFor
} from '../../src/api/backends/realtime';
import { idsFromRecords, normalizedHttpBase, webSocketBase } from '../../src/api/backends/realtime/RealtimeSubscription';
import type { BackendHandle, RealtimeChange, RealtimeError, RealtimeStatus } from '@noodl/backend-contract';

// FH-021 — the node layer, tested at the foot of this file.
import NoodlRuntime = require('../../noodl-runtime');
import { createNode, type DrivenNode } from '../helpers/node-harness';
import subscribeModule = require('../../src/nodes/std-library/data/subscribetochanges');

/* eslint-disable @typescript-eslint/no-explicit-any */

// ── doubles ────────────────────────────────────────────────────────────────

/** A controllable clock: nothing here waits on a real timer. */
class FakeClock {
  private _next = 1;
  private _pending = new Map<number, { fn: () => void; at: number }>();
  now = 0;

  setTimeout = (fn: () => void, delay: number): unknown => {
    const id = this._next++;
    this._pending.set(id, { fn, at: this.now + delay });
    return id;
  };
  clearTimeout = (handle: unknown): void => {
    this._pending.delete(handle as number);
  };
  /** Run everything due within `ms`, in due order, including anything they schedule. */
  advance(ms: number): void {
    const until = this.now + ms;
    for (;;) {
      const due = [...this._pending.entries()].filter(([, t]) => t.at <= until).sort((a, b) => a[1].at - b[1].at);
      if (due.length === 0) break;
      const [id, timer] = due[0];
      this._pending.delete(id);
      this.now = timer.at;
      timer.fn();
    }
    this.now = until;
  }
  get pending(): number {
    return this._pending.size;
  }
}

/** Every socket a run opened, so "did it reconnect?" is countable. */
const sockets: FakeSocket[] = [];

class FakeSocket {
  onopen: ((...a: unknown[]) => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: ((...a: unknown[]) => void) | null = null;
  onerror: ((...a: unknown[]) => void) | null = null;
  sent: any[] = [];
  closed = false;
  readonly url: string;

  constructor(url: string) {
    this.url = url;
    sockets.push(this);
  }
  send(data: string) {
    this.sent.push(JSON.parse(data));
  }
  close() {
    this.closed = true;
  }

  open() {
    this.onopen?.();
  }
  message(frame: unknown) {
    this.onmessage?.({ data: JSON.stringify(frame) });
  }
  error() {
    this.onerror?.();
  }
  serverClose() {
    this.onclose?.();
  }
}

const streams: FakeEventSource[] = [];

class FakeEventSource {
  private _listeners = new Map<string, ((e: { data: string }) => void)[]>();
  onerror: ((...a: unknown[]) => void) | null = null;
  closed = false;
  readonly url: string;

  constructor(url: string) {
    this.url = url;
    streams.push(this);
  }
  addEventListener(type: string, listener: (e: { data: string }) => void) {
    const list = this._listeners.get(type) || [];
    list.push(listener);
    this._listeners.set(type, list);
  }
  close() {
    this.closed = true;
  }

  emit(name: string, data: unknown) {
    for (const l of this._listeners.get(name) || []) l({ data: JSON.stringify(data) });
  }
  fail() {
    this.onerror?.();
  }
  get listenerNames(): string[] {
    return [...this._listeners.keys()];
  }
}

/** A `fetch` that records every call and answers from a queue. */
function fakeFetch(replies: { status?: number; body?: unknown }[]) {
  const calls: { url: string; init: any }[] = [];
  let i = 0;
  const impl = (url: string, init?: unknown) => {
    calls.push({ url, init });
    const reply = replies[Math.min(i++, replies.length - 1)];
    return Promise.resolve({
      status: reply.status ?? 200,
      json: () => Promise.resolve(reply.body ?? null)
    });
  };
  return { impl, calls };
}

/** Collect everything a subscription reported. */
function watch() {
  const changes: RealtimeChange[] = [];
  const statuses: RealtimeStatus[] = [];
  const errors: RealtimeError[] = [];
  return {
    changes,
    statuses,
    errors,
    callbacks: {
      onEvent: (c: RealtimeChange) => changes.push(c),
      onStatus: (s: RealtimeStatus) => statuses.push(s),
      onError: (e: RealtimeError) => errors.push(e)
    }
  };
}

const DIRECTUS: BackendHandle = {
  id: 'd',
  type: 'directus',
  name: 'Directus',
  url: 'http://directus.test:8055',
  sessionToken: 'tok'
};
const NODEGX: BackendHandle = { id: 'n', type: 'nodegx', name: 'NodeGX', url: 'http://nodegx.test:8593' };
const PB: BackendHandle = { id: 'p', type: 'pocketbase', name: 'PocketBase', url: 'http://pb.test:8091' };

/** Let queued promise callbacks (the subscription POST) run. */
const flush = () => new Promise<void>((r) => setImmediate(r));

beforeEach(() => {
  sockets.length = 0;
  streams.length = 0;
});

// ═══════════════════════════════════════════════════════════════════════════

describe('URL and id helpers', () => {
  it('turns an http base into a ws one, and refuses anything else', () => {
    expect(webSocketBase('http://x:8055')).toBe('ws://x:8055');
    expect(webSocketBase('https://x')).toBe('wss://x');
    expect(webSocketBase('https://x/')).toBe('wss://x');
    expect(webSocketBase('x:8055')).toBeNull();
    expect(webSocketBase('')).toBeNull();
    expect(webSocketBase(undefined)).toBeNull();
  });

  it('strips trailing slashes from an http base', () => {
    expect(normalizedHttpBase('http://x:1/')).toBe('http://x:1');
    expect(normalizedHttpBase('  http://x:1///  ')).toBe('http://x:1');
    expect(normalizedHttpBase('ftp://x')).toBeNull();
  });

  it('coerces ids to strings and drops records that have none', () => {
    expect(idsFromRecords([{ id: 2 }, { id: 'a' }, { id: null }, {}, null], 'id')).toEqual(['2', 'a']);
  });
});

describe('transport selection', () => {
  it('routes each backend type to the wire it actually speaks', () => {
    expect(realtimeSupportFor('directus')).toEqual({ transport: 'websocket', state: 'supported' });
    expect(realtimeSupportFor('pocketbase').transport).toBe('sse');
    expect(realtimeSupportFor('nodegx').transport).toBe('sse');
    expect(realtimeSupportFor('parse').state).toBe('conditional');
    // Its own transport name, so nobody is tempted to reuse the Directus WebSocket for it.
    expect(realtimeSupportFor('supabase')).toMatchObject({ transport: 'phoenix-channel', state: 'unsupported' });
    expect(realtimeSupportFor('custom').state).toBe('unsupported');
  });

  it('keeps the three type strings that all mean our own backend', () => {
    expect(isNodeGXRealtime('nodegx')).toBe(true);
    expect(isNodeGXRealtime('nodegx-backend')).toBe(true);
    expect(isNodeGXRealtime('local')).toBe(true);
    expect(isNodeGXRealtime('directus')).toBe(false);
    expect(isNodeGXRealtime(undefined)).toBe(false);
  });

  it('every unsupported state carries a reason', () => {
    for (const type of ['supabase', 'custom', 'parse']) {
      const support = realtimeSupportFor(type);
      if (support.state !== 'supported') expect(typeof support.reason).toBe('string');
    }
  });

  it('builds the right class for each type', () => {
    // ⚠️ Injected timers, and every subscription disposed. `createRealtimeSubscription`
    // *connects*, and a live one on real timers reconnects forever — which is correct
    // behaviour and hangs the runner.
    const clock = new FakeClock();
    const deps = {
      WebSocketImpl: FakeSocket as never,
      EventSourceImpl: FakeEventSource as never,
      fetchImpl: (() => Promise.resolve({})) as never,
      setTimeoutImpl: clock.setTimeout,
      clearTimeoutImpl: clock.clearTimeout
    };
    const built = [
      [createRealtimeSubscription(DIRECTUS, { collection: 'c', deps }), DirectusWebSocketTransport],
      [createRealtimeSubscription(NODEGX, { collection: 'c', deps }), SseTransport],
      [createRealtimeSubscription(PB, { collection: 'c', deps }), SseTransport],
      [createRealtimeSubscription({ ...DIRECTUS, type: 'parse' }, { collection: 'c', deps }), ParseLiveQueryTransport],
      [createRealtimeSubscription({ ...DIRECTUS, type: 'supabase' }, { collection: 'c', deps }), UnavailableTransport]
    ] as const;
    for (const [subscription, klass] of built) {
      expect(subscription).toBeInstanceOf(klass);
      subscription.dispose();
    }
  });

  it('the adapter reports the transport for the type it was built for', () => {
    expect(realtimeAdapterFor('directus').transport).toBe('websocket');
    expect(realtimeAdapterFor('supabase').transport).toBe('phoenix-channel');
  });
});

// ═══════════════════════════════════════════════════════════════════════════

describe('Directus WebSocket transport', () => {
  function open(handle: BackendHandle = DIRECTUS, options: any = {}) {
    const clock = new FakeClock();
    const w = watch();
    const sub = new DirectusWebSocketTransport(handle, {
      collection: 'items',
      primaryKey: 'id',
      deps: { WebSocketImpl: FakeSocket as never, setTimeoutImpl: clock.setTimeout, clearTimeoutImpl: clock.clearTimeout },
      ...w.callbacks,
      ...options
    });
    sub.connect();
    return { sub, clock, ...w, socket: () => sockets[sockets.length - 1] };
  }

  it('authenticates, subscribes, and only reports subscribed once init arrives', () => {
    const t = open();
    expect(t.socket().url).toBe('ws://directus.test:8055/websocket');

    t.socket().open();
    expect(t.socket().sent[0]).toEqual({ type: 'auth', access_token: 'tok' });
    // ⚠️ An open socket is not a subscription.
    expect(t.sub.status).toBe('connecting');

    t.socket().message({ type: 'auth', status: 'ok' });
    expect(t.socket().sent[1]).toMatchObject({ type: 'subscribe', collection: 'items' });
    expect(t.sub.status).toBe('connecting');

    t.socket().message({ type: 'subscription', event: 'init', data: [{ id: 1 }] });
    expect(t.sub.status).toBe('subscribed');
    expect(t.statuses).toEqual(['subscribed']);
    expect(t.changes[0]).toEqual({
      type: 'init',
      collection: 'items',
      ids: ['1'],
      records: [{ id: 1 }],
      recordsComplete: true
    });
  });

  it('subscribes directly when there is no token (WEBSOCKETS_AUTH=public)', () => {
    const t = open({ ...DIRECTUS, sessionToken: undefined, publicToken: undefined });
    t.socket().open();
    expect(t.socket().sent[0]).toMatchObject({ type: 'subscribe' });
  });

  it('⚠️ answers ping with pong — the server hangs up on a silent client at 60s', () => {
    const t = open();
    t.socket().open();
    t.socket().message({ type: 'auth', status: 'ok' });
    t.socket().message({ type: 'subscription', event: 'init', data: [] });

    t.socket().message({ type: 'ping' });
    expect(t.socket().sent[t.socket().sent.length - 1]).toEqual({ type: 'pong' });
    // And a ping is not a change.
    expect(t.changes.filter((c) => c.type !== 'init')).toHaveLength(0);
  });

  it('⚠️ a delete carries STRING keys for an integer pk, and says the record is missing', () => {
    const t = open();
    t.socket().open();
    t.socket().message({ type: 'auth', status: 'ok' });
    t.socket().message({ type: 'subscription', event: 'init', data: [] });
    t.socket().message({ type: 'subscription', event: 'delete', data: ['2'] });

    expect(t.changes[1]).toEqual({
      type: 'delete',
      collection: 'items',
      ids: ['2'],
      records: [],
      // The gate a "Deleted Record" output has to read. `records.length === 0` cannot tell
      // this from an empty frame.
      recordsComplete: false
    });
  });

  it('reports create and update with their records', () => {
    const t = open();
    t.socket().open();
    t.socket().message({ type: 'auth', status: 'ok' });
    t.socket().message({ type: 'subscription', event: 'init', data: [] });
    t.socket().message({ type: 'subscription', event: 'create', data: [{ id: 7, title: 'a' }] });
    t.socket().message({ type: 'subscription', event: 'update', data: [{ id: 7, title: 'b' }] });

    expect(t.changes.map((c) => c.type)).toEqual(['init', 'create', 'update']);
    expect(t.changes[1].ids).toEqual(['7']);
    expect(t.changes[2].records).toEqual([{ id: 7, title: 'b' }]);
  });

  it('AUTH_FAILED is fatal: it stops, and never opens a second socket', () => {
    const t = open();
    t.socket().open();
    t.socket().message({ type: 'auth', status: 'error', error: { code: 'AUTH_FAILED', message: 'nope' } });

    expect(t.errors[0]).toEqual({ message: 'nope', code: 'AUTH_FAILED', kind: 'fatal' });
    expect(t.sub.status).toBe('stopped');
    // The server closes ~2ms later; that must not restart anything.
    t.socket().serverClose();
    t.clock.advance(120000);
    expect(sockets).toHaveLength(1);
  });

  it('⚠️ reconnects from `error` alone — undici never fires close for a failed connect', () => {
    const t = open();
    t.socket().error();
    expect(t.errors[0].code).toBe('CONNECT_FAILED');

    t.clock.advance(1000);
    expect(sockets).toHaveLength(2);
    sockets[1].error();
    t.clock.advance(2000);
    expect(sockets).toHaveLength(3);
  });

  it('an error followed by a close reconnects ONCE, not twice', () => {
    const t = open();
    t.socket().error();
    t.socket().serverClose();
    t.clock.advance(5000);
    expect(sockets).toHaveLength(2);
  });

  it('a straggling close from a replaced socket does not schedule a second reconnect', () => {
    const t = open();
    const first = t.socket();
    first.error();
    t.clock.advance(1000);
    expect(sockets).toHaveLength(2);

    // Generation 1 reporting late, after generation 2 exists.
    first.serverClose();
    // Short of generation 2's own 15s confirmation deadline, so the only thing that could
    // open a third socket is the straggler being taken seriously.
    t.clock.advance(14000);
    expect(sockets).toHaveLength(2);
  });

  it('⚠️ a socket that fires NOTHING is caught by the confirmation deadline', () => {
    const t = open(DIRECTUS, { timing: { reconnectBaseMs: 1000, reconnectMaxMs: 30000, connectTimeoutMs: 15000 } });
    // No open, no error, no close. This is a real Directus on a path it will not upgrade.
    t.clock.advance(14000);
    expect(t.errors).toHaveLength(0);
    t.clock.advance(2000);
    expect(t.errors[0].code).toBe('CONNECT_TIMEOUT');
    t.clock.advance(1000);
    expect(sockets).toHaveLength(2);
  });

  it('the deadline also catches a socket that opens and never confirms', () => {
    const t = open();
    t.socket().open();
    t.socket().message({ type: 'auth', status: 'ok' });
    // Subscribed on the wire, never confirmed by the server.
    t.clock.advance(16000);
    expect(t.errors[0].code).toBe('CONNECT_TIMEOUT');
  });

  it('backs off exponentially and resets the counter on a confirmed resubscribe', () => {
    const t = open();
    const failAt = (n: number) => {
      sockets[n].error();
    };
    failAt(0);
    t.clock.advance(999);
    expect(sockets).toHaveLength(1);
    t.clock.advance(2);
    expect(sockets).toHaveLength(2);

    failAt(1);
    t.clock.advance(1999);
    expect(sockets).toHaveLength(2);
    t.clock.advance(2);
    expect(sockets).toHaveLength(3);

    // Confirm, then fail again: back to 1s, not 4s.
    sockets[2].open();
    sockets[2].message({ type: 'auth', status: 'ok' });
    sockets[2].message({ type: 'subscription', event: 'init', data: [] });
    sockets[2].error();
    t.clock.advance(1001);
    expect(sockets).toHaveLength(4);
  });

  it('a heartbeat drought reconnects', () => {
    const t = open();
    t.socket().open();
    t.socket().message({ type: 'auth', status: 'ok' });
    t.socket().message({ type: 'subscription', event: 'init', data: [] });

    t.clock.advance(89000);
    expect(t.errors).toHaveLength(0);
    t.clock.advance(2000);
    expect(t.errors[0].code).toBe('HEARTBEAT_MISSED');
  });

  it('a bad backend URL is fatal, overriding the table', () => {
    const t = open({ ...DIRECTUS, url: 'directus.test' });
    expect(t.errors[0]).toMatchObject({ code: 'CONNECT_FAILED', kind: 'fatal' });
    expect(t.sub.status).toBe('stopped');
    t.clock.advance(60000);
    expect(sockets).toHaveLength(0);
  });

  it('no WebSocket in this host is fatal', () => {
    const w = watch();
    const sub = new DirectusWebSocketTransport(DIRECTUS, {
      collection: 'items',
      deps: { WebSocketImpl: null },
      ...w.callbacks
    });
    sub.connect();
    expect(w.errors[0]).toMatchObject({ code: 'TRANSPORT_UNAVAILABLE', kind: 'fatal' });
  });

  it('dispose is idempotent, silences the socket, and cancels pending reconnects', () => {
    const t = open();
    t.socket().error();
    expect(t.clock.pending).toBeGreaterThan(0);
    t.sub.dispose();
    t.sub.dispose();
    expect(t.clock.pending).toBe(0);
    t.clock.advance(60000);
    expect(sockets).toHaveLength(1);
    expect(t.sub.status).toBe('stopped');
  });

  it('a throwing consumer callback does not take the subscription down', () => {
    const clock = new FakeClock();
    const sub = new DirectusWebSocketTransport(DIRECTUS, {
      collection: 'items',
      deps: { WebSocketImpl: FakeSocket as never, setTimeoutImpl: clock.setTimeout, clearTimeoutImpl: clock.clearTimeout },
      onEvent: () => {
        throw new Error('a node threw');
      }
    });
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    sub.connect();
    sockets[0].open();
    sockets[0].message({ type: 'auth', status: 'ok' });
    sockets[0].message({ type: 'subscription', event: 'init', data: [] });
    // The pong is dispatched from the same handler a throwing consumer would have killed.
    sockets[0].message({ type: 'ping' });
    expect(sockets[0].sent[sockets[0].sent.length - 1]).toEqual({ type: 'pong' });
    expect(sub.status).toBe('subscribed');
    spy.mockRestore();
  });

  it('ignores a frame that is not JSON', () => {
    const t = open();
    t.socket().open();
    t.socket().onmessage?.({ data: 'not json at all' });
    expect(t.errors).toHaveLength(0);
    expect(t.changes).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════

describe('SSE transport — the NodeGX dialect', () => {
  function open(replies: { status?: number; body?: unknown }[], options: any = {}) {
    const clock = new FakeClock();
    const w = watch();
    const f = fakeFetch(replies);
    const sub = new SseTransport(
      NODEGX,
      {
        collection: 'Items',
        primaryKey: 'objectId',
        deps: {
          EventSourceImpl: FakeEventSource as never,
          fetchImpl: f.impl as never,
          setTimeoutImpl: clock.setTimeout,
          clearTimeoutImpl: clock.clearTimeout
        },
        ...w.callbacks,
        ...options
      },
      NODEGX_SSE
    );
    sub.connect();
    return { sub, clock, fetchCalls: f.calls, ...w, stream: () => streams[streams.length - 1] };
  }

  it('opens the stream, registers on the hello frame, and confirms from accepted[]', async () => {
    const t = open([{ status: 200, body: { accepted: [{ collection: 'Items' }] } }]);
    expect(t.stream().url).toBe('http://nodegx.test:8593/realtime');
    expect(t.sub.status).toBe('connecting');

    t.stream().emit('connected', { clientId: 'c1' });
    await flush();

    expect(t.fetchCalls[0].url).toBe('http://nodegx.test:8593/realtime/subscriptions');
    expect(JSON.parse(t.fetchCalls[0].init.body)).toEqual({
      clientId: 'c1',
      subscriptions: [{ collection: 'Items' }]
    });
    expect(t.sub.status).toBe('subscribed');
  });

  it('⚠️ a 200 carrying rejected[] is NOT a subscription', async () => {
    const t = open([{ status: 200, body: { accepted: [], rejected: [{ reason: '"$nonsense" is not supported' }] } }]);
    t.stream().emit('connected', { clientId: 'c1' });
    await flush();

    expect(t.sub.status).not.toBe('subscribed');
    expect(t.errors[0]).toMatchObject({ code: 'SUBSCRIPTION_REJECTED', kind: 'retryable' });
    expect(t.errors[0].message).toContain('$nonsense');
  });

  it('a rejection retries with backoff rather than sitting on a dead stream', async () => {
    const t = open([{ status: 200, body: { accepted: [], rejected: [{ reason: 'no' }] } }]);
    t.stream().emit('connected', { clientId: 'c1' });
    await flush();
    expect(streams).toHaveLength(1);
    t.clock.advance(1001);
    expect(streams).toHaveLength(2);
  });

  it('sends the server-side filter when one is given, in the dialect the server evaluates', async () => {
    // ⚠️ FH-021 changed this fixture from `{title: {equalTo: 'x'}}`, and the row was
    // green either way — which is the point. `RealtimeFilter` is the **Parse-style `$`
    // grammar**, because `nodegx-backend/src/realtime/filter.ts` matches with
    // `matchOperator` and `RealtimeHub` fails closed on an operator it cannot evaluate.
    // A neutral filter therefore produces a subscription that connects, confirms, and
    // then delivers nothing at all — and a pass-through assertion cannot see the
    // difference. The dialect is asserted here so the fixture stops teaching the wrong one.
    const t = open([{ status: 200, body: { accepted: [1] } }], { where: { title: { $eq: 'x' } } });
    t.stream().emit('connected', { clientId: 'c1' });
    await flush();
    expect(JSON.parse(t.fetchCalls[0].init.body).subscriptions[0].filter).toEqual({ title: { $eq: 'x' } });
  });

  it('normalises create, update and delete — and a delete carries the whole record', async () => {
    const t = open([{ status: 200, body: { accepted: [1] } }]);
    t.stream().emit('connected', { clientId: 'c1' });
    await flush();

    t.stream().emit('change', { action: 'create', collection: 'Items', record: { objectId: 'a', n: 1 } });
    t.stream().emit('change', { action: 'delete', collection: 'Items', record: { objectId: 'a', n: 1 } });

    expect(t.changes[0]).toEqual({
      type: 'create',
      collection: 'Items',
      ids: ['a'],
      records: [{ objectId: 'a', n: 1 }],
      recordsComplete: true
    });
    expect(t.changes[1]).toMatchObject({ type: 'delete', ids: ['a'], recordsComplete: true });
  });

  it('reports resync — the frame a create/update/delete-only consumer would drop', async () => {
    const t = open([{ status: 200, body: { accepted: [1] } }]);
    t.stream().emit('connected', { clientId: 'c1' });
    await flush();
    t.stream().emit('resync', { reason: 'reconnect' });
    expect(t.changes[0]).toEqual({
      type: 'resync',
      collection: 'Items',
      ids: [],
      records: [],
      recordsComplete: false
    });
  });

  it('ignores a change frame for another collection, and an unknown action', async () => {
    const t = open([{ status: 200, body: { accepted: [1] } }]);
    t.stream().emit('connected', { clientId: 'c1' });
    await flush();
    t.stream().emit('change', { action: 'create', collection: 'Other', record: { objectId: 'z' } });
    t.stream().emit('change', { action: 'nonsense', collection: 'Items', record: { objectId: 'z' } });
    expect(t.changes).toHaveLength(0);
  });

  it('⚠️ RE-registers on every hello frame — the clientId is fresh on each connection', async () => {
    const t = open([{ status: 200, body: { accepted: [1] } }]);
    t.stream().emit('connected', { clientId: 'c1' });
    await flush();
    expect(t.fetchCalls).toHaveLength(1);

    // EventSource reconnected on its own; the transport never saw a close.
    t.stream().emit('connected', { clientId: 'c2' });
    await flush();
    expect(t.fetchCalls).toHaveLength(2);
    expect(JSON.parse(t.fetchCalls[1].init.body).clientId).toBe('c2');
  });

  it('a late reply for a superseded clientId is ignored', async () => {
    const t = open([
      { status: 200, body: { accepted: [] , rejected: [{ reason: 'stale' }] } },
      { status: 200, body: { accepted: [1] } }
    ]);
    t.stream().emit('connected', { clientId: 'c1' });
    t.stream().emit('connected', { clientId: 'c2' });
    await flush();
    await flush();
    // The first (rejecting) reply belongs to c1, which is no longer current.
    expect(t.errors).toHaveLength(0);
  });

  it('an EventSource error does not tear down immediately — it lets the browser retry', async () => {
    const t = open([{ status: 200, body: { accepted: [1] } }]);
    t.stream().emit('connected', { clientId: 'c1' });
    await flush();
    expect(t.sub.status).toBe('subscribed');

    t.stream().fail();
    expect(t.sub.status).toBe('interrupted');
    // No new stream yet: EventSource's own retry keeps Last-Event-ID, which is what earns
    // our backend's `resync`.
    expect(streams).toHaveLength(1);

    // …and it recovers without our backoff ever running.
    t.stream().emit('connected', { clientId: 'c2' });
    await flush();
    expect(t.sub.status).toBe('subscribed');
    expect(streams).toHaveLength(1);
  });

  it('⚠️ but a host whose EventSource does not retry is still recovered, by the deadline', async () => {
    const t = open([{ status: 200, body: { accepted: [1] } }]);
    t.stream().emit('connected', { clientId: 'c1' });
    await flush();
    t.stream().fail();

    t.clock.advance(16000);
    expect(t.errors[0].code).toBe('CONNECT_TIMEOUT');
    t.clock.advance(1001);
    expect(streams).toHaveLength(2);
  });

  it('repeated errors cannot postpone the deadline forever', async () => {
    const t = open([{ status: 200, body: { accepted: [1] } }]);
    t.stream().emit('connected', { clientId: 'c1' });
    await flush();
    for (let i = 0; i < 10; i++) {
      t.stream().fail();
      t.clock.advance(3000);
    }
    // 30s of flapping: the 15s deadline must have fired regardless.
    expect(t.errors.some((e) => e.code === 'CONNECT_TIMEOUT')).toBe(true);
  });

  it('no EventSource in this host is fatal — Node has none, which is why SSR is client-only', () => {
    const w = watch();
    const sub = new SseTransport(NODEGX, { collection: 'Items', deps: { EventSourceImpl: null }, ...w.callbacks }, NODEGX_SSE);
    sub.connect();
    expect(w.errors[0]).toMatchObject({ code: 'TRANSPORT_UNAVAILABLE', kind: 'fatal' });
  });

  it('a failed registration request is reported and retried', async () => {
    const clock = new FakeClock();
    const w = watch();
    const sub = new SseTransport(
      NODEGX,
      {
        collection: 'Items',
        deps: {
          EventSourceImpl: FakeEventSource as never,
          fetchImpl: (() => Promise.reject(new Error('offline'))) as never,
          setTimeoutImpl: clock.setTimeout,
          clearTimeoutImpl: clock.clearTimeout
        },
        ...w.callbacks
      },
      NODEGX_SSE
    );
    sub.connect();
    streams[0].emit('connected', { clientId: 'c1' });
    await flush();
    expect(w.errors[0]).toMatchObject({ code: 'CONNECT_FAILED' });
    expect(w.errors[0].message).toContain('offline');
    clock.advance(1001);
    expect(streams).toHaveLength(2);
  });

  it('carries the token in the query string, because EventSource cannot set headers', () => {
    const clock = new FakeClock();
    const sub = new SseTransport(
      { ...NODEGX, sessionToken: 'a b' },
      {
        collection: 'Items',
        deps: {
          EventSourceImpl: FakeEventSource as never,
          fetchImpl: (() => Promise.resolve({ status: 200, json: () => Promise.resolve({ accepted: [1] }) })) as never,
          setTimeoutImpl: clock.setTimeout,
          clearTimeoutImpl: clock.clearTimeout
        }
      },
      NODEGX_SSE
    );
    sub.connect();
    expect(streams[0].url).toBe('http://nodegx.test:8593/realtime?token=a%20b');
    sub.dispose();
  });

  it('dispose closes the stream and stops everything', async () => {
    const t = open([{ status: 200, body: { accepted: [1] } }]);
    t.stream().emit('connected', { clientId: 'c1' });
    await flush();
    const stream = t.stream();
    t.sub.dispose();
    expect(stream.closed).toBe(true);
    expect(t.sub.status).toBe('stopped');
    t.clock.advance(120000);
    expect(streams).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════

describe('SSE transport — the PocketBase dialect', () => {
  function open(replies: { status?: number; body?: unknown }[], handle: BackendHandle = PB) {
    const clock = new FakeClock();
    const w = watch();
    const f = fakeFetch(replies);
    const sub = new SseTransport(
      handle,
      {
        collection: 'notes',
        deps: {
          EventSourceImpl: FakeEventSource as never,
          fetchImpl: f.impl as never,
          setTimeoutImpl: clock.setTimeout,
          clearTimeoutImpl: clock.clearTimeout
        },
        ...w.callbacks
      },
      POCKETBASE_SSE
    );
    sub.connect();
    return { sub, clock, fetchCalls: f.calls, ...w, stream: () => streams[streams.length - 1] };
  }

  it('⚠️ listens on the COLLECTION name, not "change"', () => {
    const t = open([{ status: 204 }]);
    expect(t.stream().listenerNames).toContain('notes');
    expect(t.stream().listenerNames).not.toContain('change');
    expect(t.stream().url).toBe('http://pb.test:8091/api/realtime');
  });

  it('registers a flat list of names and confirms on 204', async () => {
    const t = open([{ status: 204 }]);
    t.stream().emit('PB_CONNECT', { clientId: 'pb1' });
    await flush();
    expect(t.fetchCalls[0].url).toBe('http://pb.test:8091/api/realtime');
    expect(JSON.parse(t.fetchCalls[0].init.body)).toEqual({ clientId: 'pb1', subscriptions: ['notes'] });
    expect(t.sub.status).toBe('subscribed');
  });

  it('a 404 for an unknown clientId is a rejection with the server\'s own message', async () => {
    const t = open([{ status: 404, body: { message: 'Missing or invalid client id.' } }]);
    t.stream().emit('PB_CONNECT', { clientId: 'gone' });
    await flush();
    expect(t.errors[0]).toMatchObject({ code: 'SUBSCRIPTION_REJECTED' });
    expect(t.errors[0].message).toContain('Missing or invalid client id.');
  });

  it('a delete carries the whole record here, unlike Directus', async () => {
    const t = open([{ status: 204 }]);
    t.stream().emit('PB_CONNECT', { clientId: 'pb1' });
    await flush();
    t.stream().emit('notes', { action: 'delete', record: { id: 'abcdefghij12345', title: 'x' } });
    expect(t.changes[0]).toEqual({
      type: 'delete',
      collection: 'notes',
      ids: ['abcdefghij12345'],
      records: [{ id: 'abcdefghij12345', title: 'x' }],
      recordsComplete: true
    });
  });

  it('sends the token as an Authorization header, never in the stream URL', async () => {
    const t = open([{ status: 204 }], { ...PB, sessionToken: 'pbtok' });
    expect(t.stream().url).not.toContain('pbtok');
    t.stream().emit('PB_CONNECT', { clientId: 'pb1' });
    await flush();
    expect(t.fetchCalls[0].init.headers.authorization).toBe('pbtok');
  });
});

// ═══════════════════════════════════════════════════════════════════════════

describe('Parse LiveQuery — probed, and measured absent', () => {
  function open() {
    const clock = new FakeClock();
    const w = watch();
    const sub = new ParseLiveQueryTransport(
      { id: 'p', type: 'parse', name: 'Parse', url: 'http://parse.test:8092/parse', publicToken: 'app' },
      {
        collection: 'Items',
        deps: { WebSocketImpl: FakeSocket as never, setTimeoutImpl: clock.setTimeout, clearTimeoutImpl: clock.clearTimeout },
        ...w.callbacks
      }
    );
    sub.connect();
    return { sub, clock, ...w };
  }

  it('reports CAPABILITY_UNAVAILABLE, fatally, when the socket errors', () => {
    const t = open();
    sockets[0].error();
    expect(t.errors[0]).toMatchObject({ code: 'CAPABILITY_UNAVAILABLE', kind: 'fatal' });
    expect(t.sub.status).toBe('stopped');
    // Fatal means fatal: no reconnect storm against a server that will never answer.
    t.clock.advance(300000);
    expect(sockets).toHaveLength(1);
    expect(t.errors).toHaveLength(1);
  });

  it('⚠️ and when the socket says nothing at all — its absence is silent by nature', () => {
    const t = open();
    t.clock.advance(2001);
    expect(t.errors[0].code).toBe('CAPABILITY_UNAVAILABLE');
    expect(t.sub.status).toBe('stopped');
  });

  it('a LiveQuery server that DOES answer is still declined, and says why', () => {
    const t = open();
    sockets[0].open();
    expect(t.errors[0].code).toBe('CAPABILITY_UNAVAILABLE');
    expect(t.errors[0].message).toContain('never spoken the LiveQuery protocol');
    expect(t.sub.lastProbe).toMatchObject({ available: true, reason: 'unimplemented' });
  });

  it('declares transport "none", not "websocket"', () => {
    const t = open();
    expect(t.sub.transport).toBe('none');
    t.sub.dispose();
  });
});

describe('Supabase and custom — nothing measured, and it says so', () => {
  it('reports once, fatally, without opening anything', () => {
    const w = watch();
    const sub = createRealtimeSubscription(
      { id: 's', type: 'supabase', name: 'Supabase', url: 'http://sb.test' },
      { collection: 'x', deps: { WebSocketImpl: FakeSocket as never, EventSourceImpl: FakeEventSource as never }, ...w.callbacks }
    );
    expect(sockets).toHaveLength(0);
    expect(streams).toHaveLength(0);
    expect(w.errors[0]).toMatchObject({ code: 'CAPABILITY_UNAVAILABLE', kind: 'fatal' });
    expect(w.errors[0].message).toContain('unmeasured');
    expect(sub.status).toBe('stopped');
    expect(sub.transport).toBe('phoenix-channel');
  });

  it('a custom backend says there is no wire to speak', () => {
    const w = watch();
    const sub = createRealtimeSubscription(
      { id: 'c', type: 'custom', name: 'Mine', url: 'http://mine.test' },
      { collection: 'x', ...w.callbacks }
    );
    expect(w.errors[0].code).toBe('CAPABILITY_UNAVAILABLE');
    expect(sub.transport).toBe('none');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//
// FH-021 — the standalone Subscribe To Changes node, on the same doubles.
//
// These rows are the node layer, not the wire: the transports above prove what arrives,
// and what is unproven until here is that a node an author dropped on a canvas turns it
// into signals and outputs. Every row that claims a subscription **receives** something
// drives a real transport end to end — the hello frame, the registration POST, the change
// frame — because a subscription test that never receives an event proves nothing.
//
// The doubles are installed as globals rather than injected: the node calls
// `createRealtimeSubscription` with no `deps`, exactly as it does in a browser, so
// swapping `EventSource`/`WebSocket`/`fetch` is what exercises the code that ships.
// ═══════════════════════════════════════════════════════════════════════════


/** One backend of a given type, as the project metadata a running runtime would carry. */
function useBackend(type: string, url = 'http://nodegx.test:8593'): void {
  (NoodlRuntime as unknown as { instance: unknown }).instance = {
    getMetaData: (key: string) =>
      key === 'backendServices' ? { backends: [{ id: 'b1', type, name: 'The backend', url }] } : undefined
  };
}

describe('Subscribe To Changes (FH-021)', () => {
  const realEventSource = (globalThis as any).EventSource;
  const realWebSocket = (globalThis as any).WebSocket;
  const realFetch = (globalThis as any).fetch;
  const realInstance = (NoodlRuntime as unknown as { instance: unknown }).instance;

  /** Every subscription POST answered `accepted`, and every call recorded. */
  let fetchCalls: { url: string; init: any }[] = [];

  beforeEach(() => {
    fetchCalls = [];
    (globalThis as any).EventSource = FakeEventSource;
    (globalThis as any).WebSocket = FakeSocket;
    (globalThis as any).fetch = (url: string, init?: unknown) => {
      fetchCalls.push({ url, init });
      return Promise.resolve({ status: 200, json: () => Promise.resolve({ accepted: [{ collection: 'Note' }] }) });
    };
    useBackend('nodegx');
  });

  afterEach(() => {
    (globalThis as any).EventSource = realEventSource;
    (globalThis as any).WebSocket = realWebSocket;
    (globalThis as any).fetch = realFetch;
    (NoodlRuntime as unknown as { instance: unknown }).instance = realInstance;
  });

  /**
   * Build the node and let its scheduled reconfigure run.
   *
   * `scheduleAfterInputsHaveUpdated` queues onto the update loop, so `update()` is what a
   * frame would have done. Every input here is a *dynamic* one — the node declares only
   * `Enabled` — so `registerInputIfNeeded` is on the path, which is also the path a saved
   * project takes when it applies a parameter before the port exists.
   */
  function place(inputs: Record<string, unknown> = { collectionName: 'Note' }): DrivenNode {
    const probe = createNode(subscribeModule as never, 'SubscribeToChanges', 'sub-1');
    for (const [name, value] of Object.entries(inputs)) {
      probe.node.registerInputIfNeeded(name);
      probe.node.setInputValue(name, value);
    }
    probe.node.update();
    return probe;
  }

  const stream = () => streams[streams.length - 1];

  // ── the default that makes it the easy path ──────────────────────────────

  it('⚠️ subscribes with nothing configured but a class — the Enabled default runs no setter', () => {
    const probe = place();

    // If `Enabled` were read off `_internal` it would be `undefined` here, because a port
    // declared with a `default` never runs its setter — and this node would sit inert
    // until somebody toggled a checkbox twice. That is the whole "drop it and go" claim.
    expect(streams).toHaveLength(1);
    expect(stream().url).toBe('http://nodegx.test:8593/realtime');
    expect(probe.out('realtimeStatus')).toBe('connecting');

    probe.node._onNodeDeleted();
  });

  it('and with no Backend chosen either: an untouched picker resolves to the project default', async () => {
    const probe = place();
    stream().emit('connected', { clientId: 'c1' });
    await flush();

    expect(fetchCalls[0].url).toBe('http://nodegx.test:8593/realtime/subscriptions');
    expect(JSON.parse(fetchCalls[0].init.body).subscriptions[0].collection).toBe('Note');

    probe.node._onNodeDeleted();
  });

  it('does nothing at all without a class — an unnamed subscription is not a subscription', () => {
    const probe = place({});
    expect(streams).toHaveLength(0);
    expect(probe.signals).toEqual([]);
    probe.node._onNodeDeleted();
  });

  // ── delivery ─────────────────────────────────────────────────────────────

  it('turns a delivered change into signals and outputs', async () => {
    const probe = place();
    stream().emit('connected', { clientId: 'c1' });
    await flush();

    expect(probe.out('subscribed')).toBe(true);
    expect(probe.out('realtimeStatus')).toBe('subscribed');

    stream().emit('change', { action: 'create', collection: 'Note', record: { objectId: 'n1', title: 'a' } });

    expect(probe.signals).toEqual(['created', 'changed']);
    expect(probe.out('changedEvent')).toBe('create');
    expect(probe.out('changedRecordId')).toBe('n1');
    expect(probe.out('changedRecord')).toEqual({ objectId: 'n1', title: 'a' });
    expect(probe.out('changedRecords')).toEqual([{ objectId: 'n1', title: 'a' }]);

    stream().emit('change', { action: 'update', collection: 'Note', record: { objectId: 'n1', title: 'b' } });
    expect(probe.signals).toEqual(['created', 'changed', 'updated', 'changed']);

    probe.node._onNodeDeleted();
  });

  it('a resync fires Records Changed and nothing else — it is not a create', async () => {
    const probe = place();
    stream().emit('connected', { clientId: 'c1' });
    await flush();

    stream().emit('resync', { reason: 'reconnect' });

    expect(probe.signals).toEqual(['changed']);
    expect(probe.out('changedEvent')).toBe('resync');
    expect(probe.out('changedRecordId')).toBe('');

    probe.node._onNodeDeleted();
  });

  it('⚠️ a Directus delete carries the key only, and Changed Record Id is the output that works', () => {
    // The one place the "a subscription without a query is a stream of ids nobody can
    // render" objection still bites (TALK-005 correction 3). Driven end to end on the
    // WebSocket wire rather than asserted at the node's method, because the null is
    // produced by `recordsComplete` — and a create/update-only test passes while a delete
    // publishes `{}`.
    useBackend('directus', 'http://directus.test:8055');
    const probe = place({ collectionName: 'items' });

    const socket = sockets[sockets.length - 1];
    socket.open();
    socket.message({ type: 'auth', status: 'ok' });
    socket.message({ type: 'subscription', event: 'init', data: [] });

    // `init` is the confirmation snapshot, not a burst of writes.
    expect(probe.signals).toEqual([]);
    expect(probe.out('subscribed')).toBe(true);

    socket.message({ type: 'subscription', event: 'delete', data: ['2'] });

    expect(probe.signals).toEqual(['deleted', 'changed']);
    expect(probe.out('changedRecord')).toBeNull();
    expect(probe.out('changedRecords')).toEqual([]);
    // A string, even though the Directus primary key is an integer.
    expect(probe.out('changedRecordId')).toBe('2');

    probe.node._onNodeDeleted();
  });

  // ── the switch, and the teardown ─────────────────────────────────────────

  it('Enabled false closes the connection and clears Subscribed; true opens a new one', async () => {
    const probe = place();
    stream().emit('connected', { clientId: 'c1' });
    await flush();
    expect(probe.out('subscribed')).toBe(true);

    probe.node.setInputValue('enabled', false);
    probe.node.update();

    expect(stream().closed).toBe(true);
    expect(probe.out('subscribed')).toBe(false);
    expect(probe.out('realtimeStatus')).toBe('');

    probe.node.setInputValue('enabled', true);
    probe.node.update();
    expect(streams).toHaveLength(2);
    expect(stream().closed).toBe(false);

    probe.node._onNodeDeleted();
  });

  it('deleting the node leaves nothing connected', () => {
    const probe = place();
    expect(streams).toHaveLength(1);

    probe.node._onNodeDeleted();
    expect(stream().closed).toBe(true);
  });

  it('changing the class moves the subscription rather than adding one', () => {
    const probe = place();
    const first = stream();

    probe.node.setInputValue('collectionName', 'Task');
    probe.node.update();

    expect(first.closed).toBe(true);
    expect(streams).toHaveLength(2);

    probe.node._onNodeDeleted();
  });

  // ── the disclosure ───────────────────────────────────────────────────────

  it('⚠️ Supabase reports a reason on Realtime Error and fires Realtime Failure', () => {
    useBackend('supabase', 'http://sb.test');
    const probe = place();

    // Answered without opening anything, so it is a sentence rather than a spinner.
    expect(streams).toHaveLength(0);
    expect(sockets).toHaveLength(0);
    expect(probe.signals).toEqual(['realtimeFailure']);
    expect(probe.out('subscribed')).toBe(false);

    const error = probe.out('realtimeError') as { code: string; message: string; kind: string };
    expect(error.code).toBe('CAPABILITY_UNAVAILABLE');
    expect(error.kind).toBe('fatal');
    expect(error.message).toContain('unmeasured');

    probe.node._onNodeDeleted();
  });

  it('a backend the project no longer has says so, naming what it was set to', () => {
    const probe = place({ collectionName: 'Note', backendId: 'gone' });

    expect(streams).toHaveLength(0);
    const error = probe.out('realtimeError') as { message: string };
    expect(error.message).toContain('"gone"');
    expect(probe.signals).toEqual(['realtimeFailure']);

    probe.node._onNodeDeleted();
  });

  // ── the filter, and the dialect it has to be in ──────────────────────────

  it('⚠️ sends the filter in the backend\'s own dialect, not the neutral one', async () => {
    const probe = place({
      collectionName: 'Note',
      visualFilter: {
        combinator: 'and',
        rules: [{ property: 'title', operator: 'equal to', value: 'a' }]
      }
    });
    stream().emit('connected', { clientId: 'c1' });
    await flush();

    // `$eq`, not `equalTo`. Our backend evaluates a subscription filter with the same
    // Parse-style grammar its query routes use; the neutral document would be refused by
    // `matchOperator` and `RealtimeHub` would then fail closed — a live subscription
    // delivering nothing, with nothing anywhere saying why.
    expect(JSON.parse(fetchCalls[0].init.body).subscriptions[0].filter).toEqual({ title: { $eq: 'a' } });

    probe.node._onNodeDeleted();
  });

  it('a filter value port re-subscribes when it moves — the server decides what is delivered', async () => {
    const probe = place({
      collectionName: 'Note',
      visualFilter: {
        combinator: 'and',
        rules: [{ property: 'title', operator: 'equal to', input: 'wanted' }]
      }
    });
    probe.node.registerInputIfNeeded('qp-wanted');
    probe.node.setInputValue('qp-wanted', 'a');
    probe.node.update();

    stream().emit('connected', { clientId: 'c1' });
    await flush();
    expect(JSON.parse(fetchCalls[fetchCalls.length - 1].init.body).subscriptions[0].filter).toEqual({
      title: { $eq: 'a' }
    });

    probe.node.setInputValue('qp-wanted', 'b');
    probe.node.update();
    stream().emit('connected', { clientId: 'c2' });
    await flush();
    expect(JSON.parse(fetchCalls[fetchCalls.length - 1].init.body).subscriptions[0].filter).toEqual({
      title: { $eq: 'b' }
    });

    probe.node._onNodeDeleted();
  });

  it('sends no filter when none is set, rather than an empty one', async () => {
    const probe = place();
    stream().emit('connected', { clientId: 'c1' });
    await flush();

    expect(JSON.parse(fetchCalls[0].init.body).subscriptions[0]).toEqual({ collection: 'Note' });

    probe.node._onNodeDeleted();
  });

  // ── what the definition promises ─────────────────────────────────────────

  it('is client-only, and says so on the definition rather than checking a platform', () => {
    const probe = place({});
    expect(probe.metadata.ssr).toMatchObject({ compat: 'client-only' });
    probe.node._onNodeDeleted();
  });

  // ── the ports the editor is sent ─────────────────────────────────────────

  /**
   * Run the module's `setup` against a fake editor and hand back what it published.
   *
   * The port set is the *whole* author-facing surface of this node — a picker that hid
   * itself when it should not, or a Filter port with no disclosure on it, is invisible to
   * every row above. This is the one place either can be seen.
   */
  function portsSent(parameters: Record<string, unknown>, backends: unknown[]) {
    let sent: any[] = [];
    const handlers: Record<string, ((...args: any[]) => void)[]> = {};
    const graphModel: any = {
      getMetaData: (key: string) => (key === 'backendServices' ? { backends } : undefined),
      on: (name: string, cb: (...args: any[]) => void) => {
        (handlers[name] = handlers[name] || []).push(cb);
      },
      getNodesWithType: () => [{ id: 'n1', parameters, on: () => undefined }]
    };
    const context: any = {
      editorConnection: {
        isRunningLocally: () => true,
        sendDynamicPorts: (_id: string, ports: any[]) => {
          sent = ports;
        }
      }
    };

    (subscribeModule as unknown as { setup(c: unknown, g: unknown): void }).setup(context, graphModel);
    (handlers['editorImportComplete'] || []).forEach((cb) => cb());
    return sent;
  }

  const NOTE_SCHEMA = {
    id: 'b1',
    type: 'nodegx',
    name: 'The backend',
    url: 'http://nodegx.test:8593',
    schema: { collections: [{ name: 'Note', primaryKey: 'objectId', fields: [{ name: 'title', type: 'string' }] }] }
  };

  it('⚠️ hides the Backend picker in a one-backend project — that IS the easy path', () => {
    const ports = portsSent({ collectionName: 'Note' }, [NOTE_SCHEMA]);
    expect(ports.find((p) => p.name === 'backendId')).toBeUndefined();
    // And the node still resolves one, which the delivery rows above prove.
    expect(ports.find((p) => p.name === 'collectionName')).toMatchObject({ displayName: 'Class' });
  });

  it('offers the picker, defaulted to Active Backend, once there are two', () => {
    const ports = portsSent({ collectionName: 'Note' }, [NOTE_SCHEMA, { id: 'b2', type: 'directus', name: 'D' }]);
    expect(ports.find((p) => p.name === 'backendId')).toMatchObject({ default: '_active_' });
  });

  it('⚠️ the Filter port carries the disclosure, and carries it where a row is rendered', () => {
    // `description` is the field `Ports.renderParams` turns into the row's tooltip. The
    // asymmetry is deliberate (only NodeGX evaluates a subscription filter) and this
    // sentence is the whole of what makes it a knowing one rather than a fourth twin of
    // the filter semantics BCN-003 collapsed.
    const filter = portsSent({ collectionName: 'Note' }, [NOTE_SCHEMA]).find((p) => p.name === 'visualFilter');
    expect(filter).toBeDefined();
    expect(String(filter.description)).toContain('built-in NodeGX backend only');
    expect(String(filter.description)).toContain('never applied on the client');
  });

  it('declares no Filter port at all when there is no schema to build one from', () => {
    const ports = portsSent({ collectionName: 'Note' }, [{ id: 'b1', type: 'directus', name: 'D' }]);
    expect(ports.find((p) => p.name === 'visualFilter')).toBeUndefined();
  });

  it('mints one Query Parameter port per filter value bound to one', () => {
    const ports = portsSent(
      {
        collectionName: 'Note',
        visualFilter: { combinator: 'and', rules: [{ property: 'title', operator: 'equal to', input: 'wanted' }] }
      },
      [NOTE_SCHEMA]
    );
    expect(ports.find((p) => p.name === 'qp-wanted')).toMatchObject({ displayName: 'wanted', plug: 'input' });
  });

  it('⚠️ declares the Realtime ports whatever the backend is — nothing is gated', () => {
    // TALK-005's shipped correction. A capability that disappears from the panel when the
    // picker moves is worse than one that says why it cannot connect, and the Supabase row
    // above is the other half of that claim.
    const probe = place({});
    const outputs = Object.keys(probe.metadata.outputs);
    for (const name of ['subscribed', 'realtimeStatus', 'realtimeError', 'realtimeFailure', 'changedRecordId']) {
      expect(outputs).toContain(name);
    }
    probe.node._onNodeDeleted();
  });
});
