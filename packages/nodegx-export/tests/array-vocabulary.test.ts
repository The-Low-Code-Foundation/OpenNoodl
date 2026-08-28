import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

import { Catalog } from '../src/catalog';
import { emitApp } from '../src/emit/emitApp';
import { parseProject } from '../src/parse/parseProject';
import { ExportIR, ComponentIR, ConnectionIR, NodeIR, ParamValue } from '../src/ir/types';

/**
 * EXP-011 Tier 1.1 — the client-side data vocabulary.
 *
 * Built on the Cheer fixture's `Pages/Notes`, which already carries the whole write side of a
 * named array (`NewModel makeNote → CollectionInsert insertNote → notes`), a `Collection2`
 * reading it back and a `For Each` over `/Components/NoteRow`. Every case below adds one node
 * to that, so what is under test is the new translation and never a fixture built to suit it.
 *
 * 🔴 **The defer cases assert the NAMED REASON, not merely that something deferred.** A gate
 * firing for the wrong reason passes the weaker test, and this slice has four deliberate
 * deferrals whose reasons are the whole content of the decision.
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

const connect = (component: ComponentIR, from: string, fromProperty: string, to: string, toProperty: string, kind: ConnectionIR['kind'] = 'signal') => {
  component.connections.push({
    key: `${from}:${fromProperty}->${to}:${toProperty}`,
    fromId: from,
    fromProperty,
    toId: to,
    toProperty,
    kind
  });
};

const addNode = (component: ComponentIR, node: Partial<NodeIR> & { id: string; type: string }): NodeIR => {
  const full: NodeIR = {
    catalogRef: node.type,
    parameters: [],
    declaredPorts: [],
    portKnowledge: 'complete',
    ...node
  } as NodeIR;
  component.nodes.push(full);
  return full;
};

const emit = (ir: ExportIR) => emitApp(ir, catalog);
const notesOf = (ir: ExportIR) => ir.components.find((c) => c.path === 'Pages/Notes')!;
const notesFile = (app: ReturnType<typeof emitApp>) =>
  app.files[Object.keys(app.files).find((k) => k.endsWith('Notes.tsx'))!];
const collectionFile = (app: ReturnType<typeof emitApp>) =>
  app.files[Object.keys(app.files).find((k) => k.includes('collections/'))!];
const notesReport = (app: ReturnType<typeof emitApp>) =>
  app.notes.filter((n) => n.includes('Pages/Notes') || n.includes('clearNotes') || n.includes('clearOther')).join('\n');

/**
 * 🔴 Every emitted file in these cases is parsed, because the first version of this slice
 * emitted `…{ notes.clear(); … }; else …` — a SyntaxError that three `toContain` assertions in
 * this very file passed on. `tests/emitted-syntax.test.ts` runs the same check over the fixtures
 * on disk; these IRs are built in memory and reach it no other way.
 */
