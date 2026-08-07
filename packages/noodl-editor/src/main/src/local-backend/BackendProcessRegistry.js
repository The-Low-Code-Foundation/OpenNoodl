/**
 * BackendProcessRegistry — the editor's half of the shared spawn record, and the
 * sweep that reaps backends nobody owns (AAQ-011 / F10).
 *
 * ## Why this exists
 *
 * F10 asks for the project's backend to start when the project opens. Starting a
 * child process automatically is only defensible if stopping it is *guaranteed*,
 * and Richard's constraint is explicit that a close handler is not a guarantee: a
 * crash, a force-quit, a `SIGKILL` and a power cut all run no handler. What is
 * owed is orphan **reaping**.
 *
 * ## ⚠️ Two premises the task doc got wrong, and one this file got wrong first
 *
 * 1. **An orphan guard already existed.** `ServiceSupervisor` has passed
 *    `--parent-pid` since WF-004 (`ServiceSupervisor.js:169`) and
 *    `nodegx-backend`'s `runServe` polls it every five seconds, draining itself
 *    when the supervisor disappears (`nodegx-backend/src/cli.ts:350-364`). So
 *    F10's "an orphan holds the project's port" is not the everyday outcome it
 *    describes — the ordinary force-quit is already covered.
 * 2. **It has three holes**, and each is a process that never exits: the guard's
 *    liveness test is a bare `process.kill(pid, 0)`, so a **recycled parent pid**
 *    reports alive forever; **`EPERM` is deliberately read as alive**
 *    (`cli.ts:356`), so a recycled pid owned by root is permanently "alive"; and
 *    a **wedged** backend never runs the timer that lives inside it.
 * 3. **This file's first version wrote its own record format**, under
 *    `~/.noodl/backend-runtime/`, with its own owner-claim files. `noodl-mcp`
 *    landed F13's provisioning the same afternoon with a *different* record —
 *    `runtime.json` inside each backend's own directory — and two records that
 *    cannot see each other is precisely the failure the F13 row names: each
 *    spawner reaps only its own, so an MCP orphan survives every editor launch
 *    and an editor orphan survives every MCP launch. This is now the **same**
 *    record: `<backendsRoot>/<backendId>/runtime.json`, in the shape
 *    `noodl-mcp/src/backend/runtimeRecord.ts` defines, judged by the same rules
 *    `noodl-mcp/src/backend/reaper.ts` applies.
 *
 * There is no shared module and there cannot be: the two live in different
 * packages with different builds, and the MCP server ships as its own bundle.
 * This is the `workflow-proposals` arrangement exactly — two processes, one
 * directory, one JSON shape, and a suite on each side that asserts a file
 * written the way the *other* writes it is read back whole.
 *
 * ## The design, and what was rejected
 *
 * **Reap on startup**, not a reaper on a timer.
 *
 * - A *timed reaper* would have to be a daemon, and the only process guaranteed
 *   not to be running is the one that just died.
 * - **Reap on startup** is deterministic and costs nothing while the editor
 *   runs: the next launch of *either* spawner settles every record.
 *
 * Its weakness is that an orphan survives until something launches again — which
 * is exactly what the `--parent-pid` self-guard already covers. The two are
 * complementary rather than redundant, and neither is asked to cover the other's
 * blind spot.
 *
 * **A heartbeat, but only as evidence of owner liveness** — not as a schedule.
 * The owner refreshes `heartbeatAt` every ten seconds while it owns a backend,
 * and a stale stamp means a dead owner even when the owner's pid still resolves.
 * That is the only thing that closes hole (2) above, because a recycled owner pid
 * is indistinguishable from a live one by pid alone.
 *
 * ⚠️ **It costs a threshold, and the threshold is a guess** — sixty seconds, six
 * missed beats. A machine suspended for longer, waking a moment before another
 * spawner's startup sweep, could have a live editor's backend judged unowned.
 * The window is at most one beat wide and it was accepted deliberately: an
 * editor-only design with no threshold existed (a session id in a separate owner
 * file, which is immune to pid reuse without a clock) and it was **discarded in
 * favour of interoperating**, because a record the other spawner cannot read is a
 * guaranteed failure, and this is a narrow race.
 *
 * ## Never kill on a pid
 *
 * A recorded pid may belong to an unrelated process by sweep time, and killing it
 * would be a far worse defect than the one this fixes. A kill requires the
 * process's own command line to name `--backend-id <id>` **and** look like the
 * service. `GET /health` on the recorded port corroborates and is what the
 * editor's adopt path uses, but it is refused as kill proof: it identifies a
 * *port*, not a *pid*.
 *
 * The three failing verdicts differ, and the difference is deliberate:
 * - *not ours* (command line readable, does not match) — drop the record, signal
 *   nothing. The pid was recycled.
 * - *unverifiable* (no command line at all) — **keep** the record and signal
 *   nothing, so a later sweep on a machine where `ps` works can settle it.
 * - *process gone* — drop the record.
 *
 * @module local-backend/BackendProcessRegistry
 */

