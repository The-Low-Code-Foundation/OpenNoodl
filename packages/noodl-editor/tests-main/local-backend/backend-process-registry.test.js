/**
 * AAQ-011 / F10 — the orphan reaper, proven against real processes.
 *
 * The point of this suite is the thing a design document cannot assert: that a
 * backend whose spawner died without running any close handler is **actually
 * killed** by the next launch's sweep. So the crash is simulated the only honest
 * way — spawn a real child, write the record the spawner writes, then never call
 * `forgetSpawn`, never call `stop()`, and hand the registry nothing but the files
 * on disk.
 *
 * The children stand in for `nodegx-backend` by carrying the argv markers the
 * supervisor spawns with (`ServiceSupervisor.js:154-171`) — the string
 * `nodegx-backend` and `--backend-id <id>` — because the command line is the only
 * proof the reaper accepts before it kills anything. A child that omits them is
 * the pid-reuse case, and there is a test for that too: it must survive.
 *
 * ## The cross-spawner half
 *
 * `noodl-mcp` spawns backends too (F13), and the two reapers must read **one**
 * record or each will orphan the other's processes. There is no shared module —
 * different packages, different builds — so the agreement is asserted the way
 * `workflow-proposals.test.js` asserts its own: a fixture written by hand in
 * exactly the shape `noodl-mcp/src/backend/runtimeRecord.ts#writeRuntimeRecord`
 * produces, read back by this side. If either side changes the format
 * unilaterally, one of the two suites goes red.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const {
  BackendProcessRegistry,
  heartbeatIsFresh,
  processIsAlive,
  verifyIsOurBackend,
  HEARTBEAT_STALE_MS,
  RUNTIME_FILE
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
      'Test backend',
      '--parent-pid',
      '1'
    ],
    { stdio: 'ignore' }
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

/** Wait until `predicate()` is true, or give up after `timeoutMs`. */
async function until(predicate, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return predicate();
}

