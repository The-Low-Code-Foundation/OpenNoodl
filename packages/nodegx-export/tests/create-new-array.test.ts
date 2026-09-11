import * as fs from 'fs';
import * as path from 'path';

import * as ts from 'typescript';

import { Catalog, CatalogIndex, loadCatalog } from '../src/catalog';
import { ComponentPlan, planProject } from '../src/analyze/plan';
import { arrayTargetOf } from '../src/analyze/appState';
import { emitApp } from '../src/emit/emitApp';
import { summarizePreflight } from '../src/emit/preflight';
import { exportBadgeOf, ledgerEntryOf } from '../src/ledger';
import { parseProject } from '../src/parse/parseProject';
import { typecheckEmittedApp } from './helpers/typecheckApp';
import { ComponentIR, ConnectionIR, ExportIR, NodeIR, ParamValue } from '../src/ir/types';

/**
 * EXP-011 §55 — `Create New Array` (type id `CollectionNew`), Tier 2.8 row 5: the handle is the id.
 *
 * Built on `tests/fixtures/snap-desk`: a named `notes` array with the Cheer insert chain and §30's
 * Remove-by-row; a `Snapshot` button minting a copy of `notes`; an `Array` bound to the mint BY WIRE
 * feeding a second repeater; an insert chain, a Clear (both outcomes) and the row's Remove all bound by
 * wire. Every refused shape lives here by mutation (§52.4.2's rule: the corpus control forbids a refused
 * node in a fixture), and each refusal asserts the NAMED sentence.
 *
 * 🔴 §55.2's finding is a row here (§E): before this build the one untranslated node silenced the NAMED
 * list — `notesArray.items` also fed the mint's Items, and the Array node's stray-wire gate read that as
 * "drives logic this slice does not translate". The named side must survive beside the mint.
 */

const FIXTURE = path.join(__dirname, 'fixtures', 'snap-desk');
const catalog: Catalog = loadCatalog();
const index = new CatalogIndex(catalog);
const baseIr = parseProject(FIXTURE, catalog);
const app = emitApp(baseIr, catalog);
const project = planProject(baseIr, index);

const HOME = 'Pages/Home';
const HOME_FILE = 'src/pages/Home.tsx';

const cloneIr = (): ExportIR => structuredClone(baseIr);
const componentOf = (source: ExportIR, componentPath: string): ComponentIR => source.components.find((c) => c.path === componentPath)!;
const nodeOf = (source: ExportIR, componentPath: string, id: string): NodeIR => componentOf(source, componentPath).nodes.find((n) => n.id === id)!;
const planOf = (source: ExportIR, componentPath: string): ComponentPlan => planProject(source, index).plans.find((p) => p.path === componentPath)!;
const setParam = (node: NodeIR, name: string, value: ParamValue) => {
  const existing = node.parameters.find((p) => p.name === name);
  if (existing) existing.value = value;
  else {
    node.parameters.push({ name, value });
    node.parameters.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  }
};
const connect = (component: ComponentIR, fromId: string, fromProperty: string, toId: string, toProperty: string, kind: ConnectionIR['kind'] = 'signal') => {
  component.connections.push({ key: `${fromId}:${fromProperty}->${toId}:${toProperty}`, fromId, fromProperty, toId, toProperty, kind });
};
const disconnect = (component: ComponentIR, predicate: (c: ConnectionIR) => boolean) => {
  component.connections = component.connections.filter((c) => !predicate(c));
};
const addNode = (component: ComponentIR, node: Partial<NodeIR> & { id: string; type: string }): NodeIR => {
  const full: NodeIR = { catalogRef: node.type, parameters: [], declaredPorts: [], portKnowledge: 'complete', ...node } as NodeIR;
  component.nodes.push(full);
  return full;
};
/** A button in the shell, wired into `toId.toProperty`. */
const addButton = (ir: ExportIR, id: string, label: string, toId: string, toProperty: string) => {
  const home = componentOf(ir, HOME);
  const shell = home.nodes.find((n) => n.id === 'shell')!;
  addNode(home, { id, type: 'net.noodl.controls.button', authoredLabel: label, parent: 'shell', parameters: [{ name: 'label', value: { kind: 'literal', value: label } }] });
  shell.children = [...(shell.children ?? []), id];
  connect(home, id, 'onClick', toId, toProperty);
};
const refusalOf = (source: ExportIR, componentPath: string, id: string) =>
  emitApp(source, catalog).report.components.find((c) => c.path === componentPath)?.refusals?.find((r) => r.nodeId === id);