const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

/** File name inside `<backendsRoot>/<backendId>/`. Must match noodl-mcp's `RUNTIME_FILE`. */
const RUNTIME_FILE = 'runtime.json';

/** How often a live owner rewrites `heartbeatAt`. Must match noodl-mcp's. */
const HEARTBEAT_INTERVAL_MS = 10_000;

/** How long a heartbeat may go unrefreshed before the owner counts as gone. */
const HEARTBEAT_STALE_MS = 60_000;

/** How long a health probe may take before it counts as unreachable. */
const HEALTH_TIMEOUT_MS = 1500;

/** SIGTERM, then SIGKILL after this. */
const STOP_GRACE_MS = 3000;

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
 * `EPERM` means yes-but-not-ours, which is still yes — the same reading as the
 * backend's own parent guard and as `noodl-mcp`'s `processIsAlive`.
 *
 * @param {number} pid
 * @returns {boolean}
 */
function processIsAlive(pid) {
  if (!Number.isFinite(pid) || pid <= 1) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return !!e && e.code === 'EPERM';
  }
}

/**
 * The full command line of a running process, or `null` when it cannot be read.
 *
 * `null` is "unknown", never "does not match" — the caller must not treat an
 * unreadable command line as a licence to kill.
 *
 * `-ww` is not decoration: `ps` truncates at the terminal width by default, the
 * backend id sits near the end of a long argv, and a truncated read would fail
 * to match a process that really is ours.
 *
 * @param {number} pid
 * @returns {Promise<string|null>}
 */
function processCommandLine(pid) {
  return new Promise((resolve) => {
    try {
      if (process.platform === 'win32') {
        // `wmic` is deprecated and absent from recent Windows builds; CIM is the
        // supported route and ships wherever PowerShell does.
        execFile(
          'powershell.exe',
          [
            '-NoProfile',
            '-NonInteractive',
            '-Command',
            `(Get-CimInstance Win32_Process -Filter "ProcessId=${pid}").CommandLine`
          ],
          { timeout: 5000, windowsHide: true },
          (err, stdout) => resolve(err ? null : String(stdout || '').trim() || null)
        );
        return;
      }
      execFile('ps', ['-ww', '-o', 'command=', '-p', String(pid)], { timeout: 5000 }, (err, stdout) =>
        resolve(err ? null : String(stdout || '').trim() || null)
      );
    } catch (e) {
      resolve(null);
    }
  });
}

/**
 * Is the process at `record.pid` really the backend this record describes?
 *
 * The same three-valued answer `noodl-mcp/src/backend/runtimeRecord.ts` gives,
 * and deliberately the same test — the argv marker `--backend-id <id>`, which
 * only our own child can carry, corroborated by the service name or the recorded
 * entry path (a dev checkout and a packaged app resolve different entries for the
 * same service, so the entry alone would reject a record written by the other).
 *
 * @param {{ pid: number, backendId: string, entry?: string }} record
 * @param {string|null} commandLine
 * @returns {'verified'|'not-ours'|'unverifiable'}
 */
