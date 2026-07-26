/**
 * FileConfigStore — the persisted file-storage policy (BAK-006), mirroring
 * BackupConfigStore's shape: `<dataDir>/files.json` is diffable/deployable
 * policy (limits, content-type rules, driver selection, thumbnail presets,
 * the orphan-sweep schedule) plus runtime status persisted back so restarts
 * don't lose the last sweep report. S3 CREDENTIALS do not live here — they go
 * in secrets.json under the `files` namespace (SecretsStore convention); this
 * file only carries the non-secret driver shape (endpoint/bucket/region).
 *
 * @module nodegx-backend/storage/config
 */

import * as fs from 'fs';
import * as path from 'path';

const FILES_CONFIG_FILE = 'files.json';

export interface ContentTypePolicy {
  /** When non-null, ONLY these content types (post-sniff) may be uploaded. */
  allowList: string[] | null;
  /** Always checked, even when allowList is set: these content types are refused. */
  denyList: string[];
}

export type DriverConfig =
  | { type: 'local' }
  | { type: 's3'; endpoint: string; region: string; bucket: string; forcePathStyle: boolean };

export interface ThumbPreset {
  width: number;
  height: number;
  fit: 'cover' | 'contain';
}

export interface OrphanSweepSchedule {
  enabled: boolean;
  cron: string;
}

export interface OrphanSweepReport {
  at: string;
  /** Storage keys with no `_Files` row pointing at them. */
  orphanBlobs: string[];
  /** `_Files` rows whose blob is missing from the driver. */
  orphanRows: string[];
  /** True only when a caller explicitly asked the sweep to delete (opt-in; default is report-only). */
  deleted: boolean;
  error?: string;
}

/**
 * The subset of the config an admin may patch. Was inline on `update()`, which
 * meant `admin-files.ts` had nothing to name and cast the whole patch object
 * `as any` on its way in (PLAT-004). `update()` is still the validator — this
 * type says what the fields *are*, not that a caller sent them correctly.
 */
export interface FileConfigPatch {
  maxUploadBytes?: number;
  contentTypes?: Partial<ContentTypePolicy>;
  driver?: DriverConfig;
  thumbnails?: { presets?: Record<string, ThumbPreset> };
  signedUrlTtlSeconds?: number;
  orphanSweep?: OrphanSweepSchedule;
}

export interface FileStorageConfig {
  version: 1;
  maxUploadBytes: number;
  contentTypes: ContentTypePolicy;
  driver: DriverConfig;
  thumbnails: { presets: Record<string, ThumbPreset> };
  signedUrlTtlSeconds: number;
  orphanSweep: OrphanSweepSchedule;
  sweepStatus: { lastReport: OrphanSweepReport | null; nextRunAt: string | null };
}

const DEFAULT_MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25MB (recorded decision: BAK-006-NOTES §limits)

const DEFAULT_PRESETS: Record<string, ThumbPreset> = {
  sm: { width: 64, height: 64, fit: 'cover' },
  md: { width: 256, height: 256, fit: 'cover' },
  lg: { width: 1024, height: 1024, fit: 'contain' }
};

export class FileConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FileConfigError';
  }
}

export class FileConfigStore {
  private readonly filePath: string;
  private config: FileStorageConfig;

  constructor(private readonly dataDir: string) {
    this.filePath = path.join(dataDir, FILES_CONFIG_FILE);
    this.config = this.load();
  }

  private defaults(): FileStorageConfig {
    return {
      version: 1,
      maxUploadBytes: DEFAULT_MAX_UPLOAD_BYTES,
      contentTypes: { allowList: null, denyList: [] },
      driver: { type: 'local' },
      thumbnails: { presets: { ...DEFAULT_PRESETS } },
      signedUrlTtlSeconds: 300,
      orphanSweep: { enabled: false, cron: '0 3 * * *' },
      sweepStatus: { lastReport: null, nextRunAt: null }
    };
  }

