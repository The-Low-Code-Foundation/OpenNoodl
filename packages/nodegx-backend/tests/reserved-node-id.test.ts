/**
 * The reported symptom: a node whose graph **id** is `add` 500s every function
 * in the bundle with `Can't find component model`.
 *
 * The cause is two packages away from the message. `ComponentModel.nodes` is an
 * array used as an id-keyed dictionary, and `collection.ts` installs `add` on
 * `Array.prototype` as `writable: false` — so `this.nodes['add'] = node` throws
 * `Cannot assign to read only property 'add'` in strict mode, the component
 * never finishes importing, and the *next* thing to ask for it reports the
 * absence rather than the throw.
 *
 * Driven here, against a real service over HTTP, because the interesting claim
 * is the blast radius: it is not the `add` function that fails, it is every
 * function that shares its file. The second function in this workflow file has
 * nothing wrong with it.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { BackendService } from '../src/service';

import { httpClient } from './helpers/http';

jest.setTimeout(40000);

/** Request → Function → Response, where the Function's id is `add`. */
const functionWithReservedId = {
  name: '/#__cloud__/reservedId',
  nodes: [
    {
      id: 'req',
      type: 'noodl.cloud.request',
      x: 0,
      y: 0,
      parameters: { allowNoAuth: true, params: 'value' },
      ports: [],
      children: []
    },
    {
      id: 'add',
      type: 'JavaScriptFunction',
      x: 0,
      y: 100,
      parameters: { functionScript: 'Outputs.sum = Number(Inputs.value) + 1;' },
      ports: [],
      children: []
    },
    {
      id: 'res',
      type: 'noodl.cloud.response',
      x: 0,
      y: 200,
      parameters: { params: 'sum' },
      ports: [],
      children: []
    }
  ],
  connections: [
    { sourceId: 'req', sourcePort: 'pm-value', targetId: 'add', targetPort: 'in-value' },
    { sourceId: 'req', sourcePort: 'receive', targetId: 'add', targetPort: 'run' },
    { sourceId: 'add', sourcePort: 'out-sum', targetId: 'res', targetPort: 'pm-sum' },
    { sourceId: 'add', sourcePort: 'success', targetId: 'res', targetPort: 'send' }
  ],
  roots: []
};

/**
 * The same class one layer down, where the map is `{}` rather than `[]`.
 *
 * `NodeScope.nodes` and `NodeScope.componentInstanceChildren` are keyed by the same
 * authored ids. There, `add` is harmless and two other names are not: `__proto__` sets the
 * prototype instead of storing the node (so it vanishes silently, taking its wires with
 * it), and a node called `hasOwnProperty` shadows the method the scope calls on the map.
 */
const functionWithObjectPrototypeIds = {
  name: '/#__cloud__/protoIds',
  nodes: [
    {
      id: 'req',
      type: 'noodl.cloud.request',
      x: 0,
      y: 0,
      parameters: { allowNoAuth: true, params: 'value' },
      ports: [],
      children: []
    },
    {
      id: '__proto__',
      type: 'JavaScriptFunction',
      x: 0,
      y: 100,
      parameters: { functionScript: 'Outputs.doubled = Number(Inputs.value) * 2;' },
      ports: [],
      children: []
    },
    {
      id: 'hasOwnProperty',
      type: 'JavaScriptFunction',
      x: 0,
      y: 200,
      parameters: { functionScript: 'Outputs.sum = Number(Inputs.value) + 1;' },
      ports: [],
      children: []
    },
    {
      id: 'constructor',
      type: 'noodl.cloud.response',
      x: 0,
      y: 300,
      parameters: { params: 'sum' },
      ports: [],
      children: []
    }
  ],
  connections: [
    { sourceId: 'req', sourcePort: 'pm-value', targetId: '__proto__', targetPort: 'in-value' },
    { sourceId: 'req', sourcePort: 'receive', targetId: '__proto__', targetPort: 'run' },
    { sourceId: '__proto__', sourcePort: 'out-doubled', targetId: 'hasOwnProperty', targetPort: 'in-value' },
    { sourceId: '__proto__', sourcePort: 'success', targetId: 'hasOwnProperty', targetPort: 'run' },
    { sourceId: 'hasOwnProperty', sourcePort: 'out-sum', targetId: 'constructor', targetPort: 'pm-sum' },
    { sourceId: 'hasOwnProperty', sourcePort: 'success', targetId: 'constructor', targetPort: 'send' }
  ],
  roots: []
};

/** An entirely ordinary neighbour, in the same file. */
const innocentNeighbour = {
  name: '/#__cloud__/neighbour',
  nodes: [
    {
      id: 'req',
      type: 'noodl.cloud.request',
      x: 0,
      y: 0,
      parameters: { allowNoAuth: true, params: 'value' },
      ports: [],
      children: []
    },
    {
      id: 'res',
      type: 'noodl.cloud.response',
      x: 0,
      y: 100,
      parameters: { params: 'value' },
      ports: [],
      children: []
    }
  ],
  connections: [
    { sourceId: 'req', sourcePort: 'pm-value', targetId: 'res', targetPort: 'pm-value' },
    { sourceId: 'req', sourcePort: 'receive', targetId: 'res', targetPort: 'send' }
  ],
  roots: []
};

describe('a cloud function with a node id from the collection vocabulary', () => {
  let dataDir: string;
  let service: BackendService;
  let base: string;

  const client = httpClient(() => base);

  beforeAll(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-reserved-id-'));
    fs.mkdirSync(path.join(dataDir, 'workflows'), { recursive: true });
    fs.writeFileSync(
      path.join(dataDir, 'workflows', 'reserved.workflow.json'),
      JSON.stringify({
        components: [functionWithReservedId, functionWithObjectPrototypeIds, innocentNeighbour],
        settings: {},
        metadata: {}
      })
    );
    service = new BackendService({ dataDir, port: 0, backendId: 'reserved_id', backendName: 'Reserved id' });
    base = (await service.start()).listen.url;
  });

  afterAll(async () => {
    await service.stop();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('runs, rather than 500ing with "Can\'t find component model"', async () => {
    const res = await client.request<{ result: { sum?: number } }>('POST', '/functions/reservedId', {
      body: { value: 41 }
    });

    expect(res.text).not.toContain("Can't find component model");
    expect(res.status).toBe(200);
    expect(res.json.result.sum).toBe(42);
  });

  it('runs a graph whose ids are Object.prototype names, wires and all', async () => {
    const res = await client.request<{ result: { sum?: number } }>('POST', '/functions/protoIds', {
      body: { value: 20 }
    });

    expect(res.status).toBe(200);
    // 20 doubled by the `__proto__` node, then +1 by the `hasOwnProperty` one: the value
    // proves both nodes were stored AND that the wire between them survived.
    expect(res.json.result.sum).toBe(41);
  });

  it('does not take its neighbours in the same file down with it', async () => {
    const res = await client.request<{ result: { value?: number } }>('POST', '/functions/neighbour', {
      body: { value: 7 }
    });

    expect(res.status).toBe(200);
    expect(res.json.result.value).toBe(7);
  });
});
