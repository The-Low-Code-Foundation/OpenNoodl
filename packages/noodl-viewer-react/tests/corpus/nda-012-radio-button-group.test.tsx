/**
 * NDA-012 (Visual) — `Radio Button`'s two remaining cells, `A1` and `F1`.
 *
 * - **`A1`** — the node had **no `Changed` output at all**, unlike both `Checkbox` and
 *   `Radio Button Group`. A selection could only be observed by polling `Checked` or by wiring
 *   the group instead of the button the author was actually looking at.
 * - **`F1`** — the category's only instance of defect class F. The group is resolved through a
 *   React context and cannot be named: there is no `Group` port, and a Radio Button rendered
 *   outside a group is *visibly a control and functionally inert*, with nothing said anywhere.
 *
 * ## What `F1` closes here, and what it does not
 *
 * Class F's remedy in `FINDINGS.md` has two halves: **an optional explicit target**, and **a
 * visible indication of what was resolved when it is left implicit**. Only the second is built
 * here. Naming a group needs a name→group registry of the kind `Component Stack` and
 * `Page Router` have (which is exactly why both of *their* `F1` cells pass), and inventing one
 * for this node alone is a design change, not a remediation. ⚠️ **`F1` is therefore reported,
 * not closed** — recorded honestly rather than counted.
 *
 * ## The bug the fix uncovered
 *
 * `RadioButtonContext`'s default was an **object** with undefined fields — which is truthy. So
 * `radioButtonGroup ? radioButtonGroup.selected === props.value : false` took the first branch
 * whether or not a group existed, and compared `undefined === props.value`. A groupless Radio
 * Button with no `Value` therefore rendered **checked**, permanently, and could not be
 * unchecked. The default is `null` now, which is what makes the condition detectable at all.
 */

/* eslint-env jest */

import React from 'react';

import type { NodeInstance } from '@noodl/types';

import { createCorpusGraph, type CorpusGraph } from '../../../noodl-runtime/test/corpus/graph-harness';

(globalThis as unknown as { Noodl: unknown }).Noodl = { deployed: true, baseUrl: '/' };

/**
 * A hand-made DOM.
 *
 * ⚠️ This package's jest runs `testEnvironment: node` and `jest-environment-jsdom` is not in the
 * tree, so there is no `@jest-environment jsdom` docblock available. Both cells are **effect**
 * behaviour — `Changed` fires from the same `useEffect` the `A3` fix introduced, and the
 * missing-group report is another — so `renderToStaticMarkup`, which runs no effects, cannot
 * measure either. jsdom is constructed directly instead.
 */
/* eslint-disable @typescript-eslint/no-var-requires */
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><html><body></body></html>');
(globalThis as never as Record<string, unknown>).window = dom.window;
(globalThis as never as Record<string, unknown>).document = dom.window.document;
(globalThis as never as Record<string, unknown>).navigator = dom.window.navigator;
(globalThis as never as Record<string, unknown>).HTMLElement = dom.window.HTMLElement;
(globalThis as never as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const { createRoot } = require('react-dom/client');
const { act } = require('react');

const { RadioButton } = require('../../src/components/controls/RadioButton');
const { RadioButtonGroup } = require('../../src/components/controls/RadioButtonGroup');
const RadioButtonModule = require('../../src/nodes/controls/radiobutton').default;
/* eslint-enable @typescript-eslint/no-var-requires */

/** Props both components read that have nothing to do with what is measured. */
function baseProps(overrides: Record<string, unknown> = {}) {
  return {
    style: {},
    className: '',
    styles: { radio: {}, fill: {}, label: {} },
    noodlNode: {
      context: { styles: { resolveColor: (c: unknown) => c } },
      getDOMElement: () => null
    },
    ...overrides
  };
}

function radioProps(value: string, extra: Record<string, unknown> = {}) {
  return baseProps({
    id: 'input-' + value,
    enabled: true,
    value,
    useLabel: false,
    useIcon: false,
    label: '',
    labelSpacing: '0px',
    labeltextStyle: {},
    fillSpacing: '2px',
    ...extra
  });
}

/** Mount a tree, run its effects, and hand back the container plus a re-render function. */
async function mount(element: React.ReactElement) {
  const container = dom.window.document.createElement('div');
  dom.window.document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(element);
  });

  return {
    container,
    rerender: async (next: React.ReactElement) => {
      await act(async () => {
        root.render(next);
      });
    },
    click: async (input: HTMLInputElement) => {
      await act(async () => {
        input.click();
      });
    }
  };
}

/** Every `checkedChanged` call a radio made, as `[checked, fromUser]`. */
function recorder() {
  const seen: Array<[boolean, boolean]> = [];
  return {
    seen,
    checkedChanged: (checked: boolean, fromUser: boolean) => seen.push([checked, fromUser])
  };
}

