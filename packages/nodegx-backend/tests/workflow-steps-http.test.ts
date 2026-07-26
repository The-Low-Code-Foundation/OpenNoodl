/**
 * WF-002 end-to-end over a REAL BackendService: real HTTP, real registry
 * persistence, real CloudRunner functions, real execution records.
 *
 * workflow-steps.test.ts stubs function invocation to exercise the kinds
 * exhaustively. This suite does the opposite — fewer cases, nothing stubbed —
 * because a kind proven only against a fake runner is half-verified. Here the
 * `call-function`/`for-each`/`retry` steps invoke actual cloud-function graphs
 * (Request → Response nodes) through the same CloudRunner the request/response
 * surface uses, which is what "a workflow node is a node" has to mean in
 * practice.
 *
 * It doubles as WF-002's example workflow: `order-pipeline` below exercises all
 * three CF11 groups (logic, error handling, wait/delay) in one run.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { BackendService } from '../src/service';

jest.setTimeout(40000);

/** Request → Response, echoing the named request params straight back. */
function echoFunction(name: string, params: string) {
  return {
    name: `/#__cloud__/${name}`,
    nodes: [
      { id: `req_${name}`, type: 'noodl.cloud.request', x: 0, y: 0, parameters: { allowNoAuth: true, params }, ports: [], children: [] },
      { id: `res_${name}`, type: 'noodl.cloud.response', x: 0, y: 200, parameters: { params }, ports: [], children: [] }
    ],
    connections: [
      { sourceId: `req_${name}`, sourcePort: 'receive', targetId: `res_${name}`, targetPort: 'send' },
      ...params.split(',').map((p) => ({
        sourceId: `req_${name}`,
        sourcePort: `pm-${p}`,
        targetId: `res_${name}`,
        targetPort: `pm-${p}`
      }))
    ],
    roots: []
  };
}

/** Request → Response(status: failure) — a function that always returns 400. */
function failingFunction(name: string) {
  return {
    name: `/#__cloud__/${name}`,
    nodes: [
      { id: `req_${name}`, type: 'noodl.cloud.request', x: 0, y: 0, parameters: { allowNoAuth: true }, ports: [], children: [] },
      {
        id: `res_${name}`,
        type: 'noodl.cloud.response',
        x: 0,
        y: 200,
        parameters: { status: 'failure', errorMessage: 'upstream is down' },
        ports: [],
        children: []
      }
    ],
    connections: [{ sourceId: `req_${name}`, sourcePort: 'receive', targetId: `res_${name}`, targetPort: 'send' }],
    roots: []
  };
}

const FUNCTIONS = {
  components: [echoFunction('ok', 'stage'), echoFunction('perItem', 'item'), failingFunction('flaky')],
  settings: {},
  metadata: {}
};

