/**
 * UNI-016 — the editor's first WRITE, and the credential it does not have.
 *
 * 🔴 **`CommunityApiClient` HAD NO CALLER OUTSIDE ITS OWN SPEC UNTIL THIS SESSION**, and
 * neither did the platform's `attachToPost`. The handover for this task said the composer
 * *"already holds"* a bearer token and that the platform *"can receive artifact posts"*; both
 * were false, in the same shape — *build the caller*, the ninth and tenth instances this phase
 * has recorded. This file exists so the write path has one.
 *
 * ───────────────────────────────────────────────────────────────────────────────
 * WHAT IS GRADED HERE, AND WHY EACH ONE IS NOT OBVIOUS
 *
 *  1. **The five outcomes are distinguished, and `absent` is not an error.** A 404 from a
 *     write is D15 refusing an org-minor with the same 404 the read gets — deliberately, so
 *     *"a pupil is not told a door exists."* A client that reported "posting failed, retry"
 *     would narrate the door in the one place nobody would look for a D15 decision.
 *  2. **401 is its own outcome, not `unreachable`.** Signed-out is a fact the caller can act
 *     on; folding it into a transport failure tells somebody their network is down.
 *  3. **A refusal carries the PLATFORM's words.** `bench-http.ts` chooses them through one
 *     table so a caller learns enough to fix its input and nothing about D15.
 *  4. 🔴 **The bearer header is present when there is a token and ABSENT when there is not** —
 *     asserted beside its own control, because "no authorization header" and "an authorization
 *     header the server rejected" are indistinguishable from the client's side and have
 *     opposite fixes.
 *  5. **The session store never throws**, whatever is in it. Its caller's signed-out path is a
 *     working feature (AC5), so every malformed record must mean *not signed in* rather than
 *     an exception inside a dialog's `useEffect`.
 */

import {
  CommunityApiClient,
  type AskAccepted,
  type Write
} from '../../src/editor/src/models/community/communityapi';
import {
  COMMUNITY_SESSION_KEY,
  readCommunitySession
} from '../../src/editor/src/models/community/communitysession';

type Call = { url: string; init: RequestInit };

/** A fetch that records what it was asked, and answers with what the test wants. */
function fetchStub(reply: { status: number; body?: unknown; throws?: unknown }) {
  const calls: Call[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url: String(url), init });
    if (reply.throws) throw reply.throws;
    return {
      status: reply.status,
      ok: reply.status >= 200 && reply.status < 300,
      json: async () => reply.body
    } as unknown as Response;
  }) as unknown as typeof fetch;
  return { calls, impl };
}

const ATTACHMENTS = [
  {
    kind: 'node_excerpt' as const,
    payload: { nodeType: 'For Each', ports: [], withheldPorts: [{ direction: 'input' }] }
  }
];

function ask(client: CommunityApiClient): Promise<Write<AskAccepted>> {
  return client.askQuestion({
    section: 'help',
    title: 'For Each draws one row',
    body: 'It stops after the first.',
    attachments: ATTACHMENTS
  });
}

describe('the write reaches the route the platform serves', () => {
  it('POSTs the section, title, body and attachments as one JSON document', async () => {
    const stub = fetchStub({
      status: 201,
      body: { threadId: 't-1', postId: 'p-1', pointsAwarded: 14 }
    });
    const result = await ask(
      new CommunityApiClient({ baseUrl: 'https://community.nodegx.io', token: 'tok', fetchImpl: stub.impl })
    );

    expect(result).toEqual({
      outcome: 'ok',
      value: { threadId: 't-1', postId: 'p-1', pointsAwarded: 14 }
    });

    const [call] = stub.calls;
    expect(call.url).toBe('https://community.nodegx.io/api/v1/bench/threads');
    expect(call.init.method).toBe('POST');
    expect(JSON.parse(String(call.init.body))).toEqual({
      section: 'help',
      title: 'For Each draws one row',
      body: 'It stops after the first.',
      attachments: ATTACHMENTS
    });
  });

  it('an answer goes to the thread’s own posts route, with the id encoded', async () => {
    const stub = fetchStub({ status: 201, body: { postId: 'p-2', pointsAwarded: 5 } });
    await new CommunityApiClient({ baseUrl: 'https://x', token: 'tok', fetchImpl: stub.impl }).answer(
      'a b/c',
      { body: 'Try Static Data.' }
    );
    expect(stub.calls[0].url).toBe('https://x/api/v1/bench/threads/a%20b%2Fc/posts');
  });
});

