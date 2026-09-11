/**
 * FLD-010 — `session_status`: is a person in here, and are they mid-edit?
 *
 * ## What this is for
 *
 * [#41] reported an agent and a human writing the same project files at once. It asked for three
 * things; **R6 ruled two of them out** (2026-09-11) and this is the third. The lock is not built
 * and the reason is measured rather than deferred: FLD-009 already makes the editor refuse to
 * reload over a dirty buffer and re-read before autosaving, so an agent does not need to *hold*
 * anything. It needs to know — before it applies a plan — that somebody is looking at the file
 * it is about to rewrite.
 *
 * ## 🔴 The one rule this tool is built around: it must never lie about a person
 *
 * The dangerous answer is not "I don't know". It is a confident `editorAttached: false` produced
 * by a transport that failed — an agent told nobody is home, applying a plan over a person's
 * unsaved work. So **every failure this tool can have maps to `status: 'unknown'`**, and
 * `editorAttached` is `null` there rather than `false`. `false` is reserved for the one case the
 * transport can actually establish: the relay did not answer on the port, and the relay lives
 * *inside* the editor's own main process, so nothing listening is genuinely nobody home.
 *
 * ⚠️ **Liveness is "can I register on the relay", never "does a file exist".** The editor writes
 * `relay-token` on launch and **never unlinks it on quit** (verified 2026-09-11: `relay-token.js`
 * has no `unlink` in it), so a token on disk proves only that the editor once ran. This tool
 * therefore tries the socket in every case, including when it finds no token at all.
 *
 * ## What it deliberately reuses
 *
 * The whole transport is HLS-009's, unchanged: register as a `service` peer, ask the relay
 * `cmd:'clients'` for the attached editors, and address the request to each by `target`.
 * 🔴 **No relay change was needed and none was made** — FLD-010's own §2 says the routing is
 * "wrong for this use", which is true of *broadcast* and irrelevant to `target`, a branch that
 * ignores peer type entirely and has carried an agent→editor command since HLS-009 shipped.
 *
 * @module tools/sessionStatus
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { findRelayToken, relayPort } from './openInEditor';
import { guarded, jsonResult } from './util';

/**
 * How long to wait for the editor to describe itself.
 *
 * ⚠️ **Sized for a round trip, unlike `open_in_editor`'s.** That tool waits for a project to
 * load; this one waits for a synchronous read of state already in memory. A long timeout here
 * would only make an editor too old to have the handler look like a slow one.
 */
const STATUS_TIMEOUT_MS = 4_000;

/** Long enough to notice a relay that accepts connections and never answers. */
const CLIENTS_TIMEOUT_MS = 3_000;

/**
 * @see the module note. `status` is the field to branch on; `editorAttached` is the same fact in
 * the shape #41 asked for, with `null` for "could not tell".
 */
export interface SessionStatusResponse {
  /**
   * - `attached` — an editor window is on the relay and answered.
   * - `attached-no-answer` — a window is registered but did not answer. It is almost certainly an
   *   editor older than this tool. **A person may well be there**, which is why this is not `false`.
   * - `no-editor` — nothing is listening on the relay port.
   * - `unknown` — the transport failed in a way that says nothing about whether a person is here.
   */
  status: 'attached' | 'attached-no-answer' | 'no-editor' | 'unknown';
  /** `true`/`false` where it is established, `null` where it is not. Never guessed. */
  editorAttached: boolean | null;
  /** Whether the attached editor has the project this call asked about. `null` if not asked or not known. */
  sameProject: boolean | null;
  directory?: string | null;
  projectName?: string | null;
  currentComponent?: string | null;
  unsavedBuffers?: boolean | null;
  unsavedComponents?: string[] | null;
  unsavedComponentsUnknownReason?: string;
  /** What to do with this answer, in words. Always present. */
  note: string;
}

interface RelayPeer {
  clientId: string;
  type: string;
}

/** The `unknown` answer, with the sentence that says what failed and what it does NOT mean. */
function unknown(what: string): SessionStatusResponse {
  return {
    status: 'unknown',
    editorAttached: null,
    sameProject: null,
    note:
      what +
      ' This is a transport failure, not an answer: it does NOT mean nobody has the project open. ' +
      'Treat it as "a person may be editing" and say so rather than writing over their work.'
  };
}

