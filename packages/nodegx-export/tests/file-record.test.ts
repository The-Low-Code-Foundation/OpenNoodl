import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import { Catalog, CatalogIndex } from '../src/catalog';
import { planProject, tsColumnType } from '../src/analyze/plan';
import { emitApp } from '../src/emit/emitApp';
import { parseProject } from '../src/parse/parseProject';
import { typecheckEmittedApp } from './helpers/typecheckApp';
import { ComponentIR, ExportIR, NodeIR, ParamValue } from '../src/ir/types';

/**
 * EXP-011 §46 — the file ↔ record pair.
 *
 * A stored file goes **into** a record: an Upload File's Cloud File wired into a record verb's
 * `prop-<column>` or a Set User Properties' `prop-<column>` rides the wire as the File envelope
 * `{ __type: 'File', name, url }` — `fileRef()` in `src/api/files.ts`, the shape the runtime's
 * `_serializeObject` writes for a CloudFile in a File-typed column (cloudstore.js) and the tag the
 * backend infers a File column from (`_inferType`). And a stored file comes **out of** a record: a
 * `Cloud File` or a `Sign File URL` fed from a `Record`'s column that the project's schema snapshot
 * declares a File — the Cloud File is a projection of the record's row (`file-field`), the Sign
 * takes the column read as its argument, and a column the snapshot does not type File is refused
 * by name, because the interpreter makes a CloudFile only of a column the snapshot types so.
 *
 * Underneath both: a File column is `CloudFile` wherever the schema is consulted (`tsColumnType`),
 * where it used to read `string`.
 *
 * §A the modules and the types, §B the component, §C every refusal by its sentence — and the one
 * order probe that measures a registered residual, §D the fixture `tests/fixtures/gallery-desk`
 * whole: Log In, User, pick → upload → save into `Photo.image` and onto `_User.avatar`, an Id into
 * a Record, its image into a Cloud File (four Texts and an Image) and into a Sign File URL.
 */

const FIXTURE = path.join(__dirname, 'fixtures', 'gallery-desk');
const CATALOG_PATH = path.join(__dirname, '..', '..', 'noodl-types', 'src', 'node-catalog.json');
const catalog: Catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
const baseIr = parseProject(FIXTURE, catalog);
const app = emitApp(baseIr, catalog);

const HOME = 'Pages/Home';
const cloneIr = (): ExportIR => structuredClone(baseIr);
const withoutBackend = (source: ExportIR = cloneIr()): ExportIR => {
  delete source.project.cloudservices;
  return source;
};
const componentOf = (source: ExportIR, componentPath: string): ComponentIR =>
  source.components.find((c) => c.path === componentPath)!;
