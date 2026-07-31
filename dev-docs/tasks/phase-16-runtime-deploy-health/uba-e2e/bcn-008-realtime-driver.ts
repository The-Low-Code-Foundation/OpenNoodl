/**
 * BCN-008's live pass — the SHIPPED transports, against live servers, across a restart.
 *
 * The measurement pass (`bcn-008-realtime-probe.mjs`) asked the servers what they do. This
 * asks whether `api/backends/realtime/`'s classes actually do it, which is a different
 * question and the one the success criteria are written in. Every subscription here is
 * constructed by `createRealtimeSubscription` — nothing in this file builds a URL, parses a
 * frame or decides when to reconnect.
 *
 * ## The check that matters
 *
 * **A restart, and then a delivery.** BCN-008's contract half could not restart anything:
 * two other workers shared the rig. So reconnect-and-resubscribe was unverified for *every*
 * transport, the shipped Directus one included. Here each transport is subscribed, the
 * backend is restarted underneath it, and then a **new** row is written — because a status
 * flipping back to `subscribed` proves a socket reconnected and proves nothing about
 * whether the subscription was re-registered. Both servers mint a fresh `clientId` per
 * connection and both treat the subscription POST as replacing the set, so "reconnected"
 * and "resubscribed" are genuinely separable states, and only one of them is useful.
 *
 * ⚠️ **"Nothing was delivered" and "everything worked" look identical to a driver that
 * only checks for the absence of errors.** So every assertion here is positive: a named
 * event, with a named field, of a named type.
 *
 * ## Run
 *
 *   docker compose --profile supabase --profile aggregate --profile parse up -d
 *   (cd ../../../../packages/nodegx-backend && npm run build &&
 *    node bin/nodegx-backend.js serve --data-dir /tmp/bcn008-rt-data --port 8593)
 *   node bcn-008-realtime-driver.build.mjs && node bcn-008-realtime-driver.cjs
 *
 * Sections: `node bcn-008-realtime-driver.cjs directus pocketbase`.
 *
 * ⚠️ Do not pipe it into `head`: SIGPIPE kills the run partway through and it reads as the
 * server having stopped answering.
 */

import net from 'node:net';
import { spawn } from 'node:child_process';

import {
  createRealtimeSubscription,
  realtimeSupportFor,
  type RealtimeSubscription
} from '../../../../packages/noodl-runtime/src/api/backends/realtime';
import type { BackendHandle, RealtimeChange, RealtimeError, RealtimeStatus } from '@noodl/backend-contract';

const DIRECTUS = 'http://localhost:8055';
const POCKETBASE = 'http://localhost:8091';
const PARSE = 'http://localhost:8092';
const POSTGREST = 'http://localhost:8056';
const NODEGX = 'http://localhost:8593';

const DIRECTUS_ADMIN = { email: 'admin@example.com', password: 'directus-admin-pw' };
const POCKETBASE_ADMIN = { identity: 'admin@example.com', password: 'pocketbase-admin-pw' };
const PARSE_APP_ID = 'uba-e2e-app';

const COLL = 'bcn008_live';
const NODEGX_COLL = 'Bcn008Live';
const NODEGX_DATA_DIR = '/tmp/bcn008-rt-data';

// ── reporting ──────────────────────────────────────────────────────────────

let passes = 0;
const failures: string[] = [];