describe('WF-002 step kinds end-to-end over a real backend', () => {
  let dataDir: string;
  let service: BackendService;
  let base: string;

  async function req(method: string, p: string, body?: unknown) {
    const res = await fetch(`${base}${p}`, {
      method,
      headers: body !== undefined ? { 'content-type': 'application/json' } : {},
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
    let json: any = null;
    try {
      json = await res.json();
    } catch {
      /* non-JSON */
    }
    return { status: res.status, json };
  }

  /** Step statuses of a run, keyed by step id. */
  async function stepsOf(executionId: string): Promise<Record<string, string>> {
    const detail = await req('GET', `/executions/${executionId}`);
    return Object.fromEntries(detail.json.steps.map((s: any) => [s.nodeId, s.status]));
  }

  beforeAll(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-wf002-'));
    fs.mkdirSync(path.join(dataDir, 'workflows'), { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'workflows', 'fns.workflow.json'), JSON.stringify(FUNCTIONS));
    service = new BackendService({ dataDir, port: 0, backendId: 'wf002_backend', backendName: 'WF-002 Test' });
    base = (await service.start()).listen.url;
  });

  afterAll(async () => {
    await service.stop();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  // -------------------------------------------------------------------------

  it('serves the step-kind catalog so an agent can discover the vocabulary', async () => {
    const res = await req('GET', '/admin/workflow-step-kinds');
    expect(res.status).toBe(200);
    expect(res.json.kinds.map((k: any) => k.kind)).toEqual([
      'call-function',
      'branch',
      'switch',
      'for-each',
      'merge',
      'retry',
      'stop',
      'wait',
      'wait-until'
    ]);
    const branch = res.json.kinds.find((k: any) => k.kind === 'branch');
    expect(branch.routes.map((r: any) => r.name)).toEqual(['ontrue', 'onfalse']);
    expect(branch.source).toBe('CF11-001');
  });

  it('rejects a definition whose condition is malformed, with the reason', async () => {
    const bad = await req('POST', '/admin/workflow-defs', {
      id: 'bad-condition',
      entry: 'g',
      steps: [
        { id: 'g', kind: 'branch', params: { condition: { left: 1, op: 'approximately', right: 2 } }, routes: { ontrue: ['g2'] } },
        { id: 'g2', kind: 'call-function', ref: 'ok' }
      ]
    });
    expect(bad.status).toBe(400);
    expect(bad.json.error).toMatch(/op must be one of/);
  });

  // -------------------------------------------------------------------------
  // The example workflow: all three CF11 groups in one run.
  // -------------------------------------------------------------------------

  it('runs the example order-pipeline: branch + wait + call + merge + quiet stop', async () => {
    const created = await req('POST', '/admin/workflow-defs', {
      id: 'order-pipeline',
      name: 'Order pipeline (WF-002 example)',
      entry: 'isLarge',
      steps: [
        {
          id: 'isLarge',
          kind: 'branch',
          params: { condition: { left: { $path: 'total' }, op: 'gt', right: 100 } },
          routes: { ontrue: ['cooldown'], onfalse: ['autoApprove'] }
        },
        { id: 'cooldown', kind: 'wait', params: { duration: 40, unit: 'milliseconds' }, next: ['review'] },
        { id: 'review', kind: 'call-function', ref: 'ok', params: { stage: 'manual-review' }, next: ['join'] },
        { id: 'autoApprove', kind: 'call-function', ref: 'ok', params: { stage: 'auto' }, next: ['join'] },
        { id: 'join', kind: 'merge', params: { mode: 'any' }, next: ['done'] },
        { id: 'done', kind: 'stop', params: { isError: false, message: 'pipeline complete' } }
      ]
    });
    expect(created.status).toBe(201);

    const run = await req('POST', '/admin/workflow-defs/order-pipeline/run', { payload: { total: 250 } });
    expect(run.status).toBe(200);
    expect(run.json.run.status).toBe('success');

    // The false branch is recorded skipped, not silently absent.
    expect(await stepsOf(run.json.run.executionId)).toEqual({
      isLarge: 'success',
      cooldown: 'success',
      review: 'success',
      autoApprove: 'skipped',
      join: 'success',
      done: 'success'
    });

    // The merge saw the branch that actually ran, and the real function's
    // response body flowed through it.
    const detail = await req('GET', `/executions/${run.json.run.executionId}`);
    const join = detail.json.steps.find((s: any) => s.nodeId === 'join');
    expect(join.outputData.sources).toEqual(['review']);
    expect(join.outputData.merged.review).toEqual({ result: { stage: 'manual-review' } });
    expect(join.outputData.missing).toEqual(['autoApprove']);

    // Metadata records the disposition; the run is a `workflow` kind record.
    expect(detail.json.metadata.kind).toBe('workflow');
    expect(detail.json.metadata.engineStatus).toBe('success');
  });

  it('takes the other branch on a different payload — same definition', async () => {
    const run = await req('POST', '/admin/workflow-defs/order-pipeline/run', { payload: { total: 12 } });
    expect(run.json.run.status).toBe('success');
    const steps = await stepsOf(run.json.run.executionId);
    expect(steps.autoApprove).toBe('success');
    expect(steps.cooldown).toBe('skipped');
    expect(steps.review).toBe('skipped');
  });

  // -------------------------------------------------------------------------
  // for-each and retry against REAL functions
  // -------------------------------------------------------------------------

  it('for-each invokes a real cloud function once per item and collects the responses', async () => {
    await req('POST', '/admin/workflow-defs', {
      id: 'fan-out',
      entry: 'each',
      steps: [
        {
          id: 'each',
          kind: 'for-each',
          ref: 'perItem',
          params: { items: { $path: 'lines' } },
          routes: { empty: ['nothing'] },
          next: ['after']
        },
        { id: 'after', kind: 'call-function', ref: 'ok', params: { stage: 'after' } },
        { id: 'nothing', kind: 'stop', params: { isError: false } }
      ]
    });

    const run = await req('POST', '/admin/workflow-defs/fan-out/run', { payload: { lines: ['a', 'b', 'c'] } });
    expect(run.json.run.status).toBe('success');

    const detail = await req('GET', `/executions/${run.json.run.executionId}`);
    const each = detail.json.steps.find((s: any) => s.nodeId === 'each');
    expect(each.outputData.count).toBe(3);
    expect(each.outputData.failed).toBe(0);
    // Each result is a real Response-node body, proving three real invocations.
    expect(each.outputData.results).toEqual([
      { result: { item: 'a' } },
      { result: { item: 'b' } },
      { result: { item: 'c' } }
    ]);
    // `empty` was not selected, so its target is skipped; `next` still ran.
    const byId = Object.fromEntries(detail.json.steps.map((s: any) => [s.nodeId, s.status]));
    expect(byId).toMatchObject({ each: 'success', after: 'success', nothing: 'skipped' });

    // The step's nodeType names both the kind and the function it fanned out to.
    expect(each.nodeType).toBe('for-each:perItem');
  });

  it('retry re-invokes a genuinely failing function, then routes the exhaustion to a handler', async () => {
    await req('POST', '/admin/workflow-defs', {
      id: 'retrying',
      entry: 'attempt',
      steps: [
        {
          id: 'attempt',
          kind: 'retry',
          ref: 'flaky',
          params: { maxAttempts: 3, delayMs: 10 },
          next: ['never'],
          onError: ['alert']
        },
        { id: 'never', kind: 'call-function', ref: 'ok', params: { stage: 'never' } },
        { id: 'alert', kind: 'call-function', ref: 'ok', params: { stage: 'alerted' } }
      ]
    });

    const run = await req('POST', '/admin/workflow-defs/retrying/run', {});
    // Routed, so the RUN succeeds even though the step failed loudly.
    expect(run.json.run.status).toBe('success');

    const detail = await req('GET', `/executions/${run.json.run.executionId}`);
    const byId = Object.fromEntries(detail.json.steps.map((s: any) => [s.nodeId, s.status]));
    expect(byId).toEqual({ attempt: 'error', never: 'skipped', alert: 'success' });

    const attempt = detail.json.steps.find((s: any) => s.nodeId === 'attempt');
    expect(attempt.errorMessage).toMatch(/failed after 3 attempt/);

    // The handler received the failure as `previous.error` — CF11-002's catch.
    const alert = detail.json.steps.find((s: any) => s.nodeId === 'alert');
    expect(alert.inputData.previous.error.message).toMatch(/failed after 3 attempt/);
    expect(alert.inputData.previous.error.statusCode).toBe(400);
  });

  // -------------------------------------------------------------------------
  // wait-until, and cancellation of a real in-flight wait
  // -------------------------------------------------------------------------

  it('wait-until takes `skipped` for a past target without waiting', async () => {
    await req('POST', '/admin/workflow-defs', {
      id: 'embargo',
      entry: 'until',
      steps: [
        {
          id: 'until',
          kind: 'wait-until',
          params: { target: '2020-01-01T00:00:00.000Z' },
          routes: { done: ['publish'], skipped: ['publishNow'] }
        },
        { id: 'publish', kind: 'call-function', ref: 'ok', params: { stage: 'later' } },
        { id: 'publishNow', kind: 'call-function', ref: 'ok', params: { stage: 'now' } }
      ]
    });

    const started = Date.now();
    const run = await req('POST', '/admin/workflow-defs/embargo/run', {});
    expect(Date.now() - started).toBeLessThan(5000);
    expect(run.json.run.status).toBe('success');
    expect(await stepsOf(run.json.run.executionId)).toMatchObject({
      until: 'success',
      publish: 'skipped',
      publishNow: 'success'
    });
  });

  it('cancels a run parked in a long wait, promptly, over the real cancel route', async () => {
    await req('POST', '/admin/workflow-defs', {
      id: 'parked',
      entry: 'hold',
      steps: [
        { id: 'hold', kind: 'wait', params: { duration: 5, unit: 'minutes' }, next: ['after'] },
        { id: 'after', kind: 'call-function', ref: 'ok', params: { stage: 'after' } }
      ]
    });

    const started = Date.now();
    const running = req('POST', '/admin/workflow-defs/parked/run', {});
    await new Promise((r) => setTimeout(r, 300));

    const list = await req('GET', '/executions?workflowId=parked&limit=10');
    const inFlight = list.json.find((e: any) => e.status === 'running');
    expect(inFlight).toBeDefined();

    const cancelled = await req('POST', `/admin/workflow-runs/${inFlight.id}/cancel`);
    expect(cancelled.status).toBe(200);

    const run = await running;
    expect(Date.now() - started).toBeLessThan(20000); // not 5 minutes
    expect(run.json.run.status).toBe('cancelled');
    expect(await stepsOf(run.json.run.executionId)).toMatchObject({ hold: 'error', after: 'skipped' });
  });

  // -------------------------------------------------------------------------
  // Persistence: definitions using the new kinds survive a reload
  // -------------------------------------------------------------------------

  it('persists step kinds, routes and params to disk in a re-loadable form', async () => {
    const file = path.join(dataDir, 'workflow-defs', 'order-pipeline.workflow-def.json');
    const onDisk = JSON.parse(fs.readFileSync(file, 'utf-8'));
    expect(onDisk.steps.find((s: any) => s.id === 'isLarge').routes).toEqual({
      ontrue: ['cooldown'],
      onfalse: ['autoApprove']
    });

    // The registry validates on load; a second service over the same dataDir
    // starting at all is the proof that these definitions round-trip.
    const second = new BackendService({ dataDir, port: 0, backendId: 'wf002_reload', backendName: 'Reload' });
    const url = (await second.start()).listen.url;
    try {
      const res = await fetch(`${url}/admin/workflow-defs`);
      const json = (await res.json()) as { workflows: { id: string }[] };
      expect(json.workflows.map((w) => w.id).sort()).toEqual(['embargo', 'fan-out', 'order-pipeline', 'parked', 'retrying']);
    } finally {
      await second.stop();
    }
  });
});
