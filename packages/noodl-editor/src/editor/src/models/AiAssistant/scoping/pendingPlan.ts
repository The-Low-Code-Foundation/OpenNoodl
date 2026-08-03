/**
 * AIX-012 — the handover point between the launcher and the editor.
 *
 * The scoping conversation ends with an AIX-011 plan that is deliberately NOT
 * executed: the project is created, the docs are on disk, and the build starts
 * when the user chooses. That leaves the plan needing to survive one navigation
 * — the launcher route unmounts, the editor route mounts — with no shared
 * component tree between them.
 *
 * Module state is the established answer to exactly this in this codebase:
 * `StylePresets`' `setPendingPresetId` carries the chosen preset across the
 * same boundary, for the same reason, and this deliberately mirrors it rather
 * than inventing a second mechanism. The plan is small, plain data and dies
 * with the window, which is the right lifetime for "the thing I just agreed to
 * in the previous screen".
 *
 * `take` is destructive on purpose. A plan that survived being consumed would
 * reappear the next time any project was opened, attached to a project it has
 * nothing to do with — and a plan pointing at the wrong project is worse than
 * no plan.
 *
 * NOTE for whoever wires the review UI: the plan is *also* written into
 * `docs/decisions/000-initial-scope.md` at creation, so it is durable and
 * readable without this seam. This is the fast path, not the only path.
 *
 * @module AiAssistant/scoping/pendingPlan
 */

import type { AuthoringPlan } from '../authoring/plan';

export interface PendingScopePlan {
  /** Which project it belongs to. Checked on take — a mismatch discards it. */
  projectId: string;
  plan: AuthoringPlan;
  /** Where the scoping conversation was recorded, for the reviewer's context. */
  recordPath: string;
}

let pending: PendingScopePlan | undefined;

export function setPendingScopePlan(value: PendingScopePlan | null): void {
  pending = value ?? undefined;
}

/** Look without consuming — for a banner that says a plan is waiting. */
export function peekPendingScopePlan(projectId?: string): PendingScopePlan | undefined {
  if (!pending) return undefined;
  if (projectId !== undefined && pending.projectId !== projectId) return undefined;
  return pending;
}

/**
 * Consume the plan. Returns `undefined` when there is none, or when the one on
 * file belongs to a different project — in which case it is **left alone**.
 *
 * AIB-005 changed that second case. It used to clear unconditionally, on the
 * reasoning that "a stale plan that keeps offering itself is a bug that presents
 * as a feature" — but the id check above is already what stops a plan reaching
 * the wrong project, and clearing on mismatch meant that opening any *other*
 * project first silently destroyed the handover for the one the user had just
 * scoped. The plan is still window-lifetime and still single-consumption by its
 * own project; it simply no longer dies of a project it has nothing to do with
 * being opened in front of it.
 */
export function takePendingScopePlan(projectId?: string): PendingScopePlan | undefined {
  const value = pending;
  if (!value) return undefined;
  if (projectId !== undefined && value.projectId !== projectId) return undefined;
  pending = undefined;
  return value;
}
