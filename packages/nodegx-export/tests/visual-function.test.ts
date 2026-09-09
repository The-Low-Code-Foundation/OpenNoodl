import * as fs from 'fs';
import * as path from 'path';

import { Catalog, loadCatalog } from '../src/catalog';
import { emitApp } from '../src/emit/emitApp';
import { parseProject } from '../src/parse/parseProject';
import { censusOf, visualGateOf } from '../src/analyze/logicbuilder';
import { ComponentIR, ExportIR, NodeIR } from '../src/ir/types';

const FIXTURE = path.join(__dirname, 'fixtures', 'cheer');

const catalog: Catalog = loadCatalog();
const baseIr = parseProject(FIXTURE, catalog);

const cloneIr = (): ExportIR => structuredClone(baseIr);
const componentOf = (source: ExportIR, componentPath: string): ComponentIR =>
  source.components.find((c) => c.path === componentPath)!;
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

// ---- workspace construction ------------------------------------------------------------------
// The serialised Blockly shape, built from block descriptors. `detectIO` and `censusOf` both
// read this, so a test that builds one exercises the same parse the runtime does.

interface Block {
  type: string;
  fields?: Record<string, string>;
  inputs?: Record<string, { block?: Block; shadow?: Block }>;
  next?: { block?: Block };
}
const workspace = (...blocks: Block[]): string => JSON.stringify({ blocks: { blocks } });

const defineInput = (name: string, type = 'string'): Block => ({
  type: 'noodl_define_input',
  fields: { NAME: name, TYPE: type }
});
const defineOutput = (name: string, type = 'string'): Block => ({
  type: 'noodl_define_output',
  fields: { NAME: name, TYPE: type }
});
/**
 * A `set output` with **nothing plugged into its value socket** — which the block editor's own
 * generator turns into `Outputs["name"] = null;` (`NoodlGenerators.ts`, `valueToCode(…) || 'null'`).
 * Use `setOutputTo` for the plugged-in shape; the two are not interchangeable.
 */
const setOutput = (name: string): Block => ({ type: 'noodl_set_output', fields: { NAME: name } });
const setOutputTo = (name: string, value: Block): Block => ({
  type: 'noodl_set_output',
  fields: { NAME: name },
  inputs: { VALUE: { block: value } }
});
const text = (value: string): Block => ({ type: 'text', fields: { TEXT: value } });
const getInput = (name: string): Block => ({ type: 'noodl_get_input', fields: { NAME: name } });
const setVariable = (name: string): Block => ({ type: 'noodl_set_variable', fields: { NAME: name } });
const getVariable = (name: string): Block => ({ type: 'noodl_get_variable', fields: { NAME: name } });

/** A Visual Function on Home. `workspaceJson` decides its ports; `code` is what runs. */
const addVisual = (source: ExportIR, id: string, workspaceJson: string, code: string, label?: string) => {
  const home = componentOf(source, 'Pages/Home');
  home.nodes.push({
    id,
    type: 'Logic Builder',
    catalogRef: 'Logic Builder',
    ...(label !== undefined ? { authoredLabel: label } : {}),
    parameters: [
      { name: 'generatedCode', value: { kind: 'literal', value: code } },
      { name: 'workspace', value: { kind: 'literal', value: workspaceJson } }
    ],
    declaredPorts: [],
    portKnowledge: 'partial'
  } as NodeIR);
};

/** A plain Text on Home, so a Visual Function's value output has a rendered sink to land on. */
const addText = (source: ExportIR, id: string) => {
  const home = componentOf(source, 'Pages/Home');
  home.nodes.push({
    id,
    type: 'Text',
    catalogRef: 'Text',
    parameters: [{ name: 'text', value: { kind: 'literal', value: 'idle' } }],
    declaredPorts: [],
    portKnowledge: 'complete'
  } as NodeIR);
  componentOf(source, 'Pages/Home').nodes.find((n) => n.id === 'shell')!.children!.push(id);
};

