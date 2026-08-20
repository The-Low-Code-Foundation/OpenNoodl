/**
 * TUT-004 — what the editor's client will and will not accept from the platform.
 *
 * 🔴 **THE POINT OF THIS FILE IS THE SECOND COPY OF THE PATH RULE.**
 * `nodegx-community/src/lib/tutorialbundles.isSafeBundlePath` refuses the same shapes at
 * publish, and that is not a substitute. These keys become filenames on *this* machine, written
 * by *this* process — a validator on the far side of a wire is a claim about a server, and a
 * platform that is compromised, misconfigured or simply older than this build would satisfy it
 * happily while sending `../../.ssh/authorized_keys`. So the gate that counts is the one inside
 * the process holding the disk.
 *
 * ⚠️ These specs therefore drive the client with a **hostile payload the platform would never
 * emit**. A test that only used well-formed bundles would pass identically with the check
 * deleted.
 */
import { CommunityApiClient, isSafeBundleEntry } from '@noodl-models/community/communityapi';

type Route = { status: number; body?: unknown; text?: string };

function client(routes: Record<string, Route>) {
  const impl = (async (input: RequestInfo | URL) => {
    const path = String(input).replace(/^https?:\/\/[^/]+/, '');
    const route = routes[path];
    if (!route) return new Response('no route', { status: 500 });
    if (route.text !== undefined) return new Response(route.text, { status: route.status });
    return new Response(JSON.stringify(route.body ?? {}), {
      status: route.status,
      headers: { 'content-type': 'application/json' }
    });
  }) as unknown as typeof fetch;
  return new CommunityApiClient({ baseUrl: 'https://community.nodegx.io', fetchImpl: impl });
}

const BUNDLE = '/api/v1/community/tutorials/log-a-thing/bundle';
const GOOD_FILES = { 'lesson.json': '{}', 'solution/nodegx.project.json': '{}' };

const item = (over: Record<string, unknown> = {}) => ({
  item: { slug: 'log-a-thing', title: 'Log a thing', version: 2, updatedAt: '2026-08-20T10:00:00.000Z', files: GOOD_FILES, ...over }
});

// ─── The path rule, here, on this side of the wire ──────────────────────────

describe('a bundle entry is a relative path, and this process is the one that decides', () => {
  it.each([
    ['/etc/passwd', 'absolute'],
    ['../../../.ssh/authorized_keys', 'parent traversal'],
    ['components/../../escape.json', 'traversal mid-path'],
    ['components\\Home.json', 'a windows separator'],
    ['components//Home.json', 'an empty segment'],
    ['solution/', 'a trailing slash'],
    ['', 'empty']
  ])('refuses %s (%s)', (path) => {
    expect(isSafeBundleEntry(path)).toBe(false);
  });

  it.each(['lesson.json', 'components/__page__/Home/nodes.json', 'solution/components/_registry.json'])(
    'accepts %s — the known-firing half, without which `return false` would pass',
    (path) => {
      expect(isSafeBundleEntry(path)).toBe(true);
    }
  );

  it('🔴 refuses the WHOLE bundle when one entry escapes, naming the entry', async () => {
    const c = client({
      [BUNDLE]: { status: 200, body: item({ files: { ...GOOD_FILES, '../../evil.json': 'x' } }) }
    });

    const read = await c.tutorialBundle('log-a-thing');

    expect(read.outcome).toBe('unreachable');
    if (read.outcome !== 'unreachable') return;
    expect(read.detail).toContain('../../evil.json');
  });

  it('⚠️ refuses rather than DROPPING the bad entry — the dropped file is the one they chose', async () => {
    // A client that installed "the rest" would produce a lesson that is quietly not the lesson
    // that was published, and would report success while doing it.
    const c = client({
      [BUNDLE]: { status: 200, body: item({ files: { ...GOOD_FILES, '/tmp/evil': 'x' } }) }
    });
    expect((await c.tutorialBundle('log-a-thing')).outcome).not.toBe('ok');
  });

  it('refuses an entry whose contents are not text', async () => {
    const c = client({ [BUNDLE]: { status: 200, body: item({ files: { 'lesson.json': { nested: true } } }) } });
    const read = await c.tutorialBundle('log-a-thing');
    expect(read.outcome).toBe('unreachable');
    if (read.outcome !== 'unreachable') return;
    expect(read.detail).toContain('not text');
  });

  it('✅ takes a well-formed bundle — the control the refusals above are read against', async () => {
    const c = client({ [BUNDLE]: { status: 200, body: item() } });
    const read = await c.tutorialBundle('log-a-thing');
    expect(read.outcome).toBe('ok');
    if (read.outcome !== 'ok') return;
    expect(read.value).toMatchObject({ slug: 'log-a-thing', version: 2, files: GOOD_FILES });
  });
});

