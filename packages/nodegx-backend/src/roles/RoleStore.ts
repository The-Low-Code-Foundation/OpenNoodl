/**
 * The `_Role` table and its membership junction, with no transport attached.
 *
 * Extracted from `server/admin-security.ts` for F86, which needed the same six
 * operations from a place that has no `RequestContext` to answer into. The
 * alternative was a second implementation of "what a role name may contain" and
 * "which junction membership lives in", and two implementations of a security
 * primitive are two policies the first divergence makes silently different —
 * so the routes now delegate here and this file is the only one that knows.
 *
 * ## What is NOT here
 *
 * Nothing decides *whether the caller may do this*. The admin routes are
 * admin-gated by the dispatcher; `roles/SystemRoles.ts` is reachable only from a
 * graph inside this process and gated by that function's own `call` rule. A
 * store that also carried an opinion about authorisation would give both of them
 * a third gate to keep in step.
 *
 * ## Flat, deliberately (F86 design question 2)
 *
 * A role holds users. It does not hold roles. `SecurityState.rolesForUser` is a
 * single non-recursive JOIN over `_Join_users__Role`, so a role-in-role edge
 * would be written and then never resolved — a membership that reads back as
 * stored and grants nothing. Parse allowed it; this backend does not, and the
 * place that would have to change first is that JOIN, not this file.
 *
 * @module nodegx-backend/roles/RoleStore
 */

import type { AdapterFacade } from '../persistence/AdapterFacade';

/** A `_Role` row. Stored fields stay open; the two anything reads do not. */
export interface RoleRecord {
  objectId: string;
  name: string;
}

/**
 * What a role name may contain.
 *
 * ⚠️ Load-bearing beyond tidiness: a name goes into an ACL key as
 * `role:<name>` and into a permission rule as the same string, and both are
 * parsed by splitting on `:` and `,` (`security/model.ts`). A name carrying
 * either character would be a rule that means something other than it reads.
 */
export const ROLE_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

/** The one sentence every surface uses when a name is refused. */
export const ROLE_NAME_RULE = 'Role name must be non-empty and use only letters, digits, _ and -';

/** Is this usable as a role name? */
export function isValidRoleName(name: unknown): name is string {
  return typeof name === 'string' && ROLE_NAME_PATTERN.test(name);
}

/**
 * Narrow one raw `_Role` row. Throws naming the row rather than passing an
 * `undefined` objectId into a relation call, where it would silently address
 * nothing.
 */
export function asRole(row: Record<string, unknown>): RoleRecord {
  if (typeof row.objectId !== 'string' || typeof row.name !== 'string') {
    throw new Error(`Malformed _Role row: ${JSON.stringify(row)}`);
  }
  return { objectId: row.objectId, name: row.name };
}

/** The role table and its membership junction. One reader, two callers. */
export class RoleStore {
  constructor(private readonly facade: AdapterFacade) {}

  /** The role with this name, or null. Never throws for "no such role". */
  async find(name: string): Promise<RoleRecord | null> {
    const { results } = await this.facade.rawQuery('_Role', { where: { name }, limit: 1 });
    return results.length === 0 ? null : asRole(results[0]);
  }

  /** Every role, in storage order. */
  async list(): Promise<RoleRecord[]> {
    const { results } = await this.facade.rawQuery('_Role', {});
    return results.map(asRole);
  }

  /**
   * Create a role. The caller checks for an existing one first when a duplicate
   * is an error for it — this does not, because `ensure` needs the same write.
   */
  async create(name: string): Promise<RoleRecord> {
    const row = await this.facade.rawCreate('_Role', { name });
    return asRole(row);
  }

  /** The role, creating it if it is not there. `created` says which happened. */
  async ensure(name: string): Promise<{ role: RoleRecord; created: boolean }> {
    const existing = await this.find(name);
    if (existing) return { role: existing, created: false };
    return { role: await this.create(name), created: true };
  }

  /**
   * Delete a role and every membership in it.
   *
   * The memberships go first so a later role reusing this objectId (impossible
   * with UUIDs, but hygiene) cannot inherit them.
   */
  async remove(role: RoleRecord): Promise<void> {
    for (const userId of this.members(role)) {
      await this.facade.removeRelation('_Role', role.objectId, 'users', userId);
    }
    await this.facade.rawDelete('_Role', role.objectId);
  }

  /** The user ids in this role. Synchronous: it is one indexed junction read. */
  members(role: RoleRecord): string[] {
    if (!this.facade.schemaManager) return [];
    return (this.facade.schemaManager.getRelatedIds('_Role', role.objectId, 'users') as string[]) || [];
  }

  isMember(role: RoleRecord, userId: string): boolean {
    return this.members(role).includes(userId);
  }

  /**
   * Put a user in a role. Answers whether this call was the one that changed
   * anything — the junction's own `INSERT OR IGNORE` makes the write idempotent,
   * so the membership is read first to tell "added" from "was already there".
   */
  async addMember(role: RoleRecord, userId: string): Promise<boolean> {
    const already = this.isMember(role, userId);
    await this.facade.addRelation('_Role', role.objectId, 'users', userId);
    return !already;
  }

  /** Take a user out of a role. Answers whether they were in it. */
  async removeMember(role: RoleRecord, userId: string): Promise<boolean> {
    const was = this.isMember(role, userId);
    await this.facade.removeRelation('_Role', role.objectId, 'users', userId);
    return was;
  }
}