const homeSource = (source: ExportIR): string => emitApp(source, catalog).files['src/pages/Home.tsx'];
const notesOf = (source: ExportIR): string[] => emitApp(source, catalog).notes;

// The canonical shape: a guarded branch reading an input, writing an output, round-tripping a
// Variable. This is `tut003-log-a-thing-solution`'s program, which is the only corpus Visual
// Function that does real work (LOGIC-BUILDER-TARGET §2 body #4).
// ⚠️ The `set output` sockets are **filled**, as tut003's really are. That is not decoration: an
// empty socket is a different program — the generator writes `null` into it — and this fixture is
// the one every other test here reads as "the canonical complete program".
const GUARD_WORKSPACE = workspace(
  defineInput('entry'),
  defineOutput('message'),
  setOutputTo('message', text('Type something first.')),
  getInput('entry'),
  setVariable('lastEntryTitle'),
  setOutputTo('message', getVariable('lastEntryTitle')),
  getVariable('lastEntryTitle')
);
const GUARD_CODE = `if (!Inputs["entry"]) {
  Outputs["message"] = 'Type something first.';
} else {
  Noodl.Variables["lastEntryTitle"] = Inputs["entry"];
  Outputs["message"] = Noodl.Variables["lastEntryTitle"];
}`;

// ---------------------------------------------------------------------------------------------
// Session 19 (EXP-002-LOGIC-BUILDER-TARGET-OUTPUT). A Visual Function is a third script host:
// the runtime compiles its `generatedCode`, never its workspace. The workspace decides the port
// set and — because the code is GENERATED from a closed block vocabulary — licenses the
// Noodl.Variables binding that a text scan over a hand-written body could never justify.
// ---------------------------------------------------------------------------------------------

describe('the workspace census reads blocks, not generated text', () => {
  test('variable names come off the block fields', () => {
    const census = censusOf(GUARD_WORKSPACE);
    expect(census.variableWrites).toEqual(['lastEntryTitle']);
    expect(census.variableReads).toEqual(['lastEntryTitle']);
  });

  test('an unreadable workspace reports empty rather than throwing', () => {
    expect(censusOf('{not json').empty).toBe(true);
    expect(censusOf(undefined).empty).toBe(true);
  });

  test('an empty `set output` socket is reported apart from a filled one', () => {
    // The generator's rule, restated: `valueToCode(block, 'VALUE', …) || 'null'`. A filled socket
    // must NOT appear here, or every output in the corpus would widen.
    const census = censusOf(workspace(setOutput('bare'), setOutputTo('filled', text('x'))));
    expect(census.outputWrites).toEqual(['bare', 'filled']);
    expect(census.emptyOutputWrites).toEqual(['bare']);
  });

  test('a shadow in the socket counts as plugged in — Blockly generates from it', () => {
    // `valueToCode` resolves the socket's target block, and for a shadow-only connection the
    // target IS the shadow. A census that only looked at `.block` would call this empty.
    const shadowed = workspace({
      type: 'noodl_set_output',
      fields: { NAME: 'shadowed' },
      inputs: { VALUE: { shadow: text('0') } }
    });
    expect(censusOf(shadowed).outputWrites).toEqual(['shadowed']);
    expect(censusOf(shadowed).emptyOutputWrites).toEqual([]);
  });

  test('nested blocks under inputs and next are censused', () => {
    const nested = workspace({
      type: 'controls_if',
      inputs: { DO0: { block: setVariable('deep') } },
      next: { block: getVariable('alsoDeep') }
    });
    expect(censusOf(nested).variableWrites).toEqual(['deep']);
    expect(censusOf(nested).variableReads).toEqual(['alsoDeep']);
  });
});

