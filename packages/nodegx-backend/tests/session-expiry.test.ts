/**
 * CWF-015's loose end: `_Session.expiresAt` was WRITTEN and never READ.
 *
 * The cloud runtime's `Users.impersonate()` mints a `_Session` with a duration
 * (`noodl-viewer-cloud/src/api/users.js`, default 24h) and even queries on
 * `expiresAt` when it looks for a reusable one. The thing that actually
 * resolves a token on this backend — `UserRoutes.findSession` — selected by
 * `sessionToken` alone. So an "expiring" impersonation session expired never:
 * the row stayed, the token kept working, and nothing anywhere in the service
 * had an opinion about the column.
 *
 * The interesting half of making expiry real is NOT that an expired row is
 * refused. It is that every session that already exists must keep working:
 * `POST /login` and `POST /users` write no `expiresAt` at all, so a check that
 * read absent-as-expired would sign out every account on every existing backend
 * the moment it deployed. Both directions are asserted here, and the pure
 * helper is exercised across the four shapes the writers actually produce.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { BackendService } from '../src/service';
import { isSessionExpired, sessionExpiryMs } from '../src/server/users';

import { ErrorBody, ParseRecord, UserResponse, httpClient } from './helpers/http';

jest.setTimeout(30000);

describe('CWF-015 session expiry is read, not just written', () => {
  let dataDir: string;
  let service: BackendService;
  let base: string;
  const admin = { authorization: 'Bearer admin-token' };

  const http = httpClient(() => base);

  /** Sign up and return the user + the session token the server minted. */
  async function signup(username: string): Promise<{ objectId: string; sessionToken: string }> {
    const res = await http.post<{ objectId: string; sessionToken: string }>('/users', {
      username,
      password: 'correct-horse',
      email: `${username}@example.com`
    });
    expect(res.status).toBe(201);
    return res.json;
  }

  /** Write a `_Session` row directly, the way `impersonate()` does. */
  async function mintSession(userId: string, token: string, expiresAt: string | null): Promise<void> {
    const res = await http.post<ParseRecord>(
      '/api/_Session',
      expiresAt === null ? { sessionToken: token, userId } : { sessionToken: token, userId, expiresAt },
      admin
    );
    expect(res.status).toBeLessThan(300);
  }

  const asUser = (token: string) => ({ 'x-parse-session-token': token });

  beforeAll(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-cwf015-expiry-'));
    fs.writeFileSync(path.join(dataDir, 'ops.json'), JSON.stringify({ version: 1, rateLimit: { enabled: false } }));
    service = new BackendService({
      dataDir,
      port: 0,
      backendId: 'cwf015expiry',
      backendName: 'CWF-015 Expiry',
      authToken: 'admin-token'
    });
    base = (await service.start()).listen.url;
  });

  afterAll(async () => {
    await service.stop();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  // ==========================================================================
  // The pure rule
  // ==========================================================================

  it('reads every shape a writer actually produces, and treats nothing else as expired', () => {
    const past = Date.now() - 60_000;
    const future = Date.now() + 60_000;

    // ISO string — what `Records.create(new Date(...))` lands in SQLite as.
    expect(isSessionExpired({ expiresAt: new Date(past).toISOString() })).toBe(true);
    expect(isSessionExpired({ expiresAt: new Date(future).toISOString() })).toBe(false);
    // Parse wire.
    expect(isSessionExpired({ expiresAt: { __type: 'Date', iso: new Date(past).toISOString() } })).toBe(true);
    // Epoch milliseconds, and a live Date object.
    expect(isSessionExpired({ expiresAt: past })).toBe(true);
    expect(isSessionExpired({ expiresAt: new Date(future) })).toBe(false);

    // ⚠️ The direction that matters: unknowable is NOT expired.
    expect(isSessionExpired({})).toBe(false);
    expect(isSessionExpired({ expiresAt: null })).toBe(false);
    expect(isSessionExpired({ expiresAt: '' })).toBe(false);
    expect(isSessionExpired({ expiresAt: 'not a date at all' })).toBe(false);
    expect(sessionExpiryMs('not a date at all')).toBeNull();
    expect(sessionExpiryMs(undefined)).toBeNull();
  });

  // ==========================================================================
  // Over the wire
  // ==========================================================================

  it('refuses an expired impersonation session with 209 and deletes the dead row', async () => {
    const user = await signup('expiring');
    const token = 'r:expired-impersonation';
    await mintSession(user.objectId, token, new Date(Date.now() - 60_000).toISOString());

    const me = await http.get<ErrorBody>('/users/me', asUser(token));
    expect(me.status).toBe(400);
    expect(me.json.code).toBe(209);

    // The row is gone, not merely ignored — a dead session left lying around is
    // the thing that invites a future reader to resolve it.
    const rows = await http.get<{ results: ParseRecord[] }>(
      `/api/_Session?where=${encodeURIComponent(JSON.stringify({ sessionToken: token }))}`,
      admin
    );
    expect(rows.json.results).toHaveLength(0);
  });

  it('accepts an impersonation session that has NOT expired yet', async () => {
    const user = await signup('impersonated');
    const token = 'r:live-impersonation';
    await mintSession(user.objectId, token, new Date(Date.now() + 3_600_000).toISOString());

    const me = await http.get<UserResponse>('/users/me', asUser(token));
    expect(me.status).toBe(200);
    expect(me.json.username).toBe('impersonated');
  });

  it('leaves every session this backend has ever minted alone (no expiresAt = never expires)', async () => {
    // The one that matters for an existing deployment: signup/login write no
    // expiry, and making expiry real must not log those users out.
    const user = await signup('ordinary');
    const me = await http.get<UserResponse>('/users/me', asUser(user.sessionToken));
    expect(me.status).toBe(200);
    expect(me.json.username).toBe('ordinary');

    const login = await http.post<{ sessionToken: string }>('/login', {
      username: 'ordinary',
      password: 'correct-horse',
      _method: 'GET'
    });
    expect(login.status).toBe(200);
    expect((await http.get<UserResponse>('/users/me', asUser(login.json.sessionToken))).status).toBe(200);

    // And a row written with an explicitly null expiry is the same thing.
    const token = 'r:null-expiry';
    await mintSession(user.objectId, token, null);
    expect((await http.get<UserResponse>('/users/me', asUser(token))).status).toBe(200);
  });
});
