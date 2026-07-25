/**
 * byob-realtime unit tests (RUN-003 slice 7).
 *
 * The RealtimeConnection state machine is exercised against a fake WebSocket
 * with the exact frame shapes a live Directus 11 produced during the protocol
 * probe: auth handshake, subscribe → init, create/update with full records,
 * delete with STRING keys, ping/pong heartbeat, AUTH_FAILED then close.
 */

jest.mock('../noodl-runtime', () => ({
  instance: { getMetaData: jest.fn() },
  Node: { prototype: { _onNodeDeleted: jest.fn() } }
}));

const {
  RealtimeConnection,
  buildWebSocketUrl,
  nextReconnectDelay,
  RECONNECT_MAX_DELAY
} = require('../src/nodes/std-library/data/byob-realtime');

class FakeWebSocket {
  constructor(url) {
    this.url = url;
    this.sent = [];
    this.closed = false;
    FakeWebSocket.instances.push(this);
  }
  send(data) {
    this.sent.push(JSON.parse(data));
  }
  close() {
    this.closed = true;
  }
  // Test drivers
  open() {
    this.onopen && this.onopen({});
  }
  message(obj) {
    this.onmessage && this.onmessage({ data: typeof obj === 'string' ? obj : JSON.stringify(obj) });
  }
  serverClose() {
    this.onclose && this.onclose({});
  }
  serverError() {
    this.onerror && this.onerror({});
  }
}

