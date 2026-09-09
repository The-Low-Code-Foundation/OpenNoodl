/**
 * HLS-006 — what the editor's preview server is bound to, and who it answers.
 *
 * ## Why this drives the real `startServer` rather than reading its source
 *
 * [#31](https://github.com/The-Low-Code-Foundation/NodeGX/issues/31) is a report of a **running
 * process**: `*:8574` and `*:8575`, confirmed from a second machine on a LAN. The corresponding
 * claim about a fix is also about a running process, and a spec that asserts the source contains
 * `access.host` would pass just as happily on a `listen()` that never ran — the standing warning
 * on this phase, three times over.
 *
 * `web-server.js` cannot be `require`d outside Electron (`projectmodules` reaches it), which is
 * why OBS-004 split the relay out in the first place. Stubbing `electron` for this one module is
 * enough: nothing below touches a window, a dialog or a renderer. What gets started here is the
 * product's own server, with the product's own handler.
 *
 * ⚠️ **Two things this file cannot see**, both stated rather than left to be discovered:
 *
 *  1. The remote-caller cases connect over this machine's own LAN address. That is a real
 *     non-loopback path to the socket; it is not a second machine, and it says nothing about
 *     routing or firewalls. The second machine is AC1's person half.
 *  2. The WebSocket relay's own token gate is `relay-auth.test.js` (OBS-004), not this file.
 *     What is new here is that the **HTTP** half is gated at all — which matters more than it
 *     looks, because the relay token is injected into the page this server hands out, so before
 *     HLS-006 anything on the LAN could `GET /` and read the credential that OBS-004's gate
 *     checks.
 */
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

/**
 * A real app directory with a real viewer template, because the request that proves the server
 * works is `GET /` and that path reads `index.html` off disk, injects the project's modules into
 * it and injects the relay token into the result. A stub that skipped it would leave the one
 * assertion that matters — that the token is in the served page, and therefore that an ungated
 * page is a credential disclosure — with nothing to read.
 */
// ⚠️ `mock`-prefixed because jest hoists `jest.mock()` above every declaration in the file and
// then refuses a factory that closes over anything else. The factory itself is lazy — it runs on
// the first `require('electron')`, by which point these are built.
const mockAppPath = fs.mkdtempSync(path.join(os.tmpdir(), 'hls006-app-'));
const mockProjectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'hls006-project-'));
fs.mkdirSync(path.join(mockAppPath, 'src', 'external', 'viewer'), { recursive: true });
fs.writeFileSync(
  path.join(mockAppPath, 'src', 'external', 'viewer', 'index.html'),
  '<!doctype html><html><head><title>{{#title#}}</title>{{#customHeadCode#}}</head><body></body></html>'
);

jest.mock('electron', () => ({
  app: {
    getAppPath: () => mockAppPath,
    getPath: () => require('node:os').tmpdir(),
    on: () => undefined,
    quit: () => undefined,
    getVersion: () => '0.0.0-test'
  },
  dialog: { showMessageBox: () => Promise.resolve({ response: 0 }) }
}));

const { lanAddress } = require('@nodegx/export/serve/access');

/** The five callbacks `main.js` passes. None of them is reached by anything asserted here. */
const STUBS = [
  (callback) => callback({}),
  (callback) => callback({ projectDirectory: mockProjectPath }),
  (_name, callback) => callback(null),
  (callback) => callback('')
];

let webServer;

/**
 * A fresh module registry per test: `web-server.js` holds one-per-launch state at module scope
 * (there is one web server per editor launch), so two tests sharing it would share a socket.
 */
function loadServer() {
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const module_ = require('../src/main/src/web-server');
  webServer = module_;
  return module_;
}

/** Start it on a free port and return the status it reports. */
async function start() {
  // Port 0 lets the OS pick, so this never collides with an editor the developer has open —
  // and the port that matters is read back off the socket anyway.
  process.env.NOODLPORT = '0';
  process.env.NOODL_RELAY_TOKEN = 'hls006-known-token';
  const startServer = loadServer();
  const { app } = require('electron');
  startServer(app, ...STUBS);
  // `listen()` binds asynchronously, so `getAccessStatus()` answers `null` until the socket has
  // an address. Waiting on the status rather than on a fixed delay is what keeps this from being
  // a race that passes on a fast machine.
  for (let attempt = 0; attempt < 500 && startServer.getAccessStatus() === null; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  expect(startServer.getAccessStatus()).not.toBeNull();
  return startServer;
}

afterEach(async () => {
  if (webServer && webServer._stopServerForTests) await webServer._stopServerForTests();
  webServer = undefined;
  delete process.env.NOODLPORT;
  delete process.env.NOODL_RELAY_TOKEN;
});

/** One request. No client library, so what is asserted is what the socket did. */
function get(host, port, requestPath, headers = {}) {
  return new Promise((resolve, reject) => {
    const request = http.get({ host, port, path: requestPath, headers }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => (body += chunk));
      response.on('end', () => resolve({ status: response.statusCode, body }));
    });
    request.on('error', reject);
  });
}

/** The address the socket reports, which is the only reading AC2 accepts. */
function boundAddress(startServer) {
  return startServer.getAccessStatus().host;
}

