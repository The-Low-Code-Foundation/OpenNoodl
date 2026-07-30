/**
 * CLI entry point for the standalone backend service.
 *
 *   nodegx-backend serve  --data-dir <dir> --port <p> [--host <h>] [--token <t>]
 *                         [--backend-id <id>] [--backend-name <name>] [--ephemeral]
 *   nodegx-backend doctor --data-dir <dir> [--ephemeral]
 *
 * `serve`  starts the full HTTP service (BYOB + Parse-wire + admin) and stays up.
 *          When ready it prints a single machine-readable line to stdout:
 *            NODEGX_BACKEND_READY {"port":...,"url":...}
 *          — the editor's supervisor handshakes on that line (and falls back to
 *          polling /health).
 * `doctor` opens persistence, prints status, and exits — a deterministic,
 *          port-free headless smoke that proves engine resolution + persistence
 *          with no Electron present.
 *
 * @module nodegx-backend/cli
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { BackendService } from './service';
import { createAdapter } from './persistence/createAdapter';
import { AdapterFacade } from './persistence/AdapterFacade';
import { BackendServiceOptions, resolveOptions } from './config';
import { ExecutionHistory } from './execution/ExecutionStore';
import { BackupConfigStore } from './backup/config';
import { BackupAuditActor, BackupManager } from './backup/BackupManager';
import { ARCHIVE_EXT } from './backup/archive';
import { AuditLog, ensureAuditTable } from './ops/audit';
import { OpsState } from './ops/OpsState';
import { exportCollection, importCollection, DataFormat } from './backup/dataio';
import {
  applySchema,
  diffSchema,
  renderDiff,
  SchemaSnapshot,
  snapshotFromArchive,
  snapshotFromDataDir
} from './backup/schema-migrate';

interface ParsedArgs {
  command: string;
  /** Positional (non-flag) args after the command, in order. */
  positionals: string[];
  options: Partial<BackendServiceOptions>;
  /** Command-specific flags (backup/restore/export/import/schema). */
  extras: Record<string, string | boolean>;
}

function parseArgs(argv: string[]): ParsedArgs {
  const command = argv[0] || 'help';
  const options: Partial<BackendServiceOptions> = {};
  const extras: Record<string, string | boolean> = {};
  const positionals: string[] = [];

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
      case '--backend-id':
        options.backendId = next();
        break;
      case '--backend-name':
        options.backendName = next();
        break;
      case '--ephemeral':
        options.allowEphemeral = true;
        break;
      // BAK-005 admin dashboard
      case '--no-admin':
        options.adminDashboard = false;
        break;
      case '--readonly-token':
        options.readonlyToken = next();
        break;
      // BAK-007 command flags
      case '--dest':
        extras.dest = next();
        break;
      case '--out':
        extras.out = next();
        break;
      case '--format':
        extras.format = next();
        break;
      case '--include-secrets':
        extras.includeSecrets = true;
        break;
      case '--dry-run':
        extras.dryRun = true;
        break;
      case '--allow-destructive':
        extras.allowDestructive = true;
        break;
      case '--no-safety':
        extras.noSafety = true;
        break;
      // Orphan guard: exit when the supervisor that spawned us is gone. Not a
      // BackendServiceOptions field — it governs this process's lifetime, not
      // the service's behaviour.
      case '--parent-pid':
        extras.parentPid = next();
        break;
      default:
        if (arg.startsWith('--')) {
          process.stderr.write(`Unknown flag: ${arg}\n`);
        } else {
          positionals.push(arg);
        }
    }
  }

  return { command, positionals, options, extras };
}

// ============================================================================
// BAK-007 helpers
// ============================================================================

function requireDataDir(options: Partial<BackendServiceOptions>): string {
  const resolved = resolveOptions(options);
  return resolved.dataDir;
}

