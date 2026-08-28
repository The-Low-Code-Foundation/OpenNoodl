/**
 * Whole-app emission: the scaffold, then the visual generator's component/page files replacing
 * the scaffold's placeholders, then the app-state modules (stores/events — step 5) and the
 * typed api stubs the pages consume. The dependency list stays computed from the output
 * (TARGET-OUTPUT §3): @nodegx/core joins package.json exactly when a generated file imports it.
 */

import { Catalog, CatalogIndex } from '../catalog';
import { planProject, ProjectPlan, QueryPlan, SessionCallPlan } from '../analyze/plan';
import { CloudServicesIR, ExportIR } from '../ir/types';
import { emitComponent } from './component';
import { EmittedCopy, emitKits } from './kits';
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
  notes.push(...kits.notes, ...moduleNotes(ir, project));

  if (ir.project.cloudComponents.length > 0) {
    notes.push(
      `${ir.project.cloudComponents.length} cloud function component(s) skipped — they run on the backend's interpreter, not in the frontend export: ${ir.project.cloudComponents.join(', ')}`
    );
  }

  // Reachability is reported, never acted on: an unreachable component is still emitted, because
  // the author may be mid-build and the export is not the place to decide their project has dead
  // code. What it changes is how the rest of this list reads — a deferral in a component no route
  // reaches is not a gap in the export's reach (reach.ts, RECORD-VERBS §20).
  for (const legacy of project.reachability.unreachable) {
    notes.push(
      `${legacy.replace(/^\//, '')}: no route reaches this component, so nothing in the running app renders it — its notes below describe code the app never runs`
    );
  }

  for (const plan of project.plans) {
    if (plan.skipReason) {
      if (plan.rootId === null && !plan.file) notes.push(`${plan.path}: ${plan.skipReason}`);
      continue;
    }
    const emitted = emitComponent(plan, project, ir, index, kits.bindings);
    if (!emitted) continue;
    Object.assign(files, emitted.files);
    notes.push(...emitted.notes);
    notes.push(...plan.notes.map((note) => `${plan.path}: ${note}`));
  }

  const api = apiModules(ir, project);
  for (const [path, content] of api.files) {
    files[path] = content;
  }
  notes.push(...api.notes);
  Object.assign(files, emitStateModules(project));

  // Dependencies are computed from the output (TARGET-OUTPUT §3): the library is earned by an
  // import, never declared up front.
  const usesCore = Object.entries(files).some(
    ([path, content]) => path !== 'package.json' && content.includes("from '@nodegx/core")
  );
  if (usesCore) {
    files['package.json'] = withCoreDependency(files['package.json']);
  }

  return {
    files: Object.fromEntries(Object.entries(files).sort(([a], [b]) => (a < b ? -1 : 1))),
    copies: [...kits.copies].sort((a, b) => (a.to < b.to ? -1 : a.to > b.to ? 1 : 0)),
    notes
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
 *   speaks the same Parse wire the running app does. `.env.example` and a README arrive with it.
 * - **Stub** (no backend, AC7): byte-identical to what this emitted before EXP-009 — reads
 *   answer empty, writes throw — with the reason named in the report. A half-declared backend
 *   parses to none (parseCloudServices), so it lands here too.
 */
function apiModules(ir: ExportIR, project: ProjectPlan): { files: Array<[string, string]>; notes: string[] } {
  type Site = { componentPath: string; nodeId: string };
  type Module = {
    typeName: string;
    moduleBase: string;
    fetchName?: string;
    querySites: Site[];
    /** Mutation function name → its call sites, first-use order (RECORD-VERBS-TARGET §4d). */
    mutations: Map<string, { verb: 'create' | 'update' | 'delete'; sites: Site[] }>;
    /** Column → type, from the graph's writes; first-use order, first writer wins. */
    writes: Map<string, string>;
  };
  const byCollection = new Map<string, Module>();
  const moduleFor = (collectionName: string, typeName: string, moduleBase: string): Module => {
    let entry = byCollection.get(collectionName);
    if (entry === undefined) {
      byCollection.set(
        collectionName,
        (entry = { typeName, moduleBase, querySites: [], mutations: new Map(), writes: new Map() })
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
  const hasApi = byCollection.size > 0 || hasSessionCalls;
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
    const { typeName, moduleBase, fetchName, querySites, mutations, writes } = module;

    // The schema snapshot is the authority on a column's declared type, and the graph's writes
    // are evidence of columns the snapshot does not carry — most of the corpus has no snapshot
    // at all (MutationPlan.writes). Schema order first, then graph-written extras in first-use
    // order; `id` is emitted above and never repeated.
    const columns = new Map<string, string>();
    for (const col of schema?.columns ?? []) columns.set(col.name, tsColumnType(col.type));
    for (const [name, tsType] of writes) if (!columns.has(name)) columns.set(name, tsType);
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

  if (backend !== undefined && hasApi) {
    stubs.push(['src/api/client.ts', clientModule(backend)]);
    stubs.push(['.env.example', envExample(backend)]);
    stubs.push(['README.md', readmeMd(ir, backend)]);
  }
  return { files: stubs, notes };
}

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
    read: { nodeType: 'net.noodl.user.User', past: '', signature: '' }
  };

  const verbs = new Set([...byFn.values()].map((entry) => entry.verb));
  const needsUserMapping = verbs.has('login') || verbs.has('signup') || verbs.has('read');

  const parts: string[] = ['export interface SessionUser {\n  id: string;\n  username?: string;\n  email?: string;\n}\n'];
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
      const connected: Record<'login' | 'logout' | 'signup', { comment: string; body: string }> = {
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
  clientNames.sort();
  const importNames = needsUserMapping ? [...clientNames, 'type WireSession'] : clientNames;
  const clientImport = `import { ${importNames.join(', ')} } from './client';\n\n`;
  return ['src/api/session.ts', GENERATED_MODULE_TS + reactImport + clientImport + parts.join('\n')];
}

/** A column name is user text; only an identifier can be a bare interface key. */
function tsFieldKey(name: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) ? name : JSON.stringify(name);
}

function tsColumnType(columnType: string): string {
  switch (columnType) {
    case 'Boolean':
      return 'boolean';
    case 'Number':
      return 'number';
    default:
      return 'string';
  }
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
 */
async function request<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = {
    'X-Parse-Application-Id': APP_ID,
    'Content-Type': 'application/json'
  };
  const sessionToken = readSession()?.sessionToken;
  if (sessionToken !== undefined) headers['X-Parse-Session-Token'] = sessionToken;

  const response = await fetch(ENDPOINT + path, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
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

function readmeMd(ir: ExportIR, backend: CloudServicesIR): string {
  return `# ${ir.project.name}

Exported from NodeGX.

## Run

\`\`\`
npm install
npm run dev
\`\`\`

## Backend

This app talks to the project's NodeGX backend through \`src/api/client.ts\`. Two environment
variables configure it, with the project's own values as defaults:

- \`VITE_NODEGX_ENDPOINT\` — the backend's base URL (default: \`${backend.endpoint}\`)
- \`VITE_NODEGX_APP_ID\` — the backend's application id (default: \`${backend.appId}\`)

Copy \`.env.example\` to \`.env\` to point at another deployment; no generated code needs editing.
`;
}
