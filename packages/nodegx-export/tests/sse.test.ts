import * as fs from 'fs';
import * as path from 'path';

import * as ts from 'typescript';

import { Catalog, CatalogIndex, loadCatalog } from '../src/catalog';
import { ComponentPlan, SSE_TYPE, STREAM_NODES, planProject } from '../src/analyze/plan';
import { emitApp } from '../src/emit/emitApp';
import { ERRORS_LIB_PATH } from '../src/emit/errorsLib';
import { SSE_LIB_PATH, sseLibSource } from '../src/emit/sseLib';
import { STREAMING_LIB_PATH, streamingLibSource } from '../src/emit/streamingLib';
import { exportBadgeOf, ledgerEntryOf } from '../src/ledger';
import { parseProject } from '../src/parse/parseProject';
import { ComponentIR, ConnectionIR, ExportIR, NodeIR, ParamValue } from '../src/ir/types';

/**
 * EXP-011 §64 — `Server-Sent Events` (`net.noodl.SSE`), Tier 3.11's first transport.
 *
 * The fourth member of the streaming table (§58): no data port, the two Actions as verbs, the four Events and the
 * outcome trio as listeners, every Status and Data output a live getter. `src/lib/sse.ts` transcribes
 * `agent/sse.ts` (the node), `sse-connection.ts` (the connection, both transports, the backoff, the dedupe window)
 * and `stream-parsers.ts`'s SSE half (parseSseChunk, parseJsonOrText, textForPath); it imports `./streaming` for
 * describeError / tryParseJson / StreamSource and `./errors` for the Failure outcome's raise.
 *
 * Measured before the build (probe-reverted.log, HEAD f23368a1): 18 refusals — the node `logic node (net.noodl.SSE)`,
 * the Text Accumulator `its Chunk input is fed by net.noodl.SSE — no statically known source`, the three Set Variables
 * `trigger stream.onOpen is not a rendered element event or a receiver`, their three Strings behind them, every wire
 * into or out of the node dropped.
 *
 * §A the plan and the emitted page · §B the refused shapes, by mutation · §C the lib's text · §D the pure cores under
 * node · §E the hook under a hook harness with a scripted fetch, a scripted EventSource and the runtime's own timer
 * seam · §F the ledger.
 */

const FIXTURE = path.join(__dirname, 'fixtures', 'token-desk');
const catalog: Catalog = loadCatalog();
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
  "  const stream = useServerSentEvents({ label: 'Stream', nodeId: 'stream', componentName: '/Pages/Home' }, { url: 'http://localhost:8582/stream', textPath: 'choices.0.delta.content' }, {\n" +
  "    onOpen: () => status.set('open'),\n" +
  '    onMessage: () => tokens.add(stream.text),\n' +
  "    onClose: () => status.set('closed'),\n" +
  "    failure: () => status.set('failed')\n" +
  '  });';

// ---------------------------------------------------------------------------------------------------
describe('§A the plan and the emitted page — the fourth member of the streaming table', () => {
  const page = app.files[HOME_FILE];
  const home = project.plans.find((p) => p.path === HOME)!;

  test('A1 the fixture translates whole: 0 refusals, the shell note alone, the node collapsed into the file', () => {
    const report = app.report.components.find((c) => c.path === HOME)!;
    expect(report.refusals ?? []).toEqual([]);
    expect(app.notes.filter((n) => n.startsWith('Pages/Home'))).toEqual([]);
    expect(home.dispositions['stream']).toEqual({ kind: 'collapsed', into: HOME_FILE });
    expect(home.dispositions['acc']).toEqual({ kind: 'collapsed', into: HOME_FILE });
    expect(Object.keys(app.files).sort()).toEqual(
      expect.arrayContaining([SSE_LIB_PATH, STREAMING_LIB_PATH, ERRORS_LIB_PATH, HOME_FILE, 'src/stores/variables.ts'])
    );
  });

  test('A2 the plan: one stream of kind sse, its two authored config ports, no data, the four listeners; the accumulator beside it', () => {
    const stream = home.streams.find((s) => s.nodeId === 'stream')!;
    expect(stream).toMatchObject({ type: SSE_TYPE, kind: 'sse', label: 'Stream', local: 'stream' });
    expect(stream.data).toBeUndefined();
    expect(stream.config).toEqual([
      { port: 'url', expr: { kind: 'literal', value: 'http://localhost:8582/stream' } },
      { port: 'textPath', expr: { kind: 'literal', value: 'choices.0.delta.content' } }
    ]);
    expect(Object.keys(stream.listeners)).toEqual(['onOpen', 'onMessage', 'onClose', 'failure']);
    expect(stream.listeners.onMessage).toEqual([
      expect.objectContaining({ kind: 'stream-action', nodeId: 'acc', verb: 'add', value: { kind: 'stream-out', nodeId: 'stream', local: 'stream', node: 'sse', field: 'text', tsType: 'string' } })
    ]);
    expect(stream.comment).toBe('Stream — a Server-Sent Events (sse.ts), hosted by sse.ts; its value outputs read live off the handle.');
    const acc = home.streams.find((s) => s.nodeId === 'acc')!;
    expect(acc.data).toEqual({ kind: 'stream-out', nodeId: 'stream', local: 'stream', node: 'sse', field: 'text', tsType: 'string' });
  });

  test('A3 the page: two import lines grouped by module, the hook line with the listeners in declaration order, the Chunk read AT the pulse', () => {
    expect(page).toContain("import { useServerSentEvents } from '../lib/sse';");
    expect(page).toContain("import { useTextAccumulator } from '../lib/streaming';");
    expect(page).toContain('  // Stream — a Server-Sent Events (sse.ts), hosted by sse.ts; its value outputs read live off the handle.\n' + HOOK_LINE);
    expect(page).toContain("  const tokens = useTextAccumulator({ label: 'Tokens', nodeId: 'acc', componentName: '/Pages/Home' }, {});");
  });

  test('A4 the two Actions are verbs on the handle; every Status/Data read casts by its DECLARED type', () => {
    expect(page).toContain('<button onClick={() => stream.connect()}>Connect</button>');
    expect(page).toContain('<button onClick={() => stream.disconnect()}>Stop</button>');
    expect(page).toContain('<p className={styles.text}>{stream.connectionState}</p>');
    expect(page).toContain('<p className={styles.text}>{String(stream.connected)}</p>');
    expect(page).toContain('<p className={styles.text}>{String(stream.messageCount)}</p>');
    expect(page).toContain('<p className={styles.text}>{stream.lastError}</p>');
    expect(page).toContain('<p className={styles.text}>{tokens.accumulated}</p>');
    expect(page).toContain('<p className={styles.text}>{statusValue}</p>');
    // Nothing of the node prints anywhere else: no useEffect for it, no state row, no store.
    expect(page).not.toContain('useEffect');
    expect(page).not.toContain('useState');
  });

  test('A5 the table row is the catalog’s port set for net.noodl.SSE: 15 config + 2 actions in, 8 signals + 13 values out', () => {
    const spec = STREAM_NODES[SSE_TYPE];
    const node = catalog.nodes.find((n) => n.typeName === SSE_TYPE)!;
    expect(spec.data).toBeUndefined();
    expect(spec.config).toHaveLength(15);
    expect([...spec.config.map((c) => c.port), ...Object.keys(spec.actions)].sort()).toEqual((node.inputs ?? []).map((p) => p.name).sort());
    expect([...spec.signals, ...Object.keys(spec.values)].sort()).toEqual((node.outputs ?? []).map((p) => p.name).sort());
    expect(spec.signals).toEqual(['onOpen', 'onMessage', 'onError', 'onClose', 'done', 'completed', 'unchanged', 'failure']);
    expect(spec.values.data).toEqual({ tsType: 'unknown', cast: 'unknown', maybeUndefined: true });
    expect(spec.values.connected.cast).toBe('boolean');
    expect(spec.lib).toBe('sse');
  });

  test('A6 a wired config port reads at render: a Variable into URL prints its render local; a String into Method prints the literal', () => {
    const ir = cloneIr();
    const home2 = componentOf(ir, HOME);
    connect(home2, 'statusVar', 'value', 'stream', 'url', 'value');
    connect(home2, 'openStr', 'savedValue', 'stream', 'method', 'value');
    const out = emitApp(ir, catalog).files[HOME_FILE];
    expect(refusalOf(ir, HOME, 'stream')).toBeUndefined();
    expect(out).toContain("{ url: statusValue, method: 'open', textPath: 'choices.0.delta.content' }");
  });

  test('A7 a boolean config authored on disk prints as a boolean literal; a number as a number', () => {
    const ir = cloneIr();
    setParam(nodeOf(ir, HOME, 'stream'), 'autoConnect', { kind: 'literal', value: true });
    setParam(nodeOf(ir, HOME, 'stream'), 'maxRetries', { kind: 'literal', value: 3 });
    const out = emitApp(ir, catalog).files[HOME_FILE];
    expect(out).toContain("{ url: 'http://localhost:8582/stream', textPath: 'choices.0.delta.content', autoConnect: true, maxRetries: 3 }");
  });
});

