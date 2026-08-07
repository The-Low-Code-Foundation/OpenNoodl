/**
 * `Users.impersonate()` must mint a session THIS backend can resolve.
 *
 * CWF-015's expiry fix (`edb8661b`) taught `findSession` to read `expiresAt`
 * and left the other half of the same row open: `impersonate()` wrote the
 * user as a Parse-style `user` **pointer**, and every reader in this service —
 * `UserRoutes.requireUser`, `SystemUsers.verifyToken`, the identity-revocation
 * sweep, the email-driven sweep — reads a flat `userId` string. So the token
 * came back, the row was found by `sessionToken`, and then resolving it to a
 * user answered 209. Impersonation had never worked against this backend at
 * all.
 *
 * Driven end to end through `POST /functions/:name` because the whole defect
 * lives in the seam between two packages: the graph API in
 * `noodl-viewer-cloud` writes the row, the service in `nodegx-backend` reads
 * it, and either one asserted alone proves nothing about the pair. The
 * function here calls `Noodl.Users.impersonate(...)`, which itself finishes by
 * fetching `/users/me` with the minted token — so a green run IS the round
 * trip, not a claim about one.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { BackendService } from '../src/service';

import { ParseRecord, httpClient } from './helpers/http';

jest.setTimeout(40000);

/**
 * Request → Function → Response.
 *
 * The Function calls `Noodl.Users.impersonate(username)` and answers with the
 * impersonated user's own username, which it can only know by having fetched
 * `/users/me` with the session it just minted.
 */
const impersonateFunction = {
  name: '/#__cloud__/impersonate',
  nodes: [
    {
      id: 'req',
      type: 'noodl.cloud.request',
      x: 0,
      y: 0,
      parameters: { allowNoAuth: true, params: 'username' },
      ports: [],
      children: []
    },
    {
      id: 'js',
      type: 'JavaScriptFunction',
      x: 0,
      y: 100,
      parameters: {
        functionScript: [
          'const user = await Noodl.Users.impersonate(Inputs.username);',
          "Outputs.resolved = user && user.get ? user.get('username') : '';"
        ].join('\n')
      },
      ports: [],
      children: []
    },
    {
      id: 'res',
      type: 'noodl.cloud.response',
      x: 0,
      y: 200,
      parameters: { params: 'resolved' },
      ports: [],
      children: []
    },
    {
      id: 'resErr',
      type: 'noodl.cloud.response',
      x: 0,
      y: 300,
      // A 200 carrying the diagnostic: this spec wants to READ the failure, and
      // a `status: failure` response would hide the message the defect produces.
      parameters: { params: 'error' },
      ports: [],
      children: []
    }
  ],
  connections: [
    { sourceId: 'req', sourcePort: 'pm-username', targetId: 'js', targetPort: 'in-username' },
    { sourceId: 'req', sourcePort: 'receive', targetId: 'js', targetPort: 'run' },
    { sourceId: 'js', sourcePort: 'out-resolved', targetId: 'res', targetPort: 'pm-resolved' },
    { sourceId: 'js', sourcePort: 'success', targetId: 'res', targetPort: 'send' },
    // Wired, because an unwired failure path is a 40s hang instead of a verdict.
    { sourceId: 'js', sourcePort: 'error', targetId: 'resErr', targetPort: 'pm-error' },
    { sourceId: 'js', sourcePort: 'failure', targetId: 'resErr', targetPort: 'send' }
  ],
  roots: []
};

