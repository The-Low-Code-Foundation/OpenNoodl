import { ExecutionHistoryManager, type IpcMainLike } from '../../src/main/src/execution-history/ExecutionHistoryManager';

/** Simulates the ipcRenderer.invoke -> ipcMain.handle roundtrip the panel's hooks rely on. */
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

describe('ExecutionHistoryManager', () => {
  it('reports "not initialized" for list/get before init() is called', () => {
    const manager = new ExecutionHistoryManager();

    const listResult = manager.list({});
    expect(listResult).toEqual({ error: expect.stringContaining('not been initialized') });

    const getResult = manager.get('anything');
    expect(getResult).toEqual({ error: expect.stringContaining('not been initialized') });

    expect(manager.createLogger()).toBeNull();
  });

  it('init() opens node:sqlite by default and list/get work against it', () => {
    const manager = new ExecutionHistoryManager();
    const status = manager.init(':memory:');

    expect(status.initialized).toBe(true);
    expect(status.engine).toBe('node:sqlite');
    expect(status.persistent).toBe(true);

    const logger = manager.createLogger();
    expect(logger).not.toBeNull();
    const execId = logger!.startExecution({
      workflowId: 'wf-direct',
      workflowName: 'wf-direct',
      triggerType: 'test'
    });
    logger!.completeExecution(true);

    const list = manager.list({});
    expect(Array.isArray(list)).toBe(true);
    expect((list as unknown[]).length).toBe(1);

    const detail = manager.get(execId);
    expect(detail).not.toBeNull();
    expect((detail as { id: string }).id).toBe(execId);
  });

  it('registers IPC handlers that round-trip through a fake ipcMain, matching the panel hooks contract', async () => {
    const manager = new ExecutionHistoryManager();
    manager.init(':memory:');

    const ipcMain = new FakeIpcMain();
    manager.registerIpcHandlers(ipcMain);

    const logger = manager.createLogger()!;
    const execId = logger.startExecution({
      workflowId: 'wf-ipc',
      workflowName: 'wf-ipc',
      triggerType: 'webhook'
    });
    logger.completeExecution(true);

    // Exactly the channel names + call shape useExecutionHistory.ts / useExecutionDetail.ts use.
    // WFA-002: `list` answers with `{executions, sources}` rather than a bare
    // array — a bare array cannot say which stores answered, which is what made
    // "no backend running" and "backend running, nothing has run" identical.
    const listResult = (await ipcMain.invoke('execution-history:list', {
      limit: 100,
      orderBy: 'started_at',
      orderDir: 'desc'
    })) as { error?: string; executions: unknown[]; sources: { kind: string }[] };
    expect(listResult.error).toBeUndefined();
    expect(Array.isArray(listResult.executions)).toBe(true);
    expect(listResult.executions.length).toBe(1);
    expect(listResult.sources.map((s) => s.kind)).toEqual(['local']);

    const getResult = (await ipcMain.invoke('execution-history:get', execId)) as { id: string; steps: unknown[] };
    expect(getResult.id).toBe(execId);
    expect(getResult.steps).toEqual([]);
  });

  it('createLogger() returns independent loggers so concurrent executions do not clobber each other', () => {
    // ExecutionLogger keeps single-execution state internally; the manager's
    // contract is "one logger per execution" specifically to avoid this.
    const manager = new ExecutionHistoryManager();
    manager.init(':memory:');

    const loggerA = manager.createLogger()!;
    const loggerB = manager.createLogger()!;

    const execA = loggerA.startExecution({ workflowId: 'wf-a', workflowName: 'A', triggerType: 'webhook' });
    const execB = loggerB.startExecution({ workflowId: 'wf-b', workflowName: 'B', triggerType: 'webhook' });

    expect(execA).not.toBe(execB);

    loggerA.completeExecution(true);
    loggerB.completeExecution(false, new Error('nope'));

    const results = manager.list({}) as { id: string; status: string }[];
    const a = results.find((r) => r.id === execA);
    const b = results.find((r) => r.id === execB);
    expect(a?.status).toBe('success');
    expect(b?.status).toBe('error');
  });
});
