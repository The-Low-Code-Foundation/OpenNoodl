/**
 * WFA-003 end-to-end over a REAL BackendService: real HTTP, real registry
 * persistence, real CloudRunner functions, real execution records.
 *
 * `workflow-values.test.ts` covers the resolver and the payload builder in
 * isolation. This suite proves the two claims that only a whole running backend
 * can prove, and proves them the way phase 27 asked for — by the receiving
 * FUNCTION'S OWN RESPONSE BODY rather than by a spy:
 *
 *   1. A value produced by one cloud function reaches the next function's named
 *      parameter. Before WFA-003 step params were static literals, so this was
 *      not expressible at all (finding F11) and every function carried adapter
 *      code to dig its input out of wherever it happened to be (F14).
 *   2. Every entry point delivers the caller's data under `body`. Finding F13
 *      recorded the live consequence of them not doing so: a definition that ran
 *      green from `POST /admin/workflow-defs/:id/run` failed from a webhook
 *      carrying the same JSON.
 *
 * The `echo*` fixtures are Request → Response graphs whose response body is
 * `{ result: <the params it was given> }`, so an assertion on a step's
 * `outputData` is an assertion on what the function actually received.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import type { ExecutionWithSteps, WorkflowExecution } from '../src/execution/ExecutionStore';
import { BackendService } from '../src/service';
import { signWebhookHmac } from '../src/triggers/webhook';
import type { WorkflowRunResult } from '../src/workflow/types';

import { ErrorBody, httpClient } from './helpers/http';

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

const FUNCTIONS = {
  components: [
    echoFunction('quote', 'total'),
    echoFunction('charge', 'amount,orderId'),
    echoFunction('join', 'left,right'),
    echoFunction('note', 'note'),
    echoFunction('seeBody', 'body,trigger,triggerType')
  ],
  settings: {},
  metadata: {}
};

interface EchoResult {
  result: Record<string, unknown>;
}

describe('WFA-003 step data mapping over a real backend', () => {
  let dataDir: string;
  let service: BackendService;
  let base: string;

  const http = httpClient(() => base);
  const req = <T = unknown>(method: string, p: string, body?: unknown) => http.request<T>(method, p, { body });

  const executionOf = (executionId: string) => http.get<ExecutionWithSteps>(`/executions/${executionId}`);

  /** One step of a run by node id; throws naming the run rather than yielding undefined. */
  function stepOf(detail: ExecutionWithSteps, nodeId: string) {
    const step = detail.steps.find((s) => s.nodeId === nodeId);
    if (!step) {
      throw new Error(`no step "${nodeId}" in execution ${detail.id} (have: ${detail.steps.map((s) => s.nodeId).join(', ')})`);
    }
    return step;
  }

  /** What the function behind a step echoed back — i.e. what it was given. */
  async function echoed(executionId: string, nodeId: string): Promise<Record<string, unknown>> {
    const detail = (await executionOf(executionId)).json;
    const step = stepOf(detail, nodeId);
    if (step.status !== 'success') throw new Error(`step "${nodeId}" was ${step.status}: ${step.errorMessage}`);
    return (step.outputData as unknown as EchoResult).result;
  }

  async function run(id: string, body?: unknown): Promise<WorkflowRunResult> {
    const res = await req<{ run: WorkflowRunResult }>('POST', `/admin/workflow-defs/${id}/run`, body);
    if (res.status !== 200) throw new Error(`run of ${id} answered ${res.status}: ${res.text}`);
    return res.json.run;
  }

  beforeAll(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-wfa003-'));
    fs.mkdirSync(path.join(dataDir, 'workflows'), { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'workflows', 'fns.workflow.json'), JSON.stringify(FUNCTIONS));
    service = new BackendService({ dataDir, port: 0, backendId: 'wfa003_backend', backendName: 'WFA-003 Test' });
    base = (await service.start()).listen.url;
  });

  afterAll(async () => {
    await service.stop();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  // -------------------------------------------------------------------------
  // 1. One step's output into the next step's function input
  // -------------------------------------------------------------------------

  it("passes a value from one function's output into the next function's parameter", async () => {
    const created = await req('POST', '/admin/workflow-defs', {
      id: 'pass-a-value',
      name: 'Pass a value',
      entry: 'quote',
      steps: [
        // `body.total` — the caller's data, under the key WFA-003 guarantees.
        { id: 'quote', kind: 'call-function', ref: 'quote', params: { total: { $path: 'body.total' } }, next: ['charge'] },
        {
          id: 'charge',
          kind: 'call-function',
          ref: 'charge',
          params: {
            amount: { $path: 'previous.result.total' },
            orderId: { $path: 'body.orderId' }
          }
        }
      ]
    });
    expect(created.status).toBe(201);

    const result = await run('pass-a-value', { payload: { total: 250, orderId: 'ord_9' } });
    expect(result.status).toBe('success');

    // The FUNCTION echoed the value back, so the value genuinely crossed the
    // step boundary and arrived as a named parameter — not merely that the
    // engine computed it.
    expect(await echoed(result.executionId, 'quote')).toEqual({ total: 250 });
    expect(await echoed(result.executionId, 'charge')).toEqual({ amount: 250, orderId: 'ord_9' });
  });

  it('records the resolved value, not the reference, in the step input', async () => {
    // The run inspector (WFA-002) shows `inputData`. A reference left unresolved
    // there would make a correct run look like a broken one.
    const result = await run('pass-a-value', { payload: { total: 12, orderId: 'ord_1' } });
    const detail = (await executionOf(result.executionId)).json;
    expect(stepOf(detail, 'charge').inputData).toMatchObject({ amount: 12, orderId: 'ord_1' });
  });

  // -------------------------------------------------------------------------
  // 2. upstream.<stepId> where `previous` is ambiguous
  // -------------------------------------------------------------------------

  it('resolves `upstream.<stepId>` for a diamond, where `previous` is whichever arrived first', async () => {
    const created = await req('POST', '/admin/workflow-defs', {
      id: 'diamond',
      entry: 'quote',
      steps: [
        { id: 'quote', kind: 'call-function', ref: 'quote', params: { total: 10 }, next: ['left', 'right'] },
        { id: 'left', kind: 'call-function', ref: 'note', params: { note: 'from-left' }, next: ['join'] },
        { id: 'right', kind: 'call-function', ref: 'note', params: { note: 'from-right' }, next: ['join'] },
        {
          id: 'join',
          kind: 'call-function',
          ref: 'join',
          params: {
            left: { $path: 'upstream.left.result.note' },
            right: { $path: 'upstream.right.result.note' }
          }
        }
      ]
    });
    expect(created.status).toBe(201);

    const result = await run('diamond', {});
    expect(result.status).toBe('success');
    // Both branches are addressable by id. `previous` can only be one of them.
    expect(await echoed(result.executionId, 'join')).toEqual({ left: 'from-left', right: 'from-right' });

    const detail = (await executionOf(result.executionId)).json;
    const previous = stepOf(detail, 'join').inputData?.previous as { result?: { note?: string } } | undefined;
    expect(previous?.result?.note).toBe('from-left');
  });

  it('reaches back past an intervening branch — the case `previous` cannot express', async () => {
    const created = await req('POST', '/admin/workflow-defs', {
      id: 'reach-back',
      entry: 'quote',
      steps: [
        { id: 'quote', kind: 'call-function', ref: 'quote', params: { total: { $path: 'body.total' } }, next: ['decide'] },
        {
          id: 'decide',
          kind: 'branch',
          params: { condition: { left: { $path: 'previous.result.total' }, op: 'gt', right: 100 } },
          routes: { ontrue: ['big'], onfalse: ['small'] }
        },
        // `previous` here is the branch's `{result, isfalse}` — useless as data.
        { id: 'big', kind: 'call-function', ref: 'charge', params: { amount: { $path: 'upstream.quote.result.total' }, orderId: 'big' } },
        { id: 'small', kind: 'call-function', ref: 'charge', params: { amount: { $path: 'upstream.quote.result.total' }, orderId: 'small' } }
      ]
    });
    expect(created.status).toBe(201);

    const result = await run('reach-back', { payload: { total: 250 } });
    expect(result.status).toBe('success');
    expect(await echoed(result.executionId, 'big')).toEqual({ amount: 250, orderId: 'big' });
  });

  // -------------------------------------------------------------------------
  // 3. $literal
  // -------------------------------------------------------------------------

  it('escapes a param that really does contain a $path key', async () => {
    const created = await req('POST', '/admin/workflow-defs', {
      id: 'escaped',
      entry: 'note',
      steps: [
        { id: 'note', kind: 'call-function', ref: 'note', params: { note: { $literal: { $path: 'not a path' } } } }
      ]
    });
    expect(created.status).toBe(201);
    const result = await run('escaped', {});
    expect(await echoed(result.executionId, 'note')).toEqual({ note: { $path: 'not a path' } });
  });

  // -------------------------------------------------------------------------
  // 4. Write-time rejection, over real HTTP
  // -------------------------------------------------------------------------

  it('rejects a reference to a step that does not exist with a 400 naming it', async () => {
    const bad = await req<ErrorBody>('POST', '/admin/workflow-defs', {
      id: 'typo',
      entry: 'quote',
      steps: [
        { id: 'quote', kind: 'call-function', ref: 'quote', params: { total: 1 }, next: ['charge'] },
        { id: 'charge', kind: 'call-function', ref: 'charge', params: { amount: { $path: 'upstream.qoute.result.total' } } }
      ]
    });
    expect(bad.status).toBe(400);
    expect(bad.json.error).toContain('"qoute"');
    expect(bad.json.error).toContain('not a step in this workflow');
  });

  it('rejects a reference to a step that cannot have run yet', async () => {
    const bad = await req<ErrorBody>('POST', '/admin/workflow-defs', {
      id: 'backwards',
      entry: 'quote',
      steps: [
        { id: 'quote', kind: 'call-function', ref: 'quote', params: { total: { $path: 'upstream.charge.result.amount' } }, next: ['charge'] },
        { id: 'charge', kind: 'call-function', ref: 'charge', params: { amount: 1 } }
      ]
    });
    expect(bad.status).toBe(400);
    expect(bad.json.error).toMatch(/not upstream of "quote"/);
  });

  // -------------------------------------------------------------------------
  // 5. One payload shape across the entry points
  // -------------------------------------------------------------------------

  describe('one payload shape', () => {
    const SEE_BODY = {
      id: 'see-body',
      name: 'What did I receive?',
      entry: 'look',
      steps: [
        {
          id: 'look',
          kind: 'call-function',
          ref: 'seeBody',
          params: {
            body: { $path: 'body' },
            trigger: { $path: 'trigger' },
            triggerType: { $path: 'triggerType' }
          }
        }
      ]
    };

    beforeAll(async () => {
      expect((await req('POST', '/admin/workflow-defs', SEE_BODY)).status).toBe(201);
    });

    it('admin run: the caller data is under `body`, unwrapped', async () => {
      const result = await run('see-body', { payload: { total: 250 } });
      expect(await echoed(result.executionId, 'look')).toEqual({
        body: { total: 250 },
        trigger: { type: 'manual', firedAt: expect.any(String) },
        triggerType: 'manual'
      });
    });

    it('admin run: a bare body (no `payload` wrapper) is still the caller data', async () => {
      const result = await run('see-body', { total: 7 });
      expect((await echoed(result.executionId, 'look')).body).toEqual({ total: 7 });
    });

    it('manual trigger fire: the same shape, no longer spread at the top level only', async () => {
      const created = await req<{ trigger: { id: string } }>('POST', '/admin/triggers', {
        type: 'schedule',
        target: { kind: 'workflow', name: 'see-body' },
        schedule: { cron: '0 3 * * *', missedFirePolicy: 'skip' }
      });
      expect(created.status).toBe(201);
      const triggerId = created.json.trigger.id;

      const fired = await req('POST', `/admin/triggers/${triggerId}/fire`, { total: 250 });
      expect(fired.status).toBe(200);

      const entry = await latestExecution('see-body');
      const echoedBody = await echoed(entry.id, 'look');
      expect(echoedBody.body).toEqual({ total: 250 });
      expect(echoedBody.triggerType).toBe('manual');
      expect((echoedBody.trigger as { id?: string }).id).toBe(triggerId);
    });

    it('webhook: the same definition, the same `body` — this is F13 closed', async () => {
      const created = await req<{ trigger: { id: string }; secret?: string }>('POST', '/admin/triggers', {
        type: 'webhook',
        target: { kind: 'workflow', name: 'see-body' },
        webhook: { slug: 'wfa003' }
      });
      expect(created.status).toBe(201);
      const secret = created.json.secret;
      if (!secret) throw new Error('webhook trigger was created without a secret');

      const payload = JSON.stringify({ total: 250 });
      const res = await fetch(`${base}/hooks/wfa003_backend/wfa003`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-hub-signature-256': signWebhookHmac(secret, payload) },
        body: payload
      });
      expect(res.status).toBe(200);

      const entry = await latestExecution('see-body');
      const echoedBody = await echoed(entry.id, 'look');
      // The webhook used to be the ONE entry point that wrapped, so a definition
      // authored against an admin run broke here. Now it does not.
      expect(echoedBody.body).toEqual({ total: 250 });
      expect(echoedBody.triggerType).toBe('webhook');
      expect((echoedBody.trigger as { slug?: string }).slug).toBe('wfa003');
    });

    it('one definition can branch on the caller data whatever started it', async () => {
      // The phase-19 exit criterion asked for "triggered by a webhook AND on a
      // schedule". With five payload shapes, one condition could not serve both.
      const created = await req('POST', '/admin/workflow-defs', {
        id: 'either-way',
        entry: 'decide',
        steps: [
          {
            id: 'decide',
            kind: 'branch',
            params: { condition: { left: { $path: 'body.total' }, op: 'gt', right: 100 } },
            routes: { ontrue: ['big'], onfalse: ['small'] }
          },
          { id: 'big', kind: 'call-function', ref: 'note', params: { note: 'big' } },
          { id: 'small', kind: 'call-function', ref: 'note', params: { note: 'small' } }
        ]
      });
      expect(created.status).toBe(201);

      const viaAdmin = await run('either-way', { payload: { total: 250 } });
      expect(await echoed(viaAdmin.executionId, 'big')).toEqual({ note: 'big' });

      const trigger = await req<{ trigger: { id: string }; secret?: string }>('POST', '/admin/triggers', {
        type: 'webhook',
        target: { kind: 'workflow', name: 'either-way' },
        webhook: { slug: 'either-way' }
      });
      const secret = trigger.json.secret;
      if (!secret) throw new Error('webhook trigger was created without a secret');
      const payload = JSON.stringify({ total: 250 });
      const res = await fetch(`${base}/hooks/wfa003_backend/either-way`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-hub-signature-256': signWebhookHmac(secret, payload) },
        body: payload
      });
      expect(res.status).toBe(200);

      const entry = await latestExecution('either-way');
      // Same definition, same decision — which is the whole point.
      expect(await echoed(entry.id, 'big')).toEqual({ note: 'big' });
    });
  });

  // -------------------------------------------------------------------------
  // 6. Compatibility with definitions written before WFA-003
  // -------------------------------------------------------------------------

  it('runs a definition written against the pre-WFA-003 payload shapes', async () => {
    // The phase-19 live test definition is not checked into the repository (it
    // was driven ad hoc; findings F11-F14 are what survive of it), so this is
    // its IDIOM rather than its bytes: paths straight into top-level payload
    // keys, static literal params, and no `body` anywhere. Every one of those
    // top-level keys is still delivered, deprecated, for one release.
    const created = await req('POST', '/admin/workflow-defs', {
      id: 'legacy-idiom',
      name: 'Written before WFA-003',
      entry: 'save',
      steps: [
        // `{$path: 'total'}` — top level, the shape an admin run used to deliver.
        { id: 'save', kind: 'call-function', ref: 'quote', params: { total: { $path: 'total' } }, next: ['decide'] },
        {
          id: 'decide',
          kind: 'branch',
          params: { condition: { left: { $path: 'total' }, op: 'gt', right: 100 } },
          routes: { ontrue: ['charge'], onfalse: ['logfail'] }
        },
        { id: 'charge', kind: 'call-function', ref: 'charge', params: { amount: 250, orderId: 'legacy' } },
        { id: 'logfail', kind: 'call-function', ref: 'note', params: { note: 'too small' } }
      ]
    });
    expect(created.status).toBe(201);

    const result = await run('legacy-idiom', { payload: { total: 250 } });
    expect(result.status).toBe('success');
    expect(await echoed(result.executionId, 'save')).toEqual({ total: 250 });
    expect(await echoed(result.executionId, 'charge')).toEqual({ amount: 250, orderId: 'legacy' });
  });

  it('keeps the deprecated top-level keys beside the canonical ones', async () => {
    const result = await run('see-body', { payload: { total: 250, note: 'hi' } });
    const detail = (await executionOf(result.executionId)).json;
    // `triggerData` IS the run payload, so this is the whole envelope as delivered.
    expect(detail.triggerData).toMatchObject({
      total: 250, // deprecated top-level view
      note: 'hi',
      triggerType: 'manual',
      body: { total: 250, note: 'hi' }
    });
  });

  it('lets the canonical `body` win when the caller sends a `body` key of its own', async () => {
    // The collision is decided, not left to spread order. The legacy top-level
    // view of that key is shadowed; it stays reachable as `body.body`.
    const result = await run('see-body', { payload: { body: 'inner', total: 1 } });
    const echoedBody = await echoed(result.executionId, 'look');
    expect(echoedBody.body).toEqual({ body: 'inner', total: 1 });
    expect((echoedBody.body as Record<string, unknown>).body).toBe('inner');
  });

  // -------------------------------------------------------------------------

  /** The most recent execution of a workflow id. */
  async function latestExecution(workflowId: string): Promise<WorkflowExecution> {
    const list = await http.get<WorkflowExecution[]>('/executions?limit=50');
    const entry = list.json.find((e) => e.workflowId === workflowId);
    if (!entry) throw new Error(`no execution recorded for "${workflowId}"`);
    return entry;
  }
});
