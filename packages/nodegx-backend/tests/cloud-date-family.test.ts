/**
 * The date family, driven inside a real cloud function (CWF-011).
 *
 * The shared-runtime suite (`noodl-runtime/test/nodes/cwf-011-date.test.ts`) holds the maths —
 * the clamping rule, the granularities, the ISO week, and `Date To String`'s unchanged output.
 * This one holds the half that a unit test cannot see: that the nodes are in the **cloud**
 * registry, that a `date` survives being wired between them, and that it survives the JSON round
 * trip a Request and a Response node put it through.
 *
 * ⚠️ These nodes are registered in `@noodl/runtime`'s shared list, so nothing here is cloud-only:
 * the browser gets the same five. The catalog assertion at the end is what holds that.
 *
 * ⚠️ With a registration line removed these specs do not fail, they **hang** for the full timeout
 * — an unknown node type means nothing ever reaches a Response node (CWF-018).
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { BackendService } from '../src/service';

import { httpClient } from './helpers/http';

jest.setTimeout(40000);

/**
 * Request → Date Add → Date To String → Response.
 *
 * ⚠️ The Date Add node's id is `shift`, not `add`. `Collection` patches `Array.prototype.add` as a
 * read-only property (PLAT-003, load-bearing), and the graph loader assigns node ids onto an array
 * — so a node with the id `add` fails the WHOLE bundle load with "Cannot assign to read only
 * property 'add'", and every function in it then 500s with "Can't find component model".
 *
 * The renewal date one month after a subscription started, rendered in a named zone. Every
 * response parameter comes from the node that also fires `send`, so the ordering is a chain
 * rather than a race.
 */
const renewalFunction = {
  name: '/#__cloud__/renewal',
  nodes: [
    {
      id: 'req',
      type: 'noodl.cloud.request',
      x: 0,
      y: 0,
      parameters: { allowNoAuth: true, params: 'startedAt' },
      ports: [],
      children: []
    },
    // No `unit` parameter on purpose: the declared default is `days`, and a declared default
    // never runs its setter — so this graph is the one that breaks if `initialize` is missing.
    { id: 'shift', type: 'net.noodl.DateAdd', x: 0, y: 100, parameters: { amount: 30 }, ports: [], children: [] },
    {
      id: 'fmt',
      type: 'Date To String',
      x: 0,
      y: 200,
      parameters: { formatString: '{year}-{month}-{date} {hours}:{minutes}', timeZone: 'Asia/Tokyo' },
      ports: [],
      children: []
    },
    {
      id: 'res',
      type: 'noodl.cloud.response',
      x: 0,
      y: 300,
      parameters: { params: 'renewal' },
      ports: [],
      children: []
    }
  ],
  connections: [
    // ⚠️ The date leaves the caller as an ISO STRING (JSON has no date type) and is read back as
    // a Date by the port's setter. A family that only worked while the value never left the
    // graph would be half a family, so this is the ordinary path, not an edge case.
    { sourceId: 'req', sourcePort: 'pm-startedAt', targetId: 'shift', targetPort: 'input' },
    { sourceId: 'shift', sourcePort: 'result', targetId: 'fmt', targetPort: 'input' },
    { sourceId: 'fmt', sourcePort: 'currentValue', targetId: 'res', targetPort: 'pm-renewal' },
    { sourceId: 'fmt', sourcePort: 'inputChanged', targetId: 'res', targetPort: 'send' }
  ],
  roots: []
};

