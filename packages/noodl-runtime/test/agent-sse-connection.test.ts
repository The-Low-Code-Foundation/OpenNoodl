/**
 * AGENT-001 — the SSE connection lifecycle matrix.
 *
 * The point of this suite is the failure paths, not the happy one. Every case the
 * umbrella task names is here: network drop and recovery, the server closing the
 * stream, cancelling in flight, rapid open/close cycles, and teardown — each with an
 * assertion that nothing was left running afterwards (`hasPendingTimer()` false, the
 * transport closed, no callbacks after dispose).
 *
 * There is no server and no DOM: `EventSource`, `fetch`, `AbortController` and the
 * timers are all injected, which is the only way this is testable in the runtime's
 * `node` test environment.
 */

import {
  backoffDelay,
  RecentIds,
  resolveTransport,
  SseConnection,
  SseConnectionOptions,
  SseConnectionState
} from '../src/nodes/std-library/agent/sse-connection';

const { nextReconnectDelay } = require('../src/nodes/std-library/data/byob-realtime');

// ============================================================================
// Doubles
// ============================================================================

/** Fake timers that can be inspected — a leak is a timer still in the map. */
function makeTimers() {
  let nextId = 1;
  const timers = new Map<number, { fn: () => void; ms: number }>();
  return {
    setTimeoutImpl: (fn: () => void, ms: number) => {
      const id = nextId++;
      timers.set(id, { fn, ms });
      return id;
    },
    clearTimeoutImpl: (id: number) => {
      timers.delete(id);
    },
    pending: () => timers.size,
    delays: () => Array.from(timers.values()).map((t) => t.ms),
    /** Fires everything currently scheduled (new timers scheduled by it do not run). */
    run: () => {
      const entries = Array.from(timers.values());
      timers.clear();
      entries.forEach((t) => t.fn());
    }
  };
}

/** A controllable response body implementing the web-streams reader interface. */
function makeBody() {
  const queue: string[] = [];
  let pending: { resolve: (v: any) => void; reject: (e: any) => void } | null = null;
  let ended = false;
  let failure: Error | null = null;
  const state = { cancelled: false, readerTaken: false };

  const settle = () => {
    if (!pending) return;
    const p = pending;
    if (queue.length > 0) {
      pending = null;
      p.resolve({ value: queue.shift(), done: false });
    } else if (failure) {
      pending = null;
      p.reject(failure);
    } else if (ended) {
      pending = null;
      p.resolve({ value: undefined, done: true });
    }
  };

  return {
    state,
    body: {
      getReader() {
        state.readerTaken = true;
        return {
          read() {
            if (queue.length > 0) return Promise.resolve({ value: queue.shift(), done: false });
            if (failure) return Promise.reject(failure);
            if (ended) return Promise.resolve({ value: undefined, done: true });
            return new Promise((resolve, reject) => {
              pending = { resolve, reject };
            });
          },
          cancel() {
            state.cancelled = true;
            return Promise.resolve();
          }
        };
      }
    },
    push(text: string) {
      queue.push(text);
      settle();
    },
    end() {
      ended = true;
      settle();
    },
    fail(message: string) {
      failure = new Error(message);
      settle();
    }
  };
}

type FetchResponseSpec = { status?: number; ok?: boolean; body?: unknown } | { reject: string };

/** Fake fetch that hands out queued responses and records every call. */
function makeFetch(responses: FetchResponseSpec[]) {
  const calls: Array<{ url: string; init: any }> = [];
  const fn = (url: string, init: any) => {
    calls.push({ url, init });
    const spec = responses[Math.min(calls.length - 1, responses.length - 1)];
    if (spec && (spec as any).reject) return Promise.reject(new Error((spec as any).reject));
    const s = spec as { status?: number; ok?: boolean; body?: unknown };
    const status = s.status === undefined ? 200 : s.status;
    return Promise.resolve({ ok: s.ok !== undefined ? s.ok : status >= 200 && status < 300, status, body: s.body });
  };
  (fn as any).calls = calls;
  return fn as any;
}

/**
 * A `fetch` that brand-checks its receiver the way a browser's does.
 *
 * This exists because of a defect the whole rest of this suite could not see: the
 * transport called its injected fetch as `this._fetch(...)`, a method call on the
 * transport object. Node's `fetch` is an ordinary function and ignores its receiver,
 * so every test passed; a browser's rejects anything that is not a Window with
 * "Illegal invocation", so the first real run in the editor's preview failed on the
 * first token. Any double used here must reject a non-global receiver, or the same
 * bug can be reintroduced with the suite still green.
 */
