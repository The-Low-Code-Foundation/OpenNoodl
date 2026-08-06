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
import { logger } from '../ops/logger';

// Bundled from noodl-viewer-cloud/src by esbuild (test-time: jest mapper).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { CloudRunner, isCloudFunctionTimeout } = require('@cloud-runtime') as {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  CloudRunner: any;
  isCloudFunctionTimeout(e: unknown): boolean;
};
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { scrubRequestForLogging } = require('@cloud-runtime/execution-history');

/**
 * How long a cloud function may run before its request is abandoned (CWF-018).
 *
 * **30 seconds**, and the number is a floor-and-ceiling argument rather than a
 * guess:
 *
 *   - It is comfortably under every reverse proxy an operator is likely to put
 *     in front of this (nginx's `proxy_read_timeout` is 60s by default), so the
 *     limit that fires is OURS — one that names the function and logs — instead
 *     of a 502 from a proxy that knows nothing about cloud functions.
 *   - It is above anything a request-shaped function does. A function is "run
 *     this now and give the user an answer" (BACKEND-AUTHORING-MODEL); work that
 *     genuinely takes minutes is a workflow, which has had per-step and per-run
 *     timeouts, retries and waits all along.
 *   - It is short enough that a graph with an unwired `Failure` port is found in
 *     development rather than in production, which is the mistake this exists
 *     for.
 *
 * A function that legitimately needs longer says so per function
 * (`functions.<name>.timeoutMs` in security.json, CWF-017's panel); `0` there
 * means no limit, which is what a streaming response will need (CWF-007).
 */
export const DEFAULT_FUNCTION_TIMEOUT_MS = 30000;

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
  /**
   * This function's DECLARED timeout in ms, or undefined for the default
   * (CWF-018). Late-bound and asked per call, exactly like `getRunner`
   * elsewhere, so an edit through CWF-017's panel takes effect on the next
   * request rather than the next restart — and so a spec can bound a run
   * without waiting the real duration.
   */
  getFunctionTimeoutMs?: (functionName: string) => number | undefined;
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
  /**
   * BAK-009: the HTTP request that caused this run, when there was one. This is
   * the join between the access log and the execution record — a webhook's id
   * appears in the log line, in this record, and in the response header, so all
   * three can be lined up after the fact.
   */
  requestId?: string;
}

/** The body of `GET /admin/workflows` — what the editor's panel renders. */
export interface WorkflowRunnerStatus {
  initialized: boolean;
  workflowCount: number;
  functions: { name: string; workflow: string }[];
}