// ─── The outcomes a panel has to tell apart ─────────────────────────────────

describe('the outcomes, which a panel draws as three different sentences', () => {
  it('🔴 a 404 is `absent` — no such tutorial, unpublished, and no bundle are one answer', async () => {
    const c = client({ [BUNDLE]: { status: 404, body: { error: 'not found' } } });
    expect((await c.tutorialBundle('log-a-thing')).outcome).toBe('absent');
  });

  it('a network failure is `unreachable`, not `absent` — opposite fixes', async () => {
    const impl = (async () => {
      throw new Error('getaddrinfo ENOTFOUND');
    }) as unknown as typeof fetch;
    const c = new CommunityApiClient({ baseUrl: 'https://community.nodegx.io', fetchImpl: impl });
    const read = await c.tutorialBundle('log-a-thing');
    expect(read.outcome).toBe('unreachable');
  });

  it('a body that is not a bundle is `unreachable`, never `absent`', async () => {
    // `absent` is a statement about the viewer's permission and must never come from a parse
    // failure — `people()` makes the same argument for the same reason.
    const c = client({ [BUNDLE]: { status: 200, body: { item: { slug: 'log-a-thing' } } } });
    expect((await c.tutorialBundle('log-a-thing')).outcome).toBe('unreachable');
  });

  it('escapes the slug into the path rather than concatenating it', async () => {
    const seen: string[] = [];
    const impl = (async (input: RequestInfo | URL) => {
      seen.push(String(input));
      return new Response(JSON.stringify(item()), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as unknown as typeof fetch;
    const c = new CommunityApiClient({ baseUrl: 'https://community.nodegx.io', fetchImpl: impl });
    await c.tutorialBundle('a b/c');
    expect(seen[0]).toContain('/tutorials/a%20b%2Fc/bundle');
  });
});

// ─── The listing, and the flag the button hangs on ─────────────────────────

describe('the tutorials listing', () => {
  const INDEX = '/api/v1/community/tutorials';

  it('reads `installable` from the platform', async () => {
    const c = client({
      [INDEX]: {
        status: 200,
        body: {
          items: [
            { slug: 'a', title: 'A', installable: true },
            { slug: 'b', title: 'B', installable: false }
          ],
          page: { limit: 20, offset: 0, total: 2 }
        }
      }
    });
    const read = await c.tutorials();
    expect(read.outcome).toBe('ok');
    if (read.outcome !== 'ok') return;
    expect(read.value.items.map((i) => [i.slug, i.installable])).toEqual([
      ['a', true],
      ['b', false]
    ]);
  });

  it('🔴 defaults `installable` to FALSE on a platform that does not send it', async () => {
    // An older platform must read as "no button", never as "install this". The failure this
    // guards is the one that offers an action the other end cannot honour.
    const c = client({
      [INDEX]: { status: 200, body: { items: [{ slug: 'a', title: 'A' }], page: { limit: 20, offset: 0, total: 1 } } }
    });
    const read = await c.tutorials();
    if (read.outcome !== 'ok') throw new Error('expected ok');
    expect(read.value.items[0].installable).toBe(false);
  });

  it('⚠️ treats a truthy-but-not-true value as false', async () => {
    const c = client({
      [INDEX]: {
        status: 200,
        body: { items: [{ slug: 'a', title: 'A', installable: 'yes' }], page: { limit: 20, offset: 0, total: 1 } }
      }
    });
    const read = await c.tutorials();
    if (read.outcome !== 'ok') throw new Error('expected ok');
    expect(read.value.items[0].installable).toBe(false);
  });

  it('drops a row it cannot read rather than failing the page', async () => {
    const c = client({
      [INDEX]: {
        status: 200,
        body: { items: [{ nope: 1 }, { slug: 'a', title: 'A', installable: true }], page: { limit: 20, offset: 0, total: 2 } }
      }
    });
    const read = await c.tutorials();
    if (read.outcome !== 'ok') throw new Error('expected ok');
    expect(read.value.items.map((i) => i.slug)).toEqual(['a']);
  });
});
