/**
 * NDA-001 corpus — failure-reporting row F3.
 *
 * `Columns` filters `ForEachComponent` — the Repeater's own render output — out of its
 * children and renders it separately, *outside* the `.column-item` wrapper that carries the
 * width (`Columns.tsx:119-134`, then line 154), under the comment "ForEachComponent breaks
 * the layout but is needed to send onMount/onUnmount". So Columns has an explicit exception
 * for the single most common reason to reach for it, and the exception is the bug.
 *
 * **Proxy, deliberately.** These render `Columns` directly through `react-dom/server` rather
 * than standing up a Repeater in a live visual tree: a Repeater needs a mounted DOM, a
 * `ResizeObserver` and a component scope, none of which exist under `testEnvironment: node`.
 * What is asserted is the thing the source actually does — a child that is a
 * `ForEachComponent` is not given a column wrapper — which is the mechanism NDA-006 has to
 * remove. The limitation is recorded in the corpus README.
 */

/* eslint-env jest */

// `test.failing`, declared for the @types/jest this monorepo resolves. See the module.
import '../../../noodl-runtime/test/corpus/expected-failure';

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { Columns } from '../../src/components/visual/Columns/Columns';
import { ForEachComponent } from '../../src/nodes/std-library/data/foreach';

type AnyProps = Record<string, unknown>;

function renderColumns(children: React.ReactNode[]): string {
  return renderToStaticMarkup(
    React.createElement(
      Columns as unknown as React.FC<AnyProps>,
      {
        layoutString: '1 1 1',
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
  test.failing('F3: every child of a Columns node is given a column wrapper', () => {
    const markup = renderColumns([repeater(), item('a'), item('b')]);

    // Today: 2. The Repeater is filtered out of `children` and rendered bare above the
    // wrappers, so it — and anything the layout would have to reason about through it —
    // carries no width, no margin and no minimum.
    expect(columnItemCount(markup)).toBe(3);
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
  test.failing('F3 (corollary): Columns is visible on its first render', () => {
    const markup = renderColumns([item('a'), item('b')]);

    expect(markup).not.toContain('visibility:hidden');
  });
});
