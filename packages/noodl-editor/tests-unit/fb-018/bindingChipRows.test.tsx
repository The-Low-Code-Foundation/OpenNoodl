/**
 * FB-018 AC1 + AC3 — a connected row shows the chip instead of an editable-looking field,
 * and stops advertising a "changed" value the connection overrides.
 *
 * ## Where the decision actually lives, and why that is what this grades
 *
 * `PropertyPanelInput` chipped from the start; the ten rows that are NOT built out of it —
 * the number+unit row (Width/Height), the six picker rows, the icon row, the colour row —
 * each wrapped themselves in `PropertyPanelRow` and passed it a label, a value and nothing
 * about the connection. FB-018 put the chip in that row rather than teaching each component
 * to draw one, so `PropertyPanelRow` IS the decision for all ten, and it is pure.
 *
 * ⚠️ `NumberUnitInput`, `PickerTextInput` and `ColorInput` cannot be rendered here at all —
 * they call `useState`/`useEffect`, and this runner has no dispatcher, so they throw rather
 * than return something wrong (see `support/renderElements.ts`). `IconInput` calls no hooks
 * and is rendered end-to-end below; the other three are covered by the seam they pass
 * through plus the live drive in the task file. 🔴 That gap is why AC4 is a DRIVE and not
 * another spec — the wiring from `Dimension` down to the chip is exactly the part a runner
 * without a DOM cannot see.
 */
import React from 'react';

import { BindingChip, bindingTooltip } from '@noodl-core-ui/components/property-panel/BindingChip';
import { PropertyPanelRow } from '@noodl-core-ui/components/property-panel/PropertyPanelInput/PropertyPanelRow';

import { IconInput } from '../../src/editor/src/views/panels/propertyeditor/components/IconInput';
import { byClass, render, text, walk } from '../support/renderElements';

/** The control that a connected row must NOT keep showing. */
function aField() {
  return <input className="the-editable-field" />;
}

describe('FB-018 — PropertyPanelRow is the seam the chip arrives through', () => {
  // 🔴 THE DISCONNECTED ARM IS NOT A FORMALITY. `render()` returns null both for a tree
  // that drew nothing and for a component that never ran, so every "the chip is absent"
  // claim below is only worth anything beside an arm where the field is demonstrably
  // present. One component, one prop different.
  it('draws the row control and no chip when nothing is connected', () => {
    const tree = render(
      <PropertyPanelRow label="Width">
        {aField()}
      </PropertyPanelRow>
    );
    expect(byClass(tree, 'the-editable-field').length).toBe(1);
    expect(byClass(tree, 'Root').filter((n) => n.props.title).length).toBe(0);
  });

  it('replaces the control with the chip when a connection drives the port', () => {
    const tree = render(
      <PropertyPanelRow label="Width" isConnected connectionLabel="Number · Result">
        {aField()}
      </PropertyPanelRow>
    );
    // The field is GONE, not merely outlined — that is the whole filed bug: the test user
    // typed into a field that looked editable and was.
    expect(byClass(tree, 'the-editable-field').length).toBe(0);
    expect(text(tree)).toContain('Bound to');
    expect(text(tree)).toContain('Number · Result');
  });

  it('names the source, and falls back to a generic chip when it cannot be resolved', () => {
    const unnamed = render(
      <PropertyPanelRow label="Width" isConnected>
        {aField()}
      </PropertyPanelRow>
    );
    expect(byClass(unnamed, 'the-editable-field').length).toBe(0);
    expect(text(unnamed)).toContain('Connected');
  });

  it('makes the chip clickable only when there is somewhere to navigate', () => {
    const withNav = render(
      <PropertyPanelRow label="Width" isConnected connectionLabel="A · B" onConnectionClick={() => undefined}>
        {aField()}
      </PropertyPanelRow>
    );
    const withoutNav = render(
      <PropertyPanelRow label="Width" isConnected connectionLabel="A · B">
        {aField()}
      </PropertyPanelRow>
    );
    expect(walk(withNav).some((n) => n.props.role === 'button')).toBe(true);
    expect(walk(withoutNav).some((n) => n.props.role === 'button')).toBe(false);
  });

  // ── AC3 ────────────────────────────────────────────────────────────────────
  //
  // The dot means "this differs from the default, click to reset". On a connected row the
  // stored parameter is the fallback rather than the value, so the dot offers to reset
  // something the screen is not showing.
  it('draws the changed dot on a changed, unconnected row', () => {
    const tree = render(
      <PropertyPanelRow label="Width" isChanged onReset={() => undefined}>
        {aField()}
      </PropertyPanelRow>
    );
    expect(byClass(tree, 'ResetDot').length).toBe(1);
    expect(byClass(tree, 'is-changed').length).toBe(1);
  });

  it('drops the changed dot once a connection drives the same row', () => {
    const tree = render(
      <PropertyPanelRow label="Width" isChanged onReset={() => undefined} isConnected connectionLabel="A · B">
        {aField()}
      </PropertyPanelRow>
    );
    expect(byClass(tree, 'ResetDot').length).toBe(0);
    expect(byClass(tree, 'is-changed').length).toBe(0);
    // ...and the row still says what IS driving it, so dropping the dot removed a wrong
    // signal rather than all signal.
    expect(text(tree)).toContain('Bound to');
  });
});

