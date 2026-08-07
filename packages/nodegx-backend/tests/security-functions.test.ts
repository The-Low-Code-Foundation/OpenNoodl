/**
 * CWF-017 — who may call a cloud function, and how often.
 *
 * Driven end to end over real HTTP against a real service with enforcement ON,
 * because the thing under test is a DECISION and a decision asserted against the
 * config file it was written into proves only that JSON round-trips.
 *
 * The three questions:
 *   1. The rule allows and denies, through every atom the language has, set by
 *      the panel's own admin surface rather than by hand-writing security.json.
 *   2. The default posture for an undeclared function is UNCHANGED: the graph's
 *      `Allow Unauthenticated` port still decides, and DELETE puts a function
 *      back to it.
 *   3. A per-function budget refuses at its own threshold while every other
 *      function keeps working.
 *
 * The fixture carries two functions on purpose: `echo` declares
 * `allowNoAuth: true` in its Request node, `private-fn` leaves it false. That
 * pair is what makes "the effective rule came from the graph" testable at all.
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
  files: { upload: 'authenticated', read: 'public', delete: 'nobody' },
  signup: 'public'
};

/** `echo` allows unauthenticated calls in its graph; `private-fn` does not. */
const WORKFLOW = {
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
        { id: 'req2', type: 'noodl.cloud.request', x: 0, y: 0, parameters: { allowNoAuth: true }, ports: [], children: [] },
        { id: 'res2', type: 'noodl.cloud.response', x: 0, y: 200, parameters: {}, ports: [], children: [] }
      ],
      connections: [{ sourceId: 'req2', sourcePort: 'receive', targetId: 'res2', targetPort: 'send' }],
      roots: []
    },
    {
      name: '/#__cloud__/closed-graph',
      nodes: [
        { id: 'req3', type: 'noodl.cloud.request', x: 0, y: 0, parameters: {}, ports: [], children: [] },
        { id: 'res3', type: 'noodl.cloud.response', x: 0, y: 200, parameters: {}, ports: [], children: [] }
      ],
      connections: [{ sourceId: 'req3', sourcePort: 'receive', targetId: 'res3', targetPort: 'send' }],
      roots: []
    }
  ],
  settings: {},
  metadata: {}
};

interface Body {
  [key: string]: unknown;
  error?: string;
  code?: number;
  sessionToken?: string;
  objectId?: string;
}

interface FunctionRow {
  name: string;
  deployed: boolean;
  call: string | string[];
  source: 'configured' | 'graph';
  configured: string | string[] | null;
  allowNoAuth: boolean;
  runAs: string | null;
  rateLimit: { ratePerMinute: number; burst: number } | null;
  graphRefusesAnonymous: boolean;
}

