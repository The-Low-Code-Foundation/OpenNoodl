/**
 * Orphan sweep (BAK-006) — blobs with no `_Files` row, and rows whose blob is
 * missing. Compares the driver's actual key listing against the metadata
 * table; REPORT-ONLY by default (the default the spec calls for: "reporting
 * loudly rather than auto-deleting"). Passing `delete: true` opts into
 * actually removing orphan blobs (never rows — an orphan row with a missing
 * blob is a data-integrity problem for an operator to look at, not something
 * this job silently prunes).
 *
 * Runs on WF-005's `CronScheduler` — the SAME class BAK-007 already reuses
 * for scheduled backups (`BackupSubsystem`'s module doc: "ONE scheduler
 * class, two consumers" — this makes it three, still one scheduler).
 *
 * @module nodegx-backend/storage/orphanSweep
 */

import type { StorageDriver } from './types';
import type { MetadataStore } from './MetadataStore';
import type { OrphanSweepReport } from './config';

export interface SweepOptions {
  /** Actually delete orphan BLOBS (never rows). Default false — report only. */
  delete?: boolean;
  now?: () => Date;
}

export async function runOrphanSweep(driver: StorageDriver, metadata: MetadataStore, options: SweepOptions = {}): Promise<OrphanSweepReport> {
  const now = options.now || (() => new Date());
  try {
    const rows = await metadata.listAll();
    const keyToRow = new Map<string, string>(); // key -> objectId
    for (const row of rows) keyToRow.set(row.key, row.objectId);

    const blobKeys = new Set<string>();
    for await (const key of driver.listKeys()) blobKeys.add(key);

    const orphanBlobs: string[] = [];
    for (const key of blobKeys) {
      if (!keyToRow.has(key)) orphanBlobs.push(key);
    }
    const orphanRows: string[] = [];
    for (const [key, objectId] of keyToRow) {
      if (!blobKeys.has(key)) orphanRows.push(objectId);
    }

    let deleted = false;
    if (options.delete) {
      for (const key of orphanBlobs) await driver.delete(key);
      deleted = true;
    }

    return { at: now().toISOString(), orphanBlobs, orphanRows, deleted };
  } catch (e) {
    return {
      at: now().toISOString(),
      orphanBlobs: [],
      orphanRows: [],
      deleted: false,
      error: e instanceof Error ? e.message : String(e)
    };
  }
}
