/**
 * Admin security surface (BAK-003): the HTTP form of the permission model.
 *
 *   GET    /admin/permissions                       full security config
 *   PUT    /admin/permissions                       replace config (validated)
 *   PUT    /admin/permissions/collections/:name     set one collection's rules
 *   DELETE /admin/permissions/collections/:name     revert to defaults
 *   GET    /admin/permissions/functions             every function + its EFFECTIVE call rule
 *   PUT    /admin/permissions/functions/:name       set call / runAs / rateLimit
 *   DELETE /admin/permissions/functions/:name       back to the graph's own declaration
 *   POST   /admin/permissions/check                 dry-run a decision
 *   GET    /admin/roles          POST /admin/roles          DELETE /admin/roles/:name
 *   POST   /admin/roles/:name/users                 DELETE /admin/roles/:name/users/:userId
 *   GET    /admin/keys           POST /admin/keys           DELETE /admin/keys/:id (revoke)
 *
 * All admin-gated by the dispatcher. The same surface backs the editor panel
 * (via BackendManager IPC proxy), BAK-005's served dashboard, and the MCP
 * backend tools — one editor, three fronts.
 *
 * @module nodegx-backend/server/admin-security
 */

import type { BackendServiceOptions } from '../config';
import { requiresAuth } from '../config';
import type { AdapterFacade } from '../persistence/AdapterFacade';
import type { WorkflowRunner } from '../workflow/WorkflowRunner';
import type { SecurityState } from '../security/state';
import type { RequestContext } from './HttpServer';
import type { RateLimitPolicy } from '../ops/model';
import {
  ClpOp,
  CLP_OPS,
  Principal,
  SecurityConfig,
  checkClp,
  checkFunctionCall,
  canAccessRecord,
  effectiveFunctionRule,
  validateSecurityConfig,
  validateScopes,
  ruleAllows
} from '../security/model';
import { HttpError, readJSONBody, sendJSON } from './http-util';

/** A `_Role` row. Stored fields stay open; the two this file reads do not. */
export interface RoleRecord {
  objectId: string;
  name: string;
}

/**
 * Narrow one raw `_Role` row. Throws naming the row rather than passing an
 * `undefined` objectId into a relation call, where it would silently address
 * nothing.
 */
function asRole(row: Record<string, unknown>): RoleRecord {
  if (typeof row.objectId !== 'string' || typeof row.name !== 'string') {
    throw new HttpError(500, `Malformed _Role row: ${JSON.stringify(row)}`);
  }
  return { objectId: row.objectId, name: row.name };
}

export class AdminSecurityRoutes {
  private readonly security: SecurityState;
  private readonly facade: AdapterFacade;
  private readonly options: BackendServiceOptions;
  private readonly getRunner: () => WorkflowRunner | null;
  /** Read through a getter so an ops.json edit shows up without a restart. */
  private readonly getFunctionClassPolicy: () => RateLimitPolicy;

  constructor(
    security: SecurityState,
    facade: AdapterFacade,
    options: BackendServiceOptions,
    getRunner: () => WorkflowRunner | null,
    getFunctionClassPolicy: () => RateLimitPolicy
  ) {
    this.security = security;
    this.facade = facade;
    this.options = options;
    this.getRunner = getRunner;
    this.getFunctionClassPolicy = getFunctionClassPolicy;
  }

  // ==========================================================================
  // Permissions (CLP config)
  // ==========================================================================

  getPermissions(ctx: RequestContext): void {
    sendJSON(ctx.res, 200, {
      config: this.security.config,
      enforced: !this.security.devOpenActive,
      loopback: !requiresAuth(this.options)
    });
  }

  async putPermissions(ctx: RequestContext): Promise<void> {
    const body = await readJSONBody(ctx.req);
    const candidate = (body.config !== undefined ? body.config : body) as SecurityConfig;
    const errors = validateSecurityConfig(candidate);
    if (errors.length > 0) {
      throw new HttpError(400, `Invalid security config:\n${errors.map((e) => `- ${e}`).join('\n')}`);
    }
    // The interlock, live form: dev-open cannot be turned on while bound
    // beyond loopback (the startup check's runtime twin).
    if (candidate.devOpen && requiresAuth(this.options)) {
      throw new HttpError(400, 'devOpen cannot be enabled while the service is bound beyond localhost.');
    }
    ctx.audit({ sections: Object.keys(candidate), devOpen: candidate.devOpen });
    Object.assign(this.security.config, candidate);
    this.security.save();
    sendJSON(ctx.res, 200, { success: true, config: this.security.config });
  }

