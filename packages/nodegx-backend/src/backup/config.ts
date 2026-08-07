/**
 * BackupConfigStore — the persisted backup policy + status (BAK-007).
 *
 * `<dataDir>/backups.json` is policy: the schedule, retention, and destination,
 * plus runtime status (last success/failure, next run) persisted back so the
 * panel/dashboard show it across restarts and a deliberate failure is a LOUD,
 * visible state rather than a quietly stale timestamp (RUN-004). It mirrors
 * TriggerRegistry's file discipline: strict-ish load, atomic temp+rename write.
 *
 * Secrets do NOT live here (destination credentials, if S3 ever lands, go in
 * secrets.json under a `backups` namespace via the one SecretsStore). backups.json
 * is diffable/deployable config.
 *
 * @module nodegx-backend/backup/config
 */

import * as fs from 'fs';
import * as path from 'path';

import type { MissedFirePolicy } from '../triggers/registry';

const BACKUPS_FILE = 'backups.json';

export interface BackupSchedule {
  enabled: boolean;
  /** 5-field cron or @preset — same parser as WF-005 (validated on set). */
  cron: string;
  missedFirePolicy: MissedFirePolicy;
}

export interface RetentionPolicy {
  /** Keep at least the newest N backups regardless of age. 0 = keep all. */
  keepLast: number;
  /** Additionally keep the newest backup of each of the last N days. */
  keepDaily: number;
  /** Additionally keep the newest backup of each of the last N ISO weeks. */
  keepWeekly: number;
}

export interface BackupDestination {
  /** Only 'local' in v1. S3 is a recorded follow-on (needs BAK-006's driver). */
  type: 'local';
  /** Directory backups are written to. Defaults to `<dataDir>/backups`. */
  path: string;
}

export interface BackupResultStatus {
  ok: boolean;
  at: string;
  archive?: string;
  bytes?: number;
  mechanism?: string;
  error?: string;
}

export interface BackupStatus {
  lastRunAt: string | null;
  lastResult: BackupResultStatus | null;
  nextRunAt: string | null;
  lastSuccessAt: string | null;
}

export interface BackupConfig {
  version: 1;
  schedule: BackupSchedule | null;
  retention: RetentionPolicy;
  destination: BackupDestination;
  /** Include machine-local secrets.json in the archive. OFF by default. */
  includeSecrets: boolean;
  status: BackupStatus;
}

const DEFAULT_RETENTION: RetentionPolicy = { keepLast: 7, keepDaily: 0, keepWeekly: 0 };

function emptyStatus(): BackupStatus {
  return { lastRunAt: null, lastResult: null, nextRunAt: null, lastSuccessAt: null };
}

export class BackupConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupConfigError';
  }
}

export class BackupConfigStore {
  private readonly filePath: string;
  private config: BackupConfig;

  constructor(private readonly dataDir: string) {
    this.filePath = path.join(dataDir, BACKUPS_FILE);
    this.config = this.load();
  }

  private defaults(): BackupConfig {
    return {
      version: 1,
      schedule: null,
      retention: { ...DEFAULT_RETENTION },
      destination: { type: 'local', path: path.join(this.dataDir, 'backups') },
      includeSecrets: false,
      status: emptyStatus()
    };
  }

  private load(): BackupConfig {
    if (!fs.existsSync(this.filePath)) return this.defaults();
    let parsed: unknown;
    try {
      parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
    } catch (e) {
      throw new BackupConfigError(`${this.filePath} is not valid JSON: ${e instanceof Error ? e.message : e}`);
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new BackupConfigError(`${this.filePath} must be a JSON object`);
    }
    const base = this.defaults();
    const p = parsed as Partial<BackupConfig>;
    return {
      version: 1,
      schedule: p.schedule
        ? {
            enabled: !!p.schedule.enabled,
            cron: String(p.schedule.cron || ''),
            missedFirePolicy: p.schedule.missedFirePolicy === 'run-once-on-start' ? 'run-once-on-start' : 'skip'
          }
        : null,
      retention: { ...base.retention, ...(p.retention || {}) },
      destination:
        p.destination && p.destination.type === 'local'
          ? { type: 'local', path: p.destination.path || base.destination.path }
          : base.destination,
      includeSecrets: !!p.includeSecrets,
      status: { ...emptyStatus(), ...(p.status || {}) }
    };
  }

  private persist(): void {
    fs.mkdirSync(this.dataDir, { recursive: true });
    const tmp = `${this.filePath}.tmp-${process.pid}`;
    fs.writeFileSync(tmp, JSON.stringify(this.config, null, 2) + '\n');
    fs.renameSync(tmp, this.filePath);
  }

  get(): BackupConfig {
    return JSON.parse(JSON.stringify(this.config));
  }

  getDestinationDir(): string {
    return this.config.destination.path;
  }

  getRetention(): RetentionPolicy {
    return { ...this.config.retention };
  }

  getSchedule(): BackupSchedule | null {
    return this.config.schedule ? { ...this.config.schedule } : null;
  }

  includeSecrets(): boolean {
    return this.config.includeSecrets;
  }

  /** Partial update of policy (schedule/retention/destination/includeSecrets). */
  update(patch: {
    schedule?: BackupSchedule | null;
    retention?: Partial<RetentionPolicy>;
    destination?: Partial<BackupDestination>;
    includeSecrets?: boolean;
  }): BackupConfig {
    if (patch.schedule !== undefined) this.config.schedule = patch.schedule;
    if (patch.retention) this.config.retention = { ...this.config.retention, ...patch.retention };
    if (patch.destination) {
      this.config.destination = {
        type: 'local',
        path: patch.destination.path || this.config.destination.path
      };
    }
    if (patch.includeSecrets !== undefined) this.config.includeSecrets = patch.includeSecrets;
    this.persist();
    return this.get();
  }

  recordResult(result: BackupResultStatus): void {
    this.config.status.lastRunAt = result.at;
    this.config.status.lastResult = result;
    if (result.ok) this.config.status.lastSuccessAt = result.at;
    this.persist();
  }

  setNextRun(nextRunAt: string | null): void {
    this.config.status.nextRunAt = nextRunAt;
    this.persist();
  }
}