const lit = (value: string | number | boolean): ParamValue => ({ kind: 'literal', value });
const wire = (
  source: ExportIR,
  componentPath: string,
  fromId: string,
  fromProperty: string,
  toId: string,
  toProperty: string,
  kind: 'value' | 'signal' = 'value',
  where: 'end' | 'front' = 'end'
) => {
  const c = {
    key: `${fromId}:${fromProperty}->${toId}:${toProperty}`,
    fromId,
    fromProperty,
    toId,
    toProperty,
    kind
  };
  if (where === 'front') componentOf(source, componentPath).connections.unshift(c);
  else componentOf(source, componentPath).connections.push(c);
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
/** Removes logic nodes and every wire touching them (none of these has a parent or children). */
const dropNodes = (source: ExportIR, componentPath: string, ids: string[]) => {
  const component = componentOf(source, componentPath);
  component.nodes = component.nodes.filter((n) => !ids.includes(n.id));
  component.connections = component.connections.filter((c) => !ids.includes(c.fromId) && !ids.includes(c.toId));
};
/** The snapshot's `Photo.image` column, retyped or removed. */
const retypeImage = (source: ExportIR, type: string | null) => {
  const photo = source.project.collections.find((c) => c.name === 'Photo')!;
  photo.columns = photo.columns.filter((c) => c.name !== 'image');
  if (type !== null) photo.columns.push({ name: 'image', type });
};

const fileOf = (built: ReturnType<typeof emitApp>, name: string): string => built.files[name];
const home = (built: ReturnType<typeof emitApp>): string => fileOf(built, 'src/pages/Home.tsx');
const filesApi = (built: ReturnType<typeof emitApp>): string => fileOf(built, 'src/api/files.ts');
const photosApi = (built: ReturnType<typeof emitApp>): string => fileOf(built, 'src/api/photos.ts');
const sessionApi = (built: ReturnType<typeof emitApp>): string => fileOf(built, 'src/api/session.ts');
const client = (built: ReturnType<typeof emitApp>): string => fileOf(built, 'src/api/client.ts');

/** The deferral reason the planner recorded for one node. */
const reasonFor = (source: ExportIR, componentPath: string, nodeId: string): string | undefined => {
  const project = planProject(source, new CatalogIndex(catalog));
  const plan = project.plans.find((p) => p.path === componentPath)!;
  const disposition = plan.dispositions[nodeId] as { kind: string; reason?: string };
  return disposition?.kind === 'deferred' ? disposition.reason : undefined;
};
const dispositionOf = (source: ExportIR, componentPath: string, nodeId: string): string | undefined => {
  const project = planProject(source, new CatalogIndex(catalog));
  const plan = project.plans.find((p) => p.path === componentPath)!;
  return (plan.dispositions[nodeId] as { kind: string } | undefined)?.kind;
};
/** The handler of one button, from `<button` through the try/catch. */
const handlerOf = (source: string, label: string): string => {
  const end = source.indexOf(`\n        ${label}\n      </button>`);
  expect(end).toBeGreaterThan(0);
  const start = source.lastIndexOf('<button', end);
  return source.slice(start, end);
};
/** Runs an emitted TypeScript module by transpiling and evaluating it (the client import stubbed). */
const evalModule = (source: string): Record<string, unknown> => {
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const exports: Record<string, unknown> = {};
  new Function('exports', 'require', js)(exports, () => ({}));
  return exports;
};

const SAVE_CALL = 'await createPhoto({ image: fileRef(photoUploadFile), caption });';
const AVATAR_CALL = 'await setUserProperties({ avatar: fileRef(photoUploadFile) });';
const SIGN_GUARD = "const storedLinkSignedInput = thePhotoRow?.image;\n            if (storedLinkSignedInput === undefined) throw new Error('No file specified');\n            const storedLinkSigned = await signFileUrl(storedLinkSignedInput);";
const NOT_DECLARED =
  'its Cloud File is fed by a Record\'s "image" column, which the project\'s schema snapshot does not declare — the interpreter turns a column into a stored file only where the snapshot types it File';
const NOT_A_FILE =
  'its Cloud File is fed by a Record\'s "image" column, which the project\'s schema snapshot declares as something other than a File — the interpreter turns a column into a stored file only where the snapshot types it File';

describe('§A — the modules and the types', () => {
  test('A1 a File column is `CloudFile` in the collection module, which imports the type — connected and stub alike', () => {
    expect(photosApi(app)).toContain("import type { CloudFile } from './files';");
    expect(photosApi(app)).toContain('export interface Photo {\n  id: string;\n  caption?: string;\n  image?: CloudFile;\n}');
    const stub = emitApp(withoutBackend(), catalog);
    expect(photosApi(stub)).toContain("import type { CloudFile } from './files';");
    expect(photosApi(stub)).toContain('  image?: CloudFile;');
    expect(photosApi(stub)).toContain("throw new Error('createPhoto is not connected to a backend yet')");
  });

  test('A2 `fileRef` is the runtime’s File envelope — run, not read: undefined stays undefined, and only name and url survive', () => {
    const api = filesApi(app);
    expect(api).toContain("  __type?: 'File';");
    expect(api).toContain('export function fileRef(file: CloudFile | undefined): CloudFile | undefined {');
    const { fileRef } = evalModule(api) as { fileRef: (f: unknown) => unknown };
    expect(fileRef(undefined)).toBeUndefined();
    // cloudstore.js `_serializeObject`: `{ __type: 'File', url: cloudFile.getUrl(), name: cloudFile.getName() }` — nothing else.
    expect(fileRef({ name: 'ab12_photo.png', url: 'http://localhost:8584/files/ab12_photo.png', contentType: 'image/png', size: 73 })).toEqual({
      __type: 'File',
      name: 'ab12_photo.png',
      url: 'http://localhost:8584/files/ab12_photo.png'
    });
  });

  test('A3 the session module types the avatar column `CloudFile` and imports it', () => {
    expect(sessionApi(app)).toContain("import type { CloudFile } from './files';");
    expect(sessionApi(app)).toMatch(/export type UserProperties = \{\n  username\?: string;\n  email\?: string;\n  avatar\?: CloudFile;\n\};/);
  });

  test('A4 a File column with no files node at all still gets the types module — no functions, no client import, and it typechecks', () => {
    const ir = cloneIr();
    dropNodes(ir, HOME, ['picker', 'upload', 'cloud', 'cloud2', 'sign', 'create', 'setProps']);
    const built = emitApp(ir, catalog);
    const api = filesApi(built);
    expect(api).toBeDefined();
    expect(api).toContain('export interface CloudFile {');
    expect(api).toContain('export function fileRef(');
    expect(api).not.toContain('export async function');
    expect(api).not.toContain("from './client'");
    expect(photosApi(built)).toContain('  image?: CloudFile;');
    expect(typecheckEmittedApp(built)).toEqual([]);
    const stub = emitApp(withoutBackend(ir), catalog);
    expect(filesApi(stub)).toContain('// @nodegx:generated (api stub');
    expect(typecheckEmittedApp(stub)).toEqual([]);
  });

  test('A5 `tsColumnType`: File is CloudFile; the three scalars unchanged; Date still reads string (registered, §46.3)', () => {
    expect(tsColumnType('File')).toBe('CloudFile');
    expect(tsColumnType('String')).toBe('string');
    expect(tsColumnType('Number')).toBe('number');
    expect(tsColumnType('Boolean')).toBe('boolean');
    expect(tsColumnType('Date')).toBe('string');
  });
});

describe('§B — the component', () => {
  test('B1 Save: the upload’s row into the record’s column, wrapped, and the helper imported', () => {
    expect(handlerOf(home(app), 'Save photo')).toContain(SAVE_CALL);
    expect(home(app)).toContain("import { cloudFileName, fileRef, signFileUrl, uploadFile, type CloudFile, type SignedFileUrl } from '../api/files';");
  });

  test('B2 Use as avatar: the same row onto the signed-in user', () => {
    expect(handlerOf(home(app), 'Use as avatar')).toContain(AVATAR_CALL);
  });

  test('B3 the Cloud File fed from the record collapses into four reads off the row and the Image’s src', () => {
    const page = home(app);
    expect(page).toContain("{thePhotoRow?.image?.url ?? ''}");
    expect(page).toContain("{(thePhotoRow?.image === undefined ? undefined : cloudFileName(thePhotoRow?.image)) ?? ''}");
    expect(page).toContain("{thePhotoRow?.image?.contentType ?? ''}");
    expect(page).toContain("{String(thePhotoRow?.image?.size ?? '')}");
    expect(page).toContain('src={thePhotoRow?.image?.url}');
    expect(dispositionOf(baseIr, HOME, 'cloud2')).toBe('collapsed');
  });

  test('B4 the Sign fed from the record takes the column read as its argument, guarded — a sibling handler of the Id effect', () => {
    expect(handlerOf(home(app), 'Sign the stored link')).toContain(SIGN_GUARD);
  });

  test('B5 the record’s row and its Id effect are both there (the late sweep kept a fired node’s row)', () => {
    expect(home(app)).toContain('useState<Photo | undefined>()');
    expect(home(app)).toContain('await fetchPhotoById(thePhotoRecordId)');
  });

  test('B6 inside the Record’s own Done chain the Cloud File reads the chain-local', () => {
    const ir = cloneIr();
    addNode(componentOf(ir, HOME), { id: 'urlSet', type: 'Set Variable', parameters: [{ name: 'name', value: lit('lastUrl') }] });
    wire(ir, HOME, 'record', 'done', 'urlSet', 'do', 'signal');
    wire(ir, HOME, 'cloud2', 'url', 'urlSet', 'value');
    const built = emitApp(ir, catalog);
    expect(home(built)).toContain('lastUrl.set(thePhotoRecord.image?.url)');
    expect(typecheckEmittedApp(built)).toEqual([]);
  });

  test('B7 a File column straight into a Text prints the object through String() — the interpreter’s own answer', () => {
    const ir = cloneIr();
    unwire(ir, HOME, 'record:prop-caption->captionText:text');
    wire(ir, HOME, 'record', 'prop-image', 'captionText', 'text');
    const built = emitApp(ir, catalog);
    expect(home(built)).toContain("{String(thePhotoRow?.image ?? '')}");
    expect(typecheckEmittedApp(built)).toEqual([]);
  });

  test('B8 a record’s File column into another record’s column — wrapped the same way', () => {
    const ir = cloneIr();
    unwire(ir, HOME, 'upload:cloudFile->create:prop-image');
    wire(ir, HOME, 'record', 'prop-image', 'create', 'prop-image');
    const built = emitApp(ir, catalog);
    // Wire order decides the body's order (§1's accumulate rule): the appended wire comes last.
    expect(handlerOf(home(built), 'Save photo')).toContain('await createPhoto({ caption, image: fileRef(thePhotoRow?.image) });');
    expect(typecheckEmittedApp(built)).toEqual([]);
  });

  test('B9 a column the snapshot lacks, written from an upload, types CloudFile — the graph is the evidence', () => {
    const ir = cloneIr();
    wire(ir, HOME, 'upload', 'cloudFile', 'create', 'prop-thumb');
    const built = emitApp(ir, catalog);
    expect(photosApi(built)).toContain('  thumb?: CloudFile;');
    expect(handlerOf(home(built), 'Save photo')).toContain('thumb: fileRef(photoUploadFile)');
    expect(typecheckEmittedApp(built)).toEqual([]);
  });

  test('B11 a Name read only in render, off a record’s column, earns the helper’s import on its own (the second walker)', () => {
    // The fixture has two earners of `cloudFileName` — the upload's Name in the Save handler and
    // the record's Name in a Text. Remove the first; the import must survive on the second alone.
    const ir = cloneIr();
    unwire(ir, HOME, 'cloud:name->lastSavedSet:value');
    wire(ir, HOME, 'captionInput', 'onTextChanged', 'lastSavedSet', 'value');
    const built = emitApp(ir, catalog);
    expect(home(built)).not.toContain('lastSaved.set((photoUploadFile');
    expect(home(built)).toMatch(/import \{ [^}]*cloudFileName[^}]* \} from '\.\.\/api\/files';/);
    expect(typecheckEmittedApp(built)).toEqual([]);
  });

  test('B10 the envelope is built in exactly one place — the client is untouched by this slice', () => {
    expect(client(app)).not.toContain('__type');
    const sites = Object.entries(app.files).filter(([, source]) => source.includes("__type: 'File'"));
    expect(sites.map(([name]) => name)).toEqual(['src/api/files.ts']);
    // Once in code (the doc comment above it quotes the runtime's literal, which is not a site).
    expect(filesApi(app).match(/\{ __type: 'File', name: file\.name, url: file\.url \}/g)).toHaveLength(1);
  });
});

