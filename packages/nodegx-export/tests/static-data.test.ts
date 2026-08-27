import * as fs from 'fs';
import * as path from 'path';

import { Catalog } from '../src/catalog';
import { emitApp } from '../src/emit/emitApp';
import { parseProject } from '../src/parse/parseProject';
import { ExportIR, NodeIR, ParamValue } from '../src/ir/types';

/**
 * The Static Data slice (EXP-002-STATIC-DATA-TARGET-OUTPUT.md).
 *
 * The corpus has no CSV, no ragged rows, no mixed-type key and no null — 13 of its 14 nodes are
 * fully regular. So §3.1's derivation rules and every §4 gate stand on these fixtures alone,
 * which is why the defer cases assert the NAMED REASON rather than merely that something
 * deferred: a gate that fires for the wrong reason would pass the weaker test.
 *
 * Built by rewriting the Cheer fixture's `notesArray` (a Collection2 feeding the `notesList`
 * repeater) into a Static Data node, so the existing wiring and the NoteRow template are reused
 * rather than duplicated.
 */

const FIXTURE = path.join(__dirname, 'fixtures', 'cheer');
const CATALOG_PATH = path.join(__dirname, '..', '..', 'noodl-types', 'src', 'node-catalog.json');

const catalog: Catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
const baseIr = parseProject(FIXTURE, catalog);

const setParam = (node: NodeIR, name: string, value: ParamValue) => {
  const existing = node.parameters.find((p) => p.name === name);
  if (existing) existing.value = value;
  else {
    node.parameters.push({ name, value });
    node.parameters.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  }
};

/**
 * Turns `notesArray` into a Static Data node carrying `json`. The authored JSON arrives as a
 * code-editor port, i.e. `kind: 'script'` — NOT `literal`. Reading it with the literal-only
 * accessor is what made the first implementation defer all 14 corpus nodes, so the fixtures
 * feed it the way the parser really does.
 */
const withStaticData = (json: string, opts: { type?: string | null; label?: string } = {}) => {
  const ir: ExportIR = structuredClone(baseIr);
  const notes = ir.components.find((c) => c.path === 'Pages/Notes')!;
  const node = notes.nodes.find((n) => n.id === 'notesArray')!;
  node.type = 'Static Data';
  node.catalogRef = 'Static Data';
  node.authoredLabel = opts.label ?? 'Notes data';
  node.parameters = [];
  if (opts.type !== null) setParam(node, 'type', { kind: 'literal', value: opts.type ?? 'json' });
  setParam(node, 'json', { kind: 'script', source: json });
  return { ir, notes, node };
};

const emit = (ir: ExportIR) => emitApp(ir, catalog);
const notesFile = (app: ReturnType<typeof emitApp>) =>
  app.files[Object.keys(app.files).find((k) => k.endsWith('Notes.tsx'))!];

// ---------------------------------------------------------------------------------------------
// §3 — the shape that lands
// ---------------------------------------------------------------------------------------------

