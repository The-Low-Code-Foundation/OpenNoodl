/**
 * Putting a user in a role **as the system**, from inside a cloud function
 * (F86).
 *
 * ## ⚠️ Why this is not part of `users/SystemUsers.ts`
 *
 * Read that file's header before this one. Its safety property #2 is that it
 * writes **neither `_Role` nor `_Join_users__Role`**, never calls `addRelation`,
 * and that a user it creates resolves to `roles: []` — which is what makes "a
 * node that can create a user" provably not "a node that can create an admin".
 * That property is asserted in `tests/cloud-system-users.test.ts`, and folding
 * role writes into that module would have quietly invalidated it.
 *
 * So this is a **separate, deliberately-named** door. `SystemUsers` still writes
 * no roles; this module, and only this module, does. An auditor asking "what in
 * this process can grant privilege to an account?" gets one file as the answer,
 * and it is this one.
 *
 * ## Why it is cloud-only, and what actually gates it (F86 design question 1)
 *
 * **A browser node that adds the current user to a role is a
 * privilege-escalation primitive** — one wire from a button to "make me an
 * admin". Role mutation is therefore backend-authoritative: these operations
 * are reachable only through the `_noodl_system_roles` process global, which
 * exists only inside a `nodegx-backend` process, which means the only way to
 * reach them is from a graph running as a cloud function. That function's own
 * `functions.<name>.call` rule (CWF-017, the Permissions panel) is the gate —
 * exactly the CWF-015 pattern, one door and not two.
 *
 * ⚠️ **Which makes that rule load-bearing.** A function holding these nodes with
 * no rule falls back to the graph's `Allow Unauthenticated` port: ticked means
 * `public`, and `public` on a function holding Add User To Role is
 * self-service role membership for the open internet. That is the same warning
 * CWF-015 carries and it is not weaker here — it is stronger, because a role is
 * the only way a `_User` row acquires privilege at all.
 *
 * ## Roles are flat (F86 design question 2)
 *
 * A role holds users, not roles. `SecurityState.rolesForUser` is a single
 * non-recursive JOIN, so a role-in-role edge would be stored and never
 * resolved. Parse allowed nesting; this backend does not, and the change would
 * start at that JOIN. Recorded rather than implemented — see `RoleStore`.
 *
 * ## Creating a role is not granting anything
 *
 * A role nothing references is inert: privilege comes from a *rule* naming it
 * (`role:member` in a CLP, a function's `call`, or a record's ACL), and rules
 * are written in the Permissions panel and nowhere else. Nothing here can write
 * a rule. So `createRole` below widens the role table and never the policy.
 *
 * @module nodegx-backend/roles/SystemRoles
 */

import {
  AUDIT_SYSTEM_ROLE_CREATE,
  AUDIT_SYSTEM_ROLE_USER_ADD,
  AUDIT_SYSTEM_ROLE_USER_REMOVE
} from '../ops/audit-actions';
import type { AdapterFacade } from '../persistence/AdapterFacade';
import { ROLE_NAME_RULE, RoleStore, isValidRoleName } from './RoleStore';

/**
 * What a node asks for. One entry point with an `op` rather than three globals:
 * one door is one place to audit, and one place a future reader has to read.
 * The idiom is `SystemUsers`', and the shape is deliberately the same.
 */
export type SystemRoleRequest =
  | { op: 'add'; role?: unknown; userId?: unknown; createRole?: unknown }
  | { op: 'remove'; role?: unknown; userId?: unknown }
  | { op: 'list'; userId?: unknown };

/**
 * What every operation answers with.
 *
 * `outcome` is the outcome contract's own vocabulary rather than a boolean, for
 * the reason `SystemUserResult` gives: "they were already a member" and "they
 * were not in it to begin with" are neither failures nor fresh successes, and a
 * node re-deriving that from a `code` string would be three nodes each
 * re-deriving it.
 */
