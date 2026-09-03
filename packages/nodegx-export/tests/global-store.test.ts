import * as fs from 'fs';
import * as path from 'path';

import { Catalog } from '../src/catalog';
import { emitApp } from '../src/emit/emitApp';
import { parseProject } from '../src/parse/parseProject';
import { ExportIR, NodeIR, ParamValue } from '../src/ir/types';

const FIXTURE = path.join(__dirname, 'fixtures', 'cheer');
const PUPPY_FIXTURE = path.join(__dirname, 'fixtures', 'puppy-test-3');
const CATALOG_PATH = path.join(__dirname, '..', '..', 'noodl-types', 'src', 'node-catalog.json');

const catalog: Catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
const ir = parseProject(FIXTURE, catalog);
const app = emitApp(ir, catalog);

const cloneIr = (): ExportIR => structuredClone(ir);
const nodeOf = (source: ExportIR, componentPath: string, id: string): NodeIR =>
  source.components.find((c) => c.path === componentPath)!.nodes.find((n) => n.id === id)!;
const setParam = (node: NodeIR, name: string, value: ParamValue) => {
  const existing = node.parameters.find((p) => p.name === name);
  if (existing) existing.value = value;
  else {
    node.parameters.push({ name, value });
    node.parameters.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  }
};
const dropParam = (node: NodeIR, name: string) => {
  node.parameters = node.parameters.filter((p) => p.name !== name);
};

// ---------------------------------------------------------------------------------------------
// The golden tests (the named-stores slice's acceptance): the extended Cheer fixture vs the
// hand-written targets in EXP-002-NAMED-STORES-TARGET-OUTPUT.md. Any diff is a design
// conversation, on purpose.
// ---------------------------------------------------------------------------------------------

const GOLDEN_MOOD_STORE = `// @nodegx:generated (stores — provenance markers complete in EXP-007)
import { store } from '@nodegx/core';

export interface MoodState {
  note: string;
  theme: string;
}

/**
 * Declared by "mood store" (net.noodl.GlobalStore \`moodStore\` on /Pages/Mood).
 * Written by "Write note" (net.noodl.GlobalStore.Set \`setNote\` on /Pages/Mood).
 * Written by "Write theme" (net.noodl.GlobalStore.Set \`setTheme\` on /Pages/Mood).
 */
export const mood = store<MoodState>('mood', {
  note: '',
  theme: 'sunny'
});
`;

const GOLDEN_MOOD_PAGE = `// @nodegx:generated (visual — provenance markers complete in EXP-007)
import { useStore, useValue } from '@nodegx/core/react';

import { mood } from '../stores/mood';
import { visitorName } from '../stores/variables';
import styles from './Mood.module.css';

/** Mood board. */
export function MoodPage() {
  const name = useValue(visitorName);
  const note = useStore(mood, (s) => s.note);
  const theme = useStore(mood, (s) => s.theme);

  return (
    <div className={styles.moodPage}>
      <title>Mood</title>

      <p className={styles.moodHeading}>Mood board</p>

      <input
        className={styles.noteInput}
        placeholder="Write a note"
        onChange={(event) => mood.set({ note: event.target.value })}
      />

      <p className={styles.noteEcho}>{note}</p>

      <p className={styles.themeText}>{\`Feeling \${theme} today\`}</p>

      <button
        className={styles.themeButton}
        disabled={!(name && !note)}
        onClick={() => {
          if (visitorName.get()) mood.set({ theme: visitorName.get() });
        }}
      >
        Steal the visitor's name
      </button>
    </div>
  );
}
`;

