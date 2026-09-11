/**
 * FH-024 — the local admin API was cross-origin readable, and writable.
 *
 * Three defaults composed into one hole and nobody had read them together:
 * `devOpen` defaults to `true`, `devOpenActive` (= `devOpen && loopback`) made
 * every gate return early, and CORS defaults to `origins: ['*']` applied before
 * routing. So on a default local backend `GET /admin/<anything>` was
 * unauthenticated AND answered `Access-Control-Allow-Origin: *`.
 *
 * That was DRIVEN before it was fixed, from a real page in a real browser
 * (Electron, webSecurity on) served from an unrelated origin: it read
 * `/admin/ops`, `/admin/permissions`, `/admin/schema`, `/admin/keys` and
 * `/_admin/whoami`, and — the part the filing left unmeasured — a *preflighted*
 * `PUT /admin/ops` with `application/json` passed its preflight and changed the
 * running ops config, while a *simple* `POST /admin/roles` with `text/plain`
 * created a role. Loopback is not a trust boundary against a browser; the
 * browser is a confused deputy that runs untrusted code from anywhere. This
 * repo already shipped the same bug once, as OBS-004.
 *
 * The fix is two independent controls, and this file drives BOTH separately,
 * because either alone leaves a hole the other closes:
 *
 *   (a) admin routes send NO CORS headers, so a page cannot READ the response —
 *       and cannot make a preflighted write at all.
 *   (b) `devOpen` does not relax the admin gate, so the simple no-preflight
 *       writes a browser still SENDS blind are refused before they land.
 *
 * The other half of the bar is that nothing else moved: dev-open's actual
 * ergonomic (your own collections without a token) survives, a deployed
 * backend behaves exactly as before, and the startup interlock still refuses a
 * wide bind with dev-open on. Those have their own cases here.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { BackendService } from '../src/service';
import { SecurityState, SecurityStartupError } from '../src/security/state';
import type { AdapterFacade } from '../src/persistence/AdapterFacade';

jest.setTimeout(40000);

/** An origin that is not the backend's. Any page's origin would do. */
const EVIL = 'http://evil.example';

const ENFORCING_CONFIG = {
  version: 1,
  devOpen: false,
  defaults: {
    permissions: {
      find: 'authenticated',
      get: 'authenticated',
      create: 'authenticated',
      update: 'authenticated',
      delete: 'authenticated'
    },
    creatorOwns: true
  },
  collections: {},
  functions: {},
  files: { upload: 'authenticated', read: 'public', delete: 'nobody' },
  signup: 'public'
};

interface Probe {
  status: number;
  acao: string | null;
  body: string;
}

async function probe(
  base: string,
  method: string,
  pathName: string,
  headers: Record<string, string> = {},
  body?: string
): Promise<Probe> {
  const res = await fetch(`${base}${pathName}`, { method, headers, body });
  return {
    status: res.status,
    acao: res.headers.get('access-control-allow-origin'),
    body: await res.text()
  };
}

/**
 * A CORS preflight, as a browser sends one. Node's fetch does not enforce CORS,
 * which is exactly why this asserts on the HEADERS rather than on a thrown
 * error: what a browser decides from is the presence of the header, and that is
 * the observable a spec can hold. The real browser run is recorded in the doc.
 */
const preflight = (base: string, target: string, method: string) =>
  probe(base, 'OPTIONS', target, {
    origin: EVIL,
    'access-control-request-method': method,
    'access-control-request-headers': 'content-type'
  });

// ============================================================================
// 1. A DEFAULT local backend — dev-open, loopback. The reported case.
// ============================================================================

