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
import { useStore } from '@nodegx/core/react';

import { mood } from '../stores/mood';
import { visitorName } from '../stores/variables';
import styles from './Mood.module.css';

/** Mood board. */
export function MoodPage() {
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

      <p className={styles.themeText}>{theme}</p>

      <button className={styles.themeButton} onClick={() => mood.set({ theme: visitorName.get() })}>
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
    expect(app.notes).toEqual(['App: router shell — emitted as src/App.tsx by the scaffold']);
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
