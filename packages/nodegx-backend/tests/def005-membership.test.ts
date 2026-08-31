/**
 * DEF-005 — membership stops being a category the graph cannot express.
 *
 * 🧭 **Richard's ruling, 2026-08-30**: build BOTH halves.
 *   **(a)** a read-only `roles` output on the `User` node, resolved server-side
 *   from `SecurityState.rolesForUser`; **(b)** a cloud `List Users In Role`
 *   node. **The cloud-only rule on the role WRITES survives intact** — that is
 *   the load-bearing half of the ruling and nothing here weakens it.
 *
 * Driven end to end over real HTTP against a real service with enforcement ON
 * (`devOpen: false`), for the reason `cloud-system-roles.test.ts` gives: every
 * claim here is about a DECISION — who may call, who is a member, what a
 * membership permits — and a decision asserted against the object it was built
 * from proves only that JSON round-trips.
 *
 * ## 🔴 AC3 is why this suite is shaped the way it is
 *
 * The claim that makes half (a) safe is a REFUSAL: *a user who edits the new
 * output client-side is still refused by the server*. And §4 of the task file
 * names the way a refusal is misread — **"the role read was refused" and "the
 * role read was never requested" look identical and have opposite fixes.**
 *
 * So the very first test establishes the **known-firing signal**: `staffer`,
 * genuinely in `member`, calls `memberonly` and gets **200**. Every 403 below
 * is then an absence of *permission*, in the same fixture, over the same
 * transport, in the same run — not an absence of a request. Copied deliberately
 * from `def009-public-write-default.test.ts`, whose `declared-tight` arm does
 * the same job.
 *
 * ⚠️ The tamper arm also asserts the **stored row**, not only the response.
 * `/users/me` puts the server-resolved `roles` after the record spread, so a
 * stored `roles` column would be invisible in the response either way — which
 * means the response alone cannot tell "stripped" from "stored and shadowed".
 * Both are safe; only one is what `updateUser` claims. `GET /admin/schema` is
 * what tells them apart.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { BackendService } from '../src/service';
import { DEFAULT_MEMBER_PAGE } from '../src/roles/SystemRoles';

jest.setTimeout(60000);

/** Enforcement on. The same shape as `cloud-system-roles.test.ts`, which is the point. */
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

/* eslint-disable @typescript-eslint/no-explicit-any */
const requestNode = (id: string, allowNoAuth: boolean, params: string) => ({
  id,
  type: 'noodl.cloud.request',
  x: 0,
  y: 0,
  parameters: { allowNoAuth, params } as Record<string, any>,
  ports: [],
  children: []
});

const responseNode = (id: string, params: string, extra: Record<string, unknown> = {}) => ({
  id,
  type: 'noodl.cloud.response',
  x: 0,
  y: 400,
  parameters: { params, ...extra } as Record<string, any>,
  ports: [],
  children: []
});
/* eslint-enable @typescript-eslint/no-explicit-any */

/** `grant` — the only way anybody in this suite acquires a role. Cloud-side, as ruled. */
const grant = {
  name: '/#__cloud__/grant',
  nodes: [
    requestNode('req', true, 'target,role'),
    { id: 'ar', type: 'noodl.cloud.addusertorole', x: 0, y: 200, parameters: {}, ports: [], children: [] },
    responseNode('resOk', 'roles,state', { 'pm-state': 'added' }),
    responseNode('resDup', 'roles,state', { 'pm-state': 'already' }),
    responseNode('resErr', 'error,state', { 'pm-state': 'refused' })
  ],
  connections: [
    { sourceId: 'req', sourcePort: 'pm-target', targetId: 'ar', targetPort: 'userId' },
    { sourceId: 'req', sourcePort: 'pm-role', targetId: 'ar', targetPort: 'role' },
    { sourceId: 'req', sourcePort: 'receive', targetId: 'ar', targetPort: 'add' },
    { sourceId: 'ar', sourcePort: 'roles', targetId: 'resOk', targetPort: 'pm-roles' },
    { sourceId: 'ar', sourcePort: 'done', targetId: 'resOk', targetPort: 'send' },
    { sourceId: 'ar', sourcePort: 'roles', targetId: 'resDup', targetPort: 'pm-roles' },
    { sourceId: 'ar', sourcePort: 'unchanged', targetId: 'resDup', targetPort: 'send' },
    { sourceId: 'ar', sourcePort: 'error', targetId: 'resErr', targetPort: 'pm-error' },
    { sourceId: 'ar', sourcePort: 'failure', targetId: 'resErr', targetPort: 'send' }
  ],
  roots: []
};

