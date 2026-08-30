/**
 * DEF-022 (phase 80, from phase 78's D34) — a cloud function can learn the app's own
 * public address from the request that reached it.
 *
 * The gap, measured by TPL-002 needing it: an emailed link must be absolute, and nothing
 * exposed the request's origin to a graph as a port — `request.ts` stored the headers on
 * the `Request` model and declared no output for them. (⚠️ The register's "nothing exposes
 * it to a graph" was too strong: an Object node with Id `Request` reads the raw `Headers`
 * bag today — probed through the real runner while building this — but that route is
 * undocumented, undiscoverable, and leaves every builder re-deriving origin from raw
 * headers, `Origin: null` and comma-listed forwarded headers included.)
 *
 * Two halves:
 *  - the derivation table over `requestOrigin` — every precedence rule and every refusal
 *    has a row, because a validator with no rejection test is an unchecked claim;
 *  - the consequence through `CloudRunner.run` — a graph wires the port into its Response
 *    and the answer carries the address, on the same harness shape as def023's.
 */

/* eslint-env jest */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { CloudRunner } from '../src';
import { requestOrigin } from '../src/nodes/cloud/requestOrigin';

jest.setTimeout(30000);

describe('DEF-022: what requestOrigin derives from a header bag', () => {
  test('the caller’s Origin wins over the backend’s host — it names where the app is served from', () => {
    expect(
      requestOrigin({ origin: 'https://app.example.com', host: 'backend.internal:8577' })
    ).toBe('https://app.example.com');
  });

  test('header names are case-insensitive — CloudRunner is a public seam, not only Node’s lowercased HTTP', () => {
    expect(requestOrigin({ Origin: 'https://app.example.com' })).toBe('https://app.example.com');
    expect(requestOrigin({ Host: 'example.com' })).toBe('http://example.com');
  });

  test('a trailing slash is stripped, the effectiveBaseUrl discipline, so origin + path composes', () => {
    expect(requestOrigin({ origin: 'https://app.example.com/' })).toBe('https://app.example.com');
  });

  test('the literal "null" Origin — a real value, sandboxed iframes send it — falls through to host', () => {
    expect(requestOrigin({ origin: 'null', host: 'example.com' })).toBe('http://example.com');
  });

  test('a non-web Origin cannot become the front of an emailed link — falls through to host', () => {
    expect(requestOrigin({ origin: 'javascript:alert(1)', host: 'example.com' })).toBe('http://example.com');
    expect(requestOrigin({ origin: 'chrome-extension://abcdef', host: 'example.com' })).toBe('http://example.com');
  });

  test('no Origin: host + x-forwarded-proto — the proxied single-box deploy', () => {
    expect(requestOrigin({ host: 'example.com', 'x-forwarded-proto': 'https' })).toBe('https://example.com');
  });

  test('a forwarded host wins over the internal one, and a two-hop comma list reads its first entry', () => {
    expect(
      requestOrigin({ host: 'internal:8577', 'x-forwarded-host': 'public.example.com', 'x-forwarded-proto': 'https, http' })
    ).toBe('https://public.example.com');
  });

  test('a garbage forwarded proto degrades to http rather than fronting a link with it', () => {
    expect(requestOrigin({ host: 'example.com', 'x-forwarded-proto': 'jAvascript' })).toBe('http://example.com');
  });

  test('a bare host is plain http — the direct localhost backend, exactly what it serves', () => {
    expect(requestOrigin({ host: 'localhost:8577' })).toBe('http://localhost:8577');
  });

  test('an array header value — Node’s shape for a repeated header — reads its first entry', () => {
    expect(requestOrigin({ origin: ['https://a.example', 'https://b.example'] })).toBe('https://a.example');
  });

  test('nothing usable is undefined, never an invented address', () => {
    expect(requestOrigin({})).toBeUndefined();
    expect(requestOrigin(undefined)).toBeUndefined();
    expect(requestOrigin(null)).toBeUndefined();
    expect(requestOrigin('https://not-a-bag')).toBeUndefined();
    expect(requestOrigin({ origin: 'null' })).toBeUndefined();
    expect(requestOrigin({ 'x-forwarded-proto': 'https' })).toBeUndefined();
  });
});

/** `request.origin → response.pm-addr`, sent on `receive` — the emailed-link wire, minimal. */
function originEchoFunction(name: string) {
  return {
    name: `/#__cloud__/${name}`,
    nodes: [
      {
        id: `${name}-req`,
        type: 'noodl.cloud.request',
        x: 0,
        y: 0,
        parameters: { allowNoAuth: true },
        ports: [],
        children: []
      },
      {
        id: `${name}-res`,
        type: 'noodl.cloud.response',
        x: 0,
        y: 200,
        parameters: { params: 'addr' },
        ports: [],
        children: []
      }
    ],
    connections: [
      { sourceId: `${name}-req`, sourcePort: 'origin', targetId: `${name}-res`, targetPort: 'pm-addr' },
      { sourceId: `${name}-req`, sourcePort: 'receive', targetId: `${name}-res`, targetPort: 'send' }
    ],
    roots: []
  };
}

function bundle(components: unknown[]) {
  return { components, settings: {}, metadata: {} };
}

async function callWithHeaders(runner: CloudRunner, name: string, headers: Record<string, unknown>): Promise<any> {
  const res: any = await runner.run(name, { body: '{}', headers } as any, { timeoutMs: 4000 });
  expect(res.statusCode).toBe(200);
  return JSON.parse(res.body).result;
}

describe('DEF-022: the port, through a real run', () => {
  test('a browser-shaped request answers with the app’s own address', async () => {
    const runner = new CloudRunner({});
    await runner.load(bundle([originEchoFunction('echo')]));

    // The browser's cloud-function call is a POST, and a POST always carries Origin — the
    // page's origin, which is the address TPL-002 had to be TOLD from outside.
    const result = await callWithHeaders(runner, 'echo', {
      origin: 'https://members.example.com',
      host: 'localhost:8577'
    });
    expect(result.addr).toBe('https://members.example.com');
  });

  test('a curl-shaped request (no Origin) answers with the backend’s own address', async () => {
    const runner = new CloudRunner({});
    await runner.load(bundle([originEchoFunction('echo')]));

    const result = await callWithHeaders(runner, 'echo', { host: 'localhost:8577' });
    expect(result.addr).toBe('http://localhost:8577');
  });

  test('a caller with no headers at all still gets an answer, and the port is honestly blank', async () => {
    const runner = new CloudRunner({});
    await runner.load(bundle([originEchoFunction('echo')]));

    // A workflow-step invocation carries no caller address (`RunnerRequest.headers` is
    // optional); the graph must answer rather than throw, and the port must not invent one.
    const result = await callWithHeaders(runner, 'echo', {});
    expect(result.addr).toBeUndefined();
  });

  test('two requests through one runner each read their own address — no bleed-through', async () => {
    const runner = new CloudRunner({});
    await runner.load(bundle([originEchoFunction('echo')]));

    const first = await callWithHeaders(runner, 'echo', { origin: 'https://first.example.com' });
    const second = await callWithHeaders(runner, 'echo', { host: 'second.example.com' });
    expect(first.addr).toBe('https://first.example.com');
    // A stale `_internal.origin` from the first request would read the first address here.
    expect(second.addr).toBe('http://second.example.com');
  });
});