describe('Static Data → a frozen module constant', () => {
  it('hoists the rows, types them, and renders the repeater over them', () => {
    const { ir } = withStaticData('[{"text":"Nice one","mood":"happy"},{"text":"Keep going","mood":"calm"}]');
    const out = notesFile(emit(ir));

    expect(out).toContain('type NotesData = {');
    expect(out).toContain('  text: string;');
    expect(out).toContain('  mood: string;');
    expect(out).toContain('const NOTES_DATA: readonly NotesData[] = Object.freeze([');
    expect(out).toContain('text: "Nice one"');
    // The constant prints above the component, not inside it.
    expect(out.indexOf('const NOTES_DATA')).toBeLessThan(out.indexOf('export function Notes'));
  });

  it('keys by index when no row carries a usable id, and threads the mapped props', () => {
    const { ir } = withStaticData('[{"text":"a","mood":"happy"},{"text":"b","mood":"calm"}]');
    const out = notesFile(emit(ir));

    expect(out).toContain('{NOTES_DATA.map((item, index) => (');
    expect(out).toContain('key={index}');
    expect(out).toContain('text={item.text}');
    expect(out).toContain('mood={item.mood}');
  });

  it('keys by id when every row carries a unique one, and does not pass id as a prop', () => {
    const { ir } = withStaticData('[{"id":"n1","text":"a","mood":"happy"},{"id":"n2","text":"b","mood":"calm"}]');
    const out = notesFile(emit(ir));

    expect(out).toContain('{NOTES_DATA.map((item) => (');
    expect(out).toContain('key={item.id}');
    expect(out).not.toContain('id={item.id}');
  });

  it('keys by index when an id repeats — a duplicate id is not an identity', () => {
    const { ir } = withStaticData('[{"id":"n1","text":"a"},{"id":"n1","text":"b"}]');
    const out = notesFile(emit(ir));

    expect(out).toContain('key={index}');
    expect(out).not.toContain('key={item.id}');
  });

  it('numbers and booleans keep their types; they are not stringified', () => {
    const { ir } = withStaticData('[{"text":"a","count":3,"done":true}]');
    const out = notesFile(emit(ir));

    expect(out).toContain('  count: number;');
    expect(out).toContain('  done: boolean;');
    expect(out).toContain('count: 3');
    expect(out).toContain('done: true');
  });
});

// ---------------------------------------------------------------------------------------------
// §3.1 — the derivation rules the corpus does not exercise
// ---------------------------------------------------------------------------------------------

