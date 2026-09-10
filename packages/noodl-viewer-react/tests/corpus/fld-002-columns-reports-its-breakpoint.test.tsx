/**
 * FLD-002 — the Columns node says which breakpoint it is at.
 *
 * [#22](https://github.com/The-Low-Code-Foundation/NodeGX/issues/22), Richard: *"the Columns node
 * doesn't expose its current state, i.e. a string output value of 'Default', 'Medium' or 'Small'
 * and maybe a signal output of 'At Medium' or 'At Small'."*
 *
 * The state was never missing. `pickBreakpointLayout` has always known which of the three
 * authored layout strings it chose; it simply had no way out of the component, and until FLD-001
 * landed it was never even reached, because `containerWidth` was `null` for the life of a node
 * that mounted childless. The workaround in the field is a States node keyed off `boundingWidth`,
 * which is a second copy of the thresholds kept in the graph — and one measured against the
 * *bounding* width, which FLD-001's second half proved differs from the width the node folds on
 * by exactly one gutter.
 *
 * ## What this file grades, and the shape of it
 *
 * The whole design of the fix is that there is **one decision**: `pickBreakpointLayout` returns
 * the band's name beside the string it picked, `resolveColumnLayout` carries both out, and the
 * render calls it once. So the interesting assertions are not "does the output say Medium" — they
 * are:
 *
 * - **AC3, agreement.** The band reported and the widths on screen come from the same call, so
 *   this file derives the expected widths *from the reported band* rather than hard-coding them
 *   beside it. A spec that asserted `'Medium'` and `50%` as two literals would pass just as
 *   happily on two derivations that agreed by luck.
 * - **AC2, cardinality.** `expect(...).toHaveBeenCalledTimes(1)` everywhere, never
 *   `toHaveBeenCalled()`. The failure mode this task names is a signal fired from render, and a
 *   node whose children arrive by `forceUpdate()` re-renders constantly — "at least one" cannot
 *   tell a correct pulse from sixty of them.
 * - **The presence control.** `installResizeObserver({ broken: true })` is the arm where nothing
 *   is ever measured. Every band this file reports is `Default` there and no signal fires, which
 *   is what makes a green above the measurement doing the work rather than the stub.
 *
 * ⚠️ **Every width here is off the boundary.** The runtime compares with a strict `<` and the
 * export's `@container (max-width: …)` is inclusive, so a container measured *exactly* at a
 * threshold is the one width where the two disagree. That discrepancy is real and is filed, not
 * papered over; this file simply does not stand on it.
 *
 * The harness — hand-built jsdom, a real `createRoot`, a driven `ResizeObserver` stub — is
 * FLD-001's, for the reason its own header gives: this package has no `jest-environment-jsdom`,
 * and `nda-006-columns-layout.test.tsx` says outright that it can only call the arithmetic
 * directly. A reporting port is a thing a component does over time, so it has to be driven.
 */

/* eslint-env jest */

import * as fs from 'fs';
import * as path from 'path';

import React from 'react';

/* eslint-disable @typescript-eslint/no-var-requires */
const { JSDOM } = require('jsdom');

