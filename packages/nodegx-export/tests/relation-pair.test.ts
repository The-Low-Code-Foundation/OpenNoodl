import * as fs from 'fs';
import * as path from 'path';

import * as ts from 'typescript';

import { Catalog, CatalogIndex } from '../src/catalog';
import { ComponentPlan, planProject } from '../src/analyze/plan';
import { emitApp } from '../src/emit/emitApp';
import { summarizePreflight } from '../src/emit/preflight';
import { exportBadgeOf, ledgerEntryOf } from '../src/ledger';
import { parseProject } from '../src/parse/parseProject';
import { typecheckEmittedApp } from './helpers/typecheckApp';
import { ComponentIR, ConnectionIR, ExportIR, NodeIR, ParamValue } from '../src/ir/types';

/**
 * EXP-011 §62 — `Add Record Relation` (`AddDbModelRelation`) and `Remove Record Relation`
 * (`RemoveDbModelRelation`), Tier 2.8 row 12: the record verbs' api-call with a Pointer on the wire.
 *
 * Built on `tests/fixtures/link-desk`: a Record `puppy` (class Puppy, literal Id `pup-1`, Fetch unwired — the
 * effect form) feeds both verbs' Target Record Id; a text input feeds the `inquiryId` Variable that feeds both
 * verbs' Id; two buttons fire the two Dos; each done chain sets the `status` Variable through a String; each
 * Error is a Text. The pre-flight is the runtime's `validateInputs`, in its order, static where it can be and
 * thrown in the handler where it cannot. Every refused shape lives here by mutation and asserts the NAMED sentence.
 *
 * 🔴 The reverted arm (`probe-reverted.log`, HEAD 2a2dd4fa): both verbs on the designed-not-built sentence, the
 * two Set Variables silenced with the attach pass's *"the trigger is not a rendered element event or a receiver"*,
 * the two Strings behind them, 16 refusals, `whole: []`, the pathway verdict naming both. Built: 0 refusals.
 */

const FIXTURE = path.join(__dirname, 'fixtures', 'link-desk');
const CATALOG_PATH = path.join(__dirname, '..', '..', 'noodl-types', 'src', 'node-catalog.json');
const catalog: Catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
const index = new CatalogIndex(catalog);
const baseIr = parseProject(FIXTURE, catalog);
const app = emitApp(baseIr, catalog);
const project = planProject(baseIr, index);

const HOME = 'Pages/Home';
const HOME_FILE = 'src/pages/Home.tsx';
const MODULE = 'src/api/inquiries.ts';
const CLIENT = 'src/api/client.ts';

