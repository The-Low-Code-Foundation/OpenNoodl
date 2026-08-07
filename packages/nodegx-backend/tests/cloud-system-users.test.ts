/**
 * CWF-015 — a cloud function creates and administers users, as the system.
 *
 * Driven end to end through `POST /functions/:name` against a real service with
 * enforcement ON (`devOpen: false`), because every claim this task makes is
 * about a DECISION — who may call the function, what the function may write,
 * whose session survives — and a decision asserted against the object it was
 * built from proves only that JSON round-trips.
 *
 * ## What this suite exists to hold
 *
 *  1. **The round trip, not the 201.** A function creates a user, and that user
 *     then logs in through `POST /login` — the same route a browser app uses.
 *  2. **A duplicate takes the "already exists" branch**, which is `Unchanged`
 *     carrying the existing id, and NOT the generic failure.
 *  3. **The caller's own session is provably untouched.** The function reads its
 *     caller back after creating somebody else, and the caller's token still
 *     works afterwards.
 *  4. **The deny path.** ⚠️ CWF-015's own warning is that this ships with
 *     CWF-017 or it ships a privilege escalation, and an access-control claim
 *     with no deny test is an unchecked claim. A signed-in non-member is refused
 *     AND no account appears — the 403 and the absence, because a 403 after the
 *     write would still be a breach.
 *  5. **The escalation the author must close.** The last case here deliberately
 *     proves that a function with no rule and `Allow Unauthenticated` ticked
 *     lets an ANONYMOUS caller create an account. That is the default this
 *     build already had (CWF-017 changed no default); pinning it in a test is
 *     what makes "you must set a rule" a checked statement rather than prose.
 *  6. **Privilege cannot be smuggled in.** `ACL` in a property bag is refused by
 *     name, and a created user resolves to no roles at all.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { BackendService } from '../src/service';

jest.setTimeout(40000);

/** Enforcement on. Same shape as CWF-017's own suite, which is the point. */
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

/**
 * `provision` — the shape a real signup-side function has.
 *
 * Three branches off one Create User, which is the whole reason `Unchanged`
 * exists on it: created / already there / could not.
 */
const provision = (name: string, allowNoAuth: boolean) => ({
  name: `/#__cloud__/${name}`,
  nodes: [
    requestNode('req', allowNoAuth, 'username,password,plan'),
    {
      id: 'cu',
      type: 'noodl.cloud.createuser',
      x: 0,
      y: 200,
      parameters: { properties: 'plan' },
      ports: [],
      children: []
    },
    responseNode('resOk', 'userId,callerId'),
    responseNode('resDup', 'existingId,duplicate', { 'pm-duplicate': 'yes' }),
    responseNode('resErr', 'error')
  ],
  connections: [
    { sourceId: 'req', sourcePort: 'pm-username', targetId: 'cu', targetPort: 'username' },
    { sourceId: 'req', sourcePort: 'pm-password', targetId: 'cu', targetPort: 'password' },
    { sourceId: 'req', sourcePort: 'pm-plan', targetId: 'cu', targetPort: 'prop-plan' },
    { sourceId: 'req', sourcePort: 'receive', targetId: 'cu', targetPort: 'create' },

    { sourceId: 'cu', sourcePort: 'userId', targetId: 'resOk', targetPort: 'pm-userId' },
    // ⚠️ The criterion "the caller's own session is provably untouched": this is
    // the Request node's resolved caller, read at Response time — i.e. AFTER
    // Create User has run. If creating a user rewrote the request's identity,
    // this is the port that would say so.
    { sourceId: 'req', sourcePort: 'userId', targetId: 'resOk', targetPort: 'pm-callerId' },
    { sourceId: 'cu', sourcePort: 'done', targetId: 'resOk', targetPort: 'send' },

    { sourceId: 'cu', sourcePort: 'userId', targetId: 'resDup', targetPort: 'pm-existingId' },
    { sourceId: 'cu', sourcePort: 'unchanged', targetId: 'resDup', targetPort: 'send' },

    { sourceId: 'cu', sourcePort: 'error', targetId: 'resErr', targetPort: 'pm-error' },
    { sourceId: 'cu', sourcePort: 'failure', targetId: 'resErr', targetPort: 'send' }
  ],
  roots: []
});

