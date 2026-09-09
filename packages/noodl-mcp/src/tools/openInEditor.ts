/**
 * HLS-009 — `open_in_editor`: something other than a mouse opens a project.
 *
 * ## The route this closes
 *
 * [#38] reported the only way an agent could get a project in front of a person: write
 * `recently_opened_project.json` by hand, then click the project card over a Chrome debug port.
 * Both halves are wrong in the same way — they reach *around* the editor to operate its own
 * state, and neither survives the editor doing anything about it. The hand-written store row is
 * deleted by the next `LocalProjectsModel.store()`, which rewrites the whole array from memory;
 * the CDP click depends on the DOM of a screen that is being redesigned.
 *
 * This asks the editor instead. The editor registers the project, opens it, and answers.
 *
 * ## Why the relay, and not the other two doors #38 named
 *
 * - **`nodegx --project <dir>`** only exists at launch, and the case that matters is an editor
 *   the person *already has open* — which is the human/agent collaboration case, and the one a
 *   flag cannot serve. (Measured: `main.js` reads `process.argv` for `--dev`, `--textconv` and
 *   the merge driver. There is no `--project`, and adding one would still not answer this.)
 *
 * - **`nodegx://open?path=…`** is closer than #38 thought — 🔴 **the scheme is registered**;
 *   `main.js` calls `app.setAsDefaultProtocolClient('nodegx')` and the packaged build declares
 *   it. What is missing is the other end: `second-instance` forwards only URIs beginning
 *   `noodl:`, so a `nodegx://` argv is dropped without a word, and the renderer's one handler is
 *   the design-tool import path. But the decisive objection is not that it is unfinished, it is
 *   **that it has no credential**. A registered scheme is reachable by any web page the person
 *   visits, and `open?path=` on an unauthenticated channel is a stranger choosing which directory
 *   the editor opens and writes three files into. This repo already refuses exactly that string
 *   in another context (`aiMarkdownLinkPolicy`, which rejects `nodegx://open?project=/tmp/evil`).
 *
 * - **The relay** is loopback-only and token-gated as of HLS-006, and the token is a per-launch
 *   secret in the user's own user-data directory at mode 0600. A caller that can read it is
 *   already running as that user. That is the difference, and it is why this door is the one
 *   built.
 *
 * ## What this deliberately does not do
 *
 * ⚠️ **It never writes `recently_opened_project.json`.** `list_projects` reads that file and says
 * why it must not be written; the same reasoning applies with more force here, because this tool
 * runs *while the editor is up* and therefore races the one process that rewrites it wholesale.
 * The launcher entry appears because the editor made it, through `openProjectFromFolder` — the
 * same call the "Open project…" menu item makes. One writer before this task, one after.
 *
 * @module tools/openInEditor
 */

import * as fs from 'fs';
import * as path from 'path';

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { ToolError } from '../errors';
import { userDataCandidates } from './listProjects';
import { guarded, jsonResult } from './util';

/** Must match `relay-token.js` in the editor's main process. */
const TOKEN_FILENAME = 'relay-token';

/** The editor's default. `NOODLPORT` overrides it — see {@link relayPort}. */
const DEFAULT_RELAY_PORT = 8574;

/**
 * How long to wait for the editor's answer.
 *
 * ⚠️ **Sized for the work, not for a round trip.** The editor's reply is sent *after* the project
 * is loaded and routed, and a large v2 project on a cold page cache is seconds, not milliseconds.
 * A timeout tuned to the network would report failure while the project was opening — and the
 * person would then be looking at the project the tool had just said it could not open.
 */
const OPEN_TIMEOUT_MS = 30_000;

/** Long enough to notice a relay that accepts connections and never answers. */
const CLIENTS_TIMEOUT_MS = 5_000;

export interface OpenInEditorResponse {
  ok: boolean;
  /** `open`, `already-open`, `switch`, or `refuse` — the editor's own word for what it did. */
  disposition?: string;
  directory?: string;
  projectName?: string;
  leaving?: string;
  reason?: string;
  note: string;
}

interface TokenLookup {
  token?: string;
  searched: string[];
}

/**
 * Find the launch token.
 *
 * The environment first, so a second editor build or a harness can override a file another
 * process owns — the same order and the same reasoning as `nodegx-observe`'s `findRelayToken`.
 */
