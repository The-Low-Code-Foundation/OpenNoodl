/**
 * BCN-007 step 6 — the live pass, **through the nodes**.
 *
 * The spec's live pass, verbatim: *"upload a real image, read it back through a
 * rendered `Image` node in a running app, sign a URL where supported and confirm
 * it expires, delete, and confirm the read fails afterwards."*
 *
 * Four of those five are here, driven through **Upload File**, **Cloud File**
 * and **Sign File URL** — real node instances in a real `NodeContext`, inputs
 * set through `registerInputIfNeeded`, outputs read off real ports. The fifth
 * (`Image` node, rendered) genuinely needs a React tree and is called out
 * honestly in the notes rather than claimed here; what this does instead is
 * fetch the URL a `Cloud File` node published **exactly as an `<img src>`
 * would** — one GET, no `Authorization` header — and compare the bytes. That is
 * the half of "render it" that can actually fail.
 *
 * Copied from `bcn-004-node-driver.ts` rather than rebuilt, per its own
 * instruction: the XHR shim's `catch`-must-not-span-the-dispatch fix, the
 * `_initCloudServices()` re-read and the editor-connection stub are all things
 * that cost that task real time to find.
 *
 * ## What can fail here that a unit test cannot
 *
 * 1. **A `FormData` that `JSON.stringify` ate.** Every one of these backends
 *    answers 200 for a body of `{}` and stores four bytes. The bytes are
 *    compared, every time.
 * 2. **A URL that is right and unusable.** Directus `/assets/{id}` is a 403 to
 *    an `<img>`. Only an unauthenticated GET finds that.
 * 3. **An expiry that is decorative.** A signed URL that "expires" while the
 *    file was never gated still serves. Both halves are checked.
 * 4. **A delete that reports success from a different code path.** Every delete
 *    is followed by a read.
 *
 * ## Running it
 *
 *   docker compose --profile supabase --profile parse up -d
 *   node packages/nodegx-backend/bin/nodegx-backend.js serve --port 8110 --data-dir <dir>
 *   node bcn-007-file-driver.build.mjs && node bcn-007-file-driver.cjs
 *
 * ⚠️ Do not pipe this into `head` — it closes the pipe, SIGPIPEs node, and the
 * run dies partway through looking like the server stopped answering.
 *
 * ⚠️ Every fixture is namespaced `bcn007_`; the rig is shared.
 */

import * as http from 'node:http';

import NodeContext = require('../../../../packages/noodl-runtime/src/nodecontext');
import NodeDefinition = require('../../../../packages/noodl-runtime/src/nodedefinition');
import CloudStore = require('../../../../packages/noodl-runtime/src/api/cloudstore');

import CloudFileModule = require('../../../../packages/noodl-runtime/src/nodes/std-library/data/cloudfilenode');
import SignFileUrlModule = require('../../../../packages/noodl-runtime/src/nodes/std-library/data/signfileurl');
import UploadFileModule from '../../../../packages/noodl-viewer-react/src/nodes/std-library/uploadfile';

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-var-requires */
type Any = any;

const DIRECTUS = 'http://localhost:8055';
const POCKETBASE = 'http://localhost:8091';
const NODEGX = 'http://127.0.0.1:8110';
/** ⚠️ Storage is a SEPARATE service from PostgREST. See docker-compose.yml. */
const SUPABASE_STORAGE = 'http://localhost:8112';
/**
 * Where the proxy that mounts the raw storage-api under `/storage/v1/` listens.
 *
 * ⚠️ Same shape as BCN-004's PostgREST proxy and for the same reason. The
 * container serves `/object/…` at its root; a real Supabase project sits behind
 * Kong, which routes `/storage/v1/*` to it after stripping the prefix. The
 * shipped adapter builds the **project-origin** path, which is the one a user's
 * app has — so the rig is adjusted to look like production rather than the
 * profile being bent to look like the rig.
 */
