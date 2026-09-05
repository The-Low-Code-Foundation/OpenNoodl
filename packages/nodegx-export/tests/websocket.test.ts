import * as fs from 'fs';
import * as path from 'path';

import * as ts from 'typescript';

import { Catalog, CatalogIndex } from '../src/catalog';
import { ComponentPlan, STREAM_NODES, WEBSOCKET_TYPE, planProject } from '../src/analyze/plan';
import { emitApp } from '../src/emit/emitApp';
import { ERRORS_LIB_PATH } from '../src/emit/errorsLib';
import { STREAMING_LIB_PATH } from '../src/emit/streamingLib';
import { WEBSOCKET_LIB_PATH, websocketLibSource } from '../src/emit/websocketLib';
import { exportBadgeOf, ledgerEntryOf } from '../src/ledger';
import { parseProject } from '../src/parse/parseProject';
import { ComponentIR, ConnectionIR, ExportIR, NodeIR, ParamValue } from '../src/ir/types';

/**
 * EXP-011 §65 — `WebSocket` (`net.noodl.WebSocket`), Tier 3.11's second transport.
 *
 * The fifth member of the streaming table (§58, §64): a data port (Message) that only the Send verb carries, the three
 * Actions as verbs, the six Events and the outcome trio as listeners, every Status and Data output a live getter.
 * `src/lib/websocket.ts` transcribes `agent/websocket.ts` (the node: the setters' coercions, the rebuild policy, the
 * outcome tokens) and `websocket-connection.ts` (the connection: reconnection with equal-jitter backoff, the heartbeat
 * with dead-connection detection, the FIFO send queue and its three policies, teardown); it imports `./errors` for the
 * raises and nothing from `./streaming`.
 *
 * Measured before the build (probe-reverted.log, HEAD af752b95): 21 refusals — the node `logic node
 * (net.noodl.WebSocket)`, the four Set Variables `trigger socket.onOpen is not a rendered element event or a receiver`,
 * their four Strings behind them, every wire into or out of the node dropped. The first built emit found the fixture's
 * own shape refused: a text input's `onTextChanged` straight into Message reads `input-text`, legal only inside that
 * input's own onChange (the exporter's standing rule, §3's form idiom) — the fixture writes it through a `message`
 * Variable instead, which is what every other fixture does with a text input (A9 pins the refusal).
 *
 * §A the plan and the emitted page · §B the refused shapes, by mutation · §C the lib's text · §D the pure cores under
 * node · §E the hook under a hook harness with a scripted socket and the runtime's own timer, clock and random seams ·
 * §F the ledger.
 */

const FIXTURE = path.join(__dirname, 'fixtures', 'socket-desk');
const CATALOG_PATH = path.join(__dirname, '..', '..', 'noodl-types', 'src', 'node-catalog.json');
const catalog: Catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
const index = new CatalogIndex(catalog);
const baseIr = parseProject(FIXTURE, catalog);
const app = emitApp(baseIr, catalog);
const project = planProject(baseIr, index);

const HOME = 'Pages/Home';
const HOME_FILE = 'src/pages/Home.tsx';

const cloneIr = (): ExportIR => structuredClone(baseIr);
const componentOf = (source: ExportIR, componentPath: string): ComponentIR => source.components.find((c) => c.path === componentPath)!;
const nodeOf = (source: ExportIR, componentPath: string, id: string): NodeIR => componentOf(source, componentPath).nodes.find((n) => n.id === id)!;
const planOf = (source: ExportIR, componentPath: string): ComponentPlan => planProject(source, index).plans.find((p) => p.path === componentPath)!;
const setParam = (node: NodeIR, name: string, value: ParamValue) => {
  const existing = node.parameters.find((p) => p.name === name);
  if (existing) existing.value = value;
  else {
    node.parameters.push({ name, value });
    node.parameters.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  }
};
const connect = (component: ComponentIR, fromId: string, fromProperty: string, toId: string, toProperty: string, kind: ConnectionIR['kind'] = 'signal') => {
  component.connections.push({ key: `${fromId}:${fromProperty}->${toId}:${toProperty}`, fromId, fromProperty, toId, toProperty, kind });
};
const disconnect = (component: ComponentIR, predicate: (c: ConnectionIR) => boolean) => {
  component.connections = component.connections.filter((c) => !predicate(c));
};
const refusalOf = (source: ExportIR, componentPath: string, id: string) =>
  emitApp(source, catalog).report.components.find((c) => c.path === componentPath)?.refusals?.find((r) => r.nodeId === id);
const sentence = (id: string, mutate: (ir: ExportIR) => void): string | undefined => {
  const ir = cloneIr();
  mutate(ir);
  return refusalOf(ir, HOME, id)?.reason;
};

const HOOK_LINE =
  "  const socket = useWebSocket({ label: 'Socket', nodeId: 'socket', componentName: '/Pages/Home' }, { url: 'ws://localhost:8583/' }, {\n" +
  "    onOpen: () => status.set('open'),\n" +
  "    onClose: () => status.set('closed'),\n" +
  "    onReconnect: () => status.set('reconnected'),\n" +
  "    failure: () => status.set('failed')\n" +
  '  });';

