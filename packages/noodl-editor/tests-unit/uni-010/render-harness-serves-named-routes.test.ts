/**
 * UNI-010 §8.2 (serving half) — a named route is the app, not a missing file.
 *
 * `render-from-disk.js` answered `/` and static files and **404'd everything
 * else**, including the start page's own `urlPath`. Measured at HEAD before the
 * fix on a five-route project: `/` 200, `/landing` `/thank-you` `/home` all 404.
 *
 * ## ⚠️ What this half is and is NOT responsible for
 *
 * CN-001 recorded this 404 as the reason *"anything driven by `urlPath` is
 * unmeasurable by this instrument"*, and that inference is wrong. The runtime's
 * default `navigationPathType` is `hash`, and **a hash is never sent to a
 * server** — `/#thank-you` was served and rendered correctly the whole time.
 * What blinded F4 was that `render-report.js` never navigated, which is the
 * sibling test. This half matters for projects configured with
 * `navigationPathType: 'path'`, and for anyone who types a route by hand.
 *
 * ## 🔴 Why the fallback is restricted to extension-less paths
 *
 * The obvious version — "serve index.html for anything unresolved" — hands back
 * HTML for a missing `.png`. The report **counts broken images**, and an `<img>`
 * pointing at 200-with-HTML is not a broken image to the browser. So the tidy
 * version of this fix would have quietly disabled a check that works, in a
 * report that would go on saying `0 broken`. The 404 assertion below is the
 * control for that, and it is the reason this file spawns a real server instead
 * of asserting on the source.
 */
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';

const REPO = path.resolve(__dirname, '..', '..', '..', '..');
const SERVER = path.join(REPO, 'scripts', 'devtools', 'render-from-disk.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { freePort } = require(path.join(REPO, 'scripts', 'devtools', 'render-report.js'));

jest.setTimeout(30_000);

function writeFixture(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uni010-serve-'));
  const write = (rel: string, body: unknown) => {
    fs.mkdirSync(path.join(dir, path.dirname(rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), typeof body === 'string' ? body : JSON.stringify(body));
  };
  write('nodegx.project.json', {
    name: 'serve-fixture',
    version: '4',
    structure: { componentsDir: 'components' },
    settings: {},
    rootNodeId: 'router'
  });
  write('components/_registry.json', { components: { App: { path: 'App' }, 'Pages/Home': { path: 'Pages/Home' } } });
  write('components/App/component.json', { path: '/App' });
  write('components/App/nodes.json', {
    nodes: [{ id: 'router', type: 'Router', parameters: { pages: { startPage: '/Pages/Home', routes: ['/Pages/Home'] } } }],
    visualRoots: ['router']
  });
  write('components/Pages/Home/component.json', { path: '/Pages/Home' });
  write('components/Pages/Home/nodes.json', {
    nodes: [
      { id: 'page', type: 'Page', parameters: { title: 'Home', urlPath: 'home' }, children: ['t'] },
      { id: 't', type: 'Text', parameters: { text: 'Hi' }, parent: 'page' }
    ],
    visualRoots: ['page']
  });
  return dir;
}

function get(port: number, urlPath: string): Promise<{ status: number; body: string; type: string }> {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path: urlPath }, (res) => {
      let body = '';
      res.on('data', (d) => (body += d));
      res.on('end', () =>
        resolve({ status: res.statusCode ?? 0, body, type: String(res.headers['content-type'] ?? '') })
      );
    });
    req.on('error', reject);
  });
}

describe('UNI-010 §8.2 — the harness serves the app on a named route', () => {
  let server: ChildProcess;
  let port: number;

  beforeAll(async () => {
    port = await freePort();
    const dir = writeFixture();
    server = spawn(process.execPath, [SERVER, dir, '--port', String(port)], { stdio: 'ignore' });
    // Poll rather than sleep: a fixed wait is either flaky or slow, and this
    // file is in the suite everyone runs.
    for (let i = 0; i < 60; i++) {
      try {
        await get(port, '/');
        return;
      } catch {
        await new Promise((r) => setTimeout(r, 250));
      }
    }
    throw new Error('render-from-disk never started listening');
  });

  afterAll(() => {
    if (server) server.kill();
  });

  it('🔴 serves the app on a named route that used to 404', async () => {
    const res = await get(port, '/home');
    expect(res.status).toBe(200);
    expect(res.type).toMatch(/text\/html/);
  });

  it('🔴 serves the same document there as at the root', async () => {
    // A route that 200s with something *other* than the app is the same
    // blindness wearing a better status code.
    const [root, named] = [await get(port, '/'), await get(port, '/home')];
    expect(named.body).toBe(root.body);
    expect(root.body).toMatch(/<html/i);
  });

  it('🔴 CONTROL — a missing ASSET still 404s, so broken-image keeps working', async () => {
    // The assertion that stops the fallback from being widened. If this ever
    // returns 200, `images.broken` silently goes to zero for every project.
    const res = await get(port, '/missing.png');
    expect(res.status).toBe(404);
  });

  it('✅ CONTROL — a real asset is still served as itself, not as the app', async () => {
    // Without this, a fallback that swallowed *everything* would pass the two
    // assertions above and serve HTML for the viewer bundle.
    const res = await get(port, '/noodl.viewer.js');
    expect(res.status).toBe(200);
    expect(res.body).not.toMatch(/^<!DOCTYPE html>/i);
  });
});