function say(s = '') {
  console.log(s);
}
function head(s: string) {
  say('');
  say('='.repeat(78));
  say(s);
  say('='.repeat(78));
}
function sub(s: string) {
  say('');
  say('── ' + s + ' ' + '─'.repeat(Math.max(0, 72 - s.length)));
}
function note(s: string) {
  say('  · ' + s);
}
/** A positive assertion, with the evidence printed either way. */
function check(ok: boolean, label: string, evidence: unknown = '') {
  const detail = typeof evidence === 'string' ? evidence : JSON.stringify(evidence);
  if (ok) {
    passes++;
    say(`  ✅ ${label}${detail ? '  — ' + detail : ''}`);
  } else {
    failures.push(label);
    say(`  ❌ ${label}${detail ? '  — ' + detail : ''}`);
  }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

interface Reply {
  status: number;
  text: string;
  json: any;
}

async function req(url: string, init: RequestInit = {}): Promise<Reply> {
  const r = await fetch(url, init);
  const text = await r.text();
  let body: any = null;
  try {
    body = JSON.parse(text);
  } catch {
    /* not json */
  }
  return { status: r.status, text, json: body };
}

// ── an EventSource, because Node 22 has none ───────────────────────────────

/**
 * A faithful-enough `EventSource` over `fetch`.
 *
 * ⚠️ This is the one place the live pass is not measuring the real thing. Node 22.22 has
 * **no global `EventSource`** (measured, BCN-008 §5), so the two SSE transports cannot even
 * be constructed server-side — which is one of the two reasons `REALTIME_SSR_COMPAT` is
 * `client-only`. Running them here at all requires a shim, and a shim's reconnection
 * behaviour is the shim's, not the browser's.
 *
 * So it is written to the part of the spec the transports depend on:
 *
 * - dispatch by `event:` name, `data:` lines joined with `\n`, comment lines (`:`) ignored;
 * - `id:` remembered and replayed as `Last-Event-ID` on reconnect — the behaviour that
 *   earns our backend's `resync` frame;
 * - auto-reconnect after `retry:` ms (default 3000), because the browser's does, and
 *   because the transport's `onerror` handling is *written around* that fact;
 * - `autoReconnect: false` to model a host that does not, which is how the funnel and our
 *   own backoff get exercised instead.
 *
 * Both modes are run below. The browser's actual `EventSource` remains unmeasured here and
 * that is recorded in the notes rather than glossed.
 */
class NodeEventSource {
  static autoReconnect = true;

  private _listeners = new Map<string, ((event: { data: string }) => void)[]>();
  private _ctrl: AbortController | null = null;
  private _closed = false;
  private _lastId: string | null = null;
  private _retryMs = 3000;
  onerror: ((...args: unknown[]) => void) | null = null;
  readonly url: string;
  /** Every connection this instance has opened, for the reconnect assertions. */
  connects = 0;

  constructor(url: string) {
    this.url = url;
    this._open();
  }

  addEventListener(type: string, listener: (event: { data: string }) => void): void {
    const list = this._listeners.get(type) || [];
    list.push(listener);
    this._listeners.set(type, list);
  }

  close(): void {
    this._closed = true;
    try {
      this._ctrl?.abort();
    } catch {
      /* already aborted */
    }
  }

  private _fail() {
    if (this._closed) return;
    if (this.onerror) this.onerror({ type: 'error' });
    if (!NodeEventSource.autoReconnect) {
      this._closed = true;
      return;
    }
    setTimeout(() => this._open(), this._retryMs);
  }

  private async _open() {
    if (this._closed) return;
    this.connects++;
    this._ctrl = new AbortController();
    let res: Response;
    try {
      const headers: Record<string, string> = { Accept: 'text/event-stream' };
      if (this._lastId !== null) headers['Last-Event-ID'] = this._lastId;
      res = await fetch(this.url, { headers, signal: this._ctrl.signal });
    } catch (e) {
      this._fail();
      return;
    }
    if (!res.ok || !res.body || !String(res.headers.get('content-type') || '').includes('text/event-stream')) {
      this._fail();
      return;
    }
    this._pump(res.body);
  }

  private async _pump(body: ReadableStream<Uint8Array>) {
    const reader = body.getReader();
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
      /* aborted or torn down */
    }
    this._fail();
  }

  private _dispatch(block: string) {
    if (block.startsWith(':')) return; // a comment — the NodeGX heartbeat lives here
    let name = 'message';
    const dataLines: string[] = [];
    for (const line of block.split(/\r?\n/)) {
      const c = line.indexOf(':');
      const field = c < 0 ? line : line.slice(0, c);
      const value = c < 0 ? '' : line.slice(c + 1).replace(/^ /, '');
      if (field === 'event') name = value;
      else if (field === 'data') dataLines.push(value);
      else if (field === 'id') this._lastId = value;
      else if (field === 'retry') this._retryMs = Number(value) || this._retryMs;
    }
    const event = { data: dataLines.join('\n') };
    for (const listener of this._listeners.get(name) || []) listener(event);
  }
}

// ── watching one subscription ──────────────────────────────────────────────

/** Everything a subscription reported, with waiters, so assertions can be positive. */
class Watcher {
  changes: RealtimeChange[] = [];
  statuses: RealtimeStatus[] = [];
  errors: RealtimeError[] = [];
  subscription: RealtimeSubscription | null = null;

  private _waiters: { pred: () => boolean; resolve: () => void }[] = [];

  callbacks() {
    return {
      onEvent: (change: RealtimeChange) => {
        this.changes.push(change);
        this._settle();
      },
      onStatus: (status: RealtimeStatus) => {
        this.statuses.push(status);
        this._settle();
      },
      onError: (error: RealtimeError) => {
        this.errors.push(error);
        this._settle();
      }
    };
  }

