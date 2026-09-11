import * as fs from 'fs';
import * as path from 'path';

import { Catalog, CatalogIndex, loadCatalog } from '../src/catalog';
import { ComponentPlan, planProject, REPEATER_ITEM_TYPE } from '../src/analyze/plan';
import { emitApp } from '../src/emit/emitApp';
import { summarizePreflight } from '../src/emit/preflight';
import { exportBadgeOf, ledgerEntryOf } from '../src/ledger';
import { parseProject } from '../src/parse/parseProject';
import { typecheckEmittedApp } from './helpers/typecheckApp';
import { ComponentIR, ConnectionIR, ExportIR, NodeIR, ParamValue } from '../src/ir/types';

/**
 * EXP-011 §57 — `Repeater Item` (type id `For Each Actions`), Tier 2.8 row 7: the row's own id, read from inside
 * the template, and the one pulse a row can hear.
 *
 * Built on `tests/fixtures/roster-desk`: a Static Data of three people (string ids) repeated by a For Each into
 * PersonRow, whose Repeater Item feeds a Text with Item Id and, on Added, writes Item Id into the `lastAdded`
 * Variable; the row's Remove button rides §29's relay into a Set Variable on the page. The reverted arm
 * (`probe-reverted.log`) read 2 refusals in PersonRow (the node with the old sentence, the Set Variable unfired)
 * and three wires dropped; built, the fixture translates whole.
 *
 * The design is the Object-in-repeater seam (EXP-002-MODEL2-TARGET-OUTPUT §4): Item Id is a row prop typed
 * `string` on the template side and bound from `item.id` by every host, each feed gated on its own rows. Every
 * refusal lives here by mutation and asserts the NAMED sentence.
 */

const FIXTURE = path.join(__dirname, 'fixtures', 'roster-desk');
const catalog: Catalog = loadCatalog();
const index = new CatalogIndex(catalog);
const baseIr = parseProject(FIXTURE, catalog);
const app = emitApp(baseIr, catalog);
const project = planProject(baseIr, index);

const HOME = 'Pages/Home';
const ROW = 'Components/PersonRow';
const HOME_FILE = 'src/pages/Home.tsx';
const ROW_FILE = 'src/components/PersonRow.tsx';

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
const notesOf = (source: ExportIR): string => emitApp(source, catalog).notes.join('\n');
const reasonOf = (source: ExportIR, componentPath: string, nodeId: string): string => {
  const d = planOf(source, componentPath).dispositions[nodeId];
  return d?.kind === 'deferred' ? d.reason : `(${d?.kind})`;
};
const rowFile = (a: { files: Record<string, string> }): string => a.files[ROW_FILE];
const homeFile = (a: { files: Record<string, string> }): string => a.files[HOME_FILE];
const rowItem = (ir: ExportIR) => nodeOf(ir, ROW, 'rowItem');

/** A Static Data's rows, replaced wholesale — the `json` port is a code editor, so the param is a script. */
const setPeople = (ir: ExportIR, rows: unknown[]) => setParam(nodeOf(ir, HOME, 'peopleData'), 'json', { kind: 'script', source: JSON.stringify(rows) });

