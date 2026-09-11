/**
 * FIX-027 §20 — which of the two ways to put a lesson back to its starting state.
 *
 * ## Why this is a module and not four lines in the launcher
 *
 * There are two resets. A **local** lesson is repaired from the bundle directory it was
 * installed from, synchronously, by `LearningFolderModel.reset`. A **platform** lesson has to be
 * fetched again first, which is asynchronous and needs a client, and is
 * `lessonplatforminstall.resetLessonFromPlatform`.
 *
 * 🔴 **The second one existed for a whole phase with no caller.** `canReset` refused every
 * platform lesson because it is synchronous and has no network; `models/community/tutorialsview.ts`
 * said resetting was "the Learning section's business"; and the Learning section called the
 * method that refused. Each surface pointed at the other, and no lesson was ever re-pulled. The
 * function that could do it was specced in two files and imported by nothing.
 *
 * That is a *routing* mistake, and routing is exactly the kind of thing that rots unseen when it
 * lives inside a page component — `ProjectsPage.tsx` needs Electron, a router and a live
 * register, so nothing grades it. So the choice is here, taking its two arms as injected
 * functions, and `tests-unit/fix-027/lessonreset.test.ts` asserts which one runs. The launcher
 * keeps only the wiring: a client, a staging directory, and a toast.
 *
 * ⚠️ **This decides a route, never a permission.** Both arms re-check before they delete
 * anything — that rule belongs to `reset`/`resetFrom` and stays there, because the bundle can
 * disappear between the question and the act.
 *
 * @module noodl-editor/models/lessonreset
 */

import type { ResetAvailability, ResetLessonOutcome } from './learningfolder';

/** The register, narrowed to the two questions this asks it. */
export interface LessonResetRegister {
  canReset(id: string): ResetAvailability;
  reset(id: string): ResetLessonOutcome;
}

export interface LessonResetDeps {
  register: LessonResetRegister;
  /**
   * Re-pull from the platform. Called **only** for the `'needs-network'` arm.
   *
   * ⚠️ Injected rather than imported so this decision can be graded without a network, a
   * `CommunityApiClient` or a staging directory — and so a spec can prove the local arm does
   * **not** reach for one, which is the half a fake client would quietly hide.
   */
  repull(id: string): Promise<ResetLessonOutcome>;
}

/**
 * Put a lesson back to its starting state, by whichever route its source needs.
 *
 * 🔴 Dispatches on `'needs-network'` **specifically**, not on "is it not available". A refusal
 * the register has already written a sentence for must come back through `reset`, so the learner
 * reads the register's own words rather than a network error about a lesson that never went near
 * the network.
 */
export async function resetLesson(id: string, deps: LessonResetDeps): Promise<ResetLessonOutcome> {
  if (deps.register.canReset(id).result !== 'needs-network') {
    return deps.register.reset(id);
  }
  return deps.repull(id);
}