// ---------------------------------------------------------------------------------------------------
describe('§A the plan and the emitted page — the fifth member of the streaming table', () => {
  const page = app.files[HOME_FILE];
  const home = project.plans.find((p) => p.path === HOME)!;

  test('A1 the fixture translates whole: 0 refusals, the shell note alone, the node collapsed into the file; websocket.ts + errors.ts shipped, streaming.ts NOT', () => {
    const report = app.report.components.find((c) => c.path === HOME)!;
    expect(report.refusals ?? []).toEqual([]);
    expect(app.notes.filter((n) => n.startsWith('Pages/Home'))).toEqual([]);
    expect(home.dispositions['socket']).toEqual({ kind: 'collapsed', into: HOME_FILE });
    expect(Object.keys(app.files).sort()).toEqual(expect.arrayContaining([WEBSOCKET_LIB_PATH, ERRORS_LIB_PATH, HOME_FILE, 'src/stores/variables.ts']));
    expect(app.files[STREAMING_LIB_PATH]).toBeUndefined();
  });

  test('A2 the plan: one stream of kind websocket, the Message a store read (its data), the URL its one config, the four listeners in declaration order', () => {
    const socket = home.streams.find((s) => s.nodeId === 'socket')!;
    expect(socket).toMatchObject({ type: WEBSOCKET_TYPE, kind: 'websocket', label: 'Socket', local: 'socket' });
    expect(socket.data).toEqual({ kind: 'store-get', variableName: 'message' });
    expect(socket.config).toEqual([{ port: 'url', expr: { kind: 'literal', value: 'ws://localhost:8583/' } }]);
    expect(Object.keys(socket.listeners)).toEqual(['onOpen', 'onClose', 'onReconnect', 'failure']);
    expect(socket.listeners.onReconnect).toEqual([{ kind: 'store-set', variableName: 'status', expr: { kind: 'literal', value: 'reconnected' } }]);
    expect(socket.comment).toBe('Socket — a WebSocket (websocket.ts), hosted by websocket.ts; its value outputs read live off the handle.');
  });

  test('A3 the page: one import line from ../lib/websocket and none from ../lib/streaming, the hook line with the listeners in declaration order', () => {
    expect(page).toContain("import { useWebSocket } from '../lib/websocket';");
    expect(page).not.toContain("from '../lib/streaming'");
    expect(page).toContain('  // Socket — a WebSocket (websocket.ts), hosted by websocket.ts; its value outputs read live off the handle.\n' + HOOK_LINE);
  });

  test('A4 the three Actions are verbs on the handle — Send carries the Message read AT the pulse; every Status/Data read casts by its DECLARED type', () => {
    expect(page).toContain('<button onClick={() => socket.connect()}>Connect</button>');
    expect(page).toContain('<button onClick={() => socket.disconnect()}>Stop</button>');
    expect(page).toContain('<button onClick={() => socket.send(message.get())}>Send</button>');
    expect(page).toContain('<input placeholder="Message" onChange={(event) => message.set(event.target.value)} />');
    expect(page).toContain('<p className={styles.text}>{socket.connectionState}</p>');
    expect(page).toContain('<p className={styles.text}>{String(socket.connected)}</p>');
    expect(page).toContain('<p className={styles.text}>{String(socket.queueSize)}</p>');
    // `received` is `*` on the node and undefined before the first message — the unknown cast with the blank fallback.
    expect(page).toContain("<p className={styles.text}>{String(socket.received ?? '')}</p>");
    expect(page).toContain('<p className={styles.text}>{socket.receivedRaw}</p>');
    expect(page).toContain('<p className={styles.text}>{socket.lastError}</p>');
    expect(page).toContain('<p className={styles.text}>{statusValue}</p>');
    // Nothing of the node prints anywhere else: no useEffect for it, no state row, no store of its own.
    expect(page).not.toContain('useEffect');
    expect(page).not.toContain('useState');
  });

  test('A5 the table row is the catalog’s port set for net.noodl.WebSocket: 1 data + 14 config + 3 actions in, 10 signals + 12 values out', () => {
    const spec = STREAM_NODES[WEBSOCKET_TYPE];
    const node = catalog.nodes.find((n) => n.typeName === WEBSOCKET_TYPE)!;
    expect(spec.data).toEqual({ port: 'message', displayName: 'Message' });
    expect(spec.config).toHaveLength(14);
    expect([spec.data!.port, ...spec.config.map((c) => c.port), ...Object.keys(spec.actions)].sort()).toEqual((node.inputs ?? []).map((p) => p.name).sort());
    expect([...spec.signals, ...Object.keys(spec.values)].sort()).toEqual((node.outputs ?? []).map((p) => p.name).sort());
    expect(spec.signals).toEqual(['onOpen', 'onMessage', 'onMessageSent', 'onError', 'onClose', 'onReconnect', 'done', 'completed', 'unchanged', 'failure']);
    expect(spec.actions).toEqual({ connect: { verb: 'connect', takesData: false }, disconnect: { verb: 'disconnect', takesData: false }, send: { verb: 'send', takesData: true } });
    expect(spec.values.received).toEqual({ tsType: 'unknown', cast: 'unknown', maybeUndefined: true });
    expect(spec.values.connected.cast).toBe('boolean');
    expect(spec.values.closeCode.cast).toBe('number');
    expect(spec.lib).toBe('websocket');
  });

  test('A6 a wired config port reads at render: a Variable into URL prints its render local; a String into Protocols prints the literal', () => {
    const ir = cloneIr();
    const home2 = componentOf(ir, HOME);
    connect(home2, 'statusVar', 'value', 'socket', 'url', 'value');
    connect(home2, 'openStr', 'savedValue', 'socket', 'protocols', 'value');
    const out = emitApp(ir, catalog).files[HOME_FILE];
    expect(refusalOf(ir, HOME, 'socket')).toBeUndefined();
    expect(out).toContain("{ url: statusValue, protocols: 'open' }");
  });

  test('A7 booleans, numbers and enums authored on disk print as literals, in the table’s order', () => {
    const ir = cloneIr();
    setParam(nodeOf(ir, HOME, 'socket'), 'whenDisconnected', { kind: 'literal', value: 'drop' });
    setParam(nodeOf(ir, HOME, 'socket'), 'autoConnect', { kind: 'literal', value: false });
    setParam(nodeOf(ir, HOME, 'socket'), 'heartbeatInterval', { kind: 'literal', value: 5000 });
    const out = emitApp(ir, catalog).files[HOME_FILE];
    expect(out).toContain("{ url: 'ws://localhost:8583/', autoConnect: false, heartbeatInterval: 5000, whenDisconnected: 'drop' }");
  });

  test('A8 a Message authored on disk prints as the literal; no Message at all is a bare send() — the runtime’s "Nothing to send" at the pulse', () => {
    const ir = cloneIr();
    disconnect(componentOf(ir, HOME), (c) => c.toId === 'socket' && c.toProperty === 'message');
    setParam(nodeOf(ir, HOME, 'socket'), 'message', { kind: 'literal', value: 'hello' });
    expect(emitApp(ir, catalog).files[HOME_FILE]).toContain("<button onClick={() => socket.send('hello')}>Send</button>");
    const bare = cloneIr();
    disconnect(componentOf(bare, HOME), (c) => c.toId === 'socket' && c.toProperty === 'message');
    expect(emitApp(bare, catalog).files[HOME_FILE]).toContain('<button onClick={() => socket.send()}>Send</button>');
    expect(refusalOf(bare, HOME, 'socket')).toBeUndefined();
  });

  test('A9 the finding: a text input’s onTextChanged straight into Message is refused — input-text is legal only in that input’s own onChange', () => {
    expect(
      sentence('socket', (ir) => {
        disconnect(componentOf(ir, HOME), (c) => c.fromId === 'messageVar' || c.toId === 'messageVar');
        connect(componentOf(ir, HOME), 'msgInput', 'onTextChanged', 'socket', 'message', 'value');
      })
    ).toBe('its Message input reads a value that only exists inside a handler');
  });
});