const cloneIr = (): ExportIR => structuredClone(baseIr);
const componentOf = (source: ExportIR, componentPath: string): ComponentIR => source.components.find((c) => c.path === componentPath)!;
const planOf = (source: ExportIR, componentPath: string): ComponentPlan => planProject(source, index).plans.find((p) => p.path === componentPath)!;
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
const connect = (component: ComponentIR, fromId: string, fromProperty: string, toId: string, toProperty: string, kind: ConnectionIR['kind'] = 'value') => {
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
const home = (a: { files: Record<string, string> }): string => a.files[HOME_FILE];
/** The planner's reason for one node — the refusal list where it is listed, else the disposition (a sweep's verdict). */
const reasonOf = (source: ExportIR, nodeId: string): string | undefined => {
  const plan = planOf(source, HOME);
  const refusal = plan.refusals.find((r) => r.nodeId === nodeId)?.reason;
  if (refusal !== undefined) return refusal;
  const d = plan.dispositions[nodeId] as { kind: string; reason?: string } | undefined;
  return d?.kind === 'deferred' ? d.reason : undefined;
};
/** A mutation of the fixture, applied to the Home component. */
const mutated = (build: (homeComp: ComponentIR, source: ExportIR) => void): ExportIR => {
  const source = cloneIr();
  build(componentOf(source, HOME), source);
  return source;
};

const LINK_HANDLER = [
  '        onClick={async () => {',
  '          try {',
  '            const linkRecordId = inquiryId.get();',
  "            if (!linkRecordId) throw new Error('No record Id specified (the record that should get the relation)');",
  "            await addInquiryRelation(linkRecordId, 'puppies', 'pup-1', 'Puppy');",
  "            status.set('Linked.');",
  '          } catch (error) {',
  '            const linkErrorMessage = error instanceof Error ? error.message : String(error);',
  '            setLinkError(linkErrorMessage);',
  "            raiseAppError({ code: 'record/storage-op-failed', message: linkErrorMessage, nodeId: 'link', nodeType: 'AddDbModelRelation', componentName: '/Pages/Home' });",
  '          }',
  '        }}'
].join('\n');
const UNLINK_HANDLER = [
  '        onClick={async () => {',
  '          try {',
  '            const unlinkRecordId = inquiryId.get();',
  "            if (!unlinkRecordId) throw new Error('No record Id specified (the record that should lose the relation)');",
  "            await removeInquiryRelation(unlinkRecordId, 'puppies', 'pup-1', 'Puppy');",
  "            status.set('Unlinked.');",
  '          } catch (error) {',
  '            const unlinkErrorMessage = error instanceof Error ? error.message : String(error);',
  '            setUnlinkError(unlinkErrorMessage);',
  "            raiseAppError({ code: 'record/storage-op-failed', message: unlinkErrorMessage, nodeId: 'unlink', nodeType: 'RemoveDbModelRelation', componentName: '/Pages/Home' });",
  '          }',
  '        }}'
].join('\n');

// ---------------------------------------------------------------------------------------------------
describe('§A the fixture, whole — a Record feeds the target, a Variable the record, two buttons the two Dos', () => {
  const homePlan = project.plans.find((p) => p.path === HOME)!;

  test('A1 nothing refused: the shell note and the backend note, 18 files, the inquiries module among them', () => {
    expect(app.notes).toEqual([
      'App: router shell — emitted as src/App.tsx by the scaffold',
      "api modules connect to the project's NodeGX backend at http://localhost:8581 (src/api/client.ts; .env.example overrides the endpoint)"
    ]);
    expect(homePlan.refusals).toEqual([]);
    expect(summarizePreflight(app).refusals).toBe(0);
    expect(summarizePreflight(app).whole).toEqual(['Pages/Home']);
    expect(Object.keys(app.files)).toHaveLength(18);
    expect(app.files[MODULE]).toBeDefined();
    expect(home(app)).not.toContain('TODO(export)');
    // A handler action collapses into the element whose handler hosts it; a render read into the file.
    for (const id of ['link', 'setLinked']) expect(homePlan.dispositions[id]).toEqual({ kind: 'collapsed', into: 'linkBtn' });
    for (const id of ['unlink', 'setUnlinked']) expect(homePlan.dispositions[id]).toEqual({ kind: 'collapsed', into: 'unlinkBtn' });
    for (const id of ['linkedLabel', 'unlinkedLabel', 'puppy']) expect(homePlan.dispositions[id]).toEqual({ kind: 'collapsed', into: HOME_FILE });
    for (const id of ['linkBtn', 'unlinkBtn']) expect(homePlan.dispositions[id]).toEqual({ kind: 'static' });
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

  test('A4 the imports (earned in the walkers, printed before the body) and the two Error rows nothing clears', () => {
    const src = home(app);
    expect(src).toContain("import { addInquiryRelation, removeInquiryRelation } from '../api/inquiries';");
    expect(src).toContain("import { raiseAppError } from '../lib/errors';");
    expect(src).toContain("import { inquiryId, status } from '../stores/variables';");
    expect(src).toContain('const [linkError, setLinkError] = useState<string | undefined>();');
    expect(src).toContain('const [unlinkError, setUnlinkError] = useState<string | undefined>();');
    expect(src.indexOf("from '../api/inquiries'")).toBeLessThan(src.indexOf('export function HomePage'));
    expect(src).not.toContain('setLinkError(undefined)');
  });

  test("A5 the Link button: the runtime's record guard, the awaited call in position order, the done chain, the catch that writes Error and raises the family's code", () => {
    expect(home(app)).toContain(LINK_HANDLER);
  });

  test('A6 the Unlink button: the sibling with its own sentence, its own function and its own node type on the raise', () => {
    expect(home(app)).toContain(UNLINK_HANDLER);
  });

  test("A7 the Record's Id folds to its literal feeder, so no target guard prints; the Error Texts fold", () => {
    const src = home(app);
    expect(src).not.toContain('No target record Id');
    expect(src).toContain("{linkError ?? ''}");
    expect(src).toContain("{unlinkError ?? ''}");
    expect(src).toContain('{statusValue}');
  });

  test('A8 the api module: one function per verb beside the class interface, the client import naming both', () => {
    const mod = app.files[MODULE];
    expect(mod).toContain("import { addRelation, removeRelation } from './client';");
    expect(mod).toContain('export interface Inquiry {\n  id: string;\n  message?: string;\n}');
    expect(mod).toContain(
      "export async function addInquiryRelation(id: string, relation: string, targetId: string, targetClass: string): Promise<void> {\n  return addRelation('Inquiry', id, relation, targetId, targetClass);\n}"
    );
    expect(mod).toContain(
      "export async function removeInquiryRelation(id: string, relation: string, targetId: string, targetClass: string): Promise<void> {\n  return removeRelation('Inquiry', id, relation, targetId, targetClass);\n}"
    );
    expect(mod).toContain('Source: "Link" (AddDbModelRelation `link` on /Pages/Home)');
    expect(mod).toContain('Source: "Unlink" (RemoveDbModelRelation `unlink` on /Pages/Home)');
    // The Puppy module is §43's, untouched by this row.
    expect(app.files['src/api/puppies.ts']).toContain('export async function fetchPuppyById(id: string): Promise<Puppy>');
  });

  test("A9 the client: the runtime's own PUT with one op and a typed Pointer, transcribed from ParseWireAdapter", () => {
    const client = app.files[CLIENT];
    expect(client).toContain(
      [
        'export async function addRelation(collection: string, id: string, relation: string, targetId: string, targetClass: string): Promise<void> {',
        '  await request<unknown>(`/classes/${collection}/${encodeURIComponent(id)}`, {',
        "    method: 'PUT',",
        "    body: { [relation]: { __op: 'AddRelation', objects: [{ __type: 'Pointer', objectId: targetId, className: targetClass }] } }",
        '  });',
        '}'
      ].join('\n')
    );
    expect(client).toContain(
      [
        'export async function removeRelation(collection: string, id: string, relation: string, targetId: string, targetClass: string): Promise<void> {',
        '  await request<unknown>(`/classes/${collection}/${encodeURIComponent(id)}`, {',
        "    method: 'PUT',",
        "    body: { [relation]: { __op: 'RemoveRelation', objects: [{ __type: 'Pointer', objectId: targetId, className: targetClass }] } }",
        '  });',
        '}'
      ].join('\n')
    );
  });

  test('A10 the ledger rows moved, so the two picker cards carry no badge; the floor is 107', () => {
    for (const type of ['AddDbModelRelation', 'RemoveDbModelRelation']) {
      expect(ledgerEntryOf(type)?.status).toBe('translated');
      expect(exportBadgeOf(type)).toBeUndefined();
    }
    const ledger = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'coverage-ledger.json'), 'utf8'));
    expect(ledger.pickerCoverageFloor).toBe(107); // §62 the relation pair (session 86)
  });
});

