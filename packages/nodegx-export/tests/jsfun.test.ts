import * as fs from 'fs';
import * as path from 'path';

import { Catalog } from '../src/catalog';
import { emitApp } from '../src/emit/emitApp';
import { parseProject } from '../src/parse/parseProject';
import { jsPurityDefer } from '../src/analyze/jsfun';
import { ComponentIR, ExportIR, NodeIR, ParamValue } from '../src/ir/types';

const FIXTURE = path.join(__dirname, 'fixtures', 'cheer');
const CATALOG_PATH = path.join(__dirname, '..', '..', 'noodl-types', 'src', 'node-catalog.json');

const catalog: Catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
const ir = parseProject(FIXTURE, catalog);
const app = emitApp(ir, catalog);

const cloneIr = (): ExportIR => structuredClone(ir);
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
const wire = (
  source: ExportIR,
  componentPath: string,
  fromId: string,
  fromProperty: string,
  toId: string,
  toProperty: string,
  kind: 'value' | 'signal' = 'value'
) => {
  componentOf(source, componentPath).connections.push({
    key: `${fromId}:${fromProperty}->${toId}:${toProperty}`,
    fromId,
    fromProperty,
    toId,
    toProperty,
    kind
  });
};
const unwire = (source: ExportIR, componentPath: string, key: string) => {
  const component = componentOf(source, componentPath);
  component.connections = component.connections.filter((c) => c.key !== key);
};
/** A fresh Function/Expression node on Home, script attached, label naming the wrapper. */
const addJsNode = (source: ExportIR, id: string, type: 'JavaScriptFunction' | 'Expression', script: string) => {
  const home = componentOf(source, 'Pages/Home');
  home.nodes.push({
    id,
    type,
    catalogRef: type,
    authoredLabel: id,
    parameters: [
      {
        name: type === 'JavaScriptFunction' ? 'functionScript' : 'expression',
        value: { kind: 'script', source: script }
      }
    ],
    declaredPorts: [],
    portKnowledge: type === 'JavaScriptFunction' ? 'unknown' : 'partial'
  });
};

// ---------------------------------------------------------------------------------------------
// Session 14 (EXP-003-JS-TARGET-OUTPUT §3–§4): the pure re-host slice. A Function/Expression
// body that touches nothing but Inputs/Outputs emits verbatim inside a typed wrapper —
// correctness by construction, no LLM, no traces. Every §3 failure is a named defer.
// ---------------------------------------------------------------------------------------------

describe('the purity gate over bodies (EXP-003 §3.1–§3.4)', () => {
  test('a syntax error is a first-class defer — the corpus junk body, verbatim', () => {
    expect(jsPurityDefer('function', 'Script.Signal.runOnce = function')).toContain('does not compile');
  });

  test('an expression that does not compile defers with the message', () => {
    expect(jsPurityDefer('expression', 'count ===')).toContain('does not compile');
  });

  test('a body that only compiles sloppy defers — the emitted module is strict TS', () => {
    expect(jsPurityDefer('function', 'var mask = 010;\nOutputs.x = mask;')).toContain('compiles only in sloppy mode');
  });

  test('the Noodl API is the runtime-coupled tier', () => {
    expect(jsPurityDefer('function', "Noodl.Events.emit('go');")).toContain('EXP-003 Tier B');
  });

  test('the Component scope is the Filters family — per-component rewrites', () => {
    expect(jsPurityDefer('function', 'Component.UpdateCondition();')).toContain('controlled-state slice');
  });

  test('`this` persists across runs — cross-run state defers', () => {
    expect(jsPurityDefer('function', 'this.count = (this.count || 0) + 1;')).toContain('cross-run state');
  });

  test.each([
    ['new Date()', 'Outputs.now = new Date().toISOString();', 'clock'],
    ['Math.random', 'Outputs.n = Math.random();', 'randomness'],
    ['fetch', "fetch('/api');", 'network'],
    ['setTimeout', 'setTimeout(() => {}, 100);', 'timers'],
    ['window', 'Outputs.w = window.innerWidth;', 'browser environment'],
    ['dynamic import', "import('lodash');", 'dynamically'],
    ['async/await', 'await Promise.resolve();', 'asynchronous'],
    ['arguments', 'Outputs.n = arguments.length;', 'arguments']
  ])('%s is a named nondeterminism/environment defer', (_label, body, fragment) => {
    expect(jsPurityDefer('function', body)).toContain(fragment);
  });

  test('a marker inside a comment or a quoted string does not defer', () => {
    expect(jsPurityDefer('function', "// window.fetch would be bad\nOutputs.x = 'not a setTimeout';")).toBeNull();
  });

  test('an Expression reading a bare Noodl global defers — reactively subscribed at runtime', () => {
    expect(jsPurityDefer('expression', 'Variables.count + 1')).toContain('Noodl Variables global');
  });

  test('the Expression preamble alias `random` is the same randomness defer', () => {
    expect(jsPurityDefer('expression', 'random() > 0.5')).toContain('randomness');
  });

  test('the corpus junk bodies that do compile pass the body gate — the graph decides their fate', () => {
    expect(jsPurityDefer('function', 'zzzUndefinedThing;')).toBeNull();
    expect(jsPurityDefer('function', 'const total = pri')).toBeNull();
  });
});

