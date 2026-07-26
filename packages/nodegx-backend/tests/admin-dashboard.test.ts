/**
 * BAK-005 — the served admin dashboard.
 *
 * Three levels, because three different things can break:
 *
 *   1. Pure policy (no server): the read-only rule and the failure budget.
 *   2. Document assembly: the page is genuinely self-contained and genuinely
 *      substituted. This level exists because a mis-substituted page still
 *      returns 200 with a plausible byte count — the first live load of this
 *      dashboard shipped its entire stylesheet inside an HTML comment while
 *      looking perfectly healthy over curl.
 *   3. End-to-end over real HTTP against a LOCKED backend: who can sign in,
 *      what the read-only tier can and cannot do, `--no-admin`, and the
 *      delete-table capability this task was asked to finally wire up.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { BackendService } from '../src/service';
import { SecurityStartupError } from '../src/security/state';
import { AuthAttemptLimiter } from '../src/admin/auth';
import { READONLY_SAFE_ROUTES, readonlyAdminMayCall } from '../src/admin/readonly';

jest.setTimeout(30000);

const LOCKED_CONFIG = {
  version: 1,
  devOpen: false,
  defaults: {
    permissions: { find: 'authenticated', get: 'authenticated', create: 'authenticated', update: 'authenticated', delete: 'authenticated' },
    creatorOwns: true
  },
  collections: {},
  functions: {},
  files: { upload: 'authenticated', read: 'authenticated', delete: 'nobody' },
  signup: 'public'
};

const UI_DIR = path.join(__dirname, '..', 'src', 'admin', 'ui');

// ============================================================================
// 1. Policy, with no server in the way
// ============================================================================

describe('BAK-005 read-only policy', () => {
  it('permits every safe method', () => {
    for (const method of ['GET', 'HEAD', 'OPTIONS']) {
      expect(readonlyAdminMayCall(method, 'admin/schema')).toBe(true);
      expect(readonlyAdminMayCall(method, 'api/:table')).toBe(true);
    }
  });

  it('refuses state-changing methods by DEFAULT, including routes it has never heard of', () => {
    for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) {
      expect(readonlyAdminMayCall(method, 'admin/schema')).toBe(false);
      // The point of the coarse rule: a route added by a future task is
      // refused without anyone remembering to annotate it.
      expect(readonlyAdminMayCall(method, 'admin/some-future-task/thing')).toBe(false);
    }
  });

  it('permits exactly the reviewed safe-POST set, and nothing adjacent to it', () => {
    for (const pattern of READONLY_SAFE_ROUTES) {
      expect(readonlyAdminMayCall('POST', pattern)).toBe(true);
    }
    // The mutating sibling of a safe route must not be swept in.
    expect(READONLY_SAFE_ROUTES.has('admin/schema/diff')).toBe(true);
    expect(readonlyAdminMayCall('POST', 'admin/schema/apply')).toBe(false);
    expect(readonlyAdminMayCall('POST', 'admin/backups/restore')).toBe(false);
  });
});

describe('BAK-005 credential failure budget', () => {
  it('locks out only after the budget is spent, and only that client', () => {
    const limiter = new AuthAttemptLimiter(3, 60_000);
    expect(limiter.isLockedOut('1.2.3.4')).toBe(false);
    limiter.recordFailure('1.2.3.4');
    limiter.recordFailure('1.2.3.4');
    expect(limiter.isLockedOut('1.2.3.4')).toBe(false);
    limiter.recordFailure('1.2.3.4');
    expect(limiter.isLockedOut('1.2.3.4')).toBe(true);
    expect(limiter.isLockedOut('5.6.7.8')).toBe(false);
    expect(limiter.retryAfterSeconds('1.2.3.4')).toBeGreaterThan(0);
  });

  it('forgets the window once it expires', async () => {
    const limiter = new AuthAttemptLimiter(1, 30);
    limiter.recordFailure('k');
    expect(limiter.isLockedOut('k')).toBe(true);
    await new Promise((r) => setTimeout(r, 60));
    expect(limiter.isLockedOut('k')).toBe(false);
  });

  it('successes do not launder a guessing run (only failures are counted)', () => {
    const limiter = new AuthAttemptLimiter(2, 60_000);
    limiter.recordFailure('k');
    // There is deliberately no recordSuccess(): a valid session running
    // alongside an attack must not refill the attacker's budget.
    expect(typeof (limiter as unknown as Record<string, unknown>).recordSuccess).toBe('undefined');
    limiter.recordFailure('k');
    expect(limiter.isLockedOut('k')).toBe(true);
  });
});

// ============================================================================
// 2. The document itself
// ============================================================================

describe('BAK-005 dashboard document', () => {
  const html = fs.readFileSync(path.join(UI_DIR, 'index.html'), 'utf-8');
  const css = fs.readFileSync(path.join(UI_DIR, 'styles.css'), 'utf-8');

  function occurrences(haystack: string, needle: string): number {
    return haystack.split(needle).length - 1;
  }

  it('carries each substitution marker exactly where it belongs', () => {
    // Assembled from fragments so this assertion does not become its own
    // second occurrence — which is exactly the bug it guards against.
    expect(occurrences(html, '/*__ADMIN' + '_CSS__*/')).toBe(1);
    // One for the style tag, one for the script tag.
    expect(occurrences(html, '__CSP' + '_NONCE__')).toBe(2);
  });

  it('references no external origin', () => {
    // A CDN link, a remote font, a tracking pixel: none of them may exist, or
    // the CSP that forbids them would break the page instead of protecting it.
    const external = html.match(/(?:src|href)\s*=\s*["'](https?:)?\/\//gi);
    expect(external).toBeNull();
    expect(css).not.toMatch(/@import|url\(\s*["']?https?:/i);
  });

  it('renders backend values through textContent, never innerHTML', () => {
    // The dashboard prints record contents. If any of it went through
    // innerHTML, a hostile value in a row would execute.
    expect(html).not.toMatch(/\.innerHTML\s*=/);
    expect(html).not.toMatch(/insertAdjacentHTML/);
  });

  it('keeps red for danger only (the phase-23 palette law)', () => {
    // Every rule that CONSUMES the red token must be a destructive/failure
    // affordance. `:root` is where the token is defined, not used.
    const rules = css.split('}');
    const offenders: string[] = [];
    for (const rule of rules) {
      if (!rule.includes('var(--danger')) continue;
      const selector = rule.slice(0, rule.indexOf('{')).trim();
      if (selector === ':root') continue;
      if (!/danger|\.bad/.test(selector)) offenders.push(selector);
    }
    expect(offenders).toEqual([]);
  });
});

// ============================================================================
// 3. End to end, on a locked backend
// ============================================================================

describe('BAK-005 dashboard over HTTP (locked backend)', () => {
  let dataDir: string;
  let service: BackendService;
  let base: string;
  let adminToken: string;
  const readonlyToken = 'readonly-secret-for-tests';

  async function req(
    method: string,
    pathName: string,
    body?: unknown,
    headers: Record<string, string> = {}
  ): Promise<{ status: number; json: any; text: string; headers: Headers }> {
    const res = await fetch(`${base}${pathName}`, {
      method,
      headers: body !== undefined ? { 'content-type': 'application/json', ...headers } : headers,
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* html */
    }
    return { status: res.status, json, text, headers: res.headers };
  }

  const asAdmin = () => ({ authorization: `Bearer ${adminToken}` });
  const asReadonly = () => ({ authorization: `Bearer ${readonlyToken}` });

  beforeAll(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-bak005-'));
    fs.writeFileSync(path.join(dataDir, 'security.json'), JSON.stringify(LOCKED_CONFIG));
    service = new BackendService({ dataDir, port: 0, backendId: 'dash_test', backendName: 'Dashboard Test', readonlyToken });
    const started = await service.start();
    base = started.listen.url;
    expect(started.security.enforced).toBe(true);
    expect(started.security.hasReadonlyTier).toBe(true);
    adminToken = JSON.parse(fs.readFileSync(path.join(dataDir, 'secrets.json'), 'utf-8')).adminToken;
  });

  afterAll(async () => {
    await service.stop();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  // -- the page ------------------------------------------------------------

  it('serves a fully-assembled document with no leftover markers', async () => {
    const { status, text } = await req('GET', '/_admin');
    expect(status).toBe(200);
    expect(text).not.toContain('ADMIN_CSS');
    expect(text).not.toContain('CSP_NONCE');
    // The stylesheet is inside the style block, not somewhere that merely
    // contains the bytes. (The original bug put it inside an HTML comment.)
    const styleBlock = text.slice(text.indexOf('<style'), text.indexOf('</style>'));
    expect(styleBlock).toContain('--bg-page');
    expect(styleBlock).toContain('button.btn.primary');
  });

  it('locks the page down with a CSP that forbids every external origin', async () => {
    const { headers } = await req('GET', '/_admin');
    const csp = headers.get('content-security-policy') || '';
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toMatch(/script-src 'nonce-[^']+'/);
    // No 'unsafe-inline' anywhere — the nonce is what allows our own script.
    expect(csp).not.toContain('unsafe-inline');
    expect(headers.get('x-content-type-options')).toBe('nosniff');
    expect(headers.get('cache-control')).toBe('no-store');
  });

  it('mints a fresh nonce per response', async () => {
    const a = await req('GET', '/_admin');
    const b = await req('GET', '/_admin');
    expect(a.headers.get('content-security-policy')).not.toBe(b.headers.get('content-security-policy'));
  });

  // -- sign-in -------------------------------------------------------------

  it('the document is public (it IS the login page) but whoami is not', async () => {
    expect((await req('GET', '/_admin')).status).toBe(200);
    expect((await req('GET', '/_admin/whoami')).status).toBe(401);
    expect((await req('GET', '/_admin/whoami', undefined, { authorization: 'Bearer wrong' })).status).toBe(401);
  });

  it('whoami reports the tier, the posture and the available sections', async () => {
    const { status, json } = await req('GET', '/_admin/whoami', undefined, asAdmin());
    expect(status).toBe(200);
    expect(json.readonly).toBe(false);
    expect(json.security).toEqual({ devOpen: false, enforced: true, hasReadonlyTier: true });
    // Derived from the wired subsystems, not hard-coded.
    expect(json.features.collections).toBe(true);
    expect(json.features.triggers).toBe(true);
    expect(json.features.backups).toBe(true);
    expect(Object.values(json.features).every((v) => typeof v === 'boolean')).toBe(true);
  });

  it('the read-only credential signs in and is told so', async () => {
    const { status, json } = await req('GET', '/_admin/whoami', undefined, asReadonly());
    expect(status).toBe(200);
    expect(json.readonly).toBe(true);
  });

  // -- the read-only tier, for real ----------------------------------------

  it('a read-only admin reads everything an admin can', async () => {
    await req('POST', '/admin/schema', { action: 'createTable', table: 'Widget', columns: [] }, asAdmin());
    await req('POST', '/api/Widget', { name: 'one' }, asAdmin());

    const schema = await req('GET', '/admin/schema', undefined, asReadonly());
    expect(schema.status).toBe(200);
    expect(schema.json.tables.map((t: any) => t.name)).toContain('Widget');

    const rows = await req('GET', '/api/Widget?limit=10', undefined, asReadonly());
    expect(rows.status).toBe(200);
    expect(rows.json.results).toHaveLength(1);

    // Including the permission surface it is there to inspect.
    expect((await req('GET', '/admin/permissions', undefined, asReadonly())).status).toBe(200);
    expect((await req('GET', '/admin/keys', undefined, asReadonly())).status).toBe(200);
  });

  it('a read-only admin changes nothing, and is told exactly why', async () => {
    const attempts: [string, string, unknown][] = [
      ['POST', '/api/Widget', { name: 'nope' }],
      ['PUT', '/admin/permissions/collections/Widget', { permissions: { find: 'public' } }],
      ['POST', '/admin/roles', { name: 'sneaky' }],
      ['POST', '/admin/keys', { name: 'k', scopes: ['classes:*'] }],
      ['POST', '/admin/schema', { action: 'deleteTable', table: 'Widget' }],
      ['POST', '/admin/backups', {}]
    ];
    for (const [method, url, body] of attempts) {
      const { status, json } = await req(method, url, body, asReadonly());
      expect(`${method} ${url} -> ${status}`).toContain('-> 403');
      expect(json.code).toBe(119);
      expect(json.error).toContain('READ-ONLY admin credential');
    }
    // And nothing actually changed.
    const rows = await req('GET', '/api/Widget?limit=10', undefined, asAdmin());
    expect(rows.json.results).toHaveLength(1);
  });

  it('a read-only admin may still dry-run a permission check (the reviewed exception)', async () => {
    const { status, json } = await req(
      'POST',
      '/admin/permissions/check',
      { principal: { kind: 'anonymous' }, collection: 'Widget', op: 'find' },
      asReadonly()
    );
    expect(status).toBe(200);
    expect(json.allowed).toBe(false);
  });

  // -- delete table, finally wired -----------------------------------------

  it('delete-table works end to end through the route the dashboard calls', async () => {
    await req('POST', '/admin/schema', { action: 'createTable', table: 'Doomed', columns: [] }, asAdmin());
    await req('POST', '/api/Doomed', { a: 1 }, asAdmin());
    expect((await req('GET', '/admin/schema', undefined, asAdmin())).json.tables.map((t: any) => t.name)).toContain('Doomed');

    const deleted = await req('POST', '/admin/schema', { action: 'deleteTable', table: 'Doomed' }, asAdmin());
    expect(deleted.status).toBe(200);
    expect(deleted.json.deleted).toBe(true);

    const after = await req('GET', '/admin/schema', undefined, asAdmin());
    expect(after.json.tables.map((t: any) => t.name)).not.toContain('Doomed');
  });

  it('registers both dashboard routes in the one route table the walk test checks', () => {
    const table = service.getRouteTable();
    const page = table.find((r) => r.pattern === '_admin');
    const whoami = table.find((r) => r.pattern === '_admin/whoami');
    expect(page).toBeDefined();
    expect(page!.access.kind).toBe('public');
    expect(whoami).toBeDefined();
    expect(whoami!.access.kind).toBe('admin');
  });
});

// ============================================================================
// --no-admin, and the credential-collision interlock
// ============================================================================

describe('BAK-005 --no-admin', () => {
  let dataDir: string;
  let service: BackendService;
  let base: string;

  beforeAll(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-bak005-off-'));
    service = new BackendService({ dataDir, port: 0, adminDashboard: false });
    base = (await service.start()).listen.url;
  });

  afterAll(async () => {
    await service.stop();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('removes the routes entirely rather than blocking them', async () => {
    // A 404 (not a 401/403) is the point: an operator who turned the dashboard
    // off leaks no evidence that there was ever one to turn off.
    expect((await fetch(`${base}/_admin`)).status).toBe(404);
    expect((await fetch(`${base}/_admin/whoami`)).status).toBe(404);
    expect((await fetch(`${base}/health`)).status).toBe(200);
    expect(service.getRouteTable().some((r) => r.pattern.startsWith('_admin'))).toBe(false);
  });
});

describe('BAK-005 read-only credential provisioning', () => {
  it('refuses to start when the read-only credential equals the full one', async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-bak005-collide-'));
    try {
      const service = new BackendService({ dataDir, port: 0, authToken: 'same-secret', readonlyToken: 'same-secret' });
      await expect(service.start()).rejects.toThrow(SecurityStartupError);
      await expect(service.start()).rejects.toThrow(/silently grant full write access/);
    } finally {
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });

  it('is absent unless asked for — no backend grows a second credential by accident', async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-bak005-none-'));
    const service = new BackendService({ dataDir, port: 0 });
    try {
      const started = await service.start();
      expect(started.security.hasReadonlyTier).toBe(false);
      const secrets = JSON.parse(fs.readFileSync(path.join(dataDir, 'secrets.json'), 'utf-8'));
      expect(secrets.adminReadonlyToken).toBeUndefined();
      expect(typeof secrets.adminToken).toBe('string');
      // The credential WAS minted here, so the first-run surface says so.
      expect(started.security.adminTokenMintedThisStart).toBe(true);
    } finally {
      await service.stop();
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });
});
