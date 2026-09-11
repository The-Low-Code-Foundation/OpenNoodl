import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

import { Catalog, loadCatalog } from '../src/catalog';
import { emitApp } from '../src/emit/emitApp';
import { parseProject } from '../src/parse/parseProject';
import { typecheckEmittedApp } from './helpers/typecheckApp';
import { ExportIR, ComponentIR, ConnectionIR, NodeIR, ParamValue } from '../src/ir/types';

/**
 * EXP-011 §43 — `Record` (`DbModel2`), the second of the nine Cloud Services and the most used of
 * the eight that were left (22 corpus nodes, every one `idSource: explicit`).
 * A read by Id through the class's collection module: `fetch<Type>ById(id)` beside the query and
 * the record verbs, the row typed by the class's interface (the schema snapshot first, then the
 * columns the graph reads as `unknown`). Connected, it goes through the client's `fetchOne()` —
 * the runtime's own `GET /classes/<class>/<id>` (`ParseWireAdapter.fetch`). Unconnected, the stub
 * throws, because a record that does not exist is a Failure in the interpreter too.
 * Two forms, decided by the `Fetch` port: wired, a handler action (the Cloud Function's
 * try/catch, with the runtime's own `Missing Id.` thrown for an empty Id — `scheduleFetch`);
 * unwired, a `useEffect` keyed on the Id (`runOnValueChange`, `controlSignal: 'fetch'`).
 * §A the module, §B the component, §C every refusal by its sentence, §D the §40 class rows for
 * this node, §E the fixture `tests/fixtures/page-desk` — both forms on one page, a backend and a
 * schema declared — exported whole and typechecked.
 */

const FIXTURE = path.join(__dirname, 'fixtures', 'cheer');
const PAGE_DESK = path.join(__dirname, 'fixtures', 'page-desk');
const catalog: Catalog = loadCatalog();
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

type App = ReturnType<typeof emitApp>;
const notesFile = (app: App) => app.files[Object.keys(app.files).find((k) => k.endsWith('Notes.tsx'))!];
const pagesFile = (app: App) => app.files['src/api/pages.ts'];
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
const SCHEMA = [
  {
    name: 'Page',
    columns: [
      { name: 'title', type: 'String' },
      { name: 'published', type: 'Boolean' },
      { name: 'navOrder', type: 'Number' }
    ]
  }
];

/** A graph on the Notes page; `connected` gives the project a backend, `schema` a snapshot of `Page`. */
const withGraph = (build: (notes: ComponentIR) => void, options: { connected?: boolean; schema?: boolean } = {}): App => {
  const ir: ExportIR = JSON.parse(JSON.stringify(baseIr));
  if (options.connected) (ir.project as { cloudservices?: typeof BACKEND }).cloudservices = BACKEND;
  if (options.schema) (ir.project as { collections: unknown }).collections = SCHEMA;
  build(ir.components.find((c) => c.path === 'Pages/Notes')!);
  return emitApp(ir, catalog);
};

/** `Page` by explicit Id, labelled "Page". */
const addRecord = (notes: ComponentIR, extra: Partial<NodeIR> = {}) =>
  addNode(notes, {
    id: 'rec',
    type: 'DbModel2',
    authoredLabel: 'Page',
    parameters: [
      { name: 'collectionName', value: literal('Page') },
      { name: 'idSource', value: literal('explicit') }
    ],
    ...extra
  });
const addBareSetter = (notes: ComponentIR, id: string, variable: string) =>
  addNode(notes, { id, type: 'Set Variable', parameters: [{ name: 'name', value: literal(variable) }] });
