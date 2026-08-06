/**
 * What each privileged route is called in the audit trail (BAK-009).
 *
 * The action name is DECLARED, not inferred from the path, for the same reason
 * BAK-003's access classes are declared: an inferred name silently changes when
 * a route is renamed, and an audit trail whose vocabulary drifts is an audit
 * trail nobody can query. `tests/ops-audit.test.ts` walks the live route table
 * and fails when a state-changing privileged route has no entry here — so the
 * coverage question is answered at CI time rather than by whoever reviews the
 * next route.
 *
 * Only MUTATIONS are listed. Reads are not audited: they are in the access log
 * with actor, route and request id already, and recording every admin GET would
 * bury the entries that matter under dashboard polling.
 *
 * @module nodegx-backend/ops/audit-actions
 */

/** `METHOD pattern` → action name. */
const ACTIONS: Record<string, string> = {
  // Security surface (BAK-003) — the CLP/role/key edits an operator most needs
  // to be able to reconstruct after the fact.
  'PUT admin/permissions': 'permissions.update',
  'PUT admin/permissions/collections/:name': 'permissions.collection.update',
  'DELETE admin/permissions/collections/:name': 'permissions.collection.delete',
  // CWF-017. Changing who may call a cloud function changes what an anonymous
  // caller can make this backend DO, which is at least as reconstructable-after-
  // the-fact as a collection rule.
  'PUT admin/permissions/functions/:name': 'permissions.function.update',
  'DELETE admin/permissions/functions/:name': 'permissions.function.delete',
  'POST admin/roles': 'role.create',
  'DELETE admin/roles/:name': 'role.delete',
  'POST admin/roles/:name/users': 'role.user.add',
  'DELETE admin/roles/:name/users/:userId': 'role.user.remove',
  'POST admin/keys': 'apikey.create',
  'DELETE admin/keys/:id': 'apikey.revoke',
  // CWF-009. The entry records the NAME and never the value — the trail is a
  // queryable table, and a credential in one would defeat the point of a store
  // that refuses to read a value back at all. "Who provisioned STRIPE_KEY, and
  // when did it change?" is the question a live-key incident starts with.
  'PUT admin/secrets/:name': 'secret.set',
  'DELETE admin/secrets/:name': 'secret.delete',

  // Schema + data shape
  'POST api/_schema': 'schema.mutate',
  'POST admin/schema': 'schema.mutate',
  'POST admin/schema/apply': 'schema.apply',
  'POST admin/schema/diff': 'schema.diff',

  // Backups / export / import (BAK-007) — restore is the single most
  // consequential thing this service can be told to do.
  'POST admin/backups': 'backup.create',
  'PUT admin/backups/config': 'backup.config.update',
  'POST admin/backups/restore': 'backup.restore',
  'POST admin/import/:collection': 'data.import',

  // Automation (WF-005 / WF-001)
  'POST admin/triggers': 'trigger.create',
  'PUT admin/triggers/:id': 'trigger.update',
  'DELETE admin/triggers/:id': 'trigger.delete',
  'POST admin/triggers/:id/enabled': 'trigger.enabled.set',
  'POST admin/triggers/:id/fire': 'trigger.fire',
  // WFA-008: the one trigger action that breaks working integrations on purpose,
  // so it is exactly the entry an operator goes looking for afterwards ("why did
  // every hook from Stripe start failing at 14:06?").
  'POST admin/triggers/:id/secret': 'trigger.secret.rotate',
  'POST admin/workflow-defs': 'workflow.create',
  'PUT admin/workflow-defs/:id': 'workflow.update',
  'DELETE admin/workflow-defs/:id': 'workflow.delete',
  'POST admin/workflow-defs/:id/run': 'workflow.run',
  'POST admin/workflow-runs/:executionId/cancel': 'workflow.cancel',
  'PUT admin/workflows/:name': 'workflow.file.update',
  'DELETE admin/workflows/:name': 'workflow.file.delete',
  'POST admin/workflows/reload': 'workflow.reload',

  // Configuration surfaces
  'PUT admin/email/config': 'email.config.update',
  'POST admin/email/test': 'email.test-send',
  'PUT admin/email/templates/:id': 'email.template.update',
  'DELETE admin/email/templates/:id': 'email.template.delete',
  'PUT admin/files/config': 'files.config.update',
  'POST admin/files/sweep': 'files.sweep',
  'PUT admin/search/collections/:name': 'search.collection.update',
  'DELETE admin/search/collections/:name': 'search.collection.delete',
  'POST admin/search/collections/:name/rebuild': 'search.rebuild',
  'PUT admin/ops': 'ops.config.update',

  // Sign-in providers (BAK-004). Changing a provider's client id, or adding an
  // issuer, changes WHO can obtain a session on this backend — which is the
  // definition of something an operator must be able to reconstruct afterwards.
  'PUT admin/auth': 'auth.config.update',
  'PUT admin/auth/providers/:id': 'auth.provider.update',
  'DELETE admin/auth/providers/:id': 'auth.provider.delete'
};

/**
 * Privileged routes that are DELIBERATELY not audited, with the reason. Listed
 * rather than silently absent so the coverage test can tell "considered and
 * excluded" from "forgotten", which is the whole point of the test.
 */
