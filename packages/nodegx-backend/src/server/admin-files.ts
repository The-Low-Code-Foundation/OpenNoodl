/**
 * Admin file-storage config routes (BAK-006). Mirrors admin-backups.ts:
 * `admin`-only, the surface the editor's Backend Services panel, the served
 * dashboard, and the MCP file-config tools all drive.
 *
 *   GET  /admin/files/config    limits, content-type policy, driver, presets,
 *                               orphan-sweep schedule, transform (sharp) status
 *   PUT  /admin/files/config    update the above (S3 credentials via a
 *                               separate field — never echoed back)
 *   POST /admin/files/sweep     run the orphan sweep now (report-only unless
 *                               `deleteOrphans: true`)
 *
 * @module nodegx-backend/server/admin-files
 */

import type { RequestContext } from './HttpServer';
import type { FileSubsystem } from '../storage/FileSubsystem';
import { HttpError, readJSONBody, sendJSON } from './http-util';

export class AdminFileRoutes {
  constructor(private readonly files: FileSubsystem) {}

  getConfig(ctx: RequestContext): void {
    const config = this.files.config.get();
    const transform = this.files.transformStatus();
    // S3 credentials never round-trip back out — the panel shows "configured: true/false" only.
    sendJSON(ctx.res, 200, {
      config,
      driverKind: this.files.getDriver().kind,
      transformsAvailable: transform.available,
      transformUnavailableReason: transform.available ? undefined : transform.reason
    });
  }

  async updateConfig(ctx: RequestContext): Promise<void> {
    const body = await readJSONBody(ctx.req);
    const patch: Record<string, unknown> = {};
    if (body.maxUploadBytes !== undefined) patch.maxUploadBytes = body.maxUploadBytes;
    if (body.contentTypes !== undefined) patch.contentTypes = body.contentTypes;
    if (body.driver !== undefined) patch.driver = body.driver;
    if (body.signedUrlTtlSeconds !== undefined) patch.signedUrlTtlSeconds = body.signedUrlTtlSeconds;
    if (body.thumbnails !== undefined) patch.thumbnails = body.thumbnails;

    try {
      if (Object.keys(patch).length) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.files.updateConfig(patch as any);
      }
      if (body.orphanSweep !== undefined) {
        const s = body.orphanSweep as { enabled?: boolean; cron?: string } | null;
        this.files.setOrphanSweepSchedule(s ? { enabled: !!s.enabled, cron: String(s.cron || '') } : { enabled: false, cron: '0 3 * * *' });
      }
      if (body.s3Credentials !== undefined) {
        const creds = body.s3Credentials as { accessKeyId?: string; secretAccessKey?: string };
        this.files.setS3Credentials(String(creds.accessKeyId || ''), String(creds.secretAccessKey || ''));
      }
    } catch (e) {
      throw new HttpError(400, e instanceof Error ? e.message : String(e));
    }

    this.getConfig(ctx);
  }

  async runSweep(ctx: RequestContext): Promise<void> {
    const body = await readJSONBody(ctx.req).catch(() => ({}) as Record<string, unknown>);
    const report = await this.files.runSweepNow(body.deleteOrphans === true);
    sendJSON(ctx.res, 200, { report });
  }
}
