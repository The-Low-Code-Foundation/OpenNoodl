/**
 * UNI-007 AC1 — the client's four `/api/v1/me` intake-and-path calls, and the two status codes
 * that had no home in the mapping table until this caller needed them.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🔴 **THIS FILE IS THE EVIDENCE FOR A DEFECT THAT SHIPPED, not only for a feature.**
 *
 * `Read<T>` had three outcomes and `get()` had no `401` branch, so a 401 fell through to
 * `!response.ok` and reported as `unreachable`. Nothing exercised it: every read on this API
 * answers `200` for a null viewer *on purpose*, because D15's refusal is a `404` and a
 * signed-out pull has to be indistinguishable from a member with an empty list.
 * `GET /api/v1/me/path` is **the first read on this API that answers `401`** — a path is
 * nobody's but its owner's — and it walked straight into the hole.
 *
 * The same shape one status along on the write side: `post()` mapped `400/403/429` and let
 * `409` fall through. `POST /api/v1/me/path/project` answers
 * `409 {error: "take the intake first"}`, which is a sentence a learner can act on, and it
 * arrived as *"could not reach the community"*.
 *
 * ⚠️ **Both are asserted against a control that must DISAGREE**, never alone. "401 produces
 * some outcome" passes against the defect; "401 and a dead socket produce *different*
 * outcomes" does not.
 */

import {
  CommunityApiClient,
  type IntakeState,
  type PathState
} from '@noodl-models/community/communityapi';

type Route = { status: number; body?: unknown; text?: string };

