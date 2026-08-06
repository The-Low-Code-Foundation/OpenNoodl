/**
 * AAQ-011/F13 — the reaper, including one end-to-end pass against a REAL
 * `nodegx-backend` child whose owner is then simulated as crashed.
 *
 * The unit cases below cover the branches that matter (pid reuse, an
 * unverifiable pid, a live owner, a stale heartbeat) with injected seams. The
 * last block does the thing the task actually asks for: spawn something, kill
 * the owner, prove the backend is gone.
 */
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { reapOrphanedBackends, ReapRow } from '../src/backend/reaper';
import {
  BackendRuntimeRecord,
  heartbeatIsFresh,
  listRuntimeRecords,
  readRuntimeRecord,
  RUNTIME_FILE,
  verifyIsOurBackend,
  writeRuntimeRecord
} from '../src/backend/runtimeRecord';

const BACKEND_CLI = path.join(__dirname, '..', '..', 'nodegx-backend', 'dist', 'cli.js');

function tempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-reaper-'));
}

function record(root: string, over: Partial<BackendRuntimeRecord> = {}): BackendRuntimeRecord {
  const full: BackendRuntimeRecord = {
    version: 1,
    backendId: over.backendId ?? 'backend_test',
    backendName: 'Test backend',
    pid: 4242,
    port: 8578,
    endpoint: 'http://127.0.0.1:8578',
    entry: '/repo/packages/nodegx-backend/dist/cli.js',
    startedAt: new Date().toISOString(),
    owner: { kind: 'noodl-mcp', pid: 9999, startedAt: new Date().toISOString() },
    ...over
  };
  writeRuntimeRecord(full, root);
  return full;
}

/** A command line the way `ps -o command=` prints one for our spawns. */
function ourCommandLine(backendId: string): string {
  return `/usr/bin/node /repo/packages/nodegx-backend/dist/cli.js serve --data-dir /d --port 8578 --backend-id ${backendId} --backend-name X --parent-pid 9999`;
}

describe('AAQ-011/F13 runtime record', () => {
  it('round-trips, lists and deletes, and writes 0600', () => {
    const root = tempRoot();
    record(root, { backendId: 'backend_a' });
    record(root, { backendId: 'backend_b' });

    expect(listRuntimeRecords(root).map((r) => r.backendId).sort()).toEqual(['backend_a', 'backend_b']);
    expect(readRuntimeRecord('backend_a', root)?.port).toBe(8578);

    if (process.platform !== 'win32') {
      const mode = fs.statSync(path.join(root, 'backend_a', RUNTIME_FILE)).mode & 0o777;
      expect(mode).toBe(0o600);
    }
  });

  it('skips a corrupt record instead of failing the whole sweep', () => {
    const root = tempRoot();
    record(root, { backendId: 'backend_good' });
    fs.mkdirSync(path.join(root, 'backend_bad'), { recursive: true });
    fs.writeFileSync(path.join(root, 'backend_bad', RUNTIME_FILE), '{ not json');

    expect(listRuntimeRecords(root).map((r) => r.backendId)).toEqual(['backend_good']);
  });

  it('a record with no heartbeat is fresh — the editor has not adopted them yet', () => {
    expect(heartbeatIsFresh({}, Date.now())).toBe(true);
    expect(heartbeatIsFresh({ heartbeatAt: new Date().toISOString() }, Date.now())).toBe(true);
    expect(heartbeatIsFresh({ heartbeatAt: new Date(Date.now() - 120_000).toISOString() }, Date.now())).toBe(false);
  });

  it('verifies a pid by its command line and never by the pid alone', () => {
    const r = { pid: 1, backendId: 'backend_a', entry: '/repo/packages/nodegx-backend/dist/cli.js' };
    expect(verifyIsOurBackend(r, ourCommandLine('backend_a'))).toBe('verified');
    // Pid reuse: something else entirely now holds the pid.
    expect(verifyIsOurBackend(r, '/usr/sbin/cupsd -l')).toBe('not-ours');
    // A DIFFERENT backend on the same pid is also not ours to kill.
    expect(verifyIsOurBackend(r, ourCommandLine('backend_zzz'))).toBe('not-ours');
    // No command line at all — the answer is "don't know", never "kill it".
    expect(verifyIsOurBackend(r, null)).toBe('unverifiable');
  });
});

