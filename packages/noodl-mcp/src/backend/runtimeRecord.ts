/**
 * AAQ-011/F13 — the durable spawn record, and the pid-reuse-safe proof that a
 * process really is one of our backends.
 *
 * ## Why a record exists at all
 *
 * `noodl-mcp` may now start a `nodegx-backend` child process (F13's decision).
 * It is the worst spawner in the product for orphaning: an MCP server is a
 * sidecar with **no window to close and no quit event** — the client (Claude
 * Code, an IDE) can vanish at any moment, and a SIGKILL'd parent runs no
 * handler. So "stop it on the way out" cannot be the whole answer, and this
 * file is the part that survives the parent.
 *
 * Three mechanisms stack, and it is worth being precise about which does what,
 * because the first one already shipped and is easy to miss:
 *
 * 1. **The backend kills itself.** `nodegx-backend serve --parent-pid <pid>`
 *    polls that pid every 5s and drains when it disappears
 *    (`packages/nodegx-backend/src/cli.ts:350`). The editor's ServiceSupervisor
 *    already passes it; so do we. This covers the ordinary crash.
 * 2. **⚠️ …unless the parent's pid is reused.** The guard is `process.kill(pid, 0)`
 *    and nothing more, so once the OS recycles the dead parent's pid onto an
 *    unrelated process the guard reports "alive" forever and the backend serves
 *    on, holding its port and its cron schedules. That is the hole this record
 *    closes: the owner writes a **heartbeat** into it, and a record whose
 *    heartbeat has gone stale is an orphan even when its owner pid resolves.
 * 3. **The reaper** ({@link ../reaper}) reads these records on the next
 *    `noodl-mcp` start and kills what no live owner claims.
 *
 * ## Never trust a bare pid
 *
 * The whole hazard of a reaper is killing the wrong process, and a recorded pid
 * is exactly the thing that goes stale. {@link verifyIsOurBackend} therefore
 * requires the *command line* of the pid to name this backend id — a fact only
 * our own child can have — before anything is signalled. A health probe is not
 * enough on its own: it proves a backend answers on that **port**, not that it
 * is that **pid**. When the command line cannot be read at all (an OS without
 * `ps`), the answer is "unverifiable" and nothing is killed.
 *
 * ## One record, two spawners
 *
 * The editor is the other spawner. The format is deliberately owner-agnostic
 * (`owner.kind`) and the heartbeat is optional, so an editor-written record is
 * judged on owner-pid liveness alone and adopting the format later is additive.
 * If the two spawners kept separate records they would orphan each other's
 * processes, which is the one outcome F13 names.
 *
 * @module noodl-mcp/backend/runtimeRecord
 */

import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import { backendsRoot } from './client';

/** File name inside `<backendsRoot>/<backendId>/`. */
export const RUNTIME_FILE = 'runtime.json';

/**
 * How long a heartbeat may go unrefreshed before the owner counts as gone.
 *
 * Six missed beats at {@link HEARTBEAT_INTERVAL_MS}. Generous on purpose: the
 * cost of waiting is a backend that lives a minute longer than it should, and
 * the cost of being hasty is killing a live user's backend mid-request.
 */
export const HEARTBEAT_STALE_MS = 60_000;

/** How often a live owner rewrites `heartbeatAt`. */
export const HEARTBEAT_INTERVAL_MS = 10_000;

export interface BackendRuntimeOwner {
  /** Which spawner is responsible for stopping this backend. */
  kind: 'noodl-mcp' | 'editor';
  pid: number;
  startedAt: string;
  /** The project the owner was serving, for the report a human reads. */
  projectDir?: string;
}

export interface BackendRuntimeRecord {
  version: 1;
  backendId: string;
  backendName: string;
  /** The backend child process. */
  pid: number;
  port: number;
  endpoint: string;
  /** The `cli.js` the child was spawned with — corroborates the command line. */
  entry: string;
  startedAt: string;
  owner: BackendRuntimeOwner;
  /**
   * Refreshed by the live owner every {@link HEARTBEAT_INTERVAL_MS}. **Absent
   * means "judge on owner pid alone"** — that is what makes the format safe for
   * a spawner that has not adopted heartbeats yet.
   */
  heartbeatAt?: string;
}

