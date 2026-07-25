/**
 * WorkflowRunner home — PLACEHOLDER (relocation deferred).
 *
 * ============================================================================
 * DEFERRED. The current WorkflowRunner is owned by another task right now.
 * ============================================================================
 *
 * The existing runner lives at
 * `packages/noodl-editor/src/main/src/local-backend/WorkflowRunner.js` (~400
 * lines: loader/dispatcher, plus the `findViewerCloudPath()` probe that today
 * silently disables workflows if `noodl-viewer-cloud` does not resolve). It is
 * being actively edited by WF-006 at the time of this scaffold, so it is
 * explicitly NOT touched or moved here in the front half.
 *
 * This module exists to reserve the obvious home in the package (WF-004 scope:
 * "leave [the workflow engine] an obvious home"). When the runner relocates:
 *   - The viewer-cloud path resolution becomes loud (failure surfaces, not a
 *     silent no-op).
 *   - `/functions/:name` in HttpServer routes here (and later to the WF-001
 *     engine and WF-005 triggers).
 *
 * @module nodegx-backend/workflow/WorkflowRunner
 */

import type { PersistenceHandle } from '../persistence/createAdapter';

export interface WorkflowRunnerDeps {
  persistence: PersistenceHandle;
  dataDir: string;
}

/** Placeholder. Registers no workflows and runs nothing yet. */
export class WorkflowRunner {
  private readonly deps: WorkflowRunnerDeps;

  constructor(deps: WorkflowRunnerDeps) {
    this.deps = deps;
  }

  /** No-op until the real runner relocates here (second half + WF-006 handoff). */
  async load(): Promise<void> {
    /* deferred */
  }

  /** @returns names of loaded cloud functions — none in the scaffold. */
  listFunctions(): string[] {
    return [];
  }
}
