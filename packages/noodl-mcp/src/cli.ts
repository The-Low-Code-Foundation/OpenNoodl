/**
 * CLI entry: `noodl-mcp [project-dir] [--allow-writes]`
 * Speaks MCP over stdio. All human-facing output goes to stderr — stdout is
 * the protocol channel.
 *
 * BST-001 — the project directory is optional. With none, the server starts in
 * bootstrap mode: four tools that need no project, and a briefing for an agent
 * that has not got one. Zero positionals used to be the usage-and-exit-2 branch,
 * so {@link USAGE} is where somebody first reads that the mode exists — which is
 * why it says what zero means rather than only what one means.
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { reapOrphanedBackends } from './backend/reaper';
import { ToolError } from './errors';
import { createServer } from './server';
import { BOOTSTRAP_TOOLS } from './toolGroups';

const USAGE = `Usage: noodl-mcp [project-dir] [options]

Serves a NodeGX (OpenNoodl) v2 project directory over the Model Context Protocol (stdio).

With NO project directory the server starts in bootstrap mode: it advertises
list_projects, create_project, list_examples and get_example, and nothing else.
That is the mode for a machine with no projects yet — the agent finds what is
already there, or scopes and creates one, and a server is then started against
that directory. Bootstrap mode requires --allow-writes, because creating a
project is a write and there is nothing to read.

Options:
  --allow-writes   Register the authoring tools (create/update/delete component).
                   Default is read-only. Required when no project directory is given.
  --all-tools      Advertise every tool from the first tools/list. By default the
                   authoring set is advertised and the backend, docs, project and
                   theme groups are revealed on demand via find_tools — 60 of the
                   89 tools are backend admin, and they are re-sent every turn.
                   Use this for a client that ignores tools/list_changed.
  --version        Print version and exit.
  --help           Show this help.

Example MCP client configuration:
  { "command": "noodl-mcp", "args": ["/path/to/project", "--allow-writes"] }

  and with no project yet:
  { "command": "noodl-mcp", "args": ["--allow-writes"] }
`;

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h')) {
    process.stderr.write(USAGE);
    return;
  }
  if (argv.includes('--version')) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    process.stderr.write(require('../package.json').version + '\n');
    return;
  }

  const allowWrites = argv.includes('--allow-writes');
  const deferTools = !argv.includes('--all-tools');
  const positional = argv.filter((a) => !a.startsWith('--'));
  // BST-001 — zero is bootstrap mode, one is a served project, two is still a
  // mistake. `createServer` refuses zero-without---allow-writes with a message
  // naming the flag, rather than this branch printing the whole usage at
  // somebody who got one thing wrong.
  if (positional.length > 1) {
    process.stderr.write(USAGE);
    process.exitCode = 2;
    return;
  }

  // AAQ-011/F13 — reap first, serve second.
  //
  // This process may spawn backends, and it is the worst spawner in the product
  // for orphaning them: no window to close, no quit event, and a client that can
  // SIGKILL it at any moment. Startup is the one reliable moment we get, so a
  // dead session's backends are cleaned up before this one adds any of its own.
  // Deliberately awaited (a sweep is milliseconds unless something needs
  // killing) and deliberately never fatal: a reaper that cannot start a server
  // is worse than one that misses a process. It reports to stderr because stdout
  // is the MCP protocol channel.
  try {
    const reaped = (await reapOrphanedBackends()).filter((row) => row.outcome !== 'owner-alive' && row.outcome !== 'self');
    for (const row of reaped) {
      process.stderr.write(
        `noodl-mcp: orphaned backend "${row.backendName}" (${row.backendId}, pid ${row.pid}, port ${row.port}): ` +
          `${row.outcome}${row.detail ? ` — ${row.detail}` : ''}\n`
      );
    }
  } catch (err) {
    process.stderr.write(`noodl-mcp: orphan sweep failed (${err instanceof Error ? err.message : err})\n`);
  }

  try {
    const { server, binding, disclosure } = createServer({ projectDir: positional[0], allowWrites, deferTools });
    // AWP-006 — the surface is now a decision, so it is stated at startup rather
    // than inferred from a tools/list. `--all-tools` is named here because the
    // one failure mode of deferral is a client that never re-lists, and the
    // person who can fix that is reading stderr.
    //
    // ⚠️ BST-001 — this line is the one diagnostic a person configuring a client
    // actually reads, and unbound it must not print a directory the server does
    // not have. It names the state and the exit instead: a banner that said
    // "serving undefined" is how somebody spends an afternoon looking for a
    // path bug in a server that started exactly as asked.
    if (!binding.isBound) {
      process.stderr.write(
        `noodl-mcp: no project bound — bootstrap mode (${BOOTSTRAP_TOOLS.length} tools: ` +
          `${BOOTSTRAP_TOOLS.join(', ')}). Call list_projects or create_project, or restart with a project ` +
          'directory as the argument.\n'
      );
    } else {
      const advertised = disclosure.groupStates().filter((g) => g.advertised);
      const held = disclosure.groupStates().filter((g) => !g.advertised);
      process.stderr.write(
        `noodl-mcp serving ${binding.projectDir} (${allowWrites ? 'read-write' : 'read-only'}) on stdio\n` +
          `noodl-mcp advertising ${advertised.reduce((n, g) => n + g.tools, 0)} tools` +
          (held.length > 0
            ? `; ${held.reduce((n, g) => n + g.tools, 0)} held behind find_tools (${held
                .map((g) => `${g.group}:${g.tools}`)
                .join(', ')}) — pass --all-tools to advertise everything\n`
            : ' (--all-tools)\n')
      );
    }
    await server.connect(new StdioServerTransport());
  } catch (err) {
    if (err instanceof ToolError) {
      process.stderr.write(`noodl-mcp: ${err.message}\n`);
      process.exitCode = 2;
      return;
    }
    throw err;
  }
}

void main();
