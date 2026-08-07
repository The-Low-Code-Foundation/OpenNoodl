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

  function addLocalExecution(manager: ExecutionHistoryManager): void {
    const logger = manager.createLogger();
    expect(logger).not.toBeNull();
    logger!.startExecution({
      workflowId: 'localFunc',
      workflowName: 'localFunc',
      triggerType: 'manual'
    });
    logger!.completeExecution(true);
  }

  it('merges remote executions with the local store, newest first', async () => {
    const manager = makeManager(true);
    addLocalExecution(manager);

    const { executions } = await manager.listMerged({ limit: 10 });
    const ids = executions.map((e) => e.workflowId);
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
    const { executions } = await manager.listMerged({ limit: 10 });
    expect(executions.length).toBe(1);
    expect(executions[0].workflowId).toBe('remoteFunc');
  });

  it('an unreachable backend degrades to local-only, not an error', async () => {
    const manager = new ExecutionHistoryManager();
    manager.init(':memory:');
    manager.setRemoteSources(() => [{ id: 'x', name: 'Dead', endpoint: 'http://127.0.0.1:1' }]);
    const { executions, error } = await manager.listMerged({ limit: 10 });
    expect(Array.isArray(executions)).toBe(true);
    expect(error).toBeUndefined();
  });

  // WFA-002 — the panel cannot tell "no backend" from "backend with no runs"
  // from "the backend that had the runs is unreachable" unless the list says
  // which sources answered. All three used to render as one empty list.
  describe('source reporting (WFA-002)', () => {
    it('reports every source, its reachability and its row count', async () => {
      const manager = makeManager(true);
      addLocalExecution(manager);

      const { sources } = await manager.listMerged({ limit: 10 });
      const local = sources.find((s) => s.kind === 'local');
      const backend = sources.find((s) => s.id === 'backend_remote');

      expect(local!.id).toBe('local');
      expect(local!.reachable).toBe(true);
      expect(local!.count).toBe(1);
      expect(backend!.kind).toBe('backend');
      expect(backend!.reachable).toBe(true);
      expect(backend!.count).toBe(1);
    });

    it('marks an unreachable backend unreachable, with a reason', async () => {
      const manager = new ExecutionHistoryManager();
      manager.init(':memory:');
      manager.setRemoteSources(() => [{ id: 'x', name: 'Dead', endpoint: 'http://127.0.0.1:1' }]);

      const { sources } = await manager.listMerged({ limit: 10 });
      const dead = sources.find((s) => s.id === 'x');
      expect(dead!.reachable).toBe(false);
      expect(dead!.count).toBe(0);
      expect(typeof dead!.error).toBe('string');
    });

    it('stamps which source served each row', async () => {
      const manager = makeManager(true);
      addLocalExecution(manager);

      const { executions } = await manager.listMerged({ limit: 10 });
      const remote = executions.find((e) => e.workflowId === 'remoteFunc');
      const local = executions.find((e) => e.workflowId === 'localFunc');

      expect(remote!.metadata!.sourceId).toBe('backend_remote');
      expect(remote!.metadata!.sourceName).toBe('Remote');
      expect(local!.metadata!.sourceId).toBe('local');
      // The backend's own `backendId` is preserved, not overwritten: that is
      // what the backend called itself, which is a different fact.
      expect(remote!.metadata!.backendId).toBe('backend_remote');
    });

    it('reports an error only when there is nothing to ask at all', async () => {
      const manager = new ExecutionHistoryManager();
      manager.setRemoteSources(() => []);
      const { executions, sources, error } = await manager.listMerged({ limit: 10 });
      expect(executions).toEqual([]);
      expect(sources.length).toBe(1);
      expect(sources[0].kind).toBe('local');
      expect(typeof error).toBe('string');
    });
  });

  /**
   * FH-024 (b) — `GET /executions` is an `access: { kind: 'admin' }` route that
   * does not start with `admin/`, and dev-open no longer relaxes the admin
   * gate. These two fetches were the only admin calls in the editor that did
   * not go through `ServiceSupervisor.request`, so the whole panel started
   * rendering "running but could not be read: HTTP 401" against every local
   * backend. Driven in the real editor 2026-08-06 before it was fixed.
   *
   * The stand-in server below *enforces*, exactly as a post-FH-024 backend
   * does; the first case is red without the bearer header.
   */
  describe('an enforcing backend (FH-024)', () => {
    let authServer: http.Server;
    let authEndpoint: string;
    const TOKEN = 'fh024-admin-token';
    let seenAuth: string | undefined;

    beforeAll(async () => {
      authServer = http.createServer((req, res) => {
        seenAuth = req.headers.authorization;
        res.setHeader('content-type', 'application/json');
        if (req.headers.authorization !== `Bearer ${TOKEN}`) {
          res.statusCode = 401;
          res.end(JSON.stringify({ error: 'Unauthorized' }));
          return;
        }
        const url = req.url || '';
        if (url.startsWith('/executions/exec_remote1')) res.end(JSON.stringify({ ...remoteExecution, steps: [] }));
        else if (url.startsWith('/executions')) res.end(JSON.stringify([remoteExecution]));
        else {
          res.statusCode = 404;
          res.end('{}');
        }
      });
      await new Promise<void>((resolve) => authServer.listen(0, '127.0.0.1', () => resolve()));
      const addr = authServer.address();
      authEndpoint = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
    });

    afterAll(() => {
      authServer.close();
    });

    function enforcingManager(token: string | null): ExecutionHistoryManager {
      const manager = new ExecutionHistoryManager();
      manager.init(':memory:');
      manager.setRemoteSources(() => [
        { id: 'backend_remote', name: 'Remote', endpoint: authEndpoint, adminToken: token }
      ]);
      return manager;
    }

    it('reads the list when the source carries the admin token', async () => {
      const { executions, sources } = await enforcingManager(TOKEN).listMerged({ limit: 10 });
      expect(seenAuth).toBe(`Bearer ${TOKEN}`);
      expect(executions.map((e) => e.workflowId)).toContain('remoteFunc');
      expect(sources.find((s) => s.id === 'backend_remote')!.reachable).toBe(true);
    });

    it('opens a run from the source that owns it', async () => {
      const detail = (await enforcingManager(TOKEN).getMerged('exec_remote1')) as { workflowId: string };
      expect(detail.workflowId).toBe('remoteFunc');
    });

    // The regression, kept as its own case: without the credential the panel
    // must still say *why*, not merely show an empty list.
    it('without the token, reports the source unreachable with the 401', async () => {
      const { executions, sources } = await enforcingManager(null).listMerged({ limit: 10 });
      expect(executions).toEqual([]);
      const backend = sources.find((s) => s.id === 'backend_remote')!;
      expect(backend.reachable).toBe(false);
      expect(backend.error).toBe('HTTP 401');
    });
  });
});