// ---------------------------------------------------------------------------------------------------
describe('§B the refused shapes, by mutation — each sentence exact', () => {
  test('B1 two wires into one input', () => {
    expect(
      sentence('stream', (ir) => {
        connect(componentOf(ir, HOME), 'openStr', 'savedValue', 'stream', 'url', 'value');
        connect(componentOf(ir, HOME), 'closedStr', 'savedValue', 'stream', 'url', 'value');
      })
    ).toBe('two wires feed its URL input — last-writer-wins is not statically ordered');
  });

  test('B2 a signal output consumed as a value', () => {
    expect(
      sentence('stream', (ir) => {
        disconnect(componentOf(ir, HOME), (c) => c.toId === 'countText');
        connect(componentOf(ir, HOME), 'stream', 'onMessage', 'countText', 'text', 'value');
      })
    ).toBe('its onMessage output is consumed as a value — a pulse carries nothing to read');
  });

  test('B3 an input the node has not got', () => {
    expect(sentence('stream', (ir) => connect(componentOf(ir, HOME), 'connectBtn', 'onClick', 'stream', 'bogus'))).toBe('its bogus input is not a port this node has');
  });

  test('B4 an output the node has not got', () => {
    expect(sentence('stream', (ir) => connect(componentOf(ir, HOME), 'stream', 'bogus', 'errorText', 'text', 'value'))).toBe(
      'its bogus output is consumed, and this node has no such port'
    );
  });

  test('B5 the cascade when the node is refused: the accumulator behind its Text, the Set Variables behind its Events, every wire dropped', () => {
    const ir = cloneIr();
    connect(componentOf(ir, HOME), 'connectBtn', 'onClick', 'stream', 'bogus');
    const out = emitApp(ir, catalog);
    const report = out.report.components.find((c) => c.path === HOME)!;
    const reasons = Object.fromEntries((report.refusals ?? []).map((r) => [r.nodeId, r.reason]));
    expect(reasons.acc).toContain('its Chunk input is fed by net.noodl.SSE');
    // ⚠️ Not the reverted arm's sentence: with the node in the table, its refusal is memoised and the Set Variables behind its
    // Events fall to the generic logic-node sentence rather than the attach pass's "trigger … is not a rendered element event".
    // EXP-013's causedBy still walks the graph to the root (the stream), so the pre-flight names it.
    expect(reasons.setOpen).toBe('logic node (Set Variable)');
    expect(reasons.setFailed).toBe('logic node (Set Variable)');
    expect(reasons.stream).toBe('its bogus input is not a port this node has');
    const cascade = out.report.components.find((c) => c.path === HOME)!.refusals!.find((r) => r.nodeId === 'setOpen')!;
    expect(JSON.stringify(cascade)).toContain('stream');
    expect(out.files[HOME_FILE]).not.toContain('useServerSentEvents');
    expect(out.files[SSE_LIB_PATH]).toBeUndefined();
    expect(out.files[STREAMING_LIB_PATH]).toBeUndefined();
  });

  test('B6 a component with no file cannot host it', () => {
    const ir = cloneIr();
    const home = componentOf(ir, HOME);
    home.nodes = home.nodes.filter((n) => n.id === 'stream');
    home.connections = [];
    const plan = planOf(ir, HOME);
    expect(plan.dispositions['stream']).toEqual({ kind: 'deferred', to: 'EXP-003', reason: 'component emits no file to host the Server-Sent Events' });
  });
});

