/**
 * BLD-006 — the boot wiring that gives `ThreadStore` a disk.
 *
 * The same two translations `installPlanSessionPersistence` exists for, for the
 * same two reasons.
 *
 * **Key.** The store is keyed by project *id*, because that is what survives a
 * project being closed and reopened. The sidecar is keyed by project
 * *directory*, because that is where the files go. Only the editor knows both,
 * and only for the project that is open.
 *
 * **Weight.** `ThreadStore` runs in the plain-Node runner with no Electron and
 * no `ProjectModel`. Importing either into it would end that, and the specs are
 * the ones that pin what a switch is allowed to destroy.
 *
 * ## The flush that was built and never called
 *
 * ⚠️ `PlanSessionSidecar.flush()` was written for the quit path in AIB-003
 * slice 4 — its header says so — and **nothing in the editor ever called it**.
 * The renderer already has a quit handshake (`flush-project-save`, added after
 * the one-second-quit data-loss defect), so both sidecars are drained from it
 * now. Wiring only the new one would have been the same defect with a fresh
 * date on it.
 *
 * @module AiAssistant/thread/installThreadPersistence
 */

import { PlanSessionSidecar } from '../authoring/PlanSessionSidecar';
import { InterviewSidecar } from '../review/InterviewSidecar';
import { ProjectModel } from '../../projectmodel';
import { ThreadSidecar } from './ThreadSidecar';
import { ThreadStore } from './ThreadStore';
import type { ThreadRecord } from './threadRecord';

/**
 * The directory to persist this project's threads to.
 *
 * Resolved per call rather than captured, because the open project changes
 * under this module and a captured directory would write one project's
 * conversations into another's folder.
 */
function directoryFor(projectId: string | undefined): string | undefined {
  const project = ProjectModel.instance;
  if (!project || project.id !== projectId) return undefined;
  return project._retainedProjectDirectory;
}

export function installThreadPersistence(sidecar = ThreadSidecar.instance): void {
  ThreadStore.instance.attachPersistence({
    save(projectId: string | undefined, thread: ThreadRecord): void {
      const directory = directoryFor(projectId);
      if (directory) sidecar.write(directory, thread);
    }
  });
}

/**
 * Drain every AI sidecar before the process goes away.
 *
 * Resolves rather than rejects on failure, for the reason
 * `flushPendingProjectSave` gives: the caller is on its way out, and a
 * rejection here would risk wedging the quit it was added to protect.
 */
export async function flushAiSidecars(
  threads = ThreadSidecar.instance,
  plans = PlanSessionSidecar.instance,
  /**
   * BLD-008. Added here on the day the sidecar was written, not "later" — the
   * whole finding this handshake exists to close is that a flush wired later is
   * a flush that never gets wired.
   */
  interviews = InterviewSidecar.instance
): Promise<void> {
  await Promise.all([
    threads.flush().catch((error) => console.warn('Could not flush AI conversations on exit:', error)),
    plans.flush().catch((error) => console.warn('Could not flush the saved AI build on exit:', error)),
    interviews.flush().catch((error) => console.warn('Could not flush the docs interview on exit:', error))
  ]);
}
