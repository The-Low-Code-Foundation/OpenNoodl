/**
 * OBS-004 — the observe server's relay client, against the real relay.
 *
 * Not a mock. The relay is `packages/noodl-editor/src/main/src/relay-server.js` itself, driven
 * over a real socket, with a fake *viewer* standing in for the running app. Everything worth
 * testing here is an interaction between two processes — the token handshake, client
 * discovery, message batching, de-duplication — and a mock of the socket would assert the
 * client we wrote rather than the protocol it has to survive.
 *
 * The fake viewer is deliberately faithful about the two things the real runtime does that
 * break naive clients: it answers by **broadcast** rather than to a target, and it **batches
 * messages into arrays** under load.
 */

import http from 'http';

// The real relay, imported across the package boundary on purpose. If its handshake changes,
// this test fails — which is the point.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { startWebSocketServer } = require('../../noodl-editor/src/main/src/relay-server');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const WebSocketNode = require('ws');

import { RelayClient, RelayClientOptions } from '../src/relayClient';
import { findRelayToken, describeMissingToken } from '../src/token';

const TOKEN = 'test-launch-token';

let server: http.Server;
let wss: { close(cb?: () => void): void; clients: Set<{ terminate(): void }> };
let port: number;
let relayRunning = false;
let viewers: { ws: unknown; close(): void }[] = [];
let clients: RelayClient[] = [];
let logs: string[] = [];

/**
 * The token this relay accepts *right now*.
 *
 * ⚠️ Mutable on purpose. The editor mints a fresh token at every launch, so "the editor was
 * restarted" is not simulated by restarting a listener — it is simulated by restarting a
 * listener that now demands a **different** token. A fixed token would let a broken reconnect
 * pass.
 */
let currentToken = TOKEN;

jest.setTimeout(30000);

/** Bring the relay up. `desiredPort` of 0 picks one; passing the previous port restarts on it. */
async function startRelay(desiredPort = 0): Promise<void> {
  server = http.createServer((_req, res) => res.end('ok'));
  await new Promise<void>((resolve) => server.listen(desiredPort, '127.0.0.1', () => resolve()));
  port = (server.address() as { port: number }).port;
  wss = startWebSocketServer(server, { isValidToken: (t: unknown) => t === currentToken });
  relayRunning = true;
}

/**
 * Quit the editor.
 *
 * ⚠️ `wss.close()` on a server it did not create does **not** terminate the connected clients
 * (ws 8.x) — it waits for them. A test that only called `close()` would hang instead of
 * simulating a quit, and would never deliver the `close` event the reconnect hangs off.
 */
async function stopRelay(): Promise<void> {
  if (!relayRunning) return;
  relayRunning = false;
  for (const client of Array.from(wss.clients)) client.terminate();
  await new Promise<void>((resolve) => wss.close(() => resolve()));
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

/** Poll rather than sleep: a reconnect is scheduled, not synchronous. */
async function waitFor(condition: () => boolean, timeoutMs = 8000, what = 'condition'): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (condition()) return;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error(`Timed out after ${timeoutMs}ms waiting for ${what}. Log:\n${logs.join('\n')}`);
}

beforeEach(async () => {
  viewers = [];
  clients = [];
  logs = [];
  currentToken = TOKEN;
  await startRelay();
});

afterEach(async () => {
  // ⚠️ Closing the clients is not tidiness: a RelayClient left alive keeps retrying after the
  // test ends, which surfaces as "cannot log after tests are done" in whichever test runs next.
  for (const c of clients) c.close();
  for (const v of viewers) v.close();
  // ⚠️ http.Server#close waits for existing connections, and a WebSocket never ends on its
  // own — without closing these first the suite hangs rather than failing.
  await stopRelay();
});

/**
 * A stand-in for the running app.
 *
 * @param respond Called with each inbound message; whatever it returns is sent back. Returning
 *   an array exercises the runtime's batching, which is the shape a busy app actually sends.
 */
