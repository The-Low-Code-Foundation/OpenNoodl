/**
 * CLI entry: `noodl-preview <project-dir> [--port N]`
 *
 * Loads a NodeGX project headlessly, serves it with the deployed runtime, and
 * rebuilds on every change to the directory. No editor process, no WebSocket
 * protocol, no cloud service.
 *
 * @module noodl-preview/cli
 */

import type { FSWatcher } from 'chokidar';

// Must be first: binds @noodl/platform and populates NodeLibrary before any
// editor module is touched. See headless.ts.
import { bootstrapNodeLibrary } from './headless';

import { describeAccess, lanAddress, resolveAccess, shareUrl } from '../../nodegx-export/src/serve/access';

import { assertDeployAssets, loadPreview, resolveTarget, type ProjectFormat } from './loader';
import { PreviewServer } from './server';
import { startWatching } from './watcher';

const USAGE = `Usage: noodl-preview <project-dir> [options]

Renders a NodeGX (OpenNoodl) project in a browser and reloads it when the files
on disk change. Accepts a v2 project directory or a legacy project.json.

Options:
  --port <n>        Port to listen on (default 8575, 0 for any free port).
  --host <addr>     Address to bind (default 127.0.0.1). Any address but loopback also turns
                    on the token: the printed URL carries it, and without it nothing is served.
  --token <t>       Use this token rather than minting one.
  --debounce <ms>   Quiet period before rebuilding after a change (default 120).
  --no-watch        Render once and serve; do not watch for changes.
  --open            Open the preview in the default browser.
  --version         Print version and exit.
  --help            Show this help.

Point it at the folder your agent is editing:
  noodl-preview ./my-project --open
`;

interface Args {
  target: string;
  port: number;
  host: string;
  token: string | null;
  debounce: number;
  watch: boolean;
  open: boolean;
}

function parseArgs(argv: string[]): Args | null {
  const args: Args = { target: '', port: 8575, host: '127.0.0.1', token: null, debounce: 120, watch: true, open: false };
  const positional: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--port':
        args.port = Number(argv[++i]);
        break;
      case '--host':
        args.host = argv[++i];
        break;
      case '--token':
        args.token = argv[++i];
        break;
      case '--debounce':
        args.debounce = Number(argv[++i]);
        break;
      case '--no-watch':
        args.watch = false;
        break;
      case '--open':
        args.open = true;
        break;
      default:
        if (a.startsWith('--')) {
          process.stderr.write(`Unknown option: ${a}\n`);
          return null;
        }
        positional.push(a);
    }
  }

  if (positional.length !== 1) return null;
  if (!Number.isFinite(args.port) || !Number.isFinite(args.debounce)) return null;
  args.target = positional[0];
  return args;
}

const log = (message: string) => process.stdout.write(`${message}\n`);

/** Loads one snapshot and pushes the outcome to the server. Never throws. */
async function rebuild(server: PreviewServer, dir: string, format: ProjectFormat, quiet = false): Promise<void> {
  const started = Date.now();
  const result = await loadPreview(dir, format);
  const ms = Date.now() - started;

  switch (result.status) {
    case 'ok':
      server.setBuild(result.build);
      for (const warning of result.build.warnings) log(`  ! ${warning}`);
      if (result.report.summary.warnings > 0) {
        log(`  ! ${result.report.summary.warnings} validation warning(s) — rendering anyway`);
      }
      if (!quiet) log(`  ✓ rendered in ${ms}ms`);
      break;
    case 'invalid':
      server.setInvalid(result.report);
      log(`  ✗ ${result.report.summary.errors} error(s) — showing diagnostics, keeping last good render`);
      for (const d of result.report.diagnostics.filter((x) => x.severity === 'error').slice(0, 5)) {
        log(`      ${d.component}${d.nodeId ? ` › ${d.nodeId}` : ''}: ${d.message}`);
      }
      break;
    case 'error':
      server.setError(result.message);
      log(`  ✗ ${result.message}`);
      break;
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write(USAGE);
    return;
  }
  if (argv.includes('--version')) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    process.stdout.write(`${require('../package.json').version}\n`);
    return;
  }

  const args = parseArgs(argv);
  if (!args) {
    process.stderr.write(USAGE);
    process.exitCode = 2;
    return;
  }

  let dir: string;
  let format: ProjectFormat;
  try {
    assertDeployAssets();
    ({ dir, format } = resolveTarget(args.target));
  } catch (err) {
    process.stderr.write(`noodl-preview: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exitCode = 2;
    return;
  }

  const types = bootstrapNodeLibrary();
  log(`noodl-preview — ${dir} (${format}), ${types} node types`);

  // HLS-006 — `--host` is a person deciding to leave loopback, so it is the thing that sets
  // `share`; anything else arriving as a host is ignored, which is what keeps the port from being
  // re-opened by a config nobody read.
  const shared = args.host !== '127.0.0.1' && args.host !== 'localhost';
  const access = resolveAccess({ share: shared, host: args.host, token: args.token });
  const server = new PreviewServer({ projectDir: dir, port: args.port, host: args.host, access });
  let port: number;
  try {
    port = await server.listen();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(
      `noodl-preview: could not listen on ${args.host}:${args.port} — ${message}\n` +
        'Another preview may already be running; try --port 0 for any free port.\n'
    );
    process.exitCode = 2;
    return;
  }

  await rebuild(server, dir, format);

  const url = shared ? shareUrl(lanAddress() ?? args.host, port, access.token) : `http://${args.host}:${port}`;
  log(`  → ${url}`);
  if (shared) {
    // A shared preview that does not say it is shared is the half of #31 that was not about a
    // socket at all.
    log(`  ${describeAccess(access, port, lanAddress() ?? undefined)}`);
  }

  let watcher: FSWatcher | null = null;
  if (args.watch) {
    watcher = startWatching({
      dir,
      debounceMs: args.debounce,
      onChange: (paths) => {
        log(`· ${paths.length} change(s), rebuilding…`);
        void rebuild(server, dir, format);
      }
    });
    log(`  watching for changes (debounce ${args.debounce}ms) — Ctrl-C to stop`);
  }

  if (args.open) {
    const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('child_process').spawn(opener, [url], { detached: true, stdio: 'ignore' }).unref();
  }

  const shutdown = () => {
    log('\nstopping…');
    void (watcher?.close() ?? Promise.resolve()).then(() => server.close()).then(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  process.stderr.write(`noodl-preview: ${err && err.stack ? err.stack : err}\n`);
  process.exit(1);
});
