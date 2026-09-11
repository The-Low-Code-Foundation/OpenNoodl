/**
 * AIX-010 — the one place both panels look.
 *
 * The review is started from either the Build panel or the Docs panel, runs for
 * a minute or two, and its results are reviewed in the Docs panel as diffs. No
 * component tree spans those, so the run state is a singleton — the same shape
 * and the same reason as `DocProposalStore`.
 *
 * It also carries the coverage record past the end of the run. Criterion 4 says
 * the user must see what was and was not read **before they accept**, and the
 * accept happens in the Docs panel some time later, against a `DocProposal`
 * that has no field for it. Rather than widen AIX-009's proposal type (another
 * task's territory, and a shape that would then have to mean something for
 * every other producer of proposals), the coverage stays here and the panel
 * looks it up. A proposal whose `source` is `REVIEW_SOURCE` has a coverage
 * record; anything else does not, and the panel shows nothing extra.
 *
 * @module AiAssistant/review/ProjectReviewStore
 */

import Model from '../../../../../shared/model';
import type { ProjectReviewRun, ProjectReviewState } from './ProjectReviewRun';
import type { ProjectReviewCoverage } from './types';

export const PROJECT_REVIEW_CHANGED = 'projectReviewChanged';

/** The `source` every review proposal carries, and the panel's lookup key. */
export const REVIEW_SOURCE = 'Project review';

export class ProjectReviewStore extends Model {
  static instance = new ProjectReviewStore();

  private state: ProjectReviewState | null = null;
  /** Survives the run, so the review UI can explain a proposal accepted later. */
  private coverage: ProjectReviewCoverage | null = null;
  /**
   * BLD-008 — the live run, so whoever is looking at it can act on it.
   *
   * ⚠️ It used to be a `useRef` in each view, and that was a latent defect the
   * interview turned into a real one. `ProjectReviewView`'s Stop button reads
   * its own ref — which is null in the embedded case, because the run was
   * started by `AiAuthoringPanel`, so **Stop did nothing in the panel the
   * button actually ships in**. The interview's controls have the same problem
   * and could not have worked around it: answering a question has to reach the
   * run, and the run was reachable from one of the two mounts.
   *
   * The store was already "the one place both panels look" for the state; the
   * producer of that state belongs in the same place. Held weakly in spirit —
   * `clear()` drops it — and never persisted: a run is a live object.
   */
  private run: ProjectReviewRun | null = null;

  getState(): ProjectReviewState | null {
    return this.state;
  }

  /** The run producing the current state, when one is still around. */
  getRun(): ProjectReviewRun | null {
    return this.run;
  }

  setRun(run: ProjectReviewRun | null): void {
    this.run = run;
  }

  /** The coverage of the review that produced the pending proposals, if any. */
  getCoverage(): ProjectReviewCoverage | null {
    return this.coverage;
  }

  setState(state: ProjectReviewState | null): void {
    this.state = state;
    if (state?.context) this.coverage = state.context.coverage;
    this.notifyListeners(PROJECT_REVIEW_CHANGED, { state });
  }

  /** Called when the project changes — a review belongs to the project it read. */
  clear(): void {
    this.requested = false;
    this.run = null;
    if (this.state === null && this.coverage === null) return;
    this.state = null;
    this.coverage = null;
    this.notifyListeners(PROJECT_REVIEW_CHANGED, { state: null });
  }

  // ── Cross-panel hand-off ────────────────────────────────────────────────────

  private requested = false;

  /**
   * "The user clicked the banner in the Docs panel; start a review when the
   * Build panel comes up."
   *
   * A one-shot flag rather than a call, because the two panels are separate
   * component trees and the Docs panel has no run UI — putting one there would
   * mean two places that render the same progress feed. The flag is consumed
   * exactly once, so a later visit to the Build panel does not re-run anything,
   * and it is cleared with the rest of the state when the project changes.
   */
  requestReview(): void {
    this.requested = true;
    this.notifyListeners(PROJECT_REVIEW_CHANGED, { state: this.state });
  }

  /** Read and clear. Returns true at most once per `requestReview` call. */
  consumeReviewRequest(): boolean {
    if (!this.requested) return false;
    this.requested = false;
    return true;
  }
}