function verifyIsOurBackend(record, commandLine) {
  if (commandLine === null || commandLine === undefined) return 'unverifiable';
  const namesBackend = commandLine.includes(`--backend-id ${record.backendId}`);
  const looksLikeService =
    commandLine.includes('nodegx-backend') || (!!record.entry && commandLine.includes(record.entry));
  return namesBackend && looksLikeService ? 'verified' : 'not-ours';
}

/**
 * Has the owner refreshed this record recently enough to still count?
 *
 * **A record with no `heartbeatAt` is fresh by definition.** That is what makes
 * the format safe for a spawner that has not adopted heartbeats — including
 * every record either side wrote before this convergence.
 *
 * @param {{ heartbeatAt?: string }} record
 * @param {number} [now]
 */
function heartbeatIsFresh(record, now = Date.now()) {
  if (!record || !record.heartbeatAt) return true;
  const beat = Date.parse(record.heartbeatAt);
  if (!Number.isFinite(beat)) return true;
  return now - beat < HEARTBEAT_STALE_MS;
}

/**
 * `GET http://127.0.0.1:<port>/health`, or `null` when it does not answer.
 * `/health` is public on the backend (`HttpServer.ts:419`), so no credential is
 * needed — which matters, because the sweep runs before anything has read a
 * backend's secrets. Corroboration only; never kill proof.
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
 * SIGTERM, then SIGKILL after the grace period. Resolves with how it ended, or
 * `'escaped'` — reported rather than swallowed, because a backend that survives
 * `SIGKILL` is something a human needs to know about.
 *
 * @param {number} pid
 * @param {(pid: number) => boolean} isAlive
 * @param {(pid: number, signal: string) => void} kill
 * @returns {Promise<string>}
 */
async function terminate(pid, isAlive, kill) {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  try {
    kill(pid, 'SIGTERM');
  } catch (e) {
    return 'SIGTERM (already gone)';
  }
  const deadline = Date.now() + STOP_GRACE_MS;
  while (Date.now() < deadline) {
    if (!isAlive(pid)) return 'SIGTERM';
    await sleep(100);
  }
  try {
    kill(pid, 'SIGKILL');
  } catch (e) {
    return 'SIGKILL (already gone)';
  }
  // SIGKILL is not instantaneous: the process is a zombie until it is reaped.
  const killDeadline = Date.now() + 1000;
  while (Date.now() < killDeadline) {
    if (!isAlive(pid)) return 'SIGKILL';
    await sleep(25);
  }
  return 'escaped';
}

/** Write JSON so a reader never sees half of it. 0600, like everything under a backend dir. */
function writeJsonAtomic(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
  fs.renameSync(tmp, filePath);
  try {
    fs.chmodSync(filePath, 0o600);
  } catch (e) {
    // chmod is best-effort on platforms without POSIX modes.
  }
}

class BackendProcessRegistry {
  /**
   * @param {Object} [options]
   * @param {string} [options.rootDir] - The backends root (`~/.noodl/backends`).
   * @param {string} [options.kind] - Owner kind written into the record.
   * @param {number} [options.ownerPid]
   * @param {Object} [options.deps] - Injectable probes, for tests.
   */
  constructor(options = {}) {
    this.rootDir = options.rootDir || path.join(os.homedir(), '.noodl', 'backends');
    this.kind = options.kind || 'editor';
    this.ownerPid = options.ownerPid || process.pid;
    this.startedAt = new Date().toISOString();

    /** backendId -> heartbeat timer, for the backends this session owns. */
    this.heartbeats = new Map();

    const deps = options.deps || {};
    this.isAlive = deps.isAlive || processIsAlive;
    this.readCommandLine = deps.readCommandLine || processCommandLine;
    this.probeHealth = deps.probeHealth || probeHealth;
    this.kill = deps.kill || ((pid, signal) => process.kill(pid, signal));
  }

  /** @private */
  recordPath(backendId) {
    // Backend ids are generated, but this path is attacker-adjacent the moment a
    // second process writes records too, so a traversal must not escape.
    return path.join(this.rootDir, String(backendId).replace(/[^a-zA-Z0-9_.-]/g, '_'), RUNTIME_FILE);
  }