/** A Create User whose only writable property is `ACL` — the escalation attempt. */
const escalate = {
  name: '/#__cloud__/escalate',
  nodes: [
    requestNode('req', true, 'username,acl'),
    {
      id: 'cu',
      type: 'noodl.cloud.createuser',
      x: 0,
      y: 200,
      parameters: { properties: 'ACL' },
      ports: [],
      children: []
    },
    responseNode('resOk', 'userId'),
    responseNode('resErr', 'error')
  ],
  connections: [
    { sourceId: 'req', sourcePort: 'pm-username', targetId: 'cu', targetPort: 'username' },
    { sourceId: 'req', sourcePort: 'pm-acl', targetId: 'cu', targetPort: 'prop-ACL' },
    { sourceId: 'req', sourcePort: 'receive', targetId: 'cu', targetPort: 'create' },
    { sourceId: 'cu', sourcePort: 'userId', targetId: 'resOk', targetPort: 'pm-userId' },
    { sourceId: 'cu', sourcePort: 'done', targetId: 'resOk', targetPort: 'send' },
    { sourceId: 'cu', sourcePort: 'error', targetId: 'resErr', targetPort: 'pm-error' },
    { sourceId: 'cu', sourcePort: 'failure', targetId: 'resErr', targetPort: 'send' }
  ],
  roots: []
};

/** `moderate` — Update User by explicit id, with an optional password reset. */
const moderate = {
  name: '/#__cloud__/moderate',
  nodes: [
    requestNode('req', true, 'target,newPassword,plan'),
    {
      id: 'uu',
      type: 'noodl.cloud.updateuser',
      x: 0,
      y: 200,
      parameters: { properties: 'plan' },
      ports: [],
      children: []
    },
    responseNode('resOk', 'revoked'),
    responseNode('resErr', 'error')
  ],
  connections: [
    { sourceId: 'req', sourcePort: 'pm-target', targetId: 'uu', targetPort: 'userId' },
    { sourceId: 'req', sourcePort: 'pm-newPassword', targetId: 'uu', targetPort: 'password' },
    { sourceId: 'req', sourcePort: 'pm-plan', targetId: 'uu', targetPort: 'prop-plan' },
    { sourceId: 'req', sourcePort: 'receive', targetId: 'uu', targetPort: 'store' },
    { sourceId: 'uu', sourcePort: 'sessionsRevoked', targetId: 'resOk', targetPort: 'pm-revoked' },
    { sourceId: 'uu', sourcePort: 'done', targetId: 'resOk', targetPort: 'send' },
    { sourceId: 'uu', sourcePort: 'error', targetId: 'resErr', targetPort: 'pm-error' },
    { sourceId: 'uu', sourcePort: 'failure', targetId: 'resErr', targetPort: 'send' }
  ],
  roots: []
};

/** `remove` — Delete User, with the `Unchanged` branch wired separately. */
const remove = {
  name: '/#__cloud__/remove',
  nodes: [
    requestNode('req', true, 'target'),
    { id: 'du', type: 'noodl.cloud.deleteuser', x: 0, y: 200, parameters: {}, ports: [], children: [] },
    responseNode('resOk', 'revoked,state', { 'pm-state': 'deleted' }),
    responseNode('resGone', 'state', { 'pm-state': 'absent' }),
    responseNode('resErr', 'error')
  ],
  connections: [
    { sourceId: 'req', sourcePort: 'pm-target', targetId: 'du', targetPort: 'userId' },
    { sourceId: 'req', sourcePort: 'receive', targetId: 'du', targetPort: 'remove' },
    { sourceId: 'du', sourcePort: 'sessionsRevoked', targetId: 'resOk', targetPort: 'pm-revoked' },
    { sourceId: 'du', sourcePort: 'done', targetId: 'resOk', targetPort: 'send' },
    { sourceId: 'du', sourcePort: 'unchanged', targetId: 'resGone', targetPort: 'send' },
    { sourceId: 'du', sourcePort: 'error', targetId: 'resErr', targetPort: 'pm-error' },
    { sourceId: 'du', sourcePort: 'failure', targetId: 'resErr', targetPort: 'send' }
  ],
  roots: []
};