// ---------------------------------------------------------------------------------------------------
describe('§B the refused shapes, by mutation — each sentence exact', () => {
  test('B1 two wires into one input', () => {
    expect(
      sentence('socket', (ir) => {
        connect(componentOf(ir, HOME), 'openStr', 'savedValue', 'socket', 'url', 'value');
        connect(componentOf(ir, HOME), 'closedStr', 'savedValue', 'socket', 'url', 'value');
      })
    ).toBe('two wires feed its URL input — last-writer-wins is not statically ordered');
  });

  test('B2 a signal output consumed as a value', () => {
    expect(
      sentence('socket', (ir) => {
        disconnect(componentOf(ir, HOME), (c) => c.toId === 'queueText');
        connect(componentOf(ir, HOME), 'socket', 'onMessageSent', 'queueText', 'text', 'value');
      })
    ).toBe('its onMessageSent output is consumed as a value — a pulse carries nothing to read');
  });

  test('B3 an input the node has not got', () => {
    expect(sentence('socket', (ir) => connect(componentOf(ir, HOME), 'connectBtn', 'onClick', 'socket', 'bogus'))).toBe('its bogus input is not a port this node has');
  });

  test('B4 an output the node has not got', () => {
    expect(sentence('socket', (ir) => connect(componentOf(ir, HOME), 'socket', 'bogus', 'errorText', 'text', 'value'))).toBe(
      'its bogus output is consumed, and this node has no such port'
    );
  });

  test('B5 the cascade when the node is refused: the Set Variables behind its Events, the three buttons’ wires dropped, no hook, no lib', () => {
    const ir = cloneIr();
    connect(componentOf(ir, HOME), 'connectBtn', 'onClick', 'socket', 'bogus');
    const out = emitApp(ir, catalog);
    const report = out.report.components.find((c) => c.path === HOME)!;
    const reasons = Object.fromEntries((report.refusals ?? []).map((r) => [r.nodeId, r.reason]));
    expect(reasons.socket).toBe('its bogus input is not a port this node has');
    // With the node in the table its refusal is memoised, and the Set Variables behind its Events fall to the generic
    // logic-node sentence rather than the reverted arm's "trigger … is not a rendered element event" (§64.4's trap).
    expect(reasons.setOpen).toBe('logic node (Set Variable)');
    expect(reasons.setReconnected).toBe('logic node (Set Variable)');
    expect(JSON.stringify(report.refusals!.find((r) => r.nodeId === 'setOpen'))).toContain('socket');
    expect(out.notes.filter((n) => n.includes('sendBtn:onClick->socket:send'))).toHaveLength(1);
    expect(out.files[HOME_FILE]).not.toContain('useWebSocket');
    expect(out.files[HOME_FILE]).toContain('<button>Send</button>');
    expect(out.files[WEBSOCKET_LIB_PATH]).toBeUndefined();
  });

  test('B6 a component with no file cannot host it', () => {
    const ir = cloneIr();
    const home = componentOf(ir, HOME);
    home.nodes = home.nodes.filter((n) => n.id === 'socket');
    home.connections = [];
    const plan = planOf(ir, HOME);
    expect(plan.dispositions['socket']).toEqual({ kind: 'deferred', to: 'EXP-003', reason: 'component emits no file to host the WebSocket' });
  });
});

// ---------------------------------------------------------------------------------------------------
describe("§C the lib's text — src/lib/websocket.ts, shipped and transcribed", () => {
  const lib = app.files[WEBSOCKET_LIB_PATH];

  test('C1 shipped with the generated header; imports ./errors (shipped) and nothing from ./streaming (not shipped)', () => {
    expect(lib.startsWith('// @nodegx:generated')).toBe(true);
    expect(lib).toContain("import { raiseAppError } from './errors';");
    expect(lib).not.toContain("from './streaming'");
    expect(lib).toBe('// @nodegx:generated (api module — provenance markers complete in EXP-007)\n' + websocketLibSource());
    expect(app.files[ERRORS_LIB_PATH]).toBeDefined();
    expect(app.files[STREAMING_LIB_PATH]).toBeUndefined();
  });

  test('C2 the transcription pins: the scheme check, the fatal codes, the equal jitter, the flush after On Open, the outcome order, the codes, the raise', () => {
    expect(lib).toContain("if (!/^wss?:\\/\\//i.test(url)) {");
    expect(lib).toContain('const FATAL_CLOSE_CODES = [1002, 1003, 1007, 1008, 1009, 1010, 1015];');
    expect(lib).toContain('return Math.round(raw * (0.5 + 0.5 * random()));');
    expect(lib).toContain("    this._invoke(() => this._callbacks.onOpen && this._callbacks.onOpen(isReconnect));\n\n    this._startHeartbeat();\n");
    expect(lib).toContain("      if (isReconnect) s.latest.listeners.onReconnect?.();\n");
    expect(lib).toContain("      settleConnect(s, 'done');\n");
    expect(lib).toContain("  s.latest.listeners[outcome]?.();\n  s.latest.listeners.completed?.();");
    expect(lib).toContain("export const WS_ERROR_CONNECT_FAILED = 'websocket/connect-failed';");
    expect(lib).toContain("export const WS_ERROR_NOTHING_TO_SEND = 'websocket/nothing-to-send';");
    expect(lib).toContain("nodeType: 'net.noodl.WebSocket'");
    expect(lib).toContain("this._teardownSocket(1000, 'Client disconnect');");
    expect(lib).toContain("this._teardownSocket(1000, 'Node deleted');");
    // The emitted app's tsconfig is stricter than the runtime's: the seam read is `?? null`, not a bare ternary arm (§64.4).
    expect(lib).toContain("      'WebSocketImpl' in options\n        ? (options.WebSocketImpl ?? null)\n");
  });

  test('C3 a WebSocket beside a Text Accumulator ships both modules, two import lines, the socket’s Received Raw read at the accumulator’s pulse', () => {
    const ir = cloneIr();
    const home = componentOf(ir, HOME);
    home.nodes.push({ id: 'acc', type: 'net.noodl.TextAccumulator', label: 'Log', authoredLabel: 'Log', parameters: [], declaredPorts: [], children: [], visual: false } as unknown as NodeIR);
    connect(home, 'socket', 'receivedRaw', 'acc', 'chunk', 'value');
    connect(home, 'socket', 'onMessage', 'acc', 'add');
    const out = emitApp(ir, catalog);
    expect(refusalOf(ir, HOME, 'socket')).toBeUndefined();
    expect(refusalOf(ir, HOME, 'acc')).toBeUndefined();
    expect(out.files[WEBSOCKET_LIB_PATH]).toBeDefined();
    expect(out.files[STREAMING_LIB_PATH]).toBeDefined();
    expect(out.files[HOME_FILE]).toContain("import { useTextAccumulator } from '../lib/streaming';");
    expect(out.files[HOME_FILE]).toContain("import { useWebSocket } from '../lib/websocket';");
    expect(out.files[HOME_FILE]).toContain('    onMessage: () => log.add(socket.receivedRaw),');
  });

  test("C4 the trio's and the SSE's fixtures are unchanged by §65: neither ships websocket.ts", () => {
    for (const name of ['stream-desk', 'token-desk']) {
      const other = emitApp(parseProject(path.join(__dirname, 'fixtures', name), catalog), catalog);
      expect(other.files[WEBSOCKET_LIB_PATH]).toBeUndefined();
      expect(other.files['src/pages/Home.tsx']).not.toContain('useWebSocket');
    }
  });
});