  private _settle() {
    for (const w of this._waiters.slice()) {
      if (w.pred()) {
        this._waiters.splice(this._waiters.indexOf(w), 1);
        w.resolve();
      }
    }
  }

  /** Resolves true as soon as `pred` holds; false on timeout. */
  wait(pred: () => boolean, ms: number): Promise<boolean> {
    if (pred()) return Promise.resolve(true);
    return new Promise((resolve) => {
      const w = { pred, resolve: () => resolve(true) };
      this._waiters.push(w);
      setTimeout(() => {
        const i = this._waiters.indexOf(w);
        if (i >= 0) {
          this._waiters.splice(i, 1);
          resolve(pred());
        }
      }, ms);
    });
  }

  waitForChange(pred: (c: RealtimeChange) => boolean, ms: number) {
    return this.wait(() => this.changes.some(pred), ms);
  }
  waitForStatus(status: RealtimeStatus, ms: number) {
    return this.wait(() => this.subscription?.status === status, ms);
  }
  /** A status transition that happens after this many entries have already been seen. */
  waitForStatusAfter(status: RealtimeStatus, from: number, ms: number) {
    return this.wait(() => this.statuses.slice(from).indexOf(status) >= 0, ms);
  }
  find(pred: (c: RealtimeChange) => boolean) {
    return this.changes.find(pred);
  }
  dispose() {
    this.subscription?.dispose();
  }
}

function subscribe(handle: BackendHandle, collection: string, extra: Record<string, unknown> = {}): Watcher {
  const watcher = new Watcher();
  watcher.subscription = createRealtimeSubscription(handle, {
    collection,
    deps: {
      EventSourceImpl: NodeEventSource as never,
      WebSocketImpl: typeof WebSocket !== 'undefined' ? (WebSocket as never) : null
    },
    ...watcher.callbacks(),
    ...extra
  } as never);
  return watcher;
}

/** `docker restart`, awaited properly rather than slept at. */
async function dockerRestart(container: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const p = spawn('docker', ['restart', container], { stdio: 'inherit' });
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`docker restart ${container} exited ${code}`))));
  });
}

/** Poll until a URL answers, so "restarted" means "answering again". */
async function waitForHttp(url: string, ms: number): Promise<boolean> {
  const deadline = Date.now() + ms;
  for (;;) {
    try {
      const r = await fetch(url);
      if (r.status < 500) return true;
    } catch {
      /* not up yet */
    }
    if (Date.now() > deadline) return false;
    await sleep(500);
  }
}

// ═══════════════════════════════════════════════════════════════════════════

