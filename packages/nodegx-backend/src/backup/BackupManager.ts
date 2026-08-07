/**
 * BackupManager — create, list, restore, and rotate whole-backend archives
 * (BAK-007, implementation steps 2 & 3).
 *
 * A backup is a consistent DB snapshot (snapshot.ts) + the uploaded files dir +
 * the cloud-function workflows + the diffable backend config + a hashed manifest
 * (archive.ts), written atomically. The whole archive is also the migration
 * path (laptop → VPS = backup + restore), so it is a single portable file.
 *
 * Every operation writes a LOUD execution record through the SAME ExecutionHistory
 * the rest of the service uses (WF-006 substrate; the identical path
 * TriggerDispatcher.writeFailedRecord takes) — a failed backup is a visible
 * failed execution + a recorded failure status, never a silently stale "last
 * backup" timestamp (RUN-004).
 *
 * BAK-009 follow-up: `createBackup`/`restore` ALSO write an `_Audit` row when
 * the caller supplies `deps.openAudit` (optional). The HTTP admin routes get
 * their `_Audit` row for free from HttpServer's dispatcher — it stamps one
 * for every privileged route from the route table, keyed by method+pattern,
 * entirely outside this class. The CLI never builds an HTTP request, so it
 * never reaches that dispatcher; nothing else was writing the row for it.
 * Rather than duplicating the write with a second, ad hoc `_Audit` insert in
 * cli.ts, the record is written HERE, once, in the method both entry points
 * already call — and only the CLI's `BackupManager` instance is constructed
 * with `openAudit` set, so the HTTP path (whose row already exists) is
 * untouched and nothing double-records.
 *
 * `openAudit` is a FACTORY, not a pre-opened `AuditLog`, and it is called only
 * AFTER the operation finishes — deliberately. `restore` replaces the live db
 * FILE out from under any connection that was already open against it (WAL/SHM
 * removed, a new file renamed into place); a connection opened before that
 * swap and reused afterward would write into the discarded pre-restore file,
 * not the one now on disk. Opening fresh, once the swap is done, is what
 * makes "the restore row lands in the database that exists after the
 * restore" true rather than an accident of timing.
 *
 * @module nodegx-backend/backup/BackupManager
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import type { ExecutionHistory } from '../execution/ExecutionStore';
import type { AuditLog } from '../ops/audit';
import { logger } from '../ops/logger';
import type { BackupConfigStore, RetentionPolicy } from './config';
import { snapshotDatabase, verifyDatabaseIntegrity } from './snapshot';
import {
  ARCHIVE_EXT,
  BackupManifest,
  readArchive,
  verifyEntries,
  writeArchive
} from './archive';
import type { TarEntry } from './tar';

/** Config files (dataDir-root) captured under `config/` in the archive. */
const CONFIG_FILES = ['security.json', 'triggers.json', 'email.json', 'config-params.json', 'backups.json'];
const SECRETS_FILE = 'secrets.json';

export interface BackupManagerDeps {
  dataDir: string;
  /** Absolute path to the live SQLite db (persistence.dbPath). */
  dbPath: string;
  executions: ExecutionHistory;
  config: BackupConfigStore;
  backendId: string;
  backendName: string;
  /** Live schema export for the human-readable `config/schema.json` record. */
  getSchema?: () => unknown[];
  /**
   * BAK-009: when set, `createBackup`/`restore` write an `_Audit` row through
   * a connection this factory opens AFTER the operation completes (see the
   * module doc for why it must be lazy). `dataDir` is the directory the row
   * should be recorded against — the manager's own for a backup, the restore
   * TARGET for a restore, which may differ. Deliberately optional and off by
   * default: only the CLI's manager instance supplies this; the HTTP-serving
   * instance does not, because its row is already stamped by the request
   * dispatcher.
   */
  openAudit?: (dataDir: string) => Promise<{ audit: AuditLog; close: () => Promise<void> }>;
}

/** Who/where a privileged call came from, for the `_Audit` row (BAK-009). */
export interface BackupAuditActor {
  actorKind: string;
  actor: string;
  ip: string;
  requestId?: string;
}

