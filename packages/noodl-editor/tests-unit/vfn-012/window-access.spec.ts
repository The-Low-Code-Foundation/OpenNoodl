/**
 * VFN-012 §3 — the `window` path grammar.
 *
 * No Blockly in this file: the block is one `FieldTextInput` and a four-line generator, and
 * everything that can be *wrong* about it is in the parse. Grading it here is what makes the
 * half-typed cases reachable at all — a text field is read on every keystroke, so `a.` and `a..b`
 * are not malformed input, they are what the field looks like on the way to `a.b`.
 *
 * ## The control this suite is built around
 *
 * Every assertion below is a claim that a *specific string comes out*, never that something is
 * absent. That is deliberate: "generates nothing dangerous" is unfalsifiable, and the one place
 * an absence would have been the natural spelling — the leading-`window` drop — is asserted as an
 * equality against the expression that would result *if it were not dropped*, which is a string
 * this suite can print. `window["window"]["location"]` happens to evaluate correctly, because
 * `window.window === window`, so a test that only checked "the value is right" would pass on the
 * broken parse forever.
 */
import {
  parseWindowPath,
  windowPathDisplay,
  windowPathExpression,
  windowTooltip,
  DEFAULT_WINDOW_PATH,
  WINDOW_BLOCK_TYPE,
  WINDOW_CLOUD_WARNING
} from '../../src/editor/src/views/BlocklyEditor/windowAccess';

describe('VFN-012 §3 — parsing a window path', () => {
  it('splits dotted names', () => {
    expect(parseWindowPath('location.href')).toEqual([
      { kind: 'name', name: 'location' },
      { kind: 'name', name: 'href' }
    ]);
  });

  it('reads a bare integer in brackets as an index, not a name', () => {
    expect(parseWindowPath('history[0]')).toEqual([
      { kind: 'name', name: 'history' },
      { kind: 'index', index: 0 }
    ]);
  });

  it('keeps a quoted number a name — it was typed as a string', () => {
    expect(parseWindowPath('thing["0"]')).toEqual([
      { kind: 'name', name: 'thing' },
      { kind: 'name', name: '0' }
    ]);
  });

  it('accepts single quotes and spaces inside a bracket key', () => {
    expect(parseWindowPath("a['b c']")).toEqual([
      { kind: 'name', name: 'a' },
      { kind: 'name', name: 'b c' }
    ]);
  });

  it('mixes the three notations in one path', () => {
    expect(windowPathExpression('a.b[0]["c d"].e')).toBe('window["a"]["b"][0]["c d"]["e"]');
  });

  it('drops the empty segments a half-typed field is full of', () => {
    expect(windowPathExpression('a.')).toBe('window["a"]');
    expect(windowPathExpression('a..b')).toBe('window["a"]["b"]');
    expect(windowPathExpression('  a . b  ')).toBe('window["a"]["b"]');
  });

  it('answers empty for a path that is not a string', () => {
    expect(parseWindowPath(undefined as unknown as string)).toEqual([]);
    expect(parseWindowPath(null as unknown as string)).toEqual([]);
    expect(parseWindowPath(42 as unknown as string)).toEqual([]);
  });
});

describe('VFN-012 §3 — 🔴 a pasted `window.` prefix', () => {
  /**
   * The block reads `🌐 window.` followed by the field, so the field wants `location.href`. An
   * author will nonetheless paste the whole thing, and the naive parse produces
   * `window["window"]["location"]["href"]`, which **works** — `window.window` is `window`.
   *
   * That is the trap. A test that read the resulting value would pass, and the parse would stay
   * broken until the first path whose head is not self-referential. So this is asserted as a
   * string, against the exact string the broken parse would have produced.
   */
  it('strips one leading `window`, and the equality is against what the bug would emit', () => {
    expect(windowPathExpression('window.location.href')).toBe('window["location"]["href"]');
    expect(windowPathExpression('window.location.href')).not.toBe('window["window"]["location"]["href"]');
  });

  it('strips only the first, so `window.window` stays reachable', () => {
    expect(windowPathExpression('window.window.name')).toBe('window["window"]["name"]');
  });

  it('leaves a `window` that is not at the head alone', () => {
    expect(windowPathExpression('frames.window')).toBe('window["frames"]["window"]');
  });

  it('a bracketed leading window is stripped too — same paste, different spelling', () => {
    expect(windowPathExpression('["window"].name')).toBe('window["name"]');
  });
});