function makeBrowserLikeFetch(responses: FetchResponseSpec[]) {
  const inner = makeFetch(responses);
  const fn = function (this: unknown, url: string, init: any) {
    if (this !== undefined && this !== globalThis) {
      return Promise.reject(new TypeError("Failed to execute 'fetch' on 'Window': Illegal invocation"));
    }
    return inner(url, init);
  };
  (fn as any).calls = (inner as any).calls;
  return fn as any;
}

function makeAbortController() {
  const created: any[] = [];
  function FakeAbortController(this: any) {
    this.aborted = false;
    this.signal = { aborted: false };
    created.push(this);
  }
  FakeAbortController.prototype.abort = function () {
    this.aborted = true;
    this.signal.aborted = true;
  };
  (FakeAbortController as any).created = created;
  return FakeAbortController as any;
}

/** Fake EventSource with the readyState transitions the real one exposes. */
function makeEventSource() {
  const instances: any[] = [];
  function FakeES(this: any, url: string, options: any) {
    this.url = url;
    this.options = options;
    this.readyState = 0;
    this.closed = false;
    this.listeners = {} as Record<string, Array<(ev: any) => void>>;
    this.onopen = null;
    this.onmessage = null;
    this.onerror = null;
    instances.push(this);
  }
  FakeES.prototype.addEventListener = function (type: string, cb: (ev: any) => void) {
    (this.listeners[type] || (this.listeners[type] = [])).push(cb);
  };
  FakeES.prototype.close = function () {
    this.closed = true;
    this.readyState = 2;
  };
  /** Test helpers. */
  FakeES.prototype.serverOpen = function () {
    this.readyState = 1;
    if (this.onopen) this.onopen({});
  };
  FakeES.prototype.serverMessage = function (data: string, lastEventId?: string) {
    if (this.onmessage) this.onmessage({ data, lastEventId: lastEventId || '' });
  };
  FakeES.prototype.serverNamed = function (type: string, data: string, lastEventId?: string) {
    (this.listeners[type] || []).forEach((cb: any) => cb({ data, lastEventId: lastEventId || '' }));
  };
  /** `retrying` mirrors the browser's own reconnect; otherwise it gave up. */
  FakeES.prototype.serverError = function (retrying: boolean) {
    this.readyState = retrying ? 0 : 2;
    if (this.onerror) this.onerror({});
  };
  (FakeES as any).instances = instances;
  return FakeES as any;
}