const STORAGE_PROXY_PORT = 8157;
const SUPABASE_VIA_PROXY = `http://localhost:${STORAGE_PROXY_PORT}`;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const NODEGX_MASTER_KEY = process.env.NODEGX_MASTER_KEY || '';

const NS = 'bcn007';

/** A 1×1 transparent PNG. Real image bytes, so a content sniffer has something. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

let pass = 0;
let fail = 0;
const failures: string[] = [];

const say = (line = '') => console.log(line);
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
const note = (line: string) => say(`  NOTE  ${line}`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function req(url: string, init: Any = {}) {
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

/**
 * Fetch a URL **the way an `<img src>` does**: one GET, no headers of any kind.
 *
 * This is the half of "render it through an Image node" that can actually fail,
 * and it is the check that catches Directus's 403 on a URL that looks perfect.
 */
async function fetchAsImage(url: string): Promise<{ status: number; type: string | null; bytes: Buffer }> {
  const res = await fetch(url);
  const buf = Buffer.from(await res.arrayBuffer());
  return { status: res.status, type: res.headers.get('content-type'), bytes: buf };
}

// ---------------------------------------------------------------------------
// The runtime + browser shims the nodes run against (BCN-004 step 6's, verbatim)
// ---------------------------------------------------------------------------

let metadata: Record<string, Any> = {};

function installRuntime() {
  const NoodlRuntime = require('../../../../packages/noodl-runtime/noodl-runtime');
  NoodlRuntime.instance = {
    getMetaData: (key: string) => metadata[key],
    getProjectSettings: () => ({})
  };
}

function installBrowserGlobals() {
  const g = globalThis as Any;

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
        // ⚠️ BCN-004 step 6: the `catch` MUST NOT span the
        // `onreadystatechange` dispatch, or an exception thrown by the
        // adapter's own success callback is re-reported as a transport failure
        // and every successful write also takes the error path. That looked
        // exactly like a product defect and was an instrument defect.
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

  // `Upload File` hands `CloudStore.uploadFile` whatever is on its File input,
  // and `ParseWireAdapter._makeRequest` branches on `options.content instanceof
  // File`. Node has `File` since 20, so this is only a guard.
  if (!g.File) g.File = class extends Blob {};
}

function setMetadata(next: Record<string, Any>) {
  metadata = next;
  CloudStore.invalidateBackends();
  CloudStore.invalidateCollections();
  // ⚠️ BCN-004 step 6: the legacy singleton caches the endpoint at construction.
  (CloudStore.instance as Any)._initCloudServices();
}

// ---------------------------------------------------------------------------
// Driving real nodes
// ---------------------------------------------------------------------------

let context: Any;
let nextId = 0;

function makeContext() {
  const ctx: Any = new NodeContext();
  for (const mod of [UploadFileModule, CloudFileModule, SignFileUrlModule]) {
    ctx.nodeRegister.register(NodeDefinition.defineNode((mod as Any).node));
  }
  ctx.editorConnection = {
    isRunningLocally: () => true,
    isConnected: () => false,
    sendDynamicPorts: () => {},
    sendWarning: (_c: Any, _n: Any, key: string, detail: Any) =>
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

/**
 * A real `File`, which is what an Open File Picker node produces.
 *
 * ⚠️ **It must be a `File`, not a `Blob` with a `name` on it.** The first run of
 * this driver used the latter and nodegx stored **28 bytes of
 * `application/json`** while reporting a 200 — because
 * `ParseWireAdapter._makeRequest` branches on `options.content instanceof File`
 * and JSON-stringifies anything else. An instrument defect here, and a real
 * hazard there: a `Blob` is what `canvas.toBlob()`, `fetch().blob()` and most
 * client-side image processing produce, and every one of them would be silently
 * uploaded as `{}` with a success signal. Recorded in the notes; not fixed here,
 * because it is `ParseWireAdapter`'s and BCN-002's.
 */
function pngFile(name: string): Any {
  return new File([PNG], name, { type: 'image/png' });
}

// ---------------------------------------------------------------------------
// Backends
// ---------------------------------------------------------------------------

interface Shape {
  label: string;
  id: string;
  type: string;
  url: string;
  token?: string;
  sessionToken?: string;
  /** File Location inputs to set on the Upload File node, if any. */
  location?: Record<string, string>;
  /** Does `signFileUrl` work here at all? `parse`'s cell is `unsupported`. */
  canSign: boolean;
  /** What `URL Kind` must read. Measured per backend, not assumed. */
  expectKind?: 'signed' | 'token' | 'public';
  /** Is the stored file readable by an anonymous `<img>`? */
  expectPubliclyReadable: boolean;
}

function metadataFor(shape: Shape) {
  return {
    backendServices: {
      version: 2,
      activeBackendId: shape.id,
      backends: [
        {
          id: shape.id,
          name: shape.label,
          type: shape.type,
          url: shape.url,
          auth: { publicToken: shape.token, sessionToken: shape.sessionToken },
          schema: { collections: [] }
        }
      ]
    }
  };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

async function directusToken(): Promise<string | undefined> {
  const login = await req(`${DIRECTUS}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', password: 'directus-admin-pw' })
  });
  return login.json?.data?.access_token;
}

async function pocketbaseToken(): Promise<string | undefined> {
  const login = await req(`${POCKETBASE}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: 'admin@example.com', password: 'pocketbase-admin-pw' })
  });
  return login.json?.token;
}

