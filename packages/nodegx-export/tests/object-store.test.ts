import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import { Catalog, CatalogIndex } from '../src/catalog';
import { planProject } from '../src/analyze/plan';
import { emitApp } from '../src/emit/emitApp';
import { parseProject } from '../src/parse/parseProject';
import { typecheckEmittedApp } from './helpers/typecheckApp';
import { ComponentIR, ExportIR, NodeIR, ParamValue } from '../src/ir/types';

/**
 * EXP-011 §47 — the named Object: `Object` in "Specify explicitly" mode with a literal Id, and
 * `Set Object Properties` naming the same Id.
 *
 * In the runtime both are windows onto one record, `Model.get(id)` — create-on-read, app-wide,
 * keyed by the Id verbatim — which is exactly the Global Store shape one construct over (a Global
 * Store is the Model keyed `--ndl--global-store--<name>`, globalstore.ts). So the Object is a store
 * module, `src/stores/<id>.ts`, its `prop-<key>` reads are that store's key reads (`useStore` in
 * render, `.get().key` in a handler), and the Set is one patch — `profile.set({ name, city })` —
 * followed by its Done chain. `@nodegx/core`'s `store()` names itself "the exported equivalent of a
 * Global Store or an Object node"; this is the second half of that sentence built.
 *
 * §A the module, §B the component, §C every refusal by its sentence, §D the fixture
 * `tests/fixtures/profile-desk` whole: two inputs and a Save into `profile`, three Texts reading
 * it back (one key nothing writes), a Set Variable on the Done, and a badge component reading the
 * same object from a second file.
 */

const FIXTURE = path.join(__dirname, 'fixtures', 'profile-desk');
const CATALOG_PATH = path.join(__dirname, '..', '..', 'noodl-types', 'src', 'node-catalog.json');
const catalog: Catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
const baseIr = parseProject(FIXTURE, catalog);
const app = emitApp(baseIr, catalog);

const HOME = 'Pages/Home';
const BADGE = 'Components/ProfileBadge';
const cloneIr = (): ExportIR => structuredClone(baseIr);
const componentOf = (source: ExportIR, componentPath: string): ComponentIR =>
  source.components.find((c) => c.path === componentPath)!;
const nodeOf = (source: ExportIR, componentPath: string, id: string): NodeIR =>
  componentOf(source, componentPath).nodes.find((n) => n.id === id)!;
