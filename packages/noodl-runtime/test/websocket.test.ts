/**
 * WebSocket node lifecycle suite (AGENT-002 / AIX-005).
 *
 * The runtime's Jest environment is `node` with no global `WebSocket` and no
 * DOM, which is the reason the connection takes its socket and its timers
 * through injectable seams. Everything below drives those seams by hand, so the
 * lifecycle matrix AIX-005 asks for is tested as *transitions*, not as timing:
 *
 *   navigate away / unmount mid-stream ...... "node deletion" describe
 *   network drop and recovery .............. "reconnection" describe
 *   server closes the connection ........... "server-initiated close" describe
 *   cancel in flight ....................... "cancellation" describe
 *   rapid open/close cycles ................ "rapid cycles" describe
 *   no leaked handles or timers ............ `expectNoLeaks`, asserted in every
 *                                            teardown path
 *
 * The leak assertion is the load-bearing one. `TimerHarness` refuses to forget
 * a timer that was never cleared and `FakeWebSocket` records every instance it
 * ever created, so "nothing left behind" is checked against the whole history
 * of the test rather than against the object under test's own opinion of
 * itself.
 */

import {
  DEFAULT_MAX_QUEUE_SIZE,
  WebSocketConnection,
  isFatalCloseCode,
  nextReconnectDelay
} from '../src/nodes/std-library/agent/websocket-connection';
import type {
  WebSocketCloseEventLike,
  WebSocketConnectionOptions,
  WebSocketLike,
  WebSocketMessageEventLike
} from '../src/nodes/std-library/agent/websocket-connection';

// ── harnesses ────────────────────────────────────────────────────────────────

/**
 * A manual clock. Timers are opaque handles; `clear` removes them, and `live()`
 * is what a leak assertion reads. Nothing fires unless a test fires it, so
 * ordering is explicit and there is no real elapsed time anywhere in the suite.
 */
class TimerHarness {
  private _next = 1;
  private _timers = new Map<number, { fn: () => void; delay: number }>();
  /** Every timer ever scheduled, in order, including cleared ones. */
  scheduled: { handle: number; delay: number }[] = [];
  now = 1_000_000;

  setTimeout = (fn: () => void, delay: number): unknown => {
    const handle = this._next++;
    this._timers.set(handle, { fn, delay });
    this.scheduled.push({ handle, delay });
    return handle;
  };

  clearTimeout = (handle: unknown): void => {
    this._timers.delete(handle as number);
  };

  nowImpl = (): number => this.now;

  live(): number {
    return this._timers.size;
  }

  liveDelays(): number[] {
    return Array.from(this._timers.values()).map((t) => t.delay);
  }

  /** Fire the single pending timer. Throws if there is not exactly one. */
  fireOnly(): void {
    const handles = Array.from(this._timers.keys());
    if (handles.length !== 1) {
      throw new Error(`expected exactly one pending timer, found ${handles.length}`);
    }
    this.fire(handles[0]);
  }

  fire(handle: number): void {
    const timer = this._timers.get(handle);
    if (!timer) throw new Error(`timer ${handle} is not pending`);
    this._timers.delete(handle);
    this.now += timer.delay;
    timer.fn();
  }

  /** Advance the clock without firing anything — for heartbeat-timeout tests. */
  advance(ms: number): void {
    this.now += ms;
  }
}

interface RecordedSocket extends WebSocketLike {
  url: string;
  protocols?: string | string[];
  sent: unknown[];
  closeCalls: { code?: number; reason?: string }[];
  binaryType?: string;
  /** Test drivers. */
  fireOpen(): void;
  fireMessage(data: unknown): void;
  fireError(): void;
  fireClose(event?: WebSocketCloseEventLike): void;
  handlersDetached(): boolean;
}

function makeSocketFactory() {
  const instances: RecordedSocket[] = [];

  class FakeWebSocket implements RecordedSocket {
    url: string;
    protocols?: string | string[];
    sent: unknown[] = [];
    closeCalls: { code?: number; reason?: string }[] = [];
    binaryType = 'blob';

    onopen: ((event?: unknown) => void) | null = null;
    onmessage: ((event: WebSocketMessageEventLike) => void) | null = null;
    onerror: ((event?: unknown) => void) | null = null;
    onclose: ((event?: WebSocketCloseEventLike) => void) | null = null;

    constructor(url: string, protocols?: string | string[]) {
      this.url = url;
      this.protocols = protocols;
      instances.push(this);
    }

    send(data: unknown): void {
      this.sent.push(data);
    }

    close(code?: number, reason?: string): void {
      this.closeCalls.push({ code, reason });
    }

    fireOpen(): void {
      this.onopen && this.onopen({});
    }
    fireMessage(data: unknown): void {
      this.onmessage && this.onmessage({ data });
    }
    fireError(): void {
      this.onerror && this.onerror({});
    }
    fireClose(event: WebSocketCloseEventLike = { code: 1006, wasClean: false }): void {
      this.onclose && this.onclose(event);
    }
    handlersDetached(): boolean {
      return !this.onopen && !this.onmessage && !this.onerror && !this.onclose;
    }
  }

  return {
    Impl: FakeWebSocket as unknown as new (url: string, protocols?: string | string[]) => WebSocketLike,
    instances,
    last(): RecordedSocket {
      if (instances.length === 0) throw new Error('no socket was created');
      return instances[instances.length - 1];
    }
  };
}

