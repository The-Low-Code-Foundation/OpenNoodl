/**
 * Whole-app emission: the scaffold, then the visual generator's component/page files replacing
 * the scaffold's placeholders, then the app-state modules (stores/events — step 5) and the
 * typed api stubs the pages consume. The dependency list stays computed from the output
 * (TARGET-OUTPUT §3): @nodegx/core joins package.json exactly when a generated file imports it.
 */

import { Catalog, CatalogIndex } from '../catalog';
import {
  HttpCallPlan,
  CloudCallPlan,
  HttpValuePlan,
  planProject,
  ProjectPlan,
  QueryPlan,
  SessionCallPlan,
  UserVerb,
  tsColumnType
} from '../analyze/plan';
import { CloudServicesIR, ExportIR } from '../ir/types';
import { emitComponent } from './component';
import { DATE_LIB_PATH, dateLibSource } from './dateLib';
import { UTIL_LIB_PATH, utilLibSource } from './utilLib';
import { ID_LIB_PATH, idLibSource } from './idLib';
import { TIMER_LIB_PATH, timerLibSource } from './timerLib';
import { EmittedCopy, emitKits } from './kits';
import { README_PATH, renderReadme } from './readme';
import { ExportReportData, REPORT_PATH, ReportComponent, renderReport, stripScope } from './report';
import { emitScaffold } from './scaffold';
import { emitStateModules } from './state';

const GENERATED_TS = '// @nodegx:generated (api stub — provenance markers complete in EXP-007)\n';
const GENERATED_MODULE_TS = '// @nodegx:generated (api module — provenance markers complete in EXP-007)\n';

const GENERATED_CLIENT_TS = '// @nodegx:generated (api client — provenance markers complete in EXP-007)\n';

export interface EmittedApp {
  /** Path → content, sorted by path (D-rules). */
  files: Record<string, string>;
  /**
   * Files that travel byte-for-byte rather than being generated (EXP-010 AC5) — every
   * `noodl_modules` file, sorted by destination.
   *
   * 🔴 **A separate channel because `files` is `Record<string, string>` and a font is not a
   * string.** `noodl_modules/inter/` ships four `.ttf` files and `lucide-icons/` a `.woff2`;
   * reading one into a UTF-8 string to put it in `files` would corrupt it silently, and the
   * failure would render as blank glyphs rather than as an error. Emission stays pure — this is a
   * list of paths, not a filesystem operation — and the caller that writes `files` to disk copies
   * these alongside.
   */
  copies: EmittedCopy[];
  /** EXP-004's feed: everything analysis or emission dropped or deferred, per component. */
  notes: string[];
  /**
   * The same facts, grouped by the scope the pushing code already knew (EXP-004).
   *
   * 🔴 **Built beside `notes`, never derived from it.** `notes` is a flat list of sentences and
   * three dozen suites assert on its wording; recovering "which component is this about" by
   * reading those sentences back would make every reword a re-grouping. Both channels are filled
   * at the same push site, where `plan` is in hand and scope is a fact rather than a guess.
   */
  report: ExportReportData;
}

