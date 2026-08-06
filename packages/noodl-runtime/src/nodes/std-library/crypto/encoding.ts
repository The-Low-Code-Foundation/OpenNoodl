/**
 * The byte plumbing every crypto node shares (CWF-010).
 *
 * ⚠️ **`Buffer` is Node-only and must not appear here.** These helpers are used by nodes in the
 * shared runtime (Hash, Random Bytes, UUID), which means the browser, SSR and the cloud all
 * execute them. `TextEncoder`, `btoa`/`atob` and `crypto` are the three globals all three have.
 *
 * ⚠️ **`Math.random()` is not a source of bytes.** `randomBytes` throws rather than degrading —
 * a silent downgrade from a CSPRNG is a security defect that leaves no trace, and `Math.random()`
 * is exactly the thing a well-meaning fallback reaches for. (For the record: the existing
 * `Unique Id` node *is* `Math.random()` — ten characters from `Model.guid()`. It is a short id
 * for keying a list, not a credential, and the two nodes' descriptions now say so.)
 */

/** Encodings a digest or a random block can be rendered in. */
export type ByteEncoding = 'hex' | 'base64' | 'base64url';

/** The digest algorithms WebCrypto actually has. MD5 and SHA-1 are deliberately absent. */
export type DigestAlgorithm = 'SHA-256' | 'SHA-384' | 'SHA-512';

/**
 * The slice of WebCrypto this file uses, described structurally.
 *
 * ⚠️ Not `SubtleCrypto`/`Crypto` from the DOM lib: `noodl-viewer-cloud` compiles with
 * `lib: ["ES2019", "ES2020.String"]` and imports these helpers from source, so a DOM type here is
 * a `typecheck:cloud` failure in a package that has no DOM. Structural types are also honest —
 * this is exactly the surface used, in all three runtimes.
 */
export interface SubtleLike {
  digest(algorithm: string, data: Uint8Array): Promise<ArrayBuffer>;
  importKey(
    format: string,
    keyData: Uint8Array,
    algorithm: { name: string; hash: { name: string } },
    extractable: boolean,
    usages: string[]
  ): Promise<unknown>;
  sign(algorithm: string, key: unknown, data: Uint8Array): Promise<ArrayBuffer>;
}

export interface CryptoLike {
  subtle?: SubtleLike;
  getRandomValues?(array: Uint8Array): Uint8Array;
  randomUUID?(): string;
}

function hostCrypto(): CryptoLike | undefined {
  return typeof globalThis !== 'undefined' ? (globalThis as { crypto?: CryptoLike }).crypto : undefined;
}

/**
 * WebCrypto, or a message saying why there isn't one.
 *
 * `crypto.subtle` is `undefined` in a browser on a page served over plain HTTP from anything
 * other than localhost — it is a secure-context API. That is the one realistic absence, and it
 * has to be diagnosable: "digest failed" would send an author looking at their input.
 */
export function requireSubtle(): SubtleLike {
  const c = hostCrypto();
  if (!c || !c.subtle) {
    throw new Error(
      'WebCrypto is not available here. In a browser, crypto.subtle only exists in a secure context — ' +
        'serve the page over HTTPS (or from localhost). In a cloud function it is always present.'
    );
  }
  return c.subtle;
}

/** UTF-8 bytes for a string. */
export function utf8Bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

export function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, '0');
  return out;
}

export function bytesToBase64(bytes: Uint8Array): string {
  // Chunked so a large block cannot blow the argument limit of `String.fromCharCode`.
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)) as number[]);
  }
  return btoa(binary);
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlToBytes(text: string): Uint8Array {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/** Render bytes in one of the three encodings. Unknown values fail loudly rather than defaulting. */
export function encodeBytes(bytes: Uint8Array, encoding: ByteEncoding): string {
  if (encoding === 'hex') return bytesToHex(bytes);
  if (encoding === 'base64') return bytesToBase64(bytes);
  if (encoding === 'base64url') return bytesToBase64Url(bytes);
  throw new Error(`Unknown encoding "${encoding}". Use hex, base64 or base64url.`);
}

/**
 * Cryptographically random bytes — or an error. Never `Math.random()`.
 *
 * `getRandomValues` refuses more than 65536 bytes per call, so long blocks are filled in chunks
 * rather than silently truncated.
 */
export function randomBytes(length: number): Uint8Array {
  const c = hostCrypto();
  if (!c || typeof c.getRandomValues !== 'function') {
    throw new Error(
      'No cryptographic random source is available here (crypto.getRandomValues is missing). ' +
        'This node will not fall back to Math.random().'
    );
  }
  const out = new Uint8Array(length);
  const CHUNK = 65536;
  for (let i = 0; i < length; i += CHUNK) {
    c.getRandomValues(out.subarray(i, Math.min(i + CHUNK, length)));
  }
  return out;
}

/** A random v4 UUID, from `randomUUID` where it exists and from raw CSPRNG bytes where it does not. */
export function randomUuid(): string {
  const c = hostCrypto();
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();

  // `randomUUID` is secure-context-only in browsers, `getRandomValues` is not. Same version-4
  // layout, same entropy source — this is a different door to the same bytes, not a weaker one.
  const bytes = randomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytesToHex(bytes);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Constant-time comparison of two byte arrays. Used by JWT verification. */
export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** `Do` an HMAC. Shared by the HMAC node and JWT sign/verify so they cannot disagree. */
export async function hmacBytes(key: string, message: string, algorithm: DigestAlgorithm): Promise<Uint8Array> {
  const subtle = requireSubtle();
  const cryptoKey = await subtle.importKey(
    'raw',
    utf8Bytes(key),
    { name: 'HMAC', hash: { name: algorithm } },
    false,
    ['sign']
  );
  const signature = await subtle.sign('HMAC', cryptoKey, utf8Bytes(message));
  return new Uint8Array(signature);
}
