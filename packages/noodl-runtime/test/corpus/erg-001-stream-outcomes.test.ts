/**
 * ERG-001 §4 — the outcome contract on the two streaming nodes.
 *
 * See `dev-docs/reference/OUTCOME-CONTRACT.md` for the decision and
 * `ERG-001-S0-MEASUREMENT.md` §0.3 for the ground. §0.3 measured exactly one path on this
 * pair — `Disconnect` when nothing is connected — but Rule 1 covers *every* action, so
 * `Connect` and `Send` are decided here at the same time. Adopting one input of a node and
 * leaving its siblings is the per-node divergence `outcome.ts`'s docstring exists to prevent.
 *
 * ## The three actions, and what each outcome means
 *
 * | Action | `Done` | `Unchanged` | `Failure` |
 * |---|---|---|---|
 * | `Connect` | the socket/stream opened | superseded before it opened | it cannot open, or gave up |
 * | `Disconnect` | something was open and is now closed | there was nothing to close | — |
 * | `Send` (WebSocket) | handed to the socket, or queued for it | discarded by the Drop policy | refused |
 *
 * ⚠️ **`Connect` is async and its token settles at the first terminal state.** A first attempt
 * that fails and a retry that then succeeds is **one** `Done`, not a `Failure` followed by a
 * `Done` — the alternative would end an author's chain dead on a connection that is, in the
 * end, open, which is the exact class this contract closes. The token therefore rides the whole
 * outage, which is the `PendingNavigation` shape from `router-navigate.ts`.
 *
 * ⚠️ **A queued Send is `Done`.** The postcondition of `Send` is "the value is owed to the
 * wire", and a queued message is owed — `Queue Size` and `On Message Sent` are what distinguish
 * "accepted" from "actually written". Reporting `Unchanged` for it would be a lie in the other
 * direction from `Insert Object Into Array`'s.
 *
 * ⚠️ **A dropped Send is `Unchanged`, not `Failure`.** The author configured `When
 * Disconnected: Drop`; a `Failure` that fires on a graph working exactly as written is how
 * authors are trained to ignore the port.
 *
 * ## What reverting reddens — predicted before running
 *
 * | Revert | Reddens |
 * |---|---|
 * | `disconnect` reporting `done` unconditionally | the nothing-to-close row only; the while-open control stays green |
 * | the `Connect` token minted on the auto-connect path too | the auto-connect-is-silent rows on both nodes only |
 * | settling the connect token at the first *attempt* failure | the retry-then-open row only |
 * | `send` reporting `done` for a policy drop | the Drop row only; the Queue row is the control |
 */

/* eslint-env jest */

import type { NodeInstance, RuntimeErrorEventLike } from '@noodl/types';

import type { SseNodeInstance } from '../../src/nodes/std-library/agent/node-instances';
import type {
  SseTransportEnv,
  StreamBodyLike,
  StreamReadResultLike,
  FetchLike,
  SseRequestInit
} from '../../src/nodes/std-library/agent/sse-connection';
import type {
  WebSocketCloseEventLike,
  WebSocketLike,
  WebSocketMessageEventLike
} from '../../src/nodes/std-library/agent/websocket-connection';

import { createNode, pulse, type TestNode } from '../helpers/node-harness';

import sseModule = require('../../src/nodes/std-library/agent/sse');
import websocketModule = require('../../src/nodes/std-library/agent/websocket');

// =================================================================================================
// Doubles — trimmed local copies, for the reason agent-sse-node.test.ts gives for keeping its own:
// two suites that share a fake can break each other for reasons neither is about.
// =================================================================================================

class FakeSocket implements WebSocketLike {
  static instances: FakeSocket[] = [];

  sent: unknown[] = [];
  binaryType = 'blob';

  onopen: ((event?: unknown) => void) | null = null;
  onmessage: ((event: WebSocketMessageEventLike) => void) | null = null;
  onerror: ((event?: unknown) => void) | null = null;
  onclose: ((event?: WebSocketCloseEventLike) => void) | null = null;

  constructor(public url: string, public protocols?: string | string[]) {
    FakeSocket.instances.push(this);
  }

