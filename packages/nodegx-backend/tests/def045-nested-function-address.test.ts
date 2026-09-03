/**
 * DEF-045 — a cloud function in a FOLDER, and the two addresses it has.
 *
 * The register row (phase 80, raised by DEF-015 s11) reads *"a cloud function in a folder is
 * declared, listed, ticked on the card — and unreachable over HTTP"*. A second file in this repo,
 * `newFunctionFromStep.ts` (SB-003), reads the opposite: *"every caller percent-encodes the name…
 * the backend router splits the path before decoding, so an encoded `a/b` matches
 * `functions/:name`… nested names are shipped practice in the prefab library and work on every
 * call path."*
 *
 * 🔴 **TWO RECORDED READINGS THAT CONTRADICT EACH OTHER, NEITHER RE-MEASURED.** This file is the
 * measurement, against a real `BackendService` over a real socket: the same nested function, at
 * both addresses, beside a flat control.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { classifyRoute } from '../src/ops/rate-limit';
import { BackendService } from '../src/service';

import { adminHeaders, httpClient } from './helpers/http';

jest.setTimeout(40000);

/** Request → Response, answering a constant. The graph is not what is under test; the URL is. */
function echoFunction(name: string) {
  return {
    name: `/#__cloud__/${name}`,
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
        id: 'res',
        type: 'noodl.cloud.response',
        x: 0,
        y: 100,
        // ⚠️ `params` is a PARAMETER and the inputs it mints are `pm-<param>`; `send` is the
        // signal. Both facts cost a 30s timeout to learn — a Response node that is never sent
        // reads as a 504, not as a wiring mistake.
        parameters: { params: 'who', 'pm-who': name },
        ports: [],
        children: []
      }
    ],
    // `receive` — *"fires when a request arrives, after every parameter output has been
    // updated"*. There is no `success` on this node; wiring one hangs the function.
    connections: [{ sourceId: 'req', sourcePort: 'receive', targetId: 'res', targetPort: 'send' }],
    roots: []
  };
}

describe('DEF-045 — the address of a cloud function that lives in a folder', () => {
  let dataDir: string;
  let service: BackendService;
  let base: string;

  const client = httpClient(() => base);

  beforeAll(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-def045-'));
    fs.mkdirSync(path.join(dataDir, 'workflows'), { recursive: true });
    fs.writeFileSync(
      path.join(dataDir, 'workflows', 'nested.workflow.json'),
      JSON.stringify({
        components: [echoFunction('site/publishPage'), echoFunction('publishPage')],
        settings: {},
        metadata: {}
      })
    );
    // ⚠️ `allowEphemeral` — and it is a fact about THIS BOX, not about the row. `better-sqlite3`
    // is not installed here and Node 20.11.1 has no `node:sqlite`, so a `BackendService` refuses
    // to start at all. Every sibling drive in this directory (`cloud-csv-nodes`, `cloud-secret-node`,
    // `sb008-public-site-drive`, …) constructs the service without this flag and therefore cannot
    // run here either. Persistence is irrelevant to a question about URL routing: nothing below
    // reads or writes a row.
    service = new BackendService({
      dataDir,
      port: 0,
      backendId: 'def045',
      backendName: 'DEF-045',
      allowEphemeral: true
    });
    base = (await service.start()).listen.url;
  });

  afterAll(async () => {
    await service.stop();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('🟢 THE CONTROL — the FLAT function answers, so a 404 below is about the slash', async () => {
    const res = await client.request<{ result: { who?: string } }>('POST', '/functions/publishPage', { body: {} });
    expect(res.status).toBe(200);
    expect(res.json.result.who).toBe('publishPage');
  });

  it('🟢 the nested function IS declared and listed under its nested name', async () => {
    // The admin credential rides this one — FH-024 keeps the admin gate closed on loopback.
    const res = await client.request<{ functions?: { name: string }[] }>('GET', '/admin/workflows', {
      headers: adminHeaders(dataDir)
    });
    expect(res.json.functions?.map((f) => f.name)).toContain('site/publishPage');
  });

  it('the PERCENT-ENCODED address — what every in-product caller sends', async () => {
    const res = await client.request<{ result: { who?: string } }>('POST', '/functions/site%2FpublishPage', {
      body: {}
    });
    // eslint-disable-next-line no-console
    console.log('[DEF-045] encoded address ->', res.status, JSON.stringify(res.json).slice(0, 200));
    expect(res.status).toBe(200);
  });

  /**
   * 🔴 THE TWO CONSUMERS THE PATTERN CHANGE OWES, ASSERTED HERE BECAUSE THEIR OWN SUITES CANNOT
   * RUN ON THIS BOX. `ops-rate-limit.test.ts` walks the live table and classifies every route;
   * `ops-request-id.test.ts` finds the access-log line by its low-cardinality `route` label. Both
   * start a `BackendService` with persistence and so die on the missing SQLite engine here — which
   * would have left a pattern rename verified by nothing.
   */
  it('the renamed pattern still classifies as `functions`, and is what the access log labels it', () => {
    const route = service.getRouteTable().find((r) => r.method === 'POST' && r.pattern.startsWith('functions'));
    expect(route?.pattern).toBe('functions/*name');
    expect(classifyRoute(route!.pattern, route!.access.kind)).toBe('functions');
    // `HttpServer.handle` sets `trace.route = route.pattern`, so the log label IS this string —
    // the assertion above is the one `ops-request-id` makes, one indirection earlier.
  });

  /**
   * 🔴 THE CONTROL FOR THE MATCHER CHANGE ITSELF. `*name` relaxes a length check that every other
   * route in the table relies on, so the thing to prove is that it relaxed exactly one route.
   */
  it('🟢 exact-length matching is untouched everywhere else, and `*name` still needs a name', async () => {
    // A rest-capture requires at least one segment: `POST /functions` is not "the function named
    // empty string", it is no route at all.
    expect((await client.request('POST', '/functions', { body: {} })).status).toBe(404);
    // And an ordinary `:param` route still refuses a longer path.
    expect((await client.request('GET', '/classes/Thing/extra/segments', {})).status).toBe(404);
  });

  it('the RAW-SLASH address — what a person or a third party types', async () => {
    const res = await client.request<{ result: { who?: string } }>('POST', '/functions/site/publishPage', {
      body: {}
    });
    // eslint-disable-next-line no-console
    console.log('[DEF-045] raw-slash address ->', res.status, JSON.stringify(res.json).slice(0, 200));
    expect(res.status).toBe(200);
  });
});
