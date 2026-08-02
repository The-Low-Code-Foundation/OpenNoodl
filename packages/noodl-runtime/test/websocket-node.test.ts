/**
 * WebSocket *node* suite (AGENT-002 / AIX-005).
 *
 * `websocket.test.ts` covers the transport state machine in isolation. This
 * file covers the node shell around it, and does so through the real runtime —
 * `NodeContext`, `defineNode`, real ports, real connections, real signals — so
 * that the things only the shell can get wrong are actually checked:
 *
 * - the published port set (the node's contract with every project that uses it)
 * - auto-connect, and the batching that stops a url and a protocol list
 *   arriving in one frame from opening two sockets
 * - which inputs rebuild the connection and which must not disturb it
 * - `_onNodeDeleted` — the unmount / navigate-away path — leaving nothing behind
 *
 * Signals are observed by wiring the node's outputs to a recorder node with the
 * ordinary `connectInput` API, not by spying on `sendSignalOnOutput`. A signal
 * that the runtime would not actually deliver should not pass here either.
 */

import type { InspectInfo, NodeInstance } from '@noodl/types';

import NodeContext = require('../src/nodecontext');
import NodeDefinition = require('../src/nodedefinition');
import websocketModule = require('../src/nodes/std-library/agent/websocket');
import type {
  WebSocketCloseEventLike,
  WebSocketLike,
  WebSocketMessageEventLike
} from '../src/nodes/std-library/agent/websocket-connection';

/**
 * A node instance as a *test* drives it. `NodeInstance` is the author-facing
 * type and deliberately hides the runtime's internals, but wiring connections
 * and simulating deletion are exactly the internals under test here.
 */
type TestNode = NodeInstance & {
  connectInput(inputName: string, sourceNode: TestNode, sourcePortName: string): void;
  getInspectInfo(): InspectInfo;
  _onNodeDeleted(): void;
};

// ── harness ──────────────────────────────────────────────────────────────────

class FakeSocket implements WebSocketLike {
  static instances: FakeSocket[] = [];

  sent: unknown[] = [];
  closeCalls: { code?: number; reason?: string }[] = [];
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
  close(code?: number, reason?: string): void {
    this.closeCalls.push({ code, reason });
  }
  fireOpen(): void {
    this.onopen && this.onopen({});
  }
  fireMessage(data: unknown): void {
    this.onmessage && this.onmessage({ data });
  }
  fireClose(event: WebSocketCloseEventLike = { code: 1006 }): void {
    this.onclose && this.onclose(event);
  }
  detached(): boolean {
    return !this.onopen && !this.onmessage && !this.onerror && !this.onclose;
  }
}

let liveTimers: Map<number, { fn: () => void; delay: number }>;
let nextTimerHandle: number;

const seams = {
  WebSocketImpl: FakeSocket as unknown as new (url: string, protocols?: string | string[]) => WebSocketLike,
  setTimeoutImpl: (fn: () => void, delay: number) => {
    const handle = nextTimerHandle++;
    liveTimers.set(handle, { fn, delay });
    return handle;
  },
  clearTimeoutImpl: (handle: unknown) => {
    liveTimers.delete(handle as number);
  },
  nowImpl: () => 1_000_000,
  randomImpl: () => 0.5,
  jitter: false
};

/** Fires the single pending timer, which in these tests is always a reconnect. */
function fireOnlyTimer(): void {
  const handles = Array.from(liveTimers.keys());
  if (handles.length !== 1) throw new Error(`expected one pending timer, found ${handles.length}`);
  const timer = liveTimers.get(handles[0]);
  liveTimers.delete(handles[0]);
  timer.fn();
}

/**
 * A sink that records every signal and value the node sends it. Signals are
 * declared with `valueChangedToTrue` so only a genuine rising edge is recorded.
 */
