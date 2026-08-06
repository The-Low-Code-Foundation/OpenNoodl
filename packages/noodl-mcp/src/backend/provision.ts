/**
 * AAQ-011/F13 — provisioning: `noodl-mcp` starts and owns a `nodegx-backend`.
 *
 * Richard's decision, 2026-08-06: **yes, `noodl-mcp` may provision backends** —
 * because an external agent must be able to build a full-stack app end to end,
 * and without this the third of Layer 1's project-level effects (page
 * registration, `bodyScroll`, a backend) does not port with the other two.
 *
 * This is the editor's `provisionBackend.ts` written for a process with no IPC:
 * the same four steps, the same on-disk layout, and deliberately the same
 * reuse/refusal rules, so the two spawners produce interchangeable results.
 *
 *   1. **Create** `<backendsRoot>/<id>/{config.json,data/,workflows/}` with an
 *      allocated port — the layout `BackendManager.createBackend` writes.
 *   2. **Start** it as a child of this process, with `--parent-pid`.
 *   3. **Create the collections**, advisory: `nodegx-backend` makes a collection
 *      on first write anyway, so a failure here is a warning on a succeeded
 *      provision, never a failed provision.
 *   4. **Bind the project** — `nodegx.project.json → metadata.cloudservices`,
 *      the exact `{instanceId, endpoint, appId, type}` shape
 *      `projectmodel.editor.setCloudServices` writes.
 *
 * ## Should this refuse when an editor is running? — no, and why
 *
 * Considered and rejected. There is no reliable "an editor is running" signal a
 * sidecar can read (the editor keeps no lockfile, and the MCP front door is a
 * command string, not a liveness marker), so the test would be a guess; and a
 * capability that works or doesn't depending on whether an unrelated app
 * happens to be open is worse than one that always works. What actually matters
 * is **not creating a second backend for a project that has one**, and that is
 * solved directly: `findReusableBackend`'s rule (name + this project owns it)
 * is reimplemented here verbatim, an already-running backend is *adopted*
 * rather than restarted, and a project already bound to an endpoint is refused
 * rather than repointed. Those hold whether or not an editor is running.
 *
 * ## Ports
 *
 * The editor allocates from 8578 upward, skipping ports in existing configs.
 * We do the same scan **and then actually try to bind** the candidate, because
 * the config scan alone is blind to a port taken between two processes' reads —
 * which, with two spawners now, is a real race rather than a theoretical one.
 * The port finally recorded is the one the child's READY line reports, not the
 * one we asked for.
 *
 * ## Secrets
 *
 * We write none. The backend mints its own `adminToken` into
 * `<dataDir>/secrets.json` at first start (`SecurityState`, mode 0600 via
 * `atomicWriteJSON`), and this module only ever *reads* it back — the same way
 * `backend/client.ts` and the editor's `ServiceSupervisor` do. The `functions`
 * namespace, the one a cloud function may read, is not touched here at all: a
 * provision creates no credential material of its own. The one file this module
 * writes that is not already part of the layout is `runtime.json`, which holds
 * a pid, a port and a path, and is written 0600 like everything else in there.
 *
 * @module noodl-mcp/backend/provision
 */

import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as net from 'net';
import * as path from 'path';

import { ToolError } from '../errors';
import { backendsRoot, BackendClient, listBackends } from './client';
import { reapOrphanedBackends } from './reaper';
import {
  BackendRuntimeRecord,
  deleteRuntimeRecord,
  HEARTBEAT_INTERVAL_MS,
  readRuntimeRecord,
  selfOwnerStartedAt,
  touchRuntimeRecord,
  verifyIsOurBackend,
  processIsAlive,
  writeRuntimeRecord
} from './runtimeRecord';

const READY_PREFIX = 'NODEGX_BACKEND_READY ';
const READY_TIMEOUT_MS = 30_000;
const STOP_GRACE_MS = 3000;
const FIRST_PORT = 8578;

/** Matches `BackendManager.generateBackendId` so ids from both spawners read alike. */
function generateBackendId(): string {
  return 'backend_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
}

/**
 * The `nodegx-backend` bundle, or null with the paths probed.
 *
 * The dev-checkout sibling is the only candidate that makes sense here: unlike
 * the editor there is no `app.getAppPath()` and no `process.resourcesPath`, and
 * a globally-installed `noodl-mcp` reaches the service through its own
 * `node_modules` if it ever ships one. `NODEGX_BACKEND_ENTRY` overrides both.
 */