describe('§A the fixture, whole', () => {
  test('nothing refuses, both components translate, and the emitted app typechecks against the real library', () => {
    const pre = summarizePreflight(app);
    expect(pre.refusals).toBe(0);
    expect(pre.whole).toEqual([ROW, HOME]);
    expect(pre.verdict).toBeNull();
    expect(app.notes.filter((n) => n.includes('rowItem') || n.includes('setLastAdded') || n.includes('Repeater Item'))).toEqual([]);
    expect(typecheckEmittedApp(app)).toEqual([]);
  });

  test('the template declares Item Id as a string prop and renders it where the Text sat', () => {
    const row = rowFile(app);
    expect(row).toContain('export interface PersonRowProps {\n  name?: string;\n  itemId?: string;\n  onRemoved?: () => void;\n}');
    expect(row).toContain('export function PersonRow({ name, itemId, onRemoved }: PersonRowProps)');
    expect(row).toContain('<p className={styles.idText}>{itemId}</p>');
  });

  test('Added is a once-on-mount effect, guarded against StrictMode, running the row’s chain', () => {
    const row = rowFile(app);
    expect(row).toContain("import { useEffect, useRef } from 'react';");
    expect(row).toContain('  const added = useRef(false);\n  useEffect(() => {\n    if (added.current) return;\n    added.current = true;\n    lastAdded.set(itemId);\n');
    expect(row).toContain("// eslint-disable-next-line react-hooks/exhaustive-deps -- once, like the row's own Added pulse\n  }, []);");
    expect(row).toContain('// Repeater Item "This row": its Added chain runs once, on mount — signalAdded fires once per row, right after the repeater creates it (foreach.tsx).');
    expect(row.match(/useRef\(false\)/g)).toHaveLength(1);
  });

  test('the host binds Item Id from the row’s own id, typed off the list, beside the relayed Remove', () => {
    const home = homeFile(app);
    expect(home).toContain('{PEOPLE.map((item) => (\n        <PersonRow\n          key={item.id}\n          name={item.name}\n          itemId={item.id}\n          onRemoved={() => lastAction.set(\'Removed a person.\')}\n        />\n      ))}');
    expect(home).toContain('type People = {\n  id: string;\n  name: string;\n};');
  });

  test('the plan: a row prop marked as the Repeater Item’s, the node collapsed, its Added sink collapsed into it', () => {
    const plan = project.plans.find((p) => p.path === ROW)!;
    expect(plan.rowProps).toEqual([{ prop: 'itemId', field: 'id', repeaterItem: 'rowItem' }]);
    expect(plan.props).toEqual([{ name: 'name', tsType: 'string' }, { name: 'itemId', tsType: 'string' }]);
    expect(plan.dispositions.rowItem).toEqual({ kind: 'collapsed', into: 'rowGroup' });
    expect(plan.dispositions.setLastAdded).toEqual({ kind: 'collapsed', into: 'rowItem' });
    expect(plan.repeaterItems.map((r) => [r.nodeId, r.label, r.actions.length])).toEqual([['rowItem', 'This row', 1]]);
  });

  test('the ledger row is translated and the picker badge is gone', () => {
    expect(ledgerEntryOf(REPEATER_ITEM_TYPE)?.status).toBe('translated');
    expect(exportBadgeOf(REPEATER_ITEM_TYPE)).toBeUndefined();
    expect(REPEATER_ITEM_TYPE).toBe('For Each Actions');
  });
});

describe('§B the node refused whole, by name', () => {
  test('no For Each names the component — the runtime’s no-item-in-scope, and the nested case named', () => {
    const ir = cloneIr();
    setParam(nodeOf(ir, HOME, 'peopleList'), 'template', { kind: 'literal', value: '/Components/Elsewhere' });
    const reason = reasonOf(ir, ROW, 'rowItem');
    expect(reason).toBe(
      'Repeater Item rowItem: no For Each names /Components/PersonRow as its template, so there is no repeater row: Item Id reads undefined and Added never fires (the runtime reports "repeater-item/no-item-in-scope" once). A Repeater Item nested one component below the template walks up in the runtime; this slice reads only a template\'s own'
    );
    expect(planOf(ir, ROW).props.map((p) => p.name)).toEqual(['name']);
    expect(rowFile(emitApp(ir, catalog))).not.toContain('itemId?:');
  });

  test('a dynamic-template For Each is not a host either', () => {
    const ir = cloneIr();
    setParam(nodeOf(ir, HOME, 'peopleList'), 'templateType', { kind: 'literal', value: 'dynamic' });
    expect(reasonOf(ir, ROW, 'rowItem')).toContain('no For Each names /Components/PersonRow as its template');
  });

  test('a Run Tasks names it — the item is a task input, not a rendered row', () => {
    const ir = cloneIr();
    addNode(componentOf(ir, HOME), { id: 'sendAll', type: 'RunTasks', parameters: [{ name: 'taskTemplate', value: { kind: 'literal', value: '/Components/PersonRow' } }] });
    expect(reasonOf(ir, ROW, 'rowItem')).toBe(
      'Repeater Item rowItem: /Components/PersonRow is named as a Run Tasks template by Pages/Home › sendAll, where the item is a task input rather than a rendered row (runtasks.ts sets _forEachModel too) — this slice translates the For Each row only'
    );
  });

  test('Try Remove connected — a hold the emitted row cannot offer', () => {
    const ir = cloneIr();
    addNode(componentOf(ir, ROW), { id: 'exitVar', type: 'Set Variable', parameters: [{ name: 'name', value: { kind: 'literal', value: 'exiting' } }] });
    connect(componentOf(ir, ROW), 'rowItem', 'tryRemove', 'exitVar', 'do');
    expect(reasonOf(ir, ROW, 'rowItem')).toBe(
      "Repeater Item rowItem: its Try Remove is connected, which holds the repeater's teardown of this row until Remove Completed is pulsed — the emitted row unmounts the moment its item leaves the list and has no hold to offer"
    );
    expect(rowFile(emitApp(ir, catalog))).not.toContain('itemId?:');
  });

  test('Remove Completed wired — the handshake has no counterpart', () => {
    const ir = cloneIr();
    connect(componentOf(ir, ROW), 'removeButton', 'onClick', 'rowItem', 'removeCompleted');
    expect(reasonOf(ir, ROW, 'rowItem')).toBe(
      'Repeater Item rowItem: its Remove Completed is wired: the exit handshake it completes has no counterpart in the emitted row, which unmounts the moment its item leaves the list'
    );
  });

  test.each(['done', 'completed', 'unchanged'])('the "%s" outcome consumed — it reports the handshake this slice does not translate', (port) => {
    const ir = cloneIr();
    addNode(componentOf(ir, ROW), { id: 'afterVar', type: 'Set Variable', parameters: [{ name: 'name', value: { kind: 'literal', value: 'after' } }] });
    connect(componentOf(ir, ROW), 'rowItem', port, 'afterVar', 'do');
    expect(reasonOf(ir, ROW, 'rowItem')).toBe(
      `Repeater Item rowItem: its "${port}" output is consumed, and it reports the exit handshake this slice does not translate (Done when a held removal is released, Unchanged when none was waiting, Completed either way)`
    );
  });

  test('the refusal cascades by name: the Text’s wire and the Added chain’s sink both say why', () => {
    const ir = cloneIr();
    connect(componentOf(ir, ROW), 'removeButton', 'onClick', 'rowItem', 'removeCompleted');
    const notes = notesOf(ir);
    expect(notes).toContain('wire rowItem:itemId->idText:text');
    expect(notes).toContain('its Remove Completed is wired');
    expect(reasonOf(ir, ROW, 'setLastAdded')).not.toBe('(collapsed)');
  });

  test('in a component with no visual root the fallback names that instead', () => {
    const ir = cloneIr();
    const row = componentOf(ir, ROW);
    row.nodes = row.nodes.filter((n) => n.id === 'rowItem');
    row.connections = [];
    expect(reasonOf(ir, ROW, 'rowItem')).toBe('it sits in a component with no visual root, which no For Each can repeat as a template — there is no row for it to read');
  });
});

