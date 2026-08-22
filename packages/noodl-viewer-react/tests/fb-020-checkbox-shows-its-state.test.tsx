/**
 * FB-020 — a checkbox that could not be seen to be checked.
 *
 * Richard and a test user (Jordan, session 2 §7) reported the same thing independently:
 * add a checkbox, run preview, click it, nothing happens. Jordan concluded that boxes are
 * simply not checkable by default.
 *
 * The drive (2026-08-22) showed the click was never the problem. `input.checked` went true,
 * `_internal.checked` went true, the `Checked` output propagated to a connected Text node.
 * Three separate things had to be off for the tick to have nowhere to come from:
 *
 *   1. the real `<input>` is `opacity: 0` (assets/style.css) — it can never be the mark,
 *   2. `iconIconSource` ships no default, so `_renderIcon()` returned null,
 *   3. `setVisualStates(['checked'])` applies only parameters an author already configured,
 *      and a fresh node has none.
 *
 * A control checkbox carrying a `checked` state parameter turned red on the same click, which
 * is what proved the mechanism alive and the default missing rather than the mechanism broken.
 *
 * These tests render the real components with `renderToStaticMarkup` — hooks and all — because
 * the defect was in what reaches the screen, and grade the node definition separately for the
 * state it keeps.
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { Checkbox } from '../src/components/controls/Checkbox';
import { RadioButton } from '../src/components/controls/RadioButton';
import CheckBoxNodeModule from '../src/nodes/controls/checkbox';

type AnyProps = Record<string, unknown>;

/**
 * The props a Checkbox actually reads. Deliberately minimal: every field here is one the
 * runtime sets for a node with no author configuration at all, which is the case that broke.
 */
function checkboxProps(overrides: AnyProps = {}): AnyProps {
  return {
    id: 'input-test',
    enabled: true,
    checked: false,
    useLabel: false,
    useIcon: true,
    iconSourceType: 'icon',
    iconIconSource: undefined,
    iconImageSource: undefined,
    iconSize: '16px',
    iconColor: '#FFFFFF',
    style: {},
    styles: {
      // Borders arrive per side. `borderColor` is never present, which is the trap that made
      // the first version of this fix fall through to `currentColor` and look right by luck.
      checkbox: { width: '32px', height: '32px', borderTopColor: '#000000' },
      label: {}
    },
    parentLayout: 'block',
    checkedChanged: () => undefined,
    ...overrides
  };
}

function renderCheckbox(overrides: AnyProps = {}) {
  return renderToStaticMarkup(React.createElement(Checkbox as never, checkboxProps(overrides) as never));
}

/**
 * Just the default tick's own element. Colour assertions have to be scoped to it: the box's
 * border sits in the same markup carrying the same colour, so a match against the whole string
 * is satisfied whether or not a tick was ever drawn.
 */
function tickMarkup(html: string): string {
  const match = html.match(/<svg[^>]*data-ndl-default-check[^>]*>/);
  return match ? match[0] : '';
}

/** Likewise for the radio's dot, which is the one element carrying `noodl-style-tag="fill"`. */
function fillMarkup(html: string): string {
  const match = html.match(/<div[^>]*noodl-style-tag="fill"[^>]*>/);
  return match ? match[0] : '';
}

describe('FB-020 — a fresh checkbox shows that it is checked', () => {
  it('draws no mark while it is unchecked', () => {
    expect(renderCheckbox({ checked: false })).not.toContain('data-ndl-default-check');
  });

  it('draws a tick when it is checked, with no author configuration at all', () => {
    // The whole bug, in one assertion.
    expect(renderCheckbox({ checked: true })).toContain('data-ndl-default-check');
  });

  it('draws the tick in the border colour, not the inherited text colour', () => {
    // `currentColor` renders black on this page and invisible on a dark one, so a tick that
    // merely *appears* in a light-themed test is not evidence of anything.
    //
    // ⚠️ Scoped to the tick's own element on purpose. Asserting the colour against the whole
    // markup passes on the unfixed component, because the wrapper's border carries the very
    // same value — the assertion fits without excluding anything, and grades nothing.
    const html = renderCheckbox({ checked: true, styles: { checkbox: { borderTopColor: '#123456' }, label: {} } });
    expect(tickMarkup(html)).toContain('#123456');
  });

  it('yields to an author icon rather than drawing two marks', () => {
    const html = renderCheckbox({ checked: true, iconIconSource: { codeAsClass: 'fa fa-check' } });
    expect(html).not.toContain('data-ndl-default-check');
  });

  it('yields to an author image source too', () => {
    const html = renderCheckbox({ checked: true, iconSourceType: 'image', iconImageSource: '/tick.png' });
    expect(html).not.toContain('data-ndl-default-check');
  });

  it('draws nothing when the author has turned Enable Icon off', () => {
    // An explicit choice: the author is styling the checked state themselves.
    expect(renderCheckbox({ checked: true, useIcon: false })).not.toContain('data-ndl-default-check');
  });
});

/**
 * The Radio Button had the same defect from the other side, and needed the same drive to see:
 * `fillColor` ships no default and `initialize` sets `props.styles.fill = {}`, so the dot was
 * `backgroundColor: undefined` and a fresh button looked identical selected or not.
 *
 * It also painted that dot on *every* button in the group rather than the selected one, so an
 * author who set `Fill Color` as a plain parameter got a filled dot on every option. Only a
 * colour set on the checked visual state ever worked, and nothing said so.
 */
