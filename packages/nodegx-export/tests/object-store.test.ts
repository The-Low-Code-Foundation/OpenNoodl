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
 * `tests/fixtures/profile-desk` whole: two inputs and a Save into `profile`, four Texts reading
 * it back (one key nothing writes, one written only by a value typed into the Set — §68), a Set
 * Variable on the Done with its value typed in (§69), and a badge component reading the same
 * object from a second file.
 *
 * §E (EXP-011 §68, session 92): a listed key nothing wires but the author typed a value for is
 * written as that literal — the runtime queues every authored parameter into the node at creation
 * and `_pushInputValues` writes every listed key that is not `undefined` — and the literal types
 * the key as itself (§67's rule for a Variable's Value).
 *
 * §F (EXP-011 §69, session 93): the fixture's `Set status` has `Saved.` TYPED INTO its Value with no
 * String node in front of it — the common authoring — and the export writes it on Do exactly as it
 * wrote the wire (`status.set('Saved.')`, byte-identical output), where before §69 the node was
 * refused (*nothing is wired into value*) and the refusal dropped the whole Save chain behind it.
 * The literal types the variable as §67's seed does.
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
  since?: string;
}

/**
 * Read by "Profile object" (Model2 \`badge-profile\` on /Components/ProfileBadge).
 * Read by "Profile object" (Model2 \`profile\` on /Pages/Home).
 * Written by "Save profile" (SetModelProperties \`saveProfile\` on /Pages/Home).
 */
