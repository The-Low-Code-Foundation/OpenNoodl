/**
 * WorkflowEngine — the WF-001 execution core.
 *
 * Owns the semantics documented in WF-001-SEMANTICS.md and NOTHING about how an
 * individual node runs (that is the StepExecutor's job):
 *
 *   - ORDERING: an explicit step DAG, executed in topological order with
 *     explicit per-step completion. No frames, no dirty-flag propagation.
 *   - ERROR ROUTING: a failed step follows its `onError` edges when present
 *     (routed / handled); with no error edge it HALTS the run, recorded failed.
 *   - CANCELLATION: an AbortController per run; `cancel()` aborts it. The engine
 *     stops scheduling further steps promptly; an in-flight step is raced against
 *     the signal so cancellation does not wait for it.
 *   - TIMEOUTS: per-step (own or the workflow default) and per-workflow (aborts
 *     the run). A timeout is a LOUD failure recorded on the step / run.
 *   - DURABILITY: runs are in-memory; the workflow-level record is persisted as
 *     `running` for the run's duration. `recoverInterrupted()` marks any record
 *     still `running` at startup as failed+interrupted — resumable-or-failed-
 *     loudly, never silently half-run. Checkpoint/resume is v2 (fields noted in
 *     the semantics doc).
 *   - CONCURRENCY: per-workflow cap; runs beyond it queue FIFO.
 *
 * Every run emits ONE workflow-level execution record plus per-step events
 * through WF-006's ExecutionLogger — the same store the function path uses. There
 * is no second execution-record path.
 *
 * @module nodegx-backend/workflow/WorkflowEngine
 */

import type { ExecutionHistory } from '../execution/ExecutionStore';
import type { StepExecutor, StepExecContext } from './StepExecutor';
import { StepExecutionError } from './StepExecutor';
import type {
  WorkflowDefinition,
  WorkflowStep,
  WorkflowRunResult,
  RunStatus,
  StepOutcomeStatus
} from './types';
import type { RunTriggerContext } from './WorkflowRunner';

/** Distinguishes "the run was aborted" from "a step failed" in the race below. */
class RunAbortedError extends Error {
  constructor(readonly kind: 'cancelled' | 'timeout') {
    super(kind === 'timeout' ? 'Workflow timed out' : 'Workflow cancelled');
    this.name = 'RunAbortedError';
  }
}

class StepTimeoutError extends Error {
  constructor(stepId: string, ms: number) {
    super(`Step "${stepId}" timed out after ${ms}ms`);
    this.name = 'StepTimeoutError';
  }
}

export interface WorkflowEngineDeps {
  executions: ExecutionHistory;
  executor: StepExecutor;
  backendId: string;
  backendName: string;
}

export interface RunOptions {
  trigger: RunTriggerContext;
  /** The run payload — becomes each step's base input. */
  payload?: Record<string, unknown>;
}

interface ConcurrencyGate {
  active: number;
  queue: Array<() => void>;
}

interface StepOutcome {
  status: StepOutcomeStatus;
  output?: Record<string, unknown>;
}

// ============================================================================
// Static validation (used by the registry so a bad definition never loads)
// ============================================================================

/**
 * Validate a workflow definition's SHAPE and GRAPH. Returns error strings; an
 * empty array means valid. Enforces: unique step ids, a real entry, every edge
 * target existing, and ACYCLICITY (the engine's single forward pass assumes a
 * DAG — a cycle would be a definition bug, caught here, not a hang at runtime).
 */