/** The wired form: Id from the draft variable, Fetch from the Add button, Done and Failure chains fed by the node. */
const base = (notes: ComponentIR) => {
  addRecord(notes);
  connect(notes, 'noteDraftVar', 'value', 'rec', 'modelId');
  connect(notes, 'addButton', 'onClick', 'rec', 'fetch', 'signal');
  addBareSetter(notes, 'after', 'lastPublished');
  connect(notes, 'rec', 'done', 'after', 'do', 'signal');
  connect(notes, 'rec', 'prop-title', 'after', 'value');
  addBareSetter(notes, 'onFail', 'lastError');
  connect(notes, 'rec', 'failure', 'onFail', 'do', 'signal');
  connect(notes, 'rec', 'error', 'onFail', 'value');
};
/** The effect form: the same, with Fetch unwired. */
const baseEffect = (notes: ComponentIR) => {
  addRecord(notes);
  connect(notes, 'noteDraftVar', 'value', 'rec', 'modelId');
  addBareSetter(notes, 'after', 'lastPublished');
  connect(notes, 'rec', 'done', 'after', 'do', 'signal');
  connect(notes, 'rec', 'prop-title', 'after', 'value');
  addBareSetter(notes, 'onFail', 'lastError');
  connect(notes, 'rec', 'failure', 'onFail', 'do', 'signal');
  connect(notes, 'rec', 'error', 'onFail', 'value');
};

const HANDLER =
  '          try {\n' +
  '            const pageRecordId = noteDraft.get();\n' +
  "            if (pageRecordId === undefined || pageRecordId === null || pageRecordId === '') throw new Error('Missing Id.');\n" +
  '            const pageRecord = await fetchPageById(pageRecordId);\n' +
  '            lastPublished.set(pageRecord.title);\n' +
  '          } catch (error) {\n' +
  '            const pageMessage = error instanceof Error ? error.message : String(error);\n' +
  '            setPageError(pageMessage);\n' +
  // EXP-011 §54. dbmodelnode2.ts raises record/storage-op-failed (Missing Id. included) before the failure pulse.
  "            raiseAppError({ code: 'record/storage-op-failed', message: pageMessage, nodeId: 'rec', nodeType: 'DbModel2', componentName: '/Pages/Notes' });\n" +
  '            lastError.set(pageMessage);\n' +
  '          }';

describe('EXP-011 §43 §A — the collection module', () => {
  it('connected: the read joins the class module through the client’s fetchOne, the interface from the schema', () => {
    const app = withGraph(base, { connected: true, schema: true });
    const pages = pagesFile(app);
    expect(pages).toContain("import { fetchOne } from './client';");
    expect(pages).toContain('export interface Page {\n  id: string;\n  title?: string;\n  published?: boolean;\n  navOrder?: number;\n}');
    expect(pages).toContain("export async function fetchPageById(id: string): Promise<Page> {\n  return fetchOne<Page>('Page', id);\n}");
    expect(pages).toContain('Source: "Page" (DbModel2 `rec` on /Pages/Notes)');
    expect(app.files['src/api/client.ts']).toContain('export async function fetchOne<T extends { id: string }>(collection: string, id: string): Promise<T> {');
    expect(typecheckEmittedApp(app)).toEqual([]);
  });

  it('stub: the read throws — a record that does not exist is a Failure in the interpreter too', () => {
    const app = withGraph(base, { schema: true });
    const pages = pagesFile(app);
    expect(pages).not.toContain("from './client'");
    expect(pages).toContain("export async function fetchPageById(id: string): Promise<Page> {\n  throw new Error('fetchPageById is not connected to a backend yet');\n}");
    expect(pages).toContain('TODO(export): "Page" (DbModel2 `rec` on /Pages/Notes)');
    expect(app.files['src/api/client.ts']).toBeUndefined();
    expect(typecheckEmittedApp(app)).toEqual([]);
  });

  it('a column the schema does not declare is in the interface as unknown; with no schema at all every read is', () => {
    const app = withGraph((notes) => {
      base(notes);
      connect(notes, 'rec', 'prop-slug', 'notesHeading', 'text');
    }, { connected: true, schema: true });
    expect(pagesFile(app)).toContain('export interface Page {\n  id: string;\n  title?: string;\n  published?: boolean;\n  navOrder?: number;\n  slug?: unknown;\n}');
    const bare = withGraph(base, { connected: true });
    expect(pagesFile(bare)).toContain('export interface Page {\n  id: string;\n  title?: unknown;\n}');
    expect(typecheckEmittedApp(app)).toEqual([]);
  });
});