export function resolveServiceEntry(): { entry: string | null; probed: string[] } {
  const probed: string[] = [];
  const push = (p: string): string | null => {
    probed.push(p);
    return fs.existsSync(p) ? p : null;
  };

  if (process.env.NODEGX_BACKEND_ENTRY) {
    const found = push(process.env.NODEGX_BACKEND_ENTRY);
    if (found) return { entry: found, probed };
  }
  const candidates = [
    // Monorepo sibling, from src/backend/ and from dist/.
    path.resolve(__dirname, '..', '..', '..', 'nodegx-backend', 'dist', 'cli.js'),
    path.resolve(__dirname, '..', '..', 'nodegx-backend', 'dist', 'cli.js'),
    // An installed copy.
    path.resolve(__dirname, '..', '..', 'node_modules', 'nodegx-backend', 'dist', 'cli.js')
  ];
  for (const candidate of candidates) {
    const found = push(candidate);
    if (found) return { entry: found, probed };
  }
  return { entry: null, probed };
}

/** Is 127.0.0.1:<port> free right now? */
export function portIsFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => server.close(() => resolve(true)));
    server.listen(port, '127.0.0.1');
  });
}

/**
 * The next free port at or above 8578 — the editor's own starting point, so the
 * two allocators walk the same line and neither has to know about the other.
 *
 * Config scan **plus** a real bind probe: the scan alone cannot see a port taken
 * since the last config was written, and cannot see a non-backend process at
 * all.
 */
export async function allocatePort(root = backendsRoot()): Promise<number> {
  const used = new Set<number>();
  for (const b of listBackends()) if (typeof b.port === 'number') used.add(b.port);
  for (const id of safeReaddir(root)) {
    const record = readRuntimeRecord(id, root);
    if (record) used.add(record.port);
  }
  for (let port = FIRST_PORT; port < FIRST_PORT + 500; port++) {
    if (used.has(port)) continue;
    if (await portIsFree(port)) return port;
  }
  throw new ToolError('backend-error', `No free port found between ${FIRST_PORT} and ${FIRST_PORT + 500}.`);
}

function safeReaddir(dir: string): string[] {
  try {
    return fs.readdirSync(dir);
  } catch {
    return [];
  }
}

export interface BackendConfig {
  id: string;
  name: string;
  createdAt: string;
  port: number;
  /** AAQ-002/F4 — the projects that own this backend. Stamped at creation. */
  projectIds: string[];
}

function configPath(root: string, id: string): string {
  return path.join(root, id, 'config.json');
}

export function readBackendConfig(id: string, root = backendsRoot()): BackendConfig | null {
  try {
    return JSON.parse(fs.readFileSync(configPath(root, id), 'utf-8')) as BackendConfig;
  } catch {
    return null;
  }
}

/**
 * A backend this provision may reuse rather than creating a second one.
 *
 * The rule is `provisionBackend.findReusableBackend`'s, and it is copied rather
 * than shared because that module imports `@noodl-utils/ipc` and `ProjectModel`
 * — neither of which exists in this process. ⚠️ If the rule changes there, it
 * changes here: matching on **name alone** is what made every AI-created
 * project on a machine bind to the first backend ever provisioned on it, so
 * ownership is not an optimisation, it is the correctness half.
 */
export function findReusableBackend(
  existing: readonly { id: string; name: string; port: number; projectIds?: string[] }[],
  name: string,
  projectId: string | undefined
): { id: string; name: string; port: number } | undefined {
  if (!projectId) return undefined;
  const wanted = name.trim().toLowerCase();
  return existing.find((b) => b.name.trim().toLowerCase() === wanted && (b.projectIds ?? []).includes(projectId));
}

/**
 * Create the backend directory and config. Mirrors `BackendManager.createBackend`
 * exactly, including stamping `projectIds` **at creation** — a backend that
 * exists for a moment with no owner is a backend the next provision would adopt.
 */
export async function createBackendDir(
  name: string,
  projectId: string | undefined,
  root = backendsRoot()
): Promise<BackendConfig> {
  const id = generateBackendId();
  const dir = path.join(root, id);
  fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'workflows'), { recursive: true });
  const config: BackendConfig = {
    id,
    name,
    createdAt: new Date().toISOString(),
    port: await allocatePort(root),
    projectIds: projectId ? [projectId] : []
  };
  fs.writeFileSync(configPath(root, id), JSON.stringify(config, null, 2));
  fs.writeFileSync(path.join(dir, 'schema.json'), JSON.stringify({ tables: [] }, null, 2));
  return config;
}

// ─── The live children this process owns ──────────────────────────────────────

