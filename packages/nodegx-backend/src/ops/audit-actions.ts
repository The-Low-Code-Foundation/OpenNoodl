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
  'POST admin/roles': 'role.create',
  'DELETE admin/roles/:name': 'role.delete',
  'POST admin/roles/:name/users': 'role.user.add',
  'DELETE admin/roles/:name/users/:userId': 'role.user.remove',
  'POST admin/keys': 'apikey.create',
  'DELETE admin/keys/:id': 'apikey.revoke',

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
  'PUT admin/ops': 'ops.config.update'
};

/**
 * Privileged routes that are DELIBERATELY not audited, with the reason. Listed
 * rather than silently absent so the coverage test can tell "considered and
 * excluded" from "forgotten", which is the whole point of the test.
 */
const NOT_AUDITED: Record<string, string> = {
  // A server-side dry run: it answers "what would the rules decide?" and
  // changes nothing. It is a read that happens to need a body.
  'POST admin/permissions/check': 'dry run — changes nothing'
};

/** Why a privileged route is exempt from the trail, or null if it is not exempt. */
export function auditExemptionFor(method: string, pattern: string): string | null {
  return NOT_AUDITED[`${method} ${pattern}`] || null;
}

/** Actions raised by the dispatcher itself rather than by a route. */
export const AUDIT_LOGIN_SUCCESS = 'admin.login';
export const AUDIT_LOGIN_FAILURE = 'admin.login.failed';

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
  return [...new Set([...Object.values(ACTIONS), AUDIT_LOGIN_SUCCESS, AUDIT_LOGIN_FAILURE])].sort();
}