async function directus() {
  head('DIRECTUS 11 — WebSocket, via DirectusWebSocketTransport');

  const support = realtimeSupportFor('directus');
  check(support.state === 'supported' && support.transport === 'websocket', 'declared supported over websocket', support);

  let token = await directusToken();
  if (!token) {
    check(false, 'directus admin login', 'could not get a token');
    return;
  }
  const auth = () => ({ Authorization: `Bearer ${token}`, 'content-type': 'application/json' });
  await directusEnsureCollection(auth());

  const handle: BackendHandle = {
    id: 'directus',
    type: 'directus',
    name: 'Directus',
    url: DIRECTUS,
    sessionToken: token
  };

  sub('subscribe, then mutate from outside the app');
  const w = subscribe(handle, COLL);
  check(await w.waitForStatus('subscribed', 15000), 'status → subscribed (the init frame confirmed it)', w.statuses);
  check(!!w.find((c) => c.type === 'init'), 'an init frame arrived and is reported as type "init"');

  const created = await req(`${DIRECTUS}/items/${COLL}`, {
    method: 'POST',
    headers: auth(),
    body: JSON.stringify({ title: 'live row' })
  });
  const id = created.json?.data?.id;
  check(typeof id === 'number', 'the REST id is a NUMBER on this backend', `${JSON.stringify(id)} (${typeof id})`);

  check(await w.waitForChange((c) => c.type === 'create', 10000), 'create delivered');
  const createChange = w.find((c) => c.type === 'create');
  check(createChange?.ids[0] === String(id), 'create ids are strings and match the REST id', createChange?.ids);
  check(createChange?.recordsComplete === true && (createChange?.records.length || 0) > 0, 'create carries the record');

  await req(`${DIRECTUS}/items/${COLL}/${id}`, {
    method: 'PATCH',
    headers: auth(),
    body: JSON.stringify({ title: 'live row, edited' })
  });
  check(await w.waitForChange((c) => c.type === 'update', 10000), 'update delivered');

  await req(`${DIRECTUS}/items/${COLL}/${id}`, { method: 'DELETE', headers: auth() });
  check(await w.waitForChange((c) => c.type === 'delete', 10000), 'delete delivered');
  const del = w.find((c) => c.type === 'delete');
  // THE finding this whole contract is shaped around.
  check(del?.ids[0] === String(id), 'delete ids are strings for an INTEGER primary key', del?.ids);
  check(del?.records.length === 0 && del?.recordsComplete === false, 'delete says recordsComplete:false', {
    records: del?.records.length,
    recordsComplete: del?.recordsComplete
  });

  sub('the ping/pong rule — 70s of silence from us');
  note('Measured: the server pings at ~30s and closes a client that ignored one at ~60s,');
  note('code 1005. If the transport answers, the subscription never leaves `subscribed`.');
  const statusesBefore = w.statuses.length;
  await sleep(72000);
  const dropped = w.statuses.slice(statusesBefore);
  check(dropped.length === 0 && w.subscription?.status === 'subscribed', 'still subscribed after 72s idle', dropped);
  // And it is still a working subscription, not just an open socket.
  const after = await req(`${DIRECTUS}/items/${COLL}`, {
    method: 'POST',
    headers: auth(),
    body: JSON.stringify({ title: 'after the idle window' })
  });
  check(
    await w.waitForChange((c) => c.type === 'create' && c.ids[0] === String(after.json?.data?.id), 10000),
    'a row written after the idle window is still delivered'
  );

  sub('⚠️ THE unverified criterion — restart the container');
  const marker = w.statuses.length;
  await dockerRestart('uba-e2e-directus-1');
  check(await w.waitForStatusAfter('interrupted', marker, 20000), 'the drop was noticed (status → interrupted)');
  check(await waitForHttp(`${DIRECTUS}/server/ping`, 90000), 'directus is answering again');
  // Its token survives a restart (same secret), but re-auth anyway: the access token
  // expires in 15 minutes and this section has already burned 80s of it.
  token = (await directusToken()) || token;
  check(await w.waitForStatusAfter('subscribed', marker, 90000), 'reconnected and re-confirmed', w.statuses.slice(marker));

  const post = await req(`${DIRECTUS}/items/${COLL}`, {
    method: 'POST',
    headers: auth(),
    body: JSON.stringify({ title: 'after the restart' })
  });
  const postId = post.json?.data?.id;
  check(
    await w.waitForChange((c) => c.type === 'create' && c.ids[0] === String(postId), 30000),
    '⭐ a row written AFTER the restart is delivered — resubscribed, not merely reconnected',
    { postId, status: post.status }
  );

  w.dispose();
  check(w.subscription?.status === 'stopped', 'dispose leaves it stopped');
}

