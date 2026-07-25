/**
 * The service's HTTP surface. Three route families front the same database
 * (WF-004), now behind one structural enforcement point (BAK-003):
 *
 *   1. BYOB `/api/:table` + `/api/_schema` + `/api/_batch`
 *   2. Parse-wire subset — `/classes`, `/aggregate`, `/files`, `/functions`,
 *      `/config`, sessions
 *   3. Admin — `/admin/*`, `/executions*`, and the BAK-003 security surface
 *      (`/admin/permissions`, `/admin/roles`, `/admin/keys`)
 *
 * EVERY route lives in the ROUTES table below and carries a mandatory
 * `access` declaration; the dispatcher applies the gate before any handler
 * runs (model doc §8). A route added without an access class does not
 * typecheck, and the route-walk test fails any route that answers an
 * unauthenticated request on a locked backend. This shape — not reviewer
 * vigilance — is the mitigation for the classic "new route forgot the
 * middleware" BaaS CVE.
 *
 * WF-004's blanket bearer-token wall on non-loopback binds is REPLACED by
 * this model: data routes are governed by CLP/ACL/sessions, admin routes by
 * the admin credential (the old --token, migrated). /health stays public.
 *
 * @module nodegx-backend/server/HttpServer
 */

import * as http from 'http';

import type { BackendServiceOptions } from '../config';
import type { PersistenceHandle } from '../persistence/createAdapter';
import type { AdapterFacade, AclOption } from '../persistence/AdapterFacade';
import type { ExecutionHistory } from '../execution/ExecutionStore';
import type { WorkflowRunner } from '../workflow/WorkflowRunner';
import type { SecurityState } from '../security/state';
import { ClpOp, Principal, keyAllowsFunction, ruleAllows, validateAclShape } from '../security/model';
import { AdminSecurityRoutes } from './admin-security';
import { ByobAdminRoutes } from './byob-admin';
import { FileRoutes } from './files';
import { ParseWireRoutes } from './parse-wire';
import { UserRoutes } from './users';
import { CORS_HEADERS, HttpError, parseURL, readJSONBody, sendError, sendJSON } from './http-util';

// ============================================================================
// Route table types
// ============================================================================

export type RouteAccess =
  /** No gate (health, config, the 501 mail stubs). */
  | { kind: 'public' }
  /** Admin credential only. */
  | { kind: 'admin' }
  /** CLP-gated data operation. `collectionParam` names the captured segment. */
  | { kind: 'data'; op: ClpOp | 'byBody'; collectionParam: string }
  /** Batch data route — the handler enforces per contained operation via ctx.checkData. */
  | { kind: 'data-perOp' }
  /** Function call — per-function rule / key scopes. */
  | { kind: 'function'; nameParam: string }
  /** File routes — the three coarse file rules. */
  | { kind: 'files'; op: 'upload' | 'read' | 'delete' }
  /** Signup — the config `signup` rule. */
  | { kind: 'signup' }
  /** Session endpoints that are the auth system itself (login/logout/me/self-update). */
  | { kind: 'session' };

export interface RequestContext {
  req: http.IncomingMessage;
  res: http.ServerResponse;
  params: Record<string, string>;
  query: Record<string, string>;
  /** Parsed JSON body — pre-read only for `data op:'byBody'` routes. */
  body: Record<string, unknown> | null;
  principal: Principal;
  security: SecurityState;
  /** acl option for adapter calls; undefined = bypass (dev-open / admin / scoped key). */
  acl(access: 'read' | 'write'): AclOption | undefined;
  /** Throw 403/119 unless `op` on `collection` is allowed (used by /api/_batch). */
  checkData(collection: string, op: ClpOp): void;
  /** Owner + template-ACL stamping and client-ACL validation for creates. */
  stampCreate(collection: string, data: Record<string, unknown>): void;
}

export interface RouteInfo {
  method: string;
  /** Slash-joined pattern; `:name` segments capture. Matched on exact length. */
  pattern: string;
  access: RouteAccess;
}

interface RouteDef extends RouteInfo {
  handler: (ctx: RequestContext) => Promise<void> | void;
}