// ---------------------------------------------------------------------------------------------------
describe("§C the lib's text — src/lib/sse.ts, shipped and transcribed", () => {
  const lib = app.files[SSE_LIB_PATH];

  test('C1 shipped with the generated header; imports ./errors and ./streaming, which are therefore shipped too', () => {
    expect(lib.startsWith('// @nodegx:generated')).toBe(true);
    expect(lib).toContain("import { raiseAppError } from './errors';");
    expect(lib).toContain("import { describeError, tryParseJson, type StreamSource } from './streaming';");
    expect(lib).toBe('// @nodegx:generated (api module — provenance markers complete in EXP-007)\n' + sseLibSource());
    expect(app.files[STREAMING_LIB_PATH]).toBeDefined();
    expect(app.files[ERRORS_LIB_PATH]).toBeDefined();
  });

  test('C2 the transcription pins: the fetch headers, Last-Event-ID, the backoff, the dedupe window, the outcome order, the raise', () => {
    expect(lib).toContain("const headers: Record<string, string> = { Accept: 'text/event-stream', 'Cache-Control': 'no-store' };");
    expect(lib).toContain("if (this._lastEventId) headers['Last-Event-ID'] = this._lastEventId;");
    expect(lib).toContain('return Math.min(m, b * Math.pow(2, n));');
    expect(lib).toContain('export const DEFAULT_DEDUPE_WINDOW = 512;');
    expect(lib).toContain("export const SSE_ERROR_CONNECT_FAILED = 'sse/connect-failed';");
    expect(lib).toContain("  s.latest.listeners[outcome]?.();\n  s.latest.listeners.completed?.();");
    expect(lib).toContain("if (state === 'open') s.latest.listeners.onOpen?.();\n  if (state === 'closed' || state === 'error') s.latest.listeners.onClose?.();\n  if (state === 'open') settleConnect(s, 'done');");
    expect(lib).toContain("(conn && conn.lastError) || 'The stream could not be opened'");
    expect(lib).toContain("nodeType: 'net.noodl.SSE'");
  });

  test('C4 a Server-Sent Events alone (the accumulator removed) still ships streaming.ts — sse.ts imports it', () => {
    const ir = cloneIr();
    const home = componentOf(ir, HOME);
    home.nodes = home.nodes.filter((n) => n.id !== 'acc');
    home.connections = home.connections.filter((c) => c.fromId !== 'acc' && c.toId !== 'acc');
    const out = emitApp(ir, catalog);
    expect(refusalOf(ir, HOME, 'stream')).toBeUndefined();
    expect(out.files[SSE_LIB_PATH]).toBeDefined();
    expect(out.files[STREAMING_LIB_PATH]).toBeDefined();
    expect(out.files[ERRORS_LIB_PATH]).toBeDefined();
    expect(out.files[HOME_FILE]).not.toContain("from '../lib/streaming'");
  });

  test("C3 a Text Accumulator alone ships streaming.ts without sse.ts; the trio's spec fixture is unchanged by §64", () => {
    const trio = emitApp(parseProject(path.join(__dirname, 'fixtures', 'stream-desk'), catalog), catalog);
    expect(trio.files[STREAMING_LIB_PATH]).toBeDefined();
    expect(trio.files[SSE_LIB_PATH]).toBeUndefined();
    expect(trio.files['src/pages/Home.tsx']).toContain("import { useJsonStreamParser, useStreamBuffer, useTextAccumulator } from '../lib/streaming';");
  });
});

// ---------------------------------------------------------------------------------------------------
// §D / §E — the lib under node. The trio spec's hook harness; `./errors` a recording stub; `./streaming` the real
// module, compiled the same way.
// ---------------------------------------------------------------------------------------------------
type AppError = { code: string; message: string; nodeId: string; nodeType: string; componentName: string; detail?: unknown };
type Source = { label: string; nodeId: string; componentName: string };
type Frame = { event: string; data: string; id: string; retry?: number };
type Handle = {
  connect(): void;
  disconnect(): void;
  readonly connectionState: string;
  readonly connected: boolean;
  readonly lastError: string;
  readonly retryCount: number;
  readonly data: unknown;
  readonly raw: string;
  readonly text: string;
  readonly eventType: string;
  readonly lastEventId: string;
  readonly messageCount: number;
  readonly lastMessageTime: number;
  readonly duplicatesSuppressed: number;
  readonly deliverySemantics: string;
};
type Lib = {
  parseSseChunk: (buffer: string) => { frames: Frame[]; rest: string };
  parseJsonOrText: (text: string) => unknown;
  textForPath: (raw: string, parsed: unknown, path: string) => string;
  valueAtPath: (root: unknown, path: string) => unknown;
  backoffDelay: (attempt: number, base: number, max: number) => number;
  RecentIds: new (limit?: number) => { has(id: string): boolean; add(id: string): boolean; size: number; clear(): void };
  resolveTransport: (o: Record<string, unknown>) => string;
  useServerSentEvents: (source: Source, options?: Record<string, unknown>, on?: Record<string, () => void>, env?: Record<string, unknown>) => Handle;
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
  const streaming = compile(streamingLibSource(), (name) => {
    if (name === 'react') return harness.React;
    if (name === './errors') return errors;
    throw new Error(`unexpected import ${name}`);
  });
  const lib = compile(sseLibSource(), (name) => {
    if (name === 'react') return harness.React;
    if (name === './errors') return errors;
    if (name === './streaming') return streaming;
    throw new Error(`unexpected import ${name}`);
  });
  return { lib, harness, raised };
};
const SRC: Source = { label: 'Stream', nodeId: 'stream', componentName: '/Pages/Home' };
const flush = async (rounds = 6) => {
  for (let i = 0; i < rounds; i++) await new Promise((resolve) => setImmediate(resolve));
};

