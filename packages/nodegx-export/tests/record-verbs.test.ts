/**
 * The record verbs (EXP-002-RECORD-VERBS-TARGET-OUTPUT): Create / Update / Delete Record.
 *
 * The fixture is `puppy-test-3`'s Admin page, which already carries the corpus's own idiom
 * verbatim — five text inputs into `prop-*`, a button into `Do`, `Error` into a status Text, and
 * a Delete whose class name the author never filled in. That is why §7's "grow the Cheer fixture"
 * plan was not followed: a shape the corpus actually has beats one written to be translatable,
 * and the missing class name in particular is a gate no hand-authored fixture would have thought
 * to include.
 *
 * Every §5 gate is exercised by mutating the parsed IR, the controlled-state suite's method.
 */
import * as fs from 'fs';
import * as path from 'path';

import { Catalog, CatalogIndex } from '../src/catalog';
import { planProject } from '../src/analyze/plan';
import { emitApp } from '../src/emit/emitApp';
import { parseProject } from '../src/parse/parseProject';
import { ComponentIR, ExportIR, NodeIR, ParamValue } from '../src/ir/types';

const FIXTURE = path.join(__dirname, 'fixtures', 'puppy-test-3');
const CATALOG_PATH = path.join(__dirname, '..', '..', 'noodl-types', 'src', 'node-catalog.json');

const catalog: Catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
const baseIr = parseProject(FIXTURE, catalog);
const app = emitApp(baseIr, catalog);

const ADMIN = 'Pages/Admin';
const cloneIr = (): ExportIR => structuredClone(baseIr);
const componentOf = (source: ExportIR, componentPath: string): ComponentIR =>
  source.components.find((c) => c.path === componentPath)!;
const nodeOf = (source: ExportIR, componentPath: string, id: string): NodeIR =>
  componentOf(source, componentPath).nodes.find((n) => n.id === id)!;
const lit = (value: string | number | boolean): ParamValue => ({ kind: 'literal', value });
const setParam = (node: NodeIR, name: string, value: ParamValue) => {
  const existing = node.parameters.find((p) => p.name === name);
  if (existing) existing.value = value;
  else {
    node.parameters.push({ name, value });
    node.parameters.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  }
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
  component.connections = component.connections.filter((c) => c.key !== key);
};

const fileOf = (built: ReturnType<typeof emitApp>, name: string): string => built.files[name];
const adminSource = (built: ReturnType<typeof emitApp>): string => fileOf(built, 'src/pages/Admin.tsx');
const puppiesApi = (built: ReturnType<typeof emitApp>): string => fileOf(built, 'src/api/puppies.ts');

/** The deferral reason the planner recorded for one node. */
const reasonFor = (source: ExportIR, componentPath: string, nodeId: string): string | undefined => {
  const project = planProject(source, new CatalogIndex(catalog));
  const plan = project.plans.find((p) => p.path === componentPath)!;
  const disposition = plan.dispositions[nodeId] as { kind: string; reason?: string };
  return disposition?.kind === 'deferred' ? disposition.reason : undefined;
};