describe('byob-realtime', () => {
  let timers;
  let events, statuses, errors;
  let connection;

  const makeConnection = (overrides = {}) => {
    return new RealtimeConnection({
      url: 'ws://localhost:8055/websocket',
      token: 'test-token',
      collection: 'articles',
      onEvent: (event, data) => events.push({ event, data }),
      onStatus: (subscribed) => statuses.push(subscribed),
      onError: (error) => errors.push(error),
      WebSocketImpl: FakeWebSocket,
      setTimeoutImpl: (fn, delay) => timers.push({ fn, delay }) - 1,
      clearTimeoutImpl: (id) => timers.splice(id, 1),
      ...overrides
    });
  };

  const lastSocket = () => FakeWebSocket.instances[FakeWebSocket.instances.length - 1];

  // Drive a fresh connection to the subscribed state
  const openAndSubscribe = () => {
    connection.connect();
    const socket = lastSocket();
    socket.open();
    socket.message({ type: 'auth', status: 'ok' });
    socket.message({ type: 'subscription', event: 'init', data: [], uid: 'noodl-byob-subscribe' });
    return socket;
  };

  beforeEach(() => {
    FakeWebSocket.instances = [];
    timers = [];
    events = [];
    statuses = [];
    errors = [];
    connection = makeConnection();
  });

  // ── buildWebSocketUrl ──────────────────────────────────────────────────────

  describe('buildWebSocketUrl', () => {
    it('maps http to ws and appends /websocket', () => {
      expect(buildWebSocketUrl('http://localhost:8055')).toBe('ws://localhost:8055/websocket');
    });

    it('maps https to wss', () => {
      expect(buildWebSocketUrl('https://api.example.com')).toBe('wss://api.example.com/websocket');
    });

    it('strips trailing slashes before appending', () => {
      expect(buildWebSocketUrl('http://localhost:8055//')).toBe('ws://localhost:8055/websocket');
    });

    it('returns null for non-http urls and empty input', () => {
      expect(buildWebSocketUrl('ftp://x')).toBeNull();
      expect(buildWebSocketUrl('')).toBeNull();
      expect(buildWebSocketUrl(undefined)).toBeNull();
    });
  });

  // ── nextReconnectDelay ─────────────────────────────────────────────────────

  describe('nextReconnectDelay', () => {
    it('doubles from 1s and caps at 30s', () => {
      expect(nextReconnectDelay(0)).toBe(1000);
      expect(nextReconnectDelay(1)).toBe(2000);
      expect(nextReconnectDelay(2)).toBe(4000);
      expect(nextReconnectDelay(10)).toBe(RECONNECT_MAX_DELAY);
    });
  });

  // ── Handshake and subscription ─────────────────────────────────────────────

  describe('handshake', () => {
    it('authenticates first when a token is configured', () => {
      connection.connect();
      const socket = lastSocket();
      socket.open();
      expect(socket.sent).toEqual([{ type: 'auth', access_token: 'test-token' }]);
    });

    it('subscribes after auth ok', () => {
      connection.connect();
      const socket = lastSocket();
      socket.open();
      socket.message({ type: 'auth', status: 'ok' });
      expect(socket.sent[1]).toEqual({
        type: 'subscribe',
        collection: 'articles',
        uid: 'noodl-byob-subscribe'
      });
    });

    it('subscribes directly when no token is configured (public mode)', () => {
      connection = makeConnection({ token: '' });
      connection.connect();
      const socket = lastSocket();
      socket.open();
      expect(socket.sent[0].type).toBe('subscribe');
    });

    it('reports subscribed on the init event and forwards its snapshot', () => {
      connection.connect();
      const socket = lastSocket();
      socket.open();
      socket.message({ type: 'auth', status: 'ok' });
      socket.message({ type: 'subscription', event: 'init', data: [{ id: 1 }], uid: 'noodl-byob-subscribe' });
      expect(statuses).toEqual([true]);
      expect(events).toEqual([{ event: 'init', data: [{ id: 1 }] }]);
    });

    it('errors without an available WebSocket implementation', () => {
      connection = makeConnection({ WebSocketImpl: null });
      connection.connect();
      expect(errors[0].message).toMatch(/not available/);
      expect(FakeWebSocket.instances).toHaveLength(0);
    });
  });

  // ── Events and heartbeat ───────────────────────────────────────────────────

  describe('events', () => {
    it('forwards create/update/delete events with their data', () => {
      const socket = openAndSubscribe();
      socket.message({ type: 'subscription', event: 'create', data: [{ id: 5, title: 'New' }], uid: 'x' });
      socket.message({ type: 'subscription', event: 'update', data: [{ id: 5, title: 'Edited' }], uid: 'x' });
      socket.message({ type: 'subscription', event: 'delete', data: ['5'], uid: 'x' });

      expect(events.slice(1)).toEqual([
        { event: 'create', data: [{ id: 5, title: 'New' }] },
        { event: 'update', data: [{ id: 5, title: 'Edited' }] },
        { event: 'delete', data: ['5'] }
      ]);
    });

    it('answers server pings with pongs', () => {
      const socket = openAndSubscribe();
      socket.message({ type: 'ping' });
      expect(socket.sent[socket.sent.length - 1]).toEqual({ type: 'pong' });
    });

    it('ignores malformed frames', () => {
      const socket = openAndSubscribe();
      socket.message('not json {');
      expect(errors).toHaveLength(0);
      expect(events).toHaveLength(1); // just the init
    });

    it('surfaces non-fatal error frames without dropping the connection', () => {
      const socket = openAndSubscribe();
      socket.message({ type: 'subscribe', status: 'error', error: { code: 'FORBIDDEN', message: 'No permission' } });
      expect(errors[0]).toEqual({ message: 'No permission', code: 'FORBIDDEN' });
      expect(timers).toHaveLength(0); // no reconnect scheduled — socket still open
    });
  });

  // ── Auth failure is fatal ──────────────────────────────────────────────────

  describe('auth failure', () => {
    it('reports AUTH_FAILED and does not reconnect after the server closes', () => {
      connection.connect();
      const socket = lastSocket();
      socket.open();
      socket.message({
        type: 'auth',
        status: 'error',
        error: { code: 'AUTH_FAILED', message: 'Authentication handshake failed.' }
      });
      expect(errors[0].code).toBe('AUTH_FAILED');

      socket.serverClose(); // live Directus closes right after the error frame
      expect(timers).toHaveLength(0);
      expect(FakeWebSocket.instances).toHaveLength(1);
    });
  });

  // ── Reconnect with backoff ─────────────────────────────────────────────────

  describe('reconnect', () => {
    it('reconnects with exponential backoff and resubscribes', () => {
      const socket = openAndSubscribe();
      expect(statuses).toEqual([true]);

      socket.serverClose();
      expect(statuses).toEqual([true, false]);
      expect(timers).toHaveLength(1);
      expect(timers[0].delay).toBe(1000);

      timers.shift().fn(); // fire the reconnect
      const second = lastSocket();
      expect(second).not.toBe(socket);
      second.open();
      expect(second.sent[0].type).toBe('auth');

      // Fails again before subscribing → backoff doubles
      second.serverClose();
      expect(timers[0].delay).toBe(2000);
    });

    it('reconnects on error without close (Node undici fires only error on failed connects)', () => {
      connection.connect();
      const socket = lastSocket();
      socket.serverError();
      expect(timers).toHaveLength(1);
      expect(socket.closed).toBe(true); // the half-open attempt is cleaned up
    });

    it('schedules only one reconnect when error is followed by close (browser order)', () => {
      const socket = openAndSubscribe();
      socket.serverError();
      socket.serverClose();
      expect(timers).toHaveLength(1);
      expect(statuses).toEqual([true, false]);
    });

    it('resets the backoff counter once resubscribed', () => {
      const socket = openAndSubscribe();
      socket.serverClose();
      timers.shift().fn();

      const second = lastSocket();
      second.open();
      second.message({ type: 'auth', status: 'ok' });
      second.message({ type: 'subscription', event: 'init', data: [], uid: 'x' });

      second.serverClose();
      expect(timers[0].delay).toBe(1000); // back to the base delay
    });
  });

  // ── Dispose ────────────────────────────────────────────────────────────────

  describe('dispose', () => {
    it('closes the socket and suppresses reconnects', () => {
      const socket = openAndSubscribe();
      connection.dispose();
      expect(socket.closed).toBe(true);
      expect(timers).toHaveLength(0);
    });

    it('cancels a pending reconnect timer', () => {
      const socket = openAndSubscribe();
      socket.serverClose();
      expect(timers).toHaveLength(1);
      connection.dispose();
      expect(timers).toHaveLength(0);
    });
  });
});

