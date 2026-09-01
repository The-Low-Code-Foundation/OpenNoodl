import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

import { Catalog } from '../src/catalog';
import { emitApp } from '../src/emit/emitApp';
import { parseProject } from '../src/parse/parseProject';
import { utilLibSource } from '../src/emit/utilLib';
import { typecheckEmittedApp } from './helpers/typecheckApp';
import { ExportIR, ComponentIR, ConnectionIR, NodeIR, ParamValue } from '../src/ir/types';

/**
 * EXP-011 Tier 2.7 — the small string/math utilities: `Substring`, `Number Remapper`,
 * `String Mapper`.
 *
 * Two halves, `date-family.test.ts`'s shape, and the first is the one that can catch a mistake.
 *
 * §A is a **differential test**: the emitted `src/lib/util.ts` is transpiled, loaded, and driven
 * against the three node definitions themselves — their real setters and their real getters,
 * loaded from `noodl-runtime/src` — over a grid built out of the cases where a plausible-looking
 * transcription goes wrong. A transcription is exactly the kind of work that reads correctly and
 * is subtly false, so this compares the two implementations rather than asserting what the
 * transcription says.
 *
 * 🔴 **The grid is not a sample of ordinary inputs.** Negative starts, a `start` past the end, an
 * `end` before the `start`, the two input endpoints equal, a repeated Input, an Input with no
 * Mapping, and an unset Input String are all in it because each one is a place where the obvious
 * rewrite of this code answers something else.
 *
 * §B is the translation: graphs in, emitted code out, with every deferral asserted **by its named
 * reason** — a gate that fires for the wrong reason passes the weaker test.
 *
 * §C is the fixture, which is what AC3 asks for: a project a person could have built, exported
 * and typechecked whole.
 */

const FIXTURE = path.join(__dirname, 'fixtures', 'cheer');
const TICKET_DESK = path.join(__dirname, 'fixtures', 'ticket-desk');
const CATALOG_PATH = path.join(__dirname, '..', '..', 'noodl-types', 'src', 'node-catalog.json');
const RUNTIME_NODES = path.join(__dirname, '..', '..', 'noodl-runtime', 'src', 'nodes', 'std-library');

const catalog: Catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
const baseIr = parseProject(FIXTURE, catalog);

// ---- §A the emitted module, against the interpreter it has to agree with --------------------

interface UtilLib {
  substring(input: unknown, start: unknown, end: unknown): string;
  remapNumber(
    value: unknown,
    minInput: unknown,
    maxInput: unknown,
    minOutput: unknown,
    maxOutput: unknown,
    clamp: unknown
  ): number;
  mapString(input: unknown, cases: Record<string, string | undefined>, fallback: unknown): string | undefined;
}

/**
 * The emitted module, compiled and loaded.
 *
 * 🔴 This loads the **artefact that ships**, not a copy of it kept beside the generator: a test
 * against a second copy of the same logic is a test that both copies say the same thing, which is
 * true by construction and worth nothing.
 */
const loadUtilLib = (source = utilLibSource()): UtilLib => {
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText;
  const exported: Record<string, unknown> = {};
  const module = { exports: exported };
  // eslint-disable-next-line no-new-func
  new Function('exports', 'module', js)(exported, module);
  return module.exports as unknown as UtilLib;
};

const lib = loadUtilLib();

interface RuntimeNodeDefinition {
  initialize?: (this: unknown) => void;
  inputs: Record<string, { set?: (this: unknown, value: unknown) => void }>;
  numberedInputs?: Record<string, { createSetter: (this: unknown, index: number) => (this: unknown, value: unknown) => void }>;
  outputs: Record<string, { getter?: (this: unknown) => unknown }>;
  prototypeExtensions?: Record<string, unknown>;
}

/**
 * A node definition, transpiled from `noodl-runtime/src` and loaded.
 *
 * ⚠️ **Transpiled rather than imported**, for the reason `date-family.test.ts` records: these
 * files do not typecheck under *this* package's tsconfig, and ts-jest refuses the whole suite
 * over one of them. `transpileModule` erases types without checking them, which is what running
 * the interpreter's real code from a stricter package requires.
 */
