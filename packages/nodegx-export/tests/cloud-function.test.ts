import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

import { Catalog } from '../src/catalog';
import { emitApp } from '../src/emit/emitApp';
import { parseProject } from '../src/parse/parseProject';
import { typecheckEmittedApp } from './helpers/typecheckApp';
import { ExportIR, ComponentIR, ConnectionIR, NodeIR, ParamValue } from '../src/ir/types';

/**
 * EXP-011 §41 — `Cloud Function` (`CloudFunction2`), the first of the nine Cloud Services and
 * EXP-009's AC4.
 *
 * One function per node in `src/api/functions.ts`: the declared `in-*` ports as parameters (a
 * wired one is passed, an authored one folded into the body), the declared `out-*` ports as a
 * typed results object. Connected, it goes through the client's `callFunction()` — the runtime's
 * own `_makeRequest` (`cloudfunction2.ts`): `POST /functions/<name>`, app id, session token, JSON
 * body, 200/201 carries `result`. Unconnected, the stub throws the sentence the interpreter
 * answers Failure with when the project declares no backend. Done and Failure are a try/catch's
 * two arms; `Error` is a row never cleared, HTTP's rule one node over.
 *
 * §A the module, §B the component, §C every refusal by its sentence, §D the §40 class rows for
 * this node (wire order, a reactive trigger, idle), §E the fixture `tests/fixtures/call-desk` —
 * the only fixture besides `puppy-test-3` that declares a backend — exported whole and typechecked.
 */

const FIXTURE = path.join(__dirname, 'fixtures', 'cheer');
const CALL_DESK = path.join(__dirname, 'fixtures', 'call-desk');
const CATALOG_PATH = path.join(__dirname, '..', '..', 'noodl-types', 'src', 'node-catalog.json');
const catalog: Catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
const baseIr = parseProject(FIXTURE, catalog);

const literal = (value: string | number | boolean): ParamValue => ({ kind: 'literal', value });

