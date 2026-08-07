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
import type { StepExecutor, StepExecContext, StepExecResult } from './StepExecutor';
import { StepExecutionError, normalizeStepReturn } from './StepExecutor';
import { rawParamNames, validateStepShape } from './steps/kinds';
import { collectValuePaths, exceedsValueDepth, MAX_VALUE_DEPTH, resolveStepParams } from './steps/values';
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

/** Every outgoing edge of a step: `next` ∪ `onError` ∪ all `routes` values. */
function allEdgeTargets(s: WorkflowStep): string[] {
  const routeTargets: string[] = [];
  for (const list of Object.values(s.routes || {})) {
    if (Array.isArray(list)) routeTargets.push(...list);
  }
  return [...(s.next || []), ...(s.onError || []), ...routeTargets];
}

/**
 * Validate a workflow definition's SHAPE and GRAPH. Returns error strings; an
 * empty array means valid. Enforces: unique step ids, a real entry, every edge
 * target existing (including WF-002 `routes` targets), ACYCLICITY (the engine's
 * single forward pass assumes a DAG — a cycle would be a definition bug, caught
 * here, not a hang at runtime), and each kind's own required fields via
 * `validateStepShape` (WF-002's step-kind catalog).
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
    if (s.timeoutMs !== undefined && (typeof s.timeoutMs !== 'number' || s.timeoutMs < 0)) {
      errors.push(`step "${s.id}": timeoutMs must be a non-negative number`);
    }
    if (s.routes !== undefined) {
      if (typeof s.routes !== 'object' || s.routes === null || Array.isArray(s.routes)) {
        errors.push(`step "${s.id}": routes must be an object of { routeName: [stepId, ...] }`);
      } else {
        for (const [name, list] of Object.entries(s.routes)) {
          if (!Array.isArray(list) || list.some((t) => typeof t !== 'string')) {
            errors.push(`step "${s.id}": route "${name}" must be an array of step ids`);
          }
        }
      }
    }
    // Per-kind required fields, params and route names (WF-002 step catalog).
    errors.push(...validateStepShape(s));
  }

  if (typeof def.entry !== 'string' || !ids.has(def.entry)) {
    errors.push(`entry "${def.entry}" must name one of the steps`);
  }

  // Every edge target must exist.
  for (const s of def.steps) {
    for (const t of s.next || []) if (!ids.has(t)) errors.push(`step "${s.id}": next target "${t}" does not exist`);
    for (const t of s.onError || []) if (!ids.has(t)) errors.push(`step "${s.id}": onError target "${t}" does not exist`);
    for (const [name, list] of Object.entries(s.routes || {})) {
      if (!Array.isArray(list)) continue;
      for (const t of list) {
        if (typeof t === 'string' && !ids.has(t)) {
          errors.push(`step "${s.id}": route "${name}" target "${t}" does not exist`);
        }
      }
    }
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
      for (const t of allEdgeTargets(s)) {
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

  // WFA-003: `{"$path": "upstream.<stepId>.…"}` references, checked against the
  // graph. A typo here is not a runtime possibility — the step either exists
  // upstream of this one or it can never have run — so it is a 400 rather than a
  // silent `undefined` discovered halfway through a production run.
  if (errors.length === 0) errors.push(...validateValueReferences(def));

  return errors;
}

/** Transitive ancestors of every step, over `next` ∪ `onError` ∪ `routes`. */
function ancestorsOf(def: WorkflowDefinition): Map<string, Set<string>> {
  const ancestors = new Map<string, Set<string>>(def.steps.map((s) => [s.id, new Set<string>()]));
  // Topological order means a step's predecessors are already complete when we
  // reach it, so one forward pass suffices.
  for (const step of topoOrder(def)) {
    const mine = ancestors.get(step.id)!;
    for (const target of allEdgeTargets(step)) {
      const theirs = ancestors.get(target);
      if (!theirs) continue; // dangling target, already reported
      theirs.add(step.id);
      for (const a of mine) theirs.add(a);
    }
  }
  return ancestors;
}

/**
 * Validate every `$path` in every step's params (conditions included) that
 * addresses another step. Only `upstream.<stepId>` names a step; `previous` and
 * the payload keys are shapes the engine cannot know, so a path into them is
 * allowed silently — a function's output shape is the function's business.
 */
