/**
 * The read-only admin policy (BAK-005).
 *
 * A read-only admin is the "look, don't touch" credential tier for support and
 * demo access. The rule is deliberately COARSE and stated once, here, rather
 * than annotated per route:
 *
 *   a read-only admin may issue GET and OPTIONS; every other method is refused
 *   before the handler runs, unless the route is on the safe list below.
 *
 * Why coarse: the alternative — marking each route `mutating: true/false` — is
 * the same shape as the "new route forgot the middleware" bug the route table's
 * mandatory `access` declaration exists to prevent. A new route added by a
 * future task is refused for read-only admins by DEFAULT if it is a POST/PUT/
 * DELETE, which is the safe direction to fail in. Nobody has to remember
 * anything for the tier to keep its promise.
 *
 * The safe list is therefore an explicit, small, reviewed exception set: POST
 * routes whose whole purpose is to *read* something that does not fit in a URL.
 * Adding to it is a deliberate act.
 *
 * @module nodegx-backend/admin/readonly
 */

/** Methods that never change state. */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Non-GET routes a read-only admin may still call, by route *pattern* (the key
 * in the route table, not a request path). Every entry is a read dressed as a
 * POST because its input does not fit in a query string:
 *
 *   - `realtime/subscriptions` — declares what an already-open SSE stream wants
 *     to watch. Nothing is persisted; delivery is still permission-checked per
 *     event. Without this, a read-only dashboard could not show live data.
 *   - `admin/permissions/check` — BAK-003's dry run. It answers "what WOULD
 *     enforcement decide", and changes nothing.
 *   - `admin/schema/diff` — BAK-007's promotion preview. `admin/schema/apply`
 *     is its mutating sibling and is deliberately NOT here.
 */
export const READONLY_SAFE_ROUTES = new Set([
  'realtime/subscriptions',
  'admin/permissions/check',
  'admin/schema/diff'
]);

/** May a read-only admin issue this request? */
export function readonlyAdminMayCall(method: string, routePattern: string): boolean {
  if (SAFE_METHODS.has(method)) return true;
  return READONLY_SAFE_ROUTES.has(routePattern);
}

/**
 * The refusal message. Loud and specific: it names the tier and what to do,
 * so an operator never mistakes a policy refusal for a broken backend.
 */
export function readonlyRefusalMessage(method: string, routePattern: string): string {
  return (
    `Refused: this backend was reached with the READ-ONLY admin credential, which cannot perform ` +
    `state-changing requests (${method} /${routePattern}). Use the full admin credential from the ` +
    `backend's secrets.json ("adminToken") to make changes.`
  );
}
