/**
 * BackendService — the composition root for the standalone service.
 *
 * Start order matters and is deliberate:
 *
 *   1. Persistence (loud-failure: no engine + !allowEphemeral => refuse to start)
 *   2. Execution history (`<dataDir>/executions.sqlite`; disabled-loudly if it
 *      cannot open — never blocks function runs)
 *   3. HTTP surface (listen; `/functions` answers 503 until step 5)
 *   4. `_noodl_cloudservices` loopback — record/user/config nodes running
 *      INSIDE cloud functions speak the Parse-wire subset back to this same
 *      process. This is what finally gives functions database access; the old
 *      in-editor runner's adapter injection was consumed by nothing.
 *   5. WorkflowRunner (CloudRunner bundled statically — no silent path probes)
 *
 * No Electron anywhere. This runs identically as a child process the editor
 * spawns and as a headless server on a deploy target.
 *
 * @module nodegx-backend/service
 */

import * as fs from 'fs';
import * as path from 'path';

import { BackendServiceOptions, resolveOptions, requiresAuth } from './config';
import { createAdapter, PersistenceHandle } from './persistence/createAdapter';
import { AdapterFacade } from './persistence/AdapterFacade';
import { ExecutionHistory, ExecutionHistoryStatus } from './execution/ExecutionStore';
import { HttpServer, ListenInfo } from './server/HttpServer';
import { WorkflowRunner } from './workflow/WorkflowRunner';
import { SecurityState, SecurityStartupError } from './security/state';
import { ChangeBus } from './realtime/ChangeBus';
import { RealtimeHub } from './realtime/RealtimeHub';
import { EmailConfigState } from './email/EmailConfigState';
import { Mailer, SendEmailResult } from './email/Mailer';
import { EmailTokenStore } from './email/tokens';
import { isTemplateId, renderTemplate } from './email/templates';

/** The shape the Send Email node (noodl-viewer-cloud) calls `_noodl_send_email` with. */
export interface SendEmailNodeRequest {
  to: string;
  subject?: string;
  text?: string;
  html?: string;
  /** A known template id ('passwordReset' | 'verifyEmail') — when set, subject/text/html above are ignored. */
  template?: string;
  /** Variables for `{{...}}` interpolation when `template` is set. `appName` defaults to the backend's name. */
  variables?: Record<string, string>;
}

export interface StartedService {
  options: BackendServiceOptions;
  listen: ListenInfo;
  persistence: PersistenceHandle;
  executionHistory: ExecutionHistoryStatus;
  workflows: { initialized: boolean; workflowCount: number };
  security: { devOpen: boolean; enforced: boolean; migratedThisStart: boolean };
  stop(): Promise<void>;
}

export class BackendService {
  readonly options: BackendServiceOptions;
  private persistence: PersistenceHandle | null = null;
  private facade: AdapterFacade | null = null;
  private http: HttpServer | null = null;
  private runner: WorkflowRunner | null = null;
  private security: SecurityState | null = null;
  private changeBus: ChangeBus | null = null;
  private realtime: RealtimeHub | null = null;
  private emailConfig: EmailConfigState | null = null;
  private mailer: Mailer | null = null;
  private readonly executions = new ExecutionHistory();

  constructor(partial: Partial<BackendServiceOptions> = {}) {
    this.options = resolveOptions(partial);
  }

