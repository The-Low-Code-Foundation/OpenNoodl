/**
 * DEF-035 — what a schema fetch is allowed to do to the cache it could not refresh.
 *
 * ## The defect this exists to remove
 *
 * `dbCollections` is project **metadata**, and it is the only place a built-in
 * backend's schema lives. `resolveSchemaPortContext` reads it, `recordFieldPorts`
 * mints one `prop-<column>` port per column, and `setMetaData` schedules a project
 * save — so this cache is on disk, and the ports on the canvas are a function of it.
 *
 * `SchemaHandler._store()` used to write `dbCollections = undefined` on **every**
 * outcome that was not a successful read. A stopped backend, a backend mid-restart,
 * one that had not registered with `BackendManager` yet, and a window focused three
 * seconds before the backend finished starting all landed on the same write. The
 * measured consequence, taken with the runtime's own generator:
 *
 * ```
 * WARM  dbCollections=[Puppy]  → prop-name, prop-age, prop-bio
 * COLD  dbCollections=undefined → (no ports)
 * ```
 *
 * A wire into a port that no longer exists is `con-no-target-port`, which
 * `NodeGraphModel.evaluateConnectionHealth` raises at **`level: 'error'`** — and
 * after DEF-034 an error is precisely what still deletes a wire from an export. So
 * a build taken while the cache was wiped silently loses every schema-derived
 * record wire. Across the 118-project corpus that is **3,783 wires in 28 projects**
 * (`DbModel2`, `NewDbModelProperties`, `SetDbModelProperties` and the three
 * `net.noodl.user.*` nodes). The other 5,268 `prop-*` wires belong to `Model2` and
 * friends, whose ports come from a saved `properties` list and are immune.
 *
 * ## The distinction the old code claimed and did not make
 *
 * `fetchBuiltInSchema`'s docblock already said the caller "distinguishes 'there is
 * nothing to cache' from 'the cache is empty', because the second wipes the ports
 * of a project whose backend is merely asleep." It returned `undefined` for both,
 * and `_store()` wiped on `undefined`. The contract was written; nothing honoured
 * it. Three outcomes are needed, not two, and they are the type below.
 *
 * ## Why "could not ask" keeps a stale schema
 *
 * A backend that was deleted while `cloudservices` still points at it leaves a
 * stale cache behind, and that is the trade taken here deliberately. A stale
 * schema mints ports that a wire can land on; an absent one deletes the wire from
 * the build. The first is visible and recoverable, the second is silent and
 * destroys work. Unbinding the project — the act that actually means "this backend
 * is not mine any more" — raises `cloudServicesChanged` and resolves to
 * `not-applicable`, which does clear.
 *
 * Import-free on purpose: the reading of singletons stays in `schemahandler.ts`,
 * the judgement is graded in `tests-unit/`. Same split as
 * `BackendServices/projectCollections.ts` and `AiAssistant/review/collectSources.ts`.
 *
 * @module noodl-editor/utils/schemaCachePolicy
 */

/**
 * What one attempt to read the built-in backend's schema came back with.
 *
 * - `schema` — the backend answered. Its answer replaces the cache, **including
 *   when it is an empty array**: a backend with no tables is a fact, and the
 *   Data Browser and the AI review both need to be able to say so.
 * - `not-applicable` — this project has no built-in backend to describe. No
 *   endpoint at all, or an endpoint pointing at a Parse server somebody else runs
 *   (WF-007: we hold no master key and must not pretend to). The cache is cleared,
 *   because keeping one would attribute another server's classes to this project.
 * - `unavailable` — there is a backend and we could not reach it. Stopped,
 *   restarting, not yet registered, no `ipcRenderer` (the Jasmine suite), or a
 *   reply we could not read. **The cache is left exactly as it was.**
 */
export type SchemaFetchOutcome =
  | { status: 'schema'; tables: unknown[]; backend?: SchemaBackendRef }
  | { status: 'not-applicable'; cause: NotApplicableCause; reason: string }
  | { status: 'unavailable'; cause: UnavailableCause; reason: string };

