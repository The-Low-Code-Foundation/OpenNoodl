import * as fs from 'fs';
import * as path from 'path';

import { Catalog } from '../src/catalog';
import { emitApp } from '../src/emit/emitApp';
import { parseProject } from '../src/parse/parseProject';
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
const wire = (source: ExportIR, componentPath: string, fromId: string, fromProperty: string, toId: string, toProperty: string, kind: 'value' | 'signal' = 'value') => {
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

// ---------------------------------------------------------------------------------------------
// Session 7 (LOGIC-TARGET §6–§9): And / Or / Inverter and the Condition value outputs join the
// expression family as truthiness devices; `enabled` → `disabled` is the boolean render sink.
// ---------------------------------------------------------------------------------------------

describe('the three sinks on the fixture (LOGIC-TARGET §8)', () => {
  test('Home: the Condition value output gates the button over the hook local', () => {
    expect(app.files['src/pages/Home.tsx']).toContain('disabled={!name}');
  });

  test('Mood: the And-over-Inverter renders as the negated group, earning the useValue hook', () => {
    const mood = app.files['src/pages/Mood.tsx'];
    expect(mood).toContain("import { useStore, useValue } from '@nodegx/core/react';");
    expect(mood).toContain('const name = useValue(visitorName);');
    expect(mood).toContain('disabled={!(name && !note)}');
  });

  test('Notes: the Or is the branch test, over .get() snapshots', () => {
    expect(app.files['src/pages/Notes.tsx']).toContain(
      'if (noteDraft.get() || visitorName.get()) notes.add({ text: noteDraft.get(), mood: \'sunny\' });'
    );
  });

  test('nothing on the grown fixture is dropped', () => {
    expect(app.notes).toEqual([
      'App: router shell — emitted as src/App.tsx by the scaffold',
      'Components/GreetingCard: wire greet-state:value-Draft->greet-draft:startValue: property "Draft" reads its boot value — no wire writes it (a runtime script would) — rendered as the empty/omitted form'
    ]);
  });
});

describe('shapes and folds (LOGIC-TARGET §6, §7, §9)', () => {
  test('isfalse is the negation — and its disabled is the double negation', () => {
    const mutated = cloneIr();
    unwire(mutated, 'Pages/Home', 'hasName:result->cheerButton:enabled');
    wire(mutated, 'Pages/Home', 'hasName', 'isfalse', 'cheerButton', 'enabled');
    const result = emitApp(mutated, catalog);
    expect(result.files['src/pages/Home.tsx']).toContain('disabled={!!name}');
  });

  test('a single surviving operand collapses to its truthiness', () => {
    const mutated = cloneIr();
    unwire(mutated, 'Pages/Notes', 'visitorRead:value->draftOrVisitor:input 1');
    const result = emitApp(mutated, catalog);
    expect(result.files['src/pages/Notes.tsx']).toContain('if (noteDraft.get()) notes.add(');
  });

  test('a decisive literal operand collapses the And to the static disabled attribute', () => {
    const mutated = cloneIr();
    unwire(mutated, 'Pages/Mood', 'freshBoard:result->canSteal:input 1');
    setParam(nodeOf(mutated, 'Pages/Mood', 'canSteal'), 'input 1', { kind: 'literal', value: false });
    const result = emitApp(mutated, catalog);
    expect(result.files['src/pages/Mood.tsx']).toMatch(/\n\s+disabled\n/);
  });

  test('a folded-true operand disappears and the survivor stands alone', () => {
    const mutated = cloneIr();
    unwire(mutated, 'Pages/Mood', 'freshBoard:result->canSteal:input 1');
    setParam(nodeOf(mutated, 'Pages/Mood', 'canSteal'), 'input 1', { kind: 'literal', value: true });
    const result = emitApp(mutated, catalog);
    expect(result.files['src/pages/Mood.tsx']).toContain('disabled={!name}');
  });

  test('an authored enabled: false is the bare disabled attribute', () => {
    const mutated = cloneIr();
    unwire(mutated, 'Pages/Home', 'hasName:result->cheerButton:enabled');
    setParam(nodeOf(mutated, 'Pages/Home', 'cheerButton'), 'enabled', { kind: 'literal', value: false });
    const result = emitApp(mutated, catalog);
    expect(result.files['src/pages/Home.tsx']).toMatch(/\n\s+disabled\n/);
  });

  test('a plain variable read into enabled negates like any binding', () => {
    const mutated = cloneIr();
    wire(mutated, 'Pages/Home', 'visitorVar', 'value', 'nameInput', 'enabled');
    const result = emitApp(mutated, catalog);
    expect(result.files['src/pages/Home.tsx']).toContain('placeholder="Type a visitor name"\n        disabled={!name}');
  });
});

describe('what defers, all with notes (LOGIC-TARGET §9)', () => {
  test('an Inverter over a maybe-undefined operand defers — the passthrough', () => {
    const mutated = cloneIr();
    unwire(mutated, 'Pages/Mood', 'subNote:value->freshBoard:value');
    wire(mutated, 'Pages/Mood', 'readVisitor-2', 'value', 'freshBoard', 'value');
    const result = emitApp(mutated, catalog);
    expect(result.files['src/pages/Mood.tsx']).not.toContain('disabled');
    expect(result.notes.join('\n')).toContain('the Inverter passes undefined through');
  });

  test('a Condition mixing Evaluate wiring with value outputs defers the value use', () => {
    const mutated = cloneIr();
    wire(mutated, 'Pages/Home', 'cheerButton', 'onClick', 'hasName', 'eval', 'signal');
    const result = emitApp(mutated, catalog);
    expect(result.files['src/pages/Home.tsx']).not.toContain('disabled');
    expect(result.notes.join('\n')).toContain('no single honest translation');
  });

  test('an unticked Run On Value Change makes the value outputs snapshots — deferred', () => {
    const mutated = cloneIr();
    setParam(nodeOf(mutated, 'Pages/Home', 'hasName'), 'runOnChange-condition', { kind: 'literal', value: false });
    const result = emitApp(mutated, catalog);
    expect(result.files['src/pages/Home.tsx']).not.toContain('disabled');
    expect(result.notes.join('\n')).toContain('snapshots of the last Evaluate');
  });

  test('a logic truth value into an event payload defers the sender', () => {
    const mutated = cloneIr();
    unwire(mutated, 'Pages/Home', 'visitorVar:value->cheerSend:message');
    wire(mutated, 'Pages/Home', 'hasName', 'result', 'cheerSend', 'message');
    const result = emitApp(mutated, catalog);
    expect(result.notes.join('\n')).toContain('payload "message" is fed a logic truth value');
  });

  test('a logic truth value into a text sink defers with a note', () => {
    const mutated = cloneIr();
    unwire(mutated, 'Pages/Home', 'previewFormat:formatted->cheerPreview:text');
    wire(mutated, 'Pages/Home', 'hasName', 'result', 'cheerPreview', 'text');
    const result = emitApp(mutated, catalog);
    expect(result.notes.join('\n')).toContain('a logic truth value lands only in a truthiness sink');
  });

  test('a logic truth value into a format placeholder defers the format', () => {
    const mutated = cloneIr();
    unwire(mutated, 'Pages/Home', 'visitorVar:value->previewFormat:name');
    wire(mutated, 'Pages/Home', 'hasName', 'result', 'previewFormat', 'name');
    const result = emitApp(mutated, catalog);
    expect(result.notes.join('\n')).toContain('placeholder "name" is fed a logic truth value');
  });

  test('an And nobody fed defers — a note beats a silently disabled button', () => {
    const mutated = cloneIr();
    const home = componentOf(mutated, 'Pages/Home');
    home.nodes.push({
      id: 'emptyGate',
      type: 'And',
      catalogRef: 'And',
      parameters: [],
      declaredPorts: [],
      portKnowledge: 'partial'
    });
    unwire(mutated, 'Pages/Home', 'hasName:result->cheerButton:enabled');
    wire(mutated, 'Pages/Home', 'emptyGate', 'result', 'cheerButton', 'enabled');
    const result = emitApp(mutated, catalog);
    expect(result.files['src/pages/Home.tsx']).not.toContain('disabled');
    expect(result.notes.join('\n')).toContain('the And has no inputs wired or authored');
  });

  test('Switch is not an expression — a stateful latch, deferred whole (§6 headnote)', () => {
    const mutated = cloneIr();
    const home = componentOf(mutated, 'Pages/Home');
    home.nodes.push({
      id: 'latch',
      type: 'Switch',
      catalogRef: 'Switch',
      parameters: [],
      declaredPorts: [],
      portKnowledge: 'partial'
    });
    unwire(mutated, 'Pages/Home', 'hasName:result->cheerButton:enabled');
    wire(mutated, 'Pages/Home', 'latch', 'state', 'cheerButton', 'enabled');
    const result = emitApp(mutated, catalog);
    expect(result.files['src/pages/Home.tsx']).not.toContain('disabled');
    expect(result.notes.join('\n')).toContain('no deterministic translation');
  });
});

describe('the puppy fixture is untouched by the slice', () => {
  test('no disabled attributes anywhere in the puppy export', () => {
    const PUPPY_FIXTURE = path.join(__dirname, 'fixtures', 'puppy-test-3');
    const puppy = emitApp(parseProject(PUPPY_FIXTURE, catalog), catalog);
    // tokens.css legitimately mentions "disabled" in a token comment — the claim is about JSX.
    for (const [file, content] of Object.entries(puppy.files)) {
      if (file.endsWith('.tsx')) expect(content).not.toContain('disabled');
    }
  });
});
