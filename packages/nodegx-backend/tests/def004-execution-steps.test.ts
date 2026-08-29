/**
 * DEF-004 (a) — a cloud run records **what the graph did**, not what the author logged.
 *
 * ## What was measured before any of this was built
 *
 * Three real functions through a real `BackendService`, reading `executions.sqlite`:
 *
 * | graph | HTTP | record `status` | `steps` |
 * |---|---|---|---|
 * | Request → UUID → UUID → Response | 200 | `success` | `[]` |
 * | the same with one `Log` spliced in | 200 | `success` | 1, the `Log` |
 * | Request → Secret(**unprovisioned**) → Response on `failure` | 200 | `success` | `[]` |
 *
 * The third row is the defect in one line: **a run in which a node failed was recorded as a
 * success with nothing in it**, while the failure itself — fully attributed, carrying `nodeId`,
 * `nodeType`, `code` and `message` — went to a bare `console.error` and nowhere else.
 *
 * ## The seam, and why it is not the obvious one
 *
 * `Node.beginOutcome` / `reportOutcome` — per **invocation**, already carrying the verdict and, on
 * a failure, the reason. It reaches the run through `NodeScope.runContext`, which CWF-013 built
 * for the `Log` node for the same reason it is right here: the error bus hangs off `NodeContext`,
 * there is **one per `CloudRunner`**, and two cloud functions run concurrently in it. A bus
 * subscriber cannot say whose request an event belongs to. This can.
 *
 * ⚠️ **A step is an action invocation, not a node the graph passed through.** A `String Format`
 * neither succeeds nor fails; there is nothing to record about it beyond a value crossing a wire,
 * which is the per-edge trace's job and a different instrument with a different cost.
 *
 * 🔴 **The cardinality spec below is the one to keep.** Two producers now meet at one table — the
 * step `createLogSink` used to write for a `Log` line, and the outcome step the same node now
 * reports — and *a check in a second pipeline is a duplicate first*. One `Log` node, one row.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { ExecutionHistory } from '../src/execution/ExecutionStore';
import { BackendService } from '../src/service';

import { httpClient } from './helpers/http';

jest.setTimeout(40000);

/** Planted, so the record can be shown to be no less redacted than the log. */
const STORED_SECRET = 'sk_live_step_recorded_4c1f8a';

interface StepRow {
  nodeId: string;
  nodeType: string;
  status: string;
  errorMessage?: string;
  inputData?: Record<string, unknown>;
}

/** Request → UUID → UUID → Response. Four nodes, three action invocations, **no `Log`**. */
const noLogFunction = {
  name: '/#__cloud__/noLog',
  nodes: [
    {
      id: 'req',
      type: 'noodl.cloud.request',
      x: 0,
      y: 0,
      parameters: { allowNoAuth: true, params: 'seed' },
      ports: [],
      children: []
    },
    { id: 'u1', type: 'net.noodl.UUID', x: 0, y: 100, parameters: {}, ports: [], children: [] },
    { id: 'u2', type: 'net.noodl.UUID', x: 0, y: 200, parameters: {}, ports: [], children: [] },
    {
      id: 'res',
      type: 'noodl.cloud.response',
      x: 0,
      y: 300,
      parameters: { params: 'id' },
      ports: [],
      children: []
    }
  ],
  connections: [
    { sourceId: 'req', sourcePort: 'receive', targetId: 'u1', targetPort: 'generate' },
    { sourceId: 'u1', sourcePort: 'done', targetId: 'u2', targetPort: 'generate' },
    { sourceId: 'u2', sourcePort: 'uuid', targetId: 'res', targetPort: 'pm-id' },
    { sourceId: 'u2', sourcePort: 'done', targetId: 'res', targetPort: 'send' }
  ],
  roots: []
};

