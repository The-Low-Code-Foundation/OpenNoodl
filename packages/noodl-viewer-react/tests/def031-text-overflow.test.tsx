/**
 * DEF-031 — a `Text` could not be ellipsized, because the runtime shipped no `text-overflow`
 * port. Registered from phase 77 D22, where D20 had offered shrink-and-ellipsize, wrap, or
 * accept, and wrap shipped — not because it was preferred, but because ellipsize was not
 * authorable at all.
 *
 * ## Why the port alone would have been dead on arrival
 *
 * `text-overflow` does something only on a single line that is allowed to overflow its box,
 * and `Text` decided both of those for the author. Measured before the fix, on the real
 * component: a style carrying `text-overflow: ellipsis` reached the DOM intact and was inert,
 * because the render appended `white-space: pre-wrap` and `overflow-wrap: anywhere` after it —
 * the text wrapped, so no line was ever too long to fit and the ellipsis had nothing to do.
 *
 * That is the reason the rows below assert `white-space` and not just `text-overflow`. A spec
 * that only checked the declared port would have passed against the broken build: the property
 * was never the thing that was missing, the single line was.
 *
 * 🔴 The `wrap` row is the control that catches the opposite failure — a default that reaches
 * the DOM as invalid CSS, or one that silently truncates every existing `Text` in every
 * project. `wrap` is deliberately not a CSS value, so if it ever appears in the style attribute
 * that row goes red.
 *
 * ⚠️ Content-sized text is excluded by construction rather than by choice: the box grows to fit
 * its content, so nothing overflows and no `text-overflow` value can show. The port says so in
 * its own description; this file records that it is a property of the size mode.
 */

/* eslint-env jest */

// The node module reads `Noodl.deployed` at import time to decide whether to build tooltips;
// a `beforeAll` runs too late and the suite fails to run at all. Same placement as CN-006's.
(globalThis as Record<string, any>).Noodl = { deployed: false, baseUrl: '/' };

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { Text } from '../src/components/visual/Text/Text';
import TextNode from '../src/nodes/visual/text';

/** `Text` resolves its colour through the node context — the fixture DEF-027's rows use. */
const nodeContext = { frameNumber: 0, styles: { resolveColor: (c: unknown) => c } };

function styleAttr(html: string): string {
  const match = html.match(/style="([^"]*)"/);
  return match ? match[1] : '';
}

/** The real component, rendered the way the viewer renders it; only the node data is a fixture. */
function render(sizeMode: string, style: Record<string, unknown>): string {
  return styleAttr(
    renderToStaticMarkup(
      React.createElement(Text as unknown as React.FC<Record<string, unknown>>, {
        text: 'a label far too long for the box it was given',
        sizeMode,
        style,
        noodlNode: { context: nodeContext, props: {} }
      })
    )
  );
}

describe('DEF-031 — a fixed-width Text can be ellipsized', () => {
  it('FINDING — ellipsis puts the text on one line that is allowed to overflow', () => {
    const css = render('explicit', { textOverflow: 'ellipsis' });

    expect(css).toContain('text-overflow:ellipsis');
    // The half the port could not supply for itself, and the half that makes it work.
    expect(css).toContain('white-space:nowrap');
    expect(css).toContain('overflow:hidden');
    // The wrapping the old render forced unconditionally, which made the property inert.
    expect(css).not.toContain('pre-wrap');
    expect(css).not.toContain('overflow-wrap:anywhere');
  });

  it('clip truncates on one line too, without the marker', () => {
    const css = render('explicit', { textOverflow: 'clip' });

    expect(css).toContain('text-overflow:clip');
    expect(css).toContain('white-space:nowrap');
    expect(css).not.toContain('pre-wrap');
  });

  it("control — the default wraps exactly as it always did, and 'wrap' never reaches the DOM", () => {
    const css = render('explicit', { textOverflow: 'wrap' });

    expect(css).not.toContain('text-overflow');
    expect(css).toContain('white-space:pre-wrap');
    expect(css).toContain('overflow-wrap:anywhere');
    expect(css).not.toContain('nowrap');
  });

  it('control — a Text with no textOverflow at all is byte-for-byte what it was', () => {
    expect(render('explicit', {})).toBe(
      'flex-shrink:0;left:0;top:0;white-space:pre-wrap;overflow-wrap:anywhere'
    );
    expect(render('contentSize', {})).toBe('flex-shrink:0;left:0;top:0;white-space:pre');
  });

  it("control — an author's own overflow is not overwritten by the fix", () => {
    const css = render('explicit', { textOverflow: 'ellipsis', overflow: 'visible' });

    expect(css).toContain('overflow:visible');
    expect(css).not.toContain('overflow:hidden');
  });
});

describe('DEF-031 — the port exists and the panel agrees with the node', () => {
  // The compiled node, which is the surface the editor's property panel reads — `inputCss` is a
  // declaration that `createNodeFromReactComponent` folds into `node.inputs`, so asserting on the
  // source object would grade something no user ever meets.
  const def = TextNode as unknown as { node: { inputs: Record<string, Record<string, unknown>> } };

  it('the port is declared where wordBreak is, in the Text group', () => {
    const port = def.node.inputs.textOverflow;

    expect(port).toBeDefined();
    expect(port.group).toBe('Text');
    expect((port.type as { enums: { value: string }[] }).enums.map((e) => e.value)).toEqual([
      'wrap',
      'clip',
      'ellipsis'
    ]);
  });

  /**
   * 🔴 DEF-033 is a port whose declared default is not what the node does. This row is here so
   * that this port cannot become a second one: the panel's default reads `wrap`, and the row
   * above proves `wrap` wraps.
   */
  it("the declared default is the behaviour the node actually has", () => {
    const port = def.node.inputs.textOverflow;

    expect(port.default).toBe('wrap');
    // `applyDefault: false` is what keeps the default out of the emitted CSS.
    expect(port.applyDefault).toBe(false);
  });
});