export interface CreateBackupOptions {
  /** Execution-record trigger type: 'manual' (CLI/admin) or 'schedule'. */
  triggerType?: 'manual' | 'schedule' | 'test' | 'internal_event';
  /** Human-readable origin recorded on the execution. */
  source?: string;
  /** Override the destination directory (defaults to config's). */
  destinationDir?: string;
  /** Skip retention rotation (used by pre-restore safety snapshots). */
  skipRetention?: boolean;
  /** Filename prefix (default 'backup'). */
  prefix?: string;
  /** Audit actor (BAK-009). Falls back to a generic 'cli' actor when omitted. */
  actor?: BackupAuditActor;
}

export interface CreateBackupResult {
  archivePath: string;
  manifest: BackupManifest;
  bytes: number;
  deleted: string[];
}

export interface BackupListItem {
  file: string;
  path: string;
  bytes: number;
  createdAt: string | null;
}

export interface RestoreOptions {
  /** Restore into this dataDir (defaults to the manager's dataDir). */
  targetDataDir?: string;
  /** Take a pre-restore safety snapshot of the target first (default true). */
  safetySnapshot?: boolean;
  triggerType?: 'manual' | 'test';
  source?: string;
  /** Audit actor (BAK-009). Falls back to a generic 'cli' actor when omitted. */
  actor?: BackupAuditActor;
}

export interface RestoreResult {
  restoredFrom: string;
  targetDataDir: string;
  safetyArchive: string | null;
  integrity: { ok: boolean; detail: string };
  entriesWritten: number;
}

function walk(dir: string): string[] {
  const out: string[] = [];
  let names: string[];
  try {
    names = fs.readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of names) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) out.push(...walk(full));
    else if (stat.isFile()) out.push(full);
  }
  return out;
}

/** A filesystem-safe, sortable, parseable timestamp segment for a filename. */
function stampFor(date: Date): string {
  return date.toISOString().replace(/[:.]/g, '-');
}

