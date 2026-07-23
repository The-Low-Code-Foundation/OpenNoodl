/**
 * Test helpers: drive the *built* CLI, not the TypeScript sources.
 *
 * That is deliberate. The risk in this package is not the logic — it is the
 * bundle: the platform binding, the module stubs, the node register loading
 * headlessly. Testing the sources under ts-jest would exercise none of that and
 * a green suite would prove nothing about the artifact people actually run.
 */

import { spawn, type ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';

export const PKG_ROOT = path.resolve(__dirname, '..');
export const DIST = path.join(PKG_ROOT, 'dist/noodl-preview.cjs');
export const FIXTURES = path.join(PKG_ROOT, 'tests/fixtures');
const DEPLOY_DIR = path.resolve(PKG_ROOT, '../noodl-editor/src/external/deploy');

/**
 * Both prerequisites are build artifacts. Missing ones fail loudly with the
 * command that fixes them — a skipped suite would quietly claim nothing broke.
 */
export function assertPrerequisites(): void {
  if (!fs.existsSync(DIST)) {
    throw new Error(`Missing ${DIST}. Build it: npm --prefix packages/noodl-preview run build`);
  }
  if (!fs.existsSync(path.join(DEPLOY_DIR, 'index.html'))) {
    throw new Error(`Missing the deployed viewer runtime in ${DEPLOY_DIR}. Build it: npm run build:editor:_viewer`);
  }
}

/** Copies a fixture into a temp dir so specs can mutate it freely. */
export function scratchCopy(fixture: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'noodl-preview-test-'));
  fs.cpSync(path.join(FIXTURES, fixture), dir, { recursive: true });
  return dir;
}

export interface RunningPreview {
  port: number;
  stdout: string;
  stop: () => Promise<void>;
}

/** Boots the CLI on an ephemeral port and resolves once it reports the URL. */
export function startPreview(projectDir: string, extraArgs: string[] = []): Promise<RunningPreview> {
  const child: ChildProcess = spawn(process.execPath, [DIST, projectDir, '--port', '0', ...extraArgs], {
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let stdout = '';
  let stderr = '';
  child.stderr?.on('data', (chunk) => (stderr += chunk));

  return new Promise((resolve, reject) => {
    const fail = setTimeout(() => reject(new Error(`Preview did not start.\nstdout:\n${stdout}\nstderr:\n${stderr}`)), 45_000);

    child.stdout?.on('data', (chunk) => {
      stdout += chunk;
      const match = stdout.match(/http:\/\/[\d.]+:(\d+)/);
      if (!match) return;
      clearTimeout(fail);
      resolve({
        port: Number(match[1]),
        get stdout() {
          return stdout;
        },
        stop: () =>
          new Promise<void>((done) => {
            child.once('exit', () => done());
            child.kill('SIGKILL');
          })
      });
    });

    child.once('exit', (code) => {
      clearTimeout(fail);
      reject(new Error(`Preview exited with ${code}.\nstdout:\n${stdout}\nstderr:\n${stderr}`));
    });
  });
}

export interface Fetched {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: string;
}

export function get(port: number, urlPath: string, headers: Record<string, string> = {}): Promise<Fetched> {
  return new Promise((resolve, reject) => {
    http
      .get({ host: '127.0.0.1', port, path: urlPath, headers }, (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body }));
      })
      .on('error', reject);
  });
}

export const getJson = async (port: number, urlPath: string) => JSON.parse((await get(port, urlPath)).body);

/** Polls the preview's state endpoint until `predicate` holds, or times out. */
export async function waitForState(
  port: number,
  predicate: (state: TSFixme) => boolean,
  timeoutMs = 8000
): Promise<TSFixme> {
  const deadline = Date.now() + timeoutMs;
  let last: TSFixme;
  while (Date.now() < deadline) {
    last = await getJson(port, '/__preview/state');
    if (predicate(last)) return last;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`State never satisfied the predicate. Last: ${JSON.stringify(last)}`);
}

/** Opens the SSE channel and collects frames until `stop()` is called. */
export function openEvents(port: number): { frames: TSFixme[]; close: () => void } {
  const frames: TSFixme[] = [];
  const req = http.get({ host: '127.0.0.1', port, path: '/__preview/events' }, (res) => {
    let buffer = '';
    res.on('data', (chunk) => {
      buffer += chunk;
      let index: number;
      while ((index = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        const line = frame.split('\n').find((l) => l.startsWith('data: '));
        if (line) frames.push(JSON.parse(line.slice(6)));
      }
    });
  });
  return { frames, close: () => req.destroy() };
}

export function writeJson(file: string, mutate: (json: TSFixme) => void): void {
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  mutate(json);
  fs.writeFileSync(file, JSON.stringify(json, null, 2));
}