describe('§C the host’s feed decides whether Item Id can be supplied — named by node and port', () => {
  const dropSentence = (feed: string) =>
    `Pages/Home: For Each peopleList repeats /Components/PersonRow, whose Repeater Item rowItem reads Item Id, but ${feed} — the row's "itemId" stays undefined — dropped, reported`;

  test('static rows without a unique id: the runtime mints a guid the app does not', () => {
    const ir = cloneIr();
    setPeople(ir, [{ name: 'Ada' }, { name: 'Grace' }]);
    const a = emitApp(ir, catalog);
    expect(a.notes).toContain(dropSentence('the authored rows carry no unique "id" — the runtime mints a guid per row there, which the exported app does not'));
    expect(homeFile(a)).not.toContain('itemId=');
    expect(homeFile(a)).toContain('key={index}');
    expect(rowFile(a)).toContain('itemId?: string;');
    expect(typecheckEmittedApp(a)).toEqual([]);
  });

  test('static rows whose id is a number: the port is a string, and the export will not claim otherwise', () => {
    const ir = cloneIr();
    setPeople(ir, [{ id: 1, name: 'Ada' }, { id: 2, name: 'Grace' }]);
    const a = emitApp(ir, catalog);
    expect(a.notes).toContain(dropSentence('the authored rows\' "id" is typed number, which the runtime hands through the string-typed Item Id unchanged — a type the exported row will not claim'));
    expect(homeFile(a)).toContain('key={item.id}');
    expect(homeFile(a)).not.toContain('itemId=');
    expect(typecheckEmittedApp(a)).toEqual([]);
  });

  test('a duplicate id is no id: the key rule and Item Id agree', () => {
    const ir = cloneIr();
    setPeople(ir, [{ id: 'p1', name: 'Ada' }, { id: 'p1', name: 'Grace' }]);
    expect(notesOf(ir)).toContain('the authored rows carry no unique "id"');
  });

  test('the drop reaches the report under the page, naming the node and the port', () => {
    const ir = cloneIr();
    setPeople(ir, [{ name: 'Ada' }]);
    const a = emitApp(ir, catalog);
    const report = a.files['EXPORT-REPORT.md'];
    expect(report).toContain('### `Pages/Home`');
    expect(report).toContain('whose Repeater Item rowItem reads Item Id, but the authored rows carry no unique "id"');
    expect(summarizePreflight(a).refusals).toBe(1);
  });

  test('a named array whose inserters write no id: a guid per row in the runtime, undefined here', () => {
    const noteDesk = parseProject(path.join(__dirname, 'fixtures', 'note-desk'), catalog);
    const ir = structuredClone(noteDesk);
    const noteRow = componentOf(ir, 'Components/NoteRow');
    addNode(noteRow, { id: 'rowItem', type: REPEATER_ITEM_TYPE });
    addNode(noteRow, { id: 'idText', type: 'Text', parent: 'rowGroup' });
    nodeOf(ir, 'Components/NoteRow', 'rowGroup').children!.push('idText');
    connect(noteRow, 'rowItem', 'itemId', 'idText', 'text', 'value');
    const a = emitApp(ir, catalog);
    expect(a.notes).toContain(
      `Pages/Home: For Each noteList repeats /Components/NoteRow, whose Repeater Item rowItem reads Item Id, but the rows of the array "notes" are inserted without a string "id" — the runtime mints a guid per row there, which the exported app does not — the row's "itemId" stays undefined — dropped, reported`
    );
    expect(a.files['src/pages/Home.tsx']).not.toContain('itemId=');
    expect(a.files['src/components/NoteRow.tsx']).toContain('<p className={styles.idText}>{itemId}</p>');
    expect(typecheckEmittedApp(a)).toEqual([]);
  });

  test('a query feed always has the record’s own id; a Filter Records over it keeps it', () => {
    const searchDesk = parseProject(path.join(__dirname, 'fixtures', 'search-desk'), catalog);
    const withItem = (): ExportIR => {
      const ir = structuredClone(searchDesk);
      const contactRow = componentOf(ir, 'Components/ContactRow');
      addNode(contactRow, { id: 'rowItem', type: REPEATER_ITEM_TYPE });
      addNode(contactRow, { id: 'idText', type: 'Text', parent: 'rowGroup' });
      nodeOf(ir, 'Components/ContactRow', 'rowGroup').children!.push('idText');
      connect(contactRow, 'rowItem', 'itemId', 'idText', 'text', 'value');
      return ir;
    };
    const filtered = emitApp(withItem(), catalog);
    expect(filtered.files['src/pages/Home.tsx']).toContain('itemId={item.id}');
    expect(filtered.notes.filter((n) => n.includes('Repeater Item'))).toEqual([]);
    expect(typecheckEmittedApp(filtered)).toEqual([]);

    const direct = withItem();
    disconnect(componentOf(direct, 'Pages/Home'), (c) => c.fromId === 'filter' || c.toId === 'filter');
    connect(componentOf(direct, 'Pages/Home'), 'query', 'items', 'contactList', 'items', 'value');
    const plain = emitApp(direct, catalog);
    expect(plain.files['src/pages/Home.tsx']).toMatch(/itemId=\{\w+\.id\}/);
    expect(plain.notes.filter((n) => n.includes('Repeater Item'))).toEqual([]);
    expect(typecheckEmittedApp(plain)).toEqual([]);
  });

  test('two hosts: the prop is typed once, and each feed answers for itself', () => {
    const ir = cloneIr();
    const home = componentOf(ir, HOME);
    addNode(home, { id: 'guestData', type: 'Static Data', authoredLabel: 'Guests', parameters: [{ name: 'type', value: { kind: 'literal', value: 'json' } }, { name: 'json', value: { kind: 'script', source: JSON.stringify([{ name: 'Nobody' }]) } }] });
    addNode(home, { id: 'guestList', type: 'For Each', parent: 'shell', parameters: [{ name: 'template', value: { kind: 'literal', value: '/Components/PersonRow' } }] });
    nodeOf(ir, HOME, 'shell').children!.push('guestList');
    connect(home, 'guestData', 'items', 'guestList', 'items', 'value');
    const a = emitApp(ir, catalog);
    const page = homeFile(a);
    expect(page).toContain('itemId={item.id}');
    expect(page).toContain('{GUESTS.map((item, index) => (\n        <PersonRow key={index} name={item.name} />\n      ))}');
    expect(a.notes).toContain(
      `Pages/Home: For Each guestList repeats /Components/PersonRow, whose Repeater Item rowItem reads Item Id, but the authored rows carry no unique "id" — the runtime mints a guid per row there, which the exported app does not — the row's "itemId" stays undefined — dropped, reported`
    );
    expect(rowFile(a).match(/itemId\?: string;/g)).toHaveLength(1);
    expect(typecheckEmittedApp(a)).toEqual([]);
  });

  test('a template that already declares an itemId input: the minted prop steps aside, and the host binds the minted name', () => {
    const ir = cloneIr();
    const inputs = nodeOf(ir, ROW, 'rowInputs');
    inputs.declaredPorts.push({ name: 'itemId', plug: 'output', type: 'string', kind: 'value' } as NodeIR['declaredPorts'][number]);
    const a = emitApp(ir, catalog);
    expect(planOf(ir, ROW).rowProps).toEqual([{ prop: 'itemId2', field: 'id', repeaterItem: 'rowItem' }]);
    expect(rowFile(a)).toContain('itemId2?: string;');
    expect(rowFile(a)).toContain('<p className={styles.idText}>{itemId2}</p>');
    expect(homeFile(a)).toContain('itemId2={item.id}');
    expect(typecheckEmittedApp(a)).toEqual([]);
  });
});