// ---------------------------------------------------------------------------------------------------
// §B — the emitted client under node, against a fake fetch: the request the backend's parse-wire.ts
// `classUpdate` receives (`extractOps` reads `__op`, `objects[].objectId`), byte for byte.
// ---------------------------------------------------------------------------------------------------
type Call = { url: string; method: string; headers: Record<string, string>; body: string | undefined };
type Client = {
  addRelation: (c: string, id: string, k: string, t: string, cls: string) => Promise<void>;
  removeRelation: (c: string, id: string, k: string, t: string, cls: string) => Promise<void>;
};
const loadClient = (
  respond: (call: Call) => { ok: boolean; status: number; text: string } | Error,
  storage: Record<string, string> | undefined = undefined
): { client: Client; calls: Call[] } => {
  const calls: Call[] = [];
  const fakeFetch = async (url: string, init: { method?: string; headers?: Record<string, string>; body?: string }) => {
    const call: Call = { url, method: init.method ?? 'GET', headers: init.headers ?? {}, body: init.body };
    calls.push(call);
    const answer = respond(call);
    if (answer instanceof Error) throw answer;
    return { ok: answer.ok, status: answer.status, text: async () => answer.text };
  };
  // `import.meta` has no meaning in a CommonJS function body; the defaults are the project's own backend.
  const source = app.files[CLIENT]
    .replace('import.meta.env.VITE_NODEGX_ENDPOINT', 'undefined')
    .replace('import.meta.env.VITE_NODEGX_APP_ID', 'undefined');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const module = { exports: {} as Client };
  // eslint-disable-next-line no-new-func
  new Function('require', 'module', 'exports', 'fetch', 'localStorage', js)(() => ({}), module, module.exports, fakeFetch, storage);
  return { client: module.exports, calls };
};
const ok = () => ({ ok: true, status: 200, text: '{"updatedAt":"2026-09-05T10:00:00.000Z"}' });