/** Inverse of stampFor: recover a Date from an archive filename, or null. */
export function parseStampFromName(file: string): Date | null {
  const m = file.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z/);
  if (!m) return null;
  const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}.${m[7]}Z`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Pure retention selection: given dated archives (newest-first order not
 * required) and a policy, return the files to DELETE. keepLast always wins;
 * keepDaily/keepWeekly additionally protect the newest per day / per ISO-week
 * bucket within their windows. Unit-tested directly.
 */
export function selectForDeletion(
  archives: { file: string; date: Date }[],
  policy: RetentionPolicy,
  now: Date = new Date()
): string[] {
  const sorted = [...archives].sort((a, b) => b.date.getTime() - a.date.getTime());
  const keep = new Set<string>();

  // keepLast: newest N.
  if (policy.keepLast > 0) {
    for (const a of sorted.slice(0, policy.keepLast)) keep.add(a.file);
  } else if (policy.keepLast === 0 && policy.keepDaily === 0 && policy.keepWeekly === 0) {
    // keepAll semantics only when every knob is 0.
    return [];
  }

  const dayKey = (d: Date) => d.toISOString().slice(0, 10);
  const weekKey = (d: Date) => {
    const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const day = (t.getUTCDay() + 6) % 7; // Monday=0
    t.setUTCDate(t.getUTCDate() - day + 3);
    const firstThursday = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
    const week = 1 + Math.round(((t.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
    return `${t.getUTCFullYear()}-W${week}`;
  };

  const DAY = 86400000;
  if (policy.keepDaily > 0) {
    const seen = new Set<string>();
    const cutoff = now.getTime() - policy.keepDaily * DAY;
    for (const a of sorted) {
      if (a.date.getTime() < cutoff) continue;
      const k = dayKey(a.date);
      if (!seen.has(k)) {
        seen.add(k);
        keep.add(a.file); // newest of that day
      }
    }
  }
  if (policy.keepWeekly > 0) {
    const seen = new Set<string>();
    const cutoff = now.getTime() - policy.keepWeekly * 7 * DAY;
    for (const a of sorted) {
      if (a.date.getTime() < cutoff) continue;
      const k = weekKey(a.date);
      if (!seen.has(k)) {
        seen.add(k);
        keep.add(a.file);
      }
    }
  }

  return sorted.filter((a) => !keep.has(a.file)).map((a) => a.file);
}

export class BackupManager {
  constructor(private readonly deps: BackupManagerDeps) {}

  // --------------------------------------------------------------------------
  // Create
  // --------------------------------------------------------------------------

  async createBackup(options: CreateBackupOptions = {}): Promise<CreateBackupResult> {
    const triggerType = options.triggerType || 'manual';
    const source = options.source || 'backup';
    const logger = this.deps.executions.createLogger();
    if (logger) {
      logger.startExecution({
        workflowId: '__backup__',
        workflowName: 'Backup',
        triggerType,
        triggerData: { operation: 'backup', source },
        metadata: {
          backendId: this.deps.backendId,
          backendName: this.deps.backendName,
          operation: 'backup',
          triggerSource: source
        }
      });
    }

    const at = new Date();
    try {
      const result = await this.doCreate(at, options);
      if (logger) logger.completeExecution(true);
      this.deps.config.recordResult({
        ok: true,
        at: at.toISOString(),
        archive: result.archivePath,
        bytes: result.bytes,
        mechanism: result.manifest.snapshotMechanism
      });
      await this.recordAudit('backup.create', this.deps.dataDir, options.actor, 'success', {
        archive: result.archivePath,
        bytes: result.bytes,
        mechanism: result.manifest.snapshotMechanism,
        source
      });
      return result;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (logger) logger.completeExecution(false, e instanceof Error ? e : new Error(message));
      this.deps.config.recordResult({ ok: false, at: at.toISOString(), error: message });
      await this.recordAudit('backup.create', this.deps.dataDir, options.actor, 'failure', { error: message, source });
      throw e; // loud
    }
  }

  /**
   * Write this call's `_Audit` row, when `deps.audit` is set (BAK-009). A
   * missing actor gets a generic 'cli' one — the only manager instances built
   * without an explicit actor are the CLI's, and its internal callers (e.g.
   * schema-apply's pre-destructive backup) do not have a real principal to
   * name. Never throws: `AuditLog.record` already never rejects.
   */
  private async recordAudit(
    action: 'backup.create' | 'backup.restore',
    auditDataDir: string,
    actor: BackupAuditActor | undefined,
    outcome: 'success' | 'failure',
    detail: Record<string, unknown>
  ): Promise<void> {
    if (!this.deps.openAudit) return;
    try {
      const opened = await this.deps.openAudit(auditDataDir);
      try {
        await opened.audit.record({
          action,
          actorKind: actor?.actorKind ?? 'cli',
          actor: actor?.actor ?? '',
          outcome,
          ip: actor?.ip ?? 'cli',
          requestId: actor?.requestId,
          detail
        });
      } finally {
        await opened.close();
      }
    } catch (e) {
      // An audit failure never blocks or fails the operation it describes —
      // the same stance AuditLog.record itself takes for its own write.
      logger.warn('backup.audit-open-failed', { action, error: e instanceof Error ? e.message : String(e) });
    }
  }

  private async doCreate(at: Date, options: CreateBackupOptions): Promise<CreateBackupResult> {
    const destDir = options.destinationDir || this.deps.config.getDestinationDir();
    fs.mkdirSync(destDir, { recursive: true });

    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ngx-backup-'));
    try {
      // 1. Consistent DB snapshot (first — the consistency window the manifest
      //    documents starts here; files/config captured immediately after).
      const snapPath = path.join(workDir, 'local.db');
      const snap = await snapshotDatabase(this.deps.dbPath, snapPath);

      const includeSecrets = this.deps.config.includeSecrets();
      const entries: TarEntry[] = [];

      // db snapshot
      entries.push({ name: 'db/local.db', data: fs.readFileSync(snapPath) });

      // files/
      const filesDir = path.join(this.deps.dataDir, 'files');
      for (const abs of walk(filesDir)) {
        const rel = path.relative(filesDir, abs).split(path.sep).join('/');
        entries.push({ name: `files/${rel}`, data: fs.readFileSync(abs) });
      }

      // workflows/ (cloud functions)
      const workflowsDir = path.join(this.deps.dataDir, 'workflows');
      for (const abs of walk(workflowsDir)) {
        const rel = path.relative(workflowsDir, abs).split(path.sep).join('/');
        entries.push({ name: `workflows/${rel}`, data: fs.readFileSync(abs) });
      }

      // config/ (diffable policy)
      for (const name of CONFIG_FILES) {
        const abs = path.join(this.deps.dataDir, name);
        if (fs.existsSync(abs)) entries.push({ name: `config/${name}`, data: fs.readFileSync(abs) });
      }
      // schema record (human-readable; the db already carries _Schema)
      if (this.deps.getSchema) {
        try {
          const schema = this.deps.getSchema();
          entries.push({ name: 'config/schema.json', data: Buffer.from(JSON.stringify(schema, null, 2) + '\n', 'utf-8') });
        } catch {
          /* schema export is best-effort; a failure never aborts the backup */
        }
      }
      // secrets (opt-in only)
      if (includeSecrets) {
        const abs = path.join(this.deps.dataDir, SECRETS_FILE);
        if (fs.existsSync(abs)) entries.push({ name: `config/${SECRETS_FILE}`, data: fs.readFileSync(abs) });
      }

      // 2. Assemble + atomic write.
      const prefix = options.prefix || 'backup';
      const short = Math.random().toString(36).slice(2, 8);
      const archivePath = path.join(destDir, `${prefix}-${stampFor(at)}-${short}${ARCHIVE_EXT}`);
      const manifest = writeArchive(archivePath, entries, {
        createdAt: at.toISOString(),
        backendId: this.deps.backendId,
        backendName: this.deps.backendName,
        engine: 'node:sqlite',
        snapshotMechanism: snap.mechanism,
        nodeVersion: process.versions.node,
        includesSecrets: includeSecrets,
        dbEntry: 'db/local.db'
      });
      const bytes = fs.statSync(archivePath).size;

      // 3. Retention.
      let deleted: string[] = [];
      if (!options.skipRetention) deleted = this.applyRetention(destDir, at);

      return { archivePath, manifest, bytes, deleted };
    } finally {
      fs.rmSync(workDir, { recursive: true, force: true });
    }
  }

  // --------------------------------------------------------------------------
  // List / retention
  // --------------------------------------------------------------------------

  listBackups(destinationDir?: string): BackupListItem[] {
    const destDir = destinationDir || this.deps.config.getDestinationDir();
    let files: string[];
    try {
      files = fs.readdirSync(destDir);
    } catch {
      return [];
    }
    return files
      .filter((f) => f.endsWith(ARCHIVE_EXT))
      .map((f) => {
        const full = path.join(destDir, f);
        const date = parseStampFromName(f);
        return { file: f, path: full, bytes: fs.statSync(full).size, createdAt: date ? date.toISOString() : null };
      })
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }

  applyRetention(destinationDir: string, now: Date = new Date()): string[] {
    const items = this.listBackups(destinationDir)
      .map((i) => ({ file: i.file, date: parseStampFromName(i.file) }))
      .filter((i): i is { file: string; date: Date } => i.date !== null);
    const toDelete = selectForDeletion(items, this.deps.config.getRetention(), now);
    for (const file of toDelete) {
      fs.rmSync(path.join(destinationDir, file), { force: true });
    }
    return toDelete;
  }

  // --------------------------------------------------------------------------
  // Restore
  // --------------------------------------------------------------------------

  async restore(archivePath: string, options: RestoreOptions = {}): Promise<RestoreResult> {
    const target = options.targetDataDir || this.deps.dataDir;
    const logger = this.deps.executions.createLogger();
    if (logger) {
      logger.startExecution({
        workflowId: '__restore__',
        workflowName: 'Restore',
        triggerType: options.triggerType || 'manual',
        triggerData: { operation: 'restore', archive: archivePath, target },
        metadata: {
          backendId: this.deps.backendId,
          backendName: this.deps.backendName,
          operation: 'restore',
          triggerSource: options.source || 'restore'
        }
      });
    }

    try {
      const result = await this.doRestore(archivePath, target, options);
      if (logger) logger.completeExecution(true);
      // Opened AFTER doRestore returns — target's db file has already been
      // swapped by this point, so the row lands in the database that is
      // actually on disk now, not the one this call started against.
      await this.recordAudit('backup.restore', target, options.actor, 'success', {
        archive: archivePath,
        target,
        entriesWritten: result.entriesWritten,
        safetyArchive: result.safetyArchive
      });
      return result;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (logger) logger.completeExecution(false, e instanceof Error ? e : new Error(message));
      await this.recordAudit('backup.restore', target, options.actor, 'failure', { archive: archivePath, target, error: message });
      throw e; // loud
    }
  }

  private async doRestore(archivePath: string, target: string, options: RestoreOptions): Promise<RestoreResult> {
    if (!fs.existsSync(archivePath)) throw new Error(`No such archive: ${archivePath}`);

    // 1. Read + verify BEFORE touching anything.
    const { manifest, entries } = readArchive(archivePath);
    const verify = verifyEntries(manifest, entries);
    if (!verify.ok) {
      throw new Error(`Archive failed integrity verification:\n  - ${verify.errors.join('\n  - ')}`);
    }
    // Engine compatibility (no cross-engine restore claimed).
    if (manifest.engine !== 'node:sqlite') {
      throw new Error(`Refusing restore: archive engine "${manifest.engine}" != this backend's "node:sqlite".`);
    }
    if (manifest.version !== 1) {
      throw new Error(`Refusing restore: unsupported archive version ${manifest.version}.`);
    }

    // 2. Pre-restore safety snapshot of the CURRENT target (if it holds data).
    let safetyArchive: string | null = null;
    const targetDb = path.join(target, 'data', 'local.db');
    const wantSafety = options.safetySnapshot !== false;
    if (wantSafety && fs.existsSync(targetDb)) {
      const safety = await this.doCreate(new Date(), {
        destinationDir: path.join(target, 'backups'),
        skipRetention: true,
        prefix: 'pre-restore'
      });
      safetyArchive = safety.archivePath;
    }

    // 3. Swap. Target is assumed NOT to be actively served (restore is a
    //    service-stopped operation; the CLI/round-trip test guarantees this).
    let written = 0;

    // db: replace data/local.db and clear any stale WAL/SHM sidecars.
    const dbEntry = entries.get(manifest.dbEntry);
    if (!dbEntry) throw new Error(`Archive is missing its db entry "${manifest.dbEntry}".`);
    fs.mkdirSync(path.join(target, 'data'), { recursive: true });
    for (const sidecar of ['', '-wal', '-shm']) fs.rmSync(targetDb + sidecar, { force: true });
    const tmpDb = `${targetDb}.restore-${process.pid}`;
    fs.writeFileSync(tmpDb, dbEntry.data);
    fs.renameSync(tmpDb, targetDb);
    written++;

    // files/ + workflows/ : clear then repopulate from the archive.
    for (const sub of ['files', 'workflows']) {
      fs.rmSync(path.join(target, sub), { recursive: true, force: true });
    }
    // config/ : map back to dataDir-root files.
    for (const [name, entry] of entries) {
      if (name === manifest.dbEntry) continue;
      let outPath: string | null = null;
      if (name.startsWith('files/')) outPath = path.join(target, 'files', name.slice('files/'.length));
      else if (name.startsWith('workflows/')) outPath = path.join(target, 'workflows', name.slice('workflows/'.length));
      else if (name === 'config/schema.json') outPath = null; // informational only
      else if (name.startsWith('config/')) outPath = path.join(target, name.slice('config/'.length));
      if (!outPath) continue;
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, entry.data);
      written++;
    }

    // 4. Integrity check the restored db (no torn records).
    const integrity = verifyDatabaseIntegrity(targetDb);
    if (!integrity.ok) {
      throw new Error(`Restored database failed integrity_check: ${integrity.detail}`);
    }

    return { restoredFrom: archivePath, targetDataDir: target, safetyArchive, integrity, entriesWritten: written };
  }
}