function fakeViewer(clientId: string, respond?: (msg: Record<string, unknown>) => unknown) {
  const ws = new WebSocketNode(`ws://127.0.0.1:${port}`);
  const handle = { ws, close: () => ws.terminate() };
  viewers.push(handle);
  return new Promise<typeof handle>((resolve) => {
    ws.on('open', () => {
      ws.send(JSON.stringify({ cmd: 'register', type: 'viewer', clientId, token: currentToken }));
      ws.on('message', (raw: Buffer) => {
        const parsed = JSON.parse(raw.toString());
        for (const message of Array.isArray(parsed) ? parsed : [parsed]) {
          const reply = respond && respond(message);
          if (reply !== undefined) ws.send(JSON.stringify(reply));
        }
      });
      setTimeout(() => resolve(handle), 50);
    });
  });
}

function connected(overrides: Partial<RelayClientOptions> = {}) {
  const client = new RelayClient({
    token: currentToken,
    host: '127.0.0.1',
    port,
    timeout: 3000,
    // Fast enough for a test, still above the 250ms accept grace the client floors at.
    reconnectDelay: 300,
    maxReconnectDelay: 300,
    // Stands in for `cli.ts`'s `findRelayToken(explicitToken)`: re-read at each attempt.
    refreshToken: () => currentToken,
    log: (line) => logs.push(line),
    ...overrides
  });
  clients.push(client);
  return client;
}

describe('getting on the relay at all', () => {
  it('connects with the launch token', async () => {
    const client = connected();
    await expect(client.connect()).resolves.toBeUndefined();
    client.close();
  });

  it('explains a stale token rather than reporting a generic socket failure', async () => {
    // ⚠️ The single most likely failure in the field: the editor was restarted, and the token
    // on disk is from the previous launch. A message saying "connection closed" would send
    // the user off checking firewalls.
    const client = connected({ token: 'from-the-last-launch' });
    await expect(client.connect()).rejects.toThrow(/token is wrong or stale/);
  });

  it('says the editor may not be running when nothing is listening', async () => {
    const client = new RelayClient({ token: TOKEN, host: '127.0.0.1', port: 59_997, timeout: 1000 });
    await expect(client.connect()).rejects.toThrow(/Is the editor running/);
  });
});

describe('finding the running preview', () => {
  it('asks the relay who is connected, rather than the app', async () => {
    // ⚠️ The alternative — cmd:'refresh' to force a fresh announcement — makes the viewer
    // reload the page, which clears the trace buffer the caller connected to read. Discovery
    // must not have side effects on the thing being observed.
    await fakeViewer('v1');
    const client = connected();
    await client.connect();

    await expect(client.discoverClients()).resolves.toEqual(['v1']);
    client.close();
  });

  it('finds a preview that was already running before it attached', async () => {
    // A `nodelibrary` announcement only happens at registration. A server that starts later
    // never sees one, which is the ordinary case for an agent joining a session in progress.
    await fakeViewer('already-here');
    const client = connected();
    await client.connect();

    await expect(client.resolveClientId()).resolves.toBe('already-here');
    client.close();
  });

  it('says so plainly when no preview is running', async () => {
    const client = connected();
    await client.connect();
    await expect(client.resolveClientId()).rejects.toThrow(/No preview is running/);
    client.close();
  });
});

