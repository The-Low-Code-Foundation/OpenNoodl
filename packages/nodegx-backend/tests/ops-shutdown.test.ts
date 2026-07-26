/**
 * BAK-009 graceful shutdown, driven by a real SIGTERM at a real child process.
 *
 * In-process assertions would prove nothing here: the whole question is what
 * `docker stop` and systemd see — does the process exit 0, does an in-flight
 * request get its answer, does an SSE client learn the stream is going away, is
 * the drain actually bounded. So this spawns the CLI exactly the way a
 * container does, sends the same signal, and reads the same exit code.
 */
import { ChildProcess, execFileSync, spawn } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

jest.setTimeout(60000);

/** A workflow whose only step waits, so a run is a request in flight for a known duration. */
const SLOW_WORKFLOW = {
  version: 1,
  id: 'slow',
  name: 'Slow',
  entry: 'pause',
  concurrency: 1,
  steps: [{ id: 'pause', kind: 'wait', params: { duration: 1200, unit: 'milliseconds' } }],
  createdAt: '2026-07-26T00:00:00.000Z',
  updatedAt: '2026-07-26T00:00:00.000Z'
};

describe('BAK-009 graceful shutdown', () => {
  let dataDir: string;
  let child: ChildProcess | null = null;
  let base: string;
  let adminToken: string;

  function startService(): Promise<void> {
    return new Promise((resolve, reject) => {
      const cli = path.join(__dirname, '..', 'bin', 'nodegx-backend.js');
      child = spawn(process.execPath, [cli, 'serve', '--data-dir', dataDir, '--port', '0'], {
        env: { ...process.env, NODEGX_LOG_LEVEL: 'info', NODEGX_LOG_FORMAT: 'json' },
        stdio: ['ignore', 'pipe', 'pipe']
      });
      let out = '';
      const timer = setTimeout(() => reject(new Error(`service did not become ready:\n${out}`)), 30000);
      child.stdout!.on('data', (chunk) => {
        out += String(chunk);
        const line = /NODEGX_BACKEND_READY (\{.*\})/.exec(out);
        if (line) {
          clearTimeout(timer);
          base = JSON.parse(line[1]).url;
          resolve();
        }
      });
      child.stderr!.on('data', (chunk) => {
        out += String(chunk);
      });
      child.on('exit', (code) => {
        if (base === undefined) {
          clearTimeout(timer);
          reject(new Error(`service exited early (${code}):\n${out}`));
        }
      });
    });
  }

  /** Resolves with the exit code once the child is gone. */
  function exitCode(): Promise<number | null> {
    return new Promise((resolve) => child!.on('exit', (code) => resolve(code)));
  }

  beforeAll(async () => {
    // BUILD FIRST. `bin/nodegx-backend.js` loads `dist/cli.js`, so without this
    // the test grades whatever bundle happens to be lying around — it would
    // have passed against a stale artifact while the source was broken, which
    // is the exact failure mode this suite exists to catch. esbuild takes well
    // under a second, so paying it here is cheap insurance.
    execFileSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'build.js')], {
      cwd: path.join(__dirname, '..'),
      stdio: 'ignore'
    });

    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-ops-shutdown-'));
    fs.mkdirSync(path.join(dataDir, 'workflow-defs'), { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'workflow-defs', 'slow.workflow-def.json'), JSON.stringify(SLOW_WORKFLOW));
    await startService();
    adminToken = JSON.parse(fs.readFileSync(path.join(dataDir, 'secrets.json'), 'utf-8')).adminToken;
  });

  afterAll(() => {
    if (child && child.exitCode === null) child.kill('SIGKILL');
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('finishes in-flight work, says goodbye to SSE clients, and exits 0 on SIGTERM', async () => {
    // 1. An SSE client, holding a stream open.
    const controller = new AbortController();
    const stream = await fetch(`${base}/realtime`, {
      headers: { accept: 'text/event-stream' },
      signal: controller.signal
    });
    expect(stream.status).toBe(200);
    const reader = stream.body!.getReader();
    const decoder = new TextDecoder();
    let received = '';
    const readAll = (async () => {
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          received += decoder.decode(value, { stream: true });
        }
      } catch {
        /* the stream ends with the process */
      }
    })();

    // Wait for the `connected` frame so the connection is definitely registered.
    for (let i = 0; i < 50 && !received.includes('connected'); i++) {
      await new Promise((r) => setTimeout(r, 20));
    }
    expect(received).toContain('connected');

    // 2. A request that will still be running when the signal arrives.
    const inFlight = fetch(`${base}/admin/workflow-defs/slow/run`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${adminToken}` },
      body: '{}'
    });
    await new Promise((r) => setTimeout(r, 250));

    // 3. The signal a container sends.
    const exited = exitCode();
    child!.kill('SIGTERM');

    // 4. The in-flight request is ANSWERED, not reset — this is the whole point.
    const response = await inFlight;
    expect(response.status).toBe(200);

    // 5. The SSE client was told to resync before the stream ended.
    await readAll;
    expect(received).toContain('resync');
    expect(received).toContain('server-shutdown');
    controller.abort();

    // 6. And the process exits cleanly, which is what `docker stop` grades on.
    expect(await exited).toBe(0);
  });

  it('refuses new connections once draining has started', async () => {
    // The service from the previous test is gone; a request to the same port
    // must fail rather than hang or be served by a half-dead process.
    await expect(fetch(`${base}/health`)).rejects.toBeDefined();
  });
});