/**
 * BAK-009 follow-up: a CLI-driven backup/restore is exactly as privileged as
 * its HTTP admin-route equivalent, but it never passes through HttpServer's
 * dispatcher — the request-scoped place that stamps `_Audit` rows for every
 * other privileged action — so it never got one. This factory opens the same
 * `ops.json`-configured `AuditLog` the service itself would, against
 * whichever dataDir BackupManager names (its own for a backup, the restore
 * TARGET for a restore — see BackupManager's module doc for why that must be
 * opened lazily, after the call completes, rather than held open across it).
 * `_Audit` is ensured here because a data dir driven only by the CLI may
 * never have called `ensureSystemTables`.
 */
async function openCliAuditLog(dataDir: string, allowEphemeral: boolean): Promise<{ audit: AuditLog; close: () => Promise<void> }> {
  const handle = await createAdapter({ dataDir, allowEphemeral });
  const facade = new AdapterFacade(handle.adapter);
  ensureAuditTable(facade.schemaManager);
  const ops = new OpsState(dataDir);
  const audit = new AuditLog({ facade, getConfig: () => ops.config.audit });
  return { audit, close: () => handle.adapter.disconnect() };
}

function cliBackupManager(options: Partial<BackendServiceOptions>): { manager: BackupManager; config: BackupConfigStore; dataDir: string } {
  const resolved = resolveOptions(options);
  const dataDir = resolved.dataDir;
  const executions = new ExecutionHistory();
  executions.open(dataDir);
  const config = new BackupConfigStore(dataDir);
  const dbPath = path.join(dataDir, 'data', 'local.db');
  const allowEphemeral = !!options.allowEphemeral;
  const manager = new BackupManager({
    dataDir,
    dbPath,
    executions,
    config,
    backendId: resolved.backendId,
    backendName: resolved.backendName,
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    getSchema: () => require('./backup/schema-migrate').tablesFromDbFile(dbPath),
    openAudit: (auditDataDir: string) => openCliAuditLog(auditDataDir, allowEphemeral)
  });
  return { manager, config, dataDir };
}

/** The audit actor for every CLI-driven privileged call (BAK-009). */
function cliActor(): BackupAuditActor {
  return { actorKind: 'cli', actor: os.userInfo().username || '', ip: 'cli' };
}

/** Detect whether a path is a backup archive or a data dir, and snapshot it. */
function snapshotFromPath(p: string): SchemaSnapshot {
  if (p.endsWith(ARCHIVE_EXT)) return snapshotFromArchive(p);
  return snapshotFromDataDir(p);
}

async function withFacade<T>(dataDir: string, fn: (facade: AdapterFacade) => Promise<T> | T): Promise<T> {
  const handle = await createAdapter({ dataDir });
  const facade = new AdapterFacade(handle.adapter);
  try {
    // Ensure the built-in tables exist so a query on an empty backend doesn't SQL-error.
    return await fn(facade);
  } finally {
    await handle.adapter.disconnect();
  }
}

