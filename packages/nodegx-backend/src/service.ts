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
import { WorkflowSubsystem } from './workflow/WorkflowSubsystem';
import { SecurityState, SecurityStartupError } from './security/state';
import { functionTimeoutMs } from './security/model';
import { SearchState, SearchStartupError } from './search/SearchState';
import { SearchIndexer, SearchCapabilityError } from './search/SearchIndexer';
import { ChangeBus } from './realtime/ChangeBus';
import { RealtimeHub } from './realtime/RealtimeHub';
import {
  SecretsStore,
  FUNCTION_SECRETS_NAMESPACE,
  FUNCTION_SECRET_NAME_PATTERN,
  functionSecretEnvName
} from './config/SecretsStore';
import { OpsState } from './ops/OpsState';
import { logger } from './ops/logger';
import { SecretValueScrubber } from './ops/log-scrub';
import { AuditLog, ensureAuditTable } from './ops/audit';
import { SystemUsers, SystemUserRequest, SystemUserResult } from './users/SystemUsers';
import { TriggerSubsystem } from './triggers/TriggerSubsystem';
import { BackupSubsystem } from './backup/BackupSubsystem';
import { FileSubsystem } from './storage/FileSubsystem';
import { ensureFilesTable } from './storage/MetadataStore';
import { EmailConfigState } from './email/EmailConfigState';
import { Mailer, SendEmailResult } from './email/Mailer';
import { EmailTokenStore } from './email/tokens';
import { isTemplateId, renderTemplate } from './email/templates';
import { AuthConfigState } from './auth/AuthConfigState';
import { ensureIdentityTable } from './auth/identities';
import { clearDiscoveryCache } from './auth/oidc';

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

/**
 * What `_noodl_get_secret` answers the Secret node with (CWF-009).
 *
 * An object rather than a bare string for one reason: `undefined` and "the
 * empty string is genuinely the value" have to be distinguishable, and a
 * missing credential must be loud. `error` is a message about a NAME — it never
 * carries, quotes or hints at a value.
 */
export interface SecretLookupResult {
  found: boolean;
  value?: string;
  error?: string;
}

export interface StartedService {
  options: BackendServiceOptions;
  listen: ListenInfo;
  persistence: PersistenceHandle;
  executionHistory: ExecutionHistoryStatus;
  workflows: { initialized: boolean; workflowCount: number };
  security: {
    devOpen: boolean;
    enforced: boolean;
    migratedThisStart: boolean;
    /** BAK-005: the admin credential was auto-minted on this start (first-run surface). */
    adminTokenMintedThisStart: boolean;
    /** BAK-005: a read-only admin credential is provisioned. */
    hasReadonlyTier: boolean;
  };
  /** BAK-008: full-text search status at this start. */
  search: {
    fts5Available: boolean;
    /** Collections whose FTS5 shadow table was (re)built during this start. */
    reconciledCollections: string[];
  };
  stop(): Promise<void>;
}

export class BackendService {
  readonly options: BackendServiceOptions;
  private persistence: PersistenceHandle | null = null;
  private facade: AdapterFacade | null = null;
  private http: HttpServer | null = null;
  private runner: WorkflowRunner | null = null;
  private workflows: WorkflowSubsystem | null = null;
  private security: SecurityState | null = null;
  private search: SearchState | null = null;
  private changeBus: ChangeBus | null = null;
  private realtime: RealtimeHub | null = null;
  private triggers: TriggerSubsystem | null = null;
  private backups: BackupSubsystem | null = null;
  private files: FileSubsystem | null = null;
  private emailConfig: EmailConfigState | null = null;
  private auth: AuthConfigState | null = null;
  private ops: OpsState | null = null;
  private audit: AuditLog | null = null;
  private mailer: Mailer | null = null;
  /** CWF-015: the system-scoped user operations a cloud function can perform. */
  private systemUsers: SystemUsers | null = null;
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

    // 0.5 Operational config (BAK-009) BEFORE anything that logs: ops.json owns
    //     the log level and format, so loading it first is what makes startup
    //     itself obey the operator's settings instead of the defaults.
    this.ops = new OpsState(this.options.dataDir);
    logger.configure({ level: this.ops.config.logging.level, format: this.ops.config.logging.format });
    logger.info('service.starting', {
      backendId: this.options.backendId,
      dataDir: this.options.dataDir,
      host: this.options.host,
      port: this.options.port
    });