export interface SystemRoleResult {
  outcome: 'done' | 'unchanged' | 'failure';
  /** Machine-readable reason, for the `failure`/`unchanged` branches. */
  code?: string;
  /** Human-readable reason. */
  error?: string;
  role?: string;
  userId?: string;
  /**
   * Every role this user is in **after** the operation, resolved through
   * `SecurityState.rolesForUser` — the same function the access check itself
   * calls. A separate query here could have answered "member" while
   * enforcement disagreed; this cannot.
   */
  roles?: string[];
  /** `add` only: whether this call created the role as well as the membership. */
  roleCreated?: boolean;
}

export interface SystemRolesDeps {
  facade: AdapterFacade;
  /**
   * ⚠️ Must be `SecurityState.rolesForUser` itself, not a re-implementation.
   * The `Roles` output exists to answer "did the membership take effect?", and
   * an answer from a second resolver would be an answer about a different
   * question.
   */
  rolesForUser(userId: string): string[];
  /** Called after every write, for the audit trail. Never throws. */
  onAudit?(entry: { action: string; outcome: 'success' | 'failure'; target: Record<string, unknown> }): void;
}

function fail(code: string, error: string): SystemRoleResult {
  return { outcome: 'failure', code, error };
}

/** A non-empty string, or undefined. */
function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * The three system-scoped role operations, over the same `RoleStore` the admin
 * routes use. No route, no session.
 *
 * ⚠️ **Nothing here touches the runtime's current user.** Every operation
 * addresses a user by id; there is no fallback to "whoever called", because a
 * node that added *the caller* to a role would be the escalation this module is
 * shaped against.
 */
export class SystemRoles {
  private readonly roles: RoleStore;
  private readonly facade: AdapterFacade;
  private readonly rolesForUser: SystemRolesDeps['rolesForUser'];
  private readonly onAudit: SystemRolesDeps['onAudit'];

  constructor(deps: SystemRolesDeps) {
    this.facade = deps.facade;
    this.roles = new RoleStore(deps.facade);
    this.rolesForUser = deps.rolesForUser;
    this.onAudit = deps.onAudit;
  }

  async handle(request: SystemRoleRequest): Promise<SystemRoleResult> {
    if (!request || typeof request !== 'object') {
      return fail('role/invalid-request', 'No request was given.');
    }
    switch (request.op) {
      case 'add':
        return this.add(request);
      case 'remove':
        return this.remove(request);
      case 'list':
        return this.list(request);
      default:
        return fail('role/unknown-op', `Unknown role operation "${String((request as { op: string }).op)}".`);
    }
  }

  // ==========================================================================
  // add
  // ==========================================================================

  private async add(request: Extract<SystemRoleRequest, { op: 'add' }>): Promise<SystemRoleResult> {
    const name = optionalString(request.role);
    if (!name) {
      return fail('role/name-required', 'Add User To Role: a Role is required.');
    }
    if (!isValidRoleName(name)) {
      return fail('role/invalid-name', `Add User To Role: "${name}" is not a usable role name. ${ROLE_NAME_RULE}.`);
    }

    const userId = optionalString(request.userId);
    if (!userId) {
      return fail(
        'role/user-id-required',
        'Add User To Role: a User Id is required. This node never falls back to the caller — it adds the ' +
          'user you name and nobody else.'
      );
    }

    // The user must exist. A membership for an id nothing resolves would read
    // back as stored and grant nothing, which is the failure mode this whole
    // finding is about: a rule that says `role:member` and a member who is not
    // a user.
    try {
      await this.facade.rawFetch('_User', userId);
    } catch {
      return fail('role/user-not-found', `There is no user with the id "${userId}".`);
    }

    let role = await this.roles.find(name);
    let roleCreated = false;
    if (!role) {
      // ⚠️ **Auto-create is opt-in, and off by default.** A role is named in
      // two places — the rule that grants through it, and the call that fills
      // it — and those two places are written by different people at different
      // times. Creating on demand would turn a typo into a role that exists,
      // has a member, and is named by no rule: a grant that silently never
      // happens. Refusing names the role instead, which is a fix. The port is
      // there for the case that is genuinely not a typo: a function deployed to
      // a fresh backend where nobody has opened the Permissions panel yet.
      if (request.createRole !== true) {
        return fail(
          'role/not-found',
          `There is no role named "${name}". Create it in the editor's Permissions panel — where the rules ` +
            'that grant through it are written too — or tick Create Role If Missing on this node.'
        );
      }
      const ensured = await this.roles.ensure(name);
      role = ensured.role;
      roleCreated = ensured.created;
      if (roleCreated) this.audit(AUDIT_SYSTEM_ROLE_CREATE, 'success', { role: name });
    }

    let added: boolean;
    try {
      added = await this.roles.addMember(role, userId);
    } catch (e) {
      return fail('role/add-failed', `Add User To Role: ${e instanceof Error ? e.message : String(e)}`);
    }

    if (added) this.audit(AUDIT_SYSTEM_ROLE_USER_ADD, 'success', { role: name, userId, roleCreated });

    return {
      // Already a member is the post-condition already holding, which is what
      // `Unchanged` is for — a signup function re-run must not go red.
      outcome: added ? 'done' : 'unchanged',
      code: added ? undefined : 'role/already-member',
      error: added ? undefined : `That user is already in the role "${name}".`,
      role: name,
      userId,
      roleCreated,
      roles: this.rolesForUser(userId)
    };
  }

