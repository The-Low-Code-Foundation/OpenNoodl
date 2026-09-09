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
// SB-016 — the endpoint predicate, shared with the deploy interlock so the gate
// and the runner cannot disagree about what a function is.
import {
  CLOUD_COMPONENT_PREFIX,
  declaredFunctionsIn,
  findRequestNode,
  graphWritesRecords,
  requestNodeAllowsNoAuth
} from './functionDeclarations';
// CWF-013 — type-only, from the cloud runtime's own declaration, so the sink this file builds
// and the `NodeScope.runContext` a node reads cannot drift apart.
import type {
  CloudKitLoadResult,
  NodeRunContext,
  RuntimeLogEntry,
  RuntimeStepEnd,
  RuntimeStepStart
} from '@cloud-runtime';

// Bundled from noodl-viewer-cloud/src by esbuild (test-time: jest mapper).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { CloudRunner, isCloudFunctionTimeout } = require('@cloud-runtime') as {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  CloudRunner: any;
  isCloudFunctionTimeout(e: unknown): boolean;
};
// CWF-014 — from the node's own module rather than the package entry, the way
// `execution-history` is reached. The guard is checked by `name` for the same
// reason `isCloudFunctionTimeout` is: this package arrives through a bundler
// alias, so an `instanceof` that depends on one module instance is a check that
// silently starts answering "no".
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { isCloudFunctionBadRequest } = require('@cloud-runtime/nodes/cloud/requestContract') as {
  isCloudFunctionBadRequest(e: unknown): boolean;
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
  /**
   * CWF-013 — the value-based scrub a `Log` node's free text goes through before
   * it is written. Supplied by the service, which is the only thing that holds a
   * `SecretsStore`; absent means "no secrets to recognise", not "skip redaction"
   * (the key-based `redact()` inside `logger` runs either way).
   */
  scrubSecretValues?: LogValueScrubber;
}

/** What {@link WorkflowRunnerOptions.scrubSecretValues} has to be able to do. */
export interface LogValueScrubber {
  scrub(text: string): string;
  scrubValue(value: unknown): unknown;
}

/**
 * How many `Log` lines one run may write before the rest are counted and dropped.
 *
 * ⚠️ The volume trap CWF-013 names: a `Log` node inside a `Run Tasks` loop over 10,000 items
 * writes 10,000 stdout lines AND 10,000 execution-record steps, and the execution store is the
 * thing that fills a disk. The cap is per run rather than per second because a run is the unit an
 * author can reason about, and the suppression itself is announced — a silent cap is a debugging
 * session where half the evidence is missing and nothing says so.
 */
export const MAX_LOG_LINES_PER_RUN = 200;

/**
 * How many execution steps one run may record before the rest are counted and dropped.
 *
 * ⚠️ Same trap as the line cap above and a different denominator: a `Run Tasks` loop over 10,000
 * items writes an execution step per action per item whether or not a single `Log` node is
 * anywhere in the graph, so a cap that only bounded logging would bound nothing. Higher than the
 * line cap because a step is the *evidence* — an author who capped their logging still wants the
 * shape of the run — and, like it, the suppression is announced exactly once.
 */
export const MAX_STEPS_PER_RUN = 1000;

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

/** One loaded bundle, and the fingerprint of the deploy that put it here. */
export interface WorkflowBundleStatus {
  name: string;
  /**
   * HLS-013 — the `deployFingerprint` the deployer sent with this bundle, or
   * `null` for one deployed before fingerprints existed (or written by hand).
   *
   * 🔴 **Echoed, never recomputed.** The fingerprint is the deployer's own
   * `hashCloudExport`, and a second implementation of that function living here
   * would drift from it silently — this repo has the scar (`a-second-copy-of-a-
   * palette-drifts-silently`). Echoing makes the backend a *record* of what was
   * pushed rather than a second opinion about it, so a mismatch can only mean
   * the bundle changed.
   */
  deployFingerprint: string | null;
  functionCount: number;
}