async function directusToken(): Promise<string | null> {
  const login = await req(`${DIRECTUS}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(DIRECTUS_ADMIN)
  });
  return login.json?.data?.access_token || null;
}

async function directusEnsureCollection(auth: Record<string, string>) {
  const existing = await req(`${DIRECTUS}/collections/${COLL}`, { headers: auth });
  if (existing.status === 200) {
    note(`collection ${COLL} already present`);
    return;
  }
  const created = await req(`${DIRECTUS}/collections`, {
    method: 'POST',
    headers: auth,
    // An INTEGER primary key on purpose: the delete-payload question only has an
    // interesting answer when the key is not a string to begin with.
    body: JSON.stringify({
      collection: COLL,
      schema: {},
      meta: { singleton: false },
      fields: [
        {
          field: 'id',
          type: 'integer',
          meta: { hidden: true, interface: 'input', readonly: true },
          schema: { is_primary_key: true, has_auto_increment: true }
        },
        { field: 'title', type: 'string', meta: {}, schema: {} }
      ]
    })
  });
  check(created.status === 200, `created ${COLL} with an integer pk`, created.text.slice(0, 160));
}

// ═══════════════════════════════════════════════════════════════════════════

async function pocketbase() {
  head('POCKETBASE 0.30 — SSE, via SseTransport + POCKETBASE_SSE');

  const support = realtimeSupportFor('pocketbase');
  check(support.state === 'supported' && support.transport === 'sse', 'declared supported over sse', support);

  const login = await req(`${POCKETBASE}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(POCKETBASE_ADMIN)
  });
  const admin = login.json?.token;
  if (!admin) {
    check(false, 'pocketbase superuser login', login.text.slice(0, 160));
    return;
  }
  const adminHeaders = { Authorization: admin, 'content-type': 'application/json' };
  await pbEnsureCollection(adminHeaders, COLL, true);
  await pbEnsureCollection(adminHeaders, `${COLL}_private`, false);

  // ⚠️ Anonymous, deliberately: the whole measured probe ran with no token and worked, and
  // that is what a shipped browser app carries when nobody has signed in.
  const handle: BackendHandle = { id: 'pb', type: 'pocketbase', name: 'PocketBase', url: POCKETBASE };

  sub('subscribe, then mutate from outside the app');
  const w = subscribe(handle, COLL);
  check(await w.waitForStatus('subscribed', 15000), 'status → subscribed (the 204 confirmed it)', w.statuses);

  const created = await req(`${POCKETBASE}/api/collections/${COLL}/records`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ title: 'live row', count: 1 })
  });
  const id = created.json?.id;
  check(await w.waitForChange((c) => c.type === 'create', 10000), 'create delivered on an event named after the COLLECTION');
  const createChange = w.find((c) => c.type === 'create');
  check(createChange?.ids[0] === String(id), 'create ids match the REST id', createChange?.ids);

  await req(`${POCKETBASE}/api/collections/${COLL}/records/${id}`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: JSON.stringify({ title: 'live row, edited' })
  });
  check(await w.waitForChange((c) => c.type === 'update', 10000), 'update delivered');

  await req(`${POCKETBASE}/api/collections/${COLL}/records/${id}`, { method: 'DELETE', headers: adminHeaders });
  check(await w.waitForChange((c) => c.type === 'delete', 10000), 'delete delivered');
  const del = w.find((c) => c.type === 'delete');
  check(del?.recordsComplete === true && (del?.records.length || 0) > 0, 'delete carries the WHOLE record here', {
    records: del?.records.length,
    recordsComplete: del?.recordsComplete
  });
  check(del?.ids[0] === String(id), 'delete ids are strings (a 15-char PocketBase id)', del?.ids);

  sub('⚠️ a 204 is not a subscription — the trap, as a measurement');
  note('An anonymous subscription to a superuser-only collection is accepted with 204 and');
  note('then delivers nothing. Our transport reports `subscribed`, because 204 is genuinely');
  note('all the wire says. This records the limit rather than pretending it is not there.');
  const priv = subscribe(handle, `${COLL}_private`);
  check(await priv.waitForStatus('subscribed', 15000), 'the private collection also reports subscribed', priv.statuses);
  await req(`${POCKETBASE}/api/collections/${COLL}_private/records`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ title: 'should never be delivered' })
  });
  const leaked = await priv.waitForChange(() => true, 6000);
  check(!leaked, 'and nothing is delivered — subscribed-but-silent is a real state on this backend');
  priv.dispose();

  sub('⚠️ THE unverified criterion — restart the container');
  const marker = w.statuses.length;
  await dockerRestart('uba-e2e-pocketbase-1');
  check(await w.waitForStatusAfter('interrupted', marker, 30000), 'the drop was noticed (status → interrupted)');
  check(await waitForHttp(`${POCKETBASE}/api/health`, 90000), 'pocketbase is answering again');
  check(await w.waitForStatusAfter('subscribed', marker, 90000), 'reconnected and re-confirmed', w.statuses.slice(marker));

  const post = await req(`${POCKETBASE}/api/collections/${COLL}/records`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ title: 'after the restart', count: 2 })
  });
  check(
    await w.waitForChange((c) => c.type === 'create' && c.ids[0] === String(post.json?.id), 30000),
    '⭐ a row written AFTER the restart is delivered — resubscribed, not merely reconnected',
    { id: post.json?.id, status: post.status }
  );

  w.dispose();
}

async function pbEnsureCollection(adminHeaders: Record<string, string>, name: string, publicRules: boolean) {
  const list = await req(`${POCKETBASE}/api/collections?perPage=200`, { headers: adminHeaders });
  if ((list.json?.items || []).some((c: any) => c.name === name)) {
    note(`collection ${name} already present`);
    return;
  }
  const body: Record<string, unknown> = {
    name,
    type: 'base',
    fields: [
      { name: 'title', type: 'text' },
      { name: 'count', type: 'number' }
    ]
  };
  if (publicRules) {
    // Empty string = public. `null` (omitted) = superuser only, which is the other half of
    // the 204 trap below.
    Object.assign(body, { listRule: '', viewRule: '', createRule: '', updateRule: '', deleteRule: '' });
  }
  const created = await req(`${POCKETBASE}/api/collections`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify(body)
  });
  check(created.status === 200, `created ${name}`, created.text.slice(0, 160));
}