function recordPath(root: string, backendId: string): string {
  return path.join(root, backendId, RUNTIME_FILE);
}

/**
 * Write (or replace) the record. 0600 like every other file in a backend dir —
 * it names a port and a pid, which is not a credential, but nothing under
 * `~/.noodl/backends` is world-readable and this should not be the exception.
 */
export function writeRuntimeRecord(record: BackendRuntimeRecord, root = backendsRoot()): void {
  const file = recordPath(root, record.backendId);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(record, null, 2) + '\n', { mode: 0o600 });
  fs.renameSync(tmp, file);
  try {
    fs.chmodSync(file, 0o600);
  } catch {
    // chmod is best-effort on platforms without POSIX modes.
  }
}

/** The record for one backend, or null when absent/corrupt. Never throws. */
export function readRuntimeRecord(backendId: string, root = backendsRoot()): BackendRuntimeRecord | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(recordPath(root, backendId), 'utf-8'));
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.backendId !== 'string' || typeof parsed.pid !== 'number') return null;
    return parsed as BackendRuntimeRecord;
  } catch {
    return null;
  }
}

/** Every readable record under the root. A corrupt one is skipped, not fatal. */
export function listRuntimeRecords(root = backendsRoot()): BackendRuntimeRecord[] {
  let entries: string[];
  try {
    entries = fs.readdirSync(root);
  } catch {
    return [];
  }
  const out: BackendRuntimeRecord[] = [];
  for (const id of entries) {
    const record = readRuntimeRecord(id, root);
    if (record) out.push(record);
  }
  return out;
}

/** Drop the record. Idempotent. */
export function deleteRuntimeRecord(backendId: string, root = backendsRoot()): void {
  try {
    fs.rmSync(recordPath(root, backendId), { force: true });
  } catch {
    // A record we cannot delete is a record the next sweep re-evaluates.
  }
}

/** Refresh `heartbeatAt` in place, leaving everything else alone. */
export function touchRuntimeRecord(backendId: string, root = backendsRoot()): void {
  const record = readRuntimeRecord(backendId, root);
  if (!record) return;
  writeRuntimeRecord({ ...record, heartbeatAt: new Date().toISOString() }, root);
}

/**
 * Does a pid resolve to a live process?
 *
 * `EPERM` means it exists under another user — alive, and not ours to touch.
 * Same reading as the backend's own parent guard.
 */
export function processIsAlive(pid: number): boolean {
  if (!Number.isFinite(pid) || pid <= 1) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === 'EPERM';
  }
}

/**
 * The command line of a pid, or null when it cannot be read.
 *
 * Null is a meaningful answer, not a failure to paper over: {@link verifyIsOurBackend}
 * refuses to kill on it.
 */
export function processCommandLine(pid: number): string | null {
  try {
    if (process.platform === 'win32') {
      const out = execFileSync(
        'wmic',
        ['process', 'where', `processid=${pid}`, 'get', 'commandline', '/format:list'],
        { encoding: 'utf-8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'] }
      );
      const line = out.split('\n').find((l) => l.trim().toLowerCase().startsWith('commandline='));
      return line ? line.slice(line.indexOf('=') + 1).trim() || null : null;
    }
    const out = execFileSync('ps', ['-o', 'command=', '-p', String(pid)], {
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'ignore']
    });
    return out.trim() || null;
  } catch {
    // `ps` exits non-zero for a pid that no longer exists, which the caller has
    // already ruled out, and is simply absent on some minimal images.
    return null;
  }
}

export type VerifyOutcome =
  /** The command line names this backend id — safe to signal. */
  | 'verified'
  /** The command line was readable and is somebody else's — pid reuse. */
  | 'not-ours'
  /** No command line could be read. Never kill on this. */
  | 'unverifiable';

