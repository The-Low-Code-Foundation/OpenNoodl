/**
 * NAT-012 AC3 — the gesture: leave the editor for a launcher page.
 *
 * The half of the hand-off that needs the editor's models. The remembering itself is
 * `launcherHandoff.ts` beside this, which imports nothing so that jest can grade it directly.
 *
 * 🔴 **This closes the project, and that is the ruling, not an oversight** — see
 * `launcherHandoff.ts` for why AC3's original wording could not be met and what replaced it. Any
 * control calling {@link leaveForLauncher} therefore has to *say* it closes the project. That
 * obligation cannot be enforced from here, so it is asserted where the control is drawn.
 *
 * ⚠️ **Nothing here remembers the canvas.** A `rememberEditorPlace` / `restoreEditorPlace` pair
 * lived here until the AC3 drive on 2026-08-22 showed it never affected what the reader saw:
 * `EditorDocument.tsx:401/432` has always persisted `selectedComponentName` per project and
 * restored it on open, and `useSwitchToDefaultComponent` (`UseSetupNodeGraph.ts:26`) overwrote
 * this module's restore on every single open. The obligation is met; it is met there.
 *
 * @module noodl-editor/utils/launcher/leaveForLauncher
 */

import { App } from '@noodl-models/app';

import { LauncherLandingPage, stashLauncherLanding } from './launcherHandoff';

/**
 * Close the project and open the launcher on `page`.
 *
 * ⚠️ **Order matters and the reason is `exitProject`'s.** It notifies `'exitEditor'` synchronously,
 * which routes and disposes the ProjectModel — so the stash has to happen *before* it, or
 * `ProjectsPage` mounts and reads an empty one.
 */
export function leaveForLauncher(page: LauncherLandingPage): void {
  stashLauncherLanding(page);

  App.instance.exitProject();
}
