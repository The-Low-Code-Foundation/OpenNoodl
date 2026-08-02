/**
 * F37 — the name a schedule-triggered execution is recorded under.
 *
 * The defect this pins: the execution list showed `countOrdercountOrderss` for a
 * schedule fire — a name composed twice. The record's `workflowName` has exactly
 * three writers (`WorkflowRunner.run`, `WorkflowEngine.executeRun`,
 * `TriggerDispatcher.writeFailedRecord`) and a schedule fire reaches all three
 * depending on the target, so each is asserted here against a REAL fire driven by
 * the CronScheduler — not by calling the logger directly, which is where the
 * doubling could never have been.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { SecretsStore } from '../src/config/SecretsStore';
import { ExecutionHistory } from '../src/execution/ExecutionStore';
import { TriggerDispatcher } from '../src/triggers/dispatcher';
import { TriggerRegistry } from '../src/triggers/registry';
import { CronScheduler } from '../src/triggers/scheduler';
import { WorkflowRunner } from '../src/workflow/WorkflowRunner';
import { WorkflowSubsystem } from '../src/workflow/WorkflowSubsystem';

jest.setTimeout(30000);

/** A cloud function called `countOrders`, in a bundle file of the same name. */
const COUNT_ORDERS_BUNDLE = {
  components: [
    {
      name: '/#__cloud__/countOrders',
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

describe('F37 — a schedule fire records the target name once', () => {
  let dir: string;
  let executions: ExecutionHistory;
  let runner: WorkflowRunner;
  let workflows: WorkflowSubsystem;
  let registry: TriggerRegistry;
  let dispatcher: TriggerDispatcher;

  beforeEach(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-f37-'));
    const workflowsPath = path.join(dir, 'workflows');
    fs.mkdirSync(workflowsPath, { recursive: true });
    // Bundle file name == function name: the shape the defect was observed on.
    fs.writeFileSync(path.join(workflowsPath, 'countOrders.workflow.json'), JSON.stringify(COUNT_ORDERS_BUNDLE));

    executions = new ExecutionHistory();
    const status = executions.open(dir);
    if (!status.enabled) throw new Error(`execution history unavailable: ${status.error}`);

    runner = new WorkflowRunner({
      workflowsPath,
      executions,
      backendId: 'backend_f37',
      backendName: 'F37 backend'
    });
    await runner.initialize();
    await runner.loadWorkflows();

    workflows = new WorkflowSubsystem({
      dataDir: dir,
      executions,
      getRunner: () => runner,
      backendId: 'backend_f37',
      backendName: 'F37 backend'
    });

    registry = new TriggerRegistry(dir, new SecretsStore(dir));
    dispatcher = new TriggerDispatcher({
      registry,
      executions,
      getRunner: () => runner,
      getWorkflows: () => workflows,
      backendId: 'backend_f37',
      backendName: 'F37 backend'
    });
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  /**
   * Arm a catch-up fire and let it complete. `run-once-on-start` plus a
   * recorded past fire is the one deterministic way to make the scheduler fire
   * at `start()` rather than on a wall-clock timer.
   */
  async function fireScheduleNow(target: { kind: 'function' | 'workflow'; name: string }): Promise<void> {
    const { trigger } = registry.upsert({
      type: 'schedule',
      target,
      schedule: { cron: '0 * * * *', missedFirePolicy: 'run-once-on-start' }
    });
    registry.recordFire(trigger.id, { firedAt: '2026-01-01T08:00:00.000Z' });

    const scheduler = new CronScheduler({
      registry,
      dispatcher,
      now: () => new Date(2026, 0, 1, 12, 30)
    });
    scheduler.start();
    // The catch-up is fire-and-forget; give the run (and its record) time to land.
    for (let i = 0; i < 50; i++) {
      await new Promise((resolve) => setTimeout(resolve, 20));
      if (executions.list({}).some((e) => e.status !== 'running')) break;
    }
    scheduler.stop();
  }

  it('a schedule on a cloud function names the function exactly once', async () => {
    await fireScheduleNow({ kind: 'function', name: 'countOrders' });

    const rows = executions.list({});
    expect(rows).toHaveLength(1);
    expect(rows[0].triggerType).toBe('schedule');
    expect(rows[0].workflowName).toBe('countOrders');
    expect(rows[0].workflowId).toBe('countOrders');
  });

  it('a schedule on a workflow names the workflow exactly once', async () => {
    workflows.registry.upsert({
      id: 'countOrders',
      name: 'Count orders',
      entry: 'noop',
      steps: [{ id: 'noop', kind: 'stop' }]
    });

    await fireScheduleNow({ kind: 'workflow', name: 'countOrders' });

    const rows = executions.list({}).filter((e) => (e.metadata as { kind?: string })?.kind === 'workflow');
    expect(rows).toHaveLength(1);
    expect(rows[0].triggerType).toBe('schedule');
    expect(rows[0].workflowName).toBe('Count orders');
    expect(rows[0].workflowId).toBe('countOrders');
  });

  it('a schedule on a missing target names it once in the loud failed record', async () => {
    await fireScheduleNow({ kind: 'function', name: 'countOrders_gone' });

    const rows = executions.list({});
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('error');
    expect(rows[0].workflowName).toBe('countOrders_gone');
  });
});
