/**
 * BackupSubsystem — the composition root for BAK-007, owned by BackendService.
 *
 * It mirrors TriggerSubsystem exactly (that is the point): it constructs a
 * `CronScheduler` — WF-005's ONE scheduler class — and drives it with a
 * backup-specific registry + dispatcher. There is NO second scheduler, NO
 * second cron loop, NO setInterval timer: the same tested `computeStartPlan` /
 * missed-fire / timer-chunking logic that fires trigger schedules fires the
 * scheduled backup. The scheduler's only two dependencies are the minimal
 * `SchedulerRegistry` / `SchedulerDispatcher` surfaces (scheduler.ts), which the
 * two thin adapters below satisfy.
 *
 * The backup dispatcher's `fire()` runs a backup instead of a cloud function,
 * but writes the SAME LOUD execution records through the SAME ExecutionHistory
 * (via BackupManager) — one execution-record path, restated for backups.
 *
 * @module nodegx-backend/backup/BackupSubsystem
 */

import type { ExecutionHistory } from '../execution/ExecutionStore';
import { CronScheduler, SchedulerRegistry, SchedulerDispatcher } from '../triggers/scheduler';
import type { FireInput, FireOutcome, RejectionInput, TriggerResultShape } from '../triggers/dispatcher';
import type { TriggerDef } from '../triggers/registry';
import { validateCron } from '../triggers/cron';
import { BackupConfigStore, BackupSchedule } from './config';
import { BackupManager, BackupManagerDeps } from './BackupManager';

/** The synthetic trigger id the backup schedule presents to the scheduler. */
export const BACKUP_TRIGGER_ID = '__backup_schedule__';

/** Adapter: presents the backup schedule as a schedule "trigger" to CronScheduler. */
class BackupScheduleRegistry implements SchedulerRegistry {
  constructor(private readonly config: BackupConfigStore) {}

  private synthetic(): TriggerDef | null {
    const schedule = this.config.getSchedule();
    if (!schedule || !schedule.enabled || !schedule.cron) return null;
    const status = this.config.get().status;
    return {
      id: BACKUP_TRIGGER_ID,
      type: 'schedule',
      name: 'Scheduled backup',
      enabled: true,
      target: { kind: 'function', name: '__backup__' },
      schedule: { cron: schedule.cron, missedFirePolicy: schedule.missedFirePolicy },
      createdAt: status.lastRunAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: {
        lastFiredAt: status.lastRunAt,
        nextFireAt: status.nextRunAt,
        lastResult: status.lastResult ? { ok: status.lastResult.ok, at: status.lastResult.at, error: status.lastResult.error } : null,
        fireCount: 0
      }
    };
  }

  byType(type: string): TriggerDef[] {
    if (type !== 'schedule') return [];
    const t = this.synthetic();
    return t ? [t] : [];
  }

  get(id: string): TriggerDef | null {
    return id === BACKUP_TRIGGER_ID ? this.synthetic() : null;
  }

  setNextFire(id: string, nextFireAt: string | null): void {
    if (id === BACKUP_TRIGGER_ID) this.config.setNextRun(nextFireAt);
  }
}

/** Adapter: the scheduler's fire() runs a backup and records loudly. */
class BackupScheduleDispatcher implements SchedulerDispatcher {
  constructor(
    private readonly manager: BackupManager,
    private readonly executions: ExecutionHistory,
    private readonly backendId: string,
    private readonly backendName: string
  ) {}

  async fire(input: FireInput): Promise<FireOutcome> {
    try {
      const res = await this.manager.createBackup({ triggerType: 'schedule', source: input.source });
      const result: TriggerResultShape = { ok: true, at: new Date().toISOString(), statusCode: 200 };
      return { result, statusCode: 200, body: JSON.stringify({ ok: true, archive: res.archivePath, bytes: res.bytes }) };
    } catch (e) {
      // createBackup already recorded the failure LOUDLY (execution + status);
      // never rethrow into the scheduler timer.
      const message = e instanceof Error ? e.message : String(e);
      const result: TriggerResultShape = { ok: false, at: new Date().toISOString(), error: message };
      return { result, statusCode: 500, body: JSON.stringify({ ok: false, error: message }) };
    }
  }

  recordRejection(input: RejectionInput): TriggerResultShape {
    const at = new Date().toISOString();
    const logger = this.executions.createLogger();
    if (logger) {
      try {
        logger.startExecution({
          workflowId: input.workflowId,
          workflowName: 'Backup (schedule)',
          triggerType: 'schedule',
          triggerData: input.triggerData,
          metadata: {
            backendId: this.backendId,
            backendName: this.backendName,
            operation: 'backup',
            triggerSource: input.source,
            rejected: true
          }
        });
        logger.completeExecution(false, new Error(input.reason));
      } catch {
        /* a logging failure must never propagate */
      }
    }
    return { ok: false, at, error: input.reason };
  }
}

export interface BackupSubsystemDeps extends Omit<BackupManagerDeps, 'config'> {
  /** Reuse an already-constructed config store, or one is created over dataDir. */
  config?: BackupConfigStore;
}

export class BackupSubsystem {
  readonly config: BackupConfigStore;
  readonly manager: BackupManager;
  private readonly registry: BackupScheduleRegistry;
  private readonly scheduler: CronScheduler;

  constructor(deps: BackupSubsystemDeps) {
    this.config = deps.config || new BackupConfigStore(deps.dataDir);
    this.manager = new BackupManager({ ...deps, config: this.config });
    this.registry = new BackupScheduleRegistry(this.config);
    const dispatcher = new BackupScheduleDispatcher(this.manager, deps.executions, deps.backendId, deps.backendName);
    this.scheduler = new CronScheduler({ registry: this.registry, dispatcher });
  }

  /** Arm the scheduled backup (if configured). Call once the service is up. */
  start(): void {
    this.scheduler.start();
  }

  /** Recompute the schedule after a policy change. */
  reschedule(): void {
    this.scheduler.reschedule();
  }

  stop(): void {
    this.scheduler.stop();
  }

  /** Validate + persist a new schedule, then rearm. Throws on invalid cron. */
  setSchedule(schedule: BackupSchedule | null): void {
    if (schedule && schedule.enabled) {
      const err = validateCron(schedule.cron);
      if (err) throw new Error(`Invalid backup schedule cron: ${err}`);
    }
    this.config.update({ schedule });
    this.reschedule();
  }
}