/** Collects everything the connection reports, for order-sensitive assertions. */
function makeRecorder() {
  const states: SseConnectionState[] = [];
  const frames: Array<{ event: string; data: string; id: string }> = [];
  const errors: string[] = [];
  const duplicates: Array<{ id: string }> = [];
  return {
    states,
    frames,
    errors,
    duplicates,
    hooks: {
      onState: (s: SseConnectionState) => states.push(s),
      onFrame: (f: any) => frames.push({ event: f.event, data: f.data, id: f.id }),
      onError: (m: string) => errors.push(m),
      onDuplicate: (f: any) => duplicates.push({ id: f.id })
    }
  };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

function fetchConnection(overrides: Partial<SseConnectionOptions>, recorder = makeRecorder(), timers = makeTimers()) {
  const connection = new SseConnection({
    url: 'https://example.test/stream',
    transport: 'fetch',
    AbortControllerImpl: makeAbortController(),
    setTimeoutImpl: timers.setTimeoutImpl,
    clearTimeoutImpl: timers.clearTimeoutImpl,
    nowImpl: () => 1000,
    ...recorder.hooks,
    ...overrides
  } as SseConnectionOptions);
  return { connection, recorder, timers };
}

// ============================================================================

describe('backoffDelay', () => {
  it('doubles from the base and stops at the ceiling', () => {
    expect(backoffDelay(0, 1000, 30000)).toBe(1000);
    expect(backoffDelay(1, 1000, 30000)).toBe(2000);
    expect(backoffDelay(4, 1000, 30000)).toBe(16000);
    expect(backoffDelay(10, 1000, 30000)).toBe(30000);
    expect(backoffDelay(999, 1000, 30000)).toBe(30000);
  });

  it('agrees with byob-realtime for the default parameters', () => {
    // The two implementations exist only because this one is parameterised. If they
    // ever diverge, that is a bug in one of them and this fails.
    for (let attempt = 0; attempt < 12; attempt++) {
      expect(backoffDelay(attempt, 1000, 30000)).toBe(nextReconnectDelay(attempt));
    }
  });

  it('falls back to sane defaults for nonsense parameters', () => {
    expect(backoffDelay(0, 0, 0)).toBe(1000);
    expect(backoffDelay(-5, 500, 5000)).toBe(500);
  });
});

describe('RecentIds', () => {
  it('reports a repeat and evicts the oldest past the limit', () => {
    const ids = new RecentIds(3);
    expect(ids.add('a')).toBe(true);
    expect(ids.add('a')).toBe(false);
    ids.add('b');
    ids.add('c');
    ids.add('d'); // evicts 'a'
    expect(ids.size).toBe(3);
    expect(ids.has('a')).toBe(false);
    expect(ids.add('a')).toBe(true);
  });
});

describe('resolveTransport', () => {
  it('honours an explicit choice', () => {
    expect(resolveTransport({ transport: 'eventsource', fetchImpl: () => {} })).toBe('eventsource');
    expect(resolveTransport({ transport: 'fetch', EventSourceImpl: function () {} })).toBe('fetch');
  });

  it('prefers fetch on auto, because it is strictly more capable', () => {
    expect(resolveTransport({ fetchImpl: () => {}, EventSourceImpl: function () {} })).toBe('fetch');
  });

  it('falls back to EventSource when fetch is absent', () => {
    expect(resolveTransport({ fetchImpl: null, EventSourceImpl: function () {} })).toBe('eventsource');
  });
});

describe('SseConnection — fetch transport, happy path', () => {
  it('goes idle -> connecting -> open and delivers frames', async () => {
    const stream = makeBody();
    const { connection, recorder } = fetchConnection({ fetchImpl: makeFetch([{ body: stream.body }]) });

    expect(connection.state).toBe('idle');
    connection.connect();
    expect(recorder.states).toEqual(['connecting']);

    await flush();
    expect(recorder.states).toEqual(['connecting', 'open']);
    expect(connection.connected).toBe(true);

    stream.push('data: hello\n\n');
    await flush();
    expect(recorder.frames).toEqual([{ event: 'message', data: 'hello', id: '' }]);
    expect(connection.messageCount).toBe(1);
    expect(connection.lastMessageTime).toBe(1000);

    connection.dispose();
  });

  it('reassembles frames split across reads', async () => {
    const stream = makeBody();
    const { connection, recorder } = fetchConnection({ fetchImpl: makeFetch([{ body: stream.body }]) });
    connection.connect();
    await flush();

    stream.push('event: tok');
    stream.push('en\ndata: par');
    stream.push('tial\n\n');
    await flush();

    expect(recorder.frames).toEqual([{ event: 'token', data: 'partial', id: '' }]);
    connection.dispose();
  });

  it('sends the configured method, headers and body', async () => {
    const stream = makeBody();
    const fetchImpl = makeFetch([{ body: stream.body }]);
    const { connection } = fetchConnection({
      fetchImpl,
      method: 'POST',
      headers: { Authorization: 'Bearer tok' },
      body: { prompt: 'hi' }
    });
    connection.connect();
    await flush();

    const init = fetchImpl.calls[0].init;
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer tok');
    expect(init.headers.Accept).toBe('text/event-stream');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.body).toBe('{"prompt":"hi"}');
    connection.dispose();
  });

  it('calls fetch with a receiver a browser accepts', async () => {
    const stream = makeBody();
    const { connection, recorder } = fetchConnection({ fetchImpl: makeBrowserLikeFetch([{ body: stream.body }]) });

    connection.connect();
    await flush();

    // Before the fix this reached 'reconnecting' with "Illegal invocation" on
    // recorder.errors instead of ever opening.
    expect(recorder.errors).toEqual([]);
    expect(recorder.states).toEqual(['connecting', 'open']);

    stream.push('data: hello\n\n');
    await flush();
    expect(recorder.frames).toEqual([{ event: 'message', data: 'hello', id: '' }]);

    connection.dispose();
  });
});