// ---------------------------------------------------------------------------------------------------
// §D / §E — the lib under node. The trio spec's hook harness; `./errors` a recording stub.
// ---------------------------------------------------------------------------------------------------
type AppError = { code: string; message: string; nodeId: string; nodeType: string; componentName: string; detail?: unknown };
type Source = { label: string; nodeId: string; componentName: string };
type Handle = {
  connect(): void;
  disconnect(): void;
  send(message?: unknown): void;
  readonly connectionState: string;
  readonly connected: boolean;
  readonly retryCount: number;
  readonly lastError: string;
  readonly queueSize: number;
  readonly droppedCount: number;
  readonly latency: number;
  readonly closeCode: number;
  readonly closeReason: string;
  readonly received: unknown;
  readonly receivedRaw: string;
  readonly receivedIsBinary: boolean;
};
type Lib = {
  nextReconnectDelay: (attempt: number, base: number, max: number, jitter: boolean, random: () => number) => number;
  isFatalCloseCode: (code: number) => boolean;
  parseProtocols: (value: unknown) => string[];
  identityChanged: (built: Record<string, unknown>, wanted: Record<string, unknown>) => boolean;
  WebSocketConnection: new (options?: Record<string, unknown>) => { state: string; lastError: string; connect(): void; send(v: unknown): { kind: string; code?: string }; peekQueue(): unknown[]; droppedCount: number };
  DEFAULT_MAX_RETRIES: number;
  useWebSocket: (source: Source, options?: Record<string, unknown>, on?: Record<string, () => void>, env?: Record<string, unknown>) => Handle;
};
interface Harness {
  React: {
    useRef: (v: unknown) => { current: unknown };
    useReducer: (r: (s: any, a: any) => any, init: any) => [any, (a: any) => void];
    useEffect: (fn: () => void | (() => void), deps?: unknown[]) => void;
    useLayoutEffect: (fn: () => void | (() => void), deps?: unknown[]) => void;
  };
  render<T>(component: () => T): T;
  unmount(): void;
  renders: number;
  publishes: number;
}
function makeHarness(): Harness {
  const slots: any[] = [];
  const effects: Array<{ deps?: unknown[]; cleanup?: () => void }> = [];
  let cursor = 0;
  let pendingEffects: Array<{ slot: number; fn: () => void | (() => void); deps?: unknown[] }> = [];
  let dirty = false;
  const same = (a?: unknown[], b?: unknown[]) => a !== undefined && b !== undefined && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const useEffect = (fn: () => void | (() => void), deps?: unknown[]) => {
    const i = cursor++;
    pendingEffects.push({ slot: i, fn, deps });
  };
  const harness: Harness = {
    renders: 0,
    publishes: 0,
    React: {
      useRef: (v) => {
        const i = cursor++;
        if (slots[i] === undefined) slots[i] = { current: v };
        return slots[i];
      },
      useReducer: (r, init) => {
        const i = cursor++;
        if (slots[i] === undefined) slots[i] = { state: init };
        const slot = slots[i];
        return [
          slot.state,
          (a: any) => {
            slot.state = r(slot.state, a);
            harness.publishes++;
            dirty = true;
          }
        ];
      },
      useEffect,
      useLayoutEffect: useEffect
    },
    render<T>(component: () => T): T {
      let out!: T;
      do {
        dirty = false;
        cursor = 0;
        pendingEffects = [];
        harness.renders++;
        out = component();
        for (const e of pendingEffects) {
          const prev = effects[e.slot];
          if (prev !== undefined && same(prev.deps, e.deps)) continue;
          prev?.cleanup?.();
          const cleanup = e.fn();
          effects[e.slot] = { deps: e.deps, cleanup: typeof cleanup === 'function' ? cleanup : undefined };
        }
      } while (dirty);
      return out;
    },
    unmount() {
      for (const e of effects) e?.cleanup?.();
    }
  };
  return harness;
}
const compile = (source: string, requireImpl: (name: string) => unknown): any => {
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const module = { exports: {} as any };
  // eslint-disable-next-line no-new-func
  new Function('require', 'module', 'exports', js)(requireImpl, module, module.exports);
  return module.exports;
};
const loadLib = (): { lib: Lib; harness: Harness; raised: AppError[] } => {
  const harness = makeHarness();
  const raised: AppError[] = [];
  const errors = { raiseAppError: (error: AppError) => raised.push(error) };
  const lib = compile(websocketLibSource(), (name) => {
    if (name === 'react') return harness.React;
    if (name === './errors') return errors;
    throw new Error(`unexpected import ${name}`);
  });
  return { lib, harness, raised };
};
const SRC: Source = { label: 'Socket', nodeId: 'socket', componentName: '/Pages/Home' };

