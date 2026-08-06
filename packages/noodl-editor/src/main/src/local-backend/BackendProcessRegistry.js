/**
 * BackendProcessRegistry — the durable record of every backend child process
 * this machine has spawned, and the sweep that reaps the ones nobody owns
 * (AAQ-011 / F10, slice 1).
 *
 * ## Why this exists
 *
 * F10 asks for the project's backend to start when the project opens. Starting
 * a child process automatically is only defensible if stopping it is
 * *guaranteed*, and Richard's constraint is explicit that a close handler is not
 * a guarantee: a crash, a force-quit, a `SIGKILL` and a power cut all run no
 * handler by definition. What is owed is orphan **reaping**.
 *
 * ## What already existed, and why it is not enough on its own
 *
 * ⚠️ The task doc's premise here is incomplete and has been corrected in it.
 * There *is* already an orphan guard: `ServiceSupervisor` passes `--parent-pid`
 * (ServiceSupervisor.js:169) and `nodegx-backend`'s `runServe` polls it every
 * five seconds, draining itself when the supervisor disappears
 * (nodegx-backend/src/cli.ts:350-364). So the common force-quit case is already
 * covered, and F10's "an orphan holds the project's port" is not the everyday
 * outcome it describes.
 *
 * It has three holes, and every one of them is a process that never exits:
 *
 * 1. **Parent pid reuse.** The guard's liveness test is `process.kill(pid, 0)`.
 *    Once the editor's pid has been recycled by an unrelated process, that test
 *    succeeds forever and the backend serves forever. Recycling is slow on
 *    macOS/Linux and fast on Windows.
 * 2. **`EPERM` is read as alive** (cli.ts:356) — deliberately, because a parent
 *    under another user is still a parent. A recycled pid owned by root is
 *    therefore permanently "alive".
 * 3. **A wedged backend.** The guard is a timer inside the process it is meant
 *    to stop. A backend spinning a core does not run it.
 *
 * A self-guard also cannot cover a spawner that never passed `--parent-pid`, and
 * F13 (`noodl-mcp` may provision backends) is about to add a second spawner with
 * no window to close. F13's note asks for the reaping record to be *the same*
 * record, which is why nothing in this module is editor-specific: it takes an
 * owner `kind` and stores under `~/.noodl`, not under the editor's userData.
 *
 * ## The design, and the alternative that was rejected
 *
 * **Reap on startup**, not a heartbeat.
 *
 * - A *heartbeat* means the owner writes a timestamp on an interval and a reaper
 *   kills anything whose timestamp is stale. It needs a liveness threshold —
 *   which is a guess about how long a laptop may sleep, a debugger may pause the
 *   main process, or a machine may be suspended — and getting it wrong kills a
 *   live user's backend. It also needs a reaper that is *running*, and the only
 *   process guaranteed to be running is the one that just died.
 * - **Reap on startup** needs no threshold and no daemon. It is deterministic:
 *   the next launch of any spawner reads the records and settles them. It costs
 *   nothing while the editor runs.
 *
 * Its weakness is the mirror of the heartbeat's strength — an orphan survives
 * until *something* launches again. That weakness is exactly what the
 * `--parent-pid` self-guard already covers, so the two are complementary rather
 * than redundant, and neither is asked to cover the other's blind spot.
 *
 * ## Never kill on a pid
 *
 * A recorded pid may belong to an unrelated process by the time the sweep reads
 * it, and killing it would be a far worse defect than the one this fixes. So a
 * record is only ever killed once the process at that pid is **proven** to be
 * the backend the record describes:
 *
 * - **Command line** (`--backend-id <id>` in the process's own argv) is the only
 *   proof accepted for a kill. It identifies *that pid*, and it works on a
 *   wedged process that answers nothing.
 * - **`GET /health`** on the recorded port, checked for
 *   `service: 'nodegx-backend'` and the recorded `backendId`, corroborates and
 *   is what slice 2 uses to *adopt* a backend that is already up. It is
 *   deliberately **not** accepted as kill proof: it identifies a port, not a
 *   pid, so on its own it could send `SIGKILL` to whatever inherited the pid.
 *
 * When identity cannot be proven the record is **dropped without a kill**. That
 * is a conservative failure — at worst an orphan lives on — and the failure in
 * the other direction is killing a stranger's process.
 *
 * ## Ownership, and the two-spawner case
 *
 * Each record names its owner: `{ pid, sessionId, kind }`. Each live spawner
 * writes `owners/<pid>.json` at startup and deletes it on an orderly exit. A
 * record is *owned* — and therefore left alone — only when an owner file exists
 * for its owner pid, that file's `sessionId` matches the record's, and the pid
 * is alive. All three, because:
 *
 * - the `sessionId` match is what stops a *recycled owner pid* from protecting a
 *   dead session's backends (a new spawner taking pid 4242 overwrites
 *   `owners/4242.json` with its own session, so the stale record no longer
 *   matches and is correctly reaped);
 * - the liveness check is what stops a *crashed* owner's leftover file from
 *   protecting them.
 *
 * A recycled owner pid taken by a *non-spawner* process still reads as alive and
 * the record is kept. That is the conservative direction again, and slice 2's
 * adoption path means the practical harm (a held port) is absorbed rather than
 * hit.
 *
 * ## Where the files live, and why not under `backends/`
 *
 * `~/.noodl/backend-runtime/{processes,owners}`. Not under `~/.noodl/backends/`,
 * which `BackendManager.listBackends` enumerates directory-by-directory and logs
 * `Skipping invalid backend` for anything without a `config.json` — a runtime
 * directory there would be a permanent line of noise in every listing.
 *
 * One file per record rather than one shared index: two spawners writing the
 * same JSON array is a lost-update race, and the whole point of this file is to
 * be right when a process dies mid-write.
 *
 * @module local-backend/BackendProcessRegistry
 */

