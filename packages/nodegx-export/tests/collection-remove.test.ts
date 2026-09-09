import * as fs from 'fs';
import * as path from 'path';

import { Catalog, CatalogIndex, loadCatalog } from '../src/catalog';
import { emitApp } from '../src/emit/emitApp';
import { parseProject } from '../src/parse/parseProject';
import { planProject } from '../src/analyze/plan';
import { ComponentIR, ExportIR } from '../src/ir/types';
import { typecheckEmittedApp } from './helpers/typecheckApp';

const FIXTURE = path.join(__dirname, 'fixtures', 'cheer');

const catalog: Catalog = loadCatalog();
const index = new CatalogIndex(catalog);
const ir = parseProject(FIXTURE, catalog);

const componentOf = (s: ExportIR, p: string): ComponentIR => s.components.find((c) => c.path === p)!;
const wire = (
  s: ExportIR,
  p: string,
  fromId: string,
  fromProperty: string,
  toId: string,
  toProperty: string,
  kind: 'value' | 'signal' = 'signal'
) => {
  componentOf(s, p).connections.push({
    key: `${fromId}:${fromProperty}->${toId}:${toProperty}`,
    fromId,
    fromProperty,
    toId,
    toProperty,
    kind
  });
};

/** `cheer`'s `NoteRow`, given the delete button every editable list has (the §29 shape). */
const withRowOutput = (): ExportIR => {
  const m = structuredClone(ir);
  const row = componentOf(m, 'Components/NoteRow');
  row.nodes.push({
    id: 'delBtn',
    type: 'net.noodl.controls.button',
    catalogRef: 'net.noodl.controls.button',
    parameters: [{ name: 'label', value: { kind: 'literal', value: 'Delete' } }],
    declaredPorts: [],
    portKnowledge: 'partial',
    parent: 'noteRow'
  } as never);
  (row.nodes.find((n) => n.id === 'noteRow') as unknown as { children: string[] }).children.push('delBtn');
  row.nodes.push({
    id: 'rowOutputs',
    type: 'Component Outputs',
    catalogRef: 'Component Outputs',
    parameters: [],
    portKnowledge: 'partial',
    declaredPorts: [{ name: 'removed', plug: 'input', kind: 'signal' }]
  } as never);
  wire(m, 'Components/NoteRow', 'delBtn', 'onClick', 'rowOutputs', 'removed');
  return m;
};

/** The page-side `Remove Object From Array`, bound to the array the list repeats. */
const withRemoveNode = (m: ExportIR, collectionId = 'notes'): ExportIR => {
  componentOf(m, 'Pages/Notes').nodes.push({
    id: 'delNote',
    type: 'CollectionRemove',
    catalogRef: 'CollectionRemove',
    parameters: [{ name: 'collectionId', value: { kind: 'literal', value: collectionId } }],
    declaredPorts: [],
    portKnowledge: 'partial'
  } as never);
  return m;
};

/**
 * The whole graph an author draws for "a delete button in a row": the row's signal fires the
 * removal, and the repeater's Item Id says which row.
 */
const deleteARow = (collectionId = 'notes'): ExportIR => {
  const m = withRemoveNode(withRowOutput(), collectionId);
  wire(m, 'Pages/Notes', 'notesList', 'itemActionItemId', 'delNote', 'modifyId', 'value');
  wire(m, 'Pages/Notes', 'notesList', 'itemOutputSignal-removed', 'delNote', 'remove');
  return m;
};

const notesPage = (m: ExportIR): string => emitApp(m, catalog).files['src/pages/Notes.tsx'] ?? '';
/**
 * The repeater's whole emitted block, opening `.map(` to closing `))}`.
 *
 * ⚠️ Not "the lines containing `<NoteRow`". A row with one more attribute wraps across lines, so
 * a line filter reads an *added* callback as an absent one — an assertion that gets weaker
 * exactly when the thing it is watching for appears.
 */
const rowJsx = (m: ExportIR): string => {
  const page = notesPage(m);
  const start = page.indexOf('.map(');
  if (start === -1) return page;
  const end = page.indexOf('))}', start);
  return page.slice(start, end === -1 ? undefined : end + 3);
};
const dispositionOf = (m: ExportIR, nodeId: string) =>
  planProject(m, index).byLegacyPath.get('/Pages/Notes')!.dispositions[nodeId];
const reasonFor = (m: ExportIR, nodeId: string): string => {
  const d = dispositionOf(m, nodeId);
  return d !== undefined && d.kind === 'deferred' ? d.reason : `(not deferred: ${JSON.stringify(d)})`;
};