const USAGE = `nodegx-backend — standalone NodeGX backend service (WF-004)

Usage:
  nodegx-backend serve  --data-dir <dir> --port <p> [--host <h>] [--token <t>]
                        [--backend-id <id>] [--backend-name <name>] [--ephemeral]
                        [--no-admin] [--readonly-token <t>]
  nodegx-backend doctor --data-dir <dir> [--ephemeral]

  nodegx-backend backup  --data-dir <dir> [--dest <dir>] [--include-secrets]
  nodegx-backend restore <archive> --data-dir <dir> [--no-safety]
  nodegx-backend export  <collection> --data-dir <dir> [--format json|csv] [--out <file>]
  nodegx-backend import  <collection> <file> --data-dir <dir> [--format json|csv] [--dry-run]
  nodegx-backend schema  diff  <source> <target>
  nodegx-backend schema  apply <source> --data-dir <target> [--allow-destructive]

Commands:
  serve    Start the service and stay running: BYOB /api routes, the Parse-wire
           subset (/classes, /aggregate, /files, /functions, /config, sessions),
           and the admin surface (/admin, /executions).
  doctor   Open persistence, print status, and exit. Port-free headless smoke.
  backup   Write a consistent whole-backend archive (db snapshot + files +
           workflows + config + manifest) and rotate old ones per retention.
  restore  Restore an archive into a data dir (service stopped). Verifies the
           manifest hashes, takes a pre-restore safety snapshot, then swaps.
  export   Export one collection as lossless JSON or flat CSV.
  import   Import one collection (upsert by objectId; --dry-run previews).
  schema   diff/apply schema + config promotion (dev -> prod). Additive applies
           automatically; destructive needs --allow-destructive (backs up first).

Options:
  --data-dir <dir>       Directory for the SQLite files, uploads, and workflows.
  --port <p>             TCP port (0 = OS-assigned). Default 8577.
  --host <h>             Bind interface. Default 127.0.0.1 (localhost). A
                         non-loopback host requires --token (one is generated
                         if omitted).
  --token <t>            Bearer token for non-localhost binds.
  --backend-id <id>      Backend identity (doubles as the app id). Default
                         "nodegx-backend".
  --backend-name <name>  Display name reported by /health.
  --ephemeral            Run without persistence if no SQLite engine loads (data
                         lost on restart). Off by default — the service refuses
                         to fake it.
  --no-admin             Do not serve the admin dashboard. The /_admin route is
                         not registered at all (404), not merely blocked.
  --parent-pid <pid>     Exit when this process is gone. Set by a supervisor that
                         wants the backend to die with it even when the
                         supervisor itself is force-killed and cannot say so.
  --readonly-token <t>   Provision the READ-ONLY admin credential: it can read
                         everything the admin surface exposes and change
                         nothing. Never minted automatically — a backend has
                         this tier only if you ask for it.
`;