interface OwnedBackend {
  child: ChildProcess;
  heartbeat: NodeJS.Timeout;
  logRing: string[];
}

const owned = new Map<string, OwnedBackend>();

/** Backend ids this process spawned and has not stopped. Exposed for tests. */
export function ownedBackendIds(): string[] {
  return [...owned.keys()];
}

export interface StartedBackend {
  backendId: string;
  name: string;
  port: number;
  endpoint: string;
  pid: number;
}

/**
 * Spawn the service, wait for its READY handshake, and write the runtime record.
 *
 * `--parent-pid` is not optional here: it is the first of the three orphan
 * mechanisms (see {@link ../reaper}), and it is the only one that works while
 * no other `noodl-mcp` has started since.
 */
export async function startBackend(
  config: BackendConfig,
  options: { root?: string; projectDir?: string } = {}
): Promise<StartedBackend> {
  const root = options.root ?? backendsRoot();
  const { entry, probed } = resolveServiceEntry();
  if (!entry) {
    throw new ToolError(
      'backend-error',
      'The nodegx-backend service bundle was not found, so no backend can be started. Build it with ' +
        '`npm run build` in packages/nodegx-backend, or set NODEGX_BACKEND_ENTRY. Probed:\n  ' +
        probed.join('\n  ')
    );
  }

  const dataDir = path.join(root, config.id);
  const args = [
    entry,
    'serve',
    '--data-dir',
    dataDir,
    '--port',
    String(config.port),
    '--backend-id',
    config.id,
    '--backend-name',
    config.name,
    // Orphan guard #1. See the reaper's module note for what it does and does
    // not cover; `verifyIsOurBackend` also reads `--backend-id` back off this
    // very command line, so the shape of this argv is load-bearing twice.
    '--parent-pid',
    String(process.pid)
  ];

  const child = spawn(process.execPath, args, { stdio: ['ignore', 'pipe', 'pipe'], detached: false });
  const logRing: string[] = [];
  const appendLog = (stream: string, chunk: Buffer) => {
    for (const line of chunk.toString().split('\n')) {
      if (!line.trim()) continue;
      logRing.push(`[${stream}] ${line}`);
      if (logRing.length > 200) logRing.shift();
    }
  };
  child.stderr?.on('data', (c: Buffer) => appendLog('err', c));

  const ready = await new Promise<{ port: number; url?: string }>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        child.kill('SIGKILL');
      } catch {
        /* already gone */
      }
      reject(
        new ToolError(
          'backend-error',
          `The backend "${config.name}" did not become ready within ${READY_TIMEOUT_MS / 1000}s.\n` +
            `Last output:\n${logRing.slice(-15).join('\n')}`
        )
      );
    }, READY_TIMEOUT_MS);

    child.stdout?.on('data', (chunk: Buffer) => {
      appendLog('out', chunk);
      const line = chunk
        .toString()
        .split('\n')
        .find((l) => l.startsWith(READY_PREFIX));
      if (!line || settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        resolve(JSON.parse(line.slice(READY_PREFIX.length)));
      } catch {
        resolve({ port: config.port });
      }
    });

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new ToolError('backend-error', `Failed to spawn nodegx-backend: ${err.message}`));
    });

    child.on('exit', (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(
        new ToolError(
          'backend-error',
          `The backend "${config.name}" exited before becoming ready (code=${code}, signal=${signal}).\n` +
            `Last output:\n${logRing.slice(-15).join('\n')}`
        )
      );
    });
  });

  // The port the child actually bound, never the one we asked for.
  const port = ready.port || config.port;
  const record: BackendRuntimeRecord = {
    version: 1,
    backendId: config.id,
    backendName: config.name,
    pid: child.pid as number,
    port,
    endpoint: `http://127.0.0.1:${port}`,
    entry,
    startedAt: new Date().toISOString(),
    owner: {
      kind: 'noodl-mcp',
      pid: process.pid,
      // This session's start time, not this record's — see `selfOwnerStartedAt`.
      // Stamping `new Date()` here would give two records from one session two
      // different owner identities, so the reaper could not recognise its own.
      startedAt: selfOwnerStartedAt(),
      ...(options.projectDir ? { projectDir: options.projectDir } : {})
    },
    heartbeatAt: new Date().toISOString()
  };
  writeRuntimeRecord(record, root);

  // Orphan mechanism #2: while we live, we say so. `unref` so this timer alone
  // never keeps the MCP server alive after its transport closes.
  const heartbeat = setInterval(() => touchRuntimeRecord(config.id, root), HEARTBEAT_INTERVAL_MS);
  heartbeat.unref();
  owned.set(config.id, { child, heartbeat, logRing });

  child.on('exit', () => {
    // A backend that dies on its own leaves no record behind to confuse the
    // next sweep — and stops being ours to stop.
    const entryOwned = owned.get(config.id);
    if (entryOwned) clearInterval(entryOwned.heartbeat);
    owned.delete(config.id);
    deleteRuntimeRecord(config.id, root);
  });

  return { backendId: config.id, name: config.name, port, endpoint: record.endpoint, pid: child.pid as number };
}