describe('§4a — Create Record: the form idiom, awaited', () => {
  test('the submit handler is async and awaits the call with the form fields as the record', () => {
    expect(adminSource(app)).toContain(
      [
        '            onClick={async () => {',
        '              try {',
        '                await createPuppy({ name: nameInput, photo: photoURLInput, breed: breedInput, age: ageInput, description: descriptionInput });',
        '              } catch (error) {',
        '                setCreatePuppyError(error instanceof Error ? error.message : String(error));',
        '              }',
        '            }}'
      ].join('\n')
    );
  });

  test('the Error output is a state row that nothing clears, and the status line reads it', () => {
    const source = adminSource(app);
    expect(source).toContain("const [createPuppyError, setCreatePuppyError] = useState<string | undefined>();");
    expect(source).toContain('<p className={styles.statusText}>{createPuppyError ?? \'\'}</p>');
    // The runtime keeps the message after a later attempt succeeds — so no success path writes it.
    expect(source).not.toContain('setCreatePuppyError(undefined)');
  });

  test('a verb whose Error nothing reads still gets its row — the writer references it too', () => {
    // Update's Error loses the shared status line to Create's (the wire order), so its row is
    // reached only by the catch. Without the emit-side writer sweep the setter call below would
    // name a binding the unused-state filter had already dropped.
    const source = adminSource(app);
    expect(source).toContain("const [updatePuppyError, setUpdatePuppyError] = useState<string | undefined>();");
    expect(source).toContain('setUpdatePuppyError(error instanceof Error ? error.message : String(error));');
  });

  test('the second and third Error wires into one status line drop with a note, never silently', () => {
    const notes = app.notes.filter((n) => n.includes("already shows another record verb's Error"));
    expect(notes).toEqual([
      "Pages/Admin: wire updateRecord:error->statusText:text dropped: statusText.text already shows another record verb's Error — the runtime shows whichever wrote last, which is not statically ordered",
      "Pages/Admin: wire deleteRecord:error->statusText:text dropped: statusText.text already shows another record verb's Error — the runtime shows whichever wrote last, which is not statically ordered"
    ]);
  });
});

describe('§4b — Update Record takes the record id first', () => {
  test('the id argument precedes the property record', () => {
    expect(adminSource(app)).toContain(
      'await updatePuppy(puppyIdInput, { name: nameInput, photo: photoURLInput, breed: breedInput, age: ageInput, description: descriptionInput });'
    );
  });

  test('Delete takes the id alone — when its class is named', () => {
    const ir = cloneIr();
    setParam(nodeOf(ir, ADMIN, 'deleteRecord'), 'collectionName', lit('Puppy'));
    expect(adminSource(emitApp(ir, catalog))).toContain('await deletePuppy(puppyIdInput);');
  });
});

describe('§3 — a form field earns local state because the submit chain reads it', () => {
  test('a text input feeding only a prop-* is controlled, and its own onChange writes the row', () => {
    const source = adminSource(app);
    expect(source).toContain("const [nameInput, setNameInput] = useState<string>('');");
    expect(source).toContain('value={nameInput}');
    expect(source).toContain('onChange={(event) => setNameInput(event.target.value)}');
  });

  test('without that clause the props are unreachable — the verb defers on its own arguments', () => {
    // Proving the enabling change is load-bearing: strip the wires that earn the state and the
    // read falls back to `input-text`, which is legal only in the input's own DOM handler.
    const ir = cloneIr();
    const admin = componentOf(ir, ADMIN);
    admin.connections = admin.connections.filter((c) => !(c.toId === 'updateRecord' || c.toId === 'deleteRecord'));
    for (const key of ['photoInput', 'breedInput', 'ageInput', 'descInput']) {
      admin.connections = admin.connections.filter((c) => c.fromId !== key);
    }
    // `nameInput-2` now feeds only Create's prop-name; with the §3 clause it still earns state.
    expect(adminSource(emitApp(ir, catalog))).toContain('await createPuppy({ name: nameInput });');
  });
});

