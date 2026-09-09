import * as fs from 'fs';
import * as path from 'path';

import * as ts from 'typescript';

import { Catalog, CatalogIndex, loadCatalog } from '../src/catalog';
import { ComponentPlan, STREAM_BUFFER_TYPE, STREAM_NODES, STREAM_PARSER_TYPE, TEXT_ACCUMULATOR_TYPE, planProject } from '../src/analyze/plan';
import { emitApp } from '../src/emit/emitApp';
import { ERRORS_LIB_PATH } from '../src/emit/errorsLib';
import { STREAMING_LIB_PATH, streamingLibSource } from '../src/emit/streamingLib';
import { summarizePreflight } from '../src/emit/preflight';
import { exportBadgeOf, ledgerEntryOf } from '../src/ledger';
import { parseProject } from '../src/parse/parseProject';
import { typecheckEmittedApp } from './helpers/typecheckApp';
import { ComponentIR, ConnectionIR, ExportIR, NodeIR, ParamValue } from '../src/ir/types';

/**
 * EXP-011 §58 — the streaming trio (Tier 2.8 row 8): `JSON Stream Parser`, `Stream Buffer`, `Text Accumulator`.
 * Type ids `net.noodl.JSONStreamParser` / `net.noodl.StreamBuffer` / `net.noodl.TextAccumulator`.
 *
 * Each is one hook over one `_internal`: `src/lib/streaming.ts` transcribes `agent/stream-parsers.ts`'s cores and
 * the three node files as pure functions over a state object that return the ORDERED event list the runtime would
 * issue (signals, raises, the buffer's timer instructions), and three hooks that deliver them. The data port is
 * read at the pulse (`parse(chunk)` / `add(data)`: the setter, then the action); the config is read live off an
 * options object; the value outputs are live getters on the handle; a Failure raises on the error channel with the
 * node's own provenance.
 *
 * Measured before the build (probe-reverted.log, HEAD 042f221c): the three nodes `logic node (<type id>)`, three
 * roots (none a pathway), seven silenced (the three status setters, their constants, the buffer's constant), every
 * wire into or out of them dropped, the Load buttons translating on their own.
 *
 * §A the plan · §B the emitted page · §C the lib's text · §D the pure cores under node (the chunk-boundary table)
 * · §E the hooks under a hook harness (listeners in order, live getters, the raise, the timer under fake timers)
 * · §F the refused shapes, by mutation · §G the report and the pre-flight · §H the ledger · §I every variant
 * typechecks · §J the controls.
 */

const FIXTURE = path.join(__dirname, 'fixtures', 'stream-desk');
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

const PARSER_LINE = "  const parser = useJsonStreamParser({ label: 'Parser', nodeId: 'parser', componentName: '/Pages/Home' }, { format: 'ndjson' }, {\n    success: () => status.set('parsed')\n  });";
const ACC_LINE = "  const acc = useTextAccumulator({ label: 'Acc', nodeId: 'acc', componentName: '/Pages/Home' }, { delimiter: '|' }, {\n    messageReceived: () => status.set('message')\n  });";
const BUFFER_LINE = "  const buffer = useStreamBuffer({ label: 'Buffer', nodeId: 'buffer', componentName: '/Pages/Home' }, { maxSize: 3 }, {\n    flushed: () => status.set('flushed')\n  });";

// ---------------------------------------------------------------------------------------------------
describe('§A the plan — three hooks, the data read at the pulse, the config as options, the listeners as chains', () => {
  const home = project.plans.find((p) => p.path === HOME)!;

  test('the three nodes are hosted, in node order, with the authored labels and the minted locals', () => {
    expect(home.streams.map((s) => [s.nodeId, s.kind, s.label, s.local])).toEqual([
      ['parser', 'parser', 'Parser', 'parser'],
      ['acc', 'accumulator', 'Acc', 'acc'],
      ['buffer', 'buffer', 'Buffer', 'buffer']
    ]);
    for (const id of ['parser', 'acc', 'buffer']) expect(home.dispositions[id]).toEqual({ kind: 'collapsed', into: HOME_FILE });
    expect(home.refusals).toEqual([]);
  });

  test("the parser: Chunk is the `chunk` Variable's read, Format the authored literal, Success the status write", () => {
    const parser = home.streams[0];
    expect(parser.data).toEqual({ kind: 'store-get', variableName: 'chunk' });
    expect(parser.config).toEqual([{ port: 'format', expr: { kind: 'literal', value: 'ndjson' } }]);
    expect(parser.listeners).toEqual({ success: [{ kind: 'store-set', variableName: 'status', expr: { kind: 'literal', value: 'parsed' } }] });
  });

  test('the buffer: Data is the folded constant, Max Size the authored number, Flushed the status write; the accumulator likewise', () => {
    const buffer = home.streams[2];
    expect(buffer.data).toEqual({ kind: 'literal', value: 'tick' });
    expect(buffer.config).toEqual([{ port: 'maxSize', expr: { kind: 'literal', value: 3 } }]);
    expect(Object.keys(buffer.listeners)).toEqual(['flushed']);
    const acc = home.streams[1];
    expect(acc.data).toEqual({ kind: 'store-get', variableName: 'token' });
    expect(acc.config).toEqual([{ port: 'delimiter', expr: { kind: 'literal', value: '|' } }]);
    expect(Object.keys(acc.listeners)).toEqual(['messageReceived']);
  });

  test('the Parse handler carries the Chunk read at the pulse; Clear and Flush carry nothing; Add carries the constant', () => {
    const byPort = home.handlers['parseBtn']?.['onClick'] ?? [];
    expect(byPort).toEqual([{ kind: 'stream-action', nodeId: 'parser', local: 'parser', verb: 'parse', value: { kind: 'store-get', variableName: 'chunk' } }]);
    expect(home.handlers['clearParserBtn']?.['onClick']).toEqual([{ kind: 'stream-action', nodeId: 'parser', local: 'parser', verb: 'clear' }]);
    expect(home.handlers['flushBtn']?.['onClick']).toEqual([{ kind: 'stream-action', nodeId: 'buffer', local: 'buffer', verb: 'flush' }]);
    expect(home.handlers['pushBtn']?.['onClick']).toEqual([{ kind: 'stream-action', nodeId: 'buffer', local: 'buffer', verb: 'add', value: { kind: 'literal', value: 'tick' } }]);
  });

  test('every value read is a binding off the handle, typed by the table', () => {
    expect(home.bindings.valuesText?.text).toEqual({ kind: 'computed', expr: { kind: 'stream-out', nodeId: 'parser', local: 'parser', node: 'parser', field: 'values', tsType: 'unknown[]' } });
    expect(home.bindings.isCompleteText?.text).toEqual({ kind: 'computed', expr: { kind: 'stream-out', nodeId: 'parser', local: 'parser', node: 'parser', field: 'isComplete', tsType: 'boolean' } });
    expect(home.bindings.lastMessageText?.text).toEqual({ kind: 'computed', expr: { kind: 'stream-out', nodeId: 'acc', local: 'acc', node: 'accumulator', field: 'lastMessage', tsType: 'string' } });
    expect(home.bindings.droppedText?.text).toEqual({ kind: 'computed', expr: { kind: 'stream-out', nodeId: 'buffer', local: 'buffer', node: 'buffer', field: 'droppedItems', tsType: 'number' } });
  });

  test("the table is the catalog's port set: every input and output of the three nodes is in it, and nothing else", () => {
    for (const [type, spec] of Object.entries(STREAM_NODES)) {
      const node = catalog.nodes.find((n) => n.typeName === type)!;
      const inputs = (node.inputs ?? []).map((p) => p.name).sort();
      const outputs = (node.outputs ?? []).map((p) => p.name).sort();
      // §64 made the data port optional (the SSE has none) — the row now grades the table's fourth member too. §66's Class is a
      // config port the runtime DISCOVERS (`param: 'collectionName'`, `dynamicPorts.mechanisms: runtime-discovered`), so the catalog
      // declares it nowhere: a config entry carrying `param` is graded as absent from the catalog, and present on disk by name.
      expect({ type, inputs }).toEqual({ type, inputs: [...(spec.data !== undefined ? [spec.data.port] : []), ...spec.config.filter((c) => c.param === undefined).map((c) => c.port), ...Object.keys(spec.actions)].sort() });
      expect({ type, outputs }).toEqual({ type, outputs: [...spec.signals, ...Object.keys(spec.values)].sort() });
    }
  });
});