/** The runtime's own fake: a WebSocket that records what it was given and fires what the test says. */
class FakeSocket {
  static instances: FakeSocket[] = [];
  sent: unknown[] = [];
  closeCalls: Array<{ code?: number; reason?: string }> = [];
  binaryType = 'blob';
  onopen: ((event?: unknown) => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: ((event?: unknown) => void) | null = null;
  onclose: ((event?: { code?: number; reason?: string; wasClean?: boolean }) => void) | null = null;
  constructor(
    public url: string,
    public protocols?: string | string[]
  ) {
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
  fireError(): void {
    this.onerror && this.onerror({});
  }
  fireClose(event: { code?: number; reason?: string; wasClean?: boolean } = { code: 1006 }): void {
    this.onclose && this.onclose(event);
  }
  detached(): boolean {
    return !this.onopen && !this.onmessage && !this.onerror && !this.onclose;
  }
}

/** The runtime's timer + clock + random seams: timers collected and fired by hand, the clock advanced by the test, the jitter pinned at 1. */
function makeSeams() {
  const timers: Array<{ fn: () => void; ms: number; cleared: boolean }> = [];
  const clock = { now: 1700000000000 };
  return {
    timers,
    clock,
    env: {
      WebSocketImpl: FakeSocket,
      setTimeoutImpl: (fn: () => void, ms: number) => {
        timers.push({ fn, ms, cleared: false });
        return timers.length;
      },
      clearTimeoutImpl: (h: unknown) => {
        timers[(h as number) - 1].cleared = true;
      },
      nowImpl: () => clock.now,
      randomImpl: () => 1
    },
    fire(i: number) {
      const t = timers[i];
      if (t.cleared) return;
      t.cleared = true;
      t.fn();
    },
    pending: () => timers.filter((t) => !t.cleared).map((t) => t.ms)
  };
}

describe('§D the pure cores run the way websocket-connection.ts and websocket.ts do (under node)', () => {
  const { lib } = loadLib();

  test('D1 nextReconnectDelay doubles from the base to the ceiling; jitter scales into the upper half; non-positive base/max take the defaults; the exponent is clamped', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map((n) => lib.nextReconnectDelay(n, 1000, 30000, false, () => 0))).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000]);
    expect(lib.nextReconnectDelay(0, 1000, 30000, true, () => 0)).toBe(500);
    expect(lib.nextReconnectDelay(0, 1000, 30000, true, () => 1)).toBe(1000);
    expect(lib.nextReconnectDelay(0, 1000, 30000, true, () => 0.5)).toBe(750);
    expect(lib.nextReconnectDelay(0, 0, 0, false, () => 0)).toBe(1000);
    expect(lib.nextReconnectDelay(3, -5, -5, false, () => 0)).toBe(8000);
    expect(lib.nextReconnectDelay(2000, 1, 1e12, false, () => 0)).toBe(1073741824);
  });

  test('D2 isFatalCloseCode: protocol and policy failures are unretryable; normal, abnormal, server-error and application codes are not', () => {
    expect([1002, 1003, 1007, 1008, 1009, 1010, 1015].every((c) => lib.isFatalCloseCode(c))).toBe(true);
    expect([1000, 1001, 1005, 1006, 1011, 1012, 1013, 4000, 4999].some((c) => lib.isFatalCloseCode(c))).toBe(false);
  });

  test('D3 parseProtocols: a comma list trimmed and emptied; anything but a non-blank string is none', () => {
    expect(lib.parseProtocols('json, chat.v1 ,,')).toEqual(['json', 'chat.v1']);
    expect(lib.parseProtocols('   ')).toEqual([]);
    expect(lib.parseProtocols(undefined)).toEqual([]);
    expect(lib.parseProtocols(['json'])).toEqual([]);
  });

  test('D4 identityChanged: URL and the protocol list count, in order; tuning does not; an absent URL is the empty one', () => {
    expect(lib.identityChanged({ url: 'ws://a' }, { url: 'ws://a', reconnectDelay: 5 })).toBe(false);
    expect(lib.identityChanged({ url: 'ws://a' }, { url: 'ws://b' })).toBe(true);
    expect(lib.identityChanged({ url: 'ws://a', protocols: ['x', 'y'] }, { url: 'ws://a', protocols: ['y', 'x'] })).toBe(true);
    expect(lib.identityChanged({ url: 'ws://a', protocols: ['x'] }, { url: 'ws://a', protocols: ['x'] })).toBe(false);
    expect(lib.identityChanged({}, { url: '' })).toBe(false);
  });

  test('D5 the connection alone: no WebSocket in the environment is a terminal error, not a throw; a disposed-free send with nothing is refused by code', () => {
    const c = new lib.WebSocketConnection({ url: 'ws://x', WebSocketImpl: null });
    c.connect();
    expect([c.state, c.lastError]).toEqual(['error', 'WebSocket is not available in this environment']);
    expect(c.send(undefined)).toMatchObject({ kind: 'failed', code: 'websocket/nothing-to-send' });
    expect(c.send('queued')).toEqual({ kind: 'queued' });
    expect(c.peekQueue()).toEqual(['queued']);
    expect(lib.DEFAULT_MAX_RETRIES).toBe(10);
  });
});

