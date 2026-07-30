/**
 * NDA-001 corpus — failure-reporting row F3.
 *
 * **F3's original expectation was wrong, and NDA-006 reconciled it rather than satisfying
 * it.** The row read "every child of a Columns node is given a column wrapper", on the
 * premise that filtering `ForEachComponent` out of the wrapped children was what left
 * repeater children unsized. Reading the Repeater settles it the other way: a Repeater does
 * not render its items, it adds them as *siblings* of itself under the same visual parent
 * (`foreach.tsx:472`, `internal.target.addChild`). So the items were always in `children` and
 * always got wrapped, and the `ForEachComponent` — which renders `null` — must *not* be
 * wrapped: an empty box would consume a fraction slot and shift every real item's width.
 *
 * The defects NDA-006 actually found are in `nda-006-columns-layout.test.tsx`. What survives
 * here is the part of F3 that was right — the widths a Repeater's items end up with — stated
 * against the contract instead of against the wrong mechanism.
 *
 * **Proxy, deliberately.** These render `Columns` directly through `react-dom/server` rather
 * than standing up a Repeater in a live visual tree: a Repeater needs a mounted DOM, a
 * `ResizeObserver` and a component scope, none of which exist under `testEnvironment: node`.
 * The limitation is recorded in the corpus README.
 */

/* eslint-env jest */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { Columns } from '../../src/components/visual/Columns/Columns';
import { ForEachComponent } from '../../src/nodes/std-library/data/foreach';

type AnyProps = Record<string, unknown>;

function renderColumns(children: React.ReactNode[], layoutString = '1 1 1'): string {
  return renderToStaticMarkup(
    React.createElement(
      Columns as unknown as React.FC<AnyProps>,
      {
        layoutString,
        marginX: '10px',
        marginY: '10px',
        minWidth: '100px',
        justifyContent: 'flex-start',
        direction: 'row'
      },
      children
    )
  );
}

function columnItemCount(markup: string): number {
  return (markup.match(/class="column-item"/g) || []).length;
}

const repeater = () =>
  React.createElement(ForEachComponent as unknown as React.FC<AnyProps>, {
    key: 'repeater',
    didMount: () => undefined,
    willUnmount: () => undefined
  });

const item = (name: string) => React.createElement('div', { key: name, 'data-item': name }, name);

describe('NDA-001 F3: Columns with a Repeater among its children', () => {
  // ✅ Reconciled (NDA-006). A Repeater's items are siblings of the `ForEachComponent`, so
  // they are the wrapped children; the `ForEachComponent` itself draws nothing and takes no
  // slot. Two items beside a Repeater get the layout's *first two* fractions — if the
  // Repeater were wrapped, as F3 originally demanded, they would get the second and third.
  test('F3: a Repeater takes no column slot, so its siblings keep the authored widths', () => {
    const markup = renderColumns([repeater(), item('a'), item('b')], '1 2 1');

    expect(columnItemCount(markup)).toBe(2);
    // '1 2 1' is 4 fractions of 25%. The two items are slots 0 and 1 — 25% then 50%. Had the
    // Repeater been given a slot they would be 1 and 2, i.e. 50% then 25%.
    expect(markup.indexOf('width:25%')).toBeLessThan(markup.indexOf('width:50%'));
    expect(markup).toContain('width:25%');
    expect(markup).toContain('width:50%');
  });

  // ✅ Pinned: without a Repeater, Columns does wrap and size every child. The failure above
  // is the exception, not the rule, and a fix must not be "stop wrapping".
  test('F3 (pinned control): without a Repeater, every child is wrapped and sized', () => {
    const markup = renderColumns([item('a'), item('b'), item('c')]);

    expect(columnItemCount(markup)).toBe(3);
    expect(markup).toContain('width:33.333333333333336%');
  });

  /**
   * The other half of the same code path, and the reason the catalog marks Columns `partial`
   * for SSR: `visibility` is `hidden` until the first `ResizeObserver` callback
   * (`Columns.tsx:141`), which never happens on a server render. The node paints blank on
   * first paint and blank under SSR.
   */
  test('F3 (corollary): Columns is visible on its first render', () => {
    const markup = renderColumns([item('a'), item('b')]);

    expect(markup).not.toContain('visibility:hidden');
  });
});
