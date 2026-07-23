/**
 * CLI entry: `noodl-mcp <project-dir> [--allow-writes]`
 * Speaks MCP over stdio. All human-facing output goes to stderr — stdout is
 * the protocol channel.
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { ToolError } from './errors';
import { createServer } from './server';

const USAGE = `Usage: noodl-mcp <project-dir> [options]

Serves a NodeGX (OpenNoodl) v2 project directory over the Model Context Protocol (stdio).

Options:
  --allow-writes   Register the authoring tools (create/update/delete component).
                   Default is read-only.
  --version        Print version and exit.
  --help           Show this help.

Example MCP client configuration:
  { "command": "noodl-mcp", "args": ["/path/to/project", "--allow-writes"] }
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
  const positional = argv.filter((a) => !a.startsWith('--'));
  if (positional.length !== 1) {
    process.stderr.write(USAGE);
    process.exitCode = 2;
    return;
  }

  try {
    const { server, store } = createServer({ projectDir: positional[0], allowWrites });
    process.stderr.write(
      `noodl-mcp serving ${store.projectDir} (${allowWrites ? 'read-write' : 'read-only'}) on stdio\n`
    );
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