describe('CWF-017 function access and limits', () => {
  let dataDir: string;
  let service: BackendService;
  let base: string;
  let adminToken: string;
  let alice: { id: string; token: string };
  let bob: { id: string; token: string };

  async function req(
    method: string,
    pathName: string,
    body?: unknown,
    headers: Record<string, string> = {}
  ): Promise<{ status: number; json: Body }> {
    const res = await fetch(`${base}${pathName}`, {
      method,
      headers: body !== undefined ? { 'content-type': 'application/json', ...headers } : headers,
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
    let json = {} as Body;
    try {
      json = (await res.json()) as Body;
    } catch {
      /* non-JSON */
    }
    return { status: res.status, json };
  }

  const asAdmin = () => ({ authorization: `Bearer ${adminToken}` });
  const asUser = (u: { token: string }) => ({ 'x-parse-session-token': u.token });

  async function signup(username: string): Promise<{ id: string; token: string }> {
    const { status, json } = await req('POST', '/users', { username, password: `pw-${username}` });
    expect(status).toBe(201);
    if (!json.sessionToken || !json.objectId) throw new Error(`signup of ${username} returned no session`);
    return { id: json.objectId, token: json.sessionToken };
  }

  async function listFunctions(): Promise<Record<string, FunctionRow>> {
    const { status, json } = await req('GET', '/admin/permissions/functions', undefined, asAdmin());
    expect(status).toBe(200);
    const rows = json.functions as FunctionRow[];
    return Object.fromEntries(rows.map((r) => [r.name, r]));
  }

  /** Put a function back to its graph declaration between cases. */
  async function clear(name: string): Promise<void> {
    await req('DELETE', `/admin/permissions/functions/${name}`, undefined, asAdmin());
  }

  beforeAll(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-cwf017-'));
    fs.writeFileSync(path.join(dataDir, 'security.json'), JSON.stringify(LOCKED_CONFIG));
    fs.mkdirSync(path.join(dataDir, 'workflows'), { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'workflows', 'main.workflow.json'), JSON.stringify(WORKFLOW));

    service = new BackendService({ dataDir, port: 0, backendId: 'cwf017', backendName: 'CWF-017 Test' });
    const started = await service.start();
    base = started.listen.url;
    expect(started.security.enforced).toBe(true);
    adminToken = JSON.parse(fs.readFileSync(path.join(dataDir, 'secrets.json'), 'utf-8')).adminToken;

    alice = await signup('alice');
    bob = await signup('bob');
  });

  afterAll(async () => {
    await service.stop();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  // ==========================================================================
  // 1. The default posture, established BEFORE anything is declared
  // ==========================================================================

  it('an undeclared function still answers to its graph — this build changes no default', async () => {
    const rows = await listFunctions();

    // Ticked in the graph: anyone may call it, and nobody wrote that down.
    expect(rows.echo.source).toBe('graph');
    expect(rows.echo.call).toBe('public');
    expect(rows.echo.configured).toBeNull();
    expect(rows.echo.allowNoAuth).toBe(true);
    expect((await req('POST', '/functions/echo', {})).status).toBe(200);

    // Unticked in the graph: signed-in only, again with no config entry.
    expect(rows['closed-graph'].source).toBe('graph');
    expect(rows['closed-graph'].call).toBe('authenticated');
    expect(rows['closed-graph'].allowNoAuth).toBe(false);
    const anon = await req('POST', '/functions/closed-graph', {});
    expect(anon.status).toBe(403);
    expect(anon.json.code).toBe(119);
  });

  // ==========================================================================
  // 2. The rule allows and denies
  // ==========================================================================

  it('Signed-in refuses an anonymous call and admits an authenticated one', async () => {
    const set = await req('PUT', '/admin/permissions/functions/echo', { call: 'authenticated' }, asAdmin());
    expect(set.status).toBe(200);
    expect(set.json.effective).toBe('authenticated');
    expect(set.json.source).toBe('configured');

    const denied = await req('POST', '/functions/echo', {});
    expect(denied.status).toBe(403);
    expect(denied.json.code).toBe(119);

    const allowed = await req('POST', '/functions/echo', {}, asUser(alice));
    expect(allowed.status).toBe(200);

    await clear('echo');
    // And the graph default is back, without the caller reconstructing anything.
    expect((await req('POST', '/functions/echo', {})).status).toBe(200);
  });

  it('role:<name> refuses a signed-in non-member and admits a member', async () => {
    expect((await req('POST', '/admin/roles', { name: 'ops' }, asAdmin())).status).toBe(201);
    await req('PUT', '/admin/permissions/functions/echo', { call: 'role:ops' }, asAdmin());

    // Signed in, wrong role.
    const bobCall = await req('POST', '/functions/echo', {}, asUser(bob));
    expect(bobCall.status).toBe(403);
    // Anonymous, obviously.
    expect((await req('POST', '/functions/echo', {})).status).toBe(403);

    expect((await req('POST', '/admin/roles/ops/users', { userId: alice.id }, asAdmin())).status).toBe(200);
    const aliceCall = await req('POST', '/functions/echo', {}, asUser(alice));
    expect(aliceCall.status).toBe(200);

    await clear('echo');
  });

  it('"nobody" closes a function to every caller outside the backend, admin excepted', async () => {
    await req('PUT', '/admin/permissions/functions/echo', { call: 'nobody' }, asAdmin());
    expect((await req('POST', '/functions/echo', {})).status).toBe(403);
    expect((await req('POST', '/functions/echo', {}, asUser(alice))).status).toBe(403);
    // The admin credential bypasses function rules, as it does CLPs.
    expect((await req('POST', '/functions/echo', {}, asAdmin())).status).toBe(200);
    await clear('echo');
  });

  it('the array (OR) form round-trips through the admin surface and enforces', async () => {
    const set = await req(
      'PUT',
      '/admin/permissions/functions/echo',
      { call: ['role:ops', 'role:absent'] },
      asAdmin()
    );
    expect(set.status).toBe(200);
    expect(set.json.effective).toEqual(['role:ops', 'role:absent']);

    // Stored and read back identically — the panel and security.json agree.
    const rows = await listFunctions();
    expect(rows.echo.call).toEqual(['role:ops', 'role:absent']);
    expect(rows.echo.configured).toEqual(['role:ops', 'role:absent']);
    const raw = JSON.parse(fs.readFileSync(path.join(dataDir, 'security.json'), 'utf-8'));
    expect(raw.functions.echo.call).toEqual(['role:ops', 'role:absent']);

    // Alice is in ops (previous case), bob is in neither.
    expect((await req('POST', '/functions/echo', {}, asUser(alice))).status).toBe(200);
    expect((await req('POST', '/functions/echo', {}, asUser(bob))).status).toBe(403);
    await clear('echo');
  });

  it('the dry run answers exactly what enforcement does, including its source', async () => {
    await req('PUT', '/admin/permissions/functions/echo', { call: 'authenticated' }, asAdmin());

    const anon = await req('POST', '/admin/permissions/check', { functionName: 'echo' }, asAdmin());
    expect(anon.json.allowed).toBe(false);
    expect(anon.json.source).toBe('configured');
    expect(anon.json.rule).toBe('authenticated');

    const user = await req(
      'POST',
      '/admin/permissions/check',
      { functionName: 'echo', principal: { kind: 'user', userId: alice.id } },
      asAdmin()
    );
    expect(user.json.allowed).toBe(true);

    await clear('echo');
    // Cleared: the dry run now reports the graph as the source, not a blank.
    const graph = await req('POST', '/admin/permissions/check', { functionName: 'echo' }, asAdmin());
    expect(graph.json.source).toBe('graph');
    expect(graph.json.rule).toBe('public');
    expect(graph.json.allowed).toBe(true);
  });

  // ==========================================================================
  // 3. The two gates, made legible
  // ==========================================================================

  it('a public rule over a graph that refuses anonymous callers is reported, not hidden', async () => {
    // The backend rule decides whether the request REACHES the graph; the
    // Request node's own check then runs inside it. Opening the first without
    // the second is a 500, and the panel needs to be able to say so.
    await req('PUT', '/admin/permissions/functions/closed-graph', { call: 'public' }, asAdmin());
    const rows = await listFunctions();
    expect(rows['closed-graph'].graphRefusesAnonymous).toBe(true);
    expect(rows['closed-graph'].allowNoAuth).toBe(false);

    // And that is what actually happens: past the gate, refused by the graph.
    const call = await req('POST', '/functions/closed-graph', {});
    expect(call.status).toBe(500);

    // The pair that agrees is not flagged.
    expect(rows.echo.graphRefusesAnonymous).toBe(false);
    await clear('closed-graph');
  });

  it('a rule for a function nothing serves stays visible as drift', async () => {
    await req('PUT', '/admin/permissions/functions/ghost', { call: 'nobody' }, asAdmin());
    const rows = await listFunctions();
    expect(rows.ghost.deployed).toBe(false);
    expect(rows.ghost.call).toBe('nobody');
    await clear('ghost');
  });

  // ==========================================================================
  // 4. runAs, and the fields that must never be accepted-and-ignored
  // ==========================================================================

  it('runAs:"system" is accepted and runAs:"caller" is refused, not silently dropped', async () => {
    const system = await req('PUT', '/admin/permissions/functions/echo', { runAs: 'system' }, asAdmin());
    expect(system.status).toBe(200);
    expect((await listFunctions()).echo.runAs).toBe('system');

    const caller = await req('PUT', '/admin/permissions/functions/echo', { runAs: 'caller' }, asAdmin());
    expect(caller.status).toBe(400);
    expect(caller.json.error).toMatch(/not yet supported/);
    // Refused means unchanged, not half-applied.
    expect((await listFunctions()).echo.runAs).toBe('system');
    await clear('echo');
  });

  it('a body the write would ignore is refused rather than answered "success"', async () => {
    const typo = await req('PUT', '/admin/permissions/functions/echo', { calls: 'public' }, asAdmin());
    expect(typo.status).toBe(400);
    expect(typo.json.error).toMatch(/Unknown field/);

    const empty = await req('PUT', '/admin/permissions/functions/echo', {}, asAdmin());
    expect(empty.status).toBe(400);

    const junkRule = await req('PUT', '/admin/permissions/functions/echo', { call: 'everyone' }, asAdmin());
    expect(junkRule.status).toBe(400);

    const junkLimit = await req(
      'PUT',
      '/admin/permissions/functions/echo',
      { rateLimit: { perMinute: 5 } },
      asAdmin()
    );
    expect(junkLimit.status).toBe(400);

    // None of the four changed anything.
    expect((await listFunctions()).echo.configured).toBeNull();
  });

  it('only an admin may read or change who can call a function', async () => {
    expect((await req('GET', '/admin/permissions/functions', undefined, asUser(alice))).status).toBe(401);
    expect((await req('PUT', '/admin/permissions/functions/echo', { call: 'public' }, asUser(alice))).status).toBe(401);
    expect((await req('DELETE', '/admin/permissions/functions/echo', undefined, asUser(alice))).status).toBe(401);
    expect((await req('GET', '/admin/permissions/functions')).status).toBe(401);
  });

  // ==========================================================================
  // 5. The per-function budget
  // ==========================================================================

  it('a per-function limit refuses at its own threshold and leaves other functions alone', async () => {
    const set = await req(
      'PUT',
      '/admin/permissions/functions/echo',
      { rateLimit: { ratePerMinute: 1, burst: 2 } },
      asAdmin()
    );
    expect(set.status).toBe(200);
    expect((await listFunctions()).echo.rateLimit).toEqual({ ratePerMinute: 1, burst: 2 });

    // Two through the bucket, the third refused — as the same caller, since the
    // bucket is keyed by principal.
    expect((await req('POST', '/functions/echo', {}, asUser(alice))).status).toBe(200);
    expect((await req('POST', '/functions/echo', {}, asUser(alice))).status).toBe(200);
    const refused = await req('POST', '/functions/echo', {}, asUser(alice));
    expect(refused.status).toBe(429);
    expect(refused.json.error).toMatch(/function "echo"/);

    // Every other function is unaffected — the class budget is nowhere near spent.
    expect((await req('POST', '/functions/private-fn', {}, asUser(alice))).status).toBe(200);

    // A different caller has their own bucket.
    expect((await req('POST', '/functions/echo', {}, asUser(bob))).status).toBe(200);

    // Clearing the limit restores the function immediately.
    await req('PUT', '/admin/permissions/functions/echo', { rateLimit: null }, asAdmin());
    expect((await listFunctions()).echo.rateLimit).toBeNull();
    expect((await req('POST', '/functions/echo', {}, asUser(alice))).status).toBe(200);
    await clear('echo');
  });

  it('a function with no limit declared is not rate-limited beyond its class', async () => {
    // Twelve calls in a row — well past any per-function bucket, nowhere near
    // the `functions` class default of 600/min burst 200.
    for (let i = 0; i < 12; i++) {
      expect((await req('POST', '/functions/private-fn', {}, asUser(bob))).status).toBe(200);
    }
    expect((await listFunctions())['private-fn'].rateLimit).toBeNull();
  });

  // ==========================================================================
  // 6. What a workflow step meets — the interaction CWF-017 had to decide
  // ==========================================================================

  it('a workflow step is gated by the graph port, NOT by the call rule', async () => {
    // A `call-function` step invokes the function IN PROCESS (`invokeFunction`),
    // so it never reaches the dispatcher and no `call` rule applies to it. This
    // is the opposite of what CWF-017 assumed: closing a function to the outside
    // world does not close it to the workflows in the same backend, and opening
    // one does not open it to them either.
    await req('PUT', '/admin/permissions/functions/echo', { call: 'nobody' }, asAdmin());
    const closed = await req(
      'POST',
      '/admin/workflow-defs',
      { id: 'calls-echo', name: 'calls echo', entry: 'go', steps: [{ id: 'go', kind: 'call-function', ref: 'echo' }] },
      asAdmin()
    );
    expect(closed.status).toBe(201);
    const run = await req('POST', '/admin/workflow-defs/calls-echo/run', { payload: {} }, asAdmin());
    expect(run.status).toBe(200);
    // `nobody` at the door, and the step still runs: system callers bypass.
    expect((run.json.run as { status: string }).status).toBe('success');
    await clear('echo');

    // What DOES stop a step is the Request node's own port, which runs inside
    // the graph with no session token to offer it. No config rule can rescue it.
    await req('PUT', '/admin/permissions/functions/closed-graph', { call: 'public' }, asAdmin());
    const graphGated = await req(
      'POST',
      '/admin/workflow-defs',
      {
        id: 'calls-closed',
        name: 'calls closed',
        entry: 'go',
        steps: [{ id: 'go', kind: 'call-function', ref: 'closed-graph' }]
      },
      asAdmin()
    );
    expect(graphGated.status).toBe(201);
    const failing = await req('POST', '/admin/workflow-defs/calls-closed/run', { payload: {} }, asAdmin());
    expect((failing.json.run as { status: string }).status).toBe('error');
    await clear('closed-graph');
  });

  it('the shared class budget is reported so a per-function number can be read against it', async () => {
    const { json } = await req('GET', '/admin/permissions/functions', undefined, asAdmin());
    expect(json.classRateLimit).toEqual({ ratePerMinute: 600, burst: 200 });
  });
});
