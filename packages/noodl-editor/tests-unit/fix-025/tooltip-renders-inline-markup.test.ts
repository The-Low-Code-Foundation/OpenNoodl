import * as fs from 'fs';
import * as path from 'path';

/**
 * FIX-025 §12 — the tooltip that put one word on each line.
 *
 * ## What the drive found (2026-08-25)
 *
 * The new `con-type-unconverted` warning reaches the builder three ways: the wire goes
 * dashed, the Warnings panel lists it, and hovering the wire shows it as a tooltip. The
 * first two were right. The third rendered
 *
 *     This connects a
 *     string
 *     to a
 *     number
 *     port, and the text arrives as text — …
 *
 * because `.popup-layer-tooltip-content` was `display: flex; flex-direction: column`.
 *
 * 🔴 **A flex container has no inline formatting context.** Every child — each `<strong>`
 * *and each bare run of text between them* — is blockified into its own flex item, so it
 * takes its own line. Nothing was wrong with the message; the box it was poured into could
 * not hold a sentence.
 *
 * ⚠️ **This was never specific to the new warning.** `con-type-mismatch` has always been
 * built the same way (`NodeGraphModel.getConnectionHealth`, `'…type <strong>' + name +
 * '</strong> cannot be connected…'`), so every type warning has hovered like this. The new
 * sentence is simply long enough that it is impossible to miss.
 *
 * ## Why this grades the stylesheet rather than a render
 *
 * The property is a CSS fact and there is no DOM in this runner (`testEnvironment: 'node'`),
 * while the jasmine renderer suite — which does have one — **does not load the editor
 * stylesheet** (see `tests/canvas/CanvasThemeNodeSchemes.test.ts`'s header). So neither
 * runner can render the real rule. What can be checked without a browser is the thing that
 * actually caused it: the container's `display` must keep an inline formatting context.
 *
 * ✅ The parser is exercised against a known-flex fixture below, so "no violation found"
 * cannot silently mean "the rule was never located".
 */

const CSS_PATH = path.join(__dirname, '..', '..', 'src', 'editor', 'src', 'styles', 'popuplayer.css');

/** `display` values that blockify their children, destroying inline flow. */
const BLOCKIFYING = ['flex', 'inline-flex', 'grid', 'inline-grid'];

/**
 * The `display` declared for one selector, comments stripped first so a rule quoted inside a
 * comment cannot be read as the rule itself.
 */
export function displayForSelector(css: string, selector: string): string | null {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
  // The selector, then its own block — `[^{}]*` cannot run past the next rule.
  const rule = new RegExp(`(^|[},])\\s*${selector.replace('.', '\\.')}\\s*\\{([^{}]*)\\}`, 'm').exec(stripped);
  if (!rule) return null;

  const decl = /(^|;)\s*display\s*:\s*([^;]+)/m.exec(rule[2]);
  return decl ? decl[2].trim() : null;
}

describe('the tooltip container lets a sentence be a sentence', () => {
  const css = fs.readFileSync(CSS_PATH, 'utf8');

  it('finds the rule at all', () => {
    expect(displayForSelector(css, '.popup-layer-tooltip-content')).not.toBeNull();
  });

  it('does not blockify the inline markup health messages are written in', () => {
    const display = displayForSelector(css, '.popup-layer-tooltip-content');
    expect(BLOCKIFYING).not.toContain(display);
  });

  /**
   * The known-firing control. Without it, a parser that silently stopped matching would make
   * the assertion above pass for the wrong reason — the shape that has cost this repo whole
   * sessions.
   */
  it('would catch the defect if it came back', () => {
    const regressed = css.replace(
      /(\.popup-layer-tooltip-content\s*\{)([^{}]*)\}/m,
      '$1 display: flex; flex-direction: column; }'
    );
    expect(displayForSelector(regressed, '.popup-layer-tooltip-content')).toBe('flex');
    expect(BLOCKIFYING).toContain(displayForSelector(regressed, '.popup-layer-tooltip-content'));
  });

  /**
   * ⚠️ The rules the container was made flex *for* are all block-level markup already, so
   * they stack under `display: block` unchanged. If either of these ever stops being a block
   * element, the reasoning above needs redoing.
   */
  it('leaves the structured tooltip markup stacking as it did', () => {
    expect(displayForSelector(css, '.popup-layer-tooltip-content h3')).toBeNull();
    expect(displayForSelector(css, '.popup-layer-tooltip-content p')).toBeNull();
    expect(displayForSelector(css, '.popup-layer-image-row')).toBe('flex');
  });
});