  send(data: unknown): void {
    this.sent.push(data);
  }
  close(): void {
    /* the node detaches the handlers; nothing here needs to model the close frame */
  }
  fireOpen(): void {
    this.onopen && this.onopen({});
  }
  fireClose(event: WebSocketCloseEventLike = { code: 1006 }): void {
    this.onclose && this.onclose(event);
  }
}

let liveTimers: Map<number, () => void>;
let nextTimerHandle: number;

const wsSeams = {
  WebSocketImpl: FakeSocket as unknown as new (url: string, protocols?: string | string[]) => WebSocketLike,
  setTimeoutImpl: (fn: () => void) => {
    const handle = nextTimerHandle++;
    liveTimers.set(handle, fn);
    return handle;
  },
  clearTimeoutImpl: (handle: unknown) => {
    liveTimers.delete(handle as number);
  },
  nowImpl: () => 1_000_000,
  randomImpl: () => 0.5
};

/** Fires the single pending timer, which in these rows is always the reconnect backoff. */
function fireOnlyTimer(): void {
  const handles = Array.from(liveTimers.keys());
  if (handles.length !== 1) throw new Error(`expected one pending timer, found ${handles.length}`);
  const fn = liveTimers.get(handles[0]);
  liveTimers.delete(handles[0]);
  fn();
}

interface StreamDouble {
  body: StreamBodyLike;
  end(): void;
}

/** A fetch body that stays open until the row ends it. */
function makeBody(): StreamDouble {
  let pending: { resolve: (v: StreamReadResultLike) => void } | null = null;
  let ended = false;

  return {
    body: {
      getReader: () => ({
        read() {
          if (ended) return Promise.resolve({ value: undefined, done: true });
          return new Promise<StreamReadResultLike>((resolve) => {
            pending = { resolve };
          });
        },
        cancel() {
          return Promise.resolve();
        }
      })
    } as StreamBodyLike,
    end() {
      ended = true;
      if (pending) {
        const p = pending;
        pending = null;
        p.resolve({ value: undefined, done: true });
      }
    }
  };
}

