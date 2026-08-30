/**
 * `src/lib/id.ts` — the two id generators, emitted into the app (EXP-011 Tier 2.7).
 *
 * The same shape as {@link ./dateLib.ts} and {@link ./utilLib.ts}: constant text, shipped only
 * where something calls into it. A **separate** module rather than a section of `util.ts`, on
 * that file's own stated rule — a project that formats a string should not ship a CSPRNG.
 *
 * It is a transcription of three runtime files, and the two nodes it serves are **not** two
 * spellings of one thing. `uuid.ts`'s own header says so, and the export has to keep them apart:
 *
 * | | `Unique Id` | `UUID` |
 * |---|---|---|
 * | shape | 10 chars, alphanumeric | 36 chars, RFC 4122 v4 |
 * | source | `Math.random()` (`model.ts` `_randomString`) | `crypto.randomUUID` / `crypto.getRandomValues` |
 * | can it fail | **no** — and the node has no Failure port | **yes**, and it has `failure` and `Error` |
 *
 * - `noodl-runtime/src/model.ts` — `Model.guid()` is `_randomString(10)`, and the character set
 *   and the `(1 + Math.random()) * 0x10000` index are transcribed rather than modernised. An
 *   `id.length === 10` assertion would pass on a rewrite that drew from a different alphabet, and
 *   these ids end up in urls and as React keys in apps that already shipped.
 * - `noodl-runtime/src/nodes/std-library/crypto/encoding.ts` — `randomUuid`, its `randomBytes`
 *   dependency and `bytesToHex`. 🔴 **The `getRandomValues` throw is transcribed verbatim,
 *   message included**, because it is the *only* thing `UUID`'s Failure arm can ever report and
 *   the emitted app's Error output prints it.
 * - `noodl-runtime/src/nodes/std-library/crypto/uuid.ts` — the node's own `try`/`catch`, which is
 *   what {@link tryRandomUuid} and `initialUuid` are. The node never lets the throw escape.
 *
 * ⚠️ **`randomBytes`'s 65536-byte chunk loop is deliberately not transcribed.** It exists so a
 * large request does not exceed `getRandomValues`'s per-call quota; this call asks for **16**
 * bytes, one loop iteration, and reproducing the loop would be transcribing a constraint that
 * cannot bind here. Everything the loop *decides* for 16 bytes is what the single call does.
 *
 * 🔴 **`tryRandomUuid` returns a discriminated union rather than `{ uuid?, error? }`.** The
 * emitted action branches on it and then reads `.uuid` in the success arm; an optional-property
 * pair does not narrow, so that read would be `string | undefined` and every sink downstream
 * would have to guard a value that is always present. The union is what makes the emitted app
 * typecheck without a `!`.
 */

/** Where the module lands in the exported app. */
export const ID_LIB_PATH = 'src/lib/id.ts';

/**
 * The exported helpers. Sorted — the import list is sorted too.
 *
 * `randomUuid` is deliberately **not** exported from the emitted module: it throws, and the two
 * nodes that use it both catch. Exporting it would offer the exported app a door the interpreter
 * does not have.
 */
export const ID_HELPERS = ['initialUuid', 'randomId', 'tryRandomUuid'] as const;

export type IdHelper = (typeof ID_HELPERS)[number];

/**
 * Which of the two generators a node calls, and what each earns.
 *
 * 🔴 Must agree with `ID_NODES` in `plan.ts`, which reads this table rather than restating it.
 * The `boot` helper seeds the state row and the `call` helper is what the `New` action invokes;
 * they differ for `UUID` because `initialize` swallows the failure and `_generate` reports it.
 */
export const ID_HELPERS_BY_FN: Record<'randomId' | 'randomUuid', { boot: IdHelper; call: IdHelper }> = {
  randomId: { boot: 'randomId', call: 'randomId' },
  randomUuid: { boot: 'initialUuid', call: 'tryRandomUuid' }
};

/**
 * The module's source.
 *
 * ⚠️ A plain string array rather than a template literal, for `dateLib.ts`'s stated reason: the
 * emitted body needs no interpolation, and keeping it out of an interpolation context means a
 * future edit cannot accidentally interpolate the generator's own scope into the exported app.
 */
