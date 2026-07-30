import React, { useRef, useState, useEffect, useCallback, isValidElement } from 'react';

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

export function Columns(props: ColumnsProps) {
  if (!props.children) return null;
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

  const { children, forEachComponents } = partitionColumnChildren(props.children);

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
        alignItems: 'stretch',
        justifyContent: props.justifyContent,
        flexDirection: props.direction,
        width: `calc(100% + (${parseFloat(props.marginX)}px)`,
        boxSizing: 'border-box',
        ...props.style
      }}
    >
      {forEachComponents}

      {children.map((child, i) => {
        return (
          <div
            className="column-item"
            // The child's own key, not the index. Every visual node renders with a stable
            // `reactKey`; keying the wrapper by position discarded it, so a Repeater removing
            // or reordering one item made React re-key the whole tail — every following item
            // unmounted and remounted, losing focus, scroll, media playback and transitions.
            key={child.key ?? i}
            style={{
              boxSizing: 'border-box',
              paddingTop: props.marginY,
              paddingLeft: props.marginX,
              width: layout[i % columnAmount] * fractionSize + '%',
              flexShrink: 0,
              flexGrow: 0,
              minWidth: props.minWidth
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
