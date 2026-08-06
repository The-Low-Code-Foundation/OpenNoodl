/**
 * Creating and administering user accounts **as the system**, from inside a
 * cloud function (CWF-015).
 *
 * ## Why this is not the `/users` routes
 *
 * The wire already has `POST /users`, `PUT /users/:id` and `GET /users/me`
 * (`server/users.ts`), and none of the three is usable for this:
 *
 *  - `POST /users` **mints a session** and answers with its token. A node built
 *    on it could hand its caller a logged-in session for an account it had just
 *    created — which is precisely the escalation this task exists not to ship.
 *  - `PUT /users/:id` refuses any id but the caller's own (`Cannot modify
 *    another user.`, code 206). "Set the properties of user X" cannot be
 *    expressed through it at all.
 *  - Both are *session*-shaped. A cloud function is not a session; it is one
 *    process answering many requests concurrently, which is the whole reason
 *    Log In / Log Out / Sign Up have no server-side node.
 *
 * So this module is a small server-shaped API over the same database, reached
 * through the same process-global idiom the Secret node (CWF-009) and Send
 * Email (BAK-002) already use. **It adds no HTTP route.** The only way in is
 * from a graph running inside this process, which means the only gate that
 * matters is CWF-017's per-function `call` rule — one door, not two.
 *
 * ## What stops "a node that can create a user" being "a node that can create an admin"
 *
 * Four things, and they are checked rather than asserted
 * (`tests/cloud-system-users.test.ts`):
 *
 *  1. **There is no admin user.** Admin authority on this backend is a
 *     *credential* — `security.adminToken`, matched by
 *     `SecurityState.matchAdminCredential` — never a `_User` row and never a
 *     column on one. No row this module can write is an admin.
 *  2. **Privilege for a user comes only from a role**, and roles live in
 *     `_Role` + the `_Join_users__Role` junction (`SecurityState.rolesForUser`).
 *     Nothing here writes either table, and nothing here calls `addRelation`.
 *     A user this module creates resolves to `roles: []`, so every `role:` rule
 *     denies it.
 *  3. **Protected keys are REFUSED, not stripped.** `POST /users` quietly
 *     `delete`s `ACL` and `_method`; a system-privileged node must be louder
 *     than that, because a silently-dropped `ACL` is an author who believes
 *     they set one. See {@link PROTECTED_PROPERTY_KEYS}.
 *  4. **No session is ever minted.** `create` writes a `_User` row and stops.
 *     There is no session token in any result this module returns, so a
 *     function cannot answer its caller with one.
 *
 * None of that is a substitute for the access rule. A function holding these
 * nodes must carry `functions.<name>.call` in `security.json` (CWF-017's
 * Permissions panel writes it); with nothing configured the rule falls back to
 * the graph's `Allow Unauthenticated` port, which means **any signed-in user**
 * at best and **anyone at all** at worst.
 *
 * @module nodegx-backend/users/SystemUsers
 */

import type { AdapterFacade } from '../persistence/AdapterFacade';
import {
  AUDIT_SYSTEM_USER_CREATE,
  AUDIT_SYSTEM_USER_DELETE,
  AUDIT_SYSTEM_USER_UPDATE
} from '../ops/audit-actions';
import { hashPassword } from '../server/users';

/**
 * What a node asks for. One entry point with an `op` rather than four globals:
 * one door is one place to audit, and one place a future reader has to read.
 */
export type SystemUserRequest =
  | { op: 'create'; username?: unknown; email?: unknown; password?: unknown; emailVerified?: unknown; properties?: unknown }
  | { op: 'update'; userId?: unknown; password?: unknown; properties?: unknown }
  | { op: 'delete'; userId?: unknown }
  | { op: 'verifyToken'; token?: unknown };

/**
 * What every operation answers with.
 *
 * `outcome` is the outcome contract's own vocabulary rather than a boolean,
 * deliberately: the interesting cases here — "that username is already taken",
 * "there is no such user", "that token is not one of ours" — are *not* failures
 * and are not successes either, and a node that had to re-derive which was
 * which from a `code` string would be four nodes each re-deriving it. The node
 * maps this field straight onto `reportOutcomes`.
 */
export interface SystemUserResult {
  outcome: 'done' | 'unchanged' | 'failure';
  /** Machine-readable reason, for the `failure`/`unchanged` branches. */
  code?: string;
  /** Human-readable reason. Never contains a password, a hash or a token. */
  error?: string;
  userId?: string;
  username?: string;
  /** `verifyToken` only. */
  valid?: boolean;
  /** `update` only: how many sessions a password change revoked. */
  sessionsRevoked?: number;
}