// ── shared fixture ───────────────────────────────────────────────────────────

let timers: TimerHarness;
let sockets: ReturnType<typeof makeSocketFactory>;
let events: string[];
let statusUpdates: number;
let messages: { value: unknown; raw: string; isBinary: boolean }[];
let errors: string[];
let closes: { code: number; reason: string; willReconnect: boolean }[];
let sent: unknown[];
let connection: WebSocketConnection;

function makeConnection(options: Partial<WebSocketConnectionOptions> = {}): WebSocketConnection {
  return new WebSocketConnection({
    url: 'wss://example.test/socket',
    // Deterministic backoff: jitter has its own tests, and everywhere else it
    // would only make the expected delays unwritable.
    jitter: false,
    WebSocketImpl: sockets.Impl,
    setTimeoutImpl: timers.setTimeout,
    clearTimeoutImpl: timers.clearTimeout,
    nowImpl: timers.nowImpl,
    randomImpl: () => 0.5,
    onStatus: () => {
      statusUpdates++;
    },
    onOpen: (isReconnect) => events.push(isReconnect ? 'reconnect' : 'open'),
    onMessage: (value, raw, isBinary) => {
      messages.push({ value, raw, isBinary });
      events.push('message');
    },
    onError: (message) => {
      errors.push(message);
      events.push('error');
    },
    onClose: (code, reason, willReconnect) => {
      closes.push({ code, reason, willReconnect });
      events.push('close');
    },
    onSent: (value) => {
      sent.push(value);
      events.push('sent');
    },
    ...options
  });
}

/** Drive a fresh connection all the way to `open`. */
function openConnection(options: Partial<WebSocketConnectionOptions> = {}): RecordedSocket {
  connection = makeConnection(options);
  connection.connect();
  const socket = sockets.last();
  socket.fireOpen();
  return socket;
}

/**
 * The success criterion "no leaked connections after navigation", asserted
 * against the whole history: every socket ever created must be closed with its
 * handlers detached, and no timer may still be pending.
 */
function expectNoLeaks(): void {
  expect(timers.live()).toBe(0);
  for (const socket of sockets.instances) {
    expect(socket.closeCalls.length).toBeGreaterThan(0);
    expect(socket.handlersDetached()).toBe(true);
  }
}

beforeEach(() => {
  timers = new TimerHarness();
  sockets = makeSocketFactory();
  events = [];
  statusUpdates = 0;
  messages = [];
  errors = [];
  closes = [];
  sent = [];
  connection = undefined as unknown as WebSocketConnection;
});

// ── backoff arithmetic ───────────────────────────────────────────────────────

describe('nextReconnectDelay', () => {
  it('doubles from the base delay and caps at the maximum', () => {
    expect(nextReconnectDelay(0, 1000, 30000, false, () => 0)).toBe(1000);
    expect(nextReconnectDelay(1, 1000, 30000, false, () => 0)).toBe(2000);
    expect(nextReconnectDelay(2, 1000, 30000, false, () => 0)).toBe(4000);
    expect(nextReconnectDelay(5, 1000, 30000, false, () => 0)).toBe(30000);
    expect(nextReconnectDelay(50, 1000, 30000, false, () => 0)).toBe(30000);
  });

  it('keeps jitter inside the upper half of the backoff window', () => {
    // Equal jitter: never sooner than half the intended delay, never later than
    // the delay itself. A retry that arrives early would defeat the backoff.
    expect(nextReconnectDelay(2, 1000, 30000, true, () => 0)).toBe(2000);
    expect(nextReconnectDelay(2, 1000, 30000, true, () => 1)).toBe(4000);
    expect(nextReconnectDelay(2, 1000, 30000, true, () => 0.5)).toBe(3000);
  });

  it('falls back to the defaults for nonsensical inputs', () => {
    expect(nextReconnectDelay(0, 0, 0, false, () => 0)).toBe(1000);
    expect(nextReconnectDelay(0, -5, -5, false, () => 0)).toBe(1000);
  });
});

describe('isFatalCloseCode', () => {
  it('treats protocol and policy failures as unretryable', () => {
    for (const code of [1002, 1003, 1007, 1008, 1009, 1010, 1015]) {
      expect(isFatalCloseCode(code)).toBe(true);
    }
  });

  it('treats normal, abnormal and server-error closes as retryable', () => {
    // 1006 is the ordinary network drop and 1011 a server hiccup — precisely
    // the cases backoff exists for. 1000/1001 are retryable too, because a
    // clean server goodbye at an idle timeout is the commonest reason an app
    // wants to reconnect; see the note on `isFatalCloseCode`.
    for (const code of [1000, 1001, 1006, 1011, 1012, 1013, 4001]) {
      expect(isFatalCloseCode(code)).toBe(false);
    }
  });
});

// ── opening ──────────────────────────────────────────────────────────────────

