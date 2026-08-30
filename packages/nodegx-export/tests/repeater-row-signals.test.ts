import * as fs from 'fs';
import * as path from 'path';

import { Catalog, CatalogIndex } from '../src/catalog';
import { emitApp } from '../src/emit/emitApp';
import { parseProject } from '../src/parse/parseProject';
import { planProject } from '../src/analyze/plan';
import { ComponentIR, ExportIR } from '../src/ir/types';
import { typecheckEmittedApp } from './helpers/typecheckApp';

const FIXTURE = path.join(__dirname, 'fixtures', 'cheer');
const CATALOG_PATH = path.join(__dirname, '..', '..', 'noodl-types', 'src', 'node-catalog.json');

const catalog: Catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
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

/**
 * `cheer`'s `NoteRow` with a delete button wired to a `removed` signal output — the shape every
 * list that can be edited has, and the one no fixture carried before this suite.
 */
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

/** A `Clear Array` on the Notes page, as something for a row's signal to drive. */
const withClearArray = (m: ExportIR): ExportIR => {
  componentOf(m, 'Pages/Notes').nodes.push({
    id: 'clearArr',
    type: 'CollectionClear',
    catalogRef: 'CollectionClear',
    parameters: [{ name: 'collectionId', value: { kind: 'literal', value: 'notes' } }],
    declaredPorts: [],
    portKnowledge: 'partial'
  } as never);
  return m;
};

const notesPage = (m: ExportIR): string => emitApp(m, catalog).files['src/pages/Notes.tsx'] ?? '';
const rowJsx = (m: ExportIR): string =>
  notesPage(m)
    .split('\n')
    .filter((l) => l.includes('<NoteRow'))
    .join('\n');

// ---------------------------------------------------------------------------------------------
// EXP-011 §29 — the row signal a repeater relays.
//
// 🔴 The defect this suite exists for was SILENT. `plan.handlers` took an entry for a wire out of
// a `For Each` exactly as for any other rendered node, and the sink was dispositioned
// `collapsed into <the repeater>` — so the report affirmatively called it translated — while
// `renderRepeater` emitted no callback whatsoever. A delete button in a list row exported as a
// button that does nothing, and the export report said nothing needed attention.
//
// The refusal recorded elsewhere ("which row fired is not statically expressible") was wrong
// twice over: `itemOutputSignalTriggered` sets `itemActionItemId = model.getId()` before pulsing,
// so the runtime names the row; and each emitted row is its own element whose callback closes
// over its own `item`, so the question is never asked on this side.
// ---------------------------------------------------------------------------------------------

describe('a relayed row signal (§29)', () => {
  test('drives an action chain — the shape that used to vanish in silence', () => {
    const m = withClearArray(withRowOutput());
    wire(m, 'Pages/Notes', 'notesList', 'itemOutputSignal-removed', 'clearArr', 'clear');
    expect(rowJsx(m)).toContain('onRemoved={() => notes.clear()}');
  });

  test('forwards the parent component’s own output', () => {
    const m = withRowOutput();
    componentOf(m, 'Pages/Notes').nodes.push({
      id: 'pageOutputs',
      type: 'Component Outputs',
      catalogRef: 'Component Outputs',
      parameters: [],
      portKnowledge: 'partial',
      declaredPorts: [{ name: 'rowGone', plug: 'input', kind: 'signal' }]
    } as never);
    wire(m, 'Pages/Notes', 'notesList', 'itemOutputSignal-removed', 'pageOutputs', 'rowGone');
    expect(rowJsx(m)).toContain('onRemoved={() => onRowGone?.()}');
  });

  /**
   * 🔴 The negative control, and the suite measures nothing without it: every assertion above
   * would read identically if `rowSignalAttrs` unconditionally emitted a callback for any
   * template that declares one. Here the template declares `removed` and the repeater relays
   * nothing — so the attribute must be absent.
   */
  test('a template output nothing relays puts no callback on the row', () => {
    const m = withRowOutput();
    expect(rowJsx(m)).toContain('<NoteRow');
    expect(rowJsx(m)).not.toContain('onRemoved');
  });

  test('the sink is reported as collapsed into the repeater, which is now true of it', () => {
    const m = withClearArray(withRowOutput());
    wire(m, 'Pages/Notes', 'notesList', 'itemOutputSignal-removed', 'clearArr', 'clear');
    const plan = planProject(m, index);
    expect(plan.byLegacyPath.get('/Pages/Notes')!.dispositions['clearArr']).toEqual({
      kind: 'collapsed',
      into: 'notesList'
    });
  });
});

