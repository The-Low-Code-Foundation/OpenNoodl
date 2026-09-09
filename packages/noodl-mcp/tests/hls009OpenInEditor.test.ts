/**
 * HLS-009 — `open_in_editor`, graded against the editor's **real** relay.
 *
 * ## Why the real relay and not a stub
 *
 * The interesting part of this tool is not the request it sends, it is where the relay puts it.
 * The relay is a typed broadcast: an untargeted message from a `service` peer fans to *viewers*,
 * a targeted one goes to one socket by `clientId`, and a peer's `type` is a label anyone may
 * claim. A stub relay would fan messages the way this test's author believed the real one does,
 * and would therefore pass whether or not the tool is addressing anybody — which is precisely
 * HLS-010's finding restated: a control that reproduces your expected failure mode is not the
 * same as a control that reproduces the failure. So `startWebSocketServer` here is the editor's
 * own module, imported across the package boundary on purpose.
 *
 * What is faked is the *editor window* — a socket that registers as `type: 'editor'` and answers
 * `openProject`. That half is faked because it is the half this suite is not grading;
 * `noodl-editor/tests-unit/hls009OpenDisposition.test.ts` grades the decision it would make.
 */

import * as http from 'http';
import type { AddressInfo } from 'net';

import WebSocket from 'ws';

import { call, connect, copyFixture, reveal, type TestSession } from './helpers';
import type { OpenInEditorResponse } from '../src/tools/openInEditor';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { startWebSocketServer } = require('../../noodl-editor/src/main/src/relay-server.js');

const TOKEN = 'hls009-test-token';

/** A peer that behaves like an attached window: registers as `editor`, answers `openProject`. */
interface FakeEditor {
  socket: WebSocket;
  /** Every `openProject` it was sent, in order. Cardinality is an assertion below, not a detail. */
  received: Array<Record<string, unknown>>;
  close(): void;
}