const loadRuntimeNode = (file: string): RuntimeNodeDefinition => {
  const source = fs.readFileSync(path.join(RUNTIME_NODES, file), 'utf8');
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText;
  const exported: Record<string, unknown> = {};
  const module = { exports: exported };
  // eslint-disable-next-line no-new-func
  new Function('exports', 'module', 'require', js)(exported, module, () => ({}));
  return (module.exports as { node: RuntimeNodeDefinition }).node;
};

const substringNode = loadRuntimeNode('substring.ts');
const remapperNode = loadRuntimeNode('numberremapper.ts');
const mapperNode = loadRuntimeNode('stringmapper.ts');

/** A bare instance with the two methods every one of these nodes calls on itself. */
const instanceFor = (definition: RuntimeNodeDefinition) => {
  const instance: Record<string, unknown> = {
    _internal: {} as Record<string, unknown>,
    flagOutputDirty: () => undefined,
    sendSignalOnOutput: () => undefined,
    scheduleAfterInputsHaveUpdated: (fn: () => void) => fn()
  };
  for (const [name, member] of Object.entries(definition.prototypeExtensions ?? {})) {
    const fn = (member as { value?: unknown }).value ?? member;
    instance[name] = (fn as (this: unknown) => unknown).bind(instance);
  }
  definition.initialize?.call(instance);
  return instance;
};

/**
 * `Substring` driven through its own setters, with **unset** ports left unset.
 *
 * 🔴 That is the whole point of the `undefined` arms: a port nobody wired and nobody authored
 * never has its setter called, so the answer comes from `initialize` — and `end`'s is `-1` while
 * the port *declares* `0`. This harness can express that difference; a harness that always set
 * every port could not.
 */
const runtimeSubstring = (input: unknown, start?: number, end?: number): string => {
  const instance = instanceFor(substringNode);
  if (start !== undefined) substringNode.inputs.start.set!.call(instance, start);
  if (end !== undefined) substringNode.inputs.end.set!.call(instance, end);
  substringNode.inputs.string.set!.call(instance, input);
  return substringNode.outputs.result.getter!.call(instance) as string;
};

const runtimeRemap = (
  value: number,
  ports: { minInputValue?: number; maxInputValue?: number; minOutputValue?: number; maxOutputValue?: number; clamp?: boolean }
): number => {
  const instance = instanceFor(remapperNode);
  for (const [port, v] of Object.entries(ports)) {
    if (v !== undefined) remapperNode.inputs[port].set!.call(instance, v);
  }
  remapperNode.inputs.inputValue.set!.call(instance, value);
  return remapperNode.outputs.remappedValue.getter!.call(instance) as number;
};

/** `String Mapper` driven through its numbered setters, sparse entries and all. */
const runtimeMap = (
  input: unknown,
  pairs: Array<{ index: number; from?: string; to?: string }>,
  fallback?: string
): string | undefined => {
  const instance = instanceFor(mapperNode);
  for (const pair of pairs) {
    if (pair.from !== undefined) {
      mapperNode.numberedInputs!.input.createSetter.call(instance, pair.index).call(instance, pair.from);
    }
    if (pair.to !== undefined) {
      mapperNode.numberedInputs!.output.createSetter.call(instance, pair.index).call(instance, pair.to);
    }
  }
  if (fallback !== undefined) mapperNode.inputs.defaultMapping.set!.call(instance, fallback);
  if (input !== undefined) mapperNode.inputs.inputString.set!.call(instance, input);
  return mapperNode.outputs.mappedString.getter!.call(instance) as string | undefined;
};

/**
 * The `Substring` grid.
 *
 * Negative starts, a start past the end, an end before the start and an end of exactly 0 are all
 * here because each is a place `slice` and `substr` give different answers — and `slice` is what
 * anyone rewriting this reaches for first.
 */