describe('FB-018 — the icon row, which showed nothing at all', () => {
  // `IconType` computed `isConnected` and never passed it, so a connected icon port had
  // neither a chip nor even the 1px outline the other unchipped rows had.
  it('shows the picker thumbnail when unconnected', () => {
    const tree = render(<IconInput label="Icon" onOpenPicker={() => undefined} />);
    expect(walk(tree).some((n) => String(n.props.className ?? '').includes('sidebar-panel-dark-input'))).toBe(true);
    expect(text(tree)).not.toContain('Bound to');
  });

  it('shows the chip instead of the thumbnail when connected', () => {
    const tree = render(
      <IconInput label="Icon" isConnected connectionLabel="Icon Picker · Value" onOpenPicker={() => undefined} />
    );
    expect(walk(tree).some((n) => String(n.props.className ?? '').includes('sidebar-panel-dark-input'))).toBe(false);
    expect(text(tree)).toContain('Icon Picker · Value');
  });
});

describe('FB-018 scope 2 — the precedence sentence rides on the chip', () => {
  // It lives on the chip so that no call site can render one without it: the five rows that
  // already chipped inherit it untouched.
  it('is carried by every chip, named source or not', () => {
    const named = render(<BindingChip source="Number · Result" />);
    const generic = render(<BindingChip />);
    expect(String(named.props.title)).toContain('driven by Number · Result');
    expect(String(generic.props.title)).toContain('driven by a connection');
  });

  // 🔴 THE WORDING IS LOAD-BEARING AND THIS IS THE ASSERTION THAT PINS IT. "The connection
  // wins" is FALSE while the source has not fired — which is the state the test user was
  // looking at when the typed width rendered. The sentence has to be true in both states,
  // so it talks about when the typed value is USED rather than about which side wins.
  it('stays true for a source that has not fired yet', () => {
    const sentence = bindingTooltip('Number · Result');
    expect(sentence).toContain("used only while the connection hasn't sent anything");
    expect(sentence).not.toMatch(/\bwins\b/i);
    expect(sentence).not.toMatch(/\boverrides\b/i);
  });

  it('reaches a row through the seam, not just the chip in isolation', () => {
    const tree = render(
      <PropertyPanelRow label="Width" isConnected connectionLabel="Number · Result">
        {aField()}
      </PropertyPanelRow>
    );
    const titled = walk(tree).filter((n) => String(n.props.title ?? '').includes('This input is driven'));
    expect(titled.length).toBe(1);
  });
});