describe('§4d — the api stub module: reads answer empty, writes throw', () => {
  test('one module carries the query and the mutations for the same class', () => {
    const api = puppiesApi(app);
    expect(api).toContain('export async function fetchPuppies(): Promise<Puppy[]> {\n  return [];\n}');
    expect(api).toContain('export async function createPuppy(data: Partial<Puppy>): Promise<Puppy> {');
    expect(api).toContain('export async function updatePuppy(id: string, data: Partial<Puppy>): Promise<Puppy> {');
    expect(adminSource(app)).toContain("import { createPuppy, updatePuppy } from '../api/puppies';");
  });

  test('a write stub throws rather than fabricating a stored record', () => {
    const api = puppiesApi(app);
    expect(api).toContain("throw new Error('createPuppy is not connected to a backend yet');");
    expect(api).toContain("throw new Error('updatePuppy is not connected to a backend yet');");
  });

  test('each stub names its call sites', () => {
    expect(puppiesApi(app)).toContain(
      'TODO(export): "Create Puppy" (NewDbModelProperties `createRecord` on /Pages/Admin)'
    );
  });

  test('a module exists for a class that is only written, never queried', () => {
    const ir = cloneIr();
    for (const component of ir.components) {
      const queries = component.nodes.filter((n) => n.type === 'DbCollection2').map((n) => n.id);
      component.nodes = component.nodes.filter((n) => n.type !== 'DbCollection2');
      component.connections = component.connections.filter((c) => !queries.includes(c.fromId));
    }
    const built = emitApp(ir, catalog);
    expect(puppiesApi(built)).toContain('export async function createPuppy(');
    expect(puppiesApi(built)).not.toContain('fetchPuppies');
    // The item type is still declared — a mutation's argument needs it as much as a fetch does.
    expect(puppiesApi(built)).toContain('export interface Puppy {');
  });

  test('a verb whose Do never attached leaves no export and no state row behind', () => {
    const ir = cloneIr();
    unwire(ir, ADMIN, 'addBtn:onClick->createRecord:store');
    const built = emitApp(ir, catalog);
    expect(puppiesApi(built)).not.toContain('createPuppy');
    expect(adminSource(built)).not.toContain('createPuppyError');
    expect(reasonFor(ir, ADMIN, 'createRecord')).toBe('its Do is never fired by a translatable trigger');
  });
});

describe('§5 — the gates, each with its named reason', () => {
  test('1: no class name — the runtime never reaches the backend, so neither does the export', () => {
    // Verbatim from the corpus: `puppy-test-3`'s Delete Puppy has no collectionName at all.
    expect(reasonFor(baseIr, ADMIN, 'deleteRecord')).toBe(
      'no class is named, so the runtime answers Failure with "No class name specified" and never calls the backend'
    );
    expect(adminSource(app)).not.toContain('deletePuppy');
  });

  test('2: Id Source from the enclosing repeater', () => {
    const ir = cloneIr();
    setParam(nodeOf(ir, ADMIN, 'updateRecord'), 'idSource', lit('foreach'));
    expect(reasonFor(ir, ADMIN, 'updateRecord')).toBe(
      "its Id Source is the enclosing repeater's row — row identity is not statically knowable in this slice"
    );
  });

  test('3: Store to is Local only', () => {
    const ir = cloneIr();
    setParam(nodeOf(ir, ADMIN, 'updateRecord'), 'storeType', lit('local'));
    expect(reasonFor(ir, ADMIN, 'updateRecord')).toBe(
      'Store to is Local only — an in-memory-only write, and the export holds no record to write into'
    );
  });

  test('4: Properties to store is All', () => {
    const ir = cloneIr();
    setParam(nodeOf(ir, ADMIN, 'updateRecord'), 'storeProperties', lit('all'));
    expect(reasonFor(ir, ADMIN, 'updateRecord')).toBe(
      'Properties to store is All — it sends every field the record holds, and the export holds none of them'
    );
  });

  test('5: access-control rules', () => {
    const ir = cloneIr();
    setParam(nodeOf(ir, ADMIN, 'createRecord'), 'acl-sg9w-target', lit('role'));
    expect(reasonFor(ir, ADMIN, 'createRecord')).toBe(
      'it writes access-control rules with the record — the ACL has no shape in the api stub'
    );
  });

  test('6: a named Backend, and a seeded Create', () => {
    const backend = cloneIr();
    setParam(nodeOf(backend, ADMIN, 'createRecord'), 'backendId', lit('other'));
    expect(reasonFor(backend, ADMIN, 'createRecord')).toBe(
      'it names a specific Backend — one api module per class is all this slice emits'
    );

    const seeded = cloneIr();
    wire(seeded, ADMIN, 'idInput', 'onTextChanged', 'createRecord', 'sourceObjectId');
    expect(reasonFor(seeded, ADMIN, 'createRecord')).toBe(
      'its Source Object Id seeds the new record from an existing one — that read is not translated in this slice'
    );
  });

  test('7: two wires into one property, and two into the Id', () => {
    const props = cloneIr();
    wire(props, ADMIN, 'idInput', 'onTextChanged', 'createRecord', 'prop-name');
    expect(reasonFor(props, ADMIN, 'createRecord')).toBe(
      'two wires feed prop-name — last-writer-wins is not statically ordered'
    );

    const ids = cloneIr();
    wire(ids, ADMIN, 'nameInput-2', 'onTextChanged', 'updateRecord', 'modelId');
    expect(reasonFor(ids, ADMIN, 'updateRecord')).toBe(
      'two wires feed its Id — last-writer-wins is not statically ordered'
    );
  });

  test('9: an Update that names no record answers Failure every time', () => {
    const ir = cloneIr();
    unwire(ir, ADMIN, 'idInput:onTextChanged->updateRecord:modelId');
    expect(reasonFor(ir, ADMIN, 'updateRecord')).toBe(
      'it names no record, so the runtime answers Failure with "Missing Record Id" every time'
    );
  });

  test('11: a consumed Id output, and a consumed Failure pulse', () => {
    const id = cloneIr();
    wire(id, ADMIN, 'createRecord', 'id', 'updateRecord', 'modelId');
    expect(reasonFor(id, ADMIN, 'createRecord')).toBe(
      'its Id output is consumed — the record it names exists only inside the invoking chain, which the relation verbs would need'
    );

    const failure = cloneIr();
    wire(failure, ADMIN, 'createRecord', 'failure', 'navigateLogout', 'navigate', 'signal');
    expect(reasonFor(failure, ADMIN, 'createRecord')).toBe(
      'its failure output is consumed — only the done chain and the Error value are translated in this slice'
    );
  });

  test('a deferred verb does not bind its Error into a render sink', () => {
    // `deleteRecord` is deferred (gate 1) and its Error wire is the third into the status line,
    // so the negative here is about the *first* case: a verb whose Do never attached.
    const ir = cloneIr();
    unwire(ir, ADMIN, 'addBtn:onClick->createRecord:store');
    unwire(ir, ADMIN, 'updateRecord:error->statusText:text');
    unwire(ir, ADMIN, 'deleteRecord:error->statusText:text');
    const source = adminSource(emitApp(ir, catalog));
    expect(source).not.toContain('createPuppyError');
    expect(source).toContain('<p className={styles.statusText} />');
  });
});