export function idLibSource(): string {
  return [
    '//',
    '// The two id generators, transcribed from the interpreter they have to agree with:',
    '// noodl-runtime/src/model.ts (Model.guid) and',
    '// noodl-runtime/src/nodes/std-library/crypto/{encoding,uuid}.ts.',
    '//',
    '// The thing to read before changing anything: these are two different nodes, not two names',
    '// for one. `randomId` is ten characters of Math.random() and cannot fail; `randomUuid` is a',
    '// version-4 UUID from the platform CSPRNG and throws where there is no CSPRNG at all. Apps',
    '// use the first for React keys and the second for record ids, and swapping them is silent.',
    '//',
    '',
    '/**',
    ' * `Unique Id` — `Model.guid()`, which is `_randomString(10)`.',
    ' *',
    ' * ⚠️ Not a UUID, and not cryptographically strong. The alphabet and the index arithmetic are',
    ' * the interpreter\'s verbatim: ids from this function are already in shipped projects, as',
    ' * React keys and in urls, and a "tidier" rewrite drawing from a different alphabet would',
    ' * still pass every length and uniqueness check anyone would think to write.',
    ' */',
    'export function randomId(): string {',
    "  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' + 'abcdefghijklmnopqrstuvwxyz' + '0123456789';",
    "  let objectId = '';",
    '  for (let i = 0; i < 10; ++i) {',
    '    objectId += chars[Math.floor((1 + Math.random()) * 0x10000) % chars.length];',
    '  }',
    '  return objectId;',
    '}',
    '',
    '/** What `UUID`\'s New answers: the id, or the reason there is none. */',
    'export type UuidResult = { ok: true; uuid: string } | { ok: false; error: string };',
    '',
    'type CryptoLike = {',
    '  randomUUID?: () => string;',
    '  getRandomValues?: <T extends ArrayBufferView>(array: T) => T;',
    '};',
    '',
    'function hostCrypto(): CryptoLike | undefined {',
    '  return (globalThis as unknown as { crypto?: CryptoLike }).crypto;',
    '}',
    '',
    '/**',
    ' * A random v4 UUID, from `randomUUID` where it exists and from raw CSPRNG bytes where it',
    ' * does not. **Throws** where there is neither — which is the one failure the UUID node has,',
    ' * and the message below is what its Error output prints.',
    ' *',
    ' * `randomUUID` is secure-context-only in browsers and `getRandomValues` is not, so the',
    ' * fallback is a different door to the same bytes rather than a weaker one.',
    ' */',
    'function randomUuid(): string {',
    '  const c = hostCrypto();',
    "  if (c && typeof c.randomUUID === 'function') return c.randomUUID();",
    "  if (!c || typeof c.getRandomValues !== 'function') {",
    '    throw new Error(',
    "      'No cryptographic random source is available here (crypto.getRandomValues is missing). ' +",
    "        'This node will not fall back to Math.random().'",
    '    );',
    '  }',
    '  const bytes = new Uint8Array(16);',
    '  c.getRandomValues(bytes);',
    '  bytes[6] = (bytes[6] & 0x0f) | 0x40;',
    '  bytes[8] = (bytes[8] & 0x3f) | 0x80;',
    "  let hex = '';",
    "  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, '0');",
    '  return (',
    '    hex.slice(0, 8) +',
    "    '-' +",
    '    hex.slice(8, 12) +',
    "    '-' +",
    '    hex.slice(12, 16) +',
    "    '-' +",
    '    hex.slice(16, 20) +',
    "    '-' +",
    '    hex.slice(20)',
    '  );',
    '}',
    '',
    '/**',
    " * `UUID`'s New — the node's own try/catch, which is why `randomUuid` is not exported.",
    ' *',
    ' * On failure the node leaves `Id` as it was and writes only the message; on success it',
    ' * replaces the id **and clears the message**. Both halves are the interpreter\'s `_generate`.',
    ' */',
    'export function tryRandomUuid(): UuidResult {',
    '  try {',
    '    return { ok: true, uuid: randomUuid() };',
    '  } catch (e) {',
    '    return { ok: false, error: e instanceof Error ? e.message : String(e) };',
    '  }',
    '}',
    '',
    '/**',
    " * `UUID`'s `initialize` — one id at creation, so `Id` is never empty before the first New.",
    ' *',
    ' * ⚠️ The failure is **swallowed**, not reported: the node has no outcome token to report',
    ' * against at construction, so a host with no CSPRNG leaves Id blank and says nothing until',
    ' * New fires. That is the interpreter, and an export that surfaced it here would be inventing',
    ' * an error the running app does not show.',
    ' */',
    'export function initialUuid(): string | undefined {',
    '  const seeded = tryRandomUuid();',
    '  return seeded.ok ? seeded.uuid : undefined;',
    '}',
    ''
  ].join('\n');
}