export interface HttpServerDeps {
  options: BackendServiceOptions;
  persistence: PersistenceHandle;
  facade: AdapterFacade;
  executions: ExecutionHistory;
  security: SecurityState;
  /** Late-bound: the runner loads after the server starts listening. */
  getRunner: () => WorkflowRunner | null;
  /** Project config served at /config. Defaults to {}. */
  getConfigParams?: () => Record<string, unknown>;
}

/** Result of a successful listen(). */
export interface ListenInfo {
  host: string;
  port: number;
  url: string;
}

export class HttpServer {
  private readonly options: BackendServiceOptions;
  private readonly persistence: PersistenceHandle;
  private readonly facade: AdapterFacade;
  private readonly security: SecurityState;
  private readonly getRunner: () => WorkflowRunner | null;
  private server: http.Server | null = null;
  private startedAt = 0;

  private readonly byob: ByobAdminRoutes;
  private readonly parse: ParseWireRoutes;
  private readonly users: UserRoutes;
  private readonly files: FileRoutes;
  private readonly adminSecurity: AdminSecurityRoutes;
  private readonly routes: RouteDef[];

  constructor(deps: HttpServerDeps) {
    this.options = deps.options;
    this.persistence = deps.persistence;
    this.facade = deps.facade;
    this.security = deps.security;
    this.getRunner = deps.getRunner;

    this.byob = new ByobAdminRoutes(deps.facade, deps.executions, deps.getRunner);
    this.parse = new ParseWireRoutes(deps.facade, deps.getConfigParams || (() => ({})));
    this.users = new UserRoutes(deps.facade, deps.security);
    this.files = new FileRoutes(deps.options.dataDir, `http://127.0.0.1:${deps.options.port}`);
    this.adminSecurity = new AdminSecurityRoutes(deps.security, deps.facade, deps.options, deps.getRunner);
    this.routes = this.buildRoutes();
  }

  /** The full route table (method/pattern/access) — the route-walk test's input. */
  getRouteTable(): RouteInfo[] {
    return this.routes.map(({ method, pattern, access }) => ({ method, pattern, access }));
  }

  // ==========================================================================
  // The route table — every route, every access class, one place
  // ==========================================================================

