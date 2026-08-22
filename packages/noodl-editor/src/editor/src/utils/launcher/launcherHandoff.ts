/**
 * NAT-012 AC3 — what the editor remembers while you are away at the launcher.
 *
 * ## 🔴 The ruling this implements, and the criterion it replaces
 *
 * AC3 was written as *"going from the rail panel to the launcher home does not lose your project
 * or your place"*. Reading `router.tsx:154–210` showed that the editor and the launcher are two
 * routes in **one window**, and routing to `'projects'` **disposes the ProjectModel** — so there
 * was never a "go and come back", only "close the project". The only caller is `exitEditor`
 * (`EditorPage.tsx:176`), which also broadcasts `project-closed` and closes the viewer window.
 *
 * Richard ruled on 2026-08-22: **accept the close and pay for it in honesty.** Not a keep-flag
 * through the dispose branch — those twenty lines already carry a fixed white-screen bug (a
 * project → project route nulling the project that had just loaded) and are the most dangerous
 * in the file. So *"does not lose your project"* is false **by decision**, the control says so
 * before it acts, and *"does not lose your place"* survives as a **restore** obligation, which is
 * this module.
 *
 * ## ⚠️ Two facts, one gesture, and the bound on each
 *
 * 1. **Where the launcher should land.** Consumed once, by `ProjectsPage`, as `initialTab`.
 * 2. **Which component you were on**, per project id. Consumed once, on the next open of *that*
 *    project.
 *
 * 🔴 **Module state, deliberately — not `localStorage`.** The route swap is a React `setState` in
 * the same renderer, so a module variable survives it; the whole span this has to cover is one
 * editor session. Persisting it would be worse in two specific ways, not merely unnecessary:
 *
 * - `usePersistentTab` **writes** `noodl-launcher-active-tab` and no longer **reads** it, because
 *   FIX-025 removed the restore after Richard asked twice for the launcher to open on Projects.
 *   A landing page read from disk at startup is that defect, rebuilt. This one is set by a click
 *   that happened seconds ago and cleared by the read.
 * - Opening a project already writes three files into it. A remembered canvas position is not
 *   worth a fourth, and it must never reach `project.json` — see `componentIdentity.ts`, which
 *   refuses to persist for the same family of reasons.
 *
 * ## 🔴 The place is keyed by NAME, and that is the trap worth stating
 *
 * The reopened project is a **different `ProjectModel` object** with different `ComponentModel`
 * objects, so `componentInstanceId`'s `WeakMap` cannot answer this — it is explicitly scoped to
 * *"is this the same model object"*, within one load. The only key that survives a dispose is the
 * component **name**, which is what `getComponentWithName` takes and what `ProjectMerge` keys by.
 *
 * ⚠️ **A rename while you are away therefore misses**, and missing is the correct behaviour: the
 * resolve returns nothing and the canvas opens where it always did. The failure mode this avoids
 * is the one worth avoiding — restoring the *wrong* component because a stale key matched.
 *
 * ## Why this file imports nothing
 *
 * The gesture needs `App`, `ProjectModel` and `NodeGraphContextTmp`; this half needs none of them,
 * and keeping it import-free is what lets this repo's jest grade it directly. The half that needs
 * the models is `leaveForLauncher.ts` beside it.
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

/** Where the last known-open component lived, keyed by `ProjectModel.id`. */
const places = new Map<string, string>();

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

/**
 * Remember which component was open in `projectId`.
 *
 * ⚠️ An empty or missing name **clears** the entry rather than storing a falsy key: leaving with
 * no component open is a real state (the canvas opens with none), and a stale name left behind for
 * it would restore a component the reader had navigated away from.
 */
export function rememberEditorPlace(projectId: string | undefined, componentName: string | undefined): void {
  if (!projectId) return;

  if (!componentName) {
    places.delete(projectId);
    return;
  }

  places.set(projectId, componentName);
}

/**
 * Claim the remembered component name for `projectId`, once.
 *
 * Consumed for the same reason the landing is: reopening the project a second time, having since
 * navigated somewhere else in it, must not drag the reader back to where they were two opens ago.
 */
export function takeEditorPlace(projectId: string | undefined): string | undefined {
  if (!projectId) return undefined;

  const name = places.get(projectId);
  places.delete(projectId);
  return name;
}

/** Test-only: drop everything, so one spec's stash cannot leak into the next. */
export function resetLauncherHandoff(): void {
  pendingLanding = undefined;
  places.clear();
}
