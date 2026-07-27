/**
 * AGENT-001 — the SSE node shell.
 *
 * The connection lifecycle is proved in agent-sse-connection.test.ts. What is left to
 * prove here is that the node exposes it: that the promised ports exist, that state
 * changes reach outputs and signals, that Auto Connect waits for its inputs, and —
 * the named success criterion — that deleting the node leaves nothing running.
 */

import type { SseNodeInstance } from '../src/nodes/std-library/agent/node-instances';
import type {
  AbortControllerLike,
  EventSourceLike,
  FetchLike,
  SseRequestInit,
  SseTransportEnv,
  StreamBodyLike,
  StreamReadResultLike
} from '../src/nodes/std-library/agent/sse-connection';

import { createNode, outputValue } from './helpers/node-harness';

import sseModule = require('../src/nodes/std-library/agent/sse');

// ---------------------------------------------------------------------------
// Doubles (a trimmed copy of the connection suite's, kept local so the two
// suites cannot break each other)
// ---------------------------------------------------------------------------

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
    run: () => {
      const entries = Array.from(timers.values());
      timers.clear();
      entries.forEach((t) => t.fn());
    }
  };
}

function makeBody() {
  const queue: string[] = [];
  let pending: { resolve: (v: StreamReadResultLike) => void; reject: (e: unknown) => void } | null = null;
  let ended = false;
  let failure: Error | null = null;
  const state = { cancelled: false };

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
      getReader: () => ({
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
      })
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

/** One recorded request, with the request init the transport built for it. */
interface FetchCall {
  url: string;
  init?: SseRequestInit;
}

type RecordingFetch = FetchLike & { calls: FetchCall[] };

function makeFetch(bodies: StreamBodyLike[]): RecordingFetch {
  const calls: FetchCall[] = [];
  const fn = ((url: string, init?: SseRequestInit) => {
    calls.push({ url, init });
    const body = bodies[Math.min(calls.length - 1, bodies.length - 1)];
    return Promise.resolve({ ok: true, status: 200, body });
  }) as RecordingFetch;
  fn.calls = calls;
  return fn;
}

interface FakeAbortController extends AbortControllerLike {
  aborted: boolean;
}

/**
 * The `NodeRegisterConstructor` idiom: an ES5 constructor function needs its `new`
 * signature, its prototype and its statics declared separately from the function
 * expression that implements it.
 */
interface FakeAbortControllerConstructor {
  new (): FakeAbortController;
  prototype: FakeAbortController;
  created: FakeAbortController[];
}

function makeAbortController(): FakeAbortControllerConstructor {
  const created: FakeAbortController[] = [];
  const FakeAbortController = function (this: FakeAbortController) {
    this.aborted = false;
    this.signal = {};
    created.push(this);
  } as unknown as FakeAbortControllerConstructor;
  FakeAbortController.prototype.abort = function (this: FakeAbortController) {
    this.aborted = true;
  };
  FakeAbortController.created = created;
  return FakeAbortController;
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

/** Creates the node and records every signal it sends. */
function createSseNode(seams: SseTransportEnv = {}) {
  const { node, signals } = createNode<SseNodeInstance>(sseModule, 'net.noodl.SSE', 'sse-1');
  node._internal.seams = seams;
  return { node, signals, out: (name: string) => outputValue(node, name) };
}

// ---------------------------------------------------------------------------

describe('net.noodl.SSE — port surface', () => {
  it('declares exactly the documented ports', () => {
    const { metadata } = createNode(sseModule, 'net.noodl.SSE');

    // Pinned deliberately: the SSE and WebSocket nodes are meant to read alike, so a
    // rename on one side should have to be a conscious edit here.
    expect(Object.keys(metadata.inputs).sort()).toEqual(
      [
        'autoConnect',
        'autoReconnect',
        'body',
        'connect',
        'dedupeById',
        'disconnect',
        'eventTypes',
        'headers',
        'maxReconnectDelay',
        'maxRetries',
        'method',
        'reconnectDelay',
        'reconnectOnStreamEnd',
        'textPath',
        'transport',
        'url',
        'withCredentials'
      ].sort()
    );

    expect(Object.keys(metadata.outputs).sort()).toEqual(
      [
        'connected',
        'connectionState',
        'data',
        'deliverySemantics',
        'duplicatesSuppressed',
        'eventType',
        'lastError',
        'lastEventId',
        'lastMessageTime',
        'messageCount',
        'onClose',
        'onError',
        'onMessage',
        'onOpen',
        'raw',
        'retryCount',
        'text'
      ].sort()
    );
  });

  it('turns connect and disconnect into connections-only signal inputs', () => {
    const { metadata } = createNode(sseModule, 'net.noodl.SSE');
    expect(metadata.inputs.connect.type).toEqual({ name: 'signal', allowConnectionsOnly: true });
    expect(metadata.inputs.disconnect.type).toEqual({ name: 'signal', allowConnectionsOnly: true });
  });

  it('is client-only under SSR, since a stream cannot be consumed in a server render', () => {
    expect(sseModule.node.ssr).toEqual({
      compat: 'client-only',
      note: expect.stringContaining('browser')
    });
  });

  it('rests in a legible state before anything is connected', () => {
    const { out } = createSseNode();
    expect(out('connectionState')).toBe('idle');
    expect(out('connected')).toBe(false);
    expect(out('lastError')).toBe('');
    expect(out('retryCount')).toBe(0);
    expect(out('deliverySemantics')).toBe('at-most-once');
  });
});

describe('net.noodl.SSE — streaming through the graph', () => {
  it('connects on the Connect signal and publishes frames as outputs', async () => {
    const stream = makeBody();
    const timers = makeTimers();
    const { node, signals, out } = createSseNode({
      fetchImpl: makeFetch([stream.body]),
      AbortControllerImpl: makeAbortController(),
      ...timers
    });

    node.setInputValue('url', 'https://example.test/stream');
    node.setInputValue('transport', 'fetch');
    node.setInputValue('connect', true);

    expect(out('connectionState')).toBe('connecting');
    await flush();
    expect(out('connectionState')).toBe('open');
    expect(out('connected')).toBe(true);
    expect(signals).toEqual(['onOpen']);

    stream.push('event: token\nid: 1\ndata: {"text":"hi"}\n\n');
    await flush();

    expect(out('data')).toEqual({ text: 'hi' });
    expect(out('raw')).toBe('{"text":"hi"}');
    expect(out('eventType')).toBe('token');
    expect(out('lastEventId')).toBe('1');
    expect(out('messageCount')).toBe(1);
    expect(out('deliverySemantics')).toBe('at-least-once-deduped');
    expect(signals).toEqual(['onOpen', 'onMessage']);

    node._onNodeDeleted();
  });

  it('passes plain-text payloads through unparsed', async () => {
    const stream = makeBody();
    const { node, out } = createSseNode({
      fetchImpl: makeFetch([stream.body]),
      AbortControllerImpl: makeAbortController(),
      ...makeTimers()
    });
    node.setInputValue('url', 'https://example.test/stream');
    node.setInputValue('connect', true);
    await flush();

    stream.push('data: [DONE]\n\n');
    await flush();

    expect(out('data')).toBe('[DONE]');
    node._onNodeDeleted();
  });

  // -- the Text output ------------------------------------------------------
  //
  // `data` is JSON-parsed, which is right for a stream that mixes JSON frames with bare
  // sentinels — but it means `data` is an *object* for the commonest agent shape, and the
  // documented wiring (`data` -> a Text Accumulator's `chunk`) therefore rendered
  // `[object Object]`. `text` is the output that is always a string.

  it('puts the raw payload on Text when no Text Path is set', async () => {
    const stream = makeBody();
    const { node, out } = createSseNode({
      fetchImpl: makeFetch([stream.body]),
      AbortControllerImpl: makeAbortController(),
      ...makeTimers()
    });
    node.setInputValue('url', 'https://example.test/stream');
    node.setInputValue('connect', true);
    await flush();

    stream.push('data: Hello\n\n');
    await flush();

    expect(out('text')).toBe('Hello');
    node._onNodeDeleted();
  });

  it('extracts the token from an OpenAI-style envelope when Text Path names it', async () => {
    const stream = makeBody();
    const { node, out } = createSseNode({
      fetchImpl: makeFetch([stream.body]),
      AbortControllerImpl: makeAbortController(),
      ...makeTimers()
    });
    node.setInputValue('url', 'https://example.test/stream');
    node.setInputValue('textPath', 'choices.0.delta.content');
    node.setInputValue('connect', true);
    await flush();

    stream.push('data: {"choices":[{"delta":{"role":"assistant"}}]}\n\n');
    await flush();
    // The first frame of a real stream announces the role and carries no content: an
    // absent field is an ordinary outcome and must read as "nothing", not as undefined.
    expect(out('text')).toBe('');

    stream.push('data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n');
    await flush();
    expect(out('text')).toBe('Hi');
    expect(out('data')).toEqual({ choices: [{ delta: { content: 'Hi' } }] });

    // …and the sentinel that ends such a stream never parses, so it contributes nothing
    // rather than being appended to the answer.
    stream.push('data: [DONE]\n\n');
    await flush();
    expect(out('text')).toBe('');

    node._onNodeDeleted();
  });

  it('never puts an object on Text, whatever the path resolves to', async () => {
    const stream = makeBody();
    const { node, out } = createSseNode({
      fetchImpl: makeFetch([stream.body]),
      AbortControllerImpl: makeAbortController(),
      ...makeTimers()
    });
    node.setInputValue('url', 'https://example.test/stream');
    node.setInputValue('textPath', 'delta');
    node.setInputValue('connect', true);
    await flush();

    stream.push('data: {"delta":{"nested":"no"}}\n\n');
    await flush();
    expect(out('text')).toBe('');

    // A number at the path is text as far as an author is concerned.
    stream.push('data: {"delta":7}\n\n');
    await flush();
    expect(out('text')).toBe('7');

    node._onNodeDeleted();
  });

  it('re-reads Text when the path changes, without needing another frame', async () => {
    const stream = makeBody();
    const { node, out } = createSseNode({
      fetchImpl: makeFetch([stream.body]),
      AbortControllerImpl: makeAbortController(),
      ...makeTimers()
    });
    node.setInputValue('url', 'https://example.test/stream');
    node.setInputValue('connect', true);
    await flush();

    stream.push('data: {"a":"one","b":"two"}\n\n');
    await flush();
    expect(out('text')).toBe('{"a":"one","b":"two"}');

    node.setInputValue('textPath', 'b');
    expect(out('text')).toBe('two');

    node._onNodeDeleted();
  });

  it('fires On Close when the server ends the stream', async () => {
    const stream = makeBody();
    const { node, signals, out } = createSseNode({
      fetchImpl: makeFetch([stream.body]),
      AbortControllerImpl: makeAbortController(),
      ...makeTimers()
    });
    node.setInputValue('url', 'https://example.test/stream');
    node.setInputValue('connect', true);
    await flush();

    stream.end();
    await flush();

    expect(out('connectionState')).toBe('closed');
    expect(out('connected')).toBe(false);
    expect(signals).toEqual(['onOpen', 'onClose']);
    node._onNodeDeleted();
  });

  it('surfaces a drop as On Error plus a visible reconnecting state and retry count', async () => {
    const stream = makeBody();
    const timers = makeTimers();
    const { node, signals, out } = createSseNode({
      fetchImpl: makeFetch([stream.body]),
      AbortControllerImpl: makeAbortController(),
      ...timers
    });
    node.setInputValue('url', 'https://example.test/stream');
    node.setInputValue('reconnectDelay', 1000);
    node.setInputValue('connect', true);
    await flush();

    stream.fail('socket hang up');
    await flush();

    // The whole premise: none of this is a console message.
    expect(out('connectionState')).toBe('reconnecting');
    expect(out('retryCount')).toBe(1);
    expect(out('lastError')).toMatch(/interrupted/);
    expect(signals).toEqual(['onOpen', 'onError']);

    node._onNodeDeleted();
    expect(timers.pending()).toBe(0);
  });

  it('fires On Close for a terminal error too, so a Close handler always runs', async () => {
    const timers = makeTimers();
    const { node, signals, out } = createSseNode({
      fetchImpl: () => Promise.resolve({ ok: false, status: 404 }),
      AbortControllerImpl: makeAbortController(),
      ...timers
    });
    node.setInputValue('url', 'https://example.test/stream');
    node.setInputValue('connect', true);
    await flush();

    expect(out('connectionState')).toBe('error');
    expect(signals).toEqual(['onError', 'onClose']);
    expect(timers.pending()).toBe(0);
    node._onNodeDeleted();
  });

  it('disconnects on the Disconnect signal', async () => {
    const stream = makeBody();
    const { node, out } = createSseNode({
      fetchImpl: makeFetch([stream.body]),
      AbortControllerImpl: makeAbortController(),
      ...makeTimers()
    });
    node.setInputValue('url', 'https://example.test/stream');
    node.setInputValue('connect', true);
    await flush();

    node.setInputValue('disconnect', true);
    expect(out('connectionState')).toBe('closed');

    stream.push('data: ignored\n\n');
    await flush();
    expect(out('messageCount')).toBe(0);

    node._onNodeDeleted();
  });

  it('carries headers and a body from the graph into the request', async () => {
    const stream = makeBody();
    const fetchImpl = makeFetch([stream.body]);
    const { node } = createSseNode({ fetchImpl, AbortControllerImpl: makeAbortController(), ...makeTimers() });

    node.setInputValue('url', 'https://api.test/chat');
    node.setInputValue('method', 'POST');
    node.setInputValue('headers', { Authorization: 'Bearer abc' });
    node.setInputValue('body', { prompt: 'hello' });
    node.setInputValue('connect', true);
    await flush();

    expect(fetchImpl.calls[0].init.method).toBe('POST');
    expect(fetchImpl.calls[0].init.headers.Authorization).toBe('Bearer abc');
    expect(fetchImpl.calls[0].init.body).toBe('{"prompt":"hello"}');
    node._onNodeDeleted();
  });

  it('splits the Event Types input for the EventSource transport', async () => {
    interface ListenerRecordingES extends EventSourceLike {
      url: string;
      listeners: Record<string, true>;
    }
    interface ListenerRecordingESConstructor {
      new (url: string): ListenerRecordingES;
      prototype: ListenerRecordingES;
    }

    const instances: ListenerRecordingES[] = [];
    const FakeES = function (this: ListenerRecordingES, url: string) {
      this.url = url;
      this.listeners = {};
      this.close = () => {};
      instances.push(this);
    } as unknown as ListenerRecordingESConstructor;
    FakeES.prototype.addEventListener = function (this: ListenerRecordingES, type: string) {
      this.listeners[type] = true;
    };

    const { node } = createSseNode({ EventSourceImpl: FakeES, ...makeTimers() });
    node.setInputValue('url', 'https://example.test/stream');
    node.setInputValue('transport', 'eventsource');
    node.setInputValue('eventTypes', 'token, tool_call ,');
    node.setInputValue('connect', true);

    expect(Object.keys(instances[0].listeners).sort()).toEqual(['token', 'tool_call']);
    node._onNodeDeleted();
  });
});

describe('net.noodl.SSE — auto connect', () => {
  it('waits for every input to land before connecting', async () => {
    const stream = makeBody();
    const fetchImpl = makeFetch([stream.body]);
    const { node } = createSseNode({ fetchImpl, AbortControllerImpl: makeAbortController(), ...makeTimers() });

    // Auto Connect arrives before the URL, which is the order the editor may write in.
    node.setInputValue('autoConnect', true);
    node.setInputValue('url', 'https://example.test/stream');
    expect(fetchImpl.calls.length).toBe(0);

    node.update();
    expect(fetchImpl.calls.length).toBe(1);
    expect(fetchImpl.calls[0].url).toBe('https://example.test/stream');

    // The deferred callback runs once, not once per input.
    node.update();
    expect(fetchImpl.calls.length).toBe(1);

    node._onNodeDeleted();
  });

  it('stays put when Auto Connect is off', () => {
    const fetchImpl = makeFetch([makeBody().body]);
    const { node, out } = createSseNode({ fetchImpl, AbortControllerImpl: makeAbortController(), ...makeTimers() });
    node.setInputValue('url', 'https://example.test/stream');
    node.update();
    expect(fetchImpl.calls.length).toBe(0);
    expect(out('connectionState')).toBe('idle');
  });
});

describe('net.noodl.SSE — teardown leaves nothing running', () => {
  it('aborts the request and cancels the reader when the node is deleted mid-stream', async () => {
    const stream = makeBody();
    const AbortControllerImpl = makeAbortController();
    const timers = makeTimers();
    const { node, out } = createSseNode({ fetchImpl: makeFetch([stream.body]), AbortControllerImpl, ...timers });

    node.setInputValue('url', 'https://example.test/stream');
    node.setInputValue('connect', true);
    await flush();
    stream.push('data: a\n\n');
    await flush();
    expect(out('messageCount')).toBe(1);

    node._onNodeDeleted();

    expect(AbortControllerImpl.created[0].aborted).toBe(true);
    expect(stream.state.cancelled).toBe(true);
    expect(timers.pending()).toBe(0);

    // Anything still in flight must not reach the graph.
    stream.push('data: b\n\n');
    stream.end();
    await flush();
    expect(out('messageCount')).toBe(0); // the connection is gone, so the counter rests at 0
  });

  it('clears a pending reconnect timer when the node is deleted while reconnecting', async () => {
    const timers = makeTimers();
    const { node } = createSseNode({
      fetchImpl: () => Promise.reject(new Error('down')),
      AbortControllerImpl: makeAbortController(),
      ...timers
    });
    node.setInputValue('url', 'https://example.test/stream');
    node.setInputValue('connect', true);
    await flush();
    expect(timers.pending()).toBe(1);

    node._onNodeDeleted();
    expect(timers.pending()).toBe(0);
  });

  it('leaks nothing across rapid connect/disconnect cycles', async () => {
    const AbortControllerImpl = makeAbortController();
    const timers = makeTimers();
    const bodies = Array.from({ length: 12 }, () => makeBody());
    const fetchImpl = makeFetch(bodies.map((b) => b.body));
    const { node } = createSseNode({ fetchImpl, AbortControllerImpl, ...timers });

    node.setInputValue('url', 'https://example.test/stream');
    for (let i = 0; i < 10; i++) {
      node.setInputValue('connect', false);
      node.setInputValue('connect', true);
      node.setInputValue('disconnect', false);
      node.setInputValue('disconnect', true);
    }
    await flush();

    node._onNodeDeleted();

    expect(AbortControllerImpl.created.length).toBe(10);
    expect(AbortControllerImpl.created.every((c) => c.aborted)).toBe(true);
    expect(timers.pending()).toBe(0);
  });

  it('runs the base Node teardown as well as its own', () => {
    const { node } = createSseNode();
    let baseRan = false;
    node.addDeleteListener(function () {
      baseRan = true;
    });
    node._onNodeDeleted();
    // The delete listeners are Node.prototype's job; forgetting the super call is the
    // classic way a node quietly stops cleaning up its model listeners.
    expect(baseRan).toBe(true);
  });
});