  async start(): Promise<StartedService> {
    // 0. This process IS a cloud runtime: the runtime clients (cloudstore,
    //    configservice) branch on `_noodl_cloud_runtime_version` to pick their
    //    fetch-based code path over browser XHR. The esbuild bundle defines it
    //    via banner; define it here too so the service behaves identically
    //    un-bundled (tests, programmatic embedding).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = globalThis as any;
    if (typeof g._noodl_cloud_runtime_version === 'undefined') {
      g._noodl_cloud_runtime_version = 'nodegx-backend';
    }

    // 1. Persistence first — if this throws (no engine + !allowEphemeral) the
    //    service refuses to start. That is the point.
    this.persistence = await createAdapter({
      dataDir: this.options.dataDir,
      allowEphemeral: this.options.allowEphemeral
    });
    this.facade = new AdapterFacade(this.persistence.adapter);
    this.ensureSystemTables();

    // 1.5 Security (BAK-003): load/create security.json + the admin credential,
    //     and run the deploy interlock (non-loopback + devOpen = refuse).
    this.security = new SecurityState({
      dataDir: this.options.dataDir,
      loopback: !requiresAuth(this.options),
      cliToken: this.options.authToken,
      facade: this.facade
    });
    if (!this.security.config.devOpen && this.persistence.status.ephemeral) {
      // The in-memory mock cannot evaluate ACL predicates; enforcing on top of
      // it would be silent non-enforcement. Refuse rather than pretend.
      throw new SecurityStartupError(
        'ENFORCEMENT_NEEDS_PERSISTENCE',
        'Refusing to start: access control is enabled (devOpen: false) but persistence is running in ' +
          'ephemeral mock mode, which cannot enforce row-level ACLs. Use a real SQLite engine or set devOpen: true.'
      );
    }
    if (this.security.migratedThisStart) {
      // eslint-disable-next-line no-console
      console.warn(
        '[nodegx-backend] SECURITY DEFAULTS APPLIED: this backend had no security.json — one was created with ' +
          'the default posture (collections require authentication, creator-owns on, dev-open ON for local ' +
          'development). Existing records have no ACLs and stay reachable per collection permissions. ' +
          'Set "devOpen": false in security.json to test enforcement locally; deploys refuse to start with ' +
          'dev-open enabled.'
      );
    }

    // 2. Execution history beside the data.
    const executionHistory = this.executions.open(this.options.dataDir);
    if (!executionHistory.enabled) {
      // eslint-disable-next-line no-console
      console.warn(
        `[nodegx-backend] execution history DISABLED: ${executionHistory.error} — function runs proceed unlogged.`
      );
    }

    // 2.5 Realtime (BAK-001): the change bus taps the adapter's post-commit
    //     events ONCE; the hub fans matching, permission-checked events out over
    //     SSE. WF-005's trigger dispatch will be the bus's second consumer.
    this.changeBus = new ChangeBus(this.persistence.adapter);
    this.realtime = new RealtimeHub(this.changeBus, this.security);

    // 2.6 Email (BAK-002): config + secrets load beside security.json/secrets.json
    //     (same dataDir, same shared-secrets convention — see security/secrets.ts).
    //     Loading never throws for "unconfigured" — only for a malformed file —
    //     because unconfigured is a normal, loudly-reported STATE (RUN-004),
    //     not a startup error.
    this.emailConfig = new EmailConfigState(this.options.dataDir);
    this.mailer = new Mailer(this.emailConfig);

    // 3. HTTP surface.
    this.http = new HttpServer({
      options: this.options,
      persistence: this.persistence,
      facade: this.facade,
      executions: this.executions,
      security: this.security,
      getRunner: () => this.runner,
      getConfigParams: () => this.readConfigParams(),
      realtime: this.realtime,
      emailConfig: this.emailConfig,
      mailer: this.mailer,
      emailTokens: new EmailTokenStore(this.facade)
    });
    const listen = await this.http.listen();

    // 4. Loopback cloud services for nodes running inside functions. One
    //    service process serves exactly one backend, so a process-wide global
    //    is safe here. Always loop back over 127.0.0.1 even on wider binds.
    //    The masterKey makes functions run AS SYSTEM (model doc §1): the
    //    cloud-runtime clients send it as X-Parse-Master-Key, which resolves
    //    to the admin principal and bypasses CLPs/ACLs.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any)._noodl_cloudservices = {
      endpoint: `http://127.0.0.1:${listen.port}`,
      appId: this.options.backendId,
      masterKey: this.security.adminToken
    };

    // 4.5 The Send Email node (BAK-002, noodl-viewer-cloud) runs INSIDE this
    //     same process (via WorkflowRunner's CloudRunner), so it reaches the
    //     Mailer through a process-global function — the exact idiom
    //     `_noodl_cloudservices` above already establishes for database
    //     access from inside functions. `typeof _noodl_send_email !==
    //     'undefined'` is how the node detects "not running inside
    //     nodegx-backend at all" versus "running here but unconfigured" (the
    //     latter comes back as `{success:false, error}` from the Mailer
    //     itself — still loud, just via the return value instead of absence).
    //     Template resolution happens HERE (not in the node) because only the
    //     service owns EmailConfigState's per-backend template overrides.
    (globalThis as any)._noodl_send_email = (request: SendEmailNodeRequest): Promise<SendEmailResult> =>
      this.resolveAndSendEmail(request);

    // 5. Workflows.
    this.runner = new WorkflowRunner({
      workflowsPath: path.join(this.options.dataDir, 'workflows'),
      executions: this.executions,
      backendId: this.options.backendId,
      backendName: this.options.backendName
    });
    await this.runner.initialize();
    await this.runner.loadWorkflows();

