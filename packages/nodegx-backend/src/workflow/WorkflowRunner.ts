/**
 * WorkflowRunner — loads and executes cloud functions via CloudRunner, in the
 * service process (WF-004 second half; relocated from the editor's
 * `local-backend/WorkflowRunner.js`, which is deleted).
 *
 * What changed in the move:
 *
 *   - CloudRunner is imported STATICALLY (esbuild bundles
 *     `noodl-viewer-cloud/src` into the service via the `@cloud-runtime`
 *     alias). The old `findViewerCloudPath()` probe — which silently disabled
 *     workflows when the package didn't resolve — is gone; resolution cannot
 *     fail at runtime anymore, which is the loud-failure pass doing its job by
 *     construction.
 *   - Database access from inside functions goes over the wire: the service
 *     sets `_noodl_cloudservices` to point at ITSELF (see service.ts), so
 *     record/user/config nodes inside a function speak the Parse-wire subset
 *     back to this same process. The old `injectAdapterIntoContext()` hack —
 *     which nothing ever consumed — is gone.
 *   - Execution history is logged into THIS process's store
 *     (`<dataDir>/executions.sqlite`), same fresh-logger-per-run pattern and
 *     the same scrub rules as WF-006 (both come from
 *     `noodl-viewer-cloud/src/execution-history`).
 *
 * @module nodegx-backend/workflow/WorkflowRunner
 */

import { promises as fs } from 'fs';
import * as path from 'path';

import type { ExecutionHistory } from '../execution/ExecutionStore';

// Bundled from noodl-viewer-cloud/src by esbuild (test-time: jest mapper).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { CloudRunner } = require('@cloud-runtime');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { scrubRequestForLogging } = require('@cloud-runtime/execution-history');

function safeLog(...args: unknown[]): void {
  try {
    // eslint-disable-next-line no-console
    console.log('[WorkflowRunner]', ...args);
  } catch {
    // Ignore EPIPE
  }
}

export interface WorkflowRunnerOptions {
  workflowsPath: string;
  executions: ExecutionHistory;
  backendId: string;
  backendName: string;
  enableDebugInspectors?: boolean;
}

export interface RunnerResponse {
  statusCode: number;
  body: string;
}

export interface RunnerRequest {
  body?: string;
  headers?: Record<string, unknown>;
}

/**
 * Where a run came from, for execution-record tagging (WF-005). A direct
 * `POST /functions/:name` leaves this undefined and records as 'webhook'
 * (historical default); trigger dispatch passes the real source.
 */
export interface RunTriggerContext {
  /** Execution-history trigger type. */
  type: 'webhook' | 'schedule' | 'manual' | 'db_change' | 'internal_event' | 'test';
  /** Human-readable origin, e.g. `schedule trg_abc (0 * * * *)`. */
  source?: string;
  /** The trigger definition id, when fired by a registered trigger. */
  triggerId?: string;
}

export class WorkflowRunner {
  private readonly workflowsPath: string;
  private readonly executions: ExecutionHistory;
  private readonly backendId: string;
  private readonly backendName: string;
  private readonly enableDebugInspectors: boolean;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private cloudRunner: any = null;
  private loadedWorkflows = new Map<string, Record<string, unknown>>();
  isInitialized = false;

  constructor(options: WorkflowRunnerOptions) {
    this.workflowsPath = options.workflowsPath;
    this.executions = options.executions;
    this.backendId = options.backendId;
    this.backendName = options.backendName;
    this.enableDebugInspectors = options.enableDebugInspectors || false;
  }

  private createCloudRunner(): void {
    this.cloudRunner = new CloudRunner({
      enableDebugInspectors: this.enableDebugInspectors,
      connectToEditor: false
    });
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    this.createCloudRunner();
    this.isInitialized = true;
    safeLog('CloudRunner initialized');
  }

  /** Load every `*.workflow.json` in the workflows directory. */
  async loadWorkflows(): Promise<void> {
    if (!this.cloudRunner) throw new Error('WorkflowRunner not initialized');

    await fs.mkdir(this.workflowsPath, { recursive: true });
    const files = (await fs.readdir(this.workflowsPath)).filter((f) => f.endsWith('.workflow.json'));
    safeLog(`Found ${files.length} workflow files`);

    for (const file of files) {
      const workflowName = file.replace('.workflow.json', '');
      try {
        const content = await fs.readFile(path.join(this.workflowsPath, file), 'utf-8');
        const exportData = JSON.parse(content);
        this.loadedWorkflows.set(workflowName, exportData);
        await this.cloudRunner.load(exportData);
        safeLog(`Loaded workflow: ${workflowName}`);
      } catch (e) {
        // One broken file must not take down the rest — but say so.
        safeLog(`Failed to load workflow ${file}:`, e instanceof Error ? e.message : e);
      }
    }
  }

  /** Save + (re)load a single workflow (hot deploy from the editor). */
  async loadWorkflow(name: string, exportData: Record<string, unknown>): Promise<{ success: boolean; error?: string }> {
    if (!this.cloudRunner) return { success: false, error: 'WorkflowRunner not initialized' };
    try {
      await fs.mkdir(this.workflowsPath, { recursive: true });
      await fs.writeFile(path.join(this.workflowsPath, `${name}.workflow.json`), JSON.stringify(exportData, null, 2));
      this.loadedWorkflows.set(name, exportData);
      await this.cloudRunner.load(exportData);
      safeLog(`Workflow updated: ${name}`);
      return { success: true };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      safeLog(`Failed to update workflow ${name}:`, message);
      return { success: false, error: message };
    }
  }

