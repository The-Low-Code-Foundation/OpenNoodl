/**
 * WFA-009 — a cloud function can return a value, and the export does not carry
 * the ports that make it possible.
 *
 * This is the run that decided the shape of WFA-009 (spec §2 step 1), kept as a
 * spec because the claim it settles is easy to get wrong twice. F27's register
 * entry originally blamed the exporter: `utils/exporter/util.ts` writes a node's
 * dynamic ports into the export only when its type sets `exportDynamicPorts`,
 * and `noodl.cloud.response` does not. WFA-006 corrected that and this proves
 * the correction — the ports are not *needed* in the export, because the runtime
 * mints them itself:
 *
 *   - from a **connection**, at `NodeScope.addConnection` →
 *     `targetNode.registerInputIfNeeded(targetPort)`;
 *   - from a **literal parameter**, at `NodeScope.setNodeParameters` → the same
 *     hook, before the value is queued.
 *
 * So the fixtures below deliberately carry `ports: []` on every node — exactly
 * what today's exporter writes — and the assertions are on the **response body
 * of the deployed function**, which is the spec's own trap: *a port that appears
 * in the editor and not in the export is worse than no port*. If anyone ever
 * sets `exportDynamicPorts` on these types, these specs still pass; if anyone
 * removes `registerInputIfNeeded`, they fail with an empty `result`.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { BackendService } from '../src/service';

import { httpClient } from './helpers/http';

jest.setTimeout(40000);

interface ResultBody {
  result: Record<string, unknown>;
}

/** A cloud function shaped the way the editor's exporter writes one. */
function functionComponent(name: string, opts: { requestParams: string; responseParams: string; literals?: Record<string, unknown> }) {
  return {
    name: `/#__cloud__/${name}`,
    nodes: [
      {
        id: 'req',
        type: 'noodl.cloud.request',
        x: 0,
        y: 0,
        parameters: { allowNoAuth: true, params: opts.requestParams },
        // No dynamic ports in the export. This is the point of the suite.
        ports: [],
        children: []
      },
      {
        id: 'res',
        type: 'noodl.cloud.response',
        x: 0,
        y: 200,
        parameters: { params: opts.responseParams, ...(opts.literals || {}) },
        ports: [],
        children: []
      }
    ],
    connections: [
      { sourceId: 'req', sourcePort: 'receive', targetId: 'res', targetPort: 'send' },
      // Only the names present on BOTH ends are wired; the rest are literals.
      ...opts.requestParams
        .split(',')
        .filter((p) => p && opts.responseParams.split(',').includes(p))
        .map((p) => ({ sourceId: 'req', sourcePort: `pm-${p}`, targetId: 'res', targetPort: `pm-${p}` }))
    ],
    roots: []
  };
}

const BUNDLE = {
  components: [
    // The shipped-template shape: read two values from the request, return them.
    functionComponent('echoTwo', { requestParams: 'id,total', responseParams: 'id,total' }),
    // A value typed into the port rather than wired into it.
    functionComponent('literalOnly', {
      requestParams: 'id',
      responseParams: 'note',
      literals: { 'pm-note': 'a literal typed into the port' }
    }),
    // Both kinds in one response body.
    functionComponent('mixed', {
      requestParams: 'total',
      responseParams: 'total,note',
      literals: { 'pm-note': 'from the port' }
    }),
    // Status = failure: the parameters are not on offer and the body is an error.
    {
      name: '/#__cloud__/refuses',
      nodes: [
        { id: 'req', type: 'noodl.cloud.request', x: 0, y: 0, parameters: { allowNoAuth: true }, ports: [], children: [] },
        {
          id: 'res',
          type: 'noodl.cloud.response',
          x: 0,
          y: 200,
          parameters: { status: 'failure', errorMessage: 'not today' },
          ports: [],
          children: []
        }
      ],
      connections: [{ sourceId: 'req', sourcePort: 'receive', targetId: 'res', targetPort: 'send' }],
      roots: []
    }
  ],
  settings: {},
  metadata: {}
};

describe('WFA-009: a deployed cloud function returns what its Response node was given', () => {
  let dataDir: string;
  let service: BackendService;
  let base: string;

  const http = httpClient(() => base);

  const call = (name: string, body: unknown) => http.request<ResultBody>('POST', `/functions/${name}`, { body });

  beforeAll(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-wfa009-'));
    fs.mkdirSync(path.join(dataDir, 'workflows'), { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'workflows', 'fns.workflow.json'), JSON.stringify(BUNDLE));
    service = new BackendService({ dataDir, port: 0, backendId: 'wfa009_backend', backendName: 'WFA-009 Test' });
    base = (await service.start()).listen.url;
  });

  afterAll(async () => {
    await service.stop();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('returns a value wired into a `pm-` port, with nothing in the export saying that port exists', async () => {
    const res = await call('echoTwo', { id: 'ord-1', total: 42 });
    expect(res.status).toBe(200);
    expect(res.json.result).toEqual({ id: 'ord-1', total: 42 });
  });

  it('returns a value typed into a `pm-` port as a literal, with no connection at all', async () => {
    const res = await call('literalOnly', { id: 'ord-2' });
    expect(res.status).toBe(200);
    expect(res.json.result).toEqual({ note: 'a literal typed into the port' });
  });

  it('returns both kinds in one body', async () => {
    const res = await call('mixed', { total: 7 });
    expect(res.status).toBe(200);
    expect(res.json.result).toEqual({ total: 7, note: 'from the port' });
  });

  it('is `{result: {}}` when the author supplied nothing — the F27 symptom, still the honest answer', async () => {
    const res = await call('echoTwo', {});
    expect(res.status).toBe(200);
    expect(res.json.result).toEqual({});
  });

  it('answers with the error message instead when the Response node says failure', async () => {
    const res = await http.request<{ error: string }>('POST', '/functions/refuses', { body: {} });
    expect(res.status).toBe(400);
    expect(res.json).toEqual({ error: 'not today' });
  });
});