    return {
      options: this.options,
      listen,
      persistence: this.persistence,
      executionHistory,
      workflows: this.runner.getStatus(),
      security: {
        devOpen: this.security.config.devOpen,
        enforced: !this.security.devOpenActive,
        migratedThisStart: this.security.migratedThisStart
      },
      stop: () => this.stop()
    };
  }

  async stop(): Promise<void> {
    if (this.realtime) {
      this.realtime.close();
      this.realtime = null;
    }
    if (this.changeBus) {
      this.changeBus.close();
      this.changeBus = null;
    }
    if (this.http) {
      await this.http.close();
      this.http = null;
    }
    if (this.persistence && this.persistence.adapter) {
      await this.persistence.adapter.disconnect();
    }
    this.persistence = null;
    this.facade = null;
    this.runner = null;
    this.security = null;
  }

  /** True when the current options require a bearer token (non-loopback bind). */
  requiresAuth(): boolean {
    return requiresAuth(this.options);
  }

  /**
   * Test-only escape hatch (same pattern as `getRouteTable()`): lets a test
   * inject a fake SMTP transport via `Mailer.setTransportForTesting` so email
   * flows can be exercised end-to-end over real HTTP without any network I/O.
   * No production code path reads this.
   */
  getMailerForTesting(): Mailer | null {
    return this.mailer;
  }

  /**
   * The Send Email node's actual send path: resolve a template (if given)
   * against this backend's per-backend override + shipped default, then hand
   * off to the Mailer — which is where the loud-failure doctrine (no SMTP
   * configured => `{success:false, error}`, never a throw, never a queue)
   * actually lives, so this method inherits it for free.
   */
  private async resolveAndSendEmail(request: SendEmailNodeRequest): Promise<SendEmailResult> {
    if (!this.mailer || !this.emailConfig) {
      return { success: false, error: 'Email is not available: the backend service has not finished starting.' };
    }
    if (!request.to) {
      return { success: false, error: 'Send Email: "to" is required.' };
    }

    if (request.template) {
      if (!isTemplateId(request.template)) {
        return { success: false, error: `Send Email: unknown template "${request.template}".` };
      }
      const rendered = renderTemplate(this.emailConfig.effectiveTemplate(request.template), {
        appName: this.options.backendName,
        ...(request.variables || {})
      });
      return this.mailer.send({ to: request.to, subject: rendered.subject, text: rendered.text, html: rendered.html });
    }

    return this.mailer.send({
      to: request.to,
      subject: request.subject || '',
      text: request.text || '',
      html: request.html
    });
  }

  /**
   * The running server's route table (method/pattern/access). The route-walk
   * test iterates this to prove enforcement covers every route — a route added
   * without an access declaration cannot appear here (TS) and a route that
   * answers unauthenticated on a locked backend fails the walk.
   */
  getRouteTable(): import('./server/HttpServer').RouteInfo[] {
    return this.http ? this.http.getRouteTable() : [];
  }

  /**
   * Parse's built-in classes, pre-created so the session endpoints can query
   * them before any row exists (a `where` on a column of a not-yet-created
   * table is a SQL error, not an empty result).
   */
  private ensureSystemTables(): void {
    const sm = this.facade && this.facade.schemaManager;
    if (!sm) return;
    sm.createTable({
      name: '_User',
      columns: [
        { name: 'username', type: 'String' },
        { name: 'email', type: 'String' },
        { name: '_hashed_password', type: 'String' }
      ]
    });
    sm.createTable({
      name: '_Session',
      columns: [
        { name: 'sessionToken', type: 'String' },
        { name: 'userId', type: 'String' }
      ]
    });
    // BAK-003: roles (flat; membership via the users Relation's junction
    // table) and API keys (hashed secrets, never recoverable).
    sm.createTable({
      name: '_Role',
      columns: [
        { name: 'name', type: 'String' },
        { name: 'users', type: 'Relation', targetClass: '_User' }
      ]
    });
    sm.createTable({
      name: '_ApiKey',
      columns: [
        { name: 'name', type: 'String' },
        { name: 'keyHash', type: 'String' },
        { name: 'scopes', type: 'Array' },
        { name: 'revoked', type: 'Boolean' },
        { name: 'lastUsedAt', type: 'Date' }
      ]
    });
    // BAK-002: password-reset / verify-email tokens — hashed at rest, single-use.
    sm.createTable({
      name: '_EmailToken',
      columns: [
        { name: 'tokenHash', type: 'String' },
        { name: 'userId', type: 'String' },
        { name: 'kind', type: 'String' },
        { name: 'expiresAt', type: 'Date' },
        { name: 'consumedAt', type: 'Date' }
      ]
    });
  }

  /**
   * `/config` params: `<dataDir>/config-params.json` when present, else {}.
   * Read per request so edits apply without a restart (the client caches for
   * 15 minutes anyway).
   */
  private readConfigParams(): Record<string, unknown> {
    try {
      const p = path.join(this.options.dataDir, 'config-params.json');
      if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf-8'));
    } catch {
      // Unparsable config-params is not worth failing /config over — functions
      // await this endpoint on every run.
    }
    return {};
  }
}