describe('AAQ-011/F13 reaper', () => {
  const never = () => {
    throw new Error('the reaper signalled a process it should not have');
  };

  it('leaves a live owner alone, whichever spawner owns it', async () => {
    const root = tempRoot();
    record(root, { backendId: 'backend_mcp', owner: { kind: 'noodl-mcp', pid: 111, startedAt: '' } });
    record(root, { backendId: 'backend_editor', owner: { kind: 'editor', pid: 222, startedAt: '' } });

    const rows = await reapOrphanedBackends({
      root,
      selfPid: 1,
      isAlive: () => true,
      commandLineOf: (pid) => ourCommandLine(`backend_${pid}`),
      kill: never
    });
    expect(rows.every((r) => r.outcome === 'owner-alive')).toBe(true);
    expect(listRuntimeRecords(root)).toHaveLength(2);
  });

  it('never reaps its own record', async () => {
    const root = tempRoot();
    record(root, { owner: { kind: 'noodl-mcp', pid: 4711, startedAt: '' } });
    const rows = await reapOrphanedBackends({ root, selfPid: 4711, isAlive: () => false, kill: never });
    expect(rows.map((r) => r.outcome)).toEqual(['self']);
    expect(listRuntimeRecords(root)).toHaveLength(1);
  });

  it('treats a stale heartbeat as a dead owner even when the owner pid resolves', async () => {
    // This is the hole in `nodegx-backend --parent-pid`: the recycled owner pid
    // makes the backend's own guard report "alive" forever.
    const root = tempRoot();
    record(root, {
      backendId: 'backend_a',
      heartbeatAt: new Date(Date.now() - 5 * 60_000).toISOString(),
      owner: { kind: 'noodl-mcp', pid: 111, startedAt: '' }
    });
    const killed: Array<[number, string]> = [];
    const rows = await reapOrphanedBackends({
      root,
      selfPid: 1,
      isAlive: (pid) => (killed.length > 0 && pid === 4242 ? false : true),
      commandLineOf: () => ourCommandLine('backend_a'),
      kill: (pid, sig) => killed.push([pid, sig])
    });
    expect(rows.map((r) => r.outcome)).toEqual(['reaped']);
    expect(killed[0]).toEqual([4242, 'SIGTERM']);
    expect(listRuntimeRecords(root)).toHaveLength(0);
  });

  it('drops the record but signals NOTHING when the pid was reused', async () => {
    const root = tempRoot();
    record(root, { backendId: 'backend_a' });
    const rows = await reapOrphanedBackends({
      root,
      selfPid: 1,
      isAlive: (pid) => pid === 4242, // backend pid alive, owner gone
      commandLineOf: () => '/usr/sbin/sshd -D',
      kill: never
    });
    expect(rows.map((r) => r.outcome)).toEqual(['stale-record']);
    expect(listRuntimeRecords(root)).toHaveLength(0);
  });

  it('signals nothing and KEEPS the record when the pid cannot be verified', async () => {
    const root = tempRoot();
    record(root, { backendId: 'backend_a' });
    const rows = await reapOrphanedBackends({
      root,
      selfPid: 1,
      isAlive: (pid) => pid === 4242,
      commandLineOf: () => null,
      kill: never
    });
    expect(rows.map((r) => r.outcome)).toEqual(['unverifiable']);
    // Kept: a record we drop is a process we can never find again.
    expect(listRuntimeRecords(root)).toHaveLength(1);
  });

  it('removes the record when both owner and backend are already gone', async () => {
    const root = tempRoot();
    record(root, { backendId: 'backend_a' });
    const rows = await reapOrphanedBackends({ root, selfPid: 1, isAlive: () => false, kill: never });
    expect(rows.map((r) => r.outcome)).toEqual(['already-gone']);
    expect(listRuntimeRecords(root)).toHaveLength(0);
  });

  it('escalates to SIGKILL when SIGTERM is ignored', async () => {
    const root = tempRoot();
    record(root, { backendId: 'backend_a' });
    const signals: string[] = [];
    const rows = await reapOrphanedBackends({
      root,
      selfPid: 1,
      isAlive: (pid) => pid === 4242,
      commandLineOf: () => ourCommandLine('backend_a'),
      kill: (_pid, sig) => signals.push(sig)
    });
    expect(signals).toEqual(['SIGTERM', 'SIGKILL']);
    expect(rows[0].outcome).toBe('reaped');
    expect(rows[0].detail).toContain('escaped');
  }, 10000);
});