const { execFile } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

/** Bump when the on-disk shape changes; records of another version are ignored. */
const RECORD_VERSION = 1;

/** How long a health probe may take before it counts as unreachable. */
const HEALTH_TIMEOUT_MS = 1500;

/** SIGTERM, then SIGKILL after this. Short: this runs on the startup path. */
const REAP_GRACE_MS = 2000;

function safeLog(...args) {
  try {
    console.log('[BackendProcessRegistry]', ...args);
  } catch (e) {
    // Ignore EPIPE errors
  }
}

/**
 * Is there a process at this pid?
 *
 * `EPERM` means yes-but-not-ours, which is still yes. Anything else (`ESRCH`)
 * means no. Note this is the same test `nodegx-backend`'s parent guard uses, and
 * it has the same pid-reuse weakness — which is why it is never the *only* test
 * before a kill.
 *
 * @param {number} pid
 * @returns {boolean}
 */
function isAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 1) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e && e.code === 'EPERM';
  }
}

/**
 * The full command line of a running process, or `null` when it cannot be read.
 *
 * `null` is "unknown", never "does not match" — the caller must not treat an
 * unreadable command line as a licence to kill.
 *
 * @param {number} pid
 * @returns {Promise<string|null>}
 */
function readCommandLine(pid) {
  return new Promise((resolve) => {
    const done = (value) => resolve(value);
    try {
      if (process.platform === 'win32') {
        // `wmic` is deprecated and absent from recent Windows builds; CIM is the
        // supported route and is present wherever PowerShell is.
        execFile(
          'powershell.exe',
          [
            '-NoProfile',
            '-NonInteractive',
            '-Command',
            `(Get-CimInstance Win32_Process -Filter "ProcessId=${pid}").CommandLine`
          ],
          { timeout: 5000, windowsHide: true },
          (err, stdout) => done(err ? null : String(stdout || '').trim() || null)
        );
        return;
      }
      // -ww: do not truncate at the terminal width. The backend id sits near the
      // end of a long argv, and a truncated read would silently fail to match.
      execFile('ps', ['-ww', '-o', 'args=', '-p', String(pid)], { timeout: 5000 }, (err, stdout) =>
        done(err ? null : String(stdout || '').trim() || null)
      );
    } catch (e) {
      done(null);
    }
  });
}

/**
 * Does this command line belong to the backend the record describes?
 *
 * Both halves are required. `--backend-id <id>` alone would match this very
 * sweep's own `ps` invocation if it ever carried the id, and the service marker
 * alone would match a *different* backend of ours.
 *
 * @param {string|null} commandLine
 * @param {string} backendId
 * @returns {boolean}
 */
