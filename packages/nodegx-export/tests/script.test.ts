import * as fs from 'fs';
import * as path from 'path';

import * as ts from 'typescript';

import { Catalog, CatalogIndex, loadCatalog } from '../src/catalog';
import { ComponentPlan, planProject } from '../src/analyze/plan';
import { scriptBodyDefer, scriptNamesPorts, scriptPortsOf, SCRIPT_CODE_PREFIX } from '../src/analyze/script';
import { emitApp } from '../src/emit/emitApp';
import { summarizePreflight } from '../src/emit/preflight';
import { SCRIPT_LIB_PATH, scriptLibSource } from '../src/emit/scriptLib';
import { exportBadgeOf, ledgerEntryOf } from '../src/ledger';
import { parseProject } from '../src/parse/parseProject';
import { typecheckEmittedApp } from './helpers/typecheckApp';
import { ComponentIR, ExportIR, NodeIR, ParamValue } from '../src/ir/types';

/**
 * EXP-011 §52 — `Script` (`Javascript2`, Tier 2.8 row 2).
 *
 * The runtime compiles a Script node's code once, as `new Function('define', 'script', 'Node', 'Component',
 * prefix + code)`, calls it once, and reads off what it declared: a lifecycle (setup / change / destroy)
 * and signal functions, in one of three DSL generations (javascriptnodeparser.js). Ports come from disk
 * (the editor persists what it discovered; `nodemodel.ts` reads `ports`). So the export **hosts** the
 * code rather than re-hosting it as a pure function: `src/lib/script.ts` transcribes the parser and the
 * lifecycle, the code goes verbatim into its own `// @ts-nocheck` file, and the component calls
 * `useScript(definition, inputs, listeners)`.
 *
 * Measured before the build (probe15-reverted.log, HEAD e1a92d95): every Script node fell to
 * `logic node (Javascript2)`, its five wires were dropped, its code survived only as a comment block,
 * and the cascade named it as the root of every constant and Set Variable behind it.
 *
 * §A the gate · §B the ports · §C the emitted page · §D the script files · §E the host, run under node
 * through a hook harness · §F the refused shape (built by mutation, the corpus stays clean) · §G the
 * graph gates · §H the ledger and the pre-flight · §I every variant typechecks · §J the control fixture.
 */

const FIXTURE = path.join(__dirname, 'fixtures', 'script-desk');
const catalog: Catalog = loadCatalog();
const index = new CatalogIndex(catalog);
const baseIr = parseProject(FIXTURE, catalog);
const app = emitApp(baseIr, catalog);

const HOME = 'Pages/Home';
const HOME_FILE = 'src/pages/Home.tsx';
const SCRIPTS_DIR = 'src/scripts/pages/Home/';

const cloneIr = (): ExportIR => structuredClone(baseIr);
const componentOf = (source: ExportIR, componentPath: string): ComponentIR =>
  source.components.find((c) => c.path === componentPath)!;
const nodeOf = (source: ExportIR, componentPath: string, id: string): NodeIR =>
  componentOf(source, componentPath).nodes.find((n) => n.id === id)!;
const setParam = (node: NodeIR, name: string, value: ParamValue) => {
  const existing = node.parameters.find((p) => p.name === name);
  if (existing) existing.value = value;
  else {
    node.parameters.push({ name, value });
    node.parameters.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  }
};
const setCode = (node: NodeIR, code: string) => {
  setParam(node, 'code', { kind: 'script', source: code });
  node.sourceText = code;
};
const wire = (source: ExportIR, componentPath: string, fromId: string, fromProperty: string, toId: string, toProperty: string, kind: 'value' | 'signal' = 'value') => {
  componentOf(source, componentPath).connections.push({ key: `${fromId}:${fromProperty}->${toId}:${toProperty}`, fromId, fromProperty, toId, toProperty, kind });
};
const unwire = (source: ExportIR, componentPath: string, key: string) => {
  const component = componentOf(source, componentPath);
  component.connections = component.connections.filter((c) => c.key !== key);
};
const planOf = (source: ExportIR, componentPath: string): ComponentPlan =>
  planProject(source, index).plans.find((p) => p.path === componentPath)!;
const dispositionOf = (source: ExportIR, componentPath: string, id: string) =>
  planOf(source, componentPath).dispositions[id] as { kind: string; reason?: string };
const notesOf = (built: ReturnType<typeof emitApp>, componentPath: string): string =>
  built.report.components.find((c) => c.path === componentPath)!.notes.join('\n');
const count = (haystack: string, needle: string): number => haystack.split(needle).length - 1;
const codeOf = (id: string): string => nodeOf(baseIr, HOME, id).sourceText!;

/** The def036-dash-drive shape, shortened: a signal whose function uploads through the Noodl API. */
const UPLOADER = `Script.Outputs = {
    Url: 'string',
    Done: 'signal'
};

Script.Signals.Upload = async function () {
    const file = new File(['hello'], 'hello.txt', { type: 'text/plain' });
    const cloudFile = await Noodl.Files.upload(file);
    Script.Outputs.Url = cloudFile.url;
    Script.Outputs.Done();
};
`;
const uploaderNode = (): NodeIR => ({
  id: 'uploader',
  type: 'Javascript2',
  catalogRef: 'Javascript2',
  authoredLabel: 'Uploader',
  parameters: [{ name: 'code', value: { kind: 'script', source: UPLOADER } }],
  declaredPorts: [
    { name: 'Upload', plug: 'input', kind: 'signal', type: 'signal' },
    { name: 'Url', plug: 'output', kind: 'value', type: 'string' },
    { name: 'Done', plug: 'output', kind: 'signal', type: 'signal' }
  ],
  portKnowledge: 'unknown',
  sourceText: UPLOADER
});
/** The fixture plus the refused node, wired like the drive copy: a button fires it, a Text reads its Url. */
const withUploader = (): ExportIR => {
  const ir = cloneIr();
  const home = componentOf(ir, HOME);
  home.nodes.push(uploaderNode());
  home.nodes.push({ id: 'uploadBtn', type: 'net.noodl.controls.button', catalogRef: 'net.noodl.controls.button', authoredLabel: 'Upload', parameters: [{ name: 'label', value: { kind: 'literal', value: 'Upload' } }], declaredPorts: [], portKnowledge: 'partial', parent: 'shell' });
  home.nodes.push({ id: 'urlText', type: 'Text', catalogRef: 'Text', authoredLabel: 'Url', parameters: [{ name: 'text', value: { kind: 'literal', value: '' } }], declaredPorts: [], portKnowledge: 'complete', parent: 'shell' });
  const shell = nodeOf(ir, HOME, 'shell');
  shell.children = [...(shell.children ?? []), 'uploadBtn', 'urlText'];
  wire(ir, HOME, 'uploadBtn', 'onClick', 'uploader', 'Upload', 'signal');
  wire(ir, HOME, 'uploader', 'Url', 'urlText', 'text');
  return ir;
};