/** Request → Date Parts → Response. Nine fields off one node rather than nine nodes. */
const partsFunction = {
  name: '/#__cloud__/parts',
  nodes: [
    {
      id: 'req',
      type: 'noodl.cloud.request',
      x: 0,
      y: 0,
      parameters: { allowNoAuth: true, params: 'when' },
      ports: [],
      children: []
    },
    { id: 'parts', type: 'net.noodl.DateParts', x: 0, y: 100, parameters: {}, ports: [], children: [] },
    {
      id: 'res',
      type: 'noodl.cloud.response',
      x: 0,
      y: 200,
      parameters: { params: 'year,month,day,dayName,week' },
      ports: [],
      children: []
    }
  ],
  connections: [
    { sourceId: 'req', sourcePort: 'pm-when', targetId: 'parts', targetPort: 'input' },
    { sourceId: 'parts', sourcePort: 'year', targetId: 'res', targetPort: 'pm-year' },
    { sourceId: 'parts', sourcePort: 'month', targetId: 'res', targetPort: 'pm-month' },
    { sourceId: 'parts', sourcePort: 'date', targetId: 'res', targetPort: 'pm-day' },
    { sourceId: 'parts', sourcePort: 'dayName', targetId: 'res', targetPort: 'pm-dayName' },
    { sourceId: 'parts', sourcePort: 'isoWeek', targetId: 'res', targetPort: 'pm-week' },
    { sourceId: 'parts', sourcePort: 'changed', targetId: 'res', targetPort: 'send' }
  ],
  roots: []
};

/** Request → Date Difference → Response. */
const spanFunction = {
  name: '/#__cloud__/span',
  nodes: [
    {
      id: 'req',
      type: 'noodl.cloud.request',
      x: 0,
      y: 0,
      parameters: { allowNoAuth: true, params: 'from,to' },
      ports: [],
      children: []
    },
    {
      id: 'diff',
      type: 'net.noodl.DateDifference',
      x: 0,
      y: 100,
      parameters: { unit: 'hours' },
      ports: [],
      children: []
    },
    {
      id: 'res',
      type: 'noodl.cloud.response',
      x: 0,
      y: 200,
      parameters: { params: 'hours' },
      ports: [],
      children: []
    }
  ],
  connections: [
    { sourceId: 'req', sourcePort: 'pm-from', targetId: 'diff', targetPort: 'from' },
    { sourceId: 'req', sourcePort: 'pm-to', targetId: 'diff', targetPort: 'to' },
    { sourceId: 'diff', sourcePort: 'difference', targetId: 'res', targetPort: 'pm-hours' },
    { sourceId: 'diff', sourcePort: 'changed', targetId: 'res', targetPort: 'send' }
  ],
  roots: []
};

/**
 * Request → Now → Date Compare → Response.
 *
 * "Is this due date in the past" answered on the server, which is the case that motivated the
 * Now node: the alternative was an Expression with a `Date.now()` in it.
 */
const overdueFunction = {
  name: '/#__cloud__/overdue',
  nodes: [
    {
      id: 'req',
      type: 'noodl.cloud.request',
      x: 0,
      y: 0,
      parameters: { allowNoAuth: true, params: 'due' },
      ports: [],
      children: []
    },
    { id: 'now', type: 'net.noodl.Now', x: 0, y: 100, parameters: {}, ports: [], children: [] },
    { id: 'cmp', type: 'net.noodl.DateCompare', x: 0, y: 200, parameters: {}, ports: [], children: [] },
    {
      id: 'res',
      type: 'noodl.cloud.response',
      x: 0,
      y: 300,
      parameters: { params: 'overdue,serverTime' },
      ports: [],
      children: []
    }
  ],
  connections: [
    { sourceId: 'req', sourcePort: 'pm-due', targetId: 'cmp', targetPort: 'a' },
    { sourceId: 'req', sourcePort: 'receive', targetId: 'now', targetPort: 'read' },
    { sourceId: 'now', sourcePort: 'iso', targetId: 'res', targetPort: 'pm-serverTime' },
    { sourceId: 'now', sourcePort: 'date', targetId: 'cmp', targetPort: 'b' },
    { sourceId: 'cmp', sourcePort: 'before', targetId: 'res', targetPort: 'pm-overdue' },
    // Exactly one of these three fires per comparison, so wiring all three is "answer either way"
    // rather than three answers.
    { sourceId: 'cmp', sourcePort: 'isBefore', targetId: 'res', targetPort: 'send' },
    { sourceId: 'cmp', sourcePort: 'isAfter', targetId: 'res', targetPort: 'send' },
    { sourceId: 'cmp', sourcePort: 'isSame', targetId: 'res', targetPort: 'send' }
  ],
  roots: []
};