/**
 * `roster` — DEF-005 (b), the node under test.
 *
 * Gated `role:member` by a rule written below, which IS the ACL posture AC4
 * asks for: reachable only from a cloud function, and decided by that
 * function's own `call` rule. Exactly `getuserroles`' posture.
 */
const roster = {
  name: '/#__cloud__/roster',
  nodes: [
    requestNode('req', false, 'role,limit,skip'),
    { id: 'lu', type: 'noodl.cloud.listusersinrole', x: 0, y: 200, parameters: {}, ports: [], children: [] },
    responseNode('resSome', 'users,userIds,total,state', { 'pm-state': 'some' }),
    responseNode('resNone', 'total,state', { 'pm-state': 'empty' }),
    responseNode('resErr', 'error,state', { 'pm-state': 'refused' })
  ],
  connections: [
    { sourceId: 'req', sourcePort: 'pm-role', targetId: 'lu', targetPort: 'role' },
    { sourceId: 'req', sourcePort: 'pm-limit', targetId: 'lu', targetPort: 'limit' },
    { sourceId: 'req', sourcePort: 'pm-skip', targetId: 'lu', targetPort: 'skip' },
    { sourceId: 'req', sourcePort: 'receive', targetId: 'lu', targetPort: 'read' },
    { sourceId: 'lu', sourcePort: 'users', targetId: 'resSome', targetPort: 'pm-users' },
    { sourceId: 'lu', sourcePort: 'userIds', targetId: 'resSome', targetPort: 'pm-userIds' },
    { sourceId: 'lu', sourcePort: 'total', targetId: 'resSome', targetPort: 'pm-total' },
    { sourceId: 'lu', sourcePort: 'done', targetId: 'resSome', targetPort: 'send' },
    { sourceId: 'lu', sourcePort: 'total', targetId: 'resNone', targetPort: 'pm-total' },
    { sourceId: 'lu', sourcePort: 'unchanged', targetId: 'resNone', targetPort: 'send' },
    { sourceId: 'lu', sourcePort: 'error', targetId: 'resErr', targetPort: 'pm-error' },
    { sourceId: 'lu', sourcePort: 'failure', targetId: 'resErr', targetPort: 'send' }
  ],
  roots: []
};

/** `deluser` — used once, to leave a dangling junction row on purpose. */
const deluser = {
  name: '/#__cloud__/deluser',
  nodes: [
    requestNode('req', true, 'target'),
    { id: 'du', type: 'noodl.cloud.deleteuser', x: 0, y: 200, parameters: {}, ports: [], children: [] },
    responseNode('resOk', 'state', { 'pm-state': 'gone' }),
    responseNode('resErr', 'error,state', { 'pm-state': 'refused' })
  ],
  connections: [
    { sourceId: 'req', sourcePort: 'pm-target', targetId: 'du', targetPort: 'userId' },
    { sourceId: 'req', sourcePort: 'receive', targetId: 'du', targetPort: 'remove' },
    { sourceId: 'du', sourcePort: 'done', targetId: 'resOk', targetPort: 'send' },
    { sourceId: 'du', sourcePort: 'error', targetId: 'resErr', targetPort: 'pm-error' },
    { sourceId: 'du', sourcePort: 'failure', targetId: 'resErr', targetPort: 'send' }
  ],
  roots: []
};

/**
 * `memberonly` — does nothing at all, gated `role:member`.
 *
 * 🔴 This is the instrument for AC3. It has no graph worth speaking of on
 * purpose: what is being measured is the GATE, and a function that also did
 * something could fail for a second reason and read as a refusal.
 */
const memberonly = {
  name: '/#__cloud__/memberonly',
  nodes: [requestNode('req', false, ''), responseNode('res', 'ok', { 'pm-ok': 'yes' })],
  connections: [{ sourceId: 'req', sourcePort: 'receive', targetId: 'res', targetPort: 'send' }],
  roots: []
};

const WORKFLOW = { components: [grant, roster, deluser, memberonly], settings: {}, metadata: {} };

interface Body {
  [key: string]: unknown;
  error?: string;
  code?: number;
  sessionToken?: string;
  objectId?: string;
  roles?: unknown;
  result?: Record<string, unknown>;
}

/** What `GET /admin/schema/:table` answers with (`TableSchemaResponse`). */
interface TableSchemaBody {
  name?: string;
  columns?: { name: string }[];
}

