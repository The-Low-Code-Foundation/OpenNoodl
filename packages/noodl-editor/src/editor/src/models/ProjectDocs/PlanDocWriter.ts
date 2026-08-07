/**
 * AIX-011 criterion 7 — the plan transaction's doc write path.
 *
 * The implementation of AIX-011's `PlanDocWriter` seam over AIX-009's
 * `ProjectDocsModel`. It lives here, not in `AiAssistant/authoring/`, because
 * this is the side that owns the filesystem: the authoring modules are imported
 * by the headless measurement bundle and must stay free of
 * `@noodl/platform`'s filesystem, so the dependency points ProjectDocs →
 * authoring (a type import) and never back.
 *
 * Two things it does that a naive "write the file" would not:
 *
 *  - **Preflight refuses on drift.** The proposal was authored against the file
 *    as it stood at fan-out; the user may have edited it in VS Code while
 *    reviewing the plan. Refusing in preflight — before any component operation
 *    has been applied — is what keeps the plan's all-or-nothing promise true
 *    for docs as well as for components.
 *  - **It records the inverse with `push`, not the constructor's do/undo pair.**
 *    `UndoActionGroup`'s constructor appends its action but leaves the pointer
 *    at 0, so `undo()` loops from −1 and does nothing; `pushAndDo` masks this by
 *    advancing the pointer through `do()`. The write has already happened here,
 *    so there is nothing to `do` — `push` advances the pointer without
 *    executing, which is exactly the "already applied, just record the inverse"
 *    case. `DocProposals.accept` learnt this the hard way and the same comment
 *    lives there.
 *
 * @module ProjectDocs/PlanDocWriter
 */

import type {
  AppliedPlanDocOperation,
  PlanDocWriter
} from '../AiAssistant/authoring/planStaging';
import type { UndoActionGroup } from '../undo-queue-model';
import { assertInsideDocs } from './docsText';
import { DocsConflictError, type ProjectDocsModel } from './ProjectDocsModel';

/**
 * A `PlanDocWriter` over one project's docs folder.
 *
 * Returns `undefined` when there is no docs model — an unsaved project has no
 * folder to put a `docs/` in — so the caller passes `undefined` to
 * `applyAuthoredPlan`, which refuses doc operations loudly rather than dropping
 * them.
 */
export function createPlanDocWriter(docs: ProjectDocsModel | undefined): PlanDocWriter | undefined {
  if (!docs) return undefined;

  return {
    async preflight(op: AppliedPlanDocOperation): Promise<void> {
      const rel = assertInsideDocs(op.operation.target);
      const current = (await docs.read(rel)) ?? null;
      if (current !== op.baseline) {
        throw new DocsConflictError(
          rel,
          `${rel} changed on disk while the plan was being reviewed — the proposed version was written ` +
            'against the older text. Re-run the doc operation so the diff is against what is there now.'
        );
      }
    },

    async apply(op: AppliedPlanDocOperation, undoGroup: UndoActionGroup): Promise<void> {
      const rel = assertInsideDocs(op.operation.target);
      const { proposed, baseline } = op;

      // Checked against the baseline again: preflight closes the window that
      // matters, this closes the one preflight itself opened.
      await docs.write(rel, proposed, { baseline });

      // Undo/redo re-write whole files. `baseline: undefined` skips the drift
      // check on the way back — the user asked for this exact restoration, and
      // an undo that silently fails is worse than one that overwrites the edit
      // it was going to overwrite anyway.
      undoGroup.push({
        do: () => {
          void docs.write(rel, proposed, {});
        },
        undo: () => {
          void (baseline === null ? docs.remove(rel) : docs.write(rel, baseline, {}));
        }
      });
    }
  };
}