describe('the fixture translation (EXP-003 §4 A1 — asserted piecewise; the byte golden lives in stores-events)', () => {
  const home = app.files['src/pages/Home.tsx'];

  test('the Function body is re-hosted verbatim in a typed wrapper above the component', () => {
    expect(home).toContain('function formatShout(Inputs: { name?: string }): { text?: any } {');
    expect(home).toContain("const name = Inputs.name || 'friend';\nOutputs.text = name.toUpperCase() + '!';");
    expect(home).toContain('return Outputs;');
  });

  test('the wrapper catches like the runtime catches — a throw publishes what was written', () => {
    expect(home).toContain("console.error('Function node formatShout threw:', e);");
    expect(home).toContain("console.error('Expression node hasLongName threw:', e);\n    return 0;");
  });

  test('one render local per instance; the children sink folds the maybe-undefined output', () => {
    expect(home).toContain('const formatShoutOut = formatShout({ name });');
    expect(home).toContain("{formatShoutOut.text ?? ''}");
  });

  test('the Expression collapses to a return; Is True gates the truthiness sink', () => {
    expect(home).toContain("return ((name || '').length > 1);");
    expect(home).toContain('disabled={!hasLongNameOut}');
  });

  test('the runtime mints a port for `.length` after a paren — the wrapper carries it, unfed', () => {
    // parsePorts strips the string, then matches `length` as a fresh identifier; the runtime
    // registers that port too, it just never receives. Faithfulness includes the odd ports.
    expect(home).toContain('function hasLongName({ name, length }: { name?: string; length?: any }) {');
  });

  test('both nodes collapse — no JS deferral notes on the untouched fixture', () => {
    expect(app.notes.filter((n) => /formatShout|hasLongName/.test(n))).toEqual([]);
  });
});

