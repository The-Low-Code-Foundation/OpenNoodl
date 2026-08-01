/**
 * BCN-006 — the Parse auth wire behind `IAuthAdapter`, with nothing observable
 * changed.
 *
 * The same honest framing as BCN-002's suite: **this cannot prove the headline
 * claim.** "No behaviour change" is a statement about eleven user nodes and the
 * order their signals fire in, and only a live pass reaches that. What these
 * pin is what a unit test can pin, each chosen because getting it wrong during
 * the move would be silent:
 *
 * 1. The adapter implements the contract's ten, and the extras beyond them are
 *    named deliberately rather than accumulated.
 * 2. The order is still write → rebuild `current` → `success` → emit. That order
 *    is the entire reason `sessionChanged` exists.
 * 3. `fetchCurrentUser`'s `209` branch still leaves `current` stale, because it
 *    always did.
 * 4. The request gate is on the path and is synchronous, so an `eternal` backend
 *    is byte-for-byte what it was.
 */

import { AUTH_ADAPTER_METHODS } from '@noodl/backend-contract';
import type { BackendHandle } from '@noodl/backend-contract';

import { ParseAuthAdapter } from '../../src/api/backends/ParseAuthAdapter';
import { SessionStore } from '../../src/api/backends/SessionStore';

const handle: BackendHandle = {
  id: '_active_',
  type: 'nodegx',
  name: 'Built-in',
  url: 'https://backend.example',
  publicToken: 'app-id-123'
};

class FakeXHR {
  static instances: FakeXHR[] = [];
  onreadystatechange: (() => void) | null = null;
  readyState = 0;
  status = 0;
  response = '';
  responseText = '';
  opened = '';
  headers: Record<string, string> = {};
  sentBody: unknown;

  constructor() {
    FakeXHR.instances.push(this);
  }
  open(method: string, url: string) {
    this.opened = `${method} ${url}`;
  }
  setRequestHeader(name: string, value: string) {
    this.headers[name.toLowerCase()] = value;
  }
  send(body?: unknown) {
    this.sentBody = body;
  }
  complete(status: number, body: unknown) {
    this.status = status;
    this.response = typeof body === 'string' ? body : JSON.stringify(body);
    this.responseText = this.response;
    this.readyState = 4;
    this.onreadystatechange && this.onreadystatechange();
  }
}

function makeAdapter() {
  const storage: Record<string, unknown> = {};
  const adapter = new ParseAuthAdapter({
    serializeObject: (data) => data,
    createStore: (appId) => new SessionStore({ key: `Parse/${appId}/currentUser`, storage, broadcaster: null })
  });
  return { adapter, storage };
}

const KEY = 'Parse/app-id-123/currentUser';

