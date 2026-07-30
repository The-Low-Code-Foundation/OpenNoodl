/**
 * NDA-006 corpus — Columns: autofold, and the Repeater children that go missing.
 *
 * NDA-001's F3 row named the wrong mechanism (see `nda-001-columns-repeater.test.tsx`). These
 * are the defects reading the node actually turned up, and they are worse than the one it
 * predicted: two of them make a Columns node render *nothing*, and one makes its only
 * responsive behaviour stop working the moment an author touches an input.
 *
 * **Proxy, deliberately**, for the same reason as F3: there is no jsdom and no
 * `ResizeObserver` under `testEnvironment: node`, so the measured path is exercised by
 * calling `calcAutofold` directly and the render path through `react-dom/server`. The one
 * thing neither can see is whether a `ForEachComponent` survived into the tree — it renders
 * `null` — which is why `partitionColumnChildren` is exported and asserted on directly.
 */

/* eslint-env jest */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  Columns,
  calcAutoFit,
  calcAutofold,
  parseLayout,
  partitionColumnChildren,
  pickBreakpointLayout,
  resolveColumnLayout
} from '../../src/components/visual/Columns/Columns';
import { ForEachComponent } from '../../src/nodes/std-library/data/foreach';

type AnyProps = Record<string, unknown>;

const repeater = (key: string) =>
  React.createElement(ForEachComponent as unknown as React.FC<AnyProps>, {
    key,
    didMount: () => undefined,
    willUnmount: () => undefined
  });

const item = (name: string) => React.createElement('div', { key: name, 'data-item': name }, name);

function renderColumns(children: React.ReactNode, props: AnyProps = {}): string {
  return renderToStaticMarkup(
    React.createElement(
      Columns as unknown as React.FC<AnyProps>,
      {
        layoutString: '1 1 1',
        marginX: '10px',
        marginY: '10px',
        minWidth: '100px',
        justifyContent: 'flex-start',
        direction: 'row',
        ...props
      },
      children
    )
  );
}

describe('NDA-006: autofold', () => {
  // The whole of the node's responsive behaviour is "pop columns off the end until the row
  // fits". It is reached only through `calcAutofold`, and `calcAutofold` was reached with
  // `props.marginX` — which a `{ name: 'number', units: ['px'] }` port writes as the *string*
  // `'16px'`. `0 + 100 + '16px'` is the string `'10016px'`, and `number < string` coerces to
  // `NaN`, which is false. So the fold never fired.
  //
  // It fired on a *default* project, because `columns.ts:29` seeds `props.marginX = 16` as a
  // bare number and the node definition's `initialize` runs last. Touching Horizontal Gap in
  // the editor is what turned it off — and Min Column Width, the input that gives autofold
  // its only reason to exist, sits in the same panel.
  test('A1: a row narrower than its minimums folds a column away', () => {
    // Three 100px columns with a 10px gap need 330px; the container has 200.
    const folded = resolveColumnLayout('1 1 1', { minWidth: 100, marginX: 10 } as never, 200);

    expect(folded.columnAmount).toBeLessThan(3);
  });

  // The same fold, with the ports carrying what a `{ name: 'number', units: ['px'] }` input
  // actually writes into props. This is the row that was live: `columns.ts`'s own
  // `initialize` seeds bare numbers and runs last, so autofold worked on a default project
  // and stopped the moment the author set Horizontal Gap — which sits in the same panel as
  // Min Column Width, the input that gives autofold its only reason to exist.
  test('A2: the fold survives an authored gap, which arrives as a px string', () => {
    const folded = resolveColumnLayout('1 1 1', { minWidth: '100px', marginX: '10px' } as never, 200);

    expect(folded.columnAmount).toBeLessThan(3);
  });

  test('A2 (control): a wide enough container keeps every column, strings or not', () => {
    const strings = resolveColumnLayout('1 1 1', { minWidth: '100px', marginX: '10px' } as never, 1200);

    expect(strings.columnAmount).toBe(3);
  });

  // `newLayout = layout` then `.pop()`. `calcAutofold` calls `_calcAutofold` twice and
  // compares the first result's `totalFractions` — a number read *before* the second call
  // shortened the very same array — against the second's, to decide whether the layout has
  // settled. The two readings it is comparing were never independent, and the caller's array
  // came back shorter than it went in.
  test('A3: calcAutofold does not mutate the layout it is given', () => {
    const layout = [1, 1, 1];

    const folded = calcAutofold(layout, 100, 200, 10);

    expect(layout).toEqual([1, 1, 1]);
    expect(folded.layout).not.toBe(layout);
  });

  // Folding to zero columns leaves `totalFractions === 0`, so `fractionSize` is `Infinity`
  // and `columnAmount` is `0` — and the render then reads `layout[i % 0]`, i.e.
  // `layout[NaN]`, i.e. `undefined`. Every child gets `width: NaN%`, which the browser drops,
  // so a container narrower than one minimum column lost its layout entirely rather than
  // falling back to the single column it was asking for.
  test('A4: a container narrower than one minimum column folds to one, not to none', () => {
    const folded = resolveColumnLayout('1 1 1', { minWidth: '400px', marginX: '10px' } as never, 50);

    expect(folded.columnAmount).toBe(1);
    expect(Number.isFinite(folded.fractionSize)).toBe(true);
  });

  // `'1  2'` — two spaces — splits to `['1', '', '2']`, and `parseInt('')` is `NaN`. One
  // `NaN` in the fractions makes `totalFractions` `NaN` and every width `NaN%`. There is no
  // warning: the `layout-type-warning` on the port only checks that the value is a string.
  test('A5: a layout string with a stray space still lays out', () => {
    expect(parseLayout('1  2')).toEqual([1, 2]);

    const markup = renderColumns([item('a'), item('b')], { layoutString: '1  2' });
    expect(markup).not.toContain('NaN');
  });

  test('A6: a layout string with nothing usable in it falls back to one column', () => {
    expect(parseLayout('0')).toEqual([1]);
    expect(parseLayout('nonsense')).toEqual([1]);
  });
});

