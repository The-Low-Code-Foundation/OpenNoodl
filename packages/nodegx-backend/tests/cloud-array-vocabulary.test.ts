/**
 * A cloud function can build, filter and reshape a list — and its scratch state belongs to one
 * request. Driven end to end through `POST /functions/:name`, against the real service.
 *
 * CWF-008's whole point is that "registered" is not "works": TALK-007's finding was nine nodes
 * that had been in the cloud registry for months without anyone ever running them there. So the
 * array family, Variable and Component Object are driven here rather than asserted from the
 * committed snapshot.
 *
 * The two things this spec exists to hold:
 *
 *  1. A JSON array arrives in the request body, an **Array** node turns it into records, **Array
 *     Filter** and **Array Map** reshape it, and the result comes back in the response — with no
 *     Function node anywhere in the graph.
 *  2. Two **concurrent** requests to a function that writes a Variable and a Component Object,
 *     then reads them back after a pause, each see their own value. That is the criterion the
 *     Global Store decision (TALK-007 Pile B) was made on, inverted: state that silently
 *     *persists* between two callers is as wrong as state that silently forgets.
 *
 * ⚠️ Two authoring facts cost time here and will cost the next person the same:
 *
 *  - **A declared `default` never runs its setter** (`nodedefinition.ts:481` fills `_inputValues`
 *    and nothing pushes those through). So `Array Filter`'s `enabled: true` and `Array Map`'s
 *    `mapScript` default are inert: a graph that does not carry them as *parameters* gets a
 *    filter that passes everything through and a map that reports `array-map/script-failed`.
 *    Both are set explicitly below, which is also what the editor writes once an author touches
 *    the field.
 *  - A **named** array (`Collection.get(name)`) is process-wide even in the cloud — `Collection`
 *    has no `Scope` the way `Model` does. Nothing here names one, which is the ordinary path:
 *    Array/Filter/Map all build anonymous collections. See the note on `collectionnode2.ts`.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { BackendService } from '../src/service';

import { httpClient } from './helpers/http';

jest.setTimeout(40000);

/** Array in → Array → Array Filter → Array Map → Response. No code node anywhere. */
const shapeListFunction = {
  name: '/#__cloud__/shapeList',
  nodes: [
    {
      id: 'req',
      type: 'noodl.cloud.request',
      x: 0,
      y: 0,
      parameters: { allowNoAuth: true, params: 'rows' },
      ports: [],
      children: []
    },
    // `Array.items` is what turns the raw JSON objects into records: `Array.prototype.set`
    // runs `Model.create(item)` for anything that is not already one (`collection.ts:502`).
    { id: 'arr', type: 'Collection2', x: 0, y: 100, parameters: {}, ports: [], children: [] },
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
      id: 'map',
      type: 'Map Collection',
      x: 0,
      y: 300,
      parameters: {
        mapScript: "map({ label: (o) => String(o.get('name')).toUpperCase(), team: 'team' });"
      },
      ports: [],
      children: []
    },
    {
      id: 'res',
      type: 'noodl.cloud.response',
      x: 0,
      y: 400,
      parameters: { params: 'shaped' },
      ports: [],
      children: []
    }
  ],
  connections: [
    { sourceId: 'req', sourcePort: 'pm-rows', targetId: 'arr', targetPort: 'items' },
    { sourceId: 'arr', sourcePort: 'items', targetId: 'filt', targetPort: 'items' },
    { sourceId: 'filt', sourcePort: 'items', targetId: 'map', targetPort: 'items' },
    { sourceId: 'map', sourcePort: 'items', targetId: 'res', targetPort: 'pm-shaped' },
    { sourceId: 'map', sourcePort: 'modified', targetId: 'res', targetPort: 'send' }
  ],
  roots: []
};

/**
 * Write a Variable and a Component Object, pause, read both back, answer.
 *
 * The pause is the whole point: without it two requests never overlap and a process-wide
 * registry would look correct.
 */
