/**
 * BLD-001 — the thread's vocabulary.
 *
 * The Build panel was three applications wearing one panel: a segmented control
 * picked `component` / `project` / `review` before the user had typed anything,
 * and a three-way ternary switched whole subtrees. This module is the shape
 * that replaces it — **one thread of turns**, produced by all three sessions
 * rather than rendered by three views.
 *
 * ## Why the model is pure, and lives here
 *
 * These are plain functions over published session state: no React, no
 * `ProjectModel`, no editor singleton. That is deliberate and it is the same
 * boundary OBS-002 drew for the provenance walk — it makes the mapping
 * testable in a plain-Node runner (`tests-unit/bld-001/`) rather than only
 * inside a real Electron renderer, and the mapping is exactly the part where a
 * mistake is invisible on screen (a turn attributed to the wrong request reads
 * as a perfectly ordinary feed).
 *
 * ## What a turn is
 *
 * `{ id, request, activities, outcome? }`. The user's words open it; everything
 * the agent did in response belongs to it; and what the turn *produced* — a
 * staged component, a plan, three drafted docs — is its outcome, which is what
 * BLD-003 will hang decisions on. A session's `AuthoringActivity` feed is the
 * right vocabulary and survives unchanged; BLD-002 extends it, this task does
 * not.
 *
 * @module AiAssistant/thread/types
 */

import type { AuthoringActivity, AuthoringMode } from '../authoring';
import type { TurnReference } from './references';

/**
 * What the agent decided a request was, before it acted.
 *
 * Replaces `AuthoringScope` — and the difference is the whole of D1. A scope
 * was chosen by the user at the moment they knew least; an intent is decided
 * from the request itself, stated in the agent's first sentence, and
 * overridable in one click.
 */
export type BuildIntent = 'component' | 'plan' | 'docs';

/**
 * One entry inside a turn — the session's own feed vocabulary, minus `user`.
 *
 * `user` is not an activity in a thread: it is what *opens* a turn, and it is
 * carried on `Turn.request`. Keeping it in the list as well is how a feed ends
 * up rendering the same sentence twice, once as a bubble and once as a header.
 */
export type TurnActivity = Exclude<AuthoringActivity, { kind: 'user' }>;

/** A named thing a plan operation touched, for an outcome the user can read. */
export interface TurnPlanSummary {
  operationCount: number;
  /** Targets in authoring order — component paths and doc paths. */
  targets: string[];
  /** True when the plan creates a backend. */
  provisions: boolean;
}

/**
 * What a turn produced.
 *
 * Descriptive, never a live object: a turn is a record of something that
 * happened, and holding the session in it would make the thread the owner of
 * state that `PlanSessionStore` and `ProjectReviewStore` exist to own. The
 * panel renders the rich card by looking the live object up from its store;
 * this says *which* card and what it says when there is nothing live to show —
 * which is the case for every turn but the last.
 */
export type TurnOutcome =
  /** A candidate passed the gate and is waiting for a decision. */
  | {
      kind: 'staged-component';
      legacyName: string;
      mode: AuthoringMode;
      nodeCount: number;
      connectionCount: number;
    }
  /** The candidate reached the project. The receipt D5 deletes today. */
  | { kind: 'accepted-component'; legacyName: string; mode: AuthoringMode }
  /** A plan is proposed and prunable; nothing has been built. */
  | { kind: 'plan'; plan: TurnPlanSummary }
  /** A plan reached the project as one undoable edit. */
  | { kind: 'plan-applied'; componentCount: number; docs: string[]; backendName?: string }
  /** The docs pass produced drafts, staged for per-file review. */
  | { kind: 'docs-drafts'; authored: number; declined: number; errors: number }
  /** The run stopped without producing anything — exhausted, cancelled, failed. */
  | { kind: 'note'; text: string; tone: 'notice' | 'danger' };

export interface Turn {
  /**
   * Stable for the life of the thread. Derived from the producer and the
   * request's position — never from an array index alone, because a turn list
   * that renumbers on every append is one that loses scroll position and
   * expanded state on every message.
   */
  id: string;
  /** The user's words, verbatim. Absent only for a turn the agent opened itself. */
  request?: string;
  /** What the agent decided to do with the request, when it said so. */
  intent?: BuildIntent;
  activities: TurnActivity[];
  outcome?: TurnOutcome;
  /**
   * BLD-011 — what rode along with the request: kind, label, size, pin state.
   *
   * ⚠️ **The record, never the bytes.** See `TurnReference` for the retention
   * rule and why it is the way it is — in short, a 24k component serialization
   * per turn would make a thread file unreadable within a dozen turns and would
   * put a second, silently diverging copy of the project on disk. Reopening a
   * thread therefore shows what each turn carried and does not pretend it can
   * replay it.
   */
  references?: TurnReference[];
  /** True while this turn is still producing. At most one turn is busy. */
  busy?: boolean;
}
