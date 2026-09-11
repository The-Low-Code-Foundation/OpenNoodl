/**
 * FLD-010 — `session_status`, graded against the editor's **real** relay.
 *
 * ## What this suite is for, and it is one property
 *
 * 🔴 **The only way this tool can hurt anyone is by answering `false` when a person IS there.**
 * Every other wrong answer costs an agent a sentence of caution it did not need. So the arms below
 * are weighted accordingly: one arm proves the true case, and five prove that each distinct way
 * the transport can fail comes back as `unknown` rather than as "nobody is home".
 *
 * ⚠️ **AC2 is why the relay here is real.** *"The false case is measured, not assumed — assert it
 * against a running relay with no editor peer, not merely against a closed port."* A stub relay
 * would fan messages the way this file's author believes the real one does, and would pass whether
 * or not the tool addresses anybody. `startWebSocketServer` is the editor's own module, imported
 * across the package boundary on purpose — the same call `hls009OpenInEditor.test.ts` makes and for
 * the same reason.
 *
 * What is faked is the *editor window*: a socket that registers as `type: 'editor'` and answers
 * `sessionStatus`. That half is faked because it is not what this suite grades —
 * `noodl-editor/tests-unit/fld010/session-status.test.ts` grades the reading it would produce.
 */

import * as http from 'http';
import type { AddressInfo } from 'net';

import WebSocket from 'ws';

import { call, connect, copyFixture, reveal, type TestSession } from './helpers';
import type { SessionStatusResponse } from '../src/tools/sessionStatus';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { startWebSocketServer } = require('../../noodl-editor/src/main/src/relay-server.js');

const TOKEN = 'fld010-test-token';

interface FakeEditor {
  socket: WebSocket;
  received: Array<Record<string, unknown>>;
  close(): void;
}

