/**
 * BCN-004 step 6 — the five backends driven **through the Record nodes**.
 *
 * `bcn-004-rest-driver.ts` drove `RestDataAdapter` directly and proved the adapter
 * builds the right requests. This drives the layer above it, which is a different
 * claim and the one step 6 asks for: that a **Query Records / Create New Record /
 * Set Record Properties / Delete Record** node, carrying ordinary parameters,
 * reaches the right backend and reports the right answer on its own output ports.
 *
 * Everything between the parameter and the wire is live: `registerInputIfNeeded`
 * decides what each port name *means*, `CloudStore.forBackend` routes,
 * `resolveBackendTarget` picks the adapter, `getStorageFilter` produces both a
 * neutral filter and a Parse document, and `CloudStore._fromJSON` turns rows into
 * `Model`s. Most of that is step 5 code that no live check has executed — the
 * picker was *seen* rendering in the editor, but nothing had run a query through
 * the routed store.
 *
 * ## Why the node layer can fail where the adapter passed
 *
 * The adapter is handed a `BackendHandle` and a `QueryOptions`. The node has to
 * *produce* both, and each of these produces something plausible and wrong:
 *
 * 1. **`backendId` reaching `storageSettings` instead of the router.** Without its
 *    branch in `registerInputIfNeeded` the picker's value falls through to
 *    `userInputSetter`, lands in `storageSettings`, and nothing reads it — so the
 *    node queries the *active* backend while the editor shows another one selected.
 *    Every check here asserts the rows came from the backend it named.
 * 2. **`limit`/`skip` are `storageEnableLimit`-gated.** `getStorageLimit` returns
 *    `undefined` unless that boolean is on, so a Skip of 2 with the gate off is
 *    silently no pagination at all — and looks identical to page one.
 * 3. **`usesNeutralFilter` picking the wrong one of the two filters.** Sending a
 *    REST backend the already-lowered Parse document is RUN-003's live 403.
 * 4. **`objectId` as a `number`.** Directus and PostgREST hand back integers, so
 *    `firstItemId` and every `Id` output carry `7` rather than `'7'`. Recorded per
 *    backend below, and followed through the Model store in `objectIdChecks`.
 *
 * ## The pagination check, and why the obvious one is worthless
 *
 * `limit=2, skip=2` passes under a **broken** implementation: a raw offset of 2 and
 * a 1-based page `floor(2/2)+1` are both `2`. BCN-004's transport driver found that
 * by mutation-testing itself. So pagination here is **`limit=1, skip=2`** — page
 * `floor(2/1)+1 = 3` against offset `2` — and it asserts the third row *of the
 * filtered set*, which is the RUN-003 `total_count` defect from the other side.
 *
 * ## Namespacing, because the rig is shared
 *
 * Other work runs against these servers concurrently (Directus currently carries a
 * `bcn005_*` relation fixture). So: this driver owns the collection `bcn004n` where
 * it can create one, and on PostgREST — where creating a table needs DDL the wire
 * has no route for — it reuses the seeded `articles` table but writes only rows
 * whose `status` is `bcn004n-pub`/`bcn004n-draft` and deletes only those. It never
 * truncates a shared table.
 *
 * Keeping the *status value* namespaced rather than the title is deliberate: it lets
 * **one filter** — `where({status: {equalTo: 'bcn004n-pub'}})` — be the filter sent
 * to all five backends, which is criterion 5 ("the same filter returns the same
 * rows") asked at the node layer instead of the translator layer.
 *
 * ## Running it
 *
 *   docker compose --profile supabase --profile aggregate up -d
 *   docker compose --profile parse up -d
 *   # and a local nodegx-backend:
 *   #   node packages/nodegx-backend/bin/nodegx-backend.js serve --port 8099 --data-dir <dir>
 *   node bcn-004-node-driver.build.mjs && node bcn-004-node-driver.cjs
 *
 * The Supabase write grants (the rig seeds `web_anon` with SELECT only, so every
 * create/update/delete answers 42501 and tells you nothing about the wire):
 *
 *   docker exec uba-e2e-supabase-db-1 psql -U postgres -d app \
 *     -c "GRANT INSERT, UPDATE, DELETE ON articles, authors TO web_anon;
 *         GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO web_anon;"
 *
 * ⚠️ Do not pipe this into `head` — it closes the pipe, SIGPIPEs node, and the run
 * dies partway through looking like the server stopped answering. Redirect to a file.
 *
 * ⚠️ The rig's PostgREST is mounted at the root; real Supabase serves the same
 * binary under `/rest/v1/`, which is what the wire profile encodes. Like the
 * transport driver, this stands up a tiny reverse proxy rather than editing the
 * profile — the point is to exercise the path the shipped code builds.
 */

import * as http from 'node:http';

import NodeContext = require('../../../../packages/noodl-runtime/src/nodecontext');
import NodeDefinition = require('../../../../packages/noodl-runtime/src/nodedefinition');
import CloudStore = require('../../../../packages/noodl-runtime/src/api/cloudstore');

