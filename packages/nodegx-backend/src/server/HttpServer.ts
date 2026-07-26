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
import type { RealtimeHub, Subscription } from '../realtime/RealtimeHub';
import { ClpOp, Principal, keyAllowsFunction, ruleAllows, validateAclShape } from '../security/model';
import type { TriggerSubsystem } from '../triggers/TriggerSubsystem';
import type { WorkflowSubsystem } from '../workflow/WorkflowSubsystem';
import type { BackupSubsystem } from '../backup/BackupSubsystem';
import { verifyWebhook } from '../triggers/webhook';
import type { EmailConfigState } from '../email/EmailConfigState';
import type { Mailer } from '../email/Mailer';
import { EmailTokenStore } from '../email/tokens';
import { AdminSecurityRoutes } from './admin-security';
import { AdminTriggerRoutes } from './admin-triggers';
import { AdminWorkflowRoutes } from './admin-workflows';
import { AdminEmailRoutes } from './admin-email';
import { AdminBackupRoutes } from './admin-backups';
import { AdminFileRoutes } from './admin-files';
import { ByobAdminRoutes } from './byob-admin';
import { EmailRoutes } from './email-routes';
import { FileRoutes } from './files';
import type { FileSubsystem } from '../storage/FileSubsystem';
import { ParseWireRoutes } from './parse-wire';
import { UserRoutes } from './users';
import { AdminDashboardRoutes, DashboardFeatures } from '../admin/AdminDashboardRoutes';
import { AuthAttemptLimiter } from '../admin/auth';
import { readonlyAdminMayCall, readonlyRefusalMessage } from '../admin/readonly';
import { clientKey } from './rate-limit';
import { CORS_HEADERS, HttpError, parseURL, readJSONBody, readRawBody, sendError, sendJSON } from './http-util';

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
  | { kind: 'session' }
  /** Incoming webhook (WF-005) — SELF-ENFORCING on the per-hook secret; the
   *  handler verifies and rejects loudly into the execution record. */
  | { kind: 'webhook' };

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
  /** Realtime (SSE) hub — BAK-001. */
  realtime: RealtimeHub;
  /** Trigger subsystem — WF-005 (webhook route + admin trigger CRUD). */
  triggers: TriggerSubsystem;
  /** Workflow subsystem — WF-001 (admin workflow-def CRUD + run/cancel). */
  workflows: WorkflowSubsystem | null;
  /** Backup subsystem — BAK-007 (backup/restore, export/import, schema promotion). */
  backups: BackupSubsystem;
  /** File subsystem — BAK-006 (metadata, driver, transforms, orphan sweep). */
  files: FileSubsystem;
  /** Email subsystem (BAK-002): config/secrets, the mailer, and the token store. */
  emailConfig: EmailConfigState;
  mailer: Mailer;
  emailTokens: EmailTokenStore;
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
  private readonly realtime: RealtimeHub;
  private readonly triggers: TriggerSubsystem;
  private server: http.Server | null = null;
  private startedAt = 0;

  private readonly byob: ByobAdminRoutes;
  private readonly parse: ParseWireRoutes;
  private readonly users: UserRoutes;
  private readonly files: FileRoutes;
  private readonly adminSecurity: AdminSecurityRoutes;
  private readonly adminTriggers: AdminTriggerRoutes;
  private readonly adminWorkflows: AdminWorkflowRoutes;
  private readonly adminBackups: AdminBackupRoutes;
  private readonly adminFiles: AdminFileRoutes;
  private readonly email: EmailRoutes;
  private readonly adminEmail: AdminEmailRoutes;
  /** BAK-005's dashboard, or null when `--no-admin` removed it entirely. */
  private readonly dashboard: AdminDashboardRoutes | null;
  /** BAK-005: failure budget in front of the one credential check. */
  private readonly authLimiter = new AuthAttemptLimiter();
  private readonly routes: RouteDef[];

  constructor(deps: HttpServerDeps) {
    this.options = deps.options;
    this.persistence = deps.persistence;
    this.facade = deps.facade;
    this.security = deps.security;
    this.getRunner = deps.getRunner;
    this.realtime = deps.realtime;
    this.triggers = deps.triggers;

    this.byob = new ByobAdminRoutes(deps.facade, deps.executions, deps.getRunner);
    this.parse = new ParseWireRoutes(deps.facade, deps.getConfigParams || (() => ({})));
    this.email = new EmailRoutes({
      facade: deps.facade,
      emailConfig: deps.emailConfig,
      mailer: deps.mailer,
      tokens: deps.emailTokens,
      backendId: deps.options.backendId,
      backendName: deps.options.backendName,
      getLocalUrl: () => `http://127.0.0.1:${deps.options.port}`
    });
    this.users = new UserRoutes(deps.facade, deps.security, deps.emailConfig, this.email);
    this.files = new FileRoutes(deps.options.dataDir, `http://127.0.0.1:${deps.options.port}`, deps.files);
    this.adminFiles = new AdminFileRoutes(deps.files);
    this.adminSecurity = new AdminSecurityRoutes(deps.security, deps.facade, deps.options, deps.getRunner);
    this.adminTriggers = new AdminTriggerRoutes(deps.triggers);
    this.adminWorkflows = new AdminWorkflowRoutes(() => deps.workflows);
    this.adminBackups = new AdminBackupRoutes({
      backups: deps.backups,
      facade: deps.facade,
      dataDir: deps.options.dataDir
    });
    this.adminEmail = new AdminEmailRoutes(deps.emailConfig, deps.mailer);
    this.dashboard = deps.options.adminDashboard
      ? new AdminDashboardRoutes({
          options: deps.options,
          security: deps.security,
          features: () => this.dashboardFeatures(deps)
        })
      : null;
    this.routes = this.buildRoutes();
  }

  /**
   * Which dashboard sections this build can actually serve. Derived from the
   * subsystems the composition root wired in, not from a constant — a service
   * started without workflows, or whose execution-history database refused to
   * open, hides those tabs instead of serving ones that 503 (loud failure, in
   * its quiet form: absent rather than broken).
   */
  private dashboardFeatures(deps: HttpServerDeps): DashboardFeatures {
    return {
      collections: true,
      schema: Boolean(deps.facade.schemaManager),
      users: true,
      roles: Boolean(deps.facade.schemaManager),
      permissions: true,
      apiKeys: true,
      triggers: Boolean(deps.triggers),
      workflows: Boolean(deps.workflows),
      executions: deps.executions.getStatus().enabled,
      email: Boolean(deps.emailConfig),
      backups: Boolean(deps.backups),
      realtime: Boolean(deps.realtime),
      files: Boolean(deps.files)
    };
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
    const adminTriggers = this.adminTriggers;
    const adminWorkflows = this.adminWorkflows;
    const adminBackups = this.adminBackups;
    const adminFiles = this.adminFiles;
    const email = this.email;
    const adminEmail = this.adminEmail;

    return [
      // ---- Public ----------------------------------------------------------
      { method: 'GET', pattern: 'health', access: { kind: 'public' }, handler: (ctx) => this.health(ctx.res) },
      { method: 'GET', pattern: 'config', access: { kind: 'public' }, handler: (ctx) => parse.config(ctx.res) },

      // ---- Realtime (SSE) — BAK-001 ---------------------------------------
      // Both are `public` and SELF-ENFORCING, exactly like the session routes:
      // opening a stream leaks nothing (delivery is gated per-event on the row
      // ACL), and subscription creation is gated internally on each collection's
      // `find` CLP against the connection's principal. EventSource cannot set
      // headers, so the auth token rides in a query param (documented caveat).
      { method: 'GET', pattern: 'realtime', access: { kind: 'public' }, handler: (ctx) => this.realtimeStream(ctx) },
      {
        method: 'POST',
        pattern: 'realtime/subscriptions',
        access: { kind: 'public' },
        handler: (ctx) => this.realtimeSubscribe(ctx)
      },

      // ---- Webhooks (WF-005) ----------------------------------------------
      // Public route, SELF-ENFORCING on the per-hook secret. Localhost binding +
      // WF-004 auth still govern whether it is reachable at all; the secret
      // governs whether a reachable request is accepted. An unauthenticated hit
      // on a KNOWN hook is rejected loudly into the execution record.
      {
        method: 'POST',
        pattern: 'hooks/:backendId/:slug',
        access: { kind: 'webhook' },
        handler: (ctx) => this.handleWebhook(ctx)
      },

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

      // ---- Files (BAK-006) --------------------------------------------------
      {
        method: 'POST',
        pattern: 'files/:name',
        access: { kind: 'files', op: 'upload' },
        handler: (ctx) => files.upload(ctx)
      },
      {
        method: 'GET',
        pattern: 'files/:name',
        access: { kind: 'files', op: 'read' },
        handler: (ctx) => files.serve(ctx)
      },
      {
        method: 'DELETE',
        pattern: 'files/:name',
        access: { kind: 'files', op: 'delete' },
        handler: (ctx) => files.delete(ctx)
      },
      {
        // Minting a signed URL is itself a read grant — same coarse gate as
        // GET, with the row-ACL check happening inside signUrl() (module doc).
        method: 'GET',
        pattern: 'files/:name/sign',
        access: { kind: 'files', op: 'read' },
        handler: (ctx) => files.signUrl(ctx)
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

      // ---- Account email flows (BAK-002) — public, self-governing (rate
      // limiting + anti-enumeration are internal to the handlers; see
      // email-routes.ts's module doc for why these are 'public' by design,
      // the same posture as the session routes above). ---------------------
      {
        method: 'POST',
        pattern: 'requestPasswordReset',
        access: { kind: 'public' },
        handler: (ctx) => email.requestPasswordReset(ctx.req, ctx.res)
      },
      {
        method: 'POST',
        pattern: 'verificationEmailRequest',
        access: { kind: 'public' },
        handler: (ctx) => email.requestEmailVerification(ctx.req, ctx.res)
      },
      {
        method: 'GET',
        pattern: 'apps/:appId/request_password_reset',
        access: { kind: 'public' },
        handler: (ctx) => email.servePasswordResetForm(ctx.res, ctx.query, ctx.params.appId)
      },
      {
        method: 'POST',
        pattern: 'apps/:appId/request_password_reset',
        access: { kind: 'public' },
        handler: (ctx) => email.processPasswordReset(ctx.req, ctx.res)
      },
      {
        method: 'GET',
        pattern: 'apps/:appId/verify_email',
        access: { kind: 'public' },
        handler: (ctx) => email.verifyEmail(ctx.res, ctx.query)
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
      },

      // ---- Admin: triggers (WF-005) ---------------------------------------
      { method: 'GET', pattern: 'admin/triggers', access: { kind: 'admin' }, handler: (ctx) => adminTriggers.list(ctx) },
      {
        method: 'POST',
        pattern: 'admin/triggers',
        access: { kind: 'admin' },
        handler: (ctx) => adminTriggers.create(ctx)
      },
      {
        method: 'GET',
        pattern: 'admin/triggers/:id',
        access: { kind: 'admin' },
        handler: (ctx) => adminTriggers.get(ctx)
      },
      {
        method: 'PUT',
        pattern: 'admin/triggers/:id',
        access: { kind: 'admin' },
        handler: (ctx) => adminTriggers.update(ctx)
      },
      {
        method: 'DELETE',
        pattern: 'admin/triggers/:id',
        access: { kind: 'admin' },
        handler: (ctx) => adminTriggers.delete(ctx)
      },
      {
        method: 'POST',
        pattern: 'admin/triggers/:id/enabled',
        access: { kind: 'admin' },
        handler: (ctx) => adminTriggers.setEnabled(ctx)
      },
      {
        method: 'POST',
        pattern: 'admin/triggers/:id/fire',
        access: { kind: 'admin' },
        handler: (ctx) => adminTriggers.fire(ctx)
      },

      // ---- Admin: workflow definitions (WF-001) + step kinds (WF-002) -----
      {
        method: 'GET',
        pattern: 'admin/workflow-step-kinds',
        access: { kind: 'admin' },
        handler: (ctx) => adminWorkflows.stepKinds(ctx)
      },
      {
        method: 'GET',
        pattern: 'admin/workflow-defs',
        access: { kind: 'admin' },
        handler: (ctx) => adminWorkflows.list(ctx)
      },
      {
        method: 'POST',
        pattern: 'admin/workflow-defs',
        access: { kind: 'admin' },
        handler: (ctx) => adminWorkflows.create(ctx)
      },
      {
        method: 'GET',
        pattern: 'admin/workflow-defs/:id',
        access: { kind: 'admin' },
        handler: (ctx) => adminWorkflows.get(ctx)
      },
      {
        method: 'PUT',
        pattern: 'admin/workflow-defs/:id',
        access: { kind: 'admin' },
        handler: (ctx) => adminWorkflows.update(ctx)
      },
      {
        method: 'DELETE',
        pattern: 'admin/workflow-defs/:id',
        access: { kind: 'admin' },
        handler: (ctx) => adminWorkflows.delete(ctx)
      },
      {
        method: 'POST',
        pattern: 'admin/workflow-defs/:id/run',
        access: { kind: 'admin' },
        handler: (ctx) => adminWorkflows.run(ctx)
      },
      {
        method: 'POST',
        pattern: 'admin/workflow-runs/:executionId/cancel',
        access: { kind: 'admin' },
        handler: (ctx) => adminWorkflows.cancel(ctx)
      },

      // ---- Admin: backups / export-import / promotion (BAK-007) -----------
      { method: 'GET', pattern: 'admin/backups', access: { kind: 'admin' }, handler: (ctx) => adminBackups.list(ctx) },
      {
        method: 'POST',
        pattern: 'admin/backups',
        access: { kind: 'admin' },
        handler: (ctx) => adminBackups.runBackup(ctx)
      },
      {
        method: 'PUT',
        pattern: 'admin/backups/config',
        access: { kind: 'admin' },
        handler: (ctx) => adminBackups.updateConfig(ctx)
      },
      {
        method: 'POST',
        pattern: 'admin/backups/restore',
        access: { kind: 'admin' },
        handler: (ctx) => adminBackups.restore(ctx)
      },
      {
        method: 'GET',
        pattern: 'admin/export/:collection',
        access: { kind: 'admin' },
        handler: (ctx) => adminBackups.exportCollection(ctx)
      },
      {
        method: 'POST',
        pattern: 'admin/import/:collection',
        access: { kind: 'admin' },
        handler: (ctx) => adminBackups.importCollection(ctx)
      },
      {
        method: 'POST',
        pattern: 'admin/schema/diff',
        access: { kind: 'admin' },
        handler: (ctx) => adminBackups.schemaDiff(ctx)
      },
      {
        method: 'POST',
        pattern: 'admin/schema/apply',
        access: { kind: 'admin' },
        handler: (ctx) => adminBackups.schemaApply(ctx)
      },

      // ---- Admin: file storage config (BAK-006) ----------------------------
      {
        method: 'GET',
        pattern: 'admin/files/config',
        access: { kind: 'admin' },
        handler: (ctx) => adminFiles.getConfig(ctx)
      },
      {
        method: 'PUT',
        pattern: 'admin/files/config',
        access: { kind: 'admin' },
        handler: (ctx) => adminFiles.updateConfig(ctx)
      },
      {
        method: 'POST',
        pattern: 'admin/files/sweep',
        access: { kind: 'admin' },
        handler: (ctx) => adminFiles.runSweep(ctx)
      },

      // ---- Admin: the BAK-002 email surface --------------------------------
      { method: 'GET', pattern: 'admin/email/config', access: { kind: 'admin' }, handler: (ctx) => adminEmail.getConfig(ctx) },
      {
        method: 'PUT',
        pattern: 'admin/email/config',
        access: { kind: 'admin' },
        handler: (ctx) => adminEmail.putConfig(ctx)
      },
      {
        method: 'POST',
        pattern: 'admin/email/test',
        access: { kind: 'admin' },
        handler: (ctx) => adminEmail.testSend(ctx)
      },
      {
        method: 'GET',
        pattern: 'admin/email/templates',
        access: { kind: 'admin' },
        handler: (ctx) => adminEmail.getTemplates(ctx)
      },
      {
        method: 'PUT',
        pattern: 'admin/email/templates/:id',
        access: { kind: 'admin' },
        handler: (ctx) => adminEmail.putTemplate(ctx)
      },
      {
        method: 'DELETE',
        pattern: 'admin/email/templates/:id',
        access: { kind: 'admin' },
        handler: (ctx) => adminEmail.deleteTemplate(ctx)
      },
      {
        method: 'GET',
        pattern: 'admin/email/templates/:id/preview',
        access: { kind: 'admin' },
        handler: (ctx) => adminEmail.previewTemplate(ctx)
      },

      // ---- The served admin dashboard (BAK-005) ---------------------------
      // Empty when `--no-admin` was passed: the route is absent, not disabled.
      ...this.dashboardRoutes()
    ];
  }

  /**
   * BAK-005's two routes. The document is `public` BY DESIGN — it is the login
   * page, it contains no backend state, and every byte of data it later shows
   * comes from the admin-gated routes above. `whoami` is admin-gated, so
   * reaching it is what proves the credential.
   */
  private dashboardRoutes(): RouteDef[] {
    if (!this.dashboard) return [];
    const dashboard = this.dashboard;
    return [
      { method: 'GET', pattern: '_admin', access: { kind: 'public' }, handler: (ctx) => dashboard.serve(ctx) },
      { method: 'GET', pattern: '_admin/whoami', access: { kind: 'admin' }, handler: (ctx) => dashboard.whoami(ctx) }
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
      throw new HttpError(404, `Not found: ${method} ${pathname}`);
    }
    const { route, params } = match;

    // Step 1: principal. Invalid credentials are hard errors (401 / 400+209),
    // never a silent downgrade to anonymous — that includes dev-open mode.
    //
    // BAK-005 wraps that one check in a per-client failure budget: the served
    // dashboard makes the admin credential something typed into a form on a
    // reachable URL, so online guessing is now a real attack. Only failures
    // count, and the refusal is a plain 429 — it reveals nothing about which
    // credential was wrong.
    const authBucket = clientKey(req as unknown as { headers: Record<string, unknown>; socket?: { remoteAddress?: string } });
    if (this.authLimiter.isLockedOut(authBucket)) {
      const retryAfter = this.authLimiter.retryAfterSeconds(authBucket);
      res.setHeader('Retry-After', String(retryAfter));
      throw new HttpError(429, `Too many failed credential attempts. Try again in ${retryAfter}s.`);
    }
    let principal: Principal;
    try {
      principal = await this.security.resolvePrincipal(req);
    } catch (e) {
      this.authLimiter.recordFailure(authBucket);
      throw e;
    }

    // BAK-005 read-only tier: refuse every state-changing request from a
    // read-only admin BEFORE the handler runs. Coarse by design — a route added
    // later is refused by default if it mutates, so the tier's promise does not
    // depend on anyone remembering to annotate it. See ../admin/readonly.
    if (principal.kind === 'admin' && principal.readonly && !readonlyAdminMayCall(method, route.pattern)) {
      throw new HttpError(403, readonlyRefusalMessage(method, route.pattern), 119);
    }

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

      case 'webhook':
        // Self-enforcing: handleWebhook verifies the per-hook secret and rejects
        // loudly into the execution record. No CLP/session gate applies — the
        // secret is the credential.
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

  // ==========================================================================
  // Realtime (SSE) — BAK-001
  // ==========================================================================

  /**
   * `GET /realtime`. A genuine EventSource sends `Accept: text/event-stream`;
   * for that we resolve the principal (token via query param, since EventSource
   * cannot set headers) and open the stream. Any other GET (a probe, a browser
   * hitting the URL, the route-walk test) gets a finite JSON description instead
   * of a stream that would never close.
   */
  private async realtimeStream(ctx: RequestContext): Promise<void> {
    const accept = String(ctx.req.headers['accept'] || '');
    if (!accept.includes('text/event-stream')) {
      sendJSON(ctx.res, 200, {
        realtime: true,
        transport: 'sse',
        hint:
          'Open GET /realtime with `Accept: text/event-stream` (pass the auth token as ?token=… since ' +
          'EventSource cannot set headers), then POST /realtime/subscriptions {clientId, subscriptions:[{collection, filter?}]}.'
      });
      return;
    }

    // Resolve BEFORE writing any stream bytes so an invalid token is a clean
    // 401/209, not a half-open stream.
    const principal = await this.resolveSSEPrincipal(ctx.req, ctx.query);
    const lastEventId =
      (typeof ctx.req.headers['last-event-id'] === 'string' ? ctx.req.headers['last-event-id'] : undefined) ||
      ctx.query.lastEventId;

    // http.ServerResponse structurally satisfies the hub's SSEResponse.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.realtime.addConnection(ctx.res as any, principal, lastEventId);
    // Deliberately do NOT end the response — the stream stays open.
  }

  /**
   * `POST /realtime/subscriptions`. Replaces the referenced connection's
   * subscription set (Pocketbase-style). CLP gating uses the CONNECTION's stored
   * principal (established at stream open), so the clientId — a server-minted
   * secret — is the capability; the POST needs no separate auth.
   */
  private async realtimeSubscribe(ctx: RequestContext): Promise<void> {
    const body = await readJSONBody(ctx.req);
    const clientId = body && typeof body.clientId === 'string' ? body.clientId : '';
    if (!clientId) throw new HttpError(400, 'clientId is required');

    const rawSubs = Array.isArray(body.subscriptions) ? body.subscriptions : [];
    const subscriptions: Subscription[] = rawSubs.map((s) => {
      const sub = (s || {}) as Record<string, unknown>;
      return {
        collection: typeof sub.collection === 'string' ? sub.collection : '',
        filter: sub.filter && typeof sub.filter === 'object' ? (sub.filter as Record<string, unknown>) : undefined
      };
    });

    const result = this.realtime.setSubscriptions(clientId, subscriptions);
    if (!result) throw new HttpError(404, 'Unknown clientId — reconnect and re-subscribe');
    sendJSON(ctx.res, 200, result);
  }

  /**
   * Principal resolution for SSE: EventSource cannot set headers, so a token may
   * arrive as `?token=`/`?sessionToken=` (session), `?authToken=` (admin bearer),
   * or `?apiKey=`. A real header, if present, always wins. Delegates to the same
   * `resolvePrincipal` the dispatcher uses, so the identity rules are identical.
   */
  private resolveSSEPrincipal(req: http.IncomingMessage, query: Record<string, string>): Promise<Principal> {
    const headers = { ...req.headers } as http.IncomingHttpHeaders;
    const hasAuthHeader =
      headers['authorization'] ||
      headers['x-parse-master-key'] ||
      headers['x-parse-session-token'] ||
      headers['x-nodegx-api-key'];
    if (!hasAuthHeader) {
      if (query.authToken) headers['authorization'] = `Bearer ${query.authToken}`;
      else if (query.apiKey) headers['x-nodegx-api-key'] = query.apiKey;
      else if (query.token) headers['x-parse-session-token'] = query.token;
      else if (query.sessionToken) headers['x-parse-session-token'] = query.sessionToken;
    }
    return this.security.resolvePrincipal({ headers } as http.IncomingMessage);
  }

  // ==========================================================================
  // Webhooks (WF-005)
  // ==========================================================================

  /**
   * `POST /hooks/:backendId/:slug`. Route by slug to an enabled webhook trigger,
   * enforce the per-hook body-size limit, verify the per-hook secret, then fire
   * the target function via the one dispatcher path. Every refusal (oversize,
   * bad/missing secret) is recorded LOUDLY into the execution history before the
   * error is returned. An unknown/disabled slug 404s without a record (probe
   * spam is not automation history).
   */
  private async handleWebhook(ctx: RequestContext): Promise<void> {
    const { backendId, slug } = ctx.params;
    if (backendId !== this.options.backendId) {
      throw new HttpError(404, `No backend "${backendId}" here`);
    }

    const registry = this.triggers.registry;
    const dispatcher = this.triggers.dispatcher;
    const trigger = registry.enabledWebhookBySlug(slug);
    if (!trigger || !trigger.webhook) {
      throw new HttpError(404, `No enabled webhook "${slug}"`);
    }
    const targetName = trigger.target.name;
    const source = `webhook ${slug}`;
    const maxBytes = trigger.webhook.maxBodyBytes;

    // Per-hook size limit. Reject on the declared Content-Length FIRST so the
    // response sends cleanly (reading-then-destroying the socket would race the
    // 413 with a connection reset). Real senders always set Content-Length.
    const declaredLength = Number(ctx.req.headers['content-length'] || '0');
    if (declaredLength && declaredLength > maxBytes) {
      dispatcher.recordRejection({
        triggerType: 'webhook',
        triggerId: trigger.id,
        workflowId: targetName,
        source,
        reason: `webhook body (${declaredLength} bytes) exceeds the ${maxBytes}-byte limit`,
        triggerData: { slug }
      });
      throw new HttpError(413, `Webhook body exceeds ${maxBytes} bytes`);
    }

    // Backstop for chunked / unset-length bodies.
    let rawBody: Buffer;
    try {
      rawBody = await readRawBody(ctx.req, maxBytes);
    } catch (e) {
      if (e instanceof HttpError && e.status === 413) {
        dispatcher.recordRejection({
          triggerType: 'webhook',
          triggerId: trigger.id,
          workflowId: targetName,
          source,
          reason: `webhook body exceeds the ${trigger.webhook.maxBodyBytes}-byte limit`,
          triggerData: { slug }
        });
        throw new HttpError(413, `Webhook body exceeds ${trigger.webhook.maxBodyBytes} bytes`);
      }
      throw e;
    }

    // Verify the per-hook secret. A miss is an UNAUTHENTICATED hook: reject
    // loudly into the execution record (spec risk row).
    const secret = registry.getWebhookSecret(trigger.id) || '';
    const verify = verifyWebhook(trigger.webhook.scheme, secret, rawBody, ctx.req.headers, ctx.query);
    if (!verify.ok) {
      dispatcher.recordRejection({
        triggerType: 'webhook',
        triggerId: trigger.id,
        workflowId: targetName,
        source,
        reason: `unauthenticated webhook (${trigger.webhook.scheme}): ${verify.reason}`,
        triggerData: { slug, contentLength: rawBody.length }
      });
      throw new HttpError(401, `Webhook rejected: ${verify.reason}`);
    }

    // Parse the body (JSON when possible; else the raw text) and hand the target
    // a uniform trigger envelope.
    const text = rawBody.toString('utf-8');
    let parsed: unknown = {};
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }
    const headerObj: Record<string, string> = {};
    for (const [k, v] of Object.entries(ctx.req.headers)) {
      headerObj[k] = Array.isArray(v) ? v.join(', ') : String(v ?? '');
    }

    const outcome = await dispatcher.fire({
      trigger,
      triggerType: 'webhook',
      source,
      payload: { trigger: 'webhook', triggerId: trigger.id, slug, headers: headerObj, query: ctx.query, body: parsed },
      headers: ctx.req.headers as Record<string, unknown>
    });

    ctx.res.writeHead(outcome.statusCode, { 'Content-Type': 'application/json', ...CORS_HEADERS });
    ctx.res.end(outcome.body || JSON.stringify({ ok: outcome.result.ok }));
  }
}
