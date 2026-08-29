'use strict';

/**
 * The per-run services a graph may reach (CWF-013).
 *
 * ## Why this is not a process global
 *
 * `_noodl_send_email` and `_noodl_get_secret` are process globals, and for those two that is
 * right: neither answer depends on *which request* is asking. A log line does. It has to carry the
 * request id, or it cannot be lined up against the access log and the execution record — which is
 * the entire reason CWF-013 exists rather than leaving authors on `console.log`.
 *
 * Two cloud functions run concurrently in one process (`cloud-array-vocabulary.test.ts` asserts
 * exactly that, and inverted: state that silently *persists* between two callers is as wrong as
 * state that silently forgets). So a module-level "current run" would attribute one caller's log
 * line to the other's request id the first time two requests overlapped — a lie that is worse than
 * no id at all, because it would be believed.
 *
 * ## How it reaches a node
 *
 * `NodeScope.runContext`, propagated down component instances exactly as `modelScope` already is
 * (`componentinstance.ts`). The cloud runner sets it on the per-request scope it creates; every
 * nested component instance inherits it; a node reads `this.nodeScope.runContext`. In the browser
 * nothing sets it, which is how one node ends up with two destinations and no `if (cloud)`.
 *
 * @module noodl-runtime/runcontext
 */

/** The four levels the structured logger already understands (`nodegx-backend/ops/logger`). */
export type RuntimeLogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface RuntimeLogEntry {
  level: RuntimeLogLevel;
  /** The author's line. Free text — see the redaction note on the `Log` node. */
  message: string;
  /** An optional structured payload, redacted by whatever consumes this. */
  data?: unknown;
  /** The graph node that logged, so a line can be traced back to a place on a canvas. */
  nodeId?: string;
}

/**
 * One action invocation, opened at {@link NodeInstance.beginOutcome} (DEF-004).
 *
 * ⚠️ **A "step" is an action invocation, not a node the graph passed through.** A `String Format`
 * neither succeeds nor fails, so there is nothing to record about it beyond that a value crossed
 * a wire — which is the per-edge trace's job (`tracebuffer.ts`), a different instrument with a
 * different cost. What an author debugging a wrong result needs is the list of things the graph
 * *did*, each with a verdict, and that set is exactly the set of outcome-reporting invocations.
 */
export interface RuntimeStepStart {
  /** The graph node that acted, so a step can be traced back to a place on a canvas. */
  nodeId: string;
  /** Its registered type name, e.g. `net.noodl.Log`. */
  nodeType: string;
  /**
   * Optional per-node context for the record. ⚠️ Whatever consumes this is responsible for
   * redacting it — a node hands over its own inputs and cannot know what the host considers a
   * secret. The backend sink runs the same two redactions the log line gets, so a record is
   * never less safe than the log.
   */
  inputData?: Record<string, unknown>;
}

/** How an invocation ended. `code` and `message` are present on `failure` only. */
export interface RuntimeStepEnd {
  status: 'done' | 'unchanged' | 'failure';
  code?: string;
  message?: string;
}

/**
 * Services scoped to one run of one graph.
 *
 * Deliberately small. This is not a general-purpose bag: everything on it has to be something that
 * genuinely differs *per run*, or it belongs on a process global where it cannot be forgotten.
 */
export interface NodeRunContext {
  /** Where a `Log` node's line goes. Absent in the browser, where the console is the answer. */
  log?(entry: RuntimeLogEntry): void;
  /**
   * DEF-004 — where an action invocation is recorded. Returns an opaque handle the runtime hands
   * back to {@link endStep}; `undefined` means the host declined to record this one (a cap, a
   * disabled history) and the runtime must not then call `endStep`.
   *
   * ⚠️ **This has to be the per-run channel and not the error bus**, which is the obvious
   * alternative and the wrong one: the bus hangs off `NodeContext`, there is one of those per
   * `CloudRunner`, and two cloud functions run concurrently in it. A bus subscriber cannot say
   * whose request an event belongs to. This can, for the same reason `log` can.
   */
  beginStep?(step: RuntimeStepStart): unknown;
  /** Close the invocation opened by {@link beginStep}. Never called without a handle from it. */
  endStep?(handle: unknown, end: RuntimeStepEnd): void;
  /** The HTTP request id this run belongs to, when there is one. Diagnostics only. */
  requestId?: string;
}
