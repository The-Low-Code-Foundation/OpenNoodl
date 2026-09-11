/**
 * UNI-001 E1 — the editor's half of the issuer: the device dance, and the store it writes.
 *
 * ───────────────────────────────────────────────────────────────────────────────
 * 🔴 WHAT MAKES THIS WORTH RUNNING RATHER THAN READING. Until this session
 * `readCommunitySession()` returned `null` for every human being alive, because nothing on
 * the platform minted a session and nothing in the editor asked for one — measured, twice:
 * the only `insert into sessions` statements in the whole platform repository were in test
 * files. So the claim under test is not "a token can be read", which was already true and
 * already specced. It is **the editor can obtain one and persist it**, which is new.
 *
 * ⚠️ WHAT IT DOES NOT PROVE, stated so a green run is not over-read:
 *
 *   • Nothing here has spoken to a real `community.nodegx.io`. `fetch` is injected. The
 *     platform's side of these three routes is specced in `tests/uni001-issuer.test.ts` over
 *     there, against a real Postgres — but the two suites agree with each other by both
 *     agreeing with a shape written down twice, and only E9's smoke drive on the deployed box
 *     tests the wire.
 *   • There is NO DOM and NO React in this checkout's jest runner, so the composer's button
 *     is not clicked here. `composer-calls-signin.test.ts` beside this file does the
 *     established thing — source analysis with a negative control derived from the real
 *     current source — and says what that does not prove.
 */

import {
  COMMUNITY_SESSION_KEY,
  clearCommunitySession,
  readCommunitySession,
  writeCommunitySession
} from '../../src/editor/src/models/community/communitysession';
import { signIntoCommunity, signOutOfCommunity } from '../../src/editor/src/models/community/communitysignin';

/** A store that behaves like `JSONStorage` and remembers what it was asked to do. */
function fakeStore() {
  const data = new Map<string, unknown>();
  const removed: string[] = [];
  return {
    data,
    removed,
    get: async (key: string) => data.get(key),
    set: async (key: string, value: { [k: string]: unknown }) => {
      data.set(key, value);
    },
    remove: async (key: string) => {
      removed.push(key);
      data.delete(key);
    }
  };
}

type Call = { url: string; init?: RequestInit };

