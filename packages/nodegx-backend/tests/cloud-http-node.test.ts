/**
 * A cloud function can make an HTTP call with the **modern** node — driven end to end.
 *
 * CWF-003: `HTTP Request` (`net.noodl.HTTP`) lives in `@noodl/runtime` but was registered only by
 * the browser viewer, so a cloud function's only HTTP node was the deprecated `REST2` — which the
 * picker hides, because it carries `deprecated: true`. Server-side HTTP was therefore reachable
 * only through a Function node. One registration line in `noodl-viewer-cloud/src/nodes/index.ts`
 * fixes it; this spec is what makes "fixes it" a measurement rather than a claim.
 *
 * ⚠️ Registration is not the interesting half. TALK-007 §3.2 measured that Node 22 supplies
 * `fetch`, `FormData`, `Blob` and `Headers` as globals in this process, and `httpnode` uses
 * `fetch` unconditionally (`httpnode.ts:697`) — there is no `XMLHttpRequest` branch to guard, the
 * way `cloudfunction2.ts` would need one. What was genuinely open was the node's `setup()`, which
 * installs graph-model listeners for the editor's debug inspector: it early-returns unless
 * `context.editorConnection.isRunningLocally()`, and the backend never asks the cloud runtime to
 * connect to an editor — the same guard `restnode` and eight other already-shared nodes carry, so
 * it was never the reason this node sat in the viewer.
 *
 * ⚠️ Worth knowing before you debug the next one: with the registration line removed, these three
 * specs do not fail — they **hang** for the full timeout. An unknown node type in a cloud function
 * means nothing ever reaches a Response node, and `POST /functions/:name` has no timeout at all
 * (CWF-018). A 40-second red is what "this node is not registered" looks like from out here.
 */
import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';

import { BackendService } from '../src/service';

import { httpClient } from './helpers/http';

jest.setTimeout(40000);

/** GET an upstream URL and hand the parsed body and status straight back to the caller. */
function getFunction(upstream: string) {
  return {
    name: '/#__cloud__/httpGet',
    nodes: [
      {
        id: 'req',
        type: 'noodl.cloud.request',
        x: 0,
        y: 0,
        parameters: { allowNoAuth: true },
        ports: [],
        children: []
      },
      {
        id: 'http',
        type: 'net.noodl.HTTP',
        x: 0,
        y: 100,
        parameters: { url: `${upstream}/thing`, method: 'GET' },
        ports: [],
        children: []
      },
      {
        id: 'res',
        type: 'noodl.cloud.response',
        x: 0,
        y: 200,
        parameters: { params: 'body,status' },
        ports: [],
        children: []
      }
    ],
    connections: [
      { sourceId: 'req', sourcePort: 'receive', targetId: 'http', targetPort: 'fetch' },
      { sourceId: 'http', sourcePort: 'response', targetId: 'res', targetPort: 'pm-body' },
      { sourceId: 'http', sourcePort: 'statusCode', targetId: 'res', targetPort: 'pm-status' },
      { sourceId: 'http', sourcePort: 'done', targetId: 'res', targetPort: 'send' }
    ],
    roots: []
  };
}

/** POST a JSON body assembled from the request's own parameters, and return what came back. */
function postFunction(upstream: string) {
  return {
    name: '/#__cloud__/httpPost',
    nodes: [
      {
        id: 'req',
        type: 'noodl.cloud.request',
        x: 0,
        y: 0,
        parameters: { allowNoAuth: true, params: 'name' },
        ports: [],
        children: []
      },
      {
        id: 'http',
        type: 'net.noodl.HTTP',
        x: 0,
        y: 100,
        parameters: {
          url: `${upstream}/echo`,
          method: 'POST',
          bodyType: 'json',
          bodyFields: 'name'
        },
        ports: [],
        children: []
      },
      {
        id: 'res',
        type: 'noodl.cloud.response',
        x: 0,
        y: 200,
        parameters: { params: 'echoed,status' },
        ports: [],
        children: []
      }
    ],
    connections: [
      // `body-name` is a dynamic input; a connection to it is enough to mint it
      // (`nodescope.ts:120`), the same route a parameter takes.
      { sourceId: 'req', sourcePort: 'pm-name', targetId: 'http', targetPort: 'body-name' },
      { sourceId: 'req', sourcePort: 'receive', targetId: 'http', targetPort: 'fetch' },
      { sourceId: 'http', sourcePort: 'response', targetId: 'res', targetPort: 'pm-echoed' },
      { sourceId: 'http', sourcePort: 'statusCode', targetId: 'res', targetPort: 'pm-status' },
      { sourceId: 'http', sourcePort: 'done', targetId: 'res', targetPort: 'send' }
    ],
    roots: []
  };
}

/**
 * The multipart branch, which is the half of `httpnode` that depends on globals rather than on
 * `fetch`: `buildBody` reaches for `new FormData()` when Body Type is `form`.
 */