const recorderDefinition = NodeDefinition.defineNode({
  name: 'AGENT002 Recorder',
  category: 'test',
  initialize(this: NodeInstance) {
    this._internal.log = [];
    this._internal.values = {};
  },
  inputs: {
    onOpen: { valueChangedToTrue: recordSignal('onOpen') },
    onMessage: { valueChangedToTrue: recordSignal('onMessage') },
    onMessageSent: { valueChangedToTrue: recordSignal('onMessageSent') },
    onError: { valueChangedToTrue: recordSignal('onError') },
    onClose: { valueChangedToTrue: recordSignal('onClose') },
    onReconnect: { valueChangedToTrue: recordSignal('onReconnect') },
    connectionState: { type: 'string', set: recordValue('connectionState') },
    connected: { type: 'boolean', set: recordValue('connected') },
    lastError: { type: 'string', set: recordValue('lastError') },
    retryCount: { type: 'number', set: recordValue('retryCount') },
    queueSize: { type: 'number', set: recordValue('queueSize') },
    droppedCount: { type: 'number', set: recordValue('droppedCount') },
    received: { type: '*', set: recordValue('received') },
    receivedRaw: { type: 'string', set: recordValue('receivedRaw') },
    receivedIsBinary: { type: 'boolean', set: recordValue('receivedIsBinary') }
  },
  outputs: {}
});

function recordSignal(name: string) {
  return function (this: NodeInstance) {
    (this._internal.log as string[]).push(name);
  };
}

function recordValue(name: string) {
  return function (this: NodeInstance, value: unknown) {
    (this._internal.values as Record<string, unknown>)[name] = value;
  };
}

/** Every output the recorder listens to, so wiring stays in one place. */
const RECORDED_SIGNALS = ['onOpen', 'onMessage', 'onMessageSent', 'onError', 'onClose', 'onReconnect'];
const RECORDED_VALUES = [
  'connectionState',
  'connected',
  'lastError',
  'retryCount',
  'queueSize',
  'droppedCount',
  'received',
  'receivedRaw',
  'receivedIsBinary'
];

interface Fixture {
  context: InstanceType<typeof NodeContext>;
  node: TestNode;
  recorder: TestNode;
  log: string[];
  values: Record<string, unknown>;
  /** Applies queued inputs and runs the graph, as a frame would. */
  update(): void;
  lastSocket(): FakeSocket;
}

function createFixture(): Fixture {
  const context = new NodeContext();
  context.nodeRegister.register(NodeDefinition.defineNode(websocketModule.node));
  context.nodeRegister.register(recorderDefinition);

  const node = context.nodeRegister.createNode('net.noodl.WebSocket', 'ws-1') as unknown as TestNode;
  const recorder = context.nodeRegister.createNode('AGENT002 Recorder', 'rec-1') as unknown as TestNode;

  // The seam has to be in place before the node builds its connection, which
  // for an auto-connecting node happens on the first update.
  (node as TestNode & { _webSocketTestSeams: unknown })._webSocketTestSeams = seams;

  for (const name of RECORDED_SIGNALS.concat(RECORDED_VALUES)) {
    recorder.connectInput(name, node, name);
  }

  const update = () => {
    node.update();
    recorder.update();
  };

  return {
    context,
    node,
    recorder,
    log: recorder._internal.log as string[],
    values: recorder._internal.values as Record<string, unknown>,
    update,
    lastSocket: () => FakeSocket.instances[FakeSocket.instances.length - 1]
  };
}

beforeEach(() => {
  FakeSocket.instances = [];
  liveTimers = new Map();
  nextTimerHandle = 1;
});

// ── the published contract ───────────────────────────────────────────────────