  // ==========================================================================
  // remove
  // ==========================================================================

  private async remove(request: Extract<SystemRoleRequest, { op: 'remove' }>): Promise<SystemRoleResult> {
    const name = optionalString(request.role);
    if (!name) {
      return fail('role/name-required', 'Remove User From Role: a Role is required.');
    }
    const userId = optionalString(request.userId);
    if (!userId) {
      return fail(
        'role/user-id-required',
        'Remove User From Role: a User Id is required. This node never falls back to the caller.'
      );
    }

    const role = await this.roles.find(name);
    if (!role) {
      // Not a failure: with no such role the user is provably not in it, which
      // is the goal already met. The same reading `Delete User` gives an id
      // that is already gone.
      return {
        outcome: 'unchanged',
        code: 'role/not-found',
        error: `There is no role named "${name}", so nobody is in it.`,
        role: name,
        userId,
        roles: this.rolesForUser(userId)
      };
    }

    let was: boolean;
    try {
      was = await this.roles.removeMember(role, userId);
    } catch (e) {
      return fail('role/remove-failed', `Remove User From Role: ${e instanceof Error ? e.message : String(e)}`);
    }

    if (was) this.audit(AUDIT_SYSTEM_ROLE_USER_REMOVE, 'success', { role: name, userId });

    return {
      outcome: was ? 'done' : 'unchanged',
      code: was ? undefined : 'role/not-a-member',
      error: was ? undefined : `That user was not in the role "${name}".`,
      role: name,
      userId,
      roles: this.rolesForUser(userId)
    };
  }

  // ==========================================================================
  // list
  // ==========================================================================

  /**
   * Which roles is this user in? A read, so it audits nothing — the same stance
   * `audit-actions.ts` states for every other read on this backend.
   *
   * `Unchanged` for a user with no roles rather than `Done` with an empty list:
   * "this user is in nothing" is the branch a function checking membership
   * wants to take, and an empty stringlist on a `Done` wire is the shape that
   * gets mistaken for "not wired yet".
   */
  private async list(request: Extract<SystemRoleRequest, { op: 'list' }>): Promise<SystemRoleResult> {
    const userId = optionalString(request.userId);
    if (!userId) {
      return fail('role/user-id-required', 'Get User Roles: a User Id is required.');
    }

    try {
      await this.facade.rawFetch('_User', userId);
    } catch {
      return fail('role/user-not-found', `There is no user with the id "${userId}".`);
    }

    const roles = this.rolesForUser(userId);
    return {
      outcome: roles.length > 0 ? 'done' : 'unchanged',
      code: roles.length > 0 ? undefined : 'role/no-roles',
      error: roles.length > 0 ? undefined : 'That user is in no roles.',
      userId,
      roles
    };
  }

  private audit(action: string, outcome: 'success' | 'failure', target: Record<string, unknown>): void {
    if (!this.onAudit) return;
    try {
      this.onAudit({ action, outcome, target });
    } catch {
      // An audit write must never turn a successful membership change into a
      // failure the author has to reason about. `AuditLog.record` already
      // swallows its own errors; this is the second layer.
    }
  }
}
