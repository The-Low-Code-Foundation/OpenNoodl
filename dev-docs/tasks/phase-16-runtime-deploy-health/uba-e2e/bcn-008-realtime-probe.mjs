/**
 * BCN-008 — what the five backends' realtime surfaces actually do.
 *
 * The `realtime.*` descriptor cells were written from documentation. Three of
 * them are claims about other people's products, one is a claim about a service
 * that may not exist in the rig at all, and the fifth is ours. BCN-002 found all
 * three of Parse's file cells wrong and BCN-003 found four filter cells wrong,
 * both times because the table had been written from a manual — so this asks the
 * servers.
 *
 * Every question below is one the realtime adapter has to answer in code, and
 * one where guessing produces a plausible wrong behaviour rather than an error:
 *
 *   1. What transport, and what does the handshake look like on the wire?
 *   2. **What does a delete event actually carry?** RUN-003 learned the hard way
 *      that Directus sends only keys, as STRINGS, even for a numeric primary
 *      key. Every transport is asked the same question, with `typeof` recorded.
 *   3. What is the keepalive rule, and who is obliged to answer whom? Directus
 *      disconnects a client that will not answer `ping` with `pong`.
 *   4. **How does a failed connect present?** Node's undici WebSocket fires only
 *      `error`, never `close`, when the connect fails before establishing.
 *      Reconnect logic living on `onclose` dead-ends. Measured here for three
 *      distinct failure modes rather than assumed from one.
 *   5. Is the service even there? Parse LiveQuery's absence is silent — the
 *      client connects to a URL that is not serving and nothing errors in an
 *      obvious place — and Supabase Realtime is a separate service from the
 *      PostgREST container that stands in for Supabase in this rig.
 *
 * Run:
 *   docker compose --profile supabase --profile aggregate --profile parse up -d
 *   # …and a local NodeGX backend for the fifth column:
 *   (cd ../../../../packages/nodegx-backend && npm run build &&
 *    node bin/nodegx-backend.js serve --data-dir /tmp/bcn008-data --port 8593)
 *   node bcn-008-realtime-probe.mjs > BCN-008-REALTIME-OUTPUT.txt
 *
 * Sections can be run one at a time: `node bcn-008-realtime-probe.mjs directus`.
 *
 * ⚠️ Do not pipe this into `head`. It closes the pipe, SIGPIPEs node, and the run
 * dies partway through looking like the server stopped answering.
 */

import net from 'node:net';

const DIRECTUS = 'http://localhost:8055';
const POSTGREST = 'http://localhost:8056';
const POCKETBASE = 'http://localhost:8091';
const PARSE = 'http://localhost:8092';
const NODEGX = 'http://localhost:8593';

const DIRECTUS_ADMIN = { email: 'admin@example.com', password: 'directus-admin-pw' };
const POCKETBASE_ADMIN = { identity: 'admin@example.com', password: 'pocketbase-admin-pw' };
const PARSE_APP_ID = 'uba-e2e-app';
const PARSE_MASTER_KEY = 'uba-e2e-master-key';

/** The collection this probe creates on each backend. Named so it cannot collide. */
const COLL = 'bcn008_items';

// ── reporting ──────────────────────────────────────────────────────────────

