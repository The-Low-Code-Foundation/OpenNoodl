import React, { useRef, useState, useEffect, useLayoutEffect, useCallback, isValidElement } from 'react';

import { ForEachComponent } from '../../../nodes/std-library/data/foreach';
import { Noodl, Slot } from '../../../types';

export interface ColumnsProps extends Noodl.ReactProps {
  marginX: string;
  marginY: string;

  justifyContent: 'flex-start' | 'flex-end' | 'center';
  direction: 'row' | 'column';
  minWidth: string;
  layoutString: string;

  /** `'layoutString'` uses the authored fractions; `'autoFit'` derives the count. */
  sizing: 'layoutString' | 'autoFit';

  /** `'rows'` aligns each wrap line; `'masonry'` packs each column independently. */
  packing: 'rows' | 'masonry';

  /** Container width below which `mediumLayout` applies, if both are set. */
  mediumBreakpoint: string;
  mediumLayout: string;
  /** Container width below which `smallLayout` applies, if both are set. */
  smallBreakpoint: string;
  smallLayout: string;

  children: Slot;
}

/**
 * Read a px-ish port value as a number.
 *
 * `marginX`/`minWidth` are declared `{ name: 'number', units: ['px'] }`, and that port shape
 * writes `value.value + value.unit` into props — a *string* like `'16px'`. The node's own
 * `initialize()` seeds them as bare numbers, so they are numbers until the author touches the
 * input and strings forever after. Arithmetic that does not go through here therefore works
 * on a default project and silently stops working on an authored one.
 */