function noEditor(address: string): SessionStatusResponse {
  return {
    status: 'no-editor',
    editorAttached: false,
    sameProject: null,
    note:
      `Nothing is listening on the NodeGX relay at ${address}, and the relay runs inside the editor's ` +
      'own process — so no editor is running here. It is safe to edit the project files. (If NodeGX was ' +
      'launched on a non-default port, set NOODLPORT to it; this tool cannot discover the port.)'
  };
}

async function askEditorForStatus(directory?: string): Promise<SessionStatusResponse> {
  // 🔴 No token is not an answer, so this does not return here. The socket is tried either way —
  // see the module note on liveness. A missing token only decides what a *rejection* means.
  const lookup = findRelayToken();
  const port = relayPort();
  const address = `ws://127.0.0.1:${port}`;
  const clientId = 'mcp-status-' + Math.random().toString(36).slice(2, 10);
  const requestId = Math.random().toString(36).slice(2, 12);

  const WebSocketCtor = (globalThis as { WebSocket?: typeof WebSocket }).WebSocket;
  if (!WebSocketCtor) {
    return unknown('This Node build has no global WebSocket, so the editor could not be asked.');
  }

  return new Promise<SessionStatusResponse>((resolve) => {
    const socket = new WebSocketCtor(address);
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    /** Set once the relay names an editor peer — the difference between `no-editor` and a timeout. */
    let sawEditorPeer = false;

    function finish(value: SessionStatusResponse) {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      try {
        socket.close();
      } catch {
        /* already gone */
      }
      resolve(value);
    }

    function arm(ms: number, value: () => SessionStatusResponse) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => finish(value()), ms);
    }

    socket.addEventListener('open', () => {
      socket.send(JSON.stringify({ cmd: 'register', type: 'service', clientId, token: lookup.token }));
      socket.send(JSON.stringify({ cmd: 'clients' }));
      arm(CLIENTS_TIMEOUT_MS, () =>
        unknown(`The NodeGX relay at ${address} accepted the connection but never said who is attached.`)
      );
    });

    // 🔴 The one branch that may answer `false`. A connection error on the relay port means the
    // relay is not there, and the relay is part of the editor's main process.
    socket.addEventListener('error', () => finish(noEditor(address)));

    socket.addEventListener('close', () => {
      // A close before any answer, having connected, is the relay hanging up — which for this
      // transport means the token was refused. Something IS listening, so an editor is almost
      // certainly running; this is the textbook case that must not read as "nobody home".
      finish(
        unknown(
          'The NodeGX relay closed the connection, which almost always means a stale token — the editor ' +
            'mints a new one every launch. Something is listening on ' +
            address +
            ', so an editor probably IS running; this tool just could not authenticate to it.' +
            (lookup.token ? '' : ' No relay token was found on this machine at all.')
        )
      );
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
        finish(
          unknown(
            'The NodeGX relay rejected this token (' +
              String(message.reason || 'no reason given') +
              '). Something is listening, so an editor probably IS running — the token just does not match ' +
              'this launch.'
          )
        );
        return;
      }

      if (message.cmd === 'clients') {
        const peers = (Array.isArray(message.clients) ? message.clients : []) as RelayPeer[];
        const editors = peers.filter((p) => p && p.type === 'editor' && p.clientId);
        if (editors.length === 0) {
          // 🔴 AC2's case, and it is the reason the false arm is measured against a live relay
          // rather than a closed port. The relay is up, so the editor process is up — its
          // renderer just has not registered yet (it registers about a second after launch).
          // Saying "no editor" here would be true of the *window* and misleading about the
          // person, so it is `unknown`.
          finish(
            unknown(
              `The NodeGX relay at ${address} is up but no editor window has registered on it, which is what ` +
                'a starting editor looks like for about a second.'
            )
          );
          return;
        }
        sawEditorPeer = true;
        // Sent to every editor peer, for HLS-009's reason: `nodegx-observe` registers as `editor`
        // too, so "the first editor" may be another agent's sidecar. A sidecar has no handler and
        // stays silent, so only a window can answer.
        for (const peer of editors) {
          socket.send(JSON.stringify({ cmd: 'sessionStatus', target: peer.clientId, clientId, requestId }));
        }
        arm(STATUS_TIMEOUT_MS, () => ({
          status: 'attached-no-answer' as const,
          editorAttached: true,
          sameProject: null,
          note:
            'An editor window is attached to the relay but did not answer within ' +
            STATUS_TIMEOUT_MS / 1000 +
            's — most likely a NodeGX older than this tool. Someone has the editor open; assume they may be ' +
            'editing and do not write over the project without saying so.'
        }));
        return;
      }

      if (message.cmd === 'sessionStatusResult' && message.requestId === requestId) {
        let result: Record<string, unknown> = {};
        try {
          result = JSON.parse(String(message.content)) as Record<string, unknown>;
        } catch {
          /* an answer we cannot read is an answer that failed */
        }
        if (typeof result.error === 'string') {
          finish(unknown('The editor answered but could not read its own state: ' + result.error + '.'));
          return;
        }
        finish(compose(result, directory));
      }
    });

    // Guard against a socket that neither opens, errors nor closes.
    arm(CLIENTS_TIMEOUT_MS, () =>
      sawEditorPeer ? unknown('The editor stopped answering.') : unknown(`No reply of any kind from ${address}.`)
    );
  });
}