    // 0.6 The operational warnings an internet-facing backend deserves at the
    //     moment it starts, not the moment it is exploited. Both name the exact
    //     setting to change: a warning an operator cannot act on is noise.
    if (requiresAuth(this.options)) {
      if (this.ops.config.cors.origins.includes('*')) {
        logger.warn('cors.wildcard-on-public-bind', {
          host: this.options.host,
          detail:
            'This backend is bound beyond localhost and answers every origin (cors.origins: ["*"]). Any website ' +
            'a user visits can call this API from their browser. Set cors.origins in ops.json to your app origin(s).'
        });
      }
      if (this.ops.config.rateLimit.trustedProxies.includes('*')) {
        logger.warn('proxy.trust-everything', {
          detail:
            'rateLimit.trustedProxies is ["*"], so any client can set X-Forwarded-For and choose its own ' +
            'rate-limit bucket and audit origin. Use ["loopback"] or ["private"] unless something upstream ' +
            'strips and re-sets that header.'
        });
      }
      if (!this.ops.config.rateLimit.enabled) {
        logger.warn('ratelimit.disabled-on-public-bind', {
          detail: 'rateLimit.enabled is false on a non-loopback bind: nothing bounds request rate on this backend.'
        });
      }
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
      readonlyToken: this.options.readonlyToken,
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

    // 1.6 Search (BAK-008): load search.json, then reconcile every enabled
    //     collection's FTS5 shadow table against it — a fresh start, a config
    //     change that landed but whose rebuild was interrupted, or drift from
    //     a prior crash all converge to the same correct state (rebuild is
    //     idempotent). An engine that cannot support FTS5 fails this LOUDLY
    //     (SearchCapabilityError) if — and only if — some collection actually
    //     has search enabled; a backend that never opted in to search is not
    //     penalized for an absent capability it never asked for (RUN-004
    //     loud-failure doctrine: fail loud when it matters, not everywhere).
    this.search = new SearchState(this.options.dataDir);
    const searchIndexer = new SearchIndexer(this.facade.schemaManager);
    let searchReconciledCollections: string[] = [];
    if (this.search.enabledCollections().length > 0) {
      try {
        searchReconciledCollections = searchIndexer.reconcileAll(this.search).map((r) => r.tableName);
      } catch (e) {
        if (e instanceof SearchCapabilityError) {
          throw new SearchStartupError('SEARCH_ENGINE_UNAVAILABLE', e.message);
        }
        throw e;
      }
    }

    // 1.7 The audit trail (BAK-009). Constructed here so every subsystem that
    //     follows can be audited through the ONE writer, and pruned once at
    //     start so a long-stopped backend does not come back with years of
    //     entries the retention setting says should be gone.
    this.audit = new AuditLog({ facade: this.facade, getConfig: () => this.ops!.config.audit });
    void this.audit.prune();

    // 1.75 CWF-015: system-scoped user administration for cloud functions.
    //      Constructed beside the audit log because every write it makes goes
    //      through it — an account created by a graph must be as
    //      reconstructable afterwards as one created through the admin surface.
    //      The action names are declared in ops/audit-actions like every other,
    //      so the dashboard's filter list has them without a second vocabulary.
    this.systemUsers = new SystemUsers({
      facade: this.facade,
      onAudit: ({ action, outcome, target }) => {
        void this.audit?.record({
          action,
          actorKind: 'system',
          actor: 'cloud-function',
          outcome,
          target,
          ip: 'in-process'
        });
      }
    });

    // 2. Execution history beside the data.
    const executionHistory = this.executions.open(this.options.dataDir);
    if (!executionHistory.enabled) {
      // eslint-disable-next-line no-console
      console.warn(
        `[nodegx-backend] execution history DISABLED: ${executionHistory.error} — function runs proceed unlogged.`
      );
    }

    // 2.2 Workflows (WF-001): the definition registry loads workflow-defs/ (loud
    //     on an invalid definition, same doctrine as triggers.json). The engine
    //     emits into the SAME execution history as functions (one record path)
    //     and schedules real cloud functions as steps via the shared runner (one
    //     node abstraction). getRunner is late-bound — the runner comes up at
    //     step 5, and the engine only calls it at run time.
    this.workflows = new WorkflowSubsystem({
      dataDir: this.options.dataDir,
      executions: this.executions,
      getRunner: () => this.runner,
      backendId: this.options.backendId,
      backendName: this.options.backendName
    });

    // 2.5 Realtime (BAK-001): the change bus taps the adapter's post-commit
    //     events ONCE; the hub fans matching, permission-checked events out over
    //     SSE. WF-005's trigger dispatch will be the bus's second consumer.
    this.changeBus = new ChangeBus(this.persistence.adapter);
    this.realtime = new RealtimeHub(this.changeBus, this.security, {
      // BAK-009: read live, so raising the cap in ops.json does not need a restart.
      maxConnections: () => (this.ops ? this.ops.config.rateLimit.realtimeMaxConnections : 0)
    });

    // 2.6 Triggers (WF-005): the registry loads triggers.json (loud on invalid).
    //     The db-change source is the SAME ChangeBus the realtime hub uses — the
    //     dispatcher becomes the bus's SECOND consumer via bus.subscribe(); no
    //     second tap. Webhook secrets share the one secrets.json convention.
    this.triggers = new TriggerSubsystem({
      dataDir: this.options.dataDir,
      executions: this.executions,
      getRunner: () => this.runner,
      getWorkflows: () => this.workflows,
      backendId: this.options.backendId,
      backendName: this.options.backendName,
      bus: this.changeBus,
      secrets: new SecretsStore(this.options.dataDir)
    });

    // 2.65 Backups (BAK-007): the backup subsystem constructs its OWN CronScheduler
    //      the SAME way TriggerSubsystem does — ONE scheduler class, two consumers.
    //      Its dispatcher runs a backup instead of a function but writes the SAME
    //      loud execution records through this.executions. dbPath is the live
    //      persistence file; schema is exported live for the archive's record.
    this.backups = new BackupSubsystem({
      dataDir: this.options.dataDir,
      dbPath: this.persistence.dbPath,
      executions: this.executions,
      backendId: this.options.backendId,
      backendName: this.options.backendName,
      getSchema: () => (this.facade && this.facade.schemaManager ? this.facade.schemaManager.exportSchemas() : [])
    });

    // 2.66 Files (BAK-006): metadata + storage driver + orphan-sweep scheduler,
    //      the SAME CronScheduler class again (three consumers now: triggers,
    //      backups, files). Shares the `files` namespace of secrets.json for
    //      S3 credentials and the signed-URL HMAC secret.
    this.files = new FileSubsystem({
      dataDir: this.options.dataDir,
      facade: this.facade,
      secrets: new SecretsStore(this.options.dataDir),
      executions: this.executions,
      backendId: this.options.backendId,
      backendName: this.options.backendName
    });

    // 2.7 Email (BAK-002): config + secrets load beside security.json/secrets.json
    //     (same dataDir, same shared-secrets convention — see config/SecretsStore).
    //     Loading never throws for "unconfigured" — only for a malformed file —
    //     because unconfigured is a normal, loudly-reported STATE (RUN-004),
    //     not a startup error.
    this.emailConfig = new EmailConfigState(this.options.dataDir);
    this.mailer = new Mailer(this.emailConfig);

    // 2.8 Sign-in providers (BAK-004): auth.json beside email.json, client
    //     secrets in the `auth` namespace of the same secrets.json. Like email,
    //     "no providers configured" is a normal state and never a startup
    //     error — only a malformed file is. The discovery/JWKS caches are
    //     cleared on start so a restart is a reliable way to pick up a
    //     provider's key rotation without waiting out the TTL.
    this.auth = new AuthConfigState(this.options.dataDir);
    clearDiscoveryCache();
    for (const provider of this.auth.config.providers) {
      if (!provider.enabled) continue;
      const reason = this.auth.notConfiguredReason(provider);
      if (reason) {
        // A provider advertised as enabled that cannot actually sign anyone in
        // is exactly the kind of thing that is discovered by a user, in a
        // browser, at the worst moment. Say it at startup instead.
        logger.warn('auth.provider-incomplete', { provider: provider.id, detail: reason });
      }
      if (provider.kind === 'oidc' && provider.issuer.startsWith('http://') && requiresAuth(this.options)) {
        logger.warn('auth.issuer-not-https', {
          provider: provider.id,
          issuer: provider.issuer,
          detail:
            'This backend is bound beyond localhost and talks to an OIDC issuer over plain HTTP. The client ' +
            'secret and the ID token cross that connection in the clear.'
        });
      }
    }

    // 3. HTTP surface.
    this.http = new HttpServer({
      options: this.options,
      persistence: this.persistence,
      facade: this.facade,
      executions: this.executions,
      security: this.security,
      search: this.search,
      getRunner: () => this.runner,
      getConfigParams: () => this.readConfigParams(),
      realtime: this.realtime,
      triggers: this.triggers,
      workflows: this.workflows,
      backups: this.backups,
      files: this.files,
      emailConfig: this.emailConfig,
      mailer: this.mailer,
      emailTokens: new EmailTokenStore(this.facade),
      auth: this.auth,
      ops: this.ops,
      audit: this.audit
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

    // 4.6 The Secret node (CWF-009, noodl-viewer-cloud) reaches SecretsStore the
    //     same way — a process-global function, because the cloud runtime runs
    //     in THIS process. The seam is deliberately a *resolver*, not the store:
    //     the namespace is supplied here and never by the graph, so a function
    //     can read the project author's `functions` secrets and cannot name
    //     `webhooks`, `email`, `auth`, `files` or `adminToken` at all. See the
    //     policy paragraph in config/SecretsStore.ts.
    (globalThis as any)._noodl_get_secret = (name: unknown): SecretLookupResult => this.resolveFunctionSecret(name);

    // 4.7 The user-administration nodes (CWF-015) reach the database the same
    //     way, and for the same reason the Secret node's seam is a resolver
    //     rather than the store: what a graph may do is decided HERE, not by
    //     the graph. The node names an operation and an id; this end owns the
    //     protected-key policy, the duplicate check, the hashing and the
    //     session revocation.
    //
    //     ⚠️ It deliberately adds NO HTTP route. `POST /users` mints a session
    //     and `PUT /users/:id` refuses any id but the caller's own, so neither
    //     could serve this; adding an admin route that could would be a second
    //     door onto account creation, gated separately from the first. In
    //     process, the ONLY gate is CWF-017's per-function `call` rule.
    (globalThis as any)._noodl_system_users = (request: SystemUserRequest): Promise<SystemUserResult> =>
      this.systemUsers
        ? this.systemUsers.handle(request)
        : Promise.resolve<SystemUserResult>({
            outcome: 'failure',
            code: 'user/service-stopped',
            error: 'User administration is not available: the backend service is not running.'
          });

    // 5. Workflows.
    this.runner = new WorkflowRunner({
      workflowsPath: path.join(this.options.dataDir, 'workflows'),
      executions: this.executions,
      backendId: this.options.backendId,
      backendName: this.options.backendName,
      // CWF-018: read live, so a timeout edited through CWF-017's panel applies
      // to the next call — same stance as the realtime cap above.
      getFunctionTimeoutMs: (name) => (this.security ? functionTimeoutMs(this.security.config, name) : undefined),
      // CWF-013: the value-based half of a `Log` node's redaction. The service is the only
      // thing that holds a SecretsStore, and it deliberately stays that way — the scrubber
      // exposes `scrub(text)` and nothing that hands a value back, so this is not a way around
      // SecretsStore's missing bulk read (CWF-009 design question 4).
      scrubSecretValues: new SecretValueScrubber(new SecretsStore(this.options.dataDir))
    });
    await this.runner.initialize();
    await this.runner.loadWorkflows();

    // 5.5 WF-001 durability recovery: any execution left `running` from a prior
    //     process (a restart mid-run) is marked failed+interrupted now — nothing
    //     silently half-runs. In-memory runs do not resume (v1 policy).
    const interruptedRecovered = this.workflows.start();
    if (interruptedRecovered > 0) {
      // eslint-disable-next-line no-console
      console.warn(
        `[nodegx-backend] WF-001: marked ${interruptedRecovered} in-flight execution(s) as interrupted ` +
          '(a prior run did not survive a restart; in-memory runs do not resume in v1).'
      );
    }

    // 6. Triggers go live only now the runner can answer: arm the cron scheduler
    //    and attach the db-change consumer to the ChangeBus.
    this.triggers.start();

    // 6.5 Scheduled backups arm here too (their CronScheduler, mirroring above).
    this.backups.start();

    // 6.6 The orphan-sweep schedule (BAK-006), same mechanism, disabled by default.
    this.files.start();

    return {
      options: this.options,
      listen,
      persistence: this.persistence,
      executionHistory,
      workflows: this.runner.getStatus(),
      security: {
        devOpen: this.security.config.devOpen,
        enforced: !this.security.devOpenActive,
        migratedThisStart: this.security.migratedThisStart,
        adminTokenMintedThisStart: this.security.adminTokenMintedThisStart,
        hasReadonlyTier: this.security.adminReadonlyToken !== null
      },
      search: {
        fts5Available: searchIndexer.hasFts5(),
        reconciledCollections: searchReconciledCollections
      },
      stop: () => this.stop()
    };
  }

  /**
   * Stop, in the order that makes a SIGTERM survivable (BAK-009):
   *
   *   1. Schedulers first — no NEW work while we are trying to finish the old.
   *   2. The HTTP surface, which is where the graceful part lives: stop
   *      accepting, say goodbye to SSE clients, drain what is in flight
   *      (bounded), then close.
   *   3. Only then the realtime hub, the change bus, and the database — every
   *      one of which a still-draining request might be using. This order was
   *      wrong before: the hub was closed first, so SSE clients had their
   *      streams cut without the goodbye the hub knows how to send.
   */
  async stop(): Promise<void> {
    if (this.triggers) {
      this.triggers.stop();
      this.triggers = null;
    }
    if (this.backups) {
      this.backups.stop();
      this.backups = null;
    }
    if (this.files) {
      this.files.stop();
      this.files = null;
    }
    if (this.http) {
      await this.http.close();
      this.http = null;
    }
    if (this.realtime) {
      this.realtime.close();
      this.realtime = null;
    }
    if (this.changeBus) {
      this.changeBus.close();
      this.changeBus = null;
    }
    if (this.persistence && this.persistence.adapter) {
      await this.persistence.adapter.disconnect();
    }
    this.persistence = null;
    this.facade = null;
    this.runner = null;
    this.workflows = null;
    this.security = null;
    this.search = null;
    this.auth = null;
    this.ops = null;
    this.audit = null;
    // CWF-015: the process-global stays installed (as `_noodl_get_secret` and
    // `_noodl_send_email` do — a `start()` overwrites it), but it now answers a
    // loud `user/service-stopped` rather than reaching a disconnected adapter.
    this.systemUsers = null;
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
   * The Secret node's actual read path (CWF-009).
   *
   * Two doors, in this order, and no third:
   *
   *   1. `<dataDir>/secrets.json`, `functions` namespace — the store convention
   *      (config/SecretsStore.ts). Machine-local, mode 0600, never deployed.
   *   2. `NODEGX_SECRET_<NAME>` in the environment — for deploy targets that
   *      provision env vars rather than a data directory. Adds a door and not
   *      an exposure: `process.env` is already fully readable from inside any
   *      cloud function.
   *
   * ⚠️ Every `error` string here names the SECRET and the two places to put it.
   * None of them can contain a value: the only branch that has one is the
   * success branch, and the not-provisioned message is built from the name
   * alone. That wording — "not provisioned **on this machine**" — is the
   * expected production failure spelled out, because secrets.json does not
   * travel with a deploy.
   */
  private resolveFunctionSecret(name: unknown): SecretLookupResult {
    if (typeof name !== 'string' || name.length === 0) {
      return { found: false, error: 'Secret: a Name is required — this node was asked for a secret with no name.' };
    }
    if (!FUNCTION_SECRET_NAME_PATTERN.test(name)) {
      return {
        found: false,
        error:
          `Secret: "${name.slice(0, 64)}" is not a usable secret name. ` +
          'Use 1-128 characters from letters, digits, "_", "." and "-".'
      };
    }

    const stored = new SecretsStore(this.options.dataDir).get(FUNCTION_SECRETS_NAMESPACE, name);
    if (typeof stored === 'string') return { found: true, value: stored };

    const envName = functionSecretEnvName(name);
    const fromEnv = process.env[envName];
    if (typeof fromEnv === 'string') return { found: true, value: fromEnv };

    return {
      found: false,
      error:
        `Secret: "${name}" is not provisioned on this machine. ` +
        `Add it under the "${FUNCTION_SECRETS_NAMESPACE}" section of ` +
        `${path.join(this.options.dataDir, 'secrets.json')}, or set the ${envName} environment variable. ` +
        'secrets.json is machine-local and does not travel with a deploy, so a function that works ' +
        'locally and fails here is usually a secret nobody provisioned on this target.'
    };
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
    // BAK-004 adds two columns for magic links: `email`, because a signup link
    // is issued before any user exists (so `userId` is empty and the address is
    // the identity), and `redirectUrl`, authorised at request time so a click
    // cannot smuggle in a destination nobody vetted.
    sm.createTable({
      name: '_EmailToken',
      columns: [
        { name: 'tokenHash', type: 'String' },
        { name: 'userId', type: 'String' },
        { name: 'kind', type: 'String' },
        { name: 'expiresAt', type: 'Date' },
        { name: 'consumedAt', type: 'Date' },
        { name: 'email', type: 'String' },
        { name: 'redirectUrl', type: 'String' }
      ]
    });
    // BAK-004: (provider, subject) -> userId. A system collection like the
    // rest, so `isSystemCollection` keeps it off /api and /classes.
    ensureIdentityTable(sm);
    // BAK-006: file metadata, ACL'd exactly like any other collection (the
    // `ACL` column SchemaManager stamps onto every table here).
    ensureFilesTable(sm);
    // BAK-009: the audit trail. A system collection like the rest, so
    // `isSystemCollection` keeps it off /api and /classes — the only front
    // door is the admin surface.
    ensureAuditTable(sm);
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
