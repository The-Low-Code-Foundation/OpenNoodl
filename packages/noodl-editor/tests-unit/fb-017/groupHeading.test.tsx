/**
 * FB-017 AC1/AC2 — the heading a builder clicks, graded as a component.
 *
 * ## What this can and cannot see
 *
 * `GroupHeading` calls no hooks, so `renderElements` evaluates it end-to-end and these
 * assertions are about the real element tree: the chevron, `aria-expanded`, the badge, the
 * handler. `PropertyGroups` around it reaches `RowHost`, which calls `useRef` and
 * `useLayoutEffect` and therefore throws in this runner — so *which sections exist and in what
 * order* is covered by `propertyPanelTiers.test.ts` on the decision side and by the drive on the
 * rendering side. 🔴 That gap is named rather than papered over: this file grades the heading,
 * not the panel.
 */
import React from 'react';

import { GroupHeading } from '../../src/editor/src/views/panels/propertyeditor/components/PropertyGroups';
import { byClass, render, text } from '../support/renderElements';

const heading = (props: Partial<React.ComponentProps<typeof GroupHeading>> = {}) =>
  render(<GroupHeading name="Advanced CSS" isExpanded={false} {...props} />);

describe('the disclosure control', () => {
  /**
   * 🔴 Before FB-017 this was a `<div>` with no handler — `Ports.ts` read `groupExpansions` on
   * every render and nothing ever wrote to it, so the collapse mechanism was dead code with a
   * live reader. A div that toggles would be the same defect wearing a cursor.
   */
  it('is a real button, so it is reachable by keyboard', () => {
    const tree = heading();
    expect(tree.type).toBe('button');
    expect(tree.props.type).toBe('button');
  });

  it('announces its state through aria-expanded, in both directions', () => {
    expect(heading({ isExpanded: false }).props['aria-expanded']).toBe(false);
    expect(heading({ isExpanded: true }).props['aria-expanded']).toBe(true);
  });

  it('turns the chevron only when it is open', () => {
    const closed = byClass(heading({ isExpanded: false }), 'property-group-chevron')[0];
    const open = byClass(heading({ isExpanded: true }), 'property-group-chevron')[0];

    expect(String(closed.props.className)).not.toContain('is-expanded');
    expect(String(open.props.className)).toContain('is-expanded');
  });

  it('hides the chevron from assistive tech — the button already says the state', () => {
    expect(byClass(heading(), 'property-group-chevron')[0].props['aria-hidden']).toBe(true);
  });

  it('names the group', () => {
    expect(text(byClass(heading({ name: 'Margin and padding' }), 'property-group-name')[0])).toBe('Margin and padding');
  });

  it('asks for the opposite of the state it is in', () => {
    const toggles: boolean[] = [];

    const closed = heading({ isExpanded: false, onToggle: (next) => toggles.push(next) });
    (closed.props.onClick as () => void)();

    const open = heading({ isExpanded: true, onToggle: (next) => toggles.push(next) });
    (open.props.onClick as () => void)();

    expect(toggles).toEqual([true, false]);
  });

  it('does not throw when nothing is listening', () => {
    const tree = heading({ onToggle: undefined });
    expect(() => (tree.props.onClick as () => void)()).not.toThrow();
  });
});

describe('the badge — FB-017 AC2', () => {
  /**
   * 🔴 THE EXPANDED ARM IS NOT A FORMALITY. `byClass` returns `[]` both for a badge that was
   * deliberately withheld and for a component that never drew anything, so every "no badge"
   * claim below is only worth something beside an arm where the badge is demonstrably present.
   * Same component, one prop different.
   */
  it('reports what a collapsed group is still doing', () => {
    const badges = byClass(heading({ isExpanded: false, activeCount: 3 }), 'property-group-badge');
    expect(badges.length).toBe(1);
    expect(text(badges[0])).toBe('3 set');
  });

  it('says nothing when the group is open — the rows speak for themselves', () => {
    expect(byClass(heading({ isExpanded: true, activeCount: 3 }), 'property-group-badge').length).toBe(0);
  });

  it('says nothing when a collapsed group holds nothing set', () => {
    expect(byClass(heading({ isExpanded: false, activeCount: 0 }), 'property-group-badge').length).toBe(0);
    expect(byClass(heading({ isExpanded: false, activeCount: undefined }), 'property-group-badge').length).toBe(0);
  });
});