import DbCollectionModule = require('../../../../packages/noodl-runtime/src/nodes/std-library/data/dbcollectionnode2');
import NewRecordModule = require('../../../../packages/noodl-runtime/src/nodes/std-library/data/newdbmodelpropertiesnode');
import SetRecordModule = require('../../../../packages/noodl-runtime/src/nodes/std-library/data/setdbmodelpropertiesnode');
import DeleteRecordModule = require('../../../../packages/noodl-runtime/src/nodes/std-library/data/deletedbmodelpropertiesnode');

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-var-requires */
type Any = any;

const DIRECTUS = 'http://localhost:8055';
const POSTGREST = 'http://localhost:8056';
const POCKETBASE = 'http://localhost:8091';
const PARSE = 'http://localhost:8092/parse';
const NODEGX = 'http://127.0.0.1:8099';

/** Where the proxy that mounts the rig's PostgREST under `/rest/v1/` listens. */
const PROXY_PORT = 8156;
const POSTGREST_VIA_PROXY = `http://localhost:${PROXY_PORT}`;

const NS = 'bcn004n';
const PUB = `${NS}-pub`;
const DRAFT = `${NS}-draft`;

let pass = 0;
let fail = 0;
const failures: string[] = [];
const notes: string[] = [];

function say(line = '') {
  console.log(line);
}
function head(title: string) {
  say();
  say('='.repeat(76));
  say(title);
  say('='.repeat(76));
}
function check(name: string, got: unknown, want: unknown) {
  if (JSON.stringify(got) === JSON.stringify(want)) {
    pass++;
    say(`  PASS  ${name}`);
  } else {
    fail++;
    failures.push(name);
    say(`  FAIL  ${name}`);
    say(`          want ${JSON.stringify(want)}`);
    say(`          got  ${JSON.stringify(got)}`);
  }
}
function checkThat(name: string, ok: boolean, detail = '') {
  if (ok) {
    pass++;
    say(`  PASS  ${name}`);
  } else {
    fail++;
    failures.push(name);
    say(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`);
  }
}
function note(line: string) {
  notes.push(line);
  say(`  NOTE  ${line}`);
}

// ---------------------------------------------------------------------------
// HTTP helper for fixtures only. The checks go through the nodes.
// ---------------------------------------------------------------------------

async function req(url: string, init: RequestInit = {}) {
  const res = await fetch(url, init);
  const text = await res.text();
  let json: Any;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    json = undefined;
  }
  return { status: res.status, json, text };
}

// ---------------------------------------------------------------------------
// The runtime the nodes read their metadata off
// ---------------------------------------------------------------------------

let metadata: Record<string, Any> = {};

function installRuntime() {
  // `resolveBackend.runtimeMetaDataSources` requires this module lazily and reads
  // `.instance.getMetaData`, so installing the singleton on the real module's
  // exports means the code under test takes its real path, not a mocked one.
  const NoodlRuntime = require('../../../../packages/noodl-runtime/noodl-runtime');
  NoodlRuntime.instance = {
    getMetaData: (key: string) => metadata[key],
    getProjectSettings: () => ({})
  };
}

/**
 * Run as a **browser**, not as a cloud function.
 *
 * `ParseWireAdapter._makeRequest` has two branches and picks between them on
 * `_noodl_cloud_runtime_version`. Setting that flag is the one-line way to get the
 * `fetch` branch in Node — and it is the wrong choice here, for a reason worth
 * recording: the same flag switches `_getCurrentUser` (dbmodelcrudbase.ts:540) onto
 * its cloud branch, which does `modelScope.get('Request')`. Every Create/Set/Delete
 * node mixes in `_addAccessControl`, so with the flag set **every write in this
 * driver died** in ACL resolution before a request was built.
 *
 * ⚠️ And `modelScope` is typed `ModelScopeLike | undefined` there and dereferenced
 * without a guard. A real cloud function always has one, so it never bites — but the
 * signature says the parameter is optional and the body says it is not.
 *
 * So the driver shims the two browser globals instead and takes the branch a real app
 * takes. The shim is deliberately the smallest thing `_makeRequest` actually reads;
 * anything it gets wrong shows up as a transport failure on the Parse-wire backends
 * only, since `RestDataAdapter` uses `fetch` directly on all three REST ones.
 */
function installBrowserGlobals() {
  const g = globalThis as Any;

  // `SessionStore` reads and writes this; without it "who is signed in" throws
  // rather than answering "nobody".
  if (!g.localStorage) {
    const store = new Map<string, string>();
    g.localStorage = {
      getItem: (k: string) => (store.has(k) ? store.get(k) : null),
      setItem: (k: string, v: string) => void store.set(k, String(v)),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear()
    };
  }

  if (!g.XMLHttpRequest) {
    g.XMLHttpRequest = class {
      onreadystatechange: (() => void) | null = null;
      readyState = 0;
      status = 0;
      response: Any = '';
      responseText = '';
      upload: Any = {};
      private _method = 'GET';
      private _url = '';
      private _headers: Record<string, string> = {};

      open(method: string, url: string) {
        this._method = method;
        this._url = url;
        this.readyState = 1;
      }
      setRequestHeader(name: string, value: string) {
        this._headers[name] = value;
      }
      send(body?: Any) {
        // ⚠️ The `catch` MUST NOT span the `onreadystatechange` dispatch.
        //
        // The first version of this shim wrapped both, and an exception thrown by
        // the adapter's own `success` callback therefore landed in the catch, which
        // then re-fired the handler as `status: 0` — so every successful create and
        // update in the run ALSO took the error path and raised
        // `record/storage-op-failed`. That looked exactly like a product defect and
        // was an instrument defect. A real `XMLHttpRequest` lets an exception thrown
        // by a listener escape; it does not convert it into a transport failure.
        const settle = (status: number, text: string) => {
          this.status = status;
          this.response = text;
          this.responseText = text;
          this.readyState = 4;
        };

        fetch(this._url, {
          method: this._method,
          headers: this._headers,
          body: body === undefined || body === null ? undefined : body
        }).then(
          async (res) => {
            const text = await res.text();
            settle(res.status, text);
            // Deliberately outside any catch — see above.
            if (this.onreadystatechange) this.onreadystatechange();
          },
          () => {
            // A transport failure is status 0 with readyState 4, which is what a
            // browser reports for a refused connection and what the adapter's error
            // path is written against. This handler covers ONLY the fetch.
            settle(0, '');
            if (this.onreadystatechange) this.onreadystatechange();
          }
        );
      }
    };
  }
}

function setMetadata(next: Record<string, Any>) {
  metadata = next;
  // Both caches key off metadata that just changed. Not resetting them is how the
  // second backend in one process silently answers with the first one's store.
  CloudStore.invalidateBackends();
  CloudStore.invalidateCollections();
}

// ---------------------------------------------------------------------------
// Driving real nodes
// ---------------------------------------------------------------------------

let context: Any;
let nextId = 0;

function makeContext() {
  const ctx: Any = new NodeContext();
  for (const mod of [DbCollectionModule, NewRecordModule, SetRecordModule, DeleteRecordModule]) {
    ctx.nodeRegister.register(NodeDefinition.defineNode((mod as Any).node));
  }
  // The filter branches of `getStorageFilter` call `sendWarning` unguarded, so a
  // filter that throws would take the driver down with a TypeError about
  // `editorConnection` instead of reporting the real problem. A recording stub
  // keeps the failure legible — and is what a running preview actually has.
  ctx.editorConnection = {
    isRunningLocally: () => true,
    // `NodeContext.connectionSentValue` calls this on every `flagOutputDirty`, so
    // omitting it turns any node error into a TypeError several frames away from
    // the real cause. `false` = no debug inspector, which is the honest answer.
    isConnected: () => false,
    sendDynamicPorts: () => {},
    sendWarning: (_c: string, _n: string, key: string, detail: Any) =>
      note(`editor warning [${key}]: ${detail && detail.message}`),
    clearWarning: () => {}
  };
  return ctx;
}

interface Driven {
  node: Any;
  signals: string[];
}

function createNode(type: string): Driven {
  const nodeScope: Any = {
    modelScope: undefined,
    context,
    nodeRegister: context.nodeRegister,
    componentOwner: { name: 'Driver' }
  };
  const node: Any = context.nodeRegister.createNode(type, 'n' + ++nextId, nodeScope);
  const signals: string[] = [];
  const original = node.sendSignalOnOutput.bind(node);
  node.sendSignalOnOutput = (name: string) => {
    signals.push(name);
    original(name);
  };
  return { node, signals };
}

/**
 * Set one input by the name the editor saves it under.
 *
 * `registerInputIfNeeded` is the node's own dispatch from a port name to a setter,
 * and going through it is what makes this the node layer rather than a poke at
 * `_internal`. It is also exactly what has to be right for the Backend picker to
 * work at all.
 */
function setInput(node: Any, name: string, value: unknown) {
  node.registerInputIfNeeded(name);
  node.setInputValue(name, value);
}

/** Pulse an edge-triggered signal: it needs the falling edge to re-fire. */
function pulse(node: Any, name: string) {
  node.registerInputIfNeeded(name);
  node.setInputValue(name, false);
  node.setInputValue(name, true);
}

/**
 * Read an output port, registering it first if it is a dynamic one.
 *
 * `storageTotalCount` is only declared by `updatePorts` when `storageEnableCount` is
 * set, and `updatePorts` runs in the editor. At runtime the node registers it on
 * demand through `registerOutputIfNeeded` — which is also the guard
 * (`hasOutput('storageTotalCount')`) the query's success callback checks before
 * flagging it dirty. So registering it here is what a real graph with that port
 * wired does, not a workaround.
 */
function output(node: Any, name: string): unknown {
  if (typeof node.registerOutputIfNeeded === 'function') node.registerOutputIfNeeded(name);
  if (!node.hasOutput(name)) return undefined;
  const port = node.getOutput(name);
  return port ? port.value : undefined;
}

function tick(node: Any) {
  (node.context as { updateIteration: number }).updateIteration++;
  node.update();
}

/** Wait for one of `wanted`, ticking like a frame loop. Returns the signal or a diagnosis. */
async function waitFor(driven: Driven, wanted: string[], timeoutMs = 20000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    tick(driven.node);
    const hit = driven.signals.find((s) => wanted.includes(s));
    if (hit) return hit;
    await new Promise((r) => setTimeout(r, 25));
  }
  return `<timeout ${timeoutMs}ms; signals: ${JSON.stringify(driven.signals)}>`;
}

// ---------------------------------------------------------------------------
// The PostgREST proxy
// ---------------------------------------------------------------------------

function startProxy(): Promise<http.Server> {
  const server = http.createServer((clientReq, clientRes) => {
    const path = (clientReq.url || '').replace(/^\/rest\/v1/, '') || '/';
    const upstream = http.request(
      {
        host: 'localhost',
        port: 8056,
        method: clientReq.method,
        path,
        headers: Object.assign({}, clientReq.headers, { host: 'localhost:8056' })
      },
      (up) => {
        clientRes.writeHead(up.statusCode || 500, up.headers);
        up.pipe(clientRes);
      }
    );
    upstream.on('error', (e) => {
      clientRes.writeHead(502);
      clientRes.end(String(e));
    });
    clientReq.pipe(upstream);
  });
  return new Promise((resolve) => server.listen(PROXY_PORT, () => resolve(server)));
}

// ---------------------------------------------------------------------------
// One backend's shape, and the fixture rows
// ---------------------------------------------------------------------------

interface Shape {
  label: string;
  /** The `backendServices` entry id the picker would save. */
  id: string;
  type: string;
  url: string;
  token?: string;
  collection: string;
  titleField: string;
  statusField: string;
  orderField: string;
  /** Does this wire hand back an integer primary key? Recorded, then asserted. */
  expectNumericId: boolean;
  /** Sorting asked for as the node would ask for it, or undefined where unsupported. */
  canSort: boolean;
}

const ROWS = [
  { title: 'Alpha', status: PUB, order: 1 },
  { title: 'Bravo', status: DRAFT, order: 2 },
  { title: 'Charlie', status: PUB, order: 3 },
  { title: 'Delta', status: DRAFT, order: 4 },
  { title: 'Echo', status: PUB, order: 5 }
];
/** `bcn004n-pub` rows in `order` — what the one filter must return, everywhere. */
const PUBLISHED = ['Alpha', 'Charlie', 'Echo'];

/** The cached schema the port generator and the filter builder read. */
function schemaFor(shape: Shape) {
  return {
    collections: [
      {
        name: shape.collection,
        displayName: shape.collection,
        primaryKey: 'id',
        fields: [
          { name: 'id', displayName: 'id', type: 'integer', primaryKey: true },
          { name: shape.titleField, displayName: 'Title', type: 'string' },
          { name: shape.statusField, displayName: 'Status', type: 'string' },
          { name: shape.orderField, displayName: 'Order', type: 'integer' }
        ]
      }
    ]
  };
}

function metadataFor(shape: Shape) {
  return {
    backendServices: {
      activeBackendId: shape.id,
      backends: [
        {
          id: shape.id,
          name: shape.label,
          type: shape.type,
          url: shape.url,
          auth: { publicToken: shape.token },
          schema: schemaFor(shape)
        }
      ]
    }
  };
}

// ---------------------------------------------------------------------------
// Fixtures, written over each backend's own admin surface
// ---------------------------------------------------------------------------

async function seedDirectus(): Promise<string | undefined> {
  const login = await req(`${DIRECTUS}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', password: 'directus-admin-pw' })
  });
  const token = login.json?.data?.access_token as string | undefined;
  if (!token) {
    say(`  !! Directus login failed: ${login.status} ${login.text.slice(0, 150)}`);
    return undefined;
  }
  const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  await req(`${DIRECTUS}/collections`, {
    method: 'POST',
    headers: H,
    body: JSON.stringify({
      collection: NS,
      schema: {},
      meta: { singleton: false },
      fields: [
        { field: 'id', type: 'integer', schema: { is_primary_key: true, has_auto_increment: true } },
        { field: 'title', type: 'string' },
        { field: 'status', type: 'string' },
        { field: 'rank', type: 'integer' }
      ]
    })
  });

  const existing = await req(`${DIRECTUS}/items/${NS}?limit=-1&fields=id`, { headers: H });
  const ids = ((existing.json?.data ?? []) as Array<{ id: number }>).map((r) => r.id);
  if (ids.length) await req(`${DIRECTUS}/items/${NS}`, { method: 'DELETE', headers: H, body: JSON.stringify(ids) });
  await req(`${DIRECTUS}/items/${NS}`, {
    method: 'POST',
    headers: H,
    body: JSON.stringify(ROWS.map((r) => ({ title: r.title, status: r.status, rank: r.order })))
  });
  return token;
}