const TEXTS = ['', 'a', 'hello', 'a longer sentence with spaces', '  padded  ', '日本語のテキスト'];
const OFFSETS = [-30, -5, -3, -1, 0, 1, 3, 5, 12, 30];

describe('EXP-011 Tier 2.7 §A — the emitted module against the interpreter', () => {
  it('the module the export ships parses and loads', () => {
    const sf = ts.createSourceFile('util.ts', utilLibSource(), ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);
    const diagnostics = (sf as unknown as { parseDiagnostics: ts.Diagnostic[] }).parseDiagnostics ?? [];
    expect(diagnostics.map((d) => ts.flattenDiagnosticMessageText(d.messageText, ' ')).join('\n')).toBe('');
    expect(typeof lib.substring).toBe('function');
    expect(typeof lib.remapNumber).toBe('function');
    expect(typeof lib.mapString).toBe('function');
  });

  it('substring agrees with the interpreter on every text and every Start/End pair in the grid', () => {
    const disagreements: string[] = [];
    let compared = 0;
    for (const text of TEXTS) {
      for (const start of OFFSETS) {
        for (const end of OFFSETS) {
          compared += 1;
          const mine = lib.substring(text, start, end);
          const theirs = runtimeSubstring(text, start, end);
          if (mine !== theirs) disagreements.push(`"${text}" [${start}, ${end}]: emitted "${mine}" vs runtime "${theirs}"`);
        }
      }
    }
    expect(disagreements).toEqual([]);
    // 6 texts × 10 starts × 10 ends — stated so a grid that silently shrinks is visible.
    expect(compared).toBe(600);
  });

  /**
   * 🔴 The one that pays for the whole harness.
   *
   * An untouched `End` port holds **-1**, because `registerInput` writes a declared default into
   * `_inputValues` without ever calling the setter and the getter reads what `initialize` wrote.
   * When this row was written the catalog and the property panel both declared `0` — the
   * opposite answer, nothing at all instead of the whole string — and an export that trusted the
   * catalog would have emitted an app whose every `Substring` returned `''`. That was DEF-033,
   * fixed 2026-09-01 by aligning the declaration to -1 (Richard: "show the truth"). The last
   * assertion now pins the declaration to the interpreter's answer, so a regression to `0`
   * reddens here as well as in the runtime's own `substring-declared-default.test.ts`.
   */
  it('an untouched End is -1 in the interpreter, and -1 is what the export has to agree with', () => {
    for (const text of TEXTS) {
      for (const start of [0, 2]) {
        expect(lib.substring(text, start, -1)).toBe(runtimeSubstring(text, start, undefined));
      }
    }
    expect(runtimeSubstring('hello', 0, undefined)).toBe('hello');
    // What the old declared default would have produced, had the setter ever run. It is not a
    // near-miss: it is the empty string for every input the node can be given.
    expect(runtimeSubstring('hello', 0, 0)).toBe('');
    const declaredEnd = catalog.nodes.find((n) => n.typeName === 'Substring')!.inputs!.find((p) => p.name === 'end')!;
    expect(declaredEnd.default).toBe(-1);
  });

  it('an unset Start and an unset String are the interpreter’s own zero and empty string', () => {
    expect(runtimeSubstring('hello', undefined, undefined)).toBe(lib.substring('hello', 0, -1));
    const instance = instanceFor(substringNode);
    expect(substringNode.outputs.result.getter!.call(instance)).toBe(lib.substring('', 0, -1));
  });

  it('remapNumber agrees with the interpreter across the grid, degenerate range included', () => {
    const disagreements: string[] = [];
    let compared = 0;
    const ranges = [
      { minInputValue: 0, maxInputValue: 1 },
      { minInputValue: 0, maxInputValue: 100 },
      { minInputValue: -50, maxInputValue: 50 },
      { minInputValue: 10, maxInputValue: 0 }, // inverted
      { minInputValue: 5, maxInputValue: 5 } // degenerate — the NDA-012 branch
    ];
    const outputs = [
      { minOutputValue: 0, maxOutputValue: 1 },
      { minOutputValue: 0, maxOutputValue: 255 },
      { minOutputValue: 100, maxOutputValue: 0 }
    ];
    for (const range of ranges) {
      for (const out of outputs) {
        for (const clamp of [true, false]) {
          for (const value of [-100, -1, 0, 0.5, 1, 25, 50, 99, 100, 1000]) {
            compared += 1;
            const ports = { ...range, ...out, clamp };
            const mine = lib.remapNumber(
              value,
              ports.minInputValue,
              ports.maxInputValue,
              ports.minOutputValue,
              ports.maxOutputValue,
              ports.clamp
            );
            const theirs = runtimeRemap(value, ports);
            if (!Object.is(mine, theirs)) disagreements.push(`${value} through ${JSON.stringify(ports)}: ${mine} vs ${theirs}`);
          }
        }
      }
    }
    expect(disagreements).toEqual([]);
    expect(compared).toBe(300);
  });

  /**
   * The unopened panel, one node over. `initialize` writes `maxInputValue = 1` — NDA-012's fix —
   * and the export's fallbacks have to be those, not the catalog's.
   */
  it('an untouched Number Remapper passes its input through, clamped', () => {
    for (const value of [-1, 0, 0.25, 1, 4]) {
      expect(lib.remapNumber(value, 0, 1, 0, 1, true)).toBe(runtimeRemap(value, {}));
    }
    expect(runtimeRemap(0.25, {})).toBe(0.25);
    expect(runtimeRemap(4, {})).toBe(1);
  });

  it('mapString agrees with the interpreter over matches, misses and an unset input', () => {
    const table = [
      { index: 0, from: 'open', to: 'Open now' },
      { index: 1, from: 'closed', to: 'Closed for the day' },
      { index: 2, from: 'paused', to: 'On hold' }
    ];
    const cases: Record<string, string | undefined> = { open: 'Open now', closed: 'Closed for the day', paused: 'On hold' };
    for (const input of ['open', 'closed', 'paused', 'OPEN', 'unknown', '', undefined]) {
      expect(lib.mapString(input, cases, 'Not a status')).toBe(runtimeMap(input, table, 'Not a status'));
    }
    // No Default authored: a miss is the undefined the node publishes, not an empty string.
    expect(lib.mapString('unknown', cases, undefined)).toBe(runtimeMap('unknown', table, undefined));
    expect(lib.mapString('unknown', cases, undefined)).toBeUndefined();
  });

  /**
   * 🔴 An Input with no Mapping beside it. The interpreter reads `mappings[idx]` off the index
   * `indexOf` found and publishes the hole — **not** the Default — and a `??` in the helper would
   * send it to the Default instead. This is the case that decides `hasOwnProperty`.
   */
  it('an Input with no Mapping publishes empty rather than falling through to Default', () => {
    const table = [{ index: 0, from: 'open', to: 'Open now' }, { index: 1, from: 'closed' }];
    const cases: Record<string, string | undefined> = { open: 'Open now', closed: undefined };
    expect(runtimeMap('closed', table, 'Not a status')).toBeUndefined();
    expect(lib.mapString('closed', cases, 'Not a status')).toBeUndefined();
    // The control: the same table, a genuine miss, and the Default *does* arrive.
    expect(lib.mapString('missing', cases, 'Not a status')).toBe(runtimeMap('missing', table, 'Not a status'));
    expect(lib.mapString('missing', cases, 'Not a status')).toBe('Not a status');
  });

  /** A hole in the numbered series: `indexOf` skips it, so only the filled pairs can match. */
  it('a gap in the numbered inputs matches nothing', () => {
    const table = [{ index: 0, from: 'open', to: 'Open now' }, { index: 3, from: 'shut', to: 'Shut' }];
    const cases: Record<string, string | undefined> = { open: 'Open now', shut: 'Shut' };
    for (const input of ['open', 'shut', 'missing']) {
      expect(lib.mapString(input, cases, 'fallback')).toBe(runtimeMap(input, table, 'fallback'));
    }
  });

  /**
   * ⚠️ A repeated Input. `indexOf` finds the **first**; an object literal keeps the **last**, so
   * the planner drops the repeat when it builds the table. This asserts the interpreter's answer,
   * which is what §B's table-building row then has to reproduce.
   */
  it('a repeated Input takes the first mapping in the interpreter', () => {
    const table = [
      { index: 0, from: 'open', to: 'First' },
      { index: 1, from: 'open', to: 'Second' }
    ];
    expect(runtimeMap('open', table, 'fallback')).toBe('First');
    expect(lib.mapString('open', { open: 'First' }, 'fallback')).toBe('First');
  });
});