/** `checktoken` — Verify Session Token on a token that arrived in the body. */
const checktoken = {
  name: '/#__cloud__/checktoken',
  nodes: [
    requestNode('req', true, 'token'),
    { id: 'vt', type: 'noodl.cloud.verifysessiontoken', x: 0, y: 200, parameters: {}, ports: [], children: [] },
    responseNode('resValid', 'valid,userId,username', { 'pm-valid': 'yes' }),
    responseNode('resInvalid', 'valid', { 'pm-valid': 'no' }),
    responseNode('resErr', 'error')
  ],
  connections: [
    { sourceId: 'req', sourcePort: 'pm-token', targetId: 'vt', targetPort: 'token' },
    { sourceId: 'req', sourcePort: 'receive', targetId: 'vt', targetPort: 'verify' },
    { sourceId: 'vt', sourcePort: 'userId', targetId: 'resValid', targetPort: 'pm-userId' },
    { sourceId: 'vt', sourcePort: 'username', targetId: 'resValid', targetPort: 'pm-username' },
    { sourceId: 'vt', sourcePort: 'done', targetId: 'resValid', targetPort: 'send' },
    { sourceId: 'vt', sourcePort: 'unchanged', targetId: 'resInvalid', targetPort: 'send' },
    { sourceId: 'vt', sourcePort: 'error', targetId: 'resErr', targetPort: 'pm-error' },
    { sourceId: 'vt', sourcePort: 'failure', targetId: 'resErr', targetPort: 'send' }
  ],
  roots: []
};