  private buildRoutes(): RouteDef[] {
    const byob = this.byob;
    const parse = this.parse;
    const users = this.users;
    const files = this.files;
    const adminSec = this.adminSecurity;

    return [
      // ---- Public ----------------------------------------------------------
      { method: 'GET', pattern: 'health', access: { kind: 'public' }, handler: (ctx) => this.health(ctx.res) },
      { method: 'GET', pattern: 'config', access: { kind: 'public' }, handler: (ctx) => parse.config(ctx.res) },

      // ---- Parse-wire data -------------------------------------------------
      {
        method: 'POST',
        pattern: 'classes/:collection',
        access: { kind: 'data', op: 'byBody', collectionParam: 'collection' },
        handler: (ctx) => parse.classesPost(ctx)
      },
      {
        method: 'GET',
        pattern: 'classes/:collection',
        access: { kind: 'data', op: 'find', collectionParam: 'collection' },
        handler: (ctx) => parse.classesGet(ctx)
      },
      {
        method: 'GET',
        pattern: 'classes/:collection/:id',
        access: { kind: 'data', op: 'get', collectionParam: 'collection' },
        handler: (ctx) => parse.classGet(ctx)
      },
      {
        method: 'PUT',
        pattern: 'classes/:collection/:id',
        access: { kind: 'data', op: 'update', collectionParam: 'collection' },
        handler: (ctx) => parse.classPut(ctx)
      },
      {
        method: 'DELETE',
        pattern: 'classes/:collection/:id',
        access: { kind: 'data', op: 'delete', collectionParam: 'collection' },
        handler: (ctx) => parse.classDelete(ctx)
      },
      {
        method: 'GET',
        pattern: 'aggregate/:collection',
        access: { kind: 'data', op: 'find', collectionParam: 'collection' },
        handler: (ctx) => parse.aggregate(ctx)
      },

      // ---- Functions -------------------------------------------------------
      {
        method: 'POST',
        pattern: 'functions/:name',
        access: { kind: 'function', nameParam: 'name' },
        handler: (ctx) => this.runFunction(ctx)
      },

      // ---- Files -----------------------------------------------------------
      {
        method: 'POST',
        pattern: 'files/:name',
        access: { kind: 'files', op: 'upload' },
        handler: (ctx) => files.upload(ctx.req, ctx.res, ctx.params.name)
      },
      {
        method: 'GET',
        pattern: 'files/:name',
        access: { kind: 'files', op: 'read' },
        handler: (ctx) => files.serve(ctx.res, ctx.params.name)
      },
      {
        method: 'DELETE',
        pattern: 'files/:name',
        access: { kind: 'files', op: 'delete' },
        handler: (ctx) => files.delete(ctx.res, ctx.params.name)
      },

      // ---- Sessions --------------------------------------------------------
      { method: 'POST', pattern: 'login', access: { kind: 'session' }, handler: (ctx) => users.login(ctx.req, ctx.res) },
      { method: 'POST', pattern: 'logout', access: { kind: 'session' }, handler: (ctx) => users.logout(ctx.req, ctx.res) },
      { method: 'POST', pattern: 'users', access: { kind: 'signup' }, handler: (ctx) => users.signup(ctx.req, ctx.res) },
      { method: 'GET', pattern: 'users/me', access: { kind: 'session' }, handler: (ctx) => users.me(ctx.req, ctx.res) },
      {
        method: 'PUT',
        pattern: 'users/:id',
        access: { kind: 'session' },
        handler: (ctx) => users.updateUser(ctx.req, ctx.res, ctx.params.id)
      },

      // ---- BYOB ------------------------------------------------------------
      { method: 'GET', pattern: 'api/_schema', access: { kind: 'admin' }, handler: (ctx) => byob.getSchema(ctx.res) },
      {
        method: 'POST',
        pattern: 'api/_schema',
        access: { kind: 'admin' },
        handler: (ctx) => byob.mutateSchema(ctx.req, ctx.res)
      },
      { method: 'POST', pattern: 'api/_batch', access: { kind: 'data-perOp' }, handler: (ctx) => byob.batch(ctx) },
      {
        method: 'GET',
        pattern: 'api/:table',
        access: { kind: 'data', op: 'find', collectionParam: 'table' },
        handler: (ctx) => byob.query(ctx)
      },
      {
        method: 'POST',
        pattern: 'api/:table',
        access: { kind: 'data', op: 'create', collectionParam: 'table' },
        handler: (ctx) => byob.create(ctx)
      },
      {
        method: 'GET',
        pattern: 'api/:table/:id',
        access: { kind: 'data', op: 'get', collectionParam: 'table' },
        handler: (ctx) => byob.fetch(ctx)
      },
      {
        method: 'PUT',
        pattern: 'api/:table/:id',
        access: { kind: 'data', op: 'update', collectionParam: 'table' },
        handler: (ctx) => byob.save(ctx)
      },
      {
        method: 'DELETE',
        pattern: 'api/:table/:id',
        access: { kind: 'data', op: 'delete', collectionParam: 'table' },
        handler: (ctx) => byob.delete(ctx)
      },

      // ---- Admin -----------------------------------------------------------
      { method: 'GET', pattern: 'admin/status', access: { kind: 'admin' }, handler: (ctx) => this.health(ctx.res) },
      { method: 'GET', pattern: 'admin/schema', access: { kind: 'admin' }, handler: (ctx) => byob.getSchema(ctx.res) },
      {
        method: 'POST',
        pattern: 'admin/schema',
        access: { kind: 'admin' },
        handler: (ctx) => byob.mutateSchema(ctx.req, ctx.res)
      },
      {
        method: 'GET',
        pattern: 'admin/schema/:table',
        access: { kind: 'admin' },
        handler: (ctx) => byob.getTableSchema(ctx.res, ctx.params.table)
      },
      {
        method: 'GET',
        pattern: 'admin/schema-export',
        access: { kind: 'admin' },
        handler: (ctx) => byob.exportSchema(ctx.res, ctx.query.format || 'json')
      },
      {
        method: 'GET',
        pattern: 'admin/workflows',
        access: { kind: 'admin' },
        handler: (ctx) => byob.workflowStatus(ctx.res)
      },
      {
        method: 'POST',
        pattern: 'admin/workflows/reload',
        access: { kind: 'admin' },
        handler: (ctx) => byob.reloadWorkflows(ctx.res)
      },
      {
        method: 'PUT',
        pattern: 'admin/workflows/:name',
        access: { kind: 'admin' },
        handler: (ctx) => byob.updateWorkflow(ctx.req, ctx.res, ctx.params.name)
      },
      {
        method: 'DELETE',
        pattern: 'admin/workflows/:name',
        access: { kind: 'admin' },
        handler: (ctx) => byob.deleteWorkflow(ctx.res, ctx.params.name)
      },
      {
        method: 'GET',
        pattern: 'executions',
        access: { kind: 'admin' },
        handler: (ctx) => byob.listExecutions(ctx.res, ctx.query)
      },
      {
        method: 'GET',
        pattern: 'executions/:id',
        access: { kind: 'admin' },
        handler: (ctx) => byob.getExecution(ctx.res, ctx.params.id)
      },

      // ---- Admin: the BAK-003 security surface -----------------------------
      {
        method: 'GET',
        pattern: 'admin/permissions',
        access: { kind: 'admin' },
        handler: (ctx) => adminSec.getPermissions(ctx)
      },
      {
        method: 'PUT',
        pattern: 'admin/permissions',
        access: { kind: 'admin' },
        handler: (ctx) => adminSec.putPermissions(ctx)
      },
      {
        method: 'POST',
        pattern: 'admin/permissions/check',
        access: { kind: 'admin' },
        handler: (ctx) => adminSec.checkAccess(ctx)
      },
      {
        method: 'PUT',
        pattern: 'admin/permissions/collections/:name',
        access: { kind: 'admin' },
        handler: (ctx) => adminSec.putCollection(ctx)
      },
      {
        method: 'DELETE',
        pattern: 'admin/permissions/collections/:name',
        access: { kind: 'admin' },
        handler: (ctx) => adminSec.deleteCollection(ctx)
      },
      { method: 'GET', pattern: 'admin/roles', access: { kind: 'admin' }, handler: (ctx) => adminSec.listRoles(ctx) },
      { method: 'POST', pattern: 'admin/roles', access: { kind: 'admin' }, handler: (ctx) => adminSec.createRole(ctx) },
      {
        method: 'DELETE',
        pattern: 'admin/roles/:name',
        access: { kind: 'admin' },
        handler: (ctx) => adminSec.deleteRole(ctx)
      },
      {
        method: 'POST',
        pattern: 'admin/roles/:name/users',
        access: { kind: 'admin' },
        handler: (ctx) => adminSec.addRoleUser(ctx)
      },
      {
        method: 'DELETE',
        pattern: 'admin/roles/:name/users/:userId',
        access: { kind: 'admin' },
        handler: (ctx) => adminSec.removeRoleUser(ctx)
      },
      { method: 'GET', pattern: 'admin/keys', access: { kind: 'admin' }, handler: (ctx) => adminSec.listKeys(ctx) },
      { method: 'POST', pattern: 'admin/keys', access: { kind: 'admin' }, handler: (ctx) => adminSec.createKey(ctx) },
      {
        method: 'DELETE',
        pattern: 'admin/keys/:id',
        access: { kind: 'admin' },
        handler: (ctx) => adminSec.revokeKey(ctx)
      }
    ];
  }

