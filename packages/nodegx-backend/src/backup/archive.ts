/**
 * Backup archive format (BAK-007, implementation step 2).
 *
 * One backup is ONE file: `<name>.ngxbackup.tar.gz` — a gzipped USTAR tar (see
 * ./tar) whose first entry is `manifest.json` and whose remaining entries are
 * the consistent DB snapshot, the uploaded files, the cloud-function workflows,
 * and the diffable backend config. The manifest carries a sha256 of every other
 * entry, so a restore can verify integrity before it swaps anything (spec risk
 * row "torn archives"). The whole file is written atomically (temp + rename).
 *
 * The archive is engine-versioned (manifest.engine + .snapshotMechanism): we do
 * not claim cross-engine restore (out of scope), so restore refuses an archive
 * whose engine does not match.
 *
 * @module nodegx-backend/backup/archive
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';

import { createTar, extractTar, TarEntry } from './tar';
import type { SnapshotMechanism } from './snapshot';

export const ARCHIVE_FORMAT = 'nodegx-backup';
export const ARCHIVE_VERSION = 1 as const;
export const MANIFEST_ENTRY = 'manifest.json';
export const ARCHIVE_EXT = '.ngxbackup.tar.gz';

export interface ManifestEntry {
  name: string;
  bytes: number;
  sha256: string;
}

export interface BackupManifest {
  format: typeof ARCHIVE_FORMAT;
  version: typeof ARCHIVE_VERSION;
  createdAt: string;
  backendId: string;
  backendName: string;
  engine: string;
  snapshotMechanism: SnapshotMechanism;
  nodeVersion: string;
  includesSecrets: boolean;
  /** The db snapshot entry name, e.g. `db/local.db`. */
  dbEntry: string;
  /** Hash + size of every non-manifest entry. */
  entries: ManifestEntry[];
}

export function hashBuffer(buf: Buffer): string {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function atomicWriteFile(filePath: string, buf: Buffer): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, buf);
  fs.renameSync(tmp, filePath);
}

/**
 * Assemble content entries + a manifest into an archive file, atomically.
 * `contentEntries` must NOT include the manifest — it is generated here with a
 * fresh hash of every content entry.
 */
export function writeArchive(
  destPath: string,
  contentEntries: TarEntry[],
  manifestBase: Omit<BackupManifest, 'format' | 'version' | 'entries'>
): BackupManifest {
  const manifest: BackupManifest = {
    format: ARCHIVE_FORMAT,
    version: ARCHIVE_VERSION,
    ...manifestBase,
    entries: contentEntries
      .filter((e) => e.type !== '5')
      .map((e) => ({ name: e.name, bytes: e.data.length, sha256: hashBuffer(e.data) }))
  };
  const manifestEntry: TarEntry = {
    name: MANIFEST_ENTRY,
    data: Buffer.from(JSON.stringify(manifest, null, 2) + '\n', 'utf-8')
  };
  const tar = createTar([manifestEntry, ...contentEntries]);
  const gz = zlib.gzipSync(tar, { level: 9 });
  atomicWriteFile(destPath, gz);
  return manifest;
}

export interface ReadArchiveResult {
  manifest: BackupManifest;
  /** All content entries keyed by archive-relative name (manifest excluded). */
  entries: Map<string, TarEntry>;
}

/** Read + gunzip + untar an archive; parse and return the manifest and entries. */
export function readArchive(archivePath: string): ReadArchiveResult {
  const gz = fs.readFileSync(archivePath);
  let tar: Buffer;
  try {
    tar = zlib.gunzipSync(gz);
  } catch (e) {
    throw new Error(`Not a valid gzip archive: ${archivePath} (${e instanceof Error ? e.message : e})`);
  }
  const all = extractTar(tar);
  const manifestRaw = all.find((e) => e.name === MANIFEST_ENTRY);
  if (!manifestRaw) throw new Error(`Archive is missing ${MANIFEST_ENTRY}: ${archivePath}`);
  let manifest: BackupManifest;
  try {
    manifest = JSON.parse(manifestRaw.data.toString('utf-8'));
  } catch (e) {
    throw new Error(`Archive ${MANIFEST_ENTRY} is not valid JSON: ${e instanceof Error ? e.message : e}`);
  }
  if (manifest.format !== ARCHIVE_FORMAT) {
    throw new Error(`Not a NodeGX backup archive (format="${manifest.format}"): ${archivePath}`);
  }
  const entries = new Map<string, TarEntry>();
  for (const e of all) {
    if (e.name !== MANIFEST_ENTRY && e.type !== '5') entries.set(e.name, e);
  }
  return { manifest, entries };
}

export interface VerifyResult {
  ok: boolean;
  errors: string[];
}

/** Recompute every entry hash and compare against the manifest. */
export function verifyEntries(manifest: BackupManifest, entries: Map<string, TarEntry>): VerifyResult {
  const errors: string[] = [];
  for (const declared of manifest.entries) {
    const entry = entries.get(declared.name);
    if (!entry) {
      errors.push(`missing entry: ${declared.name}`);
      continue;
    }
    if (entry.data.length !== declared.bytes) {
      errors.push(`size mismatch for ${declared.name}: expected ${declared.bytes}, got ${entry.data.length}`);
    }
    const actual = hashBuffer(entry.data);
    if (actual !== declared.sha256) {
      errors.push(`hash mismatch for ${declared.name}`);
    }
  }
  return { ok: errors.length === 0, errors };
}
