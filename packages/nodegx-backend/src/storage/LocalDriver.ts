/**
 * LocalDriver — the default StorageDriver: blobs on disk beside the data dir.
 *
 * Layout: `<root>/<hash[0:2]>/<hash[2:4]>/<hash>-<random8>`. The two-level hash
 * bucketing keeps any one directory from accumulating tens of thousands of
 * entries (the classic git-object-store trick); the random suffix means two
 * uploads of byte-identical content get DIFFERENT keys, so `delete()` on one
 * never removes a blob a second, unrelated `_Files` row still points at — we
 * deliberately do NOT content-address-dedupe (out of scope; documented in
 * BAK-006-NOTES) because that would need reference counting this v1 doesn't
 * have. This layout is also BAK-007's answer for backup inclusion: everything
 * lives under one `root` directory, so "back up the files driver" is "tar
 * this directory" — see BAK-006-NOTES §layout-for-backups.
 *
 * @module nodegx-backend/storage/LocalDriver
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import type { StorageDriver, StorageStat } from './types';

export class LocalDriver implements StorageDriver {
  readonly kind = 'local' as const;
  readonly root: string;

  constructor(root: string) {
    this.root = root;
  }

  private resolve(key: string): string {
    // Defense in depth: keys we mint ourselves are always hex+dash, but a key
    // that reached here from elsewhere (a corrupt metadata row) must never
    // escape `root` via `..` or an absolute path.
    const full = path.join(this.root, key);
    if (!full.startsWith(this.root + path.sep) && full !== this.root) {
      throw new Error(`Refusing to resolve a storage key outside its root: "${key}"`);
    }
    return full;
  }

  async put(hash: string, data: Buffer): Promise<string> {
    const bucket1 = hash.slice(0, 2) || '00';
    const bucket2 = hash.slice(2, 4) || '00';
    const key = path.join(bucket1, bucket2, `${hash}-${crypto.randomBytes(4).toString('hex')}`);
    const full = this.resolve(key);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, data);
    return key.split(path.sep).join('/');
  }

  async get(key: string): Promise<Buffer> {
    return fs.readFileSync(this.resolve(this.fromPosix(key)));
  }

  createReadStream(key: string): NodeJS.ReadableStream {
    return fs.createReadStream(this.resolve(this.fromPosix(key)));
  }

  async delete(key: string): Promise<void> {
    const full = this.resolve(this.fromPosix(key));
    if (fs.existsSync(full)) fs.unlinkSync(full);
  }

  async stat(key: string): Promise<StorageStat> {
    const full = this.resolve(this.fromPosix(key));
    if (!fs.existsSync(full)) return { exists: false, size: 0 };
    return { exists: true, size: fs.statSync(full).size };
  }

  async *listKeys(): AsyncIterable<string> {
    if (!fs.existsSync(this.root)) return;
    for (const b1 of fs.readdirSync(this.root)) {
      const dir1 = path.join(this.root, b1);
      if (!fs.statSync(dir1).isDirectory()) continue;
      for (const b2 of fs.readdirSync(dir1)) {
        const dir2 = path.join(dir1, b2);
        if (!fs.statSync(dir2).isDirectory()) continue;
        for (const name of fs.readdirSync(dir2)) {
          yield [b1, b2, name].join('/');
        }
      }
    }
  }

  private fromPosix(key: string): string {
    return key.split('/').join(path.sep);
  }
}
