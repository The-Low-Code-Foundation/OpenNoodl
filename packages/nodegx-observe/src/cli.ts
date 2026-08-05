/**
 * CLI entry: `nodegx-observe [--token <token>] [--port 8574]`
 *
 * Speaks MCP over stdio. All human-facing output goes to **stderr** — stdout is the protocol
 * channel, and one stray `console.log` there corrupts the session in a way that looks like a
 * client bug.
 *
 * ⚠️ **This is not `noodl-mcp`.** That server reads a project *directory* on disk and refuses
 * legacy formats. This one attaches to a *running app* over the editor's local relay, needs no
 * project access at all, and works on any format — because the running runtime supplies both
 * the names and the topology.
 *
 * They used to ship as two binaries from one package, for packaging convenience. They are now
 * two packages: the spec's standing warning is that the two must not be *confused*, and one
 * `npm install` producing both worked against exactly that.
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { createObserveServer } from './server';
import { RelayClient } from './relayClient';
import { describeMissingToken, findRelayToken } from './token';

const USAGE = `Usage: nodegx-observe [options]

Observes and drives a RUNNING NodeGX app over the editor's local relay (port 8574).
Needs the editor running with a project open and the preview started. Needs no
access to the project on disk.

Options:
  --token <token>  The relay token. Default: $NODEGX_RELAY_TOKEN, then the
                   editor's <userData>/relay-token file.
  --port <port>    Relay port. Default: $NOODLPORT, then 8574.
  --version        Print version and exit.
  --help           Show this help.

Example MCP client configuration:
  { "command": "nodegx-observe" }
`;

function flag(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  return index !== -1 ? argv[index + 1] : undefined;
}

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

  const explicitToken = flag(argv, '--token');
  const lookup = findRelayToken(explicitToken);
  if (!lookup.token) {
    process.stderr.write(describeMissingToken(lookup) + '\n');
    process.exitCode = 2;
    return;
  }

  const portArg = flag(argv, '--port');
  const client = new RelayClient({
    token: lookup.token,
    port: portArg ? Number(portArg) : undefined,
    // MCP-003 — the reason this is a function and not the token above. This process outlives
    // the editor: an MCP client holds a stdio server for a whole session while the editor is
    // quit and restarted, and each launch mints a *new* token. Re-running the same lookup keeps
    // the `--token` / `$NODEGX_RELAY_TOKEN` / file precedence exactly as it was at startup, so
    // an explicit token stays explicit and a discovered one is re-discovered.
    refreshToken: () => findRelayToken(explicitToken).token
  });

  try {
    await client.connect();
  } catch (err) {
    // ⚠️ Fail here rather than registering the tools and letting each one fail in turn. A
    // server that starts cleanly and then answers "could not connect" to every call reads as
    // a broken server; refusing to start reads as "the editor is not running", which is what
    // is actually true.
    process.stderr.write(`nodegx-observe: ${(err as Error).message}\n`);
    process.exitCode = 2;
    return;
  }

  const clients = await client.discoverClients().catch(() => [] as string[]);
  process.stderr.write(
    `nodegx-observe connected to ${client.address} (token from ${lookup.source}); ` +
      (clients.length ? `${clients.length} preview client(s)` : 'no preview running yet') +
      '\n'
  );

  await createObserveServer(client).connect(new StdioServerTransport());
}

main().catch((err) => {
  process.stderr.write(`nodegx-observe: ${err && err.stack ? err.stack : err}\n`);
  process.exitCode = 1;
});