const connect = (
  component: ComponentIR,
  from: string,
  fromProperty: string,
  to: string,
  toProperty: string,
  kind: ConnectionIR['kind'] = 'value'
) => {
  component.connections.push({
    key: `${from}:${fromProperty}->${to}:${toProperty}`,
    fromId: from,
    fromProperty,
    toId: to,
    toProperty,
    kind
  });
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

/** A dynamic port as the parser records it off `dynamicports`. */
const port = (name: string, plug: 'input' | 'output') =>
  ({ name, plug, kind: 'value', displayName: name.slice(name.indexOf('-') + 1) }) as never;

type App = ReturnType<typeof emitApp>;
const notesFile = (app: App) => app.files[Object.keys(app.files).find((k) => k.endsWith('Notes.tsx'))!];
const functionsFile = (app: App) => app.files['src/api/functions.ts'];
const notesNotes = (app: App) => app.notes.filter((n) => n.startsWith('Pages/Notes'));
const app_notes = (app: App) => app.notes.join('\n');
const deferralFor = (app: App, nodeId: string): string =>
  app.notes.find((n) => n.includes(`node ${nodeId}`) && n.includes('deferred')) ?? app.notes.join('\n');

const expectParses = (app: App) => {
  for (const [file, source] of Object.entries(app.files)) {
    if (!file.endsWith('.ts') && !file.endsWith('.tsx')) continue;
    const sf = ts.createSourceFile(file, source, ts.ScriptTarget.ESNext, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const diagnostics = (sf as unknown as { parseDiagnostics: ts.Diagnostic[] }).parseDiagnostics ?? [];
    expect(diagnostics.map((d) => `${file}: ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`).join('\n')).toBe('');
  }
};

const BACKEND = { instanceId: 'backend_x', endpoint: 'http://localhost:8581', appId: 'backend_x', type: 'nodegx' };

/** A graph on the Notes page; `connected` gives the project a backend, so the client is real. */
const withGraph = (build: (notes: ComponentIR) => void, options: { connected?: boolean } = {}): App => {
  const ir: ExportIR = JSON.parse(JSON.stringify(baseIr));
  if (options.connected) (ir.project as { cloudservices?: typeof BACKEND }).cloudservices = BACKEND;
  build(ir.components.find((c) => c.path === 'Pages/Notes')!);
  return emitApp(ir, catalog);
};

/** `publishPage(pageId ← the draft variable, publish: true)`, results pageId + published. */
const addPublish = (notes: ComponentIR, extra: Partial<NodeIR> = {}) =>
  addNode(notes, {
    id: 'pub',
    type: 'CloudFunction2',
    authoredLabel: 'Publish page',
    parameters: [
      { name: 'function', value: literal('publishPage') },
      { name: 'in-publish', value: literal(true) }
    ],
    declaredPorts: [port('in-pageId', 'input'), port('in-publish', 'input'), port('out-pageId', 'output'), port('out-published', 'output')],
    ...extra
  });
const addSetter = (notes: ComponentIR, id: string, variable: string) => {
  addNode(notes, { id, type: 'Set Variable', parameters: [{ name: 'name', value: literal(variable) }] });
  connect(notes, 'noteDraftVar', 'value', id, 'value');
};
/** A setter whose `value` the row wires itself — a second wire into `value` would be ignored. */
const addBareSetter = (notes: ComponentIR, id: string, variable: string) =>
  addNode(notes, { id, type: 'Set Variable', parameters: [{ name: 'name', value: literal(variable) }] });
/** The base with bare setters, for rows that feed the setters from the node's own outputs. */
const baseBare = (notes: ComponentIR) => {
  addPublish(notes);
  connect(notes, 'noteDraftVar', 'value', 'pub', 'in-pageId');
  connect(notes, 'addButton', 'onClick', 'pub', 'call', 'signal');
  addBareSetter(notes, 'after', 'lastPublished');
  connect(notes, 'pub', 'done', 'after', 'do', 'signal');
  addBareSetter(notes, 'onFail', 'lastError');
  connect(notes, 'pub', 'failure', 'onFail', 'do', 'signal');
};
/** The base: wired pageId, fired by the Add button, Done and Failure chains. */
const base = (notes: ComponentIR) => {
  addPublish(notes);
  connect(notes, 'noteDraftVar', 'value', 'pub', 'in-pageId');
  connect(notes, 'addButton', 'onClick', 'pub', 'call', 'signal');
  addSetter(notes, 'after', 'lastPublished');
  connect(notes, 'pub', 'done', 'after', 'do', 'signal');
  addSetter(notes, 'onFail', 'lastError');
  connect(notes, 'pub', 'failure', 'onFail', 'do', 'signal');
};

describe('EXP-011 §41 §A — the functions module', () => {
  it('connected: one function per node through callFunction, the wired param passed and the authored one folded', () => {
    const app = withGraph(base, { connected: true });
    const fns = functionsFile(app);
    expect(fns).toContain("import { callFunction } from './client';");
    expect(fns).toContain('export interface PublishPageResults {\n  pageId: any;\n  published: any;\n}');
    expect(fns).toContain(
      'export async function callPublishPage(params: { pageId?: string }): Promise<PublishPageResults> {\n  return callFunction<PublishPageResults>("publishPage", { pageId: params.pageId, publish: true });\n}'
    );
    expect(fns).toContain('Source: "Publish page" (CloudFunction2 `pub` on /Pages/Notes)');
    expect(app.files['src/api/client.ts']).toContain('export async function callFunction<T>(name: string, params: Record<string, unknown>): Promise<T>');
    expect(app.files['src/api/client.ts']).toContain("`${ENDPOINT}/functions/${encodeURIComponent(name)}`");
    expect(app.files['.env.example']).toBeDefined();
    expect(typecheckEmittedApp(app)).toEqual([]);
  });

  it('unconnected: the stub throws the sentence the interpreter answers Failure with, and no client is emitted', () => {
    const app = withGraph(base);
    const fns = functionsFile(app);
    expect(fns).toContain("throw new Error('No cloud services defined in this project.');");
    expect(fns).not.toContain('callFunction');
    expect(fns).toContain('TODO(export): "Publish page" (CloudFunction2 `pub` on /Pages/Notes)');
    expect(app.files['src/api/client.ts']).toBeUndefined();
    expect(app.notes).toContain('api modules emitted as stubs — the project declares no backend (metadata.cloudservices is absent)');
    expect(typecheckEmittedApp(app)).toEqual([]);
  });

  it('emits no module at all when the project calls no function', () => {
    expect(functionsFile(withGraph(() => undefined))).toBeUndefined();
    expect(functionsFile(withGraph(() => undefined, { connected: true }))).toBeUndefined();
  });

  it('a result a wire reads that the declaration does not is in the results type, and an odd name is quoted', () => {
    const app = withGraph((notes) => {
      base(notes);
      connect(notes, 'pub', 'out-page-id', 'notesHeading', 'text');
    });
    expect(functionsFile(app)).toContain('export interface PublishPageResults {\n  pageId: any;\n  published: any;\n  "page-id": any;\n}');
    expect(notesFile(app)).toContain('{publishPageOut?.["page-id"]}');
    expect(typecheckEmittedApp(app)).toEqual([]);
  });

  it('takes no parameter object when every parameter is authored', () => {
    const app = withGraph((notes) => {
      addPublish(notes, { parameters: [{ name: 'function', value: literal('publishPage') }, { name: 'in-publish', value: literal(true) }, { name: 'in-pageId', value: literal('p1') }] });
      connect(notes, 'addButton', 'onClick', 'pub', 'call', 'signal');
      addSetter(notes, 'after', 'lastPublished');
      connect(notes, 'pub', 'done', 'after', 'do', 'signal');
    }, { connected: true });
    expect(functionsFile(app)).toContain('export async function callPublishPage(): Promise<PublishPageResults> {\n  return callFunction<PublishPageResults>("publishPage", { pageId: "p1", publish: true });\n}');
    expect(notesFile(app)).toContain('const publishPageAnswer = await callPublishPage();');
  });
});

describe('EXP-011 §41 §B — the component', () => {
  it('the handler is async, the two chains are the two arms, and no row is written when only the chain reads', () => {
    const app = withGraph((notes) => {
      baseBare(notes);
      connect(notes, 'pub', 'out-pageId', 'after', 'value');
      connect(notes, 'pub', 'error', 'onFail', 'value');
    }, { connected: true });
    const page = notesFile(app);
    expect(page).toContain('onClick={async () => {');
    expect(page).toContain(
      // ⚠️ Ten spaces: the handler's own column. A probe's console output carries jest's four on top.
      '          try {\n            const publishPageAnswer = await callPublishPage({ pageId: noteDraft.get() });\n            lastPublished.set(publishPageAnswer.pageId);\n          } catch (error) {\n            const publishPageMessage = error instanceof Error ? error.message : String(error);\n            setPublishPageError(publishPageMessage);\n            lastError.set(publishPageMessage);\n          }'
    );
    // The chain reads the local; nothing outside the chain reads a result, so there is no results row.
    expect(page).not.toContain('setPublishPageOut(');
    expect(page).not.toContain('publishPageOut');
    // The Error row is written whether or not anything reads it — the runtime writes it too.
    expect(page).toContain('const [publishPageError, setPublishPageError] = useState<string | undefined>();');
    expect(page).toContain("import { callPublishPage } from '../api/functions';");
    expect(typecheckEmittedApp(app)).toEqual([]);
  });

  it('a result read in render binds the row, which the call writes, and the type is imported', () => {
    const app = withGraph((notes) => {
      base(notes);
      connect(notes, 'pub', 'out-published', 'notesHeading', 'text');
    }, { connected: true });
    const page = notesFile(app);
    expect(page).toContain('const [publishPageOut, setPublishPageOut] = useState<PublishPageResults | undefined>();');
    expect(page).toContain('setPublishPageOut(publishPageAnswer);');
    expect(page).toContain('{publishPageOut?.published}');
    expect(page).toContain("import { callPublishPage, type PublishPageResults } from '../api/functions';");
    expect(typecheckEmittedApp(app)).toEqual([]);
  });

  it('an Error read in render binds the row; in the Failure chain it reads the arm’s own message', () => {
    const app = withGraph((notes) => {
      baseBare(notes);
      connect(notes, 'pub', 'out-pageId', 'after', 'value');
      connect(notes, 'pub', 'error', 'notesHeading', 'text');
      connect(notes, 'pub', 'error', 'onFail', 'value');
    }, { connected: true });
    const page = notesFile(app);
    expect(page).toContain('{publishPageError}');
    expect(page).toContain('lastError.set(publishPageMessage);');
    expect(typecheckEmittedApp(app)).toEqual([]);
  });

  it('the report says which form the module took', () => {
    const connected = withGraph(base, { connected: true });
    expect(connected.files['EXPORT-REPORT.md']).toContain('**Your `Cloud Function` calls** in `src/api/functions.ts`, one function each — through `src/api/client.ts`');
    const stub = withGraph(base);
    expect(stub.files['EXPORT-REPORT.md']).toContain('the project declares no backend, so each one fails with the sentence the app itself answers: "No cloud services defined in this project."');
  });
});

describe('EXP-011 §41 §C — every refusal, by its sentence', () => {
  it('a wired Function', () => {
    const app = withGraph((notes) => {
      base(notes);
      connect(notes, 'noteDraftVar', 'value', 'pub', 'function');
    });
    expect(deferralFor(app, 'pub')).toContain('its Function is wired — which cloud function is called is not statically knowable');
    expect(functionsFile(app)).toBeUndefined();
  });
  it('no function name', () => {
    const app = withGraph((notes) => {
      base(notes);
      notes.nodes.find((n) => n.id === 'pub')!.parameters = [{ name: 'in-publish', value: literal(true) }];
    });
    expect(deferralFor(app, 'pub')).toContain('it names no function, so every Call answers Failure with "No function specified" and never sends a request');
  });
  it('a consumed Completed, and an output the node does not publish', () => {
    const completed = withGraph((notes) => {
      base(notes);
      addSetter(notes, 'afterAll', 'anyway');
      connect(notes, 'pub', 'completed', 'afterAll', 'do', 'signal');
    });
    expect(deferralFor(completed, 'pub')).toContain('its Completed output is consumed — that pulse fires once however the call ended');
    const stray = withGraph((notes) => {
      base(notes);
      connect(notes, 'pub', 'response', 'notesHeading', 'text');
    });
    expect(deferralFor(stray, 'pub')).toContain('its response output is consumed, and this node publishes only Done, Failure, Completed, Error and its results');
  });
  it('two wires into one parameter', () => {
    const app = withGraph((notes) => {
      base(notes);
      connect(notes, 'visitorNameVar', 'value', 'pub', 'in-pageId');
    });
    expect(deferralFor(app, 'pub')).toContain('two wires feed in-pageId — last-writer-wins is not statically ordered');
  });
  it('a result read from the Failure chain', () => {
    const app = withGraph((notes) => {
      baseBare(notes);
      connect(notes, 'pub', 'out-pageId', 'after', 'value');
      connect(notes, 'pub', 'out-pageId', 'onFail', 'value');
    });
    expect(deferralFor(app, 'pub')).toContain('its out-pageId is read from the Failure chain — that arm runs where no result arrived');
  });
  it('a result bound in render when the Call never attached, and a Done read as a value', () => {
    const idle = withGraph((notes) => {
      addPublish(notes);
      connect(notes, 'pub', 'out-published', 'notesHeading', 'text');
    });
    expect(deferralFor(idle, 'pub')).toContain('its Call is never fired by a translatable trigger');
    expect(notesFile(idle)).not.toContain('publishPageOut');
    const pulse = withGraph((notes) => {
      base(notes);
      connect(notes, 'pub', 'done', 'notesHeading', 'text');
    });
    // The chain compile sees the wire first: a pulse into a Text is a chain that drives nothing.
    expect(app_notes(pulse)).toContain('wire addButton:onClick->pub:call dropped: its done output drives no translatable action');
  });
});

describe('EXP-011 §41 §D — the §40 class rows for this node', () => {
  it('the chain wires listed before the trigger wire read exactly as listed after', () => {
    const first = withGraph(base, { connected: true });
    const last = withGraph((notes) => {
      addPublish(notes);
      addSetter(notes, 'after', 'lastPublished');
      connect(notes, 'pub', 'done', 'after', 'do', 'signal');
      addSetter(notes, 'onFail', 'lastError');
      connect(notes, 'pub', 'failure', 'onFail', 'do', 'signal');
      connect(notes, 'noteDraftVar', 'value', 'pub', 'in-pageId');
      connect(notes, 'addButton', 'onClick', 'pub', 'call', 'signal');
    }, { connected: true });
    expect(notesNotes(last)).toEqual(notesNotes(first));
    expect(notesNotes(last)).toEqual([]);
    expect(notesFile(last)).toBe(notesFile(first));
  });
  it('fired only from a reactive Condition: an async IIFE, the module earned, not called idle', () => {
    const app = withGraph((notes) => {
      addPublish(notes);
      connect(notes, 'noteDraftVar', 'value', 'pub', 'in-pageId');
      addSetter(notes, 'after', 'lastPublished');
      connect(notes, 'pub', 'done', 'after', 'do', 'signal');
      addNode(notes, { id: 'gate', type: 'Condition', parameters: [{ name: 'runOnChange-condition', value: literal(true) }] });
      connect(notes, 'noteDraftVar', 'value', 'gate', 'condition');
      connect(notes, 'gate', 'ontrue', 'pub', 'call', 'signal');
    }, { connected: true });
    expect(notesNotes(app).join('\n')).not.toContain('never fired');
    expect(notesFile(app)).toContain('    void (async () => {\n      if (noteDraft.get()) {\n        try {\n          const publishPageAnswer = await callPublishPage({ pageId: noteDraft.get() });');
    expect(functionsFile(app)).toContain('callPublishPage');
    expect(typecheckEmittedApp(app)).toEqual([]);
  });
  it('a node nothing fires is named, and leaves no module and no rows behind', () => {
    const app = withGraph((notes) => {
      addPublish(notes);
      addSetter(notes, 'after', 'lastPublished');
      connect(notes, 'pub', 'done', 'after', 'do', 'signal');
    }, { connected: true });
    expect(deferralFor(app, 'pub')).toContain('its Call is never fired by a translatable trigger');
    expect(functionsFile(app)).toBeUndefined();
    expect(notesFile(app)).not.toContain('useState');
  });
});

describe('EXP-011 §41 §E — the fixture, exported whole', () => {
  const app = emitApp(parseProject(CALL_DESK, catalog), catalog);
  it('translates whole but for the scaffold note and the connected-api note', () => {
    expect(app.notes).toEqual([
      'App: router shell — emitted as src/App.tsx by the scaffold',
      "api modules connect to the project's NodeGX backend at http://localhost:8581 (src/api/client.ts; .env.example overrides the endpoint)"
    ]);
  });
  it('emits the client, the functions module and the env example, and typechecks', () => {
    expect(Object.keys(app.files).filter((f) => f.startsWith('src/api/')).sort()).toEqual(['src/api/client.ts', 'src/api/functions.ts']);
    expect(app.files['.env.example']).toContain('VITE_NODEGX_ENDPOINT=http://localhost:8581');
    expect(functionsFile(app)).toContain('return callFunction<PublishPageResults>("publishPage", { pageId: params.pageId, publish: true });');
    const home = app.files['src/pages/Home.tsx'];
    expect(home).toContain('{publishPageOut?.published}');
    expect(home).toContain('{publishPageError}');
    expect(home).toContain('lastPublished.set(publishPageAnswer.pageId);');
    expectParses(app);
    expect(typecheckEmittedApp(app)).toEqual([]);
  });
});
