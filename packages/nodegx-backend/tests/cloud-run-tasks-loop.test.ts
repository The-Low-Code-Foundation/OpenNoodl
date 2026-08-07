/**
 * A cloud function can loop over an array and run per-item work — driven end to end.
 *
 * TALK-007 §7 asked whether "loop over array items and apply a function to each" needed
 * building. It does not: **Run Tasks is the For Each**, it is registered in the cloud runtime,
 * and the per-item unit of work is a cloud **helper component** (not a cloud function — the
 * component picker refuses those on purpose, `componentpicker.ts:119-127`).
 *
 * This spec is the evidence for that answer, kept because the claim is exactly the kind
 * TALK-007 was written to stop people asserting: a registered node is not a working node.
 * It also guards the vocabulary moves in CWF-008 — if a move breaks the per-item component
 * instancing path, this goes red.
 *
 * ⚠️ Two things cost a wrong conclusion while writing it, both recorded here because the next
 * person to write a component fixture will hit them:
 *
 *   1. A component's ports come from the **component-level** `ports` array
 *      (`componentmodel.ts:456-463`), NOT from the Component Inputs/Outputs nodes' own `ports`.
 *      With the ports on the nodes, Run Tasks correctly reported
 *      `run-tasks/no-completion-output` — the template had no `Success` the instance could
 *      expose.
 *   2. That failure then **hung the HTTP request** rather than answering: the run reported
 *      `failure`, nothing was wired to it, no Response node ever fired, and
 *      `POST /functions/:name` has no timeout. Filed as CWF-018.
 */
import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';

import { BackendService } from '../src/service';

import { httpClient } from './helpers/http';

jest.setTimeout(40000);

/** The per-item template: a cloud helper component, Do in / Success out. */
function templateComponent(upstream: string) {
  return {
    name: '/#__cloud__/helpers/registerOne',
    ports: [
      { name: 'Do', plug: 'input', type: { name: 'signal' } },
      { name: 'username', plug: 'input', type: { name: '*' } },
      { name: 'Success', plug: 'output', type: { name: 'signal' } }
    ],
    nodes: [
      { id: 'ci', type: 'Component Inputs', x: 0, y: 0, parameters: {}, ports: [], children: [] },
      {
        id: 'js',
        type: 'JavaScriptFunction',
        x: 0,
        y: 100,
        parameters: {
          // The observable per-item side effect: an upstream call carrying THIS item's data.
          functionScript: `await fetch(${JSON.stringify(upstream)} + '?u=' + encodeURIComponent(Inputs.username));`
        },
        ports: [],
        children: []
      },
      { id: 'co', type: 'Component Outputs', x: 0, y: 200, parameters: {}, ports: [], children: [] }
    ],
    connections: [
      { sourceId: 'ci', sourcePort: 'Do', targetId: 'js', targetPort: 'run' },
      { sourceId: 'ci', sourcePort: 'username', targetId: 'js', targetPort: 'in-username' },
      { sourceId: 'js', sourcePort: 'success', targetId: 'co', targetPort: 'Success' }
    ],
    roots: []
  };
}

/** The function: array in → Run Tasks over it → answer once the whole run is Done. */
const bulkFunction = {
  name: '/#__cloud__/bulkRegister',
  nodes: [
    {
      id: 'req',
      type: 'noodl.cloud.request',
      x: 0,
      y: 0,
      parameters: { allowNoAuth: true, params: 'users' },
      ports: [],
      children: []
    },
    {
      id: 'rt',
      type: 'RunTasks',
      x: 0,
      y: 100,
      parameters: { taskTemplate: '/#__cloud__/helpers/registerOne', maxRunningTasks: 2 },
      ports: [],
      children: []
    },
    {
      id: 'res',
      type: 'noodl.cloud.response',
      x: 0,
      y: 200,
      parameters: { params: 'ok', 'pm-ok': 'ran' },
      ports: [],
      children: []
    }
  ],
  connections: [
    { sourceId: 'req', sourcePort: 'pm-users', targetId: 'rt', targetPort: 'items' },
    { sourceId: 'req', sourcePort: 'receive', targetId: 'rt', targetPort: 'run' },
    { sourceId: 'rt', sourcePort: 'done', targetId: 'res', targetPort: 'send' }
  ],
  roots: []
};

describe('a cloud function loops an array through a per-item component', () => {
  let dataDir: string;
  let service: BackendService;
  let base: string;
  let echo: http.Server;
  let hits: string[] = [];

  const client = httpClient(() => base);

  beforeAll(async () => {
    echo = http.createServer((req, res) => {
      hits.push(String(req.url));
      res.end('ok');
    });
    await new Promise<void>((resolve) => echo.listen(0, '127.0.0.1', resolve));
    const port = (echo.address() as { port: number }).port;

    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-runtasks-'));
    fs.mkdirSync(path.join(dataDir, 'workflows'), { recursive: true });
    fs.writeFileSync(
      path.join(dataDir, 'workflows', 'loop.workflow.json'),
      JSON.stringify({
        components: [templateComponent(`http://127.0.0.1:${port}/registered`), bulkFunction],
        settings: {},
        metadata: {}
      })
    );
    service = new BackendService({ dataDir, port: 0, backendId: 'runtasks_loop', backendName: 'Run Tasks loop' });
    base = (await service.start()).listen.url;
  });

  afterEach(() => {
    hits = [];
  });

  afterAll(async () => {
    await service.stop();
    await new Promise<void>((resolve) => echo.close(() => resolve()));
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('runs the template once per item, each with its own data, and answers when the run is done', async () => {
    const res = await client.request<{ result: { ok?: string } }>('POST', '/functions/bulkRegister', {
      body: { users: [{ username: 'ann' }, { username: 'bob' }, { username: 'cass' }] }
    });

    expect(res.status).toBe(200);
    expect(res.json.result).toEqual({ ok: 'ran' });
    // Concurrency is 2, so arrival order is not guaranteed — the set is what matters.
    expect(hits.sort()).toEqual(['/registered?u=ann', '/registered?u=bob', '/registered?u=cass']);
  });

  it('runs nothing and still answers for an empty list', async () => {
    const res = await client.request<{ result: { ok?: string } }>('POST', '/functions/bulkRegister', {
      body: { users: [] }
    });

    expect(res.status).toBe(200);
    expect(hits).toEqual([]);
  });
});