describe('§E the hook under the harness — the connection, the listeners in order, the live getters, the outcomes, the raises', () => {
  const ALL = ['onOpen', 'onMessage', 'onMessageSent', 'onError', 'onClose', 'onReconnect', 'done', 'completed', 'unchanged', 'failure'];
  const mount = (options: Record<string, unknown>, listenerNames: string[] = ALL) => {
    const { lib, harness, raised } = loadLib();
    const seams = makeSeams();
    FakeSocket.instances = [];
    const log: string[] = [];
    const current = { options };
    let handle!: Handle;
    const listeners = Object.fromEntries(listenerNames.map((name) => [name, () => log.push(name === 'onMessage' ? `onMessage:${handle.receivedRaw}` : name)]));
    const env = { ...seams.env };
    const render = () => harness.render(() => (handle = lib.useWebSocket(SRC, current.options, listeners, env)));
    render();
    return { lib, harness, raised, seams, log, current, render, handle: () => handle, socket: (i = -1) => FakeSocket.instances.at(i)!, sockets: () => FakeSocket.instances.length };
  };

  test('E1 Auto Connect is the default: a URL alone opens at mount with NO outcome; open ⇒ onOpen; a JSON text, a plain text and a binary frame land in Received / Raw / Is Binary before onMessage', () => {
    const m = mount({ url: 'ws://x/chat' });
    const h = m.handle();
    expect(m.sockets()).toBe(1);
    expect([m.socket().url, m.socket().protocols, m.socket().binaryType]).toEqual(['ws://x/chat', undefined, 'arraybuffer']);
    expect([h.connectionState, h.connected, h.retryCount, h.lastError, h.queueSize, h.droppedCount, h.latency, h.closeCode, h.closeReason, h.received, h.receivedRaw, h.receivedIsBinary]).toEqual([
      'connecting', false, 0, '', 0, 0, 0, 0, '', undefined, '', false
    ]);
    expect(m.log).toEqual([]);
    m.socket().fireOpen();
    expect([h.connectionState, h.connected]).toEqual(['open', true]);
    // The mount path minted no token: On Open, and no Done.
    expect(m.log).toEqual(['onOpen']);
    m.socket().fireMessage('{"kind":"hello","n":1}');
    expect(m.log.slice(1)).toEqual(['onMessage:{"kind":"hello","n":1}']);
    expect([h.received, h.receivedRaw, h.receivedIsBinary]).toEqual([{ kind: 'hello', n: 1 }, '{"kind":"hello","n":1}', false]);
    m.socket().fireMessage('plain text');
    expect([h.received, h.receivedRaw]).toEqual(['plain text', 'plain text']);
    const buffer = new ArrayBuffer(3);
    m.socket().fireMessage(buffer);
    expect([h.received, h.receivedRaw, h.receivedIsBinary]).toEqual([buffer, '', true]);
    expect(m.log).toHaveLength(4);
    expect(m.raised).toEqual([]);
    expect(m.harness.publishes).toBeGreaterThanOrEqual(4);
  });

  test('E2 Auto Connect off: idle at mount, no socket; Connect ⇒ connecting, the protocols parsed; open ⇒ onOpen, done, completed; a Connect while open replaces the socket without On Close', () => {
    const m = mount({ url: 'ws://x/chat', autoConnect: false, protocols: 'json, chat.v1' });
    expect(m.sockets()).toBe(0);
    expect(m.handle().connectionState).toBe('idle');
    m.handle().connect();
    expect(m.sockets()).toBe(1);
    expect(m.socket().protocols).toEqual(['json', 'chat.v1']);
    expect(m.handle().connectionState).toBe('connecting');
    expect(m.log).toEqual([]);
    m.socket().fireOpen();
    expect(m.log).toEqual(['onOpen', 'done', 'completed']);
    m.handle().connect();
    expect(m.sockets()).toBe(2);
    expect(m.socket(0).closeCalls).toEqual([{ code: undefined, reason: undefined }]);
    expect(m.socket(0).detached()).toBe(true);
    expect(m.log).toEqual(['onOpen', 'done', 'completed']);
    m.socket(1).fireOpen();
    // ⚠️ The replacement rides the SAME connection object, whose `_hasEverOpened` is already true — so its open IS an
    // On Reconnect ("every open after the first"), as the runtime's is; only a rebuild (a new connection) starts afresh.
    expect(m.log).toEqual(['onOpen', 'done', 'completed', 'onOpen', 'onReconnect', 'done', 'completed']);
    // The replaced socket's late events reach nobody.
    m.socket(0).fireMessage('late');
    expect(m.handle().received).toBeUndefined();
  });

  test('E3 Send: a string as text, an object as JSON, a buffer as-is, Binary encodes UTF-8 — each onMessageSent, done, completed; an empty Message is a refused Send: On Error, then Failure raising websocket/nothing-to-send', () => {
    const m = mount({ url: 'ws://x/chat' });
    m.socket().fireOpen();
    m.log.length = 0;
    m.handle().send('hi');
    expect(m.socket().sent).toEqual(['hi']);
    expect(m.log).toEqual(['onMessageSent', 'done', 'completed']);
    m.handle().send({ a: 1 });
    expect(m.socket().sent[1]).toBe('{"a":1}');
    const buffer = new Uint8Array([1, 2, 3]);
    m.handle().send(buffer);
    expect(m.socket().sent[2]).toBe(buffer);
    m.handle().send(42);
    expect(m.socket().sent[3]).toBe('42');
    m.log.length = 0;
    m.handle().send(undefined);
    expect(m.log).toEqual(['onError', 'failure', 'completed']);
    expect(m.handle().lastError).toBe('Nothing to send: the Message input is empty');
    expect(m.raised).toEqual([{ code: 'websocket/nothing-to-send', message: 'Nothing to send: the Message input is empty', nodeId: 'socket', nodeType: 'net.noodl.WebSocket', componentName: '/Pages/Home' }]);
    expect(m.socket().sent).toHaveLength(4);

    const b = mount({ url: 'ws://x/bin', messageType: 'binary' });
    b.socket().fireOpen();
    b.handle().send('hé');
    expect(b.socket().sent[0]).toEqual(new TextEncoder().encode('hé'));
  });

  test('E4 the queue: a Send before open is Done (owed) and flushed after On Open in order; Drop is Unchanged and counted; Report Error is a Failure; a full queue refuses the newest', () => {
    const m = mount({ url: 'ws://x/q', autoConnect: false });
    m.handle().send('first');
    m.handle().send('second');
    expect(m.log).toEqual(['done', 'completed', 'done', 'completed']);
    expect([m.handle().queueSize, m.handle().droppedCount, m.handle().connectionState]).toEqual([2, 0, 'idle']);
    m.handle().connect();
    m.socket().fireOpen();
    // The Connect settles Done before the backlog goes out, and each flushed message fires On Message Sent.
    expect(m.log.slice(4)).toEqual(['onOpen', 'done', 'completed', 'onMessageSent', 'onMessageSent']);
    expect(m.socket().sent).toEqual(['first', 'second']);
    expect(m.handle().queueSize).toBe(0);

    const d = mount({ url: 'ws://x/q', autoConnect: false, whenDisconnected: 'drop' });
    d.handle().send('gone');
    expect(d.log).toEqual(['unchanged', 'completed']);
    expect([d.handle().droppedCount, d.handle().queueSize, d.handle().lastError]).toEqual([1, 0, '']);
    expect(d.raised).toEqual([]);

    const e = mount({ url: 'ws://x/q', autoConnect: false, whenDisconnected: 'error' });
    e.handle().send('refused');
    expect(e.log).toEqual(['onError', 'failure', 'completed']);
    expect(e.handle().lastError).toBe('Cannot send: the connection is not open (state: idle)');
    expect(e.raised.map((r) => r.code)).toEqual(['websocket/not-connected']);
    expect(e.handle().droppedCount).toBe(1);

    const f = mount({ url: 'ws://x/q', autoConnect: false, maxQueueSize: 1 });
    f.handle().send('kept');
    f.handle().send('too many');
    expect(f.log).toEqual(['done', 'completed', 'onError', 'failure', 'completed']);
    expect(f.handle().lastError).toBe('Send queue is full (1 messages); this message was dropped');
    expect(f.raised.map((r) => r.code)).toEqual(['websocket/queue-full']);
    expect([f.handle().queueSize, f.handle().droppedCount]).toEqual([1, 1]);
  });

  test('E5 Disconnect while open: closed, On Close, done + completed, the socket closed 1000 "Client disconnect"; again: unchanged + completed and no second On Close; with nothing ever built: unchanged, still idle', () => {
    const m = mount({ url: 'ws://x/chat' });
    m.socket().fireOpen();
    m.log.length = 0;
    m.handle().disconnect();
    expect(m.log).toEqual(['onClose', 'done', 'completed']);
    expect([m.handle().connectionState, m.handle().connected, m.handle().closeCode, m.handle().closeReason]).toEqual(['closed', false, 1000, 'Client disconnect']);
    expect(m.socket().closeCalls).toEqual([{ code: 1000, reason: 'Client disconnect' }]);
    m.log.length = 0;
    m.handle().disconnect();
    expect(m.log).toEqual(['unchanged', 'completed']);
    // The server's late close on the torn-down socket says nothing.
    m.socket().fireClose({ code: 1000 });
    expect(m.log).toEqual(['unchanged', 'completed']);

    const n = mount({ url: 'ws://x/never', autoConnect: false });
    n.handle().disconnect();
    expect(n.log).toEqual(['unchanged', 'completed']);
    expect([n.handle().connectionState, n.sockets()]).toEqual(['idle', 0]);
  });

  test('E6 the outage: a drop ⇒ reconnecting, Retry Count 1, On Close, a backoff timer; the retry reopens ⇒ On Open + On Reconnect; a Connect that never opened rides the whole outage to ONE Done; retries spent ⇒ error, On Error, On Close', () => {
    const m = mount({ url: 'ws://x/chat' });
    m.socket().fireOpen();
    m.log.length = 0;
    m.socket().fireClose({ code: 1006 });
    expect([m.handle().connectionState, m.handle().connected, m.handle().retryCount, m.handle().closeCode]).toEqual(['reconnecting', false, 1, 1006]);
    expect(m.handle().lastError).toBe('Connection lost (no close frame); reconnecting in 1000ms');
    expect(m.log).toEqual(['onClose']);
    expect(m.seams.pending()).toEqual([1000]);
    m.seams.fire(0);
    expect(m.sockets()).toBe(2);
    expect(m.handle().connectionState).toBe('reconnecting');
    // The retry drops too: attempt 1 ⇒ 2000 ms, Retry Count 2, still one outage (no second On Close storm — one per drop).
    m.socket().fireClose({ code: 1006 });
    expect([m.handle().retryCount, m.seams.pending(), m.log]).toEqual([2, [2000], ['onClose', 'onClose']]);
    m.seams.fire(1);
    m.socket().fireOpen();
    expect(m.log).toEqual(['onClose', 'onClose', 'onOpen', 'onReconnect']);
    expect([m.handle().retryCount, m.handle().lastError, m.sockets()]).toEqual([0, '', 3]);
    // The counter reset on the open, so a later drop starts the backoff over at the base.
    m.socket().fireClose({ code: 1006 });
    expect(m.seams.pending()).toEqual([1000]);

    const c = mount({ url: 'ws://x/chat', autoConnect: false });
    c.handle().connect();
    c.socket().fireError();
    expect(c.log).toEqual(['onError', 'onClose']);
    expect(c.handle().lastError).toBe('Connection lost (no close frame): Could not connect to ws://x/chat; reconnecting in 1000ms');
    c.seams.fire(0);
    c.socket().fireOpen();
    // Never opened before, so no On Reconnect; the token minted at the port settles once, on the open that finally came.
    expect(c.log).toEqual(['onError', 'onClose', 'onOpen', 'done', 'completed']);

    const g = mount({ url: 'ws://x/chat', maxRetries: 1 });
    g.socket().fireOpen();
    g.log.length = 0;
    g.socket().fireClose({ code: 1011, reason: 'restarting' });
    expect(g.handle().lastError).toBe('Connection closed (1011): restarting; reconnecting in 1000ms');
    g.seams.fire(0);
    g.socket().fireClose({ code: 1006 });
    expect([g.handle().connectionState, g.handle().retryCount]).toEqual(['error', 1]);
    expect(g.handle().lastError).toBe('Connection lost (no close frame); gave up after 1 reconnect attempts');
    expect(g.log).toEqual(['onClose', 'onError', 'onClose']);
    expect(g.seams.pending()).toEqual([]);
    // The give-up is the connection's, not a Connect's: nothing was pending, so nothing raises.
    expect(g.raised).toEqual([]);
  });

  test('E7 Auto Reconnect off: a clean goodbye is closed + On Close; an abnormal drop is error with the suffix; a fatal code is never retried; a pending Connect settles Failure raising websocket/connect-failed', () => {
    const m = mount({ url: 'ws://x/chat', autoReconnect: false });
    m.socket().fireOpen();
    m.log.length = 0;
    m.socket().fireClose({ code: 1000, reason: 'bye' });
    expect([m.handle().connectionState, m.handle().closeCode, m.handle().closeReason, m.handle().lastError]).toEqual(['closed', 1000, 'bye', '']);
    expect(m.log).toEqual(['onClose']);

    const a = mount({ url: 'ws://x/chat', autoReconnect: false, autoConnect: false });
    a.handle().connect();
    a.socket().fireError();
    expect(a.handle().connectionState).toBe('error');
    expect(a.handle().lastError).toBe('Connection lost (no close frame): Could not connect to ws://x/chat; Auto Reconnect is off');
    // The status pass settles the token before the connection's own On Error / On Close go out.
    expect(a.log).toEqual(['onError', 'failure', 'completed', 'onError', 'onClose']);
    expect(a.raised).toEqual([{ code: 'websocket/connect-failed', message: 'Connection lost (no close frame): Could not connect to ws://x/chat; Auto Reconnect is off', nodeId: 'socket', nodeType: 'net.noodl.WebSocket', componentName: '/Pages/Home' }]);
    expect(a.seams.pending()).toEqual([]);

    const f = mount({ url: 'ws://x/chat' });
    f.socket().fireOpen();
    f.log.length = 0;
    f.socket().fireClose({ code: 1008, reason: 'policy' });
    expect(f.handle().lastError).toBe('Connection closed (1008): policy; this will not be retried');
    expect(f.log).toEqual(['onError', 'onClose']);
    expect(f.seams.pending()).toEqual([]);
  });

  test('E8 the heartbeat: a ping on the interval (no On Message Sent), the reply swallowed and measured as Latency, an unanswered one treated as a dead connection; with the heartbeat off, "pong" is a message', () => {
    const m = mount({ url: 'ws://x/hb', heartbeatInterval: 100 });
    m.socket().fireOpen();
    m.log.length = 0;
    expect(m.seams.pending()).toEqual([100]);
    m.seams.fire(0);
    expect(m.socket().sent).toEqual(['ping']);
    expect(m.log).toEqual([]);
    m.seams.clock.now += 30;
    m.socket().fireMessage('pong');
    expect([m.handle().latency, m.handle().received, m.log]).toEqual([30, undefined, []]);
    m.seams.fire(1);
    expect(m.socket().sent).toEqual(['ping', 'ping']);
    m.seams.clock.now += 100;
    m.seams.fire(2);
    expect(m.log).toEqual(['onError', 'onClose']);
    expect(m.handle().connectionState).toBe('reconnecting');
    expect(m.handle().lastError).toBe('Connection lost (no close frame): Heartbeat went unanswered for 100ms; treating the connection as dead; reconnecting in 1000ms');
    expect(m.socket().closeCalls).toHaveLength(1);

    const off = mount({ url: 'ws://x/nohb' });
    off.socket().fireOpen();
    off.socket().fireMessage('pong');
    expect([off.handle().received, off.log.at(-1)]).toEqual(['pong', 'onMessage:pong']);
  });

  test('E9 the rebuild policy: a URL change drops the live connection and reopens on the new one (a pending Connect superseded); tuning applies in place; Auto Connect flipped on connects, flipped off leaves it; a deliberately disconnected node does not follow a URL', () => {
    const m = mount({ url: 'ws://x/one' });
    m.socket().fireOpen();
    m.current.options = { url: 'ws://x/two' };
    m.render();
    expect(m.sockets()).toBe(2);
    expect(m.socket(0).closeCalls).toEqual([{ code: 1000, reason: 'Node deleted' }]);
    expect([m.socket(1).url, m.handle().connectionState]).toEqual(['ws://x/two', 'connecting']);
    expect(m.log).toEqual(['onOpen']);
    // Tuning: the same socket stays; the next drop backs off with the new delay.
    m.socket(1).fireOpen();
    m.current.options = { url: 'ws://x/two', reconnectDelay: 5 };
    m.render();
    expect(m.sockets()).toBe(2);
    m.socket(1).fireClose({ code: 1006 });
    expect(m.seams.pending()).toEqual([5]);
    // A protocol string that parses the same is not an identity change: the rebuild runs and does nothing.
    m.current.options = { url: 'ws://x/two', reconnectDelay: 5, protocols: '' };
    m.render();
    expect(m.sockets()).toBe(2);

    const p = mount({ url: 'ws://x/p', autoConnect: false });
    p.handle().connect();
    p.current.options = { url: 'ws://x/p2', autoConnect: false };
    p.render();
    // The socket that was shaking hands was active, so the rebuild follows the URL even with Auto Connect off — and the
    // author's Connect against the old endpoint is superseded, not failed.
    expect(p.log).toEqual(['unchanged', 'completed']);
    expect([p.sockets(), p.socket().url]).toEqual([2, 'ws://x/p2']);

    const a = mount({ url: 'ws://x/a', autoConnect: false });
    expect(a.sockets()).toBe(0);
    a.current.options = { url: 'ws://x/a', autoConnect: true };
    a.render();
    expect(a.sockets()).toBe(1);
    a.socket().fireOpen();
    a.current.options = { url: 'ws://x/a', autoConnect: false };
    a.render();
    expect([a.sockets(), a.handle().connectionState]).toEqual([1, 'open']);

    const d = mount({ url: 'ws://x/d', autoConnect: false });
    d.handle().connect();
    d.socket().fireOpen();
    d.handle().disconnect();
    d.current.options = { url: 'ws://x/d2', autoConnect: false };
    d.render();
    expect([d.sockets(), d.handle().connectionState]).toEqual([1, 'idle']);
  });

  test('E10 unmount tears everything down: the socket closed "Node deleted", the reconnect timer cleared, the queue counted, a late event reaches nobody, no listener fires', () => {
    const m = mount({ url: 'ws://x/chat' });
    m.socket().fireOpen();
    m.socket().fireClose({ code: 1006 });
    expect(m.seams.pending()).toEqual([1000]);
    m.handle().send('queued while down');
    m.log.length = 0;
    m.harness.unmount();
    expect(m.seams.pending()).toEqual([]);
    expect(m.socket().detached()).toBe(true);
    m.seams.fire(0);
    expect(m.sockets()).toBe(1);
    m.socket().fireOpen();
    m.socket().fireMessage('late');
    expect(m.log).toEqual([]);
    expect(m.handle().received).toBeUndefined();

    const o = mount({ url: 'ws://x/open' });
    o.socket().fireOpen();
    o.harness.unmount();
    expect(o.socket().closeCalls).toEqual([{ code: 1000, reason: 'Node deleted' }]);
  });

  test('E11 the setters coerce as the runtime’s do: a null URL is no URL (Failure before On Error), a non-ws URL is refused by scheme, no WebSocket in the environment, a throwing constructor — none retried', () => {
    const m = mount({ url: null, autoConnect: false });
    m.handle().connect();
    expect([m.handle().connectionState, m.handle().lastError, m.sockets()]).toEqual(['error', 'URL is required to connect', 0]);
    // `_fail` emits the status (the token settles) before it fires On Error.
    expect(m.log).toEqual(['failure', 'completed', 'onError']);
    expect(m.raised.map((r) => [r.code, r.message])).toEqual([['websocket/connect-failed', 'URL is required to connect']]);

    const h = mount({ url: 'http://x/chat', autoConnect: false });
    h.handle().connect();
    expect(h.handle().lastError).toBe('URL must start with ws:// or wss:// — got: http://x/chat');
    expect(h.raised.map((r) => r.message)).toEqual(['URL must start with ws:// or wss:// — got: http://x/chat']);
    expect(h.seams.pending()).toEqual([]);

    const { lib, harness, raised } = loadLib();
    const seams = makeSeams();
    const log: string[] = [];
    let handle!: Handle;
    harness.render(() => (handle = lib.useWebSocket(SRC, { url: 'ws://x/none' }, { failure: () => log.push('failure'), onError: () => log.push('onError') }, { ...seams.env, WebSocketImpl: null })));
    expect([handle.connectionState, handle.lastError, log]).toEqual(['error', 'WebSocket is not available in this environment', ['onError']]);
    expect(raised).toEqual([]);

    class Throwing {
      constructor() {
        throw new Error('boom');
      }
    }
    const t = loadLib();
    const tl: string[] = [];
    let th!: Handle;
    t.harness.render(() => (th = t.lib.useWebSocket(SRC, { url: 'ws://x/throw', autoConnect: false }, { failure: () => tl.push('failure'), onError: () => tl.push('onError'), onClose: () => tl.push('onClose') }, { ...makeSeams().env, WebSocketImpl: Throwing })));
    th.connect();
    expect([th.connectionState, th.lastError, tl]).toEqual(['error', 'Could not open WebSocket: boom', ['failure', 'onError']]);
  });

  test('E12 Received is read at the pulse by a chain, and Connect / Disconnect settle superseded tokens: Connect twice before open ⇒ the first Unchanged; Disconnect before open ⇒ Unchanged then its own Done', () => {
    const m = mount({ url: 'ws://x/chat', autoConnect: false });
    m.handle().connect();
    m.handle().connect();
    expect(m.log).toEqual(['unchanged', 'completed']);
    expect(m.sockets()).toBe(2);
    m.socket(1).fireOpen();
    expect(m.log).toEqual(['unchanged', 'completed', 'onOpen', 'done', 'completed']);

    const d = mount({ url: 'ws://x/chat', autoConnect: false });
    d.handle().connect();
    d.handle().disconnect();
    // Two tokens, two Completed: the superseded Connect reports Unchanged, then the Disconnect its own Done — On Close between.
    expect(d.log).toEqual(['unchanged', 'completed', 'onClose', 'done', 'completed']);
    expect(d.handle().connectionState).toBe('closed');
    expect(d.socket().closeCalls).toEqual([{ code: 1000, reason: 'Client disconnect' }]);
  });

  test('E13 EXP-011 §66.5 — an option passed as undefined (a Variable nothing has written) is NOT a delivery: { url, autoConnect: undefined } opens at mount (the runtime default true stands); reconnectDelay undefined keeps 1000, not NaN; true then undefined rebuilds nothing', () => {
    const m = mount({ url: 'ws://x/chat', autoConnect: undefined, reconnectDelay: undefined });
    expect(m.sockets()).toBe(1);
    m.socket().fireOpen();
    m.current.options = { url: 'ws://x/chat', autoConnect: true };
    m.render();
    m.current.options = { url: 'ws://x/chat', autoConnect: undefined };
    m.render();
    expect(m.sockets()).toBe(1);
    m.socket().fireClose({ code: 1006 });
    expect(m.seams.pending()).toEqual([1000]);
  });

});