/** Turn the editor's reading into the caller's answer, including what it should do about it. */
export function compose(result: Record<string, unknown>, directory?: string): SessionStatusResponse {
  const editorDir = (result.directory as string | null) ?? null;
  const sameProject = directory && editorDir ? samePath(directory, editorDir) : null;
  const unsavedBuffers = (result.unsavedBuffers as boolean | undefined) ?? null;
  const unsavedComponents = (result.unsavedComponents as string[] | null | undefined) ?? null;

  return {
    status: 'attached',
    editorAttached: true,
    sameProject,
    directory: editorDir,
    projectName: (result.projectName as string | null) ?? null,
    currentComponent: (result.currentComponent as string | null) ?? null,
    unsavedBuffers,
    unsavedComponents,
    ...(typeof result.unsavedComponentsUnknownReason === 'string'
      ? { unsavedComponentsUnknownReason: result.unsavedComponentsUnknownReason }
      : {}),
    note: noteFor({ sameProject, unsavedBuffers, unsavedComponents, result })
  };
}

function noteFor(args: {
  sameProject: boolean | null;
  unsavedBuffers: boolean | null;
  unsavedComponents: string[] | null;
  result: Record<string, unknown>;
}): string {
  const { sameProject, unsavedBuffers, unsavedComponents, result } = args;

  if (!result.projectOpen) {
    return 'The editor is open with no project loaded. Nobody is looking at a project, so editing files is safe.';
  }

  const who =
    'Someone has ' +
    (result.projectName ? `"${String(result.projectName)}"` : 'a project') +
    ' open in the NodeGX editor' +
    (result.currentComponent ? `, looking at ${String(result.currentComponent)}` : '') +
    '.';

  if (sameProject === false) {
    return (
      who +
      ' That is NOT the project you asked about, so your edits are not racing them — but note that opening ' +
      'a different project in that window would discard nothing of theirs only after they save.'
    );
  }

  const dirty = unsavedComponents && unsavedComponents.length > 0;
  if (unsavedBuffers || dirty) {
    return (
      who +
      ' 🔴 They have unsaved edits' +
      (dirty ? ' in ' + unsavedComponents!.join(', ') : '') +
      '. The editor will refuse to reload those from disk, so a write from you would be ignored there and ' +
      'then overwritten by their next save. Tell them what you want to change and wait, or work on a ' +
      'component not in that list.'
    );
  }

  return (
    who +
    ' Nothing is unsaved, so the editor will pick up files you write. Say what you are changing before you ' +
    'change it — they are looking at this project right now.'
  );
}

/**
 * Same directory?
 *
 * Compared with trailing separators stripped and, on macOS and Windows, case-insensitively —
 * the same normalisation a path equality check needs anywhere, and getting it wrong here reports
 * a conflict as "a different project", which is the wrong direction to be wrong in.
 */
function samePath(a: string, b: string): boolean {
  const norm = (p: string) => {
    const trimmed = p.replace(/[\\/]+$/, '');
    return process.platform === 'linux' ? trimmed : trimmed.toLowerCase();
  };
  return norm(a) === norm(b);
}

const sessionStatusSchema = {
  directory: z
    .string()
    .optional()
    .describe('Absolute path of the project you are about to edit, to report whether it is the one that is open.')
};

export function registerSessionStatusTools(server: McpServer): void {
  server.registerTool(
    'session_status',
    {
      title: 'Is a person editing this project right now?',
      description:
        'Ask the running NodeGX editor whether a human has a project open and has unsaved edits, before you ' +
        'write to that project. Returns editorAttached, the project and component they are on, and which ' +
        'components differ from disk. A transport failure answers "unknown", never "nobody is here".',
      inputSchema: sessionStatusSchema
    },
    guarded(async (args: { directory?: string }) => jsonResult(await askEditorForStatus(args.directory)))
  );
}
