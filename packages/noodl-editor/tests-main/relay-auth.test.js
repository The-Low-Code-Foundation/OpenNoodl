/**
 * OBS-004 — the project relay's token gate.
 *
 * Driven with real `ws` clients against a real `http.Server`, because the thing under test is
 * a wire protocol and the failure mode is *silence*: a peer that should have been refused just
 * receives everything, and nothing in the editor looks wrong. A mock of the socket would
 * assert the code we wrote rather than the behaviour a browser tab would get.
 *
 * The threat this exists for: browsers do not apply the same-origin policy to WebSockets, so
 * before the token any page the user visited could open `ws://localhost:8574`, register as an
 * `editor`, and read the project export and every traced value out of the running app.
 */

const http = require('http');

const WebSocket = require('ws');

const { startWebSocketServer, CLOSE_UNAUTHORISED } = require('../src/main/src/relay-server');

const TOKEN = 'a-valid-launch-token';

let server;
let wss;
let port;
/** Every client this test opened, so teardown can tear them down. */
let clients;

beforeEach(async () => {
  clients = [];
  server = http.createServer((_req, res) => res.end('ok'));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  port = server.address().port;
  wss = startWebSocketServer(server, { isValidToken: (t) => t === TOKEN });
});

afterEach(async () => {
  // ⚠️ `http.Server#close` stops accepting *new* connections and then waits for the existing
  // ones to end — and a WebSocket never ends on its own. Without terminating the clients and
  // the `ws` server first, the callback never fires and the suite hangs rather than failing.
  for (const ws of clients) ws.terminate();
  await new Promise((resolve) => wss.close(resolve));
  await new Promise((resolve) => server.close(resolve));
});

