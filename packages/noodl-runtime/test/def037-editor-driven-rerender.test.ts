/**
 * DEF-037 — a style port whose effect needs a sibling property was inert until the preview
 * reloaded.
 *
 * ## What the defect actually was
 *
 * `setStyle` in `react-component-node.ts` patches the changed declaration straight onto the DOM
 * node and re-runs render only for a hard-coded allowlist. That is right for a value the browser
 * reads directly, and wrong for one the *component* re-reads at render to derive something else:
 * `Text` decides `whiteSpace`/`overflow` from `textOverflow` and then deletes it, `Checkbox`
 * copies `width`/`height` onto its inner `<input>`. Those never recomputed, so the port looked
 * broken — set Ellipsis, nothing happens; set it back to Wrap, nothing happens either.
 *
 * 🔴 **Richard ruled the class, not the ports** (2026-08-31): *"the preview is supposed to be a
 * true, live, auto updating view of what's in the node canvas at all times."* Hand-annotating the
 * four known ports with an `onChange` was overruled on principle — that is precisely how
 * `Checkbox` came to be missed while its identically-declared sibling `Radio Button` was fixed.
 *
 * ## Why an editor/runtime split, and why the control below is the whole test
 *
 * The DOM fast path is not pointless: it exists for a **wire animating a style per frame**. An
 * author dragging a colour picker is not that — it happens at human speed and nothing is gained
 * by bypassing React. So an editor-driven parameter change always re-renders, and a
 * connection-driven one keeps the fast path.
 *
 * That split is only meaningful if the two are actually distinguishable, so the rows here assert
 * **both arms against one another**. A test that only proved "setParameter re-renders" would pass
 * just as well against a build that re-rendered on *everything* — which is the change the ruling
 * did not ask for and the one with the unmeasured performance cost.
 *
 * ⚠️ **What this file cannot see.** It grades the runtime seam — *when* a re-render is asked for.
 * Whether the resulting render actually fixes the visible defect is a property of the React
 * components and is graded by driving a real editor (AC1/AC2/AC5), plus the `styleTag` half of
 * the fix, which lives in `react-component-node.ts` and is not reachable from this package.
 */

/* eslint-env jest */

import type { NodeInstance } from '@noodl/types';

import type { RuntimeNode } from '../src/internal';

import { createGraph, type TestNode } from './helpers/node-harness';

import NodeModel = require('../src/models/nodemodel');

/** A node with one ordinary value input — the smallest thing a parameter can land on. */
const testModule = {
  node: {
    name: 'test.Styled',
    category: 'Test',
    initialize: function (this: NodeInstance) {
      this._internal.seen = [];
    },
    inputs: {
      colour: {
        type: 'string',
        default: '',
        set: function (this: NodeInstance, value: string) {
          (this._internal.seen as string[]).push(value);
        }
      }
    },
    outputs: {}
  }
};

interface Harness {
  node: TestNode;
  model: InstanceType<typeof NodeModel>;
  /** How many times the node has been asked to re-render. */
  renders: () => number;
  /** Values that actually reached the input setter, in order. */
  applied: () => string[];
  flush: () => void;
}

function makeHarness(options: { reactBacked?: boolean } = {}): Harness {
  const { reactBacked = true } = options;

  const graph = createGraph(testModule);
  const node = graph.make('test.Styled', 'styled-1');
  const model = new NodeModel('styled-1', 'test.Styled');

  let renders = 0;
  if (reactBacked) {
    // Stands in for `react-component-node.ts`'s `_rerenderReactNode`, which is a bare
    // `this.forceUpdate()`. Only React-backed nodes carry it; a plain logic node has nothing
    // to render and must not be asked to.
    (node as RuntimeNode)._rerenderReactNode = () => {
      renders++;
    };
  }

  node.setNodeModel(model);

  return {
    node,
    model,
    renders: () => renders,
    applied: () => (node._internal as { seen: string[] }).seen,
    flush: () => graph.context.updateDirtyNodes()
  };
}

describe('DEF-037 — an editor-driven parameter change re-renders; a wire-driven one does not', () => {
  it('re-renders when the editor sets a parameter', () => {
    const h = makeHarness();

    h.model.setParameter('colour', 'red');
    h.flush();

    expect(h.applied()).toEqual(['red']);
    expect(h.renders()).toBe(1);
  });

  /**
   * 🔴 **The control, and the reason this file exists.** Same node, same port, same value —
   * delivered the way a *connection* delivers it. If this ever goes to 1, the fix has stopped
   * being "always truthful in the editor" and become "always re-render", which is a different
   * change with a cost nobody has measured.
   */
  it('does NOT re-render when a connection drives the same input', () => {
    const h = makeHarness();

    h.node._setValueFromConnection('colour', 'red');
    h.flush();

    // The value must still arrive — otherwise this row would pass against a node that simply
    // ignored connection input, and prove nothing about re-rendering.
    expect(h.applied()).toEqual(['red']);
    expect(h.renders()).toBe(0);
  });

  /**
   * The two arms in one pass, so the assertion is a *difference* rather than two absolutes read
   * from two separate fixtures.
   */
  it('separates the two causes on the same node', () => {
    const h = makeHarness();

    h.node._setValueFromConnection('colour', 'from-wire');
    h.flush();
    const afterWire = h.renders();

    h.model.setParameter('colour', 'from-editor');
    h.flush();
    const afterEditor = h.renders();

    expect(afterWire).toBe(0);
    expect(afterEditor).toBe(1);
    expect(h.applied()).toEqual(['from-wire', 'from-editor']);
  });

  it('costs one re-render when several parameters change in the same pass', () => {
    const h = makeHarness();

    h.model.setParameter('colour', 'a');
    h.model.setParameter('colour', 'b');
    h.model.setParameter('colour', 'c');
    h.flush();

    expect(h.renders()).toBe(1);
  });

  it('re-renders again on a later pass, rather than latching after the first', () => {
    const h = makeHarness();

    h.model.setParameter('colour', 'a');
    h.flush();
    h.model.setParameter('colour', 'b');
    h.flush();

    expect(h.renders()).toBe(2);
  });

  /**
   * A logic node has no render. The hook is absent there, and asking for one must be a no-op
   * rather than a crash — `_onNodeModelParameterUpdated` runs for every node type in the graph,
   * not only the visual ones.
   */
  it('is inert on a node that does not render', () => {
    const h = makeHarness({ reactBacked: false });

    expect(() => {
      h.model.setParameter('colour', 'red');
      h.flush();
    }).not.toThrow();

    expect(h.applied()).toEqual(['red']);
  });
});