// ---------------------------------------------------------------------------------------------------
describe('§F the ledger', () => {
  test('F1 the row moved to translated with a note; the card carries no badge; the floor carries its sentence; Subscribe To Changes (§66) is translated too, so no scheduled transport is left', () => {
    expect(ledgerEntryOf(WEBSOCKET_TYPE)?.status).toBe('translated');
    expect(exportBadgeOf(WEBSOCKET_TYPE)).toBeUndefined();
    const ledger = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'coverage-ledger.json'), 'utf8'));
    const row = (ledger.entries as Array<{ typeName: string; note?: string; exemption?: string }>).find((e) => e.typeName === WEBSOCKET_TYPE)!;
    expect(row.exemption).toBeUndefined();
    expect(String(row.note)).toContain('useWebSocket');
    expect(ledger.pickerCoverageFloor).toBe(117); // §66 Subscribe To Changes (session 90) on top of §65 WebSocket (session 89) on top of §64 Server-Sent Events (session 88)
    expect(String(ledger.$pickerCoverageFloorComment)).toContain('116 after Tier 3.11 row 2 WebSocket');
    // §66 (session 90) translated the last scheduled node; the badge reads nothing for it now, and the ledger's control for
    // "a node nothing translates" is subscribe-to-changes.test.ts F2's out-of-scope set.
    expect(exportBadgeOf('SubscribeToChanges')).toBeUndefined();
  });
});