export function emitApp(ir: ExportIR, catalog: Catalog): EmittedApp {
  const index = new CatalogIndex(catalog);
  const project = planProject(ir, index);
  const files = emitScaffold(ir);
  const notes: string[] = [];

  // EXP-010. The kit bridge is built from the node types the plans actually render, so a project
  // with five kits and one node used ships one wrapper — but every module's *files* travel
  // regardless, because an icon set contributes no node and is still what makes the page look
  // right.
  const usedCustomTypes = new Set<string>();
  for (const plan of project.plans) {
    for (const custom of Object.values(plan.customNodes)) usedCustomTypes.add(custom.def.type);
  }
  const kits = emitKits(ir, usedCustomTypes);
  Object.assign(files, kits.files);
  const moduleFailures = [...kits.notes, ...moduleNotes(ir, project)];
  notes.push(...moduleFailures);

  /**
   * EXP-004's second channel. Every `push` below is paired with the `notes.push` on the line
   * beside it — same fact, once as a sentence and once with the scope the caller already knows.
   * Nothing here reads `notes` back.
   */
  const projectNotes: string[] = [];

  if (ir.project.cloudComponents.length > 0) {
    const cloud = `${ir.project.cloudComponents.length} cloud function component(s) skipped — they run on the backend's interpreter, not in the frontend export: ${ir.project.cloudComponents.join(', ')}`;
    notes.push(cloud);
    projectNotes.push(cloud);
  }

  // Reachability is reported, never acted on: an unreachable component is still emitted, because
  // the author may be mid-build and the export is not the place to decide their project has dead
  // code. What it changes is how the rest of this list reads — a deferral in a component no route
  // reaches is not a gap in the export's reach (reach.ts, RECORD-VERBS §20).
  const unreachable = new Set<string>();
  for (const legacy of project.reachability.unreachable) {
    const path = legacy.replace(/^\//, '');
    unreachable.add(path);
    notes.push(
      `${path}: no route reaches this component, so nothing in the running app renders it — its notes below describe code the app never runs`
    );
  }

  /** Date helpers any component imports — the gate on emitting `src/lib/date.ts` at all. */
  const dateHelpersUsed = new Set<string>();
  /** The same gate for `src/lib/util.ts` (EXP-011 Tier 2.7). */
  const utilHelpersUsed = new Set<string>();
  /** The same gate for `src/lib/id.ts` (EXP-011 §37). */
  const idHelpersUsed = new Set<string>();
  /** The same gate for `src/lib/timer.ts` (EXP-011 §39). */
  const timerHelpersUsed = new Set<string>();
  const reportComponents: ReportComponent[] = [];
  for (const plan of project.plans) {
    if (plan.skipReason) {
      if (plan.rootId === null && !plan.file) {
        notes.push(`${plan.path}: ${plan.skipReason}`);
        reportComponents.push({
          path: plan.path,
          role: plan.role,
          file: null,
          notes: [],
          unreachable: unreachable.has(plan.path),
          // ⚠️ `skipKind` decides which side of "lead with what worked" this lands on, and it is
          // set at the two sites in `plan.ts` that know. Defaulting it here would put a
          // logic-only component under "handled by the app shell" the day a third skip appears.
          skipped: { kind: plan.skipKind ?? 'deferred', reason: plan.skipReason },
          // EXP-011 §27.6 — this component has no module, so the report is the only place its
          // authored scripts can survive. The emitting branch below deliberately does not set
          // this: there, `refusedScriptLines` has already written them into the file.
          ...(plan.refusedScripts.length > 0 ? { preservedScripts: plan.refusedScripts } : {})
        });
      }
      continue;
    }
    const emitted = emitComponent(plan, project, ir, index, kits.bindings);
    if (!emitted) continue;
    Object.assign(files, emitted.files);
    notes.push(...emitted.notes);
    notes.push(...plan.notes.map((note) => `${plan.path}: ${note}`));
    reportComponents.push({
      path: plan.path,
      role: plan.role,
      // Read off what was actually emitted rather than rebuilt from `plan.file`'s parts. The
      // naming rule (`src/<dir>/<fileBase>.tsx`, deduplicated per directory) lives in one place,
      // and a second copy here would be right until the day it was not.
      file: Object.keys(emitted.files).find((f) => f.endsWith('.tsx')) ?? Object.keys(emitted.files)[0] ?? null,
      notes: [...emitted.notes.map((note) => stripScope(plan.path, note)), ...plan.notes],
      unreachable: unreachable.has(plan.path)
    });
    for (const helper of emitted.dateHelpers) dateHelpersUsed.add(helper);
    for (const helper of emitted.utilHelpers) utilHelpersUsed.add(helper);
    for (const helper of emitted.idHelpers) idHelpersUsed.add(helper);
    for (const helper of emitted.timerHelpers) timerHelpersUsed.add(helper);
  }

  /**
   * `src/lib/date.ts` (EXP-011 Tier 1.3) — emitted exactly when a component imports it.
   *
   * The whole module ships whenever any one helper is called: they share `toDate`, `addToDate`
   * and `truncateTo`, and a per-helper subset would have to slice a dependency graph to save a
   * few hundred bytes a bundler already tree-shakes.
   */
  if (dateHelpersUsed.size > 0) {
    files[DATE_LIB_PATH] = GENERATED_MODULE_TS + dateLibSource();
  }

  /**
   * `src/lib/util.ts` (EXP-011 Tier 2.7) — the same rule one library over, and a **separate**
   * module rather than a section of `date.ts`: a project that formats a date should not ship the
   * string utilities, and neither module imports the other.
   */
  if (utilHelpersUsed.size > 0) {
    files[UTIL_LIB_PATH] = GENERATED_MODULE_TS + utilLibSource();
  }
  /**
   * `src/lib/id.ts` (EXP-011 §37) — the same rule one library over, and a third module rather
   * than a section of either of the other two: an app that formats a date should not ship a
   * CSPRNG, and neither of the three imports another.
   */
  if (idHelpersUsed.size > 0) {
    files[ID_LIB_PATH] = GENERATED_MODULE_TS + idLibSource();
  }
  /** `src/lib/timer.ts` (EXP-011 §39) — the fourth module, on the same rule as the other three. */
  if (timerHelpersUsed.size > 0) {
    files[TIMER_LIB_PATH] = GENERATED_MODULE_TS + timerLibSource();
  }

  const api = apiModules(ir, project);
  for (const [path, content] of api.files) {
    files[path] = content;
  }
  notes.push(...api.notes);
  // ⚠️ Deliberately NOT added to `projectNotes`. These two lines say which *mode* the api modules
  // are in — connected, or stubs because the project declares no backend — and the report states
  // that up front, under what was generated. Pushing them here as well would both duplicate the
  // fact and file a working backend under "what needs your attention", which is the exact failure
  // EXP-004's risk table calls "a good export looking bad".
  Object.assign(files, emitStateModules(project));

  // Dependencies are computed from the output (TARGET-OUTPUT §3): the library is earned by an
  // import, never declared up front.
  const usesCore = Object.entries(files).some(
    ([path, content]) => path !== 'package.json' && content.includes("from '@nodegx/core")
  );
  if (usesCore) {
    files['package.json'] = withCoreDependency(files['package.json']);
  }

  /*
   * EXP-004 — the report is written into the app, and it counts itself.
   *
   * ⚠️ **Emitted last, and its own path is in the count.** The number an author reads has to be
   * the number of files they can see in the folder; leaving the report out of its own total would
   * be off by one against `ls`, which is the first thing anyone checks.
   */
  const report: ExportReportData = {
    projectName: ir.project.name,
    // ⚠️ Both generated files are in their own count. Neither exists as a key yet — they are
    // written from this record two statements below — and an author reading "34 files" has to see
    // 34 in `ls`, the README and the report included.
    files: [...Object.keys(files), REPORT_PATH, README_PATH].sort(),
    components: reportComponents,
    modules: moduleFailures,
    project: projectNotes,
    backendEndpoint: ir.project.cloudservices?.endpoint ?? null,
    usesBackend: api.usesBackend,
    httpModule: api.files.some(([path]) => path === 'src/api/http.ts'),
    functionsModule: api.files.some(([path]) => path === 'src/api/functions.ts')
  };
  files[REPORT_PATH] = renderReport(report);
  files[README_PATH] = renderReadme(report, ir.project.cloudservices ?? null);

  return {
    files: Object.fromEntries(Object.entries(files).sort(([a], [b]) => (a < b ? -1 : 1))),
    copies: [...kits.copies].sort((a, b) => (a.to < b.to ? -1 : a.to > b.to ? 1 : 0)),
    notes,
    report
  };
}

/**
 * One line per `noodl_modules` folder that could not contribute its nodes — EXP-010 AC4.
 *
 * 🔴 **Every failing module gets a line, and a working one gets none.** A report that listed all
 * five modules would bury the one that broke; a report that listed none would reproduce the defect
 * this task closed. `status` is the discriminator and it already carries the distinction between
 * "nothing to load" (an icon set, a font) and "something went wrong", which is why an asset module
 * cannot appear here by construction rather than by a filter someone has to remember.
 */
function moduleNotes(ir: ExportIR, project: ProjectPlan): string[] {
  const notes: string[] = [];
  for (const module of ir.project.modules) {
    if (module.status === 'loaded' || module.status === 'no-nodes-declared') continue;
    notes.push(
      `noodl_modules/${module.dirName}: ${module.message ?? `could not be loaded (${module.status})`} Its files still ship with the app.`
    );
  }
  for (const duplicate of project.kitDuplicates) {
    notes.push(
      `two kits register the node type ${duplicate} — the first registration wins, here and in the running app, so this one's definition is ignored`
    );
  }
  return notes;
}

function withCoreDependency(packageJson: string): string {
  const parsed = JSON.parse(packageJson);
  parsed.dependencies = Object.fromEntries(
    [['@nodegx/core', '^0.1.0'], ...Object.entries(parsed.dependencies ?? {})].sort(([a], [b]) =>
      a < b ? -1 : 1
    )
  );
  return JSON.stringify(parsed, null, 2) + '\n';
}

/**
 * One typed api module per collection the generated pages consume, plus the session module and —
 * when the project declares a backend — the client that talks to it (EXP-009).
 *
 * Two forms per module, decided once for the whole project:
 *
 * - **Connected** (metadata.cloudservices present): bodies call `src/api/client.ts`, which
 *   speaks the same Parse wire the running app does, and `.env.example` arrives with it.
 *   ⚠️ `README.md` used to as well; since EXP-004 it is emitted for every export, from the report
 *   data, and this branch only decides whether it carries an environment-variable section.
 * - **Stub** (no backend, AC7): byte-identical to what this emitted before EXP-009 — reads
 *   answer empty, writes throw — with the reason named in the report. A half-declared backend
 *   parses to none (parseCloudServices), so it lands here too.
 */
function apiModules(
  ir: ExportIR,
  project: ProjectPlan
): {
  files: Array<[string, string]>;
  notes: string[];
  /**
   * Whether this project asks anything of a *backend* — a collection query, a mutation, or a
   * session call.
   *
   * 🔴 **Returned rather than re-derived, and the difference was a wrong sentence in the report.**
   * "Are there api files?" and "does this project use a backend?" are two predicates, and
   * `src/api/http.ts` is exactly where they part: an `HTTP Request` talks to whatever address the
   * author typed, so it is real code in a project with no backend at all. EXP-004's report asked
   * the first question and printed the second question's answer — telling a `quote-desk` author
   * their working fetch was "emitted as a stub: reads answer empty and writes throw". The
   * predicate this function already computes is the only one that means it.
   */
  usesBackend: boolean;
} {
  type Site = { componentPath: string; nodeId: string };
  type Module = {
    typeName: string;
    moduleBase: string;
    fetchName?: string;
    querySites: Site[];
    /** EXP-011 §43. `fetch<Type>ById` and the Record nodes that read through it. */
    fetchOneName?: string;
    readSites: Site[];
    /** Mutation function name → its call sites, first-use order (RECORD-VERBS-TARGET §4d). */
    mutations: Map<string, { verb: 'create' | 'update' | 'delete'; sites: Site[] }>;
    /** Column → type, from the graph's writes; first-use order, first writer wins. */
    writes: Map<string, string>;
    /** Column → type, from a Record's reads the snapshot does not declare (EXP-011 §43). */
    reads: Map<string, string>;
  };
  const byCollection = new Map<string, Module>();
  const moduleFor = (collectionName: string, typeName: string, moduleBase: string): Module => {
    let entry = byCollection.get(collectionName);
    if (entry === undefined) {
      byCollection.set(
        collectionName,
        (entry = { typeName, moduleBase, querySites: [], readSites: [], mutations: new Map(), writes: new Map(), reads: new Map() })
      );
    }
    return entry;
  };
  for (const plan of project.plans) {
    for (const query of plan.queries) {
      const entry = moduleFor(query.collectionName, query.typeName, query.moduleBase);
      entry.fetchName = query.fetchName;
      entry.querySites.push({ componentPath: plan.path, nodeId: query.nodeId });
    }
    // EXP-011 §43. A Record's read joins its class's module — one module per class, the query's rule.
    for (const read of plan.recordReads) {
      const entry = moduleFor(read.collectionName, read.typeName, read.moduleBase);
      entry.fetchOneName = read.fnName;
      entry.readSites.push({ componentPath: plan.path, nodeId: read.nodeId });
      for (const column of read.reads) {
        if (!entry.reads.has(column.name)) entry.reads.set(column.name, column.tsType);
      }
    }
    for (const mutation of plan.mutations) {
      const entry = moduleFor(mutation.collectionName, mutation.typeName, mutation.moduleBase);
      let fn = entry.mutations.get(mutation.fnName);
      if (fn === undefined) entry.mutations.set(mutation.fnName, (fn = { verb: mutation.verb, sites: [] }));
      fn.sites.push({ componentPath: plan.path, nodeId: mutation.nodeId });
      for (const write of mutation.writes) {
        if (!entry.writes.has(write.name)) entry.writes.set(write.name, write.tsType);
      }
    }
  }

  const hasSessionCalls = project.plans.some((plan) => plan.sessionCalls.length > 0);
  // EXP-011 §41. A Cloud Function call goes through the client too — it is the one api module
  // whose *only* form is the connected one, because the function lives on the backend.
  const hasCloudCalls = project.plans.some((plan) => plan.cloudCalls.length > 0);
  // EXP-011 §45. An upload or a sign is a request to the backend; a picker alone is not.
  const hasFileOps = project.plans.some((plan) => plan.fileOps.some((op) => op.family !== 'pick'));
  const hasApi = byCollection.size > 0 || hasSessionCalls || hasCloudCalls || hasFileOps;
  const notes: string[] = [];
  // No collection module can collide with `client.ts` (or `session.ts`): moduleBase is the
  // pluralized class name and every pluralize() result ends in "s"/"es"/"ies", while neither
  // "client" nor "session" does. Unreachable by construction, so there is no guard — a guard
  // here would be covered by a test that cannot fail (the s29 rule).
  const backend: CloudServicesIR | undefined = ir.project.cloudservices;
  if (hasApi && backend !== undefined) {
    notes.push(
      `api modules connect to the project's NodeGX backend at ${backend.endpoint} (src/api/client.ts; .env.example overrides the endpoint)`
    );
  } else if (hasApi && ir.project.cloudservices === undefined) {
    notes.push(
      'api modules emitted as stubs — the project declares no backend (metadata.cloudservices is absent)'
    );
  }

  const nodeLabel = (site: Site): string => {
    const node = ir.components.find((c) => c.path === site.componentPath)?.nodes.find((n) => n.id === site.nodeId);
    return node?.authoredLabel ? `"${node.authoredLabel}" ` : '';
  };
  // A connected call is provenance, not a TODO — the marker says which one this export is.
  const marker = backend !== undefined ? 'Source: ' : 'TODO(export): ';
  const siteLine = (site: Site, type: string): string =>
    ` * ${marker}${nodeLabel(site)}(${type} \`${site.nodeId}\` on /${site.componentPath})`;

  const stubs: Array<[string, string]> = [];
  for (const [collectionName, module] of byCollection) {
    const schema = ir.project.collections.find((c) => c.name === collectionName);
    const { typeName, moduleBase, fetchName, querySites, fetchOneName, readSites, mutations, writes, reads } = module;

    // The schema snapshot is the authority on a column's declared type, and the graph's writes
    // are evidence of columns the snapshot does not carry — most of the corpus has no snapshot
    // at all (MutationPlan.writes). Schema order first, then graph-written extras in first-use
    // order; `id` is emitted above and never repeated.
    const columns = new Map<string, string>();
    for (const col of schema?.columns ?? []) columns.set(col.name, tsColumnType(col.type));
    for (const [name, tsType] of writes) if (!columns.has(name)) columns.set(name, tsType);
    for (const [name, tsType] of reads) if (!columns.has(name)) columns.set(name, tsType);
    columns.delete('id');
    const fields = [...columns].map(([name, tsType]) => `  ${tsFieldKey(name)}?: ${tsType};`);
    const parts: string[] = [
      `export interface ${typeName} {\n  id: string;\n${fields.join('\n')}${fields.length > 0 ? '\n' : ''}}\n`
    ];

    if (fetchName !== undefined) {
      parts.push(
        backend !== undefined
          ? `/**\n${querySites.map((s) => siteLine(s, 'DbCollection2')).join('\n')}\n` +
              ` * Fetches the \`${collectionName}\` collection from the project's NodeGX backend\n` +
              ` * (src/api/client.ts); the export report lists every call site.\n */\n` +
              `export async function ${fetchName}(): Promise<${typeName}[]> {\n  return query<${typeName}>(${tsStringLiteral(collectionName)});\n}\n`
          : `/**\n${querySites.map((s) => siteLine(s, 'DbCollection2')).join('\n')}\n` +
              ` * fetched the \`${collectionName}\` collection from the project's NodeGX backend. Connect this to your\n` +
              ` * own data source; the export report lists every call site.\n */\n` +
              `export async function ${fetchName}(): Promise<${typeName}[]> {\n  return [];\n}\n`
      );
    }

    // EXP-011 §43. A Record's read by Id. Connected: the client's `fetchOne` — the runtime's own
    // `GET /classes/<class>/<id>`. The stub **throws**, unlike the query's: an empty list is a
    // plausible state of a collection, but a record that does not exist is a Failure in the
    // interpreter too ("Failed to fetch."), and the graph's Failure path is already drawn for it.
    if (fetchOneName !== undefined) {
      parts.push(
        backend !== undefined
          ? `/**\n${readSites.map((s) => siteLine(s, 'DbModel2')).join('\n')}\n` +
              ` * Reads one \`${collectionName}\` record by Id from the project's NodeGX backend\n` +
              ` * (src/api/client.ts); the export report lists every call site.\n */\n` +
              `export async function ${fetchOneName}(id: string): Promise<${typeName}> {\n  return fetchOne<${typeName}>(${tsStringLiteral(collectionName)}, id);\n}\n`
          : `/**\n${readSites.map((s) => siteLine(s, 'DbModel2')).join('\n')}\n` +
              ` * read one \`${collectionName}\` record by Id from the project's NodeGX backend. Connect this to your\n` +
              ` * own data source; until you do it throws, which is what the graph's Failure path already handles.\n */\n` +
              `export async function ${fetchOneName}(id: string): Promise<${typeName}> {\n  throw new Error('${fetchOneName} is not connected to a backend yet');\n}\n`
      );
    }

    // A read stub answers empty so the export builds and runs; a **write** stub throws
    // (RECORD-VERBS-TARGET §4d). An empty list is a plausible state of a real collection; a
    // fabricated successful write is a plausible state of nothing, and reporting success for a
    // record that was never stored is the one failure this whole slice exists to make visible.
    // The connected form has no such asymmetry: every body calls the client, and a failed
    // request throws the backend's own message into the graph's Failure path.
    for (const [fnName, { verb, sites }] of mutations) {
      const nodeType =
        verb === 'create' ? 'NewDbModelProperties' : verb === 'update' ? 'SetDbModelProperties' : 'DeleteDbModelProperties';
      const past = verb === 'create' ? 'created a record in' : verb === 'update' ? 'updated a record in' : 'deleted a record from';
      const present = verb === 'create' ? 'Creates a record in' : verb === 'update' ? 'Updates a record in' : 'Deletes a record from';
      const signature =
        verb === 'create'
          ? `(data: Partial<${typeName}>): Promise<${typeName}>`
          : verb === 'update'
            ? `(id: string, data: Partial<${typeName}>): Promise<${typeName}>`
            : `(id: string): Promise<void>`;
      const connectedBody =
        verb === 'create'
          ? `  return create<${typeName}>(${tsStringLiteral(collectionName)}, data);`
          : verb === 'update'
            ? `  return update<${typeName}>(${tsStringLiteral(collectionName)}, id, data);`
            : `  return remove(${tsStringLiteral(collectionName)}, id);`;
      parts.push(
        backend !== undefined
          ? `/**\n${sites.map((s) => siteLine(s, nodeType)).join('\n')}\n` +
              ` * ${present} the \`${collectionName}\` collection on the project's NodeGX backend.\n` +
              ` * A failed request throws, which is what the graph's Failure path already handles.\n */\n` +
              `export async function ${fnName}${signature} {\n${connectedBody}\n}\n`
          : `/**\n${sites.map((s) => siteLine(s, nodeType)).join('\n')}\n` +
              ` * ${past} the \`${collectionName}\` collection in the project's NodeGX backend. Connect this to your\n` +
              ` * own data source; until you do it throws, which is what the graph's Failure path already handles.\n */\n` +
              `export async function ${fnName}${signature} {\n` +
              `  throw new Error('${fnName} is not connected to a backend yet');\n}\n`
      );
    }

    if (backend !== undefined) {
      const clientImports = new Set<string>();
      if (fetchName !== undefined) clientImports.add('query');
      if (fetchOneName !== undefined) clientImports.add('fetchOne');
      for (const { verb } of mutations.values()) {
        clientImports.add(verb === 'create' ? 'create' : verb === 'update' ? 'update' : 'remove');
      }
      const importLine = `import { ${[...clientImports].sort().join(', ')} } from './client';\n`;
      stubs.push([`src/api/${moduleBase}.ts`, GENERATED_MODULE_TS + importLine + '\n' + parts.join('\n')]);
    } else {
      stubs.push([`src/api/${moduleBase}.ts`, GENERATED_TS + parts.join('\n')]);
    }
  }

  const session = sessionModule(ir, project, backend);
  if (session !== null) stubs.push(session);

  // EXP-011 Tier 1.2. Not a stub and not keyed on the backend: an HTTP Request talks to whatever
  // address the author typed, so this module is real code whether or not the project declares a
  // NodeGX backend of its own.
  const http = httpModule(project);
  if (http !== null) stubs.push(http);
  // EXP-011 §41. One function per Cloud Function node — through the client where the project
  // declares a backend, and a stub that answers the interpreter's own failure where it does not.
  const functions = functionsModule(project, backend, siteLine);
  if (functions !== null) stubs.push(functions);
  // EXP-011 §45. One module for every Upload File / Sign File URL that attached.
  const files = filesModule(project, backend, siteLine);
  if (files !== null) stubs.push(files);

  if (backend !== undefined && hasApi) {
    stubs.push(['src/api/client.ts', clientModule(backend)]);
    stubs.push(['.env.example', envExample(backend)]);
    // ⚠️ `README.md` used to be pushed here too, and that was the defect EXP-004 closed: it made
    // the repository's front door conditional on the project having a backend to query. It is now
    // emitted unconditionally in `emitApp`, from the report data, and knows about far more than
    // the two environment variables this branch could tell it.

  }
  return { files: stubs, notes, usesBackend: hasApi };
}

/**
 * `src/api/http.ts` — one function per translated `HTTP Request` (EXP-011 Tier 1.2).
 *
 * The module is a transcription of `httpnode.ts`'s four builders, and every guard in it is one
 * the interpreter makes:
 *
 * - **A path placeholder with no value stays in the URL, literally.** `buildUrl` only replaces
 *   what it has a value for, and a URL segment has no way to be empty.
 * - **`undefined` and `null` are the same omission** for a path segment, a query parameter, a
 *   header and a form/urlencoded field, and **different** for a JSON body, which has a native
 *   `null` — the one site the runtime tests `!== undefined` alone, and it says why in its own
 *   comment.
 * - **A half-filled credential sends nothing at all** — `authConfigurators` returns `{}` for a
 *   Bearer with no token and for a Basic missing either half.
 * - **The auth headers are applied after the visual ones**, so on a collision the credential
 *   wins, and the Content-Type default runs last and only where nothing has set one.
 *
 * 🔴 **The function throws only where no answer arrived** — no URL, a network error, a timeout —
 * and returns `ok: false` for an answer that was not 2xx. That split is not stylistic: the node
 * publishes `Response` and `Status Code` for a 404 (`processResponse` runs before the failure is
 * reported) and leaves them holding the *previous* request's values when nothing came back at
 * all. A single throwing shape could reproduce one of those or the other, never both.
 */
function httpModule(project: ProjectPlan): [string, string] | null {
  const calls: Array<{ componentPath: string; call: HttpCallPlan }> = [];
  for (const plan of project.plans) {
    for (const call of plan.httpCalls) calls.push({ componentPath: plan.path, call });
  }
  if (calls.length === 0) return null;

  const parts = calls.map(({ componentPath, call }) => httpFunction(componentPath, call));
  return [
    'src/api/http.ts',
    GENERATED_MODULE_TS +
      '//\n// Requests the graph makes to addresses outside this app. Each function is one\n' +
      "// HTTP Request node's configuration, with the values it was wired for as parameters.\n\n" +
      parts.join('\n')
  ];
}

/** A JS string literal for an emitted constant. */
const lit = (value: string | number | boolean): string => JSON.stringify(value);

/**
 * `src/api/functions.ts` — one function per translated `Cloud Function` node (EXP-011 §41).
 *
 * Connected: `callFunction(name, params)` on the client, which POSTs `/functions/<name>` with the
 * app id and the session token exactly as `cloudfunction2.ts`'s `_makeRequest` does, and throws
 * the backend's own `error` (or the runtime's unreachable/failed sentences) where the node reports
 * Failure. Stub: throws *"No cloud services defined in this project."* — the sentence the
 * interpreter answers Failure with when the project declares no backend, so the exported app fails
 * the same way the app it came from does rather than pretending a function ran.
 */
function functionsModule(
  project: ProjectPlan,
  backend: CloudServicesIR | undefined,
  siteLine: (site: { componentPath: string; nodeId: string }, type: string) => string
): [string, string] | null {
  const calls: Array<{ componentPath: string; call: CloudCallPlan }> = [];
  for (const plan of project.plans) {
    for (const call of plan.cloudCalls) calls.push({ componentPath: plan.path, call });
  }
  if (calls.length === 0) return null;
  const parts = calls.map(({ componentPath, call }) => {
    const paramRows = call.params
      .filter((v) => v.from.kind === 'param')
      .map((v) => `${(v.from as { param: string }).param}?: ${(v.from as { tsType: string }).tsType}`);
    const paramsType = paramRows.length > 0 ? `{ ${paramRows.join('; ')} }` : null;
    // `any`, the port's own type: every result port is declared `*`, and a value bound to a sink
    // has to compile whatever the function answered.
    const resultRows = call.results.map((r) => `${tsKey(r)}: any`);
    const bodyEntries = call.params.map((v) => {
      const key = tsKey(v.name);
      const code = v.from.kind === 'literal' ? lit(v.from.value) : `params.${v.from.param}`;
      return key === code ? code : `${key}: ${code}`;
    });
    const body = bodyEntries.length > 0 ? `{ ${bodyEntries.join(', ')} }` : '{}';
    const header = [
      '/**',
      ` * ${call.functionName} — from the Cloud Function node ${call.nodeId} in ${componentPath}.`,
      siteLine({ componentPath, nodeId: call.nodeId }, 'CloudFunction2'),
      ' */'
    ];
    const results = `export interface ${call.typeName} {${resultRows.length > 0 ? `\n  ${resultRows.join(';\n  ')};\n` : ''}}`;
    const signature = `export async function ${call.fnName}(${paramsType === null ? '' : `params: ${paramsType}`}): Promise<${call.typeName}>`;
    return backend !== undefined
      ? `${header.join('\n')}\n${results}\n${signature} {\n  return callFunction<${call.typeName}>(${lit(call.functionName)}, ${body});\n}\n`
      : `${header.join('\n')}\n${results}\n${signature} {\n  // The interpreter answers Failure with exactly this sentence when the project declares no backend.\n  throw new Error('No cloud services defined in this project.');\n}\n`;
  });
  return [
    'src/api/functions.ts',
    (backend !== undefined ? GENERATED_MODULE_TS + "import { callFunction } from './client';\n\n" : GENERATED_TS) +
      '//\n// The cloud functions the graph calls. Each function is one Cloud Function node, with the\n' +
      '// parameters it was wired for as arguments and the results it declares as the answer.\n\n' +
      parts.join('\n')
  ];
}

/**
 * `src/api/files.ts` — the stored-file vocabulary (EXP-011 §45): the `CloudFile` the runtime's
 * `cloudfile.ts` holds (`name` is the STORED name, `<random8>_<original>`, and the handle a sign
 * is addressed by), the `SignedFileUrl` a Sign publishes, `uploadFile` / `signFileUrl` over the
 * client's two requests, and `cloudFileName`, the Cloud File node's prefix-stripping `Name`.
 *
 * `kind` is `signed` unconditionally and `isShareable` therefore true: the NodeGX wire mints
 * `?exp=&sig=` and nothing else reaches this success path (ParseWireAdapter.signFileUrl,
 * measured). The type still names the runtime's three kinds so a reader of the exported app
 * sees the vocabulary the node has, not a narrowing this exporter invented.
 *
 * Stub (no backend): both **throw**, the collection module's rule for a write — a fabricated
 * stored file would be a success report for bytes nobody stored.
 */
function filesModule(
  project: ProjectPlan,
  backend: CloudServicesIR | undefined,
  siteLine: (site: { componentPath: string; nodeId: string }, type: string) => string
): [string, string] | null {
  const uploads: Array<{ componentPath: string; nodeId: string }> = [];
  const signs: Array<{ componentPath: string; nodeId: string }> = [];
  for (const plan of project.plans) {
    for (const op of plan.fileOps) {
      if (op.family === 'upload') uploads.push({ componentPath: plan.path, nodeId: op.nodeId });
      if (op.family === 'sign') signs.push({ componentPath: plan.path, nodeId: op.nodeId });
    }
  }
  if (uploads.length === 0 && signs.length === 0) return null;
  const parts: string[] = [
    `/**
 * A file stored in the project's backend, as \`POST /files/<name>\` answers it and as the running
 * app holds it (noodl-runtime's CloudFile): \`name\` is the STORED name — the wire's
 * \`<random8>_<original>\` — and the handle a later sign is addressed by; \`url\` serves the bytes;
 * \`contentType\` and \`size\` are what the backend reported, and absent on a wire that reports neither.
 */
export interface CloudFile {
  name: string;
  url: string;
  contentType?: string;
  size?: number;
}
`,
    `/**
 * A link a Sign File URL minted. \`kind\` says how it is protected — "signed" carries its own proof
 * and stops working at \`expiresAt\`; "token" carries the caller's own credential; "public" needs
 * nothing — and \`isShareable\` is false only for a token link. On the NodeGX backend every link is
 * signed.
 */
export interface SignedFileUrl {
  url: string;
  kind: 'signed' | 'token' | 'public';
  isShareable: boolean;
  expiresAt?: string;
  ttlSeconds?: number;
}
`,
    `/** The original file name, the storage prefix stripped — the Cloud File node's Name (cloudfilenode.ts). */
export function cloudFileName(file: CloudFile): string {
  const parts = file.name.split('_');
  return parts.length === 1 ? parts[0] : parts.slice(1).join('_');
}
`
  ];
  if (uploads.length > 0) {
    parts.push(
      backend !== undefined
        ? `/**\n${uploads.map((s) => siteLine(s, 'Upload File')).join('\n')}\n` +
            ` * Stores a file on the project's NodeGX backend (src/api/client.ts) — private where asked,\n` +
            ` * so that reading it back needs a signed link. A failed upload throws, which is what the\n` +
            ` * graph's Failure path already handles.\n */\n` +
            `export async function uploadFile(file: File, options: { private?: unknown } = {}): Promise<CloudFile> {\n` +
            `  return uploadFileRequest(file, Boolean(options.private));\n}\n`
        : `/**\n${uploads.map((s) => siteLine(s, 'Upload File')).join('\n')}\n` +
            ` * stored a file on the project's NodeGX backend. Connect this to your own storage; until you\n` +
            ` * do it throws, which is what the graph's Failure path already handles.\n */\n` +
            `export async function uploadFile(file: File, options: { private?: unknown } = {}): Promise<CloudFile> {\n` +
            `  throw new Error('uploadFile is not connected to a backend yet');\n}\n`
    );
  }
  if (signs.length > 0) {
    parts.push(
      backend !== undefined
        ? `/**\n${signs.map((s) => siteLine(s, 'Sign File URL')).join('\n')}\n` +
            ` * Mints a fresh, time-limited link to a stored file from the project's NodeGX backend\n` +
            ` * (src/api/client.ts); refused for a caller who could not read the file directly.\n */\n` +
            `export async function signFileUrl(file: CloudFile): Promise<SignedFileUrl> {\n` +
            `  const signed = await signFileUrlRequest(file.name);\n` +
            `  // Every link the NodeGX backend mints is a real signature (?exp=&sig=), so it is safe to hand on.\n` +
            `  return { ...signed, kind: 'signed', isShareable: true };\n}\n`
        : `/**\n${signs.map((s) => siteLine(s, 'Sign File URL')).join('\n')}\n` +
            ` * minted a time-limited link to a stored file on the project's NodeGX backend. Connect this to\n` +
            ` * your own storage; until you do it throws, which is what the graph's Failure path already handles.\n */\n` +
            `export async function signFileUrl(file: CloudFile): Promise<SignedFileUrl> {\n` +
            `  throw new Error('signFileUrl is not connected to a backend yet');\n}\n`
    );
  }
  const imports = [...(signs.length > 0 ? ['signFileUrlRequest'] : []), ...(uploads.length > 0 ? ['uploadFileRequest'] : [])];
  return [
    'src/api/files.ts',
    (backend !== undefined ? GENERATED_MODULE_TS + `import { ${imports.join(', ')} } from './client';\n\n` : GENERATED_TS) +
      '//\n// The files the graph stores and signs. A stored file is a name and a url; the Upload File and\n' +
      '// Sign File URL nodes are one function each, and Cloud File is a read of the upload\'s answer.\n\n' +
      parts.join('\n')
  ];
}

/**
 * One value the request sends, as the expression that reads it — a folded literal, or the
 * parameter the call site fills.
 */
const httpValueCode = (value: HttpValuePlan): string =>
  value.from.kind === 'literal' ? lit(value.from.value) : `params.${value.from.param}`;

/** Every parameter this request takes, as the emitted argument's inline type. */
function httpParamsType(call: HttpCallPlan): string | null {
  const all: HttpValuePlan[] = [
    ...call.pathParams,
    ...call.queryParams,
    ...call.headers,
    ...(call.body === null ? [] : 'fields' in call.body ? call.body.fields : [call.body.raw]),
    ...(call.auth === null
      ? []
      : call.auth.kind === 'bearer'
        ? [call.auth.token]
        : call.auth.kind === 'basic'
          ? [call.auth.username, call.auth.password]
          : [call.auth.name, call.auth.value])
  ];
  const rows = all
    .filter((v) => v.from.kind === 'param')
    // Optional, every one of them. A wire can carry `undefined` — every emitted component prop
    // is optional, and the runtime's own guards are written for exactly that arrival — so a
    // required parameter would make the emitted app fail to compile at the call site rather
    // than omit the header the way the interpreter does.
    .map((v) => `${(v.from as { param: string; tsType: string }).param}?: ${(v.from as { tsType: string }).tsType}`);
  return rows.length > 0 ? `{ ${rows.join('; ')} }` : null;
}

function httpFunction(componentPath: string, call: HttpCallPlan): string {
  const out: string[] = [];
  const paramsType = httpParamsType(call);
  // `any`, deliberately, and it is the port's own type: `response` is declared `*` on the node
  // and a mapping reads wherever its path points. `unknown` would be the tidier word and it
  // would make every emitted sink fail to compile — a body bound to an `<img src>` or read by
  // the author's own code — for a shape neither the interpreter nor the export ever knew.
  const fieldRows = call.fields.map((f) => `${tsKey(f.name)}: any`);

  out.push(
    '/**',
    ` * ${call.method} ${call.url}`,
    ` *`,
    ` * From the HTTP Request node ${call.nodeId} in ${componentPath}.`,
    ' */',
    `export interface ${call.typeName} {`,
    '  /** True when the server answered 2xx — the node\'s Done outcome; false is its Failure. */',
    '  ok: boolean;',
    '  /** The body, parsed as JSON when the server said so and as text otherwise. */',
    '  response: any;',
    '  statusCode: number;',
    '  /** Every header the server returned, keyed by lower-cased name. */',
    '  responseHeaders: Record<string, string>;',
    `  /** The node's Output Fields, read out of the body at their configured paths. */`,
    `  fields: ${fieldRows.length > 0 ? `{ ${fieldRows.join('; ')} }` : 'Record<string, never>'};`,
    '  /** One sentence about the failure, present only when `ok` is false. */',
    '  error?: string;',
    '}',
    '',
    `export async function ${call.fnName}(${paramsType === null ? '' : `params: ${paramsType}`}): Promise<${call.typeName}> {`
  );

  // ---- the URL: the authored address, its placeholders, then the query string ----------------
  const buildsUrl = call.pathParams.length > 0 || call.queryParams.length > 0 || call.auth?.kind === 'apiKey';
  out.push(`  ${buildsUrl ? 'let' : 'const'} url = ${lit(call.url)};`);
  for (const param of call.pathParams) {
    const code = httpValueCode(param);
    // `split`/`join` rather than `replace`: `buildUrl` iterates every match of the placeholder
    // and replaces the first remaining one each time, so all occurrences are replaced.
    const replace = `url = url.split(${lit(`{${param.name}}`)}).join(encodeURIComponent(String(${code})));`;
    out.push(
      param.from.kind === 'literal'
        ? `  ${replace}`
        : `  // An absent value leaves {${param.name}} in the URL literally, as the interpreter does.\n  if (${code} !== undefined && ${code} !== null) ${replace}`
    );
  }
  if (call.queryParams.length > 0 || call.auth?.kind === 'apiKey') {
    out.push('  const query: Record<string, unknown> = {};');
    for (const param of call.queryParams) {
      const code = httpValueCode(param);
      const assign = `query[${lit(param.name)}] = ${code};`;
      out.push(
        param.from.kind === 'literal'
          ? param.from.value === ''
            ? `  // ${param.name} is authored empty, which the interpreter omits.`
            : `  ${assign}`
          : `  if (${code} !== undefined && ${code} !== null && ${code} !== '') ${assign}`
      );
    }
    if (call.auth?.kind === 'apiKey' && call.auth.location === 'query') {
      const name = httpValueCode(call.auth.name);
      const value = httpValueCode(call.auth.value);
      out.push(`  if (${name} && ${value}) query[String(${name})] = ${value};`);
    }
    out.push(
      '  const queryString = Object.entries(query)',
      '    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)',
      "    .join('&');",
      "  if (queryString) url += (url.includes('?') ? '&' : '?') + queryString;"
    );
  }
  // Only reachable with an authored-empty URL: nothing below can empty a URL that had text in it.
  if (call.url === '') {
    out.push("  if (!url) throw new Error('URL is required, so no request could be sent');");
  }

  // ---- headers, then the credential, which wins on a collision --------------------------------
  out.push('  const headers: Record<string, string> = {};');
  for (const header of call.headers) {
    const code = httpValueCode(header);
    const assign = `headers[${lit(header.name)}] = String(${code});`;
    out.push(header.from.kind === 'literal' ? `  ${assign}` : `  if (${code} !== undefined && ${code} !== null) ${assign}`);
  }
  if (call.auth?.kind === 'bearer') {
    const token = httpValueCode(call.auth.token);
    out.push(`  if (${token}) headers['Authorization'] = \`Bearer \${${token}}\`;`);
  } else if (call.auth?.kind === 'basic') {
    const user = httpValueCode(call.auth.username);
    const pass = httpValueCode(call.auth.password);
    out.push(`  if (${user} && ${pass}) headers['Authorization'] = 'Basic ' + btoa(String(${user}) + ':' + String(${pass}));`);
  } else if (call.auth?.kind === 'apiKey' && call.auth.location === 'header') {
    const name = httpValueCode(call.auth.name);
    const value = httpValueCode(call.auth.value);
    out.push(`  if (${name} && ${value}) headers[String(${name})] = String(${value});`);
  }

  // ---- the body, then the Content-Type the encoding implies ----------------------------------
  out.push(...httpBodyLines(call));
  // `doFetch` defaults the header only for a body that exists and only where nothing has set
  // one — truthiness on both, so an empty urlencoded body (`''`) gets no Content-Type, and a
  // header the author configured is never overwritten. Raw sends none at all, by design.
  if (call.body !== null && (call.body.type === 'json' || call.body.type === 'urlencoded')) {
    const value = call.body.type === 'json' ? 'application/json' : 'application/x-www-form-urlencoded';
    out.push(`  if (payload && !headers['Content-Type']) headers['Content-Type'] = '${value}';`);
  }

  // ---- the request itself ---------------------------------------------------------------------
  out.push(
    '  // The abort controller is the timeout, and nothing else — a Cancel input would need one',
    '  // that outlives this function, which is why a wired Cancel defers (EXP-011 §8).',
    '  const controller = new AbortController();',
    '  let timedOut = false;',
    `  const timer = setTimeout(() => {`,
    '    timedOut = true;',
    '    controller.abort();',
    `  }, ${call.timeout});`,
    '  let response: Response;',
    '  try {',
    `    response = await fetch(url, {`,
    `      method: ${lit(call.method)},`,
    '      headers,',
    '      body: payload,',
    '      signal: controller.signal',
    '    });',
    '  } catch (error) {',
    '    throw new Error(',
    `      timedOut ? \`Request timed out after ${call.timeout} ms\` : error instanceof Error && error.message ? error.message : 'Network error'`,
    '    );',
    '  } finally {',
    '    clearTimeout(timer);',
    '  }',
    "  const contentType = response.headers.get('content-type') ?? '';",
    "  const parsed: unknown = contentType.includes('application/json') ? await response.json() : await response.text();",
    '  const responseHeaders: Record<string, string> = {};',
    '  response.headers.forEach((value, key) => {',
    '    responseHeaders[key] = value;',
    '  });'
  );
  if (call.fields.length > 0) {
    out.push(
      '  // `extractByPath` walks a body of unknown shape and answers undefined for anything it',
      '  // does not find, which is what optional chaining over `any` says here.',
      '  const source = parsed as any;'
    );
  }
  const fieldEntries = call.fields.map((f) => `${tsKey(f.name)}: ${f.steps === null ? 'undefined' : jsonPathCode('source', f.steps)}`);
  out.push(
    `  const fields = ${fieldEntries.length > 0 ? `{ ${fieldEntries.join(', ')} }` : '{}'};`,
    '  if (!response.ok) {',
    '    return {',
    '      ok: false,',
    '      // The node puts exactly this sentence on its Error output for a non-2xx answer.',
    '      error: `HTTP ${response.status}: ${response.statusText}`,',
    '      response: parsed,',
    '      statusCode: response.status,',
    '      responseHeaders,',
    '      fields',
    '    };',
    '  }',
    '  return { ok: true, response: parsed, statusCode: response.status, responseHeaders, fields };',
    '}',
    ''
  );
  return out.join('\n');
}

/** The four body encodings (`buildBody`), including the one place `null` survives. */
function httpBodyLines(call: HttpCallPlan): string[] {
  const body = call.body;
  if (body === null) {
    return [
      `  // ${call.method} sends no body — \`buildBody\` returns before it reads a field.`,
      '  const payload: BodyInit | undefined = undefined;'
    ];
  }
  if (body.type === 'raw') {
    return [`  const payload = ${httpValueCode(body.raw)} as BodyInit;`];
  }
  const lines: string[] = [];
  if (body.type === 'json') {
    lines.push('  const json: Record<string, unknown> = {};');
    for (const field of body.fields) {
      const code = httpValueCode(field);
      const assign = `json[${lit(field.name)}] = ${code};`;
      lines.push(
        field.from.kind === 'literal'
          ? `  ${assign}`
          : // The one site where null is kept: JSON has a native null, so "clear it" and "omit
            // it" are different outcomes here and identical everywhere else (httpnode.ts).
            `  if (${code} !== undefined) ${assign}`
      );
    }
    lines.push('  const payload = Object.keys(json).length > 0 ? JSON.stringify(json) : undefined;');
    return lines;
  }
  if (body.type === 'form') {
    lines.push('  const form = new FormData();');
    for (const field of body.fields) {
      const code = httpValueCode(field);
      const assign = `form.append(${lit(field.name)}, ${code} as string);`;
      lines.push(field.from.kind === 'literal' ? `  ${assign}` : `  if (${code} !== undefined && ${code} !== null) ${assign}`);
    }
    lines.push('  const payload: BodyInit = form;');
    return lines;
  }
  lines.push('  const search = new URLSearchParams();');
  for (const field of body.fields) {
    const code = httpValueCode(field);
    const assign = `search.append(${lit(field.name)}, String(${code}));`;
    lines.push(field.from.kind === 'literal' ? `  ${assign}` : `  if (${code} !== undefined && ${code} !== null) ${assign}`);
  }
  lines.push('  const payload = search.toString();');
  return lines;
}

/** `['items', 0, 'name']` → `source?.items?.[0]?.name` — `extractByPath`'s walk, statically. */
function jsonPathCode(base: string, steps: Array<string | number>): string {
  return steps.reduce<string>((code, step) => {
    if (typeof step === 'number') return `${code}?.[${step}]`;
    return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(step) ? `${code}?.${step}` : `${code}?.[${JSON.stringify(step)}]`;
  }, base);
}

/** An authored name printed as an object key — quoted unless it is already an identifier. */
const tsKey = (name: string): string => (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) ? name : JSON.stringify(name));

