/**
 * BCN-006 step 4 — auth for the REST backends, and the first `performRefresh`.
 *
 * What these pin, and why each one rather than coverage for its own sake: every
 * assertion below is a thing that, got wrong, fails **silently** — the app keeps
 * working and the user is signed out fifteen minutes later, or a request goes out
 * with a token nobody refreshed.
 *
 * Each wire fact asserted here was measured against the live rig on 2026-07-31
 * (Directus 11 `:8055`, PocketBase 0.30.0 `:8091`) before any of this was
 * written. Where a test's expectation looks arbitrary, the comment names the
 * observation it came from.
 */

import { AUTH_ADAPTER_METHODS } from '@noodl/backend-contract';
import type { BackendHandle } from '@noodl/backend-contract';

import {
  REST_USER_READONLY_FIELDS,
  RestAuthAdapter,
  SUPABASE_AUTH_UNSUPPORTED,
  jwtExpiryMs,
  readAuthMethods,
  restAuthProfileFor,
  restSessionKey
} from '../../src/api/backends/RestAuthAdapter';
import { SessionStore } from '../../src/api/backends/SessionStore';

// ── Fixtures ────────────────────────────────────────────────────────────────

const directus: BackendHandle = {
  id: 'be-directus',
  type: 'directus',
  name: 'My Directus',
  url: 'https://directus.example'
};

const pocketbase: BackendHandle = {
  id: 'be-pb',
  type: 'pocketbase',
  name: 'My PocketBase',
  url: 'https://pb.example'
};

const supabase: BackendHandle = {
  id: 'be-sb',
  type: 'supabase',
  name: 'My Supabase',
  url: 'https://sb.example'
};

interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