/** Open a client and resolve once it is connected. */
function open() {
  const ws = new WebSocket(`ws://127.0.0.1:${port}`);
  clients.push(ws);
  return new Promise((resolve, reject) => {
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

/** Every message this client receives, decoded, in arrival order. */
function collect(ws) {
  const received = [];
  ws.on('message', (raw) => received.push(JSON.parse(raw.toString())));
  return received;
}

/** Give the relay a beat to fan messages out. There is no ack to wait on. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 60));

async function register(ws, type, extra) {
  ws.send(JSON.stringify(Object.assign({ cmd: 'register', type, token: TOKEN }, extra)));
  await settle();
}

describe('the relay token gate', () => {
  it('closes a peer that registers without a token, and tells it why', async () => {
    const ws = await open();
    const received = collect(ws);
    const closed = new Promise((resolve) => ws.on('close', (code, reason) => resolve({ code, reason: String(reason) })));

    ws.send(JSON.stringify({ cmd: 'register', type: 'editor' }));

    const { code, reason } = await closed;
    expect(code).toBe(CLOSE_UNAUTHORISED);
    expect(reason).toBe('unauthorised');
    expect(received).toEqual([{ cmd: 'registerRejected', reason: 'invalid or missing token' }]);
  });

  it('closes a peer whose token is wrong', async () => {
    const ws = await open();
    const closed = new Promise((resolve) => ws.on('close', (code) => resolve(code)));

    ws.send(JSON.stringify({ cmd: 'register', type: 'editor', token: 'guessed' }));

    expect(await closed).toBe(CLOSE_UNAUTHORISED);
  });

  it('closes a peer that skips the handshake and sends a command straight away', async () => {
    // The gate is on the *socket*, not on the `register` message: a peer that never registers
    // used to have `type === undefined`, which made `broadcastMessage`'s `!type` branch fan
    // its traffic to every connected socket regardless of peer type.
    const ws = await open();
    const closed = new Promise((resolve) => ws.on('close', (code) => resolve(code)));

    ws.send(JSON.stringify({ cmd: 'getTraceEvents', content: '{}' }));

    expect(await closed).toBe(CLOSE_UNAUTHORISED);
  });

  it('never delivers a viewer message to a peer that failed the handshake', async () => {
    // ⚠️ The regression that matters. `ws.close()` is asynchronous, so a socket rejected in
    // this tick is still OPEN for the next fan-out unless the broadcast itself skips it.
    const eavesdropper = await open();
    const heard = collect(eavesdropper);
    eavesdropper.send(JSON.stringify({ cmd: 'register', type: 'editor' })); // no token

    const viewer = await open();
    await register(viewer, 'viewer', { clientId: 'v1' });
    viewer.send(JSON.stringify({ cmd: 'traceEvents', type: 'viewer', content: '{"events":[]}' }));
    await settle();

    expect(heard.map((m) => m.cmd)).toEqual(['registerRejected']);
  });

  it('relays between authorised peers exactly as before', async () => {
    const editor = await open();
    const fromViewer = collect(editor);
    await register(editor, 'editor');

    const viewer = await open();
    const fromEditor = collect(viewer);
    await register(viewer, 'viewer', { clientId: 'v1' });

    // A viewer registering announces itself to editors.
    expect(fromViewer).toContainEqual({ cmd: 'registered', type: 'viewer', clientId: 'v1' });

    editor.send(JSON.stringify({ cmd: 'traceEnabled', content: '{"enabled":true}' }));
    viewer.send(JSON.stringify({ cmd: 'traceEvents', type: 'viewer', content: '{"events":[]}' }));
    await settle();

    expect(fromEditor).toContainEqual({ cmd: 'traceEnabled', content: '{"enabled":true}' });
    expect(fromViewer).toContainEqual({ cmd: 'traceEvents', type: 'viewer', content: '{"events":[]}' });
  });

  it('routes a targeted message to one authorised client only', async () => {
    const editor = await open();
    await register(editor, 'editor');

    const a = await open();
    const toA = collect(a);
    await register(a, 'viewer', { clientId: 'a' });

    const b = await open();
    const toB = collect(b);
    await register(b, 'viewer', { clientId: 'b' });

    editor.send(JSON.stringify({ cmd: 'export', type: 'full', content: '{}', target: 'a' }));
    await settle();

    expect(toA.map((m) => m.cmd)).toContain('export');
    expect(toB.map((m) => m.cmd)).not.toContain('export');
  });

  it('does not announce a disconnect for a peer that never authorised', async () => {
    // A spurious `disconnect` naming an unknown clientId makes the editor drop that client's
    // export cache — so an unauthorised peer joining and leaving would have been able to
    // provoke a full re-export on every connection.
    const editor = await open();
    const seen = collect(editor);
    await register(editor, 'editor');

    const intruder = await open();
    const gone = new Promise((resolve) => intruder.on('close', resolve));
    intruder.send(JSON.stringify({ cmd: 'register', type: 'viewer', clientId: 'ghost' }));
    await gone;
    await settle();

    expect(seen.map((m) => m.cmd)).not.toContain('disconnect');
  });

  it('ignores unparseable input rather than throwing out of the message handler', async () => {
    const ws = await open();
    const closed = new Promise((resolve) => ws.on('close', (code) => resolve(code)));

    ws.send('not json at all');
    ws.send(JSON.stringify({ cmd: 'register', type: 'editor' }));

    // The garbage is dropped; the socket is still closed by the (untokened) register that
    // follows it, which is what proves the handler survived the first message.
    expect(await closed).toBe(CLOSE_UNAUTHORISED);
  });
});

describe('token injection into the served page', () => {
  const { injectRelayToken } = require('../src/main/src/relay-token');

  it('puts the token in the head of the served document', () => {
    const html = injectRelayToken('<html><head><title>x</title></head><body></body></html>', 'tok');
    expect(html).toContain('window.__nodegxRelayToken="tok"');
    expect(html.indexOf('__nodegxRelayToken')).toBeLessThan(html.indexOf('</head>'));
  });

  it('escapes the token rather than pasting it into source', () => {
    // The token is hex today, but the injector is the one place a value from outside the
    // page becomes executable code in it, so it must not depend on that.
    const html = injectRelayToken('<head></head>', '</script><script>stolen()');
    expect(html).not.toContain('</script><script>stolen()');
  });

  it('still emits the token when the template has no head', () => {
    expect(injectRelayToken('<body></body>', 'tok')).toContain('__nodegxRelayToken');
  });
});
