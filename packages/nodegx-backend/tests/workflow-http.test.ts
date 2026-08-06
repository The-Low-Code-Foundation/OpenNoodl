/**
 * WF-001 end-to-end over a real BackendService — the success criteria only a
 * live service can prove:
 *   - admin CRUD over /admin/workflow-defs (what the editor + MCP drive)
 *   - a multi-step workflow runs REAL cloud functions (via CloudRunner) as steps
 *     and records ONE workflow-level execution with per-STEP events
 *   - a trigger whose target.kind === 'workflow' runs the workflow through the
 *     ONE dispatcher path (no second dispatch path) and records it
 *   - an unrouted step failure halts the run and is recorded failed, visibly
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import type { ExecutionWithSteps, WorkflowExecution } from '../src/execution/ExecutionStore';
import type { TriggerFiredResponse, TriggerResponse } from '../src/server/admin-triggers';
import type {
  WorkflowDeletedResponse,
  WorkflowListResponse,
  WorkflowResponse,
  WorkflowRunResponse
} from '../src/server/admin-workflows';
import { BackendService } from '../src/service';

import { adminHeaders, ErrorBody, httpClient } from './helpers/http';

jest.setTimeout(30000);

// Two request/response cloud functions the workflow will chain as steps. `boom`
// returns a non-2xx so the engine sees a step failure.
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
    },
    {
      name: '/#__cloud__/second',
      nodes: [
        { id: 'req2', type: 'noodl.cloud.request', x: 0, y: 0, parameters: { allowNoAuth: true }, ports: [], children: [] },
        { id: 'res2', type: 'noodl.cloud.response', x: 0, y: 200, parameters: {}, ports: [], children: [] }
      ],
      connections: [{ sourceId: 'req2', sourcePort: 'receive', targetId: 'res2', targetPort: 'send' }],
      roots: []
    }
  ],
  settings: {},
  metadata: {}
};

describe('WF-001 workflows over HTTP', () => {
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

  beforeAll(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-wf001-'));
    fs.mkdirSync(path.join(dataDir, 'workflows'), { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'workflows', 'fns.workflow.json'), JSON.stringify(FUNCTIONS));
    service = new BackendService({ dataDir, port: 0, backendId: 'wf_backend', backendName: 'WF Test' });
    base = (await service.start()).listen.url;
  });

  afterAll(async () => {
    await service.stop();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('CRUD: create/list/get/delete a workflow definition', async () => {
    const created = await req<WorkflowResponse>('POST', '/admin/workflow-defs', {
      name: 'Pipeline',
      entry: 's1',
      steps: [
        { id: 's1', kind: 'call-function', ref: 'first', next: ['s2'] },
        { id: 's2', kind: 'call-function', ref: 'second' }
      ]
    });
    expect(created.status).toBe(201);
    const id = created.json.workflow.id;

    const list = await req<WorkflowListResponse>('GET', '/admin/workflow-defs');
    expect(list.json.workflows.some((w) => w.id === id)).toBe(true);

    const got = await req<WorkflowResponse>('GET', `/admin/workflow-defs/${id}`);
    expect(got.json.workflow.steps.length).toBe(2);

    const del = await req<WorkflowDeletedResponse>('DELETE', `/admin/workflow-defs/${id}`);
    expect(del.json.deleted).toBe(true);
    expect((await req<WorkflowResponse>('GET', `/admin/workflow-defs/${id}`)).status).toBe(404);
  });

  it('rejects an invalid workflow (cycle) with a 400 (no silent accept)', async () => {
    const bad = await req<ErrorBody>('POST', '/admin/workflow-defs', {
      entry: 'a',
      steps: [
        { id: 'a', kind: 'call-function', ref: 'first', next: ['b'] },
        { id: 'b', kind: 'call-function', ref: 'second', next: ['a'] }
      ]
    });
    expect(bad.status).toBe(400);
    expect(bad.json.error).toMatch(/cycle/);
  });

  it('runs a multi-step workflow over real functions and records per-step events', async () => {
    const created = await req<WorkflowResponse>('POST', '/admin/workflow-defs', {
      id: 'chain',
      name: 'Chain',
      entry: 's1',
      steps: [
        { id: 's1', kind: 'call-function', ref: 'first', next: ['s2'] },
        { id: 's2', kind: 'call-function', ref: 'second' }
      ]
    });
    expect(created.status).toBe(201);

    const run = await req<WorkflowRunResponse>('POST', '/admin/workflow-defs/chain/run', { hello: 'world' });
    expect(run.status).toBe(200);
    expect(run.json.run.status).toBe('success');
    expect(run.json.run.stepsRun).toBe(2);

    // ONE workflow-level execution record with TWO step records — the single
    // execution-record path, with per-step granularity.
    const execId = run.json.run.executionId;
    const detail = await req<ExecutionWithSteps>('GET', `/executions/${execId}`);
    expect(detail.json.workflowId).toBe('chain');
    expect(detail.json.status).toBe('success');
    expect(detail.json.metadata?.kind).toBe('workflow');
    expect(detail.json.steps.length).toBe(2);
    expect(detail.json.steps.map((s) => s.status)).toEqual(['success', 'success']);
  });

  it('halts and records a failed run when a step fails with no error route', async () => {
    await req<WorkflowResponse>('POST', '/admin/workflow-defs', {
      id: 'halts',
      entry: 's1',
      steps: [
        { id: 's1', kind: 'call-function', ref: 'first', next: ['missing_target'] },
        // second step points at a function that does not exist -> step failure
        { id: 'missing_target', kind: 'call-function', ref: 'does_not_exist', next: ['s3'] },
        { id: 's3', kind: 'call-function', ref: 'second' }
      ]
    });
    const run = await req<WorkflowRunResponse>('POST', '/admin/workflow-defs/halts/run', {});
    expect(run.status).toBe(200);
    expect(run.json.run.status).toBe('error');
    expect(run.json.run.unroutedError).toBe(true);

    const detail = await req<ExecutionWithSteps>('GET', `/executions/${run.json.run.executionId}`);
    expect(detail.json.status).toBe('error');
    const byId = Object.fromEntries(detail.json.steps.map((s) => [s.nodeId, s.status]));
    expect(byId.missing_target).toBe('error');
    expect(byId.s3).toBe('skipped');
  });

  it('a trigger with target.kind "workflow" runs the workflow via the one dispatcher path', async () => {
    // A webhook trigger whose target is a WORKFLOW (not a function).
    const created = await req<TriggerResponse>('POST', '/admin/triggers', {
      type: 'webhook',
      target: { kind: 'workflow', name: 'chain' },
      webhook: { slug: 'run-chain' }
    });
    expect(created.status).toBe(201);
    const triggerId = created.json.trigger.id;

    // Manual test-fire exercises dispatcher.fire() -> the workflow branch.
    const fired = await req<TriggerFiredResponse>('POST', `/admin/triggers/${triggerId}/fire`, { via: 'trigger' });
    expect(fired.status).toBe(200);
    expect((fired.json.result as { ok: boolean }).ok).toBe(true);

    // The run appears in the execution history tagged with the trigger id.
    const list = await req<WorkflowExecution[]>('GET', '/executions?workflowId=chain&limit=50');
    const viaTrigger = list.json.find(
      (e) => (e.metadata as { triggerId?: string } | undefined)?.triggerId === triggerId
    );
    if (!viaTrigger) throw new Error(`no execution of "chain" carries triggerId ${triggerId}`);
    expect(viaTrigger.status).toBe('success');
    expect(viaTrigger.metadata?.kind).toBe('workflow');
  });
});
