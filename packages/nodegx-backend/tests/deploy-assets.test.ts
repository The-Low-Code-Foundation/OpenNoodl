/**
 * WF-003 — the deploy assets, checked against the thing they describe.
 *
 * Deploy configuration rots in a particular way: it is correct on the day it is
 * written, nobody runs it in CI, and it fails months later in the one
 * environment where debugging is hardest. These tests exist to make two
 * specific rots impossible.
 *
 *   1. **Route drift.** The single-origin design means nginx must forward every
 *      top-level path family the backend serves. A task that adds a new family
 *      (a `/search` for BAK-008, say) would otherwise ship a route that 404s in
 *      production and works everywhere else. So: start a real service, read its
 *      real route table, and require nginx.conf to cover it.
 *   2. **Credentials in artifacts.** WF-003's success criteria say "no
 *      credentials in artifacts", which is only worth anything if something
 *      checks. The packager's scanner is exercised here against planted
 *      material, so we know it would catch a real leak rather than assuming it.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { BackendService } from '../src/service';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { scanForSecrets, readBakedEndpoint, auditEndpoint } = require('../scripts/package-deploy.js');

jest.setTimeout(30000);

const DEPLOY_DIR = path.join(__dirname, '..', 'deploy');
const NGINX_CONF = fs.readFileSync(path.join(DEPLOY_DIR, 'nginx.conf'), 'utf-8');

describe('WF-003 deploy assets — nginx covers the backend route table', () => {
  /**
   * Every path segment nginx forwards to the backend: the alternation in the
   * API regex location, plus any `^~` prefix location (realtime is one, and is
   * separate because SSE needs proxy_buffering off).
   */
  function proxiedPrefixes(): Set<string> {
    const prefixes = new Set<string>();
    const alternation = /location\s+~\s+\^\/\(([^)]+)\)/g;
    let m: RegExpExecArray | null;
    while ((m = alternation.exec(NGINX_CONF)) !== null) {
      for (const alt of m[1].split('|')) prefixes.add(alt.trim());
    }
    const prefixLoc = /location\s+\^~\s+\/([A-Za-z0-9_-]+)/g;
    while ((m = prefixLoc.exec(NGINX_CONF)) !== null) prefixes.add(m[1]);
    return prefixes;
  }

  it('forwards every top-level route family the service actually serves', async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-deploy-routes-'));
    const service = new BackendService({ dataDir, port: 0 });
    const started = await service.start();
    try {
      const table = service.getRouteTable();
      // Sanity: we are looking at the real surface, not an empty table.
      expect(table.length).toBeGreaterThanOrEqual(35);

      const families = [...new Set(table.map((r) => r.pattern.split('/')[0]))].sort();
      const proxied = proxiedPrefixes();
      // A family may be DELIBERATELY not exposed through the public origin —
      // /metrics is (BAK-009). The exemption lives in the conf itself, marked
      // `NOT-EXPOSED: /path`, so the artifact explains itself and this test is
      // not the place someone has to remember to look.
      const notExposed = new Set(
        [...NGINX_CONF.matchAll(/NOT-EXPOSED:\s*\/([A-Za-z0-9_-]+)/g)].map((m) => m[1])
      );
      const missing = families.filter((f) => !proxied.has(f) && !notExposed.has(f));

      expect({ missing, hint: '' }).toEqual({
        missing: [],
        hint: ''
      });
      // The message above is terse by necessity; make the fix obvious when it fires.
      if (missing.length) {
        throw new Error(
          `deploy/nginx.conf does not forward these backend route families: ${missing.join(', ')}.\n` +
            'Add them to the alternation in the API `location ~ ^/(...)` block, and to the reserved-name ' +
            'list in docs/runtime/SELF-HOSTING.md. Without this a deployed app 404s on those paths while ' +
            'every local test passes.'
        );
      }
    } finally {
      await started.stop();
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });

  it('gives SSE its own location so realtime is not buffered or timed out', () => {
    const block = /location\s+\^~\s+\/realtime\s*\{([\s\S]*?)\n {4}\}/.exec(NGINX_CONF);
    expect(block).not.toBeNull();
    expect(block![1]).toMatch(/proxy_buffering\s+off/);
    expect(block![1]).toMatch(/proxy_read_timeout\s+24h/);
  });

  it('never publishes the backend port — the front door is the only way in', () => {
    const compose = fs.readFileSync(path.join(DEPLOY_DIR, 'docker-compose.yml'), 'utf-8');
    const backendBlock = /\n {2}backend:\n([\s\S]*?)\n {2}web:/.exec(compose);
    expect(backendBlock).not.toBeNull();
    expect(backendBlock![1]).not.toMatch(/^\s+ports:/m);
  });
});

