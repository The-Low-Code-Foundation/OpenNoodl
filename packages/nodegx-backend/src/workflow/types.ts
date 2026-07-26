/**
 * WF-001 workflow definition format.
 *
 * A **workflow** here is the WF-001 engine's artifact: a multi-step, ordered,
 * error-routed, cancellable execution — NOT the same thing as the historically
 * mis-named `*.workflow.json` files, which hold cloud FUNCTION graphs
 * (request/response, run by CloudRunner). To keep the two apart in code and on
 * disk, WF-001 workflow definitions live under `<dataDir>/workflow-defs/` and
 * are addressed as "workflow definitions" everywhere.
 *
 * Structural rule (binding, inherited from the brief): **a workflow node is a
 * node.** A step does not introduce a second node abstraction — it *schedules an
 * existing runnable unit in a different execution context*. In v1 the only step
 * kind is `call-function`, which invokes an existing cloud function (a graph of
 * real, catalogued, typed nodes) through the same CloudRunner the request/
 * response path uses. WF-002's Series-1 workflow nodes plug into the SAME
 * `StepExecutor` seam as additional step kinds; the engine's ordering/error/
 * cancel/timeout semantics do not change when they arrive.
 *
 * The engine's ordering model is an explicit step DAG (dependency-ordered with
 * explicit completion), deliberately NOT the browser runtime's dirty-flag,
 * per-frame propagation — there are no frames server-side. See
 * WF-001-SEMANTICS.md §Ordering for exactly where and why this differs.
 *
 * @module nodegx-backend/workflow/types
 */

/** The only step kind in v1. WF-002 adds more via the same StepExecutor seam. */
export type StepKind = 'call-function';

export interface WorkflowStep {
  /** Unique within the workflow. Doubles as the execution-history `nodeId`. */
  id: string;
  /** Human label (optional). */
  name?: string;
  /** What the step runs. v1: 'call-function'. */
  kind: StepKind;
  /** For 'call-function': the cloud-function name to invoke. */
  ref?: string;
  /** Static parameters merged into the step's input (see semantics doc §Data). */
  params?: Record<string, unknown>;
  /**
   * Per-step timeout in ms. 0 / omitted = inherit the workflow default (or none).
   * A step that exceeds it is recorded as a failed step and routed via `onError`
   * (or halts the workflow if unrouted) — loud, never a silent hang.
   */
  timeoutMs?: number;
  /** Success edges: steps that become reachable when THIS step succeeds. */
  next?: string[];
  /**
   * Error edges: steps that become reachable when THIS step FAILS. A non-empty
   * `onError` makes a failure ROUTED (handled) — the workflow can still succeed.
   * An empty/absent `onError` makes a failure UNROUTED — the workflow halts and
   * is recorded failed (never swallowed). This is CF11-002's catch/retry design
   * expressed as first-class edges.
   */
  onError?: string[];
}

export interface WorkflowDefinition {
  version: 1;
  /** Stable id; also the execution-history `workflowId`. */
  id: string;
  name?: string;
  /** The step the run starts from. Must be one of `steps`. */
  entry: string;
  /**
   * Max concurrent RUNS of THIS workflow (the "same workflow triggered twice"
   * policy). Default 1. Runs beyond the cap QUEUE (FIFO) rather than being
   * dropped or coalesced — see semantics doc §Concurrency.
   */
  concurrency: number;
  /** Whole-workflow timeout in ms. 0 / omitted = none. */
  timeoutMs?: number;
  /** Default per-step timeout in ms applied to steps without their own. 0 = none. */
  stepTimeoutMs?: number;
  steps: WorkflowStep[];
  createdAt: string;
  updatedAt: string;
}

/** Input accepted by the registry's upsert — timestamps are registry-owned. */
export interface WorkflowInput {
  id?: string;
  name?: string;
  entry: string;
  concurrency?: number;
  timeoutMs?: number;
  stepTimeoutMs?: number;
  steps: WorkflowStep[];
}

/** Engine-level outcome of a single run. */
export type RunStatus = 'success' | 'error' | 'cancelled';

export interface WorkflowRunResult {
  /** The execution-history record id (the run is queryable at /executions/:id). */
  executionId: string;
  workflowId: string;
  status: RunStatus;
  /** True when the run failed because a step failed with no error route. */
  unroutedError: boolean;
  /** True when a per-workflow (or the abort) timeout tripped. */
  timedOut: boolean;
  /** Steps actually executed (excludes skipped). */
  stepsRun: number;
  /** Steps recorded as skipped (unreached branches / post-halt tail). */
  stepsSkipped: number;
  /** Output of the last successfully-run step, if any. */
  output?: Record<string, unknown>;
  error?: string;
}

export type StepOutcomeStatus = 'success' | 'error' | 'skipped';
