/**
 * Directus's system collections, and the one thing `RestDataAdapter` could not
 * do that the BYOB family could.
 *
 * ## Why this file exists
 *
 * `PROGRESS.md` records this as **BCN-010's precondition**, and it is the reason
 * four `noodl.byob.*` node types are still in the tree:
 *
 * > ⚠️ **Directus system collections** (`directus_users` → `/users`) are a
 * > capability BYOB had and `RestDataAdapter` does not — `byob-query-data.ts`
 * > has an `apiPathMode` port, `RestDataAdapter` has **zero** references to it,
 * > and `record-ports.ts` sets `filterByApiPathMode: false`. **This is now the
 * > blocker on deleting the four `noodl.byob.*` types**, because deleting them
 * > without it removes a working capability.
 *
 * BCN-004's own note put the same point more sharply: *"deleting the family
 * while the merged one cannot do system collections creates exactly the silent
 * gap BCN-010 exists to prevent."*
 *
 * So the choice was to implement it or to declare it `unsupported` with a
 * reason. **It is implemented**, because the measurement said it was cheap:
 *
 * ```
 * GET /items/directus_users            -> 403 FORBIDDEN "You don't have permission to access this."
 * GET /users                           -> 200
 * GET /users?limit=1&fields=id,email&sort=-id
 *                                      -> 200, {"data":[{"id":…,"email":…}]}
 * GET /items/directus_files            -> 403
 * ```
 *
 * — `BCN-007-FILES-PROBE-OUTPUT.txt` §1d. The two routes are **not**
 * interchangeable (403 vs 200), and the system route takes the *same* query
 * dialect and returns the *same* `{data: […]}` envelope as `/items`. So the
 * whole difference is the path, and everything else in `RestDataAdapter` —
 * filters, sorting, pagination, the `filter_count` total, the record identity
 * normalisation — already applies unchanged.
 *
 * ⚠️ **The 403 is why this could not be left alone.** Directus hides existence
 * behind 403 (BCN-004-FILE-FACTS §2.2), so a Query Records node pointed at
 * `directus_users` through `/items` would report *"You don't have permission to
 * access this"* to a user whose permissions are perfectly fine. That is a
 * plausible-looking wrong answer, which is the failure class this phase exists
 * to remove — not a missing feature the user can work around.
 *
 * ## What this deliberately does not do
 *
 * **It does not read `apiPathMode`.** BYOB carried a per-node enum port with
 * `items`/`system` values, defaulted from the collection name, and offered the
 * user a switch. The switch has no correct second position: `/items/directus_x`
 * is 403 for every system collection and `/users` is a 404 for every user
 * collection, so `apiPathMode` was a control whose wrong setting could only ever
 * break the request. Deriving it from the collection name — which is what
 * `schema-ports.ts::apiPathModePorts` already defaults to, and what
 * `byob-utils.ts::detectApiPathMode` does outright — is the whole of its
 * information content. See {@link directusPathOverride}.
 *
 * ## The duplicate map
 *
 * ⚠️ `byob-utils.ts` holds a second copy of {@link DIRECTUS_SYSTEM_ENDPOINTS}
 * (as `SYSTEM_ENDPOINTS`) and a second copy of `isSystemCollection` lives in
 * `schema-ports.ts`. They are **not** merged here, for two reasons: those files
 * belong to the node layer and `api/` may not import `nodes/` (the layering
 * `restSerialize.ts` states), and the BYOB copy is scheduled for deletion with
 * its family. Whoever lands that deletion should delete the copy rather than
 * re-point it.
 *
 * @module api/backends/directusSystem
 */

/**
 * Directus system collection → its dedicated REST endpoint.
 *
 * Transcribed from `byob-utils.ts::SYSTEM_ENDPOINTS`, which is the map the BYOB
 * nodes have been shipping. `directus_users` → `/users` and
 * `directus_files` → `/files` are the two that were **measured** here; the rest
 * are Directus's own documented and entirely regular
 * `directus_{x}` → `/{x}` convention, and are marked as such rather than claimed
 * as observed.
 */
export const DIRECTUS_SYSTEM_ENDPOINTS: Readonly<Record<string, string>> = Object.freeze({
  // Measured — BCN-007-FILES-PROBE-OUTPUT.txt §1d.
  directus_users: 'users',
  directus_files: 'files',
  // Inherited from `byob-utils.ts`, unprobed, and regular.
  directus_roles: 'roles',
  directus_folders: 'folders',
  directus_activity: 'activity',
  directus_permissions: 'permissions',
  directus_settings: 'settings',
  directus_webhooks: 'webhooks',
  directus_flows: 'flows',
  directus_operations: 'operations',
  directus_panels: 'panels',
  directus_dashboards: 'dashboards',
  directus_notifications: 'notifications',
  directus_shares: 'shares',
  directus_presets: 'presets',
  directus_revisions: 'revisions',
  directus_translations: 'translations'
});

/** Is this one of Directus's own tables? The `directus_` prefix is reserved. */
export function isDirectusSystemCollection(collection: string | undefined): boolean {
  return typeof collection === 'string' && collection.startsWith('directus_');
}

/**
 * The path a Directus request must use for this collection, or `undefined` when
 * the ordinary `/items/{collection}` template is right.
 *
 * `undefined` for every non-system collection, which is the overwhelming
 * majority, so the caller's hot path is one `startsWith`.
 *
 * ⚠️ **A `directus_` collection with no entry here returns `undefined` and falls
 * back to `/items/`, which will 403.** That is deliberate: the alternative is to
 * derive the endpoint by stripping the prefix, which would invent a route for
 * any future `directus_` table Directus adds that is *not* served under its bare
 * name — and a fabricated route answers 404, which reads to a user as "this
 * collection does not exist". A 403 from the documented-wrong path is at least
 * the same error Directus gives for a genuine permission problem, and the map
 * above is the thing to extend.
 */
export function directusPathOverride(collection: string | undefined): string | undefined {
  if (!isDirectusSystemCollection(collection)) return undefined;
  const endpoint = DIRECTUS_SYSTEM_ENDPOINTS[collection as string];
  return endpoint === undefined ? undefined : `/${endpoint}`;
}