async function seedPocketBaseCollection(token: string) {
  await req(`${POCKETBASE}/api/collections/${NS}_files`, { method: 'DELETE', headers: { Authorization: token } });
  const res = await req(`${POCKETBASE}/api/collections`, {
    method: 'POST',
    headers: { Authorization: token, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: `${NS}_files`,
      type: 'base',
      fields: [
        { name: 'title', type: 'text' },
        { name: 'attachment', type: 'file', maxSelect: 1, protected: false }
      ],
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: ''
    })
  });
  if (res.status >= 400) say(`  !! PocketBase collection create ${res.status}: ${res.text.slice(0, 200)}`);
}

async function seedSupabaseBucket() {
  const H = { Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, apikey: SUPABASE_SERVICE_KEY, 'Content-Type': 'application/json' };
  // Public, so the "read it back as an <img>" check has something to read.
  await req(`${SUPABASE_STORAGE}/bucket`, {
    method: 'POST',
    headers: H,
    body: JSON.stringify({ name: `${NS}-driver`, id: `${NS}-driver`, public: true })
  });
}

/** A signed-in nodegx user, so a private upload actually has an owner. */
async function nodegxUser(): Promise<string | undefined> {
  const username = `${NS}_drv_${Date.now().toString(36)}`;
  const res = await req(`${NODEGX}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: 'pw-bcn007', email: `${username}@example.com` })
  });
  return res.json?.sessionToken;
}

/** Mount the rig's raw storage-api under `/storage/v1/`, as Kong does in production. */
function startStorageProxy(): Promise<http.Server> {
  const server = http.createServer((clientReq, clientRes) => {
    const path = (clientReq.url || '').replace(/^\/storage\/v1/, '') || '/';
    const upstream = http.request(
      { host: 'localhost', port: 8112, method: clientReq.method, path, headers: clientReq.headers },
      (upstreamRes) => {
        clientRes.writeHead(upstreamRes.statusCode || 500, upstreamRes.headers);
        upstreamRes.pipe(clientRes);
      }
    );
    upstream.on('error', () => {
      clientRes.writeHead(502);
      clientRes.end();
    });
    clientReq.pipe(upstream);
  });
  return new Promise((resolve) => server.listen(STORAGE_PROXY_PORT, () => resolve(server)));
}

// ---------------------------------------------------------------------------
// The pass, per backend
// ---------------------------------------------------------------------------

async function runBackend(shape: Shape) {
  head(`${shape.label} — upload → read as an <img> → sign → delete → read again`);

  setMetadata(metadataFor(shape));
  context = makeContext();

  // ── 1. Upload, through the Upload File node ──────────────────────────
  const uploader = createNode('Upload File');
  // ⚠️ The Backend picker. BCN-007 step 6's first run failed on all four
  // backends at once because these nodes called `CloudStore.instance` — the
  // singleton that always resolves the legacy `cloudservices` endpoint — so
  // nothing a graph could do would reach a Directus or PocketBase backend.
  setInput(uploader.node, 'backendId', shape.id);
  setInput(uploader.node, 'file', pngFile(`${NS}-driver.png`));
  for (const [port, value] of Object.entries(shape.location || {})) {
    setInput(uploader.node, port, value);
  }
  pulse(uploader.node, 'upload');

  const uploadSignal = await waitFor(uploader, ['success', 'failure']);
  check(`${shape.label}: Upload File fires Success`, uploadSignal, 'success');
  if (uploadSignal !== 'success') {
    say(`          error port: ${JSON.stringify(output(uploader.node, 'error'))}`);
    say(`          status:     ${JSON.stringify(output(uploader.node, 'errorStatus'))}`);
    return;
  }

  const cloudFile: Any = output(uploader.node, 'cloudFile');
  checkThat(`${shape.label}: Cloud File output is a file object`, !!cloudFile && typeof cloudFile.getUrl === 'function');

  // ── 2. Read it back through the Cloud File node ──────────────────────
  const reader = createNode('Cloud File');
  setInput(reader.node, 'file', cloudFile);
  tick(reader.node);

  const url = String(output(reader.node, 'url') || '');
  checkThat(`${shape.label}: Cloud File publishes a URL`, /^https?:\/\//.test(url), url);
  say(`  ....  url: ${url}`);
  say(`  ....  name: ${JSON.stringify(output(reader.node, 'name'))}`);
  say(`  ....  contentType: ${JSON.stringify(output(reader.node, 'contentType'))}`);
  say(`  ....  size: ${JSON.stringify(output(reader.node, 'size'))}`);

  // ⚠️ THE check. An `<img src>` sends no Authorization header, and this is
  // where a URL that looks perfect turns out to be a 403.
  const asImage = await fetchAsImage(url);
  check(
    `${shape.label}: the Cloud File URL serves to an anonymous <img> (expected ${shape.expectPubliclyReadable})`,
    asImage.status === 200,
    shape.expectPubliclyReadable
  );
  if (asImage.status === 200) {
    check(`${shape.label}: …and the bytes are the PNG that was uploaded`, asImage.bytes.equals(PNG), true);
    check(`${shape.label}: …served as image/png, so an <img> will actually render it`, asImage.type, 'image/png');
  } else {
    note(`${shape.label}: unauthenticated GET answered ${asImage.status} — this URL is not an <img src>`);
  }

  // ── 3. Sign, and check the distinction is visible ────────────────────
  const signer = createNode('Sign File URL');
  setInput(signer.node, 'backendId', shape.id);
  setInput(signer.node, 'file', cloudFile);
  pulse(signer.node, 'sign');
  const signSignal = await waitFor(signer, ['success', 'failure']);

  if (!shape.canSign) {
    check(`${shape.label}: Sign File URL refuses, with a reason`, signSignal, 'failure');
    say(`          reason: ${JSON.stringify(output(signer.node, 'error'))}`);
    checkThat(
      `${shape.label}: …and the reason is a sentence, not an empty string`,
      String(output(signer.node, 'error') || '').length > 10
    );
  } else {
    check(`${shape.label}: Sign File URL fires Success`, signSignal, 'success');
    if (signSignal !== 'success') {
      say(`          error port: ${JSON.stringify(output(signer.node, 'error'))}`);
    } else {
      const kind = output(signer.node, 'urlKind');
      const shareable = output(signer.node, 'isShareable');
      const signedUrl = String(output(signer.node, 'url') || '');
      say(`  ....  signed url:  ${signedUrl}`);
      say(`  ....  expiresAt:   ${JSON.stringify(output(signer.node, 'expiresAt'))}`);
      say(`  ....  ttlSeconds:  ${JSON.stringify(output(signer.node, 'ttlSeconds'))}`);

      // Step 4's whole claim: an author can tell the two apart from the ports.
      check(`${shape.label}: URL Kind reads what this backend actually mints`, kind, shape.expectKind);
      check(`${shape.label}: Safe To Share agrees with URL Kind`, shareable, shape.expectKind !== 'token');

      const signedFetch = await fetchAsImage(signedUrl);
      check(`${shape.label}: the signed/token URL serves with no session at all`, signedFetch.status, 200);
      if (signedFetch.status === 200) {
        check(`${shape.label}: …and its bytes are the PNG too`, signedFetch.bytes.equals(PNG), true);
      }
    }
  }

  // ── 4. Delete, and confirm the read then fails ───────────────────────
  //
  // The nodes have no Delete File; `CloudStore.deleteFile` is the contract
  // method and is what a cloud function calls. Driven directly, but through
  // the SAME routed store the nodes just used, and with the target the upload
  // returned — which is the thing that had to survive the round trip.
  const deleted = await new Promise<{ ok: boolean; detail: unknown }>((resolve) => {
    CloudStore.forBackend(undefined, shape.id).deleteFile({
      file: { name: cloudFile.getName() },
      target: cloudFile.getTarget(),
      success: (response: Any) => resolve({ ok: true, detail: response }),
      error: (e: Any) => resolve({ ok: false, detail: e })
    });
  });
  check(`${shape.label}: deleteFile reports success`, deleted.ok, true);
  if (!deleted.ok) say(`          error: ${JSON.stringify(deleted.detail)}`);

  const afterDelete = await fetchAsImage(url);
  checkThat(
    `${shape.label}: ⚠️ the file no longer serves after the delete`,
    afterDelete.status !== 200,
    `status ${afterDelete.status}`
  );
  say(`  ....  read after delete: ${afterDelete.status}`);
}

/** nodegx's expiry: the one backend where a ttl short enough to wait for is configurable. */
async function nodegxExpiry(shape: Shape) {
  head('nodegx-backend — a signed URL that really expires, watched');

  setMetadata(metadataFor(shape));
  context = makeContext();

  const uploader = createNode('Upload File');
  setInput(uploader.node, 'backendId', shape.id);
  setInput(uploader.node, 'file', pngFile(`${NS}-expiry.png`));
  setInput(uploader.node, 'private', true);
  pulse(uploader.node, 'upload');
  const sig = await waitFor(uploader, ['success', 'failure']);
  check('nodegx: a PRIVATE upload succeeds through the node', sig, 'success');
  if (sig !== 'success') {
    say(`          error: ${JSON.stringify(output(uploader.node, 'error'))}`);
    return;
  }

  const cloudFile: Any = output(uploader.node, 'cloudFile');
  const plain = await fetchAsImage(cloudFile.getUrl());
  checkThat('nodegx: ⚠️ the plain URL of a private file is refused anonymously', plain.status !== 200, `status ${plain.status}`);

  const signer = createNode('Sign File URL');
  setInput(signer.node, 'backendId', shape.id);
  setInput(signer.node, 'file', cloudFile);
  pulse(signer.node, 'sign');
  const signSig = await waitFor(signer, ['success', 'failure']);
  check('nodegx: Sign File URL succeeds', signSig, 'success');
  if (signSig !== 'success') return;

  check('nodegx: URL Kind reads "signed"', output(signer.node, 'urlKind'), 'signed');
  check('nodegx: Safe To Share reads true for a real signature', output(signer.node, 'isShareable'), true);
  const ttl = Number(output(signer.node, 'ttlSeconds'));
  say(`  ....  ttlSeconds: ${ttl}`);

  const signedUrl = String(output(signer.node, 'url'));
  check('nodegx: the signed URL serves anonymously right now', (await fetchAsImage(signedUrl)).status, 200);

  if (ttl > 0 && ttl <= 30) {
    say(`  ....  waiting ${ttl + 2}s for the signature to expire…`);
    await sleep((ttl + 2) * 1000);
    const expired = await fetchAsImage(signedUrl);
    checkThat('nodegx: ⚠️ THE SIGNED URL STOPS SERVING once its TTL passes', expired.status !== 200, `status ${expired.status}`);
  } else {
    note(`nodegx: ttl is ${ttl}s — too long to wait out. Set signedUrlTtlSeconds low in the data dir's files.json`);
  }

  // Clean up through the routed store.
  await new Promise((resolve) => {
    CloudStore.forBackend(undefined, shape.id).deleteFile({
      file: { name: cloudFile.getName() },
      success: resolve,
      error: resolve
    });
  });
}

