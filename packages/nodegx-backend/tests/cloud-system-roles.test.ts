/**
 * F86 — a cloud function puts a user in a role, and the role means something.
 *
 * Driven end to end through `POST /functions/:name` against a real service with
 * enforcement ON (`devOpen: false`), for the reason CWF-015's suite gives: every
 * claim here is about a DECISION — who may call, who is a member, what a
 * membership then permits — and a decision asserted against the object it was
 * built from proves only that JSON round-trips.
 *
 * ## What this suite exists to hold
 *
 *  1. **The finding itself, closed.** A function gated on `role:member` refuses
 *     a user; a cloud function adds them to `member`; the same call now
 *     succeeds. Before this task there was no step 2.
 *  2. **A membership reaches the ACL predicate too**, not only the function
 *     rule — a record whose ACL names `role:member` is invisible before and
 *     readable after, with no new session and no re-login.
 *  3. **Revocation is live.** Removing the membership closes both again on the
 *     SAME session token: roles resolve per request, so there is no cache to
 *     invalidate.
 *  4. **Idempotence.** Adding twice and removing twice are `Unchanged`, not
 *     failures — a signup or de-provisioning job re-run must not go red.
 *  5. **Auto-create is off.** An unknown role is a Failure naming it, and no
 *     role appears; ticking `Create Role If Missing` is what changes that.
 *  6. **The deny path.** ⚠️ An access-control claim with no deny test is an
 *     unchecked claim. A signed-in non-member is refused AND no membership
 *     appears — the 403 and the absence, because a 403 after the write would
 *     still be a breach.
 *  7. **⚠️ `SystemUsers`' invariant #2 still holds.** That module's header and
 *     `cloud-system-users.test.ts` both state it writes neither `_Role` nor the
 *     junction. This suite adds role writes to the product, so it also pins
 *     that they went somewhere else.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { BackendService } from '../src/service';

jest.setTimeout(40000);

/** Enforcement on. The same shape as CWF-015's own suite, which is the point. */
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

/** `grant` — the signup-side shape: three branches off one Add User To Role. */
const grant = {
  name: '/#__cloud__/grant',
  nodes: [
    requestNode('req', true, 'target,role,create'),
    { id: 'ar', type: 'noodl.cloud.addusertorole', x: 0, y: 200, parameters: {}, ports: [], children: [] },
    responseNode('resOk', 'roles,created,state', { 'pm-state': 'added' }),
    responseNode('resDup', 'roles,state', { 'pm-state': 'already' }),
    responseNode('resErr', 'error,state', { 'pm-state': 'refused' })
  ],
  connections: [
    { sourceId: 'req', sourcePort: 'pm-target', targetId: 'ar', targetPort: 'userId' },
    { sourceId: 'req', sourcePort: 'pm-role', targetId: 'ar', targetPort: 'role' },
    { sourceId: 'req', sourcePort: 'pm-create', targetId: 'ar', targetPort: 'createRole' },
    { sourceId: 'req', sourcePort: 'receive', targetId: 'ar', targetPort: 'add' },

    { sourceId: 'ar', sourcePort: 'roles', targetId: 'resOk', targetPort: 'pm-roles' },
    { sourceId: 'ar', sourcePort: 'roleCreated', targetId: 'resOk', targetPort: 'pm-created' },
    { sourceId: 'ar', sourcePort: 'done', targetId: 'resOk', targetPort: 'send' },

    { sourceId: 'ar', sourcePort: 'roles', targetId: 'resDup', targetPort: 'pm-roles' },
    { sourceId: 'ar', sourcePort: 'unchanged', targetId: 'resDup', targetPort: 'send' },

    { sourceId: 'ar', sourcePort: 'error', targetId: 'resErr', targetPort: 'pm-error' },
    { sourceId: 'ar', sourcePort: 'failure', targetId: 'resErr', targetPort: 'send' }
  ],
  roots: []
};