/** A scripted streaming body: push chunks, end it, see whether it was cancelled. */
function makeStream() {
  const queue: string[] = [];
  const waiters: Array<() => void> = [];
  let ended = false;
  const stream = {
    cancelled: 0,
    reader: {
      read: () =>
        new Promise<{ value?: string; done: boolean }>((resolve) => {
          const step = () => {
            if (queue.length > 0) resolve({ value: queue.shift(), done: false });
            else if (ended) resolve({ done: true });
            else waiters.push(step);
          };
          step();
        }),
      cancel: () => {
        stream.cancelled++;
        return Promise.resolve();
      }
    },
    push(chunk: string) {
      queue.push(chunk);
      for (const w of waiters.splice(0)) w();
    },
    end() {
      ended = true;
      for (const w of waiters.splice(0)) w();
    }
  };
  return stream;
}

/** A scripted fetch: every call recorded; the script decides the response. */
function makeFetch() {
  const calls: Array<{ url: string; init: any }> = [];
  let script: (call: { url: string; init: any }, n: number) => Promise<any> = () => Promise.resolve({ ok: true, status: 200, body: { getReader: () => makeStream().reader } });
  const fetchImpl = (url: string, init: any) => {
    const call = { url, init };
    calls.push(call);
    return script(call, calls.length);
  };
  return { calls, fetchImpl, respond: (fn: typeof script) => (script = fn) };
}

/** The runtime's timer seam: timers collected, fired by hand. */
function makeTimers() {
  const timers: Array<{ fn: () => void; ms: number; cleared: boolean }> = [];
  return {
    timers,
    env: {
      setTimeoutImpl: (fn: () => void, ms: number) => {
        timers.push({ fn, ms, cleared: false });
        return timers.length;
      },
      clearTimeoutImpl: (h: unknown) => {
        timers[(h as number) - 1].cleared = true;
      },
      nowImpl: () => 1700000000000
    },
    fire(i: number) {
      const t = timers[i];
      if (!t.cleared) t.fn();
    }
  };
}
class FakeAbortController {
  static aborted = 0;
  signal = { fake: true };
  abort() {
    FakeAbortController.aborted++;
  }
}
const frame = (content: string, id?: number) => `${id !== undefined ? `id: ${id}\n` : ''}data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`;

describe('§D the pure cores run the way stream-parsers.ts and sse-connection.ts do (under node)', () => {
  const { lib } = loadLib();

  test('D1 parseSseChunk: fields, a multi-line data, an id, a retry, comments skipped, the incomplete tail kept, CRLF and a BOM honoured', () => {
    const r = lib.parseSseChunk('﻿: keep-alive\nevent: token\nid: 7\nretry: 250\ndata: one\ndata: two\n\ndata: {"a":1}\n\ndata: partial');
    expect(r.frames).toEqual([
      { event: 'token', data: 'one\ntwo', id: '7', retry: 250 },
      { event: 'message', data: '{"a":1}', id: '7' }
    ]);
    expect(r.rest).toBe('data: partial');
    expect(lib.parseSseChunk('data: a\r\n\r\ndata: b\r').frames).toEqual([{ event: 'message', data: 'a', id: '' }]);
    // A field with no colon is a field with an empty value; a leading space after the colon is stripped once.
    expect(lib.parseSseChunk('data\n\n').frames).toEqual([{ event: 'message', data: '', id: '' }]);
    expect(lib.parseSseChunk('data:  two spaces\n\n').frames[0].data).toBe(' two spaces');
    // An id carrying NUL is ignored; a retry that is not digits is ignored; a frame with no data dispatches nothing.
    expect(lib.parseSseChunk('id: a b\ndata: x\n\n').frames[0].id).toBe('');
    expect(lib.parseSseChunk('retry: soon\ndata: x\n\n').frames[0].retry).toBeUndefined();
    expect(lib.parseSseChunk('event: ping\n\n').frames).toEqual([]);
  });

  test('D2 parseJsonOrText: JSON parses, text stays text, an empty payload is the empty string, a JSON-looking failure stays text', () => {
    expect(lib.parseJsonOrText('{"a":1}')).toEqual({ a: 1 });
    expect(lib.parseJsonOrText(' 42 ')).toBe(42);
    expect(lib.parseJsonOrText('true')).toBe(true);
    expect(lib.parseJsonOrText('hello')).toBe('hello');
    expect(lib.parseJsonOrText('')).toBe('');
    expect(lib.parseJsonOrText('{not json')).toBe('{not json');
  });

  test('D3 textForPath: no path ⇒ raw; a string/number/boolean at the path; anything else blank; bracket segments; prototype keys refused', () => {
    const parsed = { choices: [{ delta: { content: 'Hel', n: 3, ok: true, obj: { x: 1 } } }] };
    expect(lib.textForPath('raw', parsed, '')).toBe('raw');
    expect(lib.textForPath('raw', parsed, 'choices.0.delta.content')).toBe('Hel');
    expect(lib.textForPath('raw', parsed, 'choices[0].delta.n')).toBe('3');
    expect(lib.textForPath('raw', parsed, 'choices.0.delta.ok')).toBe('true');
    expect(lib.textForPath('raw', parsed, 'choices.0.delta.obj')).toBe('');
    expect(lib.textForPath('raw', parsed, 'choices.9.delta')).toBe('');
    expect(lib.textForPath('raw', 'a string', 'length')).toBe('');
    expect(lib.valueAtPath({ a: 1 }, '__proto__.polluted')).toBeUndefined();
  });

  test('D4 backoffDelay doubles from the base to the ceiling; a non-positive base/max takes the defaults; past 30 attempts the ceiling', () => {
    expect([0, 1, 2, 3, 4, 5].map((n) => lib.backoffDelay(n, 1000, 30000))).toEqual([1000, 2000, 4000, 8000, 16000, 30000]);
    expect(lib.backoffDelay(0, 0, 0)).toBe(1000);
    expect(lib.backoffDelay(31, 1, 5)).toBe(5);
    expect(lib.backoffDelay(-3, 100, 1000)).toBe(100);
  });

  test('D5 RecentIds keeps the last N ids in arrival order and evicts the oldest', () => {
    const ids = new lib.RecentIds(2);
    expect(ids.add('a')).toBe(true);
    expect(ids.add('a')).toBe(false);
    expect(ids.add('b')).toBe(true);
    expect(ids.add('c')).toBe(true);
    expect(ids.has('a')).toBe(false);
    expect(ids.size).toBe(2);
    expect(new lib.RecentIds(0).add('x')).toBe(true);
  });

  test('D6 resolveTransport: an explicit choice wins; auto prefers fetch, falls back to EventSource, and is fetch with neither', () => {
    expect(lib.resolveTransport({ transport: 'eventsource', fetchImpl: () => Promise.resolve({}) })).toBe('eventsource');
    expect(lib.resolveTransport({ transport: 'auto', fetchImpl: () => Promise.resolve({}) })).toBe('fetch');
    expect(lib.resolveTransport({ fetchImpl: null, EventSourceImpl: class {} as never })).toBe('eventsource');
    expect(lib.resolveTransport({ fetchImpl: null, EventSourceImpl: null })).toBe('fetch');
  });
});

