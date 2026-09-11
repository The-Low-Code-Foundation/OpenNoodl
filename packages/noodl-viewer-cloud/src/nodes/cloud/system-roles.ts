/**
 * The shared half of the four role-membership nodes (F86, plus DEF-005 b).
 *
 * ## ⚠️ Cloud only, and this family is the reason the rule exists
 *
 * Registered in `noodl-viewer-cloud/src/nodes/index.ts` beside Request, Response,
 * Secret and the CWF-015 user family — and NOT in `@noodl/runtime`'s shared
 * list, which reaches every runtime. For Create User the browser mistake would
 * be "account creation in the hands of everyone who opens the page". Here it is
 * worse and simpler: **role membership is the only way a `_User` row acquires
 * privilege on this backend**, so an Add User To Role node in a browser bundle
 * is one wire from a button to "make me staff". There is no client-side design
 * of this node that is safe, which is why there is no client-side version of it.
 *
 * The generated catalog records `availableIn: ["cloud"]`; if it ever says
 * `browser`, the registration moved and the escalation shipped.
 *
 * ## What actually gates it
 *
 * Nothing in this file. The seam is the `_noodl_system_roles` process global,
 * which exists only inside a `nodegx-backend` process — so the only way to reach
 * these operations is a cloud function, and the gate is that function's own
 * `functions.<name>.call` rule (CWF-017, the Permissions panel).
 *
 * ⚠️ **A function holding these nodes with no rule falls back to the graph's
 * `Allow Unauthenticated` port.** Ticked means `public`. Set the rule.
 *
 * ## Roles are flat
 *
 * A role holds users, not roles. Parse allowed role-in-role; this backend's
 * membership resolver (`SecurityState.rolesForUser`) is a single non-recursive
 * JOIN, so a nested edge would be stored and never resolved. Nothing here
 * offers to write one.
 */

import { reportOutcomes } from '@noodl/runtime/src/outcome';

/** What `_noodl_system_roles` answers with — see nodegx-backend `roles/SystemRoles.ts`. */
export interface SystemRoleResult {
  outcome: 'done' | 'unchanged' | 'failure';
  code?: string;
  error?: string;
  role?: string;
  userId?: string;
  roles?: string[];
  roleCreated?: boolean;
  /** `members` only (DEF-005 b) — who is in the role, rather than which roles a user is in. */
  userIds?: string[];
  /** `members` only — the wire records for `userIds`, in the same order. */
  users?: Record<string, unknown>[];
  /** `members` only — the whole membership count, before `limit`. */
  total?: number;
}

/** The message every one of these nodes gives when it is not running in a backend. */
export const NO_BACKEND_MESSAGE =
  'no role store is available. This node only works inside a nodegx-backend cloud function — role ' +
  'membership is the only way an account gains privilege, so it is never writable from the browser.';

/* eslint-disable @typescript-eslint/no-explicit-any */
/** The subset of the runtime node instance these helpers touch. */
interface NodeLike {
  _internal: Record<string, any>;
  flagOutputDirty(name: string): void;
  scheduleAfterInputsHaveUpdated(cb: () => void): void;
  [key: string]: any;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Publish on `Error` and settle every invocation in this batch as a failure.
 *
 * `tokens` is passed rather than read back from `_internal`, for the reason
 * ERG-001 §4 gives: an outcome must not be inferred from state a branch has
 * already changed.
 */
export function setError(this: NodeLike, code: string, message: string, tokens: unknown[]): void {
  this._internal.error = message;
  this.flagOutputDirty('error');
  reportOutcomes(this as never, (tokens || []) as never[], 'failure', { code, message });
}

/**
 * The one call into the backend, shared by all four nodes.
 *
 * ⚠️ **The result's `outcome` is reported verbatim.** "Already a member", "was
 * not in it" and "there is no such role" are decided at the end that knows; a
 * node re-deriving them from a `code` string would be three nodes each
 * re-deriving them, and the first divergence would be a re-run signup reported
 * as a hard failure on one node and a no-op on another.
 */
export function callSystemRoles(
  this: NodeLike,
  label: string,
  request: Record<string, unknown>,
  tokens: unknown[],
  onDone: (result: SystemRoleResult) => void
): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const systemRoles = (globalThis as any)._noodl_system_roles;
  if (typeof systemRoles !== 'function') {
    // The same two-case split as Send Email, Secret and the user family: absent
    // means "this graph is not running inside nodegx-backend at all", which is a
    // different problem from "running here and the operation was refused".
    setError.call(this, 'role/no-backend', `${label}: ${NO_BACKEND_MESSAGE}`, tokens);
    return;
  }

