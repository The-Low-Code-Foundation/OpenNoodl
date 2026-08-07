/**
 * Consistent SQLite snapshot mechanics (BAK-007, implementation step 1).
 *
 * ## The engine story (verified at runtime — Node v22.22.0)
 *
 * WF-004's engine is `node:sqlite` (`DatabaseSync`). Two consistent-snapshot
 * mechanisms were probed against the real engine before anything was built on
 * them (spec step 1 / risk row "Engine's snapshot API gaps"):
 *
 *   1. **Online backup API** — `require('node:sqlite').backup(sourceDb, dest)`.
 *      Present and working on this Node (returns the number of pages copied).
 *      This is the equivalent of `better-sqlite3.backup()`: a page-level copy of
 *      a live source connection that tolerates concurrent writers. NOTE it is a
 *      MODULE-level function, not a `db.backup()` instance method (which is
 *      `undefined`), and it was added AFTER the `engines.node >= 22.13` floor,
 *      so it can be absent on an in-range deploy — hence the feature-detect.
 *   2. **`VACUUM INTO '<path>'`** — present and working; the DOCUMENTED fallback
 *      the spec blesses. Produces a fresh, defragmented, self-contained db file.
 *
 * Both are WAL-correct: we snapshot from a FRESH read connection opened on the
 * same db file, which sees all COMMITTED data (readers apply committed WAL
 * frames) and never an uncommitted in-flight transaction — so a snapshot can
 * never capture a torn record. We prefer the online API when available and fall
 * back to VACUUM INTO otherwise; the chosen mechanism is recorded in the
 * manifest so a restore knows how the snapshot was produced.
 *
 * We deliberately snapshot from a fresh connection rather than the adapter's
 * live handle: the adapter wraps `DatabaseSync` in a better-sqlite3-shaped shim
 * (engine.js `wrapNodeSqlite`) that does not expose the raw handle the online
 * API needs, and a fresh read connection is the canonical online-backup source
 * anyway.
 *
 * @module nodegx-backend/backup/snapshot
 */

import * as fs from 'fs';
import * as path from 'path';

export type SnapshotMechanism = 'online-backup' | 'vacuum-into';

export interface SnapshotResult {
  mechanism: SnapshotMechanism;
  /** Absolute path to the produced snapshot file. */
  outPath: string;
  bytes: number;
}

/** Resolve `node:sqlite` the same resilient way ExecutionStore/engine.js do. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loadSqlite(): any {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('node:sqlite');
  } catch {
    // jest's resolver predates node:sqlite; getBuiltinModule reaches it below
    // the module system (Node >= 22.3).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (process as any).getBuiltinModule('node:sqlite');
  }
}

/** True when the online backup API is available in this runtime. */
export function onlineBackupAvailable(): boolean {
  try {
    return typeof loadSqlite().backup === 'function';
  } catch {
    return false;
  }
}

/** Single-quote a path for a SQLite string literal (double embedded quotes). */
function sqlLiteral(p: string): string {
  return "'" + p.replace(/'/g, "''") + "'";
}

/**
 * Produce a consistent snapshot of the SQLite database at `dbPath` into
 * `outPath`. Prefers the online backup API; falls back to VACUUM INTO.
 * `outPath` must not already exist (both mechanisms require a fresh target).
 */
export async function snapshotDatabase(dbPath: string, outPath: string): Promise<SnapshotResult> {
  if (!fs.existsSync(dbPath)) {
    throw new Error(`snapshotDatabase: source database does not exist: ${dbPath}`);
  }
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  if (fs.existsSync(outPath)) fs.rmSync(outPath, { force: true });

  const sqlite = loadSqlite();
  const { DatabaseSync } = sqlite;

  // A fresh read connection is the online-backup source and the VACUUM host.
  const source = new DatabaseSync(dbPath);
  let mechanism: SnapshotMechanism;
  try {
    if (typeof sqlite.backup === 'function') {
      mechanism = 'online-backup';
      await sqlite.backup(source, outPath);
    } else {
      mechanism = 'vacuum-into';
      source.exec('VACUUM INTO ' + sqlLiteral(outPath));
    }
  } catch (e) {
    // If the online API threw (e.g. present but unusable), fall back LOUDLY-but-
    // recorded to VACUUM INTO rather than failing the whole backup.
    if (fs.existsSync(outPath)) fs.rmSync(outPath, { force: true });
    mechanism = 'vacuum-into';
    try {
      source.exec('VACUUM INTO ' + sqlLiteral(outPath));
    } catch (e2) {
      source.close();
      throw new Error(
        `snapshotDatabase: both online backup and VACUUM INTO failed. ` +
          `online: ${e instanceof Error ? e.message : e}; vacuum: ${e2 instanceof Error ? e2.message : e2}`
      );
    }
  } finally {
    source.close();
  }

  if (!fs.existsSync(outPath)) {
    throw new Error(`snapshotDatabase: snapshot produced no file at ${outPath}`);
  }
  return { mechanism, outPath, bytes: fs.statSync(outPath).size };
}

/**
 * Sanity-check that a snapshot file is a well-formed SQLite database and passes
 * an integrity check. Used by restore verification (no torn records).
 */
export function verifyDatabaseIntegrity(dbPath: string): { ok: boolean; detail: string } {
  const sqlite = loadSqlite();
  const { DatabaseSync } = sqlite;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let db: any = null;
  try {
    db = new DatabaseSync(dbPath);
    const row = db.prepare('PRAGMA integrity_check').get() as Record<string, unknown>;
    const value = row && (row.integrity_check as string);
    return { ok: value === 'ok', detail: String(value) };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : String(e) };
  } finally {
    if (db) db.close();
  }
}