  private load(): FileStorageConfig {
    if (!fs.existsSync(this.filePath)) return this.defaults();
    let parsed: unknown;
    try {
      parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
    } catch (e) {
      throw new FileConfigError(`${this.filePath} is not valid JSON: ${e instanceof Error ? e.message : e}`);
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new FileConfigError(`${this.filePath} must be a JSON object`);
    }
    const base = this.defaults();
    const p = parsed as Partial<FileStorageConfig>;
    return {
      version: 1,
      maxUploadBytes: typeof p.maxUploadBytes === 'number' && p.maxUploadBytes > 0 ? p.maxUploadBytes : base.maxUploadBytes,
      contentTypes: {
        allowList: Array.isArray(p.contentTypes?.allowList) ? (p.contentTypes as ContentTypePolicy).allowList : null,
        denyList: Array.isArray(p.contentTypes?.denyList) ? (p.contentTypes as ContentTypePolicy).denyList : []
      },
      driver: p.driver && p.driver.type === 's3'
        ? {
            type: 's3',
            endpoint: p.driver.endpoint || '',
            region: p.driver.region || 'us-east-1',
            bucket: p.driver.bucket || '',
            forcePathStyle: p.driver.forcePathStyle !== false
          }
        : { type: 'local' },
      thumbnails: { presets: { ...base.thumbnails.presets, ...(p.thumbnails && p.thumbnails.presets) } },
      signedUrlTtlSeconds:
        typeof p.signedUrlTtlSeconds === 'number' && p.signedUrlTtlSeconds > 0 ? p.signedUrlTtlSeconds : base.signedUrlTtlSeconds,
      orphanSweep: {
        enabled: !!(p.orphanSweep && p.orphanSweep.enabled),
        cron: (p.orphanSweep && p.orphanSweep.cron) || base.orphanSweep.cron
      },
      sweepStatus: {
        lastReport: (p.sweepStatus && p.sweepStatus.lastReport) || null,
        nextRunAt: (p.sweepStatus && p.sweepStatus.nextRunAt) || null
      }
    };
  }

  private persist(): void {
    fs.mkdirSync(this.dataDir, { recursive: true });
    const tmp = `${this.filePath}.tmp-${process.pid}`;
    fs.writeFileSync(tmp, JSON.stringify(this.config, null, 2) + '\n');
    fs.renameSync(tmp, this.filePath);
  }

  get(): FileStorageConfig {
    return JSON.parse(JSON.stringify(this.config));
  }

  update(patch: FileConfigPatch): FileStorageConfig {
    if (patch.maxUploadBytes !== undefined) {
      if (!(patch.maxUploadBytes > 0)) throw new FileConfigError('maxUploadBytes must be a positive number');
      this.config.maxUploadBytes = patch.maxUploadBytes;
    }
    if (patch.contentTypes) {
      this.config.contentTypes = { ...this.config.contentTypes, ...patch.contentTypes };
    }
    if (patch.driver) {
      if (patch.driver.type === 's3' && (!patch.driver.endpoint || !patch.driver.bucket)) {
        throw new FileConfigError('an s3 driver requires endpoint and bucket');
      }
      this.config.driver = patch.driver;
    }
    if (patch.thumbnails && patch.thumbnails.presets) {
      for (const [name, preset] of Object.entries(patch.thumbnails.presets)) {
        if (!(preset.width > 0) || !(preset.height > 0)) {
          throw new FileConfigError(`preset "${name}" must have positive width/height`);
        }
      }
      this.config.thumbnails = { presets: patch.thumbnails.presets };
    }
    if (patch.signedUrlTtlSeconds !== undefined) {
      if (!(patch.signedUrlTtlSeconds > 0)) throw new FileConfigError('signedUrlTtlSeconds must be a positive number');
      this.config.signedUrlTtlSeconds = patch.signedUrlTtlSeconds;
    }
    if (patch.orphanSweep) this.config.orphanSweep = patch.orphanSweep;
    this.persist();
    return this.get();
  }

  recordSweep(report: OrphanSweepReport): void {
    this.config.sweepStatus.lastReport = report;
    this.persist();
  }

  setNextSweepRun(nextRunAt: string | null): void {
    this.config.sweepStatus.nextRunAt = nextRunAt;
    this.persist();
  }
}