export class WorkflowRunner {
  private readonly workflowsPath: string;
  private readonly executions: ExecutionHistory;
  private readonly backendId: string;
  private readonly backendName: string;
  private readonly enableDebugInspectors: boolean;
  private readonly getFunctionTimeoutMs?: (functionName: string) => number | undefined;

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
    this.getFunctionTimeoutMs = options.getFunctionTimeoutMs;
  }

  /**
   * The bound this run gets. `undefined` from the resolver means "nobody
   * declared one" and takes the default; a declared `0` means no limit and is
   * passed through as such.
   */
  private timeoutFor(functionName: string): number {
    const declared = this.getFunctionTimeoutMs ? this.getFunctionTimeoutMs(functionName) : undefined;
    return typeof declared === 'number' && declared >= 0 ? declared : DEFAULT_FUNCTION_TIMEOUT_MS;
  }

  /**
   * The answer a caller gets when a function never responded — a 504 naming the
   * function, the limit, and the mistake that produces this nine times out of
   * ten. Not a 500: the whole point is that an author can tell "my graph never
   * reached a Response node" apart from "my graph crashed".
   */
  private timeoutResponse(functionName: string, timeoutMs: number): RunnerResponse {
    return {
      statusCode: 504,
      body: JSON.stringify({
        error:
          `Cloud function "${functionName}" did not send a response within ${timeoutMs}ms and was stopped. ` +
          'Check that every path through the graph reaches a Response node — an outcome node whose ' +
          '`Failure` or `Unchanged` port is unwired answers nothing.',
        code: 'function/timeout',
        function: functionName,
        timeoutMs
      })
    };
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

  /**
   * Save + (re)load a single workflow (hot deploy from the editor).
   *
   * **Build a candidate runner, then swap, then persist.** WFA-001 rewrote this
   * after being the first caller this endpoint has ever had (the editor's
   * `backend:update-workflow` IPC existed since WF-004 with zero callers), and
   * running it found two problems in the obvious implementation:
   *
   * 1. **Re-loading a bundle into the live runner crashes the service.**
   *    `cloudRunner.load` → `NoodlRuntime.setData` → `GraphModel.importEditorData`
   *    re-imports components that are already present, which is the duplicate-node
   *    case `setData` documents. The throw comes back out of a scheduled update
   *    rather than the awaited call, so a `try`/`catch` here does not contain it
   *    and the process exits 1 — mid-push, taking every other function with it.
   *    A hot deploy always re-loads (the bundle is loaded from disk at start),
   *    so this fired on the *first* push of every session.
   * 2. **A failed load must not replace the recorded state.** The original wrote
   *    the file and updated `loadedWorkflows` before loading at all, so a
   *    rejected bundle still made the backend advertise it, and a restart read
   *    the bad file back.
   *
   * Both are answered by never mutating live state until the new set is known
   * to load: the candidate runner is built from scratch out of the other
   * bundles plus this one, and only a complete success swaps it in. A failure
   * leaves the previous runner serving and the previous file on disk.
   */
  async loadWorkflow(name: string, exportData: Record<string, unknown>): Promise<{ success: boolean; error?: string }> {
    if (!this.cloudRunner) return { success: false, error: 'WorkflowRunner not initialized' };

    const candidateWorkflows = new Map(this.loadedWorkflows);
    candidateWorkflows.set(name, exportData);

    let candidateRunner: unknown;
    try {
      candidateRunner = new CloudRunner({
        enableDebugInspectors: this.enableDebugInspectors,
        connectToEditor: false
      });
      for (const bundle of candidateWorkflows.values()) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (candidateRunner as any).load(bundle);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      safeLog(`Failed to load workflow ${name} (previous version left in place):`, message);
      return { success: false, error: message };
    }

    try {
      await fs.mkdir(this.workflowsPath, { recursive: true });
      await fs.writeFile(path.join(this.workflowsPath, `${name}.workflow.json`), JSON.stringify(exportData, null, 2));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      safeLog(`Failed to persist workflow ${name} (not activated):`, message);
      return { success: false, error: message };
    }

    // Swap last: from here on the new set is what serves requests.
    this.cloudRunner = candidateRunner;
    this.loadedWorkflows = candidateWorkflows;
    safeLog(`Workflow updated: ${name} (${candidateWorkflows.size} bundle(s) loaded)`);
    return { success: true };
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
    const timeoutMs = this.timeoutFor(functionName);
    const execLogger = this.executions.createLogger();
    let executionId = '';
    if (execLogger) {
      executionId = execLogger.startExecution({
        workflowId: functionName,
        workflowName: functionName,
        triggerType: trigger ? trigger.type : 'webhook',
        triggerData: scrubRequestForLogging(request || {}),
        metadata: {
          backendId: this.backendId,
          backendName: this.backendName,
          ...(trigger && trigger.source ? { triggerSource: trigger.source } : {}),
          ...(trigger && trigger.triggerId ? { triggerId: trigger.triggerId } : {}),
          ...(trigger && trigger.requestId ? { requestId: trigger.requestId } : {})
        }
      });
    }

    try {
      safeLog(`Executing function: ${functionName}`);
      const response = await this.cloudRunner.run(functionName, request, { timeoutMs });
      const duration = Date.now() - startTime;
      safeLog(`Function ${functionName} completed in ${duration}ms`);

      const success = response.statusCode >= 200 && response.statusCode < 300;
      if (execLogger)
        execLogger.completeExecution(success, success ? undefined : new Error(`HTTP ${response.statusCode}`));

      return response;
    } catch (e) {
      const duration = Date.now() - startTime;
      const message = e instanceof Error ? e.message : String(e);
      const timedOut = isCloudFunctionTimeout(e);

      // CWF-018: the operator-facing line. It goes through the ops logger, not
      // `safeLog`, because that is the one door that is levelled, structured and
      // shipped by whatever supervises this process — a `console.log` here is a
      // line nobody can filter for or alert on.
      //
      // ⚠️ The request BODY is not logged, and `redact()` is the reason rather
      // than an excuse: redaction is KEY-based (`ops/redact.ts` says so in as
      // many words), so `{ note: "the password is hunter2" }` survives it
      // untouched. A function's request body is arbitrary caller data whose
      // field names we do not choose. What is logged is what an operator needs
      // to act — which function, which limit, which request — and the request id
      // joins this line to the access log and to the execution record.
      if (timedOut) {
        logger.error('function.timeout', {
          function: functionName,
          timeoutMs,
          durationMs: duration,
          requestId: trigger && trigger.requestId,
          triggerType: trigger ? trigger.type : 'webhook',
          triggerSource: trigger && trigger.source,
          hint: 'no Response node was reached — check the graph has no path that ends without one'
        });
      } else {
        logger.error('function.failed', {
          function: functionName,
          durationMs: duration,
          requestId: trigger && trigger.requestId,
          error: message
        });
      }
      safeLog(`Function ${functionName} failed after ${duration}ms:`, message);

      if (execLogger) {
        execLogger.completeExecution(false, e instanceof Error ? e : new Error(message));
        // The same `timedOut` key the workflow engine stamps, so the History
        // panel reads one disposition vocabulary and not two.
        if (timedOut) this.executions.stampMetadata(executionId, { timedOut: true, timeoutMs });
      }

      if (timedOut) return this.timeoutResponse(functionName, timeoutMs);
      return { statusCode: 500, body: JSON.stringify({ error: message }) };
    }
  }

  /**
   * Invoke a function WITHOUT writing its own execution record. Used by the
   * WF-001 engine when a function runs as a workflow STEP: the engine writes the
   * one per-step record, so a nested function-level record here would be a
   * double-record and break the "one execution-record path" rule. Behaviourally
   * identical to `run()` minus the logging.
   *
   * The CWF-018 timeout applies here too, and it is not redundant with the
   * engine's per-step timeout: a step timeout abandons the step's promise and
   * leaves the function's component instance running forever (the engine's own
   * cancellation-honesty note). This bound is the one that tears the graph down.
   */
  async invokeFunction(functionName: string, request: RunnerRequest): Promise<RunnerResponse> {
    if (!this.cloudRunner) {
      return { statusCode: 503, body: JSON.stringify({ error: 'Workflows not initialized' }) };
    }
    if (!this.hasFunction(functionName)) {
      return { statusCode: 404, body: JSON.stringify({ error: `Function '${functionName}' not found` }) };
    }
    const timeoutMs = this.timeoutFor(functionName);
    try {
      return await this.cloudRunner.run(functionName, request, { timeoutMs });
    } catch (e) {
      if (isCloudFunctionTimeout(e)) {
        logger.error('function.timeout', {
          function: functionName,
          timeoutMs,
          caller: 'workflow-step',
          hint: 'no Response node was reached — check the graph has no path that ends without one'
        });
        return this.timeoutResponse(functionName, timeoutMs);
      }
      const message = e instanceof Error ? e.message : String(e);
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

  getStatus(): WorkflowRunnerStatus {
    return {
      initialized: this.isInitialized,
      workflowCount: this.loadedWorkflows.size,
      functions: this.getAvailableFunctions()
    };
  }
}
