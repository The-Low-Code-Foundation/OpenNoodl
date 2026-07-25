/**
 * BAK-003 adversarial suite — the attacks the model exists to stop, run over
 * real HTTP against a real service with enforcement ON (devOpen: false,
 * loopback bind: enforcement applies identically; dev-open is tested
 * separately as the relaxation).
 *
 * Families:
 *   1. Cross-user isolation: query/get/count/aggregate/distinct/include —
 *      the "two users on a deployed backend" success criterion.
 *   2. Cross-user writes and existence hiding (404/101, row untouched).
 *   3. CLP gates + roles end-to-end over the admin surface (the "agent via
 *      MCP alone" flow at the HTTP layer it rides on).
 *   4. API key scope containment (key for one function cannot call others or
 *      touch /classes; keys cannot administer).
 *   5. Session reuse after password change.
 *   6. System-collection posture; signup rule.
 *   7. The route-table walk: EVERY route in the live table must deny an
 *      unauthenticated caller on a locked backend unless declared public —
 *      the structural "no route slips past enforcement" guarantee.
 *   8. The live interlock (devOpen cannot be enabled on a wide bind is
 *      covered in service-http; here: config PUT validation refuses junk).
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { BackendService } from '../src/service';

jest.setTimeout(30000);

const LOCKED_CONFIG = {
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
  // Locked variants so the route walk can assert denial on every non-public route.
  files: { upload: 'authenticated', read: 'authenticated', delete: 'nobody' },
  signup: 'public'
};

const ECHO_WORKFLOW = {
  components: [
    {
      name: '/#__cloud__/echo',
      nodes: [
        { id: 'req1', type: 'noodl.cloud.request', x: 0, y: 0, parameters: { allowNoAuth: true }, ports: [], children: [] },
        { id: 'res1', type: 'noodl.cloud.response', x: 0, y: 200, parameters: {}, ports: [], children: [] }
      ],
      connections: [{ sourceId: 'req1', sourcePort: 'receive', targetId: 'res1', targetPort: 'send' }],
      roots: []
    },
    {
      name: '/#__cloud__/private-fn',
      nodes: [
        { id: 'req2', type: 'noodl.cloud.request', x: 0, y: 0, parameters: {}, ports: [], children: [] },
        { id: 'res2', type: 'noodl.cloud.response', x: 0, y: 200, parameters: {}, ports: [], children: [] }
      ],
      connections: [{ sourceId: 'req2', sourcePort: 'receive', targetId: 'res2', targetPort: 'send' }],
      roots: []
    }
  ],
  settings: {},
  metadata: {}
};

describe('BAK-003 enforcement (locked backend)', () => {
  let dataDir: string;
  let service: BackendService;
  let base: string;
  let adminToken: string;

  interface User {
    id: string;
    token: string;
  }
  let alice: User;
  let bob: User;
  let aliceDocId: string;

  async function req(
    method: string,
    pathName: string,
    body?: unknown,
    headers: Record<string, string> = {}
  ): Promise<{ status: number; json: any }> {
    const res = await fetch(`${base}${pathName}`, {
      method,
      headers: body !== undefined ? { 'content-type': 'application/json', ...headers } : headers,
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
    let json: any = null;
    try {
      json = await res.json();
    } catch {
      /* non-JSON */
    }
    return { status: res.status, json };
  }

  const asUser = (u: User) => ({ 'x-parse-session-token': u.token });
  const asAdmin = () => ({ authorization: `Bearer ${adminToken}` });

  async function signup(username: string): Promise<User> {
    const { status, json } = await req('POST', '/users', { username, password: `pw-${username}` });
    expect(status).toBe(201);
    return { id: json.objectId, token: json.sessionToken };
  }

  beforeAll(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-sec-test-'));
    fs.writeFileSync(path.join(dataDir, 'security.json'), JSON.stringify(LOCKED_CONFIG));
    fs.mkdirSync(path.join(dataDir, 'workflows'), { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'workflows', 'main.workflow.json'), JSON.stringify(ECHO_WORKFLOW));

    service = new BackendService({ dataDir, port: 0, backendId: 'sec_test', backendName: 'Security Test' });
    const started = await service.start();
    base = started.listen.url;
    expect(started.security.enforced).toBe(true);
    adminToken = JSON.parse(fs.readFileSync(path.join(dataDir, 'secrets.json'), 'utf-8')).adminToken;

    alice = await signup('alice');
    bob = await signup('bob');

    // Alice creates a creator-owned record.
    const created = await req('POST', '/classes/Doc', { title: 'alice doc', amount: 100 }, asUser(alice));
    expect(created.status).toBe(201);
    aliceDocId = created.json.objectId;
  });

  afterAll(async () => {
    await service.stop();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  // ==========================================================================
  // 1. Cross-user isolation — every read shape
  // ==========================================================================

  it('the creator reads their record back (query + get)', async () => {
    const q = await req('POST', '/classes/Doc', { _method: 'GET', where: {} }, asUser(alice));
    expect(q.json.results.map((r: any) => r.title)).toContain('alice doc');
    const g = await req('GET', `/classes/Doc/${aliceDocId}`, undefined, asUser(alice));
    expect(g.status).toBe(200);
    expect(g.json.title).toBe('alice doc');
  });

  it('creator-owns stamps owner and a private ACL', async () => {
    const g = await req('GET', `/classes/Doc/${aliceDocId}`, undefined, asAdmin());
    expect(g.json.ACL).toEqual({ [alice.id]: { read: true, write: true } });
    expect(g.json.owner).toEqual({ __type: 'Pointer', className: '_User', objectId: alice.id });
  });

  it('another user cannot see the record via query', async () => {
    const q = await req('POST', '/classes/Doc', { _method: 'GET', where: {} }, asUser(bob));
    expect(q.status).toBe(200);
    expect(q.json.results).toEqual([]);
  });

  it('another user cannot get it directly — identical to a missing id', async () => {
    const g = await req('GET', `/classes/Doc/${aliceDocId}`, undefined, asUser(bob));
    expect(g.status).toBe(404);
    expect(g.json.code).toBe(101);
    const missing = await req('GET', `/classes/Doc/00000000-0000-4000-8000-000000000000`, undefined, asUser(bob));
    expect(missing.status).toBe(404);
    expect(missing.json.code).toBe(101);
  });

  it('count does not leak invisible rows', async () => {
    const c = await req('POST', '/classes/Doc', { _method: 'GET', where: {}, limit: 0, count: 1 }, asUser(bob));
    expect(c.json.count).toBe(0);
    const ca = await req('POST', '/classes/Doc', { _method: 'GET', where: {}, limit: 0, count: 1 }, asUser(alice));
    expect(ca.json.count).toBe(1);
  });

  it('aggregate and distinct do not leak invisible rows', async () => {
    const agg = await req(
      'GET',
      `/aggregate/Doc?group=${encodeURIComponent(JSON.stringify({ total: { $sum: '$amount' } }))}`,
      undefined,
      asUser(bob)
    );
    expect(agg.status).toBe(200);
    expect(agg.json.results[0].total).toBeNull();

    const dist = await req('GET', '/aggregate/Doc?distinct=title', undefined, asUser(bob));
    expect(dist.json.results).toEqual([]);
  });

  it('include= expansion cannot pivot into an unreadable record', async () => {
    // Bob creates a record pointing at alice's private doc; the schema needs a
    // typed Pointer column, which the admin sets up.
    await req(
      'POST',
      '/admin/schema',
      { action: 'addColumn', table: 'Doc', column: { name: 'ref', type: 'Pointer', targetClass: 'Doc' } },
      asAdmin()
    );
    const created = await req(
      'POST',
      '/classes/Doc',
      { title: 'bob pivot', ref: { __type: 'Pointer', className: 'Doc', objectId: aliceDocId }, ACL: { '*': { read: true, write: true } } },
      asUser(bob)
    );
    expect(created.status).toBe(201);

    const fetched = await req('GET', `/classes/Doc/${created.json.objectId}?include=ref`, undefined, asUser(bob));
    expect(fetched.status).toBe(200);
    // Unexpanded envelope — never the target's fields.
    expect(fetched.json.ref).toEqual({ __type: 'Pointer', className: 'Doc', objectId: aliceDocId });

    // The owner DOES get the expansion.
    const forAlice = await req('GET', `/classes/Doc/${created.json.objectId}?include=ref`, undefined, asUser(alice));
    expect(forAlice.json.ref.__type).toBe('Object');
    expect(forAlice.json.ref.title).toBe('alice doc');
  });

  // ==========================================================================
  // 2. Cross-user writes
  // ==========================================================================

  it('another user cannot update or delete the record (404/101, row untouched)', async () => {
    const put = await req('PUT', `/classes/Doc/${aliceDocId}`, { title: 'defaced' }, asUser(bob));
    expect(put.status).toBe(404);
    expect(put.json.code).toBe(101);

    const del = await req('DELETE', `/classes/Doc/${aliceDocId}`, undefined, asUser(bob));
    expect(del.status).toBe(404);

    const still = await req('GET', `/classes/Doc/${aliceDocId}`, undefined, asUser(alice));
    expect(still.json.title).toBe('alice doc');
  });

  it('a client-supplied ACL is honored: world-readable but only owner-writable', async () => {
    const created = await req(
      'POST',
      '/classes/Doc',
      { title: 'shared', ACL: { [alice.id]: { read: true, write: true }, '*': { read: true } } },
      asUser(alice)
    );
    const id = created.json.objectId;

    const bobRead = await req('GET', `/classes/Doc/${id}`, undefined, asUser(bob));
    expect(bobRead.status).toBe(200);
    const bobWrite = await req('PUT', `/classes/Doc/${id}`, { title: 'nope' }, asUser(bob));
    expect(bobWrite.status).toBe(404);
  });

  it('a malformed ACL is rejected, not stored', async () => {
    const bad = await req('POST', '/classes/Doc', { title: 'x', ACL: { [alice.id]: { admin: true } } }, asUser(alice));
    expect(bad.status).toBe(400);
  });

  // ==========================================================================
  // 3. CLP gates + roles, end-to-end over the admin surface
  // ==========================================================================

  it('locking a collection to a role, creating it, assigning a user — and the effect is real', async () => {
    // Lock.
    const lock = await req(
      'PUT',
      '/admin/permissions/collections/Secrets',
      { permissions: { find: 'role:staff', get: 'role:staff', create: 'role:staff', update: 'role:staff', delete: 'role:staff' } },
      asAdmin()
    );
    expect(lock.status).toBe(200);

    // Denied before membership (403/119 — a class denial, not a row one).
    const denied = await req('POST', '/classes/Secrets', { _method: 'GET', where: {} }, asUser(alice));
    expect(denied.status).toBe(403);
    expect(denied.json.code).toBe(119);

    // Create role, assign alice.
    expect((await req('POST', '/admin/roles', { name: 'staff' }, asAdmin())).status).toBe(201);
    expect((await req('POST', '/admin/roles/staff/users', { userId: alice.id }, asAdmin())).status).toBe(200);

    // Allowed after (and bob still is not).
    const allowed = await req('POST', '/classes/Secrets', { _method: 'GET', where: {} }, asUser(alice));
    expect(allowed.status).toBe(200);
    const stillDenied = await req('POST', '/classes/Secrets', { _method: 'GET', where: {} }, asUser(bob));
    expect(stillDenied.status).toBe(403);

    // The dry-run check endpoint agrees, naming the rule.
    const check = await req(
      'POST',
      '/admin/permissions/check',
      { principal: { kind: 'user', userId: alice.id }, collection: 'Secrets', op: 'find' },
      asAdmin()
    );
    expect(check.json.allowed).toBe(true);
    expect(check.json.rule).toBe('role:staff');
  });

  it('role-held ACLs grant row access via role: keys', async () => {
    const created = await req(
      'POST',
      '/classes/Doc',
      { title: 'staff note', ACL: { 'role:staff': { read: true, write: true } } },
      asUser(bob)
    );
    // Alice (staff) can read it; bob (creator but not in ACL) cannot.
    const forAlice = await req('GET', `/classes/Doc/${created.json.objectId}`, undefined, asUser(alice));
    expect(forAlice.status).toBe(200);
    const forBob = await req('GET', `/classes/Doc/${created.json.objectId}`, undefined, asUser(bob));
    expect(forBob.status).toBe(404);
  });

  // ==========================================================================
  // 4. API key scope containment
  // ==========================================================================

  it('a key scoped to one function cannot call others, touch /classes, or administer', async () => {
    const createKey = await req('POST', '/admin/keys', { name: 'ci-echo', scopes: ['functions:echo'] }, asAdmin());
    expect(createKey.status).toBe(201);
    const secret = createKey.json.secret;
    expect(secret).toMatch(/^ngxk_/);
    const asKey = { 'x-nodegx-api-key': secret };

    // Can call its function.
    const ok = await req('POST', '/functions/echo', {}, asKey);
    expect(ok.status).toBe(200);

    // Cannot call another function.
    const other = await req('POST', '/functions/private-fn', {}, asKey);
    expect(other.status).toBe(403);
    expect(other.json.code).toBe(119);

    // Cannot touch data.
    const data = await req('POST', '/classes/Doc', { _method: 'GET', where: {} }, asKey);
    expect(data.status).toBe(403);

    // Cannot administer (mint keys, read config) — same 401 as any non-admin.
    const admin = await req('GET', '/admin/keys', undefined, asKey);
    expect(admin.status).toBe(401);
    const mint = await req('POST', '/admin/keys', { name: 'esc', scopes: ['classes:*'] }, asKey);
    expect(mint.status).toBe(401);
  });

  it('a revoked key stops working; a classes:read key reads but cannot write', async () => {
    const created = await req('POST', '/admin/keys', { name: 'reader', scopes: ['classes:read'] }, asAdmin());
    const asKey = { 'x-nodegx-api-key': created.json.secret };

    const read = await req('POST', '/classes/Doc', { _method: 'GET', where: {} }, asKey);
    expect(read.status).toBe(200);
    // Reads bypass row ACLs (data-plane tool): it sees alice's doc.
    expect(read.json.results.map((r: any) => r.title)).toContain('alice doc');

    const write = await req('POST', '/classes/Doc', { title: 'from key' }, asKey);
    expect(write.status).toBe(403);

    const revoke = await req('DELETE', `/admin/keys/${created.json.objectId}`, undefined, asAdmin());
    expect(revoke.status).toBe(200);
    const after = await req('POST', '/classes/Doc', { _method: 'GET', where: {} }, asKey);
    expect(after.status).toBe(401);
  });

  it('key secrets are never listed', async () => {
    const list = await req('GET', '/admin/keys', undefined, asAdmin());
    expect(list.status).toBe(200);
    for (const key of list.json.keys) {
      expect(key.secret).toBeUndefined();
      expect(key.keyHash).toBeUndefined();
    }
  });

  // ==========================================================================
  // 5. Session lifecycle
  // ==========================================================================

  it('a password change revokes the other sessions but keeps the changing one', async () => {
    const login1 = await req('POST', '/login', { username: 'bob', password: 'pw-bob', _method: 'GET' });
    const stolen = login1.json.sessionToken;
    const login2 = await req('POST', '/login', { username: 'bob', password: 'pw-bob', _method: 'GET' });
    const current = login2.json.sessionToken;

    // Both valid now.
    expect((await req('GET', '/users/me', undefined, { 'x-parse-session-token': stolen })).status).toBe(200);

    // Change password with the second session.
    const change = await req(
      'PUT',
      `/users/${bob.id}`,
      { password: 'pw-bob-2' },
      { 'x-parse-session-token': current }
    );
    expect(change.status).toBe(200);

    // The stolen session is dead (209 — the code that makes clients drop it).
    const dead = await req('GET', '/users/me', undefined, { 'x-parse-session-token': stolen });
    expect(dead.status).toBe(400);
    expect(dead.json.code).toBe(209);
    // The changing session survives.
    expect((await req('GET', '/users/me', undefined, { 'x-parse-session-token': current })).status).toBe(200);

    // Restore for later tests.
    bob = { id: bob.id, token: current };
    await req('PUT', `/users/${bob.id}`, { password: 'pw-bob' }, { 'x-parse-session-token': current });
  });

  it('an invalid session token is a hard 209, not anonymous', async () => {
    const r = await req('POST', '/classes/Doc', { _method: 'GET', where: {} }, { 'x-parse-session-token': 'r:forged' });
    expect(r.status).toBe(400);
    expect(r.json.code).toBe(209);
  });

  // ==========================================================================
  // 6. System collections + signup rule
  // ==========================================================================

  it('system collections are unreachable through data routes for everyone but admin', async () => {
    for (const sys of ['_User', '_Session', '_Role', '_ApiKey']) {
      const asAlice = await req('POST', `/classes/${sys}`, { _method: 'GET', where: {} }, asUser(alice));
      expect(asAlice.status).toBe(403);
      const anon = await req('GET', `/api/${sys}`);
      expect(anon.status).toBe(403);
    }
    // Admin can (the Data Browser's path).
    const admin = await req('POST', '/classes/_User', { _method: 'GET', where: {} }, asAdmin());
    expect(admin.status).toBe(200);
  });

  it('CLP entries for system collections are rejected', async () => {
    const r = await req('PUT', '/admin/permissions/collections/_User', { permissions: { find: 'public' } }, asAdmin());
    expect(r.status).toBe(400);
  });

  it('the signup rule can close signups', async () => {
    const cfg = JSON.parse(JSON.stringify(LOCKED_CONFIG));
    cfg.signup = 'nobody';
    expect((await req('PUT', '/admin/permissions', cfg, asAdmin())).status).toBe(200);

    const closed = await req('POST', '/users', { username: 'mallory', password: 'x' });
    expect(closed.status).toBe(403);
    expect(closed.json.code).toBe(119);

    cfg.signup = 'public';
    await req('PUT', '/admin/permissions', cfg, asAdmin());
  });

  it('config validation refuses unknown keys and runAs:"caller" (never accept-and-ignore)', async () => {
    const junk = JSON.parse(JSON.stringify(LOCKED_CONFIG));
    (junk as any).collections.Doc = { permisions: { find: 'public' } }; // typo'd key
    expect((await req('PUT', '/admin/permissions', junk, asAdmin())).status).toBe(400);

    const caller = JSON.parse(JSON.stringify(LOCKED_CONFIG));
    (caller as any).functions.echo = { runAs: 'caller' };
    const r = await req('PUT', '/admin/permissions', caller, asAdmin());
    expect(r.status).toBe(400);
    expect(r.json.error).toMatch(/not yet supported/);
  });

  // ==========================================================================
  // 7. The route-table walk — no route slips past enforcement
  // ==========================================================================

  it('every non-public route denies an unauthenticated caller', async () => {
    const table = service.getRouteTable();
    // Sanity: the table is the real, full surface.
    expect(table.length).toBeGreaterThanOrEqual(35);
    const families = new Set(table.map((r) => r.pattern.split('/')[0]));
    for (const family of ['health', 'config', 'classes', 'aggregate', 'functions', 'files', 'api', 'admin', 'executions', 'login', 'logout', 'users']) {
      expect(families).toContain(family);
    }

    for (const route of table) {
      const url =
        '/' +
        route.pattern
          .split('/')
          .map((part) => (part.startsWith(':') ? 'WalkProbe' : part))
          .join('/');
      const needsBody = route.method === 'POST' || route.method === 'PUT';
      const { status, json } = await req(route.method, url, needsBody ? {} : undefined);

      const label = `${route.method} ${route.pattern} (${route.access.kind}) -> ${status}`;
      switch (route.access.kind) {
        case 'public':
          break; // reachable by design
        case 'session':
        case 'signup':
          // Self-governing / config-governed endpoints (signup is 'public'
          // here by design); pinned by the dedicated session + signup tests.
          break;
        case 'data-perOp': {
          // The batch route answers 200 with per-operation denials.
          const probe = await req(route.method, url, {
            operations: [{ method: 'create', collection: 'WalkProbe', data: { a: 1 } }]
          });
          expect(`${label} batch:${JSON.stringify(probe.json.results)}`).toContain('Permission denied');
          break;
        }
        case 'admin':
          expect(label).toContain('-> 401');
          break;
        default:
          // data / function / files / signup: locked config denies all of them.
          expect(`${label} ${json && json.code}`).toContain('-> 403');
      }
    }
  });
});
