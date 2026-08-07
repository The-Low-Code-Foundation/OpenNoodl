/**
 * One answer to "which backend is this project's" — BCN-009 step 2.
 *
 * ## The defect this module exists to close
 *
 * A project has had **two** active backends. `cloudservices` binds the record,
 * auth and file nodes; `backendServices.activeBackendId` binds the BYOB ones.
 * Both can be set at once, pointing at different servers, and nothing in the
 * product said so. It surfaced three ways independently in one QA run:
 *
 * - two cards said **ACTIVE** at the same time, one of them for a backend that
 *   was stopped;
 * - `hideWhenSingleBackend` nearly counted a built-in-plus-Directus project as
 *   *one* backend, which would have hidden the picker and silently moved every
 *   Record node onto Directus;
 * - the first external backend added to a project became active on creation,
 *   skipping the switch dialog — the one change that takes a project from
 *   publishing nothing to publishing a token, made silently.
 *
 * ## What converged, and what deliberately did not
 *
 * **The selection converged. The configuration did not.**
 *
 * `BCN-009-NOTES.md` §5 proposed folding both metadata keys into one `backends`
 * key holding every backend's configuration. That is not what shipped, and the
 * reasoning is in `BCN-009-NOTES-STEP2.md` §2. The short version: the ambiguity
 * is in the *selection*, not the configuration. Two configuration homes with one
 * selection pointer is merely untidy; two selection pointers is a project whose
 * own product cannot say where its data goes. And moving the endpoint's
 * configuration would rewrite the exporter's `{{#export#}}` injection, the
 * version-control differ, the deploy popup and the Parse clients that read
 * `cloudservices` directly — five surfaces, none of which make the second
 * ACTIVE badge go away.
 *
 * So: `cloudservices` remains the endpoint's configuration, and
 * `backendServices.activeBackendId` becomes the project's **one** selection,
 * which may now name the endpoint.
 *
 * ## ⚠️ How `_endpoint_` survives
 *
 * {@link ENDPOINT_BACKEND_ID} is the synthetic id the *runtime* invents for the
 * `cloudservices` pointer, in `api/backends/resolveBackend.ts`. Every Record,
 * auth and file node's Backend picker can already hold it as a saved value, and
 * the editor had never heard of it.
 *
 * It survives because the convergence **adopts** that id rather than replacing
 * it: `activeBackendId` is now allowed to be `'_endpoint_'`, meaning exactly what
 * it already means to the runtime. Nothing re-keys, nothing is rewritten, and a
 * node parameter saved as `_endpoint_` by a build before this change resolves to
 * the same backend after it. That is the whole migration for saved picker
 * values: there isn't one, by construction.
 *
 * ## The version marker, and why a migration needs one
 *
 * Legacy and converged metadata are **byte-identical** in the one case that
 * matters — `activeBackendId: 'backend_x'` with an endpoint configured means
 * "Directus binds the BYOB nodes, the endpoint binds everything else" under the
 * old rule, and "Directus is the project's backend" under the new one. Nothing in
 * the bytes distinguishes them, so a reader that guesses is a reader that
 * silently repoints somebody's data nodes.
 *
 * Hence {@link BACKEND_SELECTION_VERSION} on the metadata. `version >= 2` means
 * "`activeBackendId` is the project's one selection, read it first". Absent
 * means "legacy, resolve exactly as before". The two rules coexist, so the
 * migration and its readers can land in either order — which is what the spec's
 * trap *"a project that half-migrates resolves a backend that does not exist"*
 * is asking for.
 *
 * ## When the migration writes, and when it refuses
 *
 * It never writes on load (F46: opening a project must not rewrite data nobody
 * touched). It writes on the next deliberate save, and only when converging is
 * **semantics-preserving** — when the one selection it would record is already
 * what both families resolve today. {@link selectionConflict} names the one case
 * where it is not, and there the metadata is left legacy and the panel says so.
 * A user resolves it in one click, through the switch dialog, which is the
 * disclosure this phase exists for.
 *
 * @module BackendServices/activeBackend
 */

/**
 * The id of the project's `cloudservices` endpoint, as a selectable backend.
 *
 * ⚠️ **This constant is a copy of the runtime's, deliberately.** The canonical
 * declaration is `ENDPOINT_BACKEND_ID` in
 * `packages/noodl-runtime/src/api/backends/resolveBackend.ts`; the editor does
 * not depend on `noodl-runtime` and importing it for one string would be a
 * heavier coupling than the string is worth. The value is part of the saved
 * project format — a node's Backend parameter can hold it — so it is frozen in
 * both places for the same reason, and both say so.
 */
export const ENDPOINT_BACKEND_ID = '_endpoint_';

/**
 * The picker's "whatever the project is pointed at" value.
 *
 * Same copy-of-the-runtime's note as {@link ENDPOINT_BACKEND_ID}. Present here so
 * the editor can recognise it in a saved parameter without guessing.
 */
export const ACTIVE_BACKEND = '_active_';

/**
 * `backendServices.version` once the selection has converged.
 *
 * 2 rather than 1 because unversioned metadata is version 1 by definition and
 * saying so out loud costs nothing.
 */
export const BACKEND_SELECTION_VERSION = 2;

/** Everything the selection rules read, passed in so they are pure and testable. */
export interface BackendSelectionSources {
  /** `backendServices.version`. Absent in every project saved before BCN-009. */
  version?: number;
  /** `backendServices.activeBackendId`, exactly as stored. */
  storedActiveBackendId?: string;
  /** The ids in `backendServices.backends`. */
  backendIds: readonly string[];
  /** Does the project have a `cloudservices.endpoint`? */
  hasEndpoint: boolean;
}

