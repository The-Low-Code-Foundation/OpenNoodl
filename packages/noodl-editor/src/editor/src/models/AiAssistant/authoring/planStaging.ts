/**
 * AIX-011 — Project-scope authoring: the plan transaction
 *
 * The ONLY code that moves a plan into the live project, and it moves the
 * whole plan or nothing. The transaction property is structural, not
 * promised, at three levels:
 *
 *  1. There is no per-operation apply API. This function takes the complete
 *     accepted set — `AppliedPlanComponentOperation` *requires* `files` and
 *     `AppliedPlanDocOperation` *requires* `proposed`, and both exist only for
 *     candidates that passed their gate — so "apply operation 1 before
 *     operation 3 has validated" has no code path that could express it. The
 *     orchestrator (`PlanRun`) never imports this module; it produces plain
 *     data.
 *  2. Every check that can refuse (collision, missing target, missing doc
 *     writer, duplicate targets, a doc that changed on disk since it was read)
 *     runs in a preflight pass BEFORE the first mutation. A refusal throws
 *     `StagingError` with the project untouched.
 *  3. Every mutation records into ONE `UndoActionGroup`, pushed once — a
 *     single undo restores the project exactly (criterion 4 tests this on
 *     real files, not a mock), and redo reapplies the whole plan.
 *
 * Reject-before-apply needs no code here, for AIX-002's original reason: a
 * plan that is never passed to this function has touched nothing.
 *
 * **Why the doc writes go first.** They are the only part of an apply that
 * touches a disk, and therefore the only part that can still fail once
 * preflight has passed; component operations at this point are in-memory model
 * edits against a project preflight has just checked. Doing the fallible thing
 * first means its failure is a clean refusal with nothing else applied. The
 * remaining case — a component mutation throwing after a doc has been written
 * — is caught and the whole group is rolled back through the inverses it has
 * already recorded, so there is still no path that leaves half a plan behind.
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
 * A doc operation in the accepted set, carrying the body a `DocSession`
 * authored during the fan-out. `proposed` is required for exactly the reason
 * `files` is on a component operation: a doc operation that never authored
 * anything has nothing to put here, so "apply a doc op whose body does not
 * exist yet" is not expressible. `baseline` is the file as the authoring turn
 * read it, and is what the write path's optimistic-concurrency check compares
 * against — `null` means the file did not exist.
 */
export interface AppliedPlanDocOperation {
  kind: 'doc';
  operation: PlanOperation;
  proposed: string;
  baseline: string | null;
  /** The model's one-line description of its change, for logs and labels. */
  summary?: string;
}

export type AppliedPlanOperation = AppliedPlanComponentOperation | AppliedPlanDocOperation;

/**
 * The doc write path, injected.
 *
 * The write itself belongs to AIX-009 (`ProjectDocsModel` — optimistic
 * concurrency against `baseline`, temp-file + atomic rename), and this module
 * belongs to AIX-011; the interface is the seam between them, and it is also
 * what keeps the plan transaction free of the platform filesystem.
 * `createPlanDocWriter` in `models/ProjectDocs` is the editor's implementation.
 *
 * The contract:
 *
 *  - `preflight` may refuse — the file changed on disk since the doc turn read
 *    it, the path is not inside `docs/` — and runs with nothing yet mutated.
 *  - `apply` performs the write and records its inverse into `undoGroup`, so
 *    the doc change rides in the SAME single undo step as the plan's
 *    components (acceptance criterion 7).
 *  - Both must throw on failure, never swallow.
 *
 * Without a writer, `applyAuthoredPlan` REFUSES a plan containing doc
 * operations in preflight, loudly, before any mutation. It never fake-succeeds.
 */
export interface PlanDocWriter {
  preflight?(op: AppliedPlanDocOperation): Promise<void> | void;
  apply(op: AppliedPlanDocOperation, undoGroup: UndoActionGroup): Promise<void> | void;
}

export interface ApplyPlanOptions {
  label?: string;
  /**
   * Absent only when the project has nowhere to keep docs (an unsaved project
   * has no folder), in which case a plan carrying doc operations is refused
   * rather than silently applied without them.
   */
  docWriter?: PlanDocWriter;
}

export interface AppliedPlanResult {
  /** Components created or replaced, in apply order, keyed by operation id. */
  components: Map<string, ComponentModel>;
  /** Doc paths written, in apply order. */
  docs: string[];
  undoLabel: string;
}

/**
 * Apply an accepted plan to the live project as one undoable step.
 *
 * Throws `StagingError` from preflight — project untouched — when any
 * operation could not apply; there is deliberately no path that applies some
 * operations and then discovers a refusal.
 */
export async function applyAuthoredPlan(
  project: ProjectModel,
  operations: readonly AppliedPlanOperation[],
  options: ApplyPlanOptions = {}
): Promise<AppliedPlanResult> {
  if (operations.length === 0) {
    throw new StagingError('The plan has no accepted operations to apply.');
  }

  const docOps = operations.filter((op): op is AppliedPlanDocOperation => op.kind === 'doc');
  const componentOps = operations.filter((op): op is AppliedPlanComponentOperation => op.kind !== 'doc');

  // ── Preflight: every refusal happens here, before any mutation. ────────────
  const seenDocs = new Set<string>();
  for (const op of docOps) {
    if (!options.docWriter) {
      throw new StagingError(
        `Doc operation "${op.operation.target}" cannot be applied: this project has no docs folder to write ` +
          'to (it has never been saved). Exclude the doc operation to apply the rest.'
      );
    }
    if (seenDocs.has(op.operation.target)) {
      throw new StagingError(
        `The plan writes "${op.operation.target}" twice — two operations cannot rewrite the same document.`
      );
    }
    seenDocs.add(op.operation.target);
    try {
      await options.docWriter.preflight?.(op);
    } catch (error) {
      throw new StagingError(
        `Doc operation "${op.operation.target}" cannot be applied: ${
          error instanceof Error ? error.message : String(error)
        } Nothing was written.`
      );
    }
  }

  const seen = new Set<string>();
  for (const op of componentOps) {
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
  const undoLabel =
    options.label ??
    `apply AI plan (${componentOps.length} component${componentOps.length === 1 ? '' : 's'}${
      docOps.length > 0 ? ` + ${docOps.length} doc${docOps.length === 1 ? '' : 's'}` : ''
    })`;
  const undo = new UndoActionGroup({ label: undoLabel });
  const components = new Map<string, ComponentModel>();
  const docs: string[] = [];

  try {
    // Disk first — see the module note. Preflight guaranteed the writer exists.
    for (const op of docOps) {
      await options.docWriter!.apply(op, undo);
      docs.push(op.operation.target);
    }
    for (const op of componentOps) {
      components.set(
        op.operation.id,
        op.kind === 'create'
          ? addAuthoredComponentToGroup(project, op.files, undo)
          : updateAuthoredComponentInGroup(project, op.files, undo)
      );
    }
  } catch (error) {
    // Roll back through the inverses recorded so far. This is not a
    // partial-apply path — it is the absence of one.
    try {
      undo.undo();
    } catch {
      /* a failed rollback must not hide the failure that caused it */
    }
    throw new StagingError(
      `The plan could not be applied: ${error instanceof Error ? error.message : String(error)} ` +
        'Everything it had already changed was rolled back.'
    );
  }

  UndoQueue.instance.push(undo);
  return { components, docs, undoLabel };
}