describe('port set', () => {
  const metadata = NodeDefinition.defineNode(websocketModule.node).metadata;

  it('is registered under the name projects will persist', () => {
    expect(metadata.name).toBe('net.noodl.WebSocket');
    expect(metadata.displayNodeName).toBe('WebSocket');
    expect(metadata.category).toBe('Data');
    expect(metadata.color).toBe('data');
  });

  it('publishes exactly the documented inputs', () => {
    // Pinned deliberately: every name here is persisted in project files and in
    // the node catalog, so a rename is a breaking change and should have to be
    // made here on purpose.
    expect(Object.keys(metadata.inputs).sort()).toEqual(
      [
        'autoConnect',
        'autoReconnect',
        'connect',
        'disconnect',
        'heartbeatInterval',
        'heartbeatMessage',
        'heartbeatReply',
        'jitter',
        'maxQueueSize',
        'maxReconnectDelay',
        'maxRetries',
        'message',
        'messageType',
        'protocols',
        'reconnectDelay',
        'send',
        'url',
        'whenDisconnected'
      ].sort()
    );
  });

  it('publishes exactly the documented outputs', () => {
    // ERG-001 §4 added `done` / `unchanged` / `failure` / `completed`. They are pinned here
    // beside the lifecycle signals on purpose: SR-ix's collision is a *silent* one, so the
    // moment `Completed` becomes a reserved name this list is where a clash has to surface.
    expect(Object.keys(metadata.outputs).sort()).toEqual(
      [
        'closeCode',
        'completed',
        'done',
        'failure',
        'unchanged',
        'closeReason',
        'connected',
        'connectionState',
        'droppedCount',
        'lastError',
        'latency',
        'onClose',
        'onError',
        'onMessage',
        'onMessageSent',
        'onOpen',
        'onReconnect',
        'queueSize',
        'received',
        'receivedIsBinary',
        'receivedRaw',
        'retryCount'
      ].sort()
    );
  });

  it('makes the three actions edge-triggered signal inputs', () => {
    for (const name of ['connect', 'disconnect', 'send']) {
      expect(metadata.inputs[name].type).toEqual({ name: 'signal', allowConnectionsOnly: true });
    }
  });

  it('groups ports so the property panel reads as Connection / Actions / Message', () => {
    expect(metadata.inputs.url.group).toBe('Connection');
    expect(metadata.inputs.connect.group).toBe('Actions');
    expect(metadata.inputs.message.group).toBe('Message');
    expect(metadata.outputs.connectionState.group).toBe('Status');
    expect(metadata.outputs.received.group).toBe('Data');
    expect(metadata.outputs.onOpen.group).toBe('Events');
  });

  it('defaults the heartbeat off and the queue on', () => {
    expect(metadata.inputs.heartbeatInterval.default).toBe(0);
    expect(metadata.inputs.whenDisconnected.default).toBe('queue');
    expect(metadata.inputs.maxQueueSize.default).toBe(100);
    expect(metadata.inputs.autoConnect.default).toBe(true);
    expect(metadata.inputs.autoReconnect.default).toBe(true);
    expect(metadata.inputs.maxRetries.default).toBe(10);
  });

  it('is marked client-only for SSR, like Subscribe To Changes', () => {
    expect(metadata.ssr.compat).toBe('client-only');
  });
});

// ── auto-connect ─────────────────────────────────────────────────────────────

describe('auto connect', () => {
  it('opens once a url arrives, and publishes the state on the graph', () => {
    const f = createFixture();
    f.node.queueInput('url', 'wss://example.test/agent');
    f.update();

    expect(FakeSocket.instances).toHaveLength(1);
    expect(f.lastSocket().url).toBe('wss://example.test/agent');
    expect(f.values.connectionState).toBe('connecting');

    f.lastSocket().fireOpen();
    f.update();

    expect(f.values.connectionState).toBe('open');
    expect(f.values.connected).toBe(true);
    expect(f.log).toContain('onOpen');
    expect(f.log).not.toContain('onReconnect');

    f.node._onNodeDeleted();
  });

  it('opens one socket when url and protocols arrive in the same frame', () => {
    // The reason `scheduleRebuild` batches: two setters in one frame are one
    // author action, not two connections.
    const f = createFixture();
    f.node.queueInput('url', 'wss://example.test/agent');
    f.node.queueInput('protocols', 'json, chat.v1');
    f.update();

    expect(FakeSocket.instances).toHaveLength(1);
    expect(f.lastSocket().protocols).toEqual(['json', 'chat.v1']);

    f.node._onNodeDeleted();
  });

  it('stays idle with no url, without complaining', () => {
    // An unconfigured node is not a broken one.
    const f = createFixture();
    f.update();

    expect(FakeSocket.instances).toHaveLength(0);
    expect(f.log).not.toContain('onError');
    expect(f.node.getOutput('connectionState').value).toBe('idle');
  });

  it('waits for the Connect signal when switched off', () => {
    const f = createFixture();
    f.node.queueInput('autoConnect', false);
    f.node.queueInput('url', 'wss://example.test/agent');
    f.update();

    expect(FakeSocket.instances).toHaveLength(0);

    f.node.queueInput('connect', true);
    f.update();

    expect(FakeSocket.instances).toHaveLength(1);
    f.node._onNodeDeleted();
  });
});

// ── actions ──────────────────────────────────────────────────────────────────

