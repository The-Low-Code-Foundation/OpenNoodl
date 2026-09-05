/**
 * `src/lib/crypto.ts` — `Hash` and `Random Bytes`, emitted into the app (EXP-011 §59, Tier 2.8 row 9).
 *
 * The same shape as {@link ./idLib.ts}: constant text, shipped only where a component calls into
 * it. A **separate** module from `id.ts` on that file's own stated rule — it deliberately does not
 * export `randomUuid` because both id nodes catch, and this module's two verbs are the two nodes
 * that report a failure as an outcome rather than swallowing it — and from `util.ts` (a project
 * that formats a string should not ship a CSPRNG).
 *
 * A transcription of three runtime files:
 *
 * - `noodl-runtime/src/nodes/std-library/crypto/encoding.ts` — `bytesToHex`, `bytesToBase64`
 *   (chunked, verbatim), `bytesToBase64Url`, `encodeBytes` (an unknown encoding **throws**, with
 *   its sentence — the node lets that throw become its Failure), `requireSubtle` (🔴 message
 *   verbatim: `crypto.subtle` is absent on a page served over plain HTTP from anything but
 *   localhost, and that sentence is the one thing a Hash's Error output can say about it),
 *   `utf8Bytes`, and `randomBytes` (the `getRandomValues` throw verbatim, for the same reason).
 * - `crypto/hash.ts` — `_run`: `algorithm || 'SHA-256'`, `encoding || 'hex'`, `value || ''` (the
 *   `||`, not `??`: an author who cleared the field gets the default), the **synchronous** throw
 *   from `requireSubtle` and the promise rejection from `digest` both landing as the failure, the
 *   Error cleared on success.
 * - `crypto/randombytes.ts` — `_generate`: `length === undefined ? 32 : length` (🔴 NOT `||` —
 *   a Length of 0 is a failure, which is the node's whole reason for existing), the range gate
 *   with its exact sentence, the Error cleared on success.
 *
 * ⚠️ **`randomBytes`'s 65536-byte chunk loop is deliberately not transcribed**, on `id.ts`'s
 * rule: the node's own `MAX_LENGTH = 4096` gate runs first, so the loop is one iteration for
 * every length that reaches it — a constraint that cannot bind here.
 *
 * ⚠️ **The setters' coercions are NOT here.** `length`'s setter is `Number(value)` and runs where
 * a value is delivered; the emitter prints `Number(…)` around a wired Length at the call site
 * and a literal as a literal, so `undefined` reaching `tryRandomBytes` means "nobody ever set
 * it", exactly as it does in `_generate`. `value`, `algorithm` and `encoding` are stored as they
 * arrive and coerced by `_run` — those coercions are here.
 *
 * 🔴 **Both verbs return a discriminated union**, on `id.ts`'s reason: the emitted Done arm reads
 * `.digest` / `.value` unguarded, and an optional-property pair would not narrow.
 */

/** Where the module lands in the exported app. */
export const CRYPTO_LIB_PATH = 'src/lib/crypto.ts';

/** The exported verbs — the import list is sorted. */
export const CRYPTO_HELPERS = ['tryHash', 'tryRandomBytes'] as const;

export type CryptoHelper = (typeof CRYPTO_HELPERS)[number];

/**
 * The module's source.
 *
 * ⚠️ A plain string array rather than a template literal, for `dateLib.ts`'s stated reason: the
 * emitted body needs no interpolation, and keeping it out of an interpolation context means a
 * future edit cannot accidentally interpolate the generator's own scope into the exported app.
 */