/** The body of `GET /admin/workflows` — what the editor's panel renders. */
export interface WorkflowRunnerStatus {
  initialized: boolean;
  workflowCount: number;
  functions: { name: string; workflow: string }[];
  /**
   * HLS-013 — what each bundle on this backend was deployed from.
   *
   * A headless deploy is a new process every run, so it has no memory of its own
   * previous push the way the editor does. Without this it could only ever
   * report a fresh success, which is the thing AC3 exists to prevent.
   */
  bundles: WorkflowBundleStatus[];
}

export class WorkflowRunner {
  private readonly workflowsPath: string;
  private readonly executions: ExecutionHistory;
  private readonly backendId: string;
  private readonly backendName: string;
  private readonly enableDebugInspectors: boolean;
  private readonly getFunctionTimeoutMs?: (functionName: string) => number | undefined;
  private readonly scrubSecretValues?: LogValueScrubber;

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
    this.scrubSecretValues = options.scrubSecretValues;
  }

  /**
   * CWF-013 / DEF-004 — the per-run services a cloud graph may reach: where a `Log` node's line
   * goes, and where an action invocation is recorded.
   *
   * Built per run and handed to `CloudRunner.run`, which puts it on the request's own
   * `NodeScope`. That is what carries the request id: two functions run concurrently in this
   * process, so a module-level "current run" would attribute one caller's line to the other.
   *
   * ## ⚠️ Two redactions, and neither is a superset of the other
   *
   *  1. `logger.log` runs the service's one `redact()` over every field — **key-based**, so it
   *     catches `{ apiKey: … }` whatever the value is.
   *  2. `scrubSecretValues` runs first, over the message text and the data, and is
   *     **value-based**. It exists because `redact()`'s own comment concedes the gap — *"a secret
   *     stored under an innocent name is not caught"* — and this node is the first thing in the
   *     product to walk into it: `Message` is free author text with no key in front of it, and
   *     `Secret → Log` is a two-node graph.
   *
   * The execution-record copy goes through both too. A record that is safer than the log, or
   * less safe, is a record nobody can reason about. That now covers steps as well as lines: a
   * node hands `beginOutcome` its own `inputData` raw, because a node must not be able to see a
   * secret's value, so **this** is the only place that can redact it.
   */
  private createRunContext(
    functionName: string,
    execLogger: ReturnType<ExecutionHistory['createLogger']>,
    trigger?: RunTriggerContext
  ): NodeRunContext {
    const requestId = trigger && trigger.requestId;
    let written = 0;
    let stepsWritten = 0;

    return {
      requestId,
      log: (entry: RuntimeLogEntry) => {
        written++;
        if (written > MAX_LOG_LINES_PER_RUN) {
          // Announce the cap exactly once, then go quiet. A silent cap is worse than no cap.
          if (written === MAX_LOG_LINES_PER_RUN + 1) {
            logger.warn('function.log.suppressed', {
              function: functionName,
              requestId,
              limit: MAX_LOG_LINES_PER_RUN,
              hint: 'a Log node inside a loop — the rest of this run’s lines are dropped'
            });
          }
          return;
        }

        const level = entry && entry.level ? entry.level : 'info';
        const scrub = this.scrubSecretValues;
        const message = scrub ? scrub.scrub(String(entry.message || '')) : String((entry && entry.message) || '');
        const data = entry && entry.data !== undefined ? (scrub ? scrub.scrubValue(entry.data) : entry.data) : undefined;

        // `function.log` is one event name for every author line, so an operator can filter the
        // graph's own output apart from the service's with `jq 'select(.event=="function.log")'`.
        logger.log(level, 'function.log', {
          function: functionName,
          requestId,
          nodeId: entry && entry.nodeId,
          message,
          ...(data !== undefined ? { data } : {})
        });

        // ⚠️ **No step is written here, and that is DEF-004's doing.** This used to open and
        // close one, and since the `Log` node reports an outcome like every other action, the
        // step channel below now writes the same row — two producers, one table, and a count
        // that silently doubles. The line's own content is not lost: the node hands it to
        // `beginOutcome` as the step's `inputData`, so it arrives through the one pipeline.
        // `cloud-log-node.test.ts` asserts the cardinality.
      },

      /**
       * DEF-004 — one row per action invocation, opened when the action starts.
       *
       * Returns the store's step id, or `undefined` where there is nothing to write to or the
       * cap has been reached. The runtime treats `undefined` as "not recorded" and never calls
       * `endStep` for it, which is what keeps a capped run from leaving half-open rows.
       */
      beginStep: (step: RuntimeStepStart): unknown => {
        if (!execLogger) return undefined;

        stepsWritten++;
        if (stepsWritten > MAX_STEPS_PER_RUN) {
          if (stepsWritten === MAX_STEPS_PER_RUN + 1) {
            logger.warn('function.steps.suppressed', {
              function: functionName,
              requestId,
              limit: MAX_STEPS_PER_RUN,
              hint: 'an action inside a loop — the rest of this run’s steps are not recorded'
            });
          }
          return undefined;
        }

        const scrub = this.scrubSecretValues;
        const inputData =
          step.inputData !== undefined
            ? ((scrub ? scrub.scrubValue(step.inputData) : step.inputData) as Record<string, unknown>)
            : undefined;

        // `startNode` answers `''` when history is off or no execution is open. Normalised to
        // `undefined` so the runtime's "was this recorded" test is one check, not two.
        const stepId = execLogger.startNode({ nodeId: step.nodeId, nodeType: step.nodeType, inputData });
        return stepId || undefined;
      },

      /**
       * Close the row. `unchanged` counts as a success: the action was valid and there was
       * nothing to do, and colouring that red is how an author learns to ignore the column.
       *
       * ⚠️ The failure message is scrubbed here for the same reason the log line is — it is
       * composed by the node from its own inputs, and `Secret`'s says which secret.
       */
      endStep: (handle: unknown, end: RuntimeStepEnd) => {
        if (!execLogger || typeof handle !== 'string' || !handle) return;
        const scrub = this.scrubSecretValues;
        const failed = end.status === 'failure';
        const reason = failed
          ? new Error(
              [end.code, scrub ? scrub.scrub(end.message || '') : end.message].filter(Boolean).join(': ') ||
                'The action could not be performed'
            )
          : undefined;
        execLogger.completeNode(handle, !failed, { outcome: end.status }, reason);
      }
    };
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

  /**
   * CWF-014 — a request refused by the function's own declared contract.
   *
   * **400, not 500**, and the distinction is the whole point of the task: a 500
   * says the endpoint is broken, a 400 says the caller's body is. The body names
   * every field that was wrong, because the caller of a cloud function is a
   * supplier's webhook or another team's app, and "Invalid request body" with no
   * field name is a support ticket rather than an error.
   *
   * ⚠️ It reports the fields that failed and never the values that failed. The
   * caller sent them, so echoing them leaks nothing to *them* — but this string
   * also reaches the execution record and the ops log, and `redact()` is
   * key-based (see the note in `run`), so a value echoed here is a value stored
   * unredacted.
   */
  private badRequestResponse(e: unknown): RunnerResponse {
    const error = e as { message: string; fields?: unknown[] };
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: error.message,
        code: 'function/bad-request',
        fields: error.fields || []
      })
    };
  }

  /**
   * CN-013 — say what happened to a bundle's kits, at load, in the service log.
   *
   * 🔴 **The alternative is a hang that names nothing.** A kit whose nodes are not registered
   * leaves every cloud function using them with its chain cut: `NodeScope` logs and skips the
   * unknown type *and its connections*, no Response node is reached, and the request ends as
   * CWF-018's 504 — which talks about unwired `Failure` ports and cannot mention kits, because at
   * that point nothing knows a kit was involved. Load is the only moment the two facts are in the
   * same place.
   *
   * ⚠️ `not-cloud-enabled` is logged at `info`, not `warn`: a project whose kits are all browser
   * kits is the ordinary case, and a warning on every start for the ordinary case is a warning
   * nobody reads. Everything else is a `warn` — it means the author asked for a cloud kit and did
   * not get one.
   */
  private reportKitLoad(workflowName: string, load: CloudKitLoadResult | undefined): void {
    if (!load) return;

    if (load.registered.length) {
      safeLog(
        `Workflow ${workflowName}: registered ${load.registered.length} cloud kit(s) — ` +
          `${load.registered.join(', ')} (${load.nodeTypes.length} node type(s))`
      );
    }

    for (const skip of load.skippedReactNodes) {
      safeLog(
        `Workflow ${workflowName}: kit "${skip.module}" has ${skip.count} visual node(s), ` +
          'which do not exist in the cloud runtime. Its logic nodes were registered.'
      );
    }

    for (const failure of load.failures) {
      if (failure.reason === 'not-cloud-enabled') safeLog(`Workflow ${workflowName}: ${failure.message}`);
      else logger.warn(`Workflow ${workflowName}: ${failure.message}`, { workflow: workflowName, kit: failure.module });
    }
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
        this.reportKitLoad(workflowName, await this.cloudRunner.load(exportData));
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
      for (const [bundleName, bundle] of candidateWorkflows) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.reportKitLoad(bundleName, await (candidateRunner as any).load(bundle));
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
      const response = await this.cloudRunner.run(functionName, request, {
        timeoutMs,
        // CWF-013: this is what gives a `Log` node in the graph somewhere to go.
        runContext: this.createRunContext(functionName, execLogger, trigger)
      });
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
      const badRequest = isCloudFunctionBadRequest(e);

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
      } else if (badRequest) {
        // CWF-014: a refused body is the caller's mistake, not the operator's.
        // `warn`, not `error`, or every malformed webhook becomes a page.
        logger.warn('function.badRequest', {
          function: functionName,
          durationMs: duration,
          requestId: trigger && trigger.requestId,
          error: message
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
      if (badRequest) return this.badRequestResponse(e);
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
      // CWF-013: a function called AS A STEP logs too. It has no execution record of its own —
      // the engine writes the one per-step record — so the sink gets no `execLogger` and the
      // lines land in the structured log only. Silence here would mean a function that logs
      // when you call it and does not when a workflow does, which is the worst of both.
      return await this.cloudRunner.run(functionName, request, {
        timeoutMs,
        runContext: this.createRunContext(functionName, null)
      });
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
      // CWF-014: a step whose resolved params do not satisfy the function's
      // contract gets the same 400 an HTTP caller does, with the same field
      // list — so a workflow that maps `previous.result.total` into a `number`
      // parameter and gets a string fails naming the field, in the step's own
      // execution record, rather than as an opaque 500.
      if (isCloudFunctionBadRequest(e)) return this.badRequestResponse(e);
      const message = e instanceof Error ? e.message : String(e);
      return { statusCode: 500, body: JSON.stringify({ error: message }) };
    }
  }

  /**
   * SB-003: a cloud *function* is a `/#__cloud__/` component whose graph holds a
   * `noodl.cloud.request` node. A component without one is a helper — a per-item
   * unit of work instantiated by another cloud graph (Run Tasks, component
   * instances) — and is not an endpoint: calling it can only ever 500 inside the
   * CloudRunner ("Could not find request node"), after writing a failed
   * execution record for a call that was never servable. So the function
   * predicate is "has a Request node", not "has the name prefix", and a helper
   * is indistinguishable from a nonexistent name at every boundary
   * (HTTP 404, workflow step, trigger dispatch, the permissions listing).
   *
   * 🔴 **SB-016: the predicate itself now lives in `functionDeclarations.ts`**,
   * because the deploy interlock has to answer the same question at startup step
   * 1.5, off disk, before any of this is loaded. Two implementations of "what is
   * an endpoint" is how a gate ends up refusing a deploy over a name nothing
   * serves — or waving through one it does.
   */
  private findRequestNodeForFunction(functionName: string): Record<string, unknown> | null {
    const fullName = `${CLOUD_COMPONENT_PREFIX}${functionName}`;
    for (const exportData of this.loadedWorkflows.values()) {
      const components =
        (exportData.components as { name: string; nodes?: Record<string, unknown>[] }[] | undefined) || [];
      for (const component of components) {
        if (component.name !== fullName) continue;
        const found = findRequestNode(component.nodes || []);
        if (found) return found;
      }
    }
    return null;
  }

  hasFunction(functionName: string): boolean {
    return this.findRequestNodeForFunction(functionName) !== null;
  }

  /**
   * DEF-009 AC4: does this function's own graph create, change or delete a
   * record?
   *
   * A sibling of `findRequestNodeForFunction` rather than a widening of it: the
   * existing lookup answers *where is the Request node*, and its three callers
   * want that node itself. The predicate is `functionDeclarations`', so the
   * dispatcher's answer and the deploy interlock's answer come from one place —
   * the module docblock's rule about two readers of one predicate.
   *
   * ⚠️ **A name this runner has not loaded answers `false`**, which fails OPEN
   * for the default. That is the same degradation `functionAllowsNoAuth` already
   * has at the same call site, and it is bounded by the same fact: a function
   * the runner cannot find is a function the dispatcher 404s before any budget
   * is spent.
   */
  functionWritesRecords(functionName: string): boolean {
    const fullName = `${CLOUD_COMPONENT_PREFIX}${functionName}`;
    for (const exportData of this.loadedWorkflows.values()) {
      const components =
        (exportData.components as { name: string; nodes?: Record<string, unknown>[] }[] | undefined) || [];
      for (const component of components) {
        if (component.name !== fullName) continue;
        if (graphWritesRecords(component.nodes || [])) return true;
      }
    }
    return false;
  }

  /**
   * The graph author's auth declaration for a function: the Request node's
   * `allowNoAuth` parameter. BAK-003 uses it as the default `call` rule
   * (public when true, authenticated otherwise); a config entry overrides it.
   */
  functionAllowsNoAuth(functionName: string): boolean {
    return requestNodeAllowsNoAuth(this.findRequestNodeForFunction(functionName));
  }

  getAvailableFunctions(): { name: string; workflow: string; writesRecords: boolean }[] {
    const functions: { name: string; workflow: string; writesRecords: boolean }[] = [];
    for (const [workflowName, exportData] of this.loadedWorkflows) {
      for (const declaration of declaredFunctionsIn(exportData, workflowName)) {
        functions.push({
          name: declaration.name,
          workflow: declaration.workflow,
          // DEF-009 AC4: the panel has to show what budget applies, and that
          // answer depends on this. Carried rather than re-derived by the
          // caller, which would be a second reader of the predicate.
          writesRecords: declaration.writesRecords
        });
      }
    }
    return functions;
  }

  getStatus(): WorkflowRunnerStatus {
    const bundles: WorkflowBundleStatus[] = [];
    for (const [name, bundle] of this.loadedWorkflows) {
      const fingerprint = (bundle as { deployFingerprint?: unknown }).deployFingerprint;
      bundles.push({
        name,
        deployFingerprint: typeof fingerprint === 'string' ? fingerprint : null,
        functionCount: Array.isArray((bundle as { components?: unknown }).components)
          ? ((bundle as { components: unknown[] }).components).length
          : 0
      });
    }

    return {
      initialized: this.isInitialized,
      workflowCount: this.loadedWorkflows.size,
      functions: this.getAvailableFunctions(),
      bundles
    };
  }
}