function toPixels(value: string | number | undefined): number {
  const parsed = typeof value === 'number' ? value : parseFloat(value as string);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Parse the authored layout string into positive fractions.
 *
 * Anything that is not a positive finite number is dropped rather than carried: a double
 * space (`'1  2'`) splits to an empty entry, `parseInt('')` is `NaN`, and one `NaN` makes
 * `totalFractions` `NaN`, which renders *every* child at `width: NaN%`. A layout string that
 * yields nothing usable falls back to a single column.
 */
export function parseLayout(columnLayout: string): number[] {
  const layout = columnLayout
    .split(' ')
    .map((number) => parseInt(number))
    .filter((fraction) => Number.isFinite(fraction) && fraction > 0);

  return layout.length ? layout : [1];
}

export function calcAutofold(layout: number[], minWidth: number, containerWidth: number, marginX: number) {
  const first = _calcAutofold(layout, minWidth, containerWidth, marginX);
  const second = _calcAutofold(first.layout, minWidth, containerWidth, marginX);

  if (first.totalFractions === second.totalFractions) {
    return first;
  } else {
    return calcAutofold(second.layout, minWidth, containerWidth, marginX);
  }
}

function _calcAutofold(layout: number[], minWidth: number, containerWidth: number, marginX: number) {
  const totalFractions = layout.reduce((a, b) => a + b, 0);
  const fractionSize = 100 / totalFractions;

  const rowWidth = layout.reduce(
    (acc, curr) => {
      return {
        expected: acc.expected + (fractionSize / 100) * containerWidth * curr,
        min: acc.min + minWidth + marginX
      };
    },
    { expected: 0, min: 0 }
  );

  // A copy. `newLayout = layout` popped the *caller's* array, and `calcAutofold` above then
  // compares `first.totalFractions` — a number taken before that pop — against the array it
  // has since shortened, so the two readings it is trying to settle were never independent.
  const newLayout = layout.slice();

  // One column is the floor. Popping the last entry leaves `totalFractions === 0`, so
  // `fractionSize` is `Infinity` and `columnAmount` is `0` — and `layout[i % 0]` is
  // `layout[NaN]`, i.e. every child renders `width: NaN%` and is dropped by the browser.
  // A container narrower than one minimum column wants one column, not none.
  if (newLayout.length > 1 && rowWidth.expected < rowWidth.min) {
    newLayout.pop();
  }

  const newTotalFractions = newLayout.reduce((a, b) => a + b, 0);
  const newFractionSize = 100 / newTotalFractions;
  const newColumnAmount = newLayout.length;

  return {
    layout: newLayout,
    totalFractions: newTotalFractions,
    fractionSize: newFractionSize,
    columnAmount: newColumnAmount
  };
}

/**
 * Everything between the authored ports and the widths the children are given.
 *
 * Exported for the NDA-006 corpus, and the reason it is one function: the unit conversion is
 * as much a part of the calculation as the arithmetic is. Passing `props.marginX` — a string
 * like `'16px'` — straight into the fold made `acc.min + minWidth + marginX` a string
 * concatenation, and `number < string` coerces to `NaN`, so the comparison was permanently
 * false and the fold never happened.
 *
 * Autofold needs a measured container. Before the first `ResizeObserver` callback — and for
 * the whole of a server render, where there is no observer at all — the authored layout is
 * what gets rendered.
 */
export function resolveColumnLayout(
  columnLayout: string,
  props: Pick<
    ColumnsProps,
    'minWidth' | 'marginX' | 'sizing' | 'mediumBreakpoint' | 'mediumLayout' | 'smallBreakpoint' | 'smallLayout'
  >,
  containerWidth: number | null
) {
  const minWidth = toPixels(props.minWidth);
  const marginX = toPixels(props.marginX);

  if (typeof containerWidth !== 'number') {
    const targetLayout = parseLayout(columnLayout);
    return {
      layout: targetLayout,
      columnAmount: targetLayout.length,
      fractionSize: 100 / targetLayout.reduce((a, b) => a + b, 0)
    };
  }

  if (props.sizing === 'autoFit') {
    return calcAutoFit(minWidth, containerWidth, marginX);
  }

  const targetLayout = parseLayout(pickBreakpointLayout(columnLayout, props, containerWidth));

  return calcAutofold(targetLayout, minWidth, containerWidth, marginX);
}

/**
 * Choose the authored layout string for this container width.
 *
 * **Container width, not viewport width** — NDA-006 §3. The editor has no breakpoint concept
 * to extend (checked: nothing in the styles system or the models carries one), so this was
 * going to invent something either way. Keying off the container the node already measures
 * beats a project-level viewport set: the same Columns node then behaves correctly inside a
 * sidebar, a modal or a repeater cell, where viewport width says nothing useful.
 *
 * Two named steps rather than an open list, because they are static ports: they appear in the
 * picker, in the catalog, and to the AI authoring loop without any dynamic-port machinery, and
 * "desktop / tablet / mobile" is the shape of the request. A breakpoint with no layout beside
 * it (or the other way round) is ignored rather than half-applied.
 */
export function pickBreakpointLayout(
  base: string,
  props: Pick<ColumnsProps, 'mediumBreakpoint' | 'mediumLayout' | 'smallBreakpoint' | 'smallLayout'>,
  containerWidth: number
): string {
  const small = toPixels(props.smallBreakpoint);
  if (small > 0 && props.smallLayout && containerWidth < small) return props.smallLayout;

  const medium = toPixels(props.mediumBreakpoint);
  if (medium > 0 && props.mediumLayout && containerWidth < medium) return props.mediumLayout;

  return base;
}

/**
 * As many equal columns as will hold their minimum — CSS `repeat(auto-fit, minmax(…))`.
 *
 * The layout string is not consulted at all in this mode. `minWidth` of 0 would divide by
 * zero, so it degrades to a single column, which is the honest answer to "fit columns of no
 * minimum width".
 */
export function calcAutoFit(minWidth: number, containerWidth: number, marginX: number) {
  const columnAmount =
    minWidth > 0 ? Math.max(1, Math.floor((containerWidth + marginX) / (minWidth + marginX))) : 1;

  return {
    layout: new Array(columnAmount).fill(1) as number[],
    columnAmount,
    fractionSize: 100 / columnAmount
  };
}

/**
 * Split the children into the ones that get a column box and the Repeaters that do not.
 *
 * A Repeater renders a {@link ForEachComponent}, which draws nothing — it exists only to
 * report mount/unmount — and adds its item nodes as *siblings* of itself under this same
 * parent. So it is not a layout participant and must not be given a `.column-item` box: an
 * empty box would consume a fraction slot and shift every real item's width. It does still
 * have to be rendered, which is the half that used to go wrong.
 *
 * Exported for the NDA-006 corpus: a `ForEachComponent` renders `null`, so whether it
 * survived this partition cannot be seen in the rendered markup.
 */
export function partitionColumnChildren(slot: Slot): {
  children: React.ReactElement[];
  forEachComponents: React.ReactElement[];
} {
  // `renderChildren` hands back a bare element rather than an array when there is exactly
  // one child. The old single-child branch had no `forEachComponent` assignment at all, so a
  // Repeater that was the *only* child of a Columns node was dropped from the tree entirely
  // — it never mounted, and with `repeaterDisabledWhenUnmounted` on it therefore never
  // created a single item. A Columns node holding nothing but a Repeater rendered nothing,
  // for ever.
  const childArray = Array.isArray(slot) ? slot : [slot];
  const elements = childArray.filter((child): child is React.ReactElement => isValidElement(child));

  return {
    children: elements.filter((child) => child.type !== ForEachComponent),
    // `filter`, not `find`: a Columns node can hold more than one Repeater, and only the
    // first was ever rendered.
    forEachComponents: elements.filter((child) => child.type === ForEachComponent)
  };
}

/**
 * Where each column starts, as a percentage — the running total of the fractions before it.
 *
 * Rows mode never needs this: the wrap lines put each item after the last one. Masonry takes the
 * items out of flow, so their horizontal position has to be computed from the same resolved layout
 * the widths come from, or the two disagree the moment a layout string is not all `1`s.
 */
export function computeColumnOffsets(layout: number[], fractionSize: number): number[] {
  const lefts: number[] = [];
  let fractionsSoFar = 0;

  for (const fraction of layout) {
    lefts.push(fractionsSoFar * fractionSize);
    fractionsSoFar += fraction;
  }

  return lefts;
}

/**
 * Masonry packing — NDA-006 slice 4. **Item `i` goes in column `i % columnAmount`.**
 *
 * That is the same assignment Rows mode makes (`layout[i % columnAmount]` sets the width), which is
 * the whole design: switching Rows → Masonry never moves an item to a different column and never
 * changes its width. It only stops each wrap line from aligning to the tallest item in it. So the
 * ordering an author gets is **row-major, exactly as authored** — read left to right, wrap, repeat.
 *
 * Three alternatives were considered and rejected, each for a reason worth keeping:
 *
 * - **CSS `columns`** is the cheap answer and reorders the children *column-major* — items 1, 2, 3
 *   run down the first column. For a list, which is what a Repeater produces, that is wrong.
 * - **A `<div>` per column, with the items distributed into them**, needs no measurement at all and
 *   was the obvious implementation. It reintroduces the defect slice 2 fixed: inserting or removing
 *   one item shifts every later item's column, so an item changes *parent*, and React unmounts and
 *   remounts it however it is keyed. Masonry over a Repeater is the request, a Repeater inserts and
 *   removes, so the one structure that has to survive that is the one that would not. Keeping a flat
 *   child list and moving items with `top`/`left` costs a measurement and keeps every item mounted.
 * - **Shortest-column-first**, the balanced packing, makes an item's column depend on the heights
 *   before it. With unequal fractions an item's width then depends on its column, its height on its
 *   width, and the packing on its height — a feedback loop with no fixed point. Round-robin has
 *   stable widths. The cost is that columns are **not** height-balanced, which is documented rather
 *   than fixed.
 *
 * `heights` are the *outer* heights of the item wrappers, so each already carries its `marginY`
 * gap as padding; the column totals therefore need no gap arithmetic of their own.
 */
export function computeMasonryOffsets(heights: number[], columnAmount: number) {
  const columnHeights = new Array(Math.max(1, columnAmount)).fill(0) as number[];

  const tops = heights.map((height, i) => {
    const column = i % columnHeights.length;
    const top = columnHeights[column];
    columnHeights[column] = top + height;
    return top;
  });

  return { tops, height: columnHeights.reduce((a, b) => Math.max(a, b), 0) };
}

function sameOffsets(a: { tops: number[]; height: number } | null, b: { tops: number[]; height: number }) {
  return (
    a !== null && a.height === b.height && a.tops.length === b.tops.length && a.tops.every((t, i) => t === b.tops[i])
  );
}

export function Columns(props: ColumnsProps) {
  let columnLayout = null;

  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(null);

  const rootRef = useCallback((el: HTMLDivElement | null) => {
    containerRef.current = el;
    props.noodlNode?.setDOMElement(el);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const container = containerRef?.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      const container = containerRef.current;
      if (!container) return;
      setContainerWidth(container.offsetWidth);
    });

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, []);

  const { children, forEachComponents } = partitionColumnChildren(props.children);
  const masonry = props.packing === 'masonry';

  const itemElements = useRef<(HTMLDivElement | null)[]>([]);
  // The resolved column count, for the measurement effect. It is derived below, after the hooks,
  // because it depends on `containerWidth` — which is state, so it can only be read in render.
  const columnAmountRef = useRef(1);
  const [masonryOffsets, setMasonryOffsets] = useState<{ tops: number[]; height: number } | null>(null);

  /**
   * Measure the item wrappers and pack them.
   *
   * One `ResizeObserver` over every wrapper rather than one over the container: an item's height
   * changes without the container's when an image finishes loading or text reflows, and that is
   * exactly when a packed layout has to be recomputed. `useLayoutEffect` so the first packed frame
   * lands before paint — the *unpacked* frame is still rendered, deliberately (see the fallback
   * note in the render below), but it should not be visible for a frame longer than it must.
   *
   * Guarded by `sameOffsets` because setting the offsets re-renders, which re-runs this. Heights do
   * not change between the unpacked and packed passes — `alignItems` is `flex-start` in masonry, so
   * nothing was stretched to a row height in the first place — so the second reading equals the
   * first and the loop stops there.
   */
  useLayoutEffect(() => {
    if (!masonry) {
      setMasonryOffsets(null);
      return;
    }

    const measure = () => {
      const elements = itemElements.current.slice(0, children.length);
      if (elements.length !== children.length || elements.some((el) => !el)) return;

      const next = computeMasonryOffsets(
        elements.map((el) => el.offsetHeight),
        columnAmountRef.current
      );
      setMasonryOffsets((previous) => (sameOffsets(previous, next) ? previous : next));
    };

    measure();

    if (typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(measure);
    itemElements.current.slice(0, children.length).forEach((el) => el && observer.observe(el));

    return () => observer.disconnect();
    // `containerWidth` is a dependency because it is what can change `columnAmount`, and a
    // different column count is a different packing of the same heights.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [masonry, children.length, containerWidth]);

  // The node renders nothing without children. This used to be the first statement in the
  // function, ahead of every hook — so a Columns node whose last child was deleted while the app
  // was running changed its hook count and React threw. Live-editing a graph does exactly that.
  if (!props.children) return null;

  switch (typeof props.layoutString) {
    case 'string':
      columnLayout = props.layoutString.trim();
      break;

    case 'number':
      columnLayout = String(props.layoutString).trim();
      break;

    default:
      columnLayout = null;
  }

  if (!columnLayout) {
    return <>{props.children}</>;
  }

  const { layout, columnAmount, fractionSize } = resolveColumnLayout(columnLayout, props, containerWidth);
  columnAmountRef.current = columnAmount;

  // Masonry needs the horizontal position too, because its items are out of flow.
  const columnLefts = masonry ? computeColumnOffsets(layout, fractionSize) : null;
  const packed = masonry && masonryOffsets !== null && masonryOffsets.tops.length === children.length;

  return (
    <div
      className={['columns-container', props.className].join(' ')}
      ref={rootRef}
      style={{
        // Deliberately not `visibility: hidden until measured`. That painted blank on first
        // render and, because a server render never gets a `ResizeObserver` callback, blank
        // for the entire SSR/SSG output. The authored layout is right at the width the author
        // designed for; autofold reflows it once measured.
        marginTop: parseFloat(props.marginY) * -1,
        marginLeft: parseFloat(props.marginX) * -1,
        display: 'flex',
        flexWrap: 'wrap',
        // Masonry's items must keep their natural height, both because that is the point and
        // because the *unpacked* pass is what gets measured — `stretch` would report every item
        // in a wrap line as being as tall as the tallest, and the packing would be built out of
        // heights no item actually has.
        alignItems: masonry ? 'flex-start' : 'stretch',
        justifyContent: props.justifyContent,
        flexDirection: props.direction,
        // The negative-margin gutter's other half: the container starts `marginX` to the left,
        // so it has to be `marginX` wider for its right edge to land back on the parent's.
        //
        // The parenthesis here used to be unbalanced (`calc(100% + (0px)`), and it survived
        // because the two paths that consume this style disagree about what that means. React
        // sets each property through the CSSOM on the client, where the value is parsed in
        // isolation and CSS's end-of-input rule closes the block for you — so `width` was fine
        // and nothing upstream ever looked wrong. A **server** render serialises the same object
        // into one `style` attribute, and there the unclosed block swallows the `;` and every
        // declaration after it: `width` and `box-sizing` both vanished, the container fell back
        // to shrink-to-fit, and every percentage-width child computed to zero. The whole of an
        // SSR/SSG page's Columns content was a zero-width strip until hydration replaced it.
        width: `calc(100% + ${parseFloat(props.marginX)}px)`,
        boxSizing: 'border-box',
        // Every item is out of flow once packed, so the container has no content to size itself
        // from. `position: relative` is what the items' percentage `left` resolves against.
        ...(masonry ? { position: 'relative' as const } : null),
        ...(packed ? { height: masonryOffsets.height } : null),
        ...props.style
      }}
    >
      {forEachComponents}

      {children.map((child, i) => {
        const column = i % columnAmount;

        return (
          <div
            className={masonry ? 'column-item column-item--masonry' : 'column-item'}
            // The child's own key, not the index. Every visual node renders with a stable
            // `reactKey`; keying the wrapper by position discarded it, so a Repeater removing
            // or reordering one item made React re-key the whole tail — every following item
            // unmounted and remounted, losing focus, scroll, media playback and transitions.
            key={child.key ?? i}
            // A flat, stably-keyed child list is why masonry moves items with `top`/`left`
            // instead of distributing them into a `<div>` per column — see
            // {@link computeMasonryOffsets}. The refs are only read in masonry mode.
            ref={
              masonry
                ? (el: HTMLDivElement | null) => {
                    itemElements.current[i] = el;
                  }
                : undefined
            }
            style={{
              boxSizing: 'border-box',
              paddingTop: props.marginY,
              paddingLeft: props.marginX,
              width: layout[column] * fractionSize + '%',
              flexShrink: 0,
              flexGrow: 0,
              minWidth: props.minWidth,
              // Until the heights are known — the first frame, and the whole of a server render,
              // which never gets a `ResizeObserver` callback at all — masonry renders as ragged
              // top-aligned rows. That is what the layout means without measurement, and it is the
              // same deliberate reflow autofold makes rather than painting blank.
              ...(packed
                ? {
                    position: 'absolute' as const,
                    top: masonryOffsets.tops[i],
                    left: columnLefts[column] + '%'
                  }
                : null)
              // maxWidths needs some more thought
              //maxWidth: getMinMaxInputValues(maxWidths, columnAmount, props.marginX, i)
            }}
          >
            {child}
          </div>
        );
      })}
    </div>
  );
}