/**
 * Keys a graph may not put in a user's properties, and the reason each one is
 * here. A refusal names the key, so the message is a fix rather than a mystery.
 *
 * Everything beginning with `_` is refused too, by pattern rather than by list:
 * that covers `_hashed_password` (the whole point of the `Password` port),
 * `_method` (a Parse-wire verb tunnel), and `_email_verify_token` /
 * `_perishable_token` (BAK-002's single-use credentials, which `AdapterFacade`
 * already strips from every response and which nothing should be able to *set*).
 */
export const PROTECTED_PROPERTY_KEYS: Record<string, string> = {
  objectId: 'a record\'s identity is assigned by the backend',
  createdAt: 'bookkeeping the backend owns',
  updatedAt: 'bookkeeping the backend owns',
  ACL: 'row-level access — a graph that could set this could grant a new account access to anything',
  password: 'use the Password port, so the value goes through the same hash the login route verifies against',
  sessionToken: 'a session is not a property of a user, and these nodes never mint one'
};

/** `_User` columns whose value the caller supplies through a dedicated port. */
const CREATE_RESERVED_KEYS = ['username', 'email', 'emailVerified'];

export interface SystemUsersDeps {
  facade: AdapterFacade;
  /** Called after every write, for the audit trail. Never throws. */
  onAudit?(entry: { action: string; outcome: 'success' | 'failure'; target: Record<string, unknown> }): void;
}

function fail(code: string, error: string): SystemUserResult {
  return { outcome: 'failure', code, error };
}

/** A non-empty string, or undefined. Numbers and objects are not "a username". */
function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * Validate an author-supplied property bag.
 *
 * Returns the bag itself when it is usable, or a `SystemUserResult` failure.
 * `undefined` properties are dropped rather than written as NULL: a `prop-`
 * port that nothing is wired to must not blank a column.
 */
function checkProperties(
  raw: unknown,
  reservedKeys: string[]
): { ok: true; properties: Record<string, unknown> } | { ok: false; result: SystemUserResult } {
  if (raw === undefined || raw === null) return { ok: true, properties: {} };
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, result: fail('user/invalid-properties', 'Properties must be an object.') };
  }

  const properties: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value === undefined) continue;
    if (key.startsWith('_')) {
      return {
        ok: false,
        result: fail(
          'user/protected-property',
          `"${key}" cannot be set from a graph: names beginning with "_" are the backend's own columns ` +
            '(the password hash and the single-use email tokens live there).'
        )
      };
    }
    if (PROTECTED_PROPERTY_KEYS[key]) {
      return {
        ok: false,
        result: fail(
          'user/protected-property',
          `"${key}" cannot be set from a graph — ${PROTECTED_PROPERTY_KEYS[key]}.`
        )
      };
    }
    if (reservedKeys.includes(key)) {
      return {
        ok: false,
        result: fail(
          'user/duplicate-property',
          `"${key}" has its own port on this node — set it there rather than as a property, so there is ` +
            'one place it comes from.'
        )
      };
    }
    properties[key] = value;
  }
  return { ok: true, properties };
}

/**
 * The four system-scoped user operations, over the same `AdapterFacade` the
 * HTTP routes use. No route, no session, no `UserService`.
 *
 * ⚠️ **Nothing here touches the runtime's current user.** `UserService.forScope`
 * and the `Request` model belong to the request the function is answering
 * (`noodl-viewer-cloud/src/nodes/cloud/request.ts`), and every method below
 * addresses rows by id. A function that creates a user and then reads `User`
 * still sees whoever called it — asserted, not assumed.
 */
export class SystemUsers {
  private readonly facade: AdapterFacade;
  private readonly onAudit: SystemUsersDeps['onAudit'];

  constructor(deps: SystemUsersDeps) {
    this.facade = deps.facade;
    this.onAudit = deps.onAudit;
  }

  async handle(request: SystemUserRequest): Promise<SystemUserResult> {
    if (!request || typeof request !== 'object') {
      return fail('user/invalid-request', 'No request was given.');
    }
    switch (request.op) {
      case 'create':
        return this.create(request);
      case 'update':
        return this.update(request);
      case 'delete':
        return this.remove(request);
      case 'verifyToken':
        return this.verifyToken(request);
      default:
        return fail('user/unknown-op', `Unknown user operation "${String((request as { op: string }).op)}".`);
    }
  }

  // ==========================================================================
  // create
  // ==========================================================================

