/**
 * §1 of `NOTES-UNOWNED-NODE-WORK.md`, stage 3 — the sanitiser the Shape node's `svgSource` and the
 * Icon node now share.
 *
 * 🔴 **Three of these cases are constructs the icon sanitiser never covered**, named in §1 as the
 * reason this could not simply be imported across the Icon boundary: `<style>` blocks, CSS
 * `url()`, and SMIL `<animate>`/`<set>` — the last of which can rewrite an attribute *after* the
 * `href` rule has passed over it, making every link rule moot while it survives.
 *
 * ⚠️ **Every removal assertion is paired with a control on the RAW input.** `expect(out).not.
 * toContain('alert')` passes just as happily when the fixture never contained `alert` in the first
 * place — a typo in a case would convert this file into a suite that proves nothing while staying
 * green. The control is what makes the absence mean something.
 */
import { SANITIZER_CASES, sanitizeInlineSvg } from '../src/sanitize-inline-svg';

describe('NAT-SHAPE-004 §1 — every declared case is removed, and was really there', () => {
  it('🔴 declares a case for each of the three constructs §1 named as uncovered', () => {
    // A guard on the population itself: if someone deletes a case, the loop below goes quiet
    // rather than red, so the count and the names are asserted separately.
    const names = SANITIZER_CASES.map((c) => c.name).join(' | ');
    expect(names).toContain('style block');
    expect(names).toContain('url()');
    expect(names).toContain('SMIL');
    expect(SANITIZER_CASES.length).toBeGreaterThanOrEqual(14);
  });

  for (const { name, svg, mustNotContain } of SANITIZER_CASES) {
    it(`removes: ${name}`, () => {
      // The control. Without it this whole file can pass on fixtures that never had the payload.
      expect(svg).toContain(mustNotContain);
      expect(sanitizeInlineSvg(svg)).not.toContain(mustNotContain);
    });
  }
});

describe('NAT-SHAPE-004 §2 — it leaves legitimate artwork alone', () => {
  it('keeps drawing instructions', () => {
    const svg = '<svg viewBox="0 0 24 24"><path d="M 0 0 L 24 24" fill="red"/></svg>';
    expect(sanitizeInlineSvg(svg)).toBe(svg);
  });

  it('🔴 keeps a same-document href — the reference an inline source legitimately needs', () => {
    const svg = '<svg><defs><g id="glyph"><circle r="5"/></g></defs><use href="#glyph"/></svg>';
    expect(sanitizeInlineSvg(svg)).toContain('href="#glyph"');
  });

  it('🔴 keeps `url(#…)`, which is how a shape points at its own gradient', () => {
    const svg =
      '<svg><defs><linearGradient id="g"><stop offset="0"/></linearGradient></defs>' +
      '<rect fill="url(#g)" width="10" height="10"/></svg>';
    expect(sanitizeInlineSvg(svg)).toContain('url(#g)');
  });

  it('keeps a quoted same-document url reference too', () => {
    expect(sanitizeInlineSvg('<svg><rect fill="url(\'#g\')"/></svg>')).toContain("url('#g')");
  });

  it('replaces a remote url() with `none` rather than deleting the attribute', () => {
    // `none` is a valid paint value, so the shape still renders. Deleting the attribute would
    // fall back to the SVG default of black, which is a different wrong answer.
    expect(sanitizeInlineSvg('<svg><rect fill="url(https://evil.test/x)"/></svg>')).toContain('fill="none"');
  });

  it('returns an empty string for anything that is not a string', () => {
    // A port can deliver `undefined` — the Empty-Value Contract. Rendering "undefined" as markup
    // is the failure this prevents.
    for (const value of [undefined, null, 42, {}, []]) {
      expect(sanitizeInlineSvg(value as never)).toBe('');
    }
  });
});

describe('NAT-SHAPE-004 §3 — the SMIL rule is about ordering, not about tags', () => {
  it('🔴 removes the element that would have rewritten a sanitised href', () => {
    // The attack the rule exists for, stated end to end: the `href` is already safe, and the
    // `<set>` puts it back. Removing only one of the two leaves the other sufficient.
    const svg = '<svg><a href="#ok"><set attributeName="href" to="javascript:alert(1)" begin="0s"/></a></svg>';
    const out = sanitizeInlineSvg(svg);
    expect(out).not.toContain('<set');
    expect(out).not.toContain('javascript:');
    // ...and the legitimate half survives, so the rule is not just deleting the subtree.
    expect(out).toContain('href="#ok"');
  });

  it('removes animateTransform without being fooled by the `animate` prefix', () => {
    const out = sanitizeInlineSvg('<svg><animateTransform attributeName="transform" type="scale"/><circle r="5"/></svg>');
    expect(out).not.toContain('animateTransform');
    expect(out).toContain('<circle r="5"/>');
  });
});
