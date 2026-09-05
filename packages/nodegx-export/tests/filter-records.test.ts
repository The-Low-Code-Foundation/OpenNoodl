import * as fs from 'fs';
import * as path from 'path';

import * as ts from 'typescript';

import { Catalog, CatalogIndex } from '../src/catalog';
import { ComponentPlan, planProject } from '../src/analyze/plan';
import { emitApp } from '../src/emit/emitApp';
import { summarizePreflight } from '../src/emit/preflight';
import { RECORD_FILTER_LIB_PATH, recordFilterLibSource } from '../src/emit/recordFilterLib';
import { exportBadgeOf, ledgerEntryOf } from '../src/ledger';
import { parseProject } from '../src/parse/parseProject';
import { typecheckEmittedApp } from './helpers/typecheckApp';
import { ComponentIR, ConnectionIR, ExportIR, NodeIR, ParamValue } from '../src/ir/types';

/**
 * EXP-011 §56 — `Filter Records` (type id `FilterDBModels`), Tier 2.8 row 6: the search box over a fetched list.
 *
 * Built on `tests/fixtures/search-desk`: a Query Records over `Contact` feeding a Filter Records whose saved filter is
 * `name containsIgnoreCase <fp-search>` AND `vip equalTo true`, sorted by name, limit 5; the search text arrives
 * through a Variable the input writes; Items feed a For Each of ContactRow; Count feeds a Text. Every refused shape
 * lives here by mutation (§52.4.2's rule) and asserts the NAMED sentence.
 *
 * 🔴 The reverted arm (`probe19-reverted.log`) read 5 refusals with the cascade: the Filter Records refused, the Query
 * Records "not consumed by a rendered repeater", the For Each unfed, the count wire dropped. §E pins the two findings
 * building it produced: a query read by a transform that is later refused must NOT keep a state row and a fetch
 * effect (E1), and a transform's Count is a binding, not a stray (E2).
 */

const FIXTURE = path.join(__dirname, 'fixtures', 'search-desk');
const CATALOG_PATH = path.join(__dirname, '..', '..', 'noodl-types', 'src', 'node-catalog.json');
const catalog: Catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
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
const notesOf = (source: ExportIR): string => emitApp(source, catalog).notes.join('\n');
const home = (a: { files: Record<string, string> }): string => a.files[HOME_FILE];
const filterNode = (ir: ExportIR) => nodeOf(ir, HOME, 'filter');
const filterOf = (ir: ExportIR, conditions: unknown[], type: 'and' | 'or' = 'and') =>
  setParam(filterNode(ir), 'visualFilter', { kind: 'json', value: { id: 'q', type, conditions } });

const WHERE = "{ and: [{ field: 'name', op: 'containsIgnoreCase', value: searchValue, connected: true }, { field: 'vip', op: 'equalTo', value: true }] }";
const CALL = `filterRecords(contacts, ${WHERE}, ['name'], { limit: 5 })`;

