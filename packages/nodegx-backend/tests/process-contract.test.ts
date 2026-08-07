/**
 * WF-004 process contract, exercised against the real artifact: build the
 * bundle, spawn `bin/nodegx-backend.js serve` as a plain Node child (exactly
 * how the editor's ServiceSupervisor and a deploy target run it), handshake on
 * the `NODEGX_BACKEND_READY` stdout line, hit /health over the wall of a real
 * process boundary, and verify SIGTERM shuts it down cleanly.
 */
import { execSync, spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

jest.setTimeout(60000);

const PKG_ROOT = path.resolve(__dirname, '..');
const BIN = path.join(PKG_ROOT, 'bin', 'nodegx-backend.js');
const READY_PREFIX = 'NODEGX_BACKEND_READY ';

describe('process contract (real bundle, real child process)', () => {
  let dataDir: string;
  let child: ChildProcess | null = null;

  beforeAll(() => {
    // The contract is against the built artifact — build it (sub-second).
    execSync('node scripts/build.js', { cwd: PKG_ROOT, stdio: 'pipe' });
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-backend-proc-'));
  });

  afterAll(() => {
    if (child && child.exitCode === null) child.kill('SIGKILL');
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('spawns, prints READY with the bound port, serves /health, exits 0 on SIGTERM', async () => {
    child = spawn(
      process.execPath,
      [BIN, 'serve', '--data-dir', dataDir, '--port', '0', '--backend-id', 'proc_test', '--backend-name', 'Proc'],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    );

    const ready = await new Promise<{ port: number; persistence: string }>((resolve, reject) => {
      let out = '';
      const timeout = setTimeout(() => reject(new Error(`no READY line. Output so far:\n${out}`)), 30000);
      child!.stdout!.on('data', (chunk: Buffer) => {
        out += chunk.toString();
        const line = out.split('\n').find((l) => l.startsWith(READY_PREFIX));
        if (line) {
          clearTimeout(timeout);
          resolve(JSON.parse(line.substring(READY_PREFIX.length)));
        }
      });
      child!.on('exit', (code) => {
        clearTimeout(timeout);
        reject(new Error(`exited before READY (code=${code}). Output:\n${out}`));
      });
    });

    expect(ready.port).toBeGreaterThan(0);
    expect(ready.persistence).toBe('persistent');

    const health = await fetch(`http://127.0.0.1:${ready.port}/health`);
    expect(health.status).toBe(200);
    const body = (await health.json()) as { backendId: string; persistence: { persistent: boolean } };
    expect(body.backendId).toBe('proc_test');
    expect(body.persistence.persistent).toBe(true);

    const exitCode = await new Promise<number | null>((resolve) => {
      child!.once('exit', (code) => resolve(code));
      child!.kill('SIGTERM');
    });
    expect(exitCode).toBe(0);
    child = null;
  });
});