describe('NDA-006 §3: responsive layout', () => {
  // The whole responsive API used to be one layout string plus "pop columns off the end",
  // with no way to say "3 up on desktop, 2 on tablet, 1 on mobile" — which is what every real
  // layout asks for.
  const breaks = {
    mediumBreakpoint: '1024px',
    mediumLayout: '1 1',
    smallBreakpoint: '600px',
    smallLayout: '1'
  } as unknown as Parameters<typeof pickBreakpointLayout>[1];

  test('C1: a wide container gets the base layout', () => {
    expect(pickBreakpointLayout('1 2 1', breaks, 1400)).toBe('1 2 1');
  });

  test('C2: below the medium breakpoint the medium layout applies', () => {
    expect(pickBreakpointLayout('1 2 1', breaks, 800)).toBe('1 1');
  });

  test('C3: below the small breakpoint the small layout wins over the medium one', () => {
    // 500 is below both, and the narrower answer has to win — checking them in the other
    // order returns '1 1' for a phone.
    expect(pickBreakpointLayout('1 2 1', breaks, 500)).toBe('1');
  });

  test('C4: a breakpoint with no layout beside it is inert, not half-applied', () => {
    const halfSet = { mediumBreakpoint: '1024px', mediumLayout: '', smallBreakpoint: '', smallLayout: '1' } as never;

    expect(pickBreakpointLayout('1 2 1', halfSet, 800)).toBe('1 2 1');
  });

  test('C5: Auto Fit takes as many columns as will hold their minimum', () => {
    // 3 × 200 + 2 gaps of 20 = 640 fits in 660; a fourth would need 880.
    expect(calcAutoFit(200, 660, 20).columnAmount).toBe(3);
    expect(calcAutoFit(200, 1000, 20).columnAmount).toBe(4);
  });

  test('C6: Auto Fit never returns zero columns', () => {
    // A container narrower than one minimum column, and the degenerate "no minimum width"
    // case — both of which produced NaN widths through the fold path.
    expect(calcAutoFit(400, 100, 20).columnAmount).toBe(1);
    expect(calcAutoFit(0, 800, 20).columnAmount).toBe(1);
  });

  test('C7: Auto Fit ignores the layout string entirely', () => {
    const fitted = resolveColumnLayout('1 2 1', { ...breaks, sizing: 'autoFit', minWidth: '200px', marginX: '20px' } as never, 660);

    expect(fitted.columnAmount).toBe(3);
    expect(fitted.layout).toEqual([1, 1, 1]);
  });

  test('C8 (control): the default sizing still uses the authored fractions', () => {
    const authored = resolveColumnLayout('1 2 1', { minWidth: '0px', marginX: '20px' } as never, 1400);

    expect(authored.layout).toEqual([1, 2, 1]);
  });
});

describe('NDA-006: Repeaters among the children', () => {
  // `renderChildren` hands back a bare element rather than an array when a node has exactly
  // one child. The old single-child branch tested for `ForEachComponent` and, finding one,
  // put it in neither bucket — it assigned `forEachComponent` only in the array branch. So
  // the element was dropped, `didMount` never fired, and with the
  // `repeaterDisabledWhenUnmounted` project setting on, every operation the Repeater had
  // queued stayed queued. A Columns node whose only child is a Repeater rendered nothing at
  // all, permanently.
  test('B1: a Repeater that is the only child is still rendered', () => {
    const { children, forEachComponents } = partitionColumnChildren(repeater('r'));

    expect(children).toHaveLength(0);
    expect(forEachComponents).toHaveLength(1);
  });

  // `find`, not `filter`. The second Repeater in a Columns node was never rendered, so it
  // never mounted — same consequence as B1, for the same reason, one node further along.
  test('B2: every Repeater is rendered, not just the first', () => {
    const { forEachComponents } = partitionColumnChildren([repeater('r1'), item('a'), repeater('r2')]);

    expect(forEachComponents).toHaveLength(2);
  });

  test('B3 (control): a Repeater is never given a column box', () => {
    const { children } = partitionColumnChildren([repeater('r'), item('a')]);

    expect(children).toHaveLength(1);
    expect(children[0].type).not.toBe(ForEachComponent);
  });

  // The wrapper was keyed by position while its child carries the stable `reactKey` every
  // visual node renders with. Removing item 0 keeps wrapper 0 and hands it a different child,
  // whose key no longer matches — so React unmounts and remounts it, and the same happens all
  // the way down the list. A Repeater deleting one row therefore tore down every row after
  // it, losing focus, scroll position, media playback and any transition in flight. `Group`
  // keys its children directly and has never had this.
  // ⚠️ **Precondition only — this row does not test the fix, and cannot.** Keys are not
  // rendered into markup, and reconciliation needs a DOM to observe: there is no jsdom and no
  // `react-test-renderer` in this package. What is pinned here is the fact the fix rests on
  // — that each child arrives carrying a stable key of its own, so `key={child.key ?? i}` has
  // something to use. That the remount storm is gone is owed to live QA, and is recorded as
  // owed in PROGRESS.md rather than quietly counted as covered.
  test('B4 (precondition): every wrapped child carries a stable key of its own', () => {
    const { children } = partitionColumnChildren([item('a'), item('b')]);

    expect(children.map((child) => child.key)).toEqual(['a', 'b']);
  });
});
