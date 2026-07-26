/**
 * FileSubsystem — the composition root for BAK-006, owned by BackendService.
 *
 * Mirrors `BackupSubsystem` deliberately (its own module doc: "the SAME way
 * TriggerSubsystem does — ONE scheduler class, two consumers" — this makes it
 * three): constructs a `CronScheduler` and drives it with a sweep-specific
 * registry + dispatcher, so the orphan sweep's "when does it run" logic is the
 * SAME tested `computeStartPlan`/missed-fire/timer-chunking code as trigger
 * schedules and scheduled backups. No second cron loop.
 *
 * Also where the driver gets chosen — exactly once, from `FileConfigStore` +
 * `SecretsStore` (S3 credentials never live in the diffable files.json) — so
 * `FileRoutes` only ever sees a `StorageDriver`, never a driver-type branch.
 *
 * @module nodegx-backend/storage/FileSubsystem
 */

import * as crypto from 'crypto';
import * as path from 'path';

import type { ExecutionHistory } from '../execution/ExecutionStore';
import type { SecretsStore } from '../config/SecretsStore';
import { CronScheduler, SchedulerRegistry, SchedulerDispatcher } from '../triggers/scheduler';
import type { FireInput, FireOutcome, RejectionInput, TriggerResultShape } from '../triggers/dispatcher';
import type { TriggerDef } from '../triggers/registry';
import { validateCron } from '../triggers/cron';
import { FileConfigStore, DriverConfig, OrphanSweepSchedule, ThumbPreset } from './config';
import { LocalDriver } from './LocalDriver';
import { S3Driver } from './S3Driver';
import type { StorageDriver } from './types';
import { MetadataStore } from './MetadataStore';
import { runOrphanSweep } from './orphanSweep';
import { loadTransformer } from './transform';

export const FILE_SWEEP_TRIGGER_ID = '__file_orphan_sweep__';
export const FILES_SECRETS_NAMESPACE = 'files';

/** Adapter: presents the orphan-sweep schedule as a schedule "trigger" to CronScheduler. */
class SweepScheduleRegistry implements SchedulerRegistry {
  constructor(private readonly config: FileConfigStore) {}

