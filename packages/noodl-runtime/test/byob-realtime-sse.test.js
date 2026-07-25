/**
 * BAK-001 — NodeGX SSE realtime transport (RealtimeSSEConnection).
 *
 * Exercises the transport with an injected fake EventSource and fetch, so the
 * connect → connected → subscribe → change/resync lifecycle is unit-testable
 * without a server. The transport matches RealtimeConnection's callback contract
 * so Subscribe To Changes stays transport-agnostic.
 */
const {
  RealtimeSSEConnection,
  buildSSEUrl,
  isNodeGXRealtime
} = require('../src/nodes/std-library/data/byob-realtime');

/** Fake EventSource: records URL, dispatches named events, close()/onerror. */
function makeFakeEventSource() {
  const instances = [];
  function FakeES(url) {
    this.url = url;
    this.listeners = {};
    this.closed = false;
    this.onerror = null;
    instances.push(this);
  }
  FakeES.prototype.addEventListener = function (type, cb) {
    (this.listeners[type] || (this.listeners[type] = [])).push(cb);
  };
  FakeES.prototype.emit = function (type, data) {
    (this.listeners[type] || []).forEach((cb) => cb({ data: JSON.stringify(data) }));
  };
  FakeES.prototype.close = function () {
    this.closed = true;
  };
  FakeES.instances = instances;
  return FakeES;
}

/** Fake fetch that resolves with a controllable JSON body. */
function makeFakeFetch(body) {
  const calls = [];
  const fn = (url, opts) => {
    calls.push({ url, opts });
    return Promise.resolve({ json: () => Promise.resolve(body) });
  };
  fn.calls = calls;
  return fn;
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('buildSSEUrl / isNodeGXRealtime', () => {
  it('builds the /realtime URL and carries the token as a query param', () => {
    expect(buildSSEUrl('http://localhost:8080')).toBe('http://localhost:8080/realtime');
    expect(buildSSEUrl('http://localhost:8080/')).toBe('http://localhost:8080/realtime');
    expect(buildSSEUrl('https://api.example.com', 'tok en')).toBe('https://api.example.com/realtime?token=tok%20en');
    expect(buildSSEUrl('not-a-url')).toBeNull();
    expect(buildSSEUrl('')).toBeNull();
  });

  it('routes NodeGX/local backends to SSE and others to WebSocket', () => {
    expect(isNodeGXRealtime('nodegx')).toBe(true);
    expect(isNodeGXRealtime('local')).toBe(true);
    expect(isNodeGXRealtime('directus')).toBe(false);
    expect(isNodeGXRealtime(undefined)).toBe(false);
  });
});

describe('RealtimeSSEConnection', () => {
  it('subscribes on connect and reports status once accepted', async () => {
    const FakeES = makeFakeEventSource();
    const fetchImpl = makeFakeFetch({ accepted: [{ collection: 'Doc' }], rejected: [] });
    const statuses = [];
    const conn = new RealtimeSSEConnection({
      baseUrl: 'http://localhost:8080',
      token: 'sess',
      collection: 'Doc',
      onStatus: (s) => statuses.push(s),
      EventSourceImpl: FakeES,
      fetchImpl
    });
    conn.connect();

    const es = FakeES.instances[0];
    expect(es.url).toBe('http://localhost:8080/realtime?token=sess');

    es.emit('connected', { clientId: 'abc123' });
    await flush();

    expect(fetchImpl.calls).toHaveLength(1);
    expect(fetchImpl.calls[0].url).toBe('http://localhost:8080/realtime/subscriptions');
    expect(JSON.parse(fetchImpl.calls[0].opts.body)).toEqual({
      clientId: 'abc123',
      subscriptions: [{ collection: 'Doc' }]
    });
    expect(statuses).toContain(true);
  });

  it('maps change frames to create/update/delete and resync', async () => {
    const FakeES = makeFakeEventSource();
    const events = [];
    const conn = new RealtimeSSEConnection({
      baseUrl: 'http://localhost:8080',
      collection: 'Doc',
      onEvent: (event, records) => events.push([event, records]),
      EventSourceImpl: FakeES,
      fetchImpl: makeFakeFetch({ accepted: [{ collection: 'Doc' }], rejected: [] })
    });
    conn.connect();
    const es = FakeES.instances[0];
    es.emit('connected', { clientId: 'c1' });

    es.emit('change', { action: 'create', collection: 'Doc', record: { objectId: '1', title: 'a' } });
    es.emit('change', { action: 'update', collection: 'Doc', record: { objectId: '1', title: 'b' } });
    es.emit('change', { action: 'delete', collection: 'Doc', record: { objectId: '1' } });
    es.emit('resync', { reason: 'overflow' });

    expect(events).toEqual([
      ['create', [{ objectId: '1', title: 'a' }]],
      ['update', [{ objectId: '1', title: 'b' }]],
      ['delete', ['1']], // delete normalized to an id string, matching the WS transport
      ['resync', []]
    ]);
  });

  it('reports an error when the subscription is rejected', async () => {
    const FakeES = makeFakeEventSource();
    const errors = [];
    const conn = new RealtimeSSEConnection({
      baseUrl: 'http://localhost:8080',
      collection: 'Secret',
      onError: (e) => errors.push(e),
      EventSourceImpl: FakeES,
      fetchImpl: makeFakeFetch({ accepted: [], rejected: [{ collection: 'Secret', reason: 'denied by find CLP' }] })
    });
    conn.connect();
    FakeES.instances[0].emit('connected', { clientId: 'c1' });
    await flush();

    expect(errors).toHaveLength(1);
    expect(errors[0].message).toMatch(/denied by find CLP/);
  });

  it('dispose() closes the stream and silences further events', async () => {
    const FakeES = makeFakeEventSource();
    const events = [];
    const conn = new RealtimeSSEConnection({
      baseUrl: 'http://localhost:8080',
      collection: 'Doc',
      onEvent: (e, r) => events.push([e, r]),
      EventSourceImpl: FakeES,
      fetchImpl: makeFakeFetch({ accepted: [{ collection: 'Doc' }], rejected: [] })
    });
    conn.connect();
    const es = FakeES.instances[0];
    es.emit('connected', { clientId: 'c1' });
    conn.dispose();
    expect(es.closed).toBe(true);

    es.emit('change', { action: 'create', collection: 'Doc', record: { objectId: '9' } });
    expect(events).toHaveLength(0);
  });
});