describe('DEF-005 — membership, expressible', () => {
  let dataDir: string;
  let service: BackendService;
  let base: string;
  let adminToken: string;

  async function req(
    method: string,
    pathName: string,
    body?: unknown,
    headers: Record<string, string> = {}
  ): Promise<{ status: number; json: Body; text: string }> {
    const res = await fetch(`${base}${pathName}`, {
      method,
      headers: body !== undefined ? { 'content-type': 'application/json', ...headers } : headers,
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
    const text = await res.text();
    let json = {} as Body;
    try {
      json = JSON.parse(text) as Body;
    } catch {
      /* non-JSON */
    }
    return { status: res.status, json, text };
  }

  const asAdmin = () => ({ authorization: `Bearer ${adminToken}` });
  const asUser = (u: { token: string }) => ({ 'x-parse-session-token': u.token });

  let seq = 0;
  interface Account {
    id: string;
    token: string;
    username: string;
  }
  async function signup(prefix: string): Promise<Account> {
    const username = `${prefix}-${++seq}`;
    const { status, json } = await req('POST', '/users', { username, password: `pw-${username}` });
    expect(status).toBe(201);
    if (!json.sessionToken || !json.objectId) throw new Error(`signup of ${username} returned no session`);
    return { id: json.objectId, token: json.sessionToken, username };
  }

  /** The ONLY way a role is acquired here: through the cloud-side write node. */
  async function putInRole(user: Account, role: string): Promise<void> {
    const r = await req('POST', '/functions/grant', { target: user.id, role });
    expect(r.status).toBe(200);
    expect((r.json.result as Record<string, unknown>).state).toBe('added');
  }

  const me = (u: Account) => req('GET', '/users/me', undefined, asUser(u));
  const callMemberOnly = (u: Account) => req('POST', '/functions/memberonly', {}, asUser(u));
  const readRoster = (u: Account, params: Record<string, unknown>) =>
    req('POST', '/functions/roster', params, asUser(u));

  let staffer: Account;

  beforeAll(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-def005-'));
    fs.writeFileSync(path.join(dataDir, 'security.json'), JSON.stringify(LOCKED_CONFIG));
    fs.mkdirSync(path.join(dataDir, 'workflows'), { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'workflows', 'main.workflow.json'), JSON.stringify(WORKFLOW));

    service = new BackendService({ dataDir, port: 0, backendId: 'def005', backendName: 'DEF-005 Test' });
    const started = await service.start();
    base = started.listen.url;
    expect(started.security.enforced).toBe(true);
    adminToken = JSON.parse(fs.readFileSync(path.join(dataDir, 'secrets.json'), 'utf-8')).adminToken;

    expect((await req('POST', '/admin/roles', { name: 'member' }, asAdmin())).status).toBe(201);
    expect((await req('POST', '/admin/roles', { name: 'empty' }, asAdmin())).status).toBe(201);
    for (const fn of ['memberonly', 'roster']) {
      expect(
        (await req('PUT', `/admin/permissions/functions/${fn}`, { call: 'role:member' }, asAdmin())).status
      ).toBe(200);
    }

    staffer = await signup('staffer');
    await putInRole(staffer, 'member');
  });

  afterAll(async () => {
    await service.stop();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  // ==========================================================================
  // 0. The known-firing signal, established FIRST
  // ==========================================================================

  it('🔴 the gate can say YES — a real member reaches memberonly (the known-firing signal)', async () => {
    // Nothing about DEF-005 is being tested here. This is the arm that makes
    // every 403 below an absence of PERMISSION rather than an absence of a
    // request: the same function, the same transport, the same run.
    const ok = await callMemberOnly(staffer);
    expect(ok.status).toBe(200);
    expect((ok.json.result as Record<string, unknown>).ok).toBe('yes');
  });

  // ==========================================================================
  // 1. (a) AC2 — a graph branches on the current user's roles, no cloud function
  // ==========================================================================

  it('AC2 — /users/me carries the roles, so the branch needs no bespoke cloud function', async () => {
    const mine = await me(staffer);
    expect(mine.status).toBe(200);
    expect(mine.json.roles).toEqual(['member']);

    // The point of AC2 in one assertion: this response is the read the client
    // was making ANYWAY to know who is signed in. No second round trip, no
    // `myStanding` function, no security-policy entry, and nothing to flicker
    // through "nothing here" on the way to a decision.
    expect(mine.json.objectId).toBe(staffer.id);
  });

  it('AC2 — /login carries them too, so the very first render can already branch', async () => {
    const login = await req('POST', '/login', {
      username: staffer.username,
      password: `pw-${staffer.username}`,
      _method: 'GET'
    });
    expect(login.status).toBe(200);
    expect(login.json.roles).toEqual(['member']);
  });

  it('a user in no roles reads [], which is a different answer from "not signed in"', async () => {
    const nobody = await signup('nobody');
    const mine = await me(nobody);
    expect(mine.status).toBe(200);
    expect(mine.json.roles).toEqual([]);
  });

  it('a membership granted after sign-in appears on the SAME session token, no re-login', async () => {
    const joiner = await signup('joiner');
    expect((await me(joiner)).json.roles).toEqual([]);

    await putInRole(joiner, 'member');

    // The `User` node's `Fetch` is this request. Roles resolve per response
    // from the junction, so there is no cache to invalidate and no new session
    // to mint — which is what makes "join, then see the members' area" one wire.
    const after = await me(joiner);
    expect(after.json.roles).toEqual(['member']);
    // And it is a real grant, not just a changed string: the gate agrees.
    expect((await callMemberOnly(joiner)).status).toBe(200);
  });

  // ==========================================================================
  // 2. 🔴 (a) AC3 — the negative control. The output grants NOTHING.
  // ==========================================================================

  it('🔴 AC3 — a user who writes roles onto themselves is STILL refused by the server', async () => {
    const impostor = await signup('impostor');

    // Baseline: not a member, and the gate says so. Beside the 200 the known-
    // firing test above got from the identical call.
    expect((await me(impostor)).json.roles).toEqual([]);
    const before = await callMemberOnly(impostor);
    expect(before.status).toBe(403);

    // The tamper. This is the client editing the value it was handed — the
    // literal thing AC3 asks about — through the only write door it has to its
    // own record.
    const tamper = await req('PUT', `/users/${impostor.id}`, { roles: ['member'] }, asUser(impostor));
    expect(tamper.status).toBe(200);

    // 1. The server's answer is unchanged. It re-resolved from the junction and
    //    never looked at what was sent.
    expect((await me(impostor)).json.roles).toEqual([]);

    // 2. 🔴 THE REFUSAL ITSELF — asserted, not inferred from a missing row.
    const after = await callMemberOnly(impostor);
    expect(after.status).toBe(403);

    // 3. And the refusal is a refusal rather than a broken fixture: the same
    //    call, in this same test, from a genuine member, succeeds.
    expect((await callMemberOnly(staffer)).status).toBe(200);
  });

  it('AC3 — the tampered value was STRIPPED, not merely shadowed by the response', async () => {
    const sneak = await signup('sneak');
    await req('PUT', `/users/${sneak.id}`, { roles: ['member'], nickname: 'kept' }, asUser(sneak));

    // ⚠️ `/users/me` cannot tell these apart: the resolved value is spread last,
    // so a stored `roles` column would be invisible there either way. The schema
    // is what distinguishes "stripped" from "stored and overridden".
    const schema = await req('GET', '/admin/schema/_User', undefined, asAdmin());
    expect(schema.status).toBe(200);
    const columns = ((schema.json as unknown as TableSchemaBody).columns || []).map((c) => c.name);
    // A control on the instrument itself: if this read returned nothing at all,
    // "no roles column" below would pass for the wrong reason.
    expect(columns).toContain('username');

    // The known-firing half of THIS absence: the same PUT, in the same call,
    // carried `nickname` — and that one DID land. So `roles` being absent is the
    // strip doing its job, not the PUT having been ignored wholesale.
    expect(columns).toContain('nickname');
    expect(columns).not.toContain('roles');
  });

  it('a role WRITE is still unreachable from anywhere but a cloud function', async () => {
    // The load-bearing half of the ruling, pinned. `addusertorole` lives only in
    // `noodl-viewer-cloud`'s registry, so the only door to it is a function —
    // and this one is admin-gated, not graph-reachable.
    const outsider = await signup('outsider');
    const direct = await req('POST', '/admin/roles/member/users', { userId: outsider.id }, asUser(outsider));
    expect(direct.status).toBeGreaterThanOrEqual(400);
    expect((await me(outsider)).json.roles).toEqual([]);
    expect((await callMemberOnly(outsider)).status).toBe(403);
  });

  // ==========================================================================
  // 3. (b) AC4 — a role's members are enumerable from a cloud graph
  // ==========================================================================

  it('AC4 — List Users In Role answers who is in the role, with the records to draw them', async () => {
    const r = await readRoster(staffer, { role: 'member' });
    expect(r.status).toBe(200);
    const result = r.json.result as Record<string, unknown>;
    expect(result.state).toBe('some');

    const userIds = result.userIds as string[];
    const users = result.users as Record<string, unknown>[];
    expect(userIds).toContain(staffer.id);
    expect(users.length).toBe(userIds.length);
    expect(result.total).toBe(userIds.length);

    // The records are usable for the screen this node exists to draw...
    const mine = users.find((u) => u.objectId === staffer.id)!;
    expect(mine.username).toBe(staffer.username);
    // ...and carry no credential. Same `wireRecord` path as /users/me, so this
    // cannot drift from the stripping the login response already does.
    expect(mine._hashed_password).toBeUndefined();
  });

  it('AC4 — the ACL posture is getuserroles’: a non-member cannot read the roster', async () => {
    const lurker = await signup('lurker');
    const refused = await readRoster(lurker, { role: 'member' });
    expect(refused.status).toBe(403);

    // Unauthenticated likewise — and beside the 200 a member gets for the same
    // call, so both are refusals rather than a function that never ran.
    const anon = await req('POST', '/functions/roster', { role: 'member' });
    expect(anon.status).toBe(403);
    expect((await readRoster(staffer, { role: 'member' })).status).toBe(200);
  });

  it('an empty role is Unchanged; a role that does not exist is a Failure naming it', async () => {
    const empty = await readRoster(staffer, { role: 'empty' });
    expect((empty.json.result as Record<string, unknown>).state).toBe('empty');
    expect((empty.json.result as Record<string, unknown>).total).toBe(0);

    // ⚠️ NOT an empty list. Answering `[]` for a misspelling draws the
    // "nobody has joined yet" screen for a typo.
    const typo = await readRoster(staffer, { role: 'membre' });
    const failed = typo.json.result as Record<string, unknown>;
    expect(failed.state).toBe('refused');
    expect(String(failed.error)).toContain('membre');
  });

  it('Total reports the whole membership even when the page is clipped', async () => {
    const crowd = 'crowd';
    expect((await req('POST', '/admin/roles', { name: crowd }, asAdmin())).status).toBe(201);
    const members: Account[] = [];
    for (let i = 0; i < 5; i++) {
      const u = await signup(`crowd${i}`);
      await putInRole(u, crowd);
      members.push(u);
    }
    await putInRole(staffer, crowd);

    // Limit and Skip arrive from a Request parameter, i.e. as STRINGS. That is
    // the shape the node has to survive, not the number a spec would hand it.
    const page1 = await readRoster(staffer, { role: crowd, limit: '2', skip: '0' });
    const r1 = page1.json.result as Record<string, unknown>;
    expect((r1.userIds as string[]).length).toBe(2);
    expect(r1.total).toBe(6);

    const page2 = await readRoster(staffer, { role: crowd, limit: '2', skip: '2' });
    const r2 = page2.json.result as Record<string, unknown>;
    expect((r2.userIds as string[]).length).toBe(2);
    expect(r2.total).toBe(6);
    // A real second page, not the first one again.
    expect(r2.userIds).not.toEqual(r1.userIds);

    // 🔴 The clip is legible. A screen comparing these two numbers knows there
    // is more; a screen that only had `users.length` would report six people as
    // two and be confidently wrong.
    expect(r1.total).toBeGreaterThan((r1.userIds as string[]).length);

    // An unset Limit is the backend's default, not zero — a declared default
    // never runs its setter, so `undefined` reaches the backend here.
    const unpaged = await readRoster(staffer, { role: crowd });
    expect(((unpaged.json.result as Record<string, unknown>).userIds as string[]).length).toBe(6);
    expect(DEFAULT_MEMBER_PAGE).toBeGreaterThan(6);
  });

  it('a membership whose user has been deleted is skipped, not fatal', async () => {
    const ghostRole = 'ghosts';
    expect((await req('POST', '/admin/roles', { name: ghostRole }, asAdmin())).status).toBe(201);
    const survivor = await signup('survivor');
    const doomed = await signup('doomed');
    await putInRole(survivor, ghostRole);
    await putInRole(doomed, ghostRole);

    expect((await req('POST', '/functions/deluser', { target: doomed.id })).status).toBe(200);

    // `Delete User` does not sweep memberships, so the junction now names an id
    // nothing resolves. One deleted account must not hide every remaining
    // member — which is what failing the whole page would do.
    const r = await readRoster(staffer, { role: ghostRole });
    expect(r.status).toBe(200);
    const result = r.json.result as Record<string, unknown>;
    expect(result.userIds).toEqual([survivor.id]);
    // ⚠️ `total` counts the JUNCTION, which still holds two rows. That is the
    // honest number for "how many memberships are recorded" and it deliberately
    // disagrees with the page — recorded here so a future reader meets the
    // disagreement in a test rather than in a member count that will not add up.
    expect(result.total).toBe(2);
  });
});