// ---- §B the translation ---------------------------------------------------------------------

const setParam = (node: NodeIR, name: string, value: ParamValue) => {
  const existing = node.parameters.find((p) => p.name === name);
  if (existing) existing.value = value;
  else {
    node.parameters.push({ name, value });
    node.parameters.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  }
};

const literal = (value: string | number | boolean): ParamValue => ({ kind: 'literal', value });

const connect = (
  component: ComponentIR,
  from: string,
  fromProperty: string,
  to: string,
  toProperty: string,
  kind: ConnectionIR['kind'] = 'value'
) => {
  component.connections.push({
    key: `${from}:${fromProperty}->${to}:${toProperty}`,
    fromId: from,
    fromProperty,
    toId: to,
    toProperty,
    kind
  });
};

const addNode = (component: ComponentIR, node: Partial<NodeIR> & { id: string; type: string }): NodeIR => {
  const full: NodeIR = {
    catalogRef: node.type,
    parameters: [],
    declaredPorts: [],
    portKnowledge: 'complete',
    ...node
  } as NodeIR;
  component.nodes.push(full);
  return full;
};

const emit = (ir: ExportIR) => emitApp(ir, catalog);
const notesOf = (ir: ExportIR) => ir.components.find((c) => c.path === 'Pages/Notes')!;
const notesFile = (app: ReturnType<typeof emitApp>) =>
  app.files[Object.keys(app.files).find((k) => k.endsWith('Notes.tsx'))!];