/**
 * PostgREST: reuse the seeded `articles` table, touching only our own rows.
 *
 * Creating a table needs DDL and the wire has no route for it, and truncating a
 * table another worker may be using for relation fixtures is not an option. So the
 * namespace is a column value, and cleanup is scoped to it.
 *
 * ⚠️ The namespaced column here is **`body`, not `status`** — `articles.status` is a
 * Postgres `enum` (`article_status`), so writing `bcn004n-pub` into it answers
 * `22P02 invalid input value for enum`. That is a fact about the rig's seed rather
 * than about the wire, but it is the kind of thing that reads as an adapter bug. The
 * filter's *shape* is unchanged — equality on a free-text field — which is what the
 * cross-backend claim rests on; only the field name differs, and every backend
 * already carries its own `statusField`.
 */
async function seedPostgrest(): Promise<boolean> {
  const H = { 'Content-Type': 'application/json' };
  const wipe = await req(`${POSTGREST}/articles?body=like.${NS}-*`, { method: 'DELETE', headers: H });
  if (wipe.status === 401 || wipe.status === 403 || (wipe.json && wipe.json.code === '42501')) {
    say(`  !! PostgREST refuses writes (${wipe.status} ${JSON.stringify(wipe.json)}).`);
    say('     Run the GRANT in this file\'s docblock — without it every write check is meaningless.');
    return false;
  }
  const insert = await req(`${POSTGREST}/articles`, {
    method: 'POST',
    headers: H,
    body: JSON.stringify(ROWS.map((r) => ({ title: r.title, body: r.status, rating: r.order })))
  });
  if (insert.status >= 300) {
    say(`  !! PostgREST seed failed: ${insert.status} ${insert.text.slice(0, 200)}`);
    return false;
  }
  return true;
}