describe('the vocabulary gate (LOGIC-BUILDER-TARGET §4)', () => {
  const gate = (workspaceJson: string, code: string) =>
    visualGateOf({
      id: 'n',
      type: 'Logic Builder',
      catalogRef: 'Logic Builder',
      parameters: [
        { name: 'generatedCode', value: { kind: 'literal', value: code } },
        { name: 'workspace', value: { kind: 'literal', value: workspaceJson } }
      ],
      declaredPorts: [],
      portKnowledge: 'partial'
    } as NodeIR).defer;

  test('the canonical program passes', () => {
    expect(gate(GUARD_WORKSPACE, GUARD_CODE)).toBeNull();
  });

  test('a node with no blocks and no code is not a deferral — it runs nothing', () => {
    expect(gate('', '')).toBeNull();
  });

  test('an unknown block type defers by name, default-closed', () => {
    expect(gate(workspace({ type: 'noodl_time_travel' }), 'x')).toContain('noodl_time_travel');
  });

  test.each([
    ['noodl_get_config', 'Noodl.Config'],
    ['noodl_get_object', 'Objects model store'],
    ['noodl_get_array', 'Arrays model store'],
    ['noodl_window', 'browser window'],
    ['noodl_library_global', 'library global']
  ])('%s is refused: %s', (blockType, reason) => {
    expect(gate(workspace({ type: blockType }), 'var x = 1;')).toContain(reason);
  });

  test('object and array OPERATIONS are admitted — only the sources are refused', () => {
    // `noodl_get_object_property` generates `object["prop"]` and says nothing about where the
    // object came from; refusing it would defer programs that never touch the model store.
    const pure = workspace(
      { type: 'noodl_new_object' },
      { type: 'noodl_get_object_property', fields: { PROPERTY: 'a' } },
      { type: 'noodl_array_add' },
      { type: 'noodl_json_parse' },
      { type: 'noodl_log' }
    );
    expect(gate(pure, 'var x = ({})["a"];')).toBeNull();
  });

  test('Blockly built-ins are admitted by prefix', () => {
    expect(gate(workspace({ type: 'controls_if' }, { type: 'math_arithmetic' }, { type: 'text_join' }), 'var x = 1;')).toBeNull();
  });

  test('a write to one of the node\'s own output ports defers', () => {
    expect(gate(workspace(setOutput('success')), 'Outputs["success"] = 1;')).toContain("node's own output ports");
  });

  test('a block-declared signal input other than Run defers', () => {
    const ws = workspace({ type: 'noodl_define_signal_input', fields: { NAME: 'recalc' } });
    expect(gate(ws, 'var x = 1;')).toContain('only the built-in Run');
  });

  test('a hat named `run` is NOT a second signal input — it names the built-in port', () => {
    expect(gate(workspace({ type: 'noodl_when_signal', fields: { NAME: 'run' } }), 'var x = 1;')).toBeNull();
  });

  test('a program that does not compile defers with the compiler\'s message', () => {
    expect(gate(workspace(setOutput('a')), 'Outputs["a"] = ;')).toContain('does not compile');
  });

  test('a program that compiles only sloppy defers — the emitted module is strict TS', () => {
    expect(gate(workspace(setOutput('a')), 'var mask = 010;\nOutputs["a"] = mask;')).toContain('sloppy mode');
  });

  test('a workspace with no generated code defers — the editor never flushed', () => {
    expect(gate(GUARD_WORKSPACE, '')).toContain('never flushed');
  });

  test('generated code with no workspace defers — no port set to read', () => {
    expect(gate('', GUARD_CODE)).toContain('no block workspace');
  });
});

describe('the port set comes from detectIO, never from the wire kind (§3.1)', () => {
  test('a block-declared signal output wired as a value is not compiled as a value binding', () => {
    // 🔴 Parse reports `kind: 'value'` for this wire — it cannot see across into a
    // runtime-discovered port set. Only detectIO knows `ok` is a pulse. If the plan believed
    // the wire, a signal would silently become a value binding.
    const ir = cloneIr();
    const ws = workspace(
      { type: 'noodl_define_signal_output', fields: { NAME: 'ok' } },
      { type: 'noodl_send_signal', fields: { NAME: 'ok' } }
    );
    addVisual(ir, 'vf', ws, 'sendSignalOnOutput("ok");', 'Pulser');
    addText(ir, 'pulseText');
    wire(ir, 'Pages/Home', 'cheerButton', 'onClick', 'vf', 'run', 'signal');
    wire(ir, 'Pages/Home', 'vf', 'ok', 'pulseText', 'text'); // parse says value; detectIO says signal
    const notes = notesOf(ir);
    // It is refused as a signal chain, naming the sink — never bound as a value.
    expect(notes.some((n) => n.includes('block-declared signal "ok" drives Text.text'))).toBe(true);
    expect(homeSource(ir)).not.toContain('Pulser(');
  });
});