/** A `fetch` that answers a scripted queue and records what it was asked. */
function scriptedFetch(script: { status?: number; body?: unknown; throws?: unknown }[]) {
  const calls: Call[] = [];
  const impl = (async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    const next = script.shift() ?? { status: 500, body: {} };
    if (next.throws) throw next.throws;
    const status = next.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => next.body
    } as unknown as Response;
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const BEGUN = {
  deviceCode: 'device-secret-abc',
  userCode: 'WXYZ-2468',
  verificationUri: 'https://community.nodegx.io/auth/device',
  expiresIn: 900,
  interval: 5
};

/** No real waiting, and a clock that only moves when `wait` is called. */
function fastClock() {
  let ms = 1_000_000;
  return {
    now: () => ms,
    wait: async (delay: number) => {
      ms += delay;
    }
  };
}

describe('the device sign-in', () => {
  it('begins, opens the browser with the code prefilled, polls, and stores the session', async () => {
    const store = fakeStore();
    const clock = fastClock();
    const opened: string[] = [];
    const progress: unknown[] = [];
    const { impl, calls } = scriptedFetch([
      { status: 201, body: BEGUN },
      { body: { status: 'pending' } },
      { body: { status: 'ready', token: 'session-token-1', handle: 'nia-builds', expiresAt: 'x' } }
    ]);

    const result = await signIntoCommunity((p) => progress.push(p), {
      fetchImpl: impl,
      store,
      openExternal: (url) => opened.push(url),
      wait: clock.wait,
      now: clock.now
    });

    expect(result).toEqual({
      outcome: 'signed-in',
      session: { token: 'session-token-1', handle: 'nia-builds' }
    });

    // 🔴 The credential is PERSISTED, not merely returned — which is the difference between
    // signing in and appearing to. Read back through the reader the composer uses.
    expect(await readCommunitySession(store)).toEqual({ token: 'session-token-1', handle: 'nia-builds' });
    expect(store.data.get(COMMUNITY_SESSION_KEY)).toEqual({ token: 'session-token-1', handle: 'nia-builds' });

    // The user code reaches the person twice: in the URL we open, and in the progress
    // callback the dialog renders. Either alone is a flow somebody can get stuck in.
    expect(opened).toEqual(['https://community.nodegx.io/auth/device?code=WXYZ-2468']);
    expect(progress).toEqual([
      { phase: 'starting' },
      { phase: 'waiting', userCode: 'WXYZ-2468', verificationUri: BEGUN.verificationUri },
      { phase: 'signed-in', handle: 'nia-builds' }
    ]);

    expect(calls.map((c) => c.url)).toEqual([
      'https://community.nodegx.io/api/v1/auth/device',
      'https://community.nodegx.io/api/v1/auth/device/token',
      'https://community.nodegx.io/api/v1/auth/device/token'
    ]);
  });

  it('sends the DEVICE code when polling, never the user code', async () => {
    // 🔴 The two-code split is the security property, and it is one typo away from being
    // undone on this side. `0010`'s header carries the argument: the short code is safe
    // BECAUSE it redeems nothing, which stops being true the moment a client polls with it.
    const store = fakeStore();
    const clock = fastClock();
    const { impl, calls } = scriptedFetch([
      { status: 201, body: BEGUN },
      { body: { status: 'ready', token: 't', handle: 'h', expiresAt: 'x' } }
    ]);
    await signIntoCommunity(() => undefined, { fetchImpl: impl, store, wait: clock.wait, now: clock.now });

    const polled = JSON.parse(String(calls[1].init?.body)) as { deviceCode?: string };
    expect(polled).toEqual({ deviceCode: 'device-secret-abc' });
  });

  it('keeps polling through a transient network failure', async () => {
    // ⚠️ A dropped request mid-poll is a train going into a tunnel, not a failed sign-in.
    const store = fakeStore();
    const clock = fastClock();
    const { impl } = scriptedFetch([
      { status: 201, body: BEGUN },
      { throws: new Error('ENETDOWN') },
      { body: { status: 'ready', token: 'later', handle: 'nia', expiresAt: 'x' } }
    ]);
    const result = await signIntoCommunity(() => undefined, {
      fetchImpl: impl,
      store,
      wait: clock.wait,
      now: clock.now
    });
    expect(result.outcome).toBe('signed-in');
  });

  it('gives up at the platform-stated deadline and stores nothing', async () => {
    const store = fakeStore();
    const clock = fastClock();
    // Ten seconds of life, five-second polls: two polls and then the deadline.
    const { impl, calls } = scriptedFetch([{ status: 201, body: { ...BEGUN, expiresIn: 10 } }]);
    const script: { status?: number; body?: unknown }[] = [];
    void script;
    const pendingForever = (async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return { ok: true, status: 200, json: async () => ({ status: 'pending' }) } as unknown as Response;
    }) as unknown as typeof fetch;

    let first = true;
    const combined = (async (url: string, init?: RequestInit) => {
      if (first) {
        first = false;
        return impl(url as never, init as never);
      }
      return pendingForever(url as never, init as never);
    }) as unknown as typeof fetch;

    const result = await signIntoCommunity(() => undefined, {
      fetchImpl: combined,
      store,
      wait: clock.wait,
      now: clock.now
    });
    expect(result).toEqual({ outcome: 'expired' });
    expect(store.data.size).toBe(0);
  });

  it('reports the platform saying `expired` without waiting out the clock', async () => {
    const store = fakeStore();
    const clock = fastClock();
    const { impl } = scriptedFetch([
      { status: 201, body: BEGUN },
      { body: { status: 'expired' } }
    ]);
    expect(
      await signIntoCommunity(() => undefined, { fetchImpl: impl, store, wait: clock.wait, now: clock.now })
    ).toEqual({ outcome: 'expired' });
  });

  it('stops when the caller cancels, and stores nothing', async () => {
    // 🔴 Without this the poll loop outlives a dismissed dialog by up to fifteen minutes,
    // hitting the platform every five seconds for a window nobody is looking at.
    const store = fakeStore();
    const clock = fastClock();
    let cancelled = false;
    const { impl, calls } = scriptedFetch([
      { status: 201, body: BEGUN },
      { body: { status: 'pending' } }
    ]);
    const result = await signIntoCommunity(
      (p) => {
        if (p.phase === 'waiting') cancelled = true;
      },
      { fetchImpl: impl, store, wait: clock.wait, now: clock.now, isCancelled: () => cancelled }
    );
    expect(result).toEqual({ outcome: 'cancelled' });
    expect(store.data.size).toBe(0);
    // Only the begin call went out: cancellation is checked before the first poll.
    expect(calls).toHaveLength(1);
  });

  it('an unreachable platform is a failure with a sentence, not a throw', async () => {
    const store = fakeStore();
    const { impl } = scriptedFetch([{ throws: new Error('getaddrinfo ENOTFOUND') }]);
    const result = await signIntoCommunity(() => undefined, { fetchImpl: impl, store });
    expect(result.outcome).toBe('failed');
    expect(result.outcome === 'failed' && result.detail).toContain('ENOTFOUND');
  });

  it('a begin response with no code in it is a failure, not a pairing that can never complete', async () => {
    const store = fakeStore();
    const { impl } = scriptedFetch([{ status: 201, body: { verificationUri: 'https://x' } }]);
    const result = await signIntoCommunity(() => undefined, { fetchImpl: impl, store });
    expect(result.outcome).toBe('failed');
  });
});