const reportOf = (app: ReturnType<typeof emitApp>) => app.notes.join('\n');

/** Every emitted file is parsed — the `}; else` floor. */
const expectParses = (app: ReturnType<typeof emitApp>) => {
  for (const [file, source] of Object.entries(app.files)) {
    if (!file.endsWith('.ts') && !file.endsWith('.tsx')) continue;
    const sf = ts.createSourceFile(
      file,
      source,
      ts.ScriptTarget.ESNext,
      true,
      file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    );
    const diagnostics = (sf as unknown as { parseDiagnostics: ts.Diagnostic[] }).parseDiagnostics ?? [];
    expect(diagnostics.map((d) => `${file}: ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`).join('\n')).toBe('');
  }
};

/** A utility node feeding the Notes heading — the simplest rendered value sink there is. */
const withUtils = (
  build: (ir: ExportIR, notes: ComponentIR) => void
): { ir: ExportIR; app: ReturnType<typeof emitApp> } => {
  const ir: ExportIR = JSON.parse(JSON.stringify(baseIr));
  const notes = notesOf(ir);
  build(ir, notes);
  return { ir, app: emit(ir) };
};

describe('EXP-011 Tier 2.7 §B — the translation', () => {
  it('Substring over an authored string renders through the emitted helper', () => {
    const { app } = withUtils((_ir, notes) => {
      addNode(notes, {
        id: 'clip',
        type: 'Substring',
        authoredLabel: 'Clip',
        parameters: [
          { name: 'end', value: literal(5) },
          { name: 'start', value: literal(0) },
          { name: 'string', value: literal('a longer sentence') }
        ]
      });
      connect(notes, 'clip', 'result', 'notesHeading', 'text');
    });
    expectParses(app);
    const page = notesFile(app);
    expect(page).toContain("import { substring } from '../lib/util';");
    expect(page).toContain("substring('a longer sentence', 0, 5)");
    expect(app.files['src/lib/util.ts']).toContain('export function substring');
    // The date module is not dragged along by a project that formats no date.
    expect(app.files['src/lib/date.ts']).toBeUndefined();
  });

  /**
   * 🔴 The row §A's measurement exists for. An untouched `End` exports as **-1**, the value
   * `initialize` wrote — never the `0` the port declares.
   */
  it('an unopened panel exports the value initialize wrote, not the declared default', () => {
    const { app } = withUtils((_ir, notes) => {
      addNode(notes, {
        id: 'clip',
        type: 'Substring',
        parameters: [{ name: 'string', value: literal('a longer sentence') }]
      });
      connect(notes, 'clip', 'result', 'notesHeading', 'text');
    });
    expect(notesFile(app)).toContain("substring('a longer sentence', 0, -1)");
  });

  it('Number Remapper emits the panel’s configuration, with initialize’s 1 as the unset maximum', () => {
    const { app } = withUtils((_ir, notes) => {
      addNode(notes, {
        id: 'score',
        type: 'Number',
        parameters: [{ name: 'value', value: literal(34) }]
      });
      addNode(notes, {
        id: 'gauge',
        type: 'Number Remapper',
        parameters: [
          { name: 'maxInputValue', value: literal(100) },
          { name: 'maxOutputValue', value: literal(10) }
        ]
      });
      connect(notes, 'score', 'savedValue', 'gauge', 'inputValue');
      connect(notes, 'gauge', 'remappedValue', 'notesHeading', 'text');
    });
    expectParses(app);
    const page = notesFile(app);
    expect(page).toContain("import { remapNumber } from '../lib/util';");
    // 0 / 0 / true are `initialize`'s, and they are the same values the ports declare.
    expect(page).toContain('remapNumber(34, 0, 100, 0, 10, true)');
  });

  it('String Mapper emits its numbered pairs as a table, Default last', () => {
    const { app } = withUtils((_ir, notes) => {
      const mapper = addNode(notes, { id: 'status', type: 'String Mapper' });
      setParam(mapper, 'input 0', literal('open'));
      setParam(mapper, 'output 0', literal('Open now'));
      setParam(mapper, 'input 1', literal('closed'));
      setParam(mapper, 'output 1', literal('Closed for the day'));
      setParam(mapper, 'defaultMapping', literal('Not a status I know'));
      setParam(mapper, 'inputString', literal('open'));
      connect(notes, 'status', 'mappedString', 'notesHeading', 'text');
    });
    expectParses(app);
    const page = notesFile(app);
    expect(page).toContain("import { mapString } from '../lib/util';");
    expect(page).toContain(
      "mapString('open', { 'open': 'Open now', 'closed': 'Closed for the day' }, 'Not a status I know')"
    );
  });

  /**
   * The table-building rules §A measured on the interpreter, asserted on the emitted call.
   *
   * Both are cases where the object literal and the interpreter disagree unless the planner does
   * something about it: a repeat would take the **last** mapping, and a hole would be absent from
   * the object and so fall through to Default.
   */
  it('a repeated Input keeps the first mapping and a Mapping-less Input keeps an undefined entry', () => {
    const { app } = withUtils((_ir, notes) => {
      const mapper = addNode(notes, { id: 'status', type: 'String Mapper' });
      setParam(mapper, 'input 0', literal('open'));
      setParam(mapper, 'output 0', literal('First'));
      setParam(mapper, 'input 1', literal('open'));
      setParam(mapper, 'output 1', literal('Second'));
      setParam(mapper, 'input 2', literal('closed'));
      setParam(mapper, 'defaultMapping', literal('Fallback'));
      connect(notes, 'status', 'mappedString', 'notesHeading', 'text');
    });
    const page = notesFile(app);
    expect(page).toContain("{ 'open': 'First', 'closed': undefined }");
    expect(page).not.toContain("'Second'");
  });

  it('a sparse numbered series keeps its indices in order and drops nothing else', () => {
    const { app } = withUtils((_ir, notes) => {
      const mapper = addNode(notes, { id: 'status', type: 'String Mapper' });
      setParam(mapper, 'input 3', literal('shut'));
      setParam(mapper, 'output 3', literal('Shut'));
      setParam(mapper, 'input 0', literal('open'));
      setParam(mapper, 'output 0', literal('Open now'));
      connect(notes, 'status', 'mappedString', 'notesHeading', 'text');
    });
    expect(notesFile(app)).toContain("{ 'open': 'Open now', 'shut': 'Shut' }");
  });

  it('the three utilities compose, and a nested call is one expression', () => {
    const { app } = withUtils((_ir, notes) => {
      addNode(notes, {
        id: 'clip',
        type: 'Substring',
        parameters: [
          { name: 'end', value: literal(4) },
          { name: 'string', value: literal('openish') }
        ]
      });
      const mapper = addNode(notes, { id: 'status', type: 'String Mapper' });
      setParam(mapper, 'input 0', literal('open'));
      setParam(mapper, 'output 0', literal('Open now'));
      setParam(mapper, 'defaultMapping', literal('Unknown'));
      connect(notes, 'clip', 'result', 'status', 'inputString');
      connect(notes, 'status', 'mappedString', 'notesHeading', 'text');
    });
    expectParses(app);
    expect(notesFile(app)).toContain("mapString(substring('openish', 0, 4), { 'open': 'Open now' }, 'Unknown')");
  });

  describe('what defers, and the reason it gives', () => {
    it('a wired numbered port defers the mapper, naming the port', () => {
      const { app } = withUtils((_ir, notes) => {
        addNode(notes, { id: 'source', type: 'String', parameters: [{ name: 'value', value: literal('open') }] });
        const mapper = addNode(notes, { id: 'status', type: 'String Mapper' });
        setParam(mapper, 'input 0', literal('open'));
        setParam(mapper, 'output 0', literal('Open now'));
        connect(notes, 'source', 'savedValue', 'status', 'input 1');
        connect(notes, 'status', 'mappedString', 'notesHeading', 'text');
      });
      expect(reportOf(app)).toContain(
        'a wire feeds its input 1 port — the mapping table is read at generation time, and a wired entry is not knowable until the app runs'
      );
      expect(notesFile(app)).not.toContain('mapString');
    });

    it('two wires into one input defer, because last-writer-wins is not statically ordered', () => {
      const { app } = withUtils((_ir, notes) => {
        addNode(notes, { id: 'a', type: 'String', parameters: [{ name: 'value', value: literal('one') }] });
        addNode(notes, { id: 'b', type: 'String', parameters: [{ name: 'value', value: literal('two') }] });
        addNode(notes, { id: 'clip', type: 'Substring' });
        connect(notes, 'a', 'savedValue', 'clip', 'string');
        connect(notes, 'b', 'savedValue', 'clip', 'string');
        connect(notes, 'clip', 'result', 'notesHeading', 'text');
      });
      expect(reportOf(app)).toContain('two wires feed its string input — last-writer-wins is not statically ordered');
    });

    it('an output this slice does not read defers by name rather than by the generic catch-all', () => {
      const { app } = withUtils((_ir, notes) => {
        addNode(notes, { id: 'clip', type: 'Substring', parameters: [{ name: 'string', value: literal('hi') }] });
        connect(notes, 'clip', 'notAPort', 'notesHeading', 'text');
      });
      expect(reportOf(app)).toContain('its notAPort output is not a port this slice reads');
    });

    it('a utility nothing reads is reported as dropped, not silently translated', () => {
      const { app } = withUtils((_ir, notes) => {
        addNode(notes, { id: 'clip', type: 'Substring', parameters: [{ name: 'string', value: literal('hi') }] });
      });
      expect(reportOf(app)).toContain('its answer is read by nothing statically translatable');
    });

    /**
     * ⚠️ Not a deferral — a note. An empty table is a node that works and answers its Default for
     * everything, and refusing it would refuse a translation that is correct.
     */
    it('a mapper with no pairs translates, and says what it will answer', () => {
      const { app } = withUtils((_ir, notes) => {
        const mapper = addNode(notes, { id: 'status', type: 'String Mapper' });
        setParam(mapper, 'defaultMapping', literal('Nothing mapped'));
        setParam(mapper, 'inputString', literal('open'));
        connect(notes, 'status', 'mappedString', 'notesHeading', 'text');
      });
      expect(reportOf(app)).toContain('has no Input/Mapping pairs filled in, so it answers its Default for every input');
      expect(notesFile(app)).toContain("mapString('open', {  }, 'Nothing mapped')");
    });

    /**
     * The divergence, filed where the emptiness enters the graph. `Substring`'s own setter raises
     * on an empty arrival; the emitted helper answers `''`, and the report says so rather than
     * the export quietly choosing.
     */
    it('a String fed from a source that can be empty is reported, and still translates', () => {
      const { app } = withUtils((_ir, notes) => {
        addNode(notes, {
          id: 'stamp',
          type: 'Date To String',
          parameters: [{ name: 'input', value: literal('2024-02-29') }]
        });
        addNode(notes, { id: 'clip', type: 'Substring', parameters: [{ name: 'end', value: literal(4) }] });
        connect(notes, 'stamp', 'currentValue', 'clip', 'string');
        connect(notes, 'clip', 'result', 'notesHeading', 'text');
      });
      expect(reportOf(app)).toContain(
        'reads String from a source that can be empty — the interpreter raises an error on an empty arrival rather than answering, and the exported call answers the empty string instead'
      );
      expect(notesFile(app)).toContain('substring(dateToString(');
    });
  });
});