describe('FH-024 — a default (dev-open, loopback) backend', () => {
  let dataDir: string;
  let service: BackendService;
  let base: string;
  let adminToken: string;

  beforeAll(async () => {
    // No security.json is written on purpose: this is the DEFAULT posture, the
    // one the finding is about. A backend that had to be configured into the
    // hole would not have been worth filing.
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-fh024-open-'));
    service = new BackendService({ dataDir, port: 0, backendId: 'fh024', backendName: 'FH-024' });
    const started = await service.start();
    base = started.listen.url;
    // The premise of the whole file: dev-open is ON and unasked-for.
    expect(started.security.enforced).toBe(false);
    adminToken = JSON.parse(fs.readFileSync(path.join(dataDir, 'secrets.json'), 'utf-8')).adminToken;
  });

  afterAll(async () => {
    await service.stop();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  // --- (b): dev-open does not relax the admin gate -------------------------

  it('refuses an admin read with no credential, even though dev-open is on', async () => {
    const res = await probe(base, 'GET', '/admin/ops', { origin: EVIL });
    expect(res.status).toBe(401);
    // The 200 that used to come back carried the whole ops config.
    expect(res.body).not.toContain('ratePerMinute');
  });

  it('still serves that admin read to the credential the editor already holds', async () => {
    const res = await probe(base, 'GET', '/admin/ops', { authorization: `Bearer ${adminToken}` });
    expect(res.status).toBe(200);
    expect(res.body).toContain('ratePerMinute');
  });

  it('refuses the blind simple write a browser sends without a preflight', async () => {
    // `text/plain` makes this a CORS-simple request: the browser sends it and
    // only hides the response. (a) cannot stop it; (b) is what does.
    const write = await probe(
      base,
      'POST',
      '/admin/roles',
      { origin: EVIL, 'content-type': 'text/plain' },
      JSON.stringify({ name: 'fh024_pwned' })
    );
    expect(write.status).toBe(401);

    // And it did not land. Asked with the credential, because "the response was
    // 401" and "nothing was created" are different claims.
    const roles = await probe(base, 'GET', '/admin/roles', { authorization: `Bearer ${adminToken}` });
    expect(roles.status).toBe(200);
    expect(roles.body).not.toContain('fh024_pwned');
  });

  it('refuses the ops-config write that would otherwise reopen this hole', async () => {
    // §8's trap: `cors.origins` is itself editable over an admin route, so any
    // fix resting on the operator narrowing it is reachable through the hole.
    const before = await probe(base, 'GET', '/admin/ops', { authorization: `Bearer ${adminToken}` });
    expect(before.body).toContain('"level":"info"');

    const write = await probe(
      base,
      'PUT',
      '/admin/ops',
      { origin: EVIL, 'content-type': 'text/plain' },
      JSON.stringify({ version: 1, logging: { level: 'debug' } })
    );
    expect(write.status).toBe(401);

    const after = await probe(base, 'GET', '/admin/ops', { authorization: `Bearer ${adminToken}` });
    expect(after.body).toContain('"level":"info"');
  });

  // --- (a): admin routes carry no CORS headers -----------------------------

  it.each([
    ['/admin/ops'],
    ['/admin/permissions'],
    ['/admin/schema'],
    ['/admin/secrets'],
    ['/admin/keys'],
    ['/admin/roles'],
    ['/admin/audit'],
    ['/_admin/whoami']
  ])('sends no Access-Control-Allow-Origin on %s', async (route) => {
    const anonymous = await probe(base, 'GET', route, { origin: EVIL });
    expect(anonymous.acao).toBeNull();
    // Also with the credential: the header is suppressed by ROUTE, not by
    // whether the caller happened to be refused.
    const authenticated = await probe(base, 'GET', route, {
      origin: EVIL,
      authorization: `Bearer ${adminToken}`
    });
    expect(authenticated.acao).toBeNull();
  });

  it('fails the preflight for a JSON write to an admin route', async () => {
    const res = await preflight(base, '/admin/ops', 'PUT');
    expect(res.acao).toBeNull();
    // A browser reading this reply has no allowed origin, so the PUT is never
    // sent. Driven live: "Response to preflight request doesn't pass access
    // control check".
  });

  it.each([['/api/_schema'], ['/executions']])(
    'covers %s — an admin route that does not start with admin/',
    async (route) => {
      // The reason the suppression is answered from the route table and not
      // from a path prefix. `pathname.startsWith('/admin/')` would have sent
      // the wildcard on both of these, and `/executions` is the app's whole run
      // history including step inputs.
      const res = await probe(base, 'GET', route, { origin: EVIL });
      expect(res.acao).toBeNull();
      expect(res.status).toBe(401);
    }
  );

  it('is not bypassed by percent-encoding the path (/%61dmin/ops)', async () => {
    // The router splits, THEN decodes, so this reaches `admin/ops`. A prefix
    // test on the raw path would not have.
    const res = await probe(base, 'GET', '/%61dmin/ops', { origin: EVIL });
    expect(res.acao).toBeNull();
    expect(res.status).toBe(401);
  });

  // --- what dev-open is actually for, and must keep doing ------------------

  it('still relaxes the data plane — collections without a token', async () => {
    const created = await probe(
      base,
      'POST',
      '/api/Note',
      { 'content-type': 'application/json' },
      JSON.stringify({ title: 'dev-open still works' })
    );
    expect(created.status).toBe(201);
    const read = await probe(base, 'GET', '/api/Note');
    expect(read.status).toBe(200);
    expect(read.body).toContain('dev-open still works');
  });

  it('still sends CORS on the data plane, which is what a NodeGX app calls', async () => {
    const res = await probe(base, 'GET', '/api/Note', { origin: EVIL });
    expect(res.acao).toBe('*');
  });

  it('still sends CORS on public routes and on 404s', async () => {
    expect((await probe(base, 'GET', '/health', { origin: EVIL })).acao).toBe('*');
    const missing = await probe(base, 'GET', '/no-such-route', { origin: EVIL });
    expect(missing.status).toBe(404);
    expect(missing.acao).toBe('*');
  });

  it('still serves the dashboard document, which is same-origin and needs no CORS', async () => {
    // BAK-005's `/_admin` is a browser client — the assumption §6 said to check
    // before believing (a). It is, but a SAME-ORIGIN one: its client calls
    // relative paths, so removing CORS costs it nothing. Driven live: the page
    // loads, the token signs in, and `/admin/schema` answers 200 from inside it.
    const res = await probe(base, 'GET', '/_admin');
    expect(res.status).toBe(200);
    expect(res.body).toContain('id="login-form"');
  });
});

// ============================================================================
// 2. A DEPLOYED backend — enforcement on. Nothing here may have moved.
// ============================================================================

describe('FH-024 — an enforcing (deployed-shaped) backend is unchanged', () => {
  let dataDir: string;
  let service: BackendService;
  let base: string;
  let adminToken: string;

  beforeAll(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-fh024-locked-'));
    fs.writeFileSync(path.join(dataDir, 'security.json'), JSON.stringify(ENFORCING_CONFIG));
    service = new BackendService({ dataDir, port: 0, backendId: 'fh024l', backendName: 'FH-024 locked' });
    const started = await service.start();
    base = started.listen.url;
    expect(started.security.enforced).toBe(true);
    adminToken = JSON.parse(fs.readFileSync(path.join(dataDir, 'secrets.json'), 'utf-8')).adminToken;
  });

  afterAll(async () => {
    await service.stop();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('answers an admin route to the credential and refuses it without one', async () => {
    expect((await probe(base, 'GET', '/admin/ops')).status).toBe(401);
    expect((await probe(base, 'GET', '/admin/ops', { authorization: `Bearer ${adminToken}` })).status).toBe(200);
  });

  it('sends no CORS on admin routes here either — the two postures now agree', async () => {
    const res = await probe(base, 'GET', '/admin/ops', {
      origin: EVIL,
      authorization: `Bearer ${adminToken}`
    });
    expect(res.acao).toBeNull();
  });

  it('leaves the data plane exactly as it was: gated, and CORS-open', async () => {
    const denied = await probe(base, 'GET', '/api/Note', { origin: EVIL });
    expect(denied.status).toBe(403);
    // The refusal is READABLE cross-origin, as it always was — a NodeGX app has
    // to be able to see "permission denied" rather than an opaque failure.
    expect(denied.acao).toBe('*');
  });
});

// ============================================================================
// 3. The startup interlock — its own case, so a CORS/gate change here cannot
//    silently alter the posture the interlock is what guarantees.
// ============================================================================

describe('FH-024 — the startup interlock still refuses dev-open on a wide bind', () => {
  let dataDir: string;

  /**
   * `SecurityState` reads config and secrets off disk and touches the database
   * only through role/key lookups, none of which run in the constructor. The
   * interlock is the LAST thing the constructor does, so the facade never gets
   * used on the paths under test.
   */
  const facade = {} as AdapterFacade;

  // SB-016: `deployedFunctions: []` throughout, and it means *this backend
  // serves no cloud endpoints* rather than *nobody looked*. These data dirs are
  // mkdtemp'd with no `workflows/` in them, so it is the true answer, and it
  // keeps the second interlock out of the way of the one under test here.
  beforeEach(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-fh024-interlock-'));
  });

  afterEach(() => {
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('refuses to start with dev-open on a non-loopback bind', () => {
    expect(() => new SecurityState({ dataDir, loopback: false, cliToken: null, deployedFunctions: [], facade })).toThrow(
      SecurityStartupError
    );
    try {
      new SecurityState({ dataDir, loopback: false, cliToken: null, deployedFunctions: [], facade });
      throw new Error('expected the interlock to refuse');
    } catch (e) {
      expect((e as SecurityStartupError).code).toBe('DEV_OPEN_ON_PUBLIC_BIND');
    }
  });

  it('starts on a non-loopback bind once dev-open is off, with dev-open inactive', () => {
    fs.writeFileSync(path.join(dataDir, 'security.json'), JSON.stringify(ENFORCING_CONFIG));
    const state = new SecurityState({ dataDir, loopback: false, cliToken: null, deployedFunctions: [], facade });
    expect(state.devOpenActive).toBe(false);
  });

  it('still reports dev-open ACTIVE on loopback — FH-024 narrowed what it relaxes, not when', () => {
    // The distinction that keeps this fix honest: `devOpenActive` means the same
    // thing it always did. What changed is that `checkAccess` consults it after
    // the admin gate instead of before it.
    const state = new SecurityState({ dataDir, loopback: true, cliToken: null, deployedFunctions: [], facade });
    expect(state.devOpenActive).toBe(true);
    expect(state.config.devOpen).toBe(true);
  });
});
