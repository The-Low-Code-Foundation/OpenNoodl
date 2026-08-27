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
// Step 6 (EXP-002-LOGIC-TARGET-OUTPUT.md): String Format and Condition compile away — inline
// expressions, no runtime construct. The page goldens live with their slices
// (stores-events.test.ts, global-store.test.ts); these tests hold the slice's own rules.
// ---------------------------------------------------------------------------------------------

describe('the derived is compiled away (LOGIC-TARGET §1)', () => {
  test('no derived module, no useDerived — the expressions are inline', () => {
    expect(Object.keys(app.files).filter((f) => f.includes('derived'))).toEqual([]);
    for (const content of Object.values(app.files)) {
      expect(content).not.toContain('useDerived');
      expect(content).not.toContain("derived(");
    }
  });

  test('the format is a template literal at its sink (Home), over the hook local', () => {
    const home = app.files['src/pages/Home.tsx'];
    expect(home).toContain('const name = useValue(visitorName);');
    expect(home).toContain("{`Cheering for ${name ?? ''}!`}");
  });

  test('a format over a store key rides the selector hook a direct binding would earn (Mood)', () => {
    const mood = app.files['src/pages/Mood.tsx'];
    expect(mood).toContain('const theme = useStore(mood, (s) => s.theme);');
    expect(mood).toContain('{`Feeling ${theme} today`}');
  });

  test('the Condition chain is an if statement in the trigger handler (Mood)', () => {
    const mood = app.files['src/pages/Mood.tsx'];
    expect(mood).toContain('if (visitorName.get()) mood.set({ theme: visitorName.get() });');
    // The branch forces the block arrow form.
    expect(mood).toContain('onClick={() => {');
  });

  test('nothing on the extended fixture is dropped: the only note is the router shell', () => {
    expect(app.notes).toEqual([
      'App: router shell — emitted as src/App.tsx by the scaffold',
      'Components/GreetingCard: wire greet-state:value-Draft->greet-draft:startValue: property "Draft" reads its boot value — no wire writes it (a runtime script would) — rendered as the empty/omitted form'
    ]);
  });
});

describe('format resolution rules (LOGIC-TARGET §2)', () => {
  test('a literal parameter on a placeholder folds into the text', () => {
    const mutated = cloneIr();
    unwire(mutated, 'Pages/Home', 'visitorVar:value->previewFormat:name');
    setParam(nodeOf(mutated, 'Pages/Home', 'previewFormat'), 'name', { kind: 'literal', value: 'Ada' });
    // The enabled chain (session 7) earns the hook independently — take it out too, so the
    // assertion still measures "no hook when nothing needs it".
    unwire(mutated, 'Pages/Home', 'visitorVar:value->hasName:condition');
    unwire(mutated, 'Pages/Home', 'hasName:result->cheerButton:enabled');
    const result = emitApp(mutated, catalog);
    expect(result.files['src/pages/Home.tsx']).toContain('>Cheering for Ada!<');
    expect(result.files['src/pages/Home.tsx']).not.toContain('useValue');
  });

  test("an unfed placeholder substitutes '' — the runtime's own rule", () => {
    const mutated = cloneIr();
    unwire(mutated, 'Pages/Home', 'visitorVar:value->previewFormat:name');
    const result = emitApp(mutated, catalog);
    expect(result.files['src/pages/Home.tsx']).toContain('>Cheering for !<');
  });

  test('a bare single-placeholder format collapses to its string-typed expression', () => {
    const mutated = cloneIr();
    setParam(nodeOf(mutated, 'Pages/Home', 'previewFormat'), 'format', { kind: 'literal', value: '{name}' });
    const result = emitApp(mutated, catalog);
    expect(result.files['src/pages/Home.tsx']).toContain('<p className={styles.cheerPreview}>{name}</p>');
  });

  test('a repeated placeholder fills every occurrence — the code, not the port description', () => {
    const mutated = cloneIr();
    setParam(nodeOf(mutated, 'Pages/Home', 'previewFormat'), 'format', { kind: 'literal', value: '{name} and {name}' });
    const result = emitApp(mutated, catalog);
    expect(result.files['src/pages/Home.tsx']).toContain("{`${name ?? ''} and ${name ?? ''}`}");
  });

  test('template-significant characters in format text are escaped', () => {
    // The backtick, and a `${` that is not itself a placeholder (`{!}` fails the runtime's
    // placeholder pattern, so it stays text). Note `${name}` would NOT stay text — the runtime
    // parses the `{name}` inside it as a placeholder, and the interpolation is the faithful
    // translation.
    const mutated = cloneIr();
    setParam(nodeOf(mutated, 'Pages/Home', 'previewFormat'), 'format', {
      kind: 'literal',
      value: '{name} costs `1` or ${!}'
    });
    const result = emitApp(mutated, catalog);
    expect(result.files['src/pages/Home.tsx']).toContain("{`${name ?? ''} costs \\`1\\` or \\${!}`}");
  });

  test('a format in handler context reads .get() snapshots', () => {
    const mutated = cloneIr();
    const moodComponent = componentOf(mutated, 'Pages/Mood');
    moodComponent.nodes.push({
      id: 'vibesFormat',
      type: 'String Format',
      catalogRef: 'String Format',
      parameters: [{ name: 'format', value: { kind: 'literal', value: '{name} vibes' } }],
      declaredPorts: [],
      portKnowledge: 'partial'
    });
    unwire(mutated, 'Pages/Mood', 'readVisitor-2:value->setTheme:value');
    wire(mutated, 'Pages/Mood', 'readVisitor-2', 'value', 'vibesFormat', 'name');
    wire(mutated, 'Pages/Mood', 'vibesFormat', 'formatted', 'setTheme', 'value');
    const result = emitApp(mutated, catalog);
    expect(result.files['src/pages/Mood.tsx']).toContain("mood.set({ theme: `${visitorName.get() ?? ''} vibes` })");
  });
});