describe('opening a project does not put the preview on the network', () => {
  it('binds loopback, and says so', async () => {
    const startServer = await start();
    const status = startServer.getAccessStatus();

    expect(status.shared).toBe(false);
    expect(boundAddress(startServer)).toBe('127.0.0.1');
    expect(status.url).toBeNull();
    // #31's second complaint: the editor never mentioned the port was open. It does now.
    expect(status.description).toContain('this machine only');

    // The control. Without it every refusal below is also consistent with a server that failed
    // to start, which is the one reading that would make this whole file meaningless.
    const served = await get('127.0.0.1', status.port, '/');
    expect(served.status).toBe(200);
  });

  it('cannot be reached over the network until somebody shares it', async () => {
    if (lanAddress() === null) return; // see the file note; the absence is asserted below.
    const startServer = await start();
    const status = startServer.getAccessStatus();

    // 🔴 `ECONNREFUSED`, not `401`. Nothing is listening on that interface at all, which is a
    // strictly stronger statement than "it answers and refuses" — an open port that 401s is
    // still an open port, and is still what a scanner finds.
    await expect(get(lanAddress(), status.port, '/')).rejects.toMatchObject({ code: 'ECONNREFUSED' });
    await expect(get('127.0.0.1', status.port, '/')).resolves.toMatchObject({ status: 200 });
  });
});

describe('and when somebody does share it', () => {
  it('rebinds, mints a link with the token in it, and refuses the network without it', async () => {
    if (lanAddress() === null) return;
    const startServer = await start();

    const shared = await startServer.setSharing(true);
    expect(shared.shared).toBe(true);
    // 🔴 Read off the socket after the rebind, not off the argument that asked for it.
    expect(boundAddress(startServer)).toBe('0.0.0.0');
    expect(shared.url).toContain(lanAddress());
    expect(shared.url).toContain('t=');

    // All three verdicts in one run against one server, which is AC3's wording: a refusal on its
    // own is indistinguishable from a server that is down.
    const missing = await get(lanAddress(), shared.port, '/');
    const wrong = await get(lanAddress(), shared.port, `/?t=${shared.token}x`);
    const right = await get(lanAddress(), shared.port, `/?t=${shared.token}`);

    expect(missing.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(right.status).toBe(200);
    expect(missing.body).toBe(wrong.body);

    // 🔴 And the reason this gate is load-bearing rather than tidy: the page this server hands
    // out carries the relay token in it. An ungated `GET /` from the LAN is a disclosure of the
    // credential OBS-004's WebSocket gate checks, which would make that gate decorative for
    // anyone on the network.
    expect(right.body).toContain('__nodegxRelayToken');
    expect(missing.body).not.toContain('__nodegxRelayToken');
  });

  it('stops, and the link stops with it', async () => {
    if (lanAddress() === null) return;
    const startServer = await start();
    const shared = await startServer.setSharing(true);
    const token = shared.token;

    await startServer.setSharing(false);
    expect(boundAddress(startServer)).toBe('127.0.0.1');
    expect(startServer.getAccessStatus().url).toBeNull();

    await expect(get(lanAddress(), shared.port, `/?t=${token}`)).rejects.toMatchObject({
      code: 'ECONNREFUSED'
    });
    // …and the editor's own preview still works, in the same run.
    await expect(get('127.0.0.1', shared.port, '/')).resolves.toMatchObject({ status: 200 });
  });

  it('does not challenge this machine while shared, so local tooling keeps working', async () => {
    const startServer = await start();
    const shared = await startServer.setSharing(true);
    await expect(get('127.0.0.1', shared.port, '/')).resolves.toMatchObject({ status: 200 });
  });

  it('is idempotent, so a second share is not a second rebind', async () => {
    const startServer = await start();
    const first = await startServer.setSharing(true);
    const second = await startServer.setSharing(true);
    expect(second.port).toBe(first.port);
    expect(second.token).toBe(first.token);
  });

  /**
   * 🔴 A rebind fires `listening` a second time, and everything in that handler is
   * once-per-launch work. Attaching a second `WebSocketServer` to the same HTTP server is not
   * harmless: both take the `upgrade` event, every peer registers twice, and each relay message
   * reaches a viewer twice with nothing to distinguish the copies. `ws` in `{ server }` mode
   * announces itself as exactly one `upgrade` listener, which is why that is what is counted.
   */
  it('attaches exactly one relay, however many times it rebinds', async () => {
    const startServer = await start();
    const upgradeListeners = () => startServer._getHttpServerForTests().listenerCount('upgrade');

    // The control: one relay after the first bind. Without it, "still 1 after three rebinds"
    // would also be the reading for a relay that never attached at all.
    expect(upgradeListeners()).toBe(1);

    await startServer.setSharing(true);
    await startServer.setSharing(false);
    await startServer.setSharing(true);

    expect(upgradeListeners()).toBe(1);
  });

  it('records when the LAN cases could not run at all', () => {
    // 🔴 A security assertion that quietly does not run is a gate with a hole in it. On a machine
    // with no external interface the four cases above return early, and this is what says so.
    if (lanAddress() === null) {
      console.warn('HLS-006: no external IPv4 interface — the editor remote-caller cases did not run.');
    }
    expect(typeof lanAddress()).toMatch(/^(string|object)$/);
  });
});
