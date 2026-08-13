/**
 * VFN-012 §3 — `window`, as one deliberately blunt block.
 *
 * > *"Could we also add handy stuff like 'window' …"*
 *
 * ## What this is, and the much larger thing it is not
 *
 * One value block: `window`, plus a text field holding a property path, generating
 * `window["a"]["b"]`. That is the entire feature, and the task file is explicit about why:
 *
 * > *"Resist the temptation to enumerate browser APIs into a category — the category would be
 * > enormous, permanently incomplete, and would read as an endorsement of whatever happened to
 * > be in it."*
 *
 * There is a second, sharper reason not to enumerate, and this repo has already paid for it:
 * **`Object.keys` is not a survey of an API.** `Object.keys(window)` in a renderer answers with
 * whatever that renderer happens to have (and misses everything on `Window.prototype`), so a
 * category built from it would be a list of *this machine's* globals shipped to every project.
 * A text field makes no claim about what exists; a generated list would make a false one.
 *
 * ## 🔴 `window` does not exist in a cloud function
 *
 * The Logic Builder node is registered unconditionally in `noodl-runtime.ts` — it is **not** in
 * the `type !== 'cloud'` subtraction — so the same visual function can run inside a cloud
 * function, where `packages/noodl-viewer-cloud/src/sandbox.isolate.js` provides no `window` at
 * all. `window.x` there is a `ReferenceError`.
 *
 * That is left loud on purpose. The alternatives are worse: `typeof window !== 'undefined' ? … :
 * undefined` turns a wrong program into a silently-empty one, and `globalThis` would quietly
 * succeed against an object that is not a browser window. A thrown `ReferenceError` naming
 * `window` is the only outcome that tells the author what is actually true. The tooltip and the
 * flyout say so before they run it.
 *
 * ## No Blockly here
 *
 * Same seam as `appConfig.ts`: everything but the field itself is a pure function, so the
 * plain-Node `tests-unit` runner can grade the path grammar directly. `NoodlBlocks.ts` holds the
 * one `FieldTextInput`, `NoodlGenerators.ts` holds the four-line generator.
 *
 * @module BlocklyEditor
 */

/** The one block type §3 adds. A value block; there is deliberately no `set window` block. */
export const WINDOW_BLOCK_TYPE = 'noodl_window';

/**
 * What a freshly dragged block reads.
 *
 * A default that *does* something, and the shortest honest example of the shape: a path with a
 * dot in it, present in every browser, and harmless to evaluate. An empty default would teach
 * the field nothing and generate a bare `window`, which is the one thing nobody drags this block
 * out to get.
 */
export const DEFAULT_WINDOW_PATH = 'location.href';

/** One segment of a resolved path: a property name, or an array index. */
export type WindowPathSegment = { kind: 'name'; name: string } | { kind: 'index'; index: number };

/**
 * Split a typed path into segments.
 *
 * The grammar an author will actually type, which is JavaScript's: `a.b`, `a[0]`, `a["b c"]`,
 * and any mixture. Everything is accepted — this is a *text field*, so it is read while it is
 * half-typed on every keystroke, and a parser that threw on `a.` would throw on the way to `a.b`.
 *
 * Three things it does deliberately:
 *
 * - **A leading `window` is dropped.** An author reading the block as `window.` + path will
 *   nonetheless paste `window.location.href` into it, and `window["window"]["location"]` — which
 *   happens to *work*, because `window.window === window` — would be the worst kind of wrong:
 *   correct output from a misread input, until the day the path starts with something that is
 *   not self-referential.
 * - **Empty segments vanish.** `a..b` and the trailing dot of `a.` are what a field looks like
 *   mid-type, not a request to read the empty-string property.
 * - **A bare integer is an index, not a name.** `list[0]` generates `[0]`, not `["0"]`. They are
 *   the same lookup in JavaScript, but only one of them reads as the thing that was typed.
 */
export function parseWindowPath(path: string): WindowPathSegment[] {
  if (typeof path !== 'string') return [];

  const segments: WindowPathSegment[] = [];
  const pattern = /\[\s*"([^"]*)"\s*\]|\[\s*'([^']*)'\s*\]|\[\s*([^\]]*?)\s*\]|([^.[\]]+)/g;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(path)) !== null) {
    // Groups 1 and 2 are quoted bracket keys — always a name, even when the text inside is
    // digits: `a["0"]` was typed as a string and stays one.
    if (match[1] !== undefined) {
      pushName(segments, match[1]);
      continue;
    }
    if (match[2] !== undefined) {
      pushName(segments, match[2]);
      continue;
    }

    const raw = (match[3] !== undefined ? match[3] : match[4] || '').trim();
    if (raw === '') continue;

    if (/^\d+$/.test(raw)) {
      segments.push({ kind: 'index', index: Number(raw) });
      continue;
    }

    pushName(segments, raw);
  }

  // The leading `window`, dropped — see the note above. Only the *first* one: `window.window`
  // is a path somebody could legitimately mean, and after the first drop it is spelled exactly
  // that way.
  if (segments.length > 0 && segments[0].kind === 'name' && segments[0].name === 'window') {
    segments.shift();
  }

  return segments;
}

function pushName(segments: WindowPathSegment[], raw: string): void {
  const name = raw.trim();
  if (name === '') return;
  segments.push({ kind: 'name', name });
}

/**
 * The generated expression.
 *
 * Bracket notation throughout, and `JSON.stringify` for every name, for `appConfigReadExpression`'s
 * reason: it is identical to dot notation for every path a browser API will ever have, and it does
 * not break out of the expression for the ones it will not. A field holding `"]; drop()` generates
 * a string literal, not a statement.
 *
 * An empty path generates a bare `window`. That is not a placeholder — it is the honest reading of
 * an empty path, it is a legal value, and it is what a `Get property` block downstream would want
 * to be handed.
 */
export function windowPathExpression(path: string): string {
  const segments = parseWindowPath(path);
  if (segments.length === 0) return 'window';

  return (
    'window' +
    segments
      .map((segment) => (segment.kind === 'index' ? `[${segment.index}]` : `[${JSON.stringify(segment.name)}]`))
      .join('')
  );
}

/** How the path reads back to the author once parsed — the canonical spelling of what they typed. */
export function windowPathDisplay(path: string): string {
  const segments = parseWindowPath(path);
  if (segments.length === 0) return '';

  return segments
    .map((segment, index) =>
      segment.kind === 'index' ? `[${segment.index}]` : index === 0 ? segment.name : `.${segment.name}`
    )
    .join('');
}

/**
 * ⚠️ The sentence every `window` block owes the author, and the reason it is a constant.
 *
 * It appears in the tooltip and in the flyout, and a spec asserts both carry it — a warning that
 * exists in one of the two places a builder looks is a warning that has not been given.
 */
export const WINDOW_CLOUD_WARNING =
  'Browser only: a Visual Function inside a cloud function has no window, and this will throw there.';

/** The hover text: what it reads, and what it does not have. */
export function windowTooltip(path: string): string {
  const expression = windowPathExpression(path);

  if (expression === 'window') {
    return `Reads the browser's window object. Type a property path — for example ${DEFAULT_WINDOW_PATH} — to read into it. ${WINDOW_CLOUD_WARNING}`;
  }

  return `Reads ${expression}. ${WINDOW_CLOUD_WARNING}`;
}
