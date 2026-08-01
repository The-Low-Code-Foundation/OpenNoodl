/**
 * BCN-008 — Subscribe To Changes, driven **through the Query Records node**.
 *
 * `bcn-008-realtime-driver.ts` proves the transports parse the right frames and recover
 * from a restart. That is not the success criterion. The criterion is "confirm the signal
 * pair fires", and a signal is a node-level object: it exists only if
 * `sendSignalOnOutput('created')` reached a real `DbCollection2` in a real `NodeContext`,
 * with its ports registered the way `registerInputIfNeeded` registers them.
 *
 * So this is BCN-004 step 6's harness, pointed at the realtime capability. Everything
 * between the `Subscribe To Changes` checkbox and the wire is live: the input dispatch,
 * `resolveBackendFromRuntime`, the transport pick, the change normalisation, the
 * `recordsComplete` gate on `Changed Record`, and the debounced re-query that keeps
 * `Items` current.
 *
 * ## What it asks that the transport driver cannot
 *
 * 1. **Do the four signals fire, and only the right ones?** `init` is a confirmation
 *    snapshot, not a create — a node that fired `Record Created` for every row already in
 *    the collection would make connecting look like a burst of writes.
 * 2. **Does `Items` actually move?** The change triggers a re-query. A subscription that
 *    fires signals over a stale collection is worse than no subscription.
 * 3. **Is `Changed Record` gated on `recordsComplete`?** Directus sends keys only on a
 *    delete. The port must be `null` there and the *id* must still be right — the one
 *    place the two backends legitimately differ, expressed as ports rather than prose.
 * 4. **Does a backend with no realtime say so on a port?** Not silence: a reason on
 *    `Realtime Error`, and a `Realtime Failure` signal.
 *
 * ## Run
 *
 *   docker compose --profile supabase --profile aggregate --profile parse up -d
 *   (a local nodegx-backend on 8593 — see bcn-008-realtime-driver.ts)
 *   node bcn-008-node-driver.build.mjs && node bcn-008-node-driver.cjs
 *
 * ⚠️ Do not pipe it into `head`.
 */

import NodeContext = require('../../../../packages/noodl-runtime/src/nodecontext');
import NodeDefinition = require('../../../../packages/noodl-runtime/src/nodedefinition');
import CloudStore = require('../../../../packages/noodl-runtime/src/api/cloudstore');
import DbCollectionModule = require('../../../../packages/noodl-runtime/src/nodes/std-library/data/dbcollectionnode2');

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-var-requires */
type Any = any;

const DIRECTUS = 'http://localhost:8055';
const NODEGX = 'http://localhost:8593';
const DIRECTUS_ADMIN = { email: 'admin@example.com', password: 'directus-admin-pw' };

const DIRECTUS_COLL = 'bcn008_live';
const NODEGX_COLL = 'Bcn008Live';

let pass = 0;
const failures: string[] = [];