export function validateWorkflowDefinition(def: WorkflowDefinition): string[] {
  const errors: string[] = [];
  if (!def || typeof def !== 'object') return ['workflow must be an object'];
  if (def.version !== 1) errors.push(`unsupported version ${JSON.stringify(def.version)}`);
  if (typeof def.id !== 'string' || !def.id) errors.push('id must be a non-empty string');
  if (!Array.isArray(def.steps) || def.steps.length === 0) errors.push('steps must be a non-empty array');
  if (typeof def.concurrency !== 'number' || def.concurrency < 1) errors.push('concurrency must be a number >= 1');

  if (!Array.isArray(def.steps)) return errors;

  const ids = new Set<string>();
  for (const s of def.steps) {
    if (!s || typeof s !== 'object') {
      errors.push('every step must be an object');
      continue;
    }
    if (typeof s.id !== 'string' || !s.id) errors.push('every step needs a non-empty id');
    else if (ids.has(s.id)) errors.push(`duplicate step id "${s.id}"`);
    else ids.add(s.id);
    if (s.kind !== 'call-function') errors.push(`step "${s.id}": unknown kind "${s.kind}" (v1: 'call-function')`);
    if (s.kind === 'call-function' && (typeof s.ref !== 'string' || !s.ref)) {
      errors.push(`step "${s.id}": call-function needs a ref (the function name)`);
    }
    if (s.timeoutMs !== undefined && (typeof s.timeoutMs !== 'number' || s.timeoutMs < 0)) {
      errors.push(`step "${s.id}": timeoutMs must be a non-negative number`);
    }
  }

  if (typeof def.entry !== 'string' || !ids.has(def.entry)) {
    errors.push(`entry "${def.entry}" must name one of the steps`);
  }

  // Every edge target must exist.
  for (const s of def.steps) {
    for (const t of s.next || []) if (!ids.has(t)) errors.push(`step "${s.id}": next target "${t}" does not exist`);
    for (const t of s.onError || []) if (!ids.has(t)) errors.push(`step "${s.id}": onError target "${t}" does not exist`);
  }

  // Acyclicity (Kahn). Edges are next ∪ onError.
  if (errors.length === 0) {
    const indeg = new Map<string, number>();
    const adj = new Map<string, string[]>();
    for (const s of def.steps) {
      indeg.set(s.id, 0);
      adj.set(s.id, []);
    }
    for (const s of def.steps) {
      for (const t of [...(s.next || []), ...(s.onError || [])]) {
        adj.get(s.id)!.push(t);
        indeg.set(t, (indeg.get(t) || 0) + 1);
      }
    }
    const q = [...ids].filter((id) => (indeg.get(id) || 0) === 0);
    let seen = 0;
    while (q.length) {
      const n = q.shift()!;
      seen++;
      for (const m of adj.get(n) || []) {
        indeg.set(m, (indeg.get(m) || 0) - 1);
        if (indeg.get(m) === 0) q.push(m);
      }
    }
    if (seen !== ids.size) errors.push('workflow graph has a cycle (edges must form a DAG)');
  }

  return errors;
}

/** Topological order of the steps (assumes a valid DAG). */
function topoOrder(def: WorkflowDefinition): WorkflowStep[] {
  const byId = new Map(def.steps.map((s) => [s.id, s]));
  const indeg = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const s of def.steps) {
    indeg.set(s.id, 0);
    adj.set(s.id, []);
  }
  for (const s of def.steps) {
    for (const t of [...(s.next || []), ...(s.onError || [])]) {
      adj.get(s.id)!.push(t);
      indeg.set(t, (indeg.get(t) || 0) + 1);
    }
  }
  // Deterministic: definition order among zero-indegree steps.
  const order: WorkflowStep[] = [];
  const ready = def.steps.filter((s) => indeg.get(s.id) === 0).map((s) => s.id);
  const inReady = new Set(ready);
  while (ready.length) {
    const id = ready.shift()!;
    inReady.delete(id);
    order.push(byId.get(id)!);
    for (const m of adj.get(id) || []) {
      indeg.set(m, (indeg.get(m) || 0) - 1);
      if (indeg.get(m) === 0 && !inReady.has(m)) {
        ready.push(m);
        inReady.add(m);
      }
    }
  }
  return order;
}

// ============================================================================
// Engine
// ============================================================================

export class WorkflowEngine {
  private readonly deps: WorkflowEngineDeps;
  private readonly active = new Map<string, AbortController>();
  private readonly gates = new Map<string, ConcurrencyGate>();

  constructor(deps: WorkflowEngineDeps) {
    this.deps = deps;
  }

  /** Number of runs currently executing (for status/tests). */
  activeRunCount(): number {
    return this.active.size;
  }

  /**
   * Mark every execution left `running` at startup as failed+interrupted. This
   * is the honest v1 durability policy: an in-memory run interrupted by a
   * restart does not resume — it is recorded interrupted, never silently
   * half-run. Returns the number of records recovered.
   */
  recoverInterrupted(): number {
    const running = this.deps.executions.list({ status: 'running', limit: 10000 }) as Array<{
      id: string;
      metadata?: Record<string, unknown>;
    }>;
    let n = 0;
    for (const rec of running) {
      const md = rec.metadata || {};
      // Only touch this backend's records (one process per backend, but be exact).
      if (md.backendId && md.backendId !== this.deps.backendId) continue;
      this.deps.executions.markInterrupted(rec.id, 'Interrupted by service restart (in-flight run did not resume — WF-001 v1 durability).');
      n++;
    }
    return n;
  }