describe('VFN-012 §3 — the generated expression', () => {
  it('generates a bare `window` for an empty path, which is a legal value', () => {
    expect(windowPathExpression('')).toBe('window');
    expect(windowPathExpression('   ')).toBe('window');
  });

  it('generates bracket notation throughout', () => {
    expect(windowPathExpression('navigator.userAgent')).toBe('window["navigator"]["userAgent"]');
  });

  it('🔴 cannot be escaped out of by what is typed in the field', () => {
    // `JSON.stringify`, not a template literal: a field holding a quote produces a string
    // literal, never a second expression.
    expect(windowPathExpression('a"b')).toBe('window["a\\"b"]');
    expect(windowPathExpression('a\\b')).toBe('window["a\\\\b"]');

    /**
     * The shape assertion, over inputs chosen to break out of the expression. A hand-written
     * expected string would only cover the one attack somebody thought of; this says what is
     * true of *every* output: `window`, then bracketed string literals and integer indices, and
     * nothing else — no operator, no call, no second statement, ever.
     */
    const ONLY_MEMBER_ACCESS = /^window(\[(?:"(?:[^"\\]|\\.)*"|\d+)\])*$/;
    const nasty = [
      'a"]; alert(1); x["b',
      "a']; alert(1); x['b",
      'a[1]; drop()',
      '${process.exit(1)}',
      'a\n.b',
      '`x`',
      'a b'
    ];

    for (const input of nasty) {
      const generated = windowPathExpression(input);
      expect(generated).toMatch(ONLY_MEMBER_ACCESS);
      // And it is a single expression a JS parser accepts — not merely regex-shaped.
      expect(() => new Function('window', `return ${generated};`)).not.toThrow();
    }
  });

  it('the default the block ships with generates something real', () => {
    expect(DEFAULT_WINDOW_PATH).toBe('location.href');
    expect(windowPathExpression(DEFAULT_WINDOW_PATH)).toBe('window["location"]["href"]');
  });
});

describe('VFN-012 §3 — reading the path back', () => {
  it('canonicalises what was typed', () => {
    expect(windowPathDisplay('window.a . b [ 0 ]')).toBe('a.b[0]');
    expect(windowPathDisplay('')).toBe('');
  });
});

describe('VFN-012 §3 — 🔴 the sentence about cloud functions', () => {
  /**
   * The Logic Builder is registered unconditionally in `noodl-runtime.ts` — it is not in the
   * `type !== 'cloud'` subtraction — and `noodl-viewer-cloud/src/sandbox.isolate.js` has no
   * `window`. The block still generates `window…` there, and throws. The only defence a builder
   * gets is being told, so being told is graded.
   */
  it('is in the tooltip whether or not a path has been typed', () => {
    expect(windowTooltip('')).toContain(WINDOW_CLOUD_WARNING);
    expect(windowTooltip('location.href')).toContain(WINDOW_CLOUD_WARNING);
  });

  it('names `window` and says it throws, so the reader can act on it', () => {
    expect(WINDOW_CLOUD_WARNING).toContain('window');
    expect(WINDOW_CLOUD_WARNING).toContain('cloud function');
    expect(WINDOW_CLOUD_WARNING).toContain('throw');
  });

  it('the tooltip on an empty path teaches the field rather than restating the block', () => {
    expect(windowTooltip('')).toContain(DEFAULT_WINDOW_PATH);
    expect(windowTooltip('navigator.language')).toContain('window["navigator"]["language"]');
  });
});

describe('VFN-012 §3 — the block type id', () => {
  it('is the id every saved project will hold, so it is pinned', () => {
    expect(WINDOW_BLOCK_TYPE).toBe('noodl_window');
  });
});