// ---------------------------------------------------------------------------------------------------
describe('§B the emitted page', () => {
  const page = app.files[HOME_FILE];

  test('one import of the three hooks, sorted', () => {
    expect(page).toContain("import { useJsonStreamParser, useStreamBuffer, useTextAccumulator } from '../lib/streaming';");
  });

  test('the three hook lines: provenance, the authored config, the listener inline — after the state rows, before the return', () => {
    expect(page).toContain(PARSER_LINE);
    expect(page).toContain(ACC_LINE);
    expect(page).toContain(BUFFER_LINE);
    expect(page.indexOf('const statusValue = useValue(status);')).toBeLessThan(page.indexOf(PARSER_LINE));
    expect(page.indexOf(BUFFER_LINE)).toBeLessThan(page.indexOf('  return ('));
  });

  test('the handlers: the Chunk read at the pulse off the store, the constant folded, the bare verbs', () => {
    expect(page).toContain('<button onClick={() => parser.parse(chunk.get())}>Parse</button>');
    expect(page).toContain('<button onClick={() => parser.clear()}>Clear parser</button>');
    expect(page).toContain('<button onClick={() => acc.add(token.get())}>Add token</button>');
    expect(page).toContain("<button onClick={() => buffer.add('tick')}>Push tick</button>");
    expect(page).toContain('<button onClick={() => buffer.flush()}>Flush</button>');
  });

  test('the sinks, by the declared port type: an array port is JSON, a number or boolean is String(), a string is bare', () => {
    expect(page).toContain('<p className={styles.text}>{JSON.stringify(parser.values)}</p>');
    expect(page).toContain('<p className={styles.text}>{String(parser.valueCount)}</p>');
    expect(page).toContain('<p className={styles.text}>{String(parser.pendingCharacters)}</p>');
    expect(page).toContain('<p className={styles.text}>{String(parser.isComplete)}</p>');
    expect(page).toContain('<p className={styles.text}>{parser.error}</p>');
    expect(page).toContain('<p className={styles.text}>{acc.accumulated}</p>');
    expect(page).toContain('<p className={styles.text}>{String(acc.messageCount)}</p>');
    expect(page).toContain('<p className={styles.text}>{acc.lastMessage}</p>');
    expect(page).toContain('<p className={styles.text}>{JSON.stringify(buffer.flushedData)}</p>');
    expect(page).toContain('<p className={styles.text}>{String(buffer.droppedItems)}</p>');
  });

  test("a `*` port (Parsed) at a text sink takes the untyped Variable's cast; a number sink takes a number bare and refuses a string; a truthy sink takes the boolean bare", () => {
    const ir = cloneIr();
    const home = componentOf(ir, HOME);
    disconnect(home, (c) => c.fromId === 'parser' && c.toId === 'valuesText');
    connect(home, 'parser', 'parsed', 'valuesText', 'text', 'value');
    connect(home, 'parser', 'isComplete', 'pendingText', 'visible', 'value');
    const built = emitApp(ir, catalog);
    expect(built.files[HOME_FILE]).toContain("{String(parser.parsed ?? '')}");
    expect(built.files[HOME_FILE]).toContain('!parser.isComplete && styles.hiddenKeepSpace');
    expect(typecheckEmittedApp(built)).toEqual([]);
  });

  test('a wired config from a Variable is a render read, printed into the options and read live by the hook', () => {
    const ir = cloneIr();
    const home = componentOf(ir, HOME);
    connect(home, 'tokenVar', 'value', 'acc', 'delimiter', 'value');
    const built = emitApp(ir, catalog);
    expect(planOf(ir, HOME).streams[1].config).toEqual([{ port: 'delimiter', expr: { kind: 'store-get', variableName: 'token' } }]);
    expect(built.files[HOME_FILE]).toContain('const tokenValue = useValue(token);');
    expect(built.files[HOME_FILE]).toContain("useTextAccumulator({ label: 'Acc', nodeId: 'acc', componentName: '/Pages/Home' }, { delimiter: tokenValue }, {");
    expect(typecheckEmittedApp(built)).toEqual([]);
  });

  test('a data port with no source: the call takes no argument (the setter never ran), and the app still typechecks', () => {
    const ir = cloneIr();
    const home = componentOf(ir, HOME);
    disconnect(home, (c) => c.toId === 'buffer' && c.toProperty === 'data');
    const built = emitApp(ir, catalog);
    expect(planOf(ir, HOME).streams[2].data).toBeUndefined();
    expect(built.files[HOME_FILE]).toContain('<button onClick={() => buffer.add()}>Push tick</button>');
    expect(typecheckEmittedApp(built)).toEqual([]);
  });

  test('no config authored: the options object is empty, and the hook keeps initialize()’s values', () => {
    const ir = cloneIr();
    nodeOf(ir, HOME, 'parser').parameters = [];
    const built = emitApp(ir, catalog);
    expect(built.files[HOME_FILE]).toContain("useJsonStreamParser({ label: 'Parser', nodeId: 'parser', componentName: '/Pages/Home' }, {}, {");
  });
});