  async deleteWorkflow(name: string): Promise<{ success: boolean; error?: string }> {
    try {
      await fs.unlink(path.join(this.workflowsPath, `${name}.workflow.json`));
      this.loadedWorkflows.delete(name);
      safeLog(`Workflow deleted: ${name}`);
      return { success: true };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return { success: false, error: message };
    }
  }

  /** Fresh CloudRunner + reload everything (clears all graph state). */
  async reloadWorkflows(): Promise<{ success: boolean; count: number }> {
    this.loadedWorkflows.clear();
    this.createCloudRunner();
    await this.loadWorkflows();
    safeLog('Workflows reloaded');
    return { success: true, count: this.loadedWorkflows.size };
  }

  /**
   * Execute a cloud function. Response is passed through verbatim from the
   * function's Response node; every run is logged to execution history
   * (scrubbed) unless history is disabled.
   */
  async run(functionName: string, request: RunnerRequest, trigger?: RunTriggerContext): Promise<RunnerResponse> {
    if (!this.cloudRunner) {
      return { statusCode: 503, body: JSON.stringify({ error: 'Workflows not initialized' }) };
    }
    if (!this.hasFunction(functionName)) {
      return { statusCode: 404, body: JSON.stringify({ error: `Function '${functionName}' not found` }) };
    }

    const startTime = Date.now();
    const logger = this.executions.createLogger();
    if (logger) {
      logger.startExecution({
        workflowId: functionName,
        workflowName: functionName,
        triggerType: trigger ? trigger.type : 'webhook',
        triggerData: scrubRequestForLogging(request || {}),
        metadata: {
          backendId: this.backendId,
          backendName: this.backendName,
          ...(trigger && trigger.source ? { triggerSource: trigger.source } : {}),
          ...(trigger && trigger.triggerId ? { triggerId: trigger.triggerId } : {})
        }
      });
    }

    try {
      safeLog(`Executing function: ${functionName}`);
      const response = await this.cloudRunner.run(functionName, request);
      const duration = Date.now() - startTime;
      safeLog(`Function ${functionName} completed in ${duration}ms`);

      const success = response.statusCode >= 200 && response.statusCode < 300;
      if (logger) logger.completeExecution(success, success ? undefined : new Error(`HTTP ${response.statusCode}`));

      return response;
    } catch (e) {
      const duration = Date.now() - startTime;
      const message = e instanceof Error ? e.message : String(e);
      safeLog(`Function ${functionName} failed after ${duration}ms:`, message);
      if (logger) logger.completeExecution(false, e instanceof Error ? e : new Error(message));
      return { statusCode: 500, body: JSON.stringify({ error: message }) };
    }
  }

  hasFunction(functionName: string): boolean {
    const fullName = `/#__cloud__/${functionName}`;
    for (const exportData of this.loadedWorkflows.values()) {
      const components = exportData.components as { name: string }[] | undefined;
      if (components && components.some((c) => c.name === fullName)) return true;
    }
    return false;
  }

  /**
   * The graph author's auth declaration for a function: the Request node's
   * `allowNoAuth` parameter. BAK-003 uses it as the default `call` rule
   * (public when true, authenticated otherwise); a config entry overrides it.
   */
  functionAllowsNoAuth(functionName: string): boolean {
    const fullName = `/#__cloud__/${functionName}`;
    for (const exportData of this.loadedWorkflows.values()) {
      const components =
        (exportData.components as { name: string; nodes?: Record<string, unknown>[] }[] | undefined) || [];
      for (const component of components) {
        if (component.name !== fullName) continue;
        const found = this.findRequestNode(component.nodes || []);
        return Boolean(found && (found.parameters as Record<string, unknown> | undefined)?.allowNoAuth === true);
      }
    }
    return false;
  }

  private findRequestNode(nodes: Record<string, unknown>[]): Record<string, unknown> | null {
    for (const node of nodes) {
      if (node.type === 'noodl.cloud.request') return node;
      const children = node.children as Record<string, unknown>[] | undefined;
      if (Array.isArray(children)) {
        const found = this.findRequestNode(children);
        if (found) return found;
      }
    }
    return null;
  }

  getAvailableFunctions(): { name: string; workflow: string }[] {
    const functions: { name: string; workflow: string }[] = [];
    for (const [workflowName, exportData] of this.loadedWorkflows) {
      const components = (exportData.components as { name: string }[] | undefined) || [];
      for (const component of components) {
        if (component.name.startsWith('/#__cloud__/')) {
          functions.push({ name: component.name.replace('/#__cloud__/', ''), workflow: workflowName });
        }
      }
    }
    return functions;
  }

  getStatus(): { initialized: boolean; workflowCount: number; functions: { name: string; workflow: string }[] } {
    return {
      initialized: this.isInitialized,
      workflowCount: this.loadedWorkflows.size,
      functions: this.getAvailableFunctions()
    };
  }
}