describe('FLD-010 — session_status over the real project relay', () => {
  let server: http.Server;
  let port: number;
  let session: TestSession;
  const peers: FakeEditor[] = [];
  const savedEnv: Record<string, string | undefined> = {};

  beforeAll(async () => {
    server = http.createServer((_req, res) => res.end());
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = (server.address() as AddressInfo).port;
    startWebSocketServer(server, { isValidToken: (t: unknown) => t === TOKEN });

    savedEnv.NODEGX_RELAY_TOKEN = process.env.NODEGX_RELAY_TOKEN;
    savedEnv.NOODLPORT = process.env.NOODLPORT;
    savedEnv.NODEGX_RELAY_PORT = process.env.NODEGX_RELAY_PORT;
    process.env.NODEGX_RELAY_TOKEN = TOKEN;
    process.env.NODEGX_RELAY_PORT = String(port);

    session = await connect(copyFixture());
    await reveal(session, 'project');
  });

  afterAll(async () => {
    for (const p of peers) p.close();
    await session?.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    for (const [k, v] of Object.entries(savedEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  /**
   * 🔴 **Awaited, and that is not tidiness.** `close()` on a WebSocket is asynchronous — the relay
   * says so in its own module note, which is why its fan-out skips unauthorised sockets rather than
   * trusting `close()` to have happened. A synchronous teardown left the previous test's fake
   * editor still registered, and the arm that asserts "the relay is up with no window on it" read
   * `attached-no-answer` off a peer the test before it had opened. It failed in the safe direction
   * here; the same race in an assertion about `editorAttached: false` would have failed in the
   * other one.
   */
  afterEach(async () => {
    const closing = peers.splice(0).map(
      (p) =>
        new Promise<void>((resolve) => {
          if (p.socket.readyState === WebSocket.CLOSED) return resolve();
          p.socket.once('close', () => resolve());
          p.close();
        })
    );
    await Promise.all(closing);
  });

  /**
   * @param answer the editor's reading, or `null` to stay silent — which is how a `nodegx-observe`
   *   sidecar behaves, since it registers as `type: 'editor'` too and has no handler for this.
   */
  async function attachFakeEditor(clientId: string, answer: Record<string, unknown> | null): Promise<FakeEditor> {
    const socket = new WebSocket(`ws://127.0.0.1:${port}`);
    const peer: FakeEditor = { socket, received: [], close: () => socket.close() };
    peers.push(peer);

    await new Promise<void>((resolve, reject) => {
      socket.on('error', reject);
      socket.on('open', () => {
        socket.send(JSON.stringify({ cmd: 'register', type: 'editor', clientId, token: TOKEN }));
        resolve();
      });
    });

    socket.on('message', (raw) => {
      const msg = JSON.parse(String(raw)) as Record<string, unknown>;
      if (msg.cmd !== 'sessionStatus') return;
      peer.received.push(msg);
      if (!answer) return;
      socket.send(
        JSON.stringify({
          cmd: 'sessionStatusResult',
          target: msg.clientId,
          requestId: msg.requestId,
          content: JSON.stringify(answer)
        })
      );
    });

    return peer;
  }

  const OPEN_AND_CLEAN = {
    projectOpen: true,
    directory: '/tmp/shop',
    projectName: 'Shop',
    projectFormat: 'v2',
    currentComponent: '/Pages/Home',
    unsavedBuffers: false,
    unsavedComponents: []
  };

  it('is reachable through find_tools by a word a model would actually type', async () => {
    const fresh = await connect(copyFixture());
    try {
      const found = await call<{ revealed: string[] }>(fresh, 'find_tools', { query: 'unsaved' });
      expect(found.isError).toBe(false);
      expect(found.data.revealed).toContain('session_status');
    } finally {
      await fresh.close();
    }
  });

  it('reports the person, the project and the component they are on', async () => {
    await attachFakeEditor('editor-window', OPEN_AND_CLEAN);

    const res = await call<SessionStatusResponse>(session, 'session_status', { directory: '/tmp/shop' });

    expect(res.isError).toBe(false);
    expect(res.data.status).toBe('attached');
    expect(res.data.editorAttached).toBe(true);
    expect(res.data.sameProject).toBe(true);
    expect(res.data.currentComponent).toBe('/Pages/Home');
    expect(res.data.note).toContain('/Pages/Home');
  });

  it('sends the request addressed, so it reaches the window rather than the fan-out', async () => {
    const editor = await attachFakeEditor('editor-window', OPEN_AND_CLEAN);

    await call<SessionStatusResponse>(session, 'session_status', {});

    expect(editor.received).toHaveLength(1);
    expect(editor.received[0].target).toBe('editor-window');
    expect(typeof editor.received[0].clientId).toBe('string');
  });

  /**
   * 🔴 The answer that decides whether an agent writes. `unsavedComponents` names the files, so
   * the advice can be "work on something else" rather than "stop".
   */
  it('names the unsaved components and tells the caller not to race them', async () => {
    await attachFakeEditor('editor-window', {
      ...OPEN_AND_CLEAN,
      unsavedBuffers: true,
      unsavedComponents: ['Pages/Home']
    });

    const res = await call<SessionStatusResponse>(session, 'session_status', { directory: '/tmp/shop' });

    expect(res.data.unsavedBuffers).toBe(true);
    expect(res.data.unsavedComponents).toEqual(['Pages/Home']);
    expect(res.data.note).toContain('Pages/Home');
    expect(res.data.note).toMatch(/unsaved/i);
  });

  it('says so when the editor is open on a different project', async () => {
    await attachFakeEditor('editor-window', OPEN_AND_CLEAN);

    const res = await call<SessionStatusResponse>(session, 'session_status', { directory: '/tmp/other-app' });

    expect(res.data.status).toBe('attached');
    expect(res.data.sameProject).toBe(false);
    expect(res.data.note).toContain('NOT the project you asked about');
  });

  /**
   * 🔴 **AC2, and the reason it is written the way it is.** A relay that is up with no window
   * registered is not "nobody is home" — it is a NodeGX that is still starting, about a second
   * before its renderer registers. This arm runs against the real relay with no editor peer, which
   * is the case a closed port cannot produce.
   */
  it('answers unknown — not "no editor" — when the relay is up with no window on it', async () => {
    const res = await call<SessionStatusResponse>(session, 'session_status', {});

    expect(res.data.status).toBe('unknown');
    expect(res.data.editorAttached).toBeNull();
    expect(res.data.editorAttached).not.toBe(false);
    expect(res.data.note).toContain('does NOT mean nobody has the project open');
  });

  /**
   * 🔴 **AC4 — the specific wrong answer the obvious implementation gives.** The editor writes
   * `relay-token` on launch and never unlinks it on quit, so "the file is there" proves only that
   * NodeGX once ran on this machine. Liveness is the socket, so a token pointing at a dead port
   * must read as `no-editor` — and, because the relay lives inside the editor's own process,
   * `false` is the honest answer there rather than `unknown`.
   */
  it('a stale token with nothing listening reads as no editor, not as an error', async () => {
    const dead = await new Promise<number>((resolve) => {
      const probe = http.createServer();
      probe.listen(0, '127.0.0.1', () => {
        const p = (probe.address() as AddressInfo).port;
        probe.close(() => resolve(p));
      });
    });
    process.env.NODEGX_RELAY_PORT = String(dead);
    process.env.NODEGX_RELAY_TOKEN = 'a-token-left-behind-by-a-previous-launch';
    try {
      const res = await call<SessionStatusResponse>(session, 'session_status', {});

      expect(res.isError).toBe(false);
      expect(res.data.status).toBe('no-editor');
      expect(res.data.editorAttached).toBe(false);
      expect(res.data.note).toMatch(/safe to edit/i);
    } finally {
      process.env.NODEGX_RELAY_PORT = String(port);
      process.env.NODEGX_RELAY_TOKEN = TOKEN;
    }
  });

  /**
   * 🔴 The inverse of the arm above, and the pair is what makes either meaningful. A stale token
   * against a relay that IS listening means an editor is almost certainly running — so this is the
   * one case where "the token is bad" must NOT become "nobody is here".
   */
  it('a stale token against a live relay reads as unknown, because someone probably IS there', async () => {
    await attachFakeEditor('editor-window', OPEN_AND_CLEAN);
    process.env.NODEGX_RELAY_TOKEN = 'not-the-launch-token';
    try {
      const res = await call<SessionStatusResponse>(session, 'session_status', {});

      expect(res.data.status).toBe('unknown');
      expect(res.data.editorAttached).toBeNull();
      expect(res.data.note).toMatch(/probably IS running/);
    } finally {
      process.env.NODEGX_RELAY_TOKEN = TOKEN;
    }
  });

  /**
   * An editor older than this tool has no handler and will never answer. It is still an editor,
   * with a person in front of it — so the answer is `attached-no-answer`, which keeps
   * `editorAttached: true` while admitting it knows nothing else.
   */
  it('a window that does not answer is still a window', async () => {
    await attachFakeEditor('old-editor-window', null);

    const res = await call<SessionStatusResponse>(session, 'session_status', {});

    expect(res.data.status).toBe('attached-no-answer');
    expect(res.data.editorAttached).toBe(true);
    expect(res.data.note).toMatch(/do not write over the project/i);
  }, 15_000);

  /**
   * `nodegx-observe` registers as `type: 'editor'` too, so "the first editor peer" is as likely to
   * be another agent's sidecar as a window. Every editor peer is asked; only a window answers.
   */
  it('finds the real window when a silent peer claims the same type', async () => {
    const sidecar = await attachFakeEditor('observe-sidecar', null);
    const window = await attachFakeEditor('editor-window', OPEN_AND_CLEAN);

    const res = await call<SessionStatusResponse>(session, 'session_status', {});

    expect(res.data.status).toBe('attached');
    expect(res.data.projectName).toBe('Shop');
    expect(sidecar.received).toHaveLength(1);
    expect(window.received).toHaveLength(1);
  });

  it('reports an editor that failed to read itself as unknown, not as an empty project', async () => {
    await attachFakeEditor('editor-window', { error: 'ProjectModel blew up' });

    const res = await call<SessionStatusResponse>(session, 'session_status', {});

    expect(res.data.status).toBe('unknown');
    expect(res.data.editorAttached).toBeNull();
    expect(res.data.note).toContain('ProjectModel blew up');
  });

  it('an editor with no project open says so, and says editing is safe', async () => {
    await attachFakeEditor('editor-window', {
      projectOpen: false,
      directory: null,
      projectName: null,
      projectFormat: null,
      currentComponent: null,
      unsavedBuffers: false,
      unsavedComponents: null
    });

    const res = await call<SessionStatusResponse>(session, 'session_status', { directory: '/tmp/shop' });

    expect(res.data.status).toBe('attached');
    expect(res.data.editorAttached).toBe(true);
    expect(res.data.note).toMatch(/no project loaded/i);
  });

  /**
   * 🔴 **AC5 — the `nodegx-observe` channel still works.**
   *
   * The strongest form of this assertion is that `relay-server.js` was not changed at all, which
   * `git diff` shows and no spec can. What a spec CAN grade is the property observe depends on:
   * an untargeted message from a `viewer` peer still fans to every `editor` peer, unaffected by
   * this task's new `service` peer being on the relay at the same time. Asserted, not assumed —
   * the AC says so in those words.
   */
  it('leaves the viewer→editor fan-out that nodegx-observe rides on intact', async () => {
    const editor = await attachFakeEditor('editor-window', OPEN_AND_CLEAN);
    const heard: Array<Record<string, unknown>> = [];
    editor.socket.on('message', (raw) => heard.push(JSON.parse(String(raw)) as Record<string, unknown>));

    const viewer = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise<void>((resolve, reject) => {
      viewer.on('error', reject);
      viewer.on('open', () => {
        viewer.send(JSON.stringify({ cmd: 'register', type: 'viewer', clientId: 'preview-1', token: TOKEN }));
        resolve();
      });
    });

    // Ask for status at the same time, so the fan-out is measured with this task's peer attached.
    await call<SessionStatusResponse>(session, 'session_status', {});
    viewer.send(JSON.stringify({ cmd: 'traceEvents', clientId: 'preview-1', content: '{"events":[]}' }));
    await new Promise((resolve) => setTimeout(resolve, 120));
    viewer.close();

    expect(heard.some((m) => m.cmd === 'traceEvents' && m.clientId === 'preview-1')).toBe(true);
    // And the editor peer was told a viewer registered — the other half of the fan-out.
    expect(heard.some((m) => m.cmd === 'registered' && m.clientId === 'preview-1')).toBe(true);
  });
});
