/**
 * @noodl/nodegx-backend — public API.
 *
 * Standalone NodeGX backend service (WF-004). Runs headless with no Electron,
 * both as a child process the editor spawns and as a deployable Node service.
 *
 * The runnable artifact is `dist/cli.js` — a single esbuild bundle embedding
 * the adapter stack (@noodl/runtime) and the cloud runtime + execution history
 * (noodl-viewer-cloud/src via the `@cloud-runtime` alias). See scripts/build.js.
 *
 * @module nodegx-backend
 */

export { BackendService, StartedService } from './service';
export { createAdapter, PersistenceHandle, LocalBackendPersistenceError } from './persistence/createAdapter';
export { AdapterFacade, AclOption } from './persistence/AdapterFacade';
export { BackendServiceOptions, resolveOptions, requiresAuth, generateAuthToken } from './config';
export { HttpServer, ListenInfo, RequestContext, RouteAccess, RouteInfo } from './server/HttpServer';
export { WorkflowRunner } from './workflow/WorkflowRunner';
export { ExecutionHistory } from './execution/ExecutionStore';
export {
  IdempotencyStore,
  IdempotencyClaim,
  IdempotencyRow,
  DEFAULT_IDEMPOTENCY_TTL_MS
} from './execution/IdempotencyStore';
// BAK-003 — the access-control contract. BAK-001's realtime delivery imports
// canReadRecord/resolvePrincipal from here (model doc §11).
export {
  Principal,
  ClpOp,
  RuleValue,
  SecurityConfig,
  principalKeys,
  ruleAllows,
  checkClp,
  canReadRecord,
  canAccessRecord,
  effectiveRule,
  effectiveCreatorOwns,
  defaultSecurityConfig,
  validateSecurityConfig
} from './security/model';
export { SecurityState, SecurityStartupError } from './security/state';
// WF-005 — triggers (schedule / webhook / db-change).
export { SecretsStore, WEBHOOK_SECRETS_NAMESPACE } from './config/SecretsStore';
export {
  TriggerRegistry,
  TriggerConfigError,
  validateTriggerDef
} from './triggers/registry';
export type {
  TriggerDef,
  TriggerInput,
  TriggerType,
  TriggerStatus,
  TriggerResult,
  MissedFirePolicy,
  WebhookScheme,
  ChangeAction
} from './triggers/registry';
export { TriggerDispatcher } from './triggers/dispatcher';
export type { FireOutcome } from './triggers/dispatcher';
export { CronScheduler, computeStartPlan } from './triggers/scheduler';
export { parseCron, validateCron, CronExpression, CronParseError } from './triggers/cron';
export { DbChangeTriggers } from './triggers/dbchange';
export { TriggerSubsystem } from './triggers/TriggerSubsystem';
export { verifyWebhook, signWebhookHmac } from './triggers/webhook';
export { main as cli } from './cli';