// ---------------------------------------------------------------------------------------------------
describe("§C the lib's text — src/lib/streaming.ts, shipped and transcribed", () => {
  const lib = app.files[STREAMING_LIB_PATH];

  test('shipped exactly as the generator writes it, with the module header, beside errors.ts', () => {
    expect(STREAMING_LIB_PATH).toBe('src/lib/streaming.ts');
    expect(lib.endsWith(streamingLibSource())).toBe(true);
    expect(lib.startsWith('// @nodegx:generated')).toBe(true);
    expect(lib).toContain("import { raiseAppError } from './errors';");
    expect(app.files[ERRORS_LIB_PATH]).toBeDefined();
  });

  test("the runtime's three codes, its give-up sentence, its no-data sentence and its mis-wiring sentence", () => {
    expect(lib).toContain("const PARSE_ERROR_CODE = 'json-stream-parser/parse-failed';");
    expect(lib).toContain("const NO_DATA_CODE = 'stream-buffer/no-data';");
    expect(lib).toContain("const CHUNK_ERROR_CODE = 'text-accumulator/chunk-not-text';");
    expect(lib).toContain("'Gave up on ' + state.maxLength + '+ characters of unparsed text; check the Format setting'");
    expect(lib).toContain("'Nothing to add — no value has arrived on the Data input'");
    expect(lib).toContain("'Chunk must be text, but ' + shape + ' arrived, so nothing was appended. '");
  });

  test("reportOutcome: the raise before the failure pulse, Completed after every outcome, Unchanged never raising", () => {
    const at = lib.indexOf("if (outcome === 'failure' && failure !== undefined && failure.raise !== false) {");
    expect(at).toBeGreaterThan(0);
    expect(lib.indexOf("events.push({ kind: 'signal', name: outcome });", at)).toBeGreaterThan(at);
    expect(lib.indexOf("events.push({ kind: 'signal', name: 'completed' });", at)).toBeGreaterThan(lib.indexOf("events.push({ kind: 'signal', name: outcome });", at));
  });
});