describe('pulling from the running app', () => {
  const topology = { nodes: { n1: { name: 'Cart', type: 'Variable', component: '/Home' } }, edges: [] };

  it('reads the topology', async () => {
    await fakeViewer('v1', (msg) =>
      msg.cmd === 'getTraceDictionary'
        ? { cmd: 'traceDictionary', type: 'viewer', content: JSON.stringify(topology) }
        : undefined
    );
    const client = connected();
    await client.connect();

    await expect(client.fetchTopology()).resolves.toEqual(topology);
    client.close();
  });

  it('survives the runtime batching replies into an array', async () => {
    // ⚠️ The runtime's `send()` coalesces on a 200ms timer and ships arrays of up to 50
    // messages. A client that only handles objects works perfectly on an idle app and drops
    // everything on a busy one — which is the only time any of this matters.
    await fakeViewer('v1', (msg) =>
      msg.cmd === 'getTraceDictionary'
        ? [
            { cmd: 'somethingElse' },
            { cmd: 'traceDictionary', type: 'viewer', content: JSON.stringify(topology) }
          ]
        : undefined
    );
    const client = connected();
    await client.connect();

    await expect(client.fetchTopology()).resolves.toEqual(topology);
    client.close();
  });

  it('times out with a message rather than hanging when the preview goes away', async () => {
    // Every request here is answered by a different process that may have closed between the
    // client list being read and the message landing. A promise that never settles is
    // indistinguishable from a hang.
    await fakeViewer('v1'); // registers, never answers
    const client = connected();
    await client.connect();
    await client.discoverClients();

    await expect(client.fetchTopology()).rejects.toThrow(/did not answer/);
    client.close();
  });
});

describe('the event buffer', () => {
  const event = (seq: number) => ({
    seq,
    t: seq,
    cause: 0,
    from: { node: 'a', port: 'Out' },
    to: { node: 'b', port: 'In' },
    value: 'x',
    kind: 'value' as const
  });

  async function clientWithEvents(batches: ReturnType<typeof event>[][]) {
    let call = 0;
    await fakeViewer('v1', (msg) =>
      msg.cmd === 'getTraceEvents'
        ? { cmd: 'traceEvents', type: 'viewer', content: JSON.stringify({ events: batches[call++] || [] }) }
        : undefined
    );
    const client = connected();
    await client.connect();
    await client.discoverClients();
    return client;
  }

  it('de-duplicates by seq', async () => {
    // ⚠️ The reason this is needed at all: the editor and this server pull from the same
    // runtime, and every reply is a broadcast — so a pull the *editor* made lands here too.
    // Without this, an editor window open on the Provenance panel would double every
    // "fired N×" count this server reports.
    const client = await clientWithEvents([[event(1), event(2)], [event(2), event(3)]]);

    await client.fetchEvents();
    await client.fetchEvents();

    expect(client.events.map((e) => e.seq)).toEqual([1, 2, 3]);
    client.close();
  });

  it('does not infer that it is recording from the event count', async () => {
    // ⚠️ OBS-002 shipped this bug and found it live. Record, reproduce, nothing fires — that
    // is the most informative outcome there is, and `events.length > 0` reports it as "we
    // know nothing".
    const client = await clientWithEvents([[]]);
    expect(client.recording).toBe(false);

    await client.setTraceEnabled(true);
    expect(client.recording).toBe(true);
    expect(client.events).toHaveLength(0);
    client.close();
  });

  it('drops what it holds when a new recording starts', async () => {
    // The runtime clears its own buffer on the off→on transition; a client that kept its copy
    // would build a walk from two different sessions spliced together.
    const client = await clientWithEvents([[event(1), event(2)]]);
    await client.fetchEvents();
    expect(client.events).toHaveLength(2);

    await client.setTraceEnabled(true);
    expect(client.events).toHaveLength(0);
    client.close();
  });
});

/**
 * MCP-003 — the editor is quit and started again while this server keeps running.
 *
 * ⚠️ These are the only tests here that drop a **live** connection. Everything above tests a
 * connection that was never established; the bug this covers is a connection that worked and
 * then stopped, which is a different code path entirely — and was, before this task, a path
 * with nothing on it at all.
 */
