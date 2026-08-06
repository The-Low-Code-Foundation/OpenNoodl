/**
 * AAQ-011 / F10 slice 1 — the orphan reaper, proven against real processes.
 *
 * The point of this suite is the thing a design document cannot assert: that a
 * backend whose spawner died without running any close handler is **actually
 * killed** by the next launch's sweep. So the crash is simulated the only honest
 * way — spawn a real child, write the record the spawner writes, then never call
 * `forgetSpawn`, never call `stop()`, and hand the registry nothing but the
 * files on disk.
 *
 * The children stand in for `nodegx-backend` by carrying the same argv markers
 * the supervisor spawns with (`ServiceSupervisor.js:154-171`) — the string
 * `nodegx-backend` and `--backend-id <id>` — because the command line is the
 * only proof the reaper accepts before it kills anything. A child that omits
 * them is the pid-reuse case, and there is a test for that too: it must survive.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const {
  BackendProcessRegistry,
  commandLineMatches,
  isAlive,
  RECORD_VERSION
} = require('../../src/main/src/local-backend/BackendProcessRegistry');

/** Everything we spawned, so a failing assertion cannot leak a process. */
const spawned = [];

/**
 * A long-lived child whose command line looks exactly like a supervised
 * `nodegx-backend`. `node -e <script> -- <rest>` runs the script and leaves the
 * rest in argv, which is all we need: `ps` reports the whole line.
 */
function spawnFakeBackend(backendId) {
  const child = spawn(
    process.execPath,
    [
      '-e',
      'setInterval(() => {}, 100000)',
      '--',
      '/opt/nodegx-backend/dist/cli.js',
      'serve',
      '--data-dir',
      '/tmp/whatever',
      '--backend-id',
      backendId,
      '--backend-name',
      'Test backend'
    ],
    { stdio: 'ignore', detached: false }
  );
  spawned.push(child);
  return child;
}

/** A child with none of the markers — stands in for a recycled pid. */
function spawnStranger() {
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 100000)'], { stdio: 'ignore' });
  spawned.push(child);
  return child;
}

/** Wait until `predicate()` is true, or fail after `timeoutMs`. */
async function until(predicate, timeoutMs = 4000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return predicate();
}

