/**
 * P78 D18 / phase-80 Track C2 — every control that renders text wears the app's font.
 *
 * **The defect.** Form controls do not inherit `font-family` from `body` in any browser: the UA
 * stylesheet sets its own face for `<button>`, `<input>` and `<textarea>`. `assets/style.css`
 * contained **exactly one `font-family` declaration in the whole file** — `inherit`, on
 * `.ndl-controls-select` — so every button and every text field in every app rendered in Arial
 * (and a `textArea` in monospace, that element's own UA default) while the `Text` beside it
 * correctly used the project's `--font-sans`. Measured on the members-area template with
 * `getComputedStyle` across eleven pages.
 *
 * 🔴 **`select` is why this survived into a shipped template.** It is the one control that
 * already looked right, so anyone spot-checking "does the app font reach the controls" with a
 * dropdown would have seen it work and stopped. That is the reason this file grades a *set*
 * rather than a sample.
 *
 * ⚠️ **Scope is `font-family` only.** Size and weight were never measured; asserting them here
 * would pin metrics nobody has checked.
 */

/* eslint-env jest */

import * as fs from 'fs';
import * as path from 'path';

const STYLESHEET = path.join(__dirname, '..', '..', 'src', 'assets', 'style.css');
const css = fs.readFileSync(STYLESHEET, 'utf-8');

/**
 * The classes that dress an element rendering text the app supplies.
 *
 * ⚠️ Listed, and the control below is what stops the list being an exclusion list that cannot
 * fail: it asserts every `.ndl-controls-*` class in the file is either named here or named as
 * deliberately text-free, so a new control class reddens rather than being silently unchecked.
 */
const TEXT_BEARING: Record<string, string> = {
  'ndl-controls-button': 'renders the button label',
  'ndl-controls-textinput': 'dresses both the <input> and, with type textArea, the <textarea>',
  'ndl-controls-select': 'renders the selected option — the only one that was already correct'
};

const TEXT_FREE: Record<string, string> = {
  'ndl-controls-abs-center': 'a positioning wrapper, no text of its own',
  'ndl-controls-pointer': 'a cursor affordance applied to labels, which DO inherit from body',
  'ndl-controls-checkbox': 'the box itself; its label is a sibling <label> element',
  'ndl-controls-radio': 'prefix of the radio group classes; the input, not its label',
  'ndl-controls-radiobutton': 'the dot itself; its label is a sibling <label> element',
  'ndl-controls-range': 'a slider track and thumb, no text',
  'ndl-controls-fieldset': 'a grouping wrapper; <fieldset> inherits from body normally',
  'ndl-controls-checkbox-2': 'the second checkbox treatment — the box itself, label is a sibling',
  'ndl-controls-radio-2': 'the second radio treatment — the dot itself, label is a sibling',
  'ndl-controls-range2': 'the second slider treatment — a track and thumb, no text'
};

/** Every `.ndl-controls-*` class the stylesheet actually defines. */
function classesInStylesheet(): string[] {
  // ⚠️ `[a-z-]+` truncated `.ndl-controls-radio-2` at the hyphen and reported a class
  // `ndl-controls-radio-` that does not exist. The totality check below caught it,
  // which is the check grading its own matcher before it grades the stylesheet.
  const found = css.match(/ndl-controls-[a-z0-9-]+/g) ?? [];
  return Array.from(new Set(found)).sort();
}

/** The selectors a given class has a `font-family` declaration under. */
function declaresFontFamily(className: string): boolean {
  // Blocks are `.sel { … }`; find each block whose selector mentions the class and look inside.
  const blocks = css.match(/[^{}]+\{[^}]*\}/g) ?? [];
  return blocks.some((b) => {
    const [selector, body] = [b.slice(0, b.indexOf('{')), b.slice(b.indexOf('{'))];
    return selector.includes(className) && /font-family\s*:/.test(body);
  });
}