/** A `fetch` that answers from a queue and records what it was asked. */
function fakeFetch() {
  const calls: Call[] = [];
  const queue: { status: number; body: unknown }[] = [];
  let thrown: Error | undefined;

  const impl = (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => {
    calls.push({
      url,
      method: init?.method || 'GET',
      headers: init?.headers || {},
      body: init?.body === undefined ? undefined : JSON.parse(init.body)
    });
    if (thrown) return Promise.reject(thrown);
    const next = queue.shift();
    if (!next) return Promise.reject(new Error(`no queued response for ${init?.method} ${url}`));
    return Promise.resolve({
      status: next.status,
      text: () => Promise.resolve(next.body === undefined ? '' : JSON.stringify(next.body))
    });
  };

  return {
    impl,
    calls,
    reply(status: number, body?: unknown) {
      queue.push({ status, body });
      return this;
    },
    throwWith(error: Error) {
      thrown = error;
    }
  };
}

/** A JWT with a given `exp`, unsigned — only the claim is ever read. */
function jwt(expSeconds: number, extra: Record<string, unknown> = {}): string {
  const claim = Buffer.from(JSON.stringify({ exp: expSeconds, ...extra }))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `header.${claim}.signature`;
}

function makeAdapter(options: { now?: () => number; probed?: string[] } = {}) {
  const storage: Record<string, unknown> = {};
  const fetcher = fakeFetch();
  const adapter = new RestAuthAdapter({
    fetchImpl: fetcher.impl as never,
    now: options.now,
    // `testEnvironment: 'node'` has no `window`, so the real guard correctly says
    // "not a browser" and would switch off every refresh path under test.
    isBrowserTab: () => true,
    probedCapabilities: (options.probed ?? []) as never,
    createStore: (handle) => new SessionStore({ key: restSessionKey(handle), storage, broadcaster: null })
  });
  return { adapter, storage, fetcher };
}

/** Let the promise chain inside `request` settle. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

// ── The contract surface ────────────────────────────────────────────────────

describe('the contract', () => {
  it('implements all ten methods', () => {
    const adapter = new RestAuthAdapter();
    for (const method of AUTH_ADAPTER_METHODS) {
      expect(typeof (adapter as unknown as Record<string, unknown>)[method]).toBe('function');
    }
    adapter.dispose();
  });

  it('keeps a REST session away from the Parse key, and one per backend id', () => {
    // `Parse/<appId>/currentUser` is unchangeable — every deployed NodeGX app has
    // already written it into its users' browsers. A REST session landing on it
    // would sign those users out.
    expect(restSessionKey(directus)).toBe('NodeGX/be-directus/session');
    expect(restSessionKey(pocketbase)).toBe('NodeGX/be-pb/session');
    expect(restSessionKey(directus)).not.toContain('Parse/');
  });
});

// ── Supabase is refused, not attempted ──────────────────────────────────────

describe('Supabase', () => {
  it('refuses every auth method with one sentence, and issues no request', async () => {
    const { adapter, fetcher } = makeAdapter();
    const errors: (string | undefined)[] = [];
    const success = () => errors.push('SUCCEEDED');
    const error = (e?: string) => errors.push(e);

    adapter.logIn(supabase, { username: 'a', password: 'b', success, error });
    adapter.signUp(supabase, { username: 'a', password: 'b', success, error });
    adapter.requestPasswordReset(supabase, { email: 'a@b.c', success, error });
    adapter.fetchCurrentUser(supabase, { success, error });
    adapter.signInWithProvider(supabase, { provider: 'google', error });
    await settle();

    // ⚠️ The rig has no GoTrue: every `/auth/v1/*` path on the PostgREST
    // container answers 404, measured. An implementation written from
    // documentation is what this refusal exists instead of.
    expect(errors).toHaveLength(5);
    for (const message of errors) expect(message).toBe(SUPABASE_AUTH_UNSUPPORTED);
    expect(fetcher.calls).toHaveLength(0);
    adapter.dispose();
  });
});

// ── Directus ────────────────────────────────────────────────────────────────

describe('Directus', () => {
  const now = 1_700_000_000_000;

  it('logs in with `email`, then fetches the user before announcing it', async () => {
    const { adapter, fetcher, storage } = makeAdapter({ now: () => now });
    // Measured: POST /auth/login -> {"data":{"expires":900000,"refresh_token":…,"access_token":…}}
    fetcher.reply(200, { data: { expires: 900000, refresh_token: 'refresh-1', access_token: jwt(now / 1000 + 900) } });
    fetcher.reply(200, { data: { id: 'user-uuid', email: 'ada@example.com', first_name: 'Ada', password: '**********' } });

    const order: string[] = [];
    adapter.on('loggedIn', () => order.push('loggedIn'));
    const session = await new Promise<Record<string, unknown>>((resolve, reject) => {
      adapter.logIn(directus, {
        username: 'ada@example.com',
        password: 'pw',
        success: (s) => {
          order.push('success');
          resolve(s as Record<string, unknown>);
        },
        error: reject
      });
    });

    // ⚠️ `directus_users` has no username column. The contract's `username` IS
    // the email here, and sending it as `username` gets a 400.
    expect(fetcher.calls[0].url).toBe('https://directus.example/auth/login');
    expect(fetcher.calls[0].body).toEqual({ email: 'ada@example.com', password: 'pw' });

    // Directus's login answers tokens and NO user record, so `loggedIn` must not
    // fire until /users/me lands — a graph reading `Current.email` in its
    // loggedIn handler is the ordinary case.
    expect(fetcher.calls[1].url).toBe('https://directus.example/users/me');
    expect(fetcher.calls[1].headers.Authorization).toBe(`Bearer ${jwt(now / 1000 + 900)}`);
    expect(order).toEqual(['success', 'loggedIn']);

    expect(session.email).toBe('ada@example.com');
    // `id` -> `objectId`, the same direction `recordIdentity.ts` normalises.
    expect(session.objectId).toBe('user-uuid');
    expect(session.id).toBeUndefined();
    // Never into browser storage, whatever the backend sent.
    expect(session.password).toBeUndefined();

    const stored = JSON.parse(String(storage['NodeGX/be-directus/session']));
    expect(stored.refreshToken).toBe('refresh-1');
    adapter.dispose();
  });

  it("reads `expires` as a DURATION in milliseconds, not an absolute time", async () => {
    // ⚠️ The single most dangerous wire fact in this file. Measured: the response
    // says `expires: 900000` and the access token's own `exp` is `now + 900`
    // SECONDS. Storing 900000 as `expiresAt` puts the deadline in January 1970,
    // every request sees an expired token, and the app refreshes forever while
    // appearing to work.
    const { adapter, fetcher } = makeAdapter({ now: () => now });
    // No JWT this time, so the fallback path is the one under test.
    fetcher.reply(200, { data: { expires: 900000, refresh_token: 'r', access_token: 'not-a-jwt' } });
    fetcher.reply(200, { data: { id: 'u' } });

    const session = await new Promise<Record<string, unknown>>((resolve, reject) => {
      adapter.logIn(directus, { username: 'a@b.c', password: 'pw', success: (s) => resolve(s as never), error: reject });
    });

    expect(session.expiresAt).toBe(now + 900000);
    expect(session.expiresAt).toBeGreaterThan(now);
    adapter.dispose();
  });

  it('prefers the token\'s own `exp` over the declared TTL', async () => {
    // Design §2: "the token is the authority; the declared TTL is a fallback",
    // because every one of these backends lets an administrator change the TTL.
    const { adapter, fetcher } = makeAdapter({ now: () => now });
    const expSeconds = now / 1000 + 60; // an instance configured to one minute
    fetcher.reply(200, { data: { expires: 900000, refresh_token: 'r', access_token: jwt(expSeconds) } });
    fetcher.reply(200, { data: { id: 'u' } });

    const session = await new Promise<Record<string, unknown>>((resolve, reject) => {
      adapter.logIn(directus, { username: 'a@b.c', password: 'pw', success: (s) => resolve(s as never), error: reject });
    });

    expect(session.expiresAt).toBe(expSeconds * 1000);
    adapter.dispose();
  });

  it('sends `mode: json` on a refresh, and rotates the stored refresh token', async () => {
    const { adapter, fetcher, storage } = makeAdapter({ now: () => now });
    storage['NodeGX/be-directus/session'] = JSON.stringify({
      objectId: 'u',
      sessionToken: 'old-access',
      refreshToken: 'refresh-1',
      expiresAt: now + 1000
    });

    // Measured: without `mode: 'json'` Directus sets the new refresh token as an
    // httpOnly COOKIE and the body carries none — so the NEXT refresh has nothing
    // to present, and the user is signed out one token lifetime later.
    fetcher.reply(200, { data: { expires: 900000, refresh_token: 'refresh-2', access_token: jwt(now / 1000 + 900) } });

    const controller = adapter.lifecycleController(directus);
    await new Promise<void>((resolve) => {
      controller.withSession(() => resolve());
      // inside the margin, so a background refresh starts and this caller does
      // not wait for it — design §3, the row worth arguing with.
    });
    await settle();

    expect(fetcher.calls[0].url).toBe('https://directus.example/auth/refresh');
    expect(fetcher.calls[0].body).toEqual({ refresh_token: 'refresh-1', mode: 'json' });

    const stored = JSON.parse(String(storage['NodeGX/be-directus/session']));
    expect(stored.refreshToken).toBe('refresh-2');
    expect(stored.sessionToken).toBe(jwt(now / 1000 + 900));
    adapter.dispose();
  });

  it('a rejected refresh (401) ends the session; an undelivered one does not', async () => {
    // Measured both: a spent Directus refresh token answers
    // `401 {"errors":[{"message":"Invalid user credentials."}]}`, and an
    // unreachable host arrives as a thrown fetch, which the adapter reports as
    // status 0 so `classifyRefreshFailure` calls it undelivered.
    const rejected = makeAdapter({ now: () => now });
    rejected.storage['NodeGX/be-directus/session'] = JSON.stringify({
      sessionToken: 'a',
      refreshToken: 'spent',
      expiresAt: now - 1
    });
    rejected.fetcher.reply(401, { errors: [{ message: 'Invalid user credentials.' }] });

    const lost: string[] = [];
    rejected.adapter.on('sessionLost', (reason) => lost.push(String(reason)));
    rejected.adapter.lifecycleController(directus).withSession(() => undefined);
    await settle();

    expect(lost).toEqual(['Invalid user credentials.']);
    expect(rejected.storage['NodeGX/be-directus/session']).toBeUndefined();
    rejected.adapter.dispose();

    const offline = makeAdapter({ now: () => now });
    offline.storage['NodeGX/be-directus/session'] = JSON.stringify({
      sessionToken: 'a',
      refreshToken: 'good',
      // Still valid: the margin exists precisely to absorb this.
      expiresAt: now + 60000
    });
    offline.fetcher.throwWith(new Error('Failed to fetch'));

    const offlineLost: string[] = [];
    offline.adapter.on('sessionLost', (reason) => offlineLost.push(String(reason)));
    offline.adapter.lifecycleController(directus).withSession(() => undefined);
    await settle();

    // A user in a lift keeps their session. This is design decision #1.
    expect(offlineLost).toEqual([]);
    expect(offline.storage['NodeGX/be-directus/session']).toBeDefined();
    offline.adapter.dispose();
  });

  it('gates sign-up on the descriptor, because public registration is off by default', async () => {
    // Measured: POST /users/register -> 403 FORBIDDEN on a stock instance, and
    // `/server/info` confirms `public_registration: false`. `auth.signUp` is
    // `conditional`, and conditional counts as NO until a probe says otherwise.
    const { adapter, fetcher } = makeAdapter();
    const errors: (string | undefined)[] = [];
    adapter.signUp(directus, { username: 'a@b.c', password: 'pw', success: () => undefined, error: (e) => errors.push(e) });
    await settle();

    expect(fetcher.calls).toHaveLength(0);
    expect(errors[0]).toContain('public registration');
    adapter.dispose();
  });

  it('signs up when the capability has been probed, and logs in afterwards', async () => {
    // Directus's registration answers 204 with no session, so `signUp` that did
    // not log in would resolve with nobody signed in.
    const { adapter, fetcher } = makeAdapter({ probed: ['auth.signUp', 'auth.password'] });
    fetcher.reply(204);
    fetcher.reply(200, { data: { expires: 900000, refresh_token: 'r', access_token: jwt(2_000_000_000) } });
    fetcher.reply(200, { data: { id: 'u', email: 'new@example.com' } });

    const session = await new Promise<Record<string, unknown>>((resolve, reject) => {
      adapter.signUp(directus, {
        username: 'new@example.com',
        password: 'pw',
        email: 'new@example.com',
        success: (s) => resolve(s as never),
        error: reject
      });
    });

    expect(fetcher.calls.map((c) => c.url)).toEqual([
      'https://directus.example/users/register',
      'https://directus.example/auth/login',
      'https://directus.example/users/me'
    ]);
    expect(session.email).toBe('new@example.com');
    adapter.dispose();
  });

  it('refuses magic link with the descriptor\'s own sentence', async () => {
    const { adapter, fetcher } = makeAdapter();
    const errors: (string | undefined)[] = [];
    adapter.requestMagicLink(directus, { email: 'a@b.c', success: () => undefined, error: (e) => errors.push(e) });
    await settle();

    // The phase's central promise, in one line: not a node that emits nothing.
    expect(errors[0]).toBe('Directus has no magic-link login. Use email and password, or an OAuth provider.');
    expect(fetcher.calls).toHaveLength(0);
    adapter.dispose();
  });

  it('leaves `emailVerified` absent, because Directus has no such field', async () => {
    // `status` is an account state (active/invited/suspended), not an assertion
    // about the address — an admin-created active user may never have seen an
    // email. Mapping one to the other would answer a question Directus was not
    // asked.
    const { adapter, fetcher } = makeAdapter();
    fetcher.reply(200, { data: { expires: 900000, refresh_token: 'r', access_token: jwt(2_000_000_000) } });
    fetcher.reply(200, { data: { id: 'u', email: 'a@b.c', status: 'active' } });

    const session = await new Promise<Record<string, unknown>>((resolve, reject) => {
      adapter.logIn(directus, { username: 'a@b.c', password: 'pw', success: (s) => resolve(s as never), error: reject });
    });

    expect(session.emailVerified).toBeUndefined();
    expect(session.status).toBe('active');
    adapter.dispose();
  });

  it('drops the local session on logout even when the backend refuses', async () => {
    // Measured: Directus's own /auth/logout answers 204 and the access token
    // STILL WORKS afterwards — it revokes the refresh token, not the JWT. So the
    // client dropping its copy is what a logout actually is on this wire.
    const { adapter, fetcher, storage } = makeAdapter();
    storage['NodeGX/be-directus/session'] = JSON.stringify({ sessionToken: 'a', refreshToken: 'r' });
    fetcher.reply(500, { errors: [{ message: 'boom' }] });

    const events: string[] = [];
    adapter.on('loggedOut', () => events.push('loggedOut'));
    await new Promise<void>((resolve) => adapter.logOut(directus, { success: resolve, error: () => resolve() }));

    expect(storage['NodeGX/be-directus/session']).toBeUndefined();
    expect(events).toEqual(['loggedOut']);
    adapter.dispose();
  });
});

// ── PocketBase ──────────────────────────────────────────────────────────────

describe('PocketBase', () => {
  const now = 1_700_000_000_000;

  it('logs in with `identity`, and maps `verified` to `emailVerified`', async () => {
    const { adapter, fetcher } = makeAdapter({ now: () => now });
    const token = jwt(now / 1000 + 604800, { collectionId: '_pb_users_auth_', id: 'rec1' });
    fetcher.reply(200, {
      record: { id: 'rec1', email: 'ada@example.com', verified: false, name: 'Ada', collectionName: 'users' },
      token
    });

    const session = await new Promise<Record<string, unknown>>((resolve, reject) => {
      adapter.logIn(pocketbase, { username: 'ada@example.com', password: 'pw', success: (s) => resolve(s as never), error: reject });
    });

    expect(fetcher.calls[0].url).toBe('https://pb.example/api/collections/users/auth-with-password');
    expect(fetcher.calls[0].body).toEqual({ identity: 'ada@example.com', password: 'pw' });

    expect(session.objectId).toBe('rec1');
    // A real boolean, unlike Directus. Measured false on a fresh sign-up.
    expect(session.emailVerified).toBe(false);
    // Measured 7 days on the rig, though the descriptor declares 14 — which is
    // exactly why the token wins.
    expect(session.expiresAt).toBe((now / 1000 + 604800) * 1000);
    adapter.dispose();
  });

  it('refreshes with the ACCESS token and no refresh token', async () => {
    // ⚠️ The finding that forced a change to `TokenLifecycleController`. PocketBase
    // issues no refresh token; measured, `POST …/auth-refresh` carrying only
    // `Authorization: Bearer <access>` answers 200 and a new token. Without
    // `refreshTokenRequired: false` the controller's own guard would have signed
    // every PocketBase user out at the first scheduled refresh.
    const { adapter, fetcher, storage } = makeAdapter({ now: () => now });
    storage['NodeGX/be-pb/session'] = JSON.stringify({
      objectId: 'rec1',
      sessionToken: 'old-token',
      expiresAt: now - 1 // expired, so the gate queues and refreshes
    });
    const fresh = jwt(now / 1000 + 604800);
    fetcher.reply(200, { record: { id: 'rec1', email: 'a@b.c', verified: true }, token: fresh });

    const lost: unknown[] = [];
    adapter.on('sessionLost', (r) => lost.push(r));

    const handed = await new Promise<unknown>((resolve) => {
      adapter.lifecycleController(pocketbase).withSession((session) => resolve(session));
    });

    expect(lost).toEqual([]);
    expect(fetcher.calls[0].url).toBe('https://pb.example/api/collections/users/auth-refresh');
    expect(fetcher.calls[0].headers.Authorization).toBe('Bearer old-token');
    expect(fetcher.calls[0].body).toEqual({});
    expect((handed as Record<string, unknown>).sessionToken).toBe(fresh);
    adapter.dispose();
  });

  it('signs up in two requests, because the create returns no token and no email', async () => {
    // Both measured. The create answers 200 with the record and NO token, and the
    // record omits `email` because the shipped users collection has
    // `emailVisibility: false` — the same defect class as the Parse
    // `Current.email` gap this task fixes.
    const { adapter, fetcher } = makeAdapter({ now: () => now });
    fetcher.reply(200, { id: 'rec2', verified: false, name: 'New' });
    fetcher.reply(200, { record: { id: 'rec2', email: 'new@example.com', verified: false }, token: jwt(2_000_000_000) });

    const session = await new Promise<Record<string, unknown>>((resolve, reject) => {
      adapter.signUp(pocketbase, {
        username: 'new@example.com',
        password: 'pw12345678',
        email: 'new@example.com',
        success: (s) => resolve(s as never),
        error: reject
      });
    });

    expect(fetcher.calls[0].url).toBe('https://pb.example/api/collections/users/records');
    // PocketBase requires the confirmation field; without it the create is a 400.
    expect(fetcher.calls[0].body).toEqual({
      email: 'new@example.com',
      password: 'pw12345678',
      passwordConfirm: 'pw12345678'
    });
    expect(fetcher.calls[1].url).toBe('https://pb.example/api/collections/users/auth-with-password');
    // The email the create would not tell us.
    expect(session.email).toBe('new@example.com');
    adapter.dispose();
  });

  it('gates verification on the descriptor, because a missing SMTP looks like success', async () => {
    // Measured: `request-verification` answers 204 with SMTP disabled, and
    // `/api/settings` reports `smtp.enabled: false`. PocketBase logs the mail
    // rather than erroring, so the 204 says nothing about delivery.
    const { adapter, fetcher } = makeAdapter();
    const errors: (string | undefined)[] = [];
    adapter.sendEmailVerification(pocketbase, { email: 'a@b.c', success: () => undefined, error: (e) => errors.push(e) });
    await settle();

    expect(fetcher.calls).toHaveLength(0);
    expect(errors[0]).toContain('SMTP');
    adapter.dispose();
  });

  it('treats 401 on the current user as a lost session, and 500 as not', async () => {
    // The REST family's equivalent of Parse's code 209. A stored session must
    // survive a backend restart; it must not survive a rejection.
    const rejected = makeAdapter();
    rejected.storage['NodeGX/be-pb/session'] = JSON.stringify({ sessionToken: 'dead' });
    rejected.fetcher.reply(401, { status: 401, message: 'The request requires valid record authorization token.' });
    const lost: unknown[] = [];
    rejected.adapter.on('sessionLost', (r) => lost.push(r));
    await new Promise<void>((resolve) =>
      rejected.adapter.fetchCurrentUser(pocketbase, { success: () => resolve(), error: () => resolve() })
    );
    expect(lost).toHaveLength(1);
    expect(rejected.storage['NodeGX/be-pb/session']).toBeUndefined();
    rejected.adapter.dispose();

    const down = makeAdapter();
    down.storage['NodeGX/be-pb/session'] = JSON.stringify({ sessionToken: 'fine' });
    down.fetcher.reply(500, { status: 500, message: 'boom' });
    const downLost: unknown[] = [];
    down.adapter.on('sessionLost', (r) => downLost.push(r));
    await new Promise<void>((resolve) =>
      down.adapter.fetchCurrentUser(pocketbase, { success: () => resolve(), error: () => resolve() })
    );
    expect(downLost).toEqual([]);
    expect(down.storage['NodeGX/be-pb/session']).toBeDefined();
    down.adapter.dispose();
  });
});

// ── The JWT reader ──────────────────────────────────────────────────────────

describe('jwtExpiryMs', () => {
  it('reads `exp` as seconds and answers milliseconds', () => {
    expect(jwtExpiryMs(jwt(1_785_532_940))).toBe(1_785_532_940_000);
  });

  it('answers undefined for anything it cannot read, rather than guessing', () => {
    // A wrong number here schedules a refresh at the wrong moment; `undefined`
    // falls through to the declared TTL, which is the documented fallback.
    expect(jwtExpiryMs(undefined)).toBeUndefined();
    expect(jwtExpiryMs('not-a-jwt')).toBeUndefined();
    expect(jwtExpiryMs('a.!!!not-base64!!!.c')).toBeUndefined();
    expect(jwtExpiryMs(jwt(NaN as unknown as number))).toBeUndefined();
    // Parse session tokens are opaque, not JWTs, and must not be misread.
    expect(jwtExpiryMs('r:a56216235f1f50f9c5c5a4e88da5c9b2')).toBeUndefined();
  });
});

// ── Error surfacing ─────────────────────────────────────────────────────────

describe('errors reach the node as a sentence', () => {
  it('unwraps both measured envelopes', async () => {
    const d = makeAdapter();
    // Measured on a wrong password.
    d.fetcher.reply(401, { errors: [{ message: 'Invalid user credentials.', extensions: { code: 'INVALID_CREDENTIALS' } }] });
    const dError = await new Promise<string | undefined>((resolve) =>
      d.adapter.logIn(directus, { username: 'a@b.c', password: 'no', success: () => resolve('SUCCEEDED'), error: resolve })
    );
    expect(dError).toBe('Invalid user credentials.');
    d.adapter.dispose();

    const p = makeAdapter();
    // Measured on a wrong password: 400, not 401.
    p.fetcher.reply(400, { data: {}, message: 'Failed to authenticate.', status: 400 });
    const pError = await new Promise<string | undefined>((resolve) =>
      p.adapter.logIn(pocketbase, { username: 'a@b.c', password: 'no', success: () => resolve('SUCCEEDED'), error: resolve })
    );
    expect(pError).toBe('Failed to authenticate.');
    p.adapter.dispose();
  });
});

// ── OAuth — step 5 ──────────────────────────────────────────────────────────

/**
 * The provider flow, with the parts that are not the wire pinned here.
 *
 * The **wire** half of step 5 is measured live rather than mocked
 * (`uba-e2e/bcn-006-oauth-driver.ts`, 39 checks against a real PocketBase and a
 * stub OIDC provider). What that pass cannot pin is the set of things that are
 * *refusals* — a flow that never leaves the page has no wire to observe — and
 * those are exactly the checks BCN-006's promise rests on: nothing silently
 * missing.
 *
 * ⚠️ Every one of these fails when the branch it covers is reverted. Two of them
 * exist **because** a live check that looked equivalent stayed green under
 * mutation: asserting "the return failed" passed with the `state` comparison
 * deleted, because a foreign code is one the backend rejects anyway.
 */

/** The smallest `window` `signInWithProvider` and `consumeAuthReturn` need. */
function installFakeWindow(href: string) {
  const url = new URL(href);
  const navigations: string[] = [];
  const fake = {
    location: {
      get href() {
        return url.toString();
      },
      set href(next: string) {
        navigations.push(next);
      },
      get search() {
        return url.search;
      },
      get pathname() {
        return url.pathname;
      },
      get hash() {
        return url.hash;
      }
    },
    history: {
      state: null,
      replaceState(_state: unknown, _title: string, next: string) {
        url.search = new URL(next, url.origin).search;
      }
    }
  };
  (globalThis as unknown as { window: unknown }).window = fake;
  return { navigations, url };
}

function removeFakeWindow() {
  delete (globalThis as unknown as { window?: unknown }).window;
}

/** `auth-methods` with one provider, shaped as PocketBase 0.30 answers it. */
const POCKETBASE_AUTH_METHODS = {
  password: { identityFields: ['email'], enabled: true },
  oauth2: {
    enabled: true,
    providers: [
      {
        name: 'oidc',
        displayName: 'Acme SSO',
        state: 'the-state',
        // ⚠️ Ends in a bare `redirect_uri=`. Measured, and the whole reason
        // `signInWithProvider` appends rather than assuming a complete URL.
        authURL: 'https://idp.example/authorize?client_id=x&code_challenge=y&state=the-state&redirect_uri=',
        authUrl: 'https://idp.example/authorize?client_id=x&code_challenge=y&state=the-state&redirect_uri=',
        codeVerifier: 'the-verifier'
      }
    ]
  },
  // Not an empty array when OAuth is off — `null`. Measured, and the reason the
  // descriptor's probe moved off this field.
  authProviders: null,
  otp: { enabled: false, duration: 0 }
};

describe('signInWithProvider', () => {
  afterEach(removeFakeWindow);

  it('asks the backend which providers exist before navigating anywhere', async () => {
    const { navigations } = installFakeWindow('https://app.example/page');
    const { adapter, fetcher, storage } = makeAdapter();
    fetcher.reply(200, POCKETBASE_AUTH_METHODS);

    adapter.signInWithProvider(pocketbase, { provider: 'oidc', error: () => undefined });
    await settle();

    expect(fetcher.calls[0].url).toBe('https://pb.example/api/collections/users/auth-methods');
    expect(navigations).toHaveLength(1);
    // The PROVIDER, not PocketBase, and the redirect is appended encoded.
    expect(navigations[0]).toBe(
      'https://idp.example/authorize?client_id=x&code_challenge=y&state=the-state&redirect_uri=' +
        encodeURIComponent('https://app.example/page')
    );

    // Parked BEFORE the navigation — after it, nothing in this context runs.
    const parked = JSON.parse(String(storage['NodeGX/be-pb/session.oauth-pending']));
    expect(parked).toMatchObject({ provider: 'oidc', codeVerifier: 'the-verifier', state: 'the-state' });
    adapter.dispose();
  });

  it('refuses a provider the instance does not have, and names the ones it does', async () => {
    const { navigations } = installFakeWindow('https://app.example/page');
    const { adapter, fetcher } = makeAdapter();
    fetcher.reply(200, POCKETBASE_AUTH_METHODS);

    const error = await new Promise<string | undefined>((resolve) =>
      adapter.signInWithProvider(pocketbase, { provider: 'google', error: resolve })
    );

    // ⚠️ The measured alternative is a round trip through a provider ending in
    // `403 "The collection is not configured to allow OAuth2 authentication."`,
    // which the user only ever sees after leaving the app.
    expect(error).toContain('oidc');
    expect(navigations).toHaveLength(0);
    adapter.dispose();
  });

  it('refuses when the instance has no providers at all', async () => {
    installFakeWindow('https://app.example/page');
    const { adapter, fetcher } = makeAdapter();
    fetcher.reply(200, { oauth2: { enabled: false, providers: [] }, authProviders: null });

    const error = await new Promise<string | undefined>((resolve) =>
      adapter.signInWithProvider(pocketbase, { provider: 'oidc', error: resolve })
    );
    expect(error).toContain('no sign-in providers configured');
    adapter.dispose();
  });

  it('refuses Directus for the cookie session rather than for want of an implementation', async () => {
    const { navigations } = installFakeWindow('https://app.example/page');
    const { adapter, fetcher } = makeAdapter();

    const error = await new Promise<string | undefined>((resolve) =>
      adapter.signInWithProvider(directus, { provider: 'google', error: resolve })
    );

    // Measured: `GET /auth/login/google` on an instance without that provider is
    // a 404 ROUTE_NOT_FOUND, so a start leg written anyway navigates the user
    // off the app. And even configured, the session comes back as a cookie.
    expect(error).toContain('cookie');
    expect(navigations).toHaveLength(0);
    expect(fetcher.calls).toHaveLength(0);
    adapter.dispose();
  });
});

describe('consumeAuthReturn', () => {
  afterEach(removeFakeWindow);

  function park(storage: Record<string, unknown>, overrides: Record<string, unknown> = {}) {
    storage['NodeGX/be-pb/session.oauth-pending'] = JSON.stringify(
      Object.assign(
        { provider: 'oidc', codeVerifier: 'the-verifier', state: 'the-state', redirectURL: 'https://app.example/page', startedAt: 1 },
        overrides
      )
    );
  }

  it('does nothing at all when no flow was parked, whatever the URL says', () => {
    installFakeWindow('https://app.example/page?code=A-MARKETING-CAMPAIGN&state=x');
    const { adapter, fetcher } = makeAdapter();

    // `code` and `state` are the most generic query parameters in the world.
    // Triggering on them alone would consume somebody else's callback.
    expect(adapter.consumeAuthReturn(pocketbase)).toBe(false);
    expect(fetcher.calls).toHaveLength(0);
    adapter.dispose();
  });

  it('exchanges the code and establishes the session', async () => {
    const { url } = installFakeWindow('https://app.example/page?code=the-code&state=the-state&keep=me');
    const { adapter, fetcher, storage } = makeAdapter();
    park(storage);

    fetcher.reply(200, {
      token: jwt(Math.floor(Date.now() / 1000) + 3600),
      record: { id: 'pb-1', email: 'a@b.c', verified: true },
      meta: { isNew: true }
    });

    const events: unknown[] = [];
    adapter.events.on('oauthReturn', (state: unknown) => events.push(state));
    adapter.events.on('loggedIn', () => events.push('loggedIn'));

    expect(adapter.consumeAuthReturn(pocketbase)).toBe(true);
    await settle();

    expect(fetcher.calls[0].url).toBe('https://pb.example/api/collections/users/auth-with-oauth2');
    expect(fetcher.calls[0].body).toEqual({
      provider: 'oidc',
      code: 'the-code',
      codeVerifier: 'the-verifier',
      redirectURL: 'https://app.example/page'
    });

    const session = adapter.getCurrentUser(pocketbase);
    expect(session?.objectId).toBe('pb-1');
    expect(session?.emailVerified).toBe(true);
    expect(events).toContain('loggedIn');
    expect(events[events.length - 2]).toMatchObject({ succeeded: true, outcome: 'created' });

    // The one-time code is gone from the address bar and everything else stayed.
    expect(url.search).toBe('?keep=me');
    adapter.dispose();
  });

  it('refuses a state that is not the one this browser started, without exchanging it', async () => {
    installFakeWindow('https://app.example/page?code=someone-elses&state=a-different-state');
    const { adapter, fetcher, storage } = makeAdapter();
    park(storage);

    const outcome = await new Promise<{ succeeded?: boolean; error?: string }>((resolve) => {
      adapter.events.on('oauthReturn', (state: unknown) => {
        const s = state as { inProgress: boolean };
        if (!s.inProgress) resolve(s as never);
      });
      expect(adapter.consumeAuthReturn(pocketbase)).toBe(true);
    });

    expect(outcome.succeeded).toBe(false);
    expect(outcome.error).toContain('verified as the one you started');
    // ⚠️ The load-bearing half. Asserting only "it failed" stays green with the
    // comparison deleted, because the backend rejects a foreign code anyway.
    expect(fetcher.calls).toHaveLength(0);
    adapter.dispose();
  });

  it('forgets the flow, so a reload carrying the same code cannot replay it', async () => {
    installFakeWindow('https://app.example/page?code=the-code&state=the-state');
    const { adapter, fetcher, storage } = makeAdapter();
    park(storage);
    fetcher.reply(200, { token: 'tok', record: { id: 'pb-1' } });

    expect(adapter.consumeAuthReturn(pocketbase)).toBe(true);
    await settle();

    installFakeWindow('https://app.example/page?code=the-code&state=the-state');
    expect(adapter.consumeAuthReturn(pocketbase)).toBe(false);
    expect(fetcher.calls).toHaveLength(1);
    adapter.dispose();
  });

  it('reports a provider that refused, and exchanges nothing', async () => {
    installFakeWindow('https://app.example/page?error=access_denied&error_description=You+said+no');
    const { adapter, fetcher, storage } = makeAdapter();
    park(storage);

    const outcome = await new Promise<{ succeeded?: boolean; error?: string }>((resolve) => {
      adapter.events.on('oauthReturn', (state: unknown) => {
        const s = state as { inProgress: boolean };
        if (!s.inProgress) resolve(s as never);
      });
      expect(adapter.consumeAuthReturn(pocketbase)).toBe(true);
    });

    expect(outcome.succeeded).toBe(false);
    expect(outcome.error).toBe('You said no');
    expect(fetcher.calls).toHaveLength(0);
    adapter.dispose();
  });
});

describe('readAuthMethods', () => {
  it('reads PocketBase’s oauth2 block and keeps OTP out of magicLink', () => {
    const methods = readAuthMethods(restAuthProfileFor('pocketbase')!, POCKETBASE_AUTH_METHODS);
    expect(methods.providers).toEqual([
      expect.objectContaining({ id: 'oidc', displayName: 'Acme SSO' })
    ]);
    expect(methods.magicLink.enabled).toBe(false);
    expect(methods.otp).toEqual({ enabled: false });
  });

  it('does not report OTP as a magic link even when OTP is switched ON', () => {
    // ⚠️ **This case exists because the assertion above proved nothing.**
    // Mutation-testing `magicLink: {enabled: otp.enabled === true}` left the
    // suite green — the rig's OTP is off, so both spellings answer `false`. The
    // claim is only testable on a fixture where they differ.
    //
    // An emailed one-time PASSWORD is a second field for the user to type, not a
    // link. A `Request Magic Link` node reporting success for it sends somebody
    // looking for a link that is not coming.
    const methods = readAuthMethods(restAuthProfileFor('pocketbase')!, {
      oauth2: { enabled: false, providers: [] },
      otp: { enabled: true, duration: 180 }
    });
    expect(methods.otp).toEqual({ enabled: true });
    expect(methods.magicLink.enabled).toBe(false);
  });

  it('reports nothing when PocketBase has oauth2 switched off', () => {
    const methods = readAuthMethods(restAuthProfileFor('pocketbase')!, {
      oauth2: { enabled: false, providers: [] },
      authProviders: null
    });
    expect(methods.providers).toEqual([]);
  });

  it('reads both spellings Directus has used, and an empty list is not a throw', () => {
    const profile = restAuthProfileFor('directus')!;
    // Measured on the rig: `{"data":[],"disableDefault":false}`.
    expect(readAuthMethods(profile, { data: [], disableDefault: false }).providers).toEqual([]);
    expect(readAuthMethods(profile, { data: ['google'] }).providers).toEqual([
      { id: 'google', displayName: 'google' }
    ]);
    expect(readAuthMethods(profile, { data: [{ name: 'okta', driver: 'openid', label: 'Okta' }] }).providers).toEqual([
      { id: 'okta', displayName: 'Okta' }
    ]);
  });
});

describe('the read-only field list', () => {
  it('is the same list the write path strips', async () => {
    const { adapter, fetcher, storage } = makeAdapter();
    storage[restSessionKey(pocketbase)] = JSON.stringify({ objectId: 'pb-1', sessionToken: 'tok' });
    fetcher.reply(200, { id: 'pb-1', nickname: 'set' });

    adapter.setUserProperties(pocketbase, {
      properties: { nickname: 'set', verified: true, id: 'hijack', tokenKey: 'nope', passwordConfirm: 'nope' },
      success: () => undefined,
      error: () => undefined
    });
    await settle();

    // ⚠️ `verified` is the one that matters: before `REST_USER_READONLY_FIELDS`
    // was shared with the port generator, `Set User Properties` on PocketBase
    // offered a `verified` input that accepted a value and threw it away.
    expect(fetcher.calls[0].body).toEqual({ nickname: 'set' });
    for (const field of ['verified', 'id', 'tokenKey', 'passwordConfirm']) {
      expect(REST_USER_READONLY_FIELDS).toContain(field);
    }
    adapter.dispose();
  });
});