export function cryptoLibSource(): string {
  return [
    '//',
    '// Hash and Random Bytes, transcribed from the interpreter they have to agree with:',
    '// noodl-runtime/src/nodes/std-library/crypto/{encoding,hash,randombytes}.ts.',
    '//',
    '// tryHash(value, algorithm, encoding): a SHA-2 digest of the UTF-8 bytes of `value`, rendered in',
    '// `encoding`, or the reason there is none. Asynchronous — crypto.subtle is — so the caller awaits it.',
    '// MD5 and SHA-1 are not offered: WebCrypto has neither, and the node would not hand-roll one.',
    '//',
    '// tryRandomBytes(length, encoding): `length` cryptographically random bytes rendered in `encoding`, or',
    '// the reason there are none. It never falls back to Math.random(): a silent downgrade from a CSPRNG',
    '// produces output that looks identical and is worthless, which is the defect this node exists to refuse.',
    '//',
    '// Both apply the node\'s own defaults where an input was never set or was cleared (SHA-256, hex, an',
    '// empty string; 32 bytes only when Length was never set — a Length of 0 is a failure, not a default).',
    '//',
    '',
    '/** Encodings a digest or a random block can be rendered in. */',
    "export type ByteEncoding = 'hex' | 'base64' | 'base64url';",
    '',
    '/** The digest algorithms WebCrypto actually has. MD5 and SHA-1 are deliberately absent. */',
    "export type DigestAlgorithm = 'SHA-256' | 'SHA-384' | 'SHA-512';",
    '',
    "/** What `Hash`'s Do answers: the digest, or the reason there is none. */",
    'export type HashResult = { ok: true; digest: string } | { ok: false; error: string };',
    '',
    "/** What `Random Bytes`' New answers: the rendered bytes, or the reason there are none. */",
    'export type RandomBytesResult = { ok: true; value: string } | { ok: false; error: string };',
    '',
    '/** Above this, an author has almost certainly wired a number they did not mean (randombytes.ts). */',
    'const MAX_LENGTH = 4096;',
    '',
    'interface SubtleLike {',
    '  digest(algorithm: string, data: Uint8Array): Promise<ArrayBuffer>;',
    '}',
    '',
    'interface CryptoLike {',
    '  subtle?: SubtleLike;',
    '  getRandomValues?(array: Uint8Array): Uint8Array;',
    '}',
    '',
    'function hostCrypto(): CryptoLike | undefined {',
    "  return typeof globalThis !== 'undefined' ? (globalThis as { crypto?: CryptoLike }).crypto : undefined;",
    '}',
    '',
    '/**',
    ' * WebCrypto, or a message saying why there isn\'t one.',
    ' *',
    ' * `crypto.subtle` is `undefined` in a browser on a page served over plain HTTP from anything other',
    ' * than localhost — it is a secure-context API. That is the one realistic absence, and it has to be',
    ' * diagnosable: "digest failed" would send an author looking at their input.',
    ' */',
    'function requireSubtle(): SubtleLike {',
    '  const c = hostCrypto();',
    '  if (!c || !c.subtle) {',
    '    throw new Error(',
    "      'WebCrypto is not available here. In a browser, crypto.subtle only exists in a secure context — ' +",
    "        'serve the page over HTTPS (or from localhost). In a cloud function it is always present.'",
    '    );',
    '  }',
    '  return c.subtle;',
    '}',
    '',
    '/** UTF-8 bytes for a string. */',
    'function utf8Bytes(text: string): Uint8Array {',
    '  return new TextEncoder().encode(text);',
    '}',
    '',
    'function bytesToHex(bytes: Uint8Array): string {',
    "  let out = '';",
    "  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, '0');",
    '  return out;',
    '}',
    '',
    'function bytesToBase64(bytes: Uint8Array): string {',
    '  // Chunked so a large block cannot blow the argument limit of `String.fromCharCode`.',
    "  let binary = '';",
    '  const CHUNK = 0x8000;',
    '  for (let i = 0; i < bytes.length; i += CHUNK) {',
    '    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)) as number[]);',
    '  }',
    '  return btoa(binary);',
    '}',
    '',
    'function bytesToBase64Url(bytes: Uint8Array): string {',
    "  return bytesToBase64(bytes).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '');",
    '}',
    '',
    '/** Render bytes in one of the three encodings. Unknown values fail loudly rather than defaulting. */',
    'function encodeBytes(bytes: Uint8Array, encoding: string): string {',
    "  if (encoding === 'hex') return bytesToHex(bytes);",
    "  if (encoding === 'base64') return bytesToBase64(bytes);",
    "  if (encoding === 'base64url') return bytesToBase64Url(bytes);",
    '  throw new Error(`Unknown encoding "${encoding}". Use hex, base64 or base64url.`);',
    '}',
    '',
    '/** Cryptographically random bytes — or an error. Never `Math.random()`. */',
    'function randomBytes(length: number): Uint8Array {',
    '  const c = hostCrypto();',
    "  if (!c || typeof c.getRandomValues !== 'function') {",
    '    throw new Error(',
    "      'No cryptographic random source is available here (crypto.getRandomValues is missing). ' +",
    "        'This node will not fall back to Math.random().'",
    '    );',
    '  }',
    '  const out = new Uint8Array(length);',
    '  c.getRandomValues(out);',
    '  return out;',
    '}',
    '',
    'const messageOf = (e: unknown): string => (e instanceof Error ? e.message : String(e));',
    '',
    '/**',
    " * `Hash`'s Do — the node's own `_run`. The inputs are what the setters stored (a wire's value or",
    ' * the authored one), and the fallbacks are applied HERE, as `_run` applies them: `||`, so a',
    ' * cleared field is the default. A synchronous throw (no WebCrypto) and a rejected digest (an',
    ' * algorithm WebCrypto has not got) both land as the failure; the Error is cleared on success.',
    ' */',
    'export async function tryHash(value: unknown, algorithm: unknown, encoding: unknown): Promise<HashResult> {',
    "  const algorithmName = String(algorithm || 'SHA-256');",
    "  const encodingName = String(encoding || 'hex');",
    "  const text = String(value || '');",
    '  let digesting: Promise<ArrayBuffer>;',
    '  try {',
    '    digesting = requireSubtle().digest(algorithmName, utf8Bytes(text));',
    '  } catch (e) {',
    '    return { ok: false, error: messageOf(e) };',
    '  }',
    '  try {',
    '    const buffer = await digesting;',
    '    return { ok: true, digest: encodeBytes(new Uint8Array(buffer), encodingName) };',
    '  } catch (e) {',
    '    return { ok: false, error: messageOf(e) };',
    '  }',
    '}',
    '',
    '/**',
    " * `Random Bytes`' New — the node's own `_generate`. `length` is what the Length setter stored",
    ' * (already `Number(…)`-coerced where a wire delivered it) or `undefined` where nobody ever set it,',
    ' * and only that case takes the default of 32: `Length: 0` is falsy, and `|| 32` would turn an',
    " * author's mistake into 32 valid-looking bytes — the exact shape of defect this node refuses.",
    ' */',
    'export function tryRandomBytes(length: unknown, encoding: unknown): RandomBytesResult {',
    '  const count = length === undefined ? 32 : (length as number);',
    "  const encodingName = String(encoding || 'hex');",
    '  if (!Number.isFinite(count) || count < 1 || count > MAX_LENGTH || Math.floor(count) !== count) {',
    '    return { ok: false, error: `Random Bytes: Length must be a whole number from 1 to ${MAX_LENGTH}, and was ${String(count)}.` };',
    '  }',
    '  try {',
    '    return { ok: true, value: encodeBytes(randomBytes(count), encodingName) };',
    '  } catch (e) {',
    '    return { ok: false, error: messageOf(e) };',
    '  }',
    '}',
    ''
  ].join('\n');
}