describe('§B addRelation / removeRelation under node — the wire ParseWireAdapter sends', () => {
  test('B1 addRelation: PUT /classes/<class>/<id>, the header pair, one AddRelation op with a typed Pointer, nothing returned', async () => {
    const { client, calls } = loadClient(ok);
    await expect(client.addRelation('Inquiry', 'inq-1', 'puppies', 'pup-1', 'Puppy')).resolves.toBeUndefined();
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('http://localhost:8581/classes/Inquiry/inq-1');
    expect(calls[0].method).toBe('PUT');
    expect(calls[0].headers).toEqual({ 'X-Parse-Application-Id': 'backend_linkdesk', 'Content-Type': 'application/json' });
    expect(JSON.parse(calls[0].body!)).toEqual({ puppies: { __op: 'AddRelation', objects: [{ __type: 'Pointer', objectId: 'pup-1', className: 'Puppy' }] } });
  });

  test('B2 removeRelation: the same PUT with a RemoveRelation op', async () => {
    const { client, calls } = loadClient(ok);
    await client.removeRelation('Inquiry', 'inq-1', 'puppies', 'pup-1', 'Puppy');
    expect(JSON.parse(calls[0].body!)).toEqual({ puppies: { __op: 'RemoveRelation', objects: [{ __type: 'Pointer', objectId: 'pup-1', className: 'Puppy' }] } });
    expect(calls[0].method).toBe('PUT');
  });

  test("B3 the id rides encodeURIComponent (the client's convention for update/remove); the relation key is a body key, not a path segment", async () => {
    const { client, calls } = loadClient(ok);
    await client.addRelation('Inquiry', 'a b/c', 'puppies', 'pup-1', 'Puppy');
    expect(calls[0].url).toBe('http://localhost:8581/classes/Inquiry/a%20b%2Fc');
    expect(Object.keys(JSON.parse(calls[0].body!))).toEqual(['puppies']);
  });

  test("B4 the backend's refusal is thrown with the backend's own message — what the graph's Error shows", async () => {
    const { client } = loadClient(() => ({ ok: false, status: 404, text: '{"code":101,"error":"Object not found."}' }));
    await expect(client.addRelation('Inquiry', 'nope', 'puppies', 'pup-1', 'Puppy')).rejects.toThrow('Object not found.');
  });

  test('B5 a non-JSON failure carries the status; an unreachable backend carries the one sentence callFunction throws', async () => {
    const { client: c1 } = loadClient(() => ({ ok: false, status: 500, text: 'boom' }));
    await expect(c1.removeRelation('Inquiry', 'inq-1', 'puppies', 'pup-1', 'Puppy')).rejects.toThrow('Request failed (500)');
    const { client: c2 } = loadClient(() => new TypeError('Failed to fetch'));
    await expect(c2.addRelation('Inquiry', 'inq-1', 'puppies', 'pup-1', 'Puppy')).rejects.toThrow('Could not reach the backend at http://localhost:8581');
  });

  test("B6 a stored session rides the request as X-Parse-Session-Token — the runtime's own session lifecycle, so an ACL'd row can be written", async () => {
    const { client, calls } = loadClient(ok, { 'Parse/backend_linkdesk/currentUser': JSON.stringify({ objectId: 'u1', sessionToken: 'r:tok' }) });
    await client.addRelation('Inquiry', 'inq-1', 'puppies', 'pup-1', 'Puppy');
    expect(calls[0].headers['X-Parse-Session-Token']).toBe('r:tok');
  });
});

