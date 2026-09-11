/**
 * FLD-001 — the Columns node measures itself.
 *
 * [#21](https://github.com/The-Low-Code-Foundation/NodeGX/issues/21). The breakpoint arithmetic
 * was correct and unit-tested; it had never once been reached, because the code that produces
 * the number it works on never ran on the node the issue describes.
 *
 * ## The two defects this file grades
 *
 * **The observer was keyed off the mount, not off the element.** The `ResizeObserver` was built
 * inside a `useEffect` with `[]` deps that read `containerRef.current` and returned early when
 * it was null — and `Columns` returns `null` before rendering the ref-carrying div when it has
 * no children (`renderChildren()` hands back `null`, not `[]`, for zero children). Add a Columns
 * node to a graph and it mounts childless. Children then arrive by `addChild` →
 * `forceUpdate()`: a re-render with an unchanged React key, **not** a remount, so `useEffect([])`
 * never ran again. `containerWidth` stayed `null` for the life of that node, and
 * `resolveColumnLayout` returns the authored layout on its first branch when the width is not a
 * number. Breakpoints, Auto Fit and autofold were all dead on the same instances, in the editor
 * and in deployed and exported-as-viewer apps alike.
 *
 * **The width was 16px too big.** `offsetWidth` was read off a div declared
 * `width: calc(100% + marginX)` — the other half of the negative-margin gutter — so the measured
 * number was the true container width *plus* the gutter. "Medium Below 700" fired below 684, and
 * the runtime disagreed with the export, which measures the true container.
 *
 * The two push in opposite directions, so they ship together: landing the observer fix alone
 * would have started every existing breakpoint firing 16px late.
 *
 * ## How this file measures, and why it is not the NDA-006 file
 *
 * `nda-006-columns-layout.test.tsx:1-15` says outright that the measured path is exercised
 * **only by calling `calcAutofold` directly**, because there is no DOM under
 * `testEnvironment: node`. That is precisely the hole #21 lived in: every part of the
 * calculation was proven, and the one thing nobody drove was whether a real component ever
 * reached it. So this file drives the component — jsdom constructed by hand (this package has no
 * `jest-environment-jsdom` in its tree, the same constraint `nda-012-radio-button-group` works
 * around), a real `createRoot`, real effects, and a `ResizeObserver` stub whose calls are
 * counted.
 *
 * ⚠️ **Every assertion here is on rendered `width:` percentages** — the consequence — not on the
 * state that produces them. A spec that read the measurement back out of the component could
 * pass while nothing in the layout moved.
 *
 * 🔴 **`observerCalls` is asserted non-zero in the arming test, and the "observer deliberately
 * broken" test is the presence control**: it proves a green here is the measurement doing the
 * work. Without it, a stub that observed nothing at all would read as a pass on the authored
 * layout in tests that expected the authored layout, and as an unexplained failure elsewhere.
 */

/* eslint-env jest */

import React from 'react';

/* eslint-disable @typescript-eslint/no-var-requires */
const { JSDOM } = require('jsdom');