describe('WF-003 deploy assets — the artifact carries no credentials', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-deploy-scan-'));
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it('passes a clean tree', () => {
    fs.writeFileSync(path.join(root, 'app.js'), 'console.log("no secrets here, just a token of appreciation");');
    expect(scanForSecrets(root)).toEqual([]);
  });

  it.each([
    ['secrets.json', '{"adminToken":"whatever"}'],
    ['.env', 'NODEGX_ADMIN_TOKEN=hunter2'],
    // SQLite's real file magic. The NUL is escaped rather than literal: an
    // actual NUL byte anywhere in a source file makes git treat the whole file
    // as binary and stop showing diffs for it.
    ['local.db', 'SQLite format 3\u0000'],
    ['server.pem', 'irrelevant']
  ])('rejects the machine-local file %s', (name, body) => {
    fs.writeFileSync(path.join(root, name), body);
    expect(scanForSecrets(root).length).toBeGreaterThan(0);
  });

  it.each([
    ['a minted admin credential', 'x = {"adminToken":"aL-DZyM2fx2tDocuUTvBGVrOUALBkh9ejZ1SxXWYx60"};'],
    ['a private key', '-----BEGIN RSA PRIVATE KEY-----\nMIIE...'],
    ['an AWS key id', 'const k = "AKIAIOSFODNN7EXAMPLE";'],
    ['a password in a connection string', 'const u = "postgres://admin:s3cr3tpassword@db.internal:5432/app";']
  ])('finds %s planted in a bundle', (_label, body) => {
    fs.writeFileSync(path.join(root, 'bundle.js'), `/* padding */\n${body}\n`);
    const findings = scanForSecrets(root);
    expect(findings.length).toBeGreaterThan(0);
    // The report must never echo the secret it found.
    for (const f of findings) expect(f.excerpt).not.toMatch(/AKIA|s3cr3t|aL-DZ/);
  });

  it('does not cry wolf over the words the real bundle is full of', () => {
    fs.writeFileSync(
      path.join(root, 'bundle.js'),
      [
        'const authToken = options.token;',
        'headers["X-Parse-Master-Key"] = masterKey;',
        'if (!password) throw new Error("password required");',
        'const endpoint = "https://api.example.com/v1";',
        'smtp.auth = { user: config.username, pass: config.password };'
      ].join('\n')
    );
    expect(scanForSecrets(root)).toEqual([]);
  });
});

describe('WF-003 deploy assets — the baked backend endpoint is audited', () => {
  let appRoot: string;

  beforeEach(() => {
    appRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-deploy-app-'));
  });
  afterEach(() => fs.rmSync(appRoot, { recursive: true, force: true }));

  /** Shaped like the editor's real output: metadata inside window.projectData. */
  function writeAppBundle(endpoint: string) {
    fs.writeFileSync(
      path.join(appRoot, 'index-deadbeef.js'),
      'window.projectData = {"components":[],"metadata":{"cloudservices":' +
        JSON.stringify({ instanceId: 'i1', endpoint, appId: 'nodegx-backend', type: 'nodegx' }) +
        '}};'
    );
  }

  it('reads the endpoint the editor baked in', () => {
    writeAppBundle('https://app.school.example');
    const baked = readBakedEndpoint(appRoot);
    expect(baked.found).toBe(true);
    expect(baked.endpoint).toBe('https://app.school.example');
    expect(baked.appId).toBe('nodegx-backend');
  });

  it('refuses a localhost endpoint when a site URL is declared', () => {
    writeAppBundle('http://localhost:8577');
    const audit = auditEndpoint(readBakedEndpoint(appRoot), 'https://app.school.example');
    expect(audit.level).toBe('error');
    expect(audit.message).toMatch(/loopback|localhost/i);
  });

  it('warns about a localhost endpoint even with no site URL declared', () => {
    writeAppBundle('http://127.0.0.1:8577');
    expect(auditEndpoint(readBakedEndpoint(appRoot), undefined).level).toBe('warn');
  });

  /**
   * Deploying to loopback is a legitimate smoke test on your own machine, so
   * "the endpoint is localhost" cannot be the rule — "the endpoint is not where
   * this stack will be served" is. An early version got this wrong and refused
   * to package WF-003's own verification run.
   */
  it('accepts a loopback endpoint when the stack is genuinely deployed to loopback', () => {
    writeAppBundle('http://127.0.0.1:8080');
    const audit = auditEndpoint(readBakedEndpoint(appRoot), 'http://127.0.0.1:8080');
    expect(audit.level).toBe('ok');
    expect(audit.message).toMatch(/only reachable from the machine/i);
  });

  it('refuses an endpoint pointing at a different origin than the deploy target', () => {
    writeAppBundle('https://someone-elses-backend.example');
    expect(auditEndpoint(readBakedEndpoint(appRoot), 'https://app.school.example').level).toBe('error');
  });

  it('accepts a matching origin regardless of trailing slash or case', () => {
    writeAppBundle('https://App.School.Example/');
    expect(auditEndpoint(readBakedEndpoint(appRoot), 'https://app.school.example').level).toBe('ok');
  });

  it('accepts an empty endpoint as same-origin — the single-origin stack', () => {
    writeAppBundle('');
    const audit = auditEndpoint(readBakedEndpoint(appRoot), 'https://app.school.example');
    expect(audit.level).toBe('ok');
    expect(audit.message).toMatch(/same-origin/i);
  });

  it('warns rather than failing when an app uses no backend at all', () => {
    fs.writeFileSync(path.join(appRoot, 'index-cafe.js'), 'window.projectData = {"components":[]};');
    expect(auditEndpoint(readBakedEndpoint(appRoot), 'https://app.school.example').level).toBe('warn');
  });
});
