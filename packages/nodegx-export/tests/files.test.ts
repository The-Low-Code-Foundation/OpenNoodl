import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import { Catalog, CatalogIndex, loadCatalog } from '../src/catalog';
import { planProject } from '../src/analyze/plan';
import { emitApp } from '../src/emit/emitApp';
import { parseProject } from '../src/parse/parseProject';
import { typecheckEmittedApp } from './helpers/typecheckApp';
import { ComponentIR, ExportIR, NodeIR, ParamValue } from '../src/ir/types';

/**
 * EXP-011 §45 — the files: `Open File Picker`, `Upload File`, `Cloud File` and `Sign File URL`.
 *
 * One value flows through four nodes. The picker's `File` (a browser `File`) goes into the
 * upload; the upload's `Cloud File` (`{ name, url, contentType?, size? }` — the 201 body of
 * `POST /files/<name>`) goes into a `Cloud File` read or a `Sign File URL`'s `GET /files/<name>/sign`.
 * The picker is `pickFile()` in `src/lib/util.ts` — the node's `<input type=file>` as one promise
 * with three answers (a File / undefined / a rejection), which are the node's Done / Unchanged /
 * Failure. `Cloud File` compiles away into a projection of the upload's row, its `Name` through
 * `cloudFileName()` (the storage prefix stripped, as the node's own getter strips it).
 *
 * The shape is the Record's, three nodes over: a chain reads the local, everything else reads the
 * row, only `Error` inside Failure — **and one new thing**: the upload button reads the file the
 * pick button chose, a sibling handler reading another node's row, which no earlier family had.
 *
 * §A the files module, the client and the util helper, §B the component, §C every refusal by its
 * sentence, §D the fixture `tests/fixtures/photo-desk` — Log In, User, the four nodes, an Image on
 * the stored url — exported whole, typechecked, parsed, with nothing refused.
 */

const FIXTURE = path.join(__dirname, 'fixtures', 'photo-desk');
const catalog: Catalog = loadCatalog();
const baseIr = parseProject(FIXTURE, catalog);
const app = emitApp(baseIr, catalog);

const HOME = 'Pages/Home';
const cloneIr = (): ExportIR => structuredClone(baseIr);
const withoutBackend = (): ExportIR => {
  const ir = cloneIr();
  delete ir.project.cloudservices;
  return ir;
};
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

const fileOf = (built: ReturnType<typeof emitApp>, name: string): string => built.files[name];
const home = (built: ReturnType<typeof emitApp>): string => fileOf(built, 'src/pages/Home.tsx');
const filesApi = (built: ReturnType<typeof emitApp>): string => fileOf(built, 'src/api/files.ts');
const client = (built: ReturnType<typeof emitApp>): string => fileOf(built, 'src/api/client.ts');
const util = (built: ReturnType<typeof emitApp>): string => fileOf(built, 'src/lib/util.ts');

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

/** The body of one exported function of a module, from its signature line to its closing brace. */
const fnBody = (source: string, signature: string): string => {
  const start = source.indexOf(signature);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = source.indexOf('\n}\n', start);
  return source.slice(start, end);
};
/** The handler of one button, from `onClick={async () => {` through the try/catch. */
const handlerOf = (source: string, label: string): string => {
  const end = source.indexOf(`\n        ${label}\n      </button>`);
  expect(end).toBeGreaterThan(0);
  const start = source.lastIndexOf('<button', end);
  return source.slice(start, end);
};

/** Runs an emitted TypeScript function by transpiling the module and evaluating it. */
const evalModule = (source: string): Record<string, unknown> => {
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const exports: Record<string, unknown> = {};
  // The files module imports the client — stub it, this grades the pure helper only.
  new Function('exports', 'require', js)(exports, () => ({}));
  return exports;
};

const PICK_CALL = "const photoPickerPicked = await pickFile({ accept: 'image/*' });";
const UPLOAD_CALL = 'const photoUploadStored = await uploadFile(photoPickerFile, { private: privateChecked });';
const SIGN_CALL = 'const photoLinkSigned = await signFileUrl(photoUploadFile);';

