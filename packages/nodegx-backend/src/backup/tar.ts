/**
 * Minimal USTAR tar writer/reader (BAK-007).
 *
 * A NodeGX backup is ONE portable archive. The service ships as a single
 * esbuild bundle with NO runtime node_modules (WF-005 hand-rolled cron for the
 * same reason), so we cannot pull in a tar dependency. USTAR is a stable, ~50
 * year-old format that any `tar` binary can open — which matters for operators
 * inspecting or restoring off-box — and its writer/reader is small and fully
 * testable, so we hand-roll it here rather than add a dependency.
 *
 * Scope: regular files and directories only (typeflag '0' and '5'), which is
 * all a backup needs. Long names use the USTAR name/prefix split; a path that
 * cannot fit either field throws LOUDLY rather than silently truncating.
 *
 * The archive is gzipped by `archive.ts` (Node's built-in zlib), so this module
 * deals only in the uncompressed tar byte stream.
 *
 * @module nodegx-backend/backup/tar
 */

const BLOCK = 512;
const NAME_MAX = 100;
const PREFIX_MAX = 155;

export interface TarEntry {
  /** Archive-relative path, POSIX separators, e.g. `config/security.json`. */
  name: string;
  /** File contents. Directories carry an empty buffer. */
  data: Buffer;
  /** '0' = regular file (default), '5' = directory. */
  type?: '0' | '5';
  /** Unix mode (default 0o644 for files, 0o755 for dirs). */
  mode?: number;
  /** Modification time (epoch seconds). Default now. */
  mtime?: number;
}

function octal(value: number, width: number): string {
  // width includes the trailing NUL; value is left-padded with zeros.
  const digits = width - 1;
  const s = Math.floor(value).toString(8);
  if (s.length > digits) {
    throw new Error(`tar: value ${value} does not fit in ${digits} octal digits`);
  }
  return s.padStart(digits, '0') + '\0';
}

/** Split a long name into { prefix, name } per USTAR, or throw if impossible. */
function splitName(full: string): { name: string; prefix: string } {
  if (Buffer.byteLength(full) <= NAME_MAX) return { name: full, prefix: '' };
  // Find a split point on a '/' boundary such that both halves fit.
  const parts = full.split('/');
  for (let i = 1; i < parts.length; i++) {
    const prefix = parts.slice(0, i).join('/');
    const name = parts.slice(i).join('/');
    if (Buffer.byteLength(prefix) <= PREFIX_MAX && Buffer.byteLength(name) <= NAME_MAX) {
      return { name, prefix };
    }
  }
  throw new Error(`tar: path too long for USTAR (name>100 & prefix>155): ${full}`);
}

function header(entry: TarEntry): Buffer {
  const buf = Buffer.alloc(BLOCK, 0);
  const { name, prefix } = splitName(entry.name);
  const isDir = entry.type === '5';
  const mode = entry.mode !== undefined ? entry.mode : isDir ? 0o755 : 0o644;
  const size = isDir ? 0 : entry.data.length;
  const mtime = entry.mtime !== undefined ? entry.mtime : Math.floor(Date.now() / 1000);

  buf.write(name, 0, NAME_MAX, 'utf-8');
  buf.write(octal(mode, 8), 100, 8, 'ascii');
  buf.write(octal(0, 8), 108, 8, 'ascii'); // uid
  buf.write(octal(0, 8), 116, 8, 'ascii'); // gid
  buf.write(octal(size, 12), 124, 12, 'ascii');
  buf.write(octal(mtime, 12), 136, 12, 'ascii');
  // checksum field filled with spaces for the initial sum
  buf.write('        ', 148, 8, 'ascii');
  buf.write(isDir ? '5' : '0', 156, 1, 'ascii');
  // linkname 157..256 left zero
  buf.write('ustar\0', 257, 6, 'ascii');
  buf.write('00', 263, 2, 'ascii');
  // uname/gname left zero; devmajor/devminor left zero
  if (prefix) buf.write(prefix, 345, PREFIX_MAX, 'utf-8');

  let sum = 0;
  for (let i = 0; i < BLOCK; i++) sum += buf[i];
  // 6-digit octal, NUL, space (the canonical GNU/BSD form).
  buf.write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'ascii');
  return buf;
}

function pad(len: number): number {
  const rem = len % BLOCK;
  return rem === 0 ? 0 : BLOCK - rem;
}

/** Serialize entries into a single uncompressed tar buffer. */
export function createTar(entries: TarEntry[]): Buffer {
  const chunks: Buffer[] = [];
  for (const entry of entries) {
    chunks.push(header(entry));
    if (entry.type !== '5' && entry.data.length > 0) {
      chunks.push(entry.data);
      const p = pad(entry.data.length);
      if (p > 0) chunks.push(Buffer.alloc(p, 0));
    }
  }
  // Two zero blocks terminate the archive.
  chunks.push(Buffer.alloc(BLOCK * 2, 0));
  return Buffer.concat(chunks);
}

function parseOctal(buf: Buffer, offset: number, length: number): number {
  let s = buf.toString('ascii', offset, offset + length);
  // Trim NULs and spaces.
  s = s.replace(/[\0 ]/g, '');
  if (!s) return 0;
  return parseInt(s, 8) || 0;
}

function cstr(buf: Buffer, offset: number, length: number): string {
  let end = offset;
  const max = offset + length;
  while (end < max && buf[end] !== 0) end++;
  return buf.toString('utf-8', offset, end);
}

/** Parse a tar buffer back into entries (files and directories). */
export function extractTar(buf: Buffer): TarEntry[] {
  const entries: TarEntry[] = [];
  let offset = 0;
  while (offset + BLOCK <= buf.length) {
    const block = buf.subarray(offset, offset + BLOCK);
    // A zero block signals end-of-archive.
    if (block.every((b) => b === 0)) break;

    const name = cstr(block, 0, NAME_MAX);
    const prefix = cstr(block, 345, PREFIX_MAX);
    const size = parseOctal(block, 124, 12);
    const mode = parseOctal(block, 100, 8);
    const mtime = parseOctal(block, 136, 12);
    const typeByte = block.toString('ascii', 156, 157);
    const type: '0' | '5' = typeByte === '5' ? '5' : '0';
    const fullName = prefix ? `${prefix}/${name}` : name;

    offset += BLOCK;
    let data = Buffer.alloc(0);
    if (type !== '5' && size > 0) {
      data = Buffer.from(buf.subarray(offset, offset + size));
      offset += size + pad(size);
    }
    entries.push({ name: fullName, data, type, mode, mtime });
  }
  return entries;
}