/** The same graph with **one** `Log` spliced in. The cardinality arm. */
const oneLogFunction = {
  name: '/#__cloud__/oneLog',
  nodes: [
    {
      id: 'req',
      type: 'noodl.cloud.request',
      x: 0,
      y: 0,
      parameters: { allowNoAuth: true, params: 'seed' },
      ports: [],
      children: []
    },
    { id: 'u1', type: 'net.noodl.UUID', x: 0, y: 100, parameters: {}, ports: [], children: [] },
    {
      id: 'log',
      type: 'net.noodl.Log',
      x: 0,
      y: 150,
      parameters: { level: 'info', message: 'halfway' },
      ports: [],
      children: []
    },
    { id: 'u2', type: 'net.noodl.UUID', x: 0, y: 200, parameters: {}, ports: [], children: [] },
    {
      id: 'res',
      type: 'noodl.cloud.response',
      x: 0,
      y: 300,
      parameters: { params: 'id' },
      ports: [],
      children: []
    }
  ],
  connections: [
    { sourceId: 'req', sourcePort: 'receive', targetId: 'u1', targetPort: 'generate' },
    { sourceId: 'u1', sourcePort: 'done', targetId: 'log', targetPort: 'log' },
    { sourceId: 'log', sourcePort: 'done', targetId: 'u2', targetPort: 'generate' },
    { sourceId: 'u2', sourcePort: 'uuid', targetId: 'res', targetPort: 'pm-id' },
    { sourceId: 'u2', sourcePort: 'done', targetId: 'res', targetPort: 'send' }
  ],
  roots: []
};

/**
 * Request → Secret(never provisioned) → Response **on the `failure` edge**.
 *
 * The graph handles its own failure and answers 200, which is exactly why the record used to
 * read `success` with nothing in it: the execution's status is derived from the HTTP answer.
 */
const failingFunction = {
  name: '/#__cloud__/failing',
  nodes: [
    {
      id: 'req',
      type: 'noodl.cloud.request',
      x: 0,
      y: 0,
      parameters: { allowNoAuth: true, params: 'seed' },
      ports: [],
      children: []
    },
    {
      id: 'sec',
      type: 'noodl.cloud.secret',
      x: 0,
      y: 100,
      parameters: { name: 'NEVER_PROVISIONED' },
      ports: [],
      children: []
    },
    { id: 'res', type: 'noodl.cloud.response', x: 0, y: 200, parameters: { params: 'id' }, ports: [], children: [] }
  ],
  connections: [
    { sourceId: 'req', sourcePort: 'receive', targetId: 'sec', targetPort: 'fetch' },
    { sourceId: 'sec', sourcePort: 'failure', targetId: 'res', targetPort: 'send' }
  ],
  roots: []
};

/** Request → Secret(**provisioned**) → Log(its value) → Response. The redaction arm. */
const secretLogFunction = {
  name: '/#__cloud__/secretLog',
  nodes: [
    {
      id: 'req',
      type: 'noodl.cloud.request',
      x: 0,
      y: 0,
      parameters: { allowNoAuth: true, params: 'seed' },
      ports: [],
      children: []
    },
    {
      id: 'sec',
      type: 'noodl.cloud.secret',
      x: 0,
      y: 100,
      parameters: { name: 'STRIPE_KEY' },
      ports: [],
      children: []
    },
    { id: 'log', type: 'net.noodl.Log', x: 0, y: 200, parameters: { level: 'warn' }, ports: [], children: [] },
    { id: 'res', type: 'noodl.cloud.response', x: 0, y: 300, parameters: { params: 'ok' }, ports: [], children: [] }
  ],
  connections: [
    { sourceId: 'req', sourcePort: 'receive', targetId: 'sec', targetPort: 'fetch' },
    { sourceId: 'sec', sourcePort: 'value', targetId: 'log', targetPort: 'message' },
    { sourceId: 'sec', sourcePort: 'done', targetId: 'log', targetPort: 'log' },
    { sourceId: 'log', sourcePort: 'done', targetId: 'res', targetPort: 'send' }
  ],
  roots: []
};