/** `revoke` — Remove User From Role, with the two Unchanged readings wired. */
const revoke = {
  name: '/#__cloud__/revoke',
  nodes: [
    requestNode('req', true, 'target,role'),
    { id: 'rr', type: 'noodl.cloud.removeuserfromrole', x: 0, y: 200, parameters: {}, ports: [], children: [] },
    responseNode('resOk', 'roles,state', { 'pm-state': 'removed' }),
    responseNode('resNoop', 'roles,error,state', { 'pm-state': 'wasnt' }),
    responseNode('resErr', 'error,state', { 'pm-state': 'refused' })
  ],
  connections: [
    { sourceId: 'req', sourcePort: 'pm-target', targetId: 'rr', targetPort: 'userId' },
    { sourceId: 'req', sourcePort: 'pm-role', targetId: 'rr', targetPort: 'role' },
    { sourceId: 'req', sourcePort: 'receive', targetId: 'rr', targetPort: 'remove' },

    { sourceId: 'rr', sourcePort: 'roles', targetId: 'resOk', targetPort: 'pm-roles' },
    { sourceId: 'rr', sourcePort: 'done', targetId: 'resOk', targetPort: 'send' },

    { sourceId: 'rr', sourcePort: 'roles', targetId: 'resNoop', targetPort: 'pm-roles' },
    { sourceId: 'rr', sourcePort: 'error', targetId: 'resNoop', targetPort: 'pm-error' },
    { sourceId: 'rr', sourcePort: 'unchanged', targetId: 'resNoop', targetPort: 'send' },

    { sourceId: 'rr', sourcePort: 'error', targetId: 'resErr', targetPort: 'pm-error' },
    { sourceId: 'rr', sourcePort: 'failure', targetId: 'resErr', targetPort: 'send' }
  ],
  roots: []
};

/** `roles` — Get User Roles, the read. */
const readRoles = {
  name: '/#__cloud__/roles',
  nodes: [
    requestNode('req', true, 'target'),
    { id: 'gr', type: 'noodl.cloud.getuserroles', x: 0, y: 200, parameters: {}, ports: [], children: [] },
    responseNode('resSome', 'roles,state', { 'pm-state': 'some' }),
    responseNode('resNone', 'roles,state', { 'pm-state': 'none' }),
    responseNode('resErr', 'error,state', { 'pm-state': 'refused' })
  ],
  connections: [
    { sourceId: 'req', sourcePort: 'pm-target', targetId: 'gr', targetPort: 'userId' },
    { sourceId: 'req', sourcePort: 'receive', targetId: 'gr', targetPort: 'read' },

    { sourceId: 'gr', sourcePort: 'roles', targetId: 'resSome', targetPort: 'pm-roles' },
    { sourceId: 'gr', sourcePort: 'done', targetId: 'resSome', targetPort: 'send' },

    { sourceId: 'gr', sourcePort: 'roles', targetId: 'resNone', targetPort: 'pm-roles' },
    { sourceId: 'gr', sourcePort: 'unchanged', targetId: 'resNone', targetPort: 'send' },

    { sourceId: 'gr', sourcePort: 'error', targetId: 'resErr', targetPort: 'pm-error' },
    { sourceId: 'gr', sourcePort: 'failure', targetId: 'resErr', targetPort: 'send' }
  ],
  roots: []
};

/**
 * `memberonly` — a function that does nothing at all, gated on `role:member`.
 *
 * The whole point of the finding in one graph: this is what a rule saying
 * `role:member` is *for*, and until F86 nothing a running app did could put
 * anyone on the allowed side of it.
 */
const memberonly = {
  name: '/#__cloud__/memberonly',
  nodes: [requestNode('req', false, ''), responseNode('res', 'ok', { 'pm-ok': 'yes' })],
  connections: [{ sourceId: 'req', sourcePort: 'receive', targetId: 'res', targetPort: 'send' }],
  roots: []
};

const WORKFLOW = {
  components: [grant, revoke, readRoles, memberonly],
  settings: {},
  metadata: {}
};

interface Body {
  [key: string]: unknown;
  error?: string;
  code?: number;
  sessionToken?: string;
  objectId?: string;
  result?: Record<string, unknown>;
}