describe('surviving an editor restart', () => {
  const event = (seq: number) => ({
    seq,
    t: seq,
    cause: 0,
    from: { node: 'a', port: 'Out' },
    to: { node: 'b', port: 'In' },
    value: 'x',
    kind: 'value' as const
  });

  /** Quit the editor and start it again on the same port, minting a new launch token. */
  async function restartTheEditor(): Promise<void> {
    await stopRelay();
    currentToken = 'second-launch-token';
    await startRelay(port);
  }

  it('reconnects after a real drop, against the new launch token', async () => {
    const client = connected();
    await client.connect();
    expect(client.state).toBe('connected');

    await stopRelay();
    await waitFor(() => client.state === 'reconnecting', 5000, 'the drop to be noticed');

    currentToken = 'second-launch-token';
    await startRelay(port);
    await waitFor(() => client.state === 'connected', 10000, 'the reconnect');

    // ⚠️ Not the state flag alone. A flag says the code path ran; a round trip over the new
    // socket, to a viewer that did not exist before the restart, says the connection works.
    await fakeViewer('after-the-restart');
    await expect(client.discoverClients()).resolves.toEqual(['after-the-restart']);
  });

  it('tells the caller what happened and what to do, instead of "not connected"', async () => {
    const client = connected();
    await client.connect();
    await stopRelay();
    await waitFor(() => client.state === 'reconnecting', 5000, 'the drop to be noticed');

    // Every entry point, not just the raw send: `resolveClientId` would otherwise report "no
    // preview is running", which is true of a dead app and sends the user to the wrong place.
    await expect(client.fetchTopology()).rejects.toThrow(/retrying/);
    await expect(client.setTraceEnabled(true)).rejects.toThrow(/editor being quit or restarted/i);
  });

  it('starts the event buffer over, because a fresh runtime restarts seq at 1', async () => {
    // ⚠️ The worst available failure if this is wrong: connected, silent. A new runtime builds
    // a new TraceBuffer whose nextSeq is 1 (noodl-runtime/src/tracebuffer.ts), so a retained
    // high-water mark of 8 discards the entire new session as already-seen.
    await fakeViewer('before', (msg) =>
      msg.cmd === 'getTraceEvents'
        ? { cmd: 'traceEvents', type: 'viewer', content: JSON.stringify({ events: [event(7), event(8)] }) }
        : undefined
    );
    const client = connected();
    await client.connect();
    await client.discoverClients();
    await client.fetchEvents();
    expect(client.events.map((e) => e.seq)).toEqual([7, 8]);

    await restartTheEditor();
    await fakeViewer('after', (msg) =>
      msg.cmd === 'getTraceEvents'
        ? { cmd: 'traceEvents', type: 'viewer', content: JSON.stringify({ events: [event(1), event(2)] }) }
        : undefined
    );
    await waitFor(() => client.state === 'connected', 10000, 'the reconnect');

    await client.fetchEvents();
    expect(client.events.map((e) => e.seq)).toEqual([1, 2]);
  });

  it('re-arms a trace that was armed before the restart', async () => {
    // FH-011's class of defect: the switch is fire-and-forget, so the new relay knows nothing
    // about a recording requested over a socket that no longer exists. Silently disarmed is
    // indistinguishable from "nothing fired".
    await fakeViewer('before');
    const client = connected();
    await client.connect();
    await client.setTraceEnabled(true);
    expect(client.recording).toBe(true);

    await restartTheEditor();
    const rearmed: unknown[] = [];
    await fakeViewer('after', (msg) => {
      if (msg.cmd === 'traceEnabled') rearmed.push(msg.content);
      return undefined;
    });

    await waitFor(() => client.state === 'connected', 10000, 'the reconnect');
    await waitFor(() => rearmed.length > 0, 5000, 'the trace to be re-armed');
    // ⚠️ The owner rides along (HUD-004). The relay releases this server's ownership when its
    // socket closes, so a re-arm that forgot its own name would land on the runtime's single
    // anonymous key — back to sharing one switch with the editor, which is the bug this server
    // was the second half of.
    expect(JSON.parse(rearmed[0] as string)).toEqual({ enabled: true, owner: client.clientId });
  });

  it('never swaps the token it was given when there is no refresher', async () => {
    // The `--token` contract: an explicit token stays explicit across reconnects. `cli.ts`
    // supplies a refresher that re-runs the same precedence, so an explicit token re-resolves
    // to itself — the client itself must never invent one.
    const client = connected({ refreshToken: undefined });
    await client.connect();

    await restartTheEditor();
    await waitFor(() => client.state === 'reconnecting', 5000, 'the drop to be noticed');

    // It keeps retrying with the token it was handed, and the new relay keeps refusing it.
    await new Promise((r) => setTimeout(r, 1500));
    expect(client.state).toBe('reconnecting');
  });

  it('stops retrying once closed', async () => {
    const client = connected();
    await client.connect();
    await stopRelay();
    await waitFor(() => client.state === 'reconnecting', 5000, 'the drop to be noticed');

    client.close();
    currentToken = 'second-launch-token';
    await startRelay(port);
    await new Promise((r) => setTimeout(r, 1200));
    expect(client.state).toBe('closed');
  });

  it('logs the drop and each escalation, not every attempt', async () => {
    // stderr is the human channel of an unattended process. An unbounded retry log is the
    // reason people stop reading it.
    const client = connected({ reconnectDelay: 300, maxReconnectDelay: 600 });
    await client.connect();
    await stopRelay();
    await waitFor(() => logs.length >= 2, 5000, 'the drop to be logged');
    await new Promise((r) => setTimeout(r, 2500));

    expect(logs[0]).toMatch(/lost the editor connection/);
    // 300 then 600, and then nothing however long it keeps trying.
    expect(logs.filter((l) => /retrying/.test(l))).toHaveLength(2);
  });
});