describe('EXP-011 §43 §B — the component', () => {
  it('Fetch wired: a try/catch in the handler with the runtime’s own Missing Id. thrown for an empty Id, the chains as its arms', () => {
    const app = withGraph(base, { connected: true, schema: true });
    const page = notesFile(app);
    expect(page).toContain('onClick={async () => {');
    // ⚠️ Ten spaces: the handler's own column, read off the emitted file rather than a printout.
    expect(page).toContain(HANDLER);
    // The chain reads the local; nothing outside the chain reads a column, so there is no row.
    expect(page).not.toContain('setPageRow(');
    expect(page).not.toContain('pageRow');
    expect(page).toContain('const [pageError, setPageError] = useState<string | undefined>();');
    expect(page).toContain("import { fetchPageById } from '../api/pages';");
    expect(typecheckEmittedApp(app)).toEqual([]);
  });

  it('a column read in render binds the row, which the read writes, and the type is imported', () => {
    const app = withGraph((notes) => {
      base(notes);
      connect(notes, 'rec', 'prop-title', 'notesHeading', 'text');
    }, { connected: true, schema: true });
    const page = notesFile(app);
    expect(page).toContain('const [pageRow, setPageRow] = useState<Page | undefined>();');
    expect(page).toContain('setPageRow(pageRecord);');
    // A string column folds like every string-typed read — no coercion.
    expect(page).toContain("{pageRow?.title ?? ''}");
    expect(page).toContain("import { fetchPageById, type Page } from '../api/pages';");
    expect(typecheckEmittedApp(app)).toEqual([]);
  });

  it('a boolean or number column in a Text or a string attribute is coerced — the runtime’s String(), §42’s lesson decided by the declared type', () => {
    const app = withGraph((notes) => {
      base(notes);
      connect(notes, 'rec', 'prop-published', 'notesHeading', 'text');
      connect(notes, 'rec', 'prop-navOrder', 'entryInput', 'placeholder');
    }, { connected: true, schema: true });
    const page = notesFile(app);
    expect(page).toContain("{String(pageRow?.published ?? '')}");
    expect(page).toContain("placeholder={String(pageRow?.navOrder ?? '')}");
    expect(page).not.toContain('String(String(');
    expect(typecheckEmittedApp(app)).toEqual([]);
  });

  it('a column the schema does not declare is coerced once in a Text — not twice', () => {
    const app = withGraph((notes) => {
      base(notes);
      connect(notes, 'rec', 'prop-title', 'notesHeading', 'text');
    }, { connected: true });
    const page = notesFile(app);
    expect(page).toContain("{String(pageRow?.title ?? '')}");
    expect(page).not.toContain('String(String(');
    expect(typecheckEmittedApp(app)).toEqual([]);
  });

  it('Id resolves to the feeder — bound the moment it arrives, before any read', () => {
    const app = withGraph((notes) => {
      base(notes);
      connect(notes, 'rec', 'id', 'notesHeading', 'text');
    }, { connected: true, schema: true });
    const page = notesFile(app);
    expect(page).toContain('const draft = useValue(noteDraft);');
    // A string Variable in a Text is the Variable rule's own bare form (React renders undefined as nothing).
    expect(page).toContain('{draft}');
    expect(page).not.toContain('pageRow?.id');
    expect(typecheckEmittedApp(app)).toEqual([]);
  });

  it('an Error read in render binds the row; in the Failure chain it reads the arm’s own message', () => {
    const app = withGraph((notes) => {
      base(notes);
      connect(notes, 'rec', 'error', 'notesHeading', 'text');
    }, { connected: true, schema: true });
    const page = notesFile(app);
    expect(page).toContain('{pageError}');
    expect(page).toContain('lastError.set(pageMessage);');
    expect(typecheckEmittedApp(app)).toEqual([]);
  });

  it('Fetch unwired: the read is a useEffect keyed on the Id — the node reads again whenever its Id changes', () => {
    const app = withGraph((notes) => {
      baseEffect(notes);
      connect(notes, 'rec', 'prop-title', 'notesHeading', 'text');
    }, { connected: true, schema: true });
    const page = notesFile(app);
    expect(page).toContain("import { useEffect, useState } from 'react';");
    expect(page).toContain(
      '  // Page — read again whenever its Id changes (dbmodelnode2.ts runOnValueChange).\n' +
        '  useEffect(() => {\n' +
        '    void (async () => {\n' +
        '      try {\n' +
        // §43.2: the row is cleared first — a new Id rebinds the node to a fresh model — and an empty
        // Id returns silently, where the handler form throws the runtime's `Missing Id.`.
        '        setPageRow(undefined);\n' +
        '        const pageRecordId = noteDraft.get();\n' +
        "        if (pageRecordId === undefined || pageRecordId === null || pageRecordId === '') return;\n" +
        '        const pageRecord = await fetchPageById(pageRecordId);\n' +
        '        setPageRow(pageRecord);\n' +
        '        lastPublished.set(pageRecord.title);\n' +
        '      } catch (error) {\n' +
        '        const pageMessage = error instanceof Error ? error.message : String(error);\n' +
        '        setPageError(pageMessage);\n' +
        "        raiseAppError({ code: 'record/storage-op-failed', message: pageMessage, nodeId: 'rec', nodeType: 'DbModel2', componentName: '/Pages/Notes' });\n" +
        '        lastError.set(pageMessage);\n' +
        '      }\n' +
        '    })();\n' +
        '  }, [draft]);'
    );
    // The Add button is a plain handler again — nothing of the read is in it.
    expect(page).not.toContain('onClick={async');
    expect(typecheckEmittedApp(app)).toEqual([]);
  });

  it('Fetch unwired with no row: nothing to clear, and an empty Id still returns rather than failing', () => {
    const app = withGraph(baseEffect, { connected: true, schema: true });
    const page = notesFile(app);
    expect(page).toContain("        if (pageRecordId === undefined || pageRecordId === null || pageRecordId === '') return;");
    expect(page).not.toContain('(undefined);');
    expect(page).not.toContain("Missing Id.");
    expect(typecheckEmittedApp(app)).toEqual([]);
  });

  it('Fetch wired keeps the throw: a Fetch on an empty Id is the runtime’s Failure "Missing Id."', () => {
    const app = withGraph(base, { connected: true, schema: true });
    const page = notesFile(app);
    expect(page).toContain("throw new Error('Missing Id.');");
    expect(page).not.toContain(') return;');
  });

  it('Fetch unwired with a literal Id runs once, at mount — the effect has no dependency', () => {
    const app = withGraph((notes) => {
      addRecord(notes, {
        parameters: [
          { name: 'collectionName', value: literal('Page') },
          { name: 'idSource', value: literal('explicit') },
          { name: 'modelId', value: literal('home') }
        ]
      });
      connect(notes, 'rec', 'prop-title', 'notesHeading', 'text');
    }, { connected: true, schema: true });
    const page = notesFile(app);
    expect(page).toContain("        const pageRecordId = 'home';");
    // No guard on a literal: the planner refused an empty one, and a guard on a string literal is a TS2367.
    expect(page).not.toContain("pageRecordId === ''");
    expect(page).toContain('  }, []);');
    expect(typecheckEmittedApp(app)).toEqual([]);
  });

  it('the report names the connected read', () => {
    const app = withGraph(base, { connected: true, schema: true });
    expect(app.notes).toContain(
      "api modules connect to the project's NodeGX backend at http://localhost:8581 (src/api/client.ts; .env.example overrides the endpoint)"
    );
  });
});