  /** Cancel a run by its execution id. Returns false if it is not active. */
  cancel(executionId: string): boolean {
    const ctrl = this.active.get(executionId);
    if (!ctrl) return false;
    ctrl.abort(new RunAbortedError('cancelled'));
    return true;
  }

  /**
   * Run a workflow to completion. Acquires a per-workflow concurrency slot first
   * (queuing if at the cap), then executes the DAG.
   */
  async run(def: WorkflowDefinition, opts: RunOptions): Promise<WorkflowRunResult> {
    const release = await this.acquire(def);
    try {
      return await this.executeRun(def, opts);
    } finally {
      release();
    }
  }

  // --------------------------------------------------------------------------
  // Concurrency
  // --------------------------------------------------------------------------

  private acquire(def: WorkflowDefinition): Promise<() => void> {
    let gate = this.gates.get(def.id);
    if (!gate) {
      gate = { active: 0, queue: [] };
      this.gates.set(def.id, gate);
    }
    const g = gate;
    const grant = (): (() => void) => {
      g.active++;
      let released = false;
      return () => {
        if (released) return;
        released = true;
        g.active--;
        const next = g.queue.shift();
        if (next) next();
      };
    };
    if (g.active < Math.max(1, def.concurrency)) {
      return Promise.resolve(grant());
    }
    return new Promise<() => void>((resolve) => {
      g.queue.push(() => resolve(grant()));
    });
  }

  // --------------------------------------------------------------------------
  // The run
  // --------------------------------------------------------------------------

  private async executeRun(def: WorkflowDefinition, opts: RunOptions): Promise<WorkflowRunResult> {
    const controller = new AbortController();
    const signal = controller.signal;

    // Per-workflow timeout → abort the run.
    let workflowTimer: ReturnType<typeof setTimeout> | null = null;
    if (def.timeoutMs && def.timeoutMs > 0) {
      workflowTimer = setTimeout(() => controller.abort(new RunAbortedError('timeout')), def.timeoutMs);
      if (typeof workflowTimer.unref === 'function') workflowTimer.unref();
    }

    const logger = this.deps.executions.createLogger();
    const executionId =
      logger?.startExecution({
        workflowId: def.id,
        workflowName: def.name || def.id,
        triggerType: opts.trigger.type,
        triggerData: opts.payload || {},
        metadata: {
          kind: 'workflow',
          backendId: this.deps.backendId,
          backendName: this.deps.backendName,
          ...(opts.trigger.source ? { triggerSource: opts.trigger.source } : {}),
          ...(opts.trigger.triggerId ? { triggerId: opts.trigger.triggerId } : {})
        }
      }) || '';

    if (executionId) this.active.set(executionId, controller);

    const order = topoOrder(def);
    const byId = new Map(def.steps.map((s) => [s.id, s]));
    const outcomes = new Map<string, StepOutcome>();
    const basePayload = opts.payload || {};

    let unroutedError = false;
    let timedOut = false;
    let cancelled = false;
    let lastOutput: Record<string, unknown> | undefined;
    let stepsRun = 0;
    let stepsSkipped = 0;

    // Which upstream step "reached" a given step (for input `previous`).
    const reachedBy = new Map<string, string>();

    const isReached = (step: WorkflowStep): boolean => {
      if (step.id === def.entry) return true;
      return reachedBy.has(step.id);
    };

    try {
      for (const step of order) {
        if (signal.aborted) break; // cancelled / timed-out → stop scheduling

        // Reachability: entry always runs; others run only if an upstream edge
        // was actually taken. Unreached steps are recorded skipped.
        if (!isReached(step)) {
          logger?.skipNode({ nodeId: step.id, nodeType: this.nodeType(step), nodeName: step.name });
          outcomes.set(step.id, { status: 'skipped' });
          stepsSkipped++;
          continue;
        }

        const prevId = reachedBy.get(step.id);
        const previous = prevId ? outcomes.get(prevId)?.output : undefined;
        const input: Record<string, unknown> = {
          ...basePayload,
          ...(step.params || {}),
          ...(previous ? { previous } : {})
        };

        const stepId = logger?.startNode({
          nodeId: step.id,
          nodeType: this.nodeType(step),
          nodeName: step.name,
          inputData: input
        });

        const timeoutMs = step.timeoutMs && step.timeoutMs > 0 ? step.timeoutMs : def.stepTimeoutMs || 0;
        try {
          const ctx: StepExecContext = { workflow: def, step, input, signal };
          const output = await this.runStepGuarded(ctx, timeoutMs, signal);
          if (stepId) logger?.completeNode(stepId, true, output);
          outcomes.set(step.id, { status: 'success', output });
          lastOutput = output;
          stepsRun++;
          // Take success edges.
          for (const t of step.next || []) if (!reachedBy.has(t)) reachedBy.set(t, step.id);
        } catch (e) {
          if (e instanceof RunAbortedError) {
            // The step was interrupted by cancel/timeout — record it and stop.
            if (stepId) logger?.completeNode(stepId, false, undefined, new Error(e.message));
            outcomes.set(step.id, { status: 'error' });
            stepsRun++;
            if (e.kind === 'timeout') timedOut = true;
            else cancelled = true;
            break;
          }
          // A genuine step failure (executor threw, or per-step timeout).
          const err = e instanceof Error ? e : new Error(String(e));
          if (stepId) logger?.completeNode(stepId, false, undefined, err);
          outcomes.set(step.id, { status: 'error' });
          stepsRun++;
          const routes = step.onError || [];
          if (routes.length > 0) {
            // Routed: take error edges, keep going. The workflow can still succeed.
            for (const t of routes) if (!reachedBy.has(t)) reachedBy.set(t, step.id);
          } else {
            // Unrouted: halt loudly.
            unroutedError = true;
            break;
          }
        }
      }

      // Any step not yet given an outcome (because we halted / aborted) is skipped.
      for (const step of def.steps) {
        if (!outcomes.has(step.id)) {
          logger?.skipNode({ nodeId: step.id, nodeType: this.nodeType(step), nodeName: step.name });
          stepsSkipped++;
        }
      }

      // Cancellation/timeout can also be detected after the loop if the signal
      // fired between steps rather than during one.
      if (signal.aborted) {
        const reason = signal.reason;
        if (reason instanceof RunAbortedError) {
          if (reason.kind === 'timeout') timedOut = true;
          else cancelled = true;
        } else {
          cancelled = true;
        }
      }

      const status: RunStatus = cancelled ? 'cancelled' : unroutedError || timedOut ? 'error' : 'success';
      const errorMessage = cancelled
        ? 'Workflow run was cancelled.'
        : timedOut
          ? `Workflow exceeded its ${def.timeoutMs}ms timeout.`
          : unroutedError
            ? 'A step failed with no error route; the workflow halted.'
            : undefined;

      if (logger) {
        // completeExecution maps engine status onto the store's {success|error}.
        logger.completeExecution(status === 'success', errorMessage ? new Error(errorMessage) : undefined);
        // Stamp the precise disposition for the UI (cancelled vs timeout vs halt).
        this.deps.executions.stampMetadata(executionId, {
          engineStatus: status,
          cancelled,
          timedOut,
          unroutedError,
          stepsRun,
          stepsSkipped
        });
      }

      return {
        executionId,
        workflowId: def.id,
        status,
        unroutedError,
        timedOut,
        stepsRun,
        stepsSkipped,
        output: lastOutput,
        error: errorMessage
      };
    } finally {
      if (workflowTimer) clearTimeout(workflowTimer);
      if (executionId) this.active.delete(executionId);
    }
  }