/**
 * Stop a backend this process owns, or one whose record proves it is ours.
 *
 * The second case is what makes `stop_backend` useful after a restart: the
 * record names the pid, and `verifyIsOurBackend` proves the pid is still that
 * backend before anything is signalled. A pid we cannot verify is refused
 * loudly rather than killed hopefully.
 */
export async function stopBackend(backendId: string, root = backendsRoot()): Promise<{ stopped: boolean; how: string }> {
  const mine = owned.get(backendId);
  if (mine) {
    clearInterval(mine.heartbeat);
    owned.delete(backendId);
    const how = await terminateChild(mine.child);
    deleteRuntimeRecord(backendId, root);
    return { stopped: true, how };
  }

  const record = readRuntimeRecord(backendId, root);
  if (!record) return { stopped: false, how: 'no runtime record — it was not running' };
  if (!processIsAlive(record.pid)) {
    deleteRuntimeRecord(backendId, root);
    return { stopped: false, how: 'the recorded process is already gone; stale record removed' };
  }
  const verdict = verifyIsOurBackend(record);
  if (verdict !== 'verified') {
    throw new ToolError(
      'backend-error',
      `Refusing to signal pid ${record.pid}: it ${
        verdict === 'not-ours' ? 'no longer belongs to this backend (pid reuse)' : 'could not be verified'
      }. Nothing was signalled.` + (verdict === 'not-ours' ? ' The stale record has been removed.' : '')
    );
  }
  const how = await terminatePid(record.pid);
  deleteRuntimeRecord(backendId, root);
  return { stopped: true, how };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Wait for the child to exit, or `null` after `ms`.
 *
 * The timer is **cleared on the winning path**, which is not a nicety: a bare
 * `Promise.race([exit, sleep(3000)])` leaves a live 3-second timer behind on
 * every clean stop, and in a process whose whole job is to exit quietly when its
 * client goes away that is a handle holding the event loop open. Jest found it;
 * a user would have found it as "the MCP server takes three seconds to quit".
 */
function exitedWithin(child: ChildProcess, ms: number): Promise<boolean> {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) return resolve(true);
    const timer = setTimeout(() => {
      child.removeListener('exit', onExit);
      resolve(false);
    }, ms);
    function onExit(): void {
      clearTimeout(timer);
      resolve(true);
    }
    child.once('exit', onExit);
  });
}

async function terminateChild(child: ChildProcess): Promise<string> {
  if (child.exitCode !== null) return 'already exited';
  try {
    child.kill('SIGTERM');
  } catch {
    return 'already gone';
  }
  if (await exitedWithin(child, STOP_GRACE_MS)) return 'SIGTERM';
  try {
    child.kill('SIGKILL');
  } catch {
    /* already gone */
  }
  return (await exitedWithin(child, 1000)) ? 'SIGKILL' : 'escaped';
}

async function terminatePid(pid: number): Promise<string> {
  try {
    process.kill(pid, 'SIGTERM');
  } catch {
    return 'already gone';
  }
  const deadline = Date.now() + STOP_GRACE_MS;
  while (Date.now() < deadline) {
    if (!processIsAlive(pid)) return 'SIGTERM';
    await sleep(100);
  }
  try {
    process.kill(pid, 'SIGKILL');
  } catch {
    /* already gone */
  }
  await sleep(100);
  return processIsAlive(pid) ? 'escaped' : 'SIGKILL';
}

/**
 * Stop every backend this process owns.
 *
 * Registered on the signals a well-behaved shutdown delivers. It is explicitly
 * **not** the safety net — a SIGKILLed MCP server runs none of this, which is
 * the whole reason the record and the reaper exist.
 */
export async function stopOwnedBackends(root = backendsRoot()): Promise<string[]> {
  const ids = [...owned.keys()];
  for (const id of ids) {
    try {
      await stopBackend(id, root);
    } catch {
      /* best effort on the way out */
    }
  }
  return ids;
}

let exitHooksInstalled = false;