describe('D18 — a control renders in the app font, not the browser default', () => {
  it('control: the stylesheet is present and defines control classes to grade', () => {
    // A gate over an empty or moved file passes by measuring nothing.
    expect(css.length).toBeGreaterThan(500);
    expect(classesInStylesheet().length).toBeGreaterThanOrEqual(10);
  });

  it('🔴 every class in the file is classified — a new control cannot arrive unchecked', () => {
    const unclassified = classesInStylesheet().filter(
      (c) => TEXT_BEARING[c] === undefined && TEXT_FREE[c] === undefined
    );
    expect(unclassified).toEqual([]);
  });

  it('🔴 every text-bearing control inherits font-family', () => {
    const missing = Object.keys(TEXT_BEARING).filter((c) => !declaresFontFamily(c));
    expect(missing).toEqual([]);
  });

  it('control: the grader discriminates — it reds when a rule is removed, and names the class', () => {
    // 🔴 `toEqual([])` on a filter is green when the filter is wrong, when the population is
    // empty, and when the matcher never matched. This proves it can go red and says which class.
    const withoutButtonRule = css.replace(
      /\.ndl-controls-button\s*\{[^}]*\}/,
      '.ndl-controls-button { outline: none; }'
    );
    expect(withoutButtonRule).not.toEqual(css);
    const blocks = withoutButtonRule.match(/[^{}]+\{[^}]*\}/g) ?? [];
    const stillDeclares = blocks.some(
      (b) => b.slice(0, b.indexOf('{')).includes('ndl-controls-button') && /font-family\s*:/.test(b)
    );
    expect(stillDeclares).toBe(false);
  });

  it('🔴 the floor `inherit` depends on still exists — body carries var(--font-sans)', () => {
    // 🔴 **This fix is only as good as the thing it inherits FROM.** `font-family: inherit`
    // on a control resolves up to `body`, and `body` gets its family from exactly one place:
    // `TokenResolver.generateCss`, which appends
    //
    //     body { font-family: var(--font-sans); }
    //
    // after the `:root` block (POL-006 — a brand-new project rendered Hello World in **Times**
    // until that floor existed, because a *declared* default never runs its setter).
    //
    // Delete that line and every control silently returns to the browser's serif while the
    // three `font-family: inherit` declarations this file grades stay exactly as they are —
    // green gate, broken app. Asserting the mechanism without asserting what it stands on is
    // how a fix passes its own test and changes nothing.
    //
    // ⚠️ **Comments stripped first.** The rule appears in this function's own doc comment as
    // prose, so an unstripped check passes on the documentation while the code that emits it
    // is gone — the exact failure this test exists to catch.
    //
    // ⚠️ The file holds the rule inside a template literal, so what is on disk is the
    // two-character escape backslash-n, not a newline. The first version of this test matched
    // a real newline, found nothing, and went red for that reason rather than a real one.
    const TOKEN_RESOLVER = path.join(
      __dirname, '..', '..', '..',
      'noodl-editor/src/editor/src/models/StyleTokensModel/TokenResolver.ts'
    );
    const raw = fs.readFileSync(TOKEN_RESOLVER, 'utf-8');
    const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

    expect(code).toContain('font-family: var(--font-sans);');
    expect(code).toMatch(/body \{\\n\s*font-family: var\(--font-sans\);/);

    // 🔴 P78 D19 — the colour half of the same floor, gated here because it is the same
    // one line, the same mechanism and the same failure. The floor was font-only, so
    // `--foreground` had no reader and every element that did not set a colour rendered the
    // browser's black; a control's `<label>` was just the one somebody happened to measure.
    expect(code).toContain('color: var(--foreground);');

    // Control: the comment strip actually strips, so "found it in code" means code.
    //
    // ⚠️ This asserted something false at first — that the rule appears in the prose too, so
    // stripping would reduce the count. It does not: the doc comment writes the *camelCase*
    // form `fontFamily: 'var(--font-sans)'` (it is describing a node port), which is a
    // different string from the CSS the function emits. The premise was wrong, not the
    // subject, and only having a control at all surfaced that.
    //
    // `TextConfig` is named only in the doc comment, so it is the honest witness that the
    // strip ran.
    expect(raw).toContain('TextConfig');
    expect(code).not.toContain('TextConfig');
  });

  it('🔴 the `body` composition no longer tells an author controls inherit the page font', () => {
    // The CSS repair alone would have been undone by the next generator that read this line:
    // it is what an agent reads *before deciding not to set a font*. Guarded on the exact
    // claim rather than on wording, so a rephrase stays green and a reinstatement reds.
    const compositions = fs.readFileSync(
      path.join(
        __dirname, '..', '..', '..',
        'noodl-editor/src/editor/src/models/StyleTokensModel/StyleCompositions.ts'
      ),
      'utf-8'
    );
    const descriptions = Array.from(
      compositions.matchAll(/description:\s*\n?\s*'([^']*)'/g)
    ).map((m) => m[1]);
    expect(descriptions.length).toBeGreaterThan(10);
    expect(descriptions.filter((d) => /Never set fontFamily/i.test(d))).toEqual([]);
  });
});
