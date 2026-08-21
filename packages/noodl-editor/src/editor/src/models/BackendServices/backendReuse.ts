/**
 * The one rule for "is this backend already this project's?", and the shape it
 * reads — kept in a leaf module so more than one spawner can obey it.
 *
 * 🔴 **Extracted, not copied.** `provisionBackend` (the AI plan's spawner) and
 * `models/lessonbackend` (a lesson's) both need this rule, and
 * `provisionBackend` cannot be imported from a plain-Node runner: it reaches
 * `projectmodel.editor`, which reaches `PopupLayer` and `ToastLayer`, which
 * reach React. A second copy of an ownership rule is exactly the "second palette
 * copy" this codebase has already paid for — and `noodl-mcp`'s provisioner
 * carries a third, reimplemented verbatim and documented as such.
 *
 * @module BackendServices/backendReuse
 */

export interface LocalBackendMeta {
  id: string;
  name: string;
  port: number;
  /** AAQ-002/F4 — the projects that own this backend. See {@link findReusableBackend}. */
  projectIds?: string[];
}

/**
 * A backend this provision may reuse instead of creating a second one.
 *
 * ## ⚠️ Why this takes a project id (AAQ-002/F4)
 *
 * It used to match on **name alone**, justified by idempotence within one plan —
 * which it achieved. But the lookup is machine-wide and the name is a *constant*
 * (`provisionFromScope` called every backend "App backend"), so the real
 * behaviour was: **every AI-created project on a machine bound to the first
 * backend ever provisioned there.** Richard's puppy project came up pointing at
 * one created two days earlier, carrying `Conversation`, `Message` and `Inquiry`
 * from unrelated apps — two apps silently sharing one datastore, and the whole
 * live cause of `prop-age` / `prop-bio` not existing, because `createTable`
 * returned `created: false` for a `Puppy` it had never made.
 *
 * So reuse now needs **both**: this project must already own the backend, and
 * the name must still match.
 *
 * - *Ownership* is the correctness half. `projectIds` is stamped by
 *   `backend:create` and never widened, so one project's backend cannot be
 *   adopted by another — including every backend that predates the stamp, which
 *   has an empty `projectIds` and is therefore owned by nobody and reused by
 *   nobody. That is deliberate: a legacy "App backend" full of three apps'
 *   collections is exactly what must not be picked up again.
 * - *Name* is the intent half, and it is the rule that was already here: a user
 *   who renamed the backend gets a second one rather than having a repurposed
 *   one written into. Keeping it means a re-apply, a redo, and a second apply
 *   after an undo all still reuse — which is all the name-match was ever for.
 */
export function findReusableBackend(
  existing: readonly LocalBackendMeta[],
  name: string,
  projectId: string | undefined
): LocalBackendMeta | undefined {
  if (!projectId) return undefined;
  const wanted = name.trim().toLowerCase();
  return existing.find(
    (b) => b.name.trim().toLowerCase() === wanted && (b.projectIds ?? []).includes(projectId)
  );
}
