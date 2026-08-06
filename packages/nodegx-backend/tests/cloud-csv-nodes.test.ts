/**
 * A cloud function can be handed a CSV and answer with one (CWF-012).
 *
 * Driven end to end through `POST /functions/:name` against the real service, because
 * "registered" is not "works" — TALK-007's finding was nine nodes that had been in the cloud
 * registry for months without anyone ever running them there.
 *
 * The task's "done when" in one graph: a CSV arrives in the request body, `Parse CSV` reads it,
 * `Array Filter` (CWF-008's vocabulary) keeps some rows, `To CSV` writes them back out, and the
 * caller gets CSV text. No Function node anywhere.
 *
 * ⚠️ Two authoring facts, both of which cost time in the sibling suites and will cost the next
 * person the same:
 *
 *  - **A declared `default` never runs its setter.** `Array Filter`'s `enabled: true` is inert, so
 *    the graph below carries it as a *parameter* — which is also what the editor writes once an
 *    author touches the field. `Parse CSV` and `To CSV` set theirs in `initialize` for the same
 *    reason, and the browser-side suite asserts that.
 *  - **A cloud function's body limit is 10 MB** (`readJSONBody` → `MAX_JSON_BODY` in
 *    `server/http-util.ts`). A bigger CSV is a 413 from the HTTP layer and never reaches the
 *    graph, so the node page says so rather than letting it surface as a mystery.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { BackendService } from '../src/service';

import { httpClient } from './helpers/http';

jest.setTimeout(40000);

/** Request → Parse CSV → Array Filter → To CSV → Response, plus a wired failure path. */
const csvRoundTripFunction = {
  name: '/#__cloud__/csvRoundTrip',
  nodes: [
    {
      id: 'req',
      type: 'noodl.cloud.request',
      x: 0,
      y: 0,
      parameters: { allowNoAuth: true, params: 'csv' },
      ports: [],
      children: []
    },
    { id: 'parse', type: 'net.noodl.ParseCSV', x: 0, y: 100, parameters: {}, ports: [], children: [] },
    {
      id: 'filt',
      type: 'Filter Collection',
      x: 0,
      y: 200,
      parameters: {
        enabled: true,
        filterFilter: 'team',
        'filterFilterOp-team': 'eq',
        'filterFilterValue-team': 'blue'
      },
      ports: [],
      children: []
    },
    {
      id: 'write',
      type: 'net.noodl.ToCSV',
      x: 0,
      y: 300,
      parameters: { columns: 'name,note' },
      ports: [],
      children: []
    },
    {
      id: 'res',
      type: 'noodl.cloud.response',
      x: 0,
      y: 400,
      parameters: { params: 'csv,count' },
      ports: [],
      children: []
    },
    {
      // The failure path is wired. A function whose only wired path is the happy one hangs
      // forever when the input is bad (CWF-018) — which is what a red 40s timeout here would
      // actually mean.
      id: 'resErr',
      type: 'noodl.cloud.response',
      x: 0,
      y: 500,
      parameters: { params: 'error' },
      ports: [],
      children: []
    }
  ],
  connections: [
    { sourceId: 'req', sourcePort: 'pm-csv', targetId: 'parse', targetPort: 'text' },
    { sourceId: 'parse', sourcePort: 'items', targetId: 'filt', targetPort: 'items' },
    { sourceId: 'filt', sourcePort: 'items', targetId: 'write', targetPort: 'items' },
    { sourceId: 'write', sourcePort: 'text', targetId: 'res', targetPort: 'pm-csv' },
    { sourceId: 'parse', sourcePort: 'count', targetId: 'res', targetPort: 'pm-count' },
    { sourceId: 'write', sourcePort: 'changed', targetId: 'res', targetPort: 'send' },
    { sourceId: 'parse', sourcePort: 'error', targetId: 'resErr', targetPort: 'pm-error' },
    { sourceId: 'parse', sourcePort: 'failure', targetId: 'resErr', targetPort: 'send' }
  ],
  roots: []
};

describe('the CSV nodes in a cloud function (CWF-012)', () => {
  let dataDir: string;
  let service: BackendService;
  let base: string;

  const client = httpClient(() => base);

  beforeAll(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-cloud-csv-'));
    fs.mkdirSync(path.join(dataDir, 'workflows'), { recursive: true });
    fs.writeFileSync(
      path.join(dataDir, 'workflows', 'csv.workflow.json'),
      JSON.stringify({ components: [csvRoundTripFunction], settings: {}, metadata: {} })
    );
    service = new BackendService({ dataDir, port: 0, backendId: 'cloud_csv', backendName: 'Cloud CSV' });
    base = (await service.start()).listen.url;
  });

  afterAll(async () => {
    await service.stop();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('parses a CSV from the request, filters it and answers with CSV', async () => {
    const res = await client.request<{ result: { csv?: string; count?: number } }>('POST', '/functions/csvRoundTrip', {
      body: { csv: 'name,team,note\nann,blue,first\nbob,red,second\ncass,blue,third' }
    });

    expect(res.status).toBe(200);
    expect(res.json.result.count).toBe(3);
    expect(res.json.result.csv).toBe('name,note\nann,first\ncass,third');
  });

  it('survives the round trip with delimiters, quotes and newlines inside cells', async () => {
    const hazardous =
      'name,team,note\n' +
      'ann,blue,"blue, then red"\n' +
      'bob,red,ignored\n' +
      'cass,blue,"she said ""hi"""\n' +
      'dee,blue,"one\ntwo"';

    const res = await client.request<{ result: { csv?: string } }>('POST', '/functions/csvRoundTrip', {
      body: { csv: hazardous }
    });

    expect(res.status).toBe(200);
    expect(res.json.result.csv).toBe(
      'name,note\nann,"blue, then red"\ncass,"she said ""hi"""\ndee,"one\ntwo"'
    );
  });

  it('strips the BOM Excel writes, so the first column is not silently renamed', async () => {
    const res = await client.request<{ result: { csv?: string } }>('POST', '/functions/csvRoundTrip', {
      body: { csv: '﻿name,team,note\nann,blue,first' }
    });

    // Without the strip the header is "﻿name", `name` resolves to nothing, and the answer
    // has an empty first column — which reads as "my first column is missing".
    expect(res.json.result.csv).toBe('name,note\nann,first');
  });

  it('fails loudly on a malformed CSV, naming the line, rather than answering with half a file', async () => {
    const res = await client.request<{ result: { error?: string } }>('POST', '/functions/csvRoundTrip', {
      body: { csv: 'name,team,note\nann,blue,first\nbob,red,"never closed\ncass,blue,third' }
    });

    expect(res.status).toBe(200);
    expect(res.json.result.error || '').toContain('line 3');
    expect(res.json.result.error || '').toContain('written as ""');
  });

  it('is registered for BOTH runtimes — a browser importing a spreadsheet wants this too', () => {
    const catalog = JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', '..', 'noodl-types', 'src', 'node-catalog.json'), 'utf8')
    ) as { nodes: { typeName: string; availableIn: string[] }[] };

    for (const typeName of ['net.noodl.ParseCSV', 'net.noodl.ToCSV']) {
      const entry = catalog.nodes.find((n) => n.typeName === typeName);
      expect(entry).toBeDefined();
      expect((entry?.availableIn || []).slice().sort()).toEqual(['browser', 'cloud']);
    }
  });
});