const dom = new JSDOM('<!doctype html><html><body></body></html>');
(globalThis as never as Record<string, unknown>).window = dom.window;
(globalThis as never as Record<string, unknown>).document = dom.window.document;
(globalThis as never as Record<string, unknown>).navigator = dom.window.navigator;
(globalThis as never as Record<string, unknown>).HTMLElement = dom.window.HTMLElement;
(globalThis as never as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * jsdom lays nothing out, so `offsetWidth` is a hard `0` on every element. The component reads
 * it, so the test has to be the thing that decides what it says — a per-element override, set
 * just before the observer callback fires, which is exactly the order a browser does it in.
 */
Object.defineProperty(dom.window.HTMLElement.prototype, 'offsetWidth', {
  configurable: true,
  get(this: HTMLElement & { __offsetWidth?: number }) {
    return this.__offsetWidth ?? 0;
  }
});

const { createRoot } = require('react-dom/client');
const { act } = require('react');

const {
  Columns,
  measureContainerWidth
} = require('../../src/components/visual/Columns/Columns') as typeof import('../../src/components/visual/Columns/Columns');
/* eslint-enable @typescript-eslint/no-var-requires */

type AnyProps = Record<string, unknown>;

/**
 * A `ResizeObserver` the test drives by hand.
 *
 * `observerCalls` counts constructions and `observed` records what was handed to `observe` — the
 * two things that tell a "the layout never changed" failure apart from a "the observer was never
 * armed" one. `fire` is what a browser does: put a width on the element, then call back.
 */
function installResizeObserver({ broken = false }: { broken?: boolean } = {}) {
  const state = {
    observerCalls: 0,
    observed: [] as HTMLElement[],
    disconnects: 0,
    callbacks: [] as Array<() => void>
  };

  class StubResizeObserver {
    private callback: () => void;

    constructor(callback: () => void) {
      state.observerCalls += 1;
      this.callback = callback;
      // The presence control. A broken observer is one that is constructed and observes, and
      // then simply never reports — which is what the pre-fix code amounted to on a node that
      // mounted childless, and what a stub that measured nothing would look like.
      if (!broken) state.callbacks.push(callback);
    }

    observe(el: HTMLElement) {
      state.observed.push(el);
    }

    unobserve() {
      /* nothing to undo: this stub only records */
    }

    disconnect() {
      state.disconnects += 1;
    }
  }

  (globalThis as never as Record<string, unknown>).ResizeObserver = StubResizeObserver;
  (dom.window as never as Record<string, unknown>).ResizeObserver = StubResizeObserver;

  // `state` itself, not a spread of it.
  //
  // ⚠️ `{ ...state, get calls() { … } }` reads correctly and does not work: object spread copies
  // the *values* of `observerCalls` and `disconnects` at the moment it runs — both `0` — and this
  // package's ts-jest downlevels the literal to `__assign`, which evaluates the accessors eagerly
  // and stores their results as plain properties too. Every counter froze at zero while
  // `observed` went on working, because an array is copied by reference and mutated through it.
  // A counter that always reads `0` fails an arming assertion in exactly the way a genuinely
  // unarmed observer does.
  return Object.assign(state, {
    /** Report `width` on every observed element, the way a browser resize does. */
    fire: async (width: number) => {
      state.observed.forEach((el) => {
        (el as HTMLElement & { __offsetWidth?: number }).__offsetWidth = width;
      });
      await act(async () => {
        state.callbacks.forEach((cb) => cb());
      });
    }
  });
}

/** The ports every test sets and none of them is about. */
function columnsProps(overrides: AnyProps = {}): AnyProps {
  return {
    layoutString: '1 1 1',
    marginX: '16px',
    marginY: '16px',
    minWidth: '0px',
    sizing: 'fixed',
    justifyContent: 'flex-start',
    direction: 'row',
    packing: 'rows',
    style: {},
    className: '',
    ...overrides
  };
}

const child = (name: string) => React.createElement('div', { key: name, 'data-item': name }, name);

/**
 * Mount, then re-render **through the same root** — which is the whole point.
 *
 * `root.render` a second time with the same element type and key is a re-render, not a remount:
 * React keeps the fiber, keeps the state, and does not re-run `useEffect([])`. That is what
 * `addChild` → `forceUpdate()` does to a live Columns node, and it is the arm in which #21
 * reproduces. Opening a saved project builds the graph with children already present and cannot
 * see this at all.
 */
async function mountColumns(props: AnyProps, children: React.ReactNode) {
  const container = dom.window.document.createElement('div');
  dom.window.document.body.appendChild(container);
  const root = createRoot(container);

  const render = async (nextProps: AnyProps, nextChildren: React.ReactNode) => {
    await act(async () => {
      root.render(React.createElement(Columns as unknown as React.FC<AnyProps>, nextProps, nextChildren));
    });
  };

  await render(props, children);

  return {
    container,
    render,
    unmount: async () => {
      await act(async () => {
        root.unmount();
      });
    },
    /** The `width:` of every `.column-item`, in order — the layout, as the browser got it. */
    itemWidths: () =>
      Array.from(container.querySelectorAll('.column-item')).map(
        (el) => (el as HTMLElement).style.width
      )
  };
}

/**
 * The `width:` every item wrapper gets when `columns` equal columns are resolved.
 *
 * **One wrapper per child, not per column.** `children.map` renders every child and gives it
 * `layout[i % columnAmount]` — a three-child node in a two-column layout is three wrappers of
 * 50%, and the third wraps onto a second row. Reading this as "two columns means two widths"
 * is what a first pass at this file did, and it turned a correct fix into a red test.
 *
 * The exact float matters: `100 / 3` is `33.333333333333336`, and that is what React writes
 * into the style attribute. Rounding it in the expectation would make the assertion agree with
 * a layout the browser never got.
 */
function equalWidths(columns: number, children: number): string[] {
  return new Array(children).fill(`${100 / columns}%`);
}

/** The two readings every breakpoint test discriminates between, for three children. */
const AUTHORED_THREE = equalWidths(3, 3);
const FOLDED_TWO = equalWidths(2, 3);

afterEach(() => {
  delete (globalThis as never as Record<string, unknown>).ResizeObserver;
  delete (dom.window as never as Record<string, unknown>).ResizeObserver;
  dom.window.document.body.innerHTML = '';
});

describe('AC2 — a node that mounted childless still measures itself once children arrive', () => {
  it('arms the observer on the element, not on the mount', async () => {
    const observer = installResizeObserver();

    // The authoring order from the issue: the node exists before anything is in it.
    const view = await mountColumns(
      columnsProps({ mediumBreakpoint: '700px', mediumLayout: '1 1' }),
      null
    );

    expect(view.itemWidths()).toEqual([]);
    expect(observer.observed).toHaveLength(0);

    // ...and now three Text children arrive. Same root, same key: a re-render, not a remount.
    await view.render(columnsProps({ mediumBreakpoint: '700px', mediumLayout: '1 1' }), [
      child('a'),
      child('b'),
      child('c')
    ]);

    // The mechanism, asserted so that a failure below can be read. Pre-fix this is 1 and 0:
    // the observer was constructed at the childless mount, found no element, and returned.
    expect(observer.observerCalls).toBeGreaterThan(0);
    expect(observer.observed).toHaveLength(1);
    expect(observer.observed[0].className).toContain('columns-container');

    // Before any report, the authored layout is what renders — deliberately, and unchanged.
    expect(view.itemWidths()).toEqual(AUTHORED_THREE);

    // A container narrower than Medium Below 700. 616 + a 16px gutter is what the widened div
    // reports; the true container is 600.
    await observer.fire(616);

    expect(view.itemWidths()).toEqual(FOLDED_TWO);

    // And back: the observer keeps reporting, so widening undoes it.
    await observer.fire(1016);
    expect(view.itemWidths()).toEqual(AUTHORED_THREE);

    await view.unmount();
  });

  it('AC3 (presence control) — with the observer reporting nothing, the layout never moves', async () => {
    const observer = installResizeObserver({ broken: true });

    const view = await mountColumns(
      columnsProps({ mediumBreakpoint: '700px', mediumLayout: '1 1' }),
      null
    );
    await view.render(columnsProps({ mediumBreakpoint: '700px', mediumLayout: '1 1' }), [
      child('a'),
      child('b'),
      child('c')
    ]);

    // Armed identically — the control varies only whether the callback ever runs.
    expect(observer.observed).toHaveLength(1);

    await observer.fire(616);

    // Unmeasured means authored. If this reads `FOLDED_TWO`, the test above is passing on
    // something other than the measurement and proves nothing.
    expect(view.itemWidths()).toEqual(AUTHORED_THREE);

    await view.unmount();
  });

  it('drops the width again when the element goes away, and re-measures when it returns', async () => {
    const observer = installResizeObserver();

    const props = columnsProps({ mediumBreakpoint: '700px', mediumLayout: '1 1' });
    const view = await mountColumns(props, [child('a'), child('b'), child('c')]);

    await observer.fire(616);
    expect(view.itemWidths()).toEqual(FOLDED_TWO);

    // Every child deleted at runtime: the node renders nothing and the observed element is gone.
    await view.render(props, null);
    expect(view.itemWidths()).toEqual([]);
    expect(observer.disconnects).toBeGreaterThan(0);

    // Children back. A stale 616 would render two columns before any new report arrives, which
    // is a measurement of an element that no longer exists.
    await view.render(props, [child('a'), child('b'), child('c')]);
    expect(view.itemWidths()).toEqual(AUTHORED_THREE);

    await observer.fire(616);
    expect(view.itemWidths()).toEqual(FOLDED_TWO);

    await view.unmount();
  });

  it('measures a node whose layout string arrives after the children do', async () => {
    // The second refless path: `if (!columnLayout) return <>{props.children}</>`. A node with no
    // layout string yet renders its children bare, with no container div, so it is the same trap
    // in a different costume.
    const observer = installResizeObserver();

    const view = await mountColumns(
      columnsProps({ layoutString: null, mediumBreakpoint: '700px', mediumLayout: '1 1' }),
      [child('a'), child('b'), child('c')]
    );

    expect(view.itemWidths()).toEqual([]);

    await view.render(columnsProps({ layoutString: '1 1 1', mediumBreakpoint: '700px', mediumLayout: '1 1' }), [
      child('a'),
      child('b'),
      child('c')
    ]);

    expect(observer.observed).toHaveLength(1);

    await observer.fire(616);
    expect(view.itemWidths()).toEqual(FOLDED_TWO);

    await view.unmount();
  });
});

describe('AC4 — the measured width is the container, not the container plus the gutter', () => {
  it('subtracts the gutter the container div was widened by', () => {
    const el = { offsetWidth: 716 } as unknown as HTMLElement;

    // 700px of container, a 16px gutter, and a div declared `calc(100% + 16px)` wide.
    expect(measureContainerWidth(el, '16px')).toBe(700);
    // An unset or tokenised gutter cannot be resolved to a number here, and 0 is the right
    // answer for arithmetic — the same rule `toPixels` already follows.
    expect(measureContainerWidth(el, undefined)).toBe(716);
    expect(measureContainerWidth(el, 'var(--space-4)')).toBe(716);
    // A gutter wider than the container would otherwise measure negative.
    expect(measureContainerWidth({ offsetWidth: 8 } as unknown as HTMLElement, '16px')).toBe(0);
  });

  it('renders the breakpoint 700 crosses, not the one 716 crosses', async () => {
    const observer = installResizeObserver();

    // Medium Below 710 discriminates the two readings exactly: 700 is under it, 716 is not.
    const props = columnsProps({ mediumBreakpoint: '710px', mediumLayout: '1 1' });
    const view = await mountColumns(props, null);
    await view.render(props, [child('a'), child('b'), child('c')]);

    await observer.fire(716);

    expect(view.itemWidths()).toEqual(FOLDED_TWO);

    await view.unmount();
  });
});

describe('AC5 — Auto Fit and autofold work on a node authored node-first', () => {
  it('Auto Fit computes a column count for a node that mounted childless', async () => {
    const observer = installResizeObserver();

    // 700px of container, 200px minimum: floor((700 + 16) / (200 + 16)) = 3.
    const props = columnsProps({ sizing: 'autoFit', minWidth: '200px', layoutString: '1' });
    const view = await mountColumns(props, null);
    await view.render(props, [child('a'), child('b'), child('c'), child('d')]);

    // Unmeasured, `'1'` is one column and Auto Fit is dead — the bug, as it was reported.
    expect(view.itemWidths()).toEqual(['100%', '100%', '100%', '100%']);

    await observer.fire(716);

    expect(view.itemWidths()).toEqual(equalWidths(3, 4));

    await view.unmount();
  });

  it('autofold folds a node that mounted childless', async () => {
    const observer = installResizeObserver();

    // Three columns of 200px minimum need 648px of true container to stand up.
    const props = columnsProps({ minWidth: '200px', layoutString: '1 1 1' });
    const view = await mountColumns(props, null);
    await view.render(props, [child('a'), child('b'), child('c')]);

    expect(view.itemWidths()).toEqual(AUTHORED_THREE);

    // A true container of 400: three do not fit, two do (400 >= 2 × 216 = 432? no) — one does.
    await observer.fire(416);
    expect(view.itemWidths()).toEqual(['100%', '100%', '100%']);

    // A true container of 500: two columns of 200 + 16 = 432 fit, three (648) do not.
    await observer.fire(516);
    expect(view.itemWidths()).toEqual(FOLDED_TWO);

    await view.unmount();
  });
});