function say(s = '') {
  console.log(s);
}
function head(s: string) {
  say();
  say('='.repeat(78));
  say(s);
  say('='.repeat(78));
}
function sub(s: string) {
  say();
  say('── ' + s + ' ' + '─'.repeat(Math.max(0, 72 - s.length)));
}
function check(ok: boolean, label: string, evidence: unknown = '') {
  const detail = typeof evidence === 'string' ? evidence : JSON.stringify(evidence);
  if (ok) {
    pass++;
    say(`  ✅ ${label}${detail ? '  — ' + detail : ''}`);
  } else {
    failures.push(label);
    say(`  ❌ ${label}${detail ? '  — ' + detail : ''}`);
  }
}
function note(s: string) {
  say('  · ' + s);
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

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

// ── the EventSource Node does not have ─────────────────────────────────────
//
// ⚠️ Node 22 has `WebSocket` and no `EventSource` (measured). The Directus half of this
// driver therefore runs on the *real* undici WebSocket — the one whose `close` never
// fires — and the NodeGX half runs on the shim below. Recorded, not glossed: a browser's
// EventSource is still unexercised by anything in BCN-008.

class NodeEventSource {
  private _listeners = new Map<string, ((e: { data: string }) => void)[]>();
  private _ctrl: AbortController | null = null;
  private _closed = false;
  private _lastId: string | null = null;
  private _retryMs = 3000;
  onerror: ((...a: unknown[]) => void) | null = null;

  constructor(readonly url: string) {
    this._open();
  }
  addEventListener(type: string, listener: (e: { data: string }) => void) {
    const list = this._listeners.get(type) || [];
    list.push(listener);
    this._listeners.set(type, list);
  }
  close() {
    this._closed = true;
    try {
      this._ctrl?.abort();
    } catch {
      /* already aborted */
    }
  }
  private _fail() {
    if (this._closed) return;
    this.onerror?.({ type: 'error' });
    setTimeout(() => this._open(), this._retryMs);
  }
  private async _open() {
    if (this._closed) return;
    this._ctrl = new AbortController();
    let res: Response;
    try {
      const headers: Record<string, string> = { Accept: 'text/event-stream' };
      if (this._lastId !== null) headers['Last-Event-ID'] = this._lastId;
      res = await fetch(this.url, { headers, signal: this._ctrl.signal });
    } catch {
      this._fail();
      return;
    }
    if (!res.ok || !res.body) {
      this._fail();
      return;
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i: number;
        while ((i = buf.search(/\r?\n\r?\n/)) >= 0) {
          const block = buf.slice(0, i);
          buf = buf.slice(i + (buf.slice(i).match(/^\r?\n\r?\n/) as RegExpMatchArray)[0].length);
          this._dispatch(block);
        }
      }
    } catch {
      /* torn down */
    }
    this._fail();
  }
  private _dispatch(block: string) {
    if (block.startsWith(':')) return;
    let name = 'message';
    const data: string[] = [];
    for (const line of block.split(/\r?\n/)) {
      const c = line.indexOf(':');
      const field = c < 0 ? line : line.slice(0, c);
      const value = c < 0 ? '' : line.slice(c + 1).replace(/^ /, '');
      if (field === 'event') name = value;
      else if (field === 'data') data.push(value);
      else if (field === 'id') this._lastId = value;
      else if (field === 'retry') this._retryMs = Number(value) || this._retryMs;
    }
    const event = { data: data.join('\n') };
    for (const l of this._listeners.get(name) || []) l(event);
  }
}

// ── the runtime the node reads its metadata off ────────────────────────────

let metadata: Record<string, Any> = {};