  /**
   * `PUT /admin/permissions/collections/:name`.
   *
   * BAK-009 made this refuse a body it would otherwise ignore. It used to read
   * `permissions` and `creatorOwns`, silently drop everything else, and answer
   * `{"success":true,"rules":{}}` — so `{"find":"public","get":"public"}`,
   * which is the shape the response's own `rules` field suggests, changed
   * nothing and said it worked. That cost real time during WF-003's live
   * verification, and it is exactly the kind of thing the audit trail would
   * otherwise record as a permission change that never happened.
   */
  async putCollection(ctx: RequestContext): Promise<void> {
    const name = ctx.params.name;
    const body = await readJSONBody(ctx.req);

    const KNOWN = ['permissions', 'creatorOwns'];
    const unknown = Object.keys(body).filter((k) => !KNOWN.includes(k));
    if (unknown.length > 0) {
      throw new HttpError(
        400,
        `Unknown field(s) ${unknown.map((k) => `"${k}"`).join(', ')} for collection "${name}". ` +
          `Expected { "permissions": { find, get, create, update, delete, count }, "creatorOwns": boolean }. ` +
          `Per-operation rules go INSIDE "permissions".`
      );
    }
    if (body.permissions === undefined && body.creatorOwns === undefined) {
      throw new HttpError(
        400,
        `Nothing to set for collection "${name}". Send "permissions" and/or "creatorOwns"; ` +
          `to remove this collection's rules use DELETE.`
      );
    }

    const entry: Record<string, unknown> = {};
    if (body.permissions !== undefined) entry.permissions = body.permissions;
    if (body.creatorOwns !== undefined) entry.creatorOwns = body.creatorOwns;
    ctx.audit({ collection: name, rules: entry });

    // Validate by candidate-mutating a copy of the whole config — one
    // validator, no drift between whole-doc and per-collection writes.
    const candidate = JSON.parse(JSON.stringify(this.security.config)) as SecurityConfig;
    candidate.collections[name] = entry as SecurityConfig['collections'][string];
    const errors = validateSecurityConfig(candidate);
    if (errors.length > 0) {
      throw new HttpError(400, `Invalid collection rules:\n${errors.map((e) => `- ${e}`).join('\n')}`);
    }
    this.security.config.collections[name] = entry as SecurityConfig['collections'][string];
    this.security.save();
    sendJSON(ctx.res, 200, { success: true, collection: name, rules: entry });
  }

  async deleteCollection(ctx: RequestContext): Promise<void> {
    const name = ctx.params.name;
    const existed = this.security.config.collections[name] !== undefined;
    delete this.security.config.collections[name];
    this.security.save();
    sendJSON(ctx.res, 200, { success: true, collection: name, removed: existed });
  }

  // ==========================================================================
  // Cloud-function access + budget (CWF-017)
  // ==========================================================================

  /** The graph's `Allow Unauthenticated` declaration; false when unknown. */
  private allowsNoAuth(name: string): boolean {
    const runner = this.getRunner();
    return runner ? runner.functionAllowsNoAuth(name) : false;
  }