const reasonOf = (source: ExportIR, id: string): string | undefined => {
  const d = planOf(source, HOME).dispositions[id];
  return d !== undefined && d.kind === 'deferred' ? d.reason : undefined;
};
const notesOf = (source: ExportIR): string => emitApp(source, catalog).notes.join('\n');
const home = (a: { files: Record<string, string> }): string => a.files[HOME_FILE];
const indexOf = (haystack: string, needle: string): number => {
  const at = haystack.indexOf(needle);
  expect(at).toBeGreaterThanOrEqual(0);
  return at;
};

const MINT_LINE = 'const snapshotNew = collection<any>([...notes.peek()]);';
const ROW_LINE = 'const [snapshot, setSnapshot] = useState<Collection<any> | null>(null);';
const HOOK_LINE = 'const snapshotItems = useCollection(snapshot ?? noArray);';
const NO_ARRAY_LINE = 'const noArray = collection<any>([]);';
const INSERT_RAISE =
  "raiseAppError({ code: 'insert-into-array/no-array', message: 'Nothing to insert — no array is bound. Set the Array Id input, or connect one, before triggering this node.', nodeId: 'insertSnap', nodeType: 'CollectionInsert', componentName: '/Pages/Home' });";
const CLEAR_RAISE =
  "raiseAppError({ code: 'clear-array/no-array', message: 'Nothing to clear — no array is bound. Set the Array Id input, or connect one, before triggering this node.', nodeId: 'clearSnap', nodeType: 'CollectionClear', componentName: '/Pages/Home' });";