// ---------------------------------------------------------------------------------------------------
describe('§C the shapes a wire changes', () => {
  test('C1 no backend declared: the stub throws, the module imports nothing from the client, and the page is unchanged', () => {
    const source = cloneIr();
    delete (source.project as { cloudservices?: unknown }).cloudservices;
    const a = emitApp(source, catalog);
    expect(a.files[MODULE]).toContain("export async function addInquiryRelation(id: string, relation: string, targetId: string, targetClass: string): Promise<void> {\n  throw new Error('addInquiryRelation is not connected to a backend yet');\n}");
    expect(a.files[MODULE]).toContain("throw new Error('removeInquiryRelation is not connected to a backend yet');");
    expect(a.files[MODULE]).not.toContain("from './client'");
    expect(a.files[CLIENT]).toBeUndefined();
    expect(home(a)).toContain(LINK_HANDLER);
  });

  test("C2 a wired target Id prints the target guard FIRST — the runtime asks about the target before the record — with the verb's own sentence", () => {
    const source = mutated((h) => {
      addNode(h, { id: 'puppyIdVar', type: 'Variable2', parameters: [{ name: 'name', value: lit('puppyId') }] });
      dropParam(h.nodes.find((n) => n.id === 'puppy')!, 'modelId');
      connect(h, 'puppyIdVar', 'value', 'puppy', 'modelId');
    });
    const src = home(emitApp(source, catalog));
    expect(src).toContain(
      [
        '            const linkTargetId = puppyId.get();',
        "            if (!linkTargetId) throw new Error('No target record Id (the record to add a relation to) specified');",
        '            const linkRecordId = inquiryId.get();',
        "            if (!linkRecordId) throw new Error('No record Id specified (the record that should get the relation)');",
        "            await addInquiryRelation(linkRecordId, 'puppies', linkTargetId, 'Puppy');"
      ].join('\n')
    );
    expect(src).toContain(
      [
        '            const unlinkTargetId = puppyId.get();',
        "            if (!unlinkTargetId) throw new Error('No target record Id (the record to remove a relation from) specified');",
        '            const unlinkRecordId = inquiryId.get();',
        "            if (!unlinkRecordId) throw new Error('No record Id specified (the record that should lose the relation)');",
        "            await removeInquiryRelation(unlinkRecordId, 'puppies', unlinkTargetId, 'Puppy');"
      ].join('\n')
    );
    expect(typecheckEmittedApp(emitApp(source, catalog))).toEqual([]);
  });

  test('C3 a literal record Id prints no record guard and the literal in position', () => {
    const source = mutated((h) => {
      disconnect(h, (c) => c.toId === 'link' && c.toProperty === 'modelId');
      setParam(h.nodes.find((n) => n.id === 'link')!, 'modelId', lit('inq-1'));
    });
    const src = home(emitApp(source, catalog));
    expect(src).toContain("            await addInquiryRelation('inq-1', 'puppies', 'pup-1', 'Puppy');");
    expect(src).not.toContain("throw new Error('No record Id specified (the record that should get the relation)')");
    // ⚠️ `unlinkRecordId` contains `linkRecordId` — the substring trap, third time in this file; the declaration is the claim.
    expect(src).not.toContain('const linkRecordId');
    // The Unlink is untouched.
    expect(src).toContain(UNLINK_HANDLER);
  });

  test("C4 a Text on the verb's Error while Do is wired from a button reads the row; the raise carries the family's code", () => {
    expect(home(app)).toContain("{linkError ?? ''}");
    expect(home(app).match(/record\/storage-op-failed/g)).toHaveLength(3); // the Record's effect + the two verbs
  });
});