export function findRelayToken(): TokenLookup {
  const searched: string[] = ['$NODEGX_RELAY_TOKEN', '$NOODL_RELAY_TOKEN'];
  const fromEnv = process.env.NODEGX_RELAY_TOKEN || process.env.NOODL_RELAY_TOKEN;
  if (fromEnv) return { token: fromEnv, searched };

  for (const dir of userDataCandidates()) {
    const file = path.join(dir, TOKEN_FILENAME);
    searched.push(file);
    try {
      const token = fs.readFileSync(file, 'utf8').trim();
      if (token) return { token, searched };
    } catch {
      /* absent, or not ours to read — keep looking */
    }
  }
  return { searched };
}

/**
 * Which port the relay is on.
 *
 * 🔴 **This is a guess whenever the editor was launched with `NOODLPORT` and this process did not
 * inherit it**, and there is no file to read it from — the token is discoverable and the port is
 * not. It is right in the two cases that matter (the default, and a server the editor spawned
 * itself, which inherits the variable) and wrong for a second editor started by hand on another
 * port. Filed as C70 rather than papered over: the fix is for the editor to write the port beside
 * the token, and it belongs to whoever owns the relay's discovery story, not to this tool.
 */
export function relayPort(): number {
  const raw = process.env.NODEGX_RELAY_PORT || process.env.NOODLPORT;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_RELAY_PORT;
}

interface RelayPeer {
  clientId: string;
  type: string;
}

/**
 * One request, one socket, closed either way.
 *
 * ⚠️ **Registers as `service` and never names a service.** The relay keeps a `services` map keyed
 * by name and a second registration under the same name silently replaces the first, so a name
 * here would mean two MCP servers on one machine quietly evicting each other. Nothing needs to
 * route *to* this peer by name — the editor answers by `target`, using the `clientId` the request
 * carried — so the map is better left alone.
 *
 * ⚠️ **`type: 'service'` also keeps this out of the fan-out.** A peer registered as `viewer` or
 * `editor` receives every project export on the relay; this one receives only what is addressed
 * to it, which for a tool that sends one message and waits for one reply is the whole traffic.
 */
async function askEditorToOpen(directory: string): Promise<OpenInEditorResponse> {
  const lookup = findRelayToken();
  if (!lookup.token) {
    throw new ToolError(
      'not-found',
      'No NodeGX relay token was found, which almost always means the editor is not running on this ' +
        'machine. Start NodeGX and try again. (The editor mints a token per launch and writes it to its ' +
        'user-data directory; set NODEGX_RELAY_TOKEN to override.)',
      { searched: lookup.searched }
    );
  }

  const port = relayPort();
  const address = `ws://127.0.0.1:${port}`;
  const clientId = 'mcp-open-' + Math.random().toString(36).slice(2, 10);
  const requestId = Math.random().toString(36).slice(2, 12);

  // Node 22 ships a global WebSocket; the `ws` package is deliberately not a dependency of this
  // server, and `nodegx-observe` made the same call for the same reason.
  const WebSocketCtor = (globalThis as { WebSocket?: typeof WebSocket }).WebSocket;
  if (!WebSocketCtor) {
    throw new ToolError('io-error', 'This Node build has no global WebSocket; NodeGX requires Node 22 or newer.');
  }

  return new Promise<OpenInEditorResponse>((resolve, reject) => {
    const socket = new WebSocketCtor(address);
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function finish(outcome: { ok: true; value: OpenInEditorResponse } | { ok: false; error: Error }) {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      try {
        socket.close();
      } catch {
        /* already gone */
      }
      if (outcome.ok) resolve(outcome.value);
      else reject(outcome.error);
    }

    function arm(ms: number, error: Error) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => finish({ ok: false, error }), ms);
    }

    socket.addEventListener('open', () => {
      socket.send(JSON.stringify({ cmd: 'register', type: 'service', clientId, token: lookup.token }));
      // "Who is attached?" — the relay answers this itself (OBS-004), and it is the only way to
      // learn an editor window's clientId. A request sent without one would be broadcast to
      // *viewers*, because the relay fans a service peer's untargeted message to the opposite of
      // `viewer`, and would reach no editor at all.
      socket.send(JSON.stringify({ cmd: 'clients' }));
      arm(CLIENTS_TIMEOUT_MS, new ToolError('io-error', `The NodeGX relay at ${address} accepted the connection but did not answer.`));
    });

    socket.addEventListener('error', () => {
      finish({
        ok: false,
        error: new ToolError(
          'not-found',
          `Nothing is listening on the NodeGX relay at ${address}. Start NodeGX, or — if it is running on ` +
            'another port — set NOODLPORT to the port it was launched with.'
        )
      });
    });

    socket.addEventListener('close', () => {
      finish({
        ok: false,
        error: new ToolError(
          'io-error',
          'The NodeGX relay closed the connection. The most likely cause is a stale token: the editor ' +
            'mints a new one every launch, so a token read before the last restart is refused.'
        )
      });
    });

    socket.addEventListener('message', async (event: MessageEvent) => {
      const raw = typeof event.data === 'string' ? event.data : await (event.data as Blob).text();
      let message: Record<string, unknown>;
      try {
        message = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        return;
      }

      if (message.cmd === 'registerRejected') {
        finish({
          ok: false,
          error: new ToolError(
            'io-error',
            'The NodeGX relay rejected this token: ' +
              String(message.reason || 'no reason given') +
              '. The editor mints one per launch — if NodeGX has restarted, the token has changed.'
          )
        });
        return;
      }

      if (message.cmd === 'clients') {
        const peers = (Array.isArray(message.clients) ? message.clients : []) as RelayPeer[];
        const editors = peers.filter((p) => p && p.type === 'editor' && p.clientId);
        if (editors.length === 0) {
          finish({
            ok: false,
            error: new ToolError(
              'not-found',
              'The NodeGX relay is up but no editor window is attached to it, so there is nothing to open ' +
                'the project in. If NodeGX is starting, give it a moment and call again.'
            )
          });
          return;
        }
        // ⚠️ **Sent to every editor peer, not to the first.** `nodegx-observe` also registers as
        // `type: 'editor'` — the peer type is a label, not a capability — so "the first editor" is
        // as likely to be another agent's sidecar as it is to be a window. A sidecar ignores a
        // command it has no handler for, which means the reply can only come from a window. Two
        // real windows on one relay is not reachable: Electron holds a single-instance lock, and a
        // second editor needs its own `NOODLPORT` and therefore its own relay.
        for (const peer of editors) {
          socket.send(JSON.stringify({ cmd: 'openProject', target: peer.clientId, clientId, requestId, directory }));
        }
        arm(
          OPEN_TIMEOUT_MS,
          new ToolError(
            'io-error',
            `The editor did not answer within ${OPEN_TIMEOUT_MS / 1000}s. It may still be opening the project — ` +
              'check the window before calling again.'
          )
        );
        return;
      }

      if (message.cmd === 'openProjectResult' && message.requestId === requestId) {
        let result: Record<string, unknown> = {};
        try {
          result = JSON.parse(String(message.content)) as Record<string, unknown>;
        } catch {
          /* an answer we cannot read is an answer that failed */
        }
        finish({ ok: true, value: { ...(result as object), note: noteFor(result) } as OpenInEditorResponse });
      }
    });
  });
}