function say(s = '') {
  console.log(s);
}
function head(s) {
  say('');
  say('='.repeat(76));
  say(s);
  say('='.repeat(76));
}
function sub(s) {
  say('');
  say('── ' + s + ' ' + '─'.repeat(Math.max(0, 70 - s.length)));
}
/** Report a claim and the evidence for it, so the record is auditable. */
function fact(label, value, evidence) {
  say(`  ${label}: ${value}`);
  if (evidence) say(`      evidence: ${evidence}`);
}
function note(s) {
  say(`  · ${s}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** `typeof` for every key, which is the whole point on a delete frame. */
function typesOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return `array[${v.length}] of ${v.map((x) => typeof x).join('|') || '—'}`;
  if (typeof v === 'object') {
    return (
      '{' +
      Object.keys(v)
        .slice(0, 14)
        .map((k) => `${k}: ${v[k] === null ? 'null' : typeof v[k]}`)
        .join(', ') +
      '}'
    );
  }
  return typeof v;
}

function json(v, max = 400) {
  const s = JSON.stringify(v);
  return s.length > max ? s.slice(0, max) + '…' : s;
}

async function req(url, init = {}) {
  const r = await fetch(url, init);
  const text = await r.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    /* not json */
  }
  return { status: r.status, headers: r.headers, text, json: body };
}

/** A WebSocket handshake sent down a bare TCP socket, because `fetch` will not. */
function rawUpgrade(host, port, path, timeoutMs = 5000) {
  return new Promise((resolve) => {
    let out = '';
    const s = net.connect(port, host);
    const done = (v) => {
      try {
        s.destroy();
      } catch {
        /* already gone */
      }
      resolve(v);
    };
    s.setTimeout(timeoutMs, () => done(out || '(no bytes before timeout)'));
    s.on('error', (e) => done(`(socket error: ${e.message})`));
    s.on('connect', () => {
      s.write(
        `GET ${path} HTTP/1.1\r\nHost: ${host}:${port}\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n` +
          `Sec-WebSocket-Version: 13\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n\r\n`
      );
    });
    s.on('data', (d) => {
      out += d.toString('latin1');
      if (out.includes('\r\n\r\n')) done(out);
    });
    s.on('close', () => done(out || '(closed with no bytes)'));
  });
}

// ── a WebSocket under observation ──────────────────────────────────────────

/**
 * Opens a WebSocket and records, with timings, exactly which handlers fire.
 *
 * The `open`/`error`/`close` ORDER is the measurement — see trap 4 above. Nothing
 * here funnels the two failure events together, deliberately: the point is to
 * observe them separately.
 */
function openWs(url) {
  const t0 = Date.now();
  const log = [];
  const waiters = [];
  const record = (kind, detail) => {
    const entry = { at: Date.now() - t0, kind, detail };
    log.push(entry);
    for (const w of waiters.slice()) {
      if (w.pred(entry)) {
        waiters.splice(waiters.indexOf(w), 1);
        w.resolve(entry);
      }
    }
  };

  let ws = null;
  let ctorThrew = null;
  try {
    ws = new WebSocket(url);
  } catch (e) {
    ctorThrew = e && e.message ? e.message : String(e);
    record('ctor-threw', ctorThrew);
  }

  if (ws) {
    ws.onopen = () => record('open', null);
    ws.onerror = (ev) => record('error', (ev && (ev.message || ev.error?.message)) || '(no detail on the event)');
    ws.onclose = (ev) => record('close', ev ? `code=${ev.code} reason=${JSON.stringify(ev.reason || '')}` : '(no event)');
    ws.onmessage = (ev) => {
      let parsed = null;
      try {
        parsed = JSON.parse(ev.data);
      } catch {
        /* non-JSON frame */
      }
      record('message', parsed !== null ? parsed : String(ev.data).slice(0, 300));
    };
  }

  return {
    url,
    log,
    ctorThrew,
    send(msg) {
      const s = typeof msg === 'string' ? msg : JSON.stringify(msg);
      record('sent', s.slice(0, 200));
      ws.send(s);
    },
    /** Resolves with the first log entry matching `pred`; null on timeout. */
    waitFor(pred, ms) {
      const existing = log.find(pred);
      if (existing) return Promise.resolve(existing);
      return new Promise((resolve) => {
        const w = { pred, resolve };
        waiters.push(w);
        setTimeout(() => {
          const i = waiters.indexOf(w);
          if (i >= 0) {
            waiters.splice(i, 1);
            resolve(null);
          }
        }, ms);
      });
    },
    close() {
      try {
        if (ws) {
          ws.onopen = ws.onerror = ws.onclose = ws.onmessage = null;
          ws.close();
        }
      } catch {
        /* already gone */
      }
    }
  };
}

/** A message-log entry whose parsed payload matches. */
const msgWhere = (fn) => (e) => e.kind === 'message' && typeof e.detail === 'object' && e.detail !== null && fn(e.detail);

// ── an SSE stream under observation ────────────────────────────────────────

/**
 * Server-Sent Events, parsed by hand from `fetch`.
 *
 * Node 22 has no global `EventSource` (checked: `typeof EventSource === 'undefined'`),
 * which is itself a finding — the runtime's SSE transports are written against
 * one, so they cannot run server-side even if `client-only` were not declared.
 * Parsing by hand also keeps the COMMENT frames, and on our own backend the
 * heartbeat *is* a comment frame, so an EventSource-based probe would have been
 * structurally unable to see it.
 */
class SseStream {
  constructor(url, init = {}) {
    this.url = url;
    this.init = init;
    this.frames = [];
    this.raw = '';
    this.t0 = Date.now();
    this._waiters = [];
    this._ctrl = new AbortController();
  }

  async open() {
    const res = await fetch(this.url, {
      ...this.init,
      headers: { Accept: 'text/event-stream', ...(this.init.headers || {}) },
      signal: this._ctrl.signal
    });
    this.status = res.status;
    this.contentType = res.headers.get('content-type');
    this.headers = res.headers;
    if (!res.body || !String(this.contentType || '').includes('text/event-stream')) {
      this.notAStream = await res.text();
      return this;
    }
    this._pump(res.body);
    return this;
  }

  async _pump(body) {
    const reader = body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) {
          this._record({ kind: 'stream-end' });
          break;
        }
        const chunk = dec.decode(value, { stream: true });
        this.raw += chunk;
        buf += chunk;
        let i;
        while ((i = buf.search(/\r?\n\r?\n/)) >= 0) {
          const block = buf.slice(0, i);
          buf = buf.slice(i + buf.slice(i).match(/^\r?\n\r?\n/)[0].length);
          this._record(parseSseBlock(block));
        }
      }
    } catch (e) {
      this._record({ kind: 'stream-error', detail: e && e.message });
    }
  }

  _record(frame) {
    frame.at = Date.now() - this.t0;
    this.frames.push(frame);
    for (const w of this._waiters.slice()) {
      if (w.pred(frame)) {
        this._waiters.splice(this._waiters.indexOf(w), 1);
        w.resolve(frame);
      }
    }
  }

  waitFor(pred, ms) {
    const existing = this.frames.find(pred);
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve) => {
      const w = { pred, resolve };
      this._waiters.push(w);
      setTimeout(() => {
        const i = this._waiters.indexOf(w);
        if (i >= 0) {
          this._waiters.splice(i, 1);
          resolve(null);
        }
      }, ms);
    });
  }

  close() {
    try {
      this._ctrl.abort();
    } catch {
      /* already aborted */
    }
  }
}

function parseSseBlock(block) {
  if (block.startsWith(':')) return { kind: 'comment', raw: block, detail: block.slice(1).trim() };
  const out = { kind: 'event', raw: block, event: 'message', id: undefined, data: undefined };
  const dataLines = [];
  for (const line of block.split(/\r?\n/)) {
    const c = line.indexOf(':');
    const field = c < 0 ? line : line.slice(0, c);
    const value = c < 0 ? '' : line.slice(c + 1).replace(/^ /, '');
    if (field === 'event') out.event = value;
    else if (field === 'id') out.id = value;
    else if (field === 'data') dataLines.push(value);
    else if (field === 'retry') out.retry = value;
  }
  out.dataText = dataLines.join('\n');
  try {
    out.data = JSON.parse(out.dataText);
  } catch {
    out.data = out.dataText;
  }
  return out;
}

const evt = (name) => (f) => f.kind === 'event' && f.event === name;

// ═══════════════════════════════════════════════════════════════════════════
// Directus — WebSocket. The calibration case: RUN-003 live-verified this one,
// so anything here that disagrees with byob-realtime.ts is a regression in the
// server or a mistake in the probe, not a discovery.
// ═══════════════════════════════════════════════════════════════════════════

async function directus() {
  head('DIRECTUS 11 — ws://localhost:8055/websocket');

  const login = await req(`${DIRECTUS}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(DIRECTUS_ADMIN)
  });
  const token = login.json?.data?.access_token;
  if (!token) {
    fact('REACHABLE', 'NO — admin login failed', `${login.status} ${login.text.slice(0, 200)}`);
    return;
  }
  const auth = { Authorization: `Bearer ${token}`, 'content-type': 'application/json' };

  // A NUMERIC primary key, on purpose: the delete-payload question only has an
  // interesting answer when the key is not a string to begin with.
  const existing = await req(`${DIRECTUS}/collections/${COLL}`, { headers: auth });
  if (existing.status !== 200) {
    const created = await req(`${DIRECTUS}/collections`, {
      method: 'POST',
      headers: auth,
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
    fact('collection created', created.status === 200 ? 'yes' : `NO (${created.status})`, created.text.slice(0, 200));
  } else {
    note(`collection ${COLL} already present`);
  }
  const pk = await req(`${DIRECTUS}/fields/${COLL}/id`, { headers: auth });
  fact('primary key type', pk.json?.data?.type ?? '?', `GET /fields/${COLL}/id`);

  sub('handshake');
  const ws = openWs('ws://localhost:8055/websocket');
  const opened = await ws.waitFor((e) => e.kind === 'open' || e.kind === 'error', 8000);
  fact('connect', opened ? opened.kind : 'TIMED OUT', `first handler to fire, at ${opened?.at}ms`);
  if (!opened || opened.kind !== 'open') {
    ws.close();
    return;
  }

  ws.send({ type: 'auth', access_token: token });
  const authReply = await ws.waitFor(msgWhere((m) => m.type === 'auth'), 6000);
  fact('auth reply', authReply ? json(authReply.detail) : 'TIMED OUT', 'send {type:auth, access_token}');

  ws.send({ type: 'subscribe', collection: COLL, uid: 'bcn008' });
  const init = await ws.waitFor(msgWhere((m) => m.type === 'subscription' && m.event === 'init'), 6000);
  fact('subscribe confirm', init ? json(init.detail, 200) : 'TIMED OUT', 'send {type:subscribe, collection, uid}');

  sub('event payloads');
  const created = await req(`${DIRECTUS}/items/${COLL}`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ title: 'probe row' })
  });
  const id = created.json?.data?.id;
  fact('row id (REST)', `${json(id)} (${typeof id})`, 'POST /items — the REST view of the key');

  const createFrame = await ws.waitFor(msgWhere((m) => m.type === 'subscription' && m.event === 'create'), 8000);
  fact('create frame', createFrame ? json(createFrame.detail, 300) : 'TIMED OUT');
  if (createFrame) fact('  create data[0] types', typesOf(createFrame.detail.data?.[0]));

  await req(`${DIRECTUS}/items/${COLL}/${id}`, {
    method: 'PATCH',
    headers: auth,
    body: JSON.stringify({ title: 'probe row, edited' })
  });
  const updateFrame = await ws.waitFor(msgWhere((m) => m.type === 'subscription' && m.event === 'update'), 8000);
  fact('update frame', updateFrame ? json(updateFrame.detail, 300) : 'TIMED OUT');
  if (updateFrame) fact('  update data[0] types', typesOf(updateFrame.detail.data?.[0]));

  await req(`${DIRECTUS}/items/${COLL}/${id}`, { method: 'DELETE', headers: auth });
  const deleteFrame = await ws.waitFor(msgWhere((m) => m.type === 'subscription' && m.event === 'delete'), 8000);
  fact('DELETE frame', deleteFrame ? json(deleteFrame.detail, 300) : 'TIMED OUT');
  if (deleteFrame) {
    fact('  delete data', typesOf(deleteFrame.detail.data), 'THE question — key type after a numeric-pk delete');
  }

  sub('keepalive');
  say('  waiting up to 45s for a server ping (WEBSOCKETS_HEARTBEAT_PERIOD default is 30s)…');
  const ping = await ws.waitFor(msgWhere((m) => m.type === 'ping'), 45000);
  fact('server ping', ping ? `${json(ping.detail)} at ${ping.at}ms` : 'none within 45s');
  if (ping) {
    ws.send({ type: 'pong' });
    fact('answered with', '{type:pong}');
  }
  ws.close();

  sub('the no-pong rule (a second socket, deliberately silent)');
  const mute = openWs('ws://localhost:8055/websocket');
  if (await mute.waitFor((e) => e.kind === 'open', 8000)) {
    mute.send({ type: 'auth', access_token: token });
    await mute.waitFor(msgWhere((m) => m.type === 'auth'), 5000);
    mute.send({ type: 'subscribe', collection: COLL, uid: 'bcn008-mute' });
    say('  ignoring every ping for up to 100s and watching for a server-side close…');
    const down = await mute.waitFor((e) => e.kind === 'close' || e.kind === 'error', 100000);
    const pings = mute.log.filter(msgWhere((m) => m.type === 'ping')).length;
    fact('pings ignored', String(pings));
    fact('server closed us', down ? `${down.kind} at ${down.at}ms — ${down.detail}` : 'NO, still open after 100s');
  }
  mute.close();

  sub('failure presentation');
  const bad = openWs('ws://localhost:8055/websocket');
  if (await bad.waitFor((e) => e.kind === 'open', 8000)) {
    bad.send({ type: 'auth', access_token: 'not-a-real-token' });
    await sleep(2500);
    fact('bad token', bad.log.filter((e) => e.kind !== 'sent').map((e) => `${e.kind}@${e.at}ms`).join(' → '));
    const authErr = bad.log.find(msgWhere((m) => m.type === 'auth' && m.status === 'error'));
    fact('  frame', authErr ? json(authErr.detail) : 'none');
  }
  bad.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// Supabase — the column the rig cannot answer. Establish that, loudly.