describe('the graph-side gate (EXP-003 §3.5–§3.7), each a named defer', () => {
  test('an unticked Run On Value Change input is a stale snapshot — deferred', () => {
    const mutated = cloneIr();
    setParam(nodeOf(mutated, 'Pages/Home', 'formatShout'), 'runOnChange-in-name', { kind: 'literal', value: false });
    const result = emitApp(mutated, catalog);
    expect(result.notes.join('\n')).toContain('input "name" is unticked under Run On Value Change');
  });

  test('an input fed by a deferred node defers as collateral, naming the feeder', () => {
    const mutated = cloneIr();
    unwire(mutated, 'Pages/Home', 'visitorVar:value->formatShout:in-name');
    wire(mutated, 'Pages/Home', 'greetingCard', 'Anything', 'formatShout', 'in-name');
    const result = emitApp(mutated, catalog);
    expect(result.notes.join('\n')).toContain('input "name" is fed by /Components/GreetingCard');
  });

  test('a JS node feeding a JS node is a chain — deferred whole in this slice', () => {
    const mutated = cloneIr();
    unwire(mutated, 'Pages/Home', 'visitorVar:value->formatShout:in-name');
    wire(mutated, 'Pages/Home', 'hasLongName', 'asString', 'formatShout', 'in-name');
    const result = emitApp(mutated, catalog);
    expect(result.notes.join('\n')).toContain('JS-node chains are not translated in this slice');
  });

  test('two wires into one input defer — last-writer-wins is not statically ordered', () => {
    const mutated = cloneIr();
    wire(mutated, 'Pages/Home', 'previewFormat', 'formatted', 'formatShout', 'in-name');
    const result = emitApp(mutated, catalog);
    expect(result.notes.join('\n')).toContain('two wires feed input "name"');
  });

  test('a consumed per-run pulse defers the node (§3.6): success', () => {
    const mutated = cloneIr();
    wire(mutated, 'Pages/Home', 'formatShout', 'success', 'cheerSend', 'sendEvent', 'signal');
    const result = emitApp(mutated, catalog);
    expect(result.notes.join('\n')).toContain('its success output is consumed — per-run pulses have no render analogue');
  });

  test('a consumed isTrueEv defers — it fires per evaluation', () => {
    const mutated = cloneIr();
    wire(mutated, 'Pages/Home', 'hasLongName', 'isTrueEv', 'cheerSend', 'sendEvent', 'signal');
    const result = emitApp(mutated, catalog);
    expect(result.notes.join('\n')).toContain('its isTrueEv pulse fires per evaluation');
  });

  test('a consumed author signal output defers the Function', () => {
    const mutated = cloneIr();
    const node = nodeOf(mutated, 'Pages/Home', 'formatShout');
    setParam(node, 'functionScript', {
      kind: 'script',
      source: "const name = Inputs.name || 'friend';\nOutputs.text = name.toUpperCase() + '!';\nOutputs.done();"
    });
    wire(mutated, 'Pages/Home', 'formatShout', 'out-done', 'cheerSend', 'sendEvent', 'signal');
    const result = emitApp(mutated, catalog);
    expect(result.notes.join('\n')).toContain('its signal output "done" is consumed');
  });

  test('an unconsumed mined signal seeds a no-op callable — Outputs.done() cannot throw', () => {
    const mutated = cloneIr();
    setParam(nodeOf(mutated, 'Pages/Home', 'formatShout'), 'functionScript', {
      kind: 'script',
      source: "const name = Inputs.name || 'friend';\nOutputs.text = name.toUpperCase() + '!';\nOutputs.done();"
    });
    const result = emitApp(mutated, catalog);
    const home = result.files['src/pages/Home.tsx'];
    expect(home).toContain('{ text?: any; done: () => void }');
    expect(home).toContain('const Outputs: { text?: any; done: () => void } = { done: () => {} };');
  });

  test('done with Run unwired never pulses — the wire drops with the note', () => {
    const mutated = cloneIr();
    wire(mutated, 'Pages/Home', 'formatShout', 'done', 'cheerSend', 'sendEvent', 'signal');
    const result = emitApp(mutated, catalog);
    expect(result.notes.join('\n')).toContain('done is invocation-only and Run is not wired');
    // The node itself still translates — the value read landed.
    expect(result.files['src/pages/Home.tsx']).toContain('const formatShoutOut');
  });

  test('a run-wired output feeding a render sink materializes the record (§3.7, CONTROLLED-STATE §4f)', () => {
    const mutated = cloneIr();
    wire(mutated, 'Pages/Home', 'cheerButton', 'onClick', 'formatShout', 'run', 'signal');
    const result = emitApp(mutated, catalog);
    const home = result.files['src/pages/Home.tsx'];
    // The output record becomes a state var written where the chain runs; render reads are
    // maybe-undefined until the first invocation — the runtime's own pre-first-run contract.
    expect(home).toContain('const [formatShoutOut, setFormatShoutOut] = useState<{ text?: any } | undefined>();');
    expect(home).toContain('setFormatShoutOut(formatShout(');
    expect(home).toContain("{formatShoutOut?.text ?? ''}");
  });

  test('outputs feeding nothing statically translatable defer — the corpus junk fate', () => {
    const mutated = cloneIr();
    addJsNode(mutated, 'junk', 'JavaScriptFunction', 'const total = pri');
    const result = emitApp(mutated, catalog);
    expect(result.notes.join('\n')).toContain('node junk (JavaScriptFunction) deferred: its outputs feed nothing statically translatable');
  });

  test('an Expression whose inputs never arrive never evaluates — deferred, not computed', () => {
    const mutated = cloneIr();
    unwire(mutated, 'Pages/Home', 'visitorVar:value->hasLongName:name');
    const result = emitApp(mutated, catalog);
    expect(result.notes.join('\n')).toContain('none of its inputs is ever delivered');
  });

  test('a boolean output lands only in the truthiness sink — a text sink defers named', () => {
    const mutated = cloneIr();
    unwire(mutated, 'Pages/Home', 'hasLongName:isTrue->aboutButton:enabled');
    unwire(mutated, 'Pages/Home', 'previewFormat:formatted->cheerPreview:text');
    wire(mutated, 'Pages/Home', 'hasLongName', 'isTrue', 'cheerPreview', 'text');
    const result = emitApp(mutated, catalog);
    expect(result.notes.join('\n')).toContain('its isTrue feeds Text.text, which has no static binding in this slice');
  });
});

