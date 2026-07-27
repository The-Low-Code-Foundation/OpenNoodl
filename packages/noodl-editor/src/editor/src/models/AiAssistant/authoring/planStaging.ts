/**
 * AIX-011 — Project-scope authoring: the plan transaction
 *
 * The ONLY code that moves a plan into the live project, and it moves the
 * whole plan or nothing. The transaction property is structural, not
 * promised, at three levels:
 *
 *  1. There is no per-operation apply API. This function takes the complete
 *     accepted set — `AppliedPlanOperation` *requires* `files`, and staged
 *     files exist only for candidates that passed the validation gate — so
 *     "apply operation 1 before operation 3 has validated" has no code path
 *     that could express it. The orchestrator (`PlanRun`) never imports this
 *     module; it produces plain data.
 *  2. Every check that can refuse (collision, missing target, missing doc
 *     writer, duplicate targets) runs in a preflight pass BEFORE the first
 *     mutation. A refusal throws `StagingError` with the project untouched.
 *  3. Every mutation records into ONE `UndoActionGroup`, pushed once — a
 *     single undo restores the project exactly (criterion 4 tests this on
 *     real files, not a mock), and redo reapplies the whole plan.
 *
 * Reject-before-apply needs no code here, for AIX-002's original reason: a
 * plan that is never passed to this function has touched nothing.
 *
 * @module AiAssistant/authoring/planStaging
 */

import type { ComponentModel } from '../../componentmodel';
import type { ProjectModel } from '../../projectmodel';
import { UndoActionGroup, UndoQueue } from '../../undo-queue-model';
import type { PlanOperation } from './plan';
import {
  addAuthoredComponentToGroup,
  stagedLegacyName,
  StagingError,
  updateAuthoredComponentInGroup
} from './staging';
import type { ComponentFiles } from './types';

/**
 * One accepted operation, ready to apply. `files` is not optional: the type
 * itself is the "everything staged first" gate — an operation that never
 * passed the validation gate has no `ComponentFiles` to put here.
 */
export interface AppliedPlanComponentOperation {
  kind: 'create' | 'update';
  operation: PlanOperation;
  files: ComponentFiles;
}

/**
 * A doc operation in the accepted set. Its write goes through AIX-009's
 * reviewed project-docs path via the injected `PlanDocWriter` — see below.
 */
export interface AppliedPlanDocOperation {
  kind: 'doc';
  operation: PlanOperation;
}

export type AppliedPlanOperation = AppliedPlanComponentOperation | AppliedPlanDocOperation;

/**
 * ── AIX-009 MERGE SEAM ────────────────────────────────────────────────────────
 *
 * The single injection point for doc writes. AIX-011 makes `doc` a
 * first-class plan operation; the write itself belongs to AIX-009's reviewed
 * write path (`ProjectDocsModel` / `write_project_doc`), which is being built
 * in a parallel worktree and does not exist on this base. At merge time,
 * implement this interface over that path and hand it to `applyAuthoredPlan`
 * (the editor's construction site is `AiAuthoringPanel`'s `planDocWriter()`).
 *
 * The contract: `apply` performs the doc write for `op` and records its undo
 * into `undoGroup`, so the doc change rides in the SAME single undo step as
 * the plan's components (acceptance criterion 7). It must throw on failure —
 * never swallow. Until a writer exists, `applyAuthoredPlan` REFUSES a plan
 * containing doc operations in preflight (loudly, before any mutation); it
 * never fake-succeeds.
 */
export interface PlanDocWriter {
  apply(op: AppliedPlanDocOperation, undoGroup: UndoActionGroup): void;
}

export interface ApplyPlanOptions {
  label?: string;
  /** Absent until AIX-009 merges — see the seam note above. */
  docWriter?: PlanDocWriter;
}

export interface AppliedPlanResult {
  /** Components created or replaced, in apply order, keyed by operation id. */
  components: Map<string, ComponentModel>;
  undoLabel: string;
}

/**
 * Apply an accepted plan to the live project as one undoable step.
 *
 * Order is the caller's (plan order: creates, then updates, then docs) and is
 * preserved. Throws `StagingError` from preflight — project untouched — when
 * any operation could not apply; there is deliberately no path that applies
 * some operations and then discovers a refusal.
 */
export function applyAuthoredPlan(
  project: ProjectModel,
  operations: readonly AppliedPlanOperation[],
  options: ApplyPlanOptions = {}
): AppliedPlanResult {
  if (operations.length === 0) {
    throw new StagingError('The plan has no accepted operations to apply.');
  }

  // ── Preflight: every refusal happens here, before any mutation. ────────────
  const seen = new Set<string>();
  for (const op of operations) {
    if (op.kind === 'doc') {
      if (!options.docWriter) {
        throw new StagingError(
          `Doc operation "${op.operation.target}" cannot be applied: the project docs write path (AIX-009) ` +
            'is not available. Exclude the doc operation to apply the rest.'
        );
      }
      continue;
    }
    const legacyName = stagedLegacyName(op.files);
    if (seen.has(legacyName)) {
      throw new StagingError(`The plan applies "${legacyName}" twice — operations must target distinct components.`);
    }
    seen.add(legacyName);
    const existing = project.getComponentWithName(legacyName);
    if (op.kind === 'create' && existing) {
      throw new StagingError(
        `Component "${legacyName}" already exists in the project — it was created after authoring started.`
      );
    }
    if (op.kind === 'update' && !existing) {
      throw new StagingError(
        `Component "${legacyName}" no longer exists in the project — it was removed after authoring started.`
      );
    }
  }

  // ── One group, every mutation inside it, pushed once. ──────────────────────
  const componentCount = operations.filter((op) => op.kind !== 'doc').length;
  const undoLabel =
    options.label ??
    `apply AI plan (${componentCount} component${componentCount === 1 ? '' : 's'}${
      operations.length > componentCount ? ' + docs' : ''
    })`;
  const undo = new UndoActionGroup({ label: undoLabel });
  const components = new Map<string, ComponentModel>();

  for (const op of operations) {
    if (op.kind === 'doc') {
      // Preflight guaranteed the writer exists.
      options.docWriter?.apply(op, undo);
    } else if (op.kind === 'create') {
      components.set(op.operation.id, addAuthoredComponentToGroup(project, op.files, undo));
    } else {
      components.set(op.operation.id, updateAuthoredComponentInGroup(project, op.files, undo));
    }
  }

  UndoQueue.instance.push(undo);
  return { components, undoLabel };
}