  /**
   * `GET /admin/permissions/functions` — every function this backend serves,
   * with the rule that would actually decide a call.
   *
   * Three things this deliberately does that reading `config.functions` cannot:
   *
   * 1. It reports the EFFECTIVE rule, resolved by the same function the gate
   *    uses. A function with no config entry is the common case, and showing it
   *    blank was CWF-017's whole complaint: capability that exists and is
   *    invisible.
   * 2. It lists functions that are DEPLOYED but unconfigured, and config entries
   *    for functions that are NOT deployed. The second kind is drift — a rule
   *    guarding a name nothing answers to — and it is invisible from either side
   *    alone.
   * 3. It reports `graphRefusesAnonymous`: the two gates disagreeing. The
   *    backend rule decides whether the REQUEST reaches the graph; the Request
   *    node's own `Allow Unauthenticated` check then runs INSIDE the graph and
   *    throws. So `call: "public"` over a node with the port unticked is not a
   *    public function — it is a 500 with a confusing message. Nothing else in
   *    the system can see that pair.
   */
  listFunctions(ctx: RequestContext): void {
    const runner = this.getRunner();
    const deployed = runner ? runner.getAvailableFunctions() : [];
    const workflowOf = new Map(deployed.map((f) => [f.name, f.workflow]));
    const names = [...new Set([...deployed.map((f) => f.name), ...Object.keys(this.security.config.functions)])].sort();

    const functions = names.map((name) => {
      const entry = this.security.config.functions[name];
      const allowNoAuth = this.allowsNoAuth(name);
      const resolved = effectiveFunctionRule(this.security.config, name, allowNoAuth);
      const anonymousAllowed = ruleAllows(resolved.rule, { kind: 'anonymous' });
      return {
        name,
        deployed: workflowOf.has(name),
        workflow: workflowOf.get(name) || null,
        /** The rule that decides, whether or not anyone wrote it down. */
        call: resolved.rule,
        source: resolved.source,
        /** What is literally in security.json, or null — for a faithful round trip. */
        configured: entry && entry.call !== undefined ? entry.call : null,
        allowNoAuth,
        runAs: (entry && entry.runAs) || null,
        rateLimit: (entry && entry.rateLimit) || null,
        graphRefusesAnonymous: anonymousAllowed && !allowNoAuth
      };
    });

    sendJSON(ctx.res, 200, {
      functions,
      enforced: !this.security.devOpenActive,
      /** The shared budget a per-function limit tightens, for the panel's copy. */
      classRateLimit: this.getFunctionClassPolicy()
    });
  }

  /**
   * `PUT /admin/permissions/functions/:name` — set this function's rule and/or
   * budget. Refuses a body it would otherwise ignore, for putCollection's
   * reason: a permission write that answers `success` and changed nothing is
   * worse than an error.
   */
  async putFunction(ctx: RequestContext): Promise<void> {
    const name = ctx.params.name;
    const body = await readJSONBody(ctx.req);

    const KNOWN = ['call', 'runAs', 'rateLimit'];
    const unknown = Object.keys(body).filter((k) => !KNOWN.includes(k));
    if (unknown.length > 0) {
      throw new HttpError(
        400,
        `Unknown field(s) ${unknown.map((k) => `"${k}"`).join(', ')} for function "${name}". ` +
          `Expected { "call": "public" | "authenticated" | "nobody" | "role:<name>" | [those], ` +
          `"runAs": "system", "rateLimit": { "ratePerMinute", "burst" } }.`
      );
    }
    if (body.call === undefined && body.runAs === undefined && body.rateLimit === undefined) {
      throw new HttpError(
        400,
        `Nothing to set for function "${name}". Send "call", "runAs" and/or "rateLimit"; ` +
          `to fall back to the graph's own Allow Unauthenticated declaration use DELETE.`
      );
    }

    // `null` clears a field — the panel's "back to the default" without making
    // the caller reconstruct the whole entry.
    const entry: Record<string, unknown> = { ...(this.security.config.functions[name] || {}) };
    for (const field of KNOWN) {
      if (body[field] === undefined) continue;
      if (body[field] === null) delete entry[field];
      else entry[field] = body[field];
    }
    ctx.audit({ function: name, rules: entry });

    // Validate by candidate-mutating a copy of the whole config — one validator,
    // no drift between the whole-doc write and this one.
    const candidate = JSON.parse(JSON.stringify(this.security.config)) as SecurityConfig;
    candidate.functions[name] = entry as SecurityConfig['functions'][string];
    const errors = validateSecurityConfig(candidate);
    if (errors.length > 0) {
      throw new HttpError(400, `Invalid function rules:\n${errors.map((e) => `- ${e}`).join('\n')}`);
    }

    this.security.config.functions[name] = entry as SecurityConfig['functions'][string];
    this.security.save();
    const resolved = effectiveFunctionRule(this.security.config, name, this.allowsNoAuth(name));
    sendJSON(ctx.res, 200, { success: true, function: name, rules: entry, effective: resolved.rule, source: resolved.source });
  }

