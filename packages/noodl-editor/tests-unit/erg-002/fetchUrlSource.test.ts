/**
 * ERG-002 — `fetchUrlSource` and `registerLibrary`'s `source.kind === 'url'`
 * path, against a real (local, loopback-only) HTTP server rather than a
 * mocked `http.get` — the redirect-follow behaviour in particular is easy to
 * get subtly wrong with a mock that doesn't model status/location the way
 * Node's client actually consumes them.
 */
import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';

import { fetchUrlSource, registerLibrary } from '../../src/shared/utils/projectmodules';

const UMD_SOURCE = `(function (global) { global.PocketBase = function () { return 'client'; }; })(this);`;

describe('fetchUrlSource', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      if (req.url === '/redirect') {
        res.writeHead(302, { Location: '/pocketbase.umd.js' });
        res.end();
        return;
      }
      if (req.url === '/pocketbase.umd.js') {
        res.writeHead(200, { 'Content-Type': 'application/javascript' });
        res.end(UMD_SOURCE);
        return;
      }
      if (req.url === '/missing.js') {
        res.writeHead(404);
        res.end('not found');
        return;
      }
      res.writeHead(404);
      res.end();
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (address === null || typeof address === 'string') throw new Error('server did not bind to a port');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('fetches a direct URL', async () => {
    const code = await fetchUrlSource(`${baseUrl}/pocketbase.umd.js`);
    expect(code).toBe(UMD_SOURCE);
  });

  it('follows a redirect', async () => {
    const code = await fetchUrlSource(`${baseUrl}/redirect`);
    expect(code).toBe(UMD_SOURCE);
  });

  it('rejects a non-2xx response with a message naming the status', async () => {
    await expect(fetchUrlSource(`${baseUrl}/missing.js`)).rejects.toThrow(/404/);
  });

  describe('registerLibrary with source.kind === "url"', () => {
    let projectDir: string;

    beforeEach(async () => {
      projectDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'erg-002-url-'));
    });

    afterEach(async () => {
      await fs.promises.rm(projectDir, { recursive: true, force: true });
    });

    it('vendor: true downloads the file and keeps no remote dependency', async () => {
      const result = await registerLibrary(projectDir, {
        name: 'PocketBase',
        source: { kind: 'url', url: `${baseUrl}/pocketbase.umd.js` },
        globalName: 'PocketBase',
        vendor: true
      });

      expect(result.ok).toBe(true);
      const dir = path.join(projectDir, 'noodl_modules', 'pocketbase');
      const manifest = JSON.parse(await fs.promises.readFile(path.join(dir, 'manifest.json'), 'utf8'));
      expect(manifest.main).toBe('pocketbase.umd.js');
      expect(manifest.dependencies).toEqual([]);
      expect(await fs.promises.readFile(path.join(dir, 'pocketbase.umd.js'), 'utf8')).toBe(UMD_SOURCE);
    });

    it('vendor: false keeps the CDN URL as a dependency and writes no script file', async () => {
      const result = await registerLibrary(projectDir, {
        name: 'PocketBase',
        source: { kind: 'url', url: `${baseUrl}/pocketbase.umd.js` },
        globalName: 'PocketBase',
        vendor: false
      });

      expect(result.ok).toBe(true);
      const dir = path.join(projectDir, 'noodl_modules', 'pocketbase');
      const manifest = JSON.parse(await fs.promises.readFile(path.join(dir, 'manifest.json'), 'utf8'));
      expect(manifest.dependencies).toEqual([`${baseUrl}/pocketbase.umd.js`]);
      expect(manifest.main).toBeUndefined();

      const filesInDir = await fs.promises.readdir(dir);
      expect(filesInDir).toEqual(['manifest.json']);
    });

    it('a 404 source surfaces as a fetch failure, not a crash, and writes nothing', async () => {
      const result = await registerLibrary(projectDir, {
        name: 'PocketBase',
        source: { kind: 'url', url: `${baseUrl}/missing.js` },
        globalName: 'PocketBase'
      });

      expect(result.ok).toBe(false);
      expect(result.message).toMatch(/could not fetch/i);
      await expect(fs.promises.access(path.join(projectDir, 'noodl_modules'))).rejects.toThrow();
    });
  });
});