  private synthetic(): TriggerDef | null {
    const sweep = this.config.get().orphanSweep;
    if (!sweep || !sweep.enabled || !sweep.cron) return null;
    const status = this.config.get().sweepStatus;
    return {
      id: FILE_SWEEP_TRIGGER_ID,
      type: 'schedule',
      name: 'File orphan sweep',
      enabled: true,
      target: { kind: 'function', name: '__file_orphan_sweep__' },
      schedule: { cron: sweep.cron, missedFirePolicy: 'skip' },
      createdAt: status.lastReport?.at || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: {
        lastFiredAt: status.lastReport?.at || null,
        nextFireAt: status.nextRunAt,
        lastResult: status.lastReport ? { ok: !status.lastReport.error, at: status.lastReport.at, error: status.lastReport.error } : null,
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
    return id === FILE_SWEEP_TRIGGER_ID ? this.synthetic() : null;
  }

  setNextFire(id: string, nextFireAt: string | null): void {
    if (id === FILE_SWEEP_TRIGGER_ID) this.config.setNextSweepRun(nextFireAt);
  }
}

/** Adapter: the scheduler's fire() runs a (report-only) sweep and records loudly. */
class SweepScheduleDispatcher implements SchedulerDispatcher {
  constructor(
    private readonly driver: () => StorageDriver,
    private readonly metadata: MetadataStore,
    private readonly config: FileConfigStore,
    private readonly executions: ExecutionHistory,
    private readonly backendId: string,
    private readonly backendName: string
  ) {}

  async fire(input: FireInput): Promise<FireOutcome> {
    const logger = this.executions.createLogger();
    if (logger) {
      try {
        logger.startExecution({
          workflowId: '__file_orphan_sweep__',
          workflowName: 'File orphan sweep',
          triggerType: 'schedule',
          triggerData: { source: input.source },
          metadata: { backendId: this.backendId, backendName: this.backendName, operation: 'file-orphan-sweep' }
        });
      } catch {
        /* logging must never block the sweep */
      }
    }
    const report = await runOrphanSweep(this.driver(), this.metadata, { delete: false });
    this.config.recordSweep(report);
    if (logger) {
      try {
        logger.completeExecution(!report.error, report.error ? new Error(report.error) : undefined);
      } catch {
        /* ignore */
      }
    }
    const result: TriggerResultShape = report.error
      ? { ok: false, at: report.at, error: report.error }
      : { ok: true, at: report.at };
    return {
      result,
      statusCode: report.error ? 500 : 200,
      body: JSON.stringify({ ok: !report.error, orphanBlobs: report.orphanBlobs.length, orphanRows: report.orphanRows.length })
    };
  }

  recordRejection(input: RejectionInput): TriggerResultShape {
    const at = new Date().toISOString();
    const logger = this.executions.createLogger();
    if (logger) {
      try {
        logger.startExecution({
          workflowId: input.workflowId,
          workflowName: 'File orphan sweep (schedule)',
          triggerType: 'schedule',
          triggerData: input.triggerData,
          metadata: { backendId: this.backendId, backendName: this.backendName, operation: 'file-orphan-sweep', triggerSource: input.source, rejected: true }
        });
        logger.completeExecution(false, new Error(input.reason));
      } catch {
        /* a logging failure must never propagate */
      }
    }
    return { ok: false, at, error: input.reason };
  }
}

export interface FileSubsystemDeps {
  dataDir: string;
  facade: import('../persistence/AdapterFacade').AdapterFacade;
  secrets: SecretsStore;
  executions: ExecutionHistory;
  backendId: string;
  backendName: string;
}

export class FileSubsystem {
  readonly config: FileConfigStore;
  readonly metadata: MetadataStore;
  private readonly deps: FileSubsystemDeps;
  private driver: StorageDriver;
  private readonly registry: SweepScheduleRegistry;
  private readonly scheduler: CronScheduler;

  constructor(deps: FileSubsystemDeps) {
    this.deps = deps;
    this.config = new FileConfigStore(deps.dataDir);
    this.metadata = new MetadataStore(deps.facade);
    this.driver = this.buildDriver(this.config.get().driver);
    this.registry = new SweepScheduleRegistry(this.config);
    const dispatcher = new SweepScheduleDispatcher(
      () => this.driver,
      this.metadata,
      this.config,
      deps.executions,
      deps.backendId,
      deps.backendName
    );
    this.scheduler = new CronScheduler({ registry: this.registry, dispatcher });
  }

  private buildDriver(driverConfig: DriverConfig): StorageDriver {
    if (driverConfig.type === 'local') {
      return new LocalDriver(path.join(this.deps.dataDir, 'files', 'blobs'));
    }
    const accessKeyId = this.deps.secrets.get(FILES_SECRETS_NAMESPACE, 's3AccessKeyId') || '';
    const secretAccessKey = this.deps.secrets.get(FILES_SECRETS_NAMESPACE, 's3SecretAccessKey') || '';
    return new S3Driver({
      endpoint: driverConfig.endpoint,
      region: driverConfig.region,
      bucket: driverConfig.bucket,
      forcePathStyle: driverConfig.forcePathStyle,
      accessKeyId,
      secretAccessKey
    });
  }

  getDriver(): StorageDriver {
    return this.driver;
  }

  /** The HMAC secret for signed file URLs (./signing.ts), auto-minted on first use. */
  getSigningSecret(): string {
    const existing = this.deps.secrets.get(FILES_SECRETS_NAMESPACE, 'signingSecret');
    if (existing) return existing;
    const minted = crypto.randomBytes(32).toString('base64url');
    this.deps.secrets.set(FILES_SECRETS_NAMESPACE, 'signingSecret', minted);
    return minted;
  }

  /** Whether image transforms are available right now (sharp loaded), and why not if not. */
  transformStatus(): { available: boolean; reason?: string } {
    const loaded = loadTransformer();
    return loaded.available ? { available: true } : { available: false, reason: loaded.reason };
  }

  setS3Credentials(accessKeyId: string, secretAccessKey: string): void {
    this.deps.secrets.set(FILES_SECRETS_NAMESPACE, 's3AccessKeyId', accessKeyId);
    this.deps.secrets.set(FILES_SECRETS_NAMESPACE, 's3SecretAccessKey', secretAccessKey);
    this.driver = this.buildDriver(this.config.get().driver);
  }

  updateConfig(patch: Parameters<FileConfigStore['update']>[0]): ReturnType<FileConfigStore['update']> {
    const updated = this.config.update(patch);
    // A driver change (or its secrets changing via setS3Credentials) must take
    // effect immediately, not just on next restart.
    this.driver = this.buildDriver(updated.driver);
    this.reschedule();
    return updated;
  }

  setOrphanSweepSchedule(schedule: OrphanSweepSchedule): void {
    if (schedule.enabled) {
      const err = validateCron(schedule.cron);
      if (err) throw new Error(`Invalid orphan-sweep schedule cron: ${err}`);
    }
    this.config.update({ orphanSweep: schedule });
    this.reschedule();
  }

  setPresets(presets: Record<string, ThumbPreset>): void {
    this.config.update({ thumbnails: { presets } });
  }

  /** Run the sweep right now, outside the schedule (admin/MCP "run now"). */
  async runSweepNow(deleteOrphans = false): Promise<ReturnType<typeof runOrphanSweep> extends Promise<infer R> ? R : never> {
    const report = await runOrphanSweep(this.driver, this.metadata, { delete: deleteOrphans });
    this.config.recordSweep(report);
    return report;
  }

  start(): void {
    this.scheduler.start();
  }

  reschedule(): void {
    this.scheduler.reschedule();
  }

  stop(): void {
    this.scheduler.stop();
  }
}
