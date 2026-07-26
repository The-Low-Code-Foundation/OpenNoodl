/**
 * Admin backup / export-import / schema-promotion routes (BAK-007).
 *
 * All routes are `admin` access (the supervisor credential), mirroring
 * admin-triggers / admin-security. This is the HTTP surface the editor's
 * Backend Services panel and the MCP backup tools drive.
 *
 *   GET    /admin/backups             list archives + policy + status
 *   PUT    /admin/backups/config      update retention/destination/schedule/secrets
 *   POST   /admin/backups             run a backup now
 *   POST   /admin/backups/restore     restore { archive }  (danger; see notes)
 *   GET    /admin/export/:collection  ?format=json|csv  -> { content }
 *   POST   /admin/import/:collection  { format, content, dryRun } -> report
 *   POST   /admin/schema/diff         { source } -> diff against THIS backend
 *   POST   /admin/schema/apply        { source, allowDestructive } -> apply result
 *
 * Restore over HTTP swaps files under a running service; it is intended for a
 * quiesced backend (documented in the runbook). The CLI `restore` is the
 * blessed path (service stopped). We still expose it because the panel needs it.
 *
 * @module nodegx-backend/server/admin-backups
 */

import type { RequestContext } from './HttpServer';
import type { AdapterFacade } from '../persistence/AdapterFacade';
import type { BackupSubsystem } from '../backup/BackupSubsystem';
import type { BackupListItem } from '../backup/BackupManager';
import type { BackupConfig } from '../backup/config';
import { exportCollection, importCollection, DataFormat } from '../backup/dataio';
import {
  applySchema,
  diffSchema,
  renderDiff,
  SchemaDiff,
  SchemaSnapshot,
  snapshotFromLiveDir
} from '../backup/schema-migrate';
import { HttpError, readJSONBody, sendJSON } from './http-util';

export interface AdminBackupDeps {
  backups: BackupSubsystem;
  facade: AdapterFacade;
  dataDir: string;
}

/** `GET /admin/backups`. */
export interface BackupListResponse {
  config: BackupConfig;
  backups: BackupListItem[];
}

/** `GET`/`PUT /admin/backups/config`. */
export interface BackupConfigResponse {
  config: BackupConfig;
}

/** `POST /admin/backups`. */
export interface BackupRunResponse {
  ok: boolean;
  archive: string;
  bytes: number;
  mechanism: string;
  deleted: string[];
}

/** `POST /admin/schema/diff`. */
export interface SchemaDiffResponse {
  diff: SchemaDiff;
  rendered: string;
}

export class AdminBackupRoutes {
  constructor(private readonly deps: AdminBackupDeps) {}

  list(ctx: RequestContext): void {
    const { backups } = this.deps;
    sendJSON(ctx.res, 200, {
      config: backups.config.get(),
      backups: backups.manager.listBackups()
    } satisfies BackupListResponse);
  }

  async updateConfig(ctx: RequestContext): Promise<void> {
    const body = await readJSONBody(ctx.req);
    // Schedule goes through the subsystem (validates cron + rearms).
    if (body.schedule !== undefined) {
      this.deps.backups.setSchedule(
        body.schedule
          ? {
              enabled: !!(body.schedule as Record<string, unknown>).enabled,
              cron: String((body.schedule as Record<string, unknown>).cron || ''),
              missedFirePolicy:
                (body.schedule as Record<string, unknown>).missedFirePolicy === 'run-once-on-start'
                  ? 'run-once-on-start'
                  : 'skip'
            }
          : null
      );
    }
    const patch: Record<string, unknown> = {};
    if (body.retention !== undefined) patch.retention = body.retention;
    if (body.destination !== undefined) patch.destination = body.destination;
    if (body.includeSecrets !== undefined) patch.includeSecrets = body.includeSecrets;
    if (Object.keys(patch).length) this.deps.backups.config.update(patch);
    sendJSON(ctx.res, 200, { config: this.deps.backups.config.get() } satisfies BackupConfigResponse);
  }

  async runBackup(ctx: RequestContext): Promise<void> {
    const result = await this.deps.backups.manager.createBackup({
      triggerType: 'manual',
      source: 'admin backup'
    });
    sendJSON(ctx.res, 200, {
      ok: true,
      archive: result.archivePath,
      bytes: result.bytes,
      mechanism: result.manifest.snapshotMechanism,
      deleted: result.deleted
    } satisfies BackupRunResponse);
  }

  async restore(ctx: RequestContext): Promise<void> {
    const body = await readJSONBody(ctx.req);
    const archive = typeof body.archive === 'string' ? body.archive : '';
    if (!archive) throw new HttpError(400, 'archive (path) is required');
    const result = await this.deps.backups.manager.restore(archive, {
      triggerType: 'manual',
      source: 'admin restore',
      safetySnapshot: body.safetySnapshot !== false
    });
    sendJSON(ctx.res, 200, { ok: true, ...result });
  }

  async exportCollection(ctx: RequestContext): Promise<void> {
    const format = (ctx.query.format || 'json') as DataFormat;
    if (format !== 'json' && format !== 'csv') throw new HttpError(400, 'format must be json or csv');
    const result = await exportCollection(this.deps.facade, ctx.params.collection, format);
    sendJSON(ctx.res, 200, result);
  }

  async importCollection(ctx: RequestContext): Promise<void> {
    const body = await readJSONBody(ctx.req);
    const format = (body.format || 'json') as DataFormat;
    if (format !== 'json' && format !== 'csv') throw new HttpError(400, 'format must be json or csv');
    if (typeof body.content !== 'string') throw new HttpError(400, 'content (string) is required');
    const report = importCollection(this.deps.facade, ctx.params.collection, body.content, {
      format,
      dryRun: !!body.dryRun
    });
    sendJSON(ctx.res, report.error && !report.rejected.length ? 400 : 200, report);
  }

  private sourceFromBody(body: Record<string, unknown>): SchemaSnapshot {
    const source = body.source as SchemaSnapshot | undefined;
    if (!source || !Array.isArray(source.tables)) {
      throw new HttpError(400, 'source must be a schema snapshot: { tables: [...], permissions?, triggers?, templates? }');
    }
    return source;
  }

  async schemaDiff(ctx: RequestContext): Promise<void> {
    const body = await readJSONBody(ctx.req);
    const source = this.sourceFromBody(body);
    const target = snapshotFromLiveDir(this.deps.facade.schemaManager, this.deps.dataDir);
    const diff = diffSchema(source, target);
    sendJSON(ctx.res, 200, { diff, rendered: renderDiff(diff) } satisfies SchemaDiffResponse);
  }

  async schemaApply(ctx: RequestContext): Promise<void> {
    const body = await readJSONBody(ctx.req);
    const source = this.sourceFromBody(body);
    const target = snapshotFromLiveDir(this.deps.facade.schemaManager, this.deps.dataDir);
    const diff = diffSchema(source, target);
    try {
      const result = await applySchema(
        { schemaManager: this.deps.facade.schemaManager, dataDir: this.deps.dataDir },
        source,
        diff,
        { allowDestructive: !!body.allowDestructive, backupManager: this.deps.backups.manager }
      );
      sendJSON(ctx.res, 200, { ok: true, diff, result });
    } catch (e) {
      throw new HttpError(400, e instanceof Error ? e.message : String(e));
    }
  }
}