describe('the store', () => {
  it('refuses to write a blank token', async () => {
    // 🔴 A blank would make the raw key say "signed in" and the reader say "signed out" —
    // two answers to one question, and the reader is the one the composer believes.
    const store = fakeStore();
    await expect(writeCommunitySession({ token: '   ' }, store)).rejects.toThrow();
    expect(store.data.size).toBe(0);
  });

  it('round-trips through the reader, with and without a handle', async () => {
    const store = fakeStore();
    await writeCommunitySession({ token: '  padded  ', handle: 'nia' }, store);
    expect(await readCommunitySession(store)).toEqual({ token: 'padded', handle: 'nia' });

    await writeCommunitySession({ token: 'no-handle' }, store);
    expect(await readCommunitySession(store)).toEqual({ token: 'no-handle', handle: undefined });
  });

  it('clearing removes the key, and the reader then says signed out', async () => {
    const store = fakeStore();
    await writeCommunitySession({ token: 'live' }, store);
    await clearCommunitySession(store);
    expect(store.removed).toEqual([COMMUNITY_SESSION_KEY]);
    expect(await readCommunitySession(store)).toBeNull();
  });
});

describe('signing out', () => {
  it('revokes on the platform FIRST, then forgets locally', async () => {
    // 🔴 The order is the whole function: clearing first strands a live session nobody holds
    // a handle on. Asserted by requiring the revoke call to have carried the token, which is
    // only possible if it happened before the clear.
    const store = fakeStore();
    await writeCommunitySession({ token: 'live-token', handle: 'nia' }, store);
    const { impl, calls } = scriptedFetch([{ status: 200, body: { ok: true } }]);

    const result = await signOutOfCommunity({ fetchImpl: impl, store, readStore: store });

    expect(result).toEqual({ revokedOnPlatform: true });
    expect(calls[0].url).toBe('https://community.nodegx.io/api/auth/signout');
    expect((calls[0].init?.headers as Record<string, string>).authorization).toBe('Bearer live-token');
    expect(await readCommunitySession(store)).toBeNull();
  });

  it('forgets locally even when the platform cannot be reached', async () => {
    // ⚠️ Somebody on a plane must still be able to sign out of their own editor. The token is
    // inert here afterwards; the row lives on until it expires, and that is the lesser harm.
    const store = fakeStore();
    await writeCommunitySession({ token: 'live-token' }, store);
    const { impl } = scriptedFetch([{ throws: new Error('offline') }]);

    expect(await signOutOfCommunity({ fetchImpl: impl, store, readStore: store })).toEqual({
      revokedOnPlatform: false
    });
    expect(await readCommunitySession(store)).toBeNull();
  });

  it('signing out when already signed out calls nothing and still clears', async () => {
    const store = fakeStore();
    const { impl, calls } = scriptedFetch([]);
    expect(await signOutOfCommunity({ fetchImpl: impl, store, readStore: store })).toEqual({
      revokedOnPlatform: false
    });
    expect(calls).toEqual([]);
  });
});
