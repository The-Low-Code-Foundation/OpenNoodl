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
  | { op: 'list'; userId?: unknown }
  | { op: 'members'; role?: unknown; limit?: unknown; skip?: unknown };

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
  /**
   * `members` only: the ids in this role, for the requested page.
   *
   * ⚠️ Distinct from `roles` above and the two must never be conflated: `roles`
   * answers *which roles is this user in*, `userIds` answers *who is in this
   * role*. They are the two directions of one junction and this module was, up
   * to DEF-005, only able to walk it one way.
   */
  userIds?: string[];
  /** `members` only: the wire records for `userIds`, in the same order. */
  users?: Record<string, unknown>[];
  /**
   * `members` only: how many members the role has IN TOTAL, before `limit`.
   *
   * 🔴 Reported separately so a clipped page is legible as one. A member list
   * that silently showed the first hundred of four hundred would be the
   * "nothing is silently missing" failure in the exact screen this operation
   * exists to draw.
   */
  total?: number;
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
 * How many members `members` returns when the graph does not say.
 *
 * A number rather than "all of them" because the record fan-out is N fetches
 * and a role can hold every account on the backend; a hundred is a screenful
 * with room to spare, and `total` always tells the truth about what was
 * clipped.
 */
export const DEFAULT_MEMBER_PAGE = 100;

/**
 * Read a paging port that may hold anything.
 *
 * ⚠️ An unset port arrives as `undefined`, and a Number node's unconnected
 * output can arrive as `0` — so `0` for a limit means "the author wired
 * nothing meaningful", not "return no rows". Answering an empty page there
 * would be a member list that renders blank because of a port nobody touched.
 * Numeric strings are accepted because a Request parameter is a string.
 */
function boundedInt(value: unknown, fallback: number, minimumMeaningful: number): number {
  const n = typeof value === 'string' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) return fallback;
  const floored = Math.floor(n);
  return floored < minimumMeaningful ? fallback : floored;
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
      case 'members':
        return this.members(request);
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

  // ==========================================================================
  // members — DEF-005 (b), the inverse of `list`
  // ==========================================================================

  /**
   * Who is in this role? A read, so it audits nothing — the same stance
   * `list` and `audit-actions.ts` take for every other read here.
   *
   * ## Why this exists
   *
   * `list` answers "which roles is this user in". **There was no inverse**, so
   * *"show me the member list"* — the most ordinary screen in a membership app
   * — could not be built at all except by maintaining a projection collection
   * that duplicates `_Role` and goes stale the first time somebody changes a
   * role by hand. TPL-001 ships without its member list for exactly this
   * reason.
   *
   * ## Paging is not a nicety
   *
   * The junction read is one indexed lookup, but turning ids into records is
   * N fetches, and a role can hold every account on the backend. An unpaged
   * version would have a cliff in it that only appears once somebody is
   * successful. `total` is the full count and `userIds`/`users` are the page,
   * so a graph can always tell a complete list from a first page.
   *
   * ## `Unchanged` is "the role is empty"
   *
   * The same reading `list` gives for a user in no roles: "there is nobody
   * here" is the branch a member-list screen wants to take, and an empty array
   * on a `Done` wire is the shape that gets mistaken for a port nobody
   * connected. ⚠️ A role that does not EXIST is a Failure rather than an empty
   * list — the same call that would be a typo, and `add` refuses it for the
   * same reason.
   */
  private async members(request: Extract<SystemRoleRequest, { op: 'members' }>): Promise<SystemRoleResult> {
    const name = optionalString(request.role);
    if (!name) {
      return fail('role/name-required', 'List Users In Role: a Role is required.');
    }
    if (!isValidRoleName(name)) {
      return fail(
        'role/invalid-name',
        `List Users In Role: "${name}" is not a usable role name. ${ROLE_NAME_RULE}.`
      );
    }

    const role = await this.roles.find(name);
    if (!role) {
      // ⚠️ NOT an empty list. `remove` can read "no such role" as the goal
      // already met, because nobody being in a role that does not exist is
      // true. Here the honest answer to "who is in it" is that the question
      // does not resolve — and answering `[]` would draw an empty member list
      // for a misspelled role, which looks exactly like a community nobody has
      // joined yet.
      return fail(
        'role/not-found',
        `There is no role named "${name}". Create it in the editor's Permissions panel, where the rules that ` +
          'grant through it are written too.'
      );
    }

    const all = this.roles.members(role);
    const skip = boundedInt(request.skip, 0, 0);
    // `1`, not `DEFAULT_MEMBER_PAGE`: a limit of 5 is a limit of 5. Only a
    // value that cannot mean a page — 0, negative, unparseable — falls back.
    const limit = boundedInt(request.limit, DEFAULT_MEMBER_PAGE, 1);
    const page = all.slice(skip, skip + limit);

    const users: Record<string, unknown>[] = [];
    const present: string[] = [];
    for (const userId of page) {
      let row: Record<string, unknown>;
      try {
        row = await this.facade.rawFetch('_User', userId);
      } catch {
        // ⚠️ A junction row whose user is gone is skipped rather than fatal.
        // `Delete User` does not sweep memberships, so this is a state the
        // product can genuinely be in, and failing the whole page would make
        // one deleted account hide every remaining member.
        continue;
      }
      present.push(userId);
      // `wireRecord` is what `/login` and `/users/me` answer with, so the rows
      // a member list gets are shaped like the row the `User` node already
      // reads — and `_hashed_password` is stripped by the same code path
      // rather than by a second rule here that could drift from it.
      users.push(await this.facade.wireRecord('_User', row));
    }

    return {
      outcome: all.length > 0 ? 'done' : 'unchanged',
      code: all.length > 0 ? undefined : 'role/no-members',
      error: all.length > 0 ? undefined : `The role "${name}" has no members.`,
      role: name,
      userIds: present,
      users,
      total: all.length
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
