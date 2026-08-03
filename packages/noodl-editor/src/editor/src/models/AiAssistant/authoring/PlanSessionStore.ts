/**
 * AIB-003 — a build survives navigation.
 *
 * `ProjectAuthoringView` held the plan, the run and every staged candidate in
 * component-local `useState`, with an unmount cleanup that called
 * `runRef.current?.dispose()`. The Build panel *conditionally renders* it, so
 * switching the scope toggle to "This component" unmounted it and destroyed all
 * of it — three components' worth of authored, validated, staged output, gone to
 * a tab click, with no way back because the launcher handover had already been
 * consumed destructively on first mount.
 *
 * The rule this phase adopts is that **authored output is durable from the
 * moment it validates, and no navigation, failure, or restart may destroy it
 * without the user saying so**. This store is the smallest thing that makes the
 * first two true. It does not weaken the transaction property one bit: nothing
 * here touches a `ProjectModel`, and `applyAuthoredPlan` is still the only code
 * that moves a plan into a project.
 *
 * ## Why a store rather than hoisting into the panel
 *
 * Hoisting into `AiAuthoringPanel` would survive the scope toggle and nothing
 * else. Sidebar panels are hidden rather than unmounted most of the time, but
 * "most of the time" is exactly the kind of lifetime guarantee that turns into a
 * data-loss bug two refactors later. `ProjectReviewStore` already solves this
 * shape for project review, and this is deliberately the same shape rather than
 * a new mechanism.
 *
 * ## Keyed by project
 *
 * Two acceptance criteria pull against each other — a plan must survive
 * switching projects and back (3), and a run must not leak past a project close
 * (4). They resolve cleanly once you separate the two things a run is: on
 * `ProjectModel.instanceWillChange` the departing project's run is **cancelled**
 * (nothing keeps authoring against a project that is gone) and its staged
 * output is **kept** (it is expensive, it is valid, and the user did not ask to
 * lose it). A run cancelled this way keeps whatever it had already staged, which
 * is the phase rule applied to itself.
 *
 * Entries are never evicted by age or count. A session opens a handful of
 * projects, and quietly dropping an authored candidate to save a few hundred
 * kilobytes is the defect this module exists to remove.
 *
 * @module AiAssistant/authoring/PlanSessionStore
 */

import Model from '../../../../../shared/model';
import { EventDispatcher } from '../../../../../shared/utils/EventDispatcher';
import type { AuthoringPlan } from './plan';
import type { PlanRun } from './PlanRun';
import type { PlanSessionSnapshot } from './planSessionSnapshot';
import { isWorthPersisting, snapshotSession } from './planSessionSnapshot';

export const PLAN_SESSION_CHANGED = 'planSessionChanged';

/**
 * AIB-003 slice 4 — where a session goes so it survives the process.
 *
 * Injected rather than imported, and `null` by default, so this store keeps the
 * property that made slices 1–2 testable at all: it is a plain model that can be
 * exercised in a plain-Node runner with no filesystem, no Electron and no
 * project on disk. The editor attaches the real one at boot
 * (`installPlanSessionPersistence`); a spec attaches a recording fake.
 *
 * Both methods are fire-and-forget on purpose. A store update happens on a
 * keystroke and inside a `PlanRun` publish; neither can wait on a disk, and
 * neither has anywhere to report a failure to. The implementation debounces,
 * queues and swallows — see `PlanSessionSidecar`.
 */
export interface PlanSessionPersistence {
  save(projectId: string | undefined, snapshot: PlanSessionSnapshot): void;
  remove(projectId: string | undefined): void;
}

/** Which operation an apply failure was about, and why — see AIB-001 slice 4. */
export interface PlanApplyFailure {
  id: string;
  target: string;
  reason: string;
}

export interface PlanSessionNote {
  text: string;
  /**
   * The `FeedbackType` values, spelled out rather than imported: this is a
   * model, and the set is three strings that have not changed in the life of
   * the codebase. The view narrows it back to the enum in one place.
   */
  type: 'success' | 'notice' | 'danger';
}

/**
 * Everything the Build panel's Project scope has that is worth more than a
 * re-render — the plan, what has been authored from it, and the user's
 * decisions about it.
 *
 * Deliberately excludes the transient: which dialog is open, whether a button
 * says "Re-authoring…". Those are re-derived on mount and would only be one
 * more thing to keep in sync.
 */
