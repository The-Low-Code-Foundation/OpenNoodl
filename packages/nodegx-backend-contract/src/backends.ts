/**
 * The six backend types, and the handle every contract method takes.
 *
 * @module backend-contract/backends
 */

/**
 * Every backend NodeGX can point a data node at.
 *
 * Six, not the four in the editor's `BackendServices/types.ts` — that union
 * predates this contract and only ever described BYOB's REST backends, so it
 * has no name for the two Parse-wire backends the record nodes have been
 * talking to all along. BCN-009 reconciles the editor's union with this one;
 * until then this is the wider of the two and the one the descriptors key on.
 *
 * `nodegx` and `parse` are separate entries **despite speaking the same wire**.
 * That looked like duplication until BCN-001 read the handler: our backend
 * serves `/aggregate` and `/distinct` under an ordinary `find` permission and
 * the read ACL (`nodegx-backend/src/server/parse-wire.ts:246`, and there is no
 * master-key check anywhere in that file), while upstream Parse Server restricts
 * the same route to the master key. Same wire, different capabilities — and the
 * capability is the thing this package exists to state.
 */
export type BackendType = 'nodegx' | 'parse' | 'directus' | 'supabase' | 'pocketbase' | 'custom';

export const BACKEND_TYPES: readonly BackendType[] = Object.freeze([
  'nodegx',
  'parse',
  'directus',
  'supabase',
  'pocketbase',
  'custom'
]);

/**
 * What a backend is called in front of a user.
 *
 * "Built-in" for `nodegx` is a decision, not a placeholder: it says the least
 * and so ages the best. A name that describes the technology ("SQLite", "Parse")
 * dates the moment the technology changes, and a name that describes the product
 * ("NodeGX Backend") reads as a separate thing you have to go and get.
 */
export const BACKEND_DISPLAY_NAMES: Readonly<Record<BackendType, string>> = Object.freeze({
  nodegx: 'Built-in',
  parse: 'Parse Server',
  directus: 'Directus',
  supabase: 'Supabase',
  pocketbase: 'PocketBase',
  custom: 'Custom API'
});

/**
 * A backend, resolved.
 *
 * Every method on `IDataAdapter` and `IAuthAdapter` takes one of these as its
 * first argument. That is the whole reason this type exists, and it is worth
 * being explicit about what it is buying:
 *
 * Two resolution paths exist in the code today and they disagree. `CloudStore`
 * reads a singleton and has exactly one implicit backend. `byob-utils.ts`'s
 * `resolveBackend` reads `backendServices` project metadata, understands an
 * `_active_` sentinel, and supports several backends at once. If the contract
 * had no handle argument, every adapter would have to resolve for itself and
 * the two paths would drift again — which is how they got here.
 *
 * So resolution happens once, above the adapter, and the adapter is handed the
 * answer. `CloudStore`'s singleton becomes "resolve `_active_`", and a project
 * with two backends stops being a special case.
 */
export interface BackendHandle {
  /** Stable id from the project's `backendServices` metadata. */
  readonly id: string;
  readonly type: BackendType;
  /** User-facing name, as typed in the Backend Services panel. */
  readonly name: string;
  /** Base URL, no trailing slash. */
  readonly url: string;
  /**
   * The token that ships with the deployed app.
   *
   * Deliberately not called `token`: the editor holds a second, far more
   * privileged `adminToken` for schema introspection which must never reach a
   * published project. Naming this one for what it is makes the wrong one
   * harder to reach for. BCN-009's security disclosure is about this field.
   */
  readonly publicToken?: string;
  /**
   * Session token for the currently signed-in end user, when there is one.
   *
   * Separate from `publicToken` because they have different lifetimes and
   * different owners: the public token is project configuration, this is a
   * user's login. See `TokenLifecycle` — on most backends this one expires.
   */
  readonly sessionToken?: string;
}