describe('a Visual Function that never runs emits nothing (§3.5)', () => {
  test('no blocks: static, not deferred, and its Run wire is consumed', () => {
    const ir = cloneIr();
    const home = componentOf(ir, 'Pages/Home');
    home.nodes.push({
      id: 'blank',
      type: 'Logic Builder',
      catalogRef: 'Logic Builder',
      parameters: [],
      declaredPorts: [],
      portKnowledge: 'partial'
    } as NodeIR);
    wire(ir, 'Pages/Home', 'cheerButton', 'onClick', 'blank', 'run', 'signal');
    const notes = notesOf(ir);
    expect(notes.some((n) => n.includes('emits nothing: it has no blocks yet'))).toBe(true);
    // The wire is consumed, so pass 6 must not also report it as untranslated.
    expect(notes.some((n) => n.includes('cheerButton:click->blank:run') && n.includes('no deterministic translation'))).toBe(
      false
    );
  });

  test('nothing wired to Run: the program never executes, so nothing is emitted', () => {
    const ir = cloneIr();
    addVisual(ir, 'idle', GUARD_WORKSPACE, GUARD_CODE, 'NeverRuns');
    const notes = notesOf(ir);
    expect(notes.some((n) => n.includes('emits nothing: nothing is wired to its Run'))).toBe(true);
    expect(homeSource(ir)).not.toContain('NeverRuns');
  });
});