// ---------------------------------------------------------------------------

async function main() {
  installRuntime();
  installBrowserGlobals();
  const storageProxy = await startStorageProxy();

  say('=== BCN-007 step 6 — the live pass, through Upload File / Cloud File / Sign File URL ===');

  const shapes: Shape[] = [];

  // ── nodegx ─────────────────────────────────────────────────────────
  const session = await nodegxUser();
  if (!session) {
    say('  !! could not create a nodegx user — is the backend on 8110?');
  } else {
    shapes.push({
      label: 'nodegx',
      id: 'b_nodegx',
      type: 'nodegx',
      url: NODEGX,
      token: 'app',
      sessionToken: session,
      canSign: true,
      expectKind: 'signed',
      // Public by default: no Private input set, so the plain URL works.
      expectPubliclyReadable: true
    });
  }

  // ── Directus ───────────────────────────────────────────────────────
  const dToken = await directusToken();
  if (!dToken) say('  !! Directus login failed');
  else
    shapes.push({
      label: 'directus',
      id: 'b_directus',
      type: 'directus',
      url: DIRECTUS,
      token: dToken,
      canSign: true,
      expectKind: 'token',
      // ⚠️ measured 403 — the whole reason `signFileUrl` exists on this backend.
      expectPubliclyReadable: false
    });

  // ── PocketBase ─────────────────────────────────────────────────────
  const pToken = await pocketbaseToken();
  if (!pToken) say('  !! PocketBase login failed');
  else {
    await seedPocketBaseCollection(pToken);
    shapes.push({
      label: 'pocketbase',
      id: 'b_pocketbase',
      type: 'pocketbase',
      url: POCKETBASE,
      token: pToken,
      location: { collection: `${NS}_files`, field: 'attachment' },
      canSign: true,
      expectKind: 'token',
      // An unprotected field on a publicly-viewable collection.
      expectPubliclyReadable: true
    });
  }

  // ── Supabase Storage ───────────────────────────────────────────────
  if (!SUPABASE_SERVICE_KEY) say('  !! SUPABASE_SERVICE_KEY not set — skipping Supabase');
  else {
    await seedSupabaseBucket();
    shapes.push({
      label: 'supabase',
      id: 'b_supabase',
      type: 'supabase',
      // ⚠️ The STORAGE origin, not PostgREST's. In a real project they are one,
      // behind a gateway that mounts Storage at `/storage/v1` — which is what
      // the proxy reproduces and what the shipped adapter builds.
      url: SUPABASE_VIA_PROXY,
      token: SUPABASE_SERVICE_KEY,
      location: { bucket: `${NS}-driver`, path: `driver/${NS}.png` },
      canSign: true,
      expectKind: 'signed',
      expectPubliclyReadable: true
    });
  }

  for (const shape of shapes) await runBackend(shape);

  const nodegx = shapes.find((s) => s.label === 'nodegx');
  if (nodegx) await nodegxExpiry(nodegx);

  storageProxy.close();

  head('Result');
  say(`  ${pass} passed, ${fail} failed`);
  for (const f of failures) say(`    FAILED: ${f}`);
  process.exitCode = fail > 0 ? 1 : 0;
}

main().catch((e) => {
  console.error('DRIVER ABORTED', e);
  process.exitCode = 2;
});