describe('actions', () => {
  it('reports a Connect with no url as an error on the graph', () => {
    // Auto-connect with no url is silence; an explicit Connect with no url is a
    // mistake the author needs told about.
    const f = createFixture();
    f.node.queueInput('autoConnect', false);
    f.node.queueInput('connect', true);
    f.update();

    expect(f.log).toContain('onError');
    expect(f.values.connectionState).toBe('error');
    expect(String(f.values.lastError)).toMatch(/URL is required/);
  });

  it('sends the Message input on a Send signal', () => {
    const f = createFixture();
    f.node.queueInput('url', 'wss://example.test/agent');
    f.update();
    f.lastSocket().fireOpen();

    f.node.queueInput('message', { role: 'user', content: 'hi' });
    f.node.queueInput('send', true);
    f.update();

    expect(f.lastSocket().sent).toEqual(['{"role":"user","content":"hi"}']);
    expect(f.log).toContain('onMessageSent');

    f.node._onNodeDeleted();
  });

  it('queues a Send made before the connection is open, then flushes it', () => {
    const f = createFixture();
    f.node.queueInput('autoConnect', false);
    f.node.queueInput('url', 'wss://example.test/agent');
    f.node.queueInput('message', 'early');
    f.node.queueInput('send', true);
    f.update();

    expect(f.values.queueSize).toBe(1);

    f.node.queueInput('connect', true);
    f.update();
    f.lastSocket().fireOpen();
    f.update();

    expect(f.lastSocket().sent).toEqual(['early']);
    expect(f.values.queueSize).toBe(0);

    f.node._onNodeDeleted();
  });

  it('closes on a Disconnect signal and does nothing on a second one', () => {
    const f = createFixture();
    f.node.queueInput('url', 'wss://example.test/agent');
    f.update();
    const socket = f.lastSocket();
    socket.fireOpen();
    f.update();

    f.node.queueInput('disconnect', false);
    f.node.queueInput('disconnect', true);
    f.update();

    expect(f.values.connectionState).toBe('closed');
    expect(socket.detached()).toBe(true);
    expect(f.log.filter((e) => e === 'onClose')).toHaveLength(1);
    expect(liveTimers.size).toBe(0);
  });

  it('does not blow up on a Disconnect before anything was ever connected', () => {
    const f = createFixture();
    f.node.queueInput('disconnect', true);
    expect(() => f.update()).not.toThrow();
    expect(f.log).toHaveLength(0);
  });
});

// ── receiving on the graph ───────────────────────────────────────────────────

describe('receiving', () => {
  it('publishes the parsed value, the raw text and the binary flag', () => {
    const f = createFixture();
    f.node.queueInput('url', 'wss://example.test/agent');
    f.update();
    f.lastSocket().fireOpen();
    f.lastSocket().fireMessage('{"delta":"Hel"}');
    f.update();

    expect(f.values.received).toEqual({ delta: 'Hel' });
    expect(f.values.receivedRaw).toBe('{"delta":"Hel"}');
    expect(f.values.receivedIsBinary).toBe(false);
    expect(f.log).toContain('onMessage');

    f.node._onNodeDeleted();
  });

  it('publishes a binary frame as an ArrayBuffer with the flag set', () => {
    const f = createFixture();
    f.node.queueInput('url', 'wss://example.test/agent');
    f.update();
    f.lastSocket().fireOpen();
    const buffer = new ArrayBuffer(4);
    f.lastSocket().fireMessage(buffer);
    f.update();

    expect(f.values.received).toBe(buffer);
    expect(f.values.receivedIsBinary).toBe(true);

    f.node._onNodeDeleted();
  });
});

// ── reconnection on the graph ────────────────────────────────────────────────