const lit = (value: string | number | boolean): ParamValue => ({ kind: 'literal', value });
const setParam = (node: NodeIR, name: string, value: ParamValue) => {
  const existing = node.parameters.find((p) => p.name === name);
  if (existing) existing.value = value;
  else node.parameters.push({ name, value });
};
const dropParam = (node: NodeIR, name: string) => {
  node.parameters = node.parameters.filter((p) => p.name !== name);
};
const wire = (
  source: ExportIR,
  componentPath: string,
  fromId: string,
  fromProperty: string,
  toId: string,
  toProperty: string,
  kind: 'value' | 'signal' = 'value'
) => {
  componentOf(source, componentPath).connections.push({
    key: `${fromId}:${fromProperty}->${toId}:${toProperty}`,
    fromId,
    fromProperty,
    toId,
    toProperty,
    kind
  });
};
const unwire = (source: ExportIR, componentPath: string, key: string) => {
  const component = componentOf(source, componentPath);
  expect(component.connections.some((c) => c.key === key)).toBe(true);
  component.connections = component.connections.filter((c) => c.key !== key);
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
/** Removes logic nodes and every wire touching them. */
const dropNodes = (source: ExportIR, componentPath: string, ids: string[]) => {
  const component = componentOf(source, componentPath);
  component.nodes = component.nodes.filter((n) => !ids.includes(n.id));
  component.connections = component.connections.filter((c) => !ids.includes(c.fromId) && !ids.includes(c.toId));
};
/** A second button on the page, its Click into `toId.toProperty`. */
const addButton = (source: ExportIR, id: string, label: string, toId: string, toProperty: string) => {
  const component = componentOf(source, HOME);
  addNode(component, { id, type: 'net.noodl.controls.button', parameters: [{ name: 'label', value: lit(label) }], parent: 'shell' } as never);
  component.nodes.find((n) => n.id === 'shell')!.children!.push(id);
  wire(source, HOME, id, 'onClick', toId, toProperty, 'signal');
};

const fileOf = (built: ReturnType<typeof emitApp>, name: string): string => built.files[name];
const home = (built: ReturnType<typeof emitApp>): string => fileOf(built, 'src/pages/Home.tsx');
const badge = (built: ReturnType<typeof emitApp>): string => fileOf(built, 'src/components/ProfileBadge.tsx');
const module_ = (built: ReturnType<typeof emitApp>): string => fileOf(built, 'src/stores/profile.ts');
/**
 * The `onClick` attribute of the button carrying `label`, brace-matched — the emitter prints a
 * short button on one line (`<button …>Save</button>`) and a long one over several, and the label
 * is the one thing both shapes share.
 */
const handlerOf = (source: string, label: string): string => {
  const end = source.indexOf(`>${label}</button>`) >= 0 ? source.indexOf(`>${label}</button>`) : source.indexOf(`\n        ${label}\n      </button>`);
  expect(end).toBeGreaterThan(0);
  const start = source.lastIndexOf('onClick={', end);
  expect(start).toBeGreaterThan(0);
  let depth = 0;
  for (let i = start + 'onClick='.length; i < source.length; i++) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error('unbalanced onClick attribute');
};
const reasonFor = (source: ExportIR, componentPath: string, nodeId: string): string | undefined => {
  const project = planProject(source, new CatalogIndex(catalog));
  const plan = project.plans.find((p) => p.path === componentPath)!;
  const disposition = plan.dispositions[nodeId] as { kind: string; reason?: string };
  return disposition?.kind === 'deferred' ? disposition.reason : undefined;
};
const dispositionOf = (source: ExportIR, componentPath: string, nodeId: string): { kind: string; into?: string } | undefined => {
  const project = planProject(source, new CatalogIndex(catalog));
  const plan = project.plans.find((p) => p.path === componentPath)!;
  return plan.dispositions[nodeId] as { kind: string; into?: string } | undefined;
};
const storePlanOf = (source: ExportIR, name: string) =>
  planProject(source, new CatalogIndex(catalog)).stores.find((s) => s.name === name);

const GOLDEN_MODULE = `// @nodegx:generated (stores — provenance markers complete in EXP-007)
import { store } from '@nodegx/core';

export interface ProfileState {
  name?: string;
  city?: string;
  motto?: unknown;
}

/**
 * Read by "Profile object" (Model2 \`badge-profile\` on /Components/ProfileBadge).
 * Read by "Profile object" (Model2 \`profile\` on /Pages/Home).
 * Written by "Save profile" (SetModelProperties \`saveProfile\` on /Pages/Home).
 */
export const profile = store<ProfileState>('profile', {});
`;

const SAVE = "onClick={() => { profile.set({ name: name, city: city }); status.set('Saved.'); }}";

describe('§A — the module', () => {
  test('A1 the named object is a store module — the Global Store shape, keys optional and writer-typed, "Read by" where a store says "Declared by"', () => {
    expect(module_(app)).toBe(GOLDEN_MODULE);
  });

  test('A2 the plan carries the origin, both readers and the writer; the Object and the Set collapse into the module', () => {
    const plan = storePlanOf(baseIr, 'profile')!;
    expect(plan.origin).toBe('object');
    expect(plan.declarers.map((d) => d.nodeId).sort()).toEqual(['badge-profile', 'profile']);
    expect(plan.writers.map((w) => w.nodeId)).toEqual(['saveProfile']);
    expect(dispositionOf(baseIr, HOME, 'profile')).toEqual({ kind: 'collapsed', into: 'src/stores/profile.ts' });
    expect(dispositionOf(baseIr, BADGE, 'badge-profile')).toEqual({ kind: 'collapsed', into: 'src/stores/profile.ts' });
    expect(dispositionOf(baseIr, HOME, 'saveProfile')).toEqual({ kind: 'collapsed', into: 'saveButton' });
  });

  test('A3 a key with no statically-known writer is `unknown`, not the vacuous `string` — and becomes `string` the moment a text input writes it', () => {
    expect(storePlanOf(baseIr, 'profile')!.keys.find((k) => k.key === 'motto')!.tsType).toBe('unknown');
    const ir = cloneIr();
    setParam(nodeOf(ir, HOME, 'saveProfile'), 'properties', lit('name,city,motto'));
    wire(ir, HOME, 'cityInput', 'onTextChanged', 'saveProfile', 'prop-motto');
    expect(module_(emitApp(ir, catalog))).toContain('motto?: string;');
    // And the other way: a writer whose source has no static type makes the key unknown.
    const untyped = cloneIr();
    unwire(untyped, HOME, 'cityInput:onTextChanged->saveProfile:prop-city');
    addNode(componentOf(untyped, HOME), { id: 'n', type: 'Number', parameters: [{ name: 'value', value: lit(7) }] });
    wire(untyped, HOME, 'n', 'savedValue', 'saveProfile', 'prop-city');
    expect(module_(emitApp(untyped, catalog))).toContain('city?: unknown;');
  });

  test('A4 Id Source unset is "Specify explicitly" — the runtime’s default — on both node types', () => {
    const ir = cloneIr();
    dropParam(nodeOf(ir, HOME, 'saveProfile'), 'idSource');
    dropParam(nodeOf(ir, BADGE, 'badge-profile'), 'idSource');
    expect(module_(emitApp(ir, catalog))).toBe(GOLDEN_MODULE);
  });

  test('A5 the identifier space is shared with the Variables module: an object named "variables" cannot claim src/stores/variables.ts', () => {
    const ir = cloneIr();
    for (const [comp, id] of [[HOME, 'profile'], [HOME, 'saveProfile'], [BADGE, 'badge-profile']] as const) {
      setParam(nodeOf(ir, comp, id), 'modelId', lit('variables'));
    }
    const built = emitApp(ir, catalog);
    expect(built.files['src/stores/variables.ts']).toContain('export const status = value<');
    expect(built.files['src/stores/variables2.ts']).toContain("export const variables2 = store<VariablesState>('variables', {});");
    expect(home(built)).toContain("import { variables2 } from '../stores/variables2';");
    expect(typecheckEmittedApp(built)).toEqual([]);
  });
});

describe('§B — the component', () => {
  test('B1 every read is a selector hook — three on the page, one in the badge, both files importing the one module', () => {
    expect(home(app)).toContain('const profileName = useStore(profile, (s) => s.name);');
    expect(home(app)).toContain('const profileCity = useStore(profile, (s) => s.city);');
    expect(home(app)).toContain('const motto = useStore(profile, (s) => s.motto);');
    expect(badge(app)).toContain('const name = useStore(profile, (s) => s.name);');
    expect(home(app)).toContain("import { profile } from '../stores/profile';");
    expect(badge(app)).toContain("import { profile } from '../stores/profile';");
  });

  test('B2 Save is one patch in the node’s own list order, then the Done chain as a following statement', () => {
    expect(handlerOf(home(app), 'Save profile')).toBe(SAVE);
    const reordered = cloneIr();
    setParam(nodeOf(reordered, HOME, 'saveProfile'), 'properties', lit('city,name'));
    expect(handlerOf(home(emitApp(reordered, catalog)), 'Save profile')).toBe(
      "onClick={() => { profile.set({ city: city, name: name }); status.set('Saved.'); }}"
    );
  });

  test('B3 the two inputs are controlled because the Set reads them from the button’s handler — remove the Set and they are not', () => {
    expect(home(app)).toContain("const [name, setName] = useState<string>('');");
    expect(home(app)).toContain('value={name}');
    expect(home(app)).toContain("const [city, setCity] = useState<string>('');");
    const ir = cloneIr();
    dropNodes(ir, HOME, ['saveProfile', 'setStatus', 'savedString']);
    const built = home(emitApp(ir, catalog));
    expect(built).not.toContain('useState');
    expect(built).not.toContain('value={');
  });

  test('B4 the writer-less key at a Text prints through String() — the untyped sink path', () => {
    expect(home(app)).toContain("<p className={styles.text}>{String(motto ?? '')}</p>");
    expect(home(app)).toContain('<p className={styles.text2}>{profileName}</p>');
  });

  test('B5 an Object read inside a handler is `.get().key` — typed keys only; a writer-less key defers by name there', () => {
    const ir = cloneIr();
    addNode(componentOf(ir, HOME), { id: 'setCopy', type: 'Set Variable', parameters: [{ name: 'name', value: lit('status') }] });
    wire(ir, HOME, 'profile', 'prop-name', 'setCopy', 'value');
    addButton(ir, 'copyBtn', 'Copy the name', 'setCopy', 'do');
    const built = emitApp(ir, catalog);
    expect(handlerOf(home(built), 'Copy the name')).toBe('onClick={() => status.set(profile.get().name)}');
    expect(typecheckEmittedApp(built)).toEqual([]);
    const untyped = cloneIr();
    addNode(componentOf(untyped, HOME), { id: 'setCopy', type: 'Set Variable', parameters: [{ name: 'name', value: lit('status') }] });
    wire(untyped, HOME, 'profile', 'prop-motto', 'setCopy', 'value');
    addButton(untyped, 'copyBtn', 'Copy the motto', 'setCopy', 'do');
    expect(emitApp(untyped, catalog).notes.join('\n')).toContain('property "motto" of the object "profile" has no statically-typed writer');
  });

  test('B6 a wired property the list does not admit is dropped with the runtime’s reason, and the rest still writes', () => {
    const ir = cloneIr();
    wire(ir, HOME, 'cityInput', 'onTextChanged', 'saveProfile', 'prop-nickname');
    const built = emitApp(ir, catalog);
    expect(handlerOf(home(built), 'Save profile')).toBe(SAVE);
    expect(built.notes.join('\n')).toContain(
      'wire cityInput:onTextChanged->saveProfile:prop-nickname dropped: "nickname" is not in the node\'s Properties list, so the runtime never writes it (_pushInputValues filters by the list) — dropped'
    );
    expect(module_(built)).not.toContain('nickname');
  });

  test('B7 a Failure wire is dropped with the line of runtime source that makes it unreachable — Done still translates', () => {
    const ir = cloneIr();
    addNode(componentOf(ir, HOME), { id: 'setFail', type: 'Set Variable', parameters: [{ name: 'name', value: lit('status') }] });
    wire(ir, HOME, 'saveProfile', 'failure', 'setFail', 'do', 'signal');
    wire(ir, HOME, 'savedString', 'savedValue', 'setFail', 'value');
    const built = emitApp(ir, catalog);
    expect(handlerOf(home(built), 'Save profile')).toBe(SAVE);
    expect(built.notes.join('\n')).toContain(
      'Failure cannot fire: the Id is the literal "profile" and Model.get creates the object on read, so there is never no object to write to — dropped'
    );
  });

  test('B8 a listed property nothing feeds is absent from the patch — undefined abstains (EMPTY-VALUE-CONTRACT)', () => {
    const ir = cloneIr();
    setParam(nodeOf(ir, HOME, 'saveProfile'), 'properties', lit('name,motto,city'));
    expect(handlerOf(home(emitApp(ir, catalog)), 'Save profile')).toBe(SAVE);
  });

  test('B9 without a Done chain the handler is the patch alone', () => {
    const ir = cloneIr();
    dropNodes(ir, HOME, ['setStatus', 'savedString']);
    expect(handlerOf(home(emitApp(ir, catalog)), 'Save profile')).toBe('onClick={() => profile.set({ name: name, city: city })}');
  });

  test('B10 the Object’s Properties list does not gate a read — the runtime registers any prop-* a wire asks for', () => {
    const ir = cloneIr();
    dropParam(nodeOf(ir, HOME, 'profile'), 'properties');
    expect(home(emitApp(ir, catalog))).toContain('const profileCity = useStore(profile, (s) => s.city);');
  });

  test('B12 a component that only writes the object still imports its module — the write earns the import on its own', () => {
    const ir = cloneIr();
    dropNodes(ir, HOME, ['profile']);
    const built = emitApp(ir, catalog);
    expect(home(built)).toContain("import { profile } from '../stores/profile';");
    expect(home(built)).not.toContain('useStore(profile');
    expect(handlerOf(home(built), 'Save profile')).toBe(SAVE);
    expect(typecheckEmittedApp(built)).toEqual([]);
  });

  test('B11 the type selectors that do nothing on the write path are ignored as the runtime ignores them', () => {
    const ir = cloneIr();
    setParam(nodeOf(ir, HOME, 'saveProfile'), 'type-name', lit('number'));
    setParam(nodeOf(ir, HOME, 'saveProfile'), 'type-city', lit('date'));
    expect(handlerOf(home(emitApp(ir, catalog)), 'Save profile')).toBe(SAVE);
  });
});

describe('§C — refused by name', () => {
  test('C1 a wired Fetch on the Object', () => {
    const ir = cloneIr();
    addButton(ir, 'reloadBtn', 'Reload', 'profile', 'fetch');
    expect(reasonFor(ir, HOME, 'profile')).toBe(
      'Object profile: its Fetch is wired — the exported store is live, so a re-read has nothing to read, and the Done and Fetched it would fire are a signal chain this slice does not carry'
    );
    // The reads off it defer through the node's own reason; the Set still writes.
    const built = emitApp(ir, catalog);
    expect(home(built)).not.toContain('useStore(profile, (s) => s.city)');
    expect(handlerOf(home(built), 'Save profile')).toBe(SAVE);
  });

  test('C2 a property input wired on the Object — a write through the Object itself', () => {
    const ir = cloneIr();
    wire(ir, HOME, 'nameInput', 'onTextChanged', 'profile', 'prop-name');
    expect(reasonFor(ir, HOME, 'profile')).toBe(
      'Object profile: its "name" property input is wired — a write through the Object node itself is not translated in this slice; a Set Object Properties naming "profile" is'
    );
  });

  test('C3 a signal or the Object port consumed', () => {
    const changed = cloneIr();
    addNode(componentOf(changed, HOME), { id: 'setAny', type: 'Set Variable', parameters: [{ name: 'name', value: lit('status') }] });
    wire(changed, HOME, 'profile', 'changed', 'setAny', 'do', 'signal');
    wire(changed, HOME, 'savedString', 'savedValue', 'setAny', 'value');
    expect(reasonFor(changed, HOME, 'profile')).toBe(
      'Object profile: its "changed" output is consumed — only its property reads translate in this slice (the Id is the literal "profile"; its signals are effect() work; the Object port is the runtime\'s Model)'
    );
    const object = cloneIr();
    wire(object, HOME, 'profile', 'object', 'nameText', 'text');
    expect(reasonFor(object, HOME, 'profile')).toContain('its "object" output is consumed');
  });

  test('C4 a wired Id, on either node', () => {
    const ir = cloneIr();
    addNode(componentOf(ir, HOME), { id: 'idString', type: 'String', parameters: [{ name: 'value', value: lit('profile') }] });
    wire(ir, HOME, 'idString', 'savedValue', 'saveProfile', 'modelId');
    wire(ir, HOME, 'idString', 'savedValue', 'profile', 'modelId');
    expect(reasonFor(ir, HOME, 'saveProfile')).toBe(
      'its Id is wired, so which object it writes is a runtime value — only a literal Id names a store module (EXP-011 §47)'
    );
    expect(reasonFor(ir, HOME, 'profile')).toBe(
      'Object profile: its Id is wired, so which object it reads is a runtime value — only a literal Id names a store module (EXP-011 §47)'
    );
    // The badge's copy is untouched, so the module still exists for it.
    expect(module_(emitApp(ir, catalog))).toContain("store<ProfileState>('profile', {})");
  });

  test('C5 "From repeater" on either node — the registered residual, in its own words', () => {
    const ir = cloneIr();
    setParam(nodeOf(ir, HOME, 'saveProfile'), 'idSource', lit('foreach'));
    setParam(nodeOf(ir, HOME, 'profile'), 'idSource', lit('foreach'));
    expect(reasonFor(ir, HOME, 'saveProfile')).toBe(
      "it writes properties onto the enclosing repeater's row; inside a row that is state the enclosing list owns (EXP-002-MODEL2-TARGET-OUTPUT §4), and a row's value reaches the page only as the repeater's \"last row that fired\" read"
    );
    expect(reasonFor(ir, HOME, 'profile')).toBe(
      'Object profile: no For Each names this component as its template, so there is no repeater row to read'
    );
  });

  test('C6 the two type selectors that act — Array evaluates a string as code, Object dereferences an Id', () => {
    const array = cloneIr();
    setParam(nodeOf(array, HOME, 'saveProfile'), 'type-name', lit('array'));
    expect(reasonFor(array, HOME, 'saveProfile')).toBe(
      'its "name" is typed Array, which the runtime reads by evaluating a string as code — not translated in this slice'
    );
    const object = cloneIr();
    setParam(nodeOf(object, HOME, 'saveProfile'), 'type-city', lit('object'));
    expect(reasonFor(object, HOME, 'saveProfile')).toBe(
      'its "city" is typed Object, which the runtime reads by dereferencing a string as an object Id — not translated in this slice'
    );
  });

  test('C7 an Object whose Id is also a Global Store’s name — two records in the runtime, one store() in the export: the Object side is refused, the store keeps its module', () => {
    const ir = cloneIr();
    addNode(componentOf(ir, HOME), { id: 'gs', type: 'net.noodl.GlobalStore', parameters: [{ name: 'storeName', value: lit('profile') }, { name: 'initialState', value: { kind: 'json', value: { theme: 'sunny' } } as ParamValue }] });
    const collision =
      'its Id "profile" is also a Global Store\'s name — two records in the runtime (the store is the Model "--ndl--global-store--profile", the object the Model "profile") and one store() in the export, so the Object side is refused rather than merged into the store\'s module';
    expect(reasonFor(ir, HOME, 'saveProfile')).toBe(collision);
    expect(reasonFor(ir, HOME, 'profile')).toBe(`Object profile: ${collision}`);
    expect(reasonFor(ir, BADGE, 'badge-profile')).toBe(`Object badge-profile: ${collision}`);
    const built = emitApp(ir, catalog);
    expect(module_(built)).toContain('Declared by (net.noodl.GlobalStore `gs` on /Pages/Home).');
    expect(module_(built)).not.toContain('Read by');
    expect(module_(built)).toContain('theme: string;');
    expect(module_(built)).not.toContain('city');
  });

  test('C8 a blank Id on either node', () => {
    const ir = cloneIr();
    setParam(nodeOf(ir, HOME, 'saveProfile'), 'modelId', lit(''));
    dropParam(nodeOf(ir, HOME, 'profile'), 'modelId');
    expect(reasonFor(ir, HOME, 'saveProfile')).toBe(
      'it names no object: Id Source is "Specify explicitly" and the Id is blank, so every Do answers Failure ("no object is bound") and writes nothing'
    );
    expect(reasonFor(ir, HOME, 'profile')).toBe(
      'Object profile: it names no object: Id Source is unset, which the runtime reads as "Specify explicitly" and the Id is blank, so the runtime binds nothing and every property reads undefined'
    );
  });

  test('C9 a Set with nothing wired into any listed property, and one with an empty list', () => {
    const nothing = cloneIr();
    setParam(nodeOf(nothing, HOME, 'saveProfile'), 'properties', lit('motto'));
    expect(reasonFor(nothing, HOME, 'saveProfile')).toBe('nothing is wired into any of its properties, so Do writes nothing');
    const empty = cloneIr();
    setParam(nodeOf(empty, HOME, 'saveProfile'), 'properties', lit(''));
    expect(reasonFor(empty, HOME, 'saveProfile')).toBe('its Properties list is empty, so Do writes nothing');
  });

  test('C10 a Set nothing fires', () => {
    const ir = cloneIr();
    unwire(ir, HOME, 'saveButton:onClick->saveProfile:store');
    expect(reasonFor(ir, HOME, 'saveProfile')).toBe('its Do is never fired by a translatable trigger');
  });

  test('C12 a Set nothing fires still carries the more specific refusal when the compiler has one — the sweep asks the compiler first (arm I’s row)', () => {
    const ir = cloneIr();
    unwire(ir, HOME, 'saveButton:onClick->saveProfile:store');
    setParam(nodeOf(ir, HOME, 'saveProfile'), 'modelId', lit(''));
    expect(reasonFor(ir, HOME, 'saveProfile')).toBe(
      'it names no object: Id Source is "Specify explicitly" and the Id is blank, so every Do answers Failure ("no object is bound") and writes nothing'
    );
  });

  test('C11 Create New Array — translated since §55 (the handle is the id); a mint nothing fires falls to logic with its own sentence', () => {
    const ir = cloneIr();
    addNode(componentOf(ir, HOME), { id: 'newArr', type: 'CollectionNew' });
    // EXP-011 §55 reversed §7.3: a fired mint is `const <local> = collection<any>([]); set<Row>(<local>)`.
    expect(reasonFor(ir, HOME, 'newArr')).toBe('nothing is wired to its Do, so no array is ever created');
    addButton(ir, 'mintBtn', 'Mint', 'newArr', 'new');
    const home = emitApp(ir, catalog).files['src/pages/Home.tsx'];
    expect(home).toContain('collection<any>([])');
    expect(home).toContain('useState<Collection<any> | null>(null)');
  });
});

describe('§D — the fixture, whole', () => {
  test('D1 nothing refused: every node has a rule, and the only note is the router shell', () => {
    expect(app.notes).toEqual(['App: router shell — emitted as src/App.tsx by the scaffold']);
    expect(fileOf(app, 'EXPORT-REPORT.md')).toContain('Every node and every wire in this project had a translation, and the export refused none of them.');
    expect(home(app)).not.toContain('TODO(export)');
  });

  test('D2 the emitted app typechecks', () => {
    expect(typecheckEmittedApp(app)).toEqual([]);
  });

  test('D3 every emitted file parses', () => {
    for (const [name, source] of Object.entries(app.files)) {
      if (!/\.(ts|tsx)$/.test(name)) continue;
      const parsed = ts.createSourceFile(name, source, ts.ScriptTarget.ES2022, true, name.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
      const diagnostics = (parsed as unknown as { parseDiagnostics: ts.Diagnostic[] }).parseDiagnostics;
      expect(diagnostics.map((d) => `${name}: ${d.messageText}`)).toEqual([]);
    }
  });

  test('D4 the sites, counted: four selector hooks, one patch, one module, two store files', () => {
    expect(home(app).match(/useStore\(profile, /g)).toHaveLength(3);
    expect(badge(app).match(/useStore\(profile, /g)).toHaveLength(1);
    expect(home(app).match(/profile\.set\(/g)).toHaveLength(1);
    expect(Object.keys(app.files).filter((f) => f.startsWith('src/stores/')).sort()).toEqual(['src/stores/profile.ts', 'src/stores/variables.ts']);
  });

  test('D5 emission is deterministic: two runs are byte-identical', () => {
    expect(emitApp(cloneIr(), catalog).files).toEqual(app.files);
  });

  test('D6 the ledger says so: Set Object Properties translated, Object translated, Create New Array translated (§55)', () => {
    const ledger = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'coverage-ledger.json'), 'utf8'));
    const status = (name: string) => ledger.entries.find((e: { typeName: string }) => e.typeName === name);
    expect(status('SetModelProperties').status).toBe('translated');
    expect(status('Model2').status).toBe('translated');
    // EXP-011 §50 (Richard, 2026-09-03) reversed §7.3 and scheduled the row; §55 built it.
    expect(status('CollectionNew').status).toBe('translated');
    expect(status('CollectionNew').note).toMatch(/^EXP-011 §55/);
    expect(ledger.pickerCoverageFloor).toBe(110); // §60 the component-object trio + §62 the relation pair (session 86); §57 + §58 + §59 (session 85) // 90 after §48; §49 added States and Animate To Value; §51 Component Children; §52 Script; §53 Run Tasks; §54 On App Error; §55 Create New Array §56 Filter Records
  });
});