export const profile = store<ProfileState>('profile', {});
`;

const SAVE = "onClick={() => { profile.set({ name: name, city: city, since: '2026' }); status.set('Saved.'); }}";

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
  test('B1 every read is a selector hook — four on the page, one in the badge, both files importing the one module', () => {
    expect(home(app)).toContain('const profileName = useStore(profile, (s) => s.name);');
    expect(home(app)).toContain('const profileCity = useStore(profile, (s) => s.city);');
    expect(home(app)).toContain('const motto = useStore(profile, (s) => s.motto);');
    expect(home(app)).toContain('const since = useStore(profile, (s) => s.since);');
    expect(badge(app)).toContain('const name = useStore(profile, (s) => s.name);');
    expect(home(app)).toContain("import { profile } from '../stores/profile';");
    expect(badge(app)).toContain("import { profile } from '../stores/profile';");
  });

  test('B2 Save is one patch in the node’s own list order, then the Done chain as a following statement', () => {
    expect(handlerOf(home(app), 'Save profile')).toBe(SAVE);
    const reordered = cloneIr();
    setParam(nodeOf(reordered, HOME, 'saveProfile'), 'properties', lit('city,since,name'));
    expect(handlerOf(home(emitApp(reordered, catalog)), 'Save profile')).toBe(
      "onClick={() => { profile.set({ city: city, since: '2026', name: name }); status.set('Saved.'); }}"
    );
  });

  test('B3 the two inputs are controlled because the Set reads them from the button’s handler — remove the Set and they are not', () => {
    expect(home(app)).toContain("const [name, setName] = useState<string>('');");
    expect(home(app)).toContain('value={name}');
    expect(home(app)).toContain("const [city, setCity] = useState<string>('');");
    const ir = cloneIr();
    dropNodes(ir, HOME, ['saveProfile', 'setStatus']);
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
    addNode(componentOf(ir, HOME), { id: 'setFail', type: 'Set Variable', parameters: [{ name: 'name', value: lit('status') }, { name: 'value', value: lit('Failed.') }] });
    wire(ir, HOME, 'saveProfile', 'failure', 'setFail', 'do', 'signal');
    const built = emitApp(ir, catalog);
    expect(handlerOf(home(built), 'Save profile')).toBe(SAVE);
    expect(built.notes.join('\n')).toContain(
      'Failure cannot fire: the Id is the literal "profile" and Model.get creates the object on read, so there is never no object to write to — dropped'
    );
  });

  test('B8 a listed property nothing feeds is absent from the patch — undefined abstains (EMPTY-VALUE-CONTRACT)', () => {
    const ir = cloneIr();
    setParam(nodeOf(ir, HOME, 'saveProfile'), 'properties', lit('name,motto,city,since'));
    expect(handlerOf(home(emitApp(ir, catalog)), 'Save profile')).toBe(SAVE);
  });

  test('B9 without a Done chain the handler is the patch alone', () => {
    const ir = cloneIr();
    dropNodes(ir, HOME, ['setStatus']);
    expect(handlerOf(home(emitApp(ir, catalog)), 'Save profile')).toBe("onClick={() => profile.set({ name: name, city: city, since: '2026' })}");
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
    addNode(componentOf(changed, HOME), { id: 'setAny', type: 'Set Variable', parameters: [{ name: 'name', value: lit('status') }, { name: 'value', value: lit('Changed.') }] });
    wire(changed, HOME, 'profile', 'changed', 'setAny', 'do', 'signal');
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

describe('§E — EXP-011 §68: a value typed into a listed, unwired property is written, and types the key', () => {
  test('E1 the fixture’s "since" is in the patch as the literal, in list order, and the module types it string', () => {
    expect(handlerOf(home(app), 'Save profile')).toBe(SAVE);
    expect(module_(app)).toContain('  since?: string;');
    expect(home(app)).toContain('<p className={styles.text2}>{since}</p>'); // typed ⇒ the read binds without String()
  });

  test('E2 a number literal writes as a number and types the key unknown — and the app still typechecks; a boolean likewise', () => {
    const num = cloneIr();
    setParam(nodeOf(num, HOME, 'saveProfile'), 'prop-since', lit(2026));
    const numBuilt = emitApp(num, catalog);
    expect(handlerOf(home(numBuilt), 'Save profile')).toBe("onClick={() => { profile.set({ name: name, city: city, since: 2026 }); status.set('Saved.'); }}");
    expect(module_(numBuilt)).toContain('  since?: unknown;');
    expect(typecheckEmittedApp(numBuilt)).toEqual([]);
    const bool = cloneIr();
    setParam(nodeOf(bool, HOME, 'saveProfile'), 'prop-since', lit(true));
    expect(handlerOf(home(emitApp(bool, catalog)), 'Save profile')).toContain('since: true }');
  });

  test('E3 a literal under a wire from a text input is never written — the wire’s value is written, and (§74) a note says the typed-in value is dead in the runtime too', () => {
    const ir = cloneIr();
    wire(ir, HOME, 'nameInput', 'onTextChanged', 'saveProfile', 'prop-since');
    const built = emitApp(ir, catalog);
    expect(handlerOf(home(built), 'Save profile')).toBe("onClick={() => { profile.set({ name: name, city: city, since: name }); status.set('Saved.'); }}");
    expect(home(built)).not.toContain("'2026'");
    expect(built.notes).toContain(
      'Pages/Home: node saveProfile (SetModelProperties): its typed-in "since" value "2026" is never written — the wire from nameInput:onTextChanged always carries a value, so every Do writes the wire\'s value, in the runtime and here'
    );
    expect(module_(built)).toContain('  since?: string;');
    // The wire governs the type too: a number typed under a string wire does not demote the key.
    setParam(nodeOf(ir, HOME, 'saveProfile'), 'prop-since', lit(2026));
    expect(module_(emitApp(ir, catalog))).toContain('  since?: string;');
  });

  test('E4 a literal on a key the list does not admit is never written (the runtime filters by the list) — and leaves nothing to drop, so no note', () => {
    const ir = cloneIr();
    setParam(nodeOf(ir, HOME, 'saveProfile'), 'properties', lit('name,city'));
    const built = emitApp(ir, catalog);
    expect(handlerOf(home(built), 'Save profile')).toBe("onClick={() => { profile.set({ name: name, city: city }); status.set('Saved.'); }}");
    expect(built.notes).toEqual(['App: router shell — emitted as src/App.tsx by the scaffold']);
    expect(module_(built)).toContain('  since?: unknown;'); // read by the Text, written by nothing typed
  });

  test('E5 the two acting selectors refuse a literal exactly as a wire — the runtime evals / dereferences the string either way', () => {
    const ir = cloneIr();
    setParam(nodeOf(ir, HOME, 'saveProfile'), 'type-since', lit('array'));
    expect(reasonFor(ir, HOME, 'saveProfile')).toBe(
      'its "since" is typed Array, which the runtime reads by evaluating a string as code — not translated in this slice'
    );
  });

  test('E6 a Set whose only value is the literal translates as that one-key patch; with the literal gone too, C9’s refusal', () => {
    const ir = cloneIr();
    unwire(ir, HOME, 'nameInput:onTextChanged->saveProfile:prop-name');
    unwire(ir, HOME, 'cityInput:onTextChanged->saveProfile:prop-city');
    expect(handlerOf(home(emitApp(ir, catalog)), 'Save profile')).toBe("onClick={() => { profile.set({ since: '2026' }); status.set('Saved.'); }}");
    dropParam(nodeOf(ir, HOME, 'saveProfile'), 'prop-since');
    expect(reasonFor(ir, HOME, 'saveProfile')).toBe('nothing is wired into any of its properties, so Do writes nothing');
  });

  test('E8 a literal on a listed key nothing reads still lands on the module, typed by the literal — the write alone earns the key', () => {
    const ir = cloneIr();
    setParam(nodeOf(ir, HOME, 'saveProfile'), 'properties', lit('name,city,since,plan'));
    setParam(nodeOf(ir, HOME, 'saveProfile'), 'prop-plan', lit('free'));
    const built = emitApp(ir, catalog);
    expect(module_(built)).toContain('  plan?: string;');
    expect(handlerOf(home(built), 'Save profile')).toBe("onClick={() => { profile.set({ name: name, city: city, since: '2026', plan: 'free' }); status.set('Saved.'); }}");
    expect(typecheckEmittedApp(built)).toEqual([]);
  });

  test('E7 an expression parameter is not a literal — refused as having no statically known source, not written as its source text', () => {
    const ir = cloneIr();
    setParam(nodeOf(ir, HOME, 'saveProfile'), 'prop-since', { kind: 'expression', source: 'Date.now()' } as unknown as ParamValue);
    const built = emitApp(ir, catalog);
    expect(handlerOf(home(built), 'Save profile')).toBe("onClick={() => { profile.set({ name: name, city: city }); status.set('Saved.'); }}");
    expect(home(built)).not.toContain('Date.now()');
  });
});

describe('§F — EXP-011 §69: a value typed into the Set Variable with nothing wired over it is written on Do, and types the variable', () => {
  const variables = (built: ReturnType<typeof emitApp>): string => fileOf(built, 'src/stores/variables.ts');

  test('F1 the fixture’s Set status has "Saved." typed in and no wire — the handler is the text a String wire used to produce, and the variable types string', () => {
    expect(nodeOf(baseIr, HOME, 'setStatus').parameters.find((p) => p.name === 'value')).toEqual({ name: 'value', value: lit('Saved.') });
    expect(componentOf(baseIr, HOME).connections.some((c) => c.toId === 'setStatus' && c.toProperty === 'value')).toBe(false);
    expect(componentOf(baseIr, HOME).nodes.some((n) => n.type === 'String')).toBe(false);
    expect(handlerOf(home(app), 'Save profile')).toBe(SAVE);
    expect(variables(app)).toContain('/** Written by "Set status" (Set Variable `setStatus` on /Pages/Home). */\nexport const status = value<string | undefined>(undefined);');
  });

  test('F2 a number literal writes as a number and types the variable unknown — and the app typechecks; a boolean likewise (a literal is not a logic truth value)', () => {
    const num = cloneIr();
    setParam(nodeOf(num, HOME, 'setStatus'), 'value', lit(7));
    const built = emitApp(num, catalog);
    expect(handlerOf(home(built), 'Save profile')).toBe("onClick={() => { profile.set({ name: name, city: city, since: '2026' }); status.set(7); }}");
    expect(variables(built)).toContain('export const status = value<unknown>(undefined);');
    expect(typecheckEmittedApp(built)).toEqual([]);
    const bool = cloneIr();
    setParam(nodeOf(bool, HOME, 'setStatus'), 'value', lit(true));
    expect(handlerOf(home(emitApp(bool, catalog)), 'Save profile')).toContain('status.set(true); }}');
  });

  test('F3 a literal under a wire from a text input is never written — the wire is written, (§74) a note says so, and the wire governs the type (a number under a string wire does not demote)', () => {
    const ir = cloneIr();
    wire(ir, HOME, 'nameInput', 'onTextChanged', 'setStatus', 'value');
    setParam(nodeOf(ir, HOME, 'setStatus'), 'value', lit(7));
    const built = emitApp(ir, catalog);
    expect(handlerOf(home(built), 'Save profile')).toBe("onClick={() => { profile.set({ name: name, city: city, since: '2026' }); status.set(name); }}");
    expect(home(built)).not.toContain('status.set(7)');
    expect(built.notes).toContain(
      "Pages/Home: node setStatus (Set Variable): its typed-in Value 7 is never written — the wire from nameInput:onTextChanged always carries a value, so every Do writes the wire's value, in the runtime and here"
    );
    expect(variables(built)).toContain('export const status = value<string | undefined>(undefined);');
  });

  test('F4 with neither a wire nor a typed-in value the Set is refused by the old sentence — and the refusal still drops the whole Save chain behind it (the absence beside F1)', () => {
    const ir = cloneIr();
    dropParam(nodeOf(ir, HOME, 'setStatus'), 'value');
    expect(reasonFor(ir, HOME, 'setStatus')).toBe('nothing is wired into value');
    const built = emitApp(ir, catalog);
    expect(built.notes).toContain('Pages/Home: wire saveProfile:done->setStatus:do dropped: nothing is wired into value');
    expect(built.notes).toContain('Pages/Home: wire saveButton:onClick->saveProfile:store dropped: nothing is wired into value');
    expect(home(built)).not.toContain('profile.set(');
  });

  test('F5 (§73) Set as = Boolean with a value typed in writes !!value — "Saved." is true, false is false, and the variable types unknown; the app typechecks', () => {
    const ir = cloneIr();
    setParam(nodeOf(ir, HOME, 'setStatus'), 'setWith', lit('boolean'));
    const built = emitApp(ir, catalog);
    expect(reasonFor(ir, HOME, 'setStatus')).toBeUndefined();
    expect(handlerOf(home(built), 'Save profile')).toBe("onClick={() => { profile.set({ name: name, city: city, since: '2026' }); status.set(true); }}");
    expect(variables(built)).toContain('export const status = value<unknown>(undefined);');
    expect(typecheckEmittedApp(built)).toEqual([]);
    const off = cloneIr();
    setParam(nodeOf(off, HOME, 'setStatus'), 'setWith', lit('boolean'));
    setParam(nodeOf(off, HOME, 'setStatus'), 'value', lit(false));
    expect(handlerOf(home(emitApp(off, catalog)), 'Save profile')).toContain('status.set(false); }}');
  });

  test('F9 (§73) Set as = Boolean with NOTHING typed in is !!undefined — a write of false on every Do, not the "nothing is wired" refusal', () => {
    const ir = cloneIr();
    setParam(nodeOf(ir, HOME, 'setStatus'), 'setWith', lit('boolean'));
    dropParam(nodeOf(ir, HOME, 'setStatus'), 'value');
    const built = emitApp(ir, catalog);
    expect(reasonFor(ir, HOME, 'setStatus')).toBeUndefined();
    expect(handlerOf(home(built), 'Save profile')).toContain('status.set(false); }}');
    expect(variables(built)).toContain('export const status = value<unknown>(undefined);');
  });

  test('F10 (§73) Set as = Empty string writes \'\' and never reads Value — with "Saved." typed in, with nothing typed in, and under a wire alike; the variable types string', () => {
    for (const shape of ['typed', 'bare', 'wired'] as const) {
      const ir = cloneIr();
      setParam(nodeOf(ir, HOME, 'setStatus'), 'setWith', lit('emptyString'));
      if (shape === 'bare') dropParam(nodeOf(ir, HOME, 'setStatus'), 'value');
      // The wired shape feeds the Set from the self-fed `status` Variable — a source whose type is
      // `unknown` (the cycle guard) — so a wire the runtime never reads would demote the type if it
      // were still registered; nameInput's string wire could not tell the two apart.
      if (shape === 'wired') wire(ir, HOME, 'statusVar', 'value', 'setStatus', 'value');
      const built = emitApp(ir, catalog);
      expect(reasonFor(ir, HOME, 'setStatus')).toBeUndefined();
      expect(handlerOf(home(built), 'Save profile')).toBe("onClick={() => { profile.set({ name: name, city: city, since: '2026' }); status.set(''); }}");
      expect(home(built)).not.toContain('status.set(status');
      expect(variables(built)).toContain('export const status = value<string | undefined>(undefined);');
      expect(built.notes.join('\n')).not.toContain('setStatus');
    }
  });

  test('F11 (§73) Set as = Number, Date or Any leaves the typed-in value untouched — the enum only names the port type (7 stays 7 and types unknown; "Saved." stays "Saved.")', () => {
    for (const as of ['number', 'date', '*']) {
      const num = cloneIr();
      setParam(nodeOf(num, HOME, 'setStatus'), 'setWith', lit(as));
      setParam(nodeOf(num, HOME, 'setStatus'), 'value', lit(7));
      const built = emitApp(num, catalog);
      expect(reasonFor(num, HOME, 'setStatus')).toBeUndefined();
      expect(handlerOf(home(built), 'Save profile')).toContain('status.set(7); }}');
      expect(variables(built)).toContain('export const status = value<unknown>(undefined);');
      const str = cloneIr();
      setParam(nodeOf(str, HOME, 'setStatus'), 'setWith', lit(as));
      expect(handlerOf(home(emitApp(str, catalog)), 'Save profile')).toBe(SAVE);
    }
  });

  test('F12 (§73) Set as = Object or Array looks a string value up as an id — refused by name, with the value typed in and under a wire', () => {
    for (const as of ['object', 'array']) {
      const ir = cloneIr();
      setParam(nodeOf(ir, HOME, 'setStatus'), 'setWith', lit(as));
      expect(reasonFor(ir, HOME, 'setStatus')).toBe(`setWith "${as}" conversion is not translated in step 5`);
      const wired = cloneIr();
      setParam(nodeOf(wired, HOME, 'setStatus'), 'setWith', lit(as));
      wire(wired, HOME, 'nameInput', 'onTextChanged', 'setStatus', 'value');
      expect(reasonFor(wired, HOME, 'setStatus')).toBe(`setWith "${as}" conversion is not translated in step 5`);
    }
  });

  test('F13 (§73) Set as = Boolean UNDER a wire is still refused by name — the wire path has no !! in this slice (§73.5)', () => {
    const ir = cloneIr();
    setParam(nodeOf(ir, HOME, 'setStatus'), 'setWith', lit('boolean'));
    wire(ir, HOME, 'nameInput', 'onTextChanged', 'setStatus', 'value');
    expect(reasonFor(ir, HOME, 'setStatus')).toBe('setWith "boolean" conversion is not translated in step 5');
    expect(home(emitApp(ir, catalog))).not.toContain('status.set(');
  });

  test('F6 an expression parameter is not a literal — refused as nothing wired, never written as its source text', () => {
    const ir = cloneIr();
    setParam(nodeOf(ir, HOME, 'setStatus'), 'value', { kind: 'expression', source: 'Date.now()' } as unknown as ParamValue);
    expect(reasonFor(ir, HOME, 'setStatus')).toBe('nothing is wired into value');
    expect(home(emitApp(ir, catalog))).not.toContain('Date.now()');
  });

  test('F7 a second Set on the same variable typing in a number is a second literal source — the variable demotes to unknown and the app still typechecks', () => {
    const ir = cloneIr();
    addNode(componentOf(ir, HOME), { id: 'setCount', type: 'Set Variable', parameters: [{ name: 'name', value: lit('status') }, { name: 'value', value: lit(3) }] });
    addButton(ir, 'countButton', 'Count', 'setCount', 'do');
    const built = emitApp(ir, catalog);
    expect(handlerOf(home(built), 'Count')).toBe('onClick={() => status.set(3)}');
    expect(variables(built)).toContain('export const status = value<unknown>(undefined);');
    expect(variables(built)).toContain('Written by "Set status" (Set Variable `setStatus` on /Pages/Home)');
    expect(typecheckEmittedApp(built)).toEqual([]);
  });

  test('F8 the corpus’s only typed-in Set Variable values (mood-desk, four) all sit under a wire from a constant — never written in the runtime, so (§74) each is a note and the handlers write the constants', () => {
    const mood = parseProject(path.join(__dirname, 'fixtures', 'mood-desk'), catalog);
    const page = mood.components.find((c: ComponentIR) => c.path === 'Pages/Mood')!;
    const typedIn = page.nodes.filter((n: NodeIR) => n.type === 'Set Variable' && n.parameters.some((p) => p.name === 'value'));
    expect(typedIn.map((n: NodeIR) => n.id).sort()).toEqual(['setAngry', 'setCalm', 'setClosed', 'setOpen']);
    for (const n of typedIn) expect(page.connections.some((c) => c.toId === n.id && c.toProperty === 'value')).toBe(true);
    const built = emitApp(mood, catalog);
    const never = (id: string, value: string, from: string) =>
      `Pages/Mood: node ${id} (Set Variable): its typed-in Value ${value} is never written — the wire from ${from}:savedValue always carries a value, so every Do writes the wire's value, in the runtime and here`;
    expect(built.notes.filter((n) => !n.startsWith('App:'))).toEqual([
      never('setOpen', 'true', 'trueConst'),
      never('setClosed', 'false', 'falseConst'),
      never('setCalm', '0.5', 'calmConst'),
      never('setAngry', '1.5', 'angryConst')
    ]);
    const moodPage = built.files['src/pages/Mood.tsx'];
    expect(moodPage).toContain('onClick={() => isOpen.set(true)}');
    expect(moodPage).toContain('onClick={() => mood.set(1.5)}');
    expect(moodPage).not.toContain('??');
  });
});