describe('EXP-011 §43 §C — refused by name', () => {
  const refusal = (mutate: (notes: ComponentIR) => void, options = { connected: true, schema: true }) => {
    const app = withGraph((notes) => {
      base(notes);
      mutate(notes);
    }, options);
    return deferralFor(app, 'rec');
  };

  it('no class', () => {
    expect(refusal((notes) => {
      notes.nodes.find((n) => n.id === 'rec')!.parameters = [{ name: 'idSource', value: literal('explicit') }];
    })).toContain('no class is named, so the node has no collection to read a record from');
  });

  it('a wired class', () => {
    expect(refusal((notes) => connect(notes, 'noteDraftVar', 'value', 'rec', 'collectionName'))).toContain(
      'its Class is wired — which collection is read is not statically knowable'
    );
  });

  it('a second backend', () => {
    expect(refusal((notes) => {
      notes.nodes.find((n) => n.id === 'rec')!.parameters.push({ name: 'backendId', value: literal('backend_other') });
    })).toContain('it reads from the backend "backend_other" rather than the project\'s active one — a second backend is not in this slice');
  });

  it('a repeater-bound Id', () => {
    expect(refusal((notes) => {
      const rec = notes.nodes.find((n) => n.id === 'rec')!;
      rec.parameters = rec.parameters.map((p) => (p.name === 'idSource' ? { name: 'idSource', value: literal('foreach') } : p));
    })).toContain("its Id Source is the enclosing repeater's row — row identity is not statically knowable in this slice");
  });

  it('two wires into the Id', () => {
    expect(refusal((notes) => connect(notes, 'visitorNameVar', 'value', 'rec', 'modelId'))).toContain(
      'two wires feed its Id — last-writer-wins is not statically ordered'
    );
  });

  it('no Id at all', () => {
    expect(refusal((notes) => {
      notes.connections = notes.connections.filter((c) => !(c.toId === 'rec' && c.toProperty === 'modelId'));
    })).toContain('it names no record, so the runtime binds to nothing and never reads one');
  });

  it('a consumed Fetched — two events on one port', () => {
    expect(refusal((notes) => {
      addBareSetter(notes, 'onFetched', 'lastPublished');
      connect(notes, 'rec', 'fetched', 'onFetched', 'do', 'signal');
      connect(notes, 'noteDraftVar', 'value', 'onFetched', 'value');
    })).toContain('its Fetched output is consumed — that pulse fires when an Id is bound and again after every read, and this slice emits only the read');
  });

  it('a consumed Changed — the record store’s pub/sub', () => {
    expect(refusal((notes) => {
      addBareSetter(notes, 'onChanged', 'lastPublished');
      connect(notes, 'rec', 'changed-title', 'onChanged', 'do', 'signal');
      connect(notes, 'noteDraftVar', 'value', 'onChanged', 'value');
    })).toContain('its changed-title output is consumed — it fires from the in-process record store whenever any node writes this record, which has no static shape');
  });

  it('a consumed Completed — the join', () => {
    expect(refusal((notes) => {
      addBareSetter(notes, 'onDone', 'lastPublished');
      connect(notes, 'rec', 'completed', 'onDone', 'do', 'signal');
      connect(notes, 'noteDraftVar', 'value', 'onDone', 'value');
    })).toContain('its Completed output is consumed — that pulse fires once however the read ended, and this slice emits the two arms rather than their join');
  });

  it('a column read from the Failure chain', () => {
    expect(refusal((notes) => {
      notes.connections = notes.connections.filter((c) => c.key !== 'rec:error->onFail:value');
      connect(notes, 'rec', 'prop-title', 'onFail', 'value');
    })).toContain("its prop-title is read from the Failure chain — that arm runs where no record arrived, and the value the interpreter holds there is the previous read's");
  });
});