describe('SseConnection — server closes the connection', () => {
  it('goes to closed and schedules nothing, by default', async () => {
    const stream = makeBody();
    const { connection, recorder, timers } = fetchConnection({ fetchImpl: makeFetch([{ body: stream.body }]) });
    connection.connect();
    await flush();

    stream.push('data: last token\n\n');
    stream.end();
    await flush();

    expect(recorder.frames.length).toBe(1);
    expect(recorder.states).toEqual(['connecting', 'open', 'closed']);
    // The default matters: an agent response stream is finite, and reconnecting would
    // re-issue the request and start the generation again.
    expect(timers.pending()).toBe(0);
    expect(recorder.errors).toEqual([]);
  });

  it('dispatches a final event the server did not terminate with a blank line', async () => {
    const stream = makeBody();
    const { connection, recorder } = fetchConnection({ fetchImpl: makeFetch([{ body: stream.body }]) });
    connection.connect();
    await flush();

    stream.push('data: unterminated');
    stream.end();
    await flush();

    expect(recorder.frames).toEqual([{ event: 'message', data: 'unterminated', id: '' }]);
  });

  it('reconnects on a clean end when asked to, without reporting an error', async () => {
    const first = makeBody();
    const second = makeBody();
    const fetchImpl = makeFetch([{ body: first.body }, { body: second.body }]);
    const { connection, recorder, timers } = fetchConnection({
      fetchImpl,
      reconnectOnStreamEnd: true,
      reconnectDelay: 1000
    });
    connection.connect();
    await flush();

    first.end();
    await flush();

    expect(recorder.states).toEqual(['connecting', 'open', 'reconnecting']);
    expect(recorder.errors).toEqual([]);
    expect(timers.delays()).toEqual([1000]);

    timers.run();
    await flush();
    expect(fetchImpl.calls.length).toBe(2);
    expect(recorder.states[recorder.states.length - 1]).toBe('open');

    connection.dispose();
    expect(timers.pending()).toBe(0);
  });
});

describe('SseConnection — network drop and recovery', () => {
  it('reports the drop, backs off, and recovers', async () => {
    const first = makeBody();
    const second = makeBody();
    const fetchImpl = makeFetch([{ body: first.body }, { body: second.body }]);
    const { connection, recorder, timers } = fetchConnection({ fetchImpl, reconnectDelay: 1000 });

    connection.connect();
    await flush();
    first.push('data: a\n\n');
    await flush();

    first.fail('socket hang up');
    await flush();

    expect(recorder.states).toEqual(['connecting', 'open', 'reconnecting']);
    expect(recorder.errors.length).toBe(1);
    expect(recorder.errors[0]).toMatch(/interrupted/);
    expect(connection.retryCount).toBe(1);
    expect(timers.delays()).toEqual([1000]);

    timers.run();
    await flush();
    second.push('data: b\n\n');
    await flush();

    expect(recorder.frames.map((f) => f.data)).toEqual(['a', 'b']);
    // A successful open clears the retry budget.
    expect(connection.retryCount).toBe(0);
    connection.dispose();
  });

  it('doubles the delay across consecutive failures', async () => {
    const fetchImpl = makeFetch([{ reject: 'ECONNREFUSED' }]);
    const { connection, timers } = fetchConnection({ fetchImpl, reconnectDelay: 1000, maxReconnectDelay: 30000 });

    connection.connect();
    await flush();
    expect(timers.delays()).toEqual([1000]);

    timers.run();
    await flush();
    expect(timers.delays()).toEqual([2000]);

    timers.run();
    await flush();
    expect(timers.delays()).toEqual([4000]);

    connection.dispose();
    expect(timers.pending()).toBe(0);
  });

  it('treats a 4xx as terminal and a 5xx as retryable', async () => {
    const notFound = fetchConnection({ fetchImpl: makeFetch([{ status: 404 }]) });
    notFound.connection.connect();
    await flush();
    expect(notFound.recorder.states).toEqual(['connecting', 'error']);
    expect(notFound.timers.pending()).toBe(0);
    expect(notFound.recorder.errors[0]).toMatch(/404/);

    const unavailable = fetchConnection({ fetchImpl: makeFetch([{ status: 503 }]) });
    unavailable.connection.connect();
    await flush();
    expect(unavailable.recorder.states).toEqual(['connecting', 'reconnecting']);
    expect(unavailable.timers.pending()).toBe(1);
    unavailable.connection.dispose();
    expect(unavailable.timers.pending()).toBe(0);
  });

  it('retries a 429, which is a "slow down" rather than a "go away"', async () => {
    const { connection, recorder, timers } = fetchConnection({ fetchImpl: makeFetch([{ status: 429 }]) });
    connection.connect();
    await flush();
    expect(recorder.states).toEqual(['connecting', 'reconnecting']);
    connection.dispose();
    expect(timers.pending()).toBe(0);
  });

  it('stops at maxRetries and says so, instead of retrying forever in silence', async () => {
    const { connection, recorder, timers } = fetchConnection({
      fetchImpl: makeFetch([{ reject: 'down' }]),
      maxRetries: 2
    });

    connection.connect();
    await flush(); // attempt 1 fails -> retryCount 1
    timers.run();
    await flush(); // attempt 2 fails -> retryCount 2
    timers.run();
    await flush(); // attempt 3 fails -> budget spent

    expect(recorder.states[recorder.states.length - 1]).toBe('error');
    expect(connection.lastError).toMatch(/gave up after 2 attempts/);
    expect(timers.pending()).toBe(0);
  });

  it('does not retry at all when autoReconnect is off', async () => {
    const { connection, recorder, timers } = fetchConnection({
      fetchImpl: makeFetch([{ reject: 'down' }]),
      autoReconnect: false
    });
    connection.connect();
    await flush();

    expect(recorder.states).toEqual(['connecting', 'error']);
    expect(recorder.errors.length).toBe(1);
    expect(timers.pending()).toBe(0);
  });

  it('fails loudly with no URL', () => {
    const { connection, recorder } = fetchConnection({ url: '' });
    connection.connect();
    expect(recorder.states).toEqual(['error']);
    expect(recorder.errors[0]).toMatch(/No URL/);
  });
});