const dom = new JSDOM('<!doctype html><html><body></body></html>');
(globalThis as never as Record<string, unknown>).window = dom.window;
(globalThis as never as Record<string, unknown>).document = dom.window.document;
(globalThis as never as Record<string, unknown>).navigator = dom.window.navigator;
(globalThis as never as Record<string, unknown>).HTMLElement = dom.window.HTMLElement;
(globalThis as never as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

/** jsdom lays nothing out, so the test decides what `offsetWidth` says — see FLD-001's file. */
Object.defineProperty(dom.window.HTMLElement.prototype, 'offsetWidth', {
  configurable: true,
  get(this: HTMLElement & { __offsetWidth?: number }) {
    return this.__offsetWidth ?? 0;
  }
});

const { createRoot } = require('react-dom/client');
const { act } = require('react');

const {
  Columns
} = require('../../src/components/visual/Columns/Columns') as typeof import('../../src/components/visual/Columns/Columns');
/* eslint-enable @typescript-eslint/no-var-requires */

type AnyProps = Record<string, unknown>;

function installResizeObserver({ broken = false }: { broken?: boolean } = {}) {
  const state = {
    observerCalls: 0,
    observed: [] as HTMLElement[],
    callbacks: [] as Array<() => void>
  };

  class StubResizeObserver {
    constructor(callback: () => void) {
      state.observerCalls += 1;
      if (!broken) state.callbacks.push(callback);
    }

    observe(el: HTMLElement) {
      state.observed.push(el);
    }

    unobserve() {
      /* this stub only records */
    }

    disconnect() {
      /* this stub only records */
    }
  }

  (globalThis as never as Record<string, unknown>).ResizeObserver = StubResizeObserver;
  (dom.window as never as Record<string, unknown>).ResizeObserver = StubResizeObserver;

  // `state` itself, never a spread of it — FLD-001's file records why a spread freezes the
  // counters at zero under this package's ts-jest.
  return Object.assign(state, {
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

/**
 * The three authored layouts every test in this file uses, and the thresholds between them.
 *
 * `marginX` is 16, and `measureContainerWidth` subtracts it (FLD-001's second half), so an
 * `offsetWidth` of 900 is a *container* of 884. Every `fire()` below is written as the
 * offsetWidth a browser would report, and the band it lands in is named beside it.
 */
const LAYOUTS: Record<string, string> = {
  Default: '1 1 1',
  Medium: '1 1',
  Small: '1'
};

const BREAKPOINT_PORTS = {
  layoutString: LAYOUTS.Default,
  mediumBreakpoint: '1024px',
  mediumLayout: LAYOUTS.Medium,
  smallBreakpoint: '600px',
  smallLayout: LAYOUTS.Small
};

/** offsetWidths that sit clear of both thresholds, in each band. */
const WIDE = 1200; // container 1184 — Default
const MEDIUM = 900; // container 884 — Medium
const MEDIUM_AGAIN = 950; // container 934 — still Medium
const NARROW = 500; // container 484 — Small

/**
 * The `width:` each of `children` wrappers gets under an authored layout string.
 *
 * Written out here rather than imported from the source: this is the arithmetic AC3 checks the
 * component against, and reading it out of the same module that produced the answer would make
 * the check a tautology. One wrapper per *child*, not per column — a three-child node in a
 * two-column layout is three wrappers of 50%, the third wrapping onto a second row.
 */
function widthsFor(layoutString: string, children: number): string[] {
  const fractions = layoutString.split(' ').map(Number);
  const total = fractions.reduce((a, b) => a + b, 0);
  return new Array(children).fill(0).map((_, i) => `${(fractions[i % fractions.length] * 100) / total}%`);
}

function columnsProps(overrides: AnyProps = {}): AnyProps {
  return {
    marginX: '16px',
    marginY: '16px',
    minWidth: '0px',
    sizing: 'layoutString',
    justifyContent: 'flex-start',
    direction: 'row',
    packing: 'rows',
    style: {},
    className: '',
    ...BREAKPOINT_PORTS,
    ...overrides
  };
}

const child = (name: string) => React.createElement('div', { key: name, 'data-item': name }, name);
const THREE_CHILDREN = [child('a'), child('b'), child('c')];

/** The three reporting ports, as the node installs them: plain functions on props. */
function reportingPorts() {
  return {
    onBreakpointChanged: jest.fn(),
    onAtMedium: jest.fn(),
    onAtSmall: jest.fn()
  };
}

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
    itemWidths: () =>
      Array.from(container.querySelectorAll('.column-item')).map((el) => (el as HTMLElement).style.width)
  };
}

/** The last band the node published, or `undefined` if it has published nothing. */
function lastBand(ports: ReturnType<typeof reportingPorts>): string | undefined {
  const calls = ports.onBreakpointChanged.mock.calls;
  return calls.length ? (calls[calls.length - 1][0] as string) : undefined;
}

afterEach(() => {
  delete (globalThis as never as Record<string, unknown>).ResizeObserver;
  delete (dom.window as never as Record<string, unknown>).ResizeObserver;
  dom.window.document.body.innerHTML = '';
});

describe('AC1 — the node publishes the band it is at, as the container narrows', () => {
  it('reads Default, then Medium, then Small', async () => {
    const observer = installResizeObserver();
    const ports = reportingPorts();
    await mountColumns(columnsProps(ports), THREE_CHILDREN);

    // The unmeasured first render. It is genuinely the authored layout, and an output nobody
    // has written reads `undefined` at every sink — so it publishes rather than staying silent.
    expect(lastBand(ports)).toBe('Default');

    await observer.fire(WIDE);
    expect(lastBand(ports)).toBe('Default');

    await observer.fire(MEDIUM);
    expect(lastBand(ports)).toBe('Medium');

    await observer.fire(NARROW);
    expect(lastBand(ports)).toBe('Small');

    // Widening reports its way back up: this is a reading, not a one-way latch.
    await observer.fire(WIDE);
    expect(lastBand(ports)).toBe('Default');

    expect(observer.observerCalls).toBeGreaterThan(0);
  });

  it('control: with the observer never reporting, the band never leaves Default', async () => {
    const observer = installResizeObserver({ broken: true });
    const ports = reportingPorts();
    await mountColumns(columnsProps(ports), THREE_CHILDREN);

    // `fire` on a broken observer sets the widths and calls nothing back — the node is armed
    // and unmeasured, which is exactly what #21 left every childless-mounted node in.
    await observer.fire(NARROW);

    expect(lastBand(ports)).toBe('Default');
    expect(ports.onAtSmall).toHaveBeenCalledTimes(0);
    expect(ports.onAtMedium).toHaveBeenCalledTimes(0);
    expect(observer.observerCalls).toBeGreaterThan(0);
  });

  it('a breakpoint with no layout beside it stays inert, and is reported as Default', async () => {
    const observer = installResizeObserver();
    const ports = reportingPorts();
    await mountColumns(
      columnsProps({ ...ports, mediumLayout: '', smallLayout: '' }),
      THREE_CHILDREN
    );

    await observer.fire(NARROW);

    // Nothing was applied, so nothing is announced. Reporting `Small` here would name a layout
    // that is not on screen — the one thing these ports exist to make impossible.
    expect(lastBand(ports)).toBe('Default');
    expect(ports.onAtSmall).toHaveBeenCalledTimes(0);
  });
});

describe('AC2 — the signals fire on transition only, and exactly once', () => {
  it('crossing a boundary fires exactly one signal; resizing within a band fires none', async () => {
    const observer = installResizeObserver();
    const ports = reportingPorts();
    await mountColumns(columnsProps(ports), THREE_CHILDREN);

    await observer.fire(WIDE);
    expect(ports.onAtMedium).toHaveBeenCalledTimes(0);
    expect(ports.onAtSmall).toHaveBeenCalledTimes(0);

    await observer.fire(MEDIUM);
    expect(ports.onAtMedium).toHaveBeenCalledTimes(1);
    expect(ports.onAtSmall).toHaveBeenCalledTimes(0);

    // 884 → 934. A different width, the same band. A signal fired from render rather than from
    // an effect keyed on the band reads this as another crossing.
    await observer.fire(MEDIUM_AGAIN);
    expect(ports.onAtMedium).toHaveBeenCalledTimes(1);

    await observer.fire(NARROW);
    expect(ports.onAtSmall).toHaveBeenCalledTimes(1);
    expect(ports.onAtMedium).toHaveBeenCalledTimes(1);

    // Back up through Medium — a crossing in either direction is a crossing.
    await observer.fire(MEDIUM);
    expect(ports.onAtMedium).toHaveBeenCalledTimes(2);
    expect(ports.onAtSmall).toHaveBeenCalledTimes(1);
  });

  it('a re-render that changes nothing about the width fires nothing', async () => {
    const observer = installResizeObserver();
    const ports = reportingPorts();
    const view = await mountColumns(columnsProps(ports), THREE_CHILDREN);

    await observer.fire(NARROW);
    expect(ports.onAtSmall).toHaveBeenCalledTimes(1);
    const publishedSoFar = ports.onBreakpointChanged.mock.calls.length;

    // The `forceUpdate()` path: a re-render through the same root with an unchanged key, which
    // is how children arrive and how every input port write lands. This is the trap the task
    // names — it happens constantly, and it has nothing to do with the width.
    await view.render(columnsProps(ports), [...THREE_CHILDREN, child('d')]);
    await view.render(columnsProps({ ...ports, marginY: '24px' }), [...THREE_CHILDREN, child('d')]);

    expect(ports.onAtSmall).toHaveBeenCalledTimes(1);
    expect(ports.onAtMedium).toHaveBeenCalledTimes(0);
    expect(ports.onBreakpointChanged).toHaveBeenCalledTimes(publishedSoFar);
  });

  it('the string publishes once per band, not once per render', async () => {
    const observer = installResizeObserver();
    const ports = reportingPorts();
    await mountColumns(columnsProps(ports), THREE_CHILDREN);

    await observer.fire(WIDE);
    await observer.fire(MEDIUM);
    await observer.fire(MEDIUM_AGAIN);
    await observer.fire(NARROW);

    // Default (the unmeasured first render, which WIDE agrees with), Medium, Small. Three.
    expect(ports.onBreakpointChanged.mock.calls.map((c) => c[0])).toEqual(['Default', 'Medium', 'Small']);
  });
});

describe('AC3 — the band reported is the band whose layout is on screen', () => {
  /**
   * Derived from the report, never asserted beside it.
   *
   * The expectation is built by looking the reported band up in the authored strings and doing
   * the width arithmetic here. If the component ever grew a second derivation of "which band" —
   * which is what the States-node workaround in the field is — this is the assertion that would
   * catch the two disagreeing.
   */
  const agrees = (band: string | undefined, widths: string[]) => {
    expect(band).toBeDefined();
    expect(widths).toEqual(widthsFor(LAYOUTS[band as string], THREE_CHILDREN.length));
  };

  it('agrees at every width, in both directions', async () => {
    const observer = installResizeObserver();
    const ports = reportingPorts();
    const view = await mountColumns(columnsProps(ports), THREE_CHILDREN);

    for (const width of [WIDE, MEDIUM, NARROW, MEDIUM_AGAIN, WIDE]) {
      await observer.fire(width);
      agrees(lastBand(ports), view.itemWidths());
    }
  });

  it('control: the three bands really do render differently, so agreement can fail', async () => {
    // Without this, `agrees` would pass on a component that rendered one layout at every width
    // and reported one band at every width — the two would agree perfectly and mean nothing.
    const seen = new Set<string>();
    const observer = installResizeObserver();
    const ports = reportingPorts();
    const view = await mountColumns(columnsProps(ports), THREE_CHILDREN);

    for (const width of [WIDE, MEDIUM, NARROW]) {
      await observer.fire(width);
      seen.add(view.itemWidths().join(','));
    }

    expect(seen.size).toBe(3);
  });

  it('Auto Fit reports Default, because no layout string is in force', async () => {
    const observer = installResizeObserver();
    const ports = reportingPorts();
    const view = await mountColumns(
      columnsProps({ ...ports, sizing: 'autoFit', minWidth: '200px' }),
      THREE_CHILDREN
    );

    // 484 of container holds two 200px columns with a 16px gutter, so the rendered layout is
    // neither `smallLayout` nor the authored one — it is Auto Fit's own. Naming a band here
    // would name a string nothing on screen came from.
    await observer.fire(NARROW);

    expect(lastBand(ports)).toBe('Default');
    expect(ports.onAtSmall).toHaveBeenCalledTimes(0);
    expect(view.itemWidths()).toEqual(new Array(3).fill('50%'));
  });
});

describe('AC4 — the enrichment names every port in the Breakpoints group', () => {
  const REPO = path.resolve(__dirname, '..', '..', '..', '..');
  const TYPE = 'net.noodl.visual.columns';

  /**
   * The **enriched** catalog, not the authored file under `docs/`.
   *
   * That is the artifact the node picker preview renders and the MCP authoring loop is served,
   * so it is the one whose silence teaches a person and an agent the wrong thing. Asserting on
   * the authored source instead would pass on a merge that was never run.
   */
  const enriched = JSON.parse(
    fs.readFileSync(path.join(REPO, 'packages/noodl-types/src/node-catalog-enriched.json'), 'utf8')
  ) as { nodes: Array<{ typeName: string; inputs: PortRow[]; outputs: PortRow[]; enrichment?: { ports?: Record<string, string> } }> };

  type PortRow = { name: string; group?: string };

  const columns = enriched.nodes.find((n) => n.typeName === TYPE)!;
  const breakpointPorts = [...columns.inputs, ...columns.outputs]
    .filter((p) => p.group === 'Breakpoints')
    .map((p) => p.name)
    .sort();

  it('the group is not empty, so the rule below has something to hold', () => {
    // The arming assertion. A `group` renamed or a catalog not regenerated leaves this list
    // empty, and "every port in an empty list is documented" is a green that grades nothing.
    expect(breakpointPorts).toEqual([
      'mediumBreakpoint',
      'mediumLayout',
      'onAtMedium',
      'onAtSmall',
      'onBreakpointChanged',
      'smallBreakpoint',
      'smallLayout'
    ]);
  });

  it('every one of them has a port note', () => {
    // Before FLD-002 the enrichment described `minWidth` as "what makes the grid responsive"
    // and mentioned none of the four breakpoint inputs that had shipped beside it. This is the
    // rule that stops the next port added here leaving the docs behind.
    const documented = Object.keys(columns.enrichment?.ports ?? {});
    expect(breakpointPorts.filter((name) => !documented.includes(name))).toEqual([]);
  });

  it('the description tells a reader the ports exist at all', () => {
    // A port note is only read once somebody is looking at that port. The prose is what the
    // picker preview and the authoring loop read first.
    const description = (columns.enrichment as { description?: string } | undefined)?.description ?? '';
    expect(description).toContain('onBreakpointChanged');
    expect(description).toContain('container');
  });
});