describe('AAQ-011/F10 — BackendProcessRegistry', () => {
  let root;

  /** A registry that never touches the network unless a test asks it to. */
  function makeRegistry(overrides = {}) {
    return new BackendProcessRegistry({
      rootDir: root,
      kind: 'editor',
      deps: { probeHealth: async () => null, ...(overrides.deps || {}) },
      ...overrides
    });
  }

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'aaq011-registry-'));
  });

  afterEach(() => {
    for (const child of spawned.splice(0)) {
      try {
        child.kill('SIGKILL');
      } catch (e) {
        /* already gone */
      }
    }
    fs.rmSync(root, { recursive: true, force: true });
  });

  // ── The test this task exists for ─────────────────────────────────────────

  it('reaps a backend whose spawner died without running any close handler', async () => {
    // A previous editor session: it registered as owner, spawned a backend and
    // recorded it.
    const dead = new BackendProcessRegistry({ rootDir: root, ownerPid: process.pid, sessionId: 'session-that-crashed' });
    dead.registerOwner();

    const child = spawnFakeBackend('backend_orphan1');
    dead.recordSpawn({ backendId: 'backend_orphan1', pid: child.pid, port: 8578, name: 'Orphan' });

    // ⚠️ THE CRASH. Nothing else happens: no `releaseOwner`, no `forgetSpawn`,
    // no `stop()`. The process simply ceased to exist, and all that survives is
    // what is on disk.
    expect(isAlive(child.pid)).toBe(true);

    // The next launch. A fresh session id on the same pid is precisely what
    // happens on a machine that reuses pids, and it is the case the ownership
    // check has to get right: the owner file now belongs to *this* session, so
    // the crashed session's record is unowned.
    const next = makeRegistry({ ownerPid: process.pid, sessionId: 'session-after-restart' });
    next.registerOwner();

    const report = await next.sweep();

    expect(report.reaped.map((r) => r.backendId)).toEqual(['backend_orphan1']);
    expect(report.failed).toEqual([]);
    expect(await until(() => !isAlive(child.pid))).toBe(true);
    // And the record is gone, so a second launch does nothing.
    expect(next.listRecords()).toEqual([]);
  });

  it('a second sweep after the reap is a no-op', async () => {
    const dead = new BackendProcessRegistry({ rootDir: root, ownerPid: process.pid, sessionId: 'gone' });
    dead.registerOwner();
    const child = spawnFakeBackend('backend_orphan2');
    dead.recordSpawn({ backendId: 'backend_orphan2', pid: child.pid, port: 8579 });

    const next = makeRegistry({ sessionId: 'fresh' });
    next.registerOwner();
    await next.sweep();
    await until(() => !isAlive(child.pid));

    const second = await next.sweep();
    expect(second).toEqual({ reaped: [], kept: [], dropped: [], failed: [] });
  });

  // ── Never kill on a pid ───────────────────────────────────────────────────

  it('does NOT kill a process whose command line is not our backend (pid reuse)', async () => {
    const dead = new BackendProcessRegistry({ rootDir: root, ownerPid: process.pid, sessionId: 'crashed' });
    dead.registerOwner();

    // The record says pid P is our backend. It is not — P was recycled by
    // something else entirely. Killing it is the defect this guard prevents.
    const stranger = spawnStranger();
    dead.recordSpawn({ backendId: 'backend_recycled', pid: stranger.pid, port: 8580 });

    const next = makeRegistry({ sessionId: 'fresh' });
    next.registerOwner();
    const report = await next.sweep();

    expect(report.reaped).toEqual([]);
    expect(report.dropped).toHaveLength(1);
    expect(report.dropped[0].reason).toContain('identity not proven');
    // Still alive after a full sweep and a beat.
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(isAlive(stranger.pid)).toBe(true);
  });

  it('does NOT kill on a health match alone — a port identifies no pid', async () => {
    const stranger = spawnStranger();

    const dead = new BackendProcessRegistry({ rootDir: root, ownerPid: process.pid, sessionId: 'crashed' });
    dead.registerOwner();
    dead.recordSpawn({ backendId: 'backend_health_only', pid: stranger.pid, port: 8581 });

    const next = makeRegistry({
      sessionId: 'fresh',
      deps: {
        // The port answers as our backend; the pid is somebody else's.
        probeHealth: async () => ({ ok: true, service: 'nodegx-backend', backendId: 'backend_health_only' })
      }
    });
    next.registerOwner();
    const report = await next.sweep();

    expect(report.reaped).toEqual([]);
    expect(report.dropped[0].reason).toContain('health-only');
    expect(isAlive(stranger.pid)).toBe(true);
  });

  it('drops the record of a process that is already gone, without probing anything', async () => {
    let probes = 0;
    const dead = new BackendProcessRegistry({ rootDir: root, sessionId: 'crashed' });
    dead.registerOwner();

    const child = spawnStranger();
    const pid = child.pid;
    dead.recordSpawn({ backendId: 'backend_already_dead', pid, port: 8582 });
    child.kill('SIGKILL');
    await until(() => !isAlive(pid));

    const next = makeRegistry({
      sessionId: 'fresh',
      deps: {
        readCommandLine: async () => {
          probes += 1;
          return null;
        }
      }
    });
    next.registerOwner();
    const report = await next.sweep();

    expect(report.dropped).toEqual([{ backendId: 'backend_already_dead', pid, reason: 'process is already gone' }]);
    expect(probes).toBe(0);
    expect(next.listRecords()).toEqual([]);
  });

  // ── Ownership ─────────────────────────────────────────────────────────────

  it('leaves alone a backend a live owner still claims', async () => {
    // A second spawner — think `noodl-mcp`, or the editor when this one is a
    // packaged build with its own userData. Its owner file is present and its
    // pid is alive, so its backends are not ours to kill.
    const other = new BackendProcessRegistry({ rootDir: root, ownerPid: process.pid, sessionId: 'other-live', kind: 'mcp' });
    other.registerOwner();
    const child = spawnFakeBackend('backend_owned');
    other.recordSpawn({ backendId: 'backend_owned', pid: child.pid, port: 8583 });

    // A different spawner sweeps. Note its ownerPid differs, so registering does
    // not overwrite the other's claim.
    const us = makeRegistry({ ownerPid: 999999, sessionId: 'ours' });
    us.registerOwner();
    const report = await us.sweep();

    expect(report.reaped).toEqual([]);
    expect(report.kept).toHaveLength(1);
    expect(report.kept[0].reason).toContain('live mcp session');
    expect(isAlive(child.pid)).toBe(true);
    expect(us.listRecords()).toHaveLength(1);
  });

  it('reaps when the owner pid is alive but belongs to a different session', async () => {
    // The owner crashed; a later process took its pid and registered its own
    // claim. `process.kill(pid, 0)` says "alive" and is wrong — the session id
    // is what catches it.
    const crashed = new BackendProcessRegistry({ rootDir: root, ownerPid: process.pid, sessionId: 'session-A' });
    crashed.registerOwner();
    const child = spawnFakeBackend('backend_recycled_owner');
    crashed.recordSpawn({ backendId: 'backend_recycled_owner', pid: child.pid, port: 8584 });

    const reuser = makeRegistry({ ownerPid: process.pid, sessionId: 'session-B' });
    reuser.registerOwner(); // overwrites owners/<pid>.json

    const report = await reuser.sweep();
    expect(report.reaped.map((r) => r.backendId)).toEqual(['backend_recycled_owner']);
    expect(await until(() => !isAlive(child.pid))).toBe(true);
  });

  it('reaps when the owner left no claim at all (a spawner that never registered)', async () => {
    const child = spawnFakeBackend('backend_unclaimed');
    fs.mkdirSync(path.join(root, 'processes'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'processes', 'backend_unclaimed.json'),
      JSON.stringify({
        version: RECORD_VERSION,
        backendId: 'backend_unclaimed',
        pid: child.pid,
        port: 8585,
        spawnedAt: new Date().toISOString(),
        owner: { pid: 424242, sessionId: 'never-registered', kind: 'mcp' }
      })
    );

    const us = makeRegistry({ sessionId: 'ours' });
    us.registerOwner();
    const report = await us.sweep();

    expect(report.reaped.map((r) => r.backendId)).toEqual(['backend_unclaimed']);
    expect(await until(() => !isAlive(child.pid))).toBe(true);
  });

  it('prunes owner claims left by dead processes, but not its own', async () => {
    const ghost = new BackendProcessRegistry({ rootDir: root, ownerPid: 424243, sessionId: 'ghost' });
    ghost.registerOwner();

    const us = makeRegistry({ sessionId: 'ours' });
    us.registerOwner();
    await us.sweep();

    const owners = us.listOwners();
    expect(owners.map((o) => o.pid)).toEqual([process.pid]);
  });

  // ── Orderly lifecycle ─────────────────────────────────────────────────────

  it('an orderly stop removes the record, so the next launch sees nothing', async () => {
    const registry = makeRegistry({ sessionId: 'ours' });
    registry.registerOwner();
    registry.recordSpawn({ backendId: 'backend_clean', pid: 4242, port: 8586 });
    expect(registry.listRecords()).toHaveLength(1);

    registry.forgetSpawn('backend_clean');
    expect(registry.listRecords()).toEqual([]);

    registry.releaseOwner();
    expect(registry.listOwners()).toEqual([]);
  });

  it('discards records it cannot parse rather than accumulating them', async () => {
    fs.mkdirSync(path.join(root, 'processes'), { recursive: true });
    fs.writeFileSync(path.join(root, 'processes', 'half-written.json'), '{"version":1,"backendId":"x"');
    fs.writeFileSync(
      path.join(root, 'processes', 'from-the-future.json'),
      JSON.stringify({ version: 99, backendId: 'y', pid: 4242 })
    );

    const registry = makeRegistry({ sessionId: 'ours' });
    expect(registry.listRecords()).toEqual([]);
    expect(fs.readdirSync(path.join(root, 'processes'))).toEqual([]);
  });

  it('cannot be made to write outside its directory by a hostile backend id', () => {
    const registry = makeRegistry({ sessionId: 'ours' });
    registry.recordSpawn({ backendId: '../../escape', pid: 4242, port: 1 });
    expect(fs.existsSync(path.join(root, 'processes', '.._.._escape.json'))).toBe(true);
    expect(fs.existsSync(path.join(root, '..', 'escape.json'))).toBe(false);
  });

  // ── The real health probe, against a real server ──────────────────────────

  it('recognises a real backend by its /health response', async () => {
    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, service: 'nodegx-backend', backendId: 'backend_live' }));
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;

    try {
      const registry = new BackendProcessRegistry({ rootDir: root, sessionId: 'ours' });
      // No stub: this exercises the real fetch against the real listener.
      const health = await registry.probeHealth(port);
      expect(health.service).toBe('nodegx-backend');
      expect(health.backendId).toBe('backend_live');
      expect(await registry.probeHealth(port + 1 > 65535 ? 1 : 0)).toBeNull();
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  // ── The identity rule itself ──────────────────────────────────────────────

  describe('commandLineMatches', () => {
    const real =
      '/Applications/NodeGX.app/Contents/MacOS/NodeGX /opt/nodegx-backend/dist/cli.js serve ' +
      '--data-dir /Users/x/.noodl/backends/backend_abc --port 8578 --backend-id backend_abc ' +
      '--backend-name App backend --parent-pid 4242';

    it('accepts the real supervised command line', () => {
      expect(commandLineMatches(real, 'backend_abc')).toBe(true);
    });

    it('rejects a different backend of ours', () => {
      expect(commandLineMatches(real, 'backend_xyz')).toBe(false);
    });

    it('rejects an id that is only a prefix of the running one', () => {
      expect(commandLineMatches(real, 'backend_ab')).toBe(false);
    });

    it('rejects a process that is not our service at all', () => {
      expect(commandLineMatches('/usr/bin/node server.js --backend-id backend_abc', 'backend_abc')).toBe(false);
    });

    it('treats an unreadable command line as no proof', () => {
      expect(commandLineMatches(null, 'backend_abc')).toBe(false);
      expect(commandLineMatches('', 'backend_abc')).toBe(false);
    });

    it('accepts the = and quoted spellings', () => {
      expect(commandLineMatches('nodegx-backend/cli.js --backend-id=backend_abc --port 1', 'backend_abc')).toBe(true);
      expect(commandLineMatches('nodegx-backend\\cli.js --backend-id "backend_abc" --port 1', 'backend_abc')).toBe(true);
    });
  });
});