describe('SseConnection — delivery semantics', () => {
  it('is at-most-once when the server sends no ids', async () => {
    const stream = makeBody();
    const { connection } = fetchConnection({ fetchImpl: makeFetch([{ body: stream.body }]) });
    connection.connect();
    await flush();
    stream.push('data: a\n\n');
    await flush();

    expect(connection.deliverySemantics).toBe('at-most-once');
    connection.dispose();
  });

  it('resumes with Last-Event-ID and suppresses the replay', async () => {
    const first = makeBody();
    const second = makeBody();
    const fetchImpl = makeFetch([{ body: first.body }, { body: second.body }]);
    const { connection, recorder, timers } = fetchConnection({ fetchImpl, reconnectDelay: 10 });

    connection.connect();
    await flush();
    first.push('id: 1\ndata: one\n\nid: 2\ndata: two\n\n');
    await flush();
    expect(connection.lastEventId).toBe('2');
    expect(connection.deliverySemantics).toBe('at-least-once-deduped');

    first.fail('drop');
    await flush();
    timers.run();
    await flush();

    // The resume point goes out as a header, which is the whole reason a POST stream
    // can resume at all — EventSource could not send this on a POST.
    expect(fetchImpl.calls[1].init.headers['Last-Event-ID']).toBe('2');

    // The server replays from the resume point, inclusive.
    second.push('id: 2\ndata: two\n\nid: 3\ndata: three\n\n');
    await flush();

    expect(recorder.frames.map((f) => f.data)).toEqual(['one', 'two', 'three']);
    expect(connection.duplicatesSuppressed).toBe(1);
    expect(recorder.duplicates).toEqual([{ id: '2' }]);
    connection.dispose();
  });

  it('delivers the replay when dedupe is turned off, and says so', async () => {
    const first = makeBody();
    const second = makeBody();
    const fetchImpl = makeFetch([{ body: first.body }, { body: second.body }]);
    const { connection, recorder, timers } = fetchConnection({ fetchImpl, dedupeById: false, reconnectDelay: 10 });

    connection.connect();
    await flush();
    first.push('id: 1\ndata: one\n\n');
    await flush();
    first.fail('drop');
    await flush();
    timers.run();
    await flush();
    second.push('id: 1\ndata: one\n\n');
    await flush();

    expect(recorder.frames.map((f) => f.data)).toEqual(['one', 'one']);
    expect(connection.deliverySemantics).toBe('at-least-once');
    connection.dispose();
  });

  it('honours a server retry: field over the configured delay', async () => {
    const stream = makeBody();
    const { connection, timers } = fetchConnection({
      fetchImpl: makeFetch([{ body: stream.body }, { reject: 'x' }]),
      reconnectDelay: 1000
    });
    connection.connect();
    await flush();
    stream.push('retry: 250\ndata: a\n\n');
    await flush();
    expect(connection.serverRetryMs).toBe(250);

    stream.fail('drop');
    await flush();
    expect(timers.delays()).toEqual([250]);
    connection.dispose();
  });
});

