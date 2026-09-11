/**
 * NAT-012 AC3 — where the launcher lands when a door in the editor sends you there.
 *
 * ## 🔴 The ruling this implements, and the criterion it replaces
 *
 * AC3 was written as *"going from the rail panel to the launcher home does not lose your project
 * or your place"*. Reading `router.tsx:154–210` showed that the editor and the launcher are two
 * routes in **one window**, and routing to `'projects'` **disposes the ProjectModel** — so there
 * was never a "go and come back", only "close the project". The only caller is `exitEditor`
 * (`EditorPage.tsx:176`), which also broadcasts `project-closed` and closes the viewer window.
 *
 * Richard ruled on 2026-08-22: **accept the close and pay for it in honesty.** So *"does not lose
 * your project"* is false **by decision** and the control says so before it acts.
 *
 * ## 🔴 *"Does not lose your place"* is somebody else's job, and always was — DRIVEN 2026-08-22
 *
 * This module briefly carried a second half: a per-project map of the component you were on, read
 * back by a `restoreEditorPlace` call in the node graph's bootstrap. **The drive deleted it**, and
 * the reason is worth keeping because the specs could not have found it:
 *
 * - `EditorDocument.tsx:401` writes `selectedComponentName` into `EditorSettings` on **every**
 *   `activeComponentChanged`, keyed by the same `ProjectModel.id`; `EditorDocument.tsx:432` reads
 *   it back on open, resolves it with the same `getComponentWithName`, and applies it with the
 *   same `replaceHistory: true`. It predates this task, it **persists to `editorSettings.json`**
 *   so it survives an editor restart, and it covers *every* exit route rather than this one door.
 * - The copy that lived here **never once affected what the reader saw**. Instrumenting
 *   `switchToComponent` showed two calls on every open, in this order: `restoreEditorPlace` →
 *   the stashed name, then **`useSwitchToDefaultComponent` (`UseSetupNodeGraph.ts:26`) → the
 *   default, unconditionally**. The second always won. Starving the real mechanism (clearing
 *   `selectedComponentName`) and leaving the stash intact opened the canvas on the *default*,
 *   which is the arm that proved it.
 * - ⚠️ Its spec asserted the **source text** `restoreEditorPlace(currentInstance);` was present.
 *   That passes on dead code. Mechanism checked, consequence not — which is exactly why AC3 says
 *   the claim is driven.
 *
 * So AC3's restore obligation holds, and nothing in this file delivers it. What is left here is
 * the one fact nothing else knows.
 *
 * ## ⚠️ One fact, and the bound on it
 *
 * **Where the launcher should land.** Consumed once, by `ProjectsPage`, as `initialTab`.
 *
 * 🔴 **Module state, deliberately — not `localStorage`.** The route swap is a React `setState` in
 * the same renderer, so a module variable survives it; the whole span this has to cover is one
 * editor session. Persisting it would be worse rather than merely unnecessary:
 * `usePersistentTab` **writes** `noodl-launcher-active-tab` and no longer **reads** it, because
 * FIX-025 removed the restore after Richard asked twice for the launcher to open on Projects. A
 * landing page read from disk at startup is that defect, rebuilt. This one is set by a click that
 * happened seconds ago and cleared by the read.
 *
 * ## Why this file imports nothing
 *
 * The gesture needs `App` and `ProjectModel`; this half needs neither, and keeping it import-free
 * is what lets this repo's jest grade it directly. The half that needs the models is
 * `leaveForLauncher.ts` beside it.
 *
 * @module noodl-editor/utils/launcher/launcherHandoff
 */

/**
 * The launcher pages a hand-off may ask for.
 *
 * ⚠️ A **narrow** union rather than core-ui's `LauncherPageId`: importing that would pull a
 * preview-tree module into a utility for no gain, and this list is what an in-editor door can
 * honestly ask for. `isValidPageId` remains the guard for anything arriving as a *stored string*
 * — this value never leaves memory, so it cannot arrive from outside the session.
 */
export type LauncherLandingPage = 'projects' | 'community' | 'learning';

let pendingLanding: LauncherLandingPage | undefined;

/**
 * Ask the launcher to open on `page` the next time it mounts.
 *
 * ⚠️ Stashing does not navigate — {@link leaveForLauncher} does, after this. The two are separate
 * so a caller cannot half-perform the gesture: a stash with no route change is a no-op that the
 * next read clears, not a launcher stuck on the wrong tab.
 */
export function stashLauncherLanding(page: LauncherLandingPage): void {
  pendingLanding = page;
}

/**
 * Claim the landing page, once.
 *
 * 🔴 **Consumed on read**, which is the line between this and the key FIX-025 stopped consulting.
 * A second mount of the launcher — closing another project, an HMR reload — gets `undefined` and
 * lands on Projects, because by then nobody asked for anything else.
 */
export function takeLauncherLanding(): LauncherLandingPage | undefined {
  const landing = pendingLanding;
  pendingLanding = undefined;
  return landing;
}

let pendingLessonReset: string | undefined;

/**
 * Ask the launcher to reset a lesson once the project it belongs to is **closed**.
 *
 * ───────────────────────────────────────────────────────────────────────────────
 * 🔴 FIX-027 §20 — WHY *START AGAIN* CANNOT RESET FROM INSIDE THE LESSON.
 *
 * `LearningFolderModel.repairFrom` deletes `Learning/<slug>/` and copies a fresh bundle over
 * it. At the completion moment that directory is **the open project**: `ProjectModel.instance`
 * holds the whole graph in memory and saves it back to those files. Reset it in place and the
 * live model is the newer writer — it either puts the learner's finished work straight back
 * over the fresh copy, or interleaves with the copy and leaves neither. The learner pressed a
 * button labelled *Start again* and got a corrupted lesson.
 *
 * ✅ So the gesture is: decide, close, **then** reset. `App.exitProject` routes to `'projects'`,
 * which disposes the ProjectModel; the launcher mounts with nothing holding the directory and
 * performs the reset there. This is the same one-fact-in-memory hand-off as
 * {@link stashLauncherLanding} above and for the same reason — the span is one editor session,
 * the setter is a click that happened seconds ago, and the read clears it.
 *
 * ⚠️ **Stashing is not deciding.** The caller has already asked
 * `LearningFolderModel.canReset` and already confirmed with the learner, because a refusal or a
 * change of mind *after* they have been thrown out of the lesson is not a graceful refusal. The
 * register still re-checks before it deletes anything; that rule is `reset`'s and stays there.
 */
export function stashLessonReset(lessonId: string): void {
  pendingLessonReset = lessonId;
}

/**
 * Claim the lesson to reset, once.
 *
 * 🔴 **Consumed on read**, exactly as {@link takeLauncherLanding} is: a second mount of the
 * launcher must not reset the lesson again. Resetting is destructive, so "at most once per
 * request" is a safety property here and not only tidiness.
 */
export function takeLessonReset(): string | undefined {
  const id = pendingLessonReset;
  pendingLessonReset = undefined;
  return id;
}

/** Test-only: drop the stash, so one spec's request cannot leak into the next. */
export function resetLauncherHandoff(): void {
  pendingLanding = undefined;
  pendingLessonReset = undefined;
}