describe('§C — refused by name, and one order probe', () => {
  test('C1 a Cloud File fed from a column the snapshot does not declare, or declares a String', () => {
    const undeclared = cloneIr();
    retypeImage(undeclared, null);
    expect(reasonFor(undeclared, HOME, 'cloud2')).toBe(NOT_DECLARED);
    const string = cloneIr();
    retypeImage(string, 'String');
    expect(reasonFor(string, HOME, 'cloud2')).toBe(NOT_A_FILE);
    // The control: declared File, nothing refused.
    expect(reasonFor(cloneIr(), HOME, 'cloud2')).toBeUndefined();
  });

  test('C2 a Sign fed from a String column — the same sentence, about its File', () => {
    const string = cloneIr();
    retypeImage(string, 'String');
    expect(reasonFor(string, HOME, 'sign')).toBe(NOT_A_FILE.replace('its Cloud File is fed', 'its File is fed'));
  });

  test('C3 an upload’s Cloud File into a Delete’s column — a delete writes nothing, so the upload names the sink', () => {
    const ir = cloneIr();
    addNode(componentOf(ir, HOME), { id: 'del', type: 'DeleteDbModelProperties', parameters: [{ name: 'collectionName', value: lit('Photo') }] });
    wire(ir, HOME, 'upload', 'cloudFile', 'del', 'prop-image');
    expect(reasonFor(ir, HOME, 'upload')).toBe(
      "its Cloud File output is wired into DeleteDbModelProperties — a stored-file reference is read only by a Cloud File, a Sign File URL, a record verb's column or a Set User Properties' column in this slice"
    );
  });

  test('C4 the order probe: the Id effect’s column is readable from a sibling handler wired first or last', () => {
    const first = cloneIr();
    unwire(first, HOME, 'record:prop-image->sign:file');
    unwire(first, HOME, 'signBtn:onClick->sign:sign');
    wire(first, HOME, 'signBtn', 'onClick', 'sign', 'sign', 'signal', 'front');
    wire(first, HOME, 'record', 'prop-image', 'sign', 'file', 'value', 'front');
    expect(reasonFor(first, HOME, 'sign')).toBeUndefined();
    expect(handlerOf(home(emitApp(first, catalog)), 'Sign the stored link')).toContain(SIGN_GUARD);
    const reversed = cloneIr();
    componentOf(reversed, HOME).connections.reverse();
    expect(reasonFor(reversed, HOME, 'sign')).toBeUndefined();
    expect(typecheckEmittedApp(emitApp(reversed, catalog))).toEqual([]);
  });

  test('C5 the registered residual, measured: a Record fetched by a button is not readable by a sibling handler in either wire order (§46.3)', () => {
    // Measured, not designed: `attachedRecordNodes` is filled by the earn scan after Pass 2 has
    // compiled every handler, so a sibling's read sees an unattached node whichever wire comes
    // first. §43's contract (a Fetch wired from nothing translatable leaves no row) keeps
    // `recordWillFire` off the trigger form; the effect form (C4) is the one that carries.
    const last = cloneIr();
    addNode(componentOf(last, HOME), { id: 'loadBtn', type: 'net.noodl.controls.button', parameters: [{ name: 'label', value: lit('Load') }], parent: 'shell' } as never);
    componentOf(last, HOME).nodes.find((n) => n.id === 'shell')!.children!.push('loadBtn');
    wire(last, HOME, 'loadBtn', 'onClick', 'record', 'fetch', 'signal');
    expect(reasonFor(last, HOME, 'sign')).toBe('its Fetch is never fired by a translatable trigger');
    const first = structuredClone(last);
    const fetchWire = componentOf(first, HOME).connections.pop()!;
    componentOf(first, HOME).connections.unshift(fetchWire);
    expect(reasonFor(first, HOME, 'sign')).toBe('its Fetch is never fired by a translatable trigger');
    // The control: the record itself attached in both orders — the row is fetched, only the sibling cannot read it.
    expect(reasonFor(last, HOME, 'record')).toBeUndefined();
    expect(reasonFor(first, HOME, 'record')).toBeUndefined();
  });
});

describe('§D — the fixture, whole', () => {
  test('D1 nothing refused: every node on the page has a rule', () => {
    const report = fileOf(app, 'EXPORT-REPORT.md');
    expect(report).toContain('Every node and every wire in this project had a translation, and the export refused none of them.');
    expect(report).not.toContain('(deferred to');
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

  test('D4 the sites, counted: two envelopes, one sign, two names, two guards, two functions in the collection module', () => {
    expect(home(app).match(/fileRef\(/g)).toHaveLength(2);
    expect(home(app).match(/await signFileUrl\(/g)).toHaveLength(1);
    expect(home(app).match(/cloudFileName\(/g)).toHaveLength(2);
    expect(home(app).match(/throw new Error\('No file specified'\)/g)).toHaveLength(2);
    expect(photosApi(app).match(/^export async function /gm)).toHaveLength(2);
  });

  test('D5 the no-backend export of the same fixture typechecks too', () => {
    expect(typecheckEmittedApp(emitApp(withoutBackend(), catalog))).toEqual([]);
  });
});
