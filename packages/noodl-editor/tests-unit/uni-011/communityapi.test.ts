/**
 * UNI-011 — the mirror decides nothing.
 *
 * 🔴 THE CENTRAL PROPERTY IS A NEGATIVE ONE, and negatives are the shape this phase keeps
 * getting wrong. D15 ruled that the visibility rule lives *behind the API* rather than in each
 * client — *"an editor build that decides for itself is one release away from disagreeing with
 * the web"* — and D16 put the entry-point decision in the same place. A client that happens to
 * agree with the API today is indistinguishable, from every test you would naturally write,
 * from a client that reads the API. Both render the right thing.
 *
 * So the payloads below are deliberately **self-contradictory**: an `entryPoint` that
 * disagrees with its own components, and a `present` surface with no capabilities on it. A
 * client that recomputed would produce the "sensible" answer; this one must produce the one it
 * was given. That is the only version of this assertion that can fail.
 */
import {
  CommunityApiClient,
  entryPointFor,
  poll,
  type CommunityHome,
  type MeResponse,
  type ThresholdResponse
} from '@noodl-models/community/communityapi';

type Route = { status: number; body?: unknown; text?: string };

function fakeFetch(routes: Record<string, Route>): {
  impl: typeof fetch;
  calls: { url: string; headers: Record<string, string> }[];
} {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, headers: (init?.headers ?? {}) as Record<string, string> });
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

const PRESENT_ME: MeResponse = {
  viewer: { handle: 'ada-builds', kind: 'individual' },
  community: {
    surface: 'present',
    capabilities: { readThreads: true, postThread: true }
  }
};

/**
 * 🔴 A threshold reading that CONTRADICTS ITSELF: nothing is met, and the entry point says
 * mirror. Only a client reading the field can produce `in-editor-mirror` from this.
 */
const CONTRADICTORY_THRESHOLD: ThresholdResponse = {
  met: false,
  entryPoint: 'in-editor-mirror',
  threads: { value: 0, required: 30, met: false },
  consecutiveWeeksWithCall: { value: 0, required: 3, met: false },
  medianFirstReply: {
    medianHours: null,
    requiredBelowHours: 24,
    n: 0,
    unreplied: 0,
    minimumSample: 10,
    met: false
  },
  source: { forum: 'absent' }
};