beforeEach(() => {
  FakeXHR.instances = [];
  (globalThis as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest = FakeXHR;
});

afterEach(() => {
  delete (globalThis as unknown as { XMLHttpRequest?: unknown }).XMLHttpRequest;
});

describe('the contract surface', () => {
  test('implements exactly the ten, and nothing accidental beyond them', () => {
    const { adapter } = makeAdapter();
    for (const method of AUTH_ADAPTER_METHODS) {
      expect(typeof (adapter as unknown as Record<string, unknown>)[method]).toBe('function');
    }

    // The extras are deliberate and named. `setUserProperties` and
    // `listAuthProviders` moved because leaving them behind would have left a
    // second `_makeRequest` in `userservice.ts`, and the whole claim of the move
    // is that there is one; `consumeAuthReturn` is BAK-004's return leg, which
    // is per-backend by nature — four backends have four redirect shapes.
    const own = Object.getOwnPropertyNames(ParseAuthAdapter.prototype).filter(
      (name) => name !== 'constructor' && !name.startsWith('_')
    );
    const extras = own.filter((name) => !(AUTH_ADAPTER_METHODS as readonly string[]).includes(name));
    expect(extras.sort()).toEqual(
      [
        'consumeAuthReturn',
        'getCurrentUser',
        'lifecycleController',
        'sessionStore',
        'setUserProperties',
        'listAuthProviders',
        // `private` in TypeScript is a compile-time claim, not a runtime one, so
        // these two are on the prototype like everything else. Listed rather
        // than filtered out: the point of this test is that the surface is
        // enumerated deliberately, and a filter would let the next one in.
        'setSession',
        'clearSession'
      ].sort()
    );
  });
});

describe('the request', () => {
  test('carries the application id and a generated installation id', () => {
    const { adapter, storage } = makeAdapter();
    adapter.logIn(handle, { username: 'a', password: 'b', success: () => {}, error: () => {} });

    const xhr = FakeXHR.instances[0];
    expect(xhr.opened).toBe('POST https://backend.example/login');
    expect(xhr.headers['x-parse-application-id']).toBe('app-id-123');
    expect(xhr.headers['x-parse-installation-id']).toBeDefined();
    expect(storage['Parse/app-id-123/installationId']).toBe(xhr.headers['x-parse-installation-id']);
  });

  test('reuses the installation id it minted', () => {
    const { adapter } = makeAdapter();
    adapter.requestPasswordReset(handle, { email: 'a@b.c', success: () => {}, error: () => {} });
    adapter.requestPasswordReset(handle, { email: 'a@b.c', success: () => {}, error: () => {} });
    expect(FakeXHR.instances[0].headers['x-parse-installation-id']).toBe(
      FakeXHR.instances[1].headers['x-parse-installation-id']
    );
  });

  test('sends the stored session token', () => {
    const { adapter, storage } = makeAdapter();
    storage[KEY] = JSON.stringify({ objectId: 'u1', sessionToken: 'r:tok' });
    adapter.fetchCurrentUser(handle, { success: () => {}, error: () => {} });
    expect(FakeXHR.instances[0].headers['x-parse-session-token']).toBe('r:tok');
  });

  test('an explicit session token overrides the stored one', () => {
    const { adapter, storage } = makeAdapter();
    storage[KEY] = JSON.stringify({ sessionToken: 'stored' });
    adapter.fetchCurrentUser(handle, { sessionToken: 'explicit', success: () => {}, error: () => {} });
    expect(FakeXHR.instances[0].headers['x-parse-session-token']).toBe('explicit');
  });

  test('no configured backend fails with the message and status it always did', () => {
    const { adapter } = makeAdapter();
    let seen: unknown;
    adapter._makeRequest({ ...handle, url: undefined } as unknown as BackendHandle, '/login', {
      success: () => {},
      error: (e) => (seen = e)
    });
    expect(seen).toEqual({ error: 'No active cloud service', status: 0 });
    expect(FakeXHR.instances).toHaveLength(0);
  });

  test('the gate is on the request path and does not defer an eternal backend', () => {
    const { adapter } = makeAdapter();
    adapter.requestPasswordReset(handle, { email: 'a@b.c', success: () => {}, error: () => {} });
    // Issued in the same tick. A promise-based gate would push every request in
    // the product onto a microtask.
    expect(FakeXHR.instances).toHaveLength(1);
  });
});

describe('logIn', () => {
  test('writes the session, then announces, then succeeds, then says loggedIn — in that order', () => {
    const { adapter, storage } = makeAdapter();
    const order: string[] = [];
    adapter.on('sessionChanged', () => order.push('sessionChanged:' + (storage[KEY] ? 'written' : 'absent')));
    adapter.on('loggedIn', () => order.push('loggedIn'));

    adapter.logIn(handle, {
      username: 'ada',
      password: 'pw',
      success: () => order.push('success'),
      error: () => order.push('error')
    });
    FakeXHR.instances[0].complete(200, { objectId: 'u1', sessionToken: 'r:tok' });

    // `UserService` rebuilds `current` inside the `sessionChanged` handler, so
    // this order is what makes the split invisible: it is exactly what the
    // single method did before.
    expect(order).toEqual(['sessionChanged:written', 'success', 'loggedIn']);
    expect(JSON.parse(storage[KEY] as string)).toEqual({ objectId: 'u1', sessionToken: 'r:tok' });
  });

  test('sends the `_method: GET` tunnel Parse expects on /login', () => {
    const { adapter } = makeAdapter();
    adapter.logIn(handle, { username: 'ada', password: 'pw', success: () => {}, error: () => {} });
    expect(JSON.parse(FakeXHR.instances[0].sentBody as string)).toEqual({
      username: 'ada',
      password: 'pw',
      _method: 'GET'
    });
  });

  test('a failure forwards the backend’s message string and nothing else', () => {
    const { adapter, storage } = makeAdapter();
    let seen: unknown = 'nothing';
    adapter.logIn(handle, { username: 'a', password: 'b', success: () => {}, error: (e) => (seen = e) });
    FakeXHR.instances[0].complete(404, { error: 'Invalid username/password.', code: 101 });
    expect(seen).toBe('Invalid username/password.');
    expect(storage[KEY]).toBeUndefined();
  });
});

describe('logOut', () => {
  test('clears the session before succeeding, and says loggedOut after', () => {
    const { adapter, storage } = makeAdapter();
    storage[KEY] = JSON.stringify({ sessionToken: 'r:tok' });

    const order: string[] = [];
    adapter.on('sessionChanged', () => order.push('sessionChanged:' + (storage[KEY] ? 'present' : 'gone')));
    adapter.on('loggedOut', () => order.push('loggedOut'));

    adapter.logOut(handle, { success: () => order.push('success'), error: () => {} });
    FakeXHR.instances[0].complete(200, {});

    expect(order).toEqual(['sessionChanged:gone', 'success', 'loggedOut']);
  });
});

describe('signUp', () => {
  /**
   * ⚠️ **This test asserted the defect until BCN-006 step 4.**
   *
   * It used to expect exactly `{objectId, sessionToken, username, nickname}` —
   * no `email`, no `emailVerified` — because that is what the code did, and the
   * suite was written during step 2 whose whole claim was that nothing changed.
   * It therefore *pinned* the bug: `Current.email` was `undefined` after a
   * sign-up, so the ordinary "we sent a link to {email}" screen rendered
   * `undefined`, and `emailVerified` never populated at all.
   *
   * Both were reproduced live twice on fresh users (BCN-006-007-LIVE-QA §1.1) and
   * pinned at the wire in step 4: `POST /users` answers
   * `{objectId, createdAt, sessionToken}` and nothing else, so whatever the client
   * does not merge is simply lost.
   */
  test('stores the email and a verification flag as well as the username and profile fields', () => {
    const { adapter, storage } = makeAdapter();
    adapter.signUp(handle, {
      username: 'ada',
      password: 'pw',
      email: 'ada@example.com',
      properties: { nickname: 'A' },
      success: () => {},
      error: () => {}
    });
    FakeXHR.instances[0].complete(201, { objectId: 'u1', sessionToken: 'r:tok' });

    expect(JSON.parse(storage[KEY] as string)).toEqual({
      objectId: 'u1',
      sessionToken: 'r:tok',
      username: 'ada',
      nickname: 'A',
      // The caller supplied it and the response cannot carry it.
      email: 'ada@example.com',
      // An account created a millisecond ago cannot have had its address
      // confirmed, so this is a fact about this user rather than a default.
      emailVerified: false
    });
  });

  test('omits `email` entirely when none was supplied, rather than storing undefined', () => {
    const { adapter, storage } = makeAdapter();
    adapter.signUp(handle, { username: 'ada', password: 'pw', success: () => {}, error: () => {} });
    FakeXHR.instances[0].complete(201, { objectId: 'u1', sessionToken: 'r:tok' });

    const stored = JSON.parse(storage[KEY] as string);
    expect('email' in stored).toBe(false);
    expect(stored.emailVerified).toBe(false);
  });

  test('lets the backend and the caller outrank the verification default', () => {
    // Ours never answers `emailVerified`, but a stock Parse Server with
    // verification switched on can — and a project may pass it as a property.
    // Inventing `false` over either would be the fix becoming its own defect.
    const { adapter, storage } = makeAdapter();
    adapter.signUp(handle, {
      username: 'ada',
      password: 'pw',
      properties: { emailVerified: true },
      success: () => {},
      error: () => {}
    });
    FakeXHR.instances[0].complete(201, { objectId: 'u1', sessionToken: 'r:tok' });

    expect(JSON.parse(storage[KEY] as string).emailVerified).toBe(true);
  });

  test('sends the serialised profile fields with the credentials', () => {
    const { adapter } = makeAdapter();
    adapter.signUp(handle, {
      username: 'ada',
      password: 'pw',
      email: 'ada@example.com',
      properties: { nickname: 'A' },
      success: () => {},
      error: () => {}
    });
    expect(JSON.parse(FakeXHR.instances[0].sentBody as string)).toEqual({
      nickname: 'A',
      username: 'ada',
      password: 'pw',
      email: 'ada@example.com'
    });
  });
});

describe('fetchCurrentUser', () => {
  test('stores, announces the change, says sessionGained, then succeeds', () => {
    const { adapter } = makeAdapter();
    const order: string[] = [];
    adapter.on('sessionChanged', () => order.push('sessionChanged'));
    adapter.on('sessionGained', () => order.push('sessionGained'));

    adapter.fetchCurrentUser(handle, { success: () => order.push('success'), error: () => {} });
    FakeXHR.instances[0].complete(200, { objectId: 'u1', sessionToken: 'r:tok' });

    expect(order).toEqual(['sessionChanged', 'sessionGained', 'success']);
  });

  test('a 209 clears storage and says sessionLost — but announces NO session change', () => {
    const { adapter, storage } = makeAdapter();
    storage[KEY] = JSON.stringify({ objectId: 'u1', sessionToken: 'dead' });

    const order: string[] = [];
    adapter.on('sessionChanged', () => order.push('sessionChanged'));
    adapter.on('sessionLost', () => order.push('sessionLost'));

    adapter.fetchCurrentUser(handle, { success: () => {}, error: () => order.push('error') });
    FakeXHR.instances[0].complete(401, { code: 209, error: 'Invalid session token' });

    expect(order).toEqual(['sessionLost', 'error']);
    expect(storage[KEY]).toBeUndefined();
    // No `sessionChanged`, so `UserService.current` keeps pointing at the user
    // who has just turned out to be signed out. Preserved from
    // `userservice.ts:369` — the `User` node clears its own model off
    // `sessionLost`, so nothing visible depends on it, and fixing it here would
    // spend the only signal this move produces.
  });

  test('a non-209 error leaves the session alone', () => {
    const { adapter, storage } = makeAdapter();
    storage[KEY] = JSON.stringify({ sessionToken: 'tok' });
    adapter.fetchCurrentUser(handle, { success: () => {}, error: () => {} });
    FakeXHR.instances[0].complete(500, { error: 'boom' });
    expect(storage[KEY]).toBeDefined();
  });
});

describe('the two endpoints that answer with HTML', () => {
  test('verifyEmail reads its outcome out of the page text', () => {
    const { adapter } = makeAdapter();
    let ok = false;
    adapter.verifyEmail(handle, { username: 'ada', token: 't', success: () => (ok = true), error: () => {} });
    expect(FakeXHR.instances[0].opened).toBe(
      'GET https://backend.example/apps/app-id-123/verify_email?username=ada&token=t'
    );
    FakeXHR.instances[0].complete(200, '<html>Successfully verified your email</html>');
    expect(ok).toBe(true);
  });

  test('resetPassword accepts either of the two success phrases', () => {
    const { adapter } = makeAdapter();
    let ok = false;
    adapter.resetPassword(handle, {
      username: 'ada',
      token: 't',
      newPassword: 'pw',
      success: () => (ok = true),
      error: () => {}
    });
    FakeXHR.instances[0].complete(200, '<html>Successfully updated your password</html>');
    expect(ok).toBe(true);
  });
});

describe('setUserProperties', () => {
  test('never sends the three fields the backend owns', () => {
    const { adapter, storage } = makeAdapter();
    storage[KEY] = JSON.stringify({ objectId: 'u1', sessionToken: 'tok' });

    adapter.setUserProperties(handle, {
      email: 'new@example.com',
      properties: { nickname: 'A', emailVerified: true, createdAt: 'x', updatedAt: 'y' },
      success: () => {},
      error: () => {}
    });

    const sent = JSON.parse(FakeXHR.instances[0].sentBody as string);
    expect(sent).toEqual({ email: 'new@example.com', nickname: 'A' });
    expect(FakeXHR.instances[0].opened).toBe('PUT https://backend.example/users/u1');
  });

  test('does nothing at all when nobody is signed in', () => {
    const { adapter } = makeAdapter();
    adapter.setUserProperties(handle, { properties: { a: 1 }, success: () => {}, error: () => {} });
    expect(FakeXHR.instances).toHaveLength(0);
  });
});

describe('two backends, two sessions', () => {
  test('each handle gets its own store — the phase decided sessions are never shared', () => {
    const storage: Record<string, unknown> = {};
    const adapter = new ParseAuthAdapter({
      serializeObject: (d) => d,
      createStore: (appId) => new SessionStore({ key: `Parse/${appId}/currentUser`, storage, broadcaster: null })
    });
    const other: BackendHandle = { ...handle, id: 'other', publicToken: 'app-id-999' };

    expect(adapter.sessionStore(handle).key).toBe('Parse/app-id-123/currentUser');
    expect(adapter.sessionStore(other).key).toBe('Parse/app-id-999/currentUser');
    expect(adapter.sessionStore(handle)).toBe(adapter.sessionStore(handle));
  });
});

/**
 * The two HTML-page endpoints — **branches no test had ever reached**.
 *
 * BCN-006-007-LIVE-QA §1.2 recorded that its run "did not reach it", and step 2's
 * notes listed the inverted `indexOf` as preserved-on-purpose. Step 4 measured
 * what these endpoints actually do and fixed both the inversion and the worse
 * defect beside it; these are the tests that were not previously possible,
 * because covering a branch requires first deciding what it should do.
 *
 * The page bodies below are the real ones, copied from a running backend.
 */
const VERIFY_OK = '<!doctype html><html><head><title>Verified</title></head><body><h2 class="ok">Successfully verified your email</h2></body></html>';
const VERIFY_BAD =
  '<!doctype html><html><head><meta charset="utf-8"><title>Invalid link</title></head><body>' +
  '<h2 class="err">Invalid Verification Link</h2><p>This verification link is invalid, expired, or already used.</p></body></html>';
const RESET_BAD =
  '<!doctype html><html><head><meta charset="utf-8"><title>Invalid link</title></head><body>' +
  '<h2 class="err">Invalid Link</h2><p>This reset link is invalid, expired, or already used.</p></body></html>';

describe('verifyEmail and resetPassword read an HTML page', () => {
  function run(method: 'verifyEmail' | 'resetPassword', status: number, page: string) {
    const { adapter } = makeAdapter();
    const outcome: string[] = [];
    const options = {
      username: 'ada',
      token: 't',
      newPassword: 'pw',
      success: () => outcome.push('success'),
      error: (e?: string) => outcome.push('error:' + e)
    };
    adapter[method](handle, options as never);
    // The LAST instance — `FakeXHR.instances` is reset per test, not per call, and
    // several of these drive two requests in one test.
    FakeXHR.instances[FakeXHR.instances.length - 1].complete(status, page);
    return outcome;
  }

  test('a success page succeeds', () => {
    expect(run('verifyEmail', 200, VERIFY_OK)).toEqual(['success']);
  });

  test('⚠️ an invalid-link page reports the link, not a phrase found at index 1', () => {
    // The bug: `if (response.indexOf('Invalid Verification Link'))` — a match at
    // index 0 reads as FALSE and an absent phrase (-1) reads as TRUE, so the
    // condition was inverted for every input except a match at index 1 or later.
    // These pages open with `<!doctype html>`, so a match is never at index 0 and
    // the old code limped to the right answer here — while reporting the SAME
    // answer for a page that says nothing of the kind. That is the next test.
    expect(run('verifyEmail', 200, VERIFY_BAD)).toEqual(['error:Invalid verification token']);
  });

  test('⚠️ an unrecognised 200 page no longer claims the token was invalid', () => {
    // This is what the inversion actually cost: `indexOf(...) === -1` is truthy,
    // so ANY page the code could not identify — a login wall, a proxy notice, a
    // maintenance page — was confidently reported as "Invalid verification token"
    // and the third branch was dead code. It now says what it knows.
    expect(run('verifyEmail', 200, '<html><body>502 Bad Gateway</body></html>')).toEqual(['error:Failed to verify email']);
    expect(run('resetPassword', 200, '<html><body>502 Bad Gateway</body></html>')).toEqual(['error:Failed to reset password']);
  });

  test('⚠️ a 400 no longer hands the node an entire HTML document as its error string', () => {
    // The defect that was in no register, found by measurement in step 4: an
    // invalid link answers **400** with the page, `_makeRequest` routes any
    // non-2xx to `error` as `{error: responseText}`, and both methods forwarded
    // it verbatim — so the Verify Email node's `error` output carried
    // `<!doctype html>` and inline CSS for a builder to wire to a text label.
    // `UserServiceCallbacks` is explicit that these two "substitute a message of
    // their own". They did not.
    const verify = run('verifyEmail', 400, VERIFY_BAD);
    expect(verify).toEqual(['error:Invalid verification token']);
    expect(verify[0]).not.toContain('<');

    const reset = run('resetPassword', 400, RESET_BAD);
    expect(reset).toEqual(['error:Invalid or expired reset link']);
    expect(reset[0]).not.toContain('<');
  });

  test('a reset no longer reports a failure about email verification', () => {
    // Both failure strings in `resetPassword` were copied from `verifyEmail`, so
    // a user resetting a password was told their *email* had failed to verify.
    const outcome = run('resetPassword', 200, RESET_BAD);
    expect(outcome).toEqual(['error:Invalid or expired reset link']);
    expect(outcome[0]).not.toContain('email');
  });

  test('a non-HTML error is passed through untouched, because it is already a sentence', () => {
    const { adapter } = makeAdapter();
    const outcome: string[] = [];
    adapter.verifyEmail(handle, {
      username: 'ada',
      token: 't',
      success: () => outcome.push('success'),
      error: (e?: string) => outcome.push('error:' + e)
    });
    FakeXHR.instances[0].complete(500, { error: 'Database is offline' });
    expect(outcome).toEqual(['error:Database is offline']);
  });
});