describe('the store module (NAMED-STORES-TARGET §1)', () => {
  test('mood.ts matches the hand-written target', () => {
    expect(app.files['src/stores/mood.ts']).toBe(GOLDEN_MOOD_STORE);
  });

  test('initial state typed as JSON text emits the same module (the coerceState rule)', () => {
    const mutated = cloneIr();
    setParam(nodeOf(mutated, 'Pages/Mood', 'moodStore'), 'initialState', {
      kind: 'literal',
      value: '{"note":"","theme":"sunny"}'
    });
    const result = emitApp(mutated, catalog);
    expect(result.files['src/stores/mood.ts']).toBe(GOLDEN_MOOD_STORE);
  });

  test('every naming node defaulted ⇒ the store is app, module src/stores/app.ts', () => {
    const mutated = cloneIr();
    for (const id of ['moodStore', 'setNote', 'setTheme', 'subNote', 'subTheme']) {
      dropParam(nodeOf(mutated, 'Pages/Mood', id), 'storeName');
    }
    const result = emitApp(mutated, catalog);
    expect(result.files['src/stores/mood.ts']).toBeUndefined();
    expect(result.files['src/stores/app.ts']).toContain("export const app = store<AppState>('app', {");
    expect(result.files['src/pages/Mood.tsx']).toContain('useStore(app, (s) => s.note)');
  });

  test('a key only Set writers know is optional and writer-typed', () => {
    const mutated = cloneIr();
    setParam(nodeOf(mutated, 'Pages/Mood', 'moodStore'), 'initialState', { kind: 'json', value: { theme: 'sunny' } });
    const result = emitApp(mutated, catalog);
    expect(result.files['src/stores/mood.ts']).toContain('note?: string;');
    expect(result.files['src/stores/mood.ts']).toContain('theme: string;');
  });

  test('the puppy export has no store modules', () => {
    const puppy = emitApp(parseProject(PUPPY_FIXTURE, catalog), catalog);
    expect(Object.keys(puppy.files).filter((f) => f.startsWith('src/stores/'))).toEqual([]);
  });
});

describe('selectors in render, patches in handlers (NAMED-STORES-TARGET §2)', () => {
  test('Mood.tsx matches the hand-written target', () => {
    expect(app.files['src/pages/Mood.tsx']).toBe(GOLDEN_MOOD_PAGE);
  });

  test('the write-through input stays uncontrolled: onChange only, no value, no useState', () => {
    const mood = app.files['src/pages/Mood.tsx'];
    expect(mood).not.toContain('useState');
    expect(mood).not.toContain('value={');
    expect(mood).toContain('onChange={(event) => mood.set({ note: event.target.value })}');
  });

  test('nothing on the extended fixture is dropped: the only note is the router shell', () => {
    expect(app.notes).toEqual([
      'App: router shell — emitted as src/App.tsx by the scaffold',
      'Components/GreetingCard: wire greet-state:value-Draft->greet-draft:startValue: property "Draft" reads its boot value — no wire writes it (a runtime script would) — rendered as the empty/omitted form'
    ]);
  });
});

describe('what defers, all with notes (NAMED-STORES-TARGET §3)', () => {
  test('persist defers the whole store: no module, no hooks, a note', () => {
    const mutated = cloneIr();
    setParam(nodeOf(mutated, 'Pages/Mood', 'moodStore'), 'persist', { kind: 'literal', value: true });
    const result = emitApp(mutated, catalog);
    expect(result.files['src/stores/mood.ts']).toBeUndefined();
    expect(result.files['src/pages/Mood.tsx']).not.toContain('useStore');
    expect(result.files['src/pages/Mood.tsx']).not.toContain('mood.set');
    expect(result.notes.join('\n')).toContain('a declarer authors persist');
  });

  test('merge defers the Set', () => {
    const mutated = cloneIr();
    setParam(nodeOf(mutated, 'Pages/Mood', 'setNote'), 'merge', { kind: 'literal', value: true });
    const result = emitApp(mutated, catalog);
    expect(result.files['src/pages/Mood.tsx']).not.toContain('mood.set({ note');
    expect(result.notes.join('\n')).toContain('merge writes shallow-merge objects');
  });

  test('a multi-key subscription defers its binding', () => {
    const mutated = cloneIr();
    setParam(nodeOf(mutated, 'Pages/Mood', 'subNote'), 'keys', { kind: 'literal', value: 'note, theme' });
    const result = emitApp(mutated, catalog);
    expect(result.notes.join('\n')).toContain('a multi-key subscription is not translated in this slice');
    expect(result.files['src/pages/Mood.tsx']).not.toContain('(s) => s.note');
  });

  test('a whole-store subscription defers its binding', () => {
    const mutated = cloneIr();
    setParam(nodeOf(mutated, 'Pages/Mood', 'subTheme'), 'keys', { kind: 'literal', value: '' });
    const result = emitApp(mutated, catalog);
    expect(result.notes.join('\n')).toContain('a whole-store subscription is not translated in this slice');
    expect(result.files['src/pages/Mood.tsx']).not.toContain('(s) => s.theme');
  });

  test('a number-typed key refuses a string write but still renders', () => {
    const mutated = cloneIr();
    setParam(nodeOf(mutated, 'Pages/Mood', 'moodStore'), 'initialState', {
      kind: 'json',
      value: { note: 0, theme: 'sunny' }
    });
    const result = emitApp(mutated, catalog);
    expect(result.files['src/stores/mood.ts']).toContain('note: number;');
    expect(result.notes.join('\n')).toContain('key "note" is number-typed by the initial state');
    expect(result.files['src/pages/Mood.tsx']).not.toContain('mood.set({ note');
    expect(result.files['src/pages/Mood.tsx']).toContain('useStore(mood, (s) => s.note)');
  });

  test('a non-literal store name defers the node', () => {
    const mutated = cloneIr();
    setParam(nodeOf(mutated, 'Pages/Mood', 'subNote'), 'storeName', {
      kind: 'expression',
      source: 'someDynamicName'
    } as unknown as ParamValue);
    const result = emitApp(mutated, catalog);
    expect(result.notes.join('\n')).toContain('store name is not a literal');
    expect(result.files['src/pages/Mood.tsx']).not.toContain('(s) => s.note');
  });

  test('an unparseable initialState defers the declarer, not the store', () => {
    const mutated = cloneIr();
    setParam(nodeOf(mutated, 'Pages/Mood', 'moodStore'), 'initialState', { kind: 'literal', value: '{not json' });
    const result = emitApp(mutated, catalog);
    expect(result.notes.join('\n')).toContain('initialState is not a literal JSON object');
    const module = result.files['src/stores/mood.ts'];
    expect(module).toContain("export const mood = store<MoodState>('mood', {});");
    expect(module).toContain('note?: string;');
  });
});