function multipartFunction(upstream: string) {
  return {
    name: '/#__cloud__/httpMultipart',
    nodes: [
      {
        id: 'req',
        type: 'noodl.cloud.request',
        x: 0,
        y: 0,
        parameters: { allowNoAuth: true, params: 'note' },
        ports: [],
        children: []
      },
      {
        id: 'http',
        type: 'net.noodl.HTTP',
        x: 0,
        y: 100,
        parameters: {
          url: `${upstream}/upload`,
          method: 'POST',
          bodyType: 'form',
          bodyFields: 'note'
        },
        ports: [],
        children: []
      },
      {
        id: 'res',
        type: 'noodl.cloud.response',
        x: 0,
        y: 200,
        parameters: { params: 'status' },
        ports: [],
        children: []
      }
    ],
    connections: [
      { sourceId: 'req', sourcePort: 'pm-note', targetId: 'http', targetPort: 'body-note' },
      { sourceId: 'req', sourcePort: 'receive', targetId: 'http', targetPort: 'fetch' },
      { sourceId: 'http', sourcePort: 'statusCode', targetId: 'res', targetPort: 'pm-status' },
      { sourceId: 'http', sourcePort: 'done', targetId: 'res', targetPort: 'send' }
    ],
    roots: []
  };
}

interface UpstreamHit {
  method: string;
  url: string;
  contentType?: string;
  body: string;
}

describe('the HTTP Request node in a cloud function (CWF-003)', () => {
  let dataDir: string;
  let service: BackendService;
  let base: string;
  let upstream: http.Server;
  let hits: UpstreamHit[] = [];

  const client = httpClient(() => base);

  beforeAll(async () => {
    upstream = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (c) => chunks.push(c as Buffer));
      req.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        hits.push({
          method: String(req.method),
          url: String(req.url),
          contentType: req.headers['content-type'],
          body
        });
        res.setHeader('content-type', 'application/json');
        if (req.url === '/echo') {
          res.end(JSON.stringify({ received: JSON.parse(body || '{}') }));
        } else {
          res.end(JSON.stringify({ thing: 'ok' }));
        }
      });
    });
    await new Promise<void>((resolve) => upstream.listen(0, '127.0.0.1', resolve));
    const upstreamUrl = `http://127.0.0.1:${(upstream.address() as { port: number }).port}`;

    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-cloud-http-'));
    fs.mkdirSync(path.join(dataDir, 'workflows'), { recursive: true });
    fs.writeFileSync(
      path.join(dataDir, 'workflows', 'http.workflow.json'),
      JSON.stringify({
        components: [getFunction(upstreamUrl), postFunction(upstreamUrl), multipartFunction(upstreamUrl)],
        settings: {},
        metadata: {}
      })
    );
    service = new BackendService({ dataDir, port: 0, backendId: 'cloud_http', backendName: 'Cloud HTTP' });
    base = (await service.start()).listen.url;
  });

  afterEach(() => {
    hits = [];
  });

  afterAll(async () => {
    await service.stop();
    await new Promise<void>((resolve) => upstream.close(() => resolve()));
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('performs a real GET and returns the parsed body', async () => {
    const res = await client.request<{ result: { body?: unknown; status?: number } }>(
      'POST',
      '/functions/httpGet',
      { body: {} }
    );

    expect(res.status).toBe(200);
    // ⚠️ The upstream hit is what proves the call happened. TALK-007's REST probe answered 200
    // with an empty body while the upstream had in fact been called, so a green response on its
    // own proves nothing about the node.
    expect(hits.map((h) => `${h.method} ${h.url}`)).toEqual(['GET /thing']);
    expect(res.json.result.body).toEqual({ thing: 'ok' });
    expect(res.json.result.status).toBe(200);
  });

  it('performs a real POST with a JSON body assembled from the request', async () => {
    const res = await client.request<{ result: { echoed?: unknown; status?: number } }>(
      'POST',
      '/functions/httpPost',
      { body: { name: 'ada' } }
    );

    expect(res.status).toBe(200);
    expect(hits).toHaveLength(1);
    expect(hits[0].method).toBe('POST');
    expect(hits[0].url).toBe('/echo');
    expect(hits[0].contentType).toBe('application/json');
    expect(JSON.parse(hits[0].body)).toEqual({ name: 'ada' });
    expect(res.json.result.echoed).toEqual({ received: { name: 'ada' } });
    expect(res.json.result.status).toBe(200);
  });

  it('performs a real multipart POST, so the FormData path is not browser-only', async () => {
    const res = await client.request<{ result: { status?: number } }>('POST', '/functions/httpMultipart', {
      body: { note: 'hello' }
    });

    expect(res.status).toBe(200);
    expect(res.json.result.status).toBe(200);
    expect(hits).toHaveLength(1);
    // `fetch` sets the boundary itself when the body is a FormData — the node deliberately does
    // not set Content-Type for this branch, and getting that wrong is the usual way multipart
    // fails.
    expect(hits[0].contentType).toMatch(/^multipart\/form-data; boundary=/);
    expect(hits[0].body).toContain('name="note"');
    expect(hits[0].body).toContain('hello');
  });
});
