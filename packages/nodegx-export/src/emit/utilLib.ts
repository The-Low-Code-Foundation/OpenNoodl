/**
 * `src/lib/util.ts` — the small string/math utilities, emitted into the app (EXP-011 Tier 2.7).
 *
 * The same shape as {@link ./dateLib.ts}, and for the same reason: `Substring`, `Number Remapper`
 * and `String Mapper` are one pure function each, so what varies between two projects using them
 * is only the arguments at the call site. Constant text here, shipped only where something calls
 * into it.
 *
 * It is a transcription of three runtime files, and the transcription is the whole job:
 *
 * - `noodl-runtime/src/nodes/std-library/substring.ts` — the `-1` sentinel and the `substr` call.
 * - `noodl-runtime/src/nodes/std-library/numberremapper.ts` — `_calculateNewOutputValue`, whose
 *   degenerate branch (`maxInput === minInput ⇒ 0`) is reproduced rather than repaired. NDA-012
 *   already decided that question in the interpreter, by moving the *default* off the degenerate
 *   configuration; an export that silently answered something else would disagree with the node
 *   an author has already watched run.
 * - `noodl-runtime/src/nodes/std-library/stringmapper.ts` — `doMapping`, which is an `indexOf`
 *   over two index-aligned lists.
 *
 * 🔴 **Two of the three take `unknown` where the runtime takes whatever arrived, and one place
 * they deliberately disagree.** `Substring`'s `string` setter is `value.toString()`, which
 * **throws** on `null`/`undefined` rather than yielding an empty result — the node's own port
 * description says so. Reproducing that would put an uncaught exception in somebody's page, which
 * is the trade the date family already refused (`dateLib.ts`, the enum paragraph). So the helper
 * answers `''` there, and the planner files a note wherever a wire into that port can actually
 * deliver an empty. For every value the interpreter survives, `String(v)` and `v.toString()` are
 * the same string.
 *
 * ⚠️ **`Number()` rather than the raw arithmetic, and they agree.** The interpreter stores what
 * arrives and lets `-` and `/` coerce. `Number(x)` and `x - 0` produce the same result for every
 * primitive a port can carry — `''` and `null` to `0`, `undefined` and unparseable text to `NaN`
 * — so the conversion is a typing device here and not a behaviour change.
 */

/** Where the module lands in the exported app. */
export const UTIL_LIB_PATH = 'src/lib/util.ts';

/** The exported helpers, one per translated node. Sorted — the import list is sorted too. */
export const UTIL_HELPERS = ['mapString', 'remapNumber', 'substring'] as const;

export type UtilHelper = (typeof UTIL_HELPERS)[number];

/**
 * Which helpers can answer `undefined`, and it is exactly one.
 *
 * `substring` always returns a string and `remapNumber` always returns a number (`NaN` is a
 * number, and `NaN` is what the interpreter publishes too). `mapString` publishes `Default` when
 * nothing matched, and `Default` is unset on a node whose panel the author never opened — so it
 * is the one read in this family a sink has to guard.
 *
 * 🔴 Must agree with `maybeUndefinedExpr` in `plan.ts` and `maybeUndefined` in `component.ts`;
 * both read this table rather than restating it, which is the only spelling under which three
 * copies of one fact cannot drift.
 */
export const UTIL_HELPER_MAY_BE_UNDEFINED: Record<UtilHelper, boolean> = {
  mapString: true,
  remapNumber: false,
  substring: false
};

/**
 * The module's source.
 *
 * ⚠️ A plain string rather than a template literal, for `dateLib.ts`'s stated reason: the emitted
 * body needs no interpolation, and keeping it out of an interpolation context means a future edit
 * cannot accidentally interpolate the generator's own scope into the exported app.
 */