/** The emitted matcher, compiled and loaded — graded on rows, not on its text. */
const loadLib = (): { filterRecords: <T>(rows: readonly T[], where: unknown, sort?: string[], range?: { skip?: number; limit?: number }) => T[] } => {
  const js = ts.transpileModule(recordFilterLibSource(), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const module = { exports: {} as any };
  new Function('exports', 'module', 'require', js)(module.exports, module, () => ({}));
  return module.exports;
};

// ---------------------------------------------------------------------------------------------------
describe('§A the fixture, whole — Query Records → Filter Records → For Each, Count → Text', () => {
  const homePlan = project.plans.find((p) => p.path === HOME)!;

  test('A1 nothing refused: the only note is the router shell, 19 files, the lib among them', () => {
    expect(app.notes).toEqual([
      'App: router shell — emitted as src/App.tsx by the scaffold',
      "api modules connect to the project's NodeGX backend at http://localhost:8590 (src/api/client.ts; .env.example overrides the endpoint)"
    ]);
    expect(homePlan.refusals).toEqual([]);
    expect(summarizePreflight(app).refusals).toBe(0);
    expect(summarizePreflight(app).whole).toEqual(['Components/ContactRow', 'Pages/Home']);
    expect(Object.keys(app.files)).toHaveLength(19);
    expect(app.files[RECORD_FILTER_LIB_PATH]).toContain('export function filterRecords<T>(');
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

  test('A4 the read: the query row, the where as data with the wired value in place, the sort, the limit', () => {
    const src = home(app);
    expect(src).toContain("import { filterRecords } from '../lib/filterRecords';");
    expect(src).toContain('const [contacts, setContacts] = useState<Contact[]>([]);');
    expect(src).toContain('fetchContacts().then(setContacts);');
    expect(src).toContain('const searchValue = useValue(search);');
    expect(src).toContain(`{${CALL}.map((item, index) => (`);
    // Typed rows: the repeater maps the declared columns, and the source is not wrapped in `?? []`.
    expect(src).toContain('<ContactRow key={index} name={item.name} city={item.city} />');
    expect(src).not.toContain('?? []');
  });

  test('A5 the Count is the derived length, in the Text', () => {
    expect(home(app)).toContain(`{${CALL}.length}`);
  });

  test('A6 the ledger row moved, so the picker card carries no badge', () => {
    expect(ledgerEntryOf('FilterDBModels')?.status).toBe('translated');
    expect(exportBadgeOf('FilterDBModels')).toBeUndefined();
    const ledger = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'coverage-ledger.json'), 'utf8'));
    expect(ledger.pickerCoverageFloor).toBe(105); // §57 Repeater Item, §58 the streaming trio, §59 Hash / Random Bytes / Screen Resolution (session 85)
  });
});