async function seedPocketBase(): Promise<string | undefined> {
  const login = await req(`${POCKETBASE}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: 'admin@example.com', password: 'pocketbase-admin-pw' })
  });
  const token = login.json?.token as string | undefined;
  if (!token) {
    say(`  !! PocketBase login failed: ${login.status} ${login.text.slice(0, 200)}`);
    return undefined;
  }
  const H = { Authorization: token, 'Content-Type': 'application/json' };

  await req(`${POCKETBASE}/api/collections`, {
    method: 'POST',
    headers: H,
    body: JSON.stringify({
      name: NS,
      type: 'base',
      // Empty string is PocketBase for "anyone", which is what an app with a public
      // token is. `null` would be superuser-only — and BCN-008 measured that a
      // superuser-only collection accepts an anonymous subscribe and then delivers
      // nothing, so leaving these unset is a way to test nothing at all.
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        { name: 'title', type: 'text' },
        { name: 'status', type: 'text' },
        { name: 'rank', type: 'number' }
      ]
    })
  });

  const existing = await req(`${POCKETBASE}/api/collections/${NS}/records?perPage=500`, { headers: H });
  for (const row of (existing.json?.items ?? []) as Array<{ id: string }>) {
    await req(`${POCKETBASE}/api/collections/${NS}/records/${row.id}`, { method: 'DELETE', headers: H });
  }
  for (const r of ROWS) {
    await req(`${POCKETBASE}/api/collections/${NS}/records`, {
      method: 'POST',
      headers: H,
      body: JSON.stringify({ title: r.title, status: r.status, rank: r.order })
    });
  }
  return token;
}

/** Both Parse-wire backends: schemaless classes, so just clear and POST. */
async function seedParseWire(base: string, appId: string, masterKey?: string): Promise<boolean> {
  const H: Record<string, string> = { 'X-Parse-Application-Id': appId, 'Content-Type': 'application/json' };
  if (masterKey) H['X-Parse-Master-Key'] = masterKey;

  const existing = await req(`${base}/classes/${NS}?limit=1000`, { headers: H });
  const rows = (existing.json?.results ?? []) as Array<{ objectId: string }>;
  for (const row of rows) {
    await req(`${base}/classes/${NS}/${row.objectId}`, { method: 'DELETE', headers: H });
  }
  for (const r of ROWS) {
    const res = await req(`${base}/classes/${NS}`, {
      method: 'POST',
      headers: H,
      body: JSON.stringify({ title: r.title, status: r.status, rank: r.order })
    });
    if (res.status >= 300) {
      say(`  !! ${base} seed failed: ${res.status} ${res.text.slice(0, 200)}`);
      return false;
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// The checks, once per backend
// ---------------------------------------------------------------------------

/** Titles out of the `items` Collection, in the order the backend returned them. */
function titles(collection: Any, titleField: string): unknown[] {
  if (!collection || !collection.items) return [];
  return collection.items.map((m: Any) => m.get(titleField));
}

function ids(collection: Any): unknown[] {
  if (!collection || !collection.items) return [];
  return collection.items.map((m: Any) => m.getId());
}

/**
 * Build a Query Records node pointed at one backend, with the one filter.
 *
 * The filter goes in as a **Javascript** filter rather than a visual one for a
 * reason worth recording: the JSON path's `_filterCb` treats the script's own
 * vocabulary as the neutral filter, so `where({status: {equalTo: …}})` is sent
 * untranslated to a REST backend and lowered onto Parse for the other two — which
 * is precisely the "same filter, five dialects" claim, expressed once.
 */
function queryNode(shape: Shape, opts: { limit?: number; skip?: number; count?: boolean } = {}): Driven {
  const driven = createNode('DbCollection2');
  const { node } = driven;

  setInput(node, 'backendId', shape.id);
  setInput(node, 'collectionName', shape.collection);
  setInput(node, 'storageFilterType', 'json');
  setInput(node, 'storageJSONFilter', `where({${shape.statusField}: {equalTo: '${PUB}'}})`);

  if (opts.limit !== undefined || opts.skip !== undefined) {
    // ⚠️ Without this boolean `getStorageLimit`/`getStorageSkip` both return
    // `undefined` and the query is unpaginated — indistinguishable from page one.
    setInput(node, 'storageEnableLimit', true);
    if (opts.limit !== undefined) setInput(node, 'storageLimit', opts.limit);
    if (opts.skip !== undefined) setInput(node, 'storageSkip', opts.skip);
  }
  if (opts.count) setInput(node, 'storageEnableCount', true);

  return driven;
}

async function runQuery(driven: Driven): Promise<string> {
  pulse(driven.node, 'storageFetch');
  return waitFor(driven, ['fetched', 'failure']);
}

async function runBackend(shape: Shape) {
  head(`${shape.label}  (type: ${shape.type}, id: ${shape.id})`);
  setMetadata(metadataFor(shape));

  // ── 1. Query with a filter ────────────────────────────────────────────────
  const q = queryNode(shape);
  const signal = await runQuery(q);
  if (signal !== 'fetched') {
    checkThat(`${shape.label}: filtered query succeeds`, false, `${signal} / error=${output(q.node, 'error')}`);
    say('  -- skipping the rest of this backend: nothing else is meaningful without a read --');
    return;
  }
  pass++;
  say(`  PASS  ${shape.label}: filtered query succeeds`);

  const collection = output(q.node, 'items');
  const got = titles(collection, shape.titleField) as string[];
  // Sorted before comparing: ordering is a separate claim, checked in pagination
  // where it is load-bearing. Here the claim is *which rows*.
  check(`${shape.label}: the one filter returns the ${PUBLISHED.length} published rows`, got.slice().sort(), PUBLISHED.slice().sort());
  check(`${shape.label}: count output matches the filtered set`, output(q.node, 'count'), PUBLISHED.length);
  checkThat(`${shape.label}: isEmpty is false on a non-empty result`, output(q.node, 'isEmpty') === false);

  // ── 2. objectId's type, as it reaches a graph ─────────────────────────────
  const firstId = output(q.node, 'firstItemId');
  const idType = typeof firstId;
  note(`${shape.label}: firstItemId = ${JSON.stringify(firstId)} (typeof ${idType})`);
  check(`${shape.label}: firstItemId type is as the notes predict`, idType, shape.expectNumericId ? 'number' : 'string');
  checkThat(
    `${shape.label}: every item's getId() agrees with firstItemId's type`,
    ids(collection).every((v) => typeof v === idType),
    JSON.stringify(ids(collection))
  );

  // ── 3. The total on a filtered query — RUN-003's defect ──────────────────
  const qc = queryNode(shape, { count: true, limit: 2, skip: 0 });
  const cSignal = await runQuery(qc);
  if (cSignal === 'fetched') {
    check(
      `${shape.label}: total count is the FILTERED total, not the collection total`,
      output(qc.node, 'storageTotalCount'),
      PUBLISHED.length
    );
    check(`${shape.label}: limit caps the returned rows`, (titles(output(qc.node, 'items'), shape.titleField) as string[]).length, 2);
  } else {
    checkThat(`${shape.label}: counted query succeeds`, false, `${cSignal} / ${output(qc.node, 'error')}`);
  }

  // ── 4. Pagination against the filtered set: limit=1, skip=2 ──────────────
  const qp = queryNode(shape, { limit: 1, skip: 2 });
  const pSignal = await runQuery(qp);
  if (pSignal === 'fetched') {
    const page = titles(output(qp.node, 'items'), shape.titleField) as string[];
    check(`${shape.label}: limit=1 skip=2 returns exactly one row`, page.length, 1);
    // The third row *of the filtered set*. A raw-offset wire and a page-based wire
    // disagree here and agree on limit=2/skip=2 — see the module docblock.
    checkThat(
      `${shape.label}: limit=1 skip=2 is the THIRD published row, not the third row of the collection`,
      page.length === 1 && PUBLISHED.indexOf(page[0]) === 2,
      `got ${JSON.stringify(page)}; published order is ${JSON.stringify(PUBLISHED)}`
    );
  } else {
    checkThat(`${shape.label}: paginated query succeeds`, false, `${pSignal} / ${output(qp.node, 'error')}`);
  }

  // ── 5. Create, through Create New Record ─────────────────────────────────
  const created = createNode('NewDbModelProperties');
  setInput(created.node, 'backendId', shape.id);
  setInput(created.node, 'collectionName', shape.collection);
  setInput(created.node, `prop-${shape.titleField}`, 'Foxtrot');
  setInput(created.node, `prop-${shape.statusField}`, PUB);
  setInput(created.node, `prop-${shape.orderField}`, 6);
  pulse(created.node, 'store');
  const createSignal = await waitFor(created, ['created', 'failure']);
  checkThat(
    `${shape.label}: Create New Record fires Created`,
    createSignal === 'created',
    `${createSignal} / error=${output(created.node, 'error')}`
  );

  const newId = output(created.node, 'id');
  if (createSignal !== 'created') {
    say('  -- skipping update/delete: nothing was created --');
    return;
  }
  note(`${shape.label}: created id = ${JSON.stringify(newId)} (typeof ${typeof newId})`);
  checkThat(`${shape.label}: Create reports a non-empty Id`, newId !== undefined && newId !== null && newId !== '');

  // The created row must join the filtered set — a create that writes to a
  // different collection or backend would pass every check above.
  const qAfter = queryNode(shape);
  if ((await runQuery(qAfter)) === 'fetched') {
    const after = titles(output(qAfter.node, 'items'), shape.titleField) as string[];
    checkThat(
      `${shape.label}: the created row is readable through a fresh query on the same backend`,
      after.includes('Foxtrot'),
      JSON.stringify(after)
    );
    check(`${shape.label}: the filtered set grew by exactly one`, after.length, PUBLISHED.length + 1);
  }

  // ── 6. Update, through Set Record Properties ─────────────────────────────
  const updated = createNode('SetDbModelProperties');
  setInput(updated.node, 'backendId', shape.id);
  setInput(updated.node, 'collectionName', shape.collection);
  setInput(updated.node, 'storageType', shape.collection);
  // ⚠️ The id goes in as whatever type the backend handed out. Feeding a number
  // back into a `Record Id` input is the risk BCN-004's notes flag; this is where
  // it is exercised rather than argued about.
  setInput(updated.node, 'modelId', newId);
  setInput(updated.node, `prop-${shape.titleField}`, 'Foxtrot-edited');
  pulse(updated.node, 'store');
  const updateSignal = await waitFor(updated, ['stored', 'failure']);
  checkThat(
    `${shape.label}: Set Record Properties fires Stored for an id of type ${typeof newId}`,
    updateSignal === 'stored',
    `${updateSignal} / error=${output(updated.node, 'error')}`
  );

  if (updateSignal === 'stored') {
    const qEdit = queryNode(shape);
    if ((await runQuery(qEdit)) === 'fetched') {
      const after = titles(output(qEdit.node, 'items'), shape.titleField) as string[];
      checkThat(
        `${shape.label}: the update is visible on a re-read`,
        after.includes('Foxtrot-edited') && !after.includes('Foxtrot'),
        JSON.stringify(after)
      );
    }
  }

  // ── 7. Delete, through Delete Record ─────────────────────────────────────
  const deleted = createNode('DeleteDbModelProperties');
  setInput(deleted.node, 'backendId', shape.id);
  setInput(deleted.node, 'collectionName', shape.collection);
  setInput(deleted.node, 'storageType', shape.collection);
  setInput(deleted.node, 'modelId', newId);
  pulse(deleted.node, 'store');
  const deleteSignal = await waitFor(deleted, ['deleted', 'failure']);
  checkThat(
    `${shape.label}: Delete Record fires Deleted`,
    deleteSignal === 'deleted',
    `${deleteSignal} / error=${output(deleted.node, 'error')}`
  );

  if (deleteSignal === 'deleted') {
    const qGone = queryNode(shape);
    if ((await runQuery(qGone)) === 'fetched') {
      const after = titles(output(qGone.node, 'items'), shape.titleField) as string[];
      check(`${shape.label}: the filtered set is back to its original size`, after.length, PUBLISHED.length);
      checkThat(`${shape.label}: the deleted row is gone`, !after.some((t) => String(t).startsWith('Foxtrot')), JSON.stringify(after));
    }
  }
}

/**
 * The check that actually proves the Backend picker routes.
 *
 * ⚠️ Every per-backend run above configures exactly one backend and makes it
 * `activeBackendId`, so a `backendId` input that was ignored entirely would still
 * return the right rows from the right server — the node would fall back to the
 * active backend, which is the same one. Mutation-testing showed this: disabling
 * `registerInputIfNeeded`'s `backendId` branch left all 95 per-backend checks green
 * and failed only the unknown-id case.
 *
 * So this configures **two** backends at once, makes the *first* active, and points
 * a node at the *second*. The rows can then only have come from the named backend.
 * Two backends with disjoint data is the only arrangement in which "the picker was
 * ignored" and "the picker worked" produce different answers.
 */
async function runRoutingCheck(a: Shape, b: Shape) {
  head(`ROUTING — two backends configured, node pointed at the non-active one`);
  say(`  active: ${a.label}   |   node names: ${b.label}`);

  setMetadata({
    backendServices: {
      // `a` is active. `b` is only reachable by naming it.
      activeBackendId: a.id,
      backends: [
        { id: a.id, name: a.label, type: a.type, url: a.url, auth: { publicToken: a.token }, schema: schemaFor(a) },
        { id: b.id, name: b.label, type: b.type, url: b.url, auth: { publicToken: b.token }, schema: schemaFor(b) }
      ]
    }
  });

  // Both backends hold rows with the same titles, so the discriminator is the id
  // *type*, which differs between the two chosen backends by construction.
  const named = queryNode(b);
  const signal = await runQuery(named);
  checkThat(`routing: a query naming ${b.label} succeeds`, signal === 'fetched', `${signal} / ${output(named.node, 'error')}`);
  if (signal !== 'fetched') return;

  const rowIds = ids(output(named.node, 'items'));
  checkThat(
    `routing: the rows came from ${b.label} (${b.expectNumericId ? 'numeric' : 'string'} ids), not from the active ${a.label}`,
    rowIds.length > 0 && rowIds.every((v) => typeof v === (b.expectNumericId ? 'number' : 'string')),
    `ids ${JSON.stringify(rowIds)}`
  );

  // And `_active_` still means the active one — the no-regression half. Getting
  // this wrong in the other direction moves every existing project's nodes.
  const active = queryNode(a);
  setInput(active.node, 'backendId', '_active_');
  if ((await runQuery(active)) === 'fetched') {
    const activeIds = ids(output(active.node, 'items'));
    checkThat(
      `routing: '_active_' still resolves to ${a.label}`,
      activeIds.length > 0 && activeIds.every((v) => typeof v === (a.expectNumericId ? 'number' : 'string')),
      `ids ${JSON.stringify(activeIds)}`
    );
  }
}

/**
 * A node pointed at a backend the project does not have must fail with a sentence.
 *
 * The alternative — falling back to the active backend — is the defect that would
 * write a user's records somewhere they did not ask for, and it is the single most
 * dangerous behaviour available to `CloudStore.forBackend`.
 */
async function runUnknownBackendCheck(shape: Shape) {
  head('A Backend id the project does not have');
  setMetadata(metadataFor(shape));

  const q = createNode('DbCollection2');
  setInput(q.node, 'backendId', 'no-such-backend');
  setInput(q.node, 'collectionName', shape.collection);
  const signal = await waitFor(q, ['fetched', 'failure'], 8000);

  checkThat('an unknown Backend id fails rather than querying the active backend', signal === 'failure', signal);
  const err = String(output(q.node, 'error') ?? '');
  checkThat('and it says which backend it could not find', err.includes('no-such-backend'), err);
  check('and it returns no rows at all', (titles(output(q.node, 'items'), shape.titleField) as string[]).length, 0);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  installRuntime();
  installBrowserGlobals();
  context = makeContext();

  const proxy = await startProxy();
  say(`PostgREST proxy listening on ${POSTGREST_VIA_PROXY} → localhost:8056 (strips /rest/v1)`);

  const shapes: Shape[] = [];

  head('SEEDING');

  const dToken = await seedDirectus();
  if (dToken) {
    shapes.push({
      label: 'Directus 11',
      id: 'd1',
      type: 'directus',
      url: DIRECTUS,
      token: dToken,
      collection: NS,
      titleField: 'title',
      statusField: 'status',
      orderField: 'rank',
      // Directus's auto-increment PK is an integer and the adapter no longer
      // stringifies it — the deliberate change BCN-004 made so that
      // `author.objectId === article.author_id` holds.
      expectNumericId: true,
      canSort: true
    });
    say('  seeded Directus');
  }

  if (await seedPostgrest()) {
    shapes.push({
      label: 'Supabase (PostgREST 12.2.3)',
      id: 's1',
      type: 'supabase',
      url: POSTGREST_VIA_PROXY,
      collection: 'articles',
      titleField: 'title',
      // `body`, not `status` — see `seedPostgrest`: the rig's `status` is a Postgres enum.
      statusField: 'body',
      orderField: 'rating',
      expectNumericId: true,
      canSort: true
    });
    say('  seeded PostgREST (articles, status-namespaced)');
  }

  const pbToken = await seedPocketBase();
  if (pbToken) {
    shapes.push({
      label: 'PocketBase 0.30.0',
      id: 'p1',
      type: 'pocketbase',
      url: POCKETBASE,
      token: pbToken,
      collection: NS,
      titleField: 'title',
      statusField: 'status',
      orderField: 'rank',
      // PocketBase ids are 15-char strings.
      expectNumericId: false,
      canSort: true
    });
    say('  seeded PocketBase');
  }

  if (await seedParseWire(NODEGX, 'nodegx-backend')) {
    shapes.push({
      label: 'nodegx-backend (our own Parse wire)',
      id: 'g1',
      type: 'nodegx',
      // ⚠️ nodegx-backend mounts the Parse wire at the ROOT (`/classes/…`), not
      // under `/api` — `/api` is the admin/BYOB surface. Measured, not assumed.
      url: NODEGX,
      token: 'nodegx-backend',
      collection: NS,
      titleField: 'title',
      statusField: 'status',
      orderField: 'rank',
      expectNumericId: false,
      canSort: true
    });
    say('  seeded nodegx-backend');
  }

  if (await seedParseWire(PARSE, 'uba-e2e-app')) {
    shapes.push({
      label: 'Parse Server 7.3.0 (upstream)',
      id: 'ps1',
      type: 'parse',
      url: PARSE,
      token: 'uba-e2e-app',
      collection: NS,
      titleField: 'title',
      statusField: 'status',
      orderField: 'rank',
      expectNumericId: false,
      canSort: true
    });
    say('  seeded upstream Parse Server');
  }

  for (const shape of shapes) {
    await runBackend(shape);
  }

  // Directus (numeric ids) against PocketBase (string ids) — the pair whose answers
  // cannot be confused for one another.
  const numeric = shapes.find((s) => s.expectNumericId);
  const stringy = shapes.find((s) => !s.expectNumericId);
  if (numeric && stringy) await runRoutingCheck(numeric, stringy);
  else say('\n(routing check skipped: needs one numeric-id and one string-id backend)');

  if (shapes.length) await runUnknownBackendCheck(shapes[0]);

  head('SUMMARY');
  say(`backends exercised: ${shapes.length} — ${shapes.map((s) => s.label).join(', ')}`);
  say(`checks: ${pass} passed, ${fail} failed`);
  if (failures.length) {
    say();
    say('failures:');
    for (const f of failures) say(`  - ${f}`);
  }
  if (notes.length) {
    say();
    say('observations:');
    for (const n of notes) say(`  - ${n}`);
  }

  proxy.close();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  say(`FATAL: ${e && e.stack ? e.stack : e}`);
  process.exit(2);
});
