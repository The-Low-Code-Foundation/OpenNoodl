/**
 * The realtime contract's invariants.
 *
 * There is still no behaviour in this package, so most of these are assertions
 * about a table of measurements: that it cannot claim more than it measured,
 * that the one piece of arithmetic in it is right, and that the two facts which
 * were each learned the expensive way — Directus deletes carry string keys, and
 * a failed connect does not fire `close` — stay written down where an
 * implementer will meet them.
 *
 * The backoff tests are the only ones with a function under them, and it is a
 * function precisely because a doubling that overflows is silent: a subscription
 * retrying every 4ms looks exactly like one that is working.
 */

import {
  BACKEND_DESCRIPTORS,
  BACKEND_TYPES,
  REALTIME_ADAPTER_METHODS,
  REALTIME_EVENT_TYPES,
  REALTIME_FAILURE_KINDS,
  REALTIME_SSR_COMPAT,
  REALTIME_TIMING,
  REALTIME_TRANSPORT_PROFILES,
  deleteCarriesRecord,
  nextReconnectDelay,
  realtimeProfileFor,
  type BackendHandle,
  type IRealtimeAdapter,
  type RealtimeChange,
  type RealtimeError,
  type RealtimeErrorCode,
  type RealtimeHandle,
  type RealtimeLifecycle,
  type RealtimeSubscribeOptions
} from '../src';

// ── Compile-time exhaustiveness, as `contract.test.ts` does it ─────────────

type MissingRealtimeMethod = Exclude<keyof IRealtimeAdapter, (typeof REALTIME_ADAPTER_METHODS)[number] | 'transport'>;
const _realtimeMethodsAreExhaustive: MissingRealtimeMethod extends never ? true : never = true;

describe('IRealtimeAdapter', () => {
  it('is one method, and the interesting part is the handle it returns', () => {
    expect(REALTIME_ADAPTER_METHODS).toEqual(['subscribe']);
    expect(_realtimeMethodsAreExhaustive).toBe(true);
  });

  it('can be implemented — the shape compiles against a stub', () => {
    // Not ceremony: `subscribe` returning a holdable handle rather than taking
    // an unsubscribe callback is this file's one deviation from the package's
    // `{success, error}` house style, so it is worth proving somebody can write
    // it down.
    const adapter: IRealtimeAdapter = {
      transport: 'sse',
      subscribe(_handle: BackendHandle, options: RealtimeSubscribeOptions): RealtimeHandle {
        return { collection: options.collection, status: 'connecting', dispose() {} };
      }
    };
    const handle = adapter.subscribe(
      { id: 'b1', type: 'nodegx', name: 'Built-in', url: 'http://localhost:8577' },
      { collection: 'Articles' }
    );
    expect(handle.collection).toBe('Articles');
    expect(handle.status).toBe('connecting');
  });

  it('models init and resync, not just the three writes', () => {
    // A consumer that handles only create/update/delete drops the one frame
    // that says "your view is stale" — our backend keeps no replay log and
    // neither will anything else.
    expect(REALTIME_EVENT_TYPES).toContain('init');
    expect(REALTIME_EVENT_TYPES).toContain('resync');
    expect(REALTIME_EVENT_TYPES).toHaveLength(5);
  });
});