// ═══════════════════════════════════════════════════════════════════════════

async function nodegx() {
  head('NODEGX BACKEND — SSE, via SseTransport + NODEGX_SSE');

  const support = realtimeSupportFor('nodegx');
  check(support.state === 'supported' && support.transport === 'sse', 'declared supported over sse', support);

  if (!(await waitForHttp(`${NODEGX}/health`, 3000))) {
    check(false, 'nodegx-backend on 8593 is up', 'start it — see this file\'s docblock');
    return;
  }

  const handle: BackendHandle = { id: 'nodegx', type: 'nodegx', name: 'NodeGX', url: NODEGX };

  sub('subscribe, then mutate from outside the app');
  // `objectId` is the id field on the Parse wire, and NODEGX_SSE reads it first.
  const w = subscribe(handle, NODEGX_COLL, { primaryKey: 'objectId' });
  check(await w.waitForStatus('subscribed', 15000), 'status → subscribed (a non-empty accepted[] confirmed it)', w.statuses);

  const created = await req(`${NODEGX}/classes/${NODEGX_COLL}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'live row', count: 1 })
  });
  const id = created.json?.objectId;
  check(await w.waitForChange((c) => c.type === 'create', 10000), 'create delivered');
  check(w.find((c) => c.type === 'create')?.ids[0] === String(id), 'create ids match the REST objectId', id);

  await req(`${NODEGX}/classes/${NODEGX_COLL}/${id}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'live row, edited' })
  });
  check(await w.waitForChange((c) => c.type === 'update', 10000), 'update delivered');

  await req(`${NODEGX}/classes/${NODEGX_COLL}/${id}`, { method: 'DELETE' });
  check(await w.waitForChange((c) => c.type === 'delete', 10000), 'delete delivered');
  const del = w.find((c) => c.type === 'delete');
  check(del?.recordsComplete === true && (del?.records.length || 0) > 0, 'delete carries the whole pre-delete record', {
    records: del?.records.length
  });

  sub('⚠️ read the BODY: a rejected filter answers 200');
  const rejected = subscribe(handle, NODEGX_COLL, { where: { title: { $nonsense: 1 } } });
  const reported = await rejected.wait(() => rejected.errors.some((e) => e.code === 'SUBSCRIPTION_REJECTED'), 15000);
  check(reported, 'a 200 carrying rejected[] is reported as SUBSCRIPTION_REJECTED', rejected.errors[0]);
  check(rejected.subscription?.status !== 'subscribed', 'and it is NOT reported as subscribed', rejected.subscription?.status);
  rejected.dispose();

  sub('⚠️ THE unverified criterion — restart the backend');
  note('Not a container: the rig has no nodegx-backend service, so this is the same process');
  note('killed and re-launched, which is the same event from the socket\'s point of view.');
  const marker = w.statuses.length;
  await restartNodeGX();
  check(await w.waitForStatusAfter('interrupted', marker, 30000), 'the drop was noticed (status → interrupted)');
  check(await waitForHttp(`${NODEGX}/health`, 60000), 'nodegx-backend is answering again');
  check(await w.waitForStatusAfter('subscribed', marker, 90000), 'reconnected and re-confirmed', w.statuses.slice(marker));

  const post = await req(`${NODEGX}/classes/${NODEGX_COLL}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'after the restart', count: 2 })
  });
  check(
    await w.waitForChange((c) => c.type === 'create' && c.ids[0] === String(post.json?.objectId), 30000),
    '⭐ a row written AFTER the restart is delivered — resubscribed with a FRESH clientId',
    { objectId: post.json?.objectId, status: post.status }
  );
  // The frame that says "your view may be stale" — a fresh connection with a Last-Event-ID.
  note(`resync frames seen: ${w.changes.filter((c) => c.type === 'resync').length}`);

  w.dispose();
}

let nodegxChild: ReturnType<typeof spawn> | null = null;

async function restartNodeGX(): Promise<void> {
  await new Promise<void>((resolve) => {
    const p = spawn('bash', ['-lc', `pkill -f "nodegx-backend.js serve --data-dir ${NODEGX_DATA_DIR}" || true`], {
      stdio: 'ignore'
    });
    p.on('exit', () => resolve());
  });
  await sleep(1500);
  nodegxChild = spawn(
    'node',
    ['bin/nodegx-backend.js', 'serve', '--data-dir', NODEGX_DATA_DIR, '--port', '8593'],
    {
      cwd: `${__dirname}/../../../../packages/nodegx-backend`,
      detached: true,
      stdio: 'ignore'
    }
  );
  nodegxChild.unref();
}

// ═══════════════════════════════════════════════════════════════════════════

async function parse() {
  head('PARSE 7.3.0 — LiveQuery, probed. Measured ABSENT.');

  const support = realtimeSupportFor('parse');
  check(support.state === 'conditional', 'declared conditional, not supported', support.state);
  check(!!support.reason, 'and it says why', support.reason);

  const handle: BackendHandle = {
    id: 'parse',
    type: 'parse',
    name: 'Parse',
    url: PARSE + '/parse',
    publicToken: PARSE_APP_ID
  };

  sub('a subscription reports a reason, fast, and stops');
  const t0 = Date.now();
  const w = subscribe(handle, 'Bcn008Live');
  const reported = await w.wait(() => w.errors.length > 0, 6000);
  const elapsed = Date.now() - t0;
  check(reported, 'the probe reported inside 6s', `${elapsed}ms`);
  check(w.errors[0]?.code === 'CAPABILITY_UNAVAILABLE', 'as CAPABILITY_UNAVAILABLE', w.errors[0]?.code);
  check(w.errors[0]?.kind === 'fatal', 'and fatal, so it does not retry forever', w.errors[0]?.kind);
  check(w.subscription?.status === 'stopped', 'status → stopped, not connecting-forever', w.subscription?.status);
  say(`      reason: ${w.errors[0]?.message}`);

  // The silence this replaces: with no probe, a Parse app would sit `connecting` with no
  // error anywhere, which is the exact failure `conditional` was invented for.
  await sleep(3000);
  check(w.errors.length === 1, 'reported exactly once', `${w.errors.length} error(s)`);
  w.dispose();
}

// ═══════════════════════════════════════════════════════════════════════════

async function supabase() {
  head('SUPABASE — nothing measured, and it says so');

  const support = realtimeSupportFor('supabase');
  check(support.state === 'unsupported', 'declared unsupported', support.state);
  check(support.transport === 'phoenix-channel', 'and named as its own transport, not "websocket"', support.transport);

  const handle: BackendHandle = { id: 'sb', type: 'supabase', name: 'Supabase', url: POSTGREST };
  const w = subscribe(handle, COLL);
  const reported = await w.wait(() => w.errors.length > 0, 4000);
  check(reported, 'a subscription reports immediately rather than opening a socket');
  check(w.errors[0]?.code === 'CAPABILITY_UNAVAILABLE', 'as CAPABILITY_UNAVAILABLE', w.errors[0]?.code);
  check(w.subscription?.status === 'stopped', 'status → stopped');
  say(`      reason: ${w.errors[0]?.message}`);
  w.dispose();

  sub('and the rig still has no Supabase Realtime — re-checked, not assumed');
  const health = await req(`${POSTGREST}/realtime/v1/api/tenants/realtime/health`);
  check(health.status === 404, 'the descriptor\'s own health path is a 404 from PostgREST', String(health.status));
}

// ═══════════════════════════════════════════════════════════════════════════

/**
 * The failure modes the funnel exists for, against the shipped classes.
 *
 * Row 3 of BCN-008 §2 is the one that has never been survivable: a socket that fires
 * **neither `error` nor `close`**. It is reproduced here with a TCP server that accepts a
 * connection and then says nothing at all — which is exactly what Directus does on a path
 * it will not upgrade.
 */
async function traps() {
  head('THE onclose TRAP — does the funnel actually catch all three paths?');

  sub('a listening server that is not a WebSocket server (error, and never close)');
  const w1 = subscribe(
    { id: 'x', type: 'directus', name: 'PostgREST', url: POSTGREST },
    COLL,
    { timing: { reconnectBaseMs: 200, reconnectMaxMs: 400, connectTimeoutMs: 15000 } }
  );
  const bounced = await w1.wait(() => w1.statuses.filter((s) => s === 'interrupted').length >= 2, 12000);
  check(bounced, '`error` alone drives reconnection (twice), with no `close` ever arriving', w1.statuses.slice(0, 6));
  w1.dispose();

  sub('⚠️ a socket that fires NOTHING — the row RUN-003 never saw');
  const silent = net.createServer((socket) => {
    // Accept, and then send no bytes at all, ever. Directus's own behaviour on a
    // non-upgrading path, reproduced locally so it can be asserted rather than described.
    socket.resume();
  });
  await new Promise<void>((r) => silent.listen(8497, '127.0.0.1', () => r()));

  const t0 = Date.now();
  const w2 = subscribe({ id: 'y', type: 'directus', name: 'Silent', url: 'http://127.0.0.1:8497' }, COLL, {
    // 2s rather than the shipped 15s so the assertion is quick; the mechanism is identical.
    timing: { reconnectBaseMs: 300, reconnectMaxMs: 600, connectTimeoutMs: 2000 }
  });
  const timedOut = await w2.wait(() => w2.errors.some((e) => e.code === 'CONNECT_TIMEOUT'), 8000);
  check(timedOut, '⭐ the connect deadline fired — the ONLY thing that can notice this', `${Date.now() - t0}ms`);
  check(
    await w2.wait(() => w2.errors.filter((e) => e.code === 'CONNECT_TIMEOUT').length >= 2, 8000),
    'and it keeps retrying rather than reporting once and dying',
    `${w2.errors.length} reports`
  );
  w2.dispose();
  silent.close();

  sub('a bad token is fatal, not a retry loop');
  const w3 = subscribe(
    { id: 'z', type: 'directus', name: 'Directus', url: DIRECTUS, sessionToken: 'not-a-real-token' },
    COLL,
    { timing: { reconnectBaseMs: 200, reconnectMaxMs: 400, connectTimeoutMs: 15000 } }
  );
  check(await w3.wait(() => w3.errors.some((e) => e.code === 'AUTH_FAILED'), 12000), 'AUTH_FAILED reported', w3.errors[0]);
  check(w3.errors[0]?.kind === 'fatal', 'and classified fatal', w3.errors[0]?.kind);
  await sleep(2500);
  check(w3.subscription?.status === 'stopped', 'status stays stopped — no reconnect storm', {
    status: w3.subscription?.status,
    errors: w3.errors.length
  });
  w3.dispose();

  sub('a host that does not auto-reconnect its own EventSource');
  note('The browser EventSource retries by itself and the transport is written around that.');
  note('With that turned off, our own backoff has to be the thing that recovers.');
  NodeEventSource.autoReconnect = false;
  const w4 = subscribe({ id: 'n', type: 'nodegx', name: 'NodeGX', url: NODEGX }, NODEGX_COLL, {
    primaryKey: 'objectId',
    timing: { reconnectBaseMs: 500, reconnectMaxMs: 1000, connectTimeoutMs: 4000 }
  });
  const up = await w4.waitForStatus('subscribed', 15000);
  check(up, 'subscribed with a non-reconnecting EventSource', w4.statuses);
  if (up) {
    const marker = w4.statuses.length;
    await restartNodeGX();
    check(await w4.waitForStatusAfter('interrupted', marker, 30000), 'the drop was noticed');
    check(await waitForHttp(`${NODEGX}/health`, 60000), 'backend answering again');
    check(await w4.waitForStatusAfter('subscribed', marker, 60000), 'our own backoff reconnected it', w4.statuses.slice(marker));
    const post = await req(`${NODEGX}/classes/${NODEGX_COLL}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'after a no-auto-retry restart' })
    });
    check(
      await w4.waitForChange((c) => c.type === 'create' && c.ids[0] === String(post.json?.objectId), 30000),
      '⭐ and delivered again afterwards'
    );
  }
  w4.dispose();
  NodeEventSource.autoReconnect = true;
}

// ═══════════════════════════════════════════════════════════════════════════

const SECTIONS: Record<string, () => Promise<void>> = { directus, pocketbase, nodegx, parse, supabase, traps };

async function main() {
  const asked = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const run = asked.length ? asked : Object.keys(SECTIONS);

  say('BCN-008 live driver — ' + new Date().toISOString());
  say(`node ${process.version} · global EventSource: ${typeof EventSource} · global WebSocket: ${typeof WebSocket}`);
  say('(the SSE transports run on a fetch-based EventSource shim: Node has none — see the docblock)');

  for (const name of run) {
    try {
      await SECTIONS[name]();
    } catch (e) {
      check(false, `${name} threw`, e instanceof Error ? e.stack?.split('\n').slice(0, 4).join(' | ') : String(e));
    }
  }

  head(`RESULT — ${passes} passed, ${failures.length} failed`);
  for (const f of failures) say('  ❌ ' + f);
  process.exit(failures.length === 0 ? 0 : 1);
}

main();