export function utilLibSource(): string {
  return [
    '//',
    '// The small string and math utilities, transcribed from the interpreter they have to agree',
    '// with: noodl-runtime/src/nodes/std-library/{substring,numberremapper,stringmapper}.ts.',
    '//',
    '// The two worth reading before changing anything are the -1 sentinel in substring and the',
    '// hasOwnProperty test in mapString — both are cases where the obvious rewrite answers the',
    '// same thing almost always, and something else for the value an author is most likely to',
    '// have relied on.',
    '//',
    '',
    '/**',
    ' * `Substring` — the section of `input` between Start and End.',
    ' *',
    ' * 🔴 `end === -1` means "to the end of the string", not "one before the end". It is the value',
    ' * the node\'s own `initialize` writes, so it is what an untouched End port holds — the port',
    ' * *declares* a default of 0, which would yield nothing, and a declared default never runs its',
    ' * setter.',
    ' *',
    ' * The two branches are `substr(start)` and `substr(start, end - start)` written out: a',
    ' * negative Start counts back from the end, a length of zero or less is empty, and the length',
    ' * is computed from the Start the author wrote rather than from the resolved offset.',
    ' */',
    'export function substring(input: unknown, start: unknown, end: unknown): string {',
    "  const text = input === undefined || input === null ? '' : String(input);",
    '  const from = Number(start);',
    '  const to = Number(end);',
    '  const offset = from < 0 ? Math.max(text.length + from, 0) : Math.min(from, text.length);',
    '  if (to === -1) return text.slice(offset);',
    '  const length = to - from;',
    "  if (!(length > 0)) return '';",
    '  return text.slice(offset, offset + length);',
    '}',
    '',
    '/**',
    ' * `Number Remapper` — `value` rescaled from the input range onto the output range.',
    ' *',
    ' * ⚠️ The degenerate branch is the interpreter\'s: with the two input endpoints equal the',
    ' * normalised value is 0, so the answer is Output Minimum for every input. NDA-012 moved the',
    ' * *default* off that configuration rather than reporting it, because an unconfigured node is',
    ' * degenerate for the whole of the boot path.',
    ' */',
    'export function remapNumber(',
    '  value: unknown,',
    '  minInput: unknown,',
    '  maxInput: unknown,',
    '  minOutput: unknown,',
    '  maxOutput: unknown,',
    '  clamp: unknown',
    '): number {',
    '  const v = Number(value);',
    '  const minIn = Number(minInput);',
    '  const maxIn = Number(maxInput);',
    '  const minOut = Number(minOutput);',
    '  const maxOut = Number(maxOutput);',
    '  let normalized = maxIn === minIn ? 0 : (v - minIn) / (maxIn - minIn);',
    '  if (clamp) normalized = Math.max(0, Math.min(1, normalized));',
    '  return minOut + normalized * (maxOut - minOut);',
    '}',
    '',
    '/**',
    ' * `String Mapper` — the mapping paired with the input that matched, or Default when none did.',
    ' *',
    ' * 🔴 **`hasOwnProperty`, not `??`.** An Input with no Mapping beside it publishes `undefined`,',
    ' * and that is *not* the same answer as Default: the interpreter reads `mappings[idx]` off the',
    ' * index `indexOf` found, and a missing entry there is an empty answer rather than a fallback.',
    " * A `??` would send that case to Default and be right about every case but the author's",
    ' * half-filled table.',
    ' *',
    " * ⚠️ An unset Input String matches nothing. The node's setter stores `undefined` for it, and",
    ' * `indexOf(undefined)` over the numbered list answers -1 — so Default is the answer, which is',
    ' * what the `key === undefined` guard preserves here.',
    ' */',
    'export function mapString(',
    '  input: unknown,',
    '  cases: Record<string, string | undefined>,',
    '  fallback: unknown',
    '): string | undefined {',
    '  const key = input === undefined ? undefined : String(input);',
    '  if (key !== undefined && Object.prototype.hasOwnProperty.call(cases, key)) return cases[key];',
    '  return fallback === undefined ? undefined : String(fallback);',
    '}',
    ''
  ].join('\n');
}
