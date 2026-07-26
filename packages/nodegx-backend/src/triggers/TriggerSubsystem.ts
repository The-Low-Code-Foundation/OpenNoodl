/**
 * TriggerSubsystem — the composition root for WF-005 triggers, owned by the
 * BackendService.
 *
 * It wires the four pieces the service needs to construct together and exposes
 * the two surfaces the rest of the service talks to:
 *   - `registry` + `dispatcher` — CRUD and the firing contract (admin routes,
 *     MCP, the webhook route call these);
 *   - `start()` / `stop()` — arm the cron scheduler and attach the db-change
 *     consumer to the SAME ChangeBus the realtime hub uses.
 *
 * The DB-change source is BAK-001's ChangeBus, passed in from service.ts — this
 * subsystem never touches the adapter and never constructs a second bus.
 *
 * @module nodegx-backend/triggers/TriggerSubsystem
 */

import type { ChangeBus } from '../realtime/ChangeBus';
import type { ExecutionHistory } from '../execution/ExecutionStore';
import type { WorkflowRunner } from '../workflow/WorkflowRunner';
import type { WorkflowSubsystem } from '../workflow/WorkflowSubsystem';
import { SecretsStore } from '../config/SecretsStore';
import { TriggerRegistry } from './registry';
import { TriggerDispatcher } from './dispatcher';
import { CronScheduler } from './scheduler';
import { DbChangeTriggers } from './dbchange';

export interface TriggerSubsystemDeps {
  dataDir: string;
  executions: ExecutionHistory;
  getRunner: () => WorkflowRunner | null;
  /** WF-001: resolves the workflow subsystem for `target.kind === 'workflow'`. */
  getWorkflows?: () => WorkflowSubsystem | null;
  backendId: string;
  backendName: string;
  /** The service's single ChangeBus (BAK-001). */
  bus: ChangeBus;
  /** Reuse the service's SecretsStore if it has one; else construct over dataDir. */
  secrets?: SecretsStore;
}

export class TriggerSubsystem {
  readonly registry: TriggerRegistry;
  readonly dispatcher: TriggerDispatcher;
  private readonly scheduler: CronScheduler;
  private readonly dbChange: DbChangeTriggers;

  constructor(deps: TriggerSubsystemDeps) {
    const secrets = deps.secrets || new SecretsStore(deps.dataDir);
    this.registry = new TriggerRegistry(deps.dataDir, secrets);
    this.dispatcher = new TriggerDispatcher({
      registry: this.registry,
      executions: deps.executions,
      getRunner: deps.getRunner,
      getWorkflows: deps.getWorkflows,
      backendId: deps.backendId,
      backendName: deps.backendName
    });
    this.scheduler = new CronScheduler({ registry: this.registry, dispatcher: this.dispatcher });
    this.dbChange = new DbChangeTriggers({ bus: deps.bus, registry: this.registry, dispatcher: this.dispatcher });
  }

  /** Arm schedules + attach the db-change consumer. Call once the runner is up. */
  start(): void {
    this.scheduler.start();
    this.dbChange.start();
  }

  /** Recompute schedules after triggers change (admin/MCP edits). */
  reschedule(): void {
    this.scheduler.reschedule();
  }

  stop(): void {
    this.scheduler.stop();
    this.dbChange.stop();
  }
}
