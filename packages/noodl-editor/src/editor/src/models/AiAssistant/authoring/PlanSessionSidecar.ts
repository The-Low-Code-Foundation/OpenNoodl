/**
 * AIB-003 slice 4 — the unapplied build, on disk.
 *
 * `<project>/.nodegx/plan/session.json`. One file per project, because
 * `PlanSessionStore` holds one session per project: the task sketched
 * `.nodegx/plan/<planId>/` and there is no plan id anywhere in the model, so
 * inventing one would have bought a directory per plan for a store that can only
 * ever have the newest. (The phase has warned repeatedly that its own stated
 * mechanisms move; this is one of them.)
 *
 * ## What this is and is not
 *
 * It is scratch. It holds candidates that have passed the gate and reached
 * nobody's project, and it is deleted the moment they do — a successful apply
 * discards the session, and discarding removes the file. It is gitignored on
 * first write and excluded from the deploy walk, so nothing here can escape the
 * machine that authored it. The transaction property is untouched: this writes
 * JSON beside a project, never into one, and `applyAuthoredPlan` is still the
 * only code that moves a plan into a `ProjectModel`.
 *
 * ## Why the writes are debounced and queued
 *
 * The store notifies on every keystroke in the Plan-it box and on every
 * `PlanRun` publish — which is several a second while a turn streams. A staged
 * plan is tens of kilobytes of JSON. So writes coalesce on a trailing timer, and
 * the timer's callback is chained behind the previous write rather than racing
 * it, which is `CodeHistoryStore`'s answer to the same problem for the same
 * reason. The cost of the debounce is the last second of a run being lost to a
 * hard kill; the alternative is a write per token.
 *
 * A `flush()` is exposed for the one case where a second matters — the quit
 * path, which has already cost this project one data-loss defect (see the
 * 1-second-quit memory).
 *
 * @module AiAssistant/authoring/PlanSessionSidecar
 */

import { filesystem } from '@noodl/platform';

import { ensureSidecarDirectory, sidecarPath } from '../../../utils/nodegxSidecar';
import type { PlanSessionSnapshot } from './planSessionSnapshot';
import { parsePlanSessionSnapshot } from './planSessionSnapshot';

const PLAN_DIR = 'plan';
const SESSION_FILE = 'session.json';

/** Long enough to coalesce a burst of publishes, short enough to be there after a crash. */
const WRITE_DEBOUNCE_MS = 750;

/**
 * The seam `PlanSessionStore` writes through. A store with no persistence
 * attached behaves exactly as it did after slices 1–3, which is what keeps the
 * plain-Node tests free of a filesystem.
 */
export interface PlanSessionPersistence {
  read(projectDirectory: string): Promise<PlanSessionSnapshot | null>;
  write(projectDirectory: string, snapshot: PlanSessionSnapshot): void;
  remove(projectDirectory: string): void;
  flush(): Promise<void>;
}

export class PlanSessionSidecar implements PlanSessionPersistence {
  static instance = new PlanSessionSidecar();

  private pending = new Map<string, PlanSessionSnapshot | null>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private queue: Promise<unknown> = Promise.resolve();

  async read(projectDirectory: string): Promise<PlanSessionSnapshot | null> {
    const path = this.path(projectDirectory);
    if (!filesystem.exists(path)) return null;
    try {
      return parsePlanSessionSnapshot(await filesystem.readJson(path));
    } catch (error) {
      // A half-written file is the normal consequence of the crash this exists
      // to survive, and it must never be the reason a panel fails to open.
      console.warn('Could not read the saved AI build, starting without it:', error);
      return null;
    }
  }

  write(projectDirectory: string, snapshot: PlanSessionSnapshot): void {
    this.pending.set(projectDirectory, snapshot);
    this.schedule();
  }

  /**
   * Delete the file. `null` in `pending` rather than an immediate unlink so a
   * removal cannot be overtaken by a debounced write that was queued before it —
   * an Abandon followed by a stale write is the file coming back from the dead.
   */
  remove(projectDirectory: string): void {
    this.pending.set(projectDirectory, null);
    this.schedule();
  }

  /** Write everything outstanding now. For the quit path, and for tests. */
  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    this.drain();
    await this.queue;
  }

  private schedule(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.drain();
    }, WRITE_DEBOUNCE_MS);
  }

  /** Move everything pending onto the write chain, newest value per project. */
  private drain(): void {
    if (this.pending.size === 0) return;
    const batch = [...this.pending.entries()];
    this.pending.clear();
    for (const [directory, snapshot] of batch) {
      this.enqueue(() => (snapshot ? this.persist(directory, snapshot) : this.unlink(directory)));
    }
  }

  private enqueue(work: () => Promise<void>): void {
    // `.then(work, work)` keeps the chain running past a rejected link, the same
    // shape CodeHistoryStore uses: one unwritable project must not stop another.
    this.queue = this.queue.then(work, work).catch(() => undefined);
  }

  private async persist(projectDirectory: string, snapshot: PlanSessionSnapshot): Promise<void> {
    try {
      const directory = await ensureSidecarDirectory(projectDirectory, PLAN_DIR);
      if (!directory) return;
      await filesystem.writeJson(this.path(projectDirectory), snapshot);
    } catch (error) {
      // Losing the sidecar loses a restart's worth of recovery; throwing here
      // would reach a React state update in the panel. The in-memory session,
      // which is what the user is actually looking at, is unaffected either way.
      console.warn('Could not save the AI build for recovery:', error);
    }
  }

  private async unlink(projectDirectory: string): Promise<void> {
    const path = this.path(projectDirectory);
    if (!filesystem.exists(path)) return;
    try {
      await filesystem.removeFile(path);
    } catch (error) {
      console.warn('Could not remove the saved AI build:', error);
    }
  }

  private path(projectDirectory: string): string {
    return sidecarPath(projectDirectory, PLAN_DIR, SESSION_FILE);
  }
}