describe('HLS-009 — open_in_editor over the real project relay', () => {
  let server: http.Server;
  let port: number;
  let session: TestSession;
  const peers: FakeEditor[] = [];
  const savedEnv: Record<string, string | undefined> = {};

  beforeAll(async () => {
    server = http.createServer((_req, res) => res.end());
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = (server.address() as AddressInfo).port;
    // The `isValidToken` seam the relay exposes for exactly this — `relay-auth.test.js` uses it
    // the same way. It replaces the process-wide launch token, not the gate.
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

  afterEach(() => {
    while (peers.length) peers.pop()!.close();
  });

  /**
   * @param answer what to reply with, or `null` to stay silent — which is how a `nodegx-observe`
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
      if (msg.cmd !== 'openProject') return;
      peer.received.push(msg);
      if (!answer) return;
      socket.send(
        JSON.stringify({
          cmd: 'openProjectResult',
          target: msg.clientId,
          requestId: msg.requestId,
          content: JSON.stringify(answer)
        })
      );
    });

    return peer;
  }

  /**
   * 🔴 The manifest note admits the cost of appending to the `project` group instead of naming
   * this tool in a `purpose`: a model browsing group purposes will not meet it. The keyword is
   * therefore the door, and this asserts the door opens rather than assuming it — the same thing
   * `kitTools.test.ts` does for `create_node_kit`, which is behind the identical trade.
   *
   * ⚠️ On its **own** session, deliberately. The shared one has already revealed the group in
   * `beforeAll`, and `find_tools` on an advertised group answers `revealed: []` — a green here
   * against that session would be asserting that a tool already on the surface is on the surface.
   */
  it('is reachable through find_tools by a word a model would actually type', async () => {
    const fresh = await connect(copyFixture());
    try {
      const found = await call<{ revealed: string[] }>(fresh, 'find_tools', { query: 'editor' });
      expect(found.isError).toBe(false);
      expect(found.data.revealed).toContain('open_in_editor');
    } finally {
      await fresh.close();
    }
  });

  it('carries the editor’s answer back to the caller', async () => {
    await attachFakeEditor('editor-window', {
      ok: true,
      disposition: 'open',
      directory: '/tmp/shop',
      projectName: 'Shop'
    });

    const res = await call<OpenInEditorResponse>(session, 'open_in_editor', { directory: '/tmp/shop' });

    expect(res.isError).toBe(false);
    expect(res.data.ok).toBe(true);
    expect(res.data.disposition).toBe('open');
    expect(res.data.projectName).toBe('Shop');
    // 🔴 The note is what tells the caller that opening a project WROTE two files into it. A
    // response that reported success without saying so would leave `.mcp.json` and `CLAUDE.md` to
    // be discovered by `git status`, on a directory the agent chose on the person's behalf.
    expect(res.data.note).toContain('.mcp.json');
  });

  it('sends the request addressed, so it reaches the window rather than the fan-out', async () => {
    const editor = await attachFakeEditor('editor-window', { ok: true, disposition: 'already-open' });

    await call<OpenInEditorResponse>(session, 'open_in_editor', { directory: '/tmp/shop' });

    expect(editor.received).toHaveLength(1);
    expect(editor.received[0].target).toBe('editor-window');
    expect(editor.received[0].directory).toBe('/tmp/shop');
    // The reply address. Without it the editor's answer would be broadcast to every viewer on the
    // relay and to no agent at all — delivered precisely everywhere it is useless.
    expect(typeof editor.received[0].clientId).toBe('string');
  });

  /**
   * 🔴 The property the fan-out exists for.
   *
   * `nodegx-observe` registers as `type: 'editor'`, so "the first editor peer" is as likely to be
   * another agent's sidecar as a window. Targeting one and hoping would fail intermittently and
   * look like a flake. Every `editor` peer gets the request; only a window answers.
   */
  it('finds the real window when a silent peer claims the same type', async () => {
    const sidecar = await attachFakeEditor('observe-sidecar', null);
    const window = await attachFakeEditor('editor-window', { ok: true, disposition: 'open', projectName: 'Shop' });

    const res = await call<OpenInEditorResponse>(session, 'open_in_editor', { directory: '/tmp/shop' });

    expect(res.data.projectName).toBe('Shop');
    expect(sidecar.received).toHaveLength(1);
    expect(window.received).toHaveLength(1);
  });

  it('reports a refusal from the editor as a refusal, not as a transport failure', async () => {
    await attachFakeEditor('editor-window', {
      ok: false,
      disposition: 'refuse',
      reason: 'There is no directory at "/tmp/gone".'
    });

    const res = await call<OpenInEditorResponse>(session, 'open_in_editor', { directory: '/tmp/gone' });

    expect(res.data.ok).toBe(false);
    expect(res.data.reason).toContain('/tmp/gone');
  });

  /**
   * ⚠️ A relay that is up with no window attached is a different failure from a relay that is not
   * there, and the two need different sentences: one says "wait a moment", the other says "start
   * NodeGX". Reporting both as "the editor is not running" would send a person to restart an app
   * that is already open.
   */
  it('says the relay is up but no window is attached, when that is what is true', async () => {
    const res = await call<{ error?: { code: string; message: string } }>(session, 'open_in_editor', {
      directory: '/tmp/shop'
    });

    expect(res.isError).toBe(true);
    expect(res.data.error?.message).toContain('no editor window is attached');
  });

  it('reports a rejected token as a token problem', async () => {
    await attachFakeEditor('editor-window', { ok: true, disposition: 'open' });
    process.env.NODEGX_RELAY_TOKEN = 'not-the-launch-token';
    try {
      const res = await call<{ error?: { message: string } }>(session, 'open_in_editor', { directory: '/tmp/shop' });
      expect(res.isError).toBe(true);
      expect(res.data.error?.message).toMatch(/token/i);
    } finally {
      process.env.NODEGX_RELAY_TOKEN = TOKEN;
    }
  });
});