describe('SseConnection — cancellation and teardown', () => {
  it('cancels a request that is still in flight', async () => {
    const AbortControllerImpl = makeAbortController();
    let resolveFetch: (v: any) => void = () => {};
    const fetchImpl = () => new Promise((resolve) => (resolveFetch = resolve));
    const { connection, recorder } = fetchConnection({ fetchImpl, AbortControllerImpl });

    connection.connect();
    expect(recorder.states).toEqual(['connecting']);

    connection.disconnect();
    expect(AbortControllerImpl.created[0].aborted).toBe(true);
    expect(recorder.states).toEqual(['connecting', 'closed']);

    // The response arrives after the cancel; nothing further may be reported.
    const stream = makeBody();
    resolveFetch({ ok: true, status: 200, body: stream.body });
    await flush();
    stream.push('data: too late\n\n');
    await flush();

    expect(recorder.frames).toEqual([]);
    expect(recorder.states).toEqual(['connecting', 'closed']);
  });

  it('stops mid-stream without delivering anything further (navigate away)', async () => {
    const stream = makeBody();
    const { connection, recorder } = fetchConnection({ fetchImpl: makeFetch([{ body: stream.body }]) });
    connection.connect();
    await flush();
    stream.push('data: a\n\n');
    await flush();

    connection.dispose();

    stream.push('data: b\n\n');
    stream.end();
    await flush();

    expect(recorder.frames.map((f) => f.data)).toEqual(['a']);
    expect(recorder.states[recorder.states.length - 1]).toBe('open'); // no state churn after dispose
    expect(stream.state.cancelled).toBe(true);
  });

  it('clears a pending reconnect timer on dispose (unmount while reconnecting)', async () => {
    const { connection, timers } = fetchConnection({ fetchImpl: makeFetch([{ reject: 'down' }]) });
    connection.connect();
    await flush();
    expect(connection.hasPendingTimer()).toBe(true);
    expect(timers.pending()).toBe(1);

    connection.dispose();

    expect(connection.hasPendingTimer()).toBe(false);
    expect(timers.pending()).toBe(0);
  });

  it('is idempotent on dispose and inert afterwards', async () => {
    const { connection, recorder } = fetchConnection({ fetchImpl: makeFetch([{ reject: 'down' }]) });
    connection.connect();
    connection.dispose();
    connection.dispose();
    connection.connect(); // ignored
    connection.disconnect(); // ignored
    await flush();
    expect(recorder.states).toEqual(['connecting']);
  });

  it('keeps exactly one stream alive through rapid open/close cycles', async () => {
    const AbortControllerImpl = makeAbortController();
    const bodies = [makeBody(), makeBody(), makeBody(), makeBody(), makeBody()];
    const fetchImpl = makeFetch(bodies.map((b) => ({ body: b.body })));
    const { connection, timers } = fetchConnection({ fetchImpl, AbortControllerImpl });

    for (let i = 0; i < 5; i++) {
      connection.connect();
      connection.disconnect();
    }
    connection.connect();
    await flush();

    // Six connects, and every superseded attempt was aborted.
    expect(fetchImpl.calls.length).toBe(6);
    const aborted = AbortControllerImpl.created.filter((c: any) => c.aborted).length;
    expect(aborted).toBe(5);

    connection.dispose();
    expect(AbortControllerImpl.created.every((c: any) => c.aborted)).toBe(true);
    expect(timers.pending()).toBe(0);
  });

  it('reports an environment with no fetch instead of doing nothing', async () => {
    const { connection, recorder } = fetchConnection({ fetchImpl: null });
    connection.connect();
    await flush();
    expect(recorder.states).toEqual(['connecting', 'error']);
    expect(recorder.errors[0]).toMatch(/fetch is not available/);
  });

  it('reports a response with no readable body', async () => {
    const { connection, recorder } = fetchConnection({ fetchImpl: makeFetch([{ status: 200, body: null }]) });
    connection.connect();
    await flush();
    expect(recorder.states).toEqual(['connecting', 'open', 'error']);
    expect(recorder.errors[0]).toMatch(/no readable body/);
  });
});