describe('connecting', () => {
  it('starts idle and reaches open through connecting', () => {
    connection = makeConnection();
    expect(connection.state).toBe('idle');
    expect(connection.connected).toBe(false);

    connection.connect();
    expect(connection.state).toBe('connecting');
    expect(connection.connected).toBe(false);

    sockets.last().fireOpen();
    expect(connection.state).toBe('open');
    expect(connection.connected).toBe(true);
    expect(events).toEqual(['open']);

    connection.dispose();
    expectNoLeaks();
  });

  it('passes the url and parsed subprotocols to the socket', () => {
    connection = makeConnection({ protocols: ['json', 'chat.v1'] });
    connection.connect();
    expect(sockets.last().url).toBe('wss://example.test/socket');
    expect(sockets.last().protocols).toEqual(['json', 'chat.v1']);

    connection.dispose();
  });

  it('omits protocols entirely when none are configured', () => {
    connection = makeConnection();
    connection.connect();
    expect(sockets.last().protocols).toBeUndefined();
    connection.dispose();
  });

  it('asks for arraybuffer rather than the platform default blob', () => {
    // A Blob cannot be read synchronously, which makes it useless to a node
    // graph; an ArrayBuffer can be handed straight to a Function node.
    const socket = openConnection();
    expect(socket.binaryType).toBe('arraybuffer');
    connection.dispose();
  });

  it('reports a missing url loudly and does not retry it', () => {
    connection = makeConnection({ url: '' });
    connection.connect();

    expect(connection.state).toBe('error');
    expect(connection.lastError).toMatch(/URL is required/);
    expect(errors).toHaveLength(1);
    expect(sockets.instances).toHaveLength(0);
    expect(timers.live()).toBe(0);
  });

  it('rejects a url that is not ws:// or wss://', () => {
    connection = makeConnection({ url: 'https://example.test/socket' });
    connection.connect();

    expect(connection.state).toBe('error');
    expect(connection.lastError).toMatch(/must start with ws:\/\/ or wss:\/\//);
    expect(sockets.instances).toHaveLength(0);
  });

  it('reports the absence of a WebSocket implementation instead of throwing', () => {
    // Explicit null: the cloud runtime and the SSR server both lack one, and a
    // node graph must see that as an error output, not a crash.
    connection = makeConnection({ WebSocketImpl: null });
    connection.connect();

    expect(connection.state).toBe('error');
    expect(connection.lastError).toMatch(/not available in this environment/);
  });

  it('reports a throwing constructor as a terminal error', () => {
    const throwing = function () {
      throw new Error('SyntaxError: invalid subprotocol');
    } as unknown as new (url: string) => WebSocketLike;

    connection = makeConnection({ WebSocketImpl: throwing });
    connection.connect();

    expect(connection.state).toBe('error');
    expect(connection.lastError).toMatch(/invalid subprotocol/);
    expect(timers.live()).toBe(0);
  });
});

// ── receiving ────────────────────────────────────────────────────────────────

describe('receiving', () => {
  it('parses a JSON frame and keeps the raw text alongside it', () => {
    const socket = openConnection();
    socket.fireMessage('{"role":"assistant","delta":"Hel"}');

    expect(messages).toEqual([
      { value: { role: 'assistant', delta: 'Hel' }, raw: '{"role":"assistant","delta":"Hel"}', isBinary: false }
    ]);
    connection.dispose();
  });

  it('hands back non-JSON text unchanged', () => {
    const socket = openConnection();
    socket.fireMessage('not json at all');

    expect(messages[0].value).toBe('not json at all');
    expect(messages[0].raw).toBe('not json at all');
    connection.dispose();
  });

  it('passes binary frames through as-is and flags them', () => {
    const socket = openConnection();
    const buffer = new ArrayBuffer(8);
    socket.fireMessage(buffer);

    expect(messages[0].value).toBe(buffer);
    expect(messages[0].isBinary).toBe(true);
    // No raw text: there is no honest string form of arbitrary bytes.
    expect(messages[0].raw).toBe('');
    connection.dispose();
  });

  it('ignores frames from a socket that has already been replaced', () => {
    const first = openConnection();
    connection.connect(); // replaces it
    sockets.last().fireOpen();

    first.fireMessage('late arrival');
    expect(messages).toHaveLength(0);
    connection.dispose();
  });
});

// ── sending ──────────────────────────────────────────────────────────────────

describe('sending', () => {
  it('sends a string as text and fires On Message Sent', () => {
    const socket = openConnection();
    expect(connection.send('hello')).toBe(true);

    expect(socket.sent).toEqual(['hello']);
    expect(sent).toEqual(['hello']);
    connection.dispose();
  });

  it('serializes an object to JSON', () => {
    const socket = openConnection();
    connection.send({ type: 'prompt', text: 'hi' });
    expect(socket.sent).toEqual(['{"type":"prompt","text":"hi"}']);
    connection.dispose();
  });

  it('sends an ArrayBuffer untouched even in auto mode', () => {
    const socket = openConnection();
    const buffer = new Uint8Array([1, 2, 3]);
    connection.send(buffer);
    expect(socket.sent[0]).toBe(buffer);
    connection.dispose();
  });

  it('utf-8 encodes text when Message Type is binary', () => {
    const socket = openConnection({ messageEncoding: 'binary' });
    connection.send('hey');

    const frame = socket.sent[0] as Uint8Array;
    expect(frame).toBeInstanceOf(Uint8Array);
    expect(Array.from(frame)).toEqual([104, 101, 121]);
    connection.dispose();
  });

  it('reports an empty Message input rather than returning silently', () => {
    openConnection();
    expect(connection.send(undefined)).toBe(false);
    expect(errors[0]).toMatch(/Message input is empty/);
    connection.dispose();
  });

  it('records a throwing send as a drop and keeps the connection alive', () => {
    const socket = openConnection();
    socket.send = () => {
      throw new Error('InvalidStateError');
    };

    expect(connection.send('x')).toBe(false);
    expect(connection.droppedCount).toBe(1);
    expect(connection.lastError).toMatch(/Send failed/);
    // The close handler owns the connection's fate; a failed send does not
    // pre-empt it.
    expect(connection.state).toBe('open');
    connection.dispose();
  });
});

// ── send-while-disconnected policy ───────────────────────────────────────────

describe('send while disconnected', () => {
  it('queues in FIFO order and flushes on open', () => {
    connection = makeConnection();
    connection.send('first');
    connection.send('second');

    expect(connection.queueSize).toBe(2);
    expect(connection.droppedCount).toBe(0);

    connection.connect();
    sockets.last().fireOpen();

    expect(sockets.last().sent).toEqual(['first', 'second']);
    expect(connection.queueSize).toBe(0);
    // Each flushed message fires On Message Sent, exactly once.
    expect(sent).toEqual(['first', 'second']);
    connection.dispose();
  });

  it('flushes the backlog after On Open, so an auth handshake goes first', () => {
    connection = makeConnection({
      onOpen: () => {
        events.push('open');
        connection.send('{"type":"auth"}');
      }
    });
    connection.send('queued-before-connect');
    connection.connect();
    sockets.last().fireOpen();

    // The open handler's message is sent immediately; the backlog follows.
    expect(sockets.last().sent).toEqual(['{"type":"auth"}', 'queued-before-connect']);
    connection.dispose();
  });

  it('refuses the newest message when the queue is full, and says so', () => {
    connection = makeConnection({ maxQueueSize: 2 });
    connection.send('a');
    connection.send('b');
    expect(connection.send('c')).toBe(false);

    // Refusing the newest keeps the queue an ordered prefix of intent rather
    // than a sequence with a hole in it.
    expect(connection.peekQueue()).toEqual(['a', 'b']);
    expect(connection.droppedCount).toBe(1);
    expect(connection.lastError).toMatch(/queue is full/);
    expect(errors).toHaveLength(1);
  });

  it('treats a non-positive Max Queue Size as unlimited', () => {
    connection = makeConnection({ maxQueueSize: 0 });
    for (let i = 0; i < DEFAULT_MAX_QUEUE_SIZE + 5; i++) connection.send(i);
    expect(connection.queueSize).toBe(DEFAULT_MAX_QUEUE_SIZE + 5);
    expect(connection.droppedCount).toBe(0);
  });

  it('drop mode counts the loss without raising an error', () => {
    connection = makeConnection({ sendWhenDisconnected: 'drop' });
    connection.send('a');
    connection.send('b');

    expect(connection.queueSize).toBe(0);
    // Dropping was requested, so it is not an error — but it is never invisible.
    expect(connection.droppedCount).toBe(2);
    expect(errors).toHaveLength(0);
  });

  it('error mode reports and does not queue', () => {
    connection = makeConnection({ sendWhenDisconnected: 'error' });
    expect(connection.send('a')).toBe(false);

    expect(connection.queueSize).toBe(0);
    expect(connection.droppedCount).toBe(1);
    expect(errors[0]).toMatch(/Cannot send: the connection is not open \(state: idle\)/);
  });

  it('returns a failed flush to the front of the queue', () => {
    connection = makeConnection();
    connection.send('a');
    connection.send('b');

    connection.connect();
    const socket = sockets.last();
    socket.send = () => {
      throw new Error('InvalidStateError');
    };
    socket.fireOpen();

    // Nothing reached the wire, so nothing is owed twice — order is preserved.
    expect(connection.peekQueue()).toEqual(['a', 'b']);
    expect(connection.queueSize).toBe(2);
    connection.dispose();
  });

  it('holds messages across an outage and sends each exactly once', () => {
    const socket = openConnection();
    connection.send('before');
    socket.fireClose({ code: 1006, wasClean: false });

    connection.send('during-outage-1');
    connection.send('during-outage-2');
    expect(connection.queueSize).toBe(2);

    timers.fireOnly();
    sockets.last().fireOpen();

    // 'before' went out on the first socket and is not resent — that is the
    // no-duplicates half of the delivery contract.
    expect(sockets.instances[0].sent).toEqual(['before']);
    expect(sockets.instances[1].sent).toEqual(['during-outage-1', 'during-outage-2']);
    connection.dispose();
    expectNoLeaks();
  });
});

// ── reconnection ─────────────────────────────────────────────────────────────

describe('reconnection', () => {
  it('enters reconnecting on a network drop and recovers on the retry', () => {
    const socket = openConnection();
    socket.fireClose({ code: 1006, wasClean: false });

    expect(connection.state).toBe('reconnecting');
    expect(connection.connected).toBe(false);
    expect(connection.retryCount).toBe(1);
    expect(connection.lastError).toMatch(/Connection lost \(no close frame\); reconnecting in 1000ms/);
    expect(closes).toEqual([{ code: 1006, reason: '', willReconnect: true }]);
    expect(timers.liveDelays()).toEqual([1000]);

    timers.fireOnly();
    // Still reconnecting during the attempt: an author renders one "we lost it"
    // state for the whole outage rather than a flicker per attempt.
    expect(connection.state).toBe('reconnecting');

    sockets.last().fireOpen();
    expect(connection.state).toBe('open');
    expect(connection.retryCount).toBe(0);
    expect(connection.lastError).toBe('');

    connection.dispose();
    expectNoLeaks();
  });

  it('fires On Reconnect on every open after the first, and never on the first', () => {
    const socket = openConnection();
    expect(events).toEqual(['open']);

    socket.fireClose({ code: 1006 });
    timers.fireOnly();
    sockets.last().fireOpen();

    // A reconnect is a brand-new session with no replay, so the app needs a
    // distinct cue to re-fetch. Nothing else can tell it what it missed.
    expect(events.filter((e) => e === 'reconnect' || e === 'open')).toEqual(['open', 'reconnect']);
    connection.dispose();
  });

  it('backs off exponentially across successive failures', () => {
    const socket = openConnection();
    socket.fireClose({ code: 1006 });
    expect(timers.liveDelays()).toEqual([1000]);

    timers.fireOnly();
    sockets.last().fireClose({ code: 1006 });
    expect(timers.liveDelays()).toEqual([2000]);

    timers.fireOnly();
    sockets.last().fireClose({ code: 1006 });
    expect(timers.liveDelays()).toEqual([4000]);

    expect(connection.retryCount).toBe(3);
    connection.dispose();
    expectNoLeaks();
  });

  it('caps the delay at Max Reconnect Delay', () => {
    const socket = openConnection({ reconnectDelay: 10000, maxReconnectDelay: 15000, maxRetries: -1 });
    socket.fireClose({ code: 1006 });
    expect(timers.liveDelays()).toEqual([10000]);

    timers.fireOnly();
    sockets.last().fireClose({ code: 1006 });
    expect(timers.liveDelays()).toEqual([15000]);

    timers.fireOnly();
    sockets.last().fireClose({ code: 1006 });
    expect(timers.liveDelays()).toEqual([15000]);

    connection.dispose();
  });

  it('gives up loudly once Max Retries is spent', () => {
    const socket = openConnection({ maxRetries: 2 });
    socket.fireClose({ code: 1006 });
    timers.fireOnly();
    sockets.last().fireClose({ code: 1006 });
    timers.fireOnly();
    sockets.last().fireClose({ code: 1006 });

    // Giving up is the failure this node exists to make visible: an error
    // state, an error message naming the count, and an On Error signal.
    expect(connection.state).toBe('error');
    expect(connection.retryCount).toBe(2);
    expect(connection.lastError).toMatch(/gave up after 2 reconnect attempts/);
    expect(errors[errors.length - 1]).toMatch(/gave up after 2/);
    expect(closes[closes.length - 1].willReconnect).toBe(false);
    expect(timers.live()).toBe(0);

    connection.dispose();
    expectNoLeaks();
  });

  it('retries forever when Max Retries is negative', () => {
    const socket = openConnection({ maxRetries: -1 });
    socket.fireClose({ code: 1006 });
    for (let i = 0; i < 20; i++) {
      timers.fireOnly();
      sockets.last().fireClose({ code: 1006 });
    }
    expect(connection.state).toBe('reconnecting');
    expect(connection.retryCount).toBe(21);
    expect(timers.live()).toBe(1);

    connection.dispose();
    expectNoLeaks();
  });

  it('does not retry a fatal close code', () => {
    const socket = openConnection();
    socket.fireClose({ code: 1008, reason: 'Unauthorized' });

    expect(connection.state).toBe('error');
    expect(connection.lastError).toMatch(/will not be retried/);
    expect(connection.retryCount).toBe(0);
    expect(timers.live()).toBe(0);

    connection.dispose();
    expectNoLeaks();
  });

  it('reconnects after a clean server goodbye, unlike the phase-3.5 draft', () => {
    // The draft gated reconnection on `!event.wasClean`, which skips exactly
    // the idle-timeout case authors most want covered.
    const socket = openConnection();
    socket.fireClose({ code: 1000, reason: 'idle timeout', wasClean: true });

    expect(connection.state).toBe('reconnecting');
    expect(timers.live()).toBe(1);
    connection.dispose();
  });

  it('settles into closed, not error, when a clean goodbye arrives with reconnection off', () => {
    const socket = openConnection({ autoReconnect: false });
    socket.fireClose({ code: 1000, reason: 'bye', wasClean: true });

    expect(connection.state).toBe('closed');
    expect(errors).toHaveLength(0);
    expect(closes).toEqual([{ code: 1000, reason: 'bye', willReconnect: false }]);
    connection.dispose();
  });

  it('treats an abnormal close with reconnection off as an error', () => {
    const socket = openConnection({ autoReconnect: false });
    socket.fireClose({ code: 1006, wasClean: false });

    expect(connection.state).toBe('error');
    expect(connection.lastError).toMatch(/Auto Reconnect is off/);
    expect(errors).toHaveLength(1);
    connection.dispose();
  });

  it('reports a connect failure and retries it', () => {
    // Node's undici WebSocket fires only `error` — never `close` — when the
    // connection never establishes, so error alone has to drive the retry.
    connection = makeConnection();
    connection.connect();
    sockets.last().fireError();

    expect(errors[0]).toMatch(/Could not connect to wss:\/\/example.test\/socket/);
    expect(connection.state).toBe('reconnecting');
    expect(timers.live()).toBe(1);

    connection.dispose();
    expectNoLeaks();
  });

  it('handles error-then-close from one socket exactly once', () => {
    const socket = openConnection();
    socket.fireError();
    socket.fireClose({ code: 1006 });

    // Browsers fire both. One retry timer, one close callback.
    expect(timers.live()).toBe(1);
    expect(closes).toHaveLength(1);
    expect(connection.retryCount).toBe(1);

    connection.dispose();
  });

  it('exposes the close code and reason for the app to read', () => {
    const socket = openConnection({ autoReconnect: false });
    socket.fireClose({ code: 1011, reason: 'upstream model timeout' });

    expect(connection.closeCode).toBe(1011);
    expect(connection.closeReason).toBe('upstream model timeout');
    expect(connection.lastError).toContain('upstream model timeout');
    connection.dispose();
  });
});

// ── server-initiated close ───────────────────────────────────────────────────

describe('server-initiated close', () => {
  it('detaches and closes the dead socket before reconnecting', () => {
    const first = openConnection();
    first.fireClose({ code: 1006 });

    // A dying socket must not be able to call back in, and must not be left
    // holding an OS handle.
    expect(first.handlersDetached()).toBe(true);
    expect(first.closeCalls.length).toBeGreaterThan(0);

    timers.fireOnly();
    expect(sockets.instances).toHaveLength(2);
    sockets.last().fireOpen();

    connection.dispose();
    expectNoLeaks();
  });

  it('stops the heartbeat when the socket dies', () => {
    const socket = openConnection({ heartbeatInterval: 30000 });
    expect(timers.liveDelays()).toEqual([30000]);

    socket.fireClose({ code: 1006 });
    // Only the reconnect timer survives; the heartbeat is gone.
    expect(timers.liveDelays()).toEqual([1000]);

    connection.dispose();
    expectNoLeaks();
  });
});

// ── cancellation ─────────────────────────────────────────────────────────────

describe('cancellation', () => {
  it('cancels an in-flight connect', () => {
    connection = makeConnection();
    connection.connect();
    const socket = sockets.last();
    expect(connection.state).toBe('connecting');

    connection.disconnect();

    expect(connection.state).toBe('closed');
    expect(socket.handlersDetached()).toBe(true);
    expect(socket.closeCalls).toEqual([{ code: 1000, reason: 'Client disconnect' }]);
    expect(closes).toEqual([{ code: 1000, reason: 'Client disconnect', willReconnect: false }]);

    // A late open from the cancelled socket must be inert.
    socket.fireOpen();
    expect(connection.state).toBe('closed');
    expectNoLeaks();
  });

  it('cancels a pending reconnect, so a manual disconnect really stops trying', () => {
    const socket = openConnection();
    socket.fireClose({ code: 1006 });
    expect(timers.live()).toBe(1);

    connection.disconnect();

    expect(timers.live()).toBe(0);
    expect(connection.state).toBe('closed');
    expect(connection.retryCount).toBe(0);
    expectNoLeaks();
  });

  it('stops the heartbeat on disconnect', () => {
    openConnection({ heartbeatInterval: 5000 });
    expect(timers.live()).toBe(1);

    connection.disconnect();
    expect(timers.live()).toBe(0);
    expectNoLeaks();
  });

  it('stays quiet when disconnecting something that was never connected', () => {
    connection = makeConnection();
    connection.disconnect();

    expect(connection.state).toBe('closed');
    expect(closes).toHaveLength(0);
    expect(events).toHaveLength(0);
  });

  it('does not emit On Close twice for a repeated disconnect', () => {
    const socket = openConnection();
    socket.fireClose({ code: 1000, wasClean: true });
    timers.fireOnly();
    sockets.last().fireOpen();

    connection.disconnect();
    connection.disconnect();
    connection.disconnect();

    expect(closes.filter((c) => c.reason === 'Client disconnect')).toHaveLength(1);
    expectNoLeaks();
  });

  it('reconnects after a manual disconnect when asked again', () => {
    const socket = openConnection();
    connection.disconnect();
    expect(connection.state).toBe('closed');

    connection.connect();
    expect(connection.state).toBe('connecting');
    sockets.last().fireOpen();
    expect(connection.state).toBe('open');
    expect(sockets.last()).not.toBe(socket);

    connection.dispose();
    expectNoLeaks();
  });
});

// ── rapid cycles ─────────────────────────────────────────────────────────────

describe('rapid cycles', () => {
  it('leaves exactly one live socket after repeated connect calls', () => {
    connection = makeConnection();
    for (let i = 0; i < 10; i++) connection.connect();

    expect(sockets.instances).toHaveLength(10);
    // Every superseded socket is closed and detached; only the newest is live.
    for (const socket of sockets.instances.slice(0, 9)) {
      expect(socket.handlersDetached()).toBe(true);
      expect(socket.closeCalls.length).toBeGreaterThan(0);
    }
    expect(sockets.last().handlersDetached()).toBe(false);
    expect(timers.live()).toBe(0);

    connection.dispose();
    expectNoLeaks();
  });

  it('does not report a client-initiated replacement as a connection failure', () => {
    const first = openConnection();
    connection.connect();
    sockets.last().fireOpen();

    // The app asked for the replacement, so On Close would be a false alarm —
    // and an author who learns to ignore On Close will ignore the real ones.
    expect(closes).toHaveLength(0);
    expect(errors).toHaveLength(0);
    expect(first.closeCalls.length).toBeGreaterThan(0);

    connection.dispose();
    expectNoLeaks();
  });

  it('survives connect/disconnect alternated 25 times with nothing left over', () => {
    connection = makeConnection({ heartbeatInterval: 1000 });
    for (let i = 0; i < 25; i++) {
      connection.connect();
      sockets.last().fireOpen();
      connection.disconnect();
    }

    expect(sockets.instances).toHaveLength(25);
    expect(connection.state).toBe('closed');
    expectNoLeaks();
  });

  it('a stale socket that dies after being replaced does not disturb the live one', () => {
    const first = openConnection();
    connection.connect();
    const second = sockets.last();
    second.fireOpen();

    // Detached, so this is a no-op — but assert it, because the alternative is
    // a phantom reconnect racing the live connection.
    first.fireClose({ code: 1006 });
    first.fireError();

    expect(connection.state).toBe('open');
    expect(timers.live()).toBe(0);
    expect(closes).toHaveLength(0);

    connection.dispose();
    expectNoLeaks();
  });
});

// ── node deletion: unmount and navigation ────────────────────────────────────

describe('node deletion (unmount / navigate away)', () => {
  it('leaves no socket and no timers when disposed mid-stream', () => {
    const socket = openConnection({ heartbeatInterval: 30000 });
    socket.fireMessage('{"delta":"partial "}');

    connection.dispose();

    expect(connection.isDisposed).toBe(true);
    expect(connection.state).toBe('closed');
    expect(socket.closeCalls).toEqual([{ code: 1000, reason: 'Node deleted' }]);
    expectNoLeaks();
  });

  it('leaves no timers when disposed during a backoff wait', () => {
    const socket = openConnection();
    socket.fireClose({ code: 1006 });
    expect(timers.live()).toBe(1);

    connection.dispose();
    expectNoLeaks();
  });

  it('emits nothing after dispose, however the socket behaves', () => {
    const socket = openConnection();
    const before = events.length;

    connection.dispose();
    socket.fireMessage('late');
    socket.fireClose({ code: 1006 });
    socket.fireError();
    socket.fireOpen();

    expect(events).toHaveLength(before);
    expect(timers.live()).toBe(0);
  });

  it('refuses to send after dispose and counts what it was holding', () => {
    connection = makeConnection();
    connection.send('queued');
    expect(connection.queueSize).toBe(1);

    connection.dispose();

    expect(connection.droppedCount).toBe(1);
    expect(connection.queueSize).toBe(0);
    expect(connection.send('too late')).toBe(false);
  });

  it('is idempotent', () => {
    const socket = openConnection();
    connection.dispose();
    connection.dispose();
    connection.dispose();

    expect(socket.closeCalls).toHaveLength(1);
    expectNoLeaks();
  });

  it('ignores connect and disconnect after dispose', () => {
    openConnection();
    connection.dispose();
    const socketCount = sockets.instances.length;

    connection.connect();
    connection.disconnect();

    expect(sockets.instances).toHaveLength(socketCount);
    expectNoLeaks();
  });

  it('tolerates a socket whose close() throws', () => {
    const socket = openConnection();
    socket.close = () => {
      throw new Error('already closed');
    };

    expect(() => connection.dispose()).not.toThrow();
    expect(timers.live()).toBe(0);
  });
});

// ── heartbeat ────────────────────────────────────────────────────────────────

describe('heartbeat', () => {
  it('is off by default, so nothing is injected into the app protocol', () => {
    // The phase-3.5 draft defaulted this to 30s and sent the literal text
    // "ping". Injecting unsolicited application data into someone else's
    // protocol cannot be a default.
    const socket = openConnection();
    expect(timers.live()).toBe(0);
    expect(socket.sent).toEqual([]);
    connection.dispose();
  });

  it('sends the configured message on the interval without firing On Message Sent', () => {
    const socket = openConnection({ heartbeatInterval: 30000 });
    timers.fireOnly();

    expect(socket.sent).toEqual(['ping']);
    // A heartbeat is transport bookkeeping; an app counting sent messages must
    // not see it.
    expect(sent).toEqual([]);
    expect(timers.liveDelays()).toEqual([30000]);

    connection.dispose();
    expectNoLeaks();
  });

  it('measures latency from the reply and swallows it', () => {
    const socket = openConnection({ heartbeatInterval: 30000 });
    timers.fireOnly(); // sends ping, clock is now +30000
    timers.advance(42);
    socket.fireMessage('pong');

    expect(connection.latency).toBe(42);
    // The reply is not application data.
    expect(messages).toHaveLength(0);
    connection.dispose();
  });

  it('delivers a "pong" frame normally when the heartbeat is off', () => {
    // Otherwise a server whose protocol happens to use that word would lose
    // messages to the transport layer.
    const socket = openConnection();
    socket.fireMessage('pong');
    expect(messages).toHaveLength(1);
    expect(messages[0].value).toBe('pong');
    connection.dispose();
  });

  it('treats an unanswered heartbeat as a dead connection and reconnects', () => {
    const socket = openConnection({ heartbeatInterval: 30000 });
    timers.fireOnly(); // ping sent, no reply
    timers.fireOnly(); // next heartbeat: still unanswered

    // TCP can hold a half-open socket for minutes. Without this the node would
    // sit in `open` forever, receiving nothing — the silent failure AIX-005 is
    // explicitly about.
    expect(errors[0]).toMatch(/Heartbeat went unanswered/);
    expect(connection.state).toBe('reconnecting');
    expect(socket.handlersDetached()).toBe(true);
    expect(timers.liveDelays()).toEqual([1000]);

    connection.dispose();
    expectNoLeaks();
  });

  it('keeps beating while replies arrive', () => {
    const socket = openConnection({ heartbeatInterval: 1000 });
    for (let i = 0; i < 5; i++) {
      timers.fireOnly();
      socket.fireMessage('pong');
    }

    expect(socket.sent).toEqual(['ping', 'ping', 'ping', 'ping', 'ping']);
    expect(connection.state).toBe('open');
    connection.dispose();
  });

  it('never declares death when no reply marker is configured', () => {
    const socket = openConnection({ heartbeatInterval: 1000, heartbeatReply: '' });
    for (let i = 0; i < 5; i++) timers.fireOnly();

    expect(connection.state).toBe('open');
    expect(socket.sent).toHaveLength(5);
    expect(errors).toHaveLength(0);
    connection.dispose();
  });

  it('restarts on the new interval when reconfigured mid-stream', () => {
    openConnection({ heartbeatInterval: 30000 });
    expect(timers.liveDelays()).toEqual([30000]);

    connection.configure({ heartbeatInterval: 5000 });
    expect(timers.liveDelays()).toEqual([5000]);

    connection.configure({ heartbeatInterval: 0 });
    expect(timers.live()).toBe(0);

    connection.dispose();
  });
});

// ── configure ────────────────────────────────────────────────────────────────

describe('configure', () => {
  it('changes backoff without disturbing the live socket', () => {
    const socket = openConnection();
    connection.configure({ reconnectDelay: 250, maxReconnectDelay: 500 });

    expect(connection.state).toBe('open');
    expect(socket.closeCalls).toHaveLength(0);

    socket.fireClose({ code: 1006 });
    expect(timers.liveDelays()).toEqual([250]);

    connection.dispose();
    expectNoLeaks();
  });

  it('changes the queue policy for subsequent sends only', () => {
    connection = makeConnection();
    connection.send('queued');
    connection.configure({ sendWhenDisconnected: 'drop' });
    connection.send('dropped');

    expect(connection.peekQueue()).toEqual(['queued']);
    expect(connection.droppedCount).toBe(1);
  });

  it('ignores undefined values rather than clobbering configuration', () => {
    connection = makeConnection({ maxRetries: 4 });
    connection.configure({ maxRetries: undefined, jitter: undefined });
    expect(connection.getConfig().maxRetries).toBe(4);
    expect(connection.getConfig().jitter).toBe(false);
  });
});

// ── status notification ──────────────────────────────────────────────────────

describe('status notification', () => {
  it('notifies on every observable transition', () => {
    connection = makeConnection();
    const at = () => statusUpdates;

    const before = at();
    connection.connect();
    expect(at()).toBeGreaterThan(before);

    const afterConnecting = at();
    sockets.last().fireOpen();
    expect(at()).toBeGreaterThan(afterConnecting);

    const afterOpen = at();
    sockets.last().fireClose({ code: 1006 });
    expect(at()).toBeGreaterThan(afterOpen);

    connection.dispose();
  });

  it('survives a callback that throws, without corrupting the state machine', () => {
    // A graph's signal handling can throw (a Function node with a bug). The
    // transport must not be left half-updated or with a timer unscheduled.
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    connection = makeConnection({
      onOpen: () => {
        throw new Error('boom');
      }
    });
    connection.connect();
    sockets.last().fireOpen();

    expect(connection.state).toBe('open');
    expect(connection.connected).toBe(true);

    sockets.last().fireClose({ code: 1006 });
    expect(connection.state).toBe('reconnecting');
    expect(timers.live()).toBe(1);

    connection.dispose();
    expectNoLeaks();
    spy.mockRestore();
  });
});