function installRuntime() {
  const NoodlRuntime = require('../../../../packages/noodl-runtime/noodl-runtime');
  NoodlRuntime.instance = {
    getMetaData: (key: string) => metadata[key],
    getProjectSettings: () => ({})
  };
  (globalThis as Any).EventSource = NodeEventSource;
  if (!(globalThis as Any).localStorage) {
    const store = new Map<string, string>();
    (globalThis as Any).localStorage = {
      getItem: (k: string) => (store.has(k) ? store.get(k) : null),
      setItem: (k: string, v: string) => void store.set(k, String(v)),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear()
    };
  }

  // `ParseWireAdapter._makeRequest` takes the XHR branch for a browser, and our own
  // backend is a Parse-wire backend — so the re-query a realtime change triggers needs
  // one. Lifted from `bcn-004-node-driver.ts`, including the reason its `catch` is shaped
  // the way it is:
  //
  // ⚠️ The `catch` MUST NOT span the `onreadystatechange` dispatch. BCN-004's first
  // version wrapped both, so an exception thrown by the adapter's own success callback
  // landed in the catch, which re-fired the handler as `status: 0` — every successful
  // write also took the error path. That looked exactly like a product defect and was an
  // instrument defect.
  if (!(globalThis as Any).XMLHttpRequest) {
    (globalThis as Any).XMLHttpRequest = class {
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
            if (this.onreadystatechange) this.onreadystatechange();
          },
          () => {
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
  CloudStore.invalidateBackends();
  CloudStore.invalidateCollections();
}

// ── driving a real node ────────────────────────────────────────────────────

let context: Any;
let nextId = 0;

function makeContext() {
  const ctx: Any = new NodeContext();
  ctx.nodeRegister.register(NodeDefinition.defineNode((DbCollectionModule as Any).node));
  ctx.editorConnection = {
    isRunningLocally: () => true,
    isConnected: () => false,
    sendDynamicPorts: () => {},
    sendWarning: (_c: string, _n: string, key: string, detail: Any) => note(`editor warning [${key}]: ${detail?.message}`),
    clearWarning: () => {}
  };
  return ctx;
}

interface Driven {
  node: Any;
  signals: string[];
}

function createQueryNode(): Driven {
  const nodeScope: Any = {
    modelScope: undefined,
    context,
    nodeRegister: context.nodeRegister,
    componentOwner: { name: 'Driver' }
  };
  const node: Any = context.nodeRegister.createNode('DbCollection2', 'n' + ++nextId, nodeScope);
  const signals: string[] = [];
  const original = node.sendSignalOnOutput.bind(node);
  node.sendSignalOnOutput = (name: string) => {
    signals.push(name);
    original(name);
  };
  return { node, signals };
}

function setInput(node: Any, name: string, value: unknown) {
  node.registerInputIfNeeded(name);
  node.setInputValue(name, value);
}
function pulse(node: Any, name: string) {
  node.registerInputIfNeeded(name);
  node.setInputValue(name, false);
  node.setInputValue(name, true);
}
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

/** Tick like a frame loop until `pred` holds. The node's scheduler needs the ticks. */
async function until(driven: Driven, pred: () => boolean, timeoutMs = 25000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    tick(driven.node);
    if (pred()) return true;
    if (Date.now() > deadline) return false;
    await sleep(25);
  }
}

/** Signals seen since a mark, so "which fired *this* time" is answerable. */
function since(driven: Driven, mark: number): string[] {
  return driven.signals.slice(mark);
}

function itemTitles(node: Any): unknown[] {
  const collection: Any = output(node, 'items');
  if (!collection || !collection.items) return [];
  return collection.items.map((m: Any) => m.get('title'));
}

// ═══════════════════════════════════════════════════════════════════════════

async function directus() {
  head('DIRECTUS — the capability, through Query Records');

  const login = await req(`${DIRECTUS}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(DIRECTUS_ADMIN)
  });
  const token = login.json?.data?.access_token;
  if (!token) {
    check(false, 'directus admin login');
    return;
  }
  const auth = { Authorization: `Bearer ${token}`, 'content-type': 'application/json' };

  setMetadata({
    backendServices: {
      activeBackendId: 'd1',
      backends: [
        {
          id: 'd1',
          name: 'Directus',
          type: 'directus',
          url: DIRECTUS,
          auth: { publicToken: token },
          schema: {
            collections: [
              {
                name: DIRECTUS_COLL,
                primaryKey: 'id',
                fields: [
                  { name: 'id', type: 'number', primaryKey: true },
                  { name: 'title', type: 'string' }
                ]
              }
            ]
          }
        }
      ]
    }
  });

  const q = createQueryNode();
  setInput(q.node, 'backendId', 'd1');
  setInput(q.node, 'collectionName', DIRECTUS_COLL);
  setInput(q.node, 'realtime', true);

  sub('the subscription reaches the node');
  const up = await until(q, () => output(q.node, 'subscribed') === true);
  check(up, 'Subscribed output goes true', { status: output(q.node, 'realtimeStatus'), error: output(q.node, 'realtimeError') });
  if (!up) return;

  // ⚠️ `init` is a confirmation snapshot. If it were reported as a create, connecting to a
  // populated collection would fire one `Record Created` per existing row.
  check(
    !q.signals.includes('created') && !q.signals.includes('changed'),
    'and connecting fires NO create/changed signals — init is not a write',
    q.signals
  );
  check(output(q.node, 'changedEvent') === 'init', 'Change Type carries "init"', output(q.node, 'changedEvent'));

  sub('a create, made from outside the app');
  let mark = q.signals.length;
  const created = await req(`${DIRECTUS}/items/${DIRECTUS_COLL}`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ title: 'node-driver create' })
  });
  const id = created.json?.data?.id;
  const gotCreate = await until(q, () => since(q, mark).includes('created'));
  check(gotCreate, '⭐ Record Created fires', since(q, mark));
  check(since(q, mark).includes('changed'), '⭐ …and Records Changed with it — the signal pair', since(q, mark));
  check(output(q.node, 'changedRecordId') === String(id), 'Changed Record Id is the string form of a numeric pk', {
    port: output(q.node, 'changedRecordId'),
    rest: id
  });
  check(
    (output(q.node, 'changedRecord') as Any)?.title === 'node-driver create',
    'Changed Record carries the row',
    output(q.node, 'changedRecord')
  );
  // The re-query is debounced; give it a moment and keep ticking.
  const inItems = await until(q, () => itemTitles(q.node).includes('node-driver create'));
  check(inItems, '⭐ Items re-queried and now contains the new row', itemTitles(q.node));

  sub('an update');
  mark = q.signals.length;
  await req(`${DIRECTUS}/items/${DIRECTUS_COLL}/${id}`, {
    method: 'PATCH',
    headers: auth,
    body: JSON.stringify({ title: 'node-driver edited' })
  });
  check(await until(q, () => since(q, mark).includes('updated')), 'Record Updated fires', since(q, mark));
  check(output(q.node, 'changedEvent') === 'update', 'Change Type is "update"');

  sub('⚠️ a delete — Directus sends keys only');
  mark = q.signals.length;
  await req(`${DIRECTUS}/items/${DIRECTUS_COLL}/${id}`, { method: 'DELETE', headers: auth });
  check(await until(q, () => since(q, mark).includes('deleted')), 'Record Deleted fires', since(q, mark));
  check(output(q.node, 'changedRecordId') === String(id), 'Changed Record Id is still right', output(q.node, 'changedRecordId'));
  // The whole reason `recordsComplete` is in the contract: without it this port would
  // publish `{}` here and a full row on PocketBase, with nothing saying why.
  check(
    output(q.node, 'changedRecord') === null,
    '⭐ Changed Record is NULL rather than an empty object — gated on recordsComplete',
    output(q.node, 'changedRecord')
  );
  check(
    (output(q.node, 'changedRecords') as unknown[])?.length === 0,
    'and Changed Records is empty rather than a list of bare keys'
  );

  sub('⚠️ the node survives a container restart');
  await new Promise<void>((resolve, reject) => {
    const { spawn } = require('node:child_process');
    const p = spawn('docker', ['restart', 'uba-e2e-directus-1'], { stdio: 'inherit' });
    p.on('exit', (code: number) => (code === 0 ? resolve() : reject(new Error('restart failed'))));
  });
  check(await until(q, () => output(q.node, 'subscribed') === false, 30000), 'Subscribed goes false while it is gone');
  check(await until(q, () => output(q.node, 'subscribed') === true, 120000), 'and back to true once it returns', {
    status: output(q.node, 'realtimeStatus')
  });

  mark = q.signals.length;
  const after = await req(`${DIRECTUS}/items/${DIRECTUS_COLL}`, {
    method: 'POST',
    headers: { ...auth, Authorization: `Bearer ${(await directusToken()) || token}` },
    body: JSON.stringify({ title: 'after the restart' })
  });
  check(
    await until(q, () => since(q, mark).includes('created'), 40000),
    '⭐ a row written AFTER the restart still fires Record Created in the graph',
    { status: after.status, signals: since(q, mark) }
  );

  q.node._onNodeDeleted();
  check(output(q.node, 'subscribed') === false, 'deleting the node tears the subscription down');
}

async function directusToken(): Promise<string | null> {
  const login = await req(`${DIRECTUS}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(DIRECTUS_ADMIN)
  });
  return login.json?.data?.access_token || null;
}