async function runServe(options: Partial<BackendServiceOptions>, parentPid?: number): Promise<void> {
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
  process.stdout.write(
    `[nodegx-backend] execution history: ${
      started.executionHistory.enabled ? started.executionHistory.dbPath : `DISABLED (${started.executionHistory.error})`
    }\n`
  );
  process.stdout.write(`[nodegx-backend] workflows: ${started.workflows.workflowCount} loaded\n`);
  process.stdout.write(
    `[nodegx-backend] security: ${
      started.security.enforced
        ? 'ENFORCED (collection permissions + row ACLs active)'
        : 'dev-open (all access relaxed; loopback only)'
    }\n`
  );
  if (service.requiresAuth()) {
    process.stdout.write(
      '[nodegx-backend] non-loopback bind: data routes governed by permissions/sessions; admin routes require the admin credential\n'
    );
  }

  // BAK-005: say where the dashboard is, and — when nobody has ever chosen an
  // admin credential — where to find the one that was just minted. An operator
  // who cannot find the credential cannot use the dashboard at all, so this is
  // part of the feature, not a nicety.
  if (started.options.adminDashboard) {
    process.stdout.write(`[nodegx-backend] admin dashboard: ${started.listen.url}/_admin\n`);
    if (started.security.adminTokenMintedThisStart) {
      process.stdout.write(
        `[nodegx-backend]   FIRST RUN: an admin credential was generated for this backend. Read it from\n` +
          `[nodegx-backend]   ${path.join(started.options.dataDir, 'secrets.json')} ("adminToken"), or restart with\n` +
          `[nodegx-backend]   --token <your-own-secret> to choose your own.\n`
      );
    }
    if (started.security.hasReadonlyTier) {
      process.stdout.write('[nodegx-backend]   a read-only admin credential is provisioned\n');
    }
  } else {
    process.stdout.write('[nodegx-backend] admin dashboard: DISABLED (--no-admin); /_admin is not routed\n');
  }

  // Machine-readable readiness line — the editor supervisor handshakes on this.
  process.stdout.write(
    `NODEGX_BACKEND_READY ${JSON.stringify({
      port: started.listen.port,
      url: started.listen.url,
      persistence: s.mode,
      engine: s.engine
    })}\n`
  );

  // BAK-009 graceful shutdown. `docker stop` and systemd both send SIGTERM and
  // then SIGKILL after a grace period (10s and 90s respectively), so the drain
  // has to be bounded and the exit has to be prompt. A second signal means the
  // operator is out of patience: stop draining and go.
  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) {
      process.stdout.write(`[nodegx-backend] second ${signal} — exiting immediately\n`);
      process.exit(1);
    }
    shuttingDown = true;
    process.stdout.write(`\n[nodegx-backend] ${signal} — draining in-flight requests, then shutting down\n`);
    try {
      await started.stop();
      process.stdout.write('[nodegx-backend] stopped cleanly\n');
      process.exit(0);
    } catch (e) {
      // Exit non-zero: a shutdown that could not finish is not a clean one, and
      // a supervisor deserves to know the difference.
      process.stderr.write(`[nodegx-backend] shutdown error: ${e instanceof Error ? e.message : e}\n`);
      process.exit(1);
    }
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  // Orphan guard. When the editor spawns us it is our parent, and a *graceful*
  // editor shutdown stops us on the way out. A force-kill of the editor does
  // not: we are reparented to init and keep the port, the cron schedules and the
  // SSE loop alive with nobody left to talk to. Poll the supervisor and drain
  // ourselves when it disappears.
  if (parentPid) {
    const guard = setInterval(() => {
      try {
        process.kill(parentPid, 0);
      } catch (e) {
        // EPERM means it exists under another user — still alive, keep serving.
        if ((e as NodeJS.ErrnoException).code === 'EPERM') return;
        clearInterval(guard);
        process.stdout.write(`[nodegx-backend] supervisor ${parentPid} is gone — shutting down\n`);
        void shutdown('parent exit');
      }
    }, 5000);
    // Do not let the guard alone hold the process open once the server is down.
    guard.unref();
  }
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

// ============================================================================
// BAK-007 commands
// ============================================================================

async function runBackup(options: Partial<BackendServiceOptions>, extras: Record<string, string | boolean>): Promise<void> {
  const { manager, config } = cliBackupManager(options);
  if (extras.includeSecrets) config.update({ includeSecrets: true });
  const result = await manager.createBackup({
    triggerType: 'manual',
    source: 'cli backup',
    destinationDir: typeof extras.dest === 'string' ? extras.dest : undefined,
    actor: cliActor()
  });
  process.stdout.write(`[nodegx-backend] backup written: ${result.archivePath}\n`);
  process.stdout.write(
    `[nodegx-backend]   ${result.bytes} bytes, snapshot via ${result.manifest.snapshotMechanism}, ` +
      `${result.manifest.entries.length} entries${result.manifest.includesSecrets ? ' (INCLUDES SECRETS)' : ''}\n`
  );
  if (result.deleted.length) process.stdout.write(`[nodegx-backend]   retention deleted ${result.deleted.length} old archive(s)\n`);
}

async function runRestore(
  positionals: string[],
  options: Partial<BackendServiceOptions>,
  extras: Record<string, string | boolean>
): Promise<void> {
  const archive = positionals[0];
  if (!archive) throw new Error('restore requires an archive path: nodegx-backend restore <archive> --data-dir <dir>');
  const { manager } = cliBackupManager(options);
  const result = await manager.restore(archive, {
    triggerType: 'manual',
    source: 'cli restore',
    safetySnapshot: !extras.noSafety,
    actor: cliActor()
  });
  process.stdout.write(`[nodegx-backend] restored ${result.entriesWritten} entries into ${result.targetDataDir}\n`);
  if (result.safetyArchive) process.stdout.write(`[nodegx-backend]   pre-restore safety snapshot: ${result.safetyArchive}\n`);
  process.stdout.write(`[nodegx-backend]   integrity_check: ${result.integrity.detail}\n`);
}