describe('warnings', () => {
  it('accumulates and clears what the app says about itself', async () => {
    const viewer = await fakeViewer('v1');
    const client = connected();
    await client.connect();

    const send = (payload: unknown) => (viewer.ws as { send(s: string): void }).send(JSON.stringify(payload));
    send({
      cmd: 'showwarning',
      type: 'viewer',
      content: JSON.stringify({
        componentName: '/Home',
        nodeId: 'n1',
        key: 'states-unknown-state',
        warning: { message: 'Received "Clicked" — no such state.' }
      })
    });
    await new Promise((r) => setTimeout(r, 80));
    expect(Array.from(client.warnings.values())).toHaveLength(1);

    // A fixed condition must un-ring, or the Problems panel becomes noise and gets ignored.
    send({ cmd: 'clearwarnings', type: 'viewer', content: JSON.stringify({ nodeId: 'n1' }) });
    await new Promise((r) => setTimeout(r, 80));
    expect(client.warnings.size).toBe(0);
    client.close();
  });
});

describe('finding the token', () => {
  it('prefers an explicit token over everything', () => {
    process.env.NODEGX_RELAY_TOKEN = 'from-env';
    try {
      expect(findRelayToken('explicit')).toMatchObject({ token: 'explicit', source: '--token' });
    } finally {
      delete process.env.NODEGX_RELAY_TOKEN;
    }
  });

  it('falls back to the environment before the filesystem', () => {
    process.env.NODEGX_RELAY_TOKEN = 'from-env';
    try {
      expect(findRelayToken()).toMatchObject({ token: 'from-env' });
    } finally {
      delete process.env.NODEGX_RELAY_TOKEN;
    }
  });

  it('lists everywhere it looked when it finds nothing', () => {
    // ⚠️ "No token" is indistinguishable from "the editor is not running" unless the message
    // says which paths were tried — and the directory is named after the product name
    // (`NodeGX`), not the npm package name, which is exactly the sort of thing nobody guesses.
    const lookup = { searched: ['$NODEGX_RELAY_TOKEN', '/somewhere/NodeGX/relay-token'] };
    const message = describeMissingToken(lookup);
    expect(message).toContain('/somewhere/NodeGX/relay-token');
    expect(message).toContain('--token');
    expect(message).toContain('editor is not running');
  });
});