describe('§3.1 type derivation', () => {
  it('a key absent on some rows is optional', () => {
    const { ir } = withStaticData('[{"text":"a","mood":"happy"},{"text":"b"}]');
    expect(notesFile(emit(ir))).toContain('  mood?: string;');
  });

  it('a key whose type varies emits the union', () => {
    const { ir } = withStaticData('[{"text":"a","tag":1},{"text":"b","tag":"two"}]');
    expect(notesFile(emit(ir))).toContain('  tag: number | string;');
  });

  it('a null widens the key', () => {
    const { ir } = withStaticData('[{"text":"a","mood":null},{"text":"b","mood":"calm"}]');
    expect(notesFile(emit(ir))).toContain('  mood: null | string;');
  });

  it('a nested object recurses into a sibling alias', () => {
    const { ir } = withStaticData('[{"text":"a","author":{"name":"Ada","id":1}}]');
    const out = notesFile(emit(ir));

    expect(out).toMatch(/type NotesDataAuthor\d* = \{/);
    expect(out).toContain('  name: string;');
    expect(out).toMatch(/ {2}author: NotesDataAuthor\d*;/);
  });

  it('a nested array of records recurses and stays readonly — the SiteFooter shape', () => {
    const { ir } = withStaticData('[{"title":"Shop","links":[{"id":"a","label":"Ceramics"}]}]');
    const out = notesFile(emit(ir));

    expect(out).toMatch(/ {2}links: readonly NotesDataLinks\d*\[\];/);
    expect(out).toContain('  label: string;');
  });

  it('an empty nested array has no element to inspect, so it widens to unknown', () => {
    const { ir } = withStaticData('[{"text":"a","links":[]}]');
    expect(notesFile(emit(ir))).toContain('  links: readonly unknown[];');
  });

  it('a nested array of mixed element types widens rather than emitting a union of literals', () => {
    const { ir } = withStaticData('[{"text":"a","tags":["x",2]}]');
    expect(notesFile(emit(ir))).toContain('  tags: readonly unknown[];');
  });

  it('a non-identifier key is quoted in both the type and the literal', () => {
    const { ir } = withStaticData('[{"text":"a","data-id":"x"}]');
    const out = notesFile(emit(ir));

    expect(out).toContain('  "data-id": string;');
    expect(out).toContain('"data-id": "x"');
  });
});

// ---------------------------------------------------------------------------------------------
// §4 — the gates, each asserting its NAMED reason
// ---------------------------------------------------------------------------------------------

describe('§4 gates', () => {
  const deferNote = (ir: ExportIR) =>
    emit(ir).notes.find((n) => n.includes('notesArray') && n.includes('Static Data'));

  it('CSV defers — and an unset Type is CSV, which the runtime agrees with', () => {
    expect(deferNote(withStaticData('', { type: 'csv' }).ir)).toContain(
      'CSV is not translated in this slice'
    );
    const unset = deferNote(withStaticData('[{"text":"a"}]', { type: null }).ir);
    expect(unset).toContain('CSV is not translated in this slice');
    expect(unset).toContain('Type is unset, which the runtime reads as CSV');
  });

  it('malformed JSON defers with the parser’s own message', () => {
    expect(deferNote(withStaticData('[{"text":').ir)).toContain('the authored JSON does not parse');
  });

  it('JSON that is not an array defers', () => {
    expect(deferNote(withStaticData('{"text":"a"}').ir)).toContain('the authored JSON is not an array of records');
  });

  it('a scalar or array row defers — the runtime mints each row into a record', () => {
    expect(deferNote(withStaticData('["a","b"]').ir)).toContain('a row is not a record');
    expect(deferNote(withStaticData('[["a"]]').ir)).toContain('a row is not a record');
  });

  it('no authored JSON defers', () => {
    expect(deferNote(withStaticData('   ').ir)).toContain('no JSON is authored');
  });

  it('a wired parse-failure channel defers, because a node that reaches emit has already parsed', () => {
    const { ir, notes } = withStaticData('[{"text":"a"}]');
    notes.connections.push({
      key: 'notesArray:failure->noteRowsHeading:text',
      fromId: 'notesArray',
      fromProperty: 'failure',
      toId: notes.nodes.find((n) => n.type === 'Text')!.id,
      toProperty: 'text'
    } as (typeof notes.connections)[number]);

    expect(deferNote(ir)).toContain('the parse-failure channel is wired');
  });

  it('rows nothing renders defer rather than emitting a dead constant', () => {
    const { ir, notes } = withStaticData('[{"text":"a"}]');
    notes.connections = notes.connections.filter((c) => c.fromId !== 'notesArray');

    expect(deferNote(ir)).toContain('not consumed by a rendered repeater');
    expect(notesFile(emit(ir))).not.toContain('NOTES_DATA');
  });

  it('a deferred node leaves the repeater deferred, with the repeater’s own reason', () => {
    const app = emit(withStaticData('[{"text":').ir);
    expect(notesFile(app)).toContain('For Each notesList deferred to EXP-003');
    expect(app.notes.some((n) => n.includes('items are not fed by a query'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------
// §4.6 / §5 — count, and what deliberately stays deferred
// ---------------------------------------------------------------------------------------------

describe('§4.6 count, and §5 what stays deferred', () => {
  it('count is a number literal, because the rows are known at emit', () => {
    const { ir, notes } = withStaticData('[{"text":"a"},{"text":"b"},{"text":"c"}]');
    const text = notes.nodes.find((n) => n.type === 'Text')!;
    notes.connections.push({
      key: 'notesArray:count->text:text',
      fromId: 'notesArray',
      fromProperty: 'count',
      toId: text.id,
      toProperty: 'text'
    } as (typeof notes.connections)[number]);

    // The corpus never wires `count`; this fixture is the only evidence behind §4.6. Asserted
    // at the sink, not as a bare "3" — the file is full of 3s (var(--text-3xl) among them).
    expect(notesFile(emit(ir))).toContain('<p className={styles.notesHeading}>3</p>');
  });

  it('a mapped input no authored row carries is dropped and reported', () => {
    const { ir } = withStaticData('[{"text":"a"}]');
    const app = emit(ir);

    // NoteRow declares `mood`; these rows do not carry it.
    expect(app.notes.some((n) => n.includes('which no authored row carries'))).toBe(true);
    expect(notesFile(app)).not.toContain('mood={item.mood}');
  });
});