describe('determinism and dependencies', () => {
  test('emission is deterministic: two runs are byte-identical (D6)', () => {
    const again = emitApp(parseProject(FIXTURE, catalog), catalog);
    expect(again.files).toEqual(app.files);
  });
});

// ---------------------------------------------------------------------------------------------
// EXP-011 §48 — the two gaps §47.3 registered, and the families the control-mint clause was
// missing. Every row here is built by surgery on the Cheer Mood page: `noteInput` is the text
// input, `themeButton` the button whose click already runs the visitor Condition.
// ---------------------------------------------------------------------------------------------

describe('EXP-011 §48 — the Global Store gaps §47.3 registered', () => {
  type Built = ReturnType<typeof emitApp>;
  const MOOD = 'Pages/Mood';
  const componentOf48 = (source: ExportIR) => source.components.find((c) => c.path === MOOD)!;
  const lit48 = (value: string | number | boolean): ParamValue => ({ kind: 'literal', value });
  const add48 = (source: ExportIR, node: Partial<NodeIR> & { id: string; type: string }): NodeIR => {
    const full = { catalogRef: node.type, parameters: [], declaredPorts: [], portKnowledge: 'complete', ...node } as NodeIR;
    componentOf48(source).nodes.push(full);
    return full;
  };
  const wire48 = (source: ExportIR, from: string, fromProperty: string, to: string, toProperty: string, kind: 'value' | 'signal' = 'value') => {
    componentOf48(source).connections.push({ key: `${from}:${fromProperty}->${to}:${toProperty}`, fromId: from, fromProperty, toId: to, toProperty, kind });
  };
  const mood48 = (built: Built): string => built.files['src/pages/Mood.tsx'];
  const DROPPED = 'the action reads values that only exist in another handler';
  /** A Set of `quote` — a key the initialState does not carry, so its type is inferred over its writers. */
  const withQuoteSet = (source: ExportIR, trigger: 'button' | 'own-change' | 'none', valueWired: boolean): ExportIR => {
    add48(source, { id: 'saveQuote', type: 'net.noodl.GlobalStore.Set', authoredLabel: 'Save quote', parameters: [{ name: 'storeName', value: lit48('mood') }, { name: 'key', value: lit48('quote') }] });
    add48(source, { id: 'subQuote', type: 'net.noodl.GlobalStore.Subscribe', authoredLabel: 'Quote', parameters: [{ name: 'storeName', value: lit48('mood') }, { name: 'keys', value: lit48('quote') }] });
    // themeText's own binding (the String Format) makes way — two wires into one text would drop both.
    const mood = componentOf48(source);
    mood.connections = mood.connections.filter((c) => !(c.toId === 'themeText' && c.toProperty === 'text'));
    wire48(source, 'subQuote', 'value', 'themeText', 'text');
    if (valueWired) wire48(source, 'noteInput', 'onTextChanged', 'saveQuote', 'value');
    if (trigger === 'button') wire48(source, 'themeButton', 'onClick', 'saveQuote', 'set', 'signal');
    if (trigger === 'own-change') wire48(source, 'noteInput', 'textChanged', 'saveQuote', 'set', 'signal');
    return source;
  };

  test('G1 the vacuous `every`: a key whose only Set has no value wire is `unknown`, and its read is coerced at the sink', () => {
    const built = emitApp(withQuoteSet(cloneIr(), 'button', false), catalog);
    expect(built.files['src/stores/mood.ts']).toContain('quote?: unknown;');
    expect(mood48(built)).toContain("{String(quote ?? '')}");
    expect(built.notes.join('\n')).toContain('wire themeButton:onClick->saveQuote:set dropped: nothing is wired into value');
  });

  test('G1 CONTROL — the same key with a string-typed writer is `string`, read bare', () => {
    const built = emitApp(withQuoteSet(cloneIr(), 'own-change', true), catalog);
    expect(built.files['src/stores/mood.ts']).toContain('quote?: string;');
    expect(mood48(built)).toContain('{quote}');
    expect(mood48(built)).not.toContain('String(quote');
  });

  test('G2 the control-mint clause: a text input into a Set fired from a button earns its state, and the click is kept', () => {
    const built = emitApp(withQuoteSet(cloneIr(), 'button', true), catalog);
    expect(built.notes.join('\n')).not.toContain(DROPPED);
    expect(mood48(built)).toContain('useState<string>');
    expect(mood48(built)).toMatch(/onClick=\{[\s\S]*mood\.set\(\{ quote: \w+ \}\)/);
    expect(mood48(built)).not.toContain('mood.set({ quote: event.target.value })');
  });

  test('G2 CONTROL — the write-through idiom is untouched: the input’s own textChanged fires the Set, onChange only, no useState', () => {
    const built = emitApp(withQuoteSet(cloneIr(), 'own-change', true), catalog);
    expect(mood48(built)).toContain('mood.set({ quote: event.target.value })');
    expect(mood48(built)).not.toContain('useState');
    // And the fixture's own `note` write-through, as the §2 golden pins it.
    expect(mood48(app)).toContain('mood.set({ note: event.target.value })');
    expect(mood48(app)).not.toContain('useState');
  });

  test('G3 the same clause for Set Variable — the plainest form idiom: an input, a button, a variable', () => {
    const ir = cloneIr();
    add48(ir, { id: 'sv', type: 'Set Variable', authoredLabel: 'Keep note', parameters: [{ name: 'name', value: lit48('keptNote') }] });
    wire48(ir, 'noteInput', 'onTextChanged', 'sv', 'value');
    wire48(ir, 'themeButton', 'onClick', 'sv', 'do', 'signal');
    const built = emitApp(ir, catalog);
    expect(built.notes.join('\n')).not.toContain(DROPPED);
    expect(mood48(built)).toContain('useState<string>');
    expect(mood48(built)).toMatch(/onClick=\{[\s\S]*keptNote\.set\(\w+\)/);
    // CONTROL — the same Set Variable fired by the input's own change: write-through, no state.
    const own = cloneIr();
    add48(own, { id: 'sv', type: 'Set Variable', authoredLabel: 'Keep note', parameters: [{ name: 'name', value: lit48('keptNote') }] });
    wire48(own, 'noteInput', 'onTextChanged', 'sv', 'value');
    wire48(own, 'noteInput', 'textChanged', 'sv', 'do', 'signal');
    const builtOwn = emitApp(own, catalog);
    expect(mood48(builtOwn)).toContain('keptNote.set(event.target.value)');
    expect(mood48(builtOwn)).not.toContain('useState');
  });

  test('G4 the same clause for Cloud Function arguments and Event Sender payloads', () => {
    const cf = cloneIr();
    add48(cf, { id: 'cf', type: 'CloudFunction2', authoredLabel: 'Probe', parameters: [{ name: 'function', value: lit48('probe') }], portKnowledge: 'partial' });
    wire48(cf, 'noteInput', 'onTextChanged', 'cf', 'in-note');
    wire48(cf, 'themeButton', 'onClick', 'cf', 'call', 'signal');
    const builtCf = emitApp(cf, catalog);
    expect(builtCf.notes.join('\n')).not.toContain(DROPPED);
    expect(mood48(builtCf)).toContain('useState<string>');
    const es = cloneIr();
    add48(es, { id: 'es', type: 'Event Sender', authoredLabel: 'Tell', parameters: [{ name: 'channelName', value: lit48('told') }, { name: 'payload', value: lit48('note') }] });
    wire48(es, 'noteInput', 'onTextChanged', 'es', 'note');
    wire48(es, 'themeButton', 'onClick', 'es', 'sendEvent', 'signal');
    const builtEs = emitApp(es, catalog);
    expect(builtEs.notes.join('\n')).not.toContain(DROPPED);
    expect(mood48(builtEs)).toContain('useState<string>');
  });
});