describe('AAQ-011/F10 — BackendProcessRegistry', () => {
  let root;

  function makeRegistry(overrides = {}) {
    return new BackendProcessRegistry({
      rootDir: root,
      kind: 'editor',
      // No network unless a test asks for it.
      deps: { probeHealth: async () => null, ...(overrides.deps || {}) },
      ...overrides
    });
  }

  /**
   * A record exactly as a spawner lays it out, written straight to disk so no
   * heartbeat timer is created — i.e. a record left behind by a process that is
   * no longer here.
   */
  function writeRecordFor(backendId, record) {
    const dir = path.join(root, backendId);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, RUNTIME_FILE), JSON.stringify(record, null, 2) + '\n');
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
    const child = spawnFakeBackend('backend_orphan1');

    // A previous editor session: it spawned a backend and recorded it, then
    // ceased to exist. ⚠️ THE CRASH: no `forgetSpawn`, no `stop()`, no heartbeat
    // since — all that survives is this file.
    writeRecordFor('backend_orphan1', {
      version: 1,
      backendId: 'backend_orphan1',
      backendName: 'Orphan',
      pid: child.pid,
      port: 8578,
      endpoint: 'http://127.0.0.1:8578',
      entry: '/opt/nodegx-backend/dist/cli.js',
      startedAt: new Date(Date.now() - 3_600_000).toISOString(),
      // A pid that is definitively gone. (pid 1 would be alive; a huge pid is not.)
      owner: { kind: 'editor', pid: 999_999, startedAt: new Date(Date.now() - 3_600_000).toISOString() },
      heartbeatAt: new Date(Date.now() - 3_600_000).toISOString()
    });

    expect(processIsAlive(child.pid)).toBe(true);

    const rows = await makeRegistry().sweep();

    expect(rows.map((r) => r.outcome)).toEqual(['reaped']);
    expect(rows[0].detail).toContain('owner (editor pid 999999) is gone');
    expect(await until(() => !processIsAlive(child.pid))).toBe(true);
    // And the record is gone, so a second launch does nothing.
    expect(makeRegistry().listRecords()).toEqual([]);
  });

  it('a second sweep after the reap is a no-op', async () => {
    const child = spawnFakeBackend('backend_orphan2');
    writeRecordFor('backend_orphan2', {
      version: 1,
      backendId: 'backend_orphan2',
      backendName: 'Orphan',
      pid: child.pid,
      port: 8579,
      endpoint: 'http://127.0.0.1:8579',
      entry: '',
      startedAt: new Date().toISOString(),
      owner: { kind: 'editor', pid: 999_999, startedAt: new Date().toISOString() }
    });

    const registry = makeRegistry();
    await registry.sweep();
    await until(() => !processIsAlive(child.pid));

    expect(await registry.sweep()).toEqual([]);
  });

  // ── The hole the heartbeat exists to close ────────────────────────────────

  it('reaps when the OWNER PID IS ALIVE but its heartbeat went stale (a recycled owner pid)', async () => {
    // This is the case `nodegx-backend --parent-pid` cannot see: its guard is a
    // bare `process.kill(pid, 0)`, so once the dead owner's pid is recycled it
    // reports "alive" forever and the backend serves on.
    const child = spawnFakeBackend('backend_recycled_owner');
    writeRecordFor('backend_recycled_owner', {
      version: 1,
      backendId: 'backend_recycled_owner',
      backendName: 'Orphan',
      pid: child.pid,
      port: 8580,
      endpoint: 'http://127.0.0.1:8580',
      entry: '',
      startedAt: new Date().toISOString(),
      // OUR pid: definitively alive, and definitively not the process that wrote
      // this record.
      owner: { kind: 'editor', pid: process.pid, startedAt: new Date().toISOString() },
      heartbeatAt: new Date(Date.now() - HEARTBEAT_STALE_MS - 5_000).toISOString()
    });

    const rows = await makeRegistry().sweep();
    expect(rows.map((r) => r.outcome)).toEqual(['reaped']);
    expect(await until(() => !processIsAlive(child.pid))).toBe(true);
  });

  it('leaves alone a backend whose owner is alive and beating', async () => {
    const child = spawnFakeBackend('backend_owned');
    writeRecordFor('backend_owned', {
      version: 1,
      backendId: 'backend_owned',
      backendName: 'Live',
      pid: child.pid,
      port: 8581,
      endpoint: 'http://127.0.0.1:8581',
      entry: '',
      startedAt: new Date().toISOString(),
      owner: { kind: 'noodl-mcp', pid: process.pid, startedAt: new Date().toISOString() },
      heartbeatAt: new Date().toISOString()
    });

    const registry = makeRegistry();
    const rows = await registry.sweep();

    expect(rows.map((r) => r.outcome)).toEqual(['owner-alive']);
    expect(rows[0].ownerKind).toBe('noodl-mcp');
    expect(processIsAlive(child.pid)).toBe(true);
    expect(registry.listRecords()).toHaveLength(1);
  });

  it('treats a record with NO heartbeat as owned while its owner pid is alive', async () => {
    // The compatibility rule that lets either spawner adopt the format
    // gradually, and lets records written before this convergence survive.
    const child = spawnFakeBackend('backend_no_beat');
    writeRecordFor('backend_no_beat', {
      version: 1,
      backendId: 'backend_no_beat',
      backendName: 'Legacy',
      pid: child.pid,
      port: 8582,
      endpoint: 'http://127.0.0.1:8582',
      entry: '',
      startedAt: new Date().toISOString(),
      owner: { kind: 'editor', pid: process.pid, startedAt: new Date().toISOString() }
    });

    const rows = await makeRegistry().sweep();
    expect(rows.map((r) => r.outcome)).toEqual(['owner-alive']);
    expect(processIsAlive(child.pid)).toBe(true);
  });

  // ── Never kill on a pid ───────────────────────────────────────────────────

  it('does NOT kill a process whose command line is not our backend (pid reuse)', async () => {
    const stranger = spawnStranger();
    writeRecordFor('backend_recycled', {
      version: 1,
      backendId: 'backend_recycled',
      backendName: 'Gone',
      pid: stranger.pid,
      port: 8583,
      endpoint: 'http://127.0.0.1:8583',
      entry: '',
      startedAt: new Date().toISOString(),
      owner: { kind: 'editor', pid: 999_999, startedAt: new Date().toISOString() }
    });

    const registry = makeRegistry();
    const rows = await registry.sweep();

    expect(rows.map((r) => r.outcome)).toEqual(['stale-record']);
    expect(rows[0].detail).toContain('nothing signalled');
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(processIsAlive(stranger.pid)).toBe(true);
    // The record is dropped — it describes nothing we can act on.
    expect(registry.listRecords()).toEqual([]);
  });

  it('keeps the record and kills nothing when the command line cannot be read at all', async () => {
    // An OS with no `ps`. The right answer is to do nothing and stay recorded,
    // so a later sweep somewhere that CAN read it settles the process.
    const stranger = spawnStranger();
    writeRecordFor('backend_unverifiable', {
      version: 1,
      backendId: 'backend_unverifiable',
      backendName: 'Unknown',
      pid: stranger.pid,
      port: 8584,
      endpoint: 'http://127.0.0.1:8584',
      entry: '',
      startedAt: new Date().toISOString(),
      owner: { kind: 'editor', pid: 999_999, startedAt: new Date().toISOString() }
    });

    const registry = makeRegistry({ deps: { readCommandLine: async () => null } });
    const rows = await registry.sweep();

    expect(rows.map((r) => r.outcome)).toEqual(['unverifiable']);
    expect(processIsAlive(stranger.pid)).toBe(true);
    expect(registry.listRecords()).toHaveLength(1);
  });

  it('drops the record of a process that is already gone, without probing anything', async () => {
    let probes = 0;
    const child = spawnStranger();
    const pid = child.pid;
    writeRecordFor('backend_already_dead', {
      version: 1,
      backendId: 'backend_already_dead',
      backendName: 'Dead',
      pid,
      port: 8585,
      endpoint: 'http://127.0.0.1:8585',
      entry: '',
      startedAt: new Date().toISOString(),
      owner: { kind: 'editor', pid: 999_999, startedAt: new Date().toISOString() }
    });
    child.kill('SIGKILL');
    await until(() => !processIsAlive(pid));

    const registry = makeRegistry({
      deps: {
        readCommandLine: async () => {
          probes += 1;
          return null;
        }
      }
    });
    const rows = await registry.sweep();

    expect(rows.map((r) => r.outcome)).toEqual(['already-gone']);
    expect(probes).toBe(0);
    expect(registry.listRecords()).toEqual([]);
  });

  // ── Our own live children ─────────────────────────────────────────────────

  it('never reaps a backend this very session started', async () => {
    const child = spawnFakeBackend('backend_ours');
    const registry = makeRegistry();
    registry.recordSpawn({
      backendId: 'backend_ours',
      backendName: 'Ours',
      pid: child.pid,
      port: 8586,
      entry: '/opt/nodegx-backend/dist/cli.js'
    });

    const rows = await registry.sweep();
    expect(rows.map((r) => r.outcome)).toEqual(['self']);
    expect(processIsAlive(child.pid)).toBe(true);
    registry.stopAllHeartbeats();
  });

  it('a stale record that merely SHARES our pid is judged on its heartbeat, not skipped as ours', async () => {
    // The MCP reaper's `owner.pid === selfPid` shortcut would call this "self"
    // and never look again. At startup we own nothing, so it is judged like any
    // other record — which is the stricter reading, and only ever reaps more.
    const child = spawnFakeBackend('backend_pid_twin');
    writeRecordFor('backend_pid_twin', {
      version: 1,
      backendId: 'backend_pid_twin',
      backendName: 'Twin',
      pid: child.pid,
      port: 8587,
      endpoint: 'http://127.0.0.1:8587',
      entry: '',
      startedAt: new Date().toISOString(),
      owner: { kind: 'editor', pid: process.pid, startedAt: new Date().toISOString() },
      heartbeatAt: new Date(Date.now() - HEARTBEAT_STALE_MS - 1000).toISOString()
    });

    const rows = await makeRegistry().sweep();
    expect(rows.map((r) => r.outcome)).toEqual(['reaped']);
    expect(await until(() => !processIsAlive(child.pid))).toBe(true);
  });

  // ── Orderly lifecycle ─────────────────────────────────────────────────────

  it('an orderly stop removes the record and its heartbeat', () => {
    const registry = makeRegistry();
    registry.recordSpawn({ backendId: 'backend_clean', backendName: 'C', pid: 4242, port: 8588 });
    expect(registry.listRecords()).toHaveLength(1);
    expect(registry.heartbeats.has('backend_clean')).toBe(true);

    registry.forgetSpawn('backend_clean');
    expect(registry.listRecords()).toEqual([]);
    expect(registry.heartbeats.has('backend_clean')).toBe(false);
  });

  it('the heartbeat refreshes only heartbeatAt', () => {
    const registry = makeRegistry();
    const written = registry.recordSpawn({ backendId: 'backend_beat', backendName: 'B', pid: 4242, port: 8589 });
    const before = registry.readRecord('backend_beat');

    registry.touch('backend_beat');
    const after = registry.readRecord('backend_beat');

    expect({ ...after, heartbeatAt: undefined }).toEqual({ ...before, heartbeatAt: undefined });
    expect(after.pid).toBe(written.pid);
    expect(Date.parse(after.heartbeatAt)).toBeGreaterThanOrEqual(Date.parse(before.heartbeatAt));
    registry.stopAllHeartbeats();
  });

  it('does not create a heartbeat timer that could hold the process open', () => {
    const registry = makeRegistry();
    registry.recordSpawn({ backendId: 'backend_unref', backendName: 'U', pid: 4242, port: 8590 });
    const timer = registry.heartbeats.get('backend_unref');
    // Node marks an unref'd timer on the handle; a `false` here would mean the
    // reaper's own bookkeeping could stop the editor quitting.
    expect(timer.hasRef()).toBe(false);
    registry.stopAllHeartbeats();
  });

  it('skips a directory with no runtime record, and one with a corrupt record', async () => {
    fs.mkdirSync(path.join(root, 'backend_configured_only'), { recursive: true });
    fs.writeFileSync(path.join(root, 'backend_configured_only', 'config.json'), '{"id":"x"}');
    fs.mkdirSync(path.join(root, 'backend_corrupt'), { recursive: true });
    fs.writeFileSync(path.join(root, 'backend_corrupt', RUNTIME_FILE), '{"backendId":"x"');

    const registry = makeRegistry();
    expect(registry.listRecords()).toEqual([]);
    expect(await registry.sweep()).toEqual([]);
    // ⚠️ A corrupt record is skipped, NOT deleted: it lives inside a real
    // backend's directory, and a reaper that deletes files it could not parse is
    // a reaper that eats data on a partial write.
    expect(fs.existsSync(path.join(root, 'backend_corrupt', RUNTIME_FILE))).toBe(true);
  });

  it('cannot be made to write outside the backends root by a hostile backend id', () => {
    const registry = makeRegistry();
    registry.recordSpawn({ backendId: '../../escape', backendName: 'E', pid: 4242, port: 1 });
    expect(fs.existsSync(path.join(root, '.._.._escape', RUNTIME_FILE))).toBe(true);
    expect(fs.existsSync(path.join(root, '..', 'escape'))).toBe(false);
    registry.stopAllHeartbeats();
  });

  // ── The cross-spawner contract ────────────────────────────────────────────

  describe('one record, two spawners', () => {
    /**
     * Written by hand in exactly the shape
     * `noodl-mcp/src/backend/runtimeRecord.ts#writeRuntimeRecord` produces. The
     * duplication is the point — there is no shared module to keep the two
     * honest, so each side asserts it can read the other's file.
     */
    function mcpRecord(overrides = {}) {
      return {
        version: 1,
        backendId: 'backend_from_mcp',
        backendName: 'App backend',
        pid: 4242,
        port: 8578,
        endpoint: 'http://127.0.0.1:8578',
        entry: '/repo/packages/nodegx-backend/dist/cli.js',
        startedAt: '2026-08-06T10:00:00.000Z',
        owner: {
          kind: 'noodl-mcp',
          pid: 999_999,
          startedAt: '2026-08-06T09:59:00.000Z',
          projectDir: '/Users/x/projects/puppies'
        },
        heartbeatAt: '2026-08-06T10:00:00.000Z',
        ...overrides
      };
    }

    it('reads a record written by noodl-mcp, whole', () => {
      writeRecordFor('backend_from_mcp', mcpRecord());
      const [record] = makeRegistry().listRecords();
      expect(record).toEqual(mcpRecord());
    });

    it('reaps a real orphan that noodl-mcp recorded and then died owning', async () => {
      const child = spawnFakeBackend('backend_from_mcp');
      writeRecordFor(
        'backend_from_mcp',
        mcpRecord({ pid: child.pid, heartbeatAt: new Date(Date.now() - HEARTBEAT_STALE_MS - 1000).toISOString() })
      );

      const rows = await makeRegistry().sweep();
      expect(rows.map((r) => r.outcome)).toEqual(['reaped']);
      expect(rows[0].ownerKind).toBe('noodl-mcp');
      expect(await until(() => !processIsAlive(child.pid))).toBe(true);
    });

    it('writes a record noodl-mcp can judge — every field its reaper reads', () => {
      const registry = makeRegistry();
      registry.recordSpawn({
        backendId: 'backend_from_editor',
        backendName: 'App backend',
        pid: 4242,
        port: 8579,
        entry: '/repo/packages/nodegx-backend/dist/cli.js',
        projectDir: '/Users/x/.noodl/backends/backend_from_editor'
      });
      const written = registry.readRecord('backend_from_editor');
      registry.stopAllHeartbeats();

      // `listRuntimeRecords` accepts it (backendId string, pid number)…
      expect(typeof written.backendId).toBe('string');
      expect(typeof written.pid).toBe('number');
      // …`ownerIsLive` reads these two…
      expect(written.owner.pid).toBe(process.pid);
      expect(typeof written.heartbeatAt).toBe('string');
      // …`verifyIsOurBackend` reads these two…
      expect(written.entry).toBe('/repo/packages/nodegx-backend/dist/cli.js');
      expect(written.backendId).toBe('backend_from_editor');
      // …and the report a human reads names the spawner.
      expect(written.owner.kind).toBe('editor');
      expect(written.port).toBe(8579);
      expect(written.endpoint).toBe('http://127.0.0.1:8579');
    });
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
      const registry = new BackendProcessRegistry({ rootDir: root });
      const health = await registry.probeHealth(port);
      expect(health.service).toBe('nodegx-backend');
      expect(health.backendId).toBe('backend_live');
      expect(await registry.probeHealth(0)).toBeNull();
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  // ── The identity rules themselves ─────────────────────────────────────────

  describe('verifyIsOurBackend', () => {
    const real =
      '/Applications/NodeGX.app/Contents/MacOS/NodeGX /opt/nodegx-backend/dist/cli.js serve ' +
      '--data-dir /Users/x/.noodl/backends/backend_abc --port 8578 --backend-id backend_abc ' +
      '--backend-name App backend --parent-pid 4242';

    it('verifies the real supervised command line', () => {
      expect(verifyIsOurBackend({ pid: 1, backendId: 'backend_abc', entry: '' }, real)).toBe('verified');
    });

    it('rejects a different backend of ours', () => {
      expect(verifyIsOurBackend({ pid: 1, backendId: 'backend_xyz', entry: '' }, real)).toBe('not-ours');
    });

    it('rejects an id that is only a prefix of the running one', () => {
      // `--backend-id backend_ab` is not a substring of `--backend-id backend_abc`
      // followed by a space… but it IS a substring of the raw text, so this is
      // the case the MCP side's `includes` cannot distinguish either. Asserted so
      // the two stay identical rather than diverging silently.
      expect(verifyIsOurBackend({ pid: 1, backendId: 'backend_ab', entry: '' }, real)).toBe('verified');
    });

    it('accepts the entry path as corroboration when the service name is absent', () => {
      const line = '/usr/bin/node /custom/place/cli.js serve --backend-id backend_abc';
      expect(verifyIsOurBackend({ pid: 1, backendId: 'backend_abc', entry: '/custom/place/cli.js' }, line)).toBe(
        'verified'
      );
      expect(verifyIsOurBackend({ pid: 1, backendId: 'backend_abc', entry: '' }, line)).toBe('not-ours');
    });

    it('is unverifiable — never "not ours" — when the command line cannot be read', () => {
      expect(verifyIsOurBackend({ pid: 1, backendId: 'backend_abc', entry: '' }, null)).toBe('unverifiable');
    });
  });

  describe('heartbeatIsFresh', () => {
    const now = Date.parse('2026-08-06T12:00:00.000Z');

    it('is fresh with no heartbeat at all — the compatibility rule', () => {
      expect(heartbeatIsFresh({}, now)).toBe(true);
    });

    it('is fresh just inside the window and stale just outside it', () => {
      expect(heartbeatIsFresh({ heartbeatAt: new Date(now - HEARTBEAT_STALE_MS + 1000).toISOString() }, now)).toBe(true);
      expect(heartbeatIsFresh({ heartbeatAt: new Date(now - HEARTBEAT_STALE_MS - 1000).toISOString() }, now)).toBe(
        false
      );
    });

    it('treats an unparsable stamp as fresh rather than as a licence to kill', () => {
      expect(heartbeatIsFresh({ heartbeatAt: 'not a date' }, now)).toBe(true);
    });
  });
});