// ═══════════════════════════════════════════════════════════════════════════

async function supabase() {
  head('SUPABASE — the rig has PostgREST, not a Supabase stack');

  note('The `supabase` compose profile is one postgres + one postgrest container.');
  note('Supabase Realtime is a SEPARATE Elixir service (Phoenix channels) and is');
  note('not in docker-compose.yml at all. These probes establish that rather than');
  note('standing in for it.');

  sub('what the descriptor tells a probe to ask');
  const health = await req(`${POSTGREST}/realtime/v1/api/tenants/realtime/health`);
  fact('GET /realtime/v1/api/tenants/realtime/health', String(health.status), health.text.slice(0, 240));

  sub('the websocket endpoint a Supabase client would open');
  const ws = openWs('ws://localhost:8056/realtime/v1/websocket?apikey=anon&vsn=1.0.0');
  await sleep(4000);
  fact(
    'handler sequence',
    ws.log.map((e) => `${e.kind}@${e.at}ms${e.detail ? ` (${String(e.detail).slice(0, 80)})` : ''}`).join(' → ') || '(nothing fired in 4s)'
  );
  ws.close();

  sub('is anything listening on the usual Realtime port?');
  for (const port of [4000, 54321]) {
    const w = openWs(`ws://localhost:${port}/socket/websocket?vsn=1.0.0`);
    await sleep(2500);
    fact(`ws://localhost:${port}/socket/websocket`, w.log.map((e) => `${e.kind}@${e.at}ms`).join(' → ') || '(silent)');
    w.close();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PocketBase — SSE at /api/realtime. Never probed before.
// ═══════════════════════════════════════════════════════════════════════════

async function pocketbase() {
  head('POCKETBASE 0.30 — SSE at http://localhost:8091/api/realtime');

  const login = await req(`${POCKETBASE}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(POCKETBASE_ADMIN)
  });
  const token = login.json?.token;
  if (!token) {
    fact('REACHABLE', 'NO — superuser login failed', `${login.status} ${login.text.slice(0, 200)}`);
    return;
  }
  const admin = { Authorization: token, 'content-type': 'application/json' };

  const list = await req(`${POCKETBASE}/api/collections?perPage=200`, { headers: admin });
  const have = (list.json?.items || []).some((c) => c.name === COLL);
  if (!have) {
    const created = await req(`${POCKETBASE}/api/collections`, {
      method: 'POST',
      headers: admin,
      // Empty-string rules = public. Needed to ask whether an ANONYMOUS client
      // can subscribe at all, which is the question an app in a browser asks.
      body: JSON.stringify({
        name: COLL,
        type: 'base',
        fields: [
          { name: 'title', type: 'text' },
          { name: 'count', type: 'number' }
        ],
        listRule: '',
        viewRule: '',
        createRule: '',
        updateRule: '',
        deleteRule: ''
      })
    });
    fact('collection created', created.status === 200 ? 'yes' : `NO (${created.status})`, created.text.slice(0, 300));
  } else {
    note(`collection ${COLL} already present`);
  }

  sub('handshake — anonymous, no token anywhere');
  const sse = new SseStream(`${POCKETBASE}/api/realtime`);
  await sse.open();
  fact('GET /api/realtime', `${sse.status} ${sse.contentType}`);
  if (sse.notAStream !== undefined) {
    fact('  not a stream', sse.notAStream.slice(0, 300));
    return;
  }
  const connect = await sse.waitFor((f) => f.kind === 'event' && f.event === 'PB_CONNECT', 8000);
  fact('first frame', connect ? `event=${connect.event} data=${json(connect.data)}` : 'TIMED OUT');
  fact('  raw', connect ? JSON.stringify(connect.raw) : '—', 'the literal bytes, so the frame shape is on the record');
  const clientId = connect?.data?.clientId;

  const setSubs = await req(`${POCKETBASE}/api/realtime`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ clientId, subscriptions: [COLL] })
  });
  fact('POST /api/realtime {clientId, subscriptions}', String(setSubs.status), setSubs.text.slice(0, 200) || '(empty body)');

  sub('event payloads');
  const created = await req(`${POCKETBASE}/api/collections/${COLL}/records`, {
    method: 'POST',
    headers: admin,
    body: JSON.stringify({ title: 'probe row', count: 1 })
  });
  const id = created.json?.id;
  fact('row id (REST)', `${json(id)} (${typeof id})`);

  const createFrame = await sse.waitFor((f) => f.kind === 'event' && f.data?.action === 'create', 8000);
  fact('create frame', createFrame ? `event=${createFrame.event} data=${json(createFrame.data, 300)}` : 'TIMED OUT');
  if (createFrame) fact('  record types', typesOf(createFrame.data?.record));

  await req(`${POCKETBASE}/api/collections/${COLL}/records/${id}`, {
    method: 'PATCH',
    headers: admin,
    body: JSON.stringify({ title: 'probe row, edited' })
  });
  const updateFrame = await sse.waitFor((f) => f.kind === 'event' && f.data?.action === 'update', 8000);
  fact('update frame', updateFrame ? `event=${updateFrame.event} data=${json(updateFrame.data, 300)}` : 'TIMED OUT');

  await req(`${POCKETBASE}/api/collections/${COLL}/records/${id}`, { method: 'DELETE', headers: admin });
  const deleteFrame = await sse.waitFor((f) => f.kind === 'event' && f.data?.action === 'delete', 8000);
  fact('DELETE frame', deleteFrame ? `event=${deleteFrame.event} data=${json(deleteFrame.data, 400)}` : 'TIMED OUT');
  if (deleteFrame) {
    fact('  delete record types', typesOf(deleteFrame.data?.record), 'THE question — is the record whole, or just a key?');
  }

  sub('keepalive');
  say('  watching an idle stream for 130s (long enough to catch a 30s, 60s or 120s beat)…');
  const before = sse.frames.length;
  await sleep(130000);
  const after = sse.frames.slice(before);
  fact('frames while idle', String(after.length));
  for (const f of after) say(`      ${f.at}ms ${f.kind} ${f.event || ''} ${JSON.stringify(f.raw || f.detail || '').slice(0, 120)}`);
  sse.close();

  sub('failure presentation');
  const orphan = await req(`${POCKETBASE}/api/realtime`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ clientId: 'no-such-client', subscriptions: [COLL] })
  });
  fact('subscribe with an unknown clientId', String(orphan.status), orphan.text.slice(0, 240));

  const closed = new SseStream('http://localhost:8199/api/realtime');
  let failure = null;
  try {
    await closed.open();
  } catch (e) {
    failure = e;
  }
  fact('stream to a dead port', failure ? `${failure.constructor.name}: ${failure.message}` : `resolved with ${closed.status}`,
    'fetch rejects — there is no onerror/onclose distinction to get wrong on this path');

  sub('is a private collection subscribable anonymously?');
  const priv = `${COLL}_private`;
  const already = (await req(`${POCKETBASE}/api/collections?perPage=200`, { headers: admin })).json?.items || [];
  if (!already.some((c) => c.name === priv)) {
    await req(`${POCKETBASE}/api/collections`, {
      method: 'POST',
      headers: admin,
      // null rules = superuser only.
      body: JSON.stringify({ name: priv, type: 'base', fields: [{ name: 'title', type: 'text' }] })
    });
  }
  const s2 = new SseStream(`${POCKETBASE}/api/realtime`);
  await s2.open();
  const c2 = await s2.waitFor((f) => f.kind === 'event' && f.event === 'PB_CONNECT', 8000);
  const r2 = await req(`${POCKETBASE}/api/realtime`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ clientId: c2?.data?.clientId, subscriptions: [priv] })
  });
  fact('subscribe to a superuser-only collection, anonymously', String(r2.status), r2.text.slice(0, 240) || '(empty body)');

  // A 204 is not a yes. The same lesson BCN-001 learned from PocketBase's
  // aggregates: ask what actually ARRIVES, not what the status line says.
  const secret = await req(`${POCKETBASE}/api/collections/${priv}/records`, {
    method: 'POST',
    headers: admin,
    body: JSON.stringify({ title: 'should never be delivered' })
  });
  const leaked = await s2.waitFor((f) => f.kind === 'event' && f.event === priv, 6000);
  fact(
    '  …and does anything arrive?',
    leaked ? `LEAKED: ${json(leaked.data, 200)}` : 'no — accepted, then silent',
    `wrote a row (${secret.status}) and waited 6s`
  );
  s2.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// Parse LiveQuery — the `conditional` case. Its absence is SILENT, which is
// exactly why it gets probed rather than transcribed.
// ═══════════════════════════════════════════════════════════════════════════

async function parse() {
  head('PARSE SERVER 7.3.0 — LiveQuery at ws://localhost:8092/parse');

  const info = await req(`${PARSE}/parse/serverInfo`, {
    headers: { 'X-Parse-Application-Id': PARSE_APP_ID, 'X-Parse-Master-Key': PARSE_MASTER_KEY }
  });
  fact('GET /parse/serverInfo', String(info.status));
  fact('  parseServerVersion', String(info.json?.parseServerVersion));
  fact(
    '  liveQuery advertised?',
    'liveQueryServer' in (info.json || {}) || 'liveQuery' in (info.json?.features || {}) ? 'YES' : 'NO',
    `feature keys: ${Object.keys(info.json?.features || {}).join(', ')}`
  );
  note('The descriptor probe says "a liveQueryServer entry, or a reachable ws:// endpoint".');
  note('Half of that question is answered above; the other half is below.');

  sub('open the LiveQuery socket the Parse SDK would open');
  const t0 = Date.now();
  const ws = openWs('ws://localhost:8092/parse');
  const first = await ws.waitFor((e) => e.kind === 'open' || e.kind === 'error' || e.kind === 'close', 8000);
  fact('first handler', first ? `${first.kind} at ${first.at}ms — ${first.detail}` : 'NOTHING fired within 8s');
  if (first?.kind === 'open') {
    ws.send({ op: 'connect', applicationId: PARSE_APP_ID, masterKey: PARSE_MASTER_KEY });
    const reply = await ws.waitFor((e) => e.kind === 'message' || e.kind === 'close' || e.kind === 'error', 6000);
    fact('connect op reply', reply ? `${reply.kind}: ${json(reply.detail)}` : 'SILENCE — the exact failure mode the trap describes');
  }
  await sleep(1500);
  fact('full sequence', ws.log.map((e) => `${e.kind}@${e.at}ms`).join(' → ') || '(nothing at all)');
  fact(
    'time to a definite answer',
    first ? `${first.at}ms` : '>8000ms and still nothing',
    'how long a probe must budget before calling it unsupported'
  );
  ws.close();

  sub('the root path, and the LiveQuery-on-its-own-port case');
  const root = openWs('ws://localhost:8092/');
  await sleep(3000);
  fact('ws://localhost:8092/', root.log.map((e) => `${e.kind}@${e.at}ms — ${String(e.detail).slice(0, 60)}`).join(' → ') || '(silent)');
  root.close();

  // `fetch` refuses to send Connection/Upgrade (they are forbidden header names),
  // so this goes out over a raw socket. Reported either way — the point is what
  // the server answers a handshake, and "the HTTP client would not even ask" is
  // itself worth knowing.
  const raw = await rawUpgrade('localhost', 8092, '/parse');
  fact('raw GET /parse with Upgrade headers', raw.split('\r\n')[0] || '(no status line)', JSON.stringify(raw.slice(0, 200)));
}

// ═══════════════════════════════════════════════════════════════════════════
// NodeGX — our own backend. SSE via BAK-001's ChangeBus.
// ═══════════════════════════════════════════════════════════════════════════

async function nodegx() {
  head('NODEGX BACKEND — SSE at http://localhost:8593/realtime');

  const health = await req(`${NODEGX}/health`);
  if (health.status !== 200) {
    fact('REACHABLE', 'NO', `${health.status} — start it: node bin/nodegx-backend.js serve --port 8593`);
    return;
  }
  fact('security posture', json(health.json?.security), 'dev-open relaxes the CLP gate on subscription');

  sub('the discovery answer for a client that forgets the Accept header');
  const plain = await req(`${NODEGX}/realtime`);
  fact('GET /realtime (no Accept)', String(plain.status), plain.text.slice(0, 300));

  sub('handshake');
  const sse = new SseStream(`${NODEGX}/realtime`);
  await sse.open();
  fact('GET /realtime (SSE)', `${sse.status} ${sse.contentType}`);
  const connected = await sse.waitFor(evt('connected'), 8000);
  fact('first frame', connected ? `event=${connected.event} data=${json(connected.data)}` : 'TIMED OUT');
  fact('  raw', connected ? JSON.stringify(connected.raw) : '—');
  const clientId = connected?.data?.clientId;

  const coll = 'Bcn008Items';
  const subs = await req(`${NODEGX}/realtime/subscriptions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ clientId, subscriptions: [{ collection: coll }] })
  });
  fact('POST /realtime/subscriptions', String(subs.status), subs.text.slice(0, 240));

  sub('event payloads');
  const created = await req(`${NODEGX}/classes/${coll}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'probe row', count: 1 })
  });
  const id = created.json?.objectId;
  fact('row id (REST)', `${json(id)} (${typeof id})`);

  const createFrame = await sse.waitFor((f) => f.kind === 'event' && f.data?.action === 'create', 8000);
  fact('create frame', createFrame ? `event=${createFrame.event} data=${json(createFrame.data, 300)}` : 'TIMED OUT');

  await req(`${NODEGX}/classes/${coll}/${id}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'probe row, edited' })
  });
  const updateFrame = await sse.waitFor((f) => f.kind === 'event' && f.data?.action === 'update', 8000);
  fact('update frame', updateFrame ? `event=${updateFrame.event} data=${json(updateFrame.data, 300)}` : 'TIMED OUT');

  await req(`${NODEGX}/classes/${coll}/${id}`, { method: 'DELETE' });
  const deleteFrame = await sse.waitFor((f) => f.kind === 'event' && f.data?.action === 'delete', 8000);
  fact('DELETE frame', deleteFrame ? `event=${deleteFrame.event} data=${json(deleteFrame.data, 400)}` : 'TIMED OUT');
  if (deleteFrame) fact('  delete record types', typesOf(deleteFrame.data?.record), 'THE question');

  sub('keepalive');
  say('  watching an idle stream for 30s (DEFAULT_HEARTBEAT_MS is 25000)…');
  const before = sse.frames.length;
  await sleep(30000);
  const after = sse.frames.slice(before);
  fact('frames while idle', String(after.length));
  for (const f of after) say(`      ${f.at}ms ${f.kind} ${JSON.stringify(f.raw).slice(0, 120)}`);
  sse.close();

  sub('reconnect semantics');
  const again = new SseStream(`${NODEGX}/realtime`, { headers: { 'Last-Event-ID': '7' } });
  await again.open();
  const c2 = await again.waitFor(evt('connected'), 8000);
  const r2 = await again.waitFor(evt('resync'), 4000);
  fact('reconnect with Last-Event-ID', c2 ? `connected → ${r2 ? 'resync ' + json(r2.data) : 'NO resync'}` : 'TIMED OUT');
  fact('  new clientId?', c2?.data?.clientId && c2.data.clientId !== clientId ? 'yes, a fresh one' : 'same as before');
  again.close();

  sub('failure presentation');
  const orphan = await req(`${NODEGX}/realtime/subscriptions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ clientId: 'no-such-client', subscriptions: [{ collection: coll }] })
  });
  fact('subscribe with an unknown clientId', String(orphan.status), orphan.text.slice(0, 200));

  const badFilter = new SseStream(`${NODEGX}/realtime`);
  await badFilter.open();
  const c3 = await badFilter.waitFor(evt('connected'), 8000);
  const rejected = await req(`${NODEGX}/realtime/subscriptions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      clientId: c3?.data?.clientId,
      subscriptions: [{ collection: coll, filter: { title: { $nonsense: 1 } } }]
    })
  });
  fact('subscribe with an unsupported filter', String(rejected.status), rejected.text.slice(0, 300));
  badFilter.close();

  const dead = new SseStream('http://localhost:8199/realtime');
  let failure = null;
  try {
    await dead.open();
  } catch (e) {
    failure = e;
  }
  fact('stream to a dead port', failure ? `${failure.constructor.name}: ${failure.message}` : `resolved with ${dead.status}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// The undici trap, generalised — which handler fires for which failure.
// ═══════════════════════════════════════════════════════════════════════════

async function trap() {
  head('THE onclose TRAP — which WebSocket handler fires, per failure mode');

  note('RUN-003 found that Node\'s undici WebSocket fires only `error`, never');
  note('`close`, when a connect fails before establishing. Reconnect logic on');
  note('`onclose` alone dead-ends. Three distinct failure modes, measured:');

  const cases = [
    ['nothing listening', 'ws://localhost:8199/websocket', 8199, '/websocket'],
    ['listening, but not a WebSocket server', 'ws://localhost:8056/realtime/v1/websocket', 8056, '/realtime/v1/websocket'],
    ['a real WS server, wrong path', 'ws://localhost:8055/not-the-websocket-path', 8055, '/not-the-websocket-path'],
    ['unresolvable host', 'ws://no-such-host.invalid/websocket', null, null]
  ];

  const WAIT = 20000;
  for (const [label, url, port, path] of cases) {
    const ws = openWs(url);
    await sleep(WAIT);
    fact(label, ws.log.map((e) => `${e.kind}@${e.at}ms`).join(' → ') || `(NOTHING fired in ${WAIT / 1000}s)`, url);
    const kinds = new Set(ws.log.map((e) => e.kind));
    fact('  → close fired?', kinds.has('close') ? 'yes' : 'NO', kinds.has('error') ? 'error did' : 'and nor did error');
    if (!kinds.has('error') && !kinds.has('close') && port) {
      const raw = await rawUpgrade('localhost', port, path, 6000);
      fact('  → what the server actually answered', raw.split('\r\n')[0] || '(nothing)', JSON.stringify(raw.slice(0, 160)));
    }
    ws.close();
  }

  sub('a socket that opens and is then killed by the server (a restart)');
  note('Not simulated here — BCN-008 proper restarts the container. What this');
  note('section establishes is only the PRE-establishment asymmetry above.');
}

// ═══════════════════════════════════════════════════════════════════════════

const SECTIONS = { directus, supabase, pocketbase, parse, nodegx, trap };

async function main() {
  const asked = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const run = asked.length ? asked : Object.keys(SECTIONS);

  say('BCN-008 realtime probe — ' + new Date().toISOString());
  say('node ' + process.version + ` · global EventSource: ${typeof EventSource} · global WebSocket: ${typeof WebSocket}`);

  for (const name of run) {
    const fn = SECTIONS[name];
    if (!fn) {
      say(`(no section named ${name})`);
      continue;
    }
    try {
      await fn();
    } catch (e) {
      say('');
      say(`  !! ${name} threw: ${e && e.stack ? e.stack.split('\n').slice(0, 4).join('\n     ') : e}`);
    }
  }

  head('DONE');
  process.exit(0);
}

main();