describe('SseConnection — EventSource transport', () => {
  function esConnection(overrides: Partial<SseConnectionOptions> = {}) {
    const recorder = makeRecorder();
    const timers = makeTimers();
    const EventSourceImpl = makeEventSource();
    const connection = new SseConnection({
      url: 'https://example.test/stream',
      transport: 'eventsource',
      EventSourceImpl,
      setTimeoutImpl: timers.setTimeoutImpl,
      clearTimeoutImpl: timers.clearTimeoutImpl,
      ...recorder.hooks,
      ...overrides
    } as SseConnectionOptions);
    return { connection, recorder, timers, EventSourceImpl };
  }

  it('opens, receives default and named events', () => {
    const { connection, recorder, EventSourceImpl } = esConnection({ eventTypes: ['token'] });
    connection.connect();
    const es = EventSourceImpl.instances[0];
    expect(es.url).toBe('https://example.test/stream');

    es.serverOpen();
    expect(recorder.states).toEqual(['connecting', 'open']);

    es.serverMessage('plain', '7');
    es.serverNamed('token', 'tok', '8');

    expect(recorder.frames).toEqual([
      { event: 'message', data: 'plain', id: '7' },
      { event: 'token', data: 'tok', id: '8' }
    ]);
    expect(connection.lastEventId).toBe('8');
    connection.dispose();
  });

  it('reports the browser’s own retry without opening a second stream', () => {
    const { connection, recorder, timers, EventSourceImpl } = esConnection();
    connection.connect();
    const es = EventSourceImpl.instances[0];
    es.serverOpen();

    es.serverError(true); // readyState CONNECTING: EventSource is retrying itself

    expect(recorder.states).toEqual(['connecting', 'open', 'reconnecting']);
    expect(connection.retryCount).toBe(1);
    expect(recorder.errors.length).toBe(1);
    // Crucially: no second EventSource, and no timer of our own.
    expect(EventSourceImpl.instances.length).toBe(1);
    expect(timers.pending()).toBe(0);
    connection.dispose();
  });

  it('takes over with its own backoff once EventSource gives up', () => {
    const { connection, recorder, timers, EventSourceImpl } = esConnection({ reconnectDelay: 500 });
    connection.connect();
    EventSourceImpl.instances[0].serverOpen();

    EventSourceImpl.instances[0].serverError(false); // readyState CLOSED

    expect(recorder.states).toEqual(['connecting', 'open', 'reconnecting']);
    expect(timers.delays()).toEqual([500]);
    expect(EventSourceImpl.instances[0].closed).toBe(true);

    timers.run();
    expect(EventSourceImpl.instances.length).toBe(2);
    connection.dispose();
    expect(timers.pending()).toBe(0);
  });

  it('names the likely cause when the stream never opened at all', () => {
    const { connection, recorder, EventSourceImpl } = esConnection();
    connection.connect();

    // No serverOpen: the endpoint answered with something that is not an event
    // stream. An anonymous retry loop would leave the author with nothing to go on.
    EventSourceImpl.instances[0].serverError(false);

    expect(recorder.errors[0]).toMatch(/text\/event-stream/);
    connection.dispose();
  });

  it('enforces maxRetries by closing the stream the browser keeps reopening', () => {
    const { connection, recorder, EventSourceImpl } = esConnection({ maxRetries: 2 });
    connection.connect();
    const es = EventSourceImpl.instances[0];
    es.serverOpen();

    es.serverError(true);
    es.serverError(true);
    es.serverError(true);

    expect(recorder.states[recorder.states.length - 1]).toBe('error');
    expect(es.closed).toBe(true);
    connection.dispose();
  });

  it('closes and unhooks the EventSource on dispose', () => {
    const { connection, EventSourceImpl } = esConnection();
    connection.connect();
    const es = EventSourceImpl.instances[0];
    es.serverOpen();

    connection.dispose();

    expect(es.closed).toBe(true);
    expect(es.onmessage).toBeNull();
    expect(es.onerror).toBeNull();
  });

  it('reports an environment with no EventSource', () => {
    const { connection, recorder } = esConnection({ EventSourceImpl: null });
    connection.connect();
    expect(recorder.states).toEqual(['connecting', 'error']);
    expect(recorder.errors[0]).toMatch(/EventSource is not available/);
  });
});
