/**
 * Admin security surface (BAK-003): the HTTP form of the permission model.
 *
 *   GET    /admin/permissions                       full security config
 *   PUT    /admin/permissions                       replace config (validated)
 *   PUT    /admin/permissions/collections/:name     set one collection's rules
 *   DELETE /admin/permissions/collections/:name     revert to defaults
 *   GET    /admin/permissions/functions             every function + its EFFECTIVE call rule
 *   PUT    /admin/permissions/functions/:name       set call / runAs / rateLimit / timeoutMs
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
import { DEFAULT_FUNCTION_TIMEOUT_MS } from '../workflow/WorkflowRunner';
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
  effectiveFunctionRateLimit,
  PUBLIC_WRITE_DEFAULT_RATE_LIMIT,
  canAccessRecord,
  effectiveFunctionRule,
  validateSecurityConfig,
  validateScopes,
  ruleAllows
} from '../security/model';
import { HttpError, readJSONBody, sendJSON } from './http-util';
import { ROLE_NAME_RULE, RoleStore, isValidRoleName } from '../roles/RoleStore';
import type { RoleRecord } from '../roles/RoleStore';

/**
 * ⚠️ Re-exported, not defined here. `RoleRecord` and the mechanics under it
 * moved to `roles/RoleStore` for F86, which needed the same operations from a
 * cloud function — a place with no `RequestContext` to answer into. The export
 * stays so existing importers do not have to care; the definition does not, so
 * that "what a role name may contain" and "which junction membership lives in"
 * have exactly one answer.
 */
export type { RoleRecord };

export class AdminSecurityRoutes {
  private readonly security: SecurityState;
  private readonly facade: AdapterFacade;
  private readonly options: BackendServiceOptions;
  private readonly getRunner: () => WorkflowRunner | null;
  /** Read through a getter so an ops.json edit shows up without a restart. */
  private readonly getFunctionClassPolicy: () => RateLimitPolicy;
  /**
   * CWF-016 service-level facts: is the claim store up, and how long is an
   * answered key replayed. Both are live reads (ops.json is editable at
   * runtime), and `available` matters because a panel that offers the switch
   * while sqlite is unavailable offers a promise the backend cannot keep.
   */
  private readonly getIdempotencyInfo: () => { available: boolean; ttlHours: number };

  constructor(
    security: SecurityState,
    facade: AdapterFacade,
    options: BackendServiceOptions,
    getRunner: () => WorkflowRunner | null,
    getFunctionClassPolicy: () => RateLimitPolicy,
    getIdempotencyInfo: () => { available: boolean; ttlHours: number }
  ) {
    this.security = security;
    this.facade = facade;
    this.options = options;
    this.getRunner = getRunner;
    this.getFunctionClassPolicy = getFunctionClassPolicy;
    this.getIdempotencyInfo = getIdempotencyInfo;
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
    // DEF-009 AC4: carried from the runner's own reading of the bundle, never
    // re-derived here — a second reader of the write predicate is how the panel
    // starts naming a budget the dispatcher does not spend.
    const writesRecordsOf = new Map(deployed.map((f) => [f.name, f.writesRecords]));
    const names = [...new Set([...deployed.map((f) => f.name), ...Object.keys(this.security.config.functions)])].sort();

    const functions = names.map((name) => {
      const entry = this.security.config.functions[name];
      const allowNoAuth = this.allowsNoAuth(name);
      const resolved = effectiveFunctionRule(this.security.config, name, allowNoAuth);
      // DEF-009 AC4. The panel showed the DECLARED rateLimit and nothing else,
      // which was honest while undeclared meant unlimited and becomes a lie the
      // moment a default exists. Same treatment as `timeoutMs` below: the
      // declared value survives verbatim, and what actually applies is reported
      // beside it rather than folded into it.
      const budget = effectiveFunctionRateLimit(this.security.config, name, {
        allowNoAuth,
        writesRecords: writesRecordsOf.get(name) === true
      });
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
        /**
         * DEF-009 AC4: the budget being SPENT, and where it came from.
         * `declared` with a null policy is the deliberate `{0,0}` opt-out;
         * `public-write-default` is this endpoint running on the 60/30 floor
         * because it is public and writes rows.
         */
        effectiveRateLimit: budget.policy || null,
        rateLimitSource: budget.source,
        /**
         * CWF-018. `null` = undeclared, and the panel should say what applies
         * instead — `defaultTimeoutMs` below. A declared `0` is "no limit" and
         * must survive as `0` rather than collapsing into "undeclared".
         */
        timeoutMs: entry && typeof entry.timeoutMs === 'number' ? entry.timeoutMs : null,
        /**
         * CWF-016. `null` = the function does not honour `Idempotency-Key` at
         * all, which is what every function does until someone says otherwise.
         */
        idempotency: (entry && entry.idempotency) || null,
        graphRefusesAnonymous: anonymousAllowed && !allowNoAuth
      };
    });