describe('the date family in a cloud function (CWF-011)', () => {
  let dataDir: string;
  let service: BackendService;
  let base: string;

  const client = httpClient(() => base);

  beforeAll(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-cloud-date-'));
    fs.mkdirSync(path.join(dataDir, 'workflows'), { recursive: true });
    fs.writeFileSync(
      path.join(dataDir, 'workflows', 'dates.workflow.json'),
      JSON.stringify({
        components: [renewalFunction, partsFunction, spanFunction, overdueFunction],
        settings: {},
        metadata: {}
      })
    );
    service = new BackendService({ dataDir, port: 0, backendId: 'cloud_dates', backendName: 'Cloud dates' });
    base = (await service.start()).listen.url;
  });

  afterAll(async () => {
    await service.stop();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('adds 30 days to an ISO string from the request and renders it in a named zone', async () => {
    const res = await client.request<{ result: { renewal?: string } }>('POST', '/functions/renewal', {
      body: { startedAt: '2026-01-15T23:30:00.000Z' }
    });
    expect(res.status).toBe(200);
    // 30 days on is 14 February 23:30 UTC, which is already 08:30 on the 15th in Tokyo — the
    // off-by-a-day the Timezone input exists to make visible rather than accidental.
    expect(res.json.result.renewal).toBe('2026-02-15 08:30');
  });

  it('answers with the parts of a date, months numbered from 1', async () => {
    const res = await client.request<{
      result: { year?: number; month?: number; day?: number; dayName?: string; week?: number };
    }>('POST', '/functions/parts', { body: { when: '2026-01-01T12:00:00.000Z' } });

    expect(res.status).toBe(200);
    expect(res.json.result.year).toBe(2026);
    expect(res.json.result.month).toBe(1); // not 0
    expect(res.json.result.day).toBe(1);
    expect(res.json.result.dayName).toBe('Thursday');
    expect(res.json.result.week).toBe(1);
  });

  it('measures a span in hours, unrounded and signed', async () => {
    const forwards = await client.request<{ result: { hours?: number } }>('POST', '/functions/span', {
      body: { from: '2026-01-01T00:00:00.000Z', to: '2026-01-02T12:30:00.000Z' }
    });
    expect(forwards.json.result.hours).toBe(36.5);

    const backwards = await client.request<{ result: { hours?: number } }>('POST', '/functions/span', {
      body: { from: '2026-01-02T12:30:00.000Z', to: '2026-01-01T00:00:00.000Z' }
    });
    expect(backwards.json.result.hours).toBe(-36.5);
  });

  it('reads the server clock and compares a due date against it', async () => {
    type Answer = { result: { overdue?: boolean; serverTime?: string } };

    const past = await client.request<Answer>('POST', '/functions/overdue', {
      body: { due: '2020-01-01T00:00:00.000Z' }
    });
    expect(past.status).toBe(200);
    expect(past.json.result.overdue).toBe(true);
    // The Now node must be a wall clock, not the frame clock: `platform.getCurrentTime()` is
    // `performance.now()` in the browser and `() => 0` under SSR, either of which would put this
    // in 1970.
    expect(new Date(String(past.json.result.serverTime)).getFullYear()).toBeGreaterThan(2020);

    const future = await client.request<Answer>('POST', '/functions/overdue', {
      body: { due: '2099-01-01T00:00:00.000Z' }
    });
    expect(future.json.result.overdue).toBe(false);
  });

  it('is shared vocabulary — the browser gets the same five nodes', () => {
    const catalog = JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', '..', 'noodl-types', 'src', 'node-catalog.json'), 'utf8')
    ) as { nodes: { typeName: string; availableIn: string[] }[] };

    for (const typeName of [
      'net.noodl.Now',
      'net.noodl.DateAdd',
      'net.noodl.DateDifference',
      'net.noodl.DateCompare',
      'net.noodl.DateParts'
    ]) {
      expect(catalog.nodes.find((n) => n.typeName === typeName)?.availableIn).toEqual(['browser', 'cloud']);
    }
  });
});