async function runExport(
  positionals: string[],
  options: Partial<BackendServiceOptions>,
  extras: Record<string, string | boolean>
): Promise<void> {
  const collection = positionals[0];
  if (!collection) throw new Error('export requires a collection: nodegx-backend export <collection> --data-dir <dir>');
  const format = (typeof extras.format === 'string' ? extras.format : 'json') as DataFormat;
  const dataDir = requireDataDir(options);
  const result = await withFacade(dataDir, (facade) => exportCollection(facade, collection, format));
  if (typeof extras.out === 'string') {
    fs.writeFileSync(extras.out, result.content);
    process.stdout.write(`[nodegx-backend] exported ${result.count} record(s) from ${collection} -> ${extras.out}\n`);
  } else {
    process.stdout.write(result.content);
  }
}

async function runImport(
  positionals: string[],
  options: Partial<BackendServiceOptions>,
  extras: Record<string, string | boolean>
): Promise<void> {
  const collection = positionals[0];
  const file = positionals[1];
  if (!collection || !file) {
    throw new Error('import requires a collection and file: nodegx-backend import <collection> <file> --data-dir <dir>');
  }
  const format = (typeof extras.format === 'string' ? extras.format : file.endsWith('.csv') ? 'csv' : 'json') as DataFormat;
  const content = fs.readFileSync(file, 'utf-8');
  const dataDir = requireDataDir(options);
  const report = await withFacade(dataDir, (facade) =>
    importCollection(facade, collection, content, { format, dryRun: !!extras.dryRun })
  );
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  if (report.error && !report.rejected.length) process.exitCode = 1;
}

async function runSchema(
  positionals: string[],
  options: Partial<BackendServiceOptions>,
  extras: Record<string, string | boolean>
): Promise<void> {
  const sub = positionals[0];
  if (sub === 'diff') {
    const [, source, target] = positionals;
    if (!source || !target) throw new Error('schema diff requires <source> <target> (archive or data dir paths)');
    const diff = diffSchema(snapshotFromPath(source), snapshotFromPath(target));
    process.stdout.write(renderDiff(diff) + '\n');
    return;
  }
  if (sub === 'apply') {
    const source = positionals[1];
    if (!source) throw new Error('schema apply requires <source> --data-dir <target> [--allow-destructive]');
    const dataDir = requireDataDir(options);
    const src = snapshotFromPath(source);
    const target = snapshotFromDataDir(dataDir);
    const diff = diffSchema(src, target);
    process.stdout.write(renderDiff(diff) + '\n');
    const { manager } = cliBackupManager(options);
    const result = await withFacade(dataDir, (facade) =>
      applySchema({ schemaManager: facade.schemaManager, dataDir }, src, diff, {
        allowDestructive: !!extras.allowDestructive,
        backupManager: manager
      })
    );
    process.stdout.write('\nApplied:\n' + JSON.stringify(result, null, 2) + '\n');
    return;
  }
  throw new Error('schema requires a subcommand: diff | apply');
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  const { command, positionals, options, extras } = parseArgs(argv);

  switch (command) {
    case 'serve': {
      const parentPid = typeof extras.parentPid === 'string' ? parseInt(extras.parentPid, 10) : NaN;
      await runServe(options, Number.isFinite(parentPid) && parentPid > 1 ? parentPid : undefined);
      break;
    }
    case 'doctor':
      await runDoctor(options);
      break;
    case 'backup':
      await runBackup(options, extras);
      break;
    case 'restore':
      await runRestore(positionals, options, extras);
      break;
    case 'export':
      await runExport(positionals, options, extras);
      break;
    case 'import':
      await runImport(positionals, options, extras);
      break;
    case 'schema':
      await runSchema(positionals, options, extras);
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