// ---------------------------------------------------------------------------------------------------
// §D — refused by name, each sentence exact. The first five are `validateInputs`' own verdicts, in its
// order; the rest are the compiler's static-value gates and the record verbs' consumed-output rule.
// ---------------------------------------------------------------------------------------------------
describe('§D refusals by mutation', () => {
  test("D1 no class → the runtime's first verdict", () => {
    const source = mutated((h) => dropParam(h.nodes.find((n) => n.id === 'link')!, 'collectionName'));
    expect(reasonOf(source, 'link')).toBe('no class is named, so the runtime answers Failure with "No class specified" and never calls the backend');
    expect(reasonOf(source, 'unlink')).toBeUndefined();
  });

  test('D2 no relation property → the second (the corpus shape, §17a)', () => {
    const source = mutated((h) => dropParam(h.nodes.find((n) => n.id === 'unlink')!, 'relationProperty'));
    expect(reasonOf(source, 'unlink')).toBe('no relation property is named, so the runtime answers Failure with "No relation property specified" and never calls the backend');
  });

  test('D3 no Target Record Id wire → the third', () => {
    const source = mutated((h) => disconnect(h, (c) => c.toId === 'link' && c.toProperty === 'targetId'));
    expect(reasonOf(source, 'link')).toBe('no Target Record Id is wired, so the runtime answers Failure with "No target record Id ... specified" and never calls the backend');
  });

  test('D4 no record → the fourth', () => {
    const source = mutated((h) => disconnect(h, (c) => c.toId === 'link' && c.toProperty === 'modelId'));
    expect(reasonOf(source, 'link')).toBe('it names no record to put the relation on, so the runtime answers Failure with "No record Id specified" and never calls the backend');
  });

  test("D5 a Target Record Id from a text input → NDA-012's class check, statically (the fifth)", () => {
    const source = mutated((h) => {
      disconnect(h, (c) => c.toId === 'link' && c.toProperty === 'targetId');
      connect(h, 'inquiryIdInput', 'onTextChanged', 'link', 'targetId');
    });
    expect(reasonOf(source, 'link')).toBe(
      "its Target Record Id comes from net.noodl.controls.textinput rather than a Record or Query Records output, so the target's class is unknown and the runtime refuses the write"
    );
  });

  test('D6 a wired class → the record verbs\' sentence', () => {
    const source = mutated((h) => connect(h, 'inquiryIdVar', 'value', 'link', 'collectionName'));
    expect(reasonOf(source, 'link')).toBe('its class name is not a literal');
  });

  test('D7 a wired Relation (allowEditOnly in the editor; a project can still hold it)', () => {
    const source = mutated((h) => connect(h, 'inquiryIdVar', 'value', 'link', 'relationProperty'));
    expect(reasonOf(source, 'link')).toBe('its Relation is wired — which relation column is written is not statically knowable');
  });

  test('D8 a named Backend', () => {
    const source = mutated((h) => setParam(h.nodes.find((n) => n.id === 'link')!, 'backendId', lit('backend_other')));
    expect(reasonOf(source, 'link')).toBe('it names a specific Backend — one api module per class is all this slice emits');
  });

  test('D9 a repeater-bound Id', () => {
    const source = mutated((h) => setParam(h.nodes.find((n) => n.id === 'unlink')!, 'idSource', lit('foreach')));
    expect(reasonOf(source, 'unlink')).toBe("its Id Source is the enclosing repeater's row — row identity is not statically knowable in this slice");
  });

  test('D10 a consumed Failure — the record verbs\' rule, one funnel for the family', () => {
    const source = mutated((h) => connect(h, 'link', 'failure', 'setLinked', 'do', 'signal'));
    expect(reasonOf(source, 'link')).toBe('its failure output is consumed — only the done chain and the Error value are translated in this slice');
  });

  test('D11 a consumed Completed', () => {
    const source = mutated((h) => connect(h, 'unlink', 'completed', 'setUnlinked', 'do', 'signal'));
    expect(reasonOf(source, 'unlink')).toBe('its completed output is consumed — only the done chain and the Error value are translated in this slice');
  });

  test('D12 a consumed Id', () => {
    const source = mutated((h) => connect(h, 'link', 'id', 'statusText', 'text'));
    expect(reasonOf(source, 'link')).toBe('its Id output is consumed — it republishes the Id it was given, and that read is not translated in this slice');
  });

  test('D13 two wires into Id', () => {
    const source = mutated((h) => connect(h, 'inquiryIdInput', 'onTextChanged', 'link', 'modelId'));
    expect(reasonOf(source, 'link')).toBe('two wires feed its Id — last-writer-wins is not statically ordered');
  });

  test('D14 two wires into Target Record Id', () => {
    const source = mutated((h) => {
      addNode(h, { id: 'puppy2', type: 'DbModel2', parameters: [{ name: 'collectionName', value: lit('Puppy') }, { name: 'idSource', value: lit('explicit') }, { name: 'modelId', value: lit('pup-2') }] });
      connect(h, 'puppy2', 'id', 'link', 'targetId');
    });
    expect(reasonOf(source, 'link')).toBe('two wires feed its Target Record Id — last-writer-wins is not statically ordered');
  });

  test("D15 a target Record whose class is wired → the target's class is not statically known", () => {
    const source = mutated((h) => connect(h, 'inquiryIdVar', 'value', 'puppy', 'collectionName'));
    expect(reasonOf(source, 'link')).toBe("its Target Record Id comes from a Record or Query Records whose class is not a literal, so the target's class is not statically known");
  });

  test("D16 a Query Records' Items as the target → a list, refused by name", () => {
    const source = mutated((h) => {
      addNode(h, { id: 'puppies', type: 'DbCollection2', parameters: [{ name: 'collectionName', value: lit('Puppy') }] });
      disconnect(h, (c) => c.toId === 'link' && c.toProperty === 'targetId');
      connect(h, 'puppies', 'items', 'link', 'targetId');
    });
    expect(reasonOf(source, 'link')).toBe(
      "its Target Record Id is fed the Query Records' Items list rather than one record's Id — a row's Id reaches the page only through a repeater, which this slice does not translate"
    );
  });

  test("D17 a Query Records' First Item Id — the one string output that names a loaded record — is not a read this exporter resolves (§56 reads Items and Count)", () => {
    const source = mutated((h) => {
      addNode(h, { id: 'puppies', type: 'DbCollection2', parameters: [{ name: 'collectionName', value: lit('Puppy') }] });
      disconnect(h, (c) => c.toId === 'link' && c.toProperty === 'targetId');
      connect(h, 'puppies', 'firstItemId', 'link', 'targetId');
    });
    expect(reasonOf(source, 'link')).toBe('its Target Record Id has no statically known source');
  });

  test('D18 an Id from a node with no rule names the feeder (net.noodl.PatternExtractor — out of scope by §50, never scheduled)', () => {
    const source = mutated((h) => {
      addNode(h, { id: 'extract', type: 'net.noodl.PatternExtractor' });
      disconnect(h, (c) => c.toId === 'link' && c.toProperty === 'modelId');
      connect(h, 'extract', 'match', 'link', 'modelId');
    });
    expect(reasonOf(source, 'link')).toBe('its Id has no statically known source');
  });

  test("D19 Do unwired, Error read by a Text: the node is swept with the trigger sentence — the row is a dead artefact and is not minted", () => {
    const source = mutated((h) => disconnect(h, (c) => c.toId === 'link' && c.toProperty === 'store'));
    expect(reasonOf(source, 'link')).toBe('its Do is never fired by a translatable trigger');
    const src = home(emitApp(source, catalog));
    // ⚠️ `not.toContain('linkError')` matches the node id `linkErrorText` in the marker (§57.4's trap) — the row is the claim.
    expect(src).not.toContain('const [linkError, setLinkError]');
    expect(src).toContain(UNLINK_HANDLER);
  });

  test("D20 a done chain that drives nothing translatable is the chain's refusal", () => {
    const source = mutated((h) => {
      disconnect(h, (c) => c.fromId === 'link' && c.fromProperty === 'done');
      connect(h, 'link', 'done', 'statusText', 'text', 'signal');
    });
    expect(reasonOf(source, 'link')).toBe('its done output drives no translatable action');
  });

  test('D21 Do unwired AND no relation property: the pre-flight speaks before the trigger sentence — the sweep asks the runtime\'s questions first', () => {
    const source = mutated((h) => {
      disconnect(h, (c) => c.toId === 'link' && c.toProperty === 'store');
      dropParam(h.nodes.find((n) => n.id === 'link')!, 'relationProperty');
    });
    expect(reasonOf(source, 'link')).toBe('no relation property is named, so the runtime answers Failure with "No relation property specified" and never calls the backend');
  });

  /**
   * 🔴 M10 survived with and without this row: every trigger sink is compiled diagnostically before the
   * sweeps (`compiledOf(node, TRIGGER_PORTS[node.type])`), so the sweep always reports the COMPILER's
   * pre-flight and a sweep-side fallback was dead code — removed. This row pins the behaviour, whichever
   * pass speaks: nothing fires Do, nothing reads Error, and the runtime's question is still asked first.
   */
  test("D24 Do unwired, no relation property, Error unread: the sweep still asks the runtime's questions before saying 'never fired'", () => {
    const source = mutated((h) => {
      disconnect(h, (c) => c.toId === 'link' && c.toProperty === 'store');
      disconnect(h, (c) => c.fromId === 'link' && c.fromProperty === 'error');
      dropParam(h.nodes.find((n) => n.id === 'link')!, 'relationProperty');
    });
    expect(reasonOf(source, 'link')).toBe('no relation property is named, so the runtime answers Failure with "No relation property specified" and never calls the backend');
  });

  test('D22 a refused verb leaves no api export and no Error row behind; its sibling keeps both', () => {
    const source = mutated((h) => dropParam(h.nodes.find((n) => n.id === 'link')!, 'relationProperty'));
    const a = emitApp(source, catalog);
    expect(a.files[MODULE]).not.toContain('addInquiryRelation');
    expect(a.files[MODULE]).toContain('removeInquiryRelation');
    expect(a.files[MODULE]).toContain("import { removeRelation } from './client';");
    expect(home(a)).not.toContain('const [linkError, setLinkError]');
    expect(home(a)).toContain(UNLINK_HANDLER);
  });

  test('D23 the pathway: a refused relation verb is a missing backend pathway in the pre-flight, not a missing feature', () => {
    const source = mutated((h) => dropParam(h.nodes.find((n) => n.id === 'link')!, 'relationProperty'));
    const refusal = planOf(source, HOME).refusals.find((r) => r.nodeId === 'link')!;
    expect(refusal.pathway).toBe(true);
    expect(summarizePreflight(emitApp(source, catalog)).verdict).toContain('"Link" (Add Record Relation)');
  });
});