// ---------------------------------------------------------------------------------------------------
// §D / §E — the lib under node. The Run Tasks spec's hook harness; `./errors` is a recording stub.
// ---------------------------------------------------------------------------------------------------
type AppError = { code: string; message: string; nodeId: string; nodeType: string; componentName: string; detail?: unknown };
type Ev = { kind: 'signal'; name: string } | { kind: 'raise'; code: string; message: string } | { kind: 'arm-timer' } | { kind: 'stop-timer' };
type ParserState = { pendingChunk: string; buffer: string; format: string; maxLength: number; parsed: unknown; values: unknown[]; totalValues: number; error: string; errorCount: number; isComplete: boolean };
type BufferState = { pendingData: unknown; hasPendingData: boolean; buffer: unknown[]; flushedData: unknown[]; flushCount: number; droppedItems: number; flushSize: number; flushInterval: number; maxSize: number; lastError: string | undefined };
type AccState = { pendingChunk: string; buffer: string; messages: string[]; lastMessage: string; delimiter: string; maxLength: number; maxMessages: number; droppedCharacters: number; droppedMessages: number; error: string };
type Source = { label: string; nodeId: string; componentName: string };
type Lib = {
  splitDelimited: (buffer: string, delimiter: string) => { messages: string[]; rest: string };
  scanJsonValues: (buffer: string, options?: { arrayFraming?: boolean }) => { values: unknown[]; rest: string; errors: string[] };
  utf8ByteLength: (text: string) => number;
  truncateHead: (text: string, max: number) => { text: string; dropped: number };
  createParserState: () => ParserState;
  applyParserOptions: (s: ParserState, o: Record<string, unknown>) => void;
  parserSetChunk: (s: ParserState, v: unknown) => void;
  parserParse: (s: ParserState) => Ev[];
  parserClear: (s: ParserState) => Ev[];
  createBufferState: () => BufferState;
  applyBufferOptions: (s: BufferState, o: Record<string, unknown>) => Ev[];
  bufferSetData: (s: BufferState, v: unknown) => void;
  bufferAdd: (s: BufferState) => Ev[];
  bufferFlush: (s: BufferState, owned: boolean) => Ev[];
  bufferClear: (s: BufferState) => Ev[];
  createAccumulatorState: () => AccState;
  applyAccumulatorOptions: (s: AccState, o: Record<string, unknown>) => void;
  accumulatorSetChunk: (s: AccState, v: unknown) => Ev[];
  accumulatorAdd: (s: AccState) => Ev[];
  accumulatorClear: (s: AccState) => Ev[];
  useJsonStreamParser: (source: Source, options?: Record<string, unknown>, on?: Record<string, () => void>) => any;
  useStreamBuffer: (source: Source, options?: Record<string, unknown>, on?: Record<string, () => void>) => any;
  useTextAccumulator: (source: Source, options?: Record<string, unknown>, on?: Record<string, () => void>) => any;
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
const loadLib = (): { lib: Lib; harness: Harness; raised: AppError[] } => {
  const harness = makeHarness();
  const raised: AppError[] = [];
  const js = ts.transpileModule(streamingLibSource(), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const module = { exports: {} as Lib };
  // eslint-disable-next-line no-new-func
  new Function('require', 'module', 'exports', js)(
    (name: string) => {
      if (name === 'react') return harness.React;
      if (name === './errors') return { raiseAppError: (error: AppError) => raised.push(error) };
      throw new Error(`unexpected import ${name}`);
    },
    module,
    module.exports
  );
  return { lib: module.exports, harness, raised };
};
const names = (events: Ev[]) => events.map((e) => (e.kind === 'signal' ? e.name : e.kind === 'raise' ? `raise:${e.code}` : e.kind));
const SRC: Source = { label: 'Parser', nodeId: 'p1', componentName: '/Pages/Home' };

describe('§D the pure cores run the way stream-parsers.ts and the three node files do (under node)', () => {
  const { lib } = loadLib();
  /** A parser fed chunk by chunk: the event names per Parse, and the state after. */
  const feed = (format: string, chunks: unknown[], options: Record<string, unknown> = {}) => {
    const s = lib.createParserState();
    lib.applyParserOptions(s, { format, ...options });
    const rounds: string[][] = [];
    for (const chunk of chunks) {
      lib.parserSetChunk(s, chunk);
      rounds.push(names(lib.parserParse(s)));
    }
    return { s, rounds };
  };

  test('ndjson: a line completes only at its newline; the tail waits; a later chunk completes it', () => {
    const { s, rounds } = feed('ndjson', ['{"a":1}\n{"b"', ':2}\n']);
    expect(rounds).toEqual([['success', 'done', 'completed'], ['success', 'done', 'completed']]);
    expect(s.values).toEqual([{ b: 2 }]);
    expect(s.parsed).toEqual({ b: 2 });
    expect(s.totalValues).toBe(2);
    expect(s.buffer).toBe('');
    expect(s.isComplete).toBe(true);
  });

  test('ndjson: a chunk that merely advances a line is Done and quiet (no Success); Pending Characters says so', () => {
    const { s, rounds } = feed('ndjson', ['{"id":1,"name":"A']);
    expect(rounds).toEqual([['done', 'completed']]);
    expect(s.buffer.length).toBe(17);
    expect(s.isComplete).toBe(false);
    expect(s.totalValues).toBe(0);
  });

  test('ndjson: a line that will not parse is an Error and a Failure (raised), the stream goes on; blank lines are skipped', () => {
    const { s, rounds } = feed('ndjson', ['nope\n\n{"ok":true}\n']);
    expect(rounds).toEqual([['success', 'raise:json-stream-parser/parse-failed', 'failure', 'completed']]);
    expect(s.values).toEqual([{ ok: true }]);
    expect(s.errorCount).toBe(1);
    expect(s.error.startsWith('Line did not parse as JSON: ')).toBe(true);
  });

  test('stream: two documents in one chunk; a boundary inside a string, inside an escape, inside a number', () => {
    expect(feed('stream', ['{"a":1}{"b":2}']).s.values).toEqual([{ a: 1 }, { b: 2 }]);
    const inString = feed('stream', ['{"s":"ab', 'c"}']);
    expect(inString.rounds).toEqual([['done', 'completed'], ['success', 'done', 'completed']]);
    expect(inString.s.parsed).toEqual({ s: 'abc' });
    const inEscape = feed('stream', ['{"s":"a\\', '"b"}']);
    expect(inEscape.rounds[0]).toEqual(['done', 'completed']);
    expect(inEscape.s.parsed).toEqual({ s: 'a"b' });
    // A scalar waits for a terminator: `2` at the end of a buffer might still become `23`.
    const inNumber = feed('stream', ['[1,2', '3]']);
    expect(inNumber.rounds).toEqual([['success', 'done', 'completed'], ['success', 'done', 'completed']]);
    expect(inNumber.s.values).toEqual([23]);
    expect(inNumber.s.totalValues).toBe(2);
  });

  test('stream: a JSON array arriving element by element yields its elements; the framing punctuation is skipped', () => {
    const { s, rounds } = feed('stream', ['[{"a":1},', '{"b":2}]']);
    expect(rounds).toEqual([['success', 'done', 'completed'], ['success', 'done', 'completed']]);
    expect(s.totalValues).toBe(2);
    expect(s.buffer).toBe('');
  });

  test('single: the first complete document only; the rest stays pending and Is Complete says false', () => {
    const { s, rounds } = feed('single', ['{"a":', '1} trailing']);
    expect(rounds).toEqual([['done', 'completed'], ['success', 'done', 'completed']]);
    expect(s.parsed).toEqual({ a: 1 });
    // The runtime's answer, not mine: the scanner skips the whitespace before it finds the unterminated scalar, so the space is consumed.
    expect(s.buffer).toBe('trailing');
    expect(s.isComplete).toBe(false);
  });

  test('an unknown Format name falls to the stream branch, as the runtime’s else does; the setter’s empty string is ndjson', () => {
    expect(feed('bogus', ['{"a":1}{"b":2}']).s.totalValues).toBe(2);
    const s = lib.createParserState();
    lib.applyParserOptions(s, { format: '' });
    expect(s.format).toBe('ndjson');
  });

  test('Max Pending exceeded: the buffer is dropped loudly — Error, Failure raised, and Is Complete untouched', () => {
    const { s, rounds } = feed('ndjson', ['{"aaaaaaaa'], { maxLength: 5 });
    expect(rounds).toEqual([['raise:json-stream-parser/parse-failed', 'failure', 'completed']]);
    expect(s.buffer).toBe('');
    expect(s.error).toBe('Gave up on 5+ characters of unparsed text; check the Format setting');
    expect(s.errorCount).toBe(1);
    expect(s.isComplete).toBe(false);
  });

  test('Parse with nothing pending is Unchanged; Clear with nothing is Cleared then Unchanged; Clear after values is Done', () => {
    const s = lib.createParserState();
    expect(names(lib.parserParse(s))).toEqual(['unchanged', 'completed']);
    expect(names(lib.parserClear(s))).toEqual(['cleared', 'unchanged', 'completed']);
    lib.parserSetChunk(s, '{"a":1}\n');
    lib.parserParse(s);
    expect(names(lib.parserClear(s))).toEqual(['cleared', 'done', 'completed']);
    expect(s).toMatchObject({ buffer: '', values: [], parsed: undefined, error: '', errorCount: 0, totalValues: 0, isComplete: false });
  });

  test('the Chunk setter: undefined and null clear it, a number is text, and the chunk is retained between pulses', () => {
    const s = lib.createParserState();
    lib.applyParserOptions(s, { format: 'ndjson' });
    lib.parserSetChunk(s, 7);
    expect(s.pendingChunk).toBe('7');
    lib.parserSetChunk(s, null);
    expect(s.pendingChunk).toBe('');
    lib.parserSetChunk(s, '{"n":1}\n');
    lib.parserParse(s);
    lib.parserParse(s);
    expect(s.totalValues).toBe(2);
  });

  test('accumulator: the delimiter at a chunk edge, two messages in one Add, an empty delimiter never splits', () => {
    const s = lib.createAccumulatorState();
    lib.applyAccumulatorOptions(s, { delimiter: '|' });
    lib.accumulatorSetChunk(s, 'Hello, wor');
    expect(names(lib.accumulatorAdd(s))).toEqual(['changed', 'done', 'completed']);
    lib.accumulatorSetChunk(s, 'ld|Bye|');
    expect(names(lib.accumulatorAdd(s))).toEqual(['messageReceived', 'changed', 'done', 'completed']);
    expect(s.messages).toEqual(['Hello, world', 'Bye']);
    expect(s.lastMessage).toBe('Bye');
    expect(s.buffer).toBe('');
    lib.accumulatorSetChunk(s, 'a');
    lib.accumulatorAdd(s);
    lib.accumulatorSetChunk(s, '|');
    expect(names(lib.accumulatorAdd(s))).toEqual(['messageReceived', 'changed', 'done', 'completed']);
    expect(s.messages).toEqual(['Hello, world', 'Bye', 'a']);
    const none = lib.createAccumulatorState();
    lib.applyAccumulatorOptions(none, { delimiter: '' });
    lib.accumulatorSetChunk(none, 'x\ny\n');
    lib.accumulatorAdd(none);
    expect(none.messages).toEqual([]);
    expect(none.buffer).toBe('x\ny\n');
  });

  test('accumulator: Max Length drops from the front (Overflowed), Max Messages drops the oldest (Overflowed), Byte Count is UTF-8', () => {
    const s = lib.createAccumulatorState();
    lib.applyAccumulatorOptions(s, { delimiter: '', maxLength: 4 });
    lib.accumulatorSetChunk(s, 'abcdef');
    expect(names(lib.accumulatorAdd(s))).toEqual(['overflowed', 'changed', 'done', 'completed']);
    expect(s.buffer).toBe('cdef');
    expect(s.droppedCharacters).toBe(2);
    const m = lib.createAccumulatorState();
    lib.applyAccumulatorOptions(m, { delimiter: '|', maxMessages: 1 });
    lib.accumulatorSetChunk(m, 'one|two|');
    expect(names(lib.accumulatorAdd(m))).toEqual(['overflowed', 'messageReceived', 'changed', 'done', 'completed']);
    expect(m.messages).toEqual(['two']);
    expect(m.droppedMessages).toBe(1);
    expect(lib.utf8ByteLength('héllo €')).toBe(10);
  });

  test('accumulator: a non-text chunk is refused by name — Error, the Failure pulse then the raise, once per distinct message; the Add is Unchanged; text clears it', () => {
    const s = lib.createAccumulatorState();
    const first = lib.accumulatorSetChunk(s, { delta: 'Hi' });
    expect(names(first)).toEqual(['failure', 'raise:text-accumulator/chunk-not-text']);
    expect(s.error.startsWith('Chunk must be text, but an object arrived, so nothing was appended.')).toBe(true);
    expect(names(lib.accumulatorAdd(s))).toEqual(['unchanged', 'completed']);
    expect(names(lib.accumulatorSetChunk(s, { delta: 'again' }))).toEqual([]);
    expect(names(lib.accumulatorSetChunk(s, [1]))).toEqual(['failure', 'raise:text-accumulator/chunk-not-text']);
    expect(s.error).toContain('an array arrived');
    lib.accumulatorSetChunk(s, 42);
    expect(s.error).toBe('');
    expect(s.pendingChunk).toBe('42');
    expect(names(lib.accumulatorSetChunk(s, undefined))).toEqual([]);
    expect(s.pendingChunk).toBe('');
  });

  test('accumulator: Clear counts a refused chunk’s Error as something to clear', () => {
    const s = lib.createAccumulatorState();
    expect(names(lib.accumulatorClear(s))).toEqual(['cleared', 'unchanged', 'completed']);
    lib.accumulatorSetChunk(s, new Date());
    expect(names(lib.accumulatorClear(s))).toEqual(['cleared', 'done', 'completed']);
    expect(s.error).toBe('');
  });

  test('buffer: Add before any Data is a raised Failure; adds are Done; Flush hands over a fresh array; an empty Flush is Unchanged with no Flushed', () => {
    const s = lib.createBufferState();
    expect(names(lib.bufferAdd(s))).toEqual(['raise:stream-buffer/no-data', 'failure', 'completed']);
    expect(s.lastError).toBe('Nothing to add — no value has arrived on the Data input');
    lib.bufferSetData(s, 'a');
    expect(names(lib.bufferAdd(s))).toEqual(['arm-timer', 'done', 'completed']);
    lib.bufferSetData(s, 'b');
    lib.bufferAdd(s);
    const live = s.buffer;
    expect(names(lib.bufferFlush(s, true))).toEqual(['stop-timer', 'flushed', 'done', 'completed']);
    expect(s.flushedData).toEqual(['a', 'b']);
    expect(s.flushedData).toBe(live);
    expect(s.buffer).toEqual([]);
    expect(s.buffer).not.toBe(live);
    expect(s.flushCount).toBe(1);
    expect(names(lib.bufferFlush(s, true))).toEqual(['stop-timer', 'unchanged', 'completed']);
    // The interval timer's own flush: no token, so Flushed only — and nothing at all when empty.
    expect(names(lib.bufferFlush(s, false))).toEqual(['stop-timer']);
    lib.bufferAdd(s);
    expect(names(lib.bufferFlush(s, false))).toEqual(['stop-timer', 'flushed']);
  });

  test('buffer: Max Size drops the oldest (Overflowed inside a Done Add); a reached Flush Size flushes with the Add’s one token', () => {
    const s = lib.createBufferState();
    lib.applyBufferOptions(s, { maxSize: 2 });
    for (const v of [1, 2, 3]) {
      lib.bufferSetData(s, v);
      var last = names(lib.bufferAdd(s));
    }
    expect(last!).toEqual(['overflowed', 'arm-timer', 'done', 'completed']);
    expect(s.buffer).toEqual([2, 3]);
    expect(s.droppedItems).toBe(1);
    const f = lib.createBufferState();
    lib.applyBufferOptions(f, { flushSize: 2 });
    lib.bufferSetData(f, 'x');
    lib.bufferAdd(f);
    expect(names(lib.bufferAdd(f))).toEqual(['stop-timer', 'flushed', 'done', 'completed']);
    expect(f.flushedData).toEqual(['x', 'x']);
  });

  test('buffer: Clear reads what there was before the reset; the setters coerce as the ports do; a changed interval re-arms only with something buffered', () => {
    const s = lib.createBufferState();
    expect(names(lib.bufferClear(s))).toEqual(['stop-timer', 'cleared', 'unchanged', 'completed']);
    lib.bufferSetData(s, 1);
    lib.bufferAdd(s);
    expect(names(lib.bufferClear(s))).toEqual(['stop-timer', 'cleared', 'done', 'completed']);
    expect(s).toMatchObject({ buffer: [], flushedData: [], droppedItems: 0, flushCount: 0 });
    expect(names(lib.applyBufferOptions(s, { flushInterval: 50 }))).toEqual(['stop-timer']);
    expect(names(lib.applyBufferOptions(s, { flushInterval: 50 }))).toEqual([]);
    lib.bufferAdd(s);
    expect(names(lib.applyBufferOptions(s, { flushInterval: 80 }))).toEqual(['stop-timer', 'arm-timer']);
    lib.applyBufferOptions(s, { flushSize: -3, maxSize: 0, flushInterval: 'x' });
    expect(s).toMatchObject({ flushSize: 0, maxSize: 0, flushInterval: 0 });
  });

  test('EXP-011 §66.5 — an option passed as undefined (a Variable nothing has written) is NOT a delivery: the parser keeps its 1 MiB and ndjson, the buffer its 10000 (and re-arms nothing), the accumulator its newline / 1 MiB / 1000', () => {
    const p = lib.createParserState();
    lib.applyParserOptions(p, { format: undefined, maxLength: undefined });
    expect([p.format, p.maxLength]).toEqual(['ndjson', 1024 * 1024]);
    const b = lib.createBufferState();
    expect(lib.applyBufferOptions(b, { flushSize: undefined, flushInterval: undefined, maxSize: undefined })).toEqual([]);
    expect([b.flushSize, b.flushInterval, b.maxSize]).toEqual([0, 0, 10000]);
    const a = lib.createAccumulatorState();
    lib.applyAccumulatorOptions(a, { delimiter: undefined, maxLength: undefined, maxMessages: undefined });
    expect([a.delimiter, a.maxLength, a.maxMessages]).toEqual(['\n', 1024 * 1024, 1000]);
  });

});

describe('§E the hooks under the harness — the listeners in order, the live getters, the raise, the timer', () => {
  test('the parser: listeners fire in the runtime’s order, the getters read live inside a listener, the host re-renders', () => {
    const { lib, harness, raised } = loadLib();
    const log: string[] = [];
    let handle: any;
    const render = () =>
      harness.render(() => (handle = lib.useJsonStreamParser(SRC, { format: 'ndjson' }, { success: () => log.push(`success:${handle.valueCount}`), done: () => log.push('done'), failure: () => log.push('failure'), completed: () => log.push('completed'), unchanged: () => log.push('unchanged') })));
    render();
    expect(handle.valueCount).toBe(0);
    expect(handle.parsed).toBeUndefined();
    const before = harness.renders;
    handle.parse('{"a":1}\nbad\n');
    expect(log).toEqual(['success:1', 'failure', 'completed']);
    expect(raised).toEqual([{ code: 'json-stream-parser/parse-failed', message: expect.stringContaining('Line did not parse as JSON'), nodeId: 'p1', nodeType: 'net.noodl.JSONStreamParser', componentName: '/Pages/Home' }]);
    expect(handle.values).toEqual([{ a: 1 }]);
    expect(handle.errorCount).toBe(1);
    render();
    expect(harness.renders).toBeGreaterThan(before);
    // The chunk is retained between pulses: a bare Parse appends it AGAIN (the runtime's own description of the port).
    handle.parse();
    expect(log.slice(3)).toEqual(['success:2', 'failure', 'completed']);
    expect(handle.isComplete).toBe(true);
    // An empty chunk delivered: nothing pending, Unchanged.
    handle.parse(null);
    expect(log.slice(6)).toEqual(['unchanged', 'completed']);
  });

  test('the parser: the options are read live — the latest render’s Format decides the next Parse', () => {
    const { lib, harness } = loadLib();
    let format = 'ndjson';
    let handle: any;
    const render = () => harness.render(() => (handle = lib.useJsonStreamParser(SRC, { format })));
    render();
    handle.parse('{"a":1}{"b":2}');
    expect(handle.valueCount).toBe(0);
    format = 'stream';
    render();
    handle.parse(null);
    expect(handle.valueCount).toBe(2);
  });

  test('the accumulator: a refused chunk’s Failure goes out before the Add’s Unchanged, raised with the node’s type', () => {
    const { lib, harness, raised } = loadLib();
    const log: string[] = [];
    let handle: any;
    harness.render(() => (handle = lib.useTextAccumulator({ label: 'Acc', nodeId: 'a1', componentName: '/Pages/Home' }, { delimiter: '|' }, { failure: () => log.push('failure'), unchanged: () => log.push('unchanged'), completed: () => log.push('completed'), messageReceived: () => log.push(`message:${handle.lastMessage}`), changed: () => log.push('changed'), done: () => log.push('done') })));
    handle.add({ delta: 'Hi' });
    expect(log).toEqual(['failure', 'unchanged', 'completed']);
    expect(raised.map((r) => [r.code, r.nodeType])).toEqual([['text-accumulator/chunk-not-text', 'net.noodl.TextAccumulator']]);
    handle.add('Hello, wor');
    handle.add('ld|Bye|');
    expect(log.slice(3)).toEqual(['changed', 'done', 'completed', 'message:Bye', 'changed', 'done', 'completed']);
    expect(handle.messages).toEqual(['Hello, world', 'Bye']);
    expect(handle.error).toBe('');
    expect(handle.byteCount).toBe(0);
    // Retained between pulses: a bare Add appends the last chunk again; an empty one is Unchanged.
    handle.add();
    expect(log.slice(10)).toEqual(['message:Bye', 'changed', 'done', 'completed']);
    handle.add(null);
    expect(log.slice(14)).toEqual(['unchanged', 'completed']);
  });

  describe('the buffer’s timer, under fake timers', () => {
    beforeAll(() => jest.useFakeTimers());
    afterAll(() => jest.useRealTimers());

    test('an interval flush fires Flushed alone after the period; a Flush stops it; a Clear stops it', () => {
      const { lib, harness } = loadLib();
      const log: string[] = [];
      let handle: any;
      harness.render(() => (handle = lib.useStreamBuffer({ label: 'Buffer', nodeId: 'b1', componentName: '/Pages/Home' }, { flushInterval: 100 }, { flushed: () => log.push(`flushed:${handle.flushedData.length}`), done: () => log.push('done'), completed: () => log.push('completed'), unchanged: () => log.push('unchanged') })));
      handle.add('a');
      handle.add('b');
      expect(log).toEqual(['done', 'completed', 'done', 'completed']);
      jest.advanceTimersByTime(99);
      expect(log.length).toBe(4);
      jest.advanceTimersByTime(1);
      expect(log.slice(4)).toEqual(['flushed:2']);
      expect(handle.bufferSize).toBe(0);
      expect(handle.flushCount).toBe(1);
      // Nothing buffered: the timer is not re-armed by the flush; the next Add arms it again.
      jest.advanceTimersByTime(500);
      expect(log.length).toBe(5);
      handle.add('c');
      handle.flush();
      expect(log.slice(5)).toEqual(['done', 'completed', 'flushed:1', 'done', 'completed']);
      jest.advanceTimersByTime(500);
      expect(log.length).toBe(10);
      handle.add('d');
      handle.clear();
      jest.advanceTimersByTime(500);
      // Clear stopped the timer (no Flushed arrives) and reset the counters, as clearBuffer does: the Add and the Clear
      // each logged Done + Completed, and nothing else.
      expect(log.slice(10)).toEqual(['done', 'completed', 'done', 'completed']);
      expect(handle.flushCount).toBe(0);
      expect(handle.bufferSize).toBe(0);
    });

    test('a changed interval re-arms at the new period; unmount stops the timer and drops the buffer', () => {
      const { lib, harness } = loadLib();
      const log: string[] = [];
      let interval = 100;
      let handle: any;
      const render = () => harness.render(() => (handle = lib.useStreamBuffer({ label: 'Buffer', nodeId: 'b1', componentName: '/Pages/Home' }, { flushInterval: interval }, { flushed: () => log.push('flushed') })));
      render();
      handle.add('a');
      interval = 30;
      render();
      jest.advanceTimersByTime(30);
      expect(log).toEqual(['flushed']);
      handle.add('b');
      harness.unmount();
      jest.advanceTimersByTime(1000);
      expect(log).toEqual(['flushed']);
      expect(handle.bufferSize).toBe(0);
      expect(handle.flushedData).toEqual([]);
    });

    test('no interval: nothing is ever armed', () => {
      const { lib, harness } = loadLib();
      const log: string[] = [];
      let handle: any;
      harness.render(() => (handle = lib.useStreamBuffer({ label: 'Buffer', nodeId: 'b1', componentName: '/Pages/Home' }, {}, { flushed: () => log.push('flushed') })));
      handle.add('a');
      jest.advanceTimersByTime(100000);
      expect(log).toEqual([]);
      expect(handle.bufferSize).toBe(1);
    });
  });

  test('the buffer: add() with no argument is the runtime’s no-data Failure, raised with the node’s provenance; Error reads it', () => {
    const { lib, harness, raised } = loadLib();
    const log: string[] = [];
    let handle: any;
    harness.render(() => (handle = lib.useStreamBuffer({ label: 'Buffer', nodeId: 'b1', componentName: '/Pages/Home' }, { maxSize: 3 }, { failure: () => log.push(`failure:${handle.error}`), completed: () => log.push('completed'), overflowed: () => log.push('overflowed'), done: () => log.push('done') })));
    expect(handle.error).toBeUndefined();
    handle.add();
    expect(log).toEqual(['failure:Nothing to add — no value has arrived on the Data input', 'completed']);
    expect(raised).toEqual([{ code: 'stream-buffer/no-data', message: 'Nothing to add — no value has arrived on the Data input', nodeId: 'b1', nodeType: 'net.noodl.StreamBuffer', componentName: '/Pages/Home' }]);
    for (let i = 0; i < 4; i++) handle.add('tick');
    expect(log.slice(2)).toEqual(['done', 'completed', 'done', 'completed', 'done', 'completed', 'overflowed', 'done', 'completed']);
    expect(handle.droppedItems).toBe(1);
    expect(handle.buffer).toEqual(['tick', 'tick', 'tick']);
  });

  test('the handle is stable across renders, and a listener passed later is the one that fires', () => {
    const { lib, harness } = loadLib();
    const log: string[] = [];
    let handle: any;
    let tag = 'first';
    const render = () => harness.render(() => (handle = lib.useJsonStreamParser(SRC, {}, { success: () => log.push(tag) })));
    render();
    const first = handle;
    tag = 'second';
    render();
    expect(handle).toBe(first);
    handle.parse('{"a":1}\n');
    expect(log).toEqual(['second']);
  });
});

// ---------------------------------------------------------------------------------------------------
describe('§F the refused shapes, by mutation — each sentence exact, and the corpus stays clean', () => {
  test('a signal output consumed as a value: decided before the chain compiles', () => {
    expect(sentence('parser', (ir) => connect(componentOf(ir, HOME), 'parser', 'success', 'parserErrorText', 'text', 'value'))).toBe(
      'its success output is consumed as a value — a pulse carries nothing to read'
    );
  });

  test('an output the node has not got, and an input it has not got', () => {
    expect(sentence('parser', (ir) => connect(componentOf(ir, HOME), 'parser', 'stack', 'parserErrorText', 'text', 'value'))).toBe('its stack output is consumed, and this node has no such port');
    expect(sentence('acc', (ir) => connect(componentOf(ir, HOME), 'tokenVar', 'value', 'acc', 'separator', 'value'))).toBe('its separator input is not a port this node has');
  });

  test('two wires on the data port, and two wires on a config port — each named by the port’s display name', () => {
    expect(sentence('parser', (ir) => connect(componentOf(ir, HOME), 'tokenVar', 'value', 'parser', 'chunk', 'value'))).toBe('two wires feed its Chunk input — last-writer-wins is not statically ordered');
    expect(
      sentence('buffer', (ir) => {
        const home = componentOf(ir, HOME);
        connect(home, 'tokenVar', 'value', 'buffer', 'maxSize', 'value');
        connect(home, 'chunkVar', 'value', 'buffer', 'maxSize', 'value');
      })
    ).toBe('two wires feed its Max Size input — last-writer-wins is not statically ordered');
  });

  test('a data port fed by a text input’s live text is refused — with the feeder-named fallback, not the precise sentence (§54.7’s seam, registered §58.5)', () => {
    // The node registers in the early trigger loop, before the controlled-state seam that hosts a hook argument fed by a
    // text input has minted a row — so the read answers null with no reason of its own. The refusal is right.
    expect(
      sentence('acc', (ir) => {
        const home = componentOf(ir, HOME);
        home.nodes.push({ id: 'tokenInput', type: 'net.noodl.controls.textinput', catalogRef: 'net.noodl.controls.textinput', authoredLabel: 'Token', parent: 'shell', parameters: [{ name: 'placeholder', value: { kind: 'literal', value: 'Token' } }], declaredPorts: [], portKnowledge: 'complete' });
        nodeOf(ir, HOME, 'shell').children!.push('tokenInput');
        disconnect(home, (c) => c.toId === 'acc' && c.toProperty === 'chunk');
        connect(home, 'tokenInput', 'text', 'acc', 'chunk', 'value');
      })
    ).toBe('its Chunk input is fed by net.noodl.controls.textinput — no statically known source in the emit vocabulary');
  });

  test('a config port fed by a node the vocabulary cannot read names the feeder', () => {
    expect(
      sentence('parser', (ir) => {
        const home = componentOf(ir, HOME);
        // §59 made `net.noodl.Hash` readable the same session this row was written; Pattern Extractor is §50's own out-of-scope list.
        home.nodes.push({ id: 'pattern', type: 'net.noodl.PatternExtractor', catalogRef: 'net.noodl.PatternExtractor', parameters: [], declaredPorts: [], portKnowledge: 'partial' });
        connect(home, 'pattern', 'matches', 'parser', 'maxLength', 'value');
      })
    ).toBe('its Max Pending input is fed by net.noodl.PatternExtractor — no statically known source in the emit vocabulary');
  });

  test('a listener chain into an untranslatable sink refuses the node with doneChainOf’s sentence', () => {
    expect(
      sentence('buffer', (ir) => {
        const home = componentOf(ir, HOME);
        home.nodes.push({ id: 'csv', type: 'ToCSV', catalogRef: 'ToCSV', parameters: [], declaredPorts: [], portKnowledge: 'complete' });
        connect(home, 'buffer', 'overflowed', 'csv', 'convert');
      })
    ).toBe('its overflowed output drives no translatable action');
  });

  test('a streaming node in a logic-only component nothing mounts: no file to host it, named', () => {
    const ir = cloneIr();
    ir.components.push({
      ...structuredClone(componentOf(ir, 'App')),
      path: 'Sink',
      legacyPath: '/Sink',
      role: 'component',
      nodes: [{ id: 'lonely', type: STREAM_BUFFER_TYPE, catalogRef: STREAM_BUFFER_TYPE, parameters: [], declaredPorts: [], portKnowledge: 'complete' }],
      connections: [],
      visualRoots: []
    } as ComponentIR);
    expect(refusalOf(ir, 'Sink', 'lonely')?.reason).toBe('component emits no file to host the Stream Buffer');
  });

  test('a refused node is a root with its chain silenced and attributed; it is not a pathway; its two neighbours still export', () => {
    const ir = cloneIr();
    const home = componentOf(ir, HOME);
    connect(home, 'parser', 'success', 'parserErrorText', 'text', 'value');
    const built = emitApp(ir, catalog);
    const pre = summarizePreflight(built);
    expect(pre.cascade.roots.map((r) => [r.node.nodeId, r.node.pathway, r.silences.map((s) => s.node.nodeId)])).toEqual([['parser', false, ['setStatusParsed', 'parsedConst']]]);
    expect(pre.verdict).toBeNull();
    expect(built.files[HOME_FILE]).not.toContain('useJsonStreamParser(');
    expect(built.files[HOME_FILE]).toContain(ACC_LINE);
    expect(built.files[HOME_FILE]).toContain(BUFFER_LINE);
    expect(built.files[HOME_FILE]).toContain("import { useStreamBuffer, useTextAccumulator } from '../lib/streaming';");
  });

  test('a node nothing fires and nothing reads is still hosted, with its chain compiled (and never firing, as the runtime’s never would)', () => {
    const ir = cloneIr();
    const home = componentOf(ir, HOME);
    disconnect(home, (c) => c.toId === 'buffer' && (c.toProperty === 'add' || c.toProperty === 'flush'));
    disconnect(home, (c) => c.fromId === 'buffer' && c.toId !== 'setStatusFlushed');
    const built = emitApp(ir, catalog);
    expect(planOf(ir, HOME).dispositions.buffer).toEqual({ kind: 'collapsed', into: HOME_FILE });
    expect(built.files[HOME_FILE]).toContain(BUFFER_LINE);
    expect(built.report.components.find((c) => c.path === HOME)?.refusals).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------
describe('§G the report and the pre-flight', () => {
  test('nothing refused, no cascade, no verdict; 15 files with both libs', () => {
    const pre = summarizePreflight(app);
    expect(pre.cascade).toEqual({ roots: [], unsilenced: 0, silenced: 0, pathway: [] });
    expect(pre.verdict).toBeNull();
    expect(pre.generatedFiles).toBe(15);
    expect(Object.keys(app.files).filter((f) => f.startsWith('src/')).sort()).toEqual([
      'src/App.tsx',
      'src/lib/errors.ts',
      'src/lib/streaming.ts',
      'src/main.tsx',
      'src/pages/Home.module.css',
      'src/pages/Home.tsx',
      'src/stores/variables.ts',
      'src/styles/base.css',
      'src/styles/tokens.css'
    ]);
  });

  test('every node is placed: no deferred disposition anywhere, no dropped wire', () => {
    for (const plan of project.plans) {
      const deferred = Object.entries(plan.dispositions).filter(([, d]) => d.kind === 'deferred');
      expect({ path: plan.path, deferred }).toEqual({ path: plan.path, deferred: [] });
      expect({ path: plan.path, dropped: plan.droppedWires }).toEqual({ path: plan.path, dropped: [] });
    }
  });
});

// ---------------------------------------------------------------------------------------------------
describe('§H the ledger', () => {
  test('the three are translated, carry no badge, and the floor is 105', () => {
    for (const type of [STREAM_PARSER_TYPE, STREAM_BUFFER_TYPE, TEXT_ACCUMULATOR_TYPE]) {
      expect({ type, status: ledgerEntryOf(type)?.status }).toEqual({ type, status: 'translated' });
      expect(exportBadgeOf(type)).toBeUndefined();
    }
    const ledger = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'coverage-ledger.json'), 'utf8'));
    expect(ledger.pickerCoverageFloor).toBe(117); // §66 Subscribe To Changes (session 90) on top of §65 WebSocket (session 89) on top of §64 Server-Sent Events (session 88) on top of §61 the component-stack trio + §60 the component-object trio + §62 the relation pair + §63 Drag (session 86); §57 + §58 + §59 (session 85)
  });
});

// ---------------------------------------------------------------------------------------------------
describe('§I every variant typechecks as a real ts.Program', () => {
  test('the fixture', () => {
    expect(typecheckEmittedApp(app)).toEqual([]);
  });

  test('a wired Data of unknown type and every config port wired from a Variable', () => {
    const ir = cloneIr();
    const home = componentOf(ir, HOME);
    disconnect(home, (c) => c.toId === 'buffer' && c.toProperty === 'data');
    home.nodes = home.nodes.filter((n) => n.id !== 'tickConst');
    connect(home, 'chunkVar', 'value', 'buffer', 'data', 'value');
    connect(home, 'chunkVar', 'value', 'buffer', 'flushSize', 'value');
    connect(home, 'chunkVar', 'value', 'buffer', 'flushInterval', 'value');
    connect(home, 'chunkVar', 'value', 'parser', 'maxLength', 'value');
    connect(home, 'chunkVar', 'value', 'acc', 'maxMessages', 'value');
    const built = emitApp(ir, catalog);
    expect(built.report.components.find((c) => c.path === HOME)?.refusals).toEqual([]);
    expect(built.files[HOME_FILE]).toContain('{ flushSize: chunkValue, flushInterval: chunkValue, maxSize: 3 }');
    expect(built.files[HOME_FILE]).toContain('buffer.add(chunk.get())');
    expect(typecheckEmittedApp(built)).toEqual([]);
  });

  test('a CONTROL: the checker goes red on an emitted line that reads a getter the handle has not got', () => {
    const broken = { ...app, files: { ...app.files, [HOME_FILE]: app.files[HOME_FILE].replace('parser.valueCount', 'parser.valueTotal') } };
    expect(typecheckEmittedApp(broken).some((d) => d.includes('valueTotal'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------------
describe('§J the controls — who ships the host, and who does not', () => {
  const load = (fixture: string) => emitApp(parseProject(path.join(__dirname, 'fixtures', fixture), catalog), catalog);

  test('a project with none of the three ships no streaming.ts and imports nothing from it', () => {
    for (const fixture of ['slot-desk', 'script-desk', 'alarm-desk']) {
      const other = load(fixture);
      expect({ fixture, lib: other.files[STREAMING_LIB_PATH] }).toEqual({ fixture, lib: undefined });
      for (const [name, source] of Object.entries(other.files)) {
        if (name.startsWith('src/')) expect({ fixture, name, imports: source.includes('lib/streaming') }).toEqual({ fixture, name, imports: false });
      }
    }
  });

  test('the host earns errors.ts on its own: a fixture with a streaming node and nothing else that raises still ships the channel', () => {
    expect(app.files[ERRORS_LIB_PATH]).toBeDefined();
    expect(app.files[HOME_FILE]).not.toContain('lib/errors');
  });
});
