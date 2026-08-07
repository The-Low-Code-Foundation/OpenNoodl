/**
 * CWF-002 — the workflow output reaches a caller.
 *
 * WHY THIS SUITE IS DRIVEN OVER REAL HTTP AND NOT AGAINST THE ENGINE
 * ------------------------------------------------------------------
 * The defect was never that the value was computed wrongly. `WorkflowEngine`
 * has put `output` on the run result since WF-001, and the engine specs assert
 * it and have been green throughout. The value was computed correctly and then
 * dropped by the TRANSPORT — `dispatcher.fireWorkflow` serialised
 * `{executionId, status}` and nothing else. So a test that asserts the
 * computation is exactly the test that has been passing all along, and proves
 * nothing about the bug. Every assertion below is on what came back over a
 * socket.
 *
 * Covered:
 *   - a `return` step's value reaches an HTTP webhook caller as the body
 *   - `X-Execution-Id` still names the run, so no envelope is needed
 *   - an async trigger (the default, and every trigger written before this)
 *     still answers `{executionId, status}` — unchanged
 *   - a workflow with NO return step behaves exactly as it did
 *   - two return steps that both run: first wins, conflict RECORDED
 *   - the sync cap answers 504 and does NOT abandon the run
 *   - the registry refuses `sync` where nothing would read it
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import type { WorkflowExecution } from '../src/execution/ExecutionStore';
import type { TriggerFiredResponse, TriggerResponse } from '../src/server/admin-triggers';
import type { WorkflowResponse, WorkflowRunResponse } from '../src/server/admin-workflows';
import { BackendService } from '../src/service';
import { signWebhookHmac } from '../src/triggers/webhook';

import { adminHeaders, ErrorBody, httpClient } from './helpers/http';

jest.setTimeout(30000);

/** One echo function, so a step has a real 2xx output to be referenced. */
const FUNCTIONS = {
  components: [
    {
      name: '/#__cloud__/hello',
      nodes: [
        {
          id: 'req1',
          type: 'noodl.cloud.request',
          x: 0,
          y: 0,
          parameters: { allowNoAuth: true },
          ports: [],
          children: []
        },
        { id: 'res1', type: 'noodl.cloud.response', x: 0, y: 200, parameters: {}, ports: [], children: [] }
      ],
      connections: [{ sourceId: 'req1', sourcePort: 'receive', targetId: 'res1', targetPort: 'send' }],
      roots: []
    }
  ],
  settings: {},
  metadata: {}
};

const BACKEND_ID = 'cwf002_backend';