// ---- §C the fixture ---------------------------------------------------------------------------

describe('EXP-011 Tier 2.7 §C — the picker-exercising project', () => {
  const ir = parseProject(TICKET_DESK, catalog);
  const app = emitApp(ir, catalog);
  const page = app.files[Object.keys(app.files).find((k) => k.endsWith('Ticket.tsx'))!];

  it('exports a page that calls all three helpers', () => {
    expectParses(app);
    expect(page).toContain("import { mapString, remapNumber, substring } from '../lib/util';");
    expect(page).toContain('substring(');
    expect(page).toContain('remapNumber(');
    expect(page).toContain('mapString(');
  });

  it('ships the library exactly once, and ships no library it does not call', () => {
    expect(app.files['src/lib/util.ts']).toContain('export function mapString');
    expect(app.files['src/lib/date.ts']).toBeUndefined();
  });

  /**
   * 🔴 The whole project, not the three lines this slice wrote. A `toContain` passes on dead
   * code; `tsc` over every emitted file is what says the app builds.
   */
  it('the whole emitted app typechecks', () => {
    expect(typecheckEmittedApp(app)).toEqual([]);
  });

  /**
   * The report says exactly one thing about the three nodes, and it is the divergence rather
   * than a refusal: the `Subject` variable can be empty, `Substring`'s setter raises on an empty
   * arrival, and the exported call answers `''` instead. Asserting the **whole list** rather than
   * "no deferral" is what makes this row notice a second note appearing later.
   */
  it('the report says one thing about the three utilities, and it is the empty-String divergence', () => {
    const utilNotes = app.notes.filter((n) => /Substring|String Mapper|Number Remapper/.test(n));
    expect(utilNotes).toEqual([
      'Pages/Ticket: node clip (Substring) reads String from a source that can be empty — the interpreter raises an error on an empty arrival rather than answering, and the exported call answers the empty string instead'
    ]);
    expect(utilNotes.join('\n')).not.toContain('deferred');
  });
});