describe('the credential', () => {
  it('sends a bearer header when there is a token', async () => {
    const stub = fetchStub({ status: 201, body: {} });
    await ask(new CommunityApiClient({ baseUrl: 'https://x', token: 'tok-abc', fetchImpl: stub.impl }));
    expect((stub.calls[0].init.headers as Record<string, string>).authorization).toBe('Bearer tok-abc');
  });

  /**
   * 🔴 THE CONTROL THE ONE ABOVE NEEDS. An assertion that a header IS sent passes on a client
   * that sends it unconditionally — including one that would send `Bearer null`. The two
   * states are indistinguishable at the server and have opposite fixes.
   */
  it('control — sends NO authorization header when there is no token', async () => {
    const stub = fetchStub({ status: 401, body: { error: 'sign in to post' } });
    await ask(new CommunityApiClient({ baseUrl: 'https://x', fetchImpl: stub.impl }));
    expect(stub.calls[0].init.headers).not.toHaveProperty('authorization');
  });

  it('sends the content type, or the route reads no body at all', async () => {
    const stub = fetchStub({ status: 201, body: {} });
    await ask(new CommunityApiClient({ baseUrl: 'https://x', token: 't', fetchImpl: stub.impl }));
    expect((stub.calls[0].init.headers as Record<string, string>)['content-type']).toBe('application/json');
  });
});

describe('the five outcomes are five, and each says something different', () => {
  it('401 is `unauthenticated` — a fact about this attempt, not about the network', async () => {
    const stub = fetchStub({ status: 401, body: { error: 'sign in to post' } });
    const result = await ask(new CommunityApiClient({ baseUrl: 'https://x', fetchImpl: stub.impl }));
    expect(result).toEqual({ outcome: 'unauthenticated' });
  });

  /**
   * 🔴 D15. The platform answers an org-minor's POST with a 404 rather than a 403 so that the
   * refusal names no rule. `absent` carries no detail for the same reason: there is nothing
   * the client may add without reconstructing what was withheld.
   */
  it('404 is `absent`, carries no detail, and is NOT an error', async () => {
    const stub = fetchStub({ status: 404, body: { error: 'not found' } });
    const result = await ask(new CommunityApiClient({ baseUrl: 'https://x', token: 't', fetchImpl: stub.impl }));
    expect(result).toEqual({ outcome: 'absent' });
  });

  it('400 is `refused`, and carries the platform’s own sentence unedited', async () => {
    const stub = fetchStub({
      status: 400,
      body: { error: 'that attachment is missing a field its kind requires' }
    });
    const result = await ask(new CommunityApiClient({ baseUrl: 'https://x', token: 't', fetchImpl: stub.impl }));
    expect(result).toEqual({
      outcome: 'refused',
      detail: 'that attachment is missing a field its kind requires'
    });
  });

  it('403 is `refused` too — a banned account is told, and told nothing else', async () => {
    const stub = fetchStub({ status: 403, body: { error: 'this account may not post' } });
    const result = await ask(new CommunityApiClient({ baseUrl: 'https://x', token: 't', fetchImpl: stub.impl }));
    expect(result).toEqual({ outcome: 'refused', detail: 'this account may not post' });
  });

  it('a refusal whose body is not JSON still reports a refusal, not a crash', async () => {
    const impl = (async () =>
      ({
        status: 400,
        ok: false,
        json: async () => {
          throw new Error('not json');
        }
      }) as unknown as Response) as unknown as typeof fetch;
    const result = await ask(new CommunityApiClient({ baseUrl: 'https://x', token: 't', fetchImpl: impl }));
    expect(result).toEqual({ outcome: 'refused', detail: 'HTTP 400' });
  });

  it('a 500 is `unreachable` and keeps its status, so a report can name it', async () => {
    const stub = fetchStub({ status: 500, body: {} });
    const result = await ask(new CommunityApiClient({ baseUrl: 'https://x', token: 't', fetchImpl: stub.impl }));
    expect(result).toEqual({ outcome: 'unreachable', status: 500, detail: 'HTTP 500' });
  });

  it('a thrown fetch is `unreachable` with a null status — the platform is deployed nowhere', async () => {
    const stub = fetchStub({ status: 0, throws: new Error('ENOTFOUND') });
    const result = await ask(new CommunityApiClient({ baseUrl: 'https://x', token: 't', fetchImpl: stub.impl }));
    expect(result.outcome).toBe('unreachable');
    expect(result).toMatchObject({ status: null });
  });
});