/**
 * Request → Response, with a `Static Data` node holding JSON that will not parse.
 *
 * 🔴 **The population the outcome contract does not cover, and the arm that took two tries to
 * find.** The first version of this arm used a `JavaScriptFunction` that throws, on the strength
 * of a `sendSignalOnOutput('failure')` grep hit. It graded nothing: `simplejavascript.ts` has
 * **both** paths, and its signal-driven `run` port goes through `beginOutcome` like any other
 * action, so that spec was a second test of the outcome path wearing a label that said otherwise.
 * The mutant that removed the bridge killed nothing, which is how it was caught.
 *
 * `Static Data` really is outside the contract: `reportFailure` calls `raiseRuntimeError` and
 * pulses `failure` by hand, and its own note records why it had to — *"perfect diagnosis on the
 * canvas, total silence in a deployed app, a cloud function, SSR and an export"*. That silence is
 * this task's subject one layer down.
 */
const staticDataFunction = {
  name: '/#__cloud__/badStaticData',
  nodes: [
    {
      id: 'req',
      type: 'noodl.cloud.request',
      x: 0,
      y: 0,
      parameters: { allowNoAuth: true, params: 'seed' },
      ports: [],
      children: []
    },
    {
      id: 'data',
      type: 'Static Data',
      x: 0,
      y: 100,
      parameters: { type: 'json', json: '{ this is not json' },
      ports: [],
      children: []
    },
    { id: 'res', type: 'noodl.cloud.response', x: 0, y: 200, parameters: { params: 'ok' }, ports: [], children: [] }
  ],
  connections: [{ sourceId: 'req', sourcePort: 'receive', targetId: 'res', targetPort: 'send' }],
  roots: []
};