describe('EXP-011 §43 §D — the §40 class, for this node', () => {
  it('the chain wires listed before the trigger wire read exactly as listed after', () => {
    const first = withGraph(base, { connected: true, schema: true });
    const last = withGraph((notes) => {
      addRecord(notes);
      addBareSetter(notes, 'after', 'lastPublished');
      connect(notes, 'rec', 'done', 'after', 'do', 'signal');
      connect(notes, 'rec', 'prop-title', 'after', 'value');
      addBareSetter(notes, 'onFail', 'lastError');
      connect(notes, 'rec', 'failure', 'onFail', 'do', 'signal');
      connect(notes, 'rec', 'error', 'onFail', 'value');
      connect(notes, 'noteDraftVar', 'value', 'rec', 'modelId');
      connect(notes, 'addButton', 'onClick', 'rec', 'fetch', 'signal');
    }, { connected: true, schema: true });
    const notesOf = (app: App) => app.notes.filter((n) => n.startsWith('Pages/Notes'));
    expect(notesOf(last)).toEqual(notesOf(first));
    expect(notesOf(last)).toEqual([]);
    expect(notesFile(last)).toBe(notesFile(first));
  });

  it('a Fetch wired from nothing translatable is named, and leaves no module export and no row behind', () => {
    const app = withGraph((notes) => {
      addRecord(notes);
      connect(notes, 'noteDraftVar', 'value', 'rec', 'modelId');
      addBareSetter(notes, 'after', 'lastPublished');
      connect(notes, 'rec', 'done', 'after', 'do', 'signal');
      connect(notes, 'rec', 'prop-title', 'after', 'value');
      connect(notes, 'rec', 'prop-title', 'notesHeading', 'text');
      // A wire INTO fetch keeps the port wired (so the effect form does not apply) from a node
      // that carries no signal this slice can hear. (§59 re-pointed it from `Hash`, whose Done is
      // a chain the exporter owns since, to `Pattern Extractor` — §50's own out-of-scope list.)
      addNode(notes, { id: 'pattern', type: 'net.noodl.PatternExtractor' });
      connect(notes, 'pattern', 'done', 'rec', 'fetch', 'signal');
    }, { connected: true, schema: true });
    // The attach pass disposes the sink with the trigger's own reason — the class rule, not this
    // node's — so the wire note is the name, and nothing of the read is left behind.
    expect(app.notes).toContain('Pages/Notes: wire pattern:done->rec:fetch dropped: the trigger is not a rendered element event or a receiver');
    expect(app.notes.join('\n')).not.toContain('node rec (DbModel2)');
    expect(pagesFile(app)).toBeUndefined();
    expect(notesFile(app)).not.toContain('pageRow');
    expect(notesFile(app)).not.toContain('pageError');
    expect(typecheckEmittedApp(app)).toEqual([]);
  });
});

