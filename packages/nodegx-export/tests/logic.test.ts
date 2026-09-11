import * as fs from 'fs';
import * as path from 'path';

import { Catalog, loadCatalog } from '../src/catalog';
import { emitApp } from '../src/emit/emitApp';
import { parseProject } from '../src/parse/parseProject';
import { ComponentIR, ExportIR, NodeIR, ParamValue } from '../src/ir/types';

const FIXTURE = path.join(__dirname, 'fixtures', 'cheer');

const catalog: Catalog = loadCatalog();
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
    // The EXP-003 nodes (session 14) earn it independently too — same reasoning, same treatment.
    unwire(mutated, 'Pages/Home', 'visitorVar:value->hasLongName:name');
    unwire(mutated, 'Pages/Home', 'hasLongName:isTrue->aboutButton:enabled');
    unwire(mutated, 'Pages/Home', 'visitorVar:value->formatShout:in-name');
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

// ---------------------------------------------------------------------------------------------
// §10 — the reactive Condition. Ticked and with `Evaluate` unwired, the node re-tests on every
// arrival on `condition` and fires one arm: a re-run keyed on the condition, which is a
// useEffect. Both primary cases are real fixture artefacts — `puppy-test-3`'s auth gate is
// authored reactive, `cheer`'s two Conditions are authored Evaluate-only — so the rule and its
// negative control are each read off a graph somebody actually built.
// ---------------------------------------------------------------------------------------------

describe('the reactive Condition is an effect (LOGIC-TARGET §10)', () => {
  const PUPPY = path.join(__dirname, 'fixtures', 'puppy-test-3');
  const puppyIr = parseProject(PUPPY, catalog);
  const clonePuppy = (): ExportIR => structuredClone(puppyIr);
  const ADMIN = 'Pages/Admin';
  const adminOf = (source: ExportIR) => emitApp(source, catalog).files['src/pages/Admin.tsx'];
  const notesOf = (source: ExportIR) => emitApp(source, catalog).notes.join('\n');

  test('the auth gate becomes a useEffect keyed on the condition, not a handler', () => {
    const source = adminOf(clonePuppy());
    expect(source).toContain('  useEffect(() => {');
    expect(source).toContain("    if (!session.authenticated) navigate('/admin-login');");
    expect(source).toContain('  }, [session.authenticated]);');
    // The effect is the node's whole translation — no handler anywhere fires this branch.
    expect(source).not.toContain('onClick={() => { if (!session.authenticated)');
  });

  test('the dependency is the session read itself — an effect that tests it re-runs on it', () => {
    // The `effectDeps` walker had no `session-get` case, so the deps printed empty. An effect
    // over a session with `[]` is a mount-only gate: it would not re-test on sign-out.
    const source = adminOf(clonePuppy());
    expect(source).not.toContain('}, []);');
    expect(source).toMatch(/\}, \[session\.authenticated\]\);/);
  });

  test('the condition and the arm both collapse — the User and the navigate are translated', () => {
    const result = emitApp(clonePuppy(), catalog);
    const notes = result.notes.join('\n');
    expect(notes).not.toContain('userCheck:authenticated->authGate:condition');
    expect(notes).not.toContain('authGate:onfalse->navigateNotAuth:navigate');
    expect(notes).not.toContain('node authGate (Condition) deferred');
  });

  // --- the discriminating pair: one fixture, both directions -------------------------------

  test('unticking the same Condition moves it out of the effect and into a handler', () => {
    const mutated = clonePuppy();
    setParam(nodeOf(mutated, ADMIN, 'authGate'), 'runOnChange-condition', { kind: 'literal', value: false });
    const source = adminOf(mutated);
    // Evaluate-only and nothing pulses Evaluate here, so it becomes neither — but the reason
    // must be the *unwired trigger*, never the reactive gate it no longer trips.
    expect(source).not.toContain('}, [session.authenticated]);');
    expect(notesOf(mutated)).toContain('no Evaluate wire attaches this condition to a handler');
  });

  test('ticking an Evaluate-only Condition moves it out of a handler and into an effect', () => {
    // The mirror, on the other fixture: `cheer`'s Mood page authors `hasVisitor` unticked with
    // a button pulsing Evaluate — a handler branch today.
    expect(app.files['src/pages/Mood.tsx']).toContain('if (visitorName.get()) mood.set(');
    const mutated = cloneIr();
    setParam(nodeOf(mutated, 'Pages/Mood', 'hasVisitor'), 'runOnChange-condition', { kind: 'literal', value: true });
    // Ticked *and* Evaluate still wired is the additive case — it does both, so it defers.
    expect(emitApp(mutated, catalog).notes.join('\n')).toContain('the two fire independently');
    // Cut Evaluate and the same node is a plain reactive Condition: now an effect.
    unwire(mutated, 'Pages/Mood', 'themeButton:onClick->hasVisitor:eval');
    const source = emitApp(mutated, catalog).files['src/pages/Mood.tsx'];
    expect(source).toContain('useEffect(() => {');
    // The same branch, moved verbatim out of the onClick and into the effect.
    expect(source).toContain('if (visitorName.get()) mood.set({ theme: visitorName.get() });');
    expect(source).not.toContain('onClick={() => { if (visitorName.get())');
    // The arm reads the store live (`.get()` — the value when the effect runs) while the
    // dependency is that variable's render local, which is what re-runs the effect. Two
    // spellings of one variable, and the dep has to be the reactive one.
    expect(source).toContain('}, [name]);');
  });

  // --- the gates, each deferring with its named reason ---------------------------------------

  test('a stray value output defers — one node cannot be a comparator and a branch at once', () => {
    const mutated = clonePuppy();
    wire(mutated, ADMIN, 'authGate', 'result', 'listCard', 'visible');
    expect(notesOf(mutated)).toContain('output drives logic this slice does not translate');
    expect(adminOf(mutated)).not.toContain('}, [session.authenticated]);');
  });

  test('an arm driving nothing translatable defers with that reason, not the ticked-box one', () => {
    const mutated = clonePuppy();
    unwire(mutated, ADMIN, 'authGate:onfalse->navigateNotAuth:navigate');
    wire(mutated, ADMIN, 'authGate', 'onfalse', 'formatList', 'items', 'signal');
    const notes = notesOf(mutated);
    expect(notes).toContain('node authGate (Condition) deferred');
    expect(notes).not.toContain('only an Evaluate-only condition translates in this slice');
  });

  test('nothing statically known feeding condition defers', () => {
    const mutated = clonePuppy();
    unwire(mutated, ADMIN, 'userCheck:authenticated->authGate:condition');
    expect(notesOf(mutated)).toContain('nothing statically known feeds condition');
    expect(adminOf(mutated)).not.toContain('useEffect(() => {');
  });

  test('no arm at all is not an effect — the pure comparator pass owns that shape', () => {
    const mutated = clonePuppy();
    unwire(mutated, ADMIN, 'authGate:onfalse->navigateNotAuth:navigate');
    const source = adminOf(mutated);
    expect(source).not.toContain('useEffect(() => {');
    expect(source).not.toContain('const session = useSession()');
  });
});

