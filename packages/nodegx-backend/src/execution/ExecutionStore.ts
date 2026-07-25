/**
 * Execution store home — PLACEHOLDER (owned by WF-006).
 *
 * ============================================================================
 * DEFERRED. The execution store is introduced by WF-006, not WF-004.
 * ============================================================================
 *
 * WF-004's desired state names "(from WF-006) the execution store" as one of the
 * things this package embeds. This module reserves that home so WF-006 has a
 * clear place to land — it does nothing yet and must not be implemented here.
 *
 * When WF-006 lands, this records workflow/function execution history (runs,
 * status, timings, logs) and backs whatever debugging/observability surface the
 * editor exposes.
 *
 * @module nodegx-backend/execution/ExecutionStore
 */

import type { PersistenceHandle } from '../persistence/createAdapter';

export interface ExecutionStoreDeps {
  persistence: PersistenceHandle;
}

/** Placeholder. */
export class ExecutionStore {
  private readonly deps: ExecutionStoreDeps;

  constructor(deps: ExecutionStoreDeps) {
    this.deps = deps;
  }
}