  // ── Spawn records ─────────────────────────────────────────────────────────

  /**
   * Record a spawned backend, and start heartbeating it.
   *
   * ⚠️ Call this **synchronously** after `spawn()` returns and before any
   * `await`: the pid is on the returned handle immediately, and awaited work in
   * between is a window in which a `SIGKILL` of the spawner leaves a child with
   * no record. The window is not zero — nothing short of the kernel could make it
   * zero — but it is microseconds, and it is the one case the backend's own
   * `--parent-pid` guard is best at, since a child that young cannot have wedged.
   *
   * @param {Object} spawn
   * @param {string} spawn.backendId
   * @param {string} [spawn.backendName]
   * @param {number} spawn.pid
   * @param {number} spawn.port
   * @param {string} [spawn.entry] - The `cli.js` the child was spawned with.
   * @param {string} [spawn.projectDir]
   */
  recordSpawn({ backendId, backendName, pid, port, entry, projectDir }) {
    const record = {
      version: 1,
      backendId,
      backendName: backendName || backendId,
      pid,
      port,
      endpoint: `http://127.0.0.1:${port}`,
      entry: entry || '',
      startedAt: new Date().toISOString(),
      owner: {
        kind: this.kind,
        pid: this.ownerPid,
        startedAt: this.startedAt,
        ...(projectDir ? { projectDir } : {})
      },
      heartbeatAt: new Date().toISOString()
    };
    writeJsonAtomic(this.recordPath(backendId), record);
    this.startHeartbeat(backendId);
    return record;
  }

  /**
   * Refresh `heartbeatAt` every {@link HEARTBEAT_INTERVAL_MS} while we own this
   * backend. `unref()` so a live timer can never be the reason the editor's main
   * process refuses to exit — a reaping mechanism that prevents a clean quit
   * would be creating the problem it exists to solve.
   * @private
   */
  startHeartbeat(backendId) {
    this.stopHeartbeat(backendId);
    const timer = setInterval(() => this.touch(backendId), HEARTBEAT_INTERVAL_MS);
    if (typeof timer.unref === 'function') timer.unref();
    this.heartbeats.set(backendId, timer);
  }

  /** @private */
  stopHeartbeat(backendId) {
    const timer = this.heartbeats.get(backendId);
    if (timer) {
      clearInterval(timer);
      this.heartbeats.delete(backendId);
    }
  }

  /** Rewrite `heartbeatAt` in place, leaving everything else alone. */
  touch(backendId) {
    const record = this.readRecord(backendId);
    if (!record) return;
    try {
      writeJsonAtomic(this.recordPath(backendId), { ...record, heartbeatAt: new Date().toISOString() });
    } catch (e) {
      safeLog(`Could not refresh the heartbeat of ${backendId}: ${e.message}`);
    }
  }

  /** Drop the record for a backend that stopped in an orderly way. Idempotent. */
  forgetSpawn(backendId) {
    this.stopHeartbeat(backendId);
    try {
      fs.rmSync(this.recordPath(backendId), { force: true });
    } catch (e) {
      // A record we cannot delete is a record the next sweep re-evaluates.
    }
  }

  /** Stop every heartbeat without touching any record or process. */
  stopAllHeartbeats() {
    for (const backendId of Array.from(this.heartbeats.keys())) this.stopHeartbeat(backendId);
  }