function fakeFetch(routes: Record<string, Route>): {
  impl: typeof fetch;
  calls: { url: string; method: string; body: string | null; headers: Record<string, string> }[];
} {
  const calls: { url: string; method: string; body: string | null; headers: Record<string, string> }[] = [];
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({
      url,
      method: init?.method ?? 'GET',
      body: (init?.body as string | undefined) ?? null,
      headers: (init?.headers ?? {}) as Record<string, string>
    });
    const path = url.replace(/^https?:\/\/[^/]+/, '');
    const route = routes[path];
    if (!route) return new Response('no route', { status: 500 });
    if (route.text !== undefined) return new Response(route.text, { status: route.status });
    return new Response(JSON.stringify(route.body ?? {}), {
      status: route.status,
      headers: { 'content-type': 'application/json' }
    });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const INTAKE: IntakeState = {
  questions: [
    {
      key: 'logic',
      prompt: 'When something gets complicated, which would you rather do?',
      options: [
        { value: 'visual', label: 'Wire it up visually so I can see it' },
        { value: 'code', label: 'Write a few lines of code' }
      ]
    }
  ],
  answers: null
};

const EMPTY_PATH: PathState = { intake: null, path: null };

describe('the read that answers 401', () => {
  it('is `unauthenticated`, and a dead socket is NOT — the two must disagree', async () => {
    const { impl } = fakeFetch({
      '/api/v1/me/path': { status: 401, body: { error: 'sign in to see your path' } }
    });
    const expired = await new CommunityApiClient({ baseUrl: 'https://x', fetchImpl: impl, token: 'stale' }).path();

    const dead = (async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    const offline = await new CommunityApiClient({ baseUrl: 'https://x', fetchImpl: dead }).path();

    expect(expired.outcome).toBe('unauthenticated');
    expect(offline.outcome).toBe('unreachable');
    // 🔴 The assertion that would have failed before 2026-08-20: both were `unreachable`.
    expect(expired.outcome).not.toBe(offline.outcome);
  });

  it('keeps 404 as `absent`, so D15’s refusal is still not narrated', async () => {
    // ⚠️ The 401 branch is checked BEFORE the 404 one. This proves adding it did not swallow
    // the refusal that must draw nothing at all.
    const { impl } = fakeFetch({ '/api/v1/me/path': { status: 404 } });
    const read = await new CommunityApiClient({ baseUrl: 'https://x', fetchImpl: impl }).path();
    expect(read.outcome).toBe('absent');
  });

  it('leaves an ordinary 500 as `unreachable` with its status', async () => {
    const { impl } = fakeFetch({ '/api/v1/me/path': { status: 503 } });
    const read = await new CommunityApiClient({ baseUrl: 'https://x', fetchImpl: impl }).path();
    if (read.outcome !== 'unreachable') throw new Error(`expected unreachable, got ${read.outcome}`);
    expect(read.status).toBe(503);
  });
});

describe('the write that answers 409', () => {
  it('is a `refused` carrying the platform’s own sentence, not a network error', async () => {
    const { impl } = fakeFetch({
      '/api/v1/me/path/project': { status: 409, body: { error: 'take the intake first' } }
    });
    const write = await new CommunityApiClient({ baseUrl: 'https://x', fetchImpl: impl, token: 't' }).projectConcept(
      'state'
    );

    if (write.outcome !== 'refused') throw new Error(`expected refused, got ${write.outcome}`);
    // 🔴 The platform chooses these words so the caller learns enough to FIX it. Substituting
    // our own would lose the actionable half — `bench-http.ts` argues the same from its side.
    expect(write.detail).toBe('take the intake first');
  });

  it('a 409 and a genuine outage do not read the same', async () => {
    const { impl } = fakeFetch({
      '/api/v1/me/path/project': { status: 409, body: { error: 'take the intake first' } }
    });
    const refused = await new CommunityApiClient({ baseUrl: 'https://x', fetchImpl: impl, token: 't' }).projectConcept(
      'state'
    );
    const { impl: down } = fakeFetch({ '/api/v1/me/path/project': { status: 502 } });
    const outage = await new CommunityApiClient({ baseUrl: 'https://x', fetchImpl: down, token: 't' }).projectConcept(
      'state'
    );

    expect(refused.outcome).toBe('refused');
    expect(outage.outcome).toBe('unreachable');
    expect(refused.outcome).not.toBe(outage.outcome);
  });
});

describe('the intake read', () => {
  it('sends NO authorization header when there is no token, and still gets the questions', async () => {
    // 🔴 The one read on this client that is useful signed out. An editor that authenticated
    // first would make signing in a prerequisite for seeing what it is for.
    const { impl, calls } = fakeFetch({ '/api/v1/me/intake': { status: 200, body: INTAKE } });
    const read = await new CommunityApiClient({ baseUrl: 'https://x', fetchImpl: impl }).intake();

    if (read.outcome !== 'ok') throw new Error(`expected ok, got ${read.outcome}`);
    expect(read.value.questions).toHaveLength(1);
    expect(read.value.answers).toBeNull();
    expect(calls[0].headers.authorization).toBeUndefined();
  });

  it('carries the token when there is one', async () => {
    const { impl, calls } = fakeFetch({ '/api/v1/me/intake': { status: 200, body: INTAKE } });
    await new CommunityApiClient({ baseUrl: 'https://x', fetchImpl: impl, token: 'abc' }).intake();
    expect(calls[0].headers.authorization).toBe('Bearer abc');
  });
});

describe('the path read', () => {
  it('reads "no intake yet" as a value, not as an error', async () => {
    // ⚠️ `{intake: null, path: null}` and NOT a 404 — nothing is missing at that URL, the
    // learner has simply not answered. A client that treated it as `absent` would hide the
    // form that is the whole next move.
    const { impl } = fakeFetch({ '/api/v1/me/path': { status: 200, body: EMPTY_PATH } });
    const read = await new CommunityApiClient({ baseUrl: 'https://x', fetchImpl: impl, token: 't' }).path();

    if (read.outcome !== 'ok') throw new Error(`expected ok, got ${read.outcome}`);
    expect(read.value.path).toBeNull();
    expect(read.value.intake).toBeNull();
  });
});

describe('the two writes', () => {
  it('posts the answers under an `answers` key, which is what the route parses', async () => {
    const { impl, calls } = fakeFetch({
      '/api/v1/me/intake': { status: 200, body: { answers: { experience: 'none', logic: 'visual', building: 'data-app' } } }
    });
    await new CommunityApiClient({ baseUrl: 'https://x', fetchImpl: impl, token: 't' }).submitIntake({
      experience: 'none',
      logic: 'visual',
      building: 'data-app'
    });

    expect(calls[0].method).toBe('POST');
    expect(JSON.parse(calls[0].body as string)).toEqual({
      answers: { experience: 'none', logic: 'visual', building: 'data-app' }
    });
  });

  it('carries `fresh` through, which is the only evidence "one call ever" held', async () => {
    // 🔴 Two calls for one concept return the SAME prose with `fresh: false` on the second.
    // A client that dropped the field could not tell that from having made two calls, because
    // both answers would be equally plausible.
    const { impl } = fakeFetch({
      '/api/v1/me/path/project': {
        status: 200,
        body: {
          concept: 'state',
          outcome: { kind: 'ready', projection: 'Think of it as your `let x = 0`.', model: 'claude-sonnet-5', fresh: false }
        }
      }
    });
    const write = await new CommunityApiClient({ baseUrl: 'https://x', fetchImpl: impl, token: 't' }).projectConcept(
      'state'
    );

    if (write.outcome !== 'ok') throw new Error(`expected ok, got ${write.outcome}`);
    if (write.value.outcome.kind !== 'ready') throw new Error('expected a ready projection');
    expect(write.value.outcome.fresh).toBe(false);
  });

  it('reads D10’s refusal off the 200 body — a refusal is an OUTCOME here, not a status', async () => {
    // ⚠️ Worth stating: `refused` in a `ProjectionOutcome` arrives inside a 200. The route
    // succeeded; the projection was declined. A client that only looked at statuses would
    // report this as success with an empty projection and draw nothing.
    const { impl } = fakeFetch({
      '/api/v1/me/path/project': {
        status: 200,
        body: { concept: 'state', outcome: { kind: 'refused', reason: 'this account is managed by an organisation' } }
      }
    });
    const write = await new CommunityApiClient({ baseUrl: 'https://x', fetchImpl: impl, token: 't' }).projectConcept(
      'state'
    );

    if (write.outcome !== 'ok') throw new Error(`expected ok, got ${write.outcome}`);
    expect(write.value.outcome.kind).toBe('refused');
  });

  it('an expired token on a write is `unauthenticated`, as it always was', async () => {
    const { impl } = fakeFetch({ '/api/v1/me/path/project': { status: 401 } });
    const write = await new CommunityApiClient({ baseUrl: 'https://x', fetchImpl: impl, token: 'stale' }).projectConcept(
      'state'
    );
    expect(write.outcome).toBe('unauthenticated');
  });
});