const scratchStateFunction = {
  name: '/#__cloud__/scratchState',
  nodes: [
    {
      id: 'req',
      type: 'noodl.cloud.request',
      x: 0,
      y: 0,
      parameters: { allowNoAuth: true, params: 'tag' },
      ports: [],
      children: []
    },
    {
      id: 'setvar',
      type: 'Set Variable',
      x: 0,
      y: 100,
      parameters: { name: 'seen', setWith: 'string' },
      ports: [],
      children: []
    },
    {
      id: 'co',
      type: 'net.noodl.ComponentObject',
      x: 0,
      y: 200,
      parameters: { properties: 'tag' },
      ports: [],
      children: []
    },
    {
      id: 'wait',
      type: 'JavaScriptFunction',
      x: 0,
      y: 300,
      parameters: { functionScript: 'await new Promise((r) => setTimeout(r, 250));' },
      ports: [],
      children: []
    },
    { id: 'v', type: 'Variable2', x: 0, y: 400, parameters: { name: 'seen' }, ports: [], children: [] },
    {
      id: 'res',
      type: 'noodl.cloud.response',
      x: 0,
      y: 500,
      parameters: { params: 'variable,object' },
      ports: [],
      children: []
    }
  ],
  connections: [
    { sourceId: 'req', sourcePort: 'pm-tag', targetId: 'setvar', targetPort: 'value' },
    { sourceId: 'req', sourcePort: 'pm-tag', targetId: 'co', targetPort: 'value-tag' },
    { sourceId: 'req', sourcePort: 'receive', targetId: 'setvar', targetPort: 'do' },
    { sourceId: 'setvar', sourcePort: 'done', targetId: 'wait', targetPort: 'run' },
    // Read back only after the other request has had time to write its own value.
    { sourceId: 'wait', sourcePort: 'success', targetId: 'v', targetPort: 'fetch' },
    { sourceId: 'v', sourcePort: 'done', targetId: 'co', targetPort: 'fetch' },
    { sourceId: 'v', sourcePort: 'value', targetId: 'res', targetPort: 'pm-variable' },
    { sourceId: 'co', sourcePort: 'value-tag', targetId: 'res', targetPort: 'pm-object' },
    { sourceId: 'co', sourcePort: 'done', targetId: 'res', targetPort: 'send' }
  ],
  roots: []
};

describe('the cloud array vocabulary (CWF-008)', () => {
  let dataDir: string;
  let service: BackendService;
  let base: string;

  const client = httpClient(() => base);

  beforeAll(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-cloud-arrays-'));
    fs.mkdirSync(path.join(dataDir, 'workflows'), { recursive: true });
    fs.writeFileSync(
      path.join(dataDir, 'workflows', 'arrays.workflow.json'),
      JSON.stringify({
        components: [shapeListFunction, scratchStateFunction],
        settings: {},
        metadata: {}
      })
    );
    service = new BackendService({ dataDir, port: 0, backendId: 'cloud_arrays', backendName: 'Cloud arrays' });
    base = (await service.start()).listen.url;
  });

  afterAll(async () => {
    await service.stop();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('filters and maps a JSON array from the request and returns the result', async () => {
    const res = await client.request<{ result: { shaped?: Array<Record<string, unknown>> } }>(
      'POST',
      '/functions/shapeList',
      {
        body: {
          rows: [
            { name: 'ann', team: 'blue' },
            { name: 'bob', team: 'red' },
            { name: 'cass', team: 'blue' }
          ]
        }
      }
    );

    expect(res.status).toBe(200);
    const shaped = res.json.result.shaped;
    expect(Array.isArray(shaped)).toBe(true);
    // `id` is minted per record and is not part of what the author asked for.
    expect((shaped || []).map((r) => ({ label: r.label, team: r.team }))).toEqual([
      { label: 'ANN', team: 'blue' },
      { label: 'CASS', team: 'blue' }
    ]);
  });

  it('two concurrent requests do not see each other s Variable or Component Object', async () => {
    type Answer = { result: { variable?: unknown; object?: unknown } };

    const [first, second] = await Promise.all([
      client.request<Answer>('POST', '/functions/scratchState', { body: { tag: 'first' } }),
      client.request<Answer>('POST', '/functions/scratchState', { body: { tag: 'second' } })
    ]);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.json.result).toEqual({ variable: 'first', object: 'first' });
    expect(second.json.result).toEqual({ variable: 'second', object: 'second' });
  });
});