// ── Node-level event plumbing ────────────────────────────────────────────────

describe('byob-subscribe node handlers', () => {
  const definition = require('../src/nodes/std-library/data/byob-subscribe');
  const proto = definition.node.prototypeExtensions;

  const makeFakeNode = (collections) => ({
    _internal: {
      collection: 'articles',
      subscribed: false,
      error: null,
      eventType: '',
      changedRecord: null,
      changedRecords: [],
      changedRecordId: ''
    },
    flagOutputDirty: jest.fn(),
    sendSignalOnOutput: jest.fn(),
    resolveBackend: () => ({ collections }),
    getPrimaryKeyName: proto.getPrimaryKeyName,
    setError: proto.setError
  });

  it('maps a create event to record outputs and both signals', () => {
    const node = makeFakeNode([{ name: 'articles', primaryKey: 'id' }]);
    proto.handleRealtimeEvent.call(node, 'create', [{ id: 5, title: 'New' }]);

    expect(node._internal.eventType).toBe('create');
    expect(node._internal.changedRecord).toEqual({ id: 5, title: 'New' });
    expect(node._internal.changedRecordId).toBe('5');
    expect(node.sendSignalOnOutput.mock.calls.map((c) => c[0])).toEqual(['created', 'changed']);
  });

  it('uses the schema primary key name, not a hardcoded id', () => {
    const node = makeFakeNode([{ name: 'articles', primaryKey: 'article_uuid' }]);
    proto.handleRealtimeEvent.call(node, 'update', [{ article_uuid: 'abc-123', title: 'X' }]);
    expect(node._internal.changedRecordId).toBe('abc-123');
  });

  it('maps a delete event (string keys, no record) correctly', () => {
    const node = makeFakeNode([{ name: 'articles', primaryKey: 'id' }]);
    proto.handleRealtimeEvent.call(node, 'delete', ['5']);

    expect(node._internal.eventType).toBe('delete');
    expect(node._internal.changedRecord).toBeNull();
    expect(node._internal.changedRecords).toEqual(['5']);
    expect(node._internal.changedRecordId).toBe('5');
    expect(node.sendSignalOnOutput.mock.calls.map((c) => c[0])).toEqual(['deleted', 'changed']);
  });

  it('ignores the init snapshot', () => {
    const node = makeFakeNode([{ name: 'articles', primaryKey: 'id' }]);
    proto.handleRealtimeEvent.call(node, 'init', [{ id: 1 }]);
    expect(node.sendSignalOnOutput).not.toHaveBeenCalled();
    expect(node._internal.eventType).toBe('');
  });
});
