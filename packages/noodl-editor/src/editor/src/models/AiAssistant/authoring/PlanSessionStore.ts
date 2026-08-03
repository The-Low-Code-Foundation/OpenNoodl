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

export const PLAN_SESSION_CHANGED = 'planSessionChanged';

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
    const session = { ...this.get(projectId), ...patch };
    this.sessions.set(projectId ?? UNSAVED, session);
    this.notifyListeners(PLAN_SESSION_CHANGED, { projectId, session });
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
    this.sessions.set(projectId ?? UNSAVED, emptySession());
    this.notifyListeners(PLAN_SESSION_CHANGED, { projectId, session: this.sessions.get(projectId ?? UNSAVED) });
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