describe('DEF-004 (a) — an execution record names the steps a cloud function ran', () => {
  let dataDir: string;
  let service: BackendService;
  let base: string;
  const client = httpClient(() => base);

  beforeAll(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-def004-'));
    fs.mkdirSync(path.join(dataDir, 'workflows'), { recursive: true });
    fs.writeFileSync(
      path.join(dataDir, 'workflows', 'def004.workflow.json'),
      JSON.stringify({
        components: [noLogFunction, oneLogFunction, failingFunction, secretLogFunction, staticDataFunction],
        settings: {},
        metadata: {}
      })
    );
    fs.writeFileSync(path.join(dataDir, 'secrets.json'), JSON.stringify({ functions: { STRIPE_KEY: STORED_SECRET } }), {
      mode: 0o600
    });
    service = new BackendService({ dataDir, port: 0, backendId: 'def004', backendName: 'DEF-004' });
    base = (await service.start()).listen.url;
  });

  afterAll(async () => {
    await service.stop();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  /** The last run of `workflowId`, read back out of sqlite the way a panel would. */
  const lastRun = (workflowId: string): { status: string; steps: StepRow[] } => {
    const history = new ExecutionHistory();
    history.open(dataDir);
    const runs = history.list({ workflowId, limit: 20 });
    expect(runs.length).toBeGreaterThan(0);
    const record = history.get(runs[0].id);
    return {
      status: runs[0].status,
      steps: ((record?.steps || []) as unknown as StepRow[]).map((s) => ({
        nodeId: s.nodeId,
        nodeType: s.nodeType,
        status: s.status,
        errorMessage: s.errorMessage,
        inputData: s.inputData
      }))
    };
  };

  it('records one step per action invocation, in order, for a graph with no Log node at all', async () => {
    const res = await client.request<{ result: { id?: string } }>('POST', '/functions/noLog', { body: { seed: 1 } });
    expect(res.status).toBe(200);

    const run = lastRun('noLog');
    // The measurement this whole task exists for: this list used to be empty.
    expect(run.steps.map((s) => `${s.nodeId}:${s.nodeType}:${s.status}`)).toEqual([
      'u1:net.noodl.UUID:success',
      'u2:net.noodl.UUID:success',
      'res:noodl.cloud.response:success'
    ]);
  });

  it('🔴 writes exactly ONE row for one Log node — two producers, one table', async () => {
    const res = await client.request('POST', '/functions/oneLog', { body: { seed: 1 } });
    expect(res.status).toBe(200);

    const run = lastRun('oneLog');
    const logRows = run.steps.filter((s) => s.nodeType === 'net.noodl.Log');
    // Reddens if `createLogSink` starts writing its own step again beside the outcome step.
    expect(logRows).toHaveLength(1);
    // …and the graph's other three actions are each recorded once too, so "one" above is not
    // one because everything collapsed to one.
    expect(run.steps).toHaveLength(4);
  });

  it('keeps the Log line itself in the record, which is the CWF-013 property the swap had to survive', async () => {
    await client.request('POST', '/functions/oneLog', { body: { seed: 1 } });
    const logRow = lastRun('oneLog').steps.find((s) => s.nodeType === 'net.noodl.Log');
    expect(JSON.stringify(logRow?.inputData || {})).toContain('halfway');
  });

  it('🔴 records a FAILED action as an error, naming the node and the reason', async () => {
    const res = await client.request('POST', '/functions/failing', { body: { seed: 1 } });
    // The graph answers 200 on its own failure edge — which is what made this invisible.
    expect(res.status).toBe(200);

    const run = lastRun('failing');
    const failed = run.steps.find((s) => s.status === 'error');
    expect(failed).toBeDefined();
    expect(failed?.nodeId).toBe('sec');
    expect(failed?.nodeType).toBe('noodl.cloud.secret');
    expect(failed?.errorMessage).toContain('secret/unavailable');
    expect(failed?.errorMessage).toContain('NEVER_PROVISIONED');
  });

  it('⚠️ the execution is still `success`, and the failed STEP is the only thing that says otherwise', async () => {
    await client.request('POST', '/functions/failing', { body: { seed: 1 } });
    const run = lastRun('failing');
    // Deliberate, and recorded here rather than in a comment nobody reads: the execution's
    // status means "the function answered 2xx", and a graph that handles its own failure and
    // answers 200 did not fail. What used to be missing is the row below it.
    expect(run.status).toBe('success');
    expect(run.steps.filter((s) => s.status === 'error')).toHaveLength(1);
  });

  it('a run where nothing failed has NO error step — the control for the two rows above', async () => {
    await client.request('POST', '/functions/noLog', { body: { seed: 1 } });
    const run = lastRun('noLog');
    expect(run.steps.filter((s) => s.status === 'error')).toHaveLength(0);
    expect(run.steps.length).toBeGreaterThan(0);
  });

  it('redacts a planted secret out of the step it records, exactly as it does out of the log line', async () => {
    const res = await client.request('POST', '/functions/secretLog', { body: { seed: 1 } });
    expect(res.status).toBe(200);

    const logRow = lastRun('secretLog').steps.find((s) => s.nodeType === 'net.noodl.Log');
    expect(JSON.stringify(logRow?.inputData || {})).toContain('[REDACTED]');
    // And the file itself, because a record that is less safe than the log is a record nobody
    // can reason about.
    expect(fs.readFileSync(path.join(dataDir, 'executions.sqlite')).toString('binary')).not.toContain(STORED_SECRET);
  });

  it('🔴 records a failure from a node that never adopted the outcome contract — Static Data on unparseable JSON', async () => {
    const res = await client.request('POST', '/functions/badStaticData', { body: { seed: 1 } });
    expect(res.status).toBe(200);

    const run = lastRun('badStaticData');
    const failed = run.steps.filter((s) => s.status === 'error');
    // Exactly one, not two: `raiseRuntimeError`'s bridge and the outcome path must never both
    // write for one failure. This is the second population of the cardinality assertion above.
    expect(failed).toHaveLength(1);
    expect(failed[0].nodeId).toBe('data');
    expect(failed[0].nodeType).toBe('Static Data');
    expect(failed[0].errorMessage).toBeTruthy();
  });

  it('does NOT double-record a contract-adopting node’s failure through the same bridge', async () => {
    await client.request('POST', '/functions/failing', { body: { seed: 1 } });
    const run = lastRun('failing');
    // `Secret` reports `failure` through `reportOutcome`, which raises on its way out. One row.
    expect(run.steps.filter((s) => s.nodeId === 'sec')).toHaveLength(1);
  });
});