// ---------------------------------------------------------------------------------------------------
describe('§B the matcher, run — queryutils.ts transcribed, graded on rows', () => {
  const { filterRecords } = loadLib();
  const rows = [
    { id: '1', name: 'Alice', city: 'Oslo', age: 31, vip: true },
    { id: '2', name: 'bob', city: 'Bergen', age: 45, vip: false },
    { id: '3', name: 'Salma', city: 'Oslo', age: 28, vip: true },
    { id: '4', name: 'Dale', city: '', age: 52, vip: true },
    { id: '5', name: 'Ali', city: 'Tromsø', vip: true },
    { id: '6', name: 'a.b', city: 'Oslo', age: 19, vip: true },
    { id: '7', name: 'Zed', city: 'Oslo', age: 60, vip: true }
  ];
  const names = (out: Array<{ name: string }>) => out.map((r) => r.name);
  const where = (search: unknown) => ({ and: [{ field: 'name', op: 'containsIgnoreCase', value: search, connected: true }, { field: 'vip', op: 'equalTo', value: true }] });

  test('B1 the fixture\'s filter: an unset search does not narrow; a set one matches case-insensitively; sorted; five at most', () => {
    expect(names(filterRecords(rows, where(undefined), ['name'], { limit: 5 }))).toEqual(['Ali', 'Alice', 'Dale', 'Salma', 'Zed']);
    expect(names(filterRecords(rows, where(''), ['name'], { limit: 5 }))).toEqual(['Ali', 'Alice', 'Dale', 'Salma', 'Zed']);
    expect(names(filterRecords(rows, where('AL'), ['name'], { limit: 5 }))).toEqual(['Ali', 'Alice', 'Dale', 'Salma']);
    expect(names(filterRecords(rows, where('bob'), ['name']))).toEqual([]); // not a VIP
  });

  test('B2 the regex lowering escapes the value: "a.b" matches the literal, not "axb"', () => {
    expect(names(filterRecords(rows, { field: 'name', op: 'contains', value: 'a.b' }))).toEqual(['a.b']);
    expect(names(filterRecords([...rows, { id: '8', name: 'axb', vip: true }], { field: 'name', op: 'contains', value: 'a.b' }))).toEqual(['a.b']);
    expect(names(filterRecords(rows, { field: 'name', op: 'startsWith', value: 'Al' }))).toEqual(['Alice', 'Ali']);
    expect(names(filterRecords(rows, { field: 'name', op: 'startsWithIgnoreCase', value: 'al' }))).toEqual(['Alice', 'Ali']);
    expect(names(filterRecords(rows, { field: 'name', op: 'notStartsWith', value: 'Al' }))).toEqual(['bob', 'Salma', 'Dale', 'a.b', 'Zed']);
    expect(names(filterRecords(rows, { field: 'name', op: 'endsWith', value: 'e' }))).toEqual(['Alice', 'Dale']);
    expect(names(filterRecords(rows, { field: 'name', op: 'notContains', value: 'a' }))).toEqual(['Alice', 'bob', 'Ali', 'Zed']); // case-sensitive: no lowercase a
  });

  test('B3 comparisons are loose where the runtime is loose, strict where it is strict', () => {
    expect(names(filterRecords(rows, { field: 'age', op: 'equalTo', value: '45' }))).toEqual(['bob']); // == across a string port
    expect(names(filterRecords(rows, { field: 'age', op: 'greaterThanOrEqualTo', value: 52 }))).toEqual(['Dale', 'Zed']);
    expect(names(filterRecords(rows, { field: 'age', op: 'between', value: [28, 31] }))).toEqual(['Alice', 'Salma']);
    expect(names(filterRecords(rows, { field: 'age', op: 'notBetween', value: [20, 59] }))).toEqual(['a.b', 'Zed']); // an absent age compares false both ways
    expect(names(filterRecords(rows, { field: 'city', op: 'containedIn', value: ['Bergen', 'Tromsø'] }))).toEqual(['bob', 'Ali']);
    expect(names(filterRecords(rows, { field: 'age', op: 'containedIn', value: ['45'] }))).toEqual([]); // indexOf is strict
    expect(names(filterRecords(rows, { field: 'city', op: 'notContainedIn', value: ['Oslo'] }))).toEqual(['bob', 'Dale', 'Ali']);
  });

  test('B4 presence and emptiness: exists is a null test, isEmpty an empty-string one', () => {
    expect(names(filterRecords(rows, { field: 'age', op: 'exists', value: false }))).toEqual(['Ali']);
    expect(names(filterRecords(rows, { field: 'age', op: 'exists', value: true }))).toHaveLength(6);
    expect(names(filterRecords(rows, { field: 'city', op: 'isEmpty', value: true }))).toEqual(['Dale']);
    expect(names(filterRecords(rows, { field: 'city', op: 'isNotEmpty', value: true }))).toHaveLength(6);
    expect(names(filterRecords(rows, { field: 'objectId', op: 'equalTo', value: '3' }))).toEqual(['Salma']);
  });

  test('B5 groups: an or is any child, an and every child, and a group whose connected children all drop is no constraint', () => {
    expect(names(filterRecords(rows, { or: [{ field: 'name', op: 'equalTo', value: 'Zed' }, { field: 'age', op: 'lessThan', value: 20 }] }))).toEqual(['a.b', 'Zed']);
    expect(names(filterRecords(rows, { or: [{ field: 'name', op: 'equalTo', value: undefined, connected: true }, { field: 'age', op: 'lessThan', value: undefined, connected: true }] }))).toHaveLength(7);
    expect(names(filterRecords(rows, { and: [] }))).toHaveLength(7);
    expect(names(filterRecords(rows, null))).toHaveLength(7);
    // A connected condition whose value is undefined does not narrow; the same condition static compares against undefined.
    expect(names(filterRecords(rows, { field: 'age', op: 'equalTo', value: undefined, connected: true }))).toHaveLength(7);
    expect(names(filterRecords(rows, { field: 'age', op: 'equalTo', value: undefined }))).toEqual(['Ali']);
  });

  test('B6 sort, skip and limit apply in scheduleFilter\'s order, and the input is not mutated', () => {
    const snapshot = rows.map((r) => r.name);
    // Ali has no age: bare `>`/`<` answer false both ways, so the sort is stable around it — the runtime's own ordering.
    expect(names(filterRecords(rows, null, ['-age']))).toEqual(['Zed', 'Dale', 'bob', 'Alice', 'Salma', 'Ali', 'a.b']);
    // Descending by name inside a city: JavaScript's `>` puts a lowercase initial after every uppercase one.
    expect(names(filterRecords(rows, null, ['city', '-name']))).toEqual(['Dale', 'bob', 'a.b', 'Zed', 'Salma', 'Alice', 'Ali']);
    expect(names(filterRecords(rows, null, ['name'], { skip: 2, limit: 3 }))).toEqual(['Dale', 'Salma', 'Zed']); // Ali, Alice skipped; a.b and bob sort after every capital
    expect(names(filterRecords(rows, { field: 'vip', op: 'equalTo', value: true }, ['name'], { skip: 1, limit: 2 }))).toEqual(['Alice', 'Dale']);
    expect(rows.map((r) => r.name)).toEqual(snapshot);
  });

  test('B7 a between whose wired value is not a pair matches nothing and warns once', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(filterRecords(rows, { field: 'age', op: 'between', value: 30, connected: true })).toEqual([]);
    expect(filterRecords(rows, { field: 'age', op: 'between', value: 30, connected: true })).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});

// ---------------------------------------------------------------------------------------------------
describe('§C the saved shapes and the static drops, through the exporter', () => {
  test('C1 the older {combinator, rules} shape reads the same: "contain" is containsIgnoreCase, "exist" a presence test', () => {
    const ir = cloneIr();
    setParam(filterNode(ir), 'visualFilter', {
      kind: 'json',
      value: { combinator: 'and', rules: [{ property: 'name', operator: 'contain', input: 'search' }, { property: 'age', operator: 'exist' }, { property: 'vip', operator: 'equal to', value: true }] }
    });
    const src = home(emitApp(ir, catalog));
    expect(src).toContain("{ and: [{ field: 'name', op: 'containsIgnoreCase', value: searchValue, connected: true }, { field: 'age', op: 'exists', value: true }, { field: 'vip', op: 'equalTo', value: true }] }");
  });

  test('C2 a rule whose operator was never chosen is dropped in both shapes, as the runtime drops it', () => {
    const ir = cloneIr();
    setParam(filterNode(ir), 'visualFilter', { kind: 'json', value: { combinator: 'or', rules: [{ property: 'name', operator: 'contain', value: 'x' }, { property: 'age' }] } });
    expect(home(emitApp(ir, catalog))).toContain("filterRecords(contacts, { field: 'name', op: 'containsIgnoreCase', value: \"x\" }, ['name'], { limit: 5 })");
    const ir2 = cloneIr();
    filterOf(ir2, [{ id: 'a', kind: 'field', field: '', operator: 'equalTo', value: 1 }, { id: 'b', kind: 'field', field: 'vip', operator: 'equalTo', valueSource: 'static', value: false }]);
    expect(home(emitApp(ir2, catalog))).toContain("filterRecords(contacts, { field: 'vip', op: 'equalTo', value: false }, ['name'], { limit: 5 })");
  });

  test('C3 a connected condition nothing is wired into is dropped statically, with a note, and the rest translates', () => {
    const ir = cloneIr();
    disconnect(componentOf(ir, HOME), (c) => c.toProperty === 'fp-search');
    const out = emitApp(ir, catalog);
    expect(home(out)).toContain("filterRecords(contacts, { field: 'vip', op: 'equalTo', value: true }, ['name'], { limit: 5 })");
    expect(out.notes.join('\n')).toContain('condition on "name" reads a filter parameter nothing is wired into — the runtime drops the condition, and so does the export');
    // One line in the report (the condition IS left out, as the runtime leaves it out), counted once though read twice.
    expect(summarizePreflight(out).refusals).toBe(1);
    expect(out.notes.filter((n) => n.includes('nothing is wired into'))).toHaveLength(1);
  });

  test('C4 an empty filter, no sort and no limit is the source, sorted by nothing', () => {
    const ir = cloneIr();
    filterOf(ir, []);
    setParam(filterNode(ir), 'visualSorting', { kind: 'json', value: [] });
    setParam(filterNode(ir), 'filterEnableLimit', { kind: 'literal', value: false });
    expect(home(emitApp(ir, catalog))).toContain('{filterRecords(contacts, null, []).map((item, index) => (');
  });

  test('C5 Enabled off passes the records straight through — no matcher, no lib', () => {
    const ir = cloneIr();
    setParam(filterNode(ir), 'enabled', { kind: 'literal', value: false });
    const out = emitApp(ir, catalog);
    expect(home(out)).toContain('{(contacts ?? []).map((item, index) => (');
    expect(home(out)).toContain('{contacts.length}');
    expect(home(out)).not.toContain('filterRecords');
    expect(out.files[RECORD_FILTER_LIB_PATH]).toBeUndefined();
  });

  test('C6 the limit defaults are the runtime\'s: an authored 0 is 10, skip prints only when set', () => {
    const ir = cloneIr();
    setParam(filterNode(ir), 'filterLimit', { kind: 'literal', value: 0 });
    setParam(filterNode(ir), 'filterSkip', { kind: 'literal', value: 2 });
    expect(home(emitApp(ir, catalog))).toContain("['name'], { skip: 2, limit: 10 })");
  });

  test('C7 a descending sort prints compareObjects\' minus prefix', () => {
    const ir = cloneIr();
    setParam(filterNode(ir), 'visualSorting', { kind: 'json', value: [{ property: 'age', order: 'descending' }, { property: 'name', order: 'ascending' }] });
    expect(home(emitApp(ir, catalog))).toContain("['-age', 'name']");
  });

  test('C8 a condition on a field the records do not carry is reported, not refused', () => {
    const ir = cloneIr();
    filterOf(ir, [
      { id: 'q-0', kind: 'field', field: 'name', operator: 'containsIgnoreCase', valueSource: 'connected', valuePortName: 'fp-search' },
      { id: 'a', kind: 'field', field: 'nickname', operator: 'equalTo', valueSource: 'static', value: 'x' }
    ]);
    const out = emitApp(ir, catalog);
    expect(summarizePreflight(out).refusals).toBe(1);
    expect(out.notes.filter((n) => n.includes('Filter Records tests "nickname", which the records it reads do not carry'))).toHaveLength(1);
    expect(home(out)).toContain("{ field: 'nickname', op: 'equalTo', value: \"x\" }");
  });
});

// ---------------------------------------------------------------------------------------------------
describe('§D refused by name — every gate names its sentence', () => {
  const refusal = (mutate: (ir: ExportIR) => void): string => {
    const ir = cloneIr();
    mutate(ir);
    return notesOf(ir);
  };

  test('D1 a wired Enabled', () => {
    expect(refusal((ir) => { addNode(componentOf(ir, HOME), { id: 'flag', type: 'Boolean', parameters: [{ name: 'value', value: { kind: 'literal', value: true } }] }); connect(componentOf(ir, HOME), 'flag', 'value', 'filter', 'enabled', 'value'); }))
      .toContain('its Enabled input is wired — whether the filter applies is a runtime value');
  });

  test('D2 a wired Filter signal', () => {
    expect(refusal((ir) => { addNode(componentOf(ir, HOME), { id: 'btn', type: 'net.noodl.controls.button', parent: 'shell' }); connect(componentOf(ir, HOME), 'btn', 'onClick', 'filter', 'filter'); }))
      .toContain('its Filter signal is wired — a derived list is always current and has no run to trigger');
  });

  test('D3 a Run On Value Change box unticked — the trigger form', () => {
    expect(refusal((ir) => setParam(filterNode(ir), 'runOnChange-fp-search', { kind: 'literal', value: false })))
      .toContain('its Run On Value Change box for "search" is unticked — it would re-filter only on its Filter signal, which this slice does not translate');
    expect(refusal((ir) => setParam(filterNode(ir), 'runOnChange-items', { kind: 'literal', value: false })))
      .toContain('its Run On Value Change box for "items" is unticked');
  });

  test('D4 a wired setting — the limit, the sorting, the class', () => {
    const wire = (port: string) => (ir: ExportIR) => { addNode(componentOf(ir, HOME), { id: 'n', type: 'Number', parameters: [{ name: 'value', value: { kind: 'literal', value: 3 } }] }); connect(componentOf(ir, HOME), 'n', 'value', 'filter', port, 'value'); };
    expect(refusal(wire('filterLimit'))).toContain('its filterLimit setting is wired — the filter is not statically known');
    expect(refusal(wire('visualSorting'))).toContain('its visualSorting setting is wired');
    expect(refusal(wire('collectionName'))).toContain('its collectionName setting is wired');
  });

  test('D5 a schema-bound operator: points to, a relation rule', () => {
    expect(refusal((ir) => filterOf(ir, [{ id: 'a', kind: 'field', field: 'city', operator: 'pointsTo', valueSource: 'static', value: 'x' }])))
      .toContain('its "city" condition uses "pointsTo", which the runtime answers through the backend\'s schema and this slice does not evaluate client-side');
    expect(refusal((ir) => filterOf(ir, [{ id: 'a', kind: 'relation', field: '', operator: 'relatedTo', relationClass: 'Group', relationProperty: 'members', valueSource: 'static', value: 'g1' }])))
      .toContain('it filters by a relation, which the runtime cannot answer from a loaded record either');
    expect(refusal((ir) => setParam(filterNode(ir), 'visualFilter', { kind: 'json', value: { combinator: 'and', rules: [{ operator: 'related to', relatedTo: 'Group', relationProperty: 'members', value: 'g1' }] } })))
      .toContain('it filters by a relation');
    expect(refusal((ir) => filterOf(ir, [{ id: 'a', kind: 'field', field: 'name', operator: 'textSearch', valueSource: 'static', value: 'x' }])))
      .toContain('its "name" condition uses "textSearch"');
  });

  test('D6 a condition on a Date column — the backend\'s date envelope', () => {
    expect(refusal((ir) => filterOf(ir, [{ id: 'a', kind: 'field', field: 'joined', operator: 'greaterThan', valueSource: 'static', value: '2026-01-01' }])))
      .toContain('its "joined" condition is on a Date column, which the runtime compares through the backend\'s date envelope and this slice does not reproduce');
  });

  test('D7 a between without a [from, to] pair', () => {
    expect(refusal((ir) => filterOf(ir, [{ id: 'a', kind: 'field', field: 'age', operator: 'between', valueSource: 'static', value: 30 }])))
      .toContain('its "age" between condition has no [from, to] pair — the runtime reports a filter failure and keeps the previous result');
  });

  test('D8 two wires into one filter parameter', () => {
    expect(refusal((ir) => { addNode(componentOf(ir, HOME), { id: 's', type: 'String', parameters: [{ name: 'value', value: { kind: 'literal', value: 'x' } }] }); connect(componentOf(ir, HOME), 's', 'savedValue', 'filter', 'fp-search', 'value'); }))
      .toContain('two wires feed its "search" filter parameter — last-writer-wins is not statically ordered');
  });

  test('D9 the outputs a derived list cannot announce: Filtered, Done, Failure, Error, First Record Id', () => {
    const consume = (port: string) => (ir: ExportIR) => {
      const h = componentOf(ir, HOME);
      addNode(h, { id: 'sv', type: 'Set Variable', parameters: [{ name: 'name', value: { kind: 'literal', value: 'status' } }] });
      addNode(h, { id: 'txt', type: 'Text', parent: 'shell' });
      h.nodes.find((n) => n.id === 'shell')!.children!.push('txt');
      if (port === 'firstItemId' || port === 'error') connect(h, 'filter', port, 'txt', 'text', 'value');
      else connect(h, 'filter', port, 'sv', 'do');
    };
    expect(refusal(consume('modified'))).toContain('its Changed/Filtered signal is consumed — a derived list is always current and has no run to announce');
    expect(refusal(consume('done'))).toContain('its done signal is consumed');
    expect(refusal(consume('failure'))).toContain('its failure signal is consumed');
    expect(refusal(consume('firstItemId'))).toContain('its firstItemId output is consumed, which this slice does not read');
    expect(refusal(consume('error'))).toContain('its error output is consumed, which this slice does not read');
  });

  test('D10 two wires into Items, and a Query Records with no Class', () => {
    expect(refusal((ir) => { addNode(componentOf(ir, HOME), { id: 'q2', type: 'DbCollection2', parameters: [{ name: 'collectionName', value: { kind: 'literal', value: 'Contact' } }] }); connect(componentOf(ir, HOME), 'q2', 'items', 'filter', 'items', 'value'); }))
      .toContain('two wires feed its Items input — last-writer-wins is not statically ordered');
    expect(refusal((ir) => { nodeOf(ir, HOME, 'query').parameters = []; }))
      .toContain('the Query Records it reads names no Class statically');
  });
});

// ---------------------------------------------------------------------------------------------------
describe('§E what building it found — pinned', () => {
  test('E1 a query read by a transform that is then refused keeps NO state row and NO fetch effect — and is deferred by name', () => {
    const ir = cloneIr();
    setParam(filterNode(ir), 'enabled', { kind: 'literal', value: true });
    addNode(componentOf(ir, HOME), { id: 'btn', type: 'net.noodl.controls.button', parent: 'shell' });
    connect(componentOf(ir, HOME), 'btn', 'onClick', 'filter', 'filter');
    const out = emitApp(ir, catalog);
    const src = home(out);
    expect(src).not.toContain('useState<Contact[]>');
    expect(src).not.toContain('fetchContacts()');
    expect(planOf(ir, HOME).queries).toEqual([]);
    const query = out.report.components.find((c) => c.path === HOME)?.refusals?.find((r) => r.nodeId === 'query');
    expect(query?.reason).toContain('query result is not consumed by a rendered repeater or a list transform this slice reads');
  });

  test('E2 the Count wire is a binding, not a stray: dropping it changes nothing else, and it reads for Array Filter too', () => {
    const ir = cloneIr();
    disconnect(componentOf(ir, HOME), (c) => c.fromProperty === 'count');
    const out = emitApp(ir, catalog);
    expect(summarizePreflight(out).refusals).toBe(0);
    expect(home(out)).not.toContain('.length}');
    expect(home(out)).toContain('<p className={styles.countText} />');
  });

  test('E3 the query row is allocated once however many transforms read it, and a repeater over the query directly still works beside the filter', () => {
    const ir = cloneIr();
    const h = componentOf(ir, HOME);
    addNode(h, { id: 'allList', type: 'For Each', parent: 'shell', parameters: [{ name: 'template', value: { kind: 'literal', value: '/Components/ContactRow' } }] });
    h.nodes.find((n) => n.id === 'shell')!.children!.push('allList');
    connect(h, 'query', 'items', 'allList', 'items', 'value');
    const out = emitApp(ir, catalog);
    expect(summarizePreflight(out).refusals).toBe(0);
    expect(home(out).match(/useState<Contact\[\]>/g)).toHaveLength(1);
    expect(home(out).match(/fetchContacts\(\)/g)).toHaveLength(1);
    expect(home(out)).toContain('{contacts.map((contact) => (');
    expect(planOf(ir, HOME).queries).toHaveLength(1);
  });
});