/** Is this metadata written by a build that had converged the selection? */
export function isConverged(sources: BackendSelectionSources): boolean {
  return (sources.version ?? 1) >= BACKEND_SELECTION_VERSION;
}

/** Does `id` name a backend this project actually has? */
export function namesABackend(id: string | undefined, sources: BackendSelectionSources): boolean {
  if (!id) return false;
  if (id === ENDPOINT_BACKEND_ID) return sources.hasEndpoint;
  return sources.backendIds.includes(id);
}

/**
 * The project's one active backend id.
 *
 * ⚠️ **The legacy branch is a transcription of the runtime's `defaultBackendId`,
 * not an improvement on it.** Endpoint first, then the stored id, then the
 * single-backend default. If these two ever disagree the editor shows a badge on
 * a card the runtime is not using, which is worse than the defect being fixed —
 * so any change here needs the matching one in
 * `api/backends/resolveBackend.ts::defaultBackendId`.
 *
 * The converged branch is the whole of the change: a recorded selection wins,
 * including when it names the endpoint. A recorded selection that names nothing
 * (the backend was deleted by a merge, say) falls through to the legacy
 * derivation rather than resolving to nothing — the project still has a backend
 * and refusing to name it helps nobody.
 */
export function resolveActiveBackendId(sources: BackendSelectionSources): string | undefined {
  if (isConverged(sources) && namesABackend(sources.storedActiveBackendId, sources)) {
    return sources.storedActiveBackendId;
  }

  if (sources.hasEndpoint) return ENDPOINT_BACKEND_ID;
  if (namesABackend(sources.storedActiveBackendId, sources)) return sources.storedActiveBackendId;
  if (sources.backendIds.length === 1) return sources.backendIds[0];
  return sources.storedActiveBackendId;
}

/**
 * The second active backend, when a legacy project genuinely has two.
 *
 * Returns the `backendServices` backend that binds the BYOB nodes while the
 * endpoint binds everything else — i.e. the card that used to be the *other*
 * ACTIVE badge. `undefined` when the project has one active backend, which is
 * every converged project and most legacy ones.
 *
 * This is the one state the migration will not resolve on the project's behalf,
 * because either answer silently repoints somebody's nodes:
 *
 * - recording the endpoint moves every BYOB node off the backend it is using;
 * - recording the BYOB backend moves every Record, auth and file node onto it.
 *
 * A user picks, through the switch dialog, having been shown what each publishes.
 */
export function selectionConflict(sources: BackendSelectionSources): string | undefined {
  if (isConverged(sources)) return undefined;
  if (!sources.hasEndpoint) return undefined;

  const stored = sources.storedActiveBackendId;
  if (stored && stored !== ENDPOINT_BACKEND_ID && sources.backendIds.includes(stored)) return stored;
  return undefined;
}

/**
 * May the selection be written in converged form without changing what any node
 * resolves today?
 *
 * The migration's whole safety argument in one predicate: it writes the value
 * that is *already true*, so the write itself moves nothing. Everything after
 * that is a deliberate user action with a dialog in front of it.
 */
export function canConvergeSilently(sources: BackendSelectionSources): boolean {
  return selectionConflict(sources) === undefined;
}

/**
 * The sentence shown on the card that is still bound to the BYOB nodes.
 *
 * Deliberately not a warning and deliberately not red: nothing is broken, the
 * project is in a state a previous build allowed, and the fix is one button that
 * is already on the card.
 */
export function describeSelectionConflict(activeName: string, conflictName: string): string {
  return (
    `${conflictName} is still bound to this project's Data nodes from before backends were one list, ` +
    `while ${activeName} is what everything else uses. Set one of them active to make it the whole project's backend.`
  );
}

// ============================================================================
// What the selection becomes when the list changes
// ============================================================================

/**
 * Should a newly created backend become the project's active one?
 *
 * ⚠️ **This is the fix for "the first external backend activates without the
 * switch dialog".** The old rule was `backends.length === 1` — the first
 * *`backendServices`* backend, counted without reference to the endpoint the
 * project was already using. In a project with a built-in backend running, that
 * made a freshly added Directus the active one on creation: the largest single
 * change in what an app publishes, and the one that happened silently.
 *
 * The rule now: a new backend becomes active **only when the project had no
 * active backend at all.** Then there is nothing to compare it against, nothing
 * to repoint, and a comparison dialog would have one column; the add dialog has
 * already shown that backend's disclosure before Create was pressed. In every
 * other case it is created inactive with a `Set active` button, which goes
 * through the switch dialog.
 */
export function shouldActivateOnCreate(sources: BackendSelectionSources): boolean {
  return resolveActiveBackendId(sources) === undefined;
}

/**
 * The selection after a backend is deleted.
 *
 * Only moves when the deleted backend *was* the selection. The endpoint is
 * preferred over an arbitrary survivor because it is the backend the Record,
 * auth and file nodes are bound to, and picking the first remaining REST backend
 * instead would repoint all of them to satisfy a list order.
 */
export function selectionAfterDelete(
  deletedId: string,
  activeBackendId: string | undefined,
  remaining: BackendSelectionSources
): string | undefined {
  if (activeBackendId !== deletedId) return activeBackendId;
  if (remaining.hasEndpoint) return ENDPOINT_BACKEND_ID;
  return remaining.backendIds[0];
}

/**
 * The selection after the project's endpoint is disconnected.
 *
 * The mirror of {@link selectionAfterDelete}: a selection naming an endpoint
 * that no longer exists is a project whose nodes resolve nothing, so it falls
 * back to the only other thing there is.
 */
export function selectionAfterEndpointRemoved(
  activeBackendId: string | undefined,
  backendIds: readonly string[]
): string | undefined {
  if (activeBackendId !== ENDPOINT_BACKEND_ID) return activeBackendId;
  return backendIds[0];
}