describe('reconnection', () => {
  it('surfaces the outage, the retry count and the recovery', () => {
    const f = createFixture();
    f.node.queueInput('url', 'wss://example.test/agent');
    f.update();
    f.lastSocket().fireOpen();
    f.update();

    f.lastSocket().fireClose({ code: 1006 });
    f.update();

    expect(f.values.connectionState).toBe('reconnecting');
    expect(f.values.connected).toBe(false);
    expect(f.values.retryCount).toBe(1);
    expect(f.log).toContain('onClose');

    fireOnlyTimer();
    f.lastSocket().fireOpen();
    f.update();

    expect(f.values.connectionState).toBe('open');
    expect(f.values.retryCount).toBe(0);
    // The distinct reconnect signal is the app's only cue that it may have
    // missed messages, since a WebSocket has no resume.
    expect(f.log).toContain('onReconnect');

    f.node._onNodeDeleted();
  });

  it('fires On Error when it finally gives up', () => {
    const f = createFixture();
    f.node.queueInput('url', 'wss://example.test/agent');
    f.node.queueInput('maxRetries', 1);
    f.update();
    f.lastSocket().fireOpen();
    f.update();

    f.lastSocket().fireClose({ code: 1006 });
    fireOnlyTimer();
    f.lastSocket().fireClose({ code: 1006 });
    f.update();

    expect(f.values.connectionState).toBe('error');
    expect(String(f.values.lastError)).toMatch(/gave up after 1 reconnect attempts/);
    expect(f.log).toContain('onError');
    expect(liveTimers.size).toBe(0);
  });
});

// ── which inputs rebuild, and which must not ─────────────────────────────────

describe('input changes', () => {
  it('rebuilds the connection when the url changes', () => {
    const f = createFixture();
    f.node.queueInput('url', 'wss://example.test/one');
    f.update();
    const first = f.lastSocket();
    first.fireOpen();
    f.update();

    f.node.queueInput('url', 'wss://example.test/two');
    f.update();

    expect(FakeSocket.instances).toHaveLength(2);
    expect(f.lastSocket().url).toBe('wss://example.test/two');
    // The old session is gone, not re-pointed: its retry count, queue and close
    // code all described a different endpoint.
    expect(first.detached()).toBe(true);
    expect(first.closeCalls.length).toBeGreaterThan(0);

    f.node._onNodeDeleted();
  });

  it('follows the url to the new endpoint even with Auto Connect off', () => {
    // The app said "be connected"; changing where does not mean "stop". Landing
    // silently on idle after a url change is the invisible failure this node is
    // meant to prevent.
    const f = createFixture();
    f.node.queueInput('autoConnect', false);
    f.node.queueInput('url', 'wss://example.test/one');
    f.update();
    f.node.queueInput('connect', true);
    f.update();
    f.lastSocket().fireOpen();
    f.update();

    f.node.queueInput('url', 'wss://example.test/two');
    f.update();

    expect(FakeSocket.instances).toHaveLength(2);
    expect(f.lastSocket().url).toBe('wss://example.test/two');
    expect(f.values.connectionState).toBe('connecting');

    f.node._onNodeDeleted();
  });

  it('does not connect on a url change while deliberately disconnected', () => {
    const f = createFixture();
    f.node.queueInput('autoConnect', false);
    f.node.queueInput('url', 'wss://example.test/one');
    f.update();
    f.node.queueInput('connect', true);
    f.update();
    f.lastSocket().fireOpen();
    f.node.queueInput('disconnect', true);
    f.update();

    f.node.queueInput('url', 'wss://example.test/two');
    f.update();

    expect(FakeSocket.instances).toHaveLength(1);
    expect(f.node.getOutput('connectionState').value).toBe('idle');
  });

  it('leaves the socket alone when only tuning changes', () => {
    const f = createFixture();
    f.node.queueInput('url', 'wss://example.test/agent');
    f.update();
    const socket = f.lastSocket();
    socket.fireOpen();
    f.update();

    f.node.queueInput('reconnectDelay', 250);
    f.node.queueInput('maxRetries', 3);
    f.node.queueInput('whenDisconnected', 'drop');
    f.node.queueInput('messageType', 'text');
    f.node.queueInput('maxQueueSize', 5);
    f.update();

    // Adjusting how the connection behaves must never drop the connection.
    expect(FakeSocket.instances).toHaveLength(1);
    expect(socket.closeCalls).toHaveLength(0);
    expect(f.values.connectionState).toBe('open');

    f.node._onNodeDeleted();
  });

  it('applies the new queue policy immediately', () => {
    const f = createFixture();
    f.node.queueInput('autoConnect', false);
    f.node.queueInput('url', 'wss://example.test/agent');
    f.node.queueInput('whenDisconnected', 'drop');
    f.node.queueInput('message', 'x');
    f.node.queueInput('send', true);
    f.update();

    expect(f.values.queueSize).toBe(0);
    expect(f.values.droppedCount).toBe(1);
  });

  it('starts the heartbeat when it is switched on mid-stream', () => {
    const f = createFixture();
    f.node.queueInput('url', 'wss://example.test/agent');
    f.update();
    const socket = f.lastSocket();
    socket.fireOpen();
    f.update();
    expect(liveTimers.size).toBe(0);

    f.node.queueInput('heartbeatInterval', 15000);
    f.update();

    expect(Array.from(liveTimers.values()).map((t) => t.delay)).toEqual([15000]);

    f.node._onNodeDeleted();
    expect(liveTimers.size).toBe(0);
  });
});