/**
 * `src/api/session.ts` — the user family's one module (USER-FAMILY-TARGET §4d).
 *
 * Unlike the collection stubs there is nothing to key on: a project has one session, so the
 * three writes and the read share a file whichever of them translated.
 *
 * Connected (EXP-009), the read becomes a real hook: `useSyncExternalStore` over the stored
 * session, snapshot = the raw stored string (stable, so no render loop), parsed in a `useMemo`
 * keyed on it. The emit side was already shaped for this — `effectDeps` treats session fields
 * as reactive reads.
 */
function sessionModule(ir: ExportIR, project: ProjectPlan, backend: CloudServicesIR | undefined): [string, string] | null {
  type Site = { componentPath: string; nodeId: string };
  const byFn = new Map<string, { verb: SessionCallPlan['verb']; sites: Site[] }>();
  for (const plan of project.plans) {
    for (const call of plan.sessionCalls) {
      let entry = byFn.get(call.fnName);
      if (entry === undefined) byFn.set(call.fnName, (entry = { verb: call.verb, sites: [] }));
      entry.sites.push({ componentPath: plan.path, nodeId: call.nodeId });
    }
  }
  if (byFn.size === 0) return null;

  const nodeLabel = (site: Site): string => {
    const node = ir.components.find((c) => c.path === site.componentPath)?.nodes.find((n) => n.id === site.nodeId);
    return node?.authoredLabel ? `"${node.authoredLabel}" ` : '';
  };
  const marker = backend !== undefined ? 'Source: ' : 'TODO(export): ';
  const siteLine = (site: Site, type: string): string =>
    ` * ${marker}${nodeLabel(site)}(${type} \`${site.nodeId}\` on /${site.componentPath})`;

  const SPEC: Record<
    SessionCallPlan['verb'],
    { nodeType: string; past: string; signature: string }
  > = {
    login: {
      nodeType: 'net.noodl.user.LogIn',
      past: 'signed in against',
      signature: '(username: string, password: string): Promise<SessionUser>'
    },
    logout: { nodeType: 'net.noodl.user.LogOut', past: 'ended the session on', signature: '(): Promise<void>' },
    signup: {
      nodeType: 'net.noodl.user.SignUp',
      past: 'created an account on',
      signature:
        '(data: { username?: string; password?: string; email?: string }): Promise<SessionUser>'
    },
    read: { nodeType: 'net.noodl.user.User', past: '', signature: '' },
    // EXP-011 §44.
    'update-user': {
      nodeType: 'net.noodl.user.SetUserProperties',
      past: 'wrote the signed-in user on',
      signature: '(data: UserProperties): Promise<void>'
    },
    'magic-link': {
      nodeType: 'net.noodl.user.RequestMagicLink',
      past: 'requested a sign-in link from',
      signature: '(email: string, redirect?: string): Promise<void>'
    }
  };

  const verbs = new Set([...byFn.values()].map((entry) => entry.verb));
  const needsUserMapping = verbs.has('login') || verbs.has('signup') || verbs.has('read');

  const parts: string[] = ['export interface SessionUser {\n  id: string;\n  username?: string;\n  email?: string;\n}\n'];
  if (verbs.has('update-user')) {
    // EXP-011 §44 — what a `Set User Properties` may send: the two static ports, then the `_User`
    // columns any site writes, each typed by its wire (the record verbs' rule). One interface for
    // the project, as there is one `_User` class; a column two sites write with different types
    // is `unknown`, which both satisfy.
    const columns = new Map<string, string>();
    for (const plan of project.plans) {
      for (const call of plan.sessionCalls) {
        for (const write of call.writes ?? []) {
          const seen = columns.get(write.name);
          columns.set(write.name, seen === undefined || seen === write.tsType ? write.tsType : 'unknown');
        }
      }
    }
    const lines = ['  username?: string;', '  email?: string;'];
    for (const [name, tsType] of columns) {
      if (name === 'username' || name === 'email') continue;
      lines.push(`  ${/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) ? name : JSON.stringify(name)}?: ${tsType};`);
    }
    // A `type`, not an `interface`: the client's `updateUserRequest` takes `Record<string,
    // unknown>`, and an interface has no implicit index signature (TS2345 — the fixture's
    // typecheck found it), while an object type literal is assignable to one.
    parts.push(
      '/** The fields a Set User Properties writes to the signed-in user (EXP-011 §44). */\n' +
        `export type UserProperties = {\n${lines.join('\n')}\n};\n`
    );
  }
  if (backend !== undefined && needsUserMapping) {
    parts.push(
      'function toSessionUser(session: WireSession): SessionUser {\n' +
        '  return { id: session.objectId, username: session.username, email: session.email };\n}\n'
    );
  }
  for (const [fnName, { verb, sites }] of byFn) {
    const spec = SPEC[verb];
    if (verb === 'read') {
      // Stub: the one non-throwing export, and §4c is the whole argument for it: logged-out is
      // a plausible state of a real session — the runtime says a server render always sees one —
      // and it is the only state reachable through this module while `logIn` throws.
      // Connected: a real hook over the stored session (EXP-009 ruling 3).
      parts.push(
        backend !== undefined
          ? `/**\n${sites.map((s) => siteLine(s, spec.nodeType)).join('\n')}\n` +
              ` * Reads the signed-in user from the stored session — the same store a login\n` +
              ` * writes — and re-renders when it changes. A server render sees "nobody is\n` +
              ` * signed in", which is what the runtime's own session store answers there.\n */\n` +
              `export function ${fnName}(): { authenticated: boolean; user: SessionUser | null } {\n` +
              `  const raw = useSyncExternalStore(subscribeSession, readSessionRaw, readNoSession);\n` +
              `  return useMemo(() => {\n` +
              `    if (raw === undefined) return { authenticated: false, user: null };\n` +
              `    const session = readSession();\n` +
              `    return session === undefined\n` +
              `      ? { authenticated: false, user: null }\n` +
              `      : { authenticated: true, user: toSessionUser(session) };\n` +
              `  }, [raw]);\n}\n` +
              `\nfunction readNoSession(): string | undefined {\n  return undefined;\n}\n`
          : `/**\n${sites.map((s) => siteLine(s, spec.nodeType)).join('\n')}\n` +
              ` * read the signed-in user from the project's NodeGX backend. Connect this to your own auth; until\n` +
              ` * you do it answers "nobody is signed in", which is also what a server render sees.\n */\n` +
              `export function ${fnName}(): { authenticated: boolean; user: SessionUser | null } {\n` +
              `  return { authenticated: false, user: null };\n}\n`
      );
      continue;
    }
    if (backend !== undefined) {
      const connected: Record<UserVerb, { comment: string; body: string }> = {
        login: {
          comment: ' * Signs in against the project\'s NodeGX backend and stores the session.',
          body: '  return toSessionUser(await logInRequest(username, password));'
        },
        logout: {
          comment: " * Ends the session on the project's NodeGX backend.",
          body: '  await logOutRequest();'
        },
        signup: {
          comment: " * Creates an account on the project's NodeGX backend and stores the session.",
          body: '  return toSessionUser(await signUpRequest(data));'
        },
        'update-user': {
          comment:
            " * Writes the fields to the signed-in user on the project's NodeGX backend and rewrites the\n" +
            ' * stored session with them, so a User read re-renders. Refuses when nobody is signed in.',
          body: '  await updateUserRequest(data);'
        },
        'magic-link': {
          comment:
            " * Asks the project's NodeGX backend to email a one-click sign-in link. Resolving never means\n" +
            ' * an account exists for the address — the backend answers alike for every address.',
          body: '  await requestMagicLinkRequest(email, redirect);'
        }
      };
      const { comment, body } = connected[verb];
      parts.push(
        `/**\n${sites.map((s) => siteLine(s, spec.nodeType)).join('\n')}\n` +
          `${comment}\n` +
          ` * A failed request throws, which is what the graph's Failure path already handles.\n */\n` +
          `export async function ${fnName}${spec.signature} {\n${body}\n}\n`
      );
      continue;
    }
    parts.push(
      `/**\n${sites.map((s) => siteLine(s, spec.nodeType)).join('\n')}\n` +
        ` * ${spec.past} the project's NodeGX backend. Connect this to your own auth; until you do it throws,\n` +
        ` * which is what the graph's Failure path already handles.\n */\n` +
        `export async function ${fnName}${spec.signature} {\n` +
        `  throw new Error('${fnName} is not connected to a backend yet');\n}\n`
    );
  }

  if (backend === undefined) {
    return ['src/api/session.ts', GENERATED_TS + parts.join('\n')];
  }
  const reactImport = verbs.has('read') ? "import { useMemo, useSyncExternalStore } from 'react';\n\n" : '';
  const clientNames: string[] = [];
  if (verbs.has('login')) clientNames.push('logInRequest');
  if (verbs.has('logout')) clientNames.push('logOutRequest');
  if (verbs.has('read')) clientNames.push('readSession', 'readSessionRaw', 'subscribeSession');
  if (verbs.has('signup')) clientNames.push('signUpRequest');
  if (verbs.has('update-user')) clientNames.push('updateUserRequest');
  if (verbs.has('magic-link')) clientNames.push('requestMagicLinkRequest');
  clientNames.sort();
  const importNames = needsUserMapping ? [...clientNames, 'type WireSession'] : clientNames;
  const clientImport = `import { ${importNames.join(', ')} } from './client';\n\n`;
  return ['src/api/session.ts', GENERATED_MODULE_TS + reactImport + clientImport + parts.join('\n')];
}