export interface PlanSession {
  /** The Plan-it box. A half-typed request is work too. */
  description: string;
  plan: AuthoringPlan | null;
  note: PlanSessionNote | null;
  /** Operations the user excluded, dependency-closed. */
  excluded: ReadonlySet<string>;
  applied: {
    count: number;
    docs: string[];
    /** AIB-007 — the backend this apply provisioned, when it provisioned one. */
    backend?: { name: string; endpoint: string; collections: string[]; warnings: string[] };
    /**
     * AIB-007 — nodes that were applied and have no backend to talk to.
     *
     * The reachable case is a user who dropped the provision operation and kept
     * the pages that needed it. That is a decision to respect (the graphs are
     * valid, and the diagnostic is a warning for exactly that reason) — but not
     * one to make silently.
     */
    missingBackend?: string[];
  } | null;
  applyFailure: PlanApplyFailure | null;
  /**
   * The live run, holding every staged `ComponentFiles`. Null before authoring
   * starts and after the plan is applied or abandoned.
   */
  run: PlanRun | null;
  /**
   * AIB-005 — where this plan came from. `'scoping'` means the user agreed it in
   * the launcher's wizard minutes ago and has not seen it since, which is the
   * one case that earns an announcement outside the Build panel. A plan the user
   * typed into the panel needs no announcement: they are looking at it.
   */
  origin: 'scoping' | null;
  /** AIB-005 — the canvas announcement has been dismissed. Never the plan. */
  announcementDismissed: boolean;
}

function emptySession(): PlanSession {
  return {
    description: '',
    plan: null,
    note: null,
    excluded: new Set(),
    applied: null,
    applyFailure: null,
    run: null,
    origin: null,
    announcementDismissed: false
  };
}

/** The key for a project with no id yet — an unsaved project still has a session. */
const UNSAVED = '__unsaved__';

export class PlanSessionStore extends Model {
  static instance = new PlanSessionStore();

  private readonly sessions = new Map<string, PlanSession>();
  private wired = false;

  /** AIB-003 slice 4. Null until the editor attaches one; see the interface. */
  private persistence: PlanSessionPersistence | null = null;
  /**
   * How we stop listening to the run we are currently persisting, by project.
   *
   * A `PlanRun` publishes on its own listeners, not through this store, so a
   * staged candidate never reaches `update()` — which meant the one thing slice
   * 4 exists to save was the one thing a store-side hook would have missed. The
   * store subscribes because it is the only thing that holds a session for
   * longer than a mount: the view unsubscribes on a tab click, which is where
   * this whole task started.
   */
  private readonly runSubscriptions = new Map<string, () => void>();

  /**
   * AIB-003 slice 4 — projects whose saved build has already been looked for,
   * by the promise that looked.
   *
   * Live QA found the defect this exists to close, and it made `Discard plan` do
   * nothing at all. Discarding empties the session, the panel's restore effect
   * watches exactly that emptiness, and it re-read the file and put the whole
   * build back — same plan, same note, same staged candidate. The file was then
   * deleted by the discard's own (debounced) removal, so disk and memory
   * disagreed and the next keystroke wrote it back out. From the user's side:
   * they pressed Discard and the plan did not go away.
   *
   * A boolean would have been enough for that, but not for the mount: a promise
   * makes the check happen **once** even when two mounts race it, and means a
   * view that unmounts mid-read does not leave a project permanently marked
   * "checked" with nothing restored.
   *
   * Deliberately **not** cleared by `discard`. That is the fix. It is also not
   * cleared when a project closes: the user's "no" outlives the panel, and a
   * build they threw away must not reappear because they switched projects and
   * came back.
   */
  private readonly savedBuildChecks = new Map<string, Promise<void>>();

  /**
   * The session for a project, created empty on first ask.
   *
   * Returns the live object rather than a copy: the panel reads it during
   * render, and a store that reallocated on every read would defeat the
   * `useState` initialisers that seed from it.
   */
  get(projectId: string | undefined): PlanSession {
    this.wire();
    const key = projectId ?? UNSAVED;
    let session = this.sessions.get(key);
    if (!session) {
      session = emptySession();
      this.sessions.set(key, session);
    }
    return session;
  }

  /** Merge a patch into a project's session and tell every subscriber. */
  update(projectId: string | undefined, patch: Partial<PlanSession>): PlanSession {
    const previous = this.get(projectId);
    const session = { ...previous, ...patch };
    this.sessions.set(projectId ?? UNSAVED, session);
    if (session.run !== previous.run) this.followRun(projectId, session.run);
    this.notifyListeners(PLAN_SESSION_CHANGED, { projectId, session });
    this.persist(projectId, session);
    return session;
  }