/**
 * DEF-036 AC1 — why the schema could not be read, as a code rather than a sentence.
 *
 * `reason` is prose for a log line and always has been: it interpolates a backend id, it is
 * written for a developer reading the console, and two of the strings differ only in a word.
 * The panel has to *choose a sentence* from this, and choosing one by matching substrings of
 * English is how `DELIVERED-B` came to match inside `NOT-DELIVERED-B`. So the discrimination
 * the caller needs is carried as its own field, and {@link SchemaFetchOutcome} is the only
 * place that decides it.
 *
 * ⚠️ Every arm here is a case the person meets differently:
 * - `no-endpoint` — nothing attached at all. The next action is to attach a backend.
 * - `external-endpoint` — attached, but a server we hold no key for (WF-007). There is no
 *   schema editor to send anyone to, and Richard's DEF-036 rider puts it out of scope.
 * - `not-running` — attached, and it is stopped. The next action is to start it.
 * - `not-registered-yet` — attached and starting: the window DEF-035 measured a project
 *   healing itself across. Nothing to do but wait, which is a different sentence from either.
 * - `unreadable-reply` — running, and it answered with something that is not a table list.
 * - `no-project` / `no-ipc` / `threw` — this editor could not ask. Not a fact about the
 *   project, and the panel must not blame one.
 */
export type NotApplicableCause = 'no-endpoint' | 'external-endpoint';

/**
 * DEF-036 AC4 — which managed backend answered, kept so a panel can open its schema editor.
 *
 * 🔴 Carried on the outcome rather than resolved a second time. Working out which running
 * process a project's endpoint belongs to is `matchEndpointToManaged` over an async
 * `backend:list`, and the read that produced this schema has already done it. A button that
 * re-derived it could send an author into a *different* backend's schema than the one their
 * ports came from, and nothing on screen would say which they were looking at.
 *
 * Optional, because a `SchemaFetchOutcome` is also constructed in specs where no backend
 * exists; a reader with no ref offers no jump rather than inventing an id.
 */
export interface SchemaBackendRef {
  id: string;
  name: string;
}

export type UnavailableCause =
  | 'no-project'
  | 'no-ipc'
  | 'not-registered-yet'
  | 'not-running'
  | 'unreadable-reply'
  | 'threw';

/**
 * DEF-036 AC1 — raised on `EventDispatcher` when the *answer* changes, not on every attempt.
 *
 * Declared in this leaf module rather than in `schemahandler.ts` so a panel can listen for it
 * without importing the handler, its singletons and its IPC — the same split
 * `backendSurfaces.tsx` records for `BACKEND_SERVICES_PANEL_ID`.
 */
export const SCHEMA_OUTCOME_CHANGED = 'SchemaHandler.outcomeChanged';

/** The three metadata keys `SchemaHandler._store()` owns, as one write. */
export interface SchemaCacheValue {
  dbCollections: unknown[] | undefined;
  systemCollections: unknown[] | undefined;
  haveCloudServices: boolean;
}

/**
 * Either "write this" or "touch nothing".
 *
 * `reason` is carried on both arms so the no-write case can be logged: an
 * invisible decision not to write is how this defect stayed invisible.
 */
export type SchemaCacheDecision =
  | { write: false; reason: string }
  | { write: true; value: SchemaCacheValue; reason: string };

/**
 * The whole of DEF-035's fix: only an outcome that actually settles the question
 * is allowed to change the cache.
 *
 * `systemCollections` is `[]` alongside a successful read rather than a second
 * list, because `collectionsFromParseClasses` marks `isSystem` off the leading
 * underscore and `_fetch` caches every table in one array — splitting them here
 * would be a second place to get that rule wrong.
 */
export function decideSchemaCache(outcome: SchemaFetchOutcome): SchemaCacheDecision {
  switch (outcome.status) {
    case 'schema':
      return {
        write: true,
        reason: `read ${outcome.tables.length} table(s) from the built-in backend`,
        value: { dbCollections: outcome.tables, systemCollections: [], haveCloudServices: true }
      };

    case 'not-applicable':
      return {
        write: true,
        reason: `no built-in backend to describe: ${outcome.reason}`,
        value: { dbCollections: undefined, systemCollections: undefined, haveCloudServices: false }
      };

    case 'unavailable':
      // The one line the ports of 28 real projects depend on.
      return { write: false, reason: `keeping the cached schema: ${outcome.reason}` };
  }
}
