/**
 * Content-type sniffing by magic bytes (BAK-006).
 *
 * "A PNG renamed .pdf is stored as what it is" (success criterion): the
 * client-declared `Content-Type` header and the uploaded file's extension are
 * both attacker-controlled and never trusted for validation or storage — only
 * for a display hint. `sniff()` inspects the actual bytes.
 *
 * Deliberately NOT exhaustive (no video/audio container parsing — out of
 * scope per the spec) — covers the formats this platform's File nodes and
 * transform pipeline actually care about, plus a text/JSON/SVG fallback tier,
 * plus a final generic-binary fallback. Zero dependencies (no `file-type`
 * npm package) — the signatures needed are a short, stable, well-known list.
 *
 * @module nodegx-backend/storage/sniff
 */

interface Signature {
  contentType: string;
  ext: string;
  match(buf: Buffer): boolean;
}

const SIGNATURES: Signature[] = [
  { contentType: 'image/png', ext: 'png', match: (b) => b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { contentType: 'image/jpeg', ext: 'jpg', match: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { contentType: 'image/gif', ext: 'gif', match: (b) => b.length >= 6 && (b.subarray(0, 6).toString('ascii') === 'GIF87a' || b.subarray(0, 6).toString('ascii') === 'GIF89a') },
  {
    contentType: 'image/webp',
    ext: 'webp',
    match: (b) => b.length >= 12 && b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP'
  },
  { contentType: 'image/bmp', ext: 'bmp', match: (b) => b.length >= 2 && b[0] === 0x42 && b[1] === 0x4d },
  { contentType: 'application/pdf', ext: 'pdf', match: (b) => b.length >= 5 && b.subarray(0, 5).toString('ascii') === '%PDF-' },
  {
    contentType: 'application/zip',
    ext: 'zip',
    match: (b) => b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && (b[2] === 0x03 || b[2] === 0x05 || b[2] === 0x07)
  },
  { contentType: 'audio/mpeg', ext: 'mp3', match: (b) => b.length >= 3 && ((b[0] === 0xff && (b[1] & 0xe0) === 0xe0) || b.subarray(0, 3).toString('ascii') === 'ID3') },
  { contentType: 'image/x-icon', ext: 'ico', match: (b) => b.length >= 4 && b[0] === 0x00 && b[1] === 0x00 && b[2] === 0x01 && b[3] === 0x00 }
];

/** Loose UTF-8 text check: no NUL bytes and no invalid-looking control bytes in the first chunk. */
function looksLikeText(buf: Buffer): boolean {
  const sample = buf.subarray(0, Math.min(buf.length, 4096));
  for (let i = 0; i < sample.length; i++) {
    const c = sample[i];
    if (c === 0) return false;
    // Allow tab/LF/CR plus printable + UTF-8 continuation/lead bytes.
    if (c < 0x09 || (c > 0x0d && c < 0x20)) return false;
  }
  return true;
}

export interface SniffResult {
  contentType: string;
  /** A conventional extension for the detected type (no leading dot), or null when we fell back to a text/binary guess. */
  ext: string | null;
}

/**
 * Sniff a buffer's real content type. `declaredName`'s extension is used only
 * as a text-format tiebreaker (json vs csv vs plain, which share no magic
 * bytes) — never to override a binary signature match, and never trusted
 * outright.
 */
export function sniff(buf: Buffer, declaredName?: string): SniffResult {
  for (const sig of SIGNATURES) {
    if (sig.match(buf)) return { contentType: sig.contentType, ext: sig.ext };
  }

  if (looksLikeText(buf)) {
    const trimmed = buf.subarray(0, Math.min(buf.length, 512)).toString('utf-8').trimStart();
    if (trimmed.startsWith('<?xml') || /^<svg[\s>]/i.test(trimmed)) {
      return { contentType: 'image/svg+xml', ext: 'svg' };
    }
    if (buf.length === 0) return { contentType: 'text/plain', ext: 'txt' };
    try {
      JSON.parse(buf.toString('utf-8'));
      return { contentType: 'application/json', ext: 'json' };
    } catch {
      // not JSON
    }
    const lowerName = (declaredName || '').toLowerCase();
    if (lowerName.endsWith('.csv')) return { contentType: 'text/csv', ext: 'csv' };
    if (lowerName.endsWith('.html') || lowerName.endsWith('.htm')) return { contentType: 'text/html', ext: 'html' };
    if (lowerName.endsWith('.css')) return { contentType: 'text/css', ext: 'css' };
    if (lowerName.endsWith('.js')) return { contentType: 'text/javascript', ext: 'js' };
    return { contentType: 'text/plain', ext: 'txt' };
  }

  return { contentType: 'application/octet-stream', ext: null };
}