function validateValueReferences(def: WorkflowDefinition): string[] {
  const errors: string[] = [];
  const ids = new Set(def.steps.map((s) => s.id));
  const ancestors = ancestorsOf(def);

  for (const step of def.steps) {
    if (!step.params) continue;
    const at = `step "${step.id}"`;

    // Walked PER PARAM, at the same starting depth the resolver uses, so
    // "rejected at write time" and "resolved at run time" agree exactly rather
    // than differing by the params object itself.
    const found: { path: string; where: string }[] = [];
    for (const [name, value] of Object.entries(step.params)) {
      if (exceedsValueDepth(value)) {
        errors.push(`${at}.params.${name} nests deeper than ${MAX_VALUE_DEPTH} levels, past where values are resolved`);
      }
      found.push(...collectValuePaths(value, `${at}.params.${name}`));
    }

    for (const { path, where } of found) {
      const segments = path.split('.');
      if (segments[0] !== 'upstream') continue;
      const target = segments[1];
      if (!target) {
        errors.push(`${where}: "$path": "${path}" needs a step id — write "upstream.<stepId>.<field>"`);
      } else if (!ids.has(target)) {
        errors.push(`${where}: "$path" references step "${target}", which is not a step in this workflow`);
      } else if (!ancestors.get(step.id)?.has(target)) {
        errors.push(
          `${where}: "$path" references step "${target}", which is not upstream of "${step.id}" — ` +
            'it cannot have produced output by the time this step runs'
        );
      }
    }
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
    for (const t of allEdgeTargets(s)) {
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
          ...(opts.trigger.triggerId ? { triggerId: opts.trigger.triggerId } : {}),
          // BAK-009: the request that started this run, when an HTTP request did.
          ...(opts.trigger.requestId ? { requestId: opts.trigger.requestId } : {})
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

    // CWF-002: what a `return` step decided the run answers with. FIRST WINS —
    // two Return steps on two branches is the normal shape (a success path and
    // an error path), and if a parallel merge ever runs both, resolving it
    // silently is worse than resolving it predictably and saying so. The losers
    // are recorded on the execution record rather than discarded.
    let returned: { from: string; value: unknown } | undefined;
    const returnConflict: string[] = [];

    // Which upstream step "reached" a given step (for input `previous`).
    const reachedBy = new Map<string, string>();
    // EVERY upstream step that reached it (for `ctx.upstream` — the `merge`
    // kind needs all converging branches, not just the first one to arrive).
    const reachedByAll = new Map<string, string[]>();

    const take = (target: string, from: string): void => {
      if (!reachedBy.has(target)) reachedBy.set(target, from);
      const all = reachedByAll.get(target);
      if (all) {
        if (!all.includes(from)) all.push(from);
      } else {
        reachedByAll.set(target, [from]);
      }
    };

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
        // Outputs of every predecessor that took an edge here. Topological
        // order guarantees they have all completed; a failed one appears with
        // its `{ error }` output.
        const upstream: Record<string, Record<string, unknown> | undefined> = {};
        for (const id of reachedByAll.get(step.id) || []) upstream[id] = outcomes.get(id)?.output;

        // WFA-003's author-facing `upstream.<stepId>`: EVERY earlier step that
        // produced output, not only the immediate predecessors. A three-step
        // chain must be able to read step 1 from step 3, and `ctx.upstream`
        // cannot widen to cover that — `merge` mode "all" decides whether a
        // branch arrived by asking exactly which steps have an edge INTO it, so
        // making that map transitive would report a half-merge as complete.
        // Write-time validation is the gate that keeps this honest: a `$path`
        // may only name a step that is genuinely upstream in the graph.
        const upstreamByStepId: Record<string, Record<string, unknown> | undefined> = {};
        for (const [id, outcome] of outcomes) {
          if (outcome.output !== undefined) upstreamByStepId[id] = outcome.output;
        }

        // WFA-003: params are VALUES, not just literals — `{"$path": "…"}`
        // resolves against what the run has produced so far. The scope params
        // resolve against deliberately EXCLUDES the params themselves: a param
        // referencing another param of the same step would need a resolution
        // order to be defined, and there isn't one worth defining.
        const paramScope: Record<string, unknown> = {
          ...basePayload,
          ...(previous ? { previous } : {}),
          upstream: upstreamByStepId
        };
        const resolvedParams = resolveStepParams(step.params, paramScope, rawParamNames(step.kind));

        // CWF-001: THIS is the param mapping, and it has worked since WFA-003 —
        // a step's params are merged in by NAME, so a `call-function` step whose
        // params are `{ amount: {"$path": "previous.result.total"} }` hands the
        // function `body.amount`. What was missing was never the engine: it was a
        // catalog declaration saying the kind takes author-named params, so a
        // property editor had a row to author them in. `spec.paramMapping` is
        // that declaration; nothing here changed to add it.
        const input: Record<string, unknown> = {
          ...basePayload,
          ...resolvedParams,
          ...(previous ? { previous } : {})
        };
        // The scope every LAZY value resolves against (conditions, a `wait`
        // duration, a `for-each`'s items): the input the step runs with, plus
        // `upstream`. `upstream` is in the SCOPE and not in the INPUT on
        // purpose — it would otherwise be copied into every function's request
        // body and into every step's recorded inputData, duplicating data the
        // record already holds one row above.
        const scope: Record<string, unknown> = { ...input, upstream: upstreamByStepId };

        const stepId = logger?.startNode({
          nodeId: step.id,
          nodeType: this.nodeType(step),
          nodeName: step.name,
          inputData: input
        });

        const timeoutMs = step.timeoutMs && step.timeoutMs > 0 ? step.timeoutMs : def.stepTimeoutMs || 0;
        try {
          const ctx: StepExecContext = { workflow: def, step, input, scope, upstream, signal };
          const result = await this.runStepGuarded(ctx, timeoutMs, signal);
          const output = result.output;
          if (stepId) logger?.completeNode(stepId, true, output);
          outcomes.set(step.id, { status: 'success', output });
          lastOutput = output;
          stepsRun++;
          if (result.returns) {
            if (returned) returnConflict.push(step.id);
            else returned = { from: step.id, value: result.returns.value };
          }
          // Take the outgoing edges this step selected:
          //   `next`        — unconditional, taken whatever the step decided
          //   `routes[r]`   — for each route name the executor selected
          //   `halt`        — take nothing at all (a deliberate end of path)
          // Anything not taken stays unreached and is recorded `skipped`, which
          // is WF-001-SEMANTICS §1's model, unchanged.
          if (!result.halt) {
            for (const t of step.next || []) take(t, step.id);
            for (const routeName of result.select || []) {
              for (const t of step.routes?.[routeName] || []) take(t, step.id);
            }
          }
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
          // WF-002: a failed step's outcome carries the error, so a handler
          // reached by `onError` receives it as `previous.error`. Without this a
          // catch branch could see THAT something failed but not WHAT — which
          // made CF11-002's error-handling designs unimplementable. The step is
          // still recorded `error`; nothing is softened.
          outcomes.set(step.id, {
            status: 'error',
            output: {
              error: {
                message: err.message,
                name: err.name,
                ...(err instanceof StepExecutionError && err.statusCode !== undefined
                  ? { statusCode: err.statusCode }
                  : {}),
                step: step.id
              }
            }
          });
          stepsRun++;
          const routes = step.onError || [];
          if (routes.length > 0) {
            // Routed: take error edges, keep going. The workflow can still succeed.
            for (const t of routes) take(t, step.id);
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
          stepsSkipped,
          // CWF-002: which step decided the answer, and whether any other
          // Return step also ran and lost. Absent entirely for a workflow with
          // no Return step, so an existing record's metadata is unchanged.
          ...(returned ? { returnedFrom: returned.from } : {}),
          ...(returnConflict.length ? { returnConflict: [returned!.from, ...returnConflict] } : {})
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
        // A Return step's value when one ran, else the last step's output —
        // which is exactly what every workflow written before CWF-002 gets.
        output: returned ? returned.value : lastOutput,
        ...(returned ? { returned: true, returnedFrom: returned.from } : {}),
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
  private async runStepGuarded(
    ctx: StepExecContext,
    timeoutMs: number,
    signal: AbortSignal
  ): Promise<StepExecResult> {
    const racers: Promise<StepExecResult>[] = [
      Promise.resolve(this.deps.executor.execute(ctx)).then(normalizeStepReturn)
    ];

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

  /**
   * The execution-history `nodeType` for a step. Function-invoking kinds keep
   * the `function:<name>` form WF-001 established (so the History Panel and the
   * canvas Execution Overlay show WHAT ran, not just that a step ran); a
   * for-each/retry additionally names the kind, because "this step called `bill`
   * eleven times" and "this step called `bill` once" should not look identical.
   */
  private nodeType(step: WorkflowStep): string {
    if (!step.ref) return step.kind;
    return step.kind === 'call-function' ? `function:${step.ref}` : `${step.kind}:${step.ref}`;
  }
}

export { StepExecutionError };