// ---------------------------------------------------------------------------------------------------
describe('§A the fixture, whole — the mint, the handle row, the bound Array, three mutators by wire', () => {
  const homePlan = project.plans.find((p) => p.path === HOME)!;

  test('A1 nothing refused: every node has a rule, the only note is the router shell, 17 files', () => {
    expect(app.notes).toEqual(['App: router shell — emitted as src/App.tsx by the scaffold']);
    expect(homePlan.refusals).toEqual([]);
    expect(summarizePreflight(app).refusals).toBe(0);
    expect(summarizePreflight(app).whole).toEqual(['Components/Row', 'Pages/Home']);
    expect(Object.keys(app.files)).toHaveLength(17);
    expect(home(app)).not.toContain('TODO(export)');
  });

  test('A2 the emitted app typechecks as a real program', () => {
    expect(typecheckEmittedApp(app)).toEqual([]);
  });

  test('A3 every emitted file parses', () => {
    for (const [name, source] of Object.entries(app.files)) {
      if (!/\.(ts|tsx)$/.test(name)) continue;
      const parsed = ts.createSourceFile(name, source, ts.ScriptTarget.ES2022, true, name.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
      const diagnostics = (parsed as unknown as { parseDiagnostics: ts.Diagnostic[] }).parseDiagnostics;
      expect(diagnostics.map((d) => `${name}: ${d.messageText}`)).toEqual([]);
    }
  });

  test('A4 the mint: a copy of the source, the row set, then the Done chain — in that order', () => {
    const src = home(app);
    const mint = indexOf(src, MINT_LINE);
    const set = indexOf(src, 'setSnapshot(snapshotNew);');
    const done = indexOf(src, "status.set('snapshot taken');");
    expect(mint).toBeLessThan(set);
    expect(set).toBeLessThan(done);
    // One mint call: every Do mints another array, and nothing else calls the constructor in a handler.
    expect(src.match(/collection<any>\(\[\.\.\./g)).toHaveLength(1);
  });

  test('A5 the handle row boots null; the hook reads it AFTER the row, over the module-scope stand-in', () => {
    const src = home(app);
    const standIn = indexOf(src, NO_ARRAY_LINE);
    const fn = indexOf(src, 'export function HomePage()');
    const row = indexOf(src, ROW_LINE);
    const hook = indexOf(src, HOOK_LINE);
    expect(standIn).toBeLessThan(fn);
    expect(row).toBeLessThan(hook);
    expect(src).toContain('// The array "Snapshot" minted: null until its Do fires, as the node\'s Id is empty until then; every Do mints another.');
    expect(homePlan.mintedArrays).toEqual([{ nodeId: 'mint', stateName: 'snapshot', rowType: 'any' }]);
    expect(homePlan.stateVars.find((v) => v.name === 'snapshot')).toMatchObject({ origin: 'array', originNodeId: 'mint', tsType: 'Collection<any> | null', bootCode: 'null' });
  });

  test('A6 the imports: the constructor and the type from core, the hook, the raise', () => {
    const src = home(app);
    expect(src).toContain("import { collection, type Collection } from '@nodegx/core';");
    expect(src).toContain("import { useCollection, useValue } from '@nodegx/core/react';");
    expect(src).toContain("import { raiseAppError } from '../lib/errors';");
    expect(app.files['src/lib/errors.ts']).toBeDefined();
  });

  test('A7 the bound Array feeds the second repeater through the hook local; the row callback removes through the handle', () => {
    const src = home(app);
    expect(src).toContain('{snapshotItems.map((item, index) => (');
    expect(src).toContain('<Row key={index} text={item.text} onRemoved={() => snapshot?.remove(item)} />');
    // Not `(snapshotItems ?? [])` — the hook local is an array by construction.
    expect(src).not.toContain('snapshotItems ??');
  });

  test('A8 insert by wire: the guard, the raise with the node\'s own code and message, else the add', () => {
    const src = home(app);
    const guard = indexOf(src, 'if (snapshot === null) {');
    const raise = indexOf(src, INSERT_RAISE);
    const add = indexOf(src, "snapshot.add({ text: draft.get() });");
    expect(guard).toBeLessThan(raise);
    expect(raise).toBeLessThan(add);
    expect(src.slice(raise, add)).toContain('} else {');
  });

  test('A9 clear by wire: the raise then the Failure chain in the guard; the runtime\'s own fork in the else', () => {
    const src = home(app);
    const raise = indexOf(src, CLEAR_RAISE);
    const noSnap = indexOf(src, "status.set('no snapshot yet');");
    const fork = indexOf(src, "} else if (snapshot.peek().length > 0) { snapshot.clear(); status.set('snapshot cleared'); }");
    expect(raise).toBeLessThan(noSnap);
    expect(noSnap).toBeLessThan(fork);
    // The named model's dead-wire note does not apply: bound by wire, Failure is live.
    expect(app.notes.join('\n')).not.toContain("Clear Array's Failure fires only when no array is bound");
  });

  test('A10 the named side survives beside the mint (§55.2): the list, the insert and §30\'s Remove', () => {
    const src = home(app);
    expect(src).toContain("onClick={() => notes.add({ text: draft.get() })}");
    expect(src).toContain('{notesItems.map((item, index) => (');
    expect(src).toContain('<Row key={index} text={item.text} onRemoved={() => notes.remove(item)} />');
    // Collapsed into whichever handler read it first (the mint's), never deferred.
    expect(homePlan.dispositions.notesArray).toMatchObject({ kind: 'collapsed' });
    expect(homePlan.dispositions.removeNote).toEqual({ kind: 'collapsed', into: 'notesList' });
    expect(homePlan.repeaters.notesList.itemsCollectionName).toBe('notes');
  });

  test('A11 the dispositions: everything bound to the mint collapses into what fires it', () => {
    const d = homePlan.dispositions;
    expect(d.mint).toEqual({ kind: 'collapsed', into: 'snapBtn' });
    expect(d.setTaken).toEqual({ kind: 'collapsed', into: 'snapBtn' });
    expect(d.snapArray).toEqual({ kind: 'collapsed', into: HOME_FILE });
    expect(d.makeSnapNote).toEqual({ kind: 'collapsed', into: 'addSnapBtn' });
    expect(d.insertSnap).toEqual({ kind: 'collapsed', into: 'addSnapBtn' });
    expect(d.clearSnap).toEqual({ kind: 'collapsed', into: 'clearBtn' });
    expect(d.setCleared).toEqual({ kind: 'collapsed', into: 'clearBtn' });
    expect(d.setNoSnap).toEqual({ kind: 'collapsed', into: 'clearBtn' });
    expect(d.removeSnap).toEqual({ kind: 'collapsed', into: 'snapList' });
    expect(homePlan.repeaters.snapList.itemsExpr).toEqual({ kind: 'minted-array-get', nodeId: 'mint' });
    expect(homePlan.repeaters.snapList.itemsCollectionName).toBeNull();
  });

  test('A12 emission is deterministic: two runs are byte-identical', () => {
    expect(emitApp(cloneIr(), catalog).files).toEqual(app.files);
  });

  test('A13 the ledger: translated, no badge, the floor moved', () => {
    expect(ledgerEntryOf('CollectionNew')).toMatchObject({ status: 'translated' });
    expect((ledgerEntryOf('CollectionNew') as { note?: string } | undefined)?.note).toMatch(/^EXP-011 §55/);
    expect(exportBadgeOf('CollectionNew')).toBeUndefined();
  });

  test('A14 arrayTargetOf answers the same for every consumer: three minted, two named', () => {
    const component = componentOf(baseIr, HOME);
    const target = (id: string) => arrayTargetOf(nodeOf(baseIr, HOME, id), component);
    expect(target('snapArray')).toEqual({ kind: 'minted', nodeId: 'mint', wireKey: 'mint:id->snapArray:collectionId' });
    expect(target('insertSnap')).toEqual({ kind: 'minted', nodeId: 'mint', wireKey: 'mint:id->insertSnap:collectionId' });
    expect(target('clearSnap')).toEqual({ kind: 'minted', nodeId: 'mint', wireKey: 'mint:id->clearSnap:collectionId' });
    expect(target('removeSnap')).toEqual({ kind: 'minted', nodeId: 'mint', wireKey: 'mint:id->removeSnap:collectionId' });
    expect(target('notesArray')).toEqual({ kind: 'named', collectionName: 'notes' });
    expect(target('insertNote')).toEqual({ kind: 'named', collectionName: 'notes' });
  });
});

// ---------------------------------------------------------------------------------------------------
describe('§B the shapes — inside the chain, without a source, typed by a snapshot', () => {
  test('B1 a mutator inside the mint\'s own Done chain spells the chain-local, unguarded', () => {
    const ir = cloneIr();
    const h = componentOf(ir, HOME);
    // The button no longer fires the Clear; the mint's Done does.
    disconnect(h, (c) => c.fromId === 'clearBtn' && c.toId === 'clearSnap');
    connect(h, 'mint', 'done', 'clearSnap', 'clear');
    const src = home(emitApp(ir, catalog));
    expect(src).toContain("if (snapshotNew.peek().length > 0) { snapshotNew.clear(); status.set('snapshot cleared'); }");
    expect(src).not.toContain(CLEAR_RAISE);
    expect(planOf(ir, HOME).dispositions.clearSnap).toEqual({ kind: 'collapsed', into: 'snapBtn' });
    expect(typecheckEmittedApp(emitApp(ir, catalog))).toEqual([]);
  });

  test('B2 no Items wired: the literal is empty', () => {
    const ir = cloneIr();
    disconnect(componentOf(ir, HOME), (c) => c.toId === 'mint' && c.toProperty === 'items');
    const src = home(emitApp(ir, catalog));
    expect(src).toContain('const snapshotNew = collection<any>([]);');
    expect(src).not.toContain('[...notes.peek()]');
  });

  test('B3 a snapshot of a named array that nothing inserts into is typed by that array\'s interface', () => {
    const ir = cloneIr();
    const h = componentOf(ir, HOME);
    // Drop the insert chain into the snapshot; the mint keeps its source.
    disconnect(h, (c) => c.toId === 'insertSnap' || c.fromId === 'insertSnap' || c.toId === 'makeSnapNote' || c.fromId === 'makeSnapNote');
    h.nodes = h.nodes.filter((n) => n.id !== 'insertSnap' && n.id !== 'makeSnapNote');
    const shell = h.nodes.find((n) => n.id === 'shell')!;
    shell.children = shell.children!.filter((id) => id !== 'addSnapBtn');
    h.nodes = h.nodes.filter((n) => n.id !== 'addSnapBtn');
    const out = emitApp(ir, catalog);
    const src = home(out);
    expect(src).toContain('const [snapshot, setSnapshot] = useState<Collection<NotesItem> | null>(null);');
    expect(src).toContain('const snapshotNew = collection<NotesItem>([...notes.peek()]);');
    expect(src).toContain('const snapshotItems = useCollection<NotesItem>(snapshot ?? noArray);');
    expect(src).toContain("import { notes, type NotesItem } from '../collections/notes';");
    expect(planOf(ir, HOME).mintedArrays).toEqual([{ nodeId: 'mint', stateName: 'snapshot', rowType: 'NotesItem', rowCollection: 'notes' }]);
    expect(typecheckEmittedApp(out)).toEqual([]);
  });

  test('B4 a mint nothing fires: the row stays null, the bound Array reads empty, the app still typechecks', () => {
    const ir = cloneIr();
    disconnect(componentOf(ir, HOME), (c) => c.toId === 'mint' && c.toProperty === 'new');
    const out = emitApp(ir, catalog);
    expect(reasonOf(ir, 'mint')).toBe('nothing is wired to its Do, so no array is ever created');
    const src = home(out);
    expect(src).not.toContain('setSnapshot(');
    expect(src).toContain(HOOK_LINE);
    expect(src).toContain('{snapshotItems.map((item, index) => (');
    expect(typecheckEmittedApp(out)).toEqual([]);
  });

  test('B5 the insert\'s Failure chain rides the guard', () => {
    const ir = cloneIr();
    const h = componentOf(ir, HOME);
    addNode(h, { id: 'setNoSnap2', type: 'Set Variable', authoredLabel: 'Say no snapshot for insert', parameters: [{ name: 'name', value: { kind: 'literal', value: 'status' } }] });
    connect(h, 'insertSnap', 'failure', 'setNoSnap2', 'do');
    connect(h, 'noSnapStr', 'savedValue', 'setNoSnap2', 'value', 'value');
    const src = home(emitApp(ir, catalog));
    const raise = indexOf(src, INSERT_RAISE);
    const add = indexOf(src, "snapshot.add({ text: draft.get() });");
    expect(src.slice(raise, add)).toContain("status.set('no snapshot yet');");
  });
});

// ---------------------------------------------------------------------------------------------------
describe('§C refused by name — each sentence names the mistake', () => {
  test('C1 its Id consumed as a value', () => {
    const ir = cloneIr();
    const h = componentOf(ir, HOME);
    addNode(h, { id: 'keepId', type: 'Set Variable', authoredLabel: 'Keep id', parameters: [{ name: 'name', value: { kind: 'literal', value: 'lastId' } }] });
    connect(h, 'mint', 'id', 'keepId', 'value', 'value');
    connect(h, 'mint', 'done', 'keepId', 'do');
    expect(reasonOf(ir, 'mint')).toBe(
      "its Id is consumed as a value by Set Variable's value — the export keeps the minted array as a handle, not a string, and only an Array Id port can take it"
    );
  });

  test('C2 Completed consumed — one outcome, Unique Id\'s sentence', () => {
    const ir = cloneIr();
    const h = componentOf(ir, HOME);
    disconnect(h, (c) => c.fromId === 'mint' && c.fromProperty === 'done');
    connect(h, 'mint', 'completed', 'setTaken', 'do');
    expect(reasonOf(ir, 'mint')).toBe(
      'its Completed output is consumed — this node has only one outcome, so Completed and Done always fire together; wire the chain to Done instead and it translates unchanged'
    );
  });

  test('C3 two wires on Items', () => {
    const ir = cloneIr();
    const h = componentOf(ir, HOME);
    addNode(h, { id: 'otherArray', type: 'Collection2', authoredLabel: 'Other', parameters: [{ name: 'collectionId', value: { kind: 'literal', value: 'other' } }] });
    connect(h, 'otherArray', 'items', 'mint', 'items', 'value');
    expect(reasonOf(ir, 'mint')).toBe('two wires feed its Items input — last-writer-wins is not statically ordered');
  });

  test('C4 Items fed by something that is not a list', () => {
    const ir = cloneIr();
    const h = componentOf(ir, HOME);
    disconnect(h, (c) => c.toId === 'mint' && c.toProperty === 'items');
    connect(h, 'takenStr', 'savedValue', 'mint', 'items', 'value');
    expect(reasonOf(ir, 'mint')).toBe('its Items input is fed by a source not statically typed as a list (string)');
  });

  test('C5 an Array bound from anything but a mint\'s Id names its source', () => {
    const ir = cloneIr();
    const h = componentOf(ir, HOME);
    disconnect(h, (c) => c.toId === 'snapArray' && c.toProperty === 'collectionId');
    connect(h, 'takenStr', 'savedValue', 'snapArray', 'collectionId', 'value');
    expect(notesOf(ir)).toContain(
      "its Array Id is wired from String's savedValue — only a Create New Array's Id binds by wire; any other source is a runtime string this slice cannot resolve to an array"
    );
    expect(home(emitApp(ir, catalog))).not.toContain('snapshotItems.map');
  });

  test('C6 two mints into one Array Id', () => {
    const ir = cloneIr();
    const h = componentOf(ir, HOME);
    addNode(h, { id: 'mint2', type: 'CollectionNew', authoredLabel: 'Second snapshot' });
    addButton(ir, 'snapBtn2', 'Snapshot again', 'mint2', 'new');
    connect(h, 'mint2', 'id', 'snapArray', 'collectionId', 'value');
    expect(notesOf(ir)).toContain('two wires feed its Array Id — last-writer-wins is not statically ordered');
  });

  test('C7 Run On Value Change off on the bound Array', () => {
    const ir = cloneIr();
    setParam(nodeOf(ir, HOME, 'snapArray'), 'runOnChange-collectionId', { kind: 'literal', value: false });
    expect(notesOf(ir)).toContain("its Array Id's Run On Value Change is off — it would keep the previous array until a Fetch, which this slice does not translate");
  });

  test('C8 the bound Array with Fetch wired, and with Count consumed — the named model\'s parity', () => {
    const fetch = cloneIr();
    addButton(fetch, 'fetchBtn', 'Fetch', 'snapArray', 'fetch');
    expect(notesOf(fetch)).toContain('the array node has wired inputs (seeding or fetch) — not translated in this slice');
    const count = cloneIr();
    const h = componentOf(count, HOME);
    connect(h, 'snapArray', 'count', 'statusText', 'text', 'value');
    expect(notesOf(count)).toContain('its count output drives logic this slice does not translate');
  });

  test('C9 a Remove whose row comes from the OTHER list — gate 3 over targets, both described', () => {
    const ir = cloneIr();
    const h = componentOf(ir, HOME);
    disconnect(h, (c) => c.fromId === 'snapList' && c.toId === 'removeSnap');
    connect(h, 'notesList', 'itemActionItemId', 'removeSnap', 'modifyId', 'value');
    connect(h, 'notesList', 'itemOutputSignal-removed', 'removeSnap', 'remove');
    expect(reasonOf(ir, 'removeSnap')).toBe(
      'the repeater its Object Id comes from repeats "notes" while this node removes from the array "Snapshot" mints — the row it names is not a member of the array being written'
    );
  });

  test('C10 an insert into a minted array whose Done is consumed', () => {
    const ir = cloneIr();
    const h = componentOf(ir, HOME);
    connect(h, 'insertSnap', 'done', 'setTaken', 'do');
    expect(reasonOf(ir, 'makeSnapNote')).toBe("the insert's done output is consumed — into a minted array this slice translates the Failure chain only");
  });

  test('C11 a mutator fired both from the mint\'s Done and from a button', () => {
    const ir = cloneIr();
    connect(componentOf(ir, HOME), 'mint', 'done', 'clearSnap', 'clear');
    expect(reasonOf(ir, 'mint')).toBe(
      'its Do is fired both from the Create New Array\'s Done and from elsewhere — inside that chain the array is the one just made, outside it the handle, and one node cannot spell both; give it one trigger'
    );
  });

  test('C13 the mint owns its Done: a chain wire listed BEFORE the trigger wire is not "not a rendered element event" (§40\'s order rule)', () => {
    const ir = cloneIr();
    const h = componentOf(ir, HOME);
    const done = h.connections.find((c) => c.fromId === 'mint' && c.fromProperty === 'done')!;
    h.connections = [done, ...h.connections.filter((c) => c !== done)];
    expect(notesOf(ir)).not.toContain('the trigger is not a rendered element event or a receiver');
    expect(planOf(ir, HOME).dispositions.setTaken).toEqual({ kind: 'collapsed', into: 'snapBtn' });
  });

  test('C12 the chain-scoped read cannot re-enter: Do → Clear(bound) → Done → status, no "cyclic"', () => {
    const ir = cloneIr();
    const h = componentOf(ir, HOME);
    disconnect(h, (c) => c.fromId === 'clearBtn' && c.toId === 'clearSnap');
    connect(h, 'mint', 'done', 'clearSnap', 'clear');
    expect(notesOf(ir)).not.toContain('cyclic');
    expect(refusalOf(ir, HOME, 'mint')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------------------------------
describe('§D the batch shape — the catalog\'s own example: mint → Array → Run Tasks items', () => {
  const BATCH = path.join(__dirname, 'fixtures', 'batch-desk');
  const batchIr = parseProject(BATCH, catalog);
  const batchHome = (ir: ExportIR) => emitApp(ir, catalog).files['src/pages/Home.tsx'];

  test('D1 the host reads the minted list at the pulse; the app typechecks', () => {
    const ir = structuredClone(batchIr);
    const h = componentOf(ir, 'Pages/Home');
    disconnect(h, (c) => c.fromId === 'toGuests' && c.toId === 'sendAll');
    addNode(h, { id: 'batch', type: 'CollectionNew', authoredLabel: 'New batch array' });
    addNode(h, { id: 'batchArray', type: 'Collection2', authoredLabel: 'Batch array' });
    connect(h, 'toGuests', 'out-guests', 'batch', 'items', 'value');
    connect(h, 'batch', 'id', 'batchArray', 'collectionId', 'value');
    connect(h, 'batchArray', 'items', 'sendAll', 'items', 'value');
    const shell = h.nodes.find((n) => n.id === 'shell')!;
    addNode(h, { id: 'mintBtn', type: 'net.noodl.controls.button', authoredLabel: 'Prepare', parent: 'shell', parameters: [{ name: 'label', value: { kind: 'literal', value: 'Prepare' } }] });
    shell.children = [...(shell.children ?? []), 'mintBtn'];
    connect(h, 'mintBtn', 'onClick', 'batch', 'new');
    const out = emitApp(ir, catalog);
    const src = batchHome(ir);
    expect(planOf(ir, 'Pages/Home').refusals).toEqual([]);
    expect(src).toContain('(newBatchArray?.peek() ?? [])');
    // A Function's output has no static type: copied when it is an array, empty otherwise.
    expect(src).toContain('const newBatchArrayNew = collection<any>(Array.isArray(');
    expect(typecheckEmittedApp(out)).toEqual([]);
  });

  test('D2 the §55.2 control: a NAMED Array feeding Run Tasks items is a read, not a stray', () => {
    const ir = structuredClone(batchIr);
    const h = componentOf(ir, 'Pages/Home');
    disconnect(h, (c) => c.fromId === 'toGuests' && c.toId === 'sendAll');
    addNode(h, { id: 'guestsArray', type: 'Collection2', authoredLabel: 'Guests', parameters: [{ name: 'collectionId', value: { kind: 'literal', value: 'guests' } }] });
    connect(h, 'guestsArray', 'items', 'sendAll', 'items', 'value');
    expect(planOf(ir, 'Pages/Home').dispositions.guestsArray).toEqual({ kind: 'collapsed', into: 'runBtn' });
    expect(emitApp(ir, catalog).notes.join('\n')).not.toContain('drives logic this slice does not translate');
  });
});

// ---------------------------------------------------------------------------------------------------
describe('§E the reverted arm\'s finding, as a control: the one untranslated node must not silence the named list', () => {
  test('E1 the named list survives a Create New Array reading it (the stray-wire gate admits a list reader)', () => {
    // A mint that itself refuses (its Id consumed as a value) — the named array it snapshots must still translate.
    const ir = cloneIr();
    const h = componentOf(ir, HOME);
    addNode(h, { id: 'keepId', type: 'Set Variable', authoredLabel: 'Keep id', parameters: [{ name: 'name', value: { kind: 'literal', value: 'lastId' } }] });
    connect(h, 'mint', 'id', 'keepId', 'value', 'value');
    connect(h, 'mint', 'done', 'keepId', 'do');
    expect(reasonOf(ir, 'mint')).toMatch(/^its Id is consumed as a value/);
    const plan = planOf(ir, HOME);
    expect(plan.dispositions.notesArray).toEqual({ kind: 'collapsed', into: HOME_FILE });
    expect(plan.repeaters.notesList.itemsCollectionName).toBe('notes');
    expect(plan.dispositions.removeNote).toEqual({ kind: 'collapsed', into: 'notesList' });
  });
});
