/**
 * BackendService — the composition root for the standalone service.
 *
 * Start order matters and is deliberate:
 *
 *   1. Persistence (loud-failure: no engine + !allowEphemeral => refuse to start)
 *   2. Execution history (`<dataDir>/executions.sqlite`; disabled-loudly if it
 *      cannot open — never blocks function runs)
 *   3. HTTP surface (listen; `/functions` answers 503 until step 5)
 *   4. `_noodl_cloudservices` loopback — record/user/config nodes running
 *      INSIDE cloud functions speak the Parse-wire subset back to this same
 *      process. This is what finally gives functions database access; the old
 *      in-editor runner's adapter injection was consumed by nothing.
 *   5. WorkflowRunner (CloudRunner bundled statically — no silent path probes)
 *
 * No Electron anywhere. This runs identically as a child process the editor
 * spawns and as a headless server on a deploy target.
 *
 * @module nodegx-backend/service
 */

import * as fs from 'fs';
import * as path from 'path';

import { BackendServiceOptions, resolveOptions, requiresAuth } from './config';
import { createAdapter, PersistenceHandle } from './persistence/createAdapter';
import { AdapterFacade } from './persistence/AdapterFacade';
import { ExecutionHistory, ExecutionHistoryStatus } from './execution/ExecutionStore';
import { HttpServer, ListenInfo } from './server/HttpServer';
import { WorkflowRunner } from './workflow/WorkflowRunner';

export interface StartedService {
  options: BackendServiceOptions;
  listen: ListenInfo;
  persistence: PersistenceHandle;
  executionHistory: ExecutionHistoryStatus;
  workflows: { initialized: boolean; workflowCount: number };
  stop(): Promise<void>;
}

export class BackendService {
  readonly options: BackendServiceOptions;
  private persistence: PersistenceHandle | null = null;
  private facade: AdapterFacade | null = null;
  private http: HttpServer | null = null;
  private runner: WorkflowRunner | null = null;
  private readonly executions = new ExecutionHistory();

  constructor(partial: Partial<BackendServiceOptions> = {}) {
    this.options = resolveOptions(partial);
  }

  async start(): Promise<StartedService> {
    // 0. This process IS a cloud runtime: the runtime clients (cloudstore,
    //    configservice) branch on `_noodl_cloud_runtime_version` to pick their
    //    fetch-based code path over browser XHR. The esbuild bundle defines it
    //    via banner; define it here too so the service behaves identically
    //    un-bundled (tests, programmatic embedding).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = globalThis as any;
    if (typeof g._noodl_cloud_runtime_version === 'undefined') {
      g._noodl_cloud_runtime_version = 'nodegx-backend';
    }

    // 1. Persistence first — if this throws (no engine + !allowEphemeral) the
    //    service refuses to start. That is the point.
    this.persistence = await createAdapter({
      dataDir: this.options.dataDir,
      allowEphemeral: this.options.allowEphemeral
    });
    this.facade = new AdapterFacade(this.persistence.adapter);
    this.ensureSystemTables();

    // 2. Execution history beside the data.
    const executionHistory = this.executions.open(this.options.dataDir);
    if (!executionHistory.enabled) {
      // eslint-disable-next-line no-console
      console.warn(
        `[nodegx-backend] execution history DISABLED: ${executionHistory.error} — function runs proceed unlogged.`
      );
    }

    // 3. HTTP surface.
    this.http = new HttpServer({
      options: this.options,
      persistence: this.persistence,
      facade: this.facade,
      executions: this.executions,
      getRunner: () => this.runner,
      getConfigParams: () => this.readConfigParams()
    });
    const listen = await this.http.listen();

    // 4. Loopback cloud services for nodes running inside functions. One
    //    service process serves exactly one backend, so a process-wide global
    //    is safe here. Always loop back over 127.0.0.1 even on wider binds.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any)._noodl_cloudservices = {
      endpoint: `http://127.0.0.1:${listen.port}`,
      appId: this.options.backendId
    };

    // 5. Workflows.
    this.runner = new WorkflowRunner({
      workflowsPath: path.join(this.options.dataDir, 'workflows'),
      executions: this.executions,
      backendId: this.options.backendId,
      backendName: this.options.backendName
    });
    await this.runner.initialize();
    await this.runner.loadWorkflows();

    return {
      options: this.options,
      listen,
      persistence: this.persistence,
      executionHistory,
      workflows: this.runner.getStatus(),
      stop: () => this.stop()
    };
  }

  async stop(): Promise<void> {
    if (this.http) {
      await this.http.close();
      this.http = null;
    }
    if (this.persistence && this.persistence.adapter) {
      await this.persistence.adapter.disconnect();
    }
    this.persistence = null;
    this.facade = null;
    this.runner = null;
  }

  /** True when the current options require a bearer token (non-loopback bind). */
  requiresAuth(): boolean {
    return requiresAuth(this.options);
  }

  /**
   * Parse's built-in classes, pre-created so the session endpoints can query
   * them before any row exists (a `where` on a column of a not-yet-created
   * table is a SQL error, not an empty result).
   */
  private ensureSystemTables(): void {
    const sm = this.facade && this.facade.schemaManager;
    if (!sm) return;
    sm.createTable({
      name: '_User',
      columns: [
        { name: 'username', type: 'String' },
        { name: 'email', type: 'String' },
        { name: '_hashed_password', type: 'String' }
      ]
    });
    sm.createTable({
      name: '_Session',
      columns: [
        { name: 'sessionToken', type: 'String' },
        { name: 'userId', type: 'String' }
      ]
    });
  }

  /**
   * `/config` params: `<dataDir>/config-params.json` when present, else {}.
   * Read per request so edits apply without a restart (the client caches for
   * 15 minutes anyway).
   */
  private readConfigParams(): Record<string, unknown> {
    try {
      const p = path.join(this.options.dataDir, 'config-params.json');
      if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf-8'));
    } catch {
      // Unparsable config-params is not worth failing /config over — functions
      // await this endpoint on every run.
    }
    return {};
  }
}
