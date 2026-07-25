/**
 * WF-006 integration test: run a function through WorkflowRunner.run() — the
 * actual wiring point this task adds — and assert the execution is (a) in
 * the shared store and (b) retrievable through the exact IPC handlers the
 * Execution History Panel's hooks call.
 *
 * WorkflowRunner.js is required directly (CommonJS) rather than driving it
 * through LocalBackendServer/BackendManager, since spinning up a real HTTP
 * server + LocalSQLAdapter is unrelated surface for this task — WF-006 only
 * needs to prove the logging wiring at the run boundary works, which is
 * exactly what `run()` is.
 */
import type { IpcMainLike } from '../../src/main/src/execution-history/ExecutionHistoryManager';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { executionHistoryManager } = require('../../src/main/src/execution-history/ExecutionHistoryManager');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { WorkflowRunner } = require('../../src/main/src/local-backend/WorkflowRunner');

class FakeIpcMain implements IpcMainLike {
  private handlers = new Map<string, (event: unknown, ...args: unknown[]) => unknown>();

  handle(channel: string, listener: (event: unknown, ...args: unknown[]) => unknown): void {
    this.handlers.set(channel, listener);
  }

  async invoke(channel: string, ...args: unknown[]): Promise<unknown> {
    const handler = this.handlers.get(channel);
    if (!handler) throw new Error(`FakeIpcMain: no handler registered for "${channel}"`);
    return handler({}, ...args);
  }
}

function makeRunner(overrides: Record<string, unknown> = {}) {
  const runner = new WorkflowRunner({
    workflowsPath: '/tmp/wf-006-test-unused',
    adapter: {},
    backendId: 'backend_test',
    backendName: 'Test Backend',
    ...overrides
  });
  // Bypass the real (dynamic, best-effort) CloudRunner discovery — WF-006 is
  // only responsible for what happens around a resolved cloudRunner.run()
  // call, not for CloudRunner resolution itself.
  runner.loadedWorkflows.set('test-workflow', {
    components: [{ name: '/#__cloud__/myFunc' }]
  });
  runner.isInitialized = true;
  return runner;
}

describe('WorkflowRunner.run() -> execution-history wiring', () => {
  // executionHistoryManager is a module-level singleton shared by
  // WorkflowRunner.js and this test (same resolved file path). Both init()
  // and registerIpcHandlers() are idempotent by design (mirroring production,
  // where main.js only ever calls setupExecutionHistoryIPC() once) — so this
  // is done exactly once, in beforeAll, and tests are isolated from each
  // other by using a distinct function/workflow name per test and filtering
  // on it, rather than by resetting the store.
  const ipcMain = new FakeIpcMain();

  beforeAll(() => {
    executionHistoryManager.init(':memory:');
    executionHistoryManager.registerIpcHandlers(ipcMain);
  });

  it('logs a successful execution, then it is retrievable by list and get over the IPC path', async () => {
    const runner = makeRunner();
    runner.cloudRunner = {
      run: async () => ({ statusCode: 200, body: JSON.stringify({ ok: true }) })
    };

    const response = await runner.run('myFunc', {
      body: JSON.stringify({ email: 'a@b.com', password: 'super-secret' }),
      headers: { authorization: 'Bearer xyz', 'content-type': 'application/json' }
    });

    expect(response.statusCode).toBe(200);

    // Retrieve via the exact IPC channel the panel's useExecutionHistory hook calls.
    const listResult = (await ipcMain.invoke('execution-history:list', {
      limit: 100,
      orderBy: 'started_at',
      orderDir: 'desc'
    })) as { id: string; workflowId: string; status: string }[];

    const record = listResult.find((r) => r.workflowId === 'myFunc');
    expect(record).toBeDefined();
    expect(record?.status).toBe('success');

    // Retrieve via the exact IPC channel useExecutionDetail.ts calls.
    const detail = (await ipcMain.invoke('execution-history:get', record!.id)) as {
      id: string;
      status: string;
      durationMs?: number;
      triggerData?: { headers?: Record<string, unknown>; body?: Record<string, unknown> };
      metadata?: { backendId?: string; backendName?: string };
    };

    expect(detail.id).toBe(record!.id);
    expect(detail.status).toBe('success');
    expect(typeof detail.durationMs).toBe('number');

    // Secrets must be scrubbed before they ever reached the store.
    expect(detail.triggerData?.headers?.authorization).toBe('[REDACTED]');
    expect(detail.triggerData?.headers?.['content-type']).toBe('application/json');
    expect(detail.triggerData?.body?.email).toBe('a@b.com');
    expect(detail.triggerData?.body?.password).toBe('[REDACTED]');

    // Run-boundary metadata carried through from LocalBackendServer's config.
    expect(detail.metadata?.backendId).toBe('backend_test');
    expect(detail.metadata?.backendName).toBe('Test Backend');
  });

  it('logs a failed execution (thrown error) as status "error" with the error message', async () => {
    const runner = makeRunner();
    runner.loadedWorkflows.set('test-workflow-2', {
      components: [{ name: '/#__cloud__/failingFunc' }]
    });
    runner.cloudRunner = {
      run: async () => {
        throw new Error('database connection refused');
      }
    };

    const response = await runner.run('failingFunc', { body: '{}', headers: {} });
    expect(response.statusCode).toBe(500);

    const listResult = (await ipcMain.invoke('execution-history:list', {
      limit: 100,
      orderBy: 'started_at',
      orderDir: 'desc'
    })) as { id: string; workflowId: string; status: string; errorMessage?: string }[];

    const record = listResult.find((r) => r.workflowId === 'failingFunc');
    expect(record).toBeDefined();
    expect(record?.status).toBe('error');

    const detail = (await ipcMain.invoke('execution-history:get', record!.id)) as { errorMessage?: string };
    expect(detail.errorMessage).toBe('database connection refused');
  });

  it('logs a non-2xx CloudRunner response as status "error"', async () => {
    const runner = makeRunner();
    runner.loadedWorkflows.set('test-workflow-3', {
      components: [{ name: '/#__cloud__/badRequestFunc' }]
    });
    runner.cloudRunner = {
      run: async () => ({ statusCode: 400, body: JSON.stringify({ error: 'bad input' }) })
    };

    await runner.run('badRequestFunc', { body: '{}', headers: {} });

    const listResult = (await ipcMain.invoke('execution-history:list', {
      limit: 100,
      orderBy: 'started_at',
      orderDir: 'desc'
    })) as { workflowId: string; status: string }[];

    const record = listResult.find((r) => r.workflowId === 'badRequestFunc');
    expect(record?.status).toBe('error');
  });

  it('does not log anything for a call to an unknown function (404 before any run starts)', async () => {
    const runner = makeRunner();
    // A resolved cloudRunner that would fail the test if it were ever called —
    // hasFunction() should reject 'doesNotExist' before run() gets this far.
    runner.cloudRunner = {
      run: async () => {
        throw new Error('should not be called for an unknown function');
      }
    };

    const response = await runner.run('doesNotExist', { body: '{}', headers: {} });
    expect(response.statusCode).toBe(404);

    const listResult = (await ipcMain.invoke('execution-history:list', {
      limit: 1000,
      orderBy: 'started_at',
      orderDir: 'desc'
    })) as { workflowId: string }[];

    expect(listResult.some((r) => r.workflowId === 'doesNotExist')).toBe(false);
  });
});
