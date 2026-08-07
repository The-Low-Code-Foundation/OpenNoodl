/**
 * NDA-007 — the icon source model, made real in the renderer.
 *
 * `Noodl.Icon` was a `{ class, code, codeAsClass }` triple splatted into a `<span>`, which
 * assumes icon-font semantics and can represent no other kind of icon set. That is the whole
 * of "very tricky to add custom icon sets and actually see them": a set had to be a font,
 * with a stylesheet, in two different documents.
 *
 * The union is specced in `dev-docs/reference/ICON-SOURCE-MODEL.md` (§1). These rows pin the
 * renderer half — success criteria 2 and 3. **§2 (one registration path) and §3 (the editor
 * picker) are not done**, so an author cannot yet *install* a sprite set; what these rows
 * prove is that when one arrives, it renders, sizes and colours like a font glyph does.
 */

/* eslint-env jest */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { IconGlyph, sanitizeInlineIconSvg } from '../../src/components/visual/Icon/IconGlyph';

type AnyProps = Record<string, unknown>;

function render(source: unknown, style: React.CSSProperties = {}, className?: string): string {
  return renderToStaticMarkup(
    React.createElement(IconGlyph as unknown as React.FC<AnyProps>, { source, style, className })
  );
}

const SIZED: React.CSSProperties = { fontSize: '24px', color: 'rgb(255, 0, 0)' };

describe('NDA-007: font sources render exactly as they did', () => {
  // Criterion 2. The font branch is what the entire shipped library uses, so the union is
  // only worth having if this output does not move by a byte.
  test('I1: a codepoint set renders the class on the span and the code as its text', () => {
    expect(render({ class: 'material-icons', code: 'check' }, SIZED)).toBe(
      '<span class="material-icons" style="font-size:24px;color:rgb(255, 0, 0)">check</span>'
    );
  });

  test('I2: a class-per-glyph set joins the two classes and renders no text', () => {
    expect(render({ class: 'fa', code: 'fa-check', codeAsClass: true }, SIZED)).toBe(
      '<span class="fa fa-check" style="font-size:24px;color:rgb(255, 0, 0)"></span>'
    );
  });

  test('I3: an explicit kind:font is the same as omitting it', () => {
    expect(render({ kind: 'font', class: 'material-icons', code: 'check' }, SIZED)).toBe(
      render({ class: 'material-icons', code: 'check' }, SIZED)
    );
  });

  // RadioButton centres its glyph with a class of its own, and it must still come first.
  test('I4: a caller class is prepended to the glyph’s own classes', () => {
    expect(render({ class: 'fa', code: 'fa-check', codeAsClass: true }, {}, 'ndl-controls-abs-center')).toContain(
      'class="ndl-controls-abs-center fa fa-check"'
    );
  });
});

describe('NDA-007: sprite and inline sources', () => {
  test('I5: a sprite renders a <use> at the referenced symbol', () => {
    const markup = render({ kind: 'sprite', url: '/assets/icons.svg', symbolId: 'check' }, SIZED);

    expect(markup).toContain('<use href="/assets/icons.svg#check">');
  });

  // Criterion 3, and the requirement that makes the union coherent rather than three nodes in
  // a trenchcoat: `iconSize` and `iconColor` are `fontSize`/`color` on the wrapper, and the
  // SVG inherits both by sizing at 1em and filling with currentColor. A caller therefore
  // needs no per-kind branch — which is what let all six call sites collapse into one.
  test('I6: iconSize and iconColor reach an SVG the same way they reach a font glyph', () => {
    const markup = render({ kind: 'sprite', url: '/assets/icons.svg', symbolId: 'check' }, SIZED);

    expect(markup).toContain('font-size:24px');
    expect(markup).toContain('color:rgb(255, 0, 0)');
    expect(markup).toContain('width:1em');
    expect(markup).toContain('height:1em');
    expect(markup).toContain('fill:currentColor');
  });

  test('I7: an inline source renders its markup', () => {
    const markup = render({ kind: 'inline', svg: '<svg viewBox="0 0 24 24"><path d="M1 1"/></svg>' }, SIZED);

    expect(markup).toContain('<path d="M1 1"/>');
    expect(markup).toContain('viewBox="0 0 24 24"');
  });

  test('I8: an undefined source renders nothing rather than throwing', () => {
    expect(render(undefined)).toBe('');
  });
});

describe('NDA-007: inline sources are sanitised', () => {
  // The project author is not who this defends against — they can already write a Function
  // node. Icon sets *travel*, through the library import pipeline and project templates, so
  // the set is the trust boundary, not the author.
  test('I9: script elements do not survive', () => {
    expect(sanitizeInlineIconSvg('<svg><script>alert(1)</script><path/></svg>')).toBe('<svg><path/></svg>');
  });

  test('I10: event handler attributes do not survive', () => {
    expect(sanitizeInlineIconSvg('<svg onload="alert(1)"><path onclick=\'x()\'/></svg>')).toBe('<svg><path/></svg>');
  });

  test('I11: only same-document fragment references survive', () => {
    // `<use href="#id">` is the one reference an inline set legitimately needs. Dropping
    // everything else takes `javascript:` and remote URLs together, rather than blocklisting
    // schemes one at a time and being wrong about the next one.
    expect(sanitizeInlineIconSvg('<svg><use href="#glyph"/></svg>')).toContain('href="#glyph"');
    expect(sanitizeInlineIconSvg('<svg><a href="javascript:alert(1)"/></svg>')).not.toContain('javascript:');
    expect(sanitizeInlineIconSvg('<svg><image xlink:href="http://evil/x.svg"/></svg>')).not.toContain('evil');
  });

  test('I12: foreignObject does not survive', () => {
    expect(sanitizeInlineIconSvg('<svg><foreignObject><iframe/></foreignObject></svg>')).toBe('<svg></svg>');
  });

  // A set that ships `width="24"` is the common case, not the exception — and a fixed
  // attribute beats the 1em sizing, so the glyph would silently ignore `iconSize`.
  test('I13: fixed dimensions on the root are removed so iconSize wins', () => {
    const cleaned = sanitizeInlineIconSvg('<svg width="24" height="24" viewBox="0 0 24 24"><path/></svg>');

    expect(cleaned).not.toContain('width="24"');
    expect(cleaned).not.toContain('height="24"');
    expect(cleaned).toContain('viewBox="0 0 24 24"');
  });

  test('I14 (control): legitimate drawing content is untouched', () => {
    const svg = '<svg viewBox="0 0 24 24"><defs><linearGradient id="g"/></defs><path d="M1 1" fill="url(#g)"/></svg>';

    expect(sanitizeInlineIconSvg(svg)).toBe(svg);
  });

  // I9–I14 exercise the helper, which proves the helper. This one proves the **renderer
  // calls it** — without it, every row above stays green with the call deleted, which is a
  // suite that tests a sanitiser nothing is wired to.
  test('I15: the renderer sanitises, it does not merely have a sanitiser', () => {
    const markup = render({ kind: 'inline', svg: '<svg onload="alert(1)"><script>alert(2)</script></svg>' }, SIZED);

    expect(markup).not.toContain('onload');
    expect(markup).not.toContain('alert');
  });
});