/** The sentence attached to the result — what the caller should do next, in each disposition. */
export function noteFor(result: Record<string, unknown>): string {
  switch (result.disposition) {
    case 'already-open':
      return 'That project was already open in the editor; the window has been brought to the front and nothing else changed.';
    case 'switch':
      return (
        'The editor was showing a different project. Its pending edits were written to disk first, and it is ' +
        'now showing this one.'
      );
    case 'open':
      // ⚠️ Said here because the caller is the one accountable for it. Opening a project is a
      // *write* to that project: the editor backfills `.mcp.json` and `CLAUDE.md` on every open,
      // person-triggered or not. A person choosing a folder in a file dialog has consented to
      // that; an agent passing a path has consented on their behalf, so the tool says what it
      // did rather than leaving two new files to be discovered by `git status`.
      return (
        'The editor is now showing this project, and it has been added to the launcher\'s recent projects. ' +
        'Opening a project also writes its agent configuration (.mcp.json and CLAUDE.md) if it is missing — ' +
        'the same files a person opening it from the editor would get.'
      );
    case 'refuse':
      return 'The editor did not open it. The reason names what to change.';
    default:
      return 'The editor answered in a shape this tool did not recognise.';
  }
}

const openInEditorSchema = {
  directory: z
    .string()
    .describe('Absolute path to the project directory to show — the `directory` field of a list_projects row.')
};

export function registerOpenInEditorTools(server: McpServer): void {
  server.registerTool(
    'open_in_editor',
    {
      title: 'Show a project in the running NodeGX editor',
      description:
        'Ask the NodeGX editor the user already has open to open a project, so they can see what you built ' +
        'without clicking anything. Use it after create_project, or after editing a project the user is not ' +
        'currently looking at. Requires NodeGX to be running on this machine. Opening a project makes the ' +
        'editor write its agent config (.mcp.json, CLAUDE.md) into it if missing, exactly as a person opening ' +
        'it would. Opening one the editor already has open is a no-op that brings the window to the front.',
      inputSchema: openInEditorSchema
    },
    guarded(async (args: { directory: string }) => jsonResult(await askEditorToOpen(args.directory)))
  );
}
