/**
 * WF-004: executions happen in nodegx-backend child processes, each owning its
 * own store; the panel's IPC channels merge those stores (over HTTP) with the
 * editor-local one. This exercises listMerged/getMerged against a real local
 * HTTP server standing in for a running backend service.
 */
import * as http from 'http';

import { ExecutionHistoryManager } from '../../src/main/src/execution-history/ExecutionHistoryManager';

describe('ExecutionHistoryManager remote-store merge (WF-004)', () => {
  let server: http.Server;
  let endpoint: string;

  const remoteExecution = {
    id: 'exec_remote1',
    workflowId: 'remoteFunc',
    workflowName: 'remoteFunc',
    triggerType: 'webhook',
    status: 'success',
    startedAt: Date.now() + 1000, // newer than anything local
    metadata: { backendId: 'backend_remote' }
  };

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      const url = req.url || '';
      res.setHeader('content-type', 'application/json');
      if (url.startsWith('/executions/exec_remote1')) {
        res.end(JSON.stringify({ ...remoteExecution, steps: [] }));
      } else if (url.startsWith('/executions')) {
        res.end(JSON.stringify([remoteExecution]));
      } else {
        res.statusCode = 404;
        res.end('{}');
      }
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const addr = server.address();
    endpoint = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
  });

  afterAll(() => {
    server.close();
  });

  function makeManager(withLocal: boolean): ExecutionHistoryManager {
    const manager = new ExecutionHistoryManager();
    if (withLocal) manager.init(':memory:');
    manager.setRemoteSources(() => [{ id: 'backend_remote', name: 'Remote', endpoint }]);
    return manager;
  }

  it('merges remote executions with the local store, newest first', async () => {
    const manager = makeManager(true);

    const logger = manager.createLogger();
    expect(logger).not.toBeNull();
    logger!.startExecution({
      workflowId: 'localFunc',
      workflowName: 'localFunc',
      triggerType: 'manual'
    });
    logger!.completeExecution(true);

    const merged = (await manager.listMerged({ limit: 10 })) as { workflowId: string }[];
    const ids = merged.map((e) => e.workflowId);
    expect(ids).toContain('localFunc');
    expect(ids).toContain('remoteFunc');
    // Remote entry was stamped newer — the merge re-sorts by startedAt desc.
    expect(ids[0]).toBe('remoteFunc');
  });

  it('getMerged falls through to the remote store for unknown local ids', async () => {
    const manager = makeManager(true);
    const detail = (await manager.getMerged('exec_remote1')) as { workflowId: string };
    expect(detail.workflowId).toBe('remoteFunc');
  });

  it('serves remote-only results when the local store never initialized', async () => {
    const manager = makeManager(false);
    const merged = (await manager.listMerged({ limit: 10 })) as { workflowId: string }[];
    expect(merged.length).toBe(1);
    expect(merged[0].workflowId).toBe('remoteFunc');
  });

  it('an unreachable backend degrades to local-only, not an error', async () => {
    const manager = new ExecutionHistoryManager();
    manager.init(':memory:');
    manager.setRemoteSources(() => [{ id: 'x', name: 'Dead', endpoint: 'http://127.0.0.1:1' }]);
    const merged = await manager.listMerged({ limit: 10 });
    expect(Array.isArray(merged)).toBe(true);
  });
});