function makeFetch(body: StreamBodyLike): FetchLike {
  return ((url: string, init?: SseRequestInit) => {
    void url;
    void init;
    return Promise.resolve({ ok: true, status: 200, body });
  }) as FetchLike;
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

// =================================================================================================
// Fixtures
// =================================================================================================

interface StreamFixture<I extends NodeInstance = NodeInstance> {
  node: TestNode<I>;
  signals: string[];
  errors: RuntimeErrorEventLike[];
  out(name: string): unknown;
  update(): void;
}

function createWebSocket(): StreamFixture {
  const driven = createNode(websocketModule, 'net.noodl.WebSocket', 'ws-1');
  // The seam has to be in place before the node builds its connection, which for an
  // auto-connecting node is the first update after a url arrives.
  (driven.node as TestNode & { _webSocketTestSeams: unknown })._webSocketTestSeams = wsSeams;

  const errors: RuntimeErrorEventLike[] = [];
  driven.context.errorBus.subscribe((event: RuntimeErrorEventLike) => errors.push(event));

  return {
    node: driven.node,
    signals: driven.signals,
    errors,
    out: driven.out,
    update: () => driven.node.update()
  };
}

function createSse(seams: SseTransportEnv = {}): StreamFixture<SseNodeInstance> {
  const driven = createNode<SseNodeInstance>(sseModule, 'net.noodl.SSE', 'sse-1');
  driven.node._internal.seams = seams;

  const errors: RuntimeErrorEventLike[] = [];
  driven.context.errorBus.subscribe((event: RuntimeErrorEventLike) => errors.push(event));

  return {
    node: driven.node,
    signals: driven.signals,
    errors,
    out: driven.out,
    update: () => driven.node.update()
  };
}

/** The terminal outcomes only, with the lifecycle signals a row never asserts on removed. */
function outcomesOf(signals: string[]): string[] {
  return signals.filter((s) => s === 'done' || s === 'unchanged' || s === 'failure');
}

function countOf(signals: string[], name: string): number {
  return signals.filter((s) => s === name).length;
}

beforeEach(() => {
  FakeSocket.instances = [];
  liveTimers = new Map();
  nextTimerHandle = 1;
});

// =================================================================================================
// net.noodl.WebSocket — the port surface
// =================================================================================================

describe('ERG-001 §4: WebSocket port surface', () => {
  it('publishes the contract ports, in the Events group, alongside the ones it already had', () => {
    const { metadata } = createNode(websocketModule, 'net.noodl.WebSocket');

    for (const name of ['done', 'unchanged', 'failure', 'completed']) {
      expect(metadata.outputs[name]).toBeDefined();
      expect(metadata.outputs[name].type).toBe('signal');
      expect(metadata.outputs[name].group).toBe('Events');
      // `description` is canonical; enrichment may only add what the source cannot know.
      expect(typeof metadata.outputs[name].description).toBe('string');
    }

    // SR-ix's sweep, as an assertion: the reserved names must not have collided with the
    // lifecycle signals this node already published, which mean something else entirely.
    for (const name of ['onOpen', 'onMessage', 'onMessageSent', 'onError', 'onClose', 'onReconnect']) {
      expect(metadata.outputs[name]).toBeDefined();
    }
  });
});

// =================================================================================================
// net.noodl.WebSocket — Disconnect. §0.3's one measured entry on this node.
// =================================================================================================

describe('ERG-001 §4: WebSocket Disconnect', () => {
  it('reports Unchanged when there was nothing to close', () => {
    const f = createWebSocket();
    f.node.setInputValue('autoConnect', false);
    f.node.setInputValue('url', 'wss://example.test/agent');
    f.update();

    pulse(f.node, 'disconnect');

    expect(outcomesOf(f.signals)).toEqual(['unchanged']);
    expect(countOf(f.signals, 'completed')).toBe(1);
    expect(f.signals.indexOf('completed')).toBeGreaterThan(f.signals.indexOf('unchanged'));
    // §0.3's whole point: this used to be the silent path.
    expect(f.errors).toEqual([]);
  });

  it('(control) reports Done when a live socket was closed', () => {
    const f = createWebSocket();
    f.node.setInputValue('url', 'wss://example.test/agent');
    f.update();
    FakeSocket.instances[0].fireOpen();
    f.update();

    pulse(f.node, 'disconnect');

    expect(outcomesOf(f.signals)).toEqual(['done']);
    expect(countOf(f.signals, 'completed')).toBe(1);
  });

  it('reports Done then Unchanged for two Disconnects, because an outcome is per-invocation', () => {
    const f = createWebSocket();
    f.node.setInputValue('url', 'wss://example.test/agent');
    f.update();
    FakeSocket.instances[0].fireOpen();
    f.update();

    pulse(f.node, 'disconnect');
    pulse(f.node, 'disconnect');

    // NV-iii: `Close Popup` and `Pop Component Stack` latched their first outcome and
    // reported it again forever. A token per invocation makes that unrepresentable.
    expect(outcomesOf(f.signals)).toEqual(['done', 'unchanged']);
    expect(countOf(f.signals, 'completed')).toBe(2);
  });

  it('keeps no Failure for itself — a Disconnect cannot fail', () => {
    const f = createWebSocket();
    f.node.setInputValue('autoConnect', false);
    f.node.setInputValue('url', 'wss://example.test/agent');
    f.update();

    pulse(f.node, 'disconnect');
    expect(f.signals).not.toContain('failure');
  });
});

// =================================================================================================
// net.noodl.WebSocket — Connect, the async one
// =================================================================================================

describe('ERG-001 §4: WebSocket Connect', () => {
  it('reports Done once the socket opens, after On Open', () => {
    const f = createWebSocket();
    f.node.setInputValue('autoConnect', false);
    f.node.setInputValue('url', 'wss://example.test/agent');
    f.update();

    pulse(f.node, 'connect');
    // The action is not over yet: the handshake has not landed.
    expect(outcomesOf(f.signals)).toEqual([]);

    FakeSocket.instances[0].fireOpen();
    f.update();

    expect(outcomesOf(f.signals)).toEqual(['done']);
    // Announce after you update — the lifecycle signal and the values it describes come first.
    expect(f.signals.indexOf('done')).toBeGreaterThan(f.signals.indexOf('onOpen'));
    expect(f.signals.indexOf('completed')).toBeGreaterThan(f.signals.indexOf('done'));
  });

  it('reports Failure with a code when there is no URL to connect to', () => {
    const f = createWebSocket();
    f.node.setInputValue('autoConnect', false);
    f.update();

    pulse(f.node, 'connect');

    expect(outcomesOf(f.signals)).toEqual(['failure']);
    expect(f.errors.map((e) => e.code)).toEqual(['websocket/connect-failed']);
    // The reason reaches the canvas as well as the error channel.
    expect(String(f.out('lastError'))).toContain('URL is required');
    expect(f.signals.indexOf('completed')).toBeGreaterThan(f.signals.indexOf('failure'));
  });

  it('reports one Done when the first attempt drops and a retry then opens', () => {
    const f = createWebSocket();
    f.node.setInputValue('autoConnect', false);
    f.node.setInputValue('url', 'wss://example.test/agent');
    f.update();

    pulse(f.node, 'connect');
    FakeSocket.instances[0].fireClose({ code: 1006 });
    f.update();

    // Mid-outage: the action has not finished, so it has not reported.
    expect(outcomesOf(f.signals)).toEqual([]);
    expect(f.out('connectionState')).toBe('reconnecting');

    fireOnlyTimer();
    FakeSocket.instances[1].fireOpen();
    f.update();

    // Exactly one, and it is Done — a Failure here would end the chain dead on a
    // connection that is, in the end, open.
    expect(outcomesOf(f.signals)).toEqual(['done']);
    expect(countOf(f.signals, 'completed')).toBe(1);
  });

  it('reports Failure when the connection gives up for good', () => {
    const f = createWebSocket();
    f.node.setInputValue('autoConnect', false);
    f.node.setInputValue('autoReconnect', false);
    f.node.setInputValue('url', 'wss://example.test/agent');
    f.update();

    pulse(f.node, 'connect');
    FakeSocket.instances[0].fireClose({ code: 1006 });
    f.update();

    expect(f.out('connectionState')).toBe('error');
    expect(outcomesOf(f.signals)).toEqual(['failure']);
    expect(f.errors.map((e) => e.code)).toEqual(['websocket/connect-failed']);
  });

  it('reports Unchanged for a Connect a Disconnect superseded, and Done for the Disconnect', () => {
    const f = createWebSocket();
    f.node.setInputValue('autoConnect', false);
    f.node.setInputValue('url', 'wss://example.test/agent');
    f.update();

    pulse(f.node, 'connect');
    pulse(f.node, 'disconnect');

    // Two invocations, two outcomes: the connect never opened, and the disconnect closed
    // the attempt that was in flight.
    expect(outcomesOf(f.signals)).toEqual(['unchanged', 'done']);
    expect(countOf(f.signals, 'completed')).toBe(2);
    expect(f.errors).toEqual([]);
  });

  it('reports nothing at all on the auto-connect path', () => {
    const f = createWebSocket();
    f.node.setInputValue('url', 'wss://example.test/agent');
    f.update();
    FakeSocket.instances[0].fireOpen();
    f.update();

    // The mount-path rule from the navigation slice, here: auto-connect is not an
    // invocation of the `Connect` port, so it mints no token and reports nothing.
    expect(f.out('connectionState')).toBe('open');
    expect(f.signals).toContain('onOpen');
    expect(outcomesOf(f.signals)).toEqual([]);
    expect(f.signals).not.toContain('completed');
  });

  it('reports nothing when a URL change rebuilds the connection', () => {
    const f = createWebSocket();
    f.node.setInputValue('url', 'wss://example.test/one');
    f.update();
    FakeSocket.instances[0].fireOpen();
    f.update();

    f.node.setInputValue('url', 'wss://example.test/two');
    f.update();
    FakeSocket.instances[1].fireOpen();
    f.update();

    expect(FakeSocket.instances[1].url).toBe('wss://example.test/two');
    expect(outcomesOf(f.signals)).toEqual([]);
  });
});

// =================================================================================================
// net.noodl.WebSocket — Send
// =================================================================================================

describe('ERG-001 §4: WebSocket Send', () => {
  function openSocket(): StreamFixture {
    const f = createWebSocket();
    f.node.setInputValue('url', 'wss://example.test/agent');
    f.update();
    FakeSocket.instances[0].fireOpen();
    f.update();
    return f;
  }

  it('reports Done once the value has reached the socket, after On Message Sent', () => {
    const f = openSocket();

    f.node.setInputValue('message', 'hello');
    pulse(f.node, 'send');

    expect(FakeSocket.instances[0].sent).toEqual(['hello']);
    expect(outcomesOf(f.signals)).toEqual(['done']);
    expect(f.signals.indexOf('done')).toBeGreaterThan(f.signals.indexOf('onMessageSent'));
    expect(f.signals.indexOf('completed')).toBeGreaterThan(f.signals.indexOf('done'));
  });

  it('(control) reports Done for a message the queue accepted, because it is still owed', () => {
    const f = createWebSocket();
    f.node.setInputValue('autoConnect', false);
    f.node.setInputValue('url', 'wss://example.test/agent');
    f.node.setInputValue('whenDisconnected', 'queue');
    f.update();

    f.node.setInputValue('message', 'later');
    pulse(f.node, 'send');

    expect(outcomesOf(f.signals)).toEqual(['done']);
    expect(f.out('queueSize')).toBe(1);
    expect(f.errors).toEqual([]);
  });

  it('reports Unchanged for a message the Drop policy discarded', () => {
    const f = createWebSocket();
    f.node.setInputValue('autoConnect', false);
    f.node.setInputValue('url', 'wss://example.test/agent');
    f.node.setInputValue('whenDisconnected', 'drop');
    f.update();

    f.node.setInputValue('message', 'gone');
    pulse(f.node, 'send');

    // The author configured Drop. A Failure that fires on a graph working exactly as
    // written is how authors are trained to ignore the port.
    expect(outcomesOf(f.signals)).toEqual(['unchanged']);
    expect(f.out('droppedCount')).toBe(1);
    expect(f.errors).toEqual([]);
  });

  it('reports Failure when the Report Error policy refuses the send', () => {
    const f = createWebSocket();
    f.node.setInputValue('autoConnect', false);
    f.node.setInputValue('url', 'wss://example.test/agent');
    f.node.setInputValue('whenDisconnected', 'error');
    f.update();

    f.node.setInputValue('message', 'nope');
    pulse(f.node, 'send');

    expect(outcomesOf(f.signals)).toEqual(['failure']);
    expect(f.errors.map((e) => e.code)).toEqual(['websocket/not-connected']);
  });

  it('reports Failure with its own code when there is nothing in Message to send', () => {
    const f = openSocket();

    pulse(f.node, 'send');

    expect(outcomesOf(f.signals)).toEqual(['failure']);
    expect(f.errors.map((e) => e.code)).toEqual(['websocket/nothing-to-send']);
  });

  it('reports Failure with its own code when the queue is full', () => {
    const f = createWebSocket();
    f.node.setInputValue('autoConnect', false);
    f.node.setInputValue('url', 'wss://example.test/agent');
    f.node.setInputValue('whenDisconnected', 'queue');
    f.node.setInputValue('maxQueueSize', 1);
    f.update();

    f.node.setInputValue('message', 'first');
    pulse(f.node, 'send');
    f.node.setInputValue('message', 'second');
    pulse(f.node, 'send');

    expect(outcomesOf(f.signals)).toEqual(['done', 'failure']);
    expect(f.errors.map((e) => e.code)).toEqual(['websocket/queue-full']);
    expect(countOf(f.signals, 'completed')).toBe(2);
  });

  it('gives three Sends three outcomes and three Completeds', () => {
    const f = openSocket();
    f.node.setInputValue('message', 'x');

    for (let i = 0; i < 3; i++) pulse(f.node, 'send');

    expect(outcomesOf(f.signals)).toEqual(['done', 'done', 'done']);
    expect(countOf(f.signals, 'completed')).toBe(3);
  });
});

// =================================================================================================
// net.noodl.SSE — the same three questions, on the node that shares its port shape
// =================================================================================================

describe('ERG-001 §4: SSE port surface', () => {
  it('publishes the contract ports, in the Events group', () => {
    const { metadata } = createNode(sseModule, 'net.noodl.SSE');

    for (const name of ['done', 'unchanged', 'failure', 'completed']) {
      expect(metadata.outputs[name]).toBeDefined();
      expect(metadata.outputs[name].type).toBe('signal');
      expect(metadata.outputs[name].group).toBe('Events');
      expect(typeof metadata.outputs[name].description).toBe('string');
    }

    for (const name of ['onOpen', 'onMessage', 'onError', 'onClose']) {
      expect(metadata.outputs[name]).toBeDefined();
    }
  });
});

describe('ERG-001 §4: SSE Disconnect', () => {
  it('reports Unchanged when no stream was ever opened', () => {
    const f = createSse();
    f.node.setInputValue('url', 'https://example.test/stream');

    pulse(f.node, 'disconnect');

    expect(outcomesOf(f.signals)).toEqual(['unchanged']);
    expect(countOf(f.signals, 'completed')).toBe(1);
    expect(f.errors).toEqual([]);
  });

  it('(control) reports Done when a live stream was closed', async () => {
    const stream = makeBody();
    const f = createSse({ fetchImpl: makeFetch(stream.body) });
    f.node.setInputValue('url', 'https://example.test/stream');
    f.node.setInputValue('transport', 'fetch');

    pulse(f.node, 'connect');
    await flush();

    pulse(f.node, 'disconnect');

    // Two invocations: the Connect that opened, then the Disconnect that closed it.
    expect(outcomesOf(f.signals)).toEqual(['done', 'done']);
    expect(countOf(f.signals, 'completed')).toBe(2);
  });

  it('reports Done then Unchanged for two Disconnects', async () => {
    const stream = makeBody();
    const f = createSse({ fetchImpl: makeFetch(stream.body) });
    f.node.setInputValue('url', 'https://example.test/stream');
    f.node.setInputValue('transport', 'fetch');

    pulse(f.node, 'connect');
    await flush();
    pulse(f.node, 'disconnect');
    pulse(f.node, 'disconnect');

    expect(outcomesOf(f.signals)).toEqual(['done', 'done', 'unchanged']);
  });
});

describe('ERG-001 §4: SSE Connect', () => {
  it('reports Done once the stream is open, after On Open', async () => {
    const stream = makeBody();
    const f = createSse({ fetchImpl: makeFetch(stream.body) });
    f.node.setInputValue('url', 'https://example.test/stream');
    f.node.setInputValue('transport', 'fetch');

    pulse(f.node, 'connect');
    // The request is in flight; the action has not finished.
    expect(outcomesOf(f.signals)).toEqual([]);

    await flush();

    expect(outcomesOf(f.signals)).toEqual(['done']);
    expect(f.signals.indexOf('done')).toBeGreaterThan(f.signals.indexOf('onOpen'));
    expect(f.signals.indexOf('completed')).toBeGreaterThan(f.signals.indexOf('done'));
  });

  it('reports Failure with a code when there is no URL to stream from', () => {
    const f = createSse();

    pulse(f.node, 'connect');

    expect(outcomesOf(f.signals)).toEqual(['failure']);
    expect(f.errors.map((e) => e.code)).toEqual(['sse/connect-failed']);
    expect(f.signals.indexOf('completed')).toBeGreaterThan(f.signals.indexOf('failure'));
  });

  it('reports Unchanged for a Connect a Disconnect superseded', async () => {
    const stream = makeBody();
    const f = createSse({ fetchImpl: makeFetch(stream.body) });
    f.node.setInputValue('url', 'https://example.test/stream');
    f.node.setInputValue('transport', 'fetch');

    pulse(f.node, 'connect');
    pulse(f.node, 'disconnect');
    await flush();

    expect(outcomesOf(f.signals)).toEqual(['unchanged', 'done']);
    expect(f.errors).toEqual([]);
  });

  it('reports nothing at all on the auto-connect path', async () => {
    const stream = makeBody();
    const f = createSse({ fetchImpl: makeFetch(stream.body) });
    f.node.setInputValue('autoConnect', true);
    f.node.setInputValue('url', 'https://example.test/stream');
    f.node.setInputValue('transport', 'fetch');
    f.update();
    await flush();

    expect(f.out('connectionState')).toBe('open');
    expect(f.signals).toContain('onOpen');
    expect(outcomesOf(f.signals)).toEqual([]);
    expect(f.signals).not.toContain('completed');
  });
});
