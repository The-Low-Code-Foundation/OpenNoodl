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
const notesComponent = (source: ExportIR) => source.components.find((c) => c.path === 'Pages/Notes')!;

// ---------------------------------------------------------------------------------------------
// The golden tests (the collections slice's acceptance): the extended Cheer fixture vs the
// hand-written targets in EXP-002-COLLECTIONS-TARGET-OUTPUT.md. Any diff is a design
// conversation, on purpose.
// ---------------------------------------------------------------------------------------------

const GOLDEN_NOTES_COLLECTION = `// @nodegx:generated (collections — provenance markers complete in EXP-007)
import { collection } from '@nodegx/core';

export interface NotesItem {
  text?: string;
  mood?: string;
}

/**
 * Named by "Notes array" (Collection2 \`notesArray\` on /Pages/Notes).
 * Inserted by "Make note" (NewModel \`makeNote\` → CollectionInsert \`insertNote\` on /Pages/Notes).
 */
export const notes = collection<NotesItem>([]);
`;

const GOLDEN_NOTES_PAGE = `// @nodegx:generated (visual — provenance markers complete in EXP-007)
import { useCollection } from '@nodegx/core/react';

import { notes } from '../collections/notes';
import { NoteRow } from '../components/NoteRow';
import { noteDraft, visitorName } from '../stores/variables';
import styles from './Notes.module.css';

/** Notes. */
export function NotesPage() {
  const notesItems = useCollection(notes);

  return (
    <div className={styles.notesPage}>
      <title>Notes</title>

      <p className={styles.notesHeading}>Notes</p>

      <input
        className={styles.entryInput}
        placeholder="What happened?"
        onChange={(event) => noteDraft.set(event.target.value)}
      />

      <button
        className={styles.addButton}
        onClick={() => {
          if (noteDraft.get() || visitorName.get()) notes.add({ text: noteDraft.get(), mood: 'sunny' });
        }}
      >
        Add note
      </button>

      {notesItems.map((item, index) => (
        <NoteRow key={index} text={item.text} mood={item.mood} />
      ))}
    </div>
  );
}
`;

describe('the collection module (COLLECTIONS-TARGET §1)', () => {
  test('notes.ts matches the hand-written target', () => {
    expect(app.files['src/collections/notes.ts']).toBe(GOLDEN_NOTES_COLLECTION);
  });

  test('the puppy export has no collection modules', () => {
    const puppy = emitApp(parseProject(PUPPY_FIXTURE, catalog), catalog);
    expect(Object.keys(puppy.files).filter((f) => f.startsWith('src/collections/'))).toEqual([]);
  });
});

describe('one .add in the handler, useCollection in render (COLLECTIONS-TARGET §2)', () => {
  test('Notes.tsx matches the hand-written target', () => {
    expect(app.files['src/pages/Notes.tsx']).toBe(GOLDEN_NOTES_PAGE);
  });

  test('nothing on the extended fixture is dropped: the only note is the router shell', () => {
    expect(app.notes).toEqual([
      'App: router shell — emitted as src/App.tsx by the scaffold',
      'Components/GreetingCard: wire greet-state:value-Draft->greet-draft:startValue: property "Draft" reads its boot value — no wire writes it (a runtime script would) — rendered as the empty/omitted form'
    ]);
  });

  test('the NewModel and the CollectionInsert both collapse into the handler element', () => {
    // The manifest-level truth behind the golden: neither node may survive as deferred debris.
    // Re-planned here through emitApp's notes — a deferred chain would have noted its wires.
    const mutated = cloneIr();
    const result = emitApp(mutated, catalog);
    expect(result.notes.join('\n')).not.toContain('makeNote');
    expect(result.notes.join('\n')).not.toContain('insertNote');
  });
});