describe('the session store — every failure means “not signed in”', () => {
  const store = (value: unknown) => ({ get: async () => value });

  /**
   * 🔴 THE STATE OF THE WORLD, PINNED AS A TEST. UNI-001 has no issuer: no code anywhere mints
   * a session, and on the platform the only `insert into sessions` statements are in test
   * files. So an empty store is what every real user has, and `null` — not an exception, not a
   * placeholder — is the right answer. When UNI-001 lands, this is the spec that will need a
   * sibling rather than a rewrite.
   */
  it('an empty store is signed out', async () => {
    await expect(readCommunitySession(store(undefined))).resolves.toBeNull();
    await expect(readCommunitySession(store(null))).resolves.toBeNull();
  });

  it('reads the token and the handle when both are there', async () => {
    await expect(
      readCommunitySession(store({ token: '  tok-abc  ', handle: 'nia-builds' }))
    ).resolves.toEqual({ token: 'tok-abc', handle: 'nia-builds' });
  });

  it('a handle-less session is still a session', async () => {
    await expect(readCommunitySession(store({ token: 'tok' }))).resolves.toEqual({
      token: 'tok',
      handle: undefined
    });
  });

  /**
   * ⚠️ A blank token is signed OUT, not signed in with an empty credential. An empty string
   * builds `authorization: Bearer ` perfectly well, the platform answers 401, and the composer
   * would then tell a user with a corrupted record that the server rejected them — after a
   * round trip — instead of showing them the browser route immediately.
   */
  it('a blank or whitespace token is signed out', async () => {
    await expect(readCommunitySession(store({ token: '' }))).resolves.toBeNull();
    await expect(readCommunitySession(store({ token: '   ' }))).resolves.toBeNull();
  });

  it('a malformed record is signed out rather than an exception', async () => {
    await expect(readCommunitySession(store('a string'))).resolves.toBeNull();
    await expect(readCommunitySession(store(42))).resolves.toBeNull();
    await expect(readCommunitySession(store({ token: 12345 }))).resolves.toBeNull();
    await expect(readCommunitySession(store({ handle: 'nia' }))).resolves.toBeNull();
  });

  it('a store that REJECTS is signed out, and does not throw into a useEffect', async () => {
    const throwing = {
      get: async () => {
        throw new Error('storage unavailable');
      }
    };
    await expect(readCommunitySession(throwing)).resolves.toBeNull();
  });

  it('reads the one key, so UNI-001 has one place to write', async () => {
    let asked = '';
    await readCommunitySession({
      get: async (key: string) => {
        asked = key;
        return null;
      }
    });
    expect(asked).toBe(COMMUNITY_SESSION_KEY);
  });
});