/**
 * 🔴 **A `toContain` over emitted text passes on dead code** — §24.3's finding, and the reason
 * this row exists. `onRemoved={...}` on a `<NoteRow>` that declares no such prop is a type error
 * in the exported app and an assertion about its source text cannot see it. The callback prop is
 * emitted by the Component Outputs slice from the row's own `Component Outputs` node, so the two
 * ends have to agree — and this is what checks that they do.
 */
describe('the emitted app compiles with the row callback (§29)', () => {
  test('a relayed row signal typechecks against the template’s own props', () => {
    const m = withClearArray(withRowOutput());
    wire(m, 'Pages/Notes', 'notesList', 'itemOutputSignal-removed', 'clearArr', 'clear');
    const app = emitApp(m, catalog);
    expect(app.files['src/components/NoteRow.tsx']).toContain('onRemoved?: () => void;');
    expect(typecheckEmittedApp(app)).toEqual([]);
  });

  test('the control compiles too — no callback, no unused prop', () => {
    expect(typecheckEmittedApp(emitApp(withRowOutput(), catalog))).toEqual([]);
  });
});

describe('what a repeater still refuses, and says so (§29)', () => {
  /**
   * The repeater's own pulses were lost by the identical mechanism — planned, dispositioned
   * translated, emitted as nothing. They still do not translate (they fire from the list's
   * progress, which is `effect()` work), but the loss is now named.
   */
  test('its own lifecycle pulse is reported rather than dropped in silence', () => {
    const m = withClearArray(withRowOutput());
    wire(m, 'Pages/Notes', 'notesList', 'itemsRendered', 'clearArr', 'clear');
    const result = emitApp(m, catalog);
    const notes = result.notes.join('\n');
    expect(notes).toContain('For Each notesList signal "itemsRendered"');
    expect(notes).toContain("is not a row's relayed signal");
    expect(rowJsx(m)).not.toContain('onItemsRendered');
  });

  test('a relayed signal the template declares no output for is reported', () => {
    const m = withClearArray(withRowOutput());
    wire(m, 'Pages/Notes', 'notesList', 'itemOutputSignal-ghost', 'clearArr', 'clear');
    const notes = emitApp(m, catalog).notes.join('\n');
    expect(notes).toContain('relays row signal "ghost"');
    expect(notes).toContain('/Components/NoteRow');
  });

  /**
   * `itemActionItemId` is the one port whose recorded reason survives measurement: it is read as
   * a *value*, continuously, and its value is whichever row fired last — state the emitted list
   * does not hold. It defers, as it did before, and this row is here so a later session does not
   * read §29 as having translated the whole node.
   */
  test('itemActionItemId still defers — it is a value read, not a row event', () => {
    const m = withRowOutput();
    componentOf(m, 'Pages/Notes').nodes.push({
      id: 'idText',
      type: 'Text',
      catalogRef: 'Text',
      parameters: [],
      declaredPorts: [],
      portKnowledge: 'partial',
      parent: 'notesShell'
    } as never);
    wire(m, 'Pages/Notes', 'notesList', 'itemActionItemId', 'idText', 'text', 'value');
    expect(emitApp(m, catalog).notes.join('\n')).toContain('notesList:itemActionItemId->idText:text');
  });
});

// ---------------------------------------------------------------------------------------------
// The invariant the defect broke, asserted directly rather than case by case.
// ---------------------------------------------------------------------------------------------

describe('no signal on a repeater is lost without a note (§29)', () => {
  test.each([
    ['itemOutputSignal-removed', true],
    ['itemOutputSignal-ghost', false],
    ['itemsRendered', false],
    ['done', false],
    ['completed', false]
  ])('%s either emits a callback or files a note', (port, translates) => {
    const m = withClearArray(withRowOutput());
    wire(m, 'Pages/Notes', 'notesList', port as string, 'clearArr', 'clear');
    const result = emitApp(m, catalog);
    const emitted = rowJsx(m).includes('onRemoved');
    // The note names the port as the graph spells it, or — for a relay whose template declares
    // no such output — the row-side name with the prefix stripped, which is the name an author
    // reading their template would search for.
    const stripped = (port as string).replace('itemOutputSignal-', '');
    const reported = result.notes.some(
      (n) => n.includes('For Each notesList') && (n.includes(port as string) || n.includes(`"${stripped}"`))
    );
    expect(emitted).toBe(translates);
    // Exactly one of the two must be true: translated, or named. Never neither.
    expect(emitted || reported).toBe(true);
  });
});