function radioProps(overrides: AnyProps = {}): AnyProps {
  return {
    id: 'input-radio',
    enabled: true,
    value: 'a',
    useLabel: false,
    useIcon: false,
    iconSourceType: 'icon',
    iconSize: '16px',
    fillSpacing: '2px',
    style: {},
    styles: {
      radio: { width: '32px', height: '32px', borderTopColor: '#000000' },
      label: {},
      fill: {}
    },
    parentLayout: 'block',
    checkedChanged: () => undefined,
    ...overrides
  };
}

/** The group is reached through React context; `selected` is what decides `checked`. */
function renderRadio(selected: string | null, overrides: AnyProps = {}) {
  const RadioButtonContext = require('../src/contexts/radiobuttoncontext').default;
  return renderToStaticMarkup(
    React.createElement(
      RadioButtonContext.Provider,
      { value: selected === null ? null : { selected, name: 'g', checkedChanged: () => undefined } },
      React.createElement(RadioButton as never, radioProps(overrides) as never)
    )
  );
}

describe('FB-020 AC4 — a fresh radio button shows that it is selected', () => {
  it('fills the dot with the border colour when it is the selection', () => {
    // Scoped to the dot for the same reason as the checkbox's tick — the button's border
    // carries this colour too, so an unscoped match proves nothing.
    expect(fillMarkup(renderRadio('a'))).toContain('#000000');
  });

  it('leaves the dot unpainted when it is not the selection', () => {
    expect(fillMarkup(renderRadio('b'))).not.toContain('background-color');
  });

  it('keeps an author fill colour on the selected button', () => {
    const html = renderRadio('a', { styles: { radio: {}, label: {}, fill: { backgroundColor: '#00AA00' } } });
    expect(fillMarkup(html)).toContain('#00AA00');
  });

  it('no longer paints an author fill colour on the unselected buttons', () => {
    // The regression this fix removes: green dots on every option in the group at once.
    const html = renderRadio('b', { styles: { radio: {}, label: {}, fill: { backgroundColor: '#00AA00' } } });
    expect(fillMarkup(html)).not.toContain('#00AA00');
  });
});

/**
 * The second, latent half of FB-020, found by reading and then confirmed live: the user-click
 * path never wrote `props.checked`, unlike the `checked` input setter and `setCheckedByAction`
 * which both do. After a click the drive read `_internal.checked: true` beside
 * `props.checked: false` on every clicked box.
 *
 * The consequence is worse than a stale pixel. On any remount the component re-seeds its local
 * state from that stale `false`, so the box renders unchecked while the output still says true —
 * and the next click then computes `changed` as false and fires *nothing at all*. A box that had
 * been ticked once could go permanently quiet.
 */
describe('FB-020 — the user-click path keeps props and internal state in step', () => {
  /**
   * The node's `initialize` is the composed one — border, shadow, icon, label and control-state
   * mixins have all wrapped it by the time it is exported — so the definition's own methods have
   * to be bound on first, the way the runtime binds them. Same approach as
   * `deprecated-node-defects.test.ts`; the style calls are stubbed because none of this is about
   * CSS.
   */
  function makeNode() {
    const dirtied: string[] = [];
    const signals: string[] = [];
    const definition = (CheckBoxNodeModule as never as {
      node: { initialize: () => void; methods?: Record<string, (...a: unknown[]) => unknown> };
    }).node;

    const node: AnyProps = {
      props: { styles: {} } as AnyProps,
      _internal: {} as AnyProps,
      context: { eventEmitter: { once: () => undefined }, frameNumber: 0 }
    };

    for (const key of Object.keys(definition.methods || {})) {
      node[key] = (definition.methods as Record<string, (...a: unknown[]) => unknown>)[key].bind(node);
    }

    // After the bind, so these win: the real `forceUpdate` and `setStyle` want a live runtime
    // context and a rendered tree, and neither is what this describe block is grading.
    Object.assign(node, {
      flagOutputDirty: (name: string) => dirtied.push(name),
      sendSignalOnOutput: (name: string) => signals.push(name),
      _updateVisualState: () => undefined,
      forceUpdate: () => undefined,
      setStyle: () => undefined,
      removeStyle: () => undefined,
      getStyle: () => undefined
    });

    definition.initialize.call(node);
    return { node, dirtied, signals };
  }

  it('starts with props and internal state agreeing', () => {
    const { node } = makeNode();
    expect((node.props as AnyProps).checked).toBe(false);
    expect((node._internal as AnyProps).checked).toBe(false);
  });

  it('writes props.checked when the user ticks the box', () => {
    const { node, dirtied, signals } = makeNode();
    ((node.props as AnyProps).checkedChanged as (v: boolean) => void)(true);

    expect((node._internal as AnyProps).checked).toBe(true);
    // The assertion that would have failed before the fix.
    expect((node.props as AnyProps).checked).toBe(true);
    expect(dirtied).toContain('checked');
    expect(signals).toContain('onChange');
  });

  it('still fires Changed only when the value actually moved', () => {
    const { node, signals } = makeNode();
    const changed = (node.props as AnyProps).checkedChanged as (v: boolean) => void;
    changed(true);
    changed(true);
    expect(signals).toEqual(['onChange']);
  });

  it('survives a remount: re-seeding from props renders the box the output describes', () => {
    const { node } = makeNode();
    ((node.props as AnyProps).checkedChanged as (v: boolean) => void)(true);

    // What a remount does — the component seeds `useState(props.checked)`.
    const html = renderCheckbox({ checked: (node.props as AnyProps).checked as boolean });
    expect(html).toContain('data-ndl-default-check');
  });
});