// ---------------------------------------------------------------------------------------------
// EXP-011 §30 — `Remove Object From Array`, which §7.3 recorded as blocked because "a row's
// outputs cannot reach the page at all yet".
//
// 🔴 That half of the sentence was disproved in §29. The other half is still true and is what
// this translation is built on: the Object Id really does come from inside the row. `foreach.tsx`
// publishes the firing row as `itemActionItemId` (`model.getId()`, set synchronously before the
// pulse is scheduled), so the id names the row whose callback the emitted code is standing in —
// and that row is already bound as `item`. The emitted form spells no id at all.
// ---------------------------------------------------------------------------------------------

describe('a row’s delete button removes that row (§30)', () => {
  test('emits the removal into the row’s own callback', () => {
    expect(rowJsx(deleteARow())).toContain('onRemoved={() => notes.remove(item)}');
  });

  /**
   * 🔴 §29's trap, asserted rather than assumed: a `collapsed` disposition is a *claim* about
   * the emitted code. The row above reads the file; this one reads the claim; they have to agree
   * or the report is lying about a node again.
   */
  test('the report calls it collapsed into the repeater, and the file agrees', () => {
    const m = deleteARow();
    expect(dispositionOf(m, 'delNote')).toEqual({ kind: 'collapsed', into: 'notesList' });
    expect(notesPage(m)).toContain('notes.remove(item)');
  });

  test('the exported app compiles', () => {
    expect(typecheckEmittedApp(emitApp(deleteARow(), catalog))).toEqual([]);
  });

  /**
   * The Done chain is *following statements*, not an arm — gates 1-3 prove the other two
   * outcomes dead, so there is nothing to fork on, and the bare form stays an expression.
   */
  test('a Done chain prints beside the removal, in the same callback', () => {
    const m = deleteARow();
    componentOf(m, 'Pages/Notes').nodes.push({
      id: 'showAbout',
      type: 'NavigationShowPopup',
      catalogRef: 'NavigationShowPopup',
      parameters: [{ name: 'target', value: { kind: 'literal', value: '/Components/AboutDialog' } }],
      declaredPorts: [],
      portKnowledge: 'partial'
    } as never);
    wire(m, 'Pages/Notes', 'delNote', 'done', 'showAbout', 'show');
    expect(rowJsx(m)).toMatch(/onRemoved=\{\(\) => \{\s*notes\.remove\(item\);\s*setOpenPopup\('AboutDialog'\);\s*\}\}/);
  });
});

// ---------------------------------------------------------------------------------------------
// The gates. Each one is a way the emitted call would be wrong, and each has to refuse by name.
// ---------------------------------------------------------------------------------------------