describe('the re-host: the body is verbatim and the shims are supplied (§3.2–§3.4)', () => {
  const built = () => {
    const ir = cloneIr();
    addVisual(ir, 'guard', GUARD_WORKSPACE, GUARD_CODE, 'CheckEntry');
    addText(ir, 'statusText');
    wire(ir, 'Pages/Home', 'cheerButton', 'onClick', 'guard', 'run', 'signal');
    // Fed from a Variable, not from a text input's change event: a `Changed` payload exists only
    // inside its own handler, and running from a different one is a real defer — see below.
    wire(ir, 'Pages/Home', 'visitorVar', 'value', 'guard', 'entry');
    wire(ir, 'Pages/Home', 'guard', 'message', 'statusText', 'text');
    return ir;
  };

  test('the generated body appears verbatim, never reformatted', () => {
    const source = homeSource(built());
    for (const line of GUARD_CODE.split('\n')) expect(source).toContain(line);
  });

  test('the wrapper is named from the authored label and returns the Outputs record', () => {
    const source = homeSource(built());
    // HLS-004: `entry` is wire-fed, so the property is required and its value possibly-undefined,
    // and the block program's verbatim body reads it through the runtime's own scope.
    expect(source).toContain('function CheckEntry(__inputs: { entry: string | undefined }): { message?: string } {');
    expect(source).toContain('const Inputs = __inputs as { [K in keyof typeof __inputs]: any };');
    expect(source).toContain('return Outputs;');
  });

  test('the probe shims are declared unconditionally — identity and no-op, as the runtime passes them', () => {
    const source = homeSource(built());
    expect(source).toContain('const __p = <T,>(_id: string, v: T): T => v;');
    expect(source).toContain('const __s = (_id: string): void => {};');
  });

  test('sendSignalOnOutput collects rather than pulsing — an unwired signal is a no-op in the runtime too', () => {
    expect(homeSource(built())).toContain('const sendSignalOnOutput = (name: string): void => { fired.push(name); };');
  });

  test('Noodl.Variables binds to the app variables store, so the body needs no rewriting', () => {
    const source = homeSource(built());
    expect(source).toContain('get lastEntryTitle(): any { return lastEntryTitle.get(); },');
    expect(source).toContain('set lastEntryTitle(v: any) { lastEntryTitle.set(v); }');
    expect(source).toContain("from '../stores/variables'");
  });

  test('a block-minted Variable is registered even though no Variable node declares it', () => {
    // tut003 proves the case: the blocks mint `lastEntryTitle` alone. Without registry
    // admission the name resolves to nothing and the binding vanishes silently.
    const app = emitApp(built(), catalog);
    expect(app.files['src/stores/variables.ts']).toContain('lastEntryTitle');
  });

  test('the facade separates its accessor pairs — a missing comma is a syntax error', () => {
    // Two variables is the case a single-variable fixture cannot show (found by dumping the
    // artefact, not by a passing test).
    const ir = cloneIr();
    const ws = workspace(setVariable('one'), setVariable('two'), defineOutput('m'), setOutput('m'));
    addVisual(ir, 'twoVars', ws, 'Noodl.Variables["one"] = 1;\nNoodl.Variables["two"] = 2;\nOutputs["m"] = "x";', 'TwoVars');
    addText(ir, 'twoText');
    wire(ir, 'Pages/Home', 'cheerButton', 'onClick', 'twoVars', 'run', 'signal');
    wire(ir, 'Pages/Home', 'twoVars', 'm', 'twoText', 'text');
    const source = homeSource(ir);
    expect(source).toContain('set one(v: any) { one.set(v); },');
    expect(source).toContain('get two(): any { return two.get(); },');
  });

  test('the run wire compiles into the button handler, and the output materializes (§4f)', () => {
    const source = homeSource(built());
    expect(source).toContain('CheckEntry(');
    expect(source).toMatch(/setCheckEntryOut\(/);
  });
});

// ---------------------------------------------------------------------------------------------
// Session 24 (RECORD-VERBS §12). A `Define output … type number` is a claim about the port, not a
// check on the writes: the generator emits `Outputs["result"] = null;` for an empty value socket
// without consulting it, and the runtime stores that null verbatim and sends it down the wire.
// This was 16 of the corpus's 51 remaining diagnostics, across the whole eight-project clone
// family — and it stayed invisible until §11 cleared the syntax errors that suppressed the
// semantic pass.
// ---------------------------------------------------------------------------------------------

describe('an empty `set output` socket writes null, so the wrapper admits it (§12)', () => {
  const NULL_CODE = 'Outputs["result"] = 1 + 2;\nOutputs["result"] = null;';

  /** One Visual Function on Home, run from the button, its `result` landing on a Text. */
  const withVisual = (workspaceJson: string, code = NULL_CODE) => {
    const ir = cloneIr();
    addVisual(ir, 'vf', workspaceJson, code, 'Blocks');
    addText(ir, 'resultText');
    wire(ir, 'Pages/Home', 'cheerButton', 'onClick', 'vf', 'run', 'signal');
    wire(ir, 'Pages/Home', 'vf', 'result', 'resultText', 'text');
    return ir;
  };

  // The discriminating pair: same declared type, same generated code, ONE difference — whether
  // the `set output` block has anything plugged into it.
  const EMPTY_SOCKET = workspace(defineOutput('result', 'number'), setOutput('result'));
  const FILLED_SOCKET = workspace(
    defineOutput('result', 'number'),
    setOutputTo('result', { type: 'math_number', fields: { NUM: '0' } })
  );

  test('the empty socket widens the field, the filled one does not', () => {
    expect(homeSource(withVisual(EMPTY_SOCKET))).toContain(
      'function Blocks(Inputs: Record<string, never>): { result?: number | null } {'
    );
    expect(homeSource(withVisual(FILLED_SOCKET))).toContain(
      'function Blocks(Inputs: Record<string, never>): { result?: number } {'
    );
  });

  test('the local Outputs record is widened too — it is what the body assigns into', () => {
    // Widening only the return type would leave `Outputs["result"] = null` failing on the line
    // that caused all of this. (One string builds both today; this pins that it stays that way.)
    expect(homeSource(withVisual(EMPTY_SOCKET))).toContain('const Outputs: { result?: number | null } = {};');
  });

  test('the materialized last-run state carries the widened type', () => {
    // A second surface: §4f's useState builds its own type from the same output list, and a
    // narrow state row would reintroduce the error one hop downstream.
    expect(homeSource(withVisual(EMPTY_SOCKET))).toContain('useState<{ result?: number | null } | undefined>()');
  });

  test('the body is still verbatim — the null is admitted, never coerced away', () => {
    // 🔴 The whole reason widening is the answer and coercion is not: the re-host preserves the
    // block program exactly (EXP-003 §4), so the app agrees with the graph about what it sends.
    const source = homeSource(withVisual(EMPTY_SOCKET));
    expect(source).toContain('Outputs["result"] = null;');
    expect(source).not.toContain('Outputs["result"] = 0;');
  });

  test('an undeclared port stays `any` — `any | null` would be noise, not information', () => {
    const undeclared = workspace(setOutput('result'));
    expect(homeSource(withVisual(undeclared))).toContain(
      'function Blocks(Inputs: Record<string, never>): { result?: any } {'
    );
  });

  test('the widening names the block it came from, so the reader can go and plug it in', () => {
    const source = homeSource(withVisual(EMPTY_SOCKET));
    expect(source).toContain('// `result`: a `set output` block below has an empty value socket, which');
    expect(homeSource(withVisual(FILLED_SOCKET))).not.toContain('empty value socket');
  });
});

describe('what stays deferred, by name (§4, §5)', () => {
  test('a block-declared signal driving a chain defers, naming the sink it drives', () => {
    const ir = cloneIr();
    const ws = workspace(
      { type: 'noodl_define_signal_output', fields: { NAME: 'ok' } },
      { type: 'noodl_send_signal', fields: { NAME: 'ok' } }
    );
    addVisual(ir, 'sig', ws, 'sendSignalOnOutput("ok");', 'Signaller');
    wire(ir, 'Pages/Home', 'cheerButton', 'onClick', 'sig', 'run', 'signal');
    wire(ir, 'Pages/Home', 'sig', 'ok', 'goMood', 'navigate', 'signal');
    const notes = notesOf(ir);
    expect(notes.some((n) => n.includes('block-declared signal "ok" drives RouterNavigate.navigate'))).toBe(true);
  });

  test('an input fed by a Changed payload, run from another handler, defers', () => {
    // 🔴 This is one of two independent blockers on `tut003`'s program, and it is not about
    // Visual Functions at all: `onTextChanged` carries `event.target.value`, which exists only
    // inside its own handler. Running the node from a button's onClick cannot read it until the
    // input is controlled (the controlled-state slice's territory).
    const ir = cloneIr();
    addVisual(ir, 'fromChange', GUARD_WORKSPACE, GUARD_CODE, 'FromChange');
    addText(ir, 'changeText');
    wire(ir, 'Pages/Home', 'cheerButton', 'onClick', 'fromChange', 'run', 'signal');
    wire(ir, 'Pages/Home', 'nameInput', 'onTextChanged', 'fromChange', 'entry');
    wire(ir, 'Pages/Home', 'fromChange', 'message', 'changeText', 'text');
    expect(notesOf(ir).some((n) => n.includes('only exist in another handler'))).toBe(true);
  });

  test('a consumed outcome signal defers — the outcome contract is the invocation tier', () => {
    const ir = cloneIr();
    addVisual(ir, 'outcome', GUARD_WORKSPACE, GUARD_CODE, 'Outcome');
    wire(ir, 'Pages/Home', 'cheerButton', 'onClick', 'outcome', 'run', 'signal');
    wire(ir, 'Pages/Home', 'outcome', 'failure', 'goMood', 'navigate', 'signal');
    expect(notesOf(ir).some((n) => n.includes('failure'))).toBe(true);
  });
});