// ── unmount / navigate away ──────────────────────────────────────────────────

describe('node deletion', () => {
  it('closes the socket and clears every timer', () => {
    const f = createFixture();
    f.node.queueInput('url', 'wss://example.test/agent');
    f.node.queueInput('heartbeatInterval', 10000);
    f.update();
    const socket = f.lastSocket();
    socket.fireOpen();
    f.update();
    expect(liveTimers.size).toBe(1);

    f.node._onNodeDeleted();

    expect(socket.closeCalls).toEqual([{ code: 1000, reason: 'Node deleted' }]);
    expect(socket.detached()).toBe(true);
    expect(liveTimers.size).toBe(0);
  });

  it('clears a pending reconnect when the node goes away mid-outage', () => {
    const f = createFixture();
    f.node.queueInput('url', 'wss://example.test/agent');
    f.update();
    f.lastSocket().fireOpen();
    f.lastSocket().fireClose({ code: 1006 });
    expect(liveTimers.size).toBe(1);

    f.node._onNodeDeleted();
    expect(liveTimers.size).toBe(0);
  });

  it('emits nothing after deletion, whatever the socket does', () => {
    const f = createFixture();
    f.node.queueInput('url', 'wss://example.test/agent');
    f.update();
    const socket = f.lastSocket();
    socket.fireOpen();
    f.update();

    const before = f.log.length;
    f.node._onNodeDeleted();
    socket.fireMessage('late');
    socket.fireClose({ code: 1006 });
    f.recorder.update();

    expect(f.log).toHaveLength(before);
    expect(liveTimers.size).toBe(0);
  });

  it('is safe to delete a node that never connected', () => {
    const f = createFixture();
    expect(() => f.node._onNodeDeleted()).not.toThrow();
  });

  it('leaves nothing behind across many mount/unmount cycles', () => {
    // Standing in for a page a user visits repeatedly: each visit builds a node,
    // opens a socket and tears it down. The assertion is on the whole history.
    for (let i = 0; i < 20; i++) {
      const f = createFixture();
      f.node.queueInput('url', 'wss://example.test/agent');
      f.node.queueInput('heartbeatInterval', 5000);
      f.update();
      f.lastSocket().fireOpen();
      f.update();
      f.lastSocket().fireMessage('{"delta":"x"}');
      f.node._onNodeDeleted();
    }

    expect(FakeSocket.instances).toHaveLength(20);
    for (const socket of FakeSocket.instances) {
      expect(socket.closeCalls.length).toBeGreaterThan(0);
      expect(socket.detached()).toBe(true);
    }
    expect(liveTimers.size).toBe(0);
  });
});

// ── inspector ────────────────────────────────────────────────────────────────

describe('getInspectInfo', () => {
  it('says what is wrong before anything is configured', () => {
    const f = createFixture();
    expect(f.node.getInspectInfo()).toEqual({ type: 'text', value: '[No URL set]' });
  });

  it('summarises the live connection', () => {
    const f = createFixture();
    f.node.queueInput('url', 'wss://example.test/agent');
    f.update();
    f.lastSocket().fireOpen();
    f.lastSocket().fireMessage('{"delta":"x"}');

    const info = f.node.getInspectInfo() as { type: string; value: Record<string, unknown> };
    expect(info.type).toBe('value');
    expect(info.value.state).toBe('open');
    expect(info.value.url).toBe('wss://example.test/agent');
    expect(info.value.lastReceived).toEqual({ delta: 'x' });
    expect(info.value.lastError).toBeNull();

    f.node._onNodeDeleted();
  });
});
