/**
 * BAK-007: archive write/read + manifest hash verification (tamper detection).
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { readArchive, verifyEntries, writeArchive, ARCHIVE_EXT } from '../src/backup/archive';
import { extractTar } from '../src/backup/tar';
import * as zlib from 'zlib';
import { createTar } from '../src/backup/tar';

function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'bak-arch-'));
}

describe('backup/archive', () => {
  it('writes an archive atomically and reads it back with a valid manifest', () => {
    const dir = tmp();
    const dest = path.join(dir, `x${ARCHIVE_EXT}`);
    const manifest = writeArchive(
      dest,
      [
        { name: 'db/local.db', data: Buffer.from('DBDATA') },
        { name: 'config/security.json', data: Buffer.from('{"devOpen":true}') }
      ],
      {
        createdAt: new Date().toISOString(),
        backendId: 'b',
        backendName: 'B',
        engine: 'node:sqlite',
        snapshotMechanism: 'online-backup',
        nodeVersion: process.versions.node,
        includesSecrets: false,
        dbEntry: 'db/local.db'
      }
    );
    expect(fs.existsSync(dest)).toBe(true);
    expect(manifest.entries.length).toBe(2);

    const { manifest: read, entries } = readArchive(dest);
    expect(read.engine).toBe('node:sqlite');
    expect(entries.get('db/local.db')!.data.toString()).toBe('DBDATA');
    expect(verifyEntries(read, entries).ok).toBe(true);

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('detects a tampered entry via the manifest hash', () => {
    const dir = tmp();
    const dest = path.join(dir, `x${ARCHIVE_EXT}`);
    const manifest = writeArchive(dest, [{ name: 'db/local.db', data: Buffer.from('GOOD') }], {
      createdAt: new Date().toISOString(),
      backendId: 'b',
      backendName: 'B',
      engine: 'node:sqlite',
      snapshotMechanism: 'vacuum-into',
      nodeVersion: process.versions.node,
      includesSecrets: false,
      dbEntry: 'db/local.db'
    });

    // Corrupt the entry (keep the manifest) and re-pack.
    const { entries } = readArchive(dest);
    const tampered = createTar([
      { name: 'manifest.json', data: Buffer.from(JSON.stringify(manifest)) },
      { name: 'db/local.db', data: Buffer.from('EVIL') }
    ]);
    fs.writeFileSync(dest, zlib.gzipSync(tampered));

    const reread = readArchive(dest);
    const verify = verifyEntries(reread.manifest, reread.entries);
    expect(verify.ok).toBe(false);
    expect(verify.errors.join()).toMatch(/hash mismatch/);
    void extractTar; // keep import used
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
