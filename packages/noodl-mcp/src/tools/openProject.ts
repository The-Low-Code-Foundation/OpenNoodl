/**
 * FIX-008 D — `open_project`: the door into a project that already exists.
 *
 * ## The class of bug this closes
 *
 * BST-001 gave this server a mode with no project, and BST-002 gave that mode
 * one way out: `create_project`, which binds the project it just wrote. So an
 * agent that discovers — via `list_projects`, the tool built for exactly this —
 * that the user already has the app they are talking about could name the
 * directory, describe it, and do nothing with it. The only advice available was
 * *"start a server with that directory as its argument"*, which is a
 * configuration errand handed to a person who does not know what an MCP
 * registration is. That is the phase's report 5 in its final form: the two
 * remaining fixes (A, B) stop the server binding to the *wrong* project, and
 * this one stops there being no way to bind it to the *right* one.
 *
 * 🔴 **The failure it removes is not an error message — it is a second project.**
 * A model that cannot open the existing app and has `create_project` advertised
 * will scope and build a new one beside it. `BOOTSTRAP_INSTRUCTIONS` spends a
 * paragraph mitigating that with ordering alone, because until now ordering was
 * the only lever there was: naming `list_projects` first cannot help if the
 * thing it finds is unopenable.
 *
 * ## Why this is not the `use_project` contract the phase refused
 *
 * `ProjectBinding.bind` refuses the second bind, and its header says why: a
 * server that silently repoints mid-session answers twenty subsequent tool calls
 * about a different project, and nothing in any response says which project it
 * is describing. **That boundary is kept exactly.** This tool binds a server
 * that has *no* project; it never moves one that has. On an already-bound server
 * it reports where it is bound and stops, which is the same answer a second
 * `create_project` gets and for the same reason.
 *
 * So the shape is: one bind per process, from either of two doors.
 *
 * ## What it deliberately does not do
 *
 * ⚠️ **No `.mcp.json`, no `CLAUDE.md`, no launcher entry.** Fix B backfills those
 * when the *editor* opens a project, where the user has chosen the project in a
 * UI. Writing into a directory because a model passed its path to a tool is a
 * different act with a different consent behind it, and this tool's whole
 * argument for existing is that it needs no files on disk to work.
 *
 * @module tools/openProject
 */

import * as fs from 'fs';
import * as path from 'path';

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { authoringServerName, quoteArg } from '../editor-deps';
import { ToolError } from '../errors';
import { completeBind, type BindResult, type CreateProjectBinding } from './createProject';
import { guarded, jsonResult } from './util';

/**
 * `open_project` returns a bind and nothing else, so its response *is* the bind.
 *
 * `create_project` nests the same object under `bound` because the bind is a
 * consequence there and the created project is the subject. Here it is the
 * subject, and a wrapper would only give a reader two places to look.
 */
export type OpenProjectResponse = BindResult;

const openProjectSchema = {
  directory: z
    .string()
    .describe(
      'Absolute path to an existing NodeGX v2 project directory — the `directory` field of a list_projects row.'
    )
};

interface OpenProjectArgs {
  directory: string;
}

/**
 * The registration command for a directory this server cannot bind to, built
 * from **how this very process was launched**.
 *
 * 🔴 **Derived, not guessed, and that is the whole reason it is trustworthy.**
 * The editor's `buildMcpCommands` has to *decide* a runtime — is there a `node`
 * on this machine, or must the app binary be run as node — and it probes to find
 * out. This server needs no probe: `process.execPath` and `process.argv[1]` are
 * a runtime and an entry point that are demonstrably working right now, because
 * they are the ones serving the call being answered. A command copied from a
 * live configuration cannot be wrong about the install it was copied from.
 *
 * 🔴 **`-e` goes AFTER the server name.** `claude mcp add` declares it variadic
 * (`-e, --env <env...>`), so an `-e` before the name swallows the name as a
 * second variable and the command dies with `Invalid environment variable
 * format: nodegx`. That was found by MCP-001 running the emitted command against
 * the real client rather than by reading it, and it is re-stated here because
 * this is a second assembler of the same command — see `claudeMcpAdd` in
 * `mcpCommands.ts`, which is private to that module.
 *
 * ⚠️ **`--scope project` is resolved against the shell's cwd** and the CLI has no
 * flag naming a target directory (checked against 2.1.228), which is why the
 * sentence carrying this command has to name the folder to run it in. FIX-008 C
 * made that dependency visible rather than solving it; there is still no CLI
 * affordance for it.
 */