describe('failure classification', () => {
  it('classifies every code, with no gaps for a transport to fill in differently', () => {
    const codes: RealtimeErrorCode[] = [
      'TRANSPORT_UNAVAILABLE',
      'CONNECT_FAILED',
      'CONNECT_TIMEOUT',
      'AUTH_FAILED',
      'SUBSCRIPTION_REJECTED',
      'HEARTBEAT_MISSED',
      'CAPABILITY_UNAVAILABLE'
    ];
    for (const code of codes) {
      expect(REALTIME_FAILURE_KINDS[code]).toMatch(/^(fatal|retryable)$/);
    }
    expect(Object.keys(REALTIME_FAILURE_KINDS).sort()).toEqual([...codes].sort());
  });

  it('keeps AUTH_FAILED fatal, because retrying a bad token loops until the tab closes', () => {
    expect(REALTIME_FAILURE_KINDS.AUTH_FAILED).toBe('fatal');
    expect(REALTIME_FAILURE_KINDS.CAPABILITY_UNAVAILABLE).toBe('fatal');
  });

  it('makes an error say whether to retry — there is no way to build one that does not', () => {
    const err: RealtimeError = { message: 'nope', code: 'CONNECT_FAILED', kind: REALTIME_FAILURE_KINDS.CONNECT_FAILED };
    expect(err.kind).toBe('retryable');
  });
});

describe('the reconnect backoff', () => {
  it('is 1s doubling to a 30s cap', () => {
    expect(nextReconnectDelay(0)).toBe(1000);
    expect(nextReconnectDelay(1)).toBe(2000);
    expect(nextReconnectDelay(2)).toBe(4000);
    expect(nextReconnectDelay(5)).toBe(30000);
    expect(nextReconnectDelay(50)).toBe(30000);
  });

  it('never returns NaN, Infinity or a sub-second delay for a hostile counter', () => {
    // A counter that is never reset climbs forever, and `1000 * 2**1024` is
    // Infinity — which `Math.min` happily returns.
    for (const attempt of [-1, 0.5, NaN, Infinity, 1e9]) {
      const d = nextReconnectDelay(attempt);
      expect(Number.isFinite(d)).toBe(true);
      expect(d).toBeGreaterThanOrEqual(REALTIME_TIMING.reconnectBaseMs);
      expect(d).toBeLessThanOrEqual(REALTIME_TIMING.reconnectMaxMs);
    }
  });

  it('carries a connect deadline, because a socket can fire neither error nor close', () => {
    // Measured: a WebSocket opened against a real HTTP server on a path it does
    // not upgrade stayed silent for the full 20s the probe waited. Without a
    // timer that subscription never connects and never reports.
    expect(REALTIME_TIMING.connectTimeoutMs).toBeGreaterThan(0);
    expect(REALTIME_TIMING.connectTimeoutMs).toBeLessThan(REALTIME_TIMING.reconnectMaxMs);
  });
});

describe('the lifecycle', () => {
  it('funnels every failure path into one transportDown', () => {
    // The undici trap, made structural. A transport that reconnects from
    // `onclose` alone cannot satisfy this interface, because the reason union
    // names two paths `onclose` never takes.
    const seen: string[] = [];
    const lifecycle: RealtimeLifecycle = {
      status: 'connecting',
      connect() {},
      confirmed() {},
      transportDown(reason) {
        seen.push(reason);
      },
      dispose() {}
    };
    lifecycle.transportDown('closed');
    lifecycle.transportDown('errored');
    lifecycle.transportDown('connect-timeout');
    lifecycle.transportDown('heartbeat-missed');
    expect(seen).toEqual(['closed', 'errored', 'connect-timeout', 'heartbeat-missed']);
  });
});