describe('what defers, all with notes (COLLECTIONS-TARGET §3)', () => {
  test('a wired array id defers the insert chain', () => {
    const mutated = cloneIr();
    notesComponent(mutated).connections.push({
      key: 'noteDraftVar:value->insertNote:collectionId',
      fromId: 'noteDraftVar',
      fromProperty: 'value',
      toId: 'insertNote',
      toProperty: 'collectionId',
      kind: 'value'
    });
    const result = emitApp(mutated, catalog);
    expect(result.files['src/pages/Notes.tsx']).not.toContain('.add(');
    expect(result.notes.join('\n')).toContain('array id is not a literal');
  });

  test("a second consumer of the created object's id defers the chain (Model2 territory)", () => {
    const mutated = cloneIr();
    notesComponent(mutated).connections.push({
      key: 'makeNote:id->setNote:value',
      fromId: 'makeNote',
      fromProperty: 'id',
      toId: 'noteDraftVar',
      toProperty: 'value',
      kind: 'value'
    });
    const result = emitApp(mutated, catalog);
    expect(result.files['src/pages/Notes.tsx']).not.toContain('.add(');
    expect(result.notes.join('\n')).toContain('Model2 territory');
  });

  test('an array-typed property defers the chain', () => {
    const mutated = cloneIr();
    setParam(nodeOf(mutated, 'Pages/Notes', 'makeNote'), 'type-mood', { kind: 'literal', value: 'array' });
    const result = emitApp(mutated, catalog);
    expect(result.files['src/pages/Notes.tsx']).not.toContain('.add(');
    expect(result.notes.join('\n')).toContain('property "mood" is array-typed');
  });

  test('a property with no wire and no literal is omitted — the per-key abstain', () => {
    const mutated = cloneIr();
    const makeNote = nodeOf(mutated, 'Pages/Notes', 'makeNote');
    makeNote.parameters = makeNote.parameters.filter((p) => p.name !== 'prop-mood');
    const result = emitApp(mutated, catalog);
    expect(result.files['src/pages/Notes.tsx']).toContain('notes.add({ text: noteDraft.get() })');
    // A key nothing can ever write does not exist in the item type; the row's mapping entry
    // for it drops with a note (the runtime never delivers undefined either).
    expect(result.files['src/collections/notes.ts']).not.toContain('mood');
    expect(result.files['src/pages/Notes.tsx']).not.toContain('mood={');
    expect(result.notes.join('\n')).toContain('which no statically-known item carries');
  });

  test("wiring the array node's count output defers the read side, not the write side", () => {
    const mutated = cloneIr();
    notesComponent(mutated).connections.push({
      key: 'notesArray:count->noteDraftVar:value',
      fromId: 'notesArray',
      fromProperty: 'count',
      toId: 'noteDraftVar',
      toProperty: 'value',
      kind: 'value'
    });
    const result = emitApp(mutated, catalog);
    expect(result.files['src/pages/Notes.tsx']).not.toContain('useCollection');
    expect(result.files['src/pages/Notes.tsx']).toContain('notes.add(');
    expect(result.notes.join('\n')).toContain('output drives logic this slice does not translate');
  });

  test('a mapping field outside the item type drops that entry with a note, not the repeater', () => {
    const mutated = cloneIr();
    const rowInputs = nodeOf(mutated, 'Components/NoteRow', 'rowInputs');
    rowInputs.declaredPorts.push({ name: 'id', plug: 'output', kind: 'value', type: 'string' });
    const result = emitApp(mutated, catalog);
    expect(result.files['src/pages/Notes.tsx']).toContain('text={item.text}');
    expect(result.files['src/pages/Notes.tsx']).not.toContain('id={item.id}');
    expect(result.notes.join('\n')).toContain('which no statically-known item carries');
  });
});

describe('determinism', () => {
  test('emission is deterministic: two runs are byte-identical (D6)', () => {
    const again = emitApp(parseProject(FIXTURE, catalog), catalog);
    expect(again.files).toEqual(app.files);
  });
});