  /**
   * Run one step, racing the executor against (a) the per-step timeout and (b)
   * the run's abort signal so cancellation/workflow-timeout is prompt. The
   * orphaned executor promise (if the race is lost) settles later and is
   * ignored — documented in the semantics doc's cancellation honesty note.
   */
  private runStepGuarded(
    ctx: StepExecContext,
    timeoutMs: number,
    signal: AbortSignal
  ): Promise<Record<string, unknown>> {
    const racers: Promise<Record<string, unknown>>[] = [this.deps.executor.execute(ctx)];

    if (timeoutMs > 0) {
      racers.push(
        new Promise<never>((_, reject) => {
          const t = setTimeout(() => reject(new StepTimeoutError(ctx.step.id, timeoutMs)), timeoutMs);
          if (typeof t.unref === 'function') t.unref();
        })
      );
    }

    racers.push(
      new Promise<never>((_, reject) => {
        if (signal.aborted) {
          reject(signal.reason instanceof RunAbortedError ? signal.reason : new RunAbortedError('cancelled'));
          return;
        }
        signal.addEventListener(
          'abort',
          () => reject(signal.reason instanceof RunAbortedError ? signal.reason : new RunAbortedError('cancelled')),
          { once: true }
        );
      })
    );

    return Promise.race(racers);
  }

  private nodeType(step: WorkflowStep): string {
    return step.kind === 'call-function' && step.ref ? `function:${step.ref}` : step.kind;
  }
}

export { StepExecutionError };