  // ==========================================================================
  // Listen / close
  // ==========================================================================

  listen(): Promise<ListenInfo> {
    return new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => {
        this.handle(req, res).catch((err) => sendError(res, err));
      });
      server.on('error', reject);
      server.listen(this.options.port, this.options.host, () => {
        const addr = server.address();
        const port = typeof addr === 'object' && addr ? addr.port : this.options.port;
        this.server = server;
        this.startedAt = Date.now();
        const url = `http://${this.options.host}:${port}`;
        this.files.setBaseUrl(url);
        resolve({ host: this.options.host, port, url });
      });
    });
  }

  close(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.server) return resolve();
      this.server.close(() => resolve());
      this.server = null;
    });
  }

  // ==========================================================================
  // Dispatcher — match, resolve principal, gate, run (model doc §8)
  // ==========================================================================

  private async handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const { pathname, query } = parseURL(req.url || '/');
    const method = req.method || 'GET';

    if (method === 'OPTIONS') {
      res.writeHead(204, { ...CORS_HEADERS, 'Access-Control-Max-Age': '86400' });
      res.end();
      return;
    }

    const seg = pathname.split('/').filter(Boolean).map(decodeURIComponent);
    const match = this.matchRoute(method, seg);
    if (!match) {
      // The unsupported account-mail flows (501 with client-scrapable shapes).
      if (this.users.handleUnsupported(res, pathname)) return;
      throw new HttpError(404, `Not found: ${method} ${pathname}`);
    }
    const { route, params } = match;

    // Step 1: principal. Invalid credentials are hard errors (401 / 400+209),
    // never a silent downgrade to anonymous — that includes dev-open mode.
    const principal = await this.security.resolvePrincipal(req);

    // Pre-read the body only where the operation itself depends on it
    // (Parse's POST /classes query tunnelling).
    let body: Record<string, unknown> | null = null;
    if (route.access.kind === 'data' && route.access.op === 'byBody') {
      body = await readJSONBody(req);
    }

    // Steps 2–3: dev-open fast-path, then the route gate.
    this.checkAccess(route.access, principal, params, body);

    const ctx: RequestContext = {
      req,
      res,
      params,
      query,
      body,
      principal,
      security: this.security,
      acl: (access) => this.security.aclFor(principal, access),
      checkData: (collection, op) => this.assertDataAccess(principal, collection, op),
      stampCreate: (collection, data) => this.stampCreate(principal, collection, data)
    };
    await route.handler(ctx);
  }

  private matchRoute(method: string, seg: string[]): { route: RouteDef; params: Record<string, string> } | null {
    for (const route of this.routes) {
      if (route.method !== method) continue;
      const parts = route.pattern.split('/');
      if (parts.length !== seg.length) continue;
      const params: Record<string, string> = {};
      let ok = true;
      for (let i = 0; i < parts.length; i++) {
        if (parts[i].startsWith(':')) {
          params[parts[i].slice(1)] = seg[i];
        } else if (parts[i] !== seg[i]) {
          ok = false;
          break;
        }
      }
      if (ok) return { route, params };
    }
    return null;
  }

  private checkAccess(
    access: RouteAccess,
    principal: Principal,
    params: Record<string, string>,
    body: Record<string, unknown> | null
  ): void {
    if (access.kind === 'public') return;

    // Step 2: dev-open relaxes every gate — only ever active on loopback
    // (the startup interlock guarantees a non-loopback bind cannot get here).
    if (this.security.devOpenActive) return;

    switch (access.kind) {
      case 'admin':
        if (principal.kind !== 'admin') {
          // One answer for wrong and missing credentials — no admin oracle.
          throw new HttpError(401, 'Unauthorized.');
        }
        return;

      case 'data': {
        const collection = params[access.collectionParam];
        const op: ClpOp =
          access.op === 'byBody' ? (body && body._method === 'GET' ? 'find' : 'create') : access.op;
        this.assertDataAccess(principal, collection, op);
        return;
      }

      case 'data-perOp':
        // The handler enforces per contained operation via ctx.checkData.
        return;

      case 'function': {
        const name = params[access.nameParam];
        if (principal.kind === 'admin') return;
        if (principal.kind === 'apiKey') {
          if (keyAllowsFunction(principal.scopes, name)) return;
          throw new HttpError(403, `Permission denied: API key "${principal.name}" cannot call "${name}".`, 119);
        }
        const configured = this.security.config.functions[name];
        const rule =
          configured && configured.call !== undefined
            ? configured.call
            : this.functionAuthDefault(name);
        if (ruleAllows(rule, principal)) return;
        throw new HttpError(403, `Permission denied for function "${name}".`, 119);
      }

      case 'files': {
        if (principal.kind === 'admin') return;
        if (principal.kind === 'apiKey') {
          // No key scope covers files in v1 (model doc §6).
          throw new HttpError(403, 'Permission denied for this file operation.', 119);
        }
        if (ruleAllows(this.security.config.files[access.op], principal)) return;
        throw new HttpError(403, 'Permission denied for this file operation.', 119);
      }

      case 'signup': {
        if (principal.kind === 'admin') return;
        if (principal.kind === 'apiKey') {
          throw new HttpError(403, 'Permission denied: API keys cannot create users.', 119);
        }
        if (ruleAllows(this.security.config.signup, principal)) return;
        throw new HttpError(403, 'Permission denied: signups are disabled on this backend.', 119);
      }

      case 'session':
        // The endpoint IS the auth system; it enforces its own semantics.
        return;
    }
  }

  /** The function-rule default: the graph author's allowNoAuth declaration. */
  private functionAuthDefault(name: string): string {
    const runner = this.getRunner();
    const allowNoAuth = runner ? runner.functionAllowsNoAuth(name) : false;
    return allowNoAuth ? 'public' : 'authenticated';
  }

  /** CLP assertion shared by the dispatcher and /api/_batch (throws 403/119). */
  private assertDataAccess(principal: Principal, collection: string, op: ClpOp): void {
    if (this.security.devOpenActive) return;
    const decision = this.security.checkClp(principal, collection, op);
    if (!decision.allowed) {
      throw new HttpError(403, `Permission denied for this operation on "${collection}".`, 119);
    }
  }

  /**
   * Create-time stamping (model doc §5): validate any client ACL, and when a
   * user creates into a creator-owns collection, stamp `owner` and the
   * template ACL. Runs in dev-open too, so the posture survives the flip.
   */
  private stampCreate(principal: Principal, collection: string, data: Record<string, unknown>): void {
    const aclError = validateAclShape(data.ACL);
    if (aclError) throw new HttpError(400, `Invalid ACL: ${aclError}`, 123);
    if (data.ACL === undefined || data.ACL === null) delete data.ACL;

    if (principal.kind === 'user' && this.security.creatorOwns(collection)) {
      const sm = this.facade.schemaManager;
      if (sm) {
        // Ensure the table + a properly-typed owner column exist before insert
        // (addColumn on a missing table is a SQL error, and letting create()
        // infer the type would record a plain String instead of a Pointer).
        sm.createTable({ name: collection, columns: [] });
        sm.addColumn(collection, { name: 'owner', type: 'Pointer', targetClass: '_User' });
      }
      data.owner = principal.userId;
      if (data.ACL === undefined) {
        data.ACL = { [principal.userId]: { read: true, write: true } };
      }
    }
  }

  // ==========================================================================
  // Handlers that live at the router level
  // ==========================================================================

  private health(res: http.ServerResponse): void {
    const runner = this.getRunner();
    const status = this.persistence.status;
    sendJSON(res, 200, {
      ok: true,
      service: 'nodegx-backend',
      backendId: this.options.backendId,
      backendName: this.options.backendName,
      uptimeMs: this.startedAt ? Date.now() - this.startedAt : 0,
      persistence: {
        mode: status.mode,
        engine: status.engine,
        persistent: status.persistent,
        ephemeral: status.ephemeral,
        error: status.error
      },
      security: {
        devOpen: this.security.config.devOpen,
        enforced: !this.security.devOpenActive,
        migratedThisStart: this.security.migratedThisStart
      },
      workflows: runner ? runner.getStatus() : { initialized: false, workflowCount: 0, functions: [] }
    });
  }

  private async runFunction(ctx: RequestContext): Promise<void> {
    const runner = this.getRunner();
    if (!runner) {
      throw new HttpError(503, 'Workflows are still starting up');
    }

    // The runner receives the request in CloudRunner's shape: raw JSON string
    // body + headers verbatim (session tokens ride along in headers).
    const body = await readJSONBody(ctx.req);
    const response = await runner.run(ctx.params.name, {
      body: JSON.stringify(body),
      headers: ctx.req.headers as Record<string, unknown>
    });

    ctx.res.writeHead(response.statusCode, { 'Content-Type': 'application/json', ...CORS_HEADERS });
    ctx.res.end(response.body);
  }
}
