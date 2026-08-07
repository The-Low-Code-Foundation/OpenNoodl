/**
 * AIB-003 slice 4 — the boot wiring that gives `PlanSessionStore` a disk.
 *
 * Two things need translating between the store and the sidecar, and both are
 * the reason this is a module rather than an import inside the store.
 *
 * **Key.** The store is keyed by project *id*, because that is what survives a
 * project being closed and reopened. The sidecar is keyed by project
 * *directory*, because that is where the file goes. Only the editor knows both,
 * and only for the project that is open — a session held for a project that is
 * not open has no directory to write to, and is left in memory where slices 1–3
 * put it.
 *
 * **Weight.** The store is exercised in the plain-Node runner with no Electron,
 * no filesystem and no `ProjectModel`. Importing either of those into it would
 * end that, and the tests for slices 1–2 are the ones that pin who is allowed to
 * destroy authored output.
 *
 * Installed at boot from `router.setup.ts`, alongside `installProjectDocs` — for
 * the same reason given there: a run can be publishing staged candidates long
 * before anyone opens the Build panel, and a wiring that waits for a mount is a
 * wiring that misses exactly the case this task is about.
 *
 * @module AiAssistant/authoring/installPlanSessionPersistence
 */

import { ProjectModel } from '../../projectmodel';
import { PlanSessionSidecar } from './PlanSessionSidecar';
import type { PlanSessionSnapshot } from './planSessionSnapshot';
import { PlanSessionStore } from './PlanSessionStore';

/**
 * The directory to persist this project's session to.
 *
 * Resolved per call rather than captured, because the open project changes under
 * this module and a captured directory would write one project's build into
 * another's folder. Returns undefined for a session that is not the open
 * project's, and for an open project that has never been saved to disk.
 */
function directoryFor(projectId: string | undefined): string | undefined {
  const project = ProjectModel.instance;
  if (!project || project.id !== projectId) return undefined;
  return project._retainedProjectDirectory;
}

export function installPlanSessionPersistence(sidecar = PlanSessionSidecar.instance): void {
  PlanSessionStore.instance.attachPersistence({
    save(projectId: string | undefined, snapshot: PlanSessionSnapshot): void {
      const directory = directoryFor(projectId);
      if (directory) sidecar.write(directory, snapshot);
    },
    remove(projectId: string | undefined): void {
      const directory = directoryFor(projectId);
      if (directory) sidecar.remove(directory);
    }
  });
}