    sendJSON(ctx.res, 200, {
      functions,
      enforced: !this.security.devOpenActive,
      /** The shared budget a per-function limit tightens, for the panel's copy. */
      classRateLimit: this.getFunctionClassPolicy(),
      /** What an undeclared `timeoutMs` means, in the same units (CWF-018). */
      defaultTimeoutMs: DEFAULT_FUNCTION_TIMEOUT_MS,
      /**
       * DEF-009 AC4: what an undeclared `rateLimit` means for a PUBLIC endpoint
       * that writes records. It means nothing for any other function, which is
       * why the per-row `rateLimitSource` is the field to read and this is only
       * the number to print beside it.
       */
      publicWriteDefaultRateLimit: PUBLIC_WRITE_DEFAULT_RATE_LIMIT,
      /**
       * CWF-016: how long an answered key is replayed, and whether the store is
       * up at all. A panel that offers the switch while sqlite is unavailable
       * would be offering a promise the backend cannot keep.
       */
      idempotency: this.getIdempotencyInfo()
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

    const KNOWN = ['call', 'runAs', 'rateLimit', 'timeoutMs', 'idempotency'];
    const unknown = Object.keys(body).filter((k) => !KNOWN.includes(k));
    if (unknown.length > 0) {
      throw new HttpError(
        400,
        `Unknown field(s) ${unknown.map((k) => `"${k}"`).join(', ')} for function "${name}". ` +
          `Expected { "call": "public" | "authenticated" | "nobody" | "role:<name>" | [those], ` +
          `"runAs": "system", "rateLimit": { "ratePerMinute", "burst" }, "timeoutMs": <ms, 0 = no limit>, ` +
          `"idempotency": { "enabled", "requireKey"?, "hashBody"? } }.`
      );
    }
    if (
      body.call === undefined &&
      body.runAs === undefined &&
      body.rateLimit === undefined &&
      body.timeoutMs === undefined &&
      body.idempotency === undefined
    ) {
      throw new HttpError(
        400,
        `Nothing to set for function "${name}". Send "call", "runAs", "rateLimit", "timeoutMs" and/or ` +
          `"idempotency"; ` +
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

  /** The transport-free half, shared with the cloud-function seam (F86). */
  private get roles(): RoleStore {
    return new RoleStore(this.facade);
  }

  async listRoles(ctx: RequestContext): Promise<void> {
    const store = this.roles;
    const roles: (RoleRecord & { users: string[] })[] = [];
    for (const role of await store.list()) {
      roles.push({ ...role, users: store.members(role) });
    }
    sendJSON(ctx.res, 200, { roles });
  }

  async createRole(ctx: RequestContext): Promise<void> {
    const body = await readJSONBody(ctx.req);
    const name = String(body.name || '').trim();
    if (!isValidRoleName(name)) {
      throw new HttpError(400, ROLE_NAME_RULE);
    }
    if (await this.roles.find(name)) {
      throw new HttpError(400, `Role "${name}" already exists.`);
    }
    ctx.audit({ role: name });
    const role = await this.roles.create(name);
    sendJSON(ctx.res, 201, { objectId: role.objectId, name });
  }

  /** The named role, or a 404. `RoleStore.find` answers null instead. */
  private async findRole(name: string): Promise<RoleRecord> {
    const role = await this.roles.find(name);
    if (!role) throw new HttpError(404, `No such role: ${name}`);
    return role;
  }

  async deleteRole(ctx: RequestContext): Promise<void> {
    await this.roles.remove(await this.findRole(ctx.params.name));
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
    await this.roles.addMember(role, userId);
    sendJSON(ctx.res, 200, { success: true, role: ctx.params.name, userId });
  }

  async removeRoleUser(ctx: RequestContext): Promise<void> {
    const role = await this.findRole(ctx.params.name);
    await this.roles.removeMember(role, ctx.params.userId);
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