describe('§A — the files module, the client and the util helper', () => {
  test('A1 connected: the two types, cloudFileName, and the two functions over the client’s requests', () => {
    const api = filesApi(app);
    expect(api).toContain("import { signFileUrlRequest, uploadFileRequest } from './client';");
    // §46 added the wire's tag as an optional member — a file read back from a record column carries it.
    expect(api).toContain("export interface CloudFile {\n  name: string;\n  url: string;\n  contentType?: string;\n  size?: number;\n  /** The wire's tag on a file read back from a record column, and what `fileRef()` writes. */\n  __type?: 'File';\n}");
    expect(api).toContain(
      "export interface SignedFileUrl {\n  url: string;\n  kind: 'signed' | 'token' | 'public';\n  isShareable: boolean;\n  expiresAt?: string;\n  ttlSeconds?: number;\n}"
    );
    expect(api).toContain(
      'export async function uploadFile(file: File, options: { private?: unknown } = {}): Promise<CloudFile> {\n' +
        '  return uploadFileRequest(file, Boolean(options.private));\n}'
    );
    expect(api).toContain(
      'export async function signFileUrl(file: CloudFile): Promise<SignedFileUrl> {\n' +
        '  const signed = await signFileUrlRequest(file.name);\n'
    );
    expect(api).toContain("return { ...signed, kind: 'signed', isShareable: true };");
    expect(api).toContain('Source: "Photo upload" (Upload File `upload` on /Pages/Home)');
    expect(api).toContain('Source: "Photo link" (Sign File URL `sign` on /Pages/Home)');
  });

  test('A2 cloudFileName strips the wire’s storage prefix exactly as cloudfilenode.ts does — run, not read', () => {
    const mod = evalModule(filesApi(app)) as { cloudFileName: (f: { name: string; url: string }) => string };
    expect(mod.cloudFileName({ name: 'ab12cd34_my photo.png', url: '' })).toBe('my photo.png');
    // Two underscores in the original: everything after the first is the name (`slice(1).join('_')`).
    expect(mod.cloudFileName({ name: 'ab12cd34_my_photo.png', url: '' })).toBe('my_photo.png');
    // No prefix at all: the name is the name.
    expect(mod.cloudFileName({ name: 'photo.png', url: '' })).toBe('photo.png');
  });

  test('A3 stub: both throw — a fabricated stored file would be a success report for bytes nobody stored', () => {
    const built = emitApp(withoutBackend(), catalog);
    const api = filesApi(built);
    expect(api).not.toContain("from './client'");
    expect(api).toContain("throw new Error('uploadFile is not connected to a backend yet');");
    expect(api).toContain("throw new Error('signFileUrl is not connected to a backend yet');");
    expect(built.files['src/api/client.ts']).toBeUndefined();
    // The page is unchanged: the handlers call the same two functions.
    expect(home(built)).toContain(UPLOAD_CALL);
    expect(home(built)).toContain(SIGN_CALL);
  });

  test('A4 the client: POST /files/<name> with the bytes as the body and the private header; GET /files/<name>/sign', () => {
    const upload = fnBody(client(app), 'export async function uploadFileRequest(');
    expect(upload).toContain('return request(`/files/${encodeURIComponent(file.name)}`, {');
    expect(upload).toContain("method: 'POST',\n    file,\n    headers: isPrivate ? { 'X-NodeGX-File-Private': 'true' } : undefined");
    const sign = fnBody(client(app), 'export async function signFileUrlRequest(name: string)');
    expect(sign).toContain('return request(`/files/${encodeURIComponent(name)}/sign`);');
  });

  test('A5 request(): a file is the body itself, with no JSON content type — and the §43 cardinality holds: two fetch sites, two wraps', () => {
    const body = fnBody(client(app), 'async function request<T>(');
    expect(body).toContain("...(options.file === undefined ? { 'Content-Type': 'application/json' } : {}),");
    expect(body).toContain('body: options.file !== undefined ? options.file : options.body === undefined ? undefined : JSON.stringify(options.body)');
    expect(client(app).match(/await fetch\(/g)).toHaveLength(2);
    expect(client(app).match(/throw new Error\(`Could not reach the backend at \$\{ENDPOINT\}`\);/g)).toHaveLength(2);
  });

  test('A6 pickFile in src/lib/util.ts: the node’s three answers, the input attached for the dialog and removed as it settles', () => {
    const helper = fnBody(util(app), 'export function pickFile(');
    expect(helper).toContain("const input = document.createElement('input');\n    input.type = 'file';");
    expect(helper).toContain('input.onchange = () => settle(input.files && input.files.length > 0 ? input.files[0] : undefined);');
    expect(helper).toContain('input.oncancel = () => settle(undefined);');
    expect(helper).toContain('document.body.appendChild(input);');
    expect(helper).toContain('input.remove();\n      resolve(file);');
    expect(helper).toContain("reject(new Error('Could not open the file picker: ' + (e instanceof Error && e.message ? e.message : String(e))));");
    // The settings are applied only where set — a blank accept offers every file, the node's own contract.
    expect(helper).toContain("if (options.accept !== undefined && options.accept !== null && options.accept !== '') input.accept = String(options.accept);");
  });

  test('A7 the util library is earned by the picker: a project with no picker imports no pickFile', () => {
    const ir = cloneIr();
    unwire(ir, HOME, 'pickBtn:onClick->picker:open');
    const built = emitApp(ir, catalog);
    expect(home(built)).not.toContain('pickFile');
    expect(built.files['src/lib/util.ts']).toBeUndefined();
  });
});

describe('§B — the component', () => {
  test('B1 the picker: three arms in the node’s order — Unchanged binds nothing, Done writes the row, the catch writes the Error', () => {
    const handler = handlerOf(home(app), 'Choose a photo');
    expect(handler).toContain(PICK_CALL);
    const unchanged = handler.indexOf("if (photoPickerPicked === undefined) {\n              pickNote.set('nothing chosen');");
    const done = handler.indexOf('} else {\n              setPhotoPickerFile(photoPickerPicked);\n              pickNote.set(photoPickerPicked.name);');
    const fail = handler.indexOf(
      '} catch (error) {\n            const photoPickerMessage = error instanceof Error ? error.message : String(error);\n            setPhotoPickerError(photoPickerMessage);'
    );
    expect(unchanged).toBeGreaterThan(0);
    expect(done).toBeGreaterThan(unchanged);
    expect(fail).toBeGreaterThan(done);
  });

  test('B2 the picker’s outputs in render read the row: Name folds, Size is coerced, Error is its own row', () => {
    const page = home(app);
    expect(page).toContain('const [photoPickerFile, setPhotoPickerFile] = useState<File | undefined>();');
    expect(page).toContain("{photoPickerFile?.name ?? ''}");
    expect(page).toContain("{String(photoPickerFile?.size ?? '')}");
    expect(page).toContain('{photoPickerError}');
  });

  test('B3 the upload button reads the pick button’s row — a sibling handler, guarded with the node’s own sentence', () => {
    const handler = handlerOf(home(app), 'Upload');
    const guard = handler.indexOf("if (photoPickerFile === undefined) throw new Error('No file specified');");
    const call = handler.indexOf(UPLOAD_CALL);
    const row = handler.indexOf('setPhotoUploadFile(photoUploadStored);');
    // The Done chain's Cloud File is the upload's own local, its Name through the helper.
    const chain = handler.indexOf('lastUpload.set(cloudFileName(photoUploadStored));');
    expect(guard).toBeGreaterThan(0);
    expect(call).toBeGreaterThan(guard);
    expect(row).toBeGreaterThan(call);
    expect(chain).toBeGreaterThan(row);
    expect(handler).toContain('setPhotoUploadError(photoUploadMessage);');
  });

  test('B4 Cloud File compiles away: its four outputs read the upload’s row, Name guarded through cloudFileName, and the Image takes the url', () => {
    const page = home(app);
    expect(page).toContain('const [photoUploadFile, setPhotoUploadFile] = useState<CloudFile | undefined>();');
    expect(page).toContain("{photoUploadFile?.url ?? ''}");
    expect(page).toContain("{(photoUploadFile === undefined ? undefined : cloudFileName(photoUploadFile)) ?? ''}");
    expect(page).toContain("{photoUploadFile?.contentType ?? ''}");
    expect(page).toContain("{String(photoUploadFile?.size ?? '')}");
    expect(page).toContain('<img className={styles.preview} src={photoUploadFile?.url} />');
    expect(dispositionOf(baseIr, HOME, 'cloud')).toBe('collapsed');
    expect(page).not.toContain('TODO(export)');
  });

  test('B5 the sign: the upload’s row as the argument, guarded; the Done chain reads the minted link’s local', () => {
    const handler = handlerOf(home(app), 'Sign the link');
    const guard = handler.indexOf("if (photoUploadFile === undefined) throw new Error('No file specified');");
    const call = handler.indexOf(SIGN_CALL);
    expect(guard).toBeGreaterThan(0);
    expect(call).toBeGreaterThan(guard);
    expect(handler).toContain('setPhotoLinkUrl(photoLinkSigned);\n            lastSigned.set(photoLinkSigned.url);');
    expect(handler).toContain('setPhotoLinkError(photoLinkMessage);');
  });

  test('B6 the sign’s five outputs in render, typed by the wire: strings fold, Safe To Share and TTL are coerced', () => {
    const page = home(app);
    expect(page).toContain('const [photoLinkUrl, setPhotoLinkUrl] = useState<SignedFileUrl | undefined>();');
    expect(page).toContain("{photoLinkUrl?.url ?? ''}");
    expect(page).toContain("{photoLinkUrl?.kind ?? ''}");
    expect(page).toContain("{String(photoLinkUrl?.isShareable ?? '')}");
    expect(page).toContain("{photoLinkUrl?.expiresAt ?? ''}");
    expect(page).toContain("{String(photoLinkUrl?.ttlSeconds ?? '')}");
    expect(page).toContain("import { cloudFileName, signFileUrl, uploadFile, type CloudFile, type SignedFileUrl } from '../api/files';");
    expect(page).toContain("import { pickFile } from '../lib/util';");
  });

  test('B7 a checkbox labelled "Private" wired into Private mints state — and not a reserved word', () => {
    const page = home(app);
    expect(page).toContain('const [privateChecked, setPrivateChecked] = useState<boolean>(false);');
    expect(page).not.toMatch(/const \[private,/);
    expect(page).toContain('checked={privateChecked}');
  });

  test('B8 Private authored true is a literal; unset or false sends no options at all', () => {
    const authored = cloneIr();
    unwire(authored, HOME, 'privateCheck:checked->upload:private');
    setParam(nodeOf(authored, HOME, 'upload'), 'private', lit(true));
    expect(home(emitApp(authored, catalog))).toContain('await uploadFile(photoPickerFile, { private: true });');

    const unset = cloneIr();
    unwire(unset, HOME, 'privateCheck:checked->upload:private');
    expect(home(emitApp(unset, catalog))).toContain('await uploadFile(photoPickerFile);');
  });

  test('B9 an upload fired from the picker’s Done runs inside it, on the chain’s local — a File by type, no guard', () => {
    const ir = cloneIr();
    unwire(ir, HOME, 'uploadBtn:onClick->upload:upload');
    wire(ir, HOME, 'picker', 'done', 'upload', 'upload', 'signal');
    const handler = handlerOf(home(emitApp(ir, catalog)), 'Choose a photo');
    expect(handler).toContain('const photoUploadStored = await uploadFile(photoPickerPicked, { private: privateChecked });');
    expect(handler).not.toContain("throw new Error('No file specified')");
    // The row is still written: the render reads outside the chain need it.
    expect(handler).toContain('setPhotoPickerFile(photoPickerPicked);');
  });

  test('B10 an upload nothing reads outside its chain has no row, and still its Error row', () => {
    const ir = cloneIr();
    for (const key of [
      'upload:cloudFile->cloud:file',
      'upload:cloudFile->sign:file',
      'upload:done->lastUploadSet:do',
      'cloud:name->lastUploadSet:value',
      'signBtn:onClick->sign:sign'
    ]) {
      unwire(ir, HOME, key);
    }
    const page = home(emitApp(ir, catalog));
    expect(page).toContain('await uploadFile(photoPickerFile, { private: privateChecked });');
    expect(page).not.toContain('setPhotoUploadFile(');
    expect(page).not.toContain('useState<CloudFile | undefined>');
    expect(page).toContain('setPhotoUploadError(photoUploadMessage);');
    expect(page).toContain("import { uploadFile } from '../api/files';");
  });

  test('B11 the picker’s Failure chain reads the arm’s own message; a Cloud File read from the upload’s Failure chain defers', () => {
    const fail = cloneIr();
    addNode(componentOf(fail, HOME), { id: 'pickFailSet', type: 'Set Variable', parameters: [{ name: 'name', value: lit('pickNote') }] });
    wire(fail, HOME, 'picker', 'failure', 'pickFailSet', 'do', 'signal');
    wire(fail, HOME, 'picker', 'error', 'pickFailSet', 'value');
    const handler = handlerOf(home(emitApp(fail, catalog)), 'Choose a photo');
    // EXP-011 §54. The raise (open-file-picker/open-failed) sits between the row and the chain.
    expect(handler).toContain('setPhotoPickerError(photoPickerMessage);\n            raiseAppError({ code: \'open-file-picker/open-failed\', message: photoPickerMessage, nodeId: \'picker\', nodeType: \'Open File Picker\', componentName: \'/Pages/Home\' });\n            pickNote.set(photoPickerMessage);');

    const wrong = cloneIr();
    addNode(componentOf(wrong, HOME), { id: 'urlOnFail', type: 'Set Variable', parameters: [{ name: 'name', value: lit('lastUpload') }] });
    wire(wrong, HOME, 'upload', 'failure', 'urlOnFail', 'do', 'signal');
    wire(wrong, HOME, 'cloud', 'url', 'urlOnFail', 'value');
    expect(reasonFor(wrong, HOME, 'upload')).toBe(
      "its url is read from the Failure chain — that arm runs where nothing arrived, and the value the interpreter holds there is the previous upload's"
    );
  });

  test('B12 a picker nobody fires: the upload that reads it defers with the picker’s reason, and no row is left behind', () => {
    const ir = cloneIr();
    unwire(ir, HOME, 'pickBtn:onClick->picker:open');
    expect(reasonFor(ir, HOME, 'picker')).toBe('its Open is never fired by a translatable trigger');
    expect(reasonFor(ir, HOME, 'upload')).toBe('its Open is never fired by a translatable trigger');
    const page = home(emitApp(ir, catalog));
    expect(page).not.toContain('photoPickerFile');
    expect(page).not.toContain('uploadFile(');
  });

  test('B13 the dialog’s settings wired: a text input into Accepted file types earns state and the call reads it', () => {
    const ir = cloneIr();
    addNode(componentOf(ir, HOME), {
      id: 'acceptInput',
      type: 'net.noodl.controls.textinput',
      authoredLabel: 'Accept',
      parent: 'shell',
      parameters: [{ name: 'placeholder', value: lit('Accept') }]
    } as Partial<NodeIR> & { id: string; type: string });
    nodeOf(ir, HOME, 'shell').children!.push('acceptInput');
    wire(ir, HOME, 'acceptInput', 'onTextChanged', 'picker', 'acceptedFileTypes');
    setParam(nodeOf(ir, HOME, 'picker'), 'capture', lit('environment'));
    const page = home(emitApp(ir, catalog));
    expect(page).toContain('const [accept, setAccept] = useState<string>');
    expect(page).toContain("const photoPickerPicked = await pickFile({ accept: accept, capture: 'environment' });");
  });

  test('B15 a Name read only from a handler still earns the helper’s import — the action walker, not just the render one', () => {
    const ir = cloneIr();
    unwire(ir, HOME, 'cloud:name->nameText:text');
    const built = emitApp(ir, catalog);
    expect(home(built)).toContain('lastUpload.set(cloudFileName(photoUploadStored));');
    expect(home(built)).toContain("import { cloudFileName, signFileUrl, uploadFile, type CloudFile, type SignedFileUrl } from '../api/files';");
    expect(typecheckEmittedApp(built)).toEqual([]);
  });

  test('B16 an upload is a backend request: with no session call and no query, the files module still earns the client', () => {
    const ir = cloneIr();
    for (const key of [
      'usernameInput:onTextChanged->login:username',
      'passwordInput:onTextChanged->login:password',
      'loginBtn:onClick->login:login',
      'login:error->loginErrorText:text',
      'me:username->whoText:text'
    ]) {
      unwire(ir, HOME, key);
    }
    const built = emitApp(ir, catalog);
    expect(built.files['src/api/session.ts']).toBeUndefined();
    expect(built.files['src/api/client.ts']).toBeDefined();
    expect(filesApi(built)).toContain("from './client'");
    expect(typecheckEmittedApp(built)).toEqual([]);
  });

  test('B14 the report names the connected module', () => {
    expect(app.notes.join('\n')).toContain("api modules connect to the project's NodeGX backend at http://localhost:8583");
  });
});

describe('§C — refused by name', () => {
  test('C1 the picker’s Path — the desktop app’s, blank in a browser', () => {
    const ir = cloneIr();
    wire(ir, HOME, 'picker', 'path', 'pickedNameText', 'text');
    expect(reasonFor(ir, HOME, 'picker')).toBe("its Path output is consumed — it is the desktop app's, and a browser never supplies a file's path");
  });

  test('C2 a consumed Completed, on all three', () => {
    for (const id of ['picker', 'upload', 'sign']) {
      const ir = cloneIr();
      wire(ir, HOME, id, 'completed', 'pickNoteCancel', 'do', 'signal');
      expect(reasonFor(ir, HOME, id)).toBe(
        'its Completed output is consumed — that pulse fires once however the action ended, and this slice emits the arms rather than their join'
      );
    }
  });

  test('C3 the upload’s progress family — XMLHttpRequest’s events, which fetch() does not publish', () => {
    const ir = cloneIr();
    wire(ir, HOME, 'upload', 'progressLoadedPercent', 'sizeText', 'text');
    expect(reasonFor(ir, HOME, 'upload')).toBe(
      "its progressLoadedPercent output is consumed — the progress family rides XMLHttpRequest's upload events, which fetch() does not publish"
    );
  });

  test('C4 Error Status Code, on the upload and the sign', () => {
    for (const id of ['upload', 'sign']) {
      const ir = cloneIr();
      wire(ir, HOME, id, 'errorStatus', 'ttlText', 'text');
      expect(reasonFor(ir, HOME, id)).toBe(
        "its Error Status Code is consumed — the HTTP status the backend refused with, which the client's one sentence does not carry"
      );
    }
  });

  test('C5 Cloud File wired into a Text — a stored-file reference has no other sink', () => {
    const ir = cloneIr();
    wire(ir, HOME, 'upload', 'cloudFile', 'urlText', 'text');
    expect(reasonFor(ir, HOME, 'upload')).toBe(
      "its Cloud File output is wired into Text — a stored-file reference is read only by a Cloud File, a Sign File URL, a record verb's column or a Set User Properties' column in this slice"
    );
  });

  test('C6 a named Backend, on the upload and the sign; _active_ and blank are the default', () => {
    const named = cloneIr();
    setParam(nodeOf(named, HOME, 'upload'), 'backendId', lit('other'));
    expect(reasonFor(named, HOME, 'upload')).toBe(
      'it uploads to the backend "other" rather than the project\'s active one — a second backend is not in this slice'
    );
    setParam(nodeOf(named, HOME, 'sign'), 'backendId', lit('other'));
    expect(reasonFor(named, HOME, 'sign')).toBe(
      'it signs on the backend "other" rather than the project\'s active one — a second backend is not in this slice'
    );
    const active = cloneIr();
    setParam(nodeOf(active, HOME, 'upload'), 'backendId', lit('_active_'));
    setParam(nodeOf(active, HOME, 'sign'), 'backendId', lit(''));
    expect(reasonFor(active, HOME, 'upload')).toBeUndefined();
    expect(reasonFor(active, HOME, 'sign')).toBeUndefined();
  });

  test('C7 a File Location input set — Supabase’s and PocketBase’s, inert on this wire', () => {
    const bucket = cloneIr();
    setParam(nodeOf(bucket, HOME, 'upload'), 'bucket', lit('avatars'));
    expect(reasonFor(bucket, HOME, 'upload')).toBe(
      "its Bucket (Supabase) is set — the File Location group addresses Supabase and PocketBase, and the project's NodeGX backend stores files independently and never reads it"
    );
    const collection = cloneIr();
    wire(collection, HOME, 'usernameInput', 'onTextChanged', 'upload', 'collection');
    expect(reasonFor(collection, HOME, 'upload')).toBe(
      "its Collection (PocketBase) is set — the File Location group addresses Supabase and PocketBase, and the project's NodeGX backend stores files independently and never reads it"
    );
  });

  test('C8 the upload’s File fed by anything but a picker; no File at all', () => {
    const variable = cloneIr();
    unwire(variable, HOME, 'picker:file->upload:file');
    wire(variable, HOME, 'lastUploadRead', 'value', 'upload', 'file');
    expect(reasonFor(variable, HOME, 'upload')).toBe(
      'its File is fed by Variable2.value — this slice uploads the file an Open File Picker chose'
    );
    const none = cloneIr();
    unwire(none, HOME, 'picker:file->upload:file');
    expect(reasonFor(none, HOME, 'upload')).toBe(
      'nothing feeds its File — every Upload answers Failure with "No file specified" and never sends a request'
    );
  });

  test('C9 the sign’s File: nothing wired, fed by a Variable, two wires', () => {
    const none = cloneIr();
    unwire(none, HOME, 'upload:cloudFile->sign:file');
    expect(reasonFor(none, HOME, 'sign')).toBe(
      'nothing feeds its File input — every Sign answers Failure with "No file specified" and never sends a request'
    );
    const variable = cloneIr();
    unwire(variable, HOME, 'upload:cloudFile->sign:file');
    wire(variable, HOME, 'lastUploadRead', 'value', 'sign', 'file');
    expect(reasonFor(variable, HOME, 'sign')).toBe(
      "its File is fed by Variable2.value — this slice reads a stored file only from an Upload File node's Cloud File output or a Record's File-typed column"
    );
    const two = cloneIr();
    wire(two, HOME, 'lastUploadRead', 'value', 'sign', 'file');
    expect(reasonFor(two, HOME, 'sign')).toBe('two wires feed its File — last-writer-wins is not statically ordered');
  });

  test('C10 Cloud File with nothing wired, and fed by a Record’s column — every wire off it defers with the reason', () => {
    const none = cloneIr();
    unwire(none, HOME, 'upload:cloudFile->cloud:file');
    expect(reasonFor(none, HOME, 'cloud')).toBe('nothing feeds its Cloud File input — every output reads empty');
    expect(home(emitApp(none, catalog))).not.toContain('photoUploadFile?.url');

    const record = cloneIr();
    unwire(record, HOME, 'upload:cloudFile->cloud:file');
    addNode(componentOf(record, HOME), { id: 'rec', type: 'DbModel2', parameters: [{ name: 'collectionName', value: lit('Photos') }] });
    wire(record, HOME, 'rec', 'prop-avatar', 'cloud', 'file');
    // §46 lifted this for a column the snapshot declares a File; this fixture's snapshot is empty, so the sentence names that.
    expect(reasonFor(record, HOME, 'cloud')).toBe(
      'its Cloud File is fed by a Record\'s "avatar" column, which the project\'s schema snapshot does not declare — the interpreter turns a column into a stored file only where the snapshot types it File'
    );
  });

  test('C11 two wires into a dialog setting', () => {
    const ir = cloneIr();
    wire(ir, HOME, 'usernameInput', 'onTextChanged', 'picker', 'acceptedFileTypes');
    wire(ir, HOME, 'passwordInput', 'onTextChanged', 'picker', 'acceptedFileTypes');
    expect(reasonFor(ir, HOME, 'picker')).toBe('two wires feed acceptedFileTypes — last-writer-wins is not statically ordered');
  });

  test('C12 an output no node publishes', () => {
    const ir = cloneIr();
    wire(ir, HOME, 'sign', 'signature', 'ttlText', 'text');
    expect(reasonFor(ir, HOME, 'sign')).toBe(
      'its signature output is consumed, and this node publishes only Done, Failure, Completed, Error, Signed URL, URL Kind, Safe To Share, Expires At and TTL'
    );
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

  test('D4 the sites, counted: three try/catches in the page, two functions in the module, two requests on the client, one helper in util', () => {
    expect(home(app).match(/await pickFile\(/g)).toHaveLength(1);
    expect(home(app).match(/await uploadFile\(/g)).toHaveLength(1);
    expect(home(app).match(/await signFileUrl\(/g)).toHaveLength(1);
    expect(home(app).match(/throw new Error\('No file specified'\)/g)).toHaveLength(2);
    expect(filesApi(app).match(/^export async function /gm)).toHaveLength(2);
    expect(client(app).match(/^export async function (uploadFileRequest|signFileUrlRequest)\(/gm)).toHaveLength(2);
    expect(util(app).match(/^export function pickFile\(/gm)).toHaveLength(1);
  });

  test('D5 the no-backend export of the same fixture typechecks too', () => {
    const built = emitApp(withoutBackend(), catalog);
    expect(typecheckEmittedApp(built)).toEqual([]);
  });
});
