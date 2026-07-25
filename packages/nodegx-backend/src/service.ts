/**
 * BackendService — the composition root for the standalone service.
 *
 * Ties together the four pieces WF-004 says this package embeds:
 *   - persistence   (createAdapter)      REAL, verified in the front half
 *   - HTTP surface   (HttpServer)        PLACEHOLDER — health only; routes deferred
 *   - WorkflowRunner (WorkflowRunner)    PLACEHOLDER — relocation deferred (WF-006 owns file)
 *   - ExecutionStore (ExecutionStore)    PLACEHOLDER — introduced by WF-006
 *
 * No Electron anywhere. This runs identically as a child process the editor
 * spawns and as a headless server on a deploy target.
 *
 * @module nodegx-backend/service
 */

import { BackendServiceOptions, resolveOptions, requiresAuth } from './config';
import { createAdapter, PersistenceHandle } from './persistence/createAdapter';
import { ExecutionStore } from './execution/ExecutionStore';
import { HttpServer, ListenInfo } from './server/HttpServer';
import { WorkflowRunner } from './workflow/WorkflowRunner';

export interface StartedService {
  options: BackendServiceOptions;
  listen: ListenInfo;
  persistence: PersistenceHandle;
  stop(): Promise<void>;
}

export class BackendService {
  readonly options: BackendServiceOptions;
  private persistence: PersistenceHandle | null = null;
  private http: HttpServer | null = null;
  private runner: WorkflowRunner | null = null;
  private executions: ExecutionStore | null = null;

  constructor(partial: Partial<BackendServiceOptions> = {}) {
    this.options = resolveOptions(partial);
  }

  /**
   * Open persistence (loud-failure if it cannot persist), wire the placeholder
   * runner/store, and start the health HTTP server.
   */
  async start(): Promise<StartedService> {
    // 1. Persistence first — if this throws (no engine + !allowEphemeral) the
    //    service refuses to start. That is the point.
    this.persistence = await createAdapter({
      dataDir: this.options.dataDir,
      allowEphemeral: this.options.allowEphemeral
    });

    // 2. Reserved homes for the deferred pieces.
    this.runner = new WorkflowRunner({ persistence: this.persistence, dataDir: this.options.dataDir });
    await this.runner.load();
    this.executions = new ExecutionStore({ persistence: this.persistence });

    // 3. HTTP surface (health-only placeholder in the front half).
    this.http = new HttpServer({ options: this.options, persistence: this.persistence });
    const listen = await this.http.listen();

    return {
      options: this.options,
      listen,
      persistence: this.persistence,
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
    this.runner = null;
    this.executions = null;
  }

  /** True when the current options require a bearer token (non-loopback bind). */
  requiresAuth(): boolean {
    return requiresAuth(this.options);
  }
}