// ═══════════════════════════════════════════════════════════════════════════

async function nodegx() {
  head('NODEGX — the same capability, the other transport');

  const health = await req(`${NODEGX}/health`);
  if (health.status !== 200) {
    check(false, 'nodegx-backend on 8593 is up');
    return;
  }

  setMetadata({
    backendServices: {
      activeBackendId: 'n1',
      backends: [
        {
          id: 'n1',
          name: 'NodeGX',
          type: 'nodegx',
          url: NODEGX,
          auth: {},
          schema: { collections: [{ name: NODEGX_COLL, primaryKey: 'objectId', fields: [{ name: 'title', type: 'string' }] }] }
        }
      ]
    }
  });

  const q = createQueryNode();
  setInput(q.node, 'backendId', 'n1');
  setInput(q.node, 'collectionName', NODEGX_COLL);
  setInput(q.node, 'realtime', true);

  const up = await until(q, () => output(q.node, 'subscribed') === true);
  check(up, 'Subscribed output goes true over SSE', { error: output(q.node, 'realtimeError') });
  if (!up) return;

  sub('a create, made from outside the app');
  const mark = q.signals.length;
  const created = await req(`${NODEGX}/classes/${NODEGX_COLL}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'node-driver sse create' })
  });
  const id = created.json?.objectId;
  check(await until(q, () => since(q, mark).includes('created')), '⭐ Record Created fires', since(q, mark));
  check(since(q, mark).includes('changed'), '⭐ …and Records Changed with it', since(q, mark));
  check(output(q.node, 'changedRecordId') === String(id), 'Changed Record Id is the objectId', {
    port: output(q.node, 'changedRecordId'),
    rest: id
  });

  sub('⚠️ a delete — this backend sends the whole record, unlike Directus');
  const mark2 = q.signals.length;
  await req(`${NODEGX}/classes/${NODEGX_COLL}/${id}`, { method: 'DELETE' });
  check(await until(q, () => since(q, mark2).includes('deleted')), 'Record Deleted fires', since(q, mark2));
  check(
    (output(q.node, 'changedRecord') as Any)?.title === 'node-driver sse create',
    '⭐ Changed Record carries the pre-delete row here — the SAME port, a different guarantee',
    output(q.node, 'changedRecord')
  );

  q.node._onNodeDeleted();
}

// ═══════════════════════════════════════════════════════════════════════════

async function unsupported() {
  head('A BACKEND WITH NO REALTIME — a reason on a port, not silence');

  setMetadata({
    backendServices: {
      activeBackendId: 's1',
      backends: [{ id: 's1', name: 'Supabase', type: 'supabase', url: 'http://localhost:8056', auth: {}, schema: { collections: [] } }]
    }
  });

  const q = createQueryNode();
  setInput(q.node, 'backendId', 's1');
  setInput(q.node, 'collectionName', 'articles');
  setInput(q.node, 'realtime', true);

  const reported = await until(q, () => !!output(q.node, 'realtimeError'), 10000);
  check(reported, 'Realtime Error is populated', output(q.node, 'realtimeError'));
  check(q.signals.includes('realtimeFailure'), 'and the Realtime Failure signal fired', q.signals);
  check(output(q.node, 'subscribed') === false, 'Subscribed stays false rather than pending forever');
  const error = output(q.node, 'realtimeError') as Any;
  check(error?.code === 'CAPABILITY_UNAVAILABLE', 'with a code a graph can branch on', error?.code);
  check(typeof error?.message === 'string' && error.message.length > 40, 'and a sentence a person can act on');
  say(`      reason: ${error?.message}`);

  q.node._onNodeDeleted();
}

// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  say('BCN-008 node driver — ' + new Date().toISOString());
  say(`node ${process.version} · global EventSource: ${typeof EventSource} · global WebSocket: ${typeof WebSocket}`);

  installRuntime();
  context = makeContext();

  const asked = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const sections: Record<string, () => Promise<void>> = { directus, nodegx, unsupported };
  for (const name of asked.length ? asked : Object.keys(sections)) {
    try {
      await sections[name]();
    } catch (e) {
      check(false, `${name} threw`, e instanceof Error ? e.stack?.split('\n').slice(0, 4).join(' | ') : String(e));
    }
  }

  head(`RESULT — ${pass} passed, ${failures.length} failed`);
  for (const f of failures) say('  ❌ ' + f);
  process.exit(failures.length === 0 ? 0 : 1);
}

main();
