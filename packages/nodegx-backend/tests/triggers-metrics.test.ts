/**
 * CWF-002's loose end: workflow-target fires were missing from trigger metrics.
 *
 * `nodegx_trigger_fires_total` was incremented in exactly two places —
 * `fire()`'s function branch and `recordRejection()` — and `fireWorkflow` was
 * neither. So a backend whose triggers all point at workflows (which is the
 * shape WF-001 introduced and the canvas encourages) scraped as though nothing
 * had ever fired, while the History Panel showed every run. A metric that is
 * silently partial is worse than an absent one: it reads as a fact.
 *
 * These specs assert the DELTA around a fire rather than an absolute count,
 * because the registry is a process-wide singleton and the point is "this fire
 * moved the counter", not "this file is the only thing that ever ran".
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import type { TriggerFiredResponse, TriggerResponse } from '../src/server/admin-triggers';
import type { WorkflowResponse } from '../src/server/admin-workflows';
import { BackendService } from '../src/service';

import { adminHeaders, httpClient } from './helpers/http';

jest.setTimeout(30000);

/** Two trivial request/response cloud functions for the workflow to call. */
const FUNCTIONS = {
  components: [
    {
      name: '/#__cloud__/first',
      nodes: [
        { id: 'req1', type: 'noodl.cloud.request', x: 0, y: 0, parameters: { allowNoAuth: true }, ports: [], children: [] },
        { id: 'res1', type: 'noodl.cloud.response', x: 0, y: 200, parameters: {}, ports: [], children: [] }
      ],
      connections: [{ sourceId: 'req1', sourcePort: 'receive', targetId: 'res1', targetPort: 'send' }],
      roots: []
    }
  ],
  settings: {},
  metadata: {}
};

describe('CWF-002 workflow-target fires reach the trigger metrics', () => {
  let dataDir: string;
  let service: BackendService;
  let base: string;

  // FH-024: the admin credential rides every call. Dev-open still relaxes the
  // data and function gates on loopback, but no longer the admin one — a web
  // page can reach 127.0.0.1 on the developer's behalf, so loopback was never
  // the boundary it was being read as. The editor's supervisor already attaches
  // this token to every proxied request.
  const http = httpClient(
    () => base,
    () => adminHeaders(dataDir)
  );
  const req = <T = unknown>(method: string, p: string, body?: unknown) => http.request<T>(method, p, { body });

  /**
   * One `nodegx_trigger_fires_total` sample, by label VALUES rather than by a
   * rendered key — a spec that hard-codes `{type="manual",outcome="success"}`
   * is asserting the registry's label ordering, which is not the fact under
   * test. Absent series read as 0, which is what a counter that has never been
   * touched means.
   */
  async function fireCount(type: string, outcome: 'success' | 'failure'): Promise<number> {
    const text = await (await fetch(`${base}/metrics`)).text();
    for (const line of text.split('\n')) {
      if (!line.startsWith('nodegx_trigger_fires_total{')) continue;
      const labels = line.slice(line.indexOf('{') + 1, line.indexOf('}'));
      if (!labels.includes(`type="${type}"`)) continue;
      if (!labels.includes(`outcome="${outcome}"`)) continue;
      return Number(line.slice(line.indexOf('}') + 2));
    }
    return 0;
  }

  beforeAll(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-cwf002-metrics-'));
    fs.mkdirSync(path.join(dataDir, 'workflows'), { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'workflows', 'fns.workflow.json'), JSON.stringify(FUNCTIONS));
    service = new BackendService({ dataDir, port: 0, backendId: 'cwf002metrics', backendName: 'CWF-002 Metrics' });
    base = (await service.start()).listen.url;

    // A workflow that succeeds, and one that halts on a step calling a function
    // that does not exist. Both are FOUND, so both take the ordinary
    // fireWorkflow path rather than the already-instrumented rejection path.
    await req<WorkflowResponse>('POST', '/admin/workflow-defs', {
      id: 'ok',
      entry: 's1',
      steps: [{ id: 's1', kind: 'call-function', ref: 'first' }]
    });
    await req<WorkflowResponse>('POST', '/admin/workflow-defs', {
      id: 'halts',
      entry: 's1',
      steps: [{ id: 's1', kind: 'call-function', ref: 'does_not_exist' }]
    });
  });

  afterAll(async () => {
    await service.stop();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('counts a successful workflow-target fire', async () => {
    const created = await req<TriggerResponse>('POST', '/admin/triggers', {
      type: 'webhook',
      target: { kind: 'workflow', name: 'ok' },
      webhook: { slug: 'metric-ok' }
    });
    expect(created.status).toBe(201);

    const before = await fireCount('manual', 'success');
    const fired = await req<TriggerFiredResponse>('POST', `/admin/triggers/${created.json.trigger.id}/fire`, {});
    expect(fired.status).toBe(200);
    expect((fired.json.result as { ok: boolean }).ok).toBe(true);

    expect(await fireCount('manual', 'success')).toBe(before + 1);
  });

  it('counts a failed workflow-target fire as a failure, not as nothing', async () => {
    const created = await req<TriggerResponse>('POST', '/admin/triggers', {
      type: 'webhook',
      target: { kind: 'workflow', name: 'halts' },
      webhook: { slug: 'metric-halts' }
    });
    expect(created.status).toBe(201);

    const beforeFail = await fireCount('manual', 'failure');
    const beforeOk = await fireCount('manual', 'success');
    const fired = await req<TriggerFiredResponse>('POST', `/admin/triggers/${created.json.trigger.id}/fire`, {});
    expect((fired.json.result as { ok: boolean }).ok).toBe(false);

    expect(await fireCount('manual', 'failure')).toBe(beforeFail + 1);
    // Same verdict as the trigger's own status stamp — one fire, one sample.
    expect(await fireCount('manual', 'success')).toBe(beforeOk);
  });

  it('still counts a function-target fire exactly once (the path that already worked)', async () => {
    const created = await req<TriggerResponse>('POST', '/admin/triggers', {
      type: 'webhook',
      target: { kind: 'function', name: 'first' },
      webhook: { slug: 'metric-fn' }
    });
    const before = await fireCount('manual', 'success');
    await req<TriggerFiredResponse>('POST', `/admin/triggers/${created.json.trigger.id}/fire`, {});
    expect(await fireCount('manual', 'success')).toBe(before + 1);
  });
});