const NOT_AUDITED: Record<string, string> = {
  // A server-side dry run: it answers "what would the rules decide?" and
  // changes nothing. It is a read that happens to need a body.
  'POST admin/permissions/check': 'dry run — changes nothing',
  // WFA-007's dry run, exactly the same shape as the one above: it answers
  // "would you accept this definition?" and writes nothing — deliberately, since
  // that is the whole reason it exists separately from POST/PUT workflow-defs,
  // which ARE audited as workflow.create / workflow.update. The editor's review
  // surface calls it on every proposal it opens and again on every accept, so
  // auditing it would bury the two entries an operator actually wants.
  'POST admin/workflow-defs/validate': 'dry run — changes nothing'
};

/** Why a privileged route is exempt from the trail, or null if it is not exempt. */
export function auditExemptionFor(method: string, pattern: string): string | null {
  return NOT_AUDITED[`${method} ${pattern}`] || null;
}

/** Actions raised by the dispatcher itself rather than by a route. */
export const AUDIT_LOGIN_SUCCESS = 'admin.login';
export const AUDIT_LOGIN_FAILURE = 'admin.login.failed';

/**
 * Actions raised by a HANDLER rather than by the route table (BAK-004).
 *
 * These are the exception to "the dispatcher writes the entry", and the reason
 * is that the route (`GET /oauth/:provider/callback`) is public and unaudited
 * by class, while the EVENT inside it — an end user obtaining a session, or an
 * account's password being revoked by the linking rule — is exactly what an
 * operator investigating an account dispute needs to see. The dispatcher cannot
 * know either happened; only the handler can.
 */
export const AUDIT_AUTH_SIGN_IN = 'auth.signin';
export const AUDIT_AUTH_CREDENTIALS_REVOKED = 'auth.link.credentials-revoked';

/**
 * Actions raised by a CLOUD FUNCTION rather than by a route (CWF-015).
 *
 * The same exception as BAK-004's above, one level further in. `POST
 * /functions/:name` is a single route whose action is whatever the graph does,
 * so the dispatcher cannot know an account was created inside it; only
 * `users/SystemUsers` can. "Who created this account?" is the first question
 * asked after an account nobody recognises turns up, and without these entries
 * the honest answer would be "some cloud function, at some point".
 *
 * ⚠️ **`actorKind` is `'system'` and `actor` is `'cloud-function'`, not the
 * function's name.** Functions run concurrently in one process, so a
 * process-global "the function currently running" would be wrong under exactly
 * the load where the trail matters. The per-run attribution already exists and
 * is the execution history (`executions.sqlite`), which records the function
 * name, the request and the outcome of every call; these entries are what point
 * at the window to look in.
 */
export const AUDIT_SYSTEM_USER_CREATE = 'user.system.create';
export const AUDIT_SYSTEM_USER_UPDATE = 'user.system.update';
export const AUDIT_SYSTEM_USER_DELETE = 'user.system.delete';

/**
 * Role membership written by a cloud function (F86), and named separately from
 * the `role.*` entries above on purpose.
 *
 * `role.user.add` is an operator clicking in the Permissions panel; this is a
 * *graph* granting privilege, at whatever rate its function is called. They are
 * the same effect through two very different doors, and an operator asking "who
 * made this account staff?" needs to be able to tell them apart in one filter
 * rather than by reading actor columns.
 *
 * ⚠️ Membership in a role is the ONLY way a `_User` row acquires privilege on
 * this backend (`SecurityState.rolesForUser`; admin authority is a credential,
 * not a row). So these three are the highest-value entries the system-side
 * families write — higher than `user.system.create`, which by construction
 * creates an account with no privilege at all.
 */
export const AUDIT_SYSTEM_ROLE_CREATE = 'role.system.create';
export const AUDIT_SYSTEM_ROLE_USER_ADD = 'role.system.user.add';
export const AUDIT_SYSTEM_ROLE_USER_REMOVE = 'role.system.user.remove';

/** The declared action for a route, or null when the route is not audited. */
export function auditActionFor(method: string, pattern: string): string | null {
  return ACTIONS[`${method} ${pattern}`] || null;
}

/**
 * Does this route need a declared action? A privileged (admin-gated) route that
 * changes state does. Everything else — reads, and the CLP-gated data routes,
 * whose per-record history is the database's job and not an audit trail's —
 * does not.
 */
export function requiresAuditAction(method: string, accessKind: string): boolean {
  if (accessKind !== 'admin') return false;
  return method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS';
}

/** Every declared action name — the dashboard's filter list and the docs. */
export function declaredAuditActions(): string[] {
  return [
    ...new Set([
      ...Object.values(ACTIONS),
      AUDIT_LOGIN_SUCCESS,
      AUDIT_LOGIN_FAILURE,
      AUDIT_AUTH_SIGN_IN,
      AUDIT_AUTH_CREDENTIALS_REVOKED,
      AUDIT_SYSTEM_USER_CREATE,
      AUDIT_SYSTEM_USER_UPDATE,
      AUDIT_SYSTEM_USER_DELETE,
      AUDIT_SYSTEM_ROLE_CREATE,
      AUDIT_SYSTEM_ROLE_USER_ADD,
      AUDIT_SYSTEM_ROLE_USER_REMOVE
    ])
  ].sort();
}
