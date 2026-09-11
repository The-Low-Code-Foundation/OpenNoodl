/**
 * SB-003 — a helper is not an endpoint.
 *
 * A cloud *function* is a `/#__cloud__/` component with a `noodl.cloud.request`
 * node; a component without one is a helper, instantiated by another cloud
 * graph (the composition idiom the prefab library is built on). Before this
 * fix, `hasFunction()` matched on name alone, so a helper:
 *
 *   - answered `POST /functions/<name>` with a 500 ("Could not find request
 *     node") instead of a 404, after a full per-request instantiation,
 *   - wrote a *failed execution record* for a call that was never servable,
 *   - appeared in `GET /admin/permissions/functions` as an authenticated
 *     endpoint (`allowNoAuth: false` — the graph walk ran and its answer was
 *     flattened into "not public" rather than "not a function").
 *
 * Driven over real HTTP because the boundary is the thing under test. Every
 * absence assertion here sits beside a known-firing control in the same bundle
 * (`bulkRegister`, a real function) — an empty listing proves nothing.
 *
 * The fixture pair is the same shape as `cloud-run-tasks-loop.test.ts`, whose
 * suite is the standing proof that the helper stays *reachable by composition*
 * (Run Tasks instances it per item) while this suite pins it unreachable by
 * name.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { BackendService } from '../src/service';

import { adminHeaders, httpClient } from './helpers/http';

jest.setTimeout(30000);

/** A helper: Component Inputs/Outputs interface, no Request node. */
const helperComponent = {
  name: '/#__cloud__/helpers/registerOne',
  ports: [
    { name: 'Do', plug: 'input', type: { name: 'signal' } },
    { name: 'Success', plug: 'output', type: { name: 'signal' } }
  ],
  nodes: [
    { id: 'ci', type: 'Component Inputs', x: 0, y: 0, parameters: {}, ports: [], children: [] },
    { id: 'co', type: 'Component Outputs', x: 0, y: 200, parameters: {}, ports: [], children: [] }
  ],
  connections: [{ sourceId: 'ci', sourcePort: 'Do', targetId: 'co', targetPort: 'Success' }],
  roots: []
};

/** A real function: the known-firing control for every listing assertion. */
const realFunction = {
  name: '/#__cloud__/bulkRegister',
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
    { id: 'res', type: 'noodl.cloud.response', x: 0, y: 200, parameters: {}, ports: [], children: [] }
  ],
  connections: [{ sourceId: 'req', sourcePort: 'receive', targetId: 'res', targetPort: 'send' }],
  roots: []
};

/**
 * A Request node NESTED in a child list — the predicate must find it at depth
 * (`findRequestNode` recurses; the export nests children under roots). `Group`
 * has no cloud component model, so this fixture is asserted through the
 * LISTING only, never called — depth is a predicate property, not an execution
 * one.
 */
const nestedFunction = {
  name: '/#__cloud__/nested',
  nodes: [
    {
      id: 'wrap',
      type: 'Group',
      x: 0,
      y: 0,
      parameters: {},
      ports: [],
      children: [
        {
          id: 'req2',
          type: 'noodl.cloud.request',
          x: 0,
          y: 0,
          parameters: { allowNoAuth: true },
          ports: [],
          children: []
        }
      ]
    },
    { id: 'res2', type: 'noodl.cloud.response', x: 0, y: 200, parameters: {}, ports: [], children: [] }
  ],
  connections: [{ sourceId: 'req2', sourcePort: 'receive', targetId: 'res2', targetPort: 'send' }],
  roots: []
};

interface ExecutionRow {
  id: string;
  workflowId: string;
  status: string;
}

interface FunctionRow {
  name: string;
  [key: string]: unknown;
}

describe('SB-003: a helper cloud component is not an endpoint', () => {
  let dataDir: string;
  let service: BackendService;
  let base: string;

  const client = httpClient(() => base);

  beforeAll(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-sb003-'));
    fs.mkdirSync(path.join(dataDir, 'workflows'), { recursive: true });
    fs.writeFileSync(
      path.join(dataDir, 'workflows', 'main.workflow.json'),
      JSON.stringify({ components: [helperComponent, realFunction, nestedFunction], settings: {}, metadata: {} })
    );
    service = new BackendService({ dataDir, port: 0, backendId: 'sb003', backendName: 'SB-003' });
    base = (await service.start()).listen.url;
  });

  afterAll(async () => {
    await service.stop();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('the control function answers 200 — the bundle is loaded and dispatch works', async () => {
    const res = await client.request('POST', '/functions/bulkRegister', { body: {} });
    expect(res.status).toBe(200);
  });

  it('calling a helper 404s with the same body as a nonexistent name, not a 500', async () => {
    const helper = await client.request<{ error?: string }>('POST', '/functions/helpers%2FregisterOne', {
      body: {}
    });
    const unknown = await client.request<{ error?: string }>('POST', '/functions/no-such-function', { body: {} });

    expect(helper.status).toBe(404);
    expect(unknown.status).toBe(404);
    // Same shape both sides: a helper's existence must not be probeable by name.
    expect(helper.json).toEqual({ error: "Function 'helpers/registerOne' not found" });
    expect(unknown.json).toEqual({ error: "Function 'no-such-function' not found" });
  });

  it('the refused call writes no execution record — beside a control call that writes one', async () => {
    const list = await client.request<ExecutionRow[]>('GET', '/executions?limit=50', {
      headers: adminHeaders(dataDir)
    });
    expect(list.status).toBe(200);
    const byWorkflow = list.json.map((e) => e.workflowId);
    // Control first: the 200s above are recorded, so an empty result cannot pass.
    expect(byWorkflow).toContain('bulkRegister');
    expect(byWorkflow).not.toContain('helpers/registerOne');
  });

  it('the permissions listing carries functions only, beside the control row', async () => {
    const res = await client.request<{ functions: FunctionRow[] }>('GET', '/admin/permissions/functions', {
      headers: adminHeaders(dataDir)
    });
    expect(res.status).toBe(200);
    const names = res.json.functions.map((f) => f.name);
    expect(names).toContain('bulkRegister');
    // The nested fixture: a Request node at depth still makes a function.
    expect(names).toContain('nested');
    expect(names).not.toContain('helpers/registerOne');
  });
});