describe('UNI-011 — the editor client', () => {
  describe('it decides nothing', () => {
    it('follows entryPoint even when every component contradicts it', async () => {
      const { impl } = fakeFetch({
        '/api/v1/community/threshold': { status: 200, body: CONTRADICTORY_THRESHOLD }
      });
      const client = new CommunityApiClient({ baseUrl: 'https://community.nodegx.dev', fetchImpl: impl });

      expect(entryPointFor(await client.threshold())).toBe('in-editor-mirror');
    });

    it('follows entryPoint the other way too', async () => {
      // ⚠️ The mirror of the case above, and it is not redundant: a client hard-coded to
      // return 'in-editor-mirror' would pass the first test. A control pair proves what you
      // varied, and what varies here is the field.
      const { impl } = fakeFetch({
        '/api/v1/community/threshold': {
          status: 200,
          body: { ...CONTRADICTORY_THRESHOLD, met: true, entryPoint: 'browser' }
        }
      });
      const client = new CommunityApiClient({ baseUrl: 'https://community.nodegx.dev', fetchImpl: impl });

      expect(entryPointFor(await client.threshold())).toBe('browser');
    });

    it('reports the capabilities it was given, including a present surface with none', async () => {
      const { impl } = fakeFetch({
        '/api/v1/me': {
          status: 200,
          body: { viewer: null, community: { surface: 'present', capabilities: {} } }
        }
      });
      const client = new CommunityApiClient({ baseUrl: 'https://x', fetchImpl: impl });
      const read = await client.me();

      expect(read.outcome).toBe('ok');
      expect(read.outcome === 'ok' && read.value.community.surface).toBe('present');
      // 🔴 Not "absent". The client does not upgrade an empty capability map into an absent
      // surface, because that is a rule, and rules live behind the API.
      expect(read.outcome === 'ok' && read.value.community).toEqual({
        surface: 'present',
        capabilities: {}
      });
    });
  });

  describe('the three outcomes of a community read', () => {
    it('a 404 is `absent`, not an error', async () => {
      const { impl } = fakeFetch({ '/api/v1/community/home': { status: 404, body: { error: 'not found' } } });
      const client = new CommunityApiClient({ baseUrl: 'https://x', fetchImpl: impl });

      // 🔴 If this were modelled as a failure, a pupil whose school switched the community off
      // would see a "could not reach the community" banner — an error message about a surface
      // D15 says must not appear to them at all.
      expect((await client.home()).outcome).toBe('absent');
    });

    it('a 500 is `unreachable` and carries the status', async () => {
      const { impl } = fakeFetch({ '/api/v1/community/home': { status: 503, text: 'nope' } });
      const client = new CommunityApiClient({ baseUrl: 'https://x', fetchImpl: impl });
      const read = await client.home();

      expect(read.outcome).toBe('unreachable');
      expect(read.outcome === 'unreachable' && read.status).toBe(503);
    });

    it('a network failure is `unreachable`, not a throw', async () => {
      const impl = (async () => {
        throw new Error('ENOTFOUND community.nodegx.dev');
      }) as unknown as typeof fetch;
      const client = new CommunityApiClient({ baseUrl: 'https://community.nodegx.dev', fetchImpl: impl });
      const read = await client.home();

      // ⚠️ The domain is genuinely unregistered today (UNI-001), so this is the ordinary case
      // rather than the exceptional one, and an editor that threw here would be broken for
      // every user until the day it is bought.
      expect(read.outcome).toBe('unreachable');
      expect(read.outcome === 'unreachable' && read.status).toBeNull();
    });

    it('malformed JSON is `unreachable`, not a crash', async () => {
      const { impl } = fakeFetch({ '/api/v1/community/home': { status: 200, text: 'not json' } });
      const client = new CommunityApiClient({ baseUrl: 'https://x', fetchImpl: impl });

      expect((await client.home()).outcome).toBe('unreachable');
    });

    it('an unreachable threshold still sends the entry point somewhere real', async () => {
      const impl = (async () => {
        throw new Error('offline');
      }) as unknown as typeof fetch;
      const client = new CommunityApiClient({ baseUrl: 'https://x', fetchImpl: impl });

      // D16: the entry point exists either way and always goes somewhere real.
      expect(entryPointFor(await client.threshold())).toBe('browser');
    });
  });

  describe('the transport', () => {
    it('sends a bearer token when it has one, and none when it does not', async () => {
      const withToken = fakeFetch({ '/api/v1/me': { status: 200, body: PRESENT_ME } });
      await new CommunityApiClient({ baseUrl: 'https://x', token: 'tok', fetchImpl: withToken.impl }).me();
      expect(withToken.calls[0].headers.authorization).toBe('Bearer tok');

      const without = fakeFetch({ '/api/v1/me': { status: 200, body: PRESENT_ME } });
      await new CommunityApiClient({ baseUrl: 'https://x', fetchImpl: without.impl }).me();
      expect(without.calls[0].headers.authorization).toBeUndefined();
    });

    it('is GET-only — nothing in this client writes', async () => {
      const routes: Record<string, Route> = {
        '/api/v1/me': { status: 200, body: PRESENT_ME },
        '/api/v1/community/home': { status: 200, body: {} },
        '/api/v1/community/threads': { status: 200, body: { forum: 'absent', reason: 'x' } },
        '/api/v1/community/threshold': { status: 200, body: CONTRADICTORY_THRESHOLD },
        '/api/v1/me/assignments': { status: 200, body: { assignments: [] } }
      };
      const { impl, calls } = fakeFetch(routes);
      const client = new CommunityApiClient({ baseUrl: 'https://x', fetchImpl: impl });

      await Promise.all([client.me(), client.home(), client.threads(), client.threshold(), client.assignments()]);

      // 🔴 D15's ceiling is that no write path exists to be switched on. The editor half of
      // that is this: the client has no method that could post, so there is nothing for a
      // capability flag to enable even if one arrived saying `postThread: true`.
      expect(calls).toHaveLength(5);
      expect(calls.every((c) => c.url.startsWith('https://x/api/v1/'))).toBe(true);
    });

    it('trims a trailing slash off the base URL', async () => {
      const { impl, calls } = fakeFetch({ '/api/v1/me': { status: 200, body: PRESENT_ME } });
      await new CommunityApiClient({ baseUrl: 'https://x/', fetchImpl: impl }).me();

      expect(calls[0].url).toBe('https://x/api/v1/me');
    });
  });

  describe('the poll', () => {
    it('owns no clock — the caller supplies it, and stop actually stops', () => {
      let scheduled: (() => void) | null = null;
      let cleared = false;
      const stop = poll(
        async () => ({ outcome: 'ok', value: 1 }) as const,
        () => undefined,
        {
          everyMs: 60_000,
          setIntervalImpl: ((fn: () => void) => {
            scheduled = fn;
            return 7 as unknown as ReturnType<typeof setInterval>;
          }) as unknown as typeof setInterval,
          clearIntervalImpl: ((handle: unknown) => {
            cleared = handle === 7;
          }) as unknown as typeof clearInterval
        }
      );

      expect(scheduled).not.toBeNull();
      stop();
      expect(cleared).toBe(true);
    });
  });

  describe('the composed home', () => {
    it('carries the threshold the API computed, not one the editor derived', async () => {
      const home: CommunityHome = {
        replays: [{ slug: 'r', title: 'Call', heldOn: '2026-08-12', videoUrl: null, description: null }],
        articles: [],
        threshold: CONTRADICTORY_THRESHOLD,
        standing: null
      };
      const { impl } = fakeFetch({ '/api/v1/community/home': { status: 200, body: home } });
      const client = new CommunityApiClient({ baseUrl: 'https://x', fetchImpl: impl });
      const read = await client.home();

      expect(read.outcome === 'ok' && read.value.threshold.entryPoint).toBe('in-editor-mirror');
      expect(read.outcome === 'ok' && read.value.replays).toHaveLength(1);
    });
  });
});
