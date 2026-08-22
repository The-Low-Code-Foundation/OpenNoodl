/**
 * NAT-012 AC3 — the gesture: leave the editor for a launcher page, and come back where you were.
 *
 * The half of the hand-off that needs the editor's models. The remembering itself is
 * `launcherHandoff.ts` beside this, which imports nothing so that jest can grade it directly;
 * everything here is wiring those facts to `App`, `ProjectModel` and the canvas.
 *
 * 🔴 **This closes the project, and that is the ruling, not an oversight** — see
 * `launcherHandoff.ts` for why AC3's original wording could not be met and what replaced it. Any
 * control calling {@link leaveForLauncher} therefore has to *say* it closes the project. That
 * obligation cannot be enforced from here, so it is asserted where the control is drawn.
 *
 * @module noodl-editor/utils/launcher/leaveForLauncher
 */

import { NodeGraphContextTmp } from '@noodl-contexts/NodeGraphContext/NodeGraphContext';
import { App } from '@noodl-models/app';
import { ProjectModel } from '@noodl-models/projectmodel';

import type { NodeGraphEditor } from '../../views/nodegrapheditor';
import { LauncherLandingPage, rememberEditorPlace, stashLauncherLanding, takeEditorPlace } from './launcherHandoff';

/**
 * Close the project and open the launcher on `page`, remembering the component on the canvas.
 *
 * ⚠️ **Order matters and the reason is `exitProject`'s.** It notifies `'exitEditor'` synchronously,
 * which routes and disposes the ProjectModel — so both reads have to happen *before* it. Reading
 * the project id afterwards gets `undefined` (the router nulls the singleton on the next tick, but
 * `args.project` is already gone), and reading the canvas afterwards gets a disposed graph.
 */
export function leaveForLauncher(page: LauncherLandingPage): void {
  rememberEditorPlace(ProjectModel.instance?.id, NodeGraphContextTmp.nodeGraph?.activeComponent?.name);
  stashLauncherLanding(page);

  App.instance.exitProject();
}

/**
 * Put the canvas back on the component this project was left on, if it was left on one.
 *
 * Called once, from the node graph's own bootstrap. Every branch is a no-op except the one where
 * a place was stashed *and* the name still resolves:
 *
 * - nothing stashed — the ordinary open, which has always started with no active component;
 * - 🔴 **stashed but unresolvable** — the component was renamed or deleted while the reader was at
 *   the launcher. `getComponentWithName` answers nothing and the canvas opens as it always did.
 *   Restoring *something* here (the first component, the root) would be a worse answer than none:
 *   it would look like a restore and be a guess.
 *
 * ⚠️ `replaceHistory` rather than `pushHistory` — the restored component is where this session of
 * the project *starts*, so back should not walk to a blank canvas that was never really shown.
 */
export function restoreEditorPlace(nodeGraph: NodeGraphEditor | null | undefined): void {
  if (!nodeGraph) return;

  const project = ProjectModel.instance;
  const name = takeEditorPlace(project?.id);
  if (!project || !name) return;

  const component = project.getComponentWithName(name);
  if (!component) return;

  nodeGraph.switchToComponent(component, { replaceHistory: true });
}