describe('EXP-011 §43 §E — the fixture', () => {
  const app = emitApp(parseProject(PAGE_DESK, catalog), catalog);
  const home = app.files['src/pages/Home.tsx'];

  it('exports whole: every node collapsed, only the two backend notes', () => {
    expect(app.notes).toEqual([
      'App: router shell — emitted as src/App.tsx by the scaffold',
      "api modules connect to the project's NodeGX backend at http://localhost:8581 (src/api/client.ts; .env.example overrides the endpoint)"
    ]);
  });

  it('emits the client, the class module and the env example, and typechecks', () => {
    expect(Object.keys(app.files).filter((f) => f.startsWith('src/api/')).sort()).toEqual(['src/api/client.ts', 'src/api/pages.ts']);
    expect(app.files['.env.example']).toContain('VITE_NODEGX_APP_ID=backend_pagedesk');
    expect(pagesFile(app)).toContain("return fetchOne<Page>('Page', id);");
    expectParses(app);
    expect(typecheckEmittedApp(app)).toEqual([]);
  });

  it('the page carries both forms: the Load handler and the live effect, each with its own row and Error', () => {
    expect(home).toContain('const [pageRow, setPageRow] = useState<Page | undefined>();');
    expect(home).toContain('const [livePageRow, setLivePageRow] = useState<Page | undefined>();');
    expect(home).toContain('const pageRecordId = pageId.get();');
    expect(home).toContain('const pageRecord = await fetchPageById(pageRecordId);');
    expect(home).toContain('const livePageRecord = await fetchPageById(livePageRecordId);');
    expect(home).toContain('  }, [id]);');
    expect(home).toContain('<p className={styles.text}>{id}</p>');
    expect(home).toContain("{pageRow?.title ?? ''}");
    expect(home).toContain("{String(pageRow?.published ?? '')}");
    expect(home).toContain("{String(pageRow?.navOrder ?? '')}");
    expect(home).toContain("{livePageRow?.title ?? ''}");
    expect(home).toContain('{pageError}');
    expect(home).toContain('{livePageError}');
  });
});