  /** The record for one backend, or null when absent/corrupt. Never throws. */
  readRecord(backendId) {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.recordPath(backendId), 'utf-8'));
      if (!parsed || typeof parsed !== 'object') return null;
      if (typeof parsed.backendId !== 'string' || typeof parsed.pid !== 'number') return null;
      return parsed;
    } catch (e) {
      return null;
    }
  }

  /** Every readable record under the root. A corrupt one is skipped, not fatal. */
  listRecords() {
    let entries = [];
    try {
      entries = fs.readdirSync(this.rootDir);
    } catch (e) {
      return [];
    }
    const records = [];
    for (const id of entries) {
      const record = this.readRecord(id);
      if (record) records.push(record);
    }
    return records;
  }

  // ── The sweep ─────────────────────────────────────────────────────────────

  /**
   * Settle every record under the root and reap the orphans.
   *
   * The outcome vocabulary is `noodl-mcp/src/backend/reaper.ts`'s, verbatim, so
   * the two sweeps can be compared: `self`, `owner-alive`, `already-gone`,
   * `stale-record`, `unverifiable`, `reaped`, `escaped`.
   *
   * ⚠️ One deliberate difference from the MCP reaper, and it is stricter rather
   * than looser: `self` means *a backend this session actually started*, not
   * merely a record whose owner pid equals ours. At startup we own nothing, so a
   * record left by a previous editor that happened to hold this pid is judged on
   * its heartbeat like any other — where the MCP reaper's `owner.pid === selfPid`
   * shortcut would skip it forever. It can only ever reap more, and only records
   * whose heartbeat is stale.
   *
   * Nothing here throws. A sweep that fails a startup is worse than one that
   * misses a process, so every outcome is a row in the report.
   *
   * @param {{ now?: number }} [options]
   * @returns {Promise<{backendId: string, pid: number, port: number, ownerKind: string, ownerPid: number, outcome: string, detail?: string}[]>}
   */
  async sweep(options = {}) {
    const now = options.now ?? Date.now();
    const rows = [];

    for (const record of this.listRecords()) {
      const row = (outcome, detail) => ({
        backendId: record.backendId,
        backendName: record.backendName,
        pid: record.pid,
        port: record.port,
        ownerKind: (record.owner && record.owner.kind) || 'unknown',
        ownerPid: (record.owner && record.owner.pid) || 0,
        outcome,
        ...(detail ? { detail } : {})
      });

      // Ours, in this session. Never our own live children.
      if (this.heartbeats.has(record.backendId) && record.owner && record.owner.pid === this.ownerPid) {
        rows.push(row('self'));
        continue;
      }

      if (this.isAlive((record.owner && record.owner.pid) || 0) && heartbeatIsFresh(record, now)) {
        rows.push(row('owner-alive'));
        continue;
      }

      if (!this.isAlive(record.pid)) {
        this.forgetSpawn(record.backendId);
        rows.push(row('already-gone'));
        continue;
      }

      const verdict = verifyIsOurBackend(record, await this.readCommandLine(record.pid));
      if (verdict === 'not-ours') {
        // The pid was recycled onto an unrelated process. Dropping the record is
        // the whole action: signalling it is the exact accident this avoids.
        this.forgetSpawn(record.backendId);
        rows.push(row('stale-record', `pid ${record.pid} is no longer our backend — record dropped, nothing signalled`));
        continue;
      }
      if (verdict === 'unverifiable') {
        rows.push(
          row(
            'unverifiable',
            `could not read the command line of pid ${record.pid}; left running and left recorded rather than ` +
              'signalling a pid we cannot prove is ours'
          )
        );
        continue;
      }

      const how = await terminate(record.pid, this.isAlive, this.kill);
      if (how === 'escaped') {
        rows.push(row('escaped', `pid ${record.pid} survived SIGTERM and SIGKILL`));
        safeLog(`Could not reap orphaned backend ${record.backendId} (pid ${record.pid})`);
        continue;
      }
      this.forgetSpawn(record.backendId);
      rows.push(
        row('reaped', `owner (${(record.owner && record.owner.kind) || 'unknown'} pid ${(record.owner && record.owner.pid) || 0}) is gone; stopped with ${how}`)
      );
      safeLog(`Reaped orphaned backend ${record.backendId} (pid ${record.pid}, port ${record.port})`);
    }

    return rows;
  }
}

module.exports = {
  BackendProcessRegistry,
  // Exported so the identity rules — the part the two spawners must agree on —
  // can be asserted directly, and reused rather than re-derived.
  processIsAlive,
  processCommandLine,
  verifyIsOurBackend,
  heartbeatIsFresh,
  probeHealth,
  terminate,
  RUNTIME_FILE,
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_STALE_MS
};