export function registrationCommandFor(projectDir: string): string {
  const entry = process.argv[1];
  // `execPath` is an Electron binary whenever the server was launched by the
  // editor's own command, and that binary only speaks stdio-as-node with this
  // set. It is read off the environment rather than sniffed from the path,
  // because the environment is the thing that actually decides the behaviour.
  const env = process.env.ELECTRON_RUN_AS_NODE ? ['-e', 'ELECTRON_RUN_AS_NODE=1'] : [];
  return [
    'claude',
    'mcp',
    'add',
    '--scope',
    'project',
    authoringServerName(projectDir),
    ...env,
    '--',
    quoteArg(process.execPath),
    ...(entry ? [quoteArg(entry)] : []),
    quoteArg(projectDir),
    '--allow-writes'
  ].join(' ');
}

/**
 * What to say when this server is already serving something else.
 *
 * ⚠️ **The same-directory case is answered separately, and it is not pedantry.**
 * `bind()` returns `false` for "already bound" without regard to *what* it is
 * bound to, so an agent that calls `open_project` on the project this server is
 * already serving — the obvious thing to do after reading a `list_projects` row,
 * and after a client restart the model did not observe — would otherwise be told
 * "this server stays bound to X" where X is precisely what it asked for. That
 * reads as a refusal, and the recovery from a refusal is another call or a
 * different project. It is a success, and it says so.
 */
function alreadyBoundNote(servingDir: string, requestedDir: string): string {
  if (path.resolve(servingDir) === requestedDir) {
    return (
      `This server is already bound to ${requestedDir} — the project you asked for. Nothing changed and ` +
      'nothing needed to: its tools are already advertised, so go ahead and read or author in it.'
    );
  }
  return (
    `This server stays bound to ${servingDir} and did NOT open ${requestedDir} — a server binds once, so ` +
    'every tool you call here still reads and writes the project it was already serving. Do not describe ' +
    `your next calls as being about ${requestedDir}. To work in it, the user can register a second server ` +
    `for it by running this in ${requestedDir}:\n\n  ${registrationCommandFor(requestedDir)}\n\n` +
    'That registers the project in its own .mcp.json; the first agent started there is asked to approve it ' +
    'once. Alternatively, restart this server with that directory as its argument.'
  );
}

/**
 * ⚠️ **Registered inside the write gate**, beside `create_project`, and the two
 * reasons are worth separating.
 *
 * The one that matters: an **unbound server is always `--allow-writes`** —
 * `createServer` refuses the unbound read-only combination at startup, because
 * with no project there is nothing to read. So this tool is present in every
 * server that could ever use it, and the gate costs it nothing.
 *
 * The one that does not: binding is not itself a write. A *bound* read-only
 * server therefore does not advertise this tool — which is correct by accident
 * and correct on purpose, since such a server would refuse the call anyway.
 */
export function registerOpenProjectTools(server: McpServer, bind: CreateProjectBinding): void {
  server.registerTool(
    'open_project',
    {
      title: 'Open an existing NodeGX project in this server',
      description:
        'Point this server at a NodeGX project that already exists on disk, and get the reading and authoring ' +
        'tools in this same conversation — no second registration and no restart. Call this after list_projects ' +
        'when the user means a project they already have; it is what makes editing the real app possible instead ' +
        'of building a second one beside it. Takes the `directory` from a list_projects row. A server binds ' +
        'once: if one is already bound this reports where and changes nothing. Legacy projects must be migrated ' +
        'in the NodeGX editor first.',
      inputSchema: openProjectSchema
    },
    guarded((args: OpenProjectArgs) => {
      const raw = typeof args.directory === 'string' ? args.directory.trim() : '';
      if (!raw) {
        throw new ToolError(
          'invalid-argument',
          'A project directory is required — pass the `directory` field of a list_projects row.'
        );
      }
      const directory = path.resolve(raw);

      // ⚠️ Ordered before the bind on purpose. `bind()` answers "already bound"
      // without ever looking at the argument, so on a bound server a typo'd or
      // absent path would be reported as a binding conflict — a true statement
      // that sends the reader after the wrong problem.
      if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) {
        throw new ToolError(
          'not-found',
          `Project directory does not exist: ${directory}. Call list_projects for the projects on this machine — ` +
            'its rows carry directories that were verified to exist when it answered.'
        );
      }

      // 🔴 The store is constructed inside `bind()`, so *this* is what refuses a
      // legacy or non-project directory — with `ProjectStore`'s own wording,
      // which names the migration path and is the string the editor mirrors.
      // Re-phrasing it here would put a third spelling of that sentence in the
      // product; letting it through means an agent and a settings panel say the
      // same thing about the same folder.
      const didBind = bind.binding.bind(directory);

      if (!didBind) {
        const servingDir = bind.binding.projectDir ?? directory;
        const refused: OpenProjectResponse = {
          bound: false,
          projectDir: servingDir,
          toolsRevealed: [],
          note: alreadyBoundNote(servingDir, directory)
        };
        return jsonResult(refused);
      }

      const opened: OpenProjectResponse = completeBind(bind, directory);
      return jsonResult(opened);
    })
  );
}
