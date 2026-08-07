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
 * Services scoped to one run of one graph.
 *
 * Deliberately small. This is not a general-purpose bag: everything on it has to be something that
 * genuinely differs *per run*, or it belongs on a process global where it cannot be forgotten.
 */
export interface NodeRunContext {
  /** Where a `Log` node's line goes. Absent in the browser, where the console is the answer. */
  log?(entry: RuntimeLogEntry): void;
  /** The HTTP request id this run belongs to, when there is one. Diagnostics only. */
  requestId?: string;
}