describe('§E the hook under the harness — the connection, the listeners in order, the live getters, the outcomes, the raise', () => {
  const mount = (options: Record<string, unknown>, listenerNames: string[] = ['onOpen', 'onMessage', 'onError', 'onClose', 'done', 'completed', 'unchanged', 'failure']) => {
    const { lib, harness, raised } = loadLib();
    const fetch = makeFetch();
    const timers = makeTimers();
    FakeAbortController.aborted = 0;
    const log: string[] = [];
    const current = { options };
    let handle!: Handle;
    const listeners = Object.fromEntries(listenerNames.map((name) => [name, () => log.push(name === 'onMessage' ? `onMessage:${handle.text}` : name)]));
    const env = { fetchImpl: fetch.fetchImpl, AbortControllerImpl: FakeAbortController, ...timers.env };
    const render = () => harness.render(() => (handle = lib.useServerSentEvents(SRC, current.options, listeners, env)));
    render();
    return { lib, harness, raised, fetch, timers, log, current, render, handle: () => handle };
  };

  test('E1 idle at mount without Auto Connect; Connect opens a GET with the two headers; open ⇒ onOpen, done, completed; frames ⇒ onMessage after Text holds them; a clean end ⇒ closed, onClose', async () => {
    const m = mount({ url: 'http://x/stream', textPath: 'choices.0.delta.content' });
    const h = m.handle();
    expect([h.connectionState, h.connected, h.text, h.raw, h.data, h.messageCount, h.lastEventId, h.deliverySemantics, h.lastError, h.retryCount, h.lastMessageTime]).toEqual([
      'idle', false, '', '', undefined, 0, '', 'at-most-once', '', 0, 0
    ]);
    expect(m.fetch.calls).toHaveLength(0);
    const stream = makeStream();
    m.fetch.respond(() => Promise.resolve({ ok: true, status: 200, body: { getReader: () => stream.reader } }));
    h.connect();
    expect(h.connectionState).toBe('connecting');
    expect(m.fetch.calls).toHaveLength(1);
    expect(m.fetch.calls[0].url).toBe('http://x/stream');
    expect(m.fetch.calls[0].init).toMatchObject({ method: 'GET', credentials: 'same-origin', headers: { Accept: 'text/event-stream', 'Cache-Control': 'no-store' } });
    expect(m.fetch.calls[0].init.body).toBeUndefined();
    expect(m.fetch.calls[0].init.signal).toEqual({ fake: true });
    await flush();
    expect(h.connectionState).toBe('open');
    expect(h.connected).toBe(true);
    expect(m.log).toEqual(['onOpen', 'done', 'completed']);
    stream.push(frame('Hel', 1));
    await flush();
    expect(m.log.slice(3)).toEqual(['onMessage:Hel']);
    expect([h.text, h.raw, h.eventType, h.lastEventId, h.messageCount, h.deliverySemantics, h.lastMessageTime]).toEqual([
      'Hel', JSON.stringify({ choices: [{ delta: { content: 'Hel' } }] }), 'message', '1', 1, 'at-least-once-deduped', 1700000000000
    ]);
    expect(h.data).toEqual({ choices: [{ delta: { content: 'Hel' } }] });
    // Two frames in one chunk, the second split across the chunk boundary: three messages, the tail reassembled.
    const two = frame('lo, ', 2) + frame('wor', 3);
    stream.push(two.slice(0, two.length - 12));
    stream.push(two.slice(two.length - 12));
    await flush();
    expect(m.log.slice(4)).toEqual(['onMessage:lo, ', 'onMessage:wor']);
    expect(h.messageCount).toBe(3);
    stream.end();
    await flush();
    expect(h.connectionState).toBe('closed');
    expect(h.connected).toBe(false);
    expect(m.log.slice(6)).toEqual(['onClose']);
    expect(m.raised).toEqual([]);
    expect(m.harness.publishes).toBeGreaterThanOrEqual(5);
  });

  test('E2 Disconnect while open: closed, done + completed, the request aborted and the reader cancelled; Disconnect again: unchanged + completed', async () => {
    const m = mount({ url: 'http://x/stream' });
    const stream = makeStream();
    m.fetch.respond(() => Promise.resolve({ ok: true, status: 200, body: { getReader: () => stream.reader } }));
    m.handle().connect();
    await flush();
    m.log.length = 0;
    m.handle().disconnect();
    expect(m.handle().connectionState).toBe('closed');
    expect(m.log).toEqual(['onClose', 'done', 'completed']);
    expect(FakeAbortController.aborted).toBe(1);
    expect(stream.cancelled).toBe(1);
    m.log.length = 0;
    m.handle().disconnect();
    expect(m.log).toEqual(['unchanged', 'completed']);
    // A frame pushed after the close reaches nobody.
    stream.push(frame('late'));
    await flush();
    expect(m.handle().messageCount).toBe(0);
    expect(m.log).toEqual(['unchanged', 'completed']);
  });

  test('E3 a 4xx is fatal: error, onClose, the raise with the node’s provenance, then failure and completed; Last Error carries the status', async () => {
    const m = mount({ url: 'http://x/stream' });
    m.fetch.respond(() => Promise.resolve({ ok: false, status: 404 }));
    m.handle().connect();
    await flush();
    expect(m.handle().connectionState).toBe('error');
    expect(m.handle().lastError).toBe('The stream endpoint returned HTTP 404');
    expect(m.log).toEqual(['onError', 'onClose', 'failure', 'completed']);
    expect(m.raised).toEqual([{ code: 'sse/connect-failed', message: 'The stream endpoint returned HTTP 404', nodeId: 'stream', nodeType: 'net.noodl.SSE', componentName: '/Pages/Home' }]);
    expect(m.timers.timers).toHaveLength(0);
  });

  test('E4 a network failure retries with the backoff: reconnecting, onError, Retry Count 1, a 1000 ms timer; the timer reopens; a 5xx after Max Retries gives up with the suffix', async () => {
    const m = mount({ url: 'http://x/stream', reconnectDelay: 0 });
    m.fetch.respond((_, n) => (n === 1 ? Promise.reject(new TypeError('Failed to fetch')) : Promise.resolve({ ok: true, status: 200, body: { getReader: () => makeStream().reader } })));
    m.handle().connect();
    await flush();
    expect(m.handle().connectionState).toBe('reconnecting');
    expect(m.handle().retryCount).toBe(1);
    expect(m.handle().lastError).toBe('Stream request failed: Failed to fetch');
    expect(m.log).toEqual(['onError']);
    // reconnectDelay 0 is coerced to the 1000 default; attempt 0 ⇒ the base.
    expect(m.timers.timers.map((t) => t.ms)).toEqual([1000]);
    m.timers.fire(0);
    expect(m.fetch.calls).toHaveLength(2);
    await flush();
    expect(m.handle().connectionState).toBe('open');
    expect(m.handle().retryCount).toBe(0);
    expect(m.log).toEqual(['onError', 'onOpen', 'done', 'completed']);

    const g = mount({ url: 'http://x/stream', maxRetries: 1, reconnectDelay: 200, maxReconnectDelay: 5000 });
    g.fetch.respond(() => Promise.resolve({ ok: false, status: 503 }));
    g.handle().connect();
    await flush();
    expect(g.handle().connectionState).toBe('reconnecting');
    expect(g.timers.timers.map((t) => t.ms)).toEqual([200]);
    g.timers.fire(0);
    await flush();
    expect(g.handle().connectionState).toBe('error');
    expect(g.handle().lastError).toBe('The stream endpoint returned HTTP 503 (gave up after 1 attempts)');
    expect(g.log).toEqual(['onError', 'onError', 'onError', 'onClose', 'failure', 'completed']);
    expect(g.raised.map((r) => r.message)).toEqual(['The stream endpoint returned HTTP 503 (gave up after 1 attempts)']);
  });

  test('E5 Dedupe By Id drops a replayed id (Duplicates Suppressed, no onMessage); off, it is delivered and the semantics say at-least-once', async () => {
    const m = mount({ url: 'http://x/stream', textPath: 'choices.0.delta.content' });
    const s1 = makeStream();
    m.fetch.respond(() => Promise.resolve({ ok: true, status: 200, body: { getReader: () => s1.reader } }));
    m.handle().connect();
    await flush();
    s1.push(frame('a', 1) + frame('b', 2) + frame('again', 2));
    await flush();
    expect([m.handle().messageCount, m.handle().duplicatesSuppressed, m.handle().text, m.handle().deliverySemantics]).toEqual([2, 1, 'b', 'at-least-once-deduped']);

    const n = mount({ url: 'http://x/stream', dedupeById: false, textPath: 'choices.0.delta.content' });
    const s2 = makeStream();
    n.fetch.respond(() => Promise.resolve({ ok: true, status: 200, body: { getReader: () => s2.reader } }));
    n.handle().connect();
    await flush();
    s2.push(frame('a', 1) + frame('again', 1));
    await flush();
    expect([n.handle().messageCount, n.handle().duplicatesSuppressed, n.handle().text, n.handle().deliverySemantics]).toEqual([2, 0, 'again', 'at-least-once']);
  });

  test('E6 Auto Connect opens at mount with no outcome (nothing asked); a URL change supersedes the live connection and reopens on the new one; an unchanged URL does nothing', async () => {
    const m = mount({ url: 'http://x/one', autoConnect: true });
    expect(m.fetch.calls.map((c) => c.url)).toEqual(['http://x/one']);
    await flush();
    expect(m.handle().connectionState).toBe('open');
    expect(m.log).toEqual(['onOpen']);
    m.render();
    expect(m.fetch.calls).toHaveLength(1);
    m.current.options = { url: 'http://x/two', autoConnect: true };
    m.render();
    expect(m.fetch.calls.map((c) => c.url)).toEqual(['http://x/one', 'http://x/two']);
    expect(FakeAbortController.aborted).toBe(1);
    await flush();
    expect(m.handle().connectionState).toBe('open');
    expect(m.log).toEqual(['onOpen', 'onOpen']);
    // Auto Connect off with a live connection: the pass leaves it alone.
    m.current.options = { url: 'http://x/two', autoConnect: false };
    m.render();
    expect(m.fetch.calls).toHaveLength(2);
    expect(m.handle().connectionState).toBe('open');
    // Auto Connect back ON while the same URL is live: `connectedUrl === url` ⇒ the pass returns — no supersede, no new
    // request, no Unchanged (the runtime's scheduleAutoConnect guard).
    m.current.options = { url: 'http://x/two', autoConnect: true };
    m.render();
    expect(m.fetch.calls).toHaveLength(2);
    expect(FakeAbortController.aborted).toBe(1);
    expect(m.handle().connectionState).toBe('open');
    expect(m.log).toEqual(['onOpen', 'onOpen']);
    // The same guard after a manual Connect: a Connect (a token pending its open) then Auto Connect flipped on ⇒ nothing.
    const k = mount({ url: 'http://x/k', autoConnect: false });
    k.fetch.respond(() => new Promise(() => {}));
    k.handle().connect();
    k.current.options = { url: 'http://x/k', autoConnect: true };
    k.render();
    expect(k.fetch.calls).toHaveLength(1);
    expect(k.log).toEqual([]);
  });

  test('E7 a second Connect before the first opened settles the first as Unchanged; a Disconnect before open settles it as Unchanged and reports its own Done', async () => {
    const m = mount({ url: 'http://x/stream' });
    let release!: (r: unknown) => void;
    m.fetch.respond((_, n) => (n === 1 ? new Promise((resolve) => (release = resolve)) : Promise.resolve({ ok: true, status: 200, body: { getReader: () => makeStream().reader } })));
    m.handle().connect();
    m.handle().connect();
    expect(m.log).toEqual(['unchanged', 'completed']);
    await flush();
    expect(m.log).toEqual(['unchanged', 'completed', 'onOpen', 'done', 'completed']);
    release({ ok: true, status: 200, body: { getReader: () => makeStream().reader } });
    await flush();
    // The first request's late answer reaches a closed transport: nothing more.
    expect(m.log).toHaveLength(5);

    const d = mount({ url: 'http://x/stream' });
    d.fetch.respond(() => new Promise(() => {}));
    d.handle().connect();
    d.handle().disconnect();
    // Two tokens, two Completed: the superseded Connect reports Unchanged + Completed, then the Disconnect its own Done + Completed.
    expect(d.log).toEqual(['unchanged', 'completed', 'onClose', 'done', 'completed']);
    expect(d.handle().connectionState).toBe('closed');
  });

  test('E8 unmount tears the connection down: the request aborted, a late frame reaches nobody, no listener fires', async () => {
    const m = mount({ url: 'http://x/stream' });
    const stream = makeStream();
    m.fetch.respond(() => Promise.resolve({ ok: true, status: 200, body: { getReader: () => stream.reader } }));
    m.handle().connect();
    await flush();
    m.log.length = 0;
    m.harness.unmount();
    expect(FakeAbortController.aborted).toBe(1);
    stream.push(frame('late'));
    stream.end();
    await flush();
    expect(m.log).toEqual([]);
    expect(m.handle().messageCount).toBe(0);
  });

  test('E9 the EventSource transport: constructed with the URL and credentials, one listener per named Event Type, open/message/error as the browser reports them, the browser’s own retry counted', async () => {
    const made: Array<{ url: string; init: unknown; listeners: Record<string, (ev: unknown) => void>; es: any }> = [];
    class FakeEventSource {
      readyState = 0;
      onopen: any = null;
      onmessage: any = null;
      onerror: any = null;
      listeners: Record<string, (ev: unknown) => void> = {};
      closed = 0;
      constructor(url: string, init: unknown) {
        made.push({ url, init, listeners: this.listeners, es: this });
      }
      addEventListener(type: string, listener: (ev: unknown) => void) {
        this.listeners[type] = listener;
      }
      close() {
        this.closed++;
      }
    }
    const { lib, harness } = loadLib();
    const timers = makeTimers();
    const log: string[] = [];
    let handle!: Handle;
    harness.render(
      () =>
        (handle = lib.useServerSentEvents(
          SRC,
          { url: 'http://x/es', transport: 'eventsource', withCredentials: true, eventTypes: ' token, message ,done' },
          { onOpen: () => log.push('onOpen'), onMessage: () => log.push(`onMessage:${handle.eventType}:${handle.text}`), onError: () => log.push('onError'), onClose: () => log.push('onClose'), done: () => log.push('done'), failure: () => log.push('failure'), completed: () => log.push('completed') },
          { EventSourceImpl: FakeEventSource, ...timers.env }
        ))
    );
    handle.connect();
    expect(made).toHaveLength(1);
    expect(made[0].url).toBe('http://x/es');
    expect(made[0].init).toEqual({ withCredentials: true });
    expect(Object.keys(made[0].listeners)).toEqual(['token', 'done']);
    made[0].es.onopen();
    expect(handle.connectionState).toBe('open');
    expect(log).toEqual(['onOpen', 'done', 'completed']);
    made[0].es.onmessage({ data: 'plain text', lastEventId: '9' });
    made[0].listeners.token({ data: '{"choices":[{"delta":{"content":"tok"}}]}' });
    expect(log.slice(3)).toEqual(['onMessage:message:plain text', 'onMessage:token:{"choices":[{"delta":{"content":"tok"}}]}']);
    expect([handle.lastEventId, handle.messageCount, handle.deliverySemantics]).toEqual(['9', 2, 'at-least-once-deduped']);
    // readyState 0/1 on error: the browser is retrying — reconnecting, Retry Count up, onError; no timer of ours.
    made[0].es.readyState = 0;
    made[0].es.onerror();
    expect([handle.connectionState, handle.retryCount, handle.lastError]).toEqual(['reconnecting', 1, 'The event stream dropped; the browser is reconnecting']);
    expect(log.slice(5)).toEqual(['onError']);
    expect(timers.timers).toHaveLength(0);
    // readyState 2: the browser gave up — a non-fatal failure, so our backoff takes over and reopens a fresh EventSource.
    made[0].es.readyState = 2;
    made[0].es.onerror();
    expect(handle.lastError).toBe('The event stream closed and the browser stopped retrying');
    expect(made[0].es.closed).toBe(1);
    expect(timers.timers.map((t) => t.ms)).toEqual([2000]);
    timers.fire(0);
    expect(made).toHaveLength(2);
  });

  test('E10 the setters coerce as the runtime’s do: a null URL is no URL (fatal at Connect), an empty Method is GET, a non-object Headers is none, a POST body is JSON with its content type, Authorization carried', async () => {
    const m = mount({ url: null });
    m.handle().connect();
    await flush();
    expect(m.handle().connectionState).toBe('error');
    expect(m.handle().lastError).toBe('No URL was set on the stream');
    expect(m.log).toEqual(['onError', 'onClose', 'failure', 'completed']);
    expect(m.fetch.calls).toHaveLength(0);

    const p = mount({ url: 'http://x/chat', method: 'post', headers: { Authorization: 'Bearer t' }, body: { q: 'hi' }, withCredentials: true });
    p.handle().connect();
    expect(p.fetch.calls[0].init).toEqual({
      method: 'POST',
      headers: { Accept: 'text/event-stream', 'Cache-Control': 'no-store', Authorization: 'Bearer t', 'Content-Type': 'application/json' },
      credentials: 'include',
      body: '{"q":"hi"}',
      signal: { fake: true }
    });

    const q = mount({ url: 'http://x/s', method: '', headers: 'nope', body: 'raw text' });
    q.handle().connect();
    expect(q.fetch.calls[0].init.method).toBe('GET');
    expect(q.fetch.calls[0].init.headers).toEqual({ Accept: 'text/event-stream', 'Cache-Control': 'no-store' });
    expect(q.fetch.calls[0].init.body).toBeUndefined();
  });

  test('E11 Text follows the live Text Path (no path ⇒ Raw; onto an object ⇒ blank; a later path reads the same Data anew); the connection options are read at Connect, so Reconnect On Stream End set later waits for the next Connect; Last-Event-ID rides the reconnect', async () => {
    const m = mount({ url: 'http://x/stream', reconnectDelay: 10 });
    const s1 = makeStream();
    m.fetch.respond((_, n) => (n === 1 ? Promise.resolve({ ok: true, status: 200, body: { getReader: () => s1.reader } }) : Promise.reject(new Error('down'))));
    m.handle().connect();
    await flush();
    s1.push(frame('Hel', 41));
    await flush();
    expect(m.handle().text).toBe(JSON.stringify({ choices: [{ delta: { content: 'Hel' } }] }));
    m.current.options = { url: 'http://x/stream', reconnectDelay: 10, textPath: 'choices.0.delta' };
    m.render();
    expect(m.handle().text).toBe('');
    m.current.options = { url: 'http://x/stream', reconnectDelay: 10, textPath: 'choices.0.delta.content' };
    m.render();
    expect(m.handle().text).toBe('Hel');
    // Reconnect On Stream End set AFTER the Connect: doConnect read `_internal` once, as the runtime's does — the live
    // connection closes cleanly; the flag applies to the next Connect.
    m.current.options = { url: 'http://x/stream', reconnectDelay: 10, textPath: 'choices.0.delta.content', reconnectOnStreamEnd: true };
    m.render();
    s1.end();
    await flush();
    expect(m.handle().connectionState).toBe('closed');
    expect(m.timers.timers).toHaveLength(0);
    // The next Connect carries it: a clean end schedules the reconnect (attempt 0 ⇒ the 10 ms base), and the reopened
    // request carries Last-Event-ID: 41 — the furthest id this connection saw.
    const s2 = makeStream();
    m.fetch.respond((_, n) => (n === 2 ? Promise.resolve({ ok: true, status: 200, body: { getReader: () => s2.reader } }) : Promise.resolve({ ok: true, status: 200, body: { getReader: () => makeStream().reader } })));
    m.handle().connect();
    await flush();
    s2.push(frame('again', 41));
    await flush();
    s2.end();
    await flush();
    expect(m.handle().connectionState).toBe('reconnecting');
    expect(m.timers.timers.map((t) => t.ms)).toEqual([10]);
    m.timers.fire(0);
    expect(m.fetch.calls).toHaveLength(3);
    expect(m.fetch.calls[2].init.headers['Last-Event-ID']).toBe('41');
  });

  test('E12 EXP-011 §66.5 — an option passed as undefined (a Variable nothing has written) is NOT a delivery: Auto Reconnect undefined keeps the runtime default true (a failure retries); Auto Connect true then undefined keeps connecting-on-URL rather than switching off', async () => {
    const m = mount({ url: 'http://x/stream', autoReconnect: undefined, reconnectDelay: 0 });
    m.fetch.respond((_, n) => (n === 1 ? Promise.reject(new TypeError('Failed to fetch')) : Promise.resolve({ ok: true, status: 200, body: { getReader: () => makeStream().reader } })));
    m.handle().connect();
    await flush();
    expect([m.handle().connectionState, m.handle().retryCount]).toEqual(['reconnecting', 1]);
    expect(m.timers.timers.map((t) => t.ms)).toEqual([1000]);
    const a = mount({ url: 'http://x/one', autoConnect: true });
    expect(a.fetch.calls.map((c) => c.url)).toEqual(['http://x/one']);
    await flush();
    a.current.options = { url: 'http://x/two', autoConnect: undefined };
    a.render();
    expect(a.fetch.calls.map((c) => c.url)).toEqual(['http://x/one', 'http://x/two']);
  });

});