// ---------------------------------------------------------------------------------------------
// §A — the gate over the code alone: only what the exported app cannot supply.
// ---------------------------------------------------------------------------------------------

describe('§A the gate (scriptBodyDefer) refuses only what the exported app cannot supply', () => {
  test('the Noodl API is the runtime-coupled tier — the corpus\'s three upload bodies', () => {
    expect(scriptBodyDefer(UPLOADER)).toContain('reads the Noodl API');
  });
  test('the Component scope is the component-record tier', () => {
    expect(scriptBodyDefer('Script.OnInit = function () { Component.Object.set("x", 1); };')).toContain('Component scope');
  });
  test('createComponent / deleteComponent need a node graph the app has not got', () => {
    expect(scriptBodyDefer('Script.OnInit = function () { this.createComponent("/Comp"); };')).toContain('createComponent');
  });
  test('a dynamic import() defers by name', () => {
    expect(scriptBodyDefer("Script.OnInit = async function () { await import('x'); };")).toContain('import()');
  });
  test('a body that does not compile defers with the message — the corpus junk body', () => {
    expect(scriptBodyDefer('Script.Signal.runOnce = function')).toContain('does not compile');
  });
  test('a body that only compiles sloppy defers — the emitted file is an ES module', () => {
    expect(scriptBodyDefer('with (Math) { Script.Outputs.x = PI; }')).toContain('compiles only in sloppy mode');
  });
  test('a marker inside a comment or a quoted string does not defer', () => {
    expect(scriptBodyDefer("// Noodl.Files.upload would be bad\nScript.Outputs.x = 'not Component.Object';")).toBeNull();
  });
  test.each([
    ['timers', 'let t; Script.Signals.Start = function () { t = setInterval(() => {}, 1000); };'],
    ['the DOM', 'Script.Signals.Go = function () { document.title = "x"; };'],
    ['the browser environment', 'Script.OnInit = function () { Script.Outputs.w = window.innerWidth; };'],
    ['media devices', 'const g = navigator.mediaDevices; Script.Signals.Start = async function () { await g.getUserMedia({ audio: true }); };'],
    ['fetch', 'Script.Signals.Load = async function () { Script.Outputs.body = await (await fetch("/x")).text(); };'],
    ['async / await', 'Script.Signals.Go = async function () { await Promise.resolve(); };'],
    ['the clock', 'Script.Signals.Go = function () { Script.Outputs.now = Date.now(); };'],
    ['randomness', 'Script.Signals.Go = function () { Script.Outputs.n = Math.random(); };'],
    ['`this` across runs', 'Script.Signals.Go = function () { this.count = (this.count || 0) + 1; };'],
    ['module-level state', 'let seconds = 0; Script.Signals.Tick = function () { seconds++; Script.Outputs.s = seconds; };'],
    ['every one of the four fixture bodies', ['ticker', 'greeter', 'doubler', 'bumper'].map(codeOf).join('\n')]
  ])('%s is NOT refused — the host runs the code inside effects and handlers, as the runtime does', (_label, body) => {
    expect(scriptBodyDefer(body)).toBeNull();
  });
  test('the corpus: every distinct Script body on disk compiles both ways (strictprobe.js) — the sloppy-only gate is a guard, not a filter', () => {
    // A `with` is the one sloppy-only construct the corpus does not use; the gate exists so that a
    // body written with one is refused rather than emitted into a module that cannot compile.
    expect(scriptBodyDefer('with (Math) {}')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------
// §B — the ports: read off disk, split the way the hook needs them.
// ---------------------------------------------------------------------------------------------

describe('§B the ports come from disk, split by plug and kind', () => {
  test('the greeter: a value in, a signal in, a value out, a signal out', () => {
    const ports = scriptPortsOf(nodeOf(baseIr, HOME, 'greeter'));
    expect(ports.inputs.map((p) => `${p.name}:${p.type}`)).toEqual(['Name:string']);
    expect(ports.signalInputs).toEqual(['Greet']);
    expect(ports.outputs.map((p) => `${p.name}:${p.type}`)).toEqual(['Greeting:string']);
    expect(ports.signalOutputs).toEqual(['Greeted']);
  });
  test('the node\'s own static inputs and the type rows are never script ports', () => {
    const node = structuredClone(nodeOf(baseIr, HOME, 'greeter'));
    node.declaredPorts.push(
      { name: 'code', plug: 'input', kind: 'value', type: 'string' },
      { name: 'useExternalFile', plug: 'input', kind: 'value', type: 'enum' },
      { name: 'intype-Name', plug: 'input', kind: 'value', type: 'enum' },
      { name: 'outtype-Greeting', plug: 'input', kind: 'value', type: 'enum' }
    );
    const ports = scriptPortsOf(node);
    expect(ports.inputs.map((p) => p.name)).toEqual(['Name']);
    expect(ports.signalInputs).toEqual(['Greet']);
  });
  test('scriptNamesPorts sees every DSL generation, and not a comment', () => {
    expect(scriptNamesPorts(codeOf('ticker'))).toBe(true); // Script.Signals / Script.Outputs
    expect(scriptNamesPorts(codeOf('doubler'))).toBe(true); // define({
    expect(scriptNamesPorts(codeOf('bumper'))).toBe(true); // script({
    expect(scriptNamesPorts("console.log('hi');")).toBe(false);
    expect(scriptNamesPorts('// Outputs.x someday\nconsole.log(1);')).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------
// §C — the emitted page.
// ---------------------------------------------------------------------------------------------

describe('§C the emitted page hosts the four nodes (golden shape)', () => {
  const home = app.files[HOME_FILE];
  test('every one of the four is collapsed into the page, and the fixture reports nothing left out', () => {
    for (const id of ['ticker', 'greeter', 'doubler', 'bumper']) expect(dispositionOf(baseIr, HOME, id)).toEqual({ kind: 'collapsed', into: HOME_FILE });
    expect(notesOf(app, HOME)).toBe('');
    expect(planOf(baseIr, HOME).refusedScripts).toEqual([]);
    expect(home).not.toContain('has an authored script that');
  });
  test('the host and the four definitions are imported, one file each', () => {
    expect(home).toContain("import { useScript } from '../lib/script';");
    for (const name of ['tickerScript', 'greeterScript', 'doublerScript', 'bumperScript']) {
      expect(home).toContain(`import { ${name} } from '../scripts/pages/Home/${name}';`);
      expect(Object.keys(app.files)).toContain(`${SCRIPTS_DIR}${name}.ts`);
    }
    expect(Object.keys(app.files)).toContain(SCRIPT_LIB_PATH);
  });
  test('the hooks: no inputs, a fed input, a fed input with a listener, and each named by its comment', () => {
    expect(home).toContain('  const ticker = useScript(tickerScript, {});');
    expect(home).toContain('  const doubler = useScript(doublerScript, { Base: 21 });');
    expect(home).toContain('  const bumper = useScript(bumperScript, { Count: 21 });');
    expect(home).toContain("  const greeter = useScript(greeterScript, { Name: 'Ada' }, {\n    Greeted: () => greeted.set('yes')\n  });");
    expect(home).toContain('// Ticker — a Script node, hosted by script.ts; its code is src/scripts/pages/Home/tickerScript.ts, verbatim.');
  });
  test('a button into a signal input is one call on the handle', () => {
    expect(home).toContain('<button onClick={() => ticker.signals.Start()}>Start</button>');
    expect(home).toContain('<button onClick={() => ticker.signals.Stop()}>Stop</button>');
    expect(home).toContain('<button onClick={() => greeter.signals.Greet()}>Greet</button>');
    expect(home).toContain('<button onClick={() => bumper.signals.Bump()}>Bump</button>');
  });
  test('a value output at a text sink: a string port bare, any other port through the Text node\'s String() fold', () => {
    expect(home).toContain("<p className={styles.clock}>{String(ticker.outputs.Seconds ?? '')}</p>"); // `*`
    expect(home).toContain('<p className={styles.text}>{greeter.outputs.Greeting}</p>'); // string
    expect(home).toContain("<p className={styles.text}>{String(doubler.outputs.Double ?? '')}</p>"); // number
    expect(home).toContain('<p className={styles.text}>{bumper.outputs.Label}</p>');
  });
  test('the Set Variable behind Greeted collapsed into the page and the Variable behind it still reads', () => {
    expect(dispositionOf(baseIr, HOME, 'setGreeted').kind).toBe('collapsed');
    expect(home).toContain('const greetedValue = useValue(greeted);');
    expect(home).toContain('{greetedValue}');
  });
});

// ---------------------------------------------------------------------------------------------
// §D — the script files: the runtime's wrapper, the code verbatim, the types for the hook.
// ---------------------------------------------------------------------------------------------

describe('§D each script file is the runtime\'s wrapper around the verbatim code', () => {
  const greeterFile = app.files[`${SCRIPTS_DIR}greeterScript.ts`];
  const tickerFile = app.files[`${SCRIPTS_DIR}tickerScript.ts`];
  test('type checking is off for the file, and the header says why', () => {
    expect(greeterFile.startsWith('// @ts-nocheck\n')).toBe(true);
    expect(greeterFile).toContain("written against the Script node's API, not");
    expect(greeterFile).toContain('From the Script node "Greeter" (node greeter) in Pages/Home.');
  });
  test('the wrapper is the runtime\'s: (define, script, Node, Component), the prefix first', () => {
    expect(greeterFile).toContain('  function (define, script, Node, Component) {\n' + SCRIPT_CODE_PREFIX + '\n');
    expect(SCRIPT_CODE_PREFIX).toBe("const Script = (typeof Node !== 'undefined')?Node:undefined;");
  });
  test.each(['ticker', 'greeter', 'doubler', 'bumper'])('%s: the code is verbatim — every byte, indentation included', (id) => {
    const file = app.files[`${SCRIPTS_DIR}${id}Script.ts`];
    // EXP-011 §54. The definition closes with its provenance — where a load failure is raised from.
    expect(file).toContain(`\n${SCRIPT_CODE_PREFIX}\n${codeOf(id)}\n  },\n  { nodeId: ${JSON.stringify(id)}, componentName: "/Pages/Home" }\n);\n`);
  });
  test('the definition carries the ports as the editor discovered them, and the types the hook reads', () => {
    expect(greeterFile).toContain('export const greeterScript = defineScript<{ Name?: string }, { Greeting?: string }>(');
    expect(greeterFile).toContain('  "Greeter",\n  { inputs: { Name: "string", Greet: "signal" }, outputs: { Greeting: "string", Greeted: "signal" } },');
    expect(tickerFile).toContain('export const tickerScript = defineScript<Record<string, never>, { Seconds?: any }>(');
    expect(tickerFile).toContain('{ inputs: { Start: "signal", Stop: "signal" }, outputs: { Seconds: "*" } }');
  });
  test('the import path is the file\'s depth: src/scripts/<dir>/<fileBase>/ is three below src/', () => {
    expect(greeterFile).toContain("import { defineScript } from '../../../lib/script';");
  });
  test('the input type is what is delivered, not what was declared — an untyped delivery is any', () => {
    // A number constant into the greeter's `string` Name: the runtime hands the code the number.
    const ir = cloneIr();
    unwire(ir, HOME, 'nameConst:savedValue->greeter:Name');
    wire(ir, HOME, 'baseConst', 'savedValue', 'greeter', 'Name');
    const built = emitApp(ir, catalog);
    expect(built.files[`${SCRIPTS_DIR}greeterScript.ts`]).toContain('defineScript<{ Name?: number }, { Greeting?: string }>(');
    expect(built.files[HOME_FILE]).toContain("useScript(greeterScript, { Name: 21 }, {");
  });
  test('a declared input nothing feeds keeps its declared type in the interface and is absent from the record', () => {
    const ir = cloneIr();
    unwire(ir, HOME, 'nameConst:savedValue->greeter:Name');
    const built = emitApp(ir, catalog);
    expect(built.files[`${SCRIPTS_DIR}greeterScript.ts`]).toContain('defineScript<{ Name?: string }, { Greeting?: string }>(');
    expect(built.files[HOME_FILE]).toContain('useScript(greeterScript, {}, {');
  });
});

// ---------------------------------------------------------------------------------------------
// §E — the host, run under node. A tiny hook harness stands in for React: refs, reducers and
// effects with the same ordering (effects after the render that declared them, cleanups before
// a re-run, all cleanups on unmount). This grades the lifecycle, which no text assertion can.
// ---------------------------------------------------------------------------------------------

type Lib = {
  defineScript: (name: string, ports: { inputs: Record<string, string>; outputs: Record<string, string> }, source: (...args: any[]) => void) => any;
  useScript: (def: any, inputs?: Record<string, unknown>, on?: Record<string, () => void>) => { outputs: Record<string, unknown>; signals: Record<string, () => void> };
};

/** EXP-011 §54. What the lib raises on `./errors` — recorded by the loader's stub, one entry per raise. */
type AppError = { code: string; message: string; nodeId: string; nodeType: string; componentName: string; detail?: unknown };
const raised: AppError[] = [];
const loadLib = (): { lib: Lib; harness: Harness } => {
  const harness = makeHarness();
  const js = ts.transpileModule(scriptLibSource(), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const module = { exports: {} as Lib };
  // eslint-disable-next-line no-new-func
  new Function('require', 'module', 'exports', js)((name: string) => {
    if (name === 'react') return harness.React;
    // EXP-011 §54. The error channel a load failure is raised on: a stub that records every raise.
    if (name === './errors') return { raiseAppError: (error: AppError) => raised.push(error) };
    throw new Error(`unexpected import ${name}`);
  }, module, module.exports);
  return { lib: module.exports, harness };
};

interface Harness {
  React: { useRef: (v: unknown) => { current: unknown }; useReducer: (r: (s: any, a: any) => any, init: any) => [any, (a: any) => void]; useEffect: (fn: () => void | (() => void), deps?: unknown[]) => void };
  /** Renders `component` (re-rendering while a dispatch is pending), then runs the effects. */
  render<T>(component: () => T): T;
  /** Whether a dispatch happened since the last render. */
  dirty(): boolean;
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
        return [slot.state, (a: any) => { slot.state = r(slot.state, a); dirty = true; }];
      },
      useEffect: (fn, deps) => {
        const i = cursor++;
        pendingEffects.push({ slot: i, fn, deps });
      }
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
    dirty: () => dirty,
    unmount() {
      for (const e of effects) e?.cleanup?.();
    }
  };
  return harness;
}
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('§E the host runs the code the way the runtime does (hook harness under node)', () => {
  let errors: jest.SpyInstance;
  beforeEach(() => {
    errors = jest.spyOn(console, 'error').mockImplementation(() => {});
    raised.length = 0;
  });
  afterEach(() => errors.mockRestore());

  test('gen 3: setup (OnInit), then change with every boot input marked changed; a Setter per changed key; OnInputsChanged', () => {
    const { lib, harness } = loadLib();
    const log: string[] = [];
    const def = lib.defineScript('Log', { inputs: { A: 'number', B: 'number' }, outputs: { Sum: 'number' } }, (_d: unknown, _s: unknown, Node: any) => {
      const Script = Node;
      Script.OnInit = function () { log.push('init'); };
      Script.Setters.A = function (v: number) { log.push(`A=${v}`); };
      Script.OnInputsChanged = function () { log.push('changed'); Script.Outputs.Sum = (Script.Inputs.A || 0) + (Script.Inputs.B || 0); };
    });
    let inputs: Record<string, unknown> = { A: 1, B: 2 };
    const handle = harness.render(() => lib.useScript(def, inputs));
    expect(log).toEqual(['init', 'A=1', 'changed']);
    expect(handle.outputs.Sum).toBe(3);
    // Only the input that changed is delivered; an unchanged one is not a changed key.
    inputs = { A: 5, B: 2 };
    harness.render(() => lib.useScript(def, inputs));
    expect(log).toEqual(['init', 'A=1', 'changed', 'A=5', 'changed']);
    expect(handle.outputs.Sum).toBe(7);
    // The same values again: nothing is delivered, nothing runs.
    inputs = { A: 5, B: 2 };
    harness.render(() => lib.useScript(def, inputs));
    expect(log.length).toBe(5);
  });

  test('gen 1: define({ change }) runs after setup with the boot inputs, and again on a change (the doubler)', () => {
    const { lib, harness } = loadLib();
    const calls: unknown[] = [];
    const def = lib.defineScript('Doubler', { inputs: { Base: 'number' }, outputs: { Double: 'number' } }, (define: any) => {
      define({
        inputs: { Base: 'number' },
        outputs: { Double: 'number' },
        setup() { calls.push('setup'); },
        change(inputs: any, outputs: any, changed: any) { calls.push({ ...changed }); outputs.Double = (inputs.Base || 0) * 2; }
      });
    });
    let inputs: Record<string, unknown> = { Base: 21 };
    const handle = harness.render(() => lib.useScript(def, inputs));
    expect(calls).toEqual(['setup', { Base: true }]);
    expect(handle.outputs.Double).toBe(42);
    inputs = { Base: 4 };
    harness.render(() => lib.useScript(def, inputs));
    expect(handle.outputs.Double).toBe(8);
  });

  test('gen 2: script({ changed, signals }) — changed(new, old) per key, this.setOutputs, this.inputs, methods on this (the bumper)', async () => {
    const { lib, harness } = loadLib();
    const seen: Array<[unknown, unknown]> = [];
    const def = lib.defineScript('Bumper', { inputs: { Count: 'number', Bump: 'signal' }, outputs: { Label: 'string' } }, (_d: unknown, script: any) => {
      script({
        inputs: { Count: 'number' },
        outputs: { Label: 'string' },
        methods: { label(this: any, word: string) { return `${word} ${this.inputs.Count}`; } },
        signals: { Bump(this: any) { this.setOutputs({ Label: this.label('bumped') }); } },
        changed: { Count(this: any, value: unknown, old: unknown) { seen.push([value, old]); this.setOutputs({ Label: this.label('count') }); } }
      });
    });
    let inputs: Record<string, unknown> = { Count: 21 };
    const handle = harness.render(() => lib.useScript(def, inputs));
    expect(seen).toEqual([[21, undefined]]);
    expect(handle.outputs.Label).toBe('count 21');
    handle.signals.Bump();
    expect(handle.outputs.Label).toBe('count 21'); // not yet — after the pass
    await tick();
    expect(handle.outputs.Label).toBe('bumped 21');
    expect(harness.dirty()).toBe(true); // the write asked for a re-render
    inputs = { Count: 22 };
    harness.render(() => lib.useScript(def, inputs));
    expect(seen).toEqual([[21, undefined], [22, 21]]);
    expect(handle.outputs.Label).toBe('count 22');
  });

  test('a signal output pulses the listener the component passed — the latest one', async () => {
    const { lib, harness } = loadLib();
    const def = lib.defineScript('Greeter', { inputs: { Name: 'string', Greet: 'signal' }, outputs: { Greeting: 'string', Greeted: 'signal' } }, (_d: unknown, _s: unknown, Node: any) => {
      const Script = Node;
      Script.Signals.Greet = function () { Script.Outputs.Greeting = 'Hello, ' + (Script.Inputs.Name || 'stranger') + '!'; Script.Outputs.Greeted(); };
    });
    const fired: string[] = [];
    let on: Record<string, () => void> = { Greeted: () => fired.push('first') };
    const handle = harness.render(() => lib.useScript(def, { Name: 'Ada' }, on));
    handle.signals.Greet();
    await tick();
    expect(handle.outputs.Greeting).toBe('Hello, Ada!');
    expect(fired).toEqual(['first']);
    on = { Greeted: () => fired.push('second') };
    harness.render(() => lib.useScript(def, { Name: 'Ada' }, on));
    handle.signals.Greet();
    await tick();
    expect(fired).toEqual(['first', 'second']);
  });

  test('the signal function runs after the pass: an input set in the same handler is visible to it (the runtime\'s schedule)', async () => {
    const { lib, harness } = loadLib();
    const def = lib.defineScript('Greeter', { inputs: { Name: 'string', Greet: 'signal' }, outputs: { Greeting: 'string' } }, (_d: unknown, _s: unknown, Node: any) => {
      Node.Signals.Greet = function () { Node.Outputs.Greeting = 'Hello, ' + Node.Inputs.Name + '!'; };
    });
    let inputs: Record<string, unknown> = { Name: 'Ada' };
    const handle = harness.render(() => lib.useScript(def, inputs));
    // A handler: pulse, then set a Variable the input reads — React commits the new value before the microtask.
    handle.signals.Greet();
    inputs = { Name: 'Bo' };
    harness.render(() => lib.useScript(def, inputs));
    await tick();
    expect(handle.outputs.Greeting).toBe('Hello, Bo!');
  });

  test('two pulses of one signal in one pass coalesce into one call; two passes are two calls', async () => {
    const { lib, harness } = loadLib();
    let calls = 0;
    const def = lib.defineScript('Counter', { inputs: { Go: 'signal' }, outputs: {} }, (_d: unknown, _s: unknown, Node: any) => {
      Node.Signals.Go = function () { calls++; };
    });
    const handle = harness.render(() => lib.useScript(def, {}));
    handle.signals.Go();
    handle.signals.Go();
    await tick();
    expect(calls).toBe(1);
    handle.signals.Go();
    await tick();
    handle.signals.Go();
    await tick();
    expect(calls).toBe(3);
  });

  test('unmount runs destroy and kills the node: a later pulse runs nothing, a later write publishes nothing', async () => {
    const { lib, harness } = loadLib();
    const log: string[] = [];
    const def = lib.defineScript('Timer', { inputs: { Go: 'signal' }, outputs: { X: '*' } }, (_d: unknown, _s: unknown, Node: any) => {
      Node.OnDestroy = function () { log.push('destroy'); };
      Node.Signals.Go = function () { log.push('go'); };
    });
    const handle = harness.render(() => lib.useScript(def, {}));
    harness.unmount();
    expect(log).toEqual(['destroy']);
    handle.signals.Go();
    await tick();
    expect(log).toEqual(['destroy']);
  });

  test('a throw inside a signal function is logged and swallowed; what it wrote before the throw stands', async () => {
    const { lib, harness } = loadLib();
    const def = lib.defineScript('Thrower', { inputs: { Go: 'signal' }, outputs: { Before: 'string' } }, (_d: unknown, _s: unknown, Node: any) => {
      Node.Signals.Go = function () { Node.Outputs.Before = 'written'; throw new Error('boom'); };
    });
    const handle = harness.render(() => lib.useScript(def, {}));
    handle.signals.Go();
    await tick();
    expect(handle.outputs.Before).toBe('written');
    expect(errors).toHaveBeenCalledWith(expect.stringContaining('Thrower: signal Go threw'), expect.any(Error));
  });

  test('a throw while the code is loaded leaves the node inert, as the runtime\'s source-failed does', () => {
    const { lib, harness } = loadLib();
    const def = lib.defineScript('Broken', { inputs: { Go: 'signal' }, outputs: { X: '*' } }, () => {
      throw new Error('bad at load');
    });
    const handle = harness.render(() => lib.useScript(def, {}));
    expect(handle.outputs.X).toBeUndefined();
    // EXP-011 §54. javascript.ts raises script/source-failed on the error channel; the console line is the channel's default, not the lib's.
    expect(raised).toEqual([expect.objectContaining({ code: 'script/source-failed', message: expect.stringContaining('The script could not be loaded: '), nodeId: 'Broken', nodeType: 'Javascript2', componentName: '<runtime>' })]);
    expect(errors).not.toHaveBeenCalledWith(expect.stringContaining('could not be loaded'), expect.anything());
  });

  test('only the ports on disk exist: a write to an undeclared output is not readable, an undeclared signal call throws (and is logged)', async () => {
    const { lib, harness } = loadLib();
    const def = lib.defineScript('Stray', { inputs: { Go: 'signal' }, outputs: { Known: '*' } }, (_d: unknown, _s: unknown, Node: any) => {
      Node.Signals.Go = function () { Node.Outputs.Known = 1; Node.Outputs.Unknown = 2; Node.Outputs.Nope(); };
    });
    const handle = harness.render(() => lib.useScript(def, {}));
    handle.signals.Go();
    await tick();
    expect(handle.outputs.Known).toBe(1);
    expect((handle.outputs as Record<string, unknown>).Unknown).toBeUndefined();
    expect(errors).toHaveBeenCalledWith(expect.stringContaining('signal Go threw'), expect.any(TypeError));
  });

  test('an input nothing feeds reads undefined; `this` carries flagOutputDirty and sendSignalOnOutput for gen 1', () => {
    const { lib, harness } = loadLib();
    const seen: unknown[] = [];
    const fired: string[] = [];
    const def = lib.defineScript('Probe', { inputs: { Never: 'string' }, outputs: { Out: '*', Sig: 'signal' } }, (define: any) => {
      define({
        inputs: { Never: 'string' },
        outputs: { Out: '*', Sig: 'signal' },
        setup(this: any, inputs: any, outputs: any) { seen.push(inputs.Never, 'Never' in inputs); outputs.Out = 'set'; this.flagOutputDirty('Out'); this.sendSignalOnOutput('Sig'); }
      });
    });
    const handle = harness.render(() => lib.useScript(def, {}, { Sig: () => fired.push('sig') }));
    expect(seen).toEqual([undefined, true]);
    expect(handle.outputs.Out).toBe('set');
    expect(fired).toEqual(['sig']);
  });

  test('the four fixture bodies load under the host without throwing (the ticker\'s interval is never started)', () => {
    const { lib, harness } = loadLib();
    for (const id of ['ticker', 'greeter', 'doubler', 'bumper']) {
      const ports = scriptPortsOf(nodeOf(baseIr, HOME, id));
      // eslint-disable-next-line no-new-func
      const source = new Function('define', 'script', 'Node', 'Component', `${SCRIPT_CODE_PREFIX}\n${codeOf(id)}`) as (...args: any[]) => void;
      const def = lib.defineScript(id, {
        inputs: Object.fromEntries([...ports.inputs.map((p) => [p.name, p.type ?? '*']), ...ports.signalInputs.map((s) => [s, 'signal'])]),
        outputs: Object.fromEntries([...ports.outputs.map((p) => [p.name, p.type ?? '*']), ...ports.signalOutputs.map((s) => [s, 'signal'])])
      }, source);
      harness.render(() => lib.useScript(def, id === 'doubler' ? { Base: 21 } : id === 'bumper' ? { Count: 21 } : {}));
    }
    expect(errors).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------------------------
// §F — the refused shape, built by mutation: the corpus stays clean (in-code-markers' control).
// ---------------------------------------------------------------------------------------------

describe('§F a refused Script keeps every behaviour the reverted arm had — and names itself', () => {
  const ir = withUploader();
  const built = emitApp(ir, catalog);
  const home = built.files[HOME_FILE];
  test('the node is deferred with the gate\'s sentence, and the four beside it still translate', () => {
    expect(dispositionOf(ir, HOME, 'uploader')).toEqual({ kind: 'deferred', to: 'EXP-003', reason: 'the code reads the Noodl API — the runtime-coupled tier (EXP-003 Tier B)' });
    for (const id of ['ticker', 'greeter', 'doubler', 'bumper']) expect(dispositionOf(ir, HOME, id).kind).toBe('collapsed');
    expect(planOf(ir, HOME).scripts.map((s) => s.nodeId).sort()).toEqual(['bumper', 'doubler', 'greeter', 'ticker']);
  });
  test('its code survives as the comment block, verbatim, and no definition file is written for it', () => {
    expect(home).toContain('// TODO(export): the Javascript2 "Uploader" (node uploader) has an authored script that');
    expect(home).toContain('//       const cloudFile = await Noodl.Files.upload(file);');
    expect(Object.keys(built.files).some((f) => f.includes('uploader'))).toBe(false);
    expect(count(home, 'has an authored script that')).toBe(1);
  });
  test('the cascade: the button\'s wire is dropped naming the reason, the Text stays blank with a marker, the report names the node', () => {
    expect(notesOf(built, HOME)).toContain('wire uploadBtn:onClick->uploader:Upload dropped: the code reads the Noodl API');
    expect(home).toContain('<button>Upload</button>');
    expect(home).toContain('into Javascript2 uploader.Upload, was dropped: the code reads the Noodl API');
    expect(built.files['EXPORT-REPORT.md']).toContain('- "Uploader" (Script) — the code reads the Noodl API — the runtime-coupled tier (EXP-003 Tier B)');
  });
  test('the pre-flight names it as a refused node, with no pathway verdict (a Script is not a pathway type)', () => {
    const summary = summarizePreflight(built);
    const homeRow = summary.attention.find((a) => a.path === HOME)!;
    expect(homeRow.nodes.map((n) => `${n.label}:${n.displayName}:${n.pathway}`)).toEqual(['Uploader:Script:false']);
    expect(summary.verdict).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------
// §G — the graph gates, each by mutation, each with the sentence a person reads.
// ---------------------------------------------------------------------------------------------

describe('§G the graph gates', () => {
  test('Use External File: the code is fetched at runtime, so it is not here to host', () => {
    const ir = cloneIr();
    setParam(nodeOf(ir, HOME, 'greeter'), 'useExternalFile', { kind: 'literal', value: 'yes' });
    expect(dispositionOf(ir, HOME, 'greeter').reason).toContain('loaded from a URL at runtime');
  });
  test('no code: the node has nothing to run', () => {
    const ir = cloneIr();
    setCode(nodeOf(ir, HOME, 'greeter'), '   ');
    expect(dispositionOf(ir, HOME, 'greeter').reason).toBe('the node has no code');
  });
  test('ports not discovered: code that names ports, on a node with none on disk — the editor has not opened it', () => {
    const ir = cloneIr();
    const node = nodeOf(ir, HOME, 'greeter');
    node.declaredPorts = [];
    unwire(ir, HOME, 'nameConst:savedValue->greeter:Name');
    unwire(ir, HOME, 'greetBtn:onClick->greeter:Greet');
    unwire(ir, HOME, 'greeter:Greeting->greetingText:text');
    unwire(ir, HOME, 'greeter:Greeted->setGreeted:do');
    expect(dispositionOf(ir, HOME, 'greeter').reason).toContain('its ports have not been discovered yet');
  });
  test('no ports and code that names none: hosted with an empty port set, as the runtime runs it', () => {
    const ir = cloneIr();
    const node = nodeOf(ir, HOME, 'greeter');
    node.declaredPorts = [];
    setCode(node, "console.log('side effect at load');");
    for (const key of ['nameConst:savedValue->greeter:Name', 'greetBtn:onClick->greeter:Greet', 'greeter:Greeting->greetingText:text', 'greeter:Greeted->setGreeted:do']) unwire(ir, HOME, key);
    expect(dispositionOf(ir, HOME, 'greeter').kind).toBe('collapsed');
    const built = emitApp(ir, catalog);
    expect(built.files[HOME_FILE]).toContain('const greeter = useScript(greeterScript, {});');
    expect(built.files[`${SCRIPTS_DIR}greeterScript.ts`]).toContain('defineScript<Record<string, never>, Record<string, never>>(');
    expect(built.files[`${SCRIPTS_DIR}greeterScript.ts`]).toContain('{ inputs: {  }, outputs: {  } }');
  });
  test('a wire from an output the node has not got refuses the node by name', () => {
    const ir = cloneIr();
    wire(ir, HOME, 'greeter', 'Nope', 'doubleText', 'text');
    expect(dispositionOf(ir, HOME, 'greeter').reason).toBe('its Nope output is consumed, and this node has no such port');
  });
  test('a signal output read as a value is a pulse with nothing to read', () => {
    const ir = cloneIr();
    wire(ir, HOME, 'greeter', 'Greeted', 'doubleText', 'text');
    expect(dispositionOf(ir, HOME, 'greeter').reason).toBe('its Greeted output is consumed as a value — a pulse carries nothing to read');
  });
  test('two wires into one input: last-writer-wins is not statically ordered', () => {
    const ir = cloneIr();
    wire(ir, HOME, 'yesConst', 'savedValue', 'greeter', 'Name');
    expect(dispositionOf(ir, HOME, 'greeter').reason).toBe('two wires feed its Name input — last-writer-wins is not statically ordered');
  });
  test('an input fed by something with no static source refuses the node, naming the feeder', () => {
    const ir = cloneIr();
    const home = componentOf(ir, HOME);
    // §59 re-pointed the feeder from `Hash` (translated since) to `Pattern Extractor`, §50's own out-of-scope list.
    home.nodes.push({ id: 'pattern', type: 'net.noodl.PatternExtractor', catalogRef: 'net.noodl.PatternExtractor', parameters: [], declaredPorts: [], portKnowledge: 'partial' });
    unwire(ir, HOME, 'nameConst:savedValue->greeter:Name');
    wire(ir, HOME, 'pattern', 'match', 'greeter', 'Name');
    expect(dispositionOf(ir, HOME, 'greeter').reason).toBe('its Name input is fed by net.noodl.PatternExtractor — no statically known source in the emit vocabulary');
  });
  test('a signal-output chain that lands on nothing translatable refuses the node with the chain\'s reason', () => {
    const ir = cloneIr();
    const home = componentOf(ir, HOME);
    home.nodes.push({ id: 'pattern', type: 'net.noodl.PatternExtractor', catalogRef: 'net.noodl.PatternExtractor', parameters: [], declaredPorts: [], portKnowledge: 'partial' });
    wire(ir, HOME, 'greeter', 'Greeted', 'pattern', 'extract', 'signal');
    expect(dispositionOf(ir, HOME, 'greeter').reason).toBe('its Greeted output drives no translatable action');
  });
  test('a Script firing another Script: the listener is one call on the other handle', () => {
    const ir = cloneIr();
    wire(ir, HOME, 'greeter', 'Greeted', 'bumper', 'Bump', 'signal');
    const built = emitApp(ir, catalog);
    expect(built.files[HOME_FILE]).toContain("    Greeted: () => { greeted.set('yes'); bumper.signals.Bump(); }");
    expect(typecheckEmittedApp(built)).toEqual([]);
  });
  test('a Script output into another Script\'s input: a live read as the hook argument', () => {
    const ir = cloneIr();
    unwire(ir, HOME, 'nameConst:savedValue->greeter:Name');
    wire(ir, HOME, 'bumper', 'Label', 'greeter', 'Name');
    const built = emitApp(ir, catalog);
    expect(built.files[HOME_FILE]).toContain('useScript(greeterScript, { Name: bumper.outputs.Label }, {');
    expect(built.files[`${SCRIPTS_DIR}greeterScript.ts`]).toContain('defineScript<{ Name?: string }, { Greeting?: string }>(');
    expect(typecheckEmittedApp(built)).toEqual([]);
  });
  test('a signal input fired from a chain: a Delay\'s Finished into Greet', () => {
    const ir = cloneIr();
    const home = componentOf(ir, HOME);
    home.nodes.push({ id: 'later', type: 'Timer', catalogRef: 'Timer', authoredLabel: 'Later', parameters: [{ name: 'duration', value: { kind: 'literal', value: 300 } }], declaredPorts: [], portKnowledge: 'complete' });
    unwire(ir, HOME, 'greetBtn:onClick->greeter:Greet');
    wire(ir, HOME, 'greetBtn', 'onClick', 'later', 'start', 'signal');
    wire(ir, HOME, 'later', 'timerFinished', 'greeter', 'Greet', 'signal');
    const built = emitApp(ir, catalog);
    expect(built.files[HOME_FILE]).toContain('greeter.signals.Greet()');
    expect(dispositionOf(ir, HOME, 'greeter').kind).toBe('collapsed');
  });
  test('a static input wired (the code itself) refuses the node', () => {
    const ir = cloneIr();
    wire(ir, HOME, 'nameConst', 'savedValue', 'greeter', 'code');
    expect(dispositionOf(ir, HOME, 'greeter').reason).toBe('its code is wired — only authored code and ports translate');
  });
  test('a literal parameter on a declared input folds into the record — the corpus date picker\'s colours', () => {
    const ir = cloneIr();
    const node = nodeOf(ir, HOME, 'doubler');
    node.declaredPorts.push({ name: 'Scale', plug: 'input', kind: 'value', type: 'number' });
    setParam(node, 'Scale', { kind: 'literal', value: 3 });
    const built = emitApp(ir, catalog);
    expect(built.files[HOME_FILE]).toContain('useScript(doublerScript, { Base: 21, Scale: 3 })');
    expect(built.files[`${SCRIPTS_DIR}doublerScript.ts`]).toContain('defineScript<{ Base?: number; Scale?: number }, { Double?: number }>(');
  });
  test('two nodes with one label: distinct locals, distinct definitions, distinct files', () => {
    const ir = cloneIr();
    const twin = structuredClone(nodeOf(ir, HOME, 'doubler'));
    twin.id = 'doubler2';
    componentOf(ir, HOME).nodes.push(twin);
    const built = emitApp(ir, catalog);
    const home = built.files[HOME_FILE];
    expect(home).toContain('const doubler = useScript(doublerScript, { Base: 21 });');
    expect(home).toContain('const doubler2 = useScript(doubler2Script, {});');
    expect(Object.keys(built.files)).toContain(`${SCRIPTS_DIR}doubler2Script.ts`);
    expect(typecheckEmittedApp(built)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------
// §H — the ledger, the badge, the pre-flight on the clean fixture.
// ---------------------------------------------------------------------------------------------

describe('§H the ledger and the pre-flight', () => {
  test('Javascript2 is translated; the badge is gone; the floor is 96 (since §54)', () => {
    expect(ledgerEntryOf('Javascript2')).toEqual({ typeName: 'Javascript2', status: 'translated' });
    expect(exportBadgeOf('Javascript2')).toBeUndefined();
    const ledger = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'coverage-ledger.json'), 'utf8'));
    expect(ledger.pickerCoverageFloor).toBe(117); // §66 Subscribe To Changes (session 90) on top of §65 WebSocket (session 89) on top of §64 Server-Sent Events (session 88) on top of §61 the component-stack trio + §60 the component-object trio + §62 the relation pair + §63 Drag (session 86); §57 + §58 + §59 (session 85) // §56 Filter Records (session 84)
  });
  test('the clean fixture pre-flights with nothing to attend to', () => {
    const summary = summarizePreflight(app);
    expect(summary.attention).toEqual([]);
    expect(summary.refusals).toBe(0);
    expect(summary.generatedFiles).toBeGreaterThanOrEqual(17);
  });
});

// ---------------------------------------------------------------------------------------------
// §I / §J — the whole fixture typechecks; a fixture with no Script ships neither the host nor a file.
// ---------------------------------------------------------------------------------------------

describe('§I the fixture typechecks as a real ts.Program; §J the control fixture ships no host', () => {
  test('the emitted app, script files included, has no semantic diagnostics', () => {
    expect(typecheckEmittedApp(app)).toEqual([]);
  });
  test('the refused variant typechecks too', () => {
    expect(typecheckEmittedApp(emitApp(withUploader(), catalog))).toEqual([]);
  });
  test('slot-desk (no Script node) emits no src/lib/script.ts and no src/scripts/', () => {
    const control = emitApp(parseProject(path.join(__dirname, 'fixtures', 'slot-desk'), catalog), catalog);
    expect(Object.keys(control.files).filter((f) => f === SCRIPT_LIB_PATH || f.startsWith('src/scripts/'))).toEqual([]);
  });
});