describe('dead wires — the runtime never delivers a bare-named Function port (nodescope catches the connect)', () => {
  test('an input wire without the in- prefix drops with the registration note', () => {
    const mutated = cloneIr();
    unwire(mutated, 'Pages/Home', 'visitorVar:value->formatShout:in-name');
    wire(mutated, 'Pages/Home', 'visitorVar', 'value', 'formatShout', 'name');
    const result = emitApp(mutated, catalog);
    expect(result.notes.join('\n')).toContain('a Function input registers as "in-<name>"');
    // The input then reads undefined, faithfully: the wrapper still translates with the
    // body's own fallback ('friend'), because the read landed.
    expect(result.files['src/pages/Home.tsx']).toContain('const formatShoutOut = formatShout({});');
  });

  test('an output wire without the out- prefix drops with the registration note', () => {
    const mutated = cloneIr();
    unwire(mutated, 'Pages/Home', 'formatShout:out-text->shoutText:text');
    wire(mutated, 'Pages/Home', 'formatShout', 'text', 'shoutText', 'text');
    const result = emitApp(mutated, catalog);
    expect(result.notes.join('\n')).toContain('registers no output named "text"');
    expect(result.notes.join('\n')).toContain('its outputs feed nothing statically translatable');
  });

  test("an Expression input that is not one of the expression's identifiers is unobservable", () => {
    const mutated = cloneIr();
    wire(mutated, 'Pages/Home', 'visitorVar', 'value', 'hasLongName', 'ghost');
    const result = emitApp(mutated, catalog);
    expect(result.notes.join('\n')).toContain('does not reference an identifier "ghost"');
  });
});

describe('A2h — invocation-pure, inside the handler chain (EXP-003 §4)', () => {
  const withA2h = () => {
    const mutated = cloneIr();
    addJsNode(mutated, 'shoutOnce', 'JavaScriptFunction', "Outputs.text = (Inputs.name || 'friend').toUpperCase() + '?';");
    const home = componentOf(mutated, 'Pages/Home');
    home.nodes.push({
      id: 'saveShout',
      type: 'Set Variable',
      catalogRef: 'Set Variable',
      parameters: [{ name: 'name', value: { kind: 'literal', value: 'visitorName' } }],
      declaredPorts: [],
      portKnowledge: 'partial'
    });
    wire(mutated, 'Pages/Home', 'visitorVar', 'value', 'shoutOnce', 'in-name');
    wire(mutated, 'Pages/Home', 'cheerButton', 'onClick', 'shoutOnce', 'run', 'signal');
    wire(mutated, 'Pages/Home', 'shoutOnce', 'out-text', 'saveShout', 'value');
    wire(mutated, 'Pages/Home', 'shoutOnce', 'done', 'saveShout', 'do', 'signal');
    return mutated;
  };

  test('the done-chain compiles into the handler; the output read inlines the call', () => {
    const result = emitApp(withA2h(), catalog);
    const home = result.files['src/pages/Home.tsx'];
    expect(home).toContain(
      "onClick={() => { celebrate.emit({ message: visitorName.get() }); visitorName.set(shoutOnce({ name: visitorName.get() }).text); }}"
    );
    // No render local — the invoked node lives only in its chain.
    expect(home).not.toContain('shoutOnceOut');
  });

  test('an invoked node read outside its chain materializes the record as state (§4f)', () => {
    const mutated = withA2h();
    wire(mutated, 'Pages/Home', 'shoutOnce', 'out-text', 'shoutText', 'text');
    const result = emitApp(mutated, catalog);
    const home = result.files['src/pages/Home.tsx'];
    expect(home).toContain('setShoutOnceOut(shoutOnce(');
    expect(home).toContain("{shoutOnceOut?.text ?? ''}");
  });

  test('a Run whose chain drives nothing defers with the note', () => {
    const mutated = cloneIr();
    addJsNode(mutated, 'idle', 'JavaScriptFunction', 'Outputs.text = 1;');
    wire(mutated, 'Pages/Home', 'cheerButton', 'onClick', 'idle', 'run', 'signal');
    const result = emitApp(mutated, catalog);
    expect(result.notes.join('\n')).toContain('its Run drives nothing this slice translates');
  });
});

describe('the typed Expression getters fold exactly as the runtime getters (expression.ts)', () => {
  test("asString folds null/undefined to '' at its sink", () => {
    const mutated = cloneIr();
    unwire(mutated, 'Pages/Home', 'previewFormat:formatted->cheerPreview:text');
    wire(mutated, 'Pages/Home', 'hasLongName', 'asString', 'cheerPreview', 'text');
    const result = emitApp(mutated, catalog);
    expect(result.files['src/pages/Home.tsx']).toContain("String(hasLongNameOut ?? '')");
  });
});