  /**
   * Throw the session away — the user's explicit Abandon, or a successful
   * apply, which are the only two things allowed to destroy authored output.
   *
   * Disposes the run, because a discarded run has nobody left to publish to.
   */
  discard(projectId: string | undefined): void {
    const session = this.sessions.get(projectId ?? UNSAVED);
    session?.run?.dispose();
    this.followRun(projectId, null);
    this.sessions.set(projectId ?? UNSAVED, emptySession());
    this.notifyListeners(PLAN_SESSION_CHANGED, { projectId, session: this.sessions.get(projectId ?? UNSAVED) });
    // AIB-003 slice 4. The file goes with the session, and both of the callers
    // that get here — the user's Abandon, and a successful apply — are the user
    // saying so. Recovering a build that is already in the project would offer
    // to re-apply work that has been applied.
    this.persistence?.remove(projectId);
  }

  /**
   * AIB-003 slice 4 — run `check` for a saved build at most once per project.
   *
   * The caller supplies the check because reading the sidecar needs a project
   * directory and restoring needs a graph, and this store has neither. What it
   * owns is the *question of whether to ask again*, because that outlives every
   * mount — see {@link savedBuildChecks} for the defect that proves it has to.
   */
  consultSavedBuild(projectId: string | undefined, check: () => Promise<void>): Promise<void> {
    const key = projectId ?? UNSAVED;
    let pending = this.savedBuildChecks.get(key);
    if (!pending) {
      // A failed check counts as asked. Retrying it on every re-render would
      // mean a project with an unreadable sidecar re-reading it forever.
      pending = check().catch((error) => {
        console.warn('Could not consult the saved AI build:', error);
      });
      this.savedBuildChecks.set(key, pending);
    }
    return pending;
  }

  /** AIB-003 slice 4 — the editor's disk-backed persistence, attached at boot. */
  attachPersistence(persistence: PlanSessionPersistence | null): void {
    this.persistence = persistence;
    // Boot order is not something this store gets to assume. If anything is
    // already running when persistence arrives, pick it up rather than
    // persisting every session except the one in flight.
    for (const [key, session] of this.sessions) {
      this.followRun(key === UNSAVED ? undefined : key, session.run);
    }
  }

  /**
   * Seed a project's session from a snapshot read off disk.
   *
   * Separate from `update` because it must not write back what it just read: the
   * only thing that could go wrong here is a restore that immediately re-persists
   * a normalised copy of the file, and then does it again next launch. It is also
   * the honest signature — a restore replaces a session, it does not patch one.
   */
  restore(projectId: string | undefined, session: PlanSession): PlanSession {
    this.get(projectId);
    this.sessions.set(projectId ?? UNSAVED, session);
    this.followRun(projectId, session.run);
    this.notifyListeners(PLAN_SESSION_CHANGED, { projectId, session });
    return session;
  }

  /**
   * Persist, or delete — a session that is not worth persisting must actively
   * remove whatever the last one wrote, or Abandon-then-type would leave the
   * abandoned plan on disk to be offered again next launch.
   */
  private persist(projectId: string | undefined, session: PlanSession): void {
    if (!this.persistence) return;
    if (isWorthPersisting(session)) {
      this.persistence.save(projectId, snapshotSession(session, new Date().toISOString()));
    } else {
      this.persistence.remove(projectId);
    }
  }

  /**
   * Subscribe to a session's run so its staged candidates reach the disk.
   *
   * Unsubscribing first matters: a project that starts a second run would
   * otherwise keep persisting on behalf of the first, which is a listener on a
   * disposed object writing a session it is no longer part of.
   */
  private followRun(projectId: string | undefined, run: PlanRun | null): void {
    const key = projectId ?? UNSAVED;
    this.runSubscriptions.get(key)?.();
    this.runSubscriptions.delete(key);
    if (!run || !this.persistence) return;
    this.runSubscriptions.set(
      key,
      run.onChange(() => this.persist(projectId, this.get(projectId)))
    );
  }

  /**
   * The departing project's run stops authoring; everything it staged stays.
   *
   * `cancel()` and not `dispose()`: disposal clears the run's listeners AND is
   * the panel's signal that the object is finished with, whereas this run may
   * well be looked at again when the user comes back to the project. What must
   * not happen is a session continuing to spend money on a project nobody has
   * open.
   */
  private cancelRunsForClosingProject(): void {
    for (const session of this.sessions.values()) {
      session.run?.cancel();
    }
    this.notifyListeners(PLAN_SESSION_CHANGED, {});
  }

  /**
   * Subscribed lazily, from `get`, so importing this module has no side effect
   * and a test can exercise the store without an `EventDispatcher` at all.
   */
  private wire(): void {
    if (this.wired) return;
    this.wired = true;
    EventDispatcher.instance.on(
      'ProjectModel.instanceWillChange',
      () => this.cancelRunsForClosingProject(),
      // A singleton's subscription lives as long as the singleton.
      this
    );
  }
}