describe('F86 role membership from a cloud function', () => {
  let dataDir: string;
  let service: BackendService;
  let base: string;
  let adminToken: string;
  let caller: { id: string; token: string };

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
  async function signup(prefix: string): Promise<{ id: string; token: string; username: string }> {
    const username = `${prefix}-${++seq}`;
    const { status, json } = await req('POST', '/users', { username, password: `pw-${username}` });
    expect(status).toBe(201);
    if (!json.sessionToken || !json.objectId) throw new Error(`signup of ${username} returned no session`);
    return { id: json.objectId, token: json.sessionToken, username };
  }

  /** Call `grant`, answering with the branch it took. */
  const doGrant = (target: string, role: string, create?: boolean) =>
    req('POST', '/functions/grant', { target, role, create }, asUser(caller));
  const doRevoke = (target: string, role: string) =>
    req('POST', '/functions/revoke', { target, role }, asUser(caller));
  const doRead = (target: string) => req('POST', '/functions/roles', { target }, asUser(caller));
  const branch = (r: { json: Body }) => r.json.result as Record<string, unknown>;

  beforeAll(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-f86-'));
    fs.writeFileSync(path.join(dataDir, 'security.json'), JSON.stringify(LOCKED_CONFIG));
    fs.mkdirSync(path.join(dataDir, 'workflows'), { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'workflows', 'main.workflow.json'), JSON.stringify(WORKFLOW));

    service = new BackendService({ dataDir, port: 0, backendId: 'f86', backendName: 'F86 Test' });
    const started = await service.start();
    base = started.listen.url;
    expect(started.security.enforced).toBe(true);
    adminToken = JSON.parse(fs.readFileSync(path.join(dataDir, 'secrets.json'), 'utf-8')).adminToken;

    caller = await signup('caller');

    // The role a rule can name. Created through the admin surface, which is
    // where the rule that grants through it is written too.
    expect((await req('POST', '/admin/roles', { name: 'member' }, asAdmin())).status).toBe(201);
    expect(
      (await req('PUT', '/admin/permissions/functions/memberonly', { call: 'role:member' }, asAdmin())).status
    ).toBe(200);
  });

  afterAll(async () => {
    await service.stop();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  // ==========================================================================
  // 1. The finding, closed
  // ==========================================================================

  it('a role-gated function refuses a user, and a cloud function is what lets them in', async () => {
    const user = await signup('joiner');

    // Before. This is the state the whole finding describes: the rule is
    // correct, the role exists, and nothing the app can do puts anyone in it.
    const before = await req('POST', '/functions/memberonly', {}, asUser(user));
    expect(before.status).toBe(403);
    expect(before.json.code).toBe(119);

    const granted = await doGrant(user.id, 'member');
    expect(granted.status).toBe(200);
    expect(branch(granted).state).toBe('added');
    expect(branch(granted).roles).toEqual(['member']);

    // After — the SAME session token, no re-login. Roles resolve per request.
    const after = await req('POST', '/functions/memberonly', {}, asUser(user));
    expect(after.status).toBe(200);
    expect((after.json.result as { ok?: string }).ok).toBe('yes');

    // ...and the admin surface agrees about who is in the role, so the two
    // halves of the product are looking at one table.
    const listed = await req('GET', '/admin/roles', undefined, asAdmin());
    const member = (listed.json.roles as { name: string; users: string[] }[]).find((r) => r.name === 'member');
    expect(member?.users).toContain(user.id);
  });

  it('a membership reaches the ACL predicate too, not only the function rule', async () => {
    const reader = await signup('reader');
    const author = await signup('author');

    const doc = await req(
      'POST',
      '/classes/Doc',
      { title: 'members only', ACL: { 'role:member': { read: true, write: true } } },
      asUser(author)
    );
    expect(doc.status).toBe(201);
    const docId = doc.json.objectId as string;

    // Invisible: the row exists and the reader has no key for it.
    expect((await req('GET', `/classes/Doc/${docId}`, undefined, asUser(reader))).status).toBe(404);

    expect(branch(await doGrant(reader.id, 'member')).state).toBe('added');

    // Readable, on the same token. `principalKeys` picked the membership up.
    expect((await req('GET', `/classes/Doc/${docId}`, undefined, asUser(reader))).status).toBe(200);

    // And revocation closes it again — the half that makes this a permission
    // boundary rather than a one-way door.
    expect(branch(await doRevoke(reader.id, 'member')).state).toBe('removed');
    expect((await req('GET', `/classes/Doc/${docId}`, undefined, asUser(reader))).status).toBe(404);
  });

  // ==========================================================================
  // 2. Idempotence, both ways
  // ==========================================================================

  it('adding twice is Unchanged carrying the roles, not a failure', async () => {
    const user = await signup('twice');

    expect(branch(await doGrant(user.id, 'member')).state).toBe('added');

    const again = await doGrant(user.id, 'member');
    expect(again.status).toBe(200);
    expect(branch(again).state).toBe('already');
    // The Unchanged branch is as useful as Done: `Roles` is populated on it, so
    // "make sure this user is a member" is one wire.
    expect(branch(again).roles).toEqual(['member']);

    // One membership, not two.
    const listed = await req('GET', '/admin/roles', undefined, asAdmin());
    const member = (listed.json.roles as { name: string; users: string[] }[]).find((r) => r.name === 'member');
    expect(member?.users.filter((u) => u === user.id).length).toBe(1);
  });

  it('removing someone who is not a member, and removing from a role that does not exist, are both Unchanged', async () => {
    const user = await signup('never');

    const notMember = await doRevoke(user.id, 'member');
    expect(notMember.status).toBe(200);
    expect(branch(notMember).state).toBe('wasnt');
    expect(String(branch(notMember).error)).toContain('was not in the role');

    const noRole = await doRevoke(user.id, 'ghosts');
    expect(branch(noRole).state).toBe('wasnt');
    expect(String(branch(noRole).error)).toContain('There is no role named "ghosts"');

    // ⚠️ Reading a role that does not exist did not create it.
    const listed = await req('GET', '/admin/roles', undefined, asAdmin());
    expect((listed.json.roles as { name: string }[]).map((r) => r.name)).not.toContain('ghosts');
  });

  it('a de-provisioning job re-run does not go red', async () => {
    const user = await signup('lapsed');
    expect(branch(await doGrant(user.id, 'member')).state).toBe('added');
    expect(branch(await doRevoke(user.id, 'member')).state).toBe('removed');
    expect(branch(await doRevoke(user.id, 'member')).state).toBe('wasnt');

    // And the gate is shut again on the same token.
    expect((await req('POST', '/functions/memberonly', {}, asUser(user))).status).toBe(403);
  });

  // ==========================================================================
  // 3. Auto-create is opt-in
  // ==========================================================================

  it('an unknown role is a Failure naming it, and no role is created', async () => {
    const user = await signup('typo');

    const refused = await doGrant(user.id, 'membre');
    expect(refused.status).toBe(200);
    expect(branch(refused).state).toBe('refused');
    // The message is a fix, not a mystery: it names the role and says where a
    // real one is made.
    expect(String(branch(refused).error)).toContain('There is no role named "membre"');
    expect(String(branch(refused).error)).toContain('Permissions panel');
    expect(String(branch(refused).error)).toContain('Create Role If Missing');

    const listed = await req('GET', '/admin/roles', undefined, asAdmin());
    expect((listed.json.roles as { name: string }[]).map((r) => r.name)).not.toContain('membre');
  });

  it('ticking Create Role If Missing creates the role and says so', async () => {
    const user = await signup('fresh');

    const made = await doGrant(user.id, 'earlyadopter', true);
    expect(branch(made).state).toBe('added');
    expect(branch(made).created).toBe(true);
    expect(branch(made).roles).toEqual(['earlyadopter']);

    // Second user into the now-existing role: created is false, and the port is
    // therefore a fact about this call rather than about the role.
    const second = await signup('fresh2');
    const joined = await doGrant(second.id, 'earlyadopter', true);
    expect(branch(joined).state).toBe('added');
    expect(branch(joined).created).toBe(false);

    const listed = await req('GET', '/admin/roles', undefined, asAdmin());
    expect((listed.json.roles as { name: string }[]).map((r) => r.name)).toContain('earlyadopter');
  });

  it('refuses a role name that could not survive being written into a rule', async () => {
    const user = await signup('badname');
    // `role:a,b` in a rule is two rules. A name carrying `,` or `:` would mean
    // something other than it reads, so it is refused before anything is
    // written — including with Create Role If Missing on.
    for (const name of ['a,b', 'x:y', 'has space']) {
      const refused = await doGrant(user.id, name, true);
      expect(branch(refused).state).toBe('refused');
      expect(String(branch(refused).error)).toContain('not a usable role name');
    }
    const listed = await req('GET', '/admin/roles', undefined, asAdmin());
    expect((listed.json.roles as { name: string }[]).length).toBeLessThan(5);
  });

  // ==========================================================================
  // 4. It addresses a NAMED user, never the caller
  // ==========================================================================

  it('refuses a blank User Id rather than adding whoever called the function', async () => {
    const before = await doRead(caller.id);
    expect(branch(before).state).toBe('none');

    const blank = await req('POST', '/functions/grant', { role: 'member' }, asUser(caller));
    expect(branch(blank).state).toBe('refused');
    expect(String(branch(blank).error)).toContain('never falls back to the caller');

    // ⚠️ The half that makes this a refusal test: the caller gained nothing.
    expect(branch(await doRead(caller.id)).state).toBe('none');
    expect((await req('POST', '/functions/memberonly', {}, asUser(caller))).status).toBe(403);
  });

  it('refuses a user id nothing resolves, so a membership can never name a non-user', async () => {
    const refused = await doGrant('no-such-user-id', 'member');
    expect(branch(refused).state).toBe('refused');
    expect(String(branch(refused).error)).toContain('There is no user with the id');

    const listed = await req('GET', '/admin/roles', undefined, asAdmin());
    const member = (listed.json.roles as { name: string; users: string[] }[]).find((r) => r.name === 'member');
    expect(member?.users).not.toContain('no-such-user-id');
  });

  // ==========================================================================
  // 5. Get User Roles reads what enforcement reads
  // ==========================================================================

  it('reports the roles the access check itself would see, and takes the Unchanged branch for none', async () => {
    const user = await signup('reporter');

    const none = await doRead(user.id);
    expect(none.status).toBe(200);
    expect(branch(none).state).toBe('none');

    await doGrant(user.id, 'member');
    await doGrant(user.id, 'extra', true);

    const some = await doRead(user.id);
    expect(branch(some).state).toBe('some');
    expect((branch(some).roles as string[]).slice().sort()).toEqual(['extra', 'member']);

    // The claim that this is the resolver enforcement uses, checked rather than
    // asserted: what it reports is exactly what the rule decides on.
    expect((await req('POST', '/functions/memberonly', {}, asUser(user))).status).toBe(200);

    const missing = await req('POST', '/functions/roles', { target: 'nobody' }, asUser(caller));
    expect(branch(missing).state).toBe('refused');
    expect(String(branch(missing).error)).toContain('There is no user with the id');
  });

  // ==========================================================================
  // 6. ⚠️ The gate — the deny path, measured
  // ==========================================================================

  it('refuses a signed-in non-member AND writes no membership', async () => {
    const outsider = await signup('outsider');
    const victim = await signup('victim');

    await req('PUT', '/admin/permissions/functions/grant', { call: 'role:member' }, asAdmin());
    try {
      const denied = await req(
        'POST',
        '/functions/grant',
        { target: victim.id, role: 'member' },
        asUser(outsider)
      );
      expect(denied.status).toBe(403);
      expect(denied.json.code).toBe(119);

      // ⚠️ A 403 that arrived after the write would still be a breach.
      expect((await req('POST', '/functions/memberonly', {}, asUser(victim))).status).toBe(403);

      // Anonymous, obviously — even though the graph itself allows it.
      expect(
        (await req('POST', '/functions/grant', { target: victim.id, role: 'member' })).status
      ).toBe(403);
      expect((await req('POST', '/functions/memberonly', {}, asUser(victim))).status).toBe(403);

      // A member gets through, so the rule is a rule and not a wall. `caller`
      // is not in `member`, so grant it to a user who is.
      await req('POST', '/admin/roles/member/users', { userId: outsider.id }, asAdmin());
      const allowed = await req(
        'POST',
        '/functions/grant',
        { target: victim.id, role: 'member' },
        asUser(outsider)
      );
      expect(allowed.status).toBe(200);
      expect(branch(allowed).state).toBe('added');
    } finally {
      await req('DELETE', '/admin/permissions/functions/grant', undefined, asAdmin());
    }
  });

  // ==========================================================================
  // 7. The trail
  // ==========================================================================

  it('leaves an audit entry for every membership a graph wrote, under its own action name', async () => {
    const added = await req('GET', '/admin/audit?action=role.system.user.add&limit=200', undefined, asAdmin());
    expect(added.status).toBe(200);
    const entries = added.json.entries as { actorKind: string; actor: string; target: Record<string, unknown> }[];
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every((e) => e.actorKind === 'system' && e.actor === 'cloud-function')).toBe(true);
    expect(entries.some((e) => e.target.role === 'member')).toBe(true);

    const removed = await req('GET', '/admin/audit?action=role.system.user.remove&limit=200', undefined, asAdmin());
    expect((removed.json.entries as unknown[]).length).toBeGreaterThan(0);

    const created = await req('GET', '/admin/audit?action=role.system.create&limit=200', undefined, asAdmin());
    expect(
      (created.json.entries as { target: Record<string, unknown> }[]).some((e) => e.target.role === 'earlyadopter')
    ).toBe(true);

    // ⚠️ Its own name, not the admin surface's. `role.user.add` is an operator
    // clicking; `role.system.user.add` is a graph granting at whatever rate its
    // function is called, and an operator has to be able to filter them apart.
    const byOperator = await req('GET', '/admin/audit?action=role.user.add&limit=200', undefined, asAdmin());
    const operatorEntries = byOperator.json.entries as { actorKind: string }[];
    expect(operatorEntries.every((e) => e.actorKind !== 'system')).toBe(true);
  });

  // ==========================================================================
  // 8. ⚠️ SystemUsers' invariant #2, still true
  // ==========================================================================

  it('keeps role writes out of the module that creates accounts', () => {
    const systemUsers = fs.readFileSync(path.join(__dirname, '..', 'src', 'users', 'SystemUsers.ts'), 'utf8');
    const body = systemUsers.slice(systemUsers.indexOf('*/') + 2);

    // The property `cloud-system-users.test.ts` and that file's own header both
    // state. It is what makes "a node that can create a user" provably not "a
    // node that can create an admin", and this task is exactly the change that
    // would have deleted it.
    expect(body).not.toContain('addRelation');
    expect(body).not.toContain('_Role');
    expect(body).not.toContain('_Join_users__Role');

    // Two doors, named apart, so "what in this process can grant privilege?"
    // has one file as the answer.
    const service = fs.readFileSync(path.join(__dirname, '..', 'src', 'service.ts'), 'utf8');
    expect(service).toContain('_noodl_system_users');
    expect(service).toContain('_noodl_system_roles');
  });

  it('registers the three nodes for the cloud runtime only', () => {
    // ⚠️ Asserted against the registration itself rather than the generated
    // catalog, unlike CWF-015's equivalent: the catalog is regenerated once for
    // a whole sprint, so a catalog assertion here would be red for reasons that
    // have nothing to do with this code. The property that matters is which
    // list the `require` is in — `@noodl/runtime`'s shared list reaches every
    // runtime, and a browser Add User To Role is one wire from a button to
    // "make me staff".
    const cloudIndex = fs.readFileSync(
      path.join(__dirname, '..', '..', 'noodl-viewer-cloud', 'src', 'nodes', 'index.ts'),
      'utf8'
    );
    for (const file of ['addusertorole', 'removeuserfromrole', 'getuserroles']) {
      expect(cloudIndex).toContain(`require('./cloud/${file}')`);
    }

    const runtimePkg = path.join(__dirname, '..', '..', 'noodl-runtime');
    // Listed in the picker — otherwise the nodes exist and nobody can find
    // them, which is the same gap as not shipping them.
    const picker = fs.readFileSync(path.join(runtimePkg, 'src', 'nodelibraryexport.ts'), 'utf8');
    for (const typeName of [
      'noodl.cloud.addusertorole',
      'noodl.cloud.removeuserfromrole',
      'noodl.cloud.getuserroles'
    ]) {
      expect(picker).toContain(`'${typeName}'`);
    }

    // ...and NOT in the shared registration list, which reaches every runtime.
    const sharedList = fs.readFileSync(path.join(runtimePkg, 'noodl-runtime.ts'), 'utf8');
    for (const file of ['addusertorole', 'removeuserfromrole', 'getuserroles']) {
      expect(sharedList).not.toContain(file);
    }
  });
});