describe('§G — EXP-011 §71: a value typed into the Object node’s OWN property input is the runtime’s per-mount write — a mount effect in the host', () => {
  /**
   * `tests/fixtures/notice-desk` (session 94): an Object `board` with `prop-headline: 'Welcome'` and `prop-priority: 2`
   * typed into its own property inputs and nothing wired over them; a Set Object Properties writing `headline` from an
   * input on a button; a badge component whose own Object seeds `footer`. Measured in the runtime first ($SCRATCH
   * runtime.log, session 94): nodescope.ts queues every authored parameter at creation, modelnode2.ts registers ANY
   * `prop-*` input on demand, `userInputSetter` marks it dirty and `scheduleStore` writes it in the same pass — on
   * every creation (mount), whatever the Properties list says, and a Set’s Do lands over it afterwards.
   */
  const NOTICE = path.join(__dirname, 'fixtures', 'notice-desk');
  const noticeIr = parseProject(NOTICE, catalog);
  const notice = emitApp(noticeIr, catalog);
  const cloneNotice = (): ExportIR => structuredClone(noticeIr);
  const nHome = (built: ReturnType<typeof emitApp>): string => built.files['src/pages/Home.tsx'];
  const nBadge = (built: ReturnType<typeof emitApp>): string => built.files['src/components/NoticeBadge.tsx'];
  const nModule = (built: ReturnType<typeof emitApp>): string => built.files['src/stores/board.ts'];
  const BADGE_PATH = 'Components/NoticeBadge';
  const SEED_COMMENT = '  // Board object — its authored property values are stored on every mount of this component (modelnode2.ts: each prop-* setter runs at node creation and schedules a store).';
  const SEED_EFFECT = `${SEED_COMMENT}\n  useEffect(() => {\n    board.set({ headline: 'Welcome', priority: 2 });\n  }, []);\n`;
  const noticeSeeds = (source: ExportIR, componentPath: string) =>
    planProject(source, new CatalogIndex(catalog)).plans.find((p) => p.path === componentPath)!.objectSeeds;

  test('G1 the fixture: one mount effect with the patch, printed after the state hooks and before the render; the module types the string key string and the number key unknown, and names the seed; nothing refused; the app typechecks', () => {
    expect(nHome(notice)).toContain(SEED_EFFECT);
    expect(nHome(notice).match(/useEffect\(/g)).toHaveLength(1);
    expect(nHome(notice)).toContain("import { useEffect, useState } from 'react';");
    expect(nHome(notice).indexOf('useState<string>')).toBeLessThan(nHome(notice).indexOf(SEED_COMMENT));
    expect(nHome(notice).indexOf(SEED_COMMENT)).toBeLessThan(nHome(notice).indexOf('return ('));
    expect(nModule(notice)).toContain('  headline?: string;\n');
    expect(nModule(notice)).toContain('  priority?: unknown;\n');
    expect(nModule(notice)).toContain(" * Seeded with { headline: 'Welcome', priority: 2 } by \"Board object\" (Model2 `board` on /Pages/Home) on every mount of its component.\n");
    expect(nModule(notice)).toContain(' * Read by "Board object" (Model2 `board` on /Pages/Home).\n');
    // The reads: the string key binds bare, the number key through the widened sink; the Set’s write is untouched.
    expect(nHome(notice)).toContain('<p className={styles.headlineText}>{headline}</p>');
    expect(nHome(notice)).toContain("<p className={styles.priorityText}>{String(priority ?? '')}</p>");
    expect(nHome(notice)).toContain('onClick={() => board.set({ headline: notice })}');
    expect(notice.notes).toEqual(['App: router shell — emitted as src/App.tsx by the scaffold']);
    expect(dispositionOf(noticeIr, HOME, 'board')).toEqual({ kind: 'collapsed', into: 'src/stores/board.ts' });
    expect(noticeSeeds(noticeIr, HOME)).toEqual([{ nodeId: 'board', storeName: 'board', entries: [{ key: 'headline', value: 'Welcome' }, { key: 'priority', value: 2 }], comment: SEED_COMMENT.trim().slice(3) }]);
    expect(typecheckEmittedApp(notice)).toEqual([]);
  });

  test('G2 the literal types the key: a boolean writes as itself and types unknown; a string on the number key promotes it to string and the read binds bare — and both apps typecheck', () => {
    const bool = cloneNotice();
    setParam(nodeOf(bool, HOME, 'board'), 'prop-priority', lit(true));
    const builtBool = emitApp(bool, catalog);
    expect(nHome(builtBool)).toContain("    board.set({ headline: 'Welcome', priority: true });\n");
    expect(nModule(builtBool)).toContain('  priority?: unknown;\n');
    expect(typecheckEmittedApp(builtBool)).toEqual([]);
    const str = cloneNotice();
    setParam(nodeOf(str, HOME, 'board'), 'prop-priority', lit('high'));
    const builtStr = emitApp(str, catalog);
    expect(nHome(builtStr)).toContain("    board.set({ headline: 'Welcome', priority: 'high' });\n");
    expect(nModule(builtStr)).toContain('  priority?: string;\n');
    expect(nHome(builtStr)).toContain('<p className={styles.priorityText}>{priority}</p>');
    expect(typecheckEmittedApp(builtStr)).toEqual([]);
  });

  test('G3 entries are in PARAMETER order — the order the runtime queues them and writes dirtyValues in — not the Properties list’s order (§68’s Set iterates its list; the Object never reads its list on the write path)', () => {
    const ir = cloneNotice();
    const node = nodeOf(ir, HOME, 'board');
    const priority = node.parameters.find((p) => p.name === 'prop-priority')!;
    node.parameters = [priority, ...node.parameters.filter((p) => p !== priority)];
    expect(node.parameters.find((p) => p.name === 'properties')!.value).toEqual(lit('headline,priority,footer'));
    expect(nHome(emitApp(ir, catalog))).toContain("    board.set({ priority: 2, headline: 'Welcome' });\n");
  });

  test('G4 a wire into the SAME property input: the node is refused by §47’s sentence, unchanged; no effect is printed; and the literal does not type the key (discovery skips it under a wire, so a key another component reads is not typed by a value the runtime would overwrite)', () => {
    const ir = cloneNotice();
    dropNodes(ir, HOME, ['postNotice']); // the Set was headline’s other (string) source — remove it so the literal alone would type the key
    wire(ir, HOME, 'noteInput', 'onTextChanged', 'board', 'prop-headline');
    expect(reasonFor(ir, HOME, 'board')).toBe('Object board: its "headline" property input is wired — a write through the Object node itself is not translated in this slice; a Set Object Properties naming "board" is');
    const built = emitApp(ir, catalog);
    expect(nHome(built)).not.toContain('useEffect');
    expect(nHome(built)).not.toContain("'Welcome'");
    expect(nModule(built)).toContain('  headline?: unknown;\n');
    // The refused node’s OTHER literal is still registered (discovery is blind to the plan’s refusal — §47’s convention for a
    // refused Set’s "Written by" line, §69.5’s for a refused Set Variable), so the module still says so; headline is not in it.
    expect(nModule(built)).not.toContain("Seeded with { headline");
    expect(nModule(built)).toContain(" * Seeded with { priority: 2 } by \"Board object\" (Model2 `board` on /Pages/Home) on every mount of its component.\n");
    expect(nBadge(built)).toContain("<p className={styles.badgeText}>{String(headline ?? '')}</p>");
    // The presence control: the same graph with the wire gone types headline string from the literal alone.
    const control = cloneNotice();
    dropNodes(control, HOME, ['postNotice']);
    expect(nModule(emitApp(control, catalog))).toContain('  headline?: string;\n');
  });

  test('G5 a key the Properties list does not name is written and earned all the same — registerInputIfNeeded registers any prop-* (runtime Q1d) — with no note', () => {
    const ir = cloneNotice();
    setParam(nodeOf(ir, HOME, 'board'), 'prop-extra', lit('x'));
    const built = emitApp(ir, catalog);
    expect(nHome(built)).toContain("    board.set({ headline: 'Welcome', priority: 2, extra: 'x' });\n");
    expect(nModule(built)).toContain('  extra?: string;\n');
    expect(built.notes).toEqual(['App: router shell — emitted as src/App.tsx by the scaffold']);
    expect(typecheckEmittedApp(built)).toEqual([]);
  });

  test('G6 a value that is not a string, number or boolean literal is named in a note and not written — the node still collapses and its reads still translate; the other key is still seeded', () => {
    const ir = cloneNotice();
    setParam(nodeOf(ir, HOME, 'board'), 'prop-headline', { kind: 'expression', source: 'Date.now()' } as unknown as ParamValue);
    const built = emitApp(ir, catalog);
    expect(built.notes).toContain('Pages/Home: node board (Model2): its authored "headline" property value is not a string, number or boolean literal — not written into "board" at mount');
    expect(nHome(built)).toContain('    board.set({ priority: 2 });\n');
    expect(nHome(built)).not.toContain('Date.now()');
    expect(dispositionOf(ir, HOME, 'board')).toEqual({ kind: 'collapsed', into: 'src/stores/board.ts' });
    expect(nHome(built)).toContain('<p className={styles.headlineText}>{headline}</p>');
    const json = cloneNotice();
    setParam(nodeOf(json, HOME, 'board'), 'prop-priority', { kind: 'json', value: { a: 1 } } as unknown as ParamValue);
    expect(emitApp(json, catalog).notes).toContain('Pages/Home: node board (Model2): its authored "priority" property value is not a string, number or boolean literal — not written into "board" at mount');
  });

  test('G7 the control — the literals gone: no effect, no useEffect import, no seed line; the Set’s wire still types headline string; priority falls to the writer-less unknown; footer read in Home falls to String()', () => {
    const ir = cloneNotice();
    dropParam(nodeOf(ir, HOME, 'board'), 'prop-headline');
    dropParam(nodeOf(ir, HOME, 'board'), 'prop-priority');
    dropParam(nodeOf(ir, BADGE_PATH, 'badge-board'), 'prop-footer');
    const built = emitApp(ir, catalog);
    expect(nHome(built)).not.toContain('useEffect');
    expect(nBadge(built)).not.toContain('useEffect');
    expect(nBadge(built)).toContain("import { useStore } from '@nodegx/core/react';");
    expect(nModule(built)).not.toContain('Seeded with');
    expect(nModule(built)).toContain('  headline?: string;\n');
    expect(nModule(built)).toContain('  priority?: unknown;\n');
    expect(nModule(built)).toContain('  footer?: unknown;\n');
    expect(nHome(built)).toContain("<p className={styles.footerText}>{String(footer ?? '')}</p>");
    expect(nHome(built)).toContain('onClick={() => board.set({ headline: notice })}');
    expect(noticeSeeds(ir, HOME)).toEqual([]);
    expect(typecheckEmittedApp(built)).toEqual([]);
  });

  test('G8 two components, two effects, one module: the badge seeds footer in its own file, earns useEffect and the module import on its own, and the writers list in component order', () => {
    expect(nBadge(notice)).toContain(`${SEED_COMMENT}\n  useEffect(() => {\n    board.set({ footer: 'Posted by the desk' });\n  }, []);\n`);
    expect(nBadge(notice)).toContain("import { useEffect } from 'react';");
    expect(nBadge(notice)).toContain("import { board } from '../stores/board';");
    expect(nModule(notice)).toContain('  footer?: string;\n');
    expect(nHome(notice)).toContain('<p className={styles.footerText}>{footer}</p>');
    const seededLines = nModule(notice).split('\n').filter((l) => l.includes('Seeded with'));
    expect(seededLines).toEqual([
      " * Seeded with { footer: 'Posted by the desk' } by \"Board object\" (Model2 `badge-board` on /Components/NoticeBadge) on every mount of its component.",
      " * Seeded with { headline: 'Welcome', priority: 2 } by \"Board object\" (Model2 `board` on /Pages/Home) on every mount of its component."
    ]);
    expect(noticeSeeds(noticeIr, BADGE_PATH)).toEqual([{ nodeId: 'badge-board', storeName: 'board', entries: [{ key: 'footer', value: 'Posted by the desk' }], comment: SEED_COMMENT.trim().slice(3) }]);
  });

  test('G9 a component that only seeds (its read wire gone) still imports the module — the write earns the import alone (B12’s rule for the effect)', () => {
    const ir = cloneNotice();
    unwire(ir, BADGE_PATH, 'badge-board:prop-headline->badge-text:text');
    const built = emitApp(ir, catalog);
    expect(nBadge(built)).toContain("import { board } from '../stores/board';");
    expect(nBadge(built)).toContain("    board.set({ footer: 'Posted by the desk' });\n");
    expect(nBadge(built)).not.toContain('useStore(');
  });

  test('G10 the refusals around the node stand as §47 wrote them, with the literals typed in: a wired Fetch, a consumed signal, a wired Id — none prints an effect', () => {
    const fetch = cloneNotice();
    addNode(componentOf(fetch, HOME), { id: 'refetch', type: 'net.noodl.controls.button', parameters: [{ name: 'label', value: lit('Refetch') }], parent: 'shell' } as never);
    componentOf(fetch, HOME).nodes.find((n) => n.id === 'shell')!.children!.push('refetch');
    wire(fetch, HOME, 'refetch', 'onClick', 'board', 'fetch', 'signal');
    expect(reasonFor(fetch, HOME, 'board')).toContain('its Fetch is wired');
    expect(nHome(emitApp(fetch, catalog))).not.toContain('useEffect');
    const wiredId = cloneNotice();
    wire(wiredId, HOME, 'noteInput', 'onTextChanged', 'board', 'modelId');
    expect(reasonFor(wiredId, HOME, 'board')).toBeDefined();
    expect(nHome(emitApp(wiredId, catalog))).not.toContain("'Welcome'");
    expect(noticeSeeds(wiredId, HOME)).toEqual([]);
  });

  test('G11 profile-desk is untouched by §71: no Object there carries a typed-in property, so no effect, no seed line — and the corpus has no other Object with one (the presence lives in notice-desk alone)', () => {
    expect(home(app)).not.toContain('useEffect');
    expect(badge(app)).not.toContain('useEffect');
    expect(module_(app)).not.toContain('Seeded with');
    const fixtures = fs.readdirSync(path.join(__dirname, 'fixtures')).filter((f) => f !== 'notice-desk');
    const carriers: string[] = [];
    for (const name of fixtures) {
      const dir = path.join(__dirname, 'fixtures', name);
      if (!fs.existsSync(path.join(dir, 'nodegx.project.json'))) continue;
      const ir = parseProject(dir, catalog);
      for (const component of ir.components) {
        for (const node of component.nodes) {
          if (node.type === 'Model2' && node.parameters.some((p) => p.name.startsWith('prop-'))) carriers.push(`${name}:${component.path}:${node.id}`);
        }
      }
    }
    expect(carriers).toEqual([]);
  });

  test('G12 emission of notice-desk is deterministic, and its ledger row names the mount write', () => {
    expect(emitApp(cloneNotice(), catalog).files).toEqual(notice.files);
    const ledger = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'coverage-ledger.json'), 'utf8'));
    expect(ledger.entries.find((e: { typeName: string }) => e.typeName === 'Model2').note).toContain('values typed into its own `prop-*` inputs are a mount write (`useEffect`, EXP-011 §71');
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

  test('D4 the sites, counted: five selector hooks, one patch, one module, two store files', () => {
    expect(home(app).match(/useStore\(profile, /g)).toHaveLength(4);
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
    expect(ledger.pickerCoverageFloor).toBe(117); // §66 Subscribe To Changes (session 90) on top of §65 WebSocket (session 89) on top of §64 Server-Sent Events (session 88) on top of §61 the component-stack trio + §60 the component-object trio + §62 the relation pair + §63 Drag (session 86); §57 + §58 + §59 (session 85) // 90 after §48; §49 added States and Animate To Value; §51 Component Children; §52 Script; §53 Run Tasks; §54 On App Error; §55 Create New Array §56 Filter Records
  });
});