describe('what the removal refuses, and why (§30)', () => {
  /**
   * 🔴 **The negative control the rest of the suite means nothing without.** Everything above
   * would read identically for an emitter that translated `Remove Object From Array` anywhere at
   * all. Here the very same node, with the very same Object Id wire, is fired by an ordinary
   * page button — where "the row that fired" has no referent — and it must not translate.
   */
  test('the same node fired by a page button does not translate', () => {
    const m = withRemoveNode(withRowOutput());
    wire(m, 'Pages/Notes', 'notesList', 'itemActionItemId', 'delNote', 'modifyId', 'value');
    wire(m, 'Pages/Notes', 'addButton', 'onClick', 'delNote', 'remove');
    expect(notesPage(m)).not.toContain('notes.remove(');
    expect(reasonFor(m, 'delNote')).toContain('values that only exist in another handler');
  });

  /**
   * The repeater's own pulses are the same refusal one port over: `itemsRendered` fires from the
   * list's progress and names no row, so the id it would remove by does not exist there either.
   */
  test('the repeater’s own lifecycle pulse does not translate', () => {
    const m = withRemoveNode(withRowOutput());
    wire(m, 'Pages/Notes', 'notesList', 'itemActionItemId', 'delNote', 'modifyId', 'value');
    wire(m, 'Pages/Notes', 'notesList', 'itemsRendered', 'delNote', 'remove');
    expect(notesPage(m)).not.toContain('notes.remove(');
    expect(reasonFor(m, 'delNote')).toContain('values that only exist in another handler');
  });

  test('an Object Id from anywhere but a repeater’s Item Id is named', () => {
    const m = withRemoveNode(withRowOutput());
    wire(m, 'Pages/Notes', 'noteDraftVar', 'value', 'delNote', 'modifyId', 'value');
    wire(m, 'Pages/Notes', 'notesList', 'itemOutputSignal-removed', 'delNote', 'remove');
    expect(reasonFor(m, 'delNote')).toContain("Variable2's \"value\"");
    expect(reasonFor(m, 'delNote')).toContain("repeater's Item Id");
  });

  test('an unwired Object Id is named as the Failure the runtime would answer', () => {
    const m = withRemoveNode(withRowOutput());
    wire(m, 'Pages/Notes', 'notesList', 'itemOutputSignal-removed', 'delNote', 'remove');
    expect(reasonFor(m, 'delNote')).toContain('nothing is wired to its Object Id');
  });

  test('two wires into the Object Id are not statically ordered', () => {
    const m = deleteARow();
    wire(m, 'Pages/Notes', 'noteDraftVar', 'value', 'delNote', 'modifyId', 'value');
    expect(reasonFor(m, 'delNote')).toContain('two wires feed its Object Id');
  });

  /**
   * 🔴 **Gate 3, and it is the one that stops a silently-wrong emit.** `Collection.remove` is
   * `indexOf` — reference equality — so removing a row of *this* array is exact and removing a
   * row of any other list is a call that quietly does nothing. A repeater fed by a mapped list
   * hands back a fresh object per row; a repeater fed by a different array hands back an object
   * this one never held.
   */
  test('a repeater that repeats another array is refused by name', () => {
    const m = deleteARow();
    const feed = componentOf(m, 'Pages/Notes').nodes.find((n) => n.id === 'notesArray')!;
    (feed.parameters as Array<{ name: string; value: unknown }>).splice(0, feed.parameters.length, {
      name: 'collectionId',
      value: { kind: 'literal', value: 'archive' }
    });
    expect(reasonFor(m, 'delNote')).toContain('repeats "archive" while this node removes from "notes"');
    expect(notesPage(m)).not.toContain('notes.remove(');
  });

  test('a repeater fed by no named array is refused by name', () => {
    const m = deleteARow();
    const page = componentOf(m, 'Pages/Notes');
    page.connections = page.connections.filter((c) => !(c.toId === 'notesList' && c.toProperty === 'items'));
    expect(reasonFor(m, 'delNote')).toContain('not fed by a named array');
    expect(reasonFor(m, 'delNote')).toContain('indexOf');
    expect(notesPage(m)).not.toContain('notes.remove(');
  });

  test('an Array Id that is not a literal name is refused, as Clear Array’s is', () => {
    const m = deleteARow();
    const node = componentOf(m, 'Pages/Notes').nodes.find((n) => n.id === 'delNote')!;
    (node.parameters as unknown[]).length = 0;
    wire(m, 'Pages/Notes', 'noteDraftVar', 'value', 'delNote', 'collectionId', 'value');
    // EXP-011 §55: a wire from anything but a Create New Array's `id` now names its source.
    expect(reasonFor(m, 'delNote')).toContain("its Array Id is wired from Variable2's value — only a Create New Array's Id binds by wire");
  });

  test('a consumed Completed defers, as every outcome node’s does', () => {
    const m = deleteARow();
    componentOf(m, 'Pages/Notes').nodes.push({
      id: 'afterAll',
      type: 'Set Variable',
      catalogRef: 'Set Variable',
      parameters: [
        { name: 'name', value: { kind: 'literal', value: 'noteDraft' } },
        { name: 'value', value: { kind: 'literal', value: '' } }
      ],
      declaredPorts: [],
      portKnowledge: 'partial'
    } as never);
    wire(m, 'Pages/Notes', 'delNote', 'completed', 'afterAll', 'do');
    expect(reasonFor(m, 'delNote')).toContain('Completed output is consumed');
  });
});

// ---------------------------------------------------------------------------------------------
// The two outcome wires this shape cannot fire.
// ---------------------------------------------------------------------------------------------

describe('the outcome wires that are dead in the interpreter too (§30)', () => {
  test.each([
    ['failure', 'unresolvable array or an unloaded object'],
    ['unchanged', 'a member of it by construction']
  ])('a %s wire is dropped with a note rather than deferring the node', (port, phrase) => {
    const m = deleteARow();
    componentOf(m, 'Pages/Notes').nodes.push({
      id: 'onOutcome',
      type: 'Set Variable',
      catalogRef: 'Set Variable',
      parameters: [
        { name: 'name', value: { kind: 'literal', value: 'noteDraft' } },
        { name: 'value', value: { kind: 'literal', value: 'x' } }
      ],
      declaredPorts: [],
      portKnowledge: 'partial'
    } as never);
    wire(m, 'Pages/Notes', 'delNote', port as string, 'onOutcome', 'do');
    const result = emitApp(m, catalog);
    expect(rowJsx(m)).toContain('notes.remove(item)');
    expect(result.notes.join('\n')).toContain(phrase as string);
    // Dropped means dropped: the arm is not emitted anywhere in the page.
    expect(notesPage(m)).not.toContain("setNoteDraft('x')");
  });
});

