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

/**
 * Every step kind. `call-function` is WF-001's original and remains the
 * workhorse; the rest are WF-002's Series-1 kinds (CF11-001 logic, CF11-002
 * error handling, CF11-003 wait/delay), added through the SAME StepExecutor
 * seam WF-001 documented — the engine's ordering / error-routing / cancel /
 * timeout / concurrency semantics are unchanged by them.
 *
 * Each kind's params, routes, output shape and prose live in
 * `steps/kinds.ts` (`STEP_KIND_SPECS`), which is also the source of write-time
 * validation and the `/admin/workflow-step-kinds` catalog.
 */
export type StepKind =
  | 'call-function'
  // CF11-001 logic
  | 'branch'
  | 'switch'
  | 'for-each'
  | 'merge'
  // CF11-002 error handling
  | 'stop'
  // CF11-003 wait / delay
  | 'wait'
  | 'wait-until'
  // CWF-002: what the caller gets back
  | 'return'
  // CWF-004: reshape a payload without a round trip through a function
  | 'transform';

export interface WorkflowStep {
  /** Unique within the workflow. Doubles as the execution-history `nodeId`. */
  id: string;
  /** Human label (optional). */
  name?: string;
  /** What the step runs. See StepKind. */
  kind: StepKind;
  /** For function-invoking kinds ('call-function', 'for-each'): the cloud-function name. */
  ref?: string;
  /** Static parameters merged into the step's input (see semantics doc §Data). */
  params?: Record<string, unknown>;
  /**
   * Per-step timeout in ms. 0 / omitted = inherit the workflow default (or none).
   * A step that exceeds it is recorded as a failed step and routed via `onError`
   * (or halts the workflow if unrouted) — loud, never a silent hang.
   */
  timeoutMs?: number;
  /**
   * UNCONDITIONAL success edges: steps that become reachable when THIS step
   * succeeds, whatever it decided. For a routing kind (`branch`, `switch`)
   * these are taken IN ADDITION to the selected route — `next` means "always
   * continue here", `routes` means "continue here conditionally".
   */
  next?: string[];
  /**
   * CONDITIONAL, NAMED success edges (WF-002). A routing step kind selects one
   * or more route names when it runs, and only those routes' targets become
   * reachable; unselected targets are recorded `skipped` like any unreached
   * step. Route names are fixed per kind (`ontrue`/`onfalse` for `branch`,
   * `done`/`skipped` for `wait-until`, …) except `switch`, whose names are its
   * case labels plus `default`. See `steps/kinds.ts`.
   *
   * Route targets participate in edge-existence and acyclicity validation
   * exactly like `next`/`onError`, so a dangling or cyclic route is rejected at
   * write time.
   */
  routes?: Record<string, string[]>;
  /**
   * Error edges: steps that become reachable when THIS step FAILS. A non-empty
   * `onError` makes a failure ROUTED (handled) — the workflow can still succeed.
   * An empty/absent `onError` makes a failure UNROUTED — the workflow halts and
   * is recorded failed (never swallowed). This is CF11-002's catch/retry design
   * expressed as first-class edges.
   */
  onError?: string[];
  /**
   * Editor-owned canvas position (WFA-004). The engine never reads it.
   *
   * It lives on the step, and not in editor-local storage, because a workflow
   * definition is the ONLY artefact a workflow has: it is not a project file,
   * so no repository carries a layout beside it. Editor-local positions would
   * mean every collaborator — and the same author on a second machine — opens a
   * workflow that has never been arranged. `WorkflowRegistry.upsert` rebuilds
   * the definition from a field whitelist but passes `steps` through verbatim,
   * so a per-step key is what survives a round trip; a workflow-level one would
   * not. Declared here rather than left to that accident.
   *
   * Optional, and absent from every definition written before WFA-004 — so the
   * shape check `validateStepShape` performs on it cannot make an existing file
   * refuse to load.
   */
  ui?: { x: number; y: number };
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
  /**
   * What the run answers with (CWF-002).
   *
   * A `return` step sets it explicitly to that step's `value` — which is why
   * this is `unknown` and not `Record<string, unknown>`: a Return may hand back
   * a number, a string or an array, and forcing it into an object would be the
   * engine inventing a wrapper the author never wrote.
   *
   * With no `return` step it is the output of the last successfully-run step,
   * exactly as before — every workflow written before CWF-002 keeps the value
   * it always had, in the shape it always had.
   */
  output?: unknown;
  /**
   * True when `output` came from a `return` step rather than from "whichever
   * step happened to finish last". The distinction is the whole point of the
   * kind: `lastOutput` is not something an author can read off a branching
   * canvas, and a caller deserves to know which of the two it is looking at.
   */
  returned?: boolean;
  /** The `return` step that set `output`, when one did (first-wins). */
  returnedFrom?: string;
  error?: string;
}

export type StepOutcomeStatus = 'success' | 'error' | 'skipped';