  private async create(request: Extract<SystemUserRequest, { op: 'create' }>): Promise<SystemUserResult> {
    const username = optionalString(request.username);
    if (!username) {
      return fail('user/username-required', 'Create User: a Username is required.');
    }

    const checked = checkProperties(request.properties, CREATE_RESERVED_KEYS);
    if (!checked.ok) return checked.result;

    const email = optionalString(request.email);
    const password = optionalString(request.password);

    // Username is the identity on this wire: `POST /login` looks a user up by
    // it and takes `results[0]`, so two rows with one username is a login that
    // answers differently depending on insertion order. Email is deliberately
    // NOT checked — this backend's own signup does not check it, and inventing
    // a stricter rule here would mean a browser Sign Up and this node disagree
    // about what "already exists" means.
    const existing = await this.facade.rawQuery('_User', { where: { username }, limit: 1 });
    if (existing.results.length > 0) {
      return {
        outcome: 'unchanged',
        code: 'user/already-exists',
        error: `A user with the username "${username}" already exists.`,
        userId: existing.results[0].objectId as string,
        username
      };
    }

    const data: Record<string, unknown> = {
      // `emailVerified` written explicitly, for the reason `server/users.ts`
      // records at length: `POST /login` reads absent as false, so leaving the
      // column unset makes "not verified" indistinguishable from "this backend
      // does not track it" for every graph that reads it.
      emailVerified: request.emailVerified === true,
      ...checked.properties,
      username
    };
    if (email !== undefined) data.email = email;
    // ⚠️ No password means NO `_hashed_password` column at all, not an empty
    // one. `verifyPassword` splits the stored value on `$` and requires three
    // parts, so an absent hash can never be matched — which is what makes an
    // invite/passwordless account (BAK-004) safe to create here.
    if (password !== undefined) data._hashed_password = hashPassword(password);

    let user: Record<string, unknown>;
    try {
      user = await this.facade.rawCreate('_User', data);
    } catch (e) {
      return fail('user/create-failed', `Create User: ${e instanceof Error ? e.message : String(e)}`);
    }

    const userId = user.objectId as string;
    this.audit(AUDIT_SYSTEM_USER_CREATE, 'success', { userId, username });
    return { outcome: 'done', userId, username };
  }

  // ==========================================================================
  // update
  // ==========================================================================

  private async update(request: Extract<SystemUserRequest, { op: 'update' }>): Promise<SystemUserResult> {
    const userId = optionalString(request.userId);
    if (!userId) {
      // The failure mode this whole node is shaped against: "accidentally
      // edited the caller instead of the target". A blank Id is a refusal, and
      // it is never read as "the current user" — there is no current user here.
      return fail(
        'user/id-required',
        'Update User: a User Id is required. This node never falls back to the caller — it writes to the ' +
          'user you name and to nobody else.'
      );
    }

    const checked = checkProperties(request.properties, []);
    if (!checked.ok) return checked.result;

    const password = optionalString(request.password);
    if (Object.keys(checked.properties).length === 0 && password === undefined) {
      return fail('user/nothing-to-write', 'Update User: no properties and no password were supplied.');
    }

    let current: Record<string, unknown>;
    try {
      current = await this.facade.rawFetch('_User', userId);
    } catch {
      return { outcome: 'failure', code: 'user/not-found', error: `There is no user with the id "${userId}".` };
    }

    // A username change that collides is a login that answers the wrong row —
    // the same reason `create` checks it. Checked before anything is written.
    const nextUsername = optionalString(checked.properties.username);
    if (nextUsername !== undefined && nextUsername !== current.username) {
      const clash = await this.facade.rawQuery('_User', { where: { username: nextUsername }, limit: 1 });
      if (clash.results.length > 0) {
        return {
          outcome: 'failure',
          code: 'user/already-exists',
          error: `Another user already has the username "${nextUsername}".`,
          userId
        };
      }
    }
    if ('username' in checked.properties && nextUsername === undefined) {
      return fail('user/username-required', 'Update User: a username cannot be set to blank.');
    }

    const data: Record<string, unknown> = { ...checked.properties };
    if (password !== undefined) data._hashed_password = hashPassword(password);

    try {
      await this.facade.rawSave('_User', userId, data);
    } catch (e) {
      return fail('user/update-failed', `Update User: ${e instanceof Error ? e.message : String(e)}`);
    }

    // ⚠️ A system-initiated password change revokes EVERY session for that
    // user, including the one that may be calling this function. `PUT
    // /users/:id` spares the session that authorized the change; there is no
    // such session here — the system is not a session — so sparing one would
    // mean picking a survivor arbitrarily. An account being reset by an
    // administrator is exactly the case where a stolen session must not live.
    let sessionsRevoked = 0;
    if (password !== undefined) {
      const { results: sessions } = await this.facade.rawQuery('_Session', { where: { userId } });
      for (const session of sessions) {
        await this.facade.rawDelete('_Session', session.objectId as string);
        sessionsRevoked++;
      }
    }

    this.audit(AUDIT_SYSTEM_USER_UPDATE, 'success', {
      userId,
      // The KEYS, never the values: a property bag is author data and a log
      // line is not the place for it. `passwordChanged` rather than the
      // password, for the obvious reason.
      properties: Object.keys(checked.properties),
      passwordChanged: password !== undefined,
      sessionsRevoked
    });
    return { outcome: 'done', userId, sessionsRevoked };
  }