const WORKFLOW = {
  components: [
    // `provision` refuses anonymous in its graph; `openprovision` does not, and
    // that pair is what makes the default posture testable at all.
    provision('provision', false),
    provision('openprovision', true),
    escalate,
    moderate,
    remove,
    checktoken
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
  result?: Record<string, unknown>;
}

describe('CWF-015 system-side users in a cloud function', () => {
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

  async function signup(username: string): Promise<{ id: string; token: string }> {
    const { status, json } = await req('POST', '/users', { username, password: `pw-${username}` });
    expect(status).toBe(201);
    if (!json.sessionToken || !json.objectId) throw new Error(`signup of ${username} returned no session`);
    return { id: json.objectId, token: json.sessionToken };
  }

  /** Can this username log in with this password? The browser's own route. */
  async function login(username: string, password: string): Promise<{ status: number; json: Body }> {
    return req('POST', '/login', { username, password });
  }

  beforeAll(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-cwf015-'));
    fs.writeFileSync(path.join(dataDir, 'security.json'), JSON.stringify(LOCKED_CONFIG));
    fs.mkdirSync(path.join(dataDir, 'workflows'), { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'workflows', 'main.workflow.json'), JSON.stringify(WORKFLOW));

    service = new BackendService({ dataDir, port: 0, backendId: 'cwf015', backendName: 'CWF-015 Test' });
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
  // 1. The round trip
  // ==========================================================================

  it('creates a user that can then log in through the ordinary login route', async () => {
    const call = await req(
      'POST',
      '/functions/provision',
      { username: 'carol', password: 'carol-secret', plan: 'pro' },
      asUser(alice)
    );
    expect(call.status).toBe(200);
    const result = call.json.result as { userId?: string; callerId?: string };
    expect(typeof result.userId).toBe('string');
    expect(result.userId).not.toBe(alice.id);

    // The round trip the task asked for: not a 201, but an account a browser
    // app can actually sign in to.
    const signedIn = await login('carol', 'carol-secret');
    expect(signedIn.status).toBe(200);
    expect(signedIn.json.objectId).toBe(result.userId);
    expect(typeof signedIn.json.sessionToken).toBe('string');
    // The arbitrary property went in with it.
    expect(signedIn.json.plan).toBe('pro');

    // Nothing echoed the password back, on either hop.
    expect(call.text).not.toContain('carol-secret');
    expect(signedIn.json._hashed_password).toBeUndefined();
  });

  it('a password nobody supplied means no password at all, not a blank one', async () => {
    const call = await req('POST', '/functions/provision', { username: 'invitee' }, asUser(alice));
    expect(call.status).toBe(200);
    expect(typeof (call.json.result as { userId?: string }).userId).toBe('string');

    // An invite/passwordless account (BAK-004). No hash was written, so no
    // password can match — including the empty one, which is the failure mode
    // a "" default would have produced.
    expect((await login('invitee', '')).status).toBe(400);
    expect((await login('invitee', 'anything')).status).toBe(404);
  });

  // ==========================================================================
  // 2. The "already exists" branch
  // ==========================================================================

  it('a duplicate takes the Unchanged branch carrying the existing id, not the generic failure', async () => {
    const first = await req(
      'POST',
      '/functions/provision',
      { username: 'dave', password: 'dave-secret' },
      asUser(alice)
    );
    const created = (first.json.result as { userId?: string }).userId;
    expect(typeof created).toBe('string');

    const again = await req(
      'POST',
      '/functions/provision',
      { username: 'dave', password: 'a-different-one' },
      asUser(alice)
    );
    expect(again.status).toBe(200);
    const result = again.json.result as { duplicate?: string; existingId?: string; error?: string };
    // The specific branch, and it carries the EXISTING id so a provisioning
    // function is idempotent in one wire.
    expect(result.duplicate).toBe('yes');
    expect(result.existingId).toBe(created);
    // And emphatically not the generic failure branch.
    expect(result.error).toBeUndefined();

    // The second call did not rewrite the password of the account that was
    // already there — an "upsert" would have been a silent account takeover.
    expect((await login('dave', 'dave-secret')).status).toBe(200);
    expect((await login('dave', 'a-different-one')).status).toBe(404);
  });

  // ==========================================================================
  // 3. The caller's session
  // ==========================================================================

  it('leaves the calling session completely alone', async () => {
    const call = await req(
      'POST',
      '/functions/provision',
      { username: 'erin', password: 'erin-secret' },
      asUser(alice)
    );
    const result = call.json.result as { userId?: string; callerId?: string };

    // Read INSIDE the function, after Create User ran: the request still knows
    // who called it.
    expect(result.callerId).toBe(alice.id);
    expect(result.userId).not.toBe(alice.id);

    // ...and outside it, alice's token is still alice's token.
    const me = await req('GET', '/users/me', undefined, asUser(alice));
    expect(me.status).toBe(200);
    expect(me.json.objectId).toBe(alice.id);
    expect(me.json.username).toBe('alice');
  });

  // ==========================================================================
  // 4. Update and delete address a NAMED user, never the caller
  // ==========================================================================

  it('updates the user it is given and refuses a blank id rather than falling back to the caller', async () => {
    const created = await req(
      'POST',
      '/functions/provision',
      { username: 'frank', password: 'frank-secret' },
      asUser(alice)
    );
    const frankId = (created.json.result as { userId?: string }).userId as string;

    const update = await req('POST', '/functions/moderate', { target: frankId, plan: 'suspended' }, asUser(alice));
    expect(update.status).toBe(200);
    expect((update.json.result as { revoked?: number }).revoked).toBe(0);

    const frank = await login('frank', 'frank-secret');
    expect(frank.json.plan).toBe('suspended');
    // The caller was not the target and was not touched.
    expect((await req('GET', '/users/me', undefined, asUser(alice))).json.username).toBe('alice');

    // A blank id is a Failure with a sentence, never a write to whoever called.
    const blank = await req('POST', '/functions/moderate', { plan: 'nope' }, asUser(alice));
    expect((blank.json.result as { error?: string }).error).toContain('never falls back to the caller');
    // `plan` is a real `_User` column by now (frank has one), so alice's row
    // answers `null` rather than absent — the assertion that matters is that
    // the refused write did not land on her.
    expect((await req('GET', '/users/me', undefined, asUser(alice))).json.plan).toBeFalsy();
  });

  it('a system password reset revokes every session that user held', async () => {
    const created = await req(
      'POST',
      '/functions/provision',
      { username: 'gina', password: 'gina-secret' },
      asUser(alice)
    );
    const ginaId = (created.json.result as { userId?: string }).userId as string;

    // Two live sessions for gina.
    const s1 = (await login('gina', 'gina-secret')).json.sessionToken as string;
    const s2 = (await login('gina', 'gina-secret')).json.sessionToken as string;
    expect((await req('GET', '/users/me', undefined, { 'x-parse-session-token': s1 })).status).toBe(200);

    const reset = await req(
      'POST',
      '/functions/moderate',
      { target: ginaId, newPassword: 'reset-by-an-admin' },
      asUser(alice)
    );
    expect(reset.status).toBe(200);
    expect((reset.json.result as { revoked?: number }).revoked).toBe(2);

    // ⚠️ Both, not "all but one". There is no session that authorized this, so
    // there is no survivor to choose.
    expect((await req('GET', '/users/me', undefined, { 'x-parse-session-token': s1 })).status).toBe(400);
    expect((await req('GET', '/users/me', undefined, { 'x-parse-session-token': s2 })).status).toBe(400);
    expect((await login('gina', 'reset-by-an-admin')).status).toBe(200);
  });

  it('deletes a user and its sessions, and reports Unchanged for one that is already gone', async () => {
    const created = await req(
      'POST',
      '/functions/provision',
      { username: 'hank', password: 'hank-secret' },
      asUser(alice)
    );
    const hankId = (created.json.result as { userId?: string }).userId as string;
    const hankToken = (await login('hank', 'hank-secret')).json.sessionToken as string;

    const gone = await req('POST', '/functions/remove', { target: hankId }, asUser(alice));
    expect(gone.status).toBe(200);
    expect((gone.json.result as { state?: string; revoked?: number }).state).toBe('deleted');
    expect((gone.json.result as { revoked?: number }).revoked).toBe(1);

    // The session went with the account rather than becoming an orphan token.
    expect((await req('GET', '/users/me', undefined, { 'x-parse-session-token': hankToken })).status).toBe(400);
    expect((await login('hank', 'hank-secret')).status).toBe(404);

    // Deleting it again is the goal already met, not a failure — a moderation
    // job re-run must not go red on its second pass.
    const again = await req('POST', '/functions/remove', { target: hankId }, asUser(alice));
    expect((again.json.result as { state?: string }).state).toBe('absent');
  });

  // ==========================================================================
  // 5. Verify Session Token
  // ==========================================================================

  it('verifies a session token that arrived in the body, and refuses everything that is not one', async () => {
    const valid = await req('POST', '/functions/checktoken', { token: bob.token }, asUser(alice));
    expect(valid.status).toBe(200);
    const result = valid.json.result as { valid?: string; userId?: string; username?: string };
    expect(result.valid).toBe('yes');
    expect(result.userId).toBe(bob.id);
    expect(result.username).toBe('bob');

    // Not a session: a made-up token, the admin credential, and a token whose
    // user has been deleted. None of the three may answer "valid".
    for (const token of ['r:not-a-real-token', adminToken]) {
      const answer = await req('POST', '/functions/checktoken', { token }, asUser(alice));
      expect((answer.json.result as { valid?: string }).valid).toBe('no');
    }

    // Blank is a Failure — the check could not be made, which is different from
    // the check answering no.
    const blank = await req('POST', '/functions/checktoken', {}, asUser(alice));
    expect((blank.json.result as { error?: string }).error).toContain('a Token is required');
  });

  it('sees a token die the moment its session is revoked', async () => {
    const created = await req(
      'POST',
      '/functions/provision',
      { username: 'iris', password: 'iris-secret' },
      asUser(alice)
    );
    const irisId = (created.json.result as { userId?: string }).userId as string;
    const irisToken = (await login('iris', 'iris-secret')).json.sessionToken as string;

    expect(
      ((await req('POST', '/functions/checktoken', { token: irisToken }, asUser(alice))).json.result as {
        valid?: string;
      }).valid
    ).toBe('yes');

    await req('POST', '/functions/remove', { target: irisId }, asUser(alice));

    expect(
      ((await req('POST', '/functions/checktoken', { token: irisToken }, asUser(alice))).json.result as {
        valid?: string;
      }).valid
    ).toBe('no');
  });

  // ==========================================================================
  // 6. Privilege cannot be smuggled in
  // ==========================================================================

  it('refuses ACL by name rather than dropping it silently', async () => {
    const call = await req(
      'POST',
      '/functions/escalate',
      { username: 'mallory', acl: { '*': { read: true, write: true } } },
      asUser(alice)
    );
    expect(call.status).toBe(200);
    const result = call.json.result as { error?: string; userId?: string };
    expect(result.userId).toBeUndefined();
    // The message names the key. `POST /users` deletes ACL silently; a
    // system-privileged node has to be louder than that.
    expect(result.error).toContain('"ACL" cannot be set from a graph');
    expect(result.error).toContain('row-level access');

    // ...and no account was created on the refused path.
    expect((await login('mallory', 'anything')).status).toBe(404);
  });

  it('gives a created user no role, so every role rule denies it', async () => {
    expect((await req('POST', '/admin/roles', { name: 'staff' }, asAdmin())).status).toBe(201);
    await req('PUT', '/admin/permissions/functions/openprovision', { call: 'role:staff' }, asAdmin());

    const created = await req(
      'POST',
      '/functions/provision',
      { username: 'jules', password: 'jules-secret' },
      asUser(alice)
    );
    expect(created.status).toBe(200);
    const julesToken = (await login('jules', 'jules-secret')).json.sessionToken as string;

    // The account exists and can sign in — and holds no role, so a role-gated
    // function refuses it. There is no column a graph could have set to change
    // this: privilege lives in `_Role`, which nothing in this family writes.
    const denied = await req('POST', '/functions/openprovision', { username: 'x' }, {
      'x-parse-session-token': julesToken
    });
    expect(denied.status).toBe(403);
    expect(denied.json.code).toBe(119);

    await req('DELETE', '/admin/permissions/functions/openprovision', undefined, asAdmin());
  });

  // ==========================================================================
  // 7. ⚠️ The gate — CWF-017 applied, and the deny path measured
  // ==========================================================================

  it('refuses a signed-in non-member AND creates nothing', async () => {
    await req('PUT', '/admin/permissions/functions/provision', { call: 'role:staff' }, asAdmin());

    const denied = await req(
      'POST',
      '/functions/provision',
      { username: 'sneaky', password: 'sneaky-secret' },
      asUser(bob)
    );
    expect(denied.status).toBe(403);
    expect(denied.json.code).toBe(119);

    // ⚠️ The half that makes this a deny test rather than a status-code test: a
    // 403 that arrives after the write would still be a breach.
    expect((await login('sneaky', 'sneaky-secret')).status).toBe(404);

    // Anonymous, obviously.
    expect((await req('POST', '/functions/provision', { username: 'sneaky2', password: 'p' })).status).toBe(403);
    expect((await login('sneaky2', 'p')).status).toBe(404);

    // A member gets through, so the rule is a rule and not a wall.
    expect((await req('POST', '/admin/roles/staff/users', { userId: alice.id }, asAdmin())).status).toBe(200);
    const allowed = await req(
      'POST',
      '/functions/provision',
      { username: 'kate', password: 'kate-secret' },
      asUser(alice)
    );
    expect(allowed.status).toBe(200);
    expect((await login('kate', 'kate-secret')).status).toBe(200);
  });

  /**
   * ⚠️ **`nobody` is TWO gates, and the second one is in the graph.**
   *
   * The admin credential bypasses function rules exactly as it bypasses CLPs
   * (`checkFunctionCall`, source `'credential'`) — so `nobody` is usually read
   * as "only the backend's own operator". That reading is incomplete: an admin
   * bearer token is not a *session* token, so a call that gets past the rule
   * then meets the Request node's own `Allow Unauthenticated` check inside the
   * graph and is refused there. On a function with that port unticked — the
   * default, and the right setting for a user-administration function — `nobody`
   * is closed to literally everyone including the operator.
   *
   * This is the mirror image of the contradiction CWF-017's panel already names
   * (a `public` rule in front of an unticked graph). Worth knowing before an
   * operator concludes their admin token is broken.
   */
  it('under "nobody" the rule refuses users, and the graph refuses even the admin credential', async () => {
    await req('PUT', '/admin/permissions/functions/provision', { call: 'nobody' }, asAdmin());

    const asAlice = await req('POST', '/functions/provision', { username: 'n1', password: 'p' }, asUser(alice));
    expect(asAlice.status).toBe(403);
    expect(asAlice.json.code).toBe(119);
    expect((await login('n1', 'p')).status).toBe(404);

    // Past the rule, refused by the graph: `provision`'s Request node does not
    // allow unauthenticated calls, and an admin token is not a session.
    const asOperator = await req('POST', '/functions/provision', { username: 'n2', password: 'p' }, asAdmin());
    expect(asOperator.status).not.toBe(200);
    expect(asOperator.text).toContain('Unauthenticated');
    expect((await login('n2', 'p')).status).toBe(404);

    // The bypass itself is real, and `openprovision` — same nodes, Allow
    // Unauthenticated ticked — is where it shows.
    await req('PUT', '/admin/permissions/functions/openprovision', { call: 'nobody' }, asAdmin());
    expect((await req('POST', '/functions/openprovision', { username: 'n3', password: 'p' }, asUser(alice))).status).toBe(
      403
    );
    expect((await req('POST', '/functions/openprovision', { username: 'n3', password: 'p' }, asAdmin())).status).toBe(
      200
    );
    expect((await login('n3', 'p')).status).toBe(200);

    await req('DELETE', '/admin/permissions/functions/provision', undefined, asAdmin());
    await req('DELETE', '/admin/permissions/functions/openprovision', undefined, asAdmin());
  });

  /**
   * ⚠️ The escalation an author has to close, pinned as a fact.
   *
   * With no `call` rule, the effective rule comes from the graph's `Allow
   * Unauthenticated` port (`effectiveFunctionRule`, source `'graph'`). Ticked
   * means `public`, and `public` on a function holding Create User means the
   * open internet can create accounts on this backend. CWF-017 changed no
   * default and this build does not either; the fix is a rule, and this test is
   * what stops the sentence "you must set one" from being unverified prose.
   */
  it('with NO rule and Allow Unauthenticated ticked, an anonymous caller creates an account', async () => {
    const rows = await req('GET', '/admin/permissions/functions', undefined, asAdmin());
    const openRow = (rows.json.functions as { name: string; call: string; source: string }[]).find(
      (r) => r.name === 'openprovision'
    );
    expect(openRow?.source).toBe('graph');
    expect(openRow?.call).toBe('public');

    const anon = await req('POST', '/functions/openprovision', { username: 'anybody', password: 'anybody-secret' });
    expect(anon.status).toBe(200);
    expect((await login('anybody', 'anybody-secret')).status).toBe(200);

    // The same function, with a rule, refuses the same caller. One line of
    // configuration is the whole difference.
    await req('PUT', '/admin/permissions/functions/openprovision', { call: 'nobody' }, asAdmin());
    expect((await req('POST', '/functions/openprovision', { username: 'nobody2', password: 'p' })).status).toBe(403);
    expect((await login('nobody2', 'p')).status).toBe(404);
  });

  // ==========================================================================
  // 8. The trail, and the shape of the registration
  // ==========================================================================

  it('leaves an audit entry for every account a graph created, and no credential in it', async () => {
    const audit = await req('GET', '/admin/audit?action=user.system.create&limit=100', undefined, asAdmin());
    expect(audit.status).toBe(200);
    const entries = audit.json.entries as { actorKind: string; actor: string; target: Record<string, unknown> }[];
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every((e) => e.actorKind === 'system' && e.actor === 'cloud-function')).toBe(true);
    expect(entries.some((e) => e.target.username === 'carol')).toBe(true);
    // Keys, never values. No password of any account created above may appear.
    expect(audit.text).not.toContain('carol-secret');
    expect(audit.text).not.toContain('reset-by-an-admin');
  });

  it('registers all four nodes for the cloud runtime only', () => {
    const catalog = JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', '..', 'noodl-types', 'src', 'node-catalog.json'), 'utf8')
    ) as { nodes: { typeName: string; availableIn: string[] }[] };

    for (const typeName of [
      'noodl.cloud.createuser',
      'noodl.cloud.updateuser',
      'noodl.cloud.deleteuser',
      'noodl.cloud.verifysessiontoken'
    ]) {
      const entry = catalog.nodes.find((n) => n.typeName === typeName);
      expect(`${typeName}: ${JSON.stringify(entry?.availableIn)}`).toBe(`${typeName}: ["cloud"]`);
    }
  });
});