describe('what defers, all with notes (LOGIC-TARGET §4)', () => {
  test('a wired format string defers the node', () => {
    const mutated = cloneIr();
    wire(mutated, 'Pages/Home', 'visitorVar', 'value', 'previewFormat', 'format');
    const result = emitApp(mutated, catalog);
    expect(result.files['src/pages/Home.tsx']).not.toContain('Cheering');
    expect(result.notes.join('\n')).toContain('the format string is wired, not literal');
  });

  test('a nameless {} placeholder defers the node', () => {
    const mutated = cloneIr();
    setParam(nodeOf(mutated, 'Pages/Home', 'previewFormat'), 'format', { kind: 'literal', value: 'Hi {} there' });
    const result = emitApp(mutated, catalog);
    expect(result.notes.join('\n')).toContain('nameless {} placeholder');
  });

  test('a wire cycle through logic nodes defers, never loops', () => {
    const mutated = cloneIr();
    setParam(nodeOf(mutated, 'Pages/Home', 'previewFormat'), 'format', { kind: 'literal', value: 'echo {name}' });
    unwire(mutated, 'Pages/Home', 'visitorVar:value->previewFormat:name');
    wire(mutated, 'Pages/Home', 'previewFormat', 'formatted', 'previewFormat', 'name');
    const result = emitApp(mutated, catalog);
    expect(result.notes.join('\n')).toContain('a wire cycle through logic nodes');
  });

  test('a ticked Run On Value Change defers the Condition — Evaluate is additive', () => {
    const mutated = cloneIr();
    const hasVisitor = nodeOf(mutated, 'Pages/Mood', 'hasVisitor');
    hasVisitor.parameters = hasVisitor.parameters.filter((p) => p.name !== 'runOnChange-condition');
    const result = emitApp(mutated, catalog);
    expect(result.files['src/pages/Mood.tsx']).not.toContain('if (');
    expect(result.notes.join('\n')).toContain('Run On Value Change is ticked');
  });

  test("a Condition value output wired anywhere defers the branch (this slice's scope)", () => {
    const mutated = cloneIr();
    wire(mutated, 'Pages/Mood', 'hasVisitor', 'result', 'noteDraftVar', 'value');
    const result = emitApp(mutated, catalog);
    expect(result.files['src/pages/Mood.tsx']).not.toContain('if (');
    expect(result.notes.join('\n')).toContain('its result output drives logic this slice does not translate');
  });

  test('an arm reading another handler-only value defers at attachment', () => {
    const mutated = cloneIr();
    // onfalse → setNote.set: setNote's value is noteInput's onChange text, which does not
    // exist inside the button's click handler.
    wire(mutated, 'Pages/Mood', 'hasVisitor', 'onfalse', 'setNote', 'set', 'signal');
    const result = emitApp(mutated, catalog);
    expect(result.files['src/pages/Mood.tsx']).not.toContain('if (');
    expect(result.notes.join('\n')).toContain('the action reads values that only exist in another handler');
  });

  test('a Condition arm driving another Condition defers — nesting is a later slice', () => {
    const mutated = cloneIr();
    const moodComponent = componentOf(mutated, 'Pages/Mood');
    moodComponent.nodes.push({
      id: 'innerCondition',
      type: 'Condition',
      catalogRef: 'Condition',
      parameters: [{ name: 'runOnChange-condition', value: { kind: 'literal', value: false } }],
      declaredPorts: [],
      portKnowledge: 'complete'
    });
    wire(mutated, 'Pages/Mood', 'hasVisitor', 'onfalse', 'innerCondition', 'eval', 'signal');
    const result = emitApp(mutated, catalog);
    expect(result.files['src/pages/Mood.tsx']).not.toContain('if (');
    expect(result.notes.join('\n')).toContain('nesting is not translated in this slice');
  });

  test('a format whose output drives nothing statically translatable defers with a note', () => {
    const mutated = cloneIr();
    unwire(mutated, 'Pages/Home', 'previewFormat:formatted->cheerPreview:text');
    const result = emitApp(mutated, catalog);
    expect(result.notes.join('\n')).toContain('format output drives nothing statically translatable');
  });
});

describe('the puppy fixture is untouched by the slice', () => {
  test('the puppy export emits no template literals and no branches', () => {
    const PUPPY_FIXTURE = path.join(__dirname, 'fixtures', 'puppy-test-3');
    const puppy = emitApp(parseProject(PUPPY_FIXTURE, catalog), catalog);
    for (const content of Object.values(puppy.files)) {
      expect(content).not.toContain('if (');
    }
  });
});
