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
export const UTIL_HELPERS = ['blendColor', 'booleanToString', 'log', 'mapString', 'pickFile', 'remapNumber', 'substring'] as const;

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
  // EXP-011 §38: a string from two coerced strings, and a hex string (or `#000000`) — never absent.
  blendColor: false,
  booleanToString: false,
  // EXP-011 §39: a write, not a read — `log` returns nothing and no expression is ever built from it.
  log: false,
  mapString: true,
  // EXP-011 §45: an action, not a read — its promise is awaited and tested by the emitted arm, never bound as a value.
  pickFile: false,
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
    ' * the node\'s own `initialize` writes and, since DEF-033, the default the port declares too;',
    ' * 0 would yield nothing.',
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
    '',
    '/**',
    ' * `Boolean To String` — String for true while Selector is truthy, String for false otherwise.',
    ' *',
    ' * Truthiness, not `=== true`: the node\'s getter is `currentInput ? trueString : falseString`,',
    ' * so a wired 1 or "yes" picks the true string in the interpreter and here. An unset string is',
    ' * the empty string `initialize` writes.',
    ' */',
    'export function booleanToString(selector: unknown, whenTrue: unknown, whenFalse: unknown): string {',
    '  const picked = selector ? whenTrue : whenFalse;',
    "  return picked === undefined || picked === null ? '' : String(picked);",
    '}',
    '',
    '/**',
    ' * `Color Blend` — the colour at `blend` along the list, where 1 is exactly the second colour',
    ' * and 1.5 is halfway to the third.',
    ' *',
    ' * A transcription of colorblend.ts: the interpreter keeps the colours in a sparse array, a',
    ' * missing entry reads `#000000`, the blend is clamped to the list, and each channel is',
    ' * `Math.floor` of a linear mix. An empty list answers `#000000`, the value `initialize` writes.',
    ' *',
    ' * P79 E2/E5 — it also transcribes the PARSER. This used to read six hex digits blindly, so',
    ' * `var(--primary)` parsed as `NaN,NaN,NaN` and painted the literal string `#NaNNaNNaN`. The',
    ' * runtime was fixed first and this copy was not, which made the two disagree for a day; the',
    ' * parity suite is what caught it. A colour it still cannot read falls back to the nearest',
    ' * authored endpoint verbatim — the interpreter also reports one, which an exported app has no',
    ' * bus for, so the fallback is the whole of the behaviour here.',
    ' */',
    'export function blendColor(blend: unknown, ...colors: unknown[]): string {',
    "  if (colors.length === 0) return '#000000';",
    "  const colorAt = (index: number): string => (colors[index] ? String(colors[index]) : '#000000');",
    '  const clamped = Math.max(0, Math.min(colors.length - 1, Number(blend)));',
    '  const index = Math.floor(clamped);',
    '  const t = clamped - index;',
    '  if (t === 0) return colorAt(index);',
    '  const from = readColor(colorAt(index));',
    '  const to = readColor(colorAt(index + 1));',
    '  if (!from || !to) return colorAt(t < 0.5 ? index : index + 1);',
    '  const part = (c: number): string => {',
    '    const hex = c.toString(16);',
    "    return hex.length === 1 ? '0' + hex : hex;",
    '  };',
    "  return '#' + [0, 1, 2].map((i) => part(Math.floor(from[i] + (to[i] - from[i]) * t))).join('');",
    '}',
    '',
    '/**',
    ' * A colour as three channels, or `null` when this notation cannot be read.',
    ' *',
    ' * `var(--token)` is resolved against the document, which is the only honest source: a token',
    ' * can be redefined per theme, per component or per media query and only the browser knows',
    ' * which definition won. Bounded, so a token defined in terms of itself cannot hang a render.',
    ' */',
    'function readColor(value: string, depth = 0): [number, number, number] | null {',
    '  const text = String(value).trim();',
    '  if (!text) return null;',
    '  const asVar = /^var\\(\\s*(--[^,)\\s]+)\\s*(?:,([\\s\\S]*))?\\)$/.exec(text);',
    '  if (asVar) {',
    '    if (depth >= 8) return null;',
    "    let resolved = '';",
    "    if (typeof document !== 'undefined' && document.documentElement && typeof getComputedStyle === 'function') {",
    '      try {',
    '        resolved = getComputedStyle(document.documentElement).getPropertyValue(asVar[1]).trim();',
    '      } catch (e) {',
    "        resolved = '';",
    '      }',
    '    }',
    '    if (resolved) return readColor(resolved, depth + 1);',
    '    if (asVar[2] !== undefined) return readColor(asVar[2], depth + 1);',
    '    return null;',
    '  }',
    '  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(text);',
    '  if (short) {',
    '    return [',
    '      parseInt(short[1] + short[1], 16),',
    '      parseInt(short[2] + short[2], 16),',
    '      parseInt(short[3] + short[3], 16)',
    '    ];',
    '  }',
    '  const long = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(text);',
    '  if (long) return [parseInt(long[1], 16), parseInt(long[2], 16), parseInt(long[3], 16)];',
    '  const fn = /^rgba?\\(\\s*([\\d.]+)[\\s,]+([\\d.]+)[\\s,]+([\\d.]+)/i.exec(text);',
    '  if (fn) {',
    '    const channel = (raw: string): number => Math.max(0, Math.min(255, Math.round(Number(raw))));',
    '    return [channel(fn[1]), channel(fn[2]), channel(fn[3])];',
    '  }',
    '  return null;',
    '}',
    '',
    '/**',
    ' * `Log` — one console line at the level the node was set to.',
    ' *',
    " * A transcription of log.ts's `_write`, browser branch: the level is the console method, an",
    " * absent message prints as '', and `data` is passed only when one arrived — so a line with no",
    " * data prints no trailing `undefined`. The backend sink and its redaction belong to the cloud",
    ' * runtime and never reach a browser bundle; this is the branch the app already ran.',
    ' */',
    "export function log(level: 'debug' | 'info' | 'warn' | 'error', message: unknown, data?: unknown): void {",
    "  const text = message === undefined || message === null ? '' : String(message);",
    '  // eslint-disable-next-line no-console',
    '  const write = (console[level] || console.log || function () {}) as (...args: unknown[]) => void;',
    '  if (data !== undefined && data !== null) write.call(console, text, data);',
    '  else write.call(console, text);',
    '}',
    '',
    '/**',
    " * The Open File Picker node's dialog (EXP-011 §45; openfilepicker.ts) as one promise: an",
    ' * <input type=file> is created, given the accept / capture settings, clicked, and answers',
    ' * exactly once — the chosen File on `change` (Done); undefined on `change` with nothing',
    ' * chosen or on `cancel` (the node\'s Unchanged); a rejection where click() itself threw,',
    ' * which a sandboxed frame without allow-modals does (Failure), with the node\'s own sentence.',
    ' *',
    ' * The input is attached, hidden, for the length of the dialog and removed as it settles, so',
    ' * every browser fires its events against a live element and nothing is left in the page.',
    ' */',
    'export function pickFile(options: { accept?: unknown; capture?: unknown } = {}): Promise<File | undefined> {',
    '  return new Promise((resolve, reject) => {',
    "    const input = document.createElement('input');",
    "    input.type = 'file';",
    '    if (options.accept !== undefined && options.accept !== null && options.accept !== \'\') input.accept = String(options.accept);',
    '    if (options.capture !== undefined && options.capture !== null && options.capture !== \'\') input.capture = String(options.capture);',
    "    input.style.display = 'none';",
    '    const settle = (file: File | undefined) => {',
    '      input.onchange = null;',
    '      input.oncancel = null;',
    '      input.remove();',
    '      resolve(file);',
    '    };',
    '    input.onchange = () => settle(input.files && input.files.length > 0 ? input.files[0] : undefined);',
    '    input.oncancel = () => settle(undefined);',
    '    document.body.appendChild(input);',
    '    try {',
    '      input.click();',
    '    } catch (e) {',
    '      input.onchange = null;',
    '      input.oncancel = null;',
    '      input.remove();',
    "      reject(new Error('Could not open the file picker: ' + (e instanceof Error && e.message ? e.message : String(e))));",
    '    }',
    '  });',
    '}',
    ''
  ].join('\n');
}