  Promise.resolve(systemRoles(request))
    .then((result: SystemRoleResult) => {
      if (!result || !result.outcome) {
        setError.call(this, 'role/no-answer', 'The backend gave no answer to this role operation.', tokens);
        return;
      }
      if (result.outcome === 'failure') {
        setError.call(this, result.code || 'role/failed', result.error || 'The role operation failed.', tokens);
        return;
      }
      this._internal.error = result.outcome === 'unchanged' ? result.error : undefined;
      this.flagOutputDirty('error');
      onDone(result);
      reportOutcomes(this as never, tokens as never[], result.outcome);
    })
    .catch((e: unknown) => {
      // Deliberately does NOT forward a thrown value's own shape: a store that
      // throws mid-write must not get to choose the message an author reads.
      setError.call(
        this,
        'role/failed',
        `The role operation failed: ${e instanceof Error ? e.message : String(e)}`,
        tokens
      );
    });
}

/**
 * The coalescing scheduler every one of these nodes uses for its action port.
 *
 * ⚠️ The pending array is created lazily rather than in `initialize`, for the
 * reason Send Email, Secret and the user family all record: several suites build
 * a node as a bag of bound methods and never call `initialize`, and an eager
 * field is `undefined` exactly where the first invocation reads it.
 */
export function scheduleAction(this: NodeLike, token: unknown, run: () => void): void {
  if (token) {
    if (!this._internal.pendingOutcomes) this._internal.pendingOutcomes = [];
    this._internal.pendingOutcomes.push(token);
  }
  if (this._internal.actionScheduled) return;
  this._internal.actionScheduled = true;
  this.scheduleAfterInputsHaveUpdated(() => {
    this._internal.actionScheduled = false;
    run();
  });
}

/**
 * Drain the batch into a local *before* the request starts, so a second pulse
 * arriving mid-flight owns its own batch rather than being settled by this
 * request's answer.
 */
export function drainOutcomes(this: NodeLike): unknown[] {
  const tokens = this._internal.pendingOutcomes || [];
  this._internal.pendingOutcomes = undefined;
  return tokens;
}

/**
 * The `User Id` input, identical on all three nodes.
 *
 * ⚠️ There is deliberately no "the current user" fallback. A node that added
 * *whoever called the function* to a role would be the escalation this family is
 * shaped against, so a blank id is a Failure with a sentence and never a write.
 */
export const userIdInput = {
  group: 'General',
  displayName: 'User Id',
  type: 'string',
  description:
    'Object id of the account to act on, usually wired from Create User or a Request parameter; blank is a ' +
    'Failure rather than a fallback to whoever called the function',
  set: function (this: NodeLike, value: unknown) {
    this._internal.userId = value;
  }
};

/**
 * The `Roles` output — on the three nodes that answer *which roles is this user
 * in*. ⚠️ **Not on List Users In Role**, which walks the junction the other way
 * and answers with `Users`; the two must not be confused for one port.
 */
export const rolesOutput = {
  group: 'Roles',
  displayName: 'Roles',
  type: 'array',
  description:
    'Every role this user is in once the operation has finished, read back through the same resolver the ' +
    'access check itself uses',
  getter: function (this: NodeLike) {
    return this._internal.roles;
  }
};

/** The `Error` output, identical on all four nodes. */
export const errorOutput = {
  displayName: 'Error',
  type: 'string',
  group: 'Error',
  description: 'Why the last operation could not be performed',
  getter: function (this: NodeLike) {
    return this._internal.error;
  }
};

/** Publish the two outputs every result carries. Called from each node's `onDone`. */
export function publishResult(this: NodeLike, result: SystemRoleResult): void {
  this._internal.roles = result.roles || [];
  this.flagOutputDirty('roles');
}