function commandLineMatches(commandLine, backendId) {
  if (!commandLine || !backendId) return false;
  if (!commandLine.includes('nodegx-backend')) return false;
  // Tolerate `--backend-id x`, `--backend-id=x` and a quoted id.
  const escaped = backendId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`--backend-id[=\\s]+["']?${escaped}["']?(\\s|$)`).test(commandLine);
}

/**
 * `GET http://127.0.0.1:<port>/health`, or `null` when it does not answer.
 * `/health` is public on the backend (HttpServer.ts:419), so no credential is
 * needed — which matters, because the sweep runs before anything has read a
 * backend's secrets.
 *
 * @param {number} port
 * @returns {Promise<object|null>}
 */
async function probeHealth(port) {
  if (!Number.isInteger(port) || port <= 0) return null;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS) });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

/**
 * SIGTERM, then SIGKILL after the grace period. Resolves `true` once the process
 * is gone, `false` if it outlived both.
 *
 * @param {number} pid
 * @returns {Promise<boolean>}
 */
async function terminate(pid) {
  try {
    process.kill(pid, 'SIGTERM');
  } catch (e) {
    return !isAlive(pid);
  }

  const deadline = Date.now() + REAP_GRACE_MS;
  while (Date.now() < deadline) {
    if (!isAlive(pid)) return true;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  try {
    process.kill(pid, 'SIGKILL');
  } catch (e) {
    /* already gone */
  }

  // SIGKILL is not instantaneous — the process becomes a zombie until reaped,
  // and on a machine under load the transition takes a few ticks.
  const killDeadline = Date.now() + 1000;
  while (Date.now() < killDeadline) {
    if (!isAlive(pid)) return true;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return !isAlive(pid);
}

/** Write JSON so a reader never sees half of it. */
function writeJsonAtomic(filePath, value) {
  const tmp = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, filePath);
}

/**
 * @typedef {Object} SpawnRecord
 * @property {number} version
 * @property {string} backendId
 * @property {string} [name]
 * @property {number} pid - The backend child's pid.
 * @property {number} port
 * @property {string} [dataDir]
 * @property {string} [projectId] - The project the backend was started for, when known.
 * @property {string} spawnedAt - ISO8601.
 * @property {{ pid: number, sessionId: string, kind: string }} owner
 */

class BackendProcessRegistry {
  /**
   * @param {Object} [options]
   * @param {string} [options.rootDir] - Override the storage root (tests).
   * @param {string} [options.kind] - Owner kind: 'editor', 'mcp', …
   * @param {Object} [options.deps] - Injectable probes, for tests.
   */
  constructor(options = {}) {
    this.rootDir = options.rootDir || path.join(os.homedir(), '.noodl', 'backend-runtime');
    this.processesDir = path.join(this.rootDir, 'processes');
    this.ownersDir = path.join(this.rootDir, 'owners');
    this.kind = options.kind || 'editor';
    this.sessionId = options.sessionId || crypto.randomUUID();
    this.ownerPid = options.ownerPid || process.pid;

    const deps = options.deps || {};
    this.isAlive = deps.isAlive || isAlive;
    this.readCommandLine = deps.readCommandLine || readCommandLine;
    this.probeHealth = deps.probeHealth || probeHealth;
    this.terminate = deps.terminate || terminate;
  }

  /** @private */
  ensureDirs() {
    fs.mkdirSync(this.processesDir, { recursive: true });
    fs.mkdirSync(this.ownersDir, { recursive: true });
  }

  /** @private */
  recordPath(backendId) {
    // Backend ids are generated (`backend_<base36>`), but this file name is
    // attacker-adjacent the moment `noodl-mcp` writes records too, so a
    // traversal in the id must not become a write outside the directory.
    return path.join(this.processesDir, `${String(backendId).replace(/[^a-zA-Z0-9_.-]/g, '_')}.json`);
  }

  /** @private */
  ownerPath(pid) {
    return path.join(this.ownersDir, `${String(pid).replace(/[^0-9]/g, '')}.json`);
  }

  // ── Owner lifecycle ───────────────────────────────────────────────────────

  /**
   * Claim this process as a live spawner. Overwrites any file left behind by a
   * previous process that had this pid — which is the mechanism that lets the
   * sweep tell a recycled owner pid from a live one.
   */
  registerOwner() {
    this.ensureDirs();
    writeJsonAtomic(this.ownerPath(this.ownerPid), {
      version: RECORD_VERSION,
      pid: this.ownerPid,
      sessionId: this.sessionId,
      kind: this.kind,
      startedAt: new Date().toISOString()
    });
    return { pid: this.ownerPid, sessionId: this.sessionId, kind: this.kind };
  }

  /** Release the claim. Called on an orderly exit; a crash simply skips it. */
  releaseOwner() {
    try {
      fs.unlinkSync(this.ownerPath(this.ownerPid));
    } catch (e) {
      /* already gone */
    }
  }

  /** @returns {{pid: number, sessionId: string, kind: string}[]} */
  listOwners() {
    let names = [];
    try {
      names = fs.readdirSync(this.ownersDir);
    } catch (e) {
      return [];
    }
    const owners = [];
    for (const name of names) {
      if (!name.endsWith('.json')) continue;
      try {
        const owner = JSON.parse(fs.readFileSync(path.join(this.ownersDir, name), 'utf-8'));
        if (owner && owner.version === RECORD_VERSION && Number.isInteger(owner.pid)) owners.push(owner);
      } catch (e) {
        /* unreadable or half-written — treat as absent */
      }
    }
    return owners;
  }

  // ── Spawn records ─────────────────────────────────────────────────────────

  /**
   * Record a spawned backend.
   *
   * ⚠️ Call this **synchronously** after `spawn()` returns and before any
   * `await`: the pid is available on the returned handle immediately, and any
   * awaited work in between is a window in which a `SIGKILL` of the spawner
   * leaves a child with no record. The window is not zero — nothing short of the
   * kernel could make it zero — but it is microseconds, and it is the one case
   * the backend's own `--parent-pid` guard is best at, since a child that young
   * has certainly not wedged.
   *
   * @param {Object} spawn
   * @param {string} spawn.backendId
   * @param {number} spawn.pid
   * @param {number} spawn.port
   * @param {string} [spawn.name]
   * @param {string} [spawn.dataDir]
   * @param {string} [spawn.projectId]
   * @returns {SpawnRecord}
   */
  recordSpawn({ backendId, pid, port, name, dataDir, projectId }) {
    this.ensureDirs();
    /** @type {SpawnRecord} */
    const record = {
      version: RECORD_VERSION,
      backendId,
      name,
      pid,
      port,
      dataDir,
      projectId,
      spawnedAt: new Date().toISOString(),
      owner: { pid: this.ownerPid, sessionId: this.sessionId, kind: this.kind }
    };
    writeJsonAtomic(this.recordPath(backendId), record);
    return record;
  }

  /** Drop the record for a backend that stopped in an orderly way. */
  forgetSpawn(backendId) {
    try {
      fs.unlinkSync(this.recordPath(backendId));
    } catch (e) {
      /* already gone */
    }
  }

  /** @returns {SpawnRecord[]} */
  listRecords() {
    let names = [];
    try {
      names = fs.readdirSync(this.processesDir);
    } catch (e) {
      return [];
    }
    const records = [];
    for (const name of names) {
      if (!name.endsWith('.json')) continue;
      const file = path.join(this.processesDir, name);
      try {
        const record = JSON.parse(fs.readFileSync(file, 'utf-8'));
        if (record && record.version === RECORD_VERSION && record.backendId && Number.isInteger(record.pid)) {
          records.push(record);
        } else {
          // A record we cannot understand describes a process we cannot verify,
          // so it can never be acted on. Dropping it stops it accumulating.
          fs.unlinkSync(file);
        }
      } catch (e) {
        try {
          fs.unlinkSync(file);
        } catch (e2) {
          /* leave it */
        }
      }
    }
    return records;
  }

  /**
   * Is a live spawner responsible for this record?
   *
   * @param {SpawnRecord} record
   * @param {{pid: number, sessionId: string}[]} owners
   * @returns {boolean}
   * @private
   */
  isOwnerLive(record, owners) {
    const owner = record.owner;
    if (!owner || !Number.isInteger(owner.pid)) return false;
    const claim = owners.find((o) => o.pid === owner.pid);
    // No file: the owner never registered, or exited in an orderly way (and then
    // the record should have gone too — a leftover means it crashed).
    if (!claim) return false;
    // A file for the same pid but a different session is a *recycled* pid: some
    // later spawner took it and wrote its own claim. The record is orphaned.
    if (claim.sessionId !== owner.sessionId) return false;
    return this.isAlive(owner.pid);
  }

  /**
   * Prove — or fail to prove — that the process at `record.pid` is the backend
   * the record describes.
   *
   * @param {SpawnRecord} record
   * @returns {Promise<{ killable: boolean, healthy: boolean, reason: string }>}
   * @private
   */
  async proveIdentity(record) {
    const commandLine = await this.readCommandLine(record.pid);
    const killable = commandLineMatches(commandLine, record.backendId);

    const health = await this.probeHealth(record.port);
    const healthy = !!(health && health.service === 'nodegx-backend' && health.backendId === record.backendId);

    if (killable) return { killable: true, healthy, reason: healthy ? 'command-line+health' : 'command-line' };
    if (healthy) {
      return {
        killable: false,
        healthy: true,
        reason: 'health-only (a backend answers on the port, but the pid could not be identified)'
      };
    }
    return {
      killable: false,
      healthy: false,
      reason: commandLine === null ? 'command line unreadable' : 'command line does not match'
    };
  }

  /**
   * Settle every record on disk. Returns a report rather than logging alone, so
   * a test can assert on it and a caller can surface it.
   *
   * @returns {Promise<{
   *   reaped: {backendId: string, pid: number, reason: string}[],
   *   kept: {backendId: string, pid: number, reason: string}[],
   *   dropped: {backendId: string, pid: number, reason: string}[],
   *   failed: {backendId: string, pid: number, reason: string}[]
   * }>}
   */
  async sweep() {
    const report = { reaped: [], kept: [], dropped: [], failed: [] };
    const records = this.listRecords();
    if (records.length === 0) {
      this.pruneOwners();
      return report;
    }

    const owners = this.listOwners();

    await Promise.all(
      records.map(async (record) => {
        const at = { backendId: record.backendId, pid: record.pid };

        if (!this.isAlive(record.pid)) {
          this.forgetSpawn(record.backendId);
          report.dropped.push({ ...at, reason: 'process is already gone' });
          return;
        }

        if (this.isOwnerLive(record, owners)) {
          report.kept.push({ ...at, reason: `owned by live ${record.owner.kind} session ${record.owner.sessionId}` });
          return;
        }

        const identity = await this.proveIdentity(record);
        if (!identity.killable) {
          // Never kill an unidentified pid. Drop the record so it does not
          // accumulate — but say so, because a health-only match means an orphan
          // really is holding the port and we chose not to shoot at it.
          this.forgetSpawn(record.backendId);
          report.dropped.push({ ...at, reason: `identity not proven: ${identity.reason}` });
          if (identity.healthy) {
            safeLog(
              `Backend ${record.backendId} is answering on port ${record.port} with no live owner, but pid ` +
                `${record.pid} could not be identified as its process. Left running rather than risk killing ` +
                'an unrelated process. Stop it from Backend Services if it is unwanted.'
            );
          }
          return;
        }

        const died = await this.terminate(record.pid);
        if (died) {
          this.forgetSpawn(record.backendId);
          report.reaped.push({ ...at, reason: `orphaned (${identity.reason})` });
          safeLog(`Reaped orphaned backend ${record.backendId} (pid ${record.pid}, port ${record.port})`);
        } else {
          report.failed.push({ ...at, reason: 'process survived SIGTERM and SIGKILL' });
          safeLog(`Could not reap orphaned backend ${record.backendId} (pid ${record.pid})`);
        }
      })
    );

    this.pruneOwners();
    return report;
  }

  /**
   * Delete owner claims whose process is gone. Runs after the sweep, never
   * before: the sweep's ownership test reads these files, and pruning first
   * would make every crashed owner's record indistinguishable from an orderly
   * one — which happens to give the same answer today, but only by accident.
   * @private
   */
  pruneOwners() {
    for (const owner of this.listOwners()) {
      if (owner.pid === this.ownerPid) continue;
      if (this.isAlive(owner.pid)) continue;
      try {
        fs.unlinkSync(this.ownerPath(owner.pid));
      } catch (e) {
        /* already gone */
      }
    }
  }
}

module.exports = {
  BackendProcessRegistry,
  // Exported for tests and for `noodl-mcp` when F13 lands — the identity rules
  // are the part the two spawners must agree on, not just the file layout.
  isAlive,
  readCommandLine,
  commandLineMatches,
  probeHealth,
  terminate,
  RECORD_VERSION
};