const expectParses = (app: ReturnType<typeof emitApp>) => {
  for (const [file, source] of Object.entries(app.files)) {
    if (!file.endsWith('.ts') && !file.endsWith('.tsx')) continue;
    const sf = ts.createSourceFile(file, source, ts.ScriptTarget.ESNext, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const diagnostics = (sf as unknown as { parseDiagnostics: ts.Diagnostic[] }).parseDiagnostics ?? [];
    expect(diagnostics.map((d) => `${file}: ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`)).toEqual([]);
  }
};

/**
 * A `Clear Array` on the Notes page, fired by the existing Add button's click.
 *
 * The button is reused rather than a second one added: what is being tested is the compiled
 * action, and the trigger's provenance is already covered by the collections slice.
 */
/**
 * A translatable sink for an outcome chain: `Set Variable` writing `<name>` from the existing
 * `visitorName` read. ⚠️ A `Variable2`'s `value` is an input *value* port and not a trigger, so
 * wiring an outcome into one defers the whole node with "drives no translatable action" — which
 * is a true reason about the fixture and says nothing about the translation under test.
 */
const addSetVariable = (component: ComponentIR, id: string, variableName: string) => {
  const node = addNode(component, { id, type: 'Set Variable' });
  setParam(node, 'name', { kind: 'literal', value: variableName });
  connect(component, 'visitorRead', 'value', id, 'value', 'value');
  return node;
};

const withClearArray = (opts: { collectionId?: ParamValue; wireDone?: boolean; wireUnchanged?: boolean; wireFailure?: boolean; wireCompleted?: boolean } = {}) => {
  const ir: ExportIR = structuredClone(baseIr);
  const notes = notesOf(ir);
  const clear = addNode(notes, { id: 'clearNotes', type: 'CollectionClear', authoredLabel: 'Clear notes' });
  setParam(clear, 'collectionId', opts.collectionId ?? { kind: 'literal', value: 'notes' });
  // The Add button's click drives it — one trigger, so the emitted handler is the clear alone.
  connect(notes, 'addButton', 'onClick', 'clearNotes', 'clear');
  const sink = (port: string, id: string, variableName: string) => {
    addSetVariable(notes, id, variableName);
    connect(notes, 'clearNotes', port, id, 'do');
  };
  if (opts.wireDone) sink('done', 'afterClear', 'lastAction');
  if (opts.wireUnchanged) sink('unchanged', 'afterNoop', 'lastNoop');
  if (opts.wireFailure) sink('failure', 'afterFail', 'lastFail');
  if (opts.wireCompleted) sink('completed', 'afterAny', 'lastAny');
  return { ir, notes, clear };
};

// ---------------------------------------------------------------------------------------------
// Clear Array
// ---------------------------------------------------------------------------------------------

describe('Clear Array → collection.clear()', () => {
  it('emits the bare call when neither outcome is consumed', () => {
    const { ir } = withClearArray();
    const out = notesFile(emit(ir));
    expect(out).toContain('notes.clear()');
    // No outcome is wired, so nothing tests the length — the fork would be dead code.
    expect(out).not.toContain('notes.peek()');
  });

  it('names the array in the collection module doc comment', () => {
    const { ir } = withClearArray();
    expect(collectionFile(emit(ir))).toContain(
      'Emptied by "Clear notes" (CollectionClear `clearNotes` on /Pages/Notes).'
    );
  });

  it('registers a module for an array only a Clear Array names', () => {
    const ir: ExportIR = structuredClone(baseIr);
    const notes = notesOf(ir);
    const clear = addNode(notes, { id: 'clearOther', type: 'CollectionClear', authoredLabel: 'Clear log' });
    setParam(clear, 'collectionId', { kind: 'literal', value: 'audit log' });
    connect(notes, 'addButton', 'onClick', 'clearOther', 'clear');
    const app = emit(ir);
    const key = Object.keys(app.files).find((k) => k.includes('collections/') && !k.includes('notes'));
    expect(key).toBeDefined();
    expect(app.files[key!]).toContain('Emptied by "Clear log"');
  });

  /**
   * 🔴 The runtime measures `wasEmpty` before `set([])` and reports `unchanged` for an array
   * that was already empty. A `done` chain emitted unconditionally would fire where the
   * interpreter stays silent, so the guard is the translation, not a decoration on it.
   */
  it('guards the Done chain on the array not being empty', () => {
    const app = emit(withClearArray({ wireDone: true }).ir);
    const out = notesFile(app);
    expect(out).toContain('if (notes.peek().length > 0)');
    expect(out).toContain('notes.clear()');
    expectParses(app);
  });

  it('forks both ways when Done and Unchanged are both consumed, and the fork parses', () => {
    const app = emit(withClearArray({ wireDone: true, wireUnchanged: true }).ir);
    const out = notesFile(app);
    // The shape that shipped broken was `…; else …` after a block. Pin the joined form itself.
    expect(out).toContain('{ notes.clear(); lastAction.set(visitorName.get()); } else');
    expectParses(app);
  });

  /**
   * The empty arm omits the `.clear()` on purpose — `Collection.clear()` returns early on an
   * empty list, so the call there is a no-op. This is the control that says the omission is a
   * decision: the *only* `.clear()` in the file sits on the non-empty arm.
   */
  it('does not call clear on the already-empty arm', () => {
    const { ir } = withClearArray({ wireUnchanged: true });
    const out = notesFile(emit(ir));
    const guard = out.indexOf('if (notes.peek().length > 0)');
    const elseAt = out.indexOf('else', guard);
    expect(guard).toBeGreaterThan(-1);
    expect(elseAt).toBeGreaterThan(-1);
    expect(out.slice(elseAt)).not.toContain('notes.clear()');
  });

  it('drops a Failure wire as dead rather than deferring the node', () => {
    const { ir } = withClearArray({ wireFailure: true });
    const app = emit(ir);
    expect(notesFile(app)).toContain('notes.clear()');
    expect(notesReport(app)).toContain('a literal Array Id always resolves');
  });

  it('defers when Completed is consumed, and says which port', () => {
    const { ir } = withClearArray({ wireCompleted: true });
    const app = emit(ir);
    expect(notesFile(app)).not.toContain('notes.clear()');
    expect(notesReport(app)).toContain('its Completed output is consumed');
  });

  it('defers a wired Array Id, naming the runtime-addressed array', () => {
    const ir: ExportIR = structuredClone(baseIr);
    const notes = notesOf(ir);
    const clear = addNode(notes, { id: 'clearNotes', type: 'CollectionClear' });
    connect(notes, 'addButton', 'onClick', 'clearNotes', 'clear');
    // A wire into collectionId is what `collectionNameOf` refuses — the array is named at runtime.
    connect(notes, 'noteDraftVar', 'value', 'clearNotes', 'collectionId', 'value');
    const app = emit(ir);
    expect(notesFile(app)).not.toContain('.clear()');
    expect(notesReport(app)).toContain('its Array Id is not a literal name');
  });
});

// ---------------------------------------------------------------------------------------------
// Array Filter / Array Map — a named array, transformed, into the repeater
// ---------------------------------------------------------------------------------------------

/**
 * Rewires `notesArray → notesList` as `notesArray → [filter] → [map] → notesList`, so what is
 * measured is the transform and not a repeater built to suit it.
 */
const withTransforms = (opts: {
  filter?: Record<string, string | number | boolean>;
  mapScript?: string | null;
  omitMap?: boolean;
  omitFilter?: boolean;
} = {}) => {
  const ir: ExportIR = structuredClone(baseIr);
  const notes = notesOf(ir);
  notes.connections = notes.connections.filter((c) => !(c.fromId === 'notesArray' && c.toId === 'notesList'));
  let tail = 'notesArray';
  if (!opts.omitFilter) {
    const filter = addNode(notes, { id: 'sunnyOnly', type: 'Filter Collection', authoredLabel: 'Sunny only', portKnowledge: 'partial' });
    for (const [name, value] of Object.entries(opts.filter ?? { filterFilter: 'mood', 'filterFilterOp-mood': 'eq', 'filterFilterValue-mood': 'sunny' })) {
      setParam(filter, name, { kind: 'literal', value });
    }
    connect(notes, tail, 'items', 'sunnyOnly', 'items', 'value');
    tail = 'sunnyOnly';
  }
  if (!opts.omitMap) {
    const map = addNode(notes, { id: 'toRow', type: 'Map Collection', authoredLabel: 'To row' });
    if (opts.mapScript !== null) {
      setParam(map, 'mapScript', { kind: 'script', source: opts.mapScript ?? "map({\n  text: 'text',\n  mood: 'mood'\n})\n" });
    }
    connect(notes, tail, 'items', 'toRow', 'items', 'value');
    tail = 'toRow';
  }
  connect(notes, tail, 'items', 'notesList', 'items', 'value');
  return { ir, notes };
};

const rowsLine = (out: string) => out.split('\n').find((l) => l.includes('.map((item')) ?? '(no repeater feed emitted)';

describe('Array Filter → a derived list', () => {
  it('reads the named array through its useCollection local, not the Collection object', () => {
    const app = emit(withTransforms({ omitMap: true }).ir);
    expect(rowsLine(notesFile(app))).toContain('notesItems.filter(');
    expectParses(app);
  });

  /**
   * 🔴 Loose `==`, matching `applyFilter` verbatim. The runtime's own comment says the looseness
   * is deliberate — "what lets a numeric filter value match a CSV column of strings" — so a
   * `===` here would drop rows the interpreter keeps, in an app the author already tested.
   */
  it('compares with the runtime’s loose operators', () => {
    const out = notesFile(emit(withTransforms({ omitMap: true }).ir));
    expect(rowsLine(out)).toContain("row.mood == 'sunny'");
    expect(rowsLine(out)).not.toContain("row.mood === 'sunny'");
  });

  it('sorts on a copy, so React never sees the rendered array mutated', () => {
    const app = emit(withTransforms({
      omitMap: true,
      filter: { filterSort: 'text', 'filterSort-text': 'ascending' }
    }).ir);
    // `.slice()` before `.sort()`: Array.prototype.sort is in-place and the source is the hook local.
    expect(rowsLine(notesFile(app))).toContain('.slice().sort(');
    expectParses(app);
  });

  it('applies skip and limit as one slice, in the runtime’s order', () => {
    const out = notesFile(emit(withTransforms({
      omitMap: true,
      filter: { filterEnableLimit: true, filterLimit: 5, filterSkip: 2 }
    }).ir));
    expect(rowsLine(out)).toContain('.slice(2, 7)');
  });

  it('defaults an enabled limit to 10 and a skip to 0, as getLimit/getSkip do', () => {
    const out = notesFile(emit(withTransforms({ omitMap: true, filter: { filterEnableLimit: true } }).ir));
    expect(rowsLine(out)).toContain('.slice(0, 10)');
  });

  /** `enabled` false is "pass straight through" in `scheduleFilter` — so the source itself. */
  it('collapses to the bare source when Enabled is false', () => {
    const out = notesFile(emit(withTransforms({
      omitMap: true,
      filter: { enabled: false, filterFilter: 'mood', 'filterFilterOp-mood': 'eq', 'filterFilterValue-mood': 'sunny' }
    }).ir));
    expect(rowsLine(out)).not.toContain('.filter(');
    expect(rowsLine(out)).toContain('notesItems');
  });

  it('defers a regex test, naming the per-row compile', () => {
    const app = emit(withTransforms({
      omitMap: true,
      filter: { filterFilter: 'mood', 'filterFilterOp-mood': 'regex', 'filterFilterValue-mood': '^sun' }
    }).ir);
    expect(rowsLine(notesFile(app))).not.toContain('.filter(');
    expect(notesReport(app)).toContain('is a regex');
  });

  it('defers a test with no value rather than dropping it', () => {
    const app = emit(withTransforms({ omitMap: true, filter: { filterFilter: 'mood' } }).ir);
    expect(notesReport(app)).toContain('the runtime compares against undefined');
  });
});

describe('Array Map → a derived list', () => {
  it('maps each row to an object literal with the script’s keys', () => {
    const app = emit(withTransforms({ omitFilter: true }).ir);
    expect(rowsLine(notesFile(app))).toContain('.map((row) => ({ text: row.text, mood: row.mood }))');
    expectParses(app);
  });

  /** The declared default writes `myOutputProp: 'inputProp'` — unquoted. A quoted-only parser
   *  answers null for the shape the editor shows every author. */
  it('parses unquoted keys', () => {
    const app = emit(withTransforms({ omitFilter: true, mapScript: "map({ headline: 'text' })" }).ir);
    expect(rowsLine(notesFile(app))).toContain('.map((row) => ({ headline: row.text }))');
  });

  it('defers a function-valued mapping to EXP-003', () => {
    const app = emit(withTransforms({
      omitFilter: true,
      mapScript: "map({ shout: function (o) { return o.get('text').toUpperCase(); } })"
    }).ir);
    expect(rowsLine(notesFile(app))).not.toContain('.map((row)');
    expect(notesReport(app)).toContain('arbitrary JavaScript over a live record');
  });

  it('composes filter then map, in wire order', () => {
    const app = emit(withTransforms().ir);
    const line = rowsLine(notesFile(app));
    expect(line.indexOf('.filter(')).toBeLessThan(line.indexOf('.map((row)'));
    expectParses(app);
  });

  /**
   * 🔴 A mapped row's shape is CONCRETE in the emitted code, so a repeater input the row does
   * not carry is a type error in the exported app rather than an `any` read that compiles. It
   * is dropped and reported here, exactly as the Static Data and named-array feeds do.
   */
  it('drops a repeater input the mapped row does not carry, and reports it', () => {
    const app = emit(withTransforms({ omitFilter: true, mapScript: "map({ text: 'text' })" }).ir);
    const out = notesFile(app);
    expect(out).toContain('<NoteRow key={index} text={item.text} />');
    expect(out).not.toContain('mood={item.mood}');
    expect(notesReport(app)).toContain('which the array it reads does not carry');
  });

  it('defers when a Changed signal is consumed', () => {
    const { ir, notes } = withTransforms({ omitFilter: true });
    addSetVariable(notes, 'afterMap', 'mapped');
    connect(notes, 'toRow', 'modified', 'afterMap', 'do');
    const app = emit(ir);
    expect(rowsLine(notesFile(app))).not.toContain('.map((row)');
    expect(notesReport(app)).toContain('a derived list is always current and has no run to announce');
  });
});

// ---------------------------------------------------------------------------------------------
// Object (Model2) in "From repeater" mode → the template's props
// ---------------------------------------------------------------------------------------------

/**
 * Puts an `Object` inside `/Components/NoteRow`, which `notesList` already renders as its
 * template, and points the row's mood Text at it instead of at the Component Input.
 *
 * Every §5 gate below is exercised against this one shape, so a deferral is always the gate
 * firing and never a fixture that was never going to translate.
 */
const withRowObject = (opts: { params?: Record<string, string | number | boolean>; port?: string; sink?: string; extra?: (row: ComponentIR, ir: ExportIR) => void } = {}) => {
  const ir: ExportIR = structuredClone(baseIr);
  const row = ir.components.find((c) => c.path === 'Components/NoteRow')!;
  row.connections = row.connections.filter((c) => !(c.fromId === 'rowInputs' && c.fromProperty === 'mood'));
  const obj = addNode(row, { id: 'rowObject', type: 'Model2', authoredLabel: 'The row', portKnowledge: 'partial' });
  for (const [name, value] of Object.entries(opts.params ?? { idSource: 'foreach', properties: 'mood' })) {
    setParam(obj, name, { kind: 'literal', value });
  }
  connect(row, 'rowObject', opts.port ?? 'prop-mood', 'moodTag', opts.sink ?? 'text', 'value');
  opts.extra?.(row, ir);
  return { ir, row, obj };
};

const rowFile = (app: ReturnType<typeof emitApp>) =>
  app.files[Object.keys(app.files).find((k) => k.endsWith('NoteRow.tsx'))!];
const rowReport = (app: ReturnType<typeof emitApp>) => app.notes.filter((n) => n.includes('rowObject')).join('\n');

describe('Object in From-repeater mode → props', () => {
  it('mints a prop, reads it at the sink, and binds it from the row in the parent', () => {
    const app = emit(withRowObject().ir);
    // Child side: the interface gains the prop and the sink reads it.
    expect(rowFile(app)).toContain('mood2?: any;');
    expect(rowFile(app)).toContain('<p className={styles.moodTag}>{mood2}</p>');
    // Parent side: the For Each binds it from the row's own field.
    expect(notesFile(app)).toContain('mood2={item.mood}');
    expectParses(app);
  });

  /**
   * 🔴 The prop name is deduplicated against the component's existing inputs and the FIELD is
   * not. `NoteRow` already declares a `mood` input, so the minted prop is `mood2` — and it must
   * still read `item.mood`. Deriving the field from the prop name would bind `item.mood2`,
   * which no row has, precisely where the collision made it hardest to spot.
   */
  it('keeps the row field when the prop name had to be deduplicated', () => {
    const out = notesFile(emit(withRowObject().ir));
    expect(out).toContain('mood2={item.mood}');
    expect(out).not.toContain('mood2={item.mood2}');
  });

  it('defers an unset Id Source, naming the runtime default', () => {
    const app = emit(withRowObject({ params: { properties: 'mood' } }).ir);
    expect(rowFile(app)).not.toContain('mood2');
    expect(rowReport(app)).toContain('the runtime reads as "explicit"');
  });

  it('defers an explicit Id Source', () => {
    const app = emit(withRowObject({ params: { idSource: 'explicit', properties: 'mood' } }).ir);
    expect(rowReport(app)).toContain('not "From repeater"');
  });

  it('defers when no For Each names the component as its template', () => {
    const { ir } = withRowObject();
    // Drop the template parameter, so nothing renders NoteRow as a row any more.
    const notes = notesOf(ir);
    notes.nodes.find((n) => n.id === 'notesList')!.parameters = [];
    expect(rowReport(emit(ir))).toContain('no For Each names this component as its template');
  });

  it('defers when two For Each nodes share the template, since their rows need not agree', () => {
    const { ir } = withRowObject();
    const notes = notesOf(ir);
    const second = addNode(notes, { id: 'otherList', type: 'For Each' });
    setParam(second, 'template', { kind: 'literal', value: '/Components/NoteRow' });
    expect(rowReport(emit(ir))).toContain('2 For Each nodes name this component as their template');
  });

  it('defers a dynamically-templated repeater, which names no template statically', () => {
    const { ir } = withRowObject();
    const list = notesOf(ir).nodes.find((n) => n.id === 'notesList')!;
    setParam(list, 'templateType', { kind: 'literal', value: 'dynamic' });
    expect(rowReport(emit(ir))).toContain('no For Each names this component as its template');
  });

  it('defers a Run Tasks template, whose item is a task input rather than a rendered row', () => {
    const { ir } = withRowObject();
    const list = notesOf(ir).nodes.find((n) => n.id === 'notesList')!;
    list.type = 'Run Tasks';
    list.catalogRef = 'Run Tasks';
    expect(rowReport(emit(ir))).toContain('Run Tasks template');
  });

  /** §5.4 — a row written from inside the row is state the list owns, not a prop. */
  it('defers a written property', () => {
    const app = emit(withRowObject({
      extra: (row) => connect(row, 'rowInputs', 'text', 'rowObject', 'prop-mood', 'value')
    }).ir);
    expect(rowReport(app)).toContain('a row written from inside the row is state the list owns');
  });

  it('defers a consumed changed signal', () => {
    const app = emit(withRowObject({
      extra: (row) => connect(row, 'rowObject', 'changed-mood', 'noteText', 'text', 'signal')
    }).ir);
    expect(rowReport(app)).toContain('signal is consumed');
  });

  it('defers a consumed Id output, which the emitted row has no counterpart for', () => {
    const app = emit(withRowObject({
      extra: (row) => connect(row, 'rowObject', 'id', 'noteText', 'text', 'value')
    }).ir);
    expect(rowReport(app)).toContain('a repeater row has no id in the emitted app');
  });

  it('defers an explicit Repeater Component target', () => {
    const app = emit(withRowObject({ params: { idSource: 'foreach', properties: 'mood', repeaterComponent: 'NoteRow' } }).ir);
    expect(rowReport(app)).toContain('explicit Repeater Component');
  });

  it('defers a dotted property path', () => {
    const app = emit(withRowObject({ params: { idSource: 'foreach', properties: 'author.name' }, port: 'prop-author.name' }).ir);
    expect(rowReport(app)).toContain('dotted path');
  });
});

// ---------------------------------------------------------------------------------------------
// §2's requirement: a picker-exercising project that exports, builds and runs
// ---------------------------------------------------------------------------------------------

/**
 * `tests/fixtures/reading-shelf` — **Reading Shelf**, authored through the MCP server rather
 * than by hand-editing JSON, one routed page, every node placed on it. It carries all four
 * translations of this slice at once, and the goldens below are pinned to the exact files a
 * headless Chrome executed (EXP-011 §7.4).
 *
 * 🔴 What makes the drive a measurement rather than a demonstration is the **wishlist** button.
 * Without a book the filter has to exclude, "the right rows rendered" would read identically if
 * the filter had never been emitted at all — a reading that fits rather than one that excludes.
 */
const SHELF = path.join(__dirname, 'fixtures', 'reading-shelf');
const shelfApp = emitApp(parseProject(SHELF, catalog), catalog);
const shelfHome = shelfApp.files['src/pages/Home.tsx'];
const shelfRow = shelfApp.files['src/components/BookRow.tsx'];

describe('Reading Shelf — the driven project', () => {
  it('reports nothing dropped beyond the router shell', () => {
    expect(shelfApp.notes.filter((n) => !n.includes('router shell'))).toEqual([]);
  });

  /**
   * The whole vocabulary in one expression, in the runtime's order: the named array through its
   * hook, the filter's loose comparison, the sort on a copy, then the map's rename.
   */
  it('emits the array, the filter, the sort and the map as one chain', () => {
    expect(shelfHome).toContain(
      "booksItems.filter((row) => row.shelf == 'favourite').slice().sort((a: any, b: any) => a.title > b.title ? 1 : a.title < b.title ? -1 : 0).map((row) => ({ title: row.title, badge: row.shelf }))"
    );
  });

  /** The Object node inside the template: a minted prop, read at the sink, bound by the parent. */
  it('compiles the row Object away into a prop the repeater binds', () => {
    expect(shelfRow).toContain('badge?: any;');
    expect(shelfRow).toContain('<p className={styles.rowShelf}>{badge}</p>');
    expect(shelfHome).toContain('<BookRow key={index} title={item.title} badge={item.badge} />');
  });

  /**
   * Both arms of Clear Array, which the drive watched fire in order: the first press emptied a
   * shelf with two books on it and said so, the second found it empty and said that instead.
   */
  it('emits both Clear Array outcome arms', () => {
    expect(shelfHome).toContain(
      "if (books.peek().length > 0) { books.clear(); lastAction.set('Emptied the shelf.'); } else lastAction.set('The shelf was already empty.');"
    );
  });

  it('names every writer of the array in the collection module', () => {
    const module = shelfApp.files['src/collections/books.ts'];
    expect(module).toContain('Named by "Books array"');
    expect(module).toContain('Inserted by "Make book"');
    expect(module).toContain('Emptied by "Clear shelf"');
  });

  it('parses, every file', () => expectParses(shelfApp));
});

/**
 * 🔴 The sabotage that found the last hole in this slice, kept as a test.
 *
 * `Array Map`'s script names source properties **by string**, so nothing stops one naming a
 * property the array does not have. That emitted `row.nope` over a typed row and the exported
 * app failed `tsc -b` with *"Property 'nope' does not exist on type 'BooksItem'"* — a defect no
 * amount of parsing would have caught, and the same hole that had already been closed on the
 * repeater's side. The read now goes through a cast, which is what the runtime's `model.get`
 * answers anyway.
 */
describe('a transform reading a field the array does not carry', () => {
  const sabotaged = () => {
    const ir: ExportIR = structuredClone(parseProject(SHELF, catalog));
    const home = ir.components.find((c) => c.path === 'Pages/Home')!;
    const map = home.nodes.find((n) => n.id === 'toRow')!;
    map.parameters = [{ name: 'mapScript', value: { kind: 'script', source: "map({ title: 'title', badge: 'nope' })" } }];
    return emitApp(ir, catalog);
  };

  it('reads it through a cast rather than emitting an app that will not build', () => {
    const app = sabotaged();
    expect(app.files['src/pages/Home.tsx']).toContain('badge: (row as any).nope');
    expect(app.files['src/pages/Home.tsx']).not.toContain('badge: row.nope');
  });

  it('says so in the report', () => {
    expect(sabotaged().notes.join('\n')).toContain('Array Map reads "nope", which the array it reads does not carry');
  });
});