describe('A1 — a Radio Button can tell the graph the user selected it', () => {
  it('reports a click as a user-driven change', async () => {
    const a = recorder();
    const b = recorder();

    const view = await mount(
      React.createElement(
        RadioButtonGroup,
        baseProps({ name: 'g', value: 'a', children: null }) as never,
        React.createElement(RadioButton, radioProps('a', { checkedChanged: a.checkedChanged }) as never),
        React.createElement(RadioButton, radioProps('b', { checkedChanged: b.checkedChanged }) as never)
      )
    );

    a.seen.length = 0;
    b.seen.length = 0;

    const inputs = view.container.querySelectorAll('input[type=radio]');
    await view.click(inputs[1] as HTMLInputElement);

    // B became the selection and A stopped being it — both are changes, both by the user.
    expect(b.seen).toContainEqual([true, true]);
    expect(a.seen).toContainEqual([false, true]);
  });

  // ⚠️ The discriminating half of the pair. Without this row, `fromUser` could be hard-coded
  // `true` and the row above would still pass.
  it('does not report a graph-set group Value as a user-driven change', async () => {
    const a = recorder();
    const b = recorder();

    const tree = (value: string) =>
      React.createElement(
        RadioButtonGroup,
        baseProps({ name: 'g', value, children: null }) as never,
        React.createElement(RadioButton, radioProps('a', { checkedChanged: a.checkedChanged }) as never),
        React.createElement(RadioButton, radioProps('b', { checkedChanged: b.checkedChanged }) as never)
      );

    const view = await mount(tree('a'));
    a.seen.length = 0;
    b.seen.length = 0;

    // The graph writing the group's `Value` — the path `Radio Button Group`'s own `Changed`
    // deliberately stays silent for.
    await view.rerender(tree('b'));

    expect(b.seen).toContainEqual([true, false]);
    expect(b.seen).not.toContainEqual([true, true]);
  });

  it('the node fires Changed for a click and stays silent for a graph-set value', async () => {
    const graph: CorpusGraph = await createCorpusGraph({
      modules: [RadioButtonModule as never],
      data: {
        components: [{ name: '/root', nodes: [{ id: 'radio', type: 'net.noodl.controls.radiobutton' }] }]
      } as never
    });
    (graph.context as unknown as { styles: unknown }).styles = {
      getTextStyle: () => ({}),
      resolveColor: (c: unknown) => c
    };
    graph.update();

    const node = graph.node('radio') as unknown as NodeInstance & {
      props: { checkedChanged(checked: boolean, fromUser: boolean): void };
    };

    const signals: string[] = [];
    (node as unknown as { sendSignalOnOutput(name: string): void }).sendSignalOnOutput = (name) => signals.push(name);

    node.props.checkedChanged(true, false);
    expect(signals).toEqual([]);

    node.props.checkedChanged(false, true);
    expect(signals).toEqual(['onChange']);

    // Not a change at all: `Changed` must not fire for a repeat of the same checked-ness.
    node.props.checkedChanged(false, true);
    expect(signals).toEqual(['onChange']);
  });

  it('declares the Changed output the way its two siblings do', () => {
    const outputs = (RadioButtonModule as { node: { outputs: Record<string, { type: string; displayName: string }> } })
      .node.outputs;

    expect(outputs.onChange).toBeDefined();
    expect(outputs.onChange.type).toBe('signal');
    expect(outputs.onChange.displayName).toBe('Changed');
  });
});

describe('F1 — a Radio Button outside a group says so instead of being quietly inert', () => {
  it('reports the missing group', async () => {
    const missing: number[] = [];

    await mount(
      React.createElement(
        RadioButton,
        radioProps('a', { checkedChanged: () => undefined, groupMissing: () => missing.push(1) }) as never
      )
    );

    expect(missing).toHaveLength(1);
  });

  // The control. A button that *is* in a group must never report, or the diagnosis is noise.
  it('says nothing when there is a group', async () => {
    const missing: number[] = [];

    await mount(
      React.createElement(
        RadioButtonGroup,
        baseProps({ name: 'g', value: 'a', children: null }) as never,
        React.createElement(
          RadioButton,
          radioProps('a', { checkedChanged: () => undefined, groupMissing: () => missing.push(1) }) as never
        )
      )
    );

    expect(missing).toHaveLength(0);
  });

  // ⚠️ The truthy-default consequence, which nothing had ever looked at. With the old context
  // default this rendered `checked`, because `undefined === undefined`.
  it('a groupless button with no Value renders unchecked rather than permanently checked', async () => {
    const view = await mount(
      React.createElement(
        RadioButton,
        radioProps(undefined as never, { checkedChanged: () => undefined }) as never
      )
    );

    const input = view.container.querySelector('input[type=radio]') as HTMLInputElement;
    expect(input.checked).toBe(false);
  });

  it('the node raises the missing group on the runtime error bus', async () => {
    const graph: CorpusGraph = await createCorpusGraph({
      modules: [RadioButtonModule as never],
      data: {
        components: [{ name: '/root', nodes: [{ id: 'radio', type: 'net.noodl.controls.radiobutton' }] }]
      } as never
    });
    (graph.context as unknown as { styles: unknown }).styles = {
      getTextStyle: () => ({}),
      resolveColor: (c: unknown) => c
    };
    graph.update();

    const node = graph.node('radio') as unknown as { props: { groupMissing(): void } };
    node.props.groupMissing();

    expect(graph.errors.map((e) => e.code)).toEqual(['radio-button/no-group']);
    expect(graph.errors[0].message).toContain('not inside a Radio Button Group');
  });
});