describe('Users.impersonate() mints a session this backend can resolve', () => {
  let dataDir: string;
  let service: BackendService;
  let base: string;
  const admin = { authorization: 'Bearer admin-token' };

  const http = httpClient(() => base);

  const callImpersonate = (username: string) =>
    http.request<{ result: { resolved?: string; error?: string } }>('POST', '/functions/impersonate', {
      body: { username }
    });

  /**
   * Every `_Session` row that names this user, by EITHER spelling — the flat
   * `userId` this backend reads, or the `user` pointer `impersonate()` used to
   * write. Both, so a row that went missing shows up as a row in the wrong
   * shape rather than as an absence.
   */
  const sessionsFor = async (userId: string) => {
    const res = await http.get<{ results: ParseRecord[] }>('/api/_Session', admin);
    return res.json.results.filter((row) => {
      const flat = (row as Record<string, unknown>).userId;
      const pointer = (row as Record<string, unknown>).user as { objectId?: string } | string | undefined;
      const fromPointer = typeof pointer === 'string' ? pointer : pointer && pointer.objectId;
      return flat === userId || fromPointer === userId;
    });
  };

  /**
   * ...narrowed to the ones `impersonate()` minted. `POST /users` and
   * `POST /login` write a session too, and theirs carries no `expiresAt` —
   * which is the only thing that tells the two apart on the wire.
   */
  const impersonationSessionsFor = async (userId: string) =>
    (await sessionsFor(userId)).filter((row) => Boolean((row as Record<string, unknown>).expiresAt));

  beforeAll(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-impersonate-'));
    fs.mkdirSync(path.join(dataDir, 'workflows'), { recursive: true });
    fs.writeFileSync(
      path.join(dataDir, 'workflows', 'impersonate.workflow.json'),
      JSON.stringify({ components: [impersonateFunction], settings: {}, metadata: {} })
    );
    service = new BackendService({
      dataDir,
      port: 0,
      backendId: 'impersonate',
      backendName: 'Impersonate',
      authToken: 'admin-token'
    });
    base = (await service.start()).listen.url;
  });

  afterAll(async () => {
    await service.stop();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('resolves the impersonated user through /users/me', async () => {
    const signup = await http.post<{ objectId: string }>('/users', {
      username: 'impersonated',
      password: 'correct-horse',
      email: 'impersonated@example.com'
    });
    expect(signup.status).toBe(201);

    const res = await callImpersonate('impersonated');
    expect(res.json.result.error).toBeUndefined();
    expect(res.json.result.resolved).toBe('impersonated');

    // The row itself: `userId`, flat, which is the only spelling any reader in
    // this service knows.
    const rows = await impersonationSessionsFor(signup.json.objectId);
    expect(rows.length).toBe(1);
    expect((rows[0] as Record<string, unknown>).userId).toBe(signup.json.objectId);
    // And not the shape it used to be written in.
    expect((rows[0] as Record<string, unknown>).user).toBeUndefined();
  });

  /**
   * The question the `expiresAt` fix had to answer the other way round.
   *
   * There, absent had to mean "never expires", because every session ever
   * minted lacked the column. Here the answer is the opposite and it is
   * measured, not assumed: a `user`-pointer row has never resolved on this
   * backend, so there is nothing in the wild to keep working, and the new code
   * deliberately does not look for one.
   */
  it('does not resolve — or reuse — a legacy user-pointer row', async () => {
    const users = await http.get<{ results: ParseRecord[] }>(
      '/api/_User?where=' + encodeURIComponent(JSON.stringify({ username: 'impersonated' })),
      admin
    );
    const userId = users.json.results[0].objectId as string;

    // Exactly what `impersonate()` used to write.
    const legacyToken = 'r:legacy-pointer-session';
    const written = await http.post<ParseRecord>(
      '/api/_Session',
      {
        sessionToken: legacyToken,
        user: { __type: 'Pointer', className: '_User', objectId: userId },
        expiresAt: { __type: 'Date', iso: new Date(Date.now() + 3600_000).toISOString() }
      },
      admin
    );
    expect(written.status).toBeLessThan(300);

    // Found by token, and then unresolvable: no `userId` for `requireUser`.
    const me = await http.get<{ code?: number }>('/users/me', { 'x-parse-session-token': legacyToken });
    expect(me.status).toBe(400);
    expect(me.json.code).toBe(209);

    // And `impersonate()` does not hand this dead token back.
    const res = await callImpersonate('impersonated');
    expect(res.json.result.resolved).toBe('impersonated');
  });

  it('reuses the live session instead of minting a second one', async () => {
    const users = await http.get<{ results: ParseRecord[] }>('/api/_User?where=' + encodeURIComponent(JSON.stringify({ username: 'impersonated' })), admin);
    const userId = users.json.results[0].objectId as string;

    const before = await impersonationSessionsFor(userId);
    expect(before.length).toBeGreaterThan(0);
    const res = await callImpersonate('impersonated');
    expect(res.json.result.resolved).toBe('impersonated');

    const after = await impersonationSessionsFor(userId);
    expect(after.map((r) => r.objectId).sort()).toEqual(before.map((r) => r.objectId).sort());
  });
});