// ---------------------------------------------------------------------------------------------------
describe('§F the ledger', () => {
  test('F1 the row moved to translated with a note; the card carries no badge; the floor is 117 (§66) with §64’s sentence still in it', () => {
    expect(ledgerEntryOf(SSE_TYPE)?.status).toBe('translated');
    expect(exportBadgeOf(SSE_TYPE)).toBeUndefined();
    const ledger = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'coverage-ledger.json'), 'utf8'));
    const row = (ledger.entries as Array<{ typeName: string; note?: string; exemption?: string }>).find((e) => e.typeName === SSE_TYPE)!;
    expect(row.exemption).toBeUndefined();
    expect(String(row.note)).toContain('useServerSentEvents');
    expect(ledger.pickerCoverageFloor).toBe(117); // §66 Subscribe To Changes (session 90) on top of §65 WebSocket (session 89) on top of §64 Server-Sent Events (session 88) on top of the Tier 2.8 rows
    expect(String(ledger.$pickerCoverageFloorComment)).toContain('115 after Tier 3.11 row 1 Server-Sent Events');
    // §65 translated WebSocket and §66 Subscribe To Changes — Tier 3.11 is complete, and no scheduled row remains (subscribe-to-changes.test F2).
    expect(exportBadgeOf('net.noodl.WebSocket')).toBeUndefined();
    expect(exportBadgeOf('SubscribeToChanges')).toBeUndefined();
  });
});