/**
 * Is the process at `record.pid` really the backend this record describes?
 *
 * The proof is the child's own argv: `ServiceSupervisor`-style spawns always
 * carry `--backend-id <id>`, and the entry path corroborates it. A process that
 * inherited the pid cannot have either.
 *
 * @param commandLine injected in tests; read from the OS otherwise.
 */
export function verifyIsOurBackend(
  record: Pick<BackendRuntimeRecord, 'pid' | 'backendId' | 'entry'>,
  commandLine: string | null = processCommandLine(record.pid)
): VerifyOutcome {
  if (commandLine === null) return 'unverifiable';
  const namesBackend = commandLine.includes(`--backend-id ${record.backendId}`);
  // The entry is corroboration, not the proof: a dev checkout and a packaged
  // app resolve different paths for the same service, and a record written by
  // one and read by the other must not be mistaken for someone else's process.
  const looksLikeService = commandLine.includes('nodegx-backend') || (!!record.entry && commandLine.includes(record.entry));
  return namesBackend && looksLikeService ? 'verified' : 'not-ours';
}

/**
 * Has the owner refreshed this record recently enough to still count?
 *
 * **A record with no `heartbeatAt` is fresh by definition** — that is what lets
 * a spawner that has not adopted heartbeats (the editor, today) write records
 * this reaper reads without its backends being judged stale on the spot.
 */
export function heartbeatIsFresh(record: Pick<BackendRuntimeRecord, 'heartbeatAt'>, now = Date.now()): boolean {
  if (!record.heartbeatAt) return true;
  const beat = Date.parse(record.heartbeatAt);
  if (!Number.isFinite(beat)) return true;
  return now - beat < HEARTBEAT_STALE_MS;
}

/**
 * Is the owner named by this record still around to stop the backend itself?
 *
 * Two conditions, and the second is the one that matters: the owner pid must
 * resolve, **and** its heartbeat must be fresh. Without the second, a recycled
 * owner pid keeps a dead session's backend alive forever, which is exactly the
 * hole in the backend's own `--parent-pid` guard.
 */
export function ownerIsLive(record: BackendRuntimeRecord, now = Date.now()): boolean {
  return processIsAlive(record.owner?.pid) && heartbeatIsFresh(record, now);
}

/**
 * This process's own start time, as a stable session identity.
 *
 * ⚠️ **A pid is not a session.** The reaper's fast path has to answer "did *I*
 * start this?", and a bare `owner.pid === process.pid` answers a different
 * question: "does this record name a pid that happens to be mine *now*". Those
 * differ in exactly the case this whole module exists for — a previous session
 * died and the OS recycled its pid onto us — and there the fast path would
 * classify that dead session's record as `self` and skip it **forever**, which
 * is the `--parent-pid` hole rebuilt one branch higher.
 *
 * Derived from `process.uptime()` rather than stamped per write: every record a
 * session writes must carry the *same* owner identity, or the comparison tells
 * you which record you are looking at rather than which session wrote it.
 * Memoised so the value cannot drift between two calls in one process.
 */
let selfOwnerStartedAtCache: string | undefined;
export function selfOwnerStartedAt(): string {
  if (selfOwnerStartedAtCache === undefined) {
    selfOwnerStartedAtCache = new Date(Date.now() - Math.round(process.uptime() * 1000)).toISOString();
  }
  return selfOwnerStartedAtCache;
}

/**
 * Does this record name *this* session as its owner?
 *
 * All three must agree. `kind` is not ceremony: the format is deliberately
 * shared with the editor, so without it an editor-written record whose owner pid
 * collides with ours would be read as our own and skipped.
 */
export function isOwnedBySelf(
  record: Pick<BackendRuntimeRecord, 'owner'>,
  self: { pid: number; startedAt: string; kind: BackendRuntimeOwner['kind'] }
): boolean {
  const owner = record.owner;
  if (!owner) return false;
  return owner.kind === self.kind && owner.pid === self.pid && owner.startedAt === self.startedAt;
}