describe('§4a — the done chain runs after the await', () => {
  test('a done wire into a Component Outputs signal follows the call inside the try', () => {
    const ir = cloneIr();
    const admin = componentOf(ir, ADMIN);
    admin.nodes.push({
      id: 'outs',
      type: 'Component Outputs',
      catalogRef: 'Component Outputs',
      parameters: [],
      declaredPorts: [{ name: 'saved', plug: 'input', kind: 'signal' }],
      portKnowledge: 'complete'
    });
    wire(ir, ADMIN, 'createRecord', 'done', 'outs', 'saved', 'signal');
    const source = adminSource(emitApp(ir, catalog));
    const awaitAt = source.indexOf('await createPuppy(');
    const chainAt = source.indexOf('onSaved?.();');
    const catchAt = source.indexOf('setCreatePuppyError(');
    expect(awaitAt).toBeGreaterThan(-1);
    // The done chain sits between the await and the catch — `reportOutcomes(…, 'done')`'s own
    // position in the runtime, after the store answers.
    expect(chainAt).toBeGreaterThan(awaitAt);
    expect(catchAt).toBeGreaterThan(chainAt);
  });

  test('a done wire that drives nothing translatable defers the verb by name', () => {
    const ir = cloneIr();
    wire(ir, ADMIN, 'createRecord', 'done', 'statusText', 'text', 'signal');
    expect(reasonFor(ir, ADMIN, 'createRecord')).toBe('its done output drives no translatable action');
  });
});