describe('the puppy fixture is untouched by the slice', () => {
  test('the puppy export emits no template literals and no branches', () => {
    const PUPPY_FIXTURE = path.join(__dirname, 'fixtures', 'puppy-test-3');
    const puppy = emitApp(parseProject(PUPPY_FIXTURE, catalog), catalog);
    for (const [name, content] of Object.entries(puppy.files)) {
      // EXP-009: the backend client is protocol code, not graph translation — template
      // literals and branches are its normal idiom, and backend-client.test.ts pins the
      // whole file byte-for-byte, a stronger claim than this scan.
      if (name === 'src/api/client.ts') continue;
      // EXP-011 §54: `src/lib/*` is transcribed runtime — the error channel (runtimeerror.ts, with its
      // depth guard and its subscriber loop) is the first lib every project with a record verb ships,
      // and a branch or a template literal there is the runtime's own idiom, not graph translation.
      // Excluded by kind, for the same reason `.md` is: the population is "the lib modules", not one file.
      if (name.startsWith('src/lib/')) continue;
      // 🔴 Excluded **by kind, not by name.** This sweep is about generated *code*: a backtick in
      // TypeScript is a template literal, and in Markdown it is a code span. `README.md` used to
      // be listed here individually, and EXP-004's `EXPORT-REPORT.md` reddened it the day it
      // arrived — the checker's population had quietly grown to include prose. Every `.md` the
      // export writes is prose, so that is the line.
      if (name.endsWith('.md')) continue;
      // A bare `not.toContain('if (')` stood in for "no Condition branch" until the record
      // verbs' Missing Record Id guard put a legitimate `if` in this fixture. The proxy was
      // always wider than the claim; assert the claim. Backticks appear in the api stubs' doc
      // comments, so the template-literal half is read off code lines only.
      for (const line of content.split('\n')) {
        if (/^\s*(\*|\/\*|\/\/)/.test(line)) continue;
        expect(`${name}: ${line}`).not.toContain('`');
      }
      // …and then LOGIC-TARGET §10 translated the auth gate, which is a Condition branch and belongs here.
      // The claim is no longer "this fixture has no branch" — it is that every branch in it was
      // put there by a slice on purpose. An unlisted `if (` is still the regression this catches;
      // pinning the inventory is what keeps it one.
      const EXPECTED_BRANCHES = [
        "if (!puppyIdInput) throw new Error('Missing Record Id');",
        "if (!session.authenticated) navigate('/admin-login');",
        // EXP-009: the connected useSession parses the stored session, and "no stored
        // session" is a branch of that read.
        'if (raw === undefined) return { authenticated: false, user: null };'
      ];
      for (const line of content.split('\n')) {
        if (EXPECTED_BRANCHES.some((b) => line.includes(b))) continue;
        expect(`${name}: ${line}`).not.toContain('if (');
      }
    }
  });
});