// ────────────────────────────────────────────────────────────────────────────
// The end-to-end pass: a real process, a simulated owner crash, a real reap.
// ────────────────────────────────────────────────────────────────────────────

const haveBundle = fs.existsSync(BACKEND_CLI);
const describeOrSkip = haveBundle ? describe : describe.skip;

describeOrSkip('AAQ-011/F13 reaper — a real backend orphaned by a crashed owner', () => {
  jest.setTimeout(60000);
  let child: ChildProcess | undefined;
  let root: string;

  afterEach(() => {
    if (child && child.exitCode === null) {
      try {
        child.kill('SIGKILL');
      } catch {
        /* already gone */
      }
    }
    child = undefined;
  });

  it('spawns a backend, loses its owner, and reaps it — verified by command line, not by pid', async () => {
    root = tempRoot();
    const backendId = 'backend_orphan';
    const dataDir = path.join(root, backendId, 'data');
    fs.mkdirSync(dataDir, { recursive: true });
    const port = 18600 + (process.pid % 300);

    // The owner is a *separate* node process we can kill without killing jest —
    // that is the crash we are simulating. The backend is spawned by jest so it
    // survives the owner's death (an orphan, exactly as if the MCP server had
    // been SIGKILLed after spawning it).
    const owner = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { stdio: 'ignore' });
    const ownerPid = owner.pid as number;

    child = spawn(
      process.execPath,
      [
        BACKEND_CLI,
        'serve',
        '--data-dir',
        dataDir,
        '--port',
        String(port),
        '--backend-id',
        backendId,
        '--backend-name',
        'Orphan',
        // Deliberately NOT --parent-pid: this test is about the backstop, not
        // about the backend's own guard. (Provisioning passes it as well.)
        '--no-admin'
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    );

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('backend did not become ready')), 30000);
      child!.stdout!.on('data', (chunk: Buffer) => {
        if (chunk.toString().includes('NODEGX_BACKEND_READY')) {
          clearTimeout(timer);
          resolve();
        }
      });
      child!.on('exit', (code) => {
        clearTimeout(timer);
        reject(new Error(`backend exited early (code=${code})`));
      });
    });

    writeRuntimeRecord(
      {
        version: 1,
        backendId,
        backendName: 'Orphan',
        pid: child.pid as number,
        port,
        endpoint: `http://127.0.0.1:${port}`,
        entry: BACKEND_CLI,
        startedAt: new Date().toISOString(),
        owner: { kind: 'noodl-mcp', pid: ownerPid, startedAt: new Date().toISOString() },
        heartbeatAt: new Date().toISOString()
      },
      root
    );

    // It really is serving.
    const health = await fetch(`http://127.0.0.1:${port}/health`).then((r) => r.json());
    expect(health.backendId).toBe(backendId);

    // ── The crash. ──────────────────────────────────────────────────────────
    owner.kill('SIGKILL');
    await new Promise<void>((resolve) => owner.on('exit', () => resolve()));

    // ── The sweep, with NO injected seams: real ps, real signals. ────────────
    const rows: ReapRow[] = await reapOrphanedBackends({ root, selfPid: process.pid });
    expect(rows).toHaveLength(1);
    expect(rows[0].outcome).toBe('reaped');
    expect(rows[0].backendId).toBe(backendId);

    // The process is gone…
    await new Promise<void>((resolve) => {
      if (child!.exitCode !== null) return resolve();
      child!.on('exit', () => resolve());
    });
    expect(child.exitCode !== null || child.signalCode !== null).toBe(true);

    // …the port no longer answers…
    await expect(fetch(`http://127.0.0.1:${port}/health`)).rejects.toBeDefined();

    // …and the record is gone with it.
    expect(listRuntimeRecords(root)).toHaveLength(0);
  });
});
