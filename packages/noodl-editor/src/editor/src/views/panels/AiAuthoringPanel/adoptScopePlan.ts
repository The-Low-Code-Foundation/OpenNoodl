/**
 * AIX-012 — the launcher's scoping plan, into the store.
 *
 * ## Why this is a function and not two initialisers
 *
 * BLD-001 gave it a second caller. `ProjectAuthoringView` used to be the sole
 * owner: it mounted whenever the "Project" scope tab was selected, so its
 * initialiser was guaranteed to run. Inside the thread it mounts as the outcome
 * card of a *plan turn* — and a plan turn exists only when the store holds a
 * plan, which is what this take is for. A launcher handover would have arrived
 * at a panel that never mounted the thing that consumes it, and a plan the user
 * agreed to minutes earlier would have vanished with no error.
 *
 * So `AiAuthoringPanel` takes it first, and the view's initialiser stays as a
 * fallback. Both call this. **A destructive read with two call sites is worth
 * being uneasy about; a destructive read with two call sites and one
 * implementation is merely a guard that runs twice** — and the guard is the
 * store's own content, which is what already made this survive React's
 * double-invoked initialiser.
 *
 * @module noodl-editor/views/panels/AiAuthoringPanel/adoptScopePlan
 */

import { PlanSessionStore, type PlanSession } from '@noodl-models/AiAssistant/authoring';
// The module, not the `scoping` barrel — the barrel pulls `ScopingSession` (the
// AI client) and `scopeDocs` (the platform filesystem), and this is a
// plain-data handover that needs neither.
import { takePendingScopePlan, type PendingScopePlan } from '@noodl-models/AiAssistant/scoping/pendingPlan';

/**
 * Take a waiting scope plan into the store, or return what is already there.
 *
 * Idempotent by the store's content: a session that already holds a plan, a run
 * or an applied summary is work in progress, and a recovered plan must never
 * overwrite it. The plan arrives **proposed, not approved** — every row is
 * prunable and nothing reaches the project until Apply.
 */
export function adoptScopePlan(projectId: string | undefined): PlanSession {
  const store = PlanSessionStore.instance;
  const existing = store.get(projectId);
  if (existing.plan || existing.run || existing.applied) return existing;

  const scopePlan: PendingScopePlan | undefined = takePendingScopePlan(projectId);
  if (!scopePlan) return existing;

  const count = scopePlan.plan.operations.length;
  return store.update(projectId, {
    plan: scopePlan.plan,
    // AIB-005: what earns this plan an announcement outside the Build panel.
    origin: 'scoping',
    note: {
      text:
        `From the scoping conversation that created this project — ${count} ` +
        `operation${count === 1 ? '' : 's'}. Nothing has been built yet. Drop ` +
        `anything you have changed your mind about, then author it. The conversation is recorded in ` +
        `${scopePlan.recordPath}.`,
      type: 'notice'
    }
  });
}