/** A column name is user text; only an identifier can be a bare interface key. */
function tsFieldKey(name: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) ? name : JSON.stringify(name);
}

/** A collection name / endpoint / appId is user text; it lands in generated code only escaped. */
function tsStringLiteral(text: string): string {
  return `'${text.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

/** An env value is one line by definition; anything else in the metadata is not one. */
function envLine(name: string, value: string): string {
  return `${name}=${value.replace(/[\r\n]/g, '')}\n`;
}

/**
 * `src/api/client.ts` — the Parse wire protocol the running app speaks (noodl-runtime's
 * `ParseWireAdapter` / `ParseAuthAdapter` / `SessionStore`), reduced to what the generated
 * calls need. Hand-written first and typechecked in the harness (EXP-009-CLIENT-TARGET-OUTPUT);
 * the only project-specific bytes are the two env-var defaults.
 *
 * Protocol facts with named sources — do not "fix" them here:
 * - the query is a POST-tunnelled GET (`_method: 'GET'`): a real GET truncates large filters
 *   at the URL length limit (`ParseWireAdapter.query`).
 * - the session key `Parse/<appId>/currentUser` is the runtime's own and unchangeable — a
 *   different key is a silent mass logout (`SessionStore.parseSessionKey`).
 * - `POST /users` answers objectId + createdAt + sessionToken only; the caller's identity is
 *   merged into the stored session (`ParseAuthAdapter.signUp` — its absence was a live defect).
 * - no master key, ever: it is a server credential, and this file ships in a browser bundle.
 */
function clientModule(backend: CloudServicesIR): string {
  return (
    GENERATED_CLIENT_TS +
    `/**
 * The NodeGX backend client — the Parse wire protocol the running app speaks
 * (noodl-runtime's ParseWireAdapter), reduced to what this app's calls need:
 * fetch, the header pair, the \`/classes\` path shapes and the session token.
 *
 * The endpoint and application id are environment variables whose defaults are
 * the project's own backend (see .env.example), so the exported repo runs
 * against it out of the box and a deploy points elsewhere without editing
 * generated code. No privileged credential appears here: the application id is
 * the non-secret identifier that ships with every deployed app, and the
 * master key is a server credential that never belongs in a browser bundle.
 */

const ENDPOINT: string = import.meta.env.VITE_NODEGX_ENDPOINT ?? ${tsStringLiteral(backend.endpoint)};
const APP_ID: string = import.meta.env.VITE_NODEGX_APP_ID ?? ${tsStringLiteral(backend.appId)};

/**
 * The session lives where every deployed NodeGX app keeps it — localStorage
 * under \`Parse/<appId>/currentUser\`, the runtime's own key — so the exported
 * app and the app it was exported from agree about who is signed in.
 */
const SESSION_KEY = \`Parse/\${APP_ID}/currentUser\`;

/** The wire's session record, stored verbatim. Its user fields are the backend's. */
export interface WireSession {
  objectId: string;
  sessionToken?: string;
  username?: string;
  email?: string;
  [field: string]: unknown;
}

function sessionStorageArea(): Storage | undefined {
  // Absent during a server render; a store with no storage reads "signed out".
  return typeof localStorage === 'undefined' ? undefined : localStorage;
}

/** The stored text, or undefined — the stable snapshot \`useSession\` keys on. */
export function readSessionRaw(): string | undefined {
  const raw = sessionStorageArea()?.[SESSION_KEY];
  return typeof raw === 'string' ? raw : undefined;
}

/** The stored session, or undefined when there is none or it will not parse. */
export function readSession(): WireSession | undefined {
  const raw = readSessionRaw();
  if (raw === undefined) return undefined;
  try {
    return JSON.parse(raw) as WireSession;
  } catch {
    return undefined;
  }
}

const sessionListeners = new Set<() => void>();

function notifySessionChanged(): void {
  for (const listener of [...sessionListeners]) listener();
}

/**
 * Hear about session changes — this tab's through the listener set, other
 * tabs' through the \`storage\` event (which fires only in tabs that did not
 * make the change). Returns an unsubscribe function.
 */
export function subscribeSession(listener: () => void): () => void {
  sessionListeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    // A null key is \`storage.clear()\` — everything changed, including this.
    if (event.key === null || event.key === SESSION_KEY) listener();
  };
  if (typeof window !== 'undefined') window.addEventListener('storage', onStorage);
  return () => {
    sessionListeners.delete(listener);
    if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage);
  };
}

function writeSession(session: WireSession): void {
  const storage = sessionStorageArea();
  if (storage !== undefined) storage[SESSION_KEY] = JSON.stringify(session);
  notifySessionChanged();
}

function clearSession(): void {
  const storage = sessionStorageArea();
  if (storage !== undefined) delete storage[SESSION_KEY];
  notifySessionChanged();
}

/**
 * One request on the wire. A failed request throws an Error carrying the
 * backend's own message, which is what every generated Failure path handles.
 *
 * A \`file\` is sent as the body itself, with no JSON content type — the upload
 * route reads raw bytes and sniffs the type (the runtime's own \`xhr.send(file)\`).
 */
async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; file?: Blob; headers?: Record<string, string> } = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'X-Parse-Application-Id': APP_ID,
    ...(options.file === undefined ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers ?? {})
  };
  const sessionToken = readSession()?.sessionToken;
  if (sessionToken !== undefined) headers['X-Parse-Session-Token'] = sessionToken;

  let response: Response;
  try {
    response = await fetch(ENDPOINT + path, {
      method: options.method ?? 'GET',
      headers,
      body: options.file !== undefined ? options.file : options.body === undefined ? undefined : JSON.stringify(options.body)
    });
  } catch {
    // A backend that cannot be reached is one sentence, the same one callFunction() throws — not
    // the browser's own (Chrome says "Failed to fetch", Firefox "NetworkError when attempting to
    // fetch resource"). The §43 drive read the browser's through a Record's Error (D8).
    throw new Error(\`Could not reach the backend at \${ENDPOINT}\`);
  }
  const text = await response.text();
  let json: { error?: unknown } | undefined;
  try {
    json = text.length > 0 ? JSON.parse(text) : undefined;
  } catch {
    json = undefined;
  }
  if (!response.ok) {
    throw new Error(typeof json?.error === 'string' ? json.error : \`Request failed (\${response.status})\`);
  }
  return json as T;
}

/** The wire calls a record's identity \`objectId\`; the generated interfaces say \`id\`. */
function fromWire<T extends { id: string }>(record: Record<string, unknown>): T {
  const { objectId, ...fields } = record;
  return { id: String(objectId), ...fields } as unknown as T;
}

export interface QueryParams {
  where?: unknown;
  sort?: string[];
  limit?: number;
  skip?: number;
}

export async function query<T extends { id: string }>(collection: string, params: QueryParams = {}): Promise<T[]> {
  // A POST that tunnels a GET — the runtime's own shape: a query has to carry
  // a body, and a real GET truncates large filters at the URL length limit.
  const response = await request<{ results: Record<string, unknown>[] }>(\`/classes/\${collection}\`, {
    method: 'POST',
    body: {
      _method: 'GET',
      where: params.where,
      order: params.sort?.join(','),
      limit: params.limit,
      skip: params.skip
    }
  });
  return response.results.map((record) => fromWire<T>(record));
}

/** One record by Id — the runtime's own \`GET /classes/<collection>/<id>\` (ParseWireAdapter.fetch). */
export async function fetchOne<T extends { id: string }>(collection: string, id: string): Promise<T> {
  const response = await request<Record<string, unknown>>(\`/classes/\${collection}/\${encodeURIComponent(id)}\`);
  return fromWire<T>(response);
}

export async function create<T extends { id: string }>(collection: string, data: Partial<T>): Promise<T> {
  const response = await request<Record<string, unknown>>(\`/classes/\${collection}\`, {
    method: 'POST',
    body: data
  });
  return fromWire<T>({ ...data, ...response });
}

export async function update<T extends { id: string }>(collection: string, id: string, data: Partial<T>): Promise<T> {
  // The wire answers a PUT with the changed fields only (\`updatedAt\`), so the
  // caller's own data is the record the graph continues with.
  const response = await request<Record<string, unknown>>(\`/classes/\${collection}/\${encodeURIComponent(id)}\`, {
    method: 'PUT',
    body: data
  });
  const { objectId: _objectId, ...fields } = response;
  return { ...data, ...fields, id } as unknown as T;
}

export async function remove(collection: string, id: string): Promise<void> {
  await request<unknown>(\`/classes/\${collection}/\${encodeURIComponent(id)}\`, { method: 'DELETE' });
}

export async function logInRequest(username: string, password: string): Promise<WireSession> {
  // \`_method: 'GET'\` is the login tunnel the wire has always used.
  const session = await request<WireSession>('/login', {
    method: 'POST',
    body: { username, password, _method: 'GET' }
  });
  writeSession(session);
  return session;
}

export async function logOutRequest(): Promise<void> {
  await request<unknown>('/logout', { method: 'POST', body: {} });
  clearSession();
}

export async function signUpRequest(data: {
  username?: string;
  password?: string;
  email?: string;
}): Promise<WireSession> {
  const response = await request<WireSession>('/users', { method: 'POST', body: data });
  // \`POST /users\` answers objectId + createdAt + sessionToken and nothing
  // else; the identity the caller just supplied is merged so the session shows
  // it immediately (the runtime client's own hard-won lesson).
  const session: WireSession = { ...response };
  if (data.username !== undefined) session.username = data.username;
  if (data.email !== undefined) session.email = data.email;
  writeSession(session);
  return session;
}

/**
 * \`PUT /users/<objectId>\` — the Set User Properties node's own request (EXP-011 §44), which is
 * \`ParseAuthAdapter.setUserProperties\`: refused with this sentence before any request when
 * nobody is signed in, the fields written to the signed-in user's own row (the backend accepts
 * no other id), and the stored session rewritten with them so a User read re-renders. Email and
 * Username left blank keep their current value — the node's own contract — and a column is
 * sent as given.
 */
export async function updateUserRequest(data: Record<string, unknown>): Promise<WireSession> {
  const session = readSession();
  if (session === undefined) throw new Error('Nobody is signed in.');
  const body: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    if ((key === 'username' || key === 'email') && value === '') continue;
    body[key] = value;
  }
  await request<{ updatedAt?: string }>(\`/users/\${encodeURIComponent(session.objectId)}\`, {
    method: 'PUT',
    body
  });
  const next: WireSession = { ...session, ...body };
  writeSession(next);
  return next;
}

/**
 * \`POST /auth/magic-link\` — the Request Magic Link node's own request (EXP-011 §44). The
 * backend answers 200 for a known and an unknown address alike, deliberately, so resolving
 * never means an account exists. A blank redirect is the current page minus the sign-in
 * return parameters, exactly as the runtime fills it (\`_currentUrlWithoutAuthParams\`).
 */
export async function requestMagicLinkRequest(email: string, redirect?: string): Promise<void> {
  await request<unknown>('/auth/magic-link', {
    method: 'POST',
    body: { email, redirect: redirect || currentUrlWithoutAuthParams() }
  });
}

function currentUrlWithoutAuthParams(): string {
  const url = new URL(window.location.href);
  url.searchParams.delete('nodegx_auth');
  url.searchParams.delete('nodegx_auth_error');
  return url.toString();
}

/**
 * \`POST /files/<name>\` — the Upload File node's own request (EXP-011 §45), which is
 * \`ParseWireAdapter.uploadFile\`: the bytes as the body (the backend sniffs the type itself
 * and ignores any declared one), the app id and the session token, and
 * \`X-NodeGX-File-Private: true\` where the node's Private is on — the header the backend reads
 * to restrict the stored file to its uploader. The 201 body is the stored file: its STORED
 * name, its url, and the size and type the backend recorded.
 */
export async function uploadFileRequest(
  file: File,
  isPrivate: boolean
): Promise<{ name: string; url: string; contentType?: string; size?: number }> {
  return request(\`/files/\${encodeURIComponent(file.name)}\`, {
    method: 'POST',
    file,
    headers: isPrivate ? { 'X-NodeGX-File-Private': 'true' } : undefined
  });
}

/**
 * \`GET /files/<name>/sign\` — the Sign File URL node's own request (EXP-011 §45): a fresh
 * \`?exp=&sig=\` link, minted only for a caller who could read the file directly (a private file
 * answers 403 "This file is private." to anyone else, exactly as reading it would).
 */
export async function signFileUrlRequest(name: string): Promise<{ url: string; expiresAt: string; ttlSeconds: number }> {
  return request(\`/files/\${encodeURIComponent(name)}/sign\`);
}

/**
 * \`POST /functions/<name>\` — the Cloud Function node's own request (EXP-011 §41), which is
 * \`cloudfunction2.ts\`'s \`_makeRequest\`: the app id, the session token when someone is signed
 * in, the params as the JSON body. 200/201 carries \`result\`; anything else is a failure whose
 * message is the backend's \`error\` or the runtime's own sentence for it.
 */
export async function callFunction<T>(name: string, params: Record<string, unknown>): Promise<T> {
  const headers: Record<string, string> = {
    'X-Parse-Application-Id': APP_ID,
    'Content-Type': 'application/json'
  };
  const sessionToken = readSession()?.sessionToken;
  if (sessionToken !== undefined) headers['X-Parse-Session-Token'] = sessionToken;
  let response: Response;
  try {
    response = await fetch(\`\${ENDPOINT}/functions/\${encodeURIComponent(name)}\`, {
      method: 'POST',
      headers,
      body: JSON.stringify(params)
    });
  } catch {
    throw new Error(\`Could not reach the backend at \${ENDPOINT}\`);
  }
  const text = await response.text();
  let json: { result?: T; error?: unknown } | undefined;
  try {
    json = text.length > 0 ? JSON.parse(text) : undefined;
  } catch {
    json = undefined;
  }
  if (response.status !== 200 && response.status !== 201) {
    throw new Error(typeof json?.error === 'string' ? json.error : 'Failed running cloud function.');
  }
  // No result is still success: the node keeps its previous results and fires Done.
  return (json?.result ?? {}) as T;
}
`
  );
}

function envExample(backend: CloudServicesIR): string {
  return (
    "# The exported app's backend — defaults are the project's own (src/api/client.ts).\n" +
    envLine('VITE_NODEGX_ENDPOINT', backend.endpoint) +
    envLine('VITE_NODEGX_APP_ID', backend.appId)
  );
}