  // ==========================================================================
  // delete
  // ==========================================================================

  private async remove(request: Extract<SystemUserRequest, { op: 'delete' }>): Promise<SystemUserResult> {
    const userId = optionalString(request.userId);
    if (!userId) {
      return fail(
        'user/id-required',
        'Delete User: a User Id is required. This node never falls back to the caller.'
      );
    }

    try {
      await this.facade.rawFetch('_User', userId);
    } catch {
      // Not a failure: "there is no such user" is the post-condition already
      // holding, which is what `Unchanged` is for. A retried moderation job
      // should not go red the second time it runs.
      return {
        outcome: 'unchanged',
        code: 'user/not-found',
        error: `There is no user with the id "${userId}".`,
        userId
      };
    }

    // Sessions first: a deleted user whose sessions survived would leave tokens
    // that `SecurityState.resolvePrincipal` resolves to a `_User` row it can no
    // longer fetch — a 209 at best, and rows the sweep would never reach.
    let sessionsRevoked = 0;
    const { results: sessions } = await this.facade.rawQuery('_Session', { where: { userId } });
    for (const session of sessions) {
      await this.facade.rawDelete('_Session', session.objectId as string);
      sessionsRevoked++;
    }

    try {
      await this.facade.rawDelete('_User', userId);
    } catch (e) {
      return fail('user/delete-failed', `Delete User: ${e instanceof Error ? e.message : String(e)}`);
    }

    this.audit(AUDIT_SYSTEM_USER_DELETE, 'success', { userId, sessionsRevoked });
    return { outcome: 'done', userId, sessionsRevoked };
  }

  // ==========================================================================
  // verifyToken
  // ==========================================================================

  /**
   * Ask this backend about one of its own session tokens.
   *
   * ⚠️ **Not CWF-010's JWT Verify.** That node verifies somebody else's JWT
   * against a key you hold. This asks our own `_Session` table about our own
   * token, and it accepts nothing else: an admin credential and an API key are
   * not sessions and answer `valid: false` here, so this cannot be turned into
   * an oracle for either.
   *
   * There is no expiry to report. `POST /login` and `POST /users` write
   * `_Session` rows carrying `sessionToken` and `userId` and nothing else, and
   * `_Session` has no `expiresAt` column (`service.ts` `ensureSystemTables`) —
   * so a session on this backend lives until a password change or a delete
   * revokes it. An `Expires At` output would be blank on every session this
   * backend has ever minted, which is a port that lies.
   */
  private async verifyToken(request: Extract<SystemUserRequest, { op: 'verifyToken' }>): Promise<SystemUserResult> {
    const token = optionalString(request.token);
    if (!token) {
      return fail('user/token-required', 'Verify Session Token: a Token is required.');
    }

    const { results } = await this.facade.rawQuery('_Session', { where: { sessionToken: token }, limit: 1 });
    const session = results[0];
    if (!session) {
      return { outcome: 'unchanged', code: 'user/token-invalid', valid: false };
    }

    let user: Record<string, unknown>;
    try {
      user = await this.facade.rawFetch('_User', session.userId as string);
    } catch {
      // A session row pointing at a user that no longer exists. Answered as
      // invalid rather than repaired: a verification must not write.
      return { outcome: 'unchanged', code: 'user/token-invalid', valid: false };
    }

    return {
      outcome: 'done',
      valid: true,
      userId: user.objectId as string,
      username: typeof user.username === 'string' ? user.username : undefined
    };
  }

  private audit(action: string, outcome: 'success' | 'failure', target: Record<string, unknown>): void {
    if (!this.onAudit) return;
    try {
      this.onAudit({ action, outcome, target });
    } catch {
      // An audit write must never turn a successful account change into a
      // failure the author has to reason about. `AuditLog.record` already
      // swallows its own errors; this is the second layer.
    }
  }
}