describe('§D the Added chain', () => {
  test('nothing reads Item Id and nothing hears Added: the node collapses, declares nothing, prints nothing', () => {
    const ir = cloneIr();
    disconnect(componentOf(ir, ROW), (c) => c.fromId === 'rowItem');
    const a = emitApp(ir, catalog);
    expect(planOf(ir, ROW).dispositions.rowItem).toEqual({ kind: 'collapsed', into: 'rowGroup' });
    expect(planOf(ir, ROW).rowProps).toEqual([]);
    expect(rowFile(a)).not.toContain('itemId');
    expect(rowFile(a)).not.toContain('useRef');
    expect(homeFile(a)).not.toContain('itemId=');
  });

  test('Added alone, with no Item Id read: the effect prints and no prop is declared', () => {
    const ir = cloneIr();
    disconnect(componentOf(ir, ROW), (c) => c.fromId === 'rowItem' && c.fromProperty === 'itemId');
    addNode(componentOf(ir, ROW), { id: 'seen', type: 'String', parameters: [{ name: 'value', value: { kind: 'literal', value: 'a row' } }] });
    connect(componentOf(ir, ROW), 'seen', 'savedValue', 'setLastAdded', 'value', 'value');
    const a = emitApp(ir, catalog);
    expect(rowFile(a)).toContain("lastAdded.set('a row');");
    expect(rowFile(a)).not.toContain('itemId');
    expect(planOf(ir, ROW).rowProps).toEqual([]);
    expect(typecheckEmittedApp(a)).toEqual([]);
  });

  test('a chain that does not translate is named on the node and the port, and Item Id still reads', () => {
    const ir = cloneIr();
    const row = componentOf(ir, ROW);
    addNode(row, { id: 'go', type: 'Navigate' });
    disconnect(row, (c) => c.toId === 'setLastAdded');
    connect(row, 'rowItem', 'added', 'go', 'navigate');
    const a = emitApp(ir, catalog);
    const note = a.notes.find((n) => n.includes('Repeater Item rowItem: its Added chain did not translate — '));
    expect(note).toBeDefined();
    expect(note).toMatch(/; its Item Id, if read, still does$/);
    expect(rowFile(a)).not.toContain('useRef');
    expect(rowFile(a)).toContain('<p className={styles.idText}>{itemId}</p>');
    expect(planOf(ir, ROW).dispositions.rowItem).toEqual({ kind: 'collapsed', into: 'rowGroup' });
    expect(planOf(ir, ROW).repeaterItems).toEqual([]);
  });

  test('🔴 a text input’s live text in the Added chain is NOT handler-only: it is the input’s state, read as \'\' on mount — the runtime’s answer too', () => {
    const ir = cloneIr();
    const row = componentOf(ir, ROW);
    addNode(row, { id: 'draft', type: 'net.noodl.controls.textinput', parent: 'rowGroup' });
    nodeOf(ir, ROW, 'rowGroup').children!.push('draft');
    disconnect(row, (c) => c.toId === 'setLastAdded' && c.toProperty === 'value');
    connect(row, 'draft', 'onTextChanged', 'setLastAdded', 'value', 'value');
    const a = emitApp(ir, catalog);
    expect(rowFile(a)).toContain("const [text, setText] = useState<string>('');");
    expect(rowFile(a)).toContain('    added.current = true;\n    lastAdded.set(text);');
    expect(a.notes.filter((n) => n.includes('Repeater Item'))).toEqual([]);
    expect(typecheckEmittedApp(a)).toEqual([]);
  });

  test('the chain’s sink earns its import in the walkers, not in the body — the import block prints first', () => {
    expect(rowFile(app).indexOf("import { lastAdded } from '../stores/variables';")).toBeLessThan(rowFile(app).indexOf('lastAdded.set(itemId)'));
  });
});