/** Idempotent; called the first time this process provisions anything. */
export function installExitHooks(root = backendsRoot()): void {
  if (exitHooksInstalled) return;
  exitHooksInstalled = true;
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as NodeJS.Signals[]) {
    process.on(signal, () => {
      void stopOwnedBackends(root).then(() => process.exit(0));
    });
  }
  // Synchronous last chance: `exit` cannot await, so this signals and drops the
  // record rather than waiting for a clean drain. The child's own --parent-pid
  // guard finishes the job if the signal does not.
  process.on('exit', () => {
    for (const [id, entry] of owned) {
      try {
        entry.child.kill('SIGTERM');
      } catch {
        /* already gone */
      }
      deleteRuntimeRecord(id, root);
    }
  });
}

// ─── The whole operation ──────────────────────────────────────────────────────

export interface ProvisionCollection {
  name: string;
  columns: { name: string; type: string }[];
}

export interface ProvisionRequest {
  name: string;
  collections: ProvisionCollection[];
  projectId?: string;
  projectDir?: string;
  root?: string;
}

export interface ProvisionResult {
  backendId: string;
  name: string;
  endpoint: string;
  port: number;
  pid: number;
  reused: boolean;
  adopted: boolean;
  collections: string[];
  warnings: string[];
}

/**
 * Create (or reuse) a backend for this project, start it, seed its collections
 * and return the binding the caller writes into the project.
 *
 * Collections are advisory throughout, for the reason `PlanProvisionSpec` gives:
 * the backend creates a collection on first write anyway, so a collection that
 * fails to create is a warning on a succeeded provision, never a failure.
 */
export async function provisionBackend(request: ProvisionRequest): Promise<ProvisionResult> {
  const root = request.root ?? backendsRoot();
  const name = request.name.trim();
  if (!name) throw new ToolError('invalid-argument', 'The backend needs a name.');

  // Sweep before we add one more process to the machine.
  await reapOrphanedBackends({ root });

  const warnings: string[] = [];
  const configs = safeReaddir(root)
    .map((id) => readBackendConfig(id, root))
    .filter((c): c is BackendConfig => !!c);

  const reusable = findReusableBackend(configs, name, request.projectId);
  let started: StartedBackend;
  let reused = false;
  let adopted = false;

  if (reusable) {
    reused = true;
    // Already running (this process's, or a previous session's that the sweep
    // above left alone because a live owner claims it)? Adopt it. Starting a
    // second process on the same data dir is how two SQLite writers happen.
    const record = readRuntimeRecord(reusable.id, root);
    if (record && processIsAlive(record.pid) && verifyIsOurBackend(record) === 'verified') {
      adopted = true;
      started = {
        backendId: record.backendId,
        name: record.backendName,
        port: record.port,
        endpoint: record.endpoint,
        pid: record.pid
      };
    } else {
      const config = readBackendConfig(reusable.id, root);
      if (!config) throw new ToolError('backend-error', `Backend ${reusable.id} has no readable config.json.`);
      installExitHooks(root);
      started = await startBackend(config, { root, projectDir: request.projectDir });
    }
  } else {
    const config = await createBackendDir(name, request.projectId, root);
    installExitHooks(root);
    started = await startBackend(config, { root, projectDir: request.projectDir });
  }

  // ── Collections, advisory. ────────────────────────────────────────────────
  const created: string[] = [];
  const client = new BackendClient({
    id: started.backendId,
    name: started.name,
    port: started.port,
    dir: path.join(root, started.backendId),
    adminToken: readAdminToken(path.join(root, started.backendId))
  });
  for (const collection of request.collections) {
    try {
      const { json } = await client.request('POST', '/admin/schema', {
        action: 'createTable',
        table: collection.name,
        columns: collection.columns
      });
      created.push(collection.name);
      if (json && typeof json === 'object' && (json as { created?: boolean }).created === false) {
        warnings.push(
          `"${collection.name}" already existed — its columns were left as they are. ` +
            'Check them in the Data Browser if the types matter.'
        );
      }
    } catch (error) {
      warnings.push(
        `"${collection.name}" was not created (${error instanceof Error ? error.message : String(error)}). ` +
          'The backend will create it the first time something writes to it.'
      );
    }
  }

  return {
    backendId: started.backendId,
    name: started.name,
    endpoint: started.endpoint,
    port: started.port,
    pid: started.pid,
    reused,
    adopted,
    collections: created,
    warnings
  };
}

/** The admin credential the backend minted for itself. Read, never written. */
function readAdminToken(dir: string): string | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, 'secrets.json'), 'utf-8')).adminToken || null;
  } catch {
    return null;
  }
}