// ---------------------------------------------------------------------------------------------
// 🔴 The walkers a new action kind is invisible to. §17.3's shape: not a switch that stops
// compiling, a walk that quietly stops walking — every one of these has a `default` clause.
// ---------------------------------------------------------------------------------------------

describe('a chain hung off an array mutator is walked (§30)', () => {
  const withPopupInChain = (trigger: 'clear' | 'remove'): ExportIR => {
    const m = trigger === 'remove' ? deleteARow() : withRowOutput();
    const page = componentOf(m, 'Pages/Notes');
    if (trigger === 'clear') {
      page.nodes.push({
        id: 'clearArr',
        type: 'CollectionClear',
        catalogRef: 'CollectionClear',
        parameters: [{ name: 'collectionId', value: { kind: 'literal', value: 'notes' } }],
        declaredPorts: [],
        portKnowledge: 'partial'
      } as never);
      wire(m, 'Pages/Notes', 'addButton', 'onClick', 'clearArr', 'clear');
    }
    page.nodes.push({
      id: 'showAbout',
      type: 'NavigationShowPopup',
      catalogRef: 'NavigationShowPopup',
      parameters: [{ name: 'target', value: { kind: 'literal', value: '/Components/AboutDialog' } }],
      declaredPorts: [],
      portKnowledge: 'partial'
    } as never);
    wire(m, 'Pages/Notes', trigger === 'clear' ? 'clearArr' : 'delNote', 'done', 'showAbout', 'show');
    return m;
  };

  /**
   * 🔴 Found while adding the case above, and it was already true of `Clear Array`: `scanActions`
   * did not descend into an array mutator's chains, so a popup opened from a Done chain never
   * earned its slot registration and the emitted `setOpenPopup` addressed a slot the page did
   * not render.
   */
  test.each([['remove'], ['clear']])('a popup opened from a %s Done chain earns its slot', (trigger) => {
    const m = withPopupInChain(trigger as 'clear' | 'remove');
    const plan = planProject(m, index).byLegacyPath.get('/Pages/Notes')!;
    expect(plan.popups.map((p) => p.slotKey)).toContain('AboutDialog');
    expect(notesPage(m)).toContain("setOpenPopup('AboutDialog')");
  });
});

// ---------------------------------------------------------------------------------------------
// §30.3 — the same shape, parsed off disk.
//
// 🔴 Everything above this line builds its graph in memory, and that is how §29 shipped a fix
// that could not fire on a real project: the test `wire()` helper declares the connection a
// signal, while a project file carries no kind at all and `resolveSourcePortKind` — correctly
// refusing to guess — answers `'value'` for a dynamic port no catalog knows. The wire then fell
// out of the handler branch as "the trigger is not a rendered element event or a receiver".
//
// `tests/fixtures/note-desk` is the shape §29's closing note asked for, and it found this on its
// first export. These rows read the fixture from disk, so they cannot be satisfied by a hand-made
// IR again.
// ---------------------------------------------------------------------------------------------

describe('a delete button in a list row, parsed off disk (§30.3)', () => {
  const desk = parseProject(path.join(__dirname, 'fixtures', 'note-desk'), catalog);
  const app = emitApp(desk, catalog);

  test('the relayed row signal parses as a value — the plan must not believe the parsed kind', () => {
    const home = desk.components.find((c) => c.path === 'Pages/Home')!;
    const relay = home.connections.find((c) => c.fromProperty === 'itemOutputSignal-removed')!;
    // The control, in the same breath: a port the catalog *does* know resolves as a signal, so
    // this is a gap in what the parse can see and not a resolver that answers 'value' for
    // everything.
    expect(index.portKind('For Each', 'itemsRendered', 'output')).toBe('signal');
    expect(index.portKind('For Each', 'itemOutputSignal-removed', 'output')).toBeUndefined();
    expect(relay.kind).toBe('value');
  });

  test('and the page still emits the removal into the row’s callback', () => {
    expect(app.files['src/pages/Home.tsx']).toContain('notes.remove(item)');
    expect(app.files['src/components/NoteRow.tsx']).toContain('onRemoved?: () => void;');
  });

  test('the whole project exports with nothing refused', () => {
    // The router shell's line is the scaffold reporting what it handled, not a refusal.
    expect(app.notes.filter((n) => !n.startsWith('App: router shell'))).toEqual([]);
    expect(typecheckEmittedApp(app)).toEqual([]);
  });
});
