/**
 * The Dropdown's visible label — the `<span>` that IS the node on screen.
 *
 * 🔴 **`Select.tsx` had no render coverage at all before this file**, which is how
 * `props.items.items.length` survived from the initial commit of 2024-01-26. It sits behind
 * `selectedIndex >= 0`, and `selectedIndex` is -1 whenever `value` is undefined — so it was
 * unreachable for every Dropdown nobody had chosen from, and threw for every one that had.
 *
 * `4672d924` seeded `value` with the first default item so a freshly placed node would draw
 * something rather than collapsing to a sliver. That made this reachable on placement: the node it
 * was meant to make visible threw instead. Found while moving `items` to the `optionslist` port
 * type (§3 of NOTES-UNOWNED-NODE-WORK.md).
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { Select } from '../src/components/controls/Select/Select';

const ITEMS = [
  { Label: 'Option 1', Value: 'option-1' },
  { Label: 'Option 2', Value: 'option-2' }
];

function render(overrides: Record<string, unknown> = {}): string {
  const props = {
    id: 'dropdown-test',
    items: ITEMS,
    value: undefined,
    style: {},
    dom: {},
    styles: {},
    placeholder: '',
    placeholderOpacity: 1,
    ...overrides
  };
  return renderToStaticMarkup(React.createElement(Select as never, props as never));
}

describe('NAT-DROPDOWN-001 — the selected option is drawn, and drawing it does not throw', () => {
  it('🔴 renders the selected label instead of throwing', () => {
    // The whole defect in one row. Before the fix this raised
    // `TypeError: Cannot read properties of undefined (reading 'length')`.
    expect(render({ value: 'option-1' })).toContain('Option 1</span>');
  });

  it('renders the SECOND option when that is the one selected', () => {
    // A control on the row above: an off-by-one or a hard-coded [0] would pass that one and fail
    // this one.
    const html = render({ value: 'option-2' });
    expect(html).toContain('Option 2</span>');
  });

  it('🔴 a freshly placed Dropdown draws its first default item', () => {
    // Richard's actual ask, end to end: `options.ts` seeds `value` with `DEFAULT_ITEMS[0].Value`,
    // and this is the assertion that the seed reaches the screen rather than the error path.
    expect(render({ value: 'option-1' })).toMatch(/<span[^>]*>Option 1<\/span>/);
  });

  it('falls back to the placeholder when nothing is selected', () => {
    expect(render({ value: undefined, placeholder: 'Pick one' })).toContain('Pick one');
  });

  it('⚠️ draws the placeholder when the value matches no option', () => {
    // The §C-registered case: an author replaces `items` with their own list and never sets
    // `value`, so the seeded `option-1` matches nothing. It must not throw, and it must not draw
    // a blank — which is what a placeholder is for.
    const html = render({ items: [{ Label: 'Red', Value: 'red' }], value: 'option-1', placeholder: 'Choose' });
    expect(html).toContain('Choose');
  });

  it('renders every option into the native select', () => {
    const html = render({ value: 'option-1' });
    expect(html).toContain('value="option-1"');
    expect(html).toContain('value="option-2"');
  });

  it('does not throw with no items at all', () => {
    // `EMPTY-VALUE-CONTRACT`: a cleared Dropdown offers nothing and still renders.
    expect(() => render({ items: undefined, value: 'option-1' })).not.toThrow();
    expect(() => render({ items: [], value: 'option-1' })).not.toThrow();
  });
});