describe('the measured transport profiles', () => {
  it('covers every backend type except custom, which is declarable by its owner', () => {
    for (const type of BACKEND_TYPES) {
      if (type === 'custom') {
        expect(realtimeProfileFor(type)).toBeUndefined();
        continue;
      }
      expect(realtimeProfileFor(type)).toBeDefined();
    }
  });

  it('records Directus deleting a NUMERIC primary key as a STRING key, with no record body', () => {
    // The finding RUN-003 paid for and BCN-008 re-measured: `id: 1` deletes as
    // `["1"]`. If this ever flips, the record family's delete output changes
    // shape on one backend and nowhere else.
    const directus = REALTIME_TRANSPORT_PROFILES.directus;
    expect(directus.deleteEvent).toEqual({ carries: 'keys-only', wireKeyType: 'string', coercedFromRest: true });
    expect(deleteCarriesRecord('directus')).toBe(false);
  });

  it('records the two SSE backends carrying the whole record on a delete', () => {
    expect(deleteCarriesRecord('nodegx')).toBe(true);
    expect(deleteCarriesRecord('pocketbase')).toBe(true);
  });

  it('will not let an unmeasured row claim to have been measured', () => {
    // Supabase Realtime is not in the rig — a separate Elixir service the
    // compose file has never contained. This is the assertion that makes
    // somebody think before flipping it.
    expect(REALTIME_TRANSPORT_PROFILES.supabase.measured).toBe(false);
    expect(REALTIME_TRANSPORT_PROFILES.supabase.evidence).toMatch(/No Supabase Realtime exists in this rig/);

    for (const profile of Object.values(REALTIME_TRANSPORT_PROFILES)) {
      // Measured or not, every row says where its claim came from.
      expect(profile.evidence.length).toBeGreaterThan(20);
    }
  });

  it('keeps an unmeasured backend out of `supported` in the descriptor', () => {
    // The join between the two tables, and the point of `measured` existing:
    // a row nobody has run cannot be the reason a port is enabled.
    for (const type of BACKEND_TYPES) {
      const profile = realtimeProfileFor(type);
      if (!profile || profile.measured) continue;
      expect(BACKEND_DESCRIPTORS[type].capabilities['realtime.subscribe'].state).not.toBe('supported');
    }
  });

  it('leaves Parse conditional, and records that its absence is fast to detect', () => {
    expect(BACKEND_DESCRIPTORS.parse.capabilities['realtime.subscribe'].state).toBe('conditional');
    expect(REALTIME_TRANSPORT_PROFILES.parse.transport).toBe('none');
    expect(REALTIME_TRANSPORT_PROFILES.parse.connectFailure).toMatch(/20ms/);
  });

  it('does not describe a keepalive it did not see', () => {
    // `none-observed` with a window on it, rather than a confident "no
    // heartbeat". PocketBase sent nothing in 130s; that is a bound, not a fact
    // about the product.
    const pb = REALTIME_TRANSPORT_PROFILES.pocketbase.keepalive!;
    expect(pb.rule).toBe('none-observed');
    expect(pb.intervalMs).toBeNull();
    expect(pb.observedForMs).toBeGreaterThan(0);

    const directus = REALTIME_TRANSPORT_PROFILES.directus.keepalive!;
    expect(directus.rule).toBe('server-ping-client-pong');
    expect(directus.disconnectsSilentClientAfterMs).toBe(60000);
  });
});

describe('SSR', () => {
  it('is client-only for every transport', () => {
    // Two independent reasons, both in realtime.ts: a server render must not
    // open a socket per request, and Node has no global EventSource to open one
    // with (measured on 22.22.0).
    expect(REALTIME_SSR_COMPAT).toBe('client-only');
  });
});

describe('the normalised change', () => {
  it('guarantees string ids and flags whether the records are whole', () => {
    const directusDelete: RealtimeChange = {
      type: 'delete',
      collection: 'articles',
      ids: ['1'],
      records: [],
      recordsComplete: false
    };
    const nodegxDelete: RealtimeChange = {
      type: 'delete',
      collection: 'Articles',
      ids: ['0a1105ac-2cff-4f0c-b415-3e66010979ad'],
      records: [{ objectId: '0a1105ac-2cff-4f0c-b415-3e66010979ad', title: 'probe row' }],
      recordsComplete: true
    };
    // Same event, same output port, two different amounts of truth — and one
    // boolean an author can gate on instead of guessing from records.length.
    expect(directusDelete.ids.every((id) => typeof id === 'string')).toBe(true);
    expect(nodegxDelete.ids.every((id) => typeof id === 'string')).toBe(true);
    expect(directusDelete.recordsComplete).toBe(false);
    expect(nodegxDelete.recordsComplete).toBe(true);
  });
});