describe('CWF-002 the workflow return', () => {
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

  /** POST a signed webhook and hand back the raw response. */
  async function fireHook(slug: string, secret: string, body: unknown): Promise<Response> {
    const payload = JSON.stringify(body);
    return fetch(`${base}/hooks/${BACKEND_ID}/${slug}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-hub-signature-256': signWebhookHmac(secret, payload) },
      body: payload
    });
  }

  function secretOf(res: TriggerResponse): string {
    if (!res.secret) throw new Error('this create was supposed to mint a webhook secret');
    return res.secret;
  }

  beforeAll(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-cwf002-'));
    fs.mkdirSync(path.join(dataDir, 'workflows'), { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'workflows', 'fns.workflow.json'), JSON.stringify(FUNCTIONS));
    service = new BackendService({ dataDir, port: 0, backendId: BACKEND_ID, backendName: 'CWF-002 Test' });
    base = (await service.start()).listen.url;

    // A workflow that calls a function and then says what it answers with.
    await req<WorkflowResponse>('POST', '/admin/workflow-defs', {
      id: 'quote',
      entry: 's1',
      steps: [
        { id: 's1', kind: 'call-function', ref: 'hello', next: ['answer'] },
        {
          id: 'answer',
          kind: 'return',
          params: { value: { total: { $path: 'body.lines' }, currency: 'GBP' } }
        }
      ]
    });

    // The same workflow WITHOUT a return step — the "unchanged" control.
    await req<WorkflowResponse>('POST', '/admin/workflow-defs', {
      id: 'no-return',
      entry: 's1',
      steps: [{ id: 's1', kind: 'call-function', ref: 'hello' }]
    });
  });

  afterAll(async () => {
    await service.stop();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  // -------------------------------------------------------------------------
  // The defect, driven over a socket
  // -------------------------------------------------------------------------

  it('a sync webhook answers with the RETURNED value, not an envelope', async () => {
    const created = await req<TriggerResponse>('POST', '/admin/triggers', {
      type: 'webhook',
      target: { kind: 'workflow', name: 'quote' },
      responseMode: 'sync',
      webhook: { slug: 'quote' }
    });
    expect(created.status).toBe(201);
    const secret = secretOf(created.json);

    const res = await fireHook('quote', secret, { lines: 3 });
    expect(res.status).toBe(200);

    // THE assertion. Before CWF-002 this body was {executionId, status}.
    expect(await res.json()).toEqual({ total: 3, currency: 'GBP' });

    // No envelope, so the run id rides in a header rather than being lost.
    const execId = res.headers.get('x-execution-id');
    expect(execId).toBeTruthy();
    const record = await http.get<WorkflowExecution>(`/executions/${execId}`);
    expect(record.json.workflowId).toBe('quote');
    expect(record.json.status).toBe('success');
    expect((record.json.metadata as { returnedFrom?: string }).returnedFrom).toBe('answer');
  });

  it('an async trigger still answers {executionId, status} — the existing behaviour', async () => {
    const created = await req<TriggerResponse>('POST', '/admin/triggers', {
      type: 'webhook',
      target: { kind: 'workflow', name: 'quote' },
      webhook: { slug: 'quote-async' }
    });
    const secret = secretOf(created.json);
    expect(created.json.trigger.responseMode).toBeUndefined();

    const res = await fireHook('quote-async', secret, { lines: 9 });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { executionId?: string; status?: string };
    expect(Object.keys(body).sort()).toEqual(['executionId', 'status']);
    expect(body.status).toBe('success');
    // And no output leaked into it.
    expect(body).not.toHaveProperty('total');
  });

  it('a workflow with no return step answers with the last step output, as it always did', async () => {
    const run = await req<WorkflowRunResponse>('POST', '/admin/workflow-defs/no-return/run', {});
    expect(run.status).toBe(200);
    expect(run.json.run.status).toBe('success');
    // The `hello` function answers `{result:{}}` — the last step's output.
    expect(run.json.run.output).toEqual({ result: {} });
    expect(run.json.run.returned).toBeUndefined();
  });

  it('the admin run route reports the returned value and which step set it', async () => {
    // The admin run route wraps what it is posted as the run's `body` (WFA-003),
    // which is the same envelope a webhook delivers — so ONE definition reads
    // `body.lines` whichever way it was started.
    const run = await req<WorkflowRunResponse>('POST', '/admin/workflow-defs/quote/run', { lines: 12 });
    expect(run.json.run.output).toEqual({ total: 12, currency: 'GBP' });
    expect(run.json.run.returned).toBe(true);
    expect(run.json.run.returnedFrom).toBe('answer');
  });

  it('a return step with no `value` hands back the upstream step output', async () => {
    await req<WorkflowResponse>('POST', '/admin/workflow-defs', {
      id: 'bare-return',
      entry: 's1',
      steps: [
        { id: 's1', kind: 'call-function', ref: 'hello', next: ['r'] },
        { id: 'r', kind: 'return' }
      ]
    });
    const run = await req<WorkflowRunResponse>('POST', '/admin/workflow-defs/bare-return/run', {});
    expect(run.json.run.output).toEqual({ result: {} });
    expect(run.json.run.returned).toBe(true);
  });

  it('a return step returns its OWN value, never a same-named key from the payload', async () => {
    // The trap this closes: reading `ctx.input.value` would make a run payload
    // carrying `value` be returned by a Return step that declares none.
    const run = await req<WorkflowRunResponse>('POST', '/admin/workflow-defs/bare-return/run', {
      value: 'the payload, not the answer'
    });
    expect(run.json.run.output).toEqual({ result: {} });
  });

  // -------------------------------------------------------------------------
  // Two returns
  // -------------------------------------------------------------------------

  it('two return steps on two branches is legal, and only the taken one answers', async () => {
    const created = await req<WorkflowResponse>('POST', '/admin/workflow-defs', {
      id: 'two-branches',
      entry: 'gate',
      steps: [
        {
          id: 'gate',
          kind: 'branch',
          params: { condition: { left: { $path: 'big' }, op: 'eq', right: true } },
          routes: { ontrue: ['yes'], onfalse: ['no'] }
        },
        { id: 'yes', kind: 'return', params: { value: 'large' } },
        { id: 'no', kind: 'return', params: { value: 'small' } }
      ]
    });
    expect(created.status).toBe(201);

    expect((await req<WorkflowRunResponse>('POST', '/admin/workflow-defs/two-branches/run', { big: true })).json.run.output).toBe(
      'large'
    );
    expect((await req<WorkflowRunResponse>('POST', '/admin/workflow-defs/two-branches/run', { big: false })).json.run.output).toBe(
      'small'
    );
  });

  it('two return steps that both RUN: first wins, and the conflict is on the record', async () => {
    await req<WorkflowResponse>('POST', '/admin/workflow-defs', {
      id: 'two-live',
      entry: 's1',
      steps: [
        { id: 's1', kind: 'call-function', ref: 'hello', next: ['r1', 'r2'] },
        { id: 'r1', kind: 'return', params: { value: 'first' } },
        { id: 'r2', kind: 'return', params: { value: 'second' } }
      ]
    });
    const run = await req<WorkflowRunResponse>('POST', '/admin/workflow-defs/two-live/run', {});
    expect(run.json.run.output).toBe('first');

    // Recorded, not resolved silently: both ids, in the order they ran.
    const record = await http.get<WorkflowExecution>(`/executions/${run.json.run.executionId}`);
    expect((record.json.metadata as { returnConflict?: string[] }).returnConflict).toEqual(['r1', 'r2']);
  });

  it('a return step cannot carry a `next` edge (dead wiring is refused at write time)', async () => {
    const bad = await req<ErrorBody>('POST', '/admin/workflow-defs', {
      id: 'return-with-next',
      entry: 'r',
      steps: [
        { id: 'r', kind: 'return', params: { value: 1 }, next: ['after'] },
        { id: 'after', kind: 'call-function', ref: 'hello' }
      ]
    });
    expect(bad.status).toBe(400);
    expect(bad.json.error).toMatch(/ends its path/);
  });

  // -------------------------------------------------------------------------
  // The cap
  // -------------------------------------------------------------------------

  it('a sync fire that outruns its cap answers 504 and does NOT abandon the run', async () => {
    await req<WorkflowResponse>('POST', '/admin/workflow-defs', {
      id: 'slowpoke',
      entry: 'w',
      steps: [
        { id: 'w', kind: 'wait', params: { duration: 900 }, next: ['r'] },
        { id: 'r', kind: 'return', params: { value: 'eventually' } }
      ]
    });
    const created = await req<TriggerResponse>('POST', '/admin/triggers', {
      type: 'webhook',
      target: { kind: 'workflow', name: 'slowpoke' },
      responseMode: 'sync',
      responseTimeoutMs: 120,
      webhook: { slug: 'slowpoke' }
    });
    expect(created.status).toBe(201);
    const secret = secretOf(created.json);
    const triggerId = created.json.trigger.id;

    const res = await fireHook('slowpoke', secret, {});
    expect(res.status).toBe(504);
    const body = (await res.json()) as { status?: string; error?: string };
    expect(body.status).toBe('running');
    expect(body.error).toMatch(/still running/);

    // The run was not cancelled: it finishes, and it stamps the trigger late.
    await new Promise((r) => setTimeout(r, 1500));
    const t = await req<TriggerResponse>('GET', `/admin/triggers/${triggerId}`);
    expect(t.json.trigger.status?.lastResult?.ok).toBe(true);
  });

  // -------------------------------------------------------------------------
  // What the registry refuses, and why
  // -------------------------------------------------------------------------

  it('refuses sync on a FUNCTION target — the flag would be read by nothing', async () => {
    const bad = await req<ErrorBody>('POST', '/admin/triggers', {
      type: 'webhook',
      target: { kind: 'function', name: 'hello' },
      responseMode: 'sync',
      webhook: { slug: 'fn-sync' }
    });
    expect(bad.status).toBe(400);
    expect(bad.json.error).toMatch(/workflow target/);
  });

  it('refuses responseTimeoutMs without sync, and one over the ceiling', async () => {
    const orphan = await req<ErrorBody>('POST', '/admin/triggers', {
      type: 'webhook',
      target: { kind: 'workflow', name: 'quote' },
      responseTimeoutMs: 5000,
      webhook: { slug: 'orphan-timeout' }
    });
    expect(orphan.status).toBe(400);
    expect(orphan.json.error).toMatch(/responseTimeoutMs/);

    const huge = await req<ErrorBody>('POST', '/admin/triggers', {
      type: 'webhook',
      target: { kind: 'workflow', name: 'quote' },
      responseMode: 'sync',
      responseTimeoutMs: 999999,
      webhook: { slug: 'huge-timeout' }
    });
    expect(huge.status).toBe(400);
    expect(huge.json.error).toMatch(/5 minutes/);
  });

  it('a manual test fire shows the author what a caller would have received', async () => {
    const created = await req<TriggerResponse>('POST', '/admin/triggers', {
      type: 'webhook',
      target: { kind: 'workflow', name: 'quote' },
      responseMode: 'sync',
      webhook: { slug: 'quote-testfire' }
    });
    const fired = await req<TriggerFiredResponse>('POST', `/admin/triggers/${created.json.trigger.id}/fire`, {
      lines: 5
    });
    expect(fired.status).toBe(200);
    expect(JSON.parse(fired.json.response.body || 'null')).toEqual({ total: 5, currency: 'GBP' });
  });
});