// ---------------------------------------------------------------------------------------------------
describe('§E the corpus shape (RECORD-VERBS-TARGET §17a) and the logic-only path', () => {
  /** `Puppy test`'s graph: a Create's Id and Done into the verb — gate 11 refuses the Create, so the verb is never fired. */
  test("E1 a Create's Id feeding the verb is still the Create's gate 11; the verb names §4c's unbuilt chain-local read from its own side", () => {
    const source = mutated((h) => {
      addNode(h, { id: 'createInquiry', type: 'NewDbModelProperties', parameters: [{ name: 'collectionName', value: lit('Inquiry') }] });
      disconnect(h, (c) => c.toId === 'link' && (c.toProperty === 'modelId' || c.toProperty === 'store'));
      connect(h, 'linkBtn', 'onClick', 'createInquiry', 'store', 'signal');
      connect(h, 'createInquiry', 'id', 'link', 'modelId');
      connect(h, 'createInquiry', 'done', 'link', 'store', 'signal');
    });
    expect(reasonOf(source, 'createInquiry')).toBe('its Id output is consumed — the record it names exists only inside the invoking chain, which the relation verbs would need');
    // 🔴 Predicted the sweep's trigger sentence; the compiler speaks first (the sink is compiled from the wire
    // side before the Create's gate is asked), and its verdict names the wall from the verb's side.
    expect(reasonOf(source, 'link')).toBe(
      "its Id is the Id output of a record verb — that value exists only inside the verb's own done chain, and the chain-local read RECORD-VERBS-TARGET §4c designs is not built"
    );
  });

  test("E3 the corpus shape in a component with no visual root: the runtime's pre-flight, not the trigger sentence — the one path where the sweep-side pre-flight runs", () => {
    const source = cloneIr();
    source.components.push({ id: 'logic-only', path: 'Components/LogicOnly', role: 'component', nodes: [], connections: [], intent: componentOf(source, HOME).intent });
    const comp = componentOf(source, 'Components/LogicOnly');
    addNode(comp, { id: 'rel', type: 'RemoveDbModelRelation', parameters: [{ name: 'collectionName', value: lit('Inquiry') }] });
    const plan = planOf(source, 'Components/LogicOnly');
    expect(plan.skipReason).toBe('no visual root — logic-only components defer to EXP-003');
    expect((plan.dispositions['rel'] as { reason?: string }).reason).toBe(
      'no relation property is named, so the runtime answers Failure with "No relation property specified" and never calls the backend'
    );
  });

  test('E2 a well-formed relation verb in a component with no visual root: the trigger sentence, not the catch-all', () => {
    const source = cloneIr();
    source.components.push({ id: 'logic-only', path: 'Components/LogicOnly', role: 'component', nodes: [], connections: [], intent: componentOf(source, HOME).intent });
    const comp = componentOf(source, 'Components/LogicOnly');
    addNode(comp, { id: 'rec', type: 'DbModel2', parameters: [{ name: 'collectionName', value: lit('Puppy') }, { name: 'idSource', value: lit('explicit') }, { name: 'modelId', value: lit('pup-1') }] });
    addNode(comp, { id: 'rel', type: 'AddDbModelRelation', parameters: [{ name: 'collectionName', value: lit('Inquiry') }, { name: 'modelId', value: lit('inq-1') }, { name: 'relationProperty', value: lit('puppies') }] });
    connect(comp, 'rec', 'id', 'rel', 'targetId');
    const plan = planOf(source, 'Components/LogicOnly');
    expect(plan.skipReason).toBe('no visual root — logic-only components defer to EXP-003');
    expect((plan.dispositions['rel'] as { reason?: string }).reason).toBe('its Do is never fired by a translatable trigger');
  });
});