  /** `DELETE /admin/permissions/functions/:name` — back to the graph's own declaration. */
  deleteFunction(ctx: RequestContext): void {
    const name = ctx.params.name;
    const existed = this.security.config.functions[name] !== undefined;
    delete this.security.config.functions[name];
    this.security.save();
    const resolved = effectiveFunctionRule(this.security.config, name, this.allowsNoAuth(name));
    sendJSON(ctx.res, 200, {
      success: true,
      function: name,
      removed: existed,
      effective: resolved.rule,
      source: resolved.source
    });
  }

  /**
   * POST /admin/permissions/check — server-side dry run. Body:
   *   { principal: { kind, userId?, roles?, scopes?, name? },
   *     collection?, op?, functionName?, record? }
   * Answers what the enforcement would decide and which rule decided it —
   * the deterministic "verify the effect" surface for agents (no session
   * juggling required).
   */
  async checkAccess(ctx: RequestContext): Promise<void> {
    const body = await readJSONBody(ctx.req);
    const principal = this.parsePrincipal(body.principal);

    if (typeof body.functionName === 'string') {
      // CWF-017: one resolver with the dispatcher's gate. This used to restate
      // the config-then-graph fallback in its own six lines, which meant the dry
      // run could answer differently from enforcement the day either changed.
      const name = body.functionName;
      const decision = checkFunctionCall(this.security.config, principal, name, this.allowsNoAuth(name));
      sendJSON(ctx.res, 200, {
        allowed: decision.allowed,
        kind: 'function',
        functionName: name,
        rule: decision.rule,
        source: decision.source,
        reason: decision.reason,
        devOpen: this.security.devOpenActive
      });
      return;
    }

    const collection = String(body.collection || '');
    const op = String(body.op || '') as ClpOp;
    if (!collection || !CLP_OPS.includes(op)) {
      throw new HttpError(400, `check requires functionName, or collection + op (one of ${CLP_OPS.join(', ')})`);
    }
    const decision = checkClp(this.security.config, principal, collection, op);
    const result: Record<string, unknown> = {
      allowed: decision.allowed,
      kind: 'collection',
      collection,
      op,
      rule: decision.rule,
      reason: decision.reason,
      devOpen: this.security.devOpenActive
    };
    // Optional row-level answer when a record (or its ACL) is supplied.
    if (decision.allowed && body.record !== undefined && body.record !== null) {
      const access = op === 'find' || op === 'get' ? 'read' : 'write';
      result.recordAllowed = canAccessRecord(principal, body.record as { ACL?: unknown }, access);
      result.recordAccess = access;
    }
    sendJSON(ctx.res, 200, result);
  }

  /** Build a Principal from a check-request descriptor (never from credentials). */
  private parsePrincipal(raw: unknown): Principal {
    if (!raw || typeof raw !== 'object') return { kind: 'anonymous' };
    const p = raw as Record<string, unknown>;
    switch (p.kind) {
      case 'admin':
        return { kind: 'admin' };
      case 'apiKey':
        return {
          kind: 'apiKey',
          name: String(p.name || 'check'),
          scopes: Array.isArray(p.scopes) ? p.scopes.map(String) : []
        };
      case 'user': {
        const userId = String(p.userId || '');
        if (!userId) throw new HttpError(400, 'principal.userId is required for kind "user"');
        // Roles may be supplied explicitly (hypotheticals) or resolved live.
        const roles = Array.isArray(p.roles) ? p.roles.map(String) : this.security.rolesForUser(userId);
        return { kind: 'user', userId, roles };
      }
      case 'anonymous':
      case undefined:
        return { kind: 'anonymous' };
      default:
        throw new HttpError(400, `unknown principal kind ${JSON.stringify(p.kind)}`);
    }
  }

  // ==========================================================================
  // Roles
  // ==========================================================================

  async listRoles(ctx: RequestContext): Promise<void> {
    const { results } = await this.facade.rawQuery('_Role', {});
    const roles: (RoleRecord & { users: string[] })[] = [];
    for (const raw of results) {
      const role = asRole(raw);
      const members = this.facade.schemaManager
        ? (this.facade.schemaManager.getRelatedIds('_Role', role.objectId, 'users') as string[])
        : [];
      roles.push({ ...role, users: members });
    }
    sendJSON(ctx.res, 200, { roles });
  }

