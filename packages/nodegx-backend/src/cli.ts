/**
 * CLI entry point for the standalone backend service.
 *
 *   nodegx-backend serve  --data-dir <dir> --port <p> [--host <h>] [--token <t>] [--ephemeral]
 *   nodegx-backend doctor --data-dir <dir> [--ephemeral]
 *
 * `serve`  starts the (health-only, in the front half) HTTP service and stays up.
 * `doctor` opens persistence, prints status, and exits — a deterministic,
 *          port-free headless smoke that proves engine resolution + persistence
 *          with no Electron present.
 *
 * @module nodegx-backend/cli
 */

import { BackendService } from './service';
import { createAdapter } from './persistence/createAdapter';
import { BackendServiceOptions } from './config';

interface ParsedArgs {
  command: string;
  options: Partial<BackendServiceOptions>;
}

function parseArgs(argv: string[]): ParsedArgs {
  const command = argv[0] || 'help';
  const options: Partial<BackendServiceOptions> = {};

  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => argv[++i];
    switch (arg) {
      case '--data-dir':
        options.dataDir = next();
        break;
      case '--port':
        options.port = parseInt(next(), 10);
        break;
      case '--host':
        options.host = next();
        break;
      case '--token':
        options.authToken = next();
        break;
      case '--ephemeral':
        options.allowEphemeral = true;
        break;
      default:
        if (arg.startsWith('--')) {
          process.stderr.write(`Unknown flag: ${arg}\n`);
        }
    }
  }

  return { command, options };
}

const USAGE = `nodegx-backend — standalone NodeGX backend service (WF-004)

Usage:
  nodegx-backend serve  --data-dir <dir> --port <p> [--host <h>] [--token <t>] [--ephemeral]
  nodegx-backend doctor --data-dir <dir> [--ephemeral]

Commands:
  serve    Start the service and stay running. (Front-half scaffold: /health only;
           data/auth/function routes return 501 until the second half relocates them.)
  doctor   Open persistence, print status, and exit. Port-free headless smoke.

Options:
  --data-dir <dir>   Directory for the SQLite file, files, and config.
  --port <p>         TCP port (0 = OS-assigned). Default 8577.
  --host <h>         Bind interface. Default 127.0.0.1 (localhost). A non-loopback
                     host requires --token (one is generated if omitted).
  --token <t>        Bearer token for non-localhost binds.
  --ephemeral        Run without persistence if no SQLite engine loads (data lost
                     on restart). Off by default — the service refuses to fake it.
`;

async function runServe(options: Partial<BackendServiceOptions>): Promise<void> {
  const service = new BackendService(options);
  const started = await service.start();
  const s = started.persistence.status;

  process.stdout.write(`[nodegx-backend] listening on ${started.listen.url}\n`);
  process.stdout.write(`[nodegx-backend] data-dir: ${started.options.dataDir}\n`);
  process.stdout.write(
    `[nodegx-backend] persistence: ${s.mode} (engine: ${s.engine || 'none'})` +
      (s.ephemeral ? '  ** DATA IS NOT PERSISTED **' : '') +
      '\n'
  );
  if (service.requiresAuth()) {
    process.stdout.write('[nodegx-backend] non-loopback bind: bearer token REQUIRED for requests\n');
  }

  const shutdown = async (signal: string) => {
    process.stdout.write(`\n[nodegx-backend] ${signal} — shutting down\n`);
    await started.stop();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

async function runDoctor(options: Partial<BackendServiceOptions>): Promise<void> {
  const dataDir = options.dataDir || require('./config').resolveOptions(options).dataDir;
  const handle = await createAdapter({ dataDir, allowEphemeral: !!options.allowEphemeral });
  const s = handle.status;
  process.stdout.write(`[nodegx-backend doctor] node ${process.versions.node}\n`);
  process.stdout.write(`[nodegx-backend doctor] db: ${handle.dbPath}\n`);
  process.stdout.write(`[nodegx-backend doctor] persistence mode: ${s.mode}\n`);
  process.stdout.write(`[nodegx-backend doctor] engine: ${s.engine || 'none'}\n`);
  process.stdout.write(`[nodegx-backend doctor] persistent: ${s.persistent}, ephemeral: ${s.ephemeral}\n`);
  await handle.adapter.disconnect();
  process.stdout.write('[nodegx-backend doctor] OK\n');
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  const { command, options } = parseArgs(argv);

  switch (command) {
    case 'serve':
      await runServe(options);
      break;
    case 'doctor':
      await runDoctor(options);
      break;
    case 'help':
    case '--help':
    case '-h':
      process.stdout.write(USAGE);
      break;
    default:
      process.stderr.write(`Unknown command: ${command}\n\n${USAGE}`);
      process.exitCode = 2;
  }
}

if (require.main === module) {
  main().catch((err) => {
    // Loud failure: print the actionable message (e.g. LocalBackendPersistenceError)
    // and exit non-zero. The service never silently degrades.
    process.stderr.write(`[nodegx-backend] FATAL: ${err && err.message ? err.message : err}\n`);
    process.exit(1);
  });
}