  async createRole(ctx: RequestContext): Promise<void> {
    const body = await readJSONBody(ctx.req);
    const name = String(body.name || '').trim();
    if (!name || !/^[a-zA-Z0-9_-]+$/.test(name)) {
      throw new HttpError(400, 'Role name must be non-empty and use only letters, digits, _ and -');
    }
    const { results } = await this.facade.rawQuery('_Role', { where: { name }, limit: 1 });
    if (results.length > 0) {
      throw new HttpError(400, `Role "${name}" already exists.`);
    }
    ctx.audit({ role: name });
    const role = await this.facade.rawCreate('_Role', { name });
    sendJSON(ctx.res, 201, { objectId: role.objectId, name });
  }

  /**
   * A `_Role` row as this file uses it. It came back `Record<string, unknown>`,
   * so `role.objectId` was `unknown` and every relation call took it anyway —
   * which only compiled because `schemaManager` was `any` (PLAT-004).
   */
  private async findRole(name: string): Promise<RoleRecord> {
    const { results } = await this.facade.rawQuery('_Role', { where: { name }, limit: 1 });
    if (results.length === 0) throw new HttpError(404, `No such role: ${name}`);
    return asRole(results[0]);
  }

  async deleteRole(ctx: RequestContext): Promise<void> {
    const role = await this.findRole(ctx.params.name);
    const sm = this.facade.schemaManager;
    if (sm) {
      // Remove memberships so a later role with the same objectId (impossible
      // with UUIDs, but hygiene) cannot inherit them.
      const members = sm.getRelatedIds('_Role', role.objectId, 'users') as string[];
      for (const userId of members) {
        sm.removeRelation('_Role', role.objectId, 'users', userId);
      }
    }
    await this.facade.rawDelete('_Role', role.objectId);
    sendJSON(ctx.res, 200, { success: true, name: ctx.params.name });
  }

  async addRoleUser(ctx: RequestContext): Promise<void> {
    const role = await this.findRole(ctx.params.name);
    const body = await readJSONBody(ctx.req);
    const userId = String(body.userId || '');
    if (!userId) throw new HttpError(400, 'userId is required');
    try {
      await this.facade.rawFetch('_User', userId);
    } catch {
      throw new HttpError(404, `No such user: ${userId}`);
    }
    this.facade.schemaManager.addRelation('_Role', role.objectId, 'users', userId);
    sendJSON(ctx.res, 200, { success: true, role: ctx.params.name, userId });
  }

  async removeRoleUser(ctx: RequestContext): Promise<void> {
    const role = await this.findRole(ctx.params.name);
    this.facade.schemaManager.removeRelation('_Role', role.objectId, 'users', ctx.params.userId);
    sendJSON(ctx.res, 200, { success: true, role: ctx.params.name, userId: ctx.params.userId });
  }

  // ==========================================================================
  // API keys
  // ==========================================================================

  listKeys(ctx: RequestContext): void {
    // Names, scopes, status — never secrets (they are unrecoverable by design).
    sendJSON(ctx.res, 200, { keys: this.security.listApiKeys() });
  }

  async createKey(ctx: RequestContext): Promise<void> {
    const body = await readJSONBody(ctx.req);
    const name = String(body.name || '').trim();
    if (!name) throw new HttpError(400, 'Key name is required');
    const scopeError = validateScopes(body.scopes);
    if (scopeError) throw new HttpError(400, scopeError);
    // Name and scopes are the audit-worthy part; the secret is returned to the
    // caller once and never recorded (the redaction rule would drop it anyway).
    ctx.audit({ key: name, scopes: body.scopes });
    const { objectId, secret } = this.security.createApiKey(name, body.scopes as string[]);
    // The one and only time the secret is returned.
    sendJSON(ctx.res, 201, { objectId, name, scopes: body.scopes, secret });
  }

  revokeKey(ctx: RequestContext): void {
    const revoked = this.security.revokeApiKey(ctx.params.id);
    if (!revoked) throw new HttpError(404, `No such key: ${ctx.params.id}`);
    sendJSON(ctx.res, 200, { success: true, objectId: ctx.params.id, revoked: true });
  }
}
