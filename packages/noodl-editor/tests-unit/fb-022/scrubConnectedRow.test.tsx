/**
 * FB-022 AC3 — a bound port has nothing to scrub, by two independent routes.
 *
 * ## Why two, when either would do
 *
 * The structural answer came free: FB-018 put the binding chip in `PropertyPanelRow`, and the
 * chip **replaces** the row's controls rather than sitting beside them, so a connected Width
 * has no field on screen to press. That is real and it is asserted below.
 *
 * It is also one edit away from not being true, and the failure it would produce is silent.
 * A scrub on a bound port writes a parameter the connection overwrites on the next frame: the
 * number moves under the cursor, snaps back, and nothing says why — which is the FB-018 bug
 * exactly, re-created by a gesture instead of by typing. So `scrubSpecForPortType` refuses to
 * build a binding for a connected port as well, and that half is gradeable here.
 *
 * ⚠️ Neither arm proves the two are wired to each other in the running panel. `NumberUnitInput`
 * calls hooks and cannot be rendered by this runner at all, which is the same gap FB-018
 * recorded and sent to its drive; this task's drive does the same.
 */
import React from 'react';

import { PropertyPanelRow } from '@noodl-core-ui/components/property-panel/PropertyPanelInput/PropertyPanelRow';

import { scrubSpecForPortType } from '../../src/editor/src/views/panels/propertyeditor/DataTypes/scrubPolicy';
import { byClass, render } from '../support/renderElements';

/** A scrubbable field as `NumberUnitInput` renders one — the class is what carries the cursor. */
function aScrubbableField() {
  return <input className="is-scrubbable" data-identifier="width" />;
}

const WIDTH_TYPE = { name: 'dimension', units: ['%', 'px', 'vw', 'vh'], defaultUnit: '%' };

describe('FB-022 AC3 — the chip leaves no field to press', () => {
  // 🔴 The disconnected arm is not a formality. `render()` returns null both for a tree that
  // drew nothing and for a component that never ran, so the "no field" claim below is only
  // worth something beside an arm where the field is demonstrably there. One prop different.
  it('draws the scrubbable field when nothing drives the port', () => {
    const tree = render(<PropertyPanelRow label="Width">{aScrubbableField()}</PropertyPanelRow>);
    expect(byClass(tree, 'is-scrubbable').length).toBe(1);
  });

  it('replaces it with the chip when a connection drives the port', () => {
    const tree = render(
      <PropertyPanelRow label="Width" isConnected connectionLabel="Number · Result">
        {aScrubbableField()}
      </PropertyPanelRow>
    );
    // Gone, not merely outlined. A field that is still there is a field a drag can land on.
    expect(byClass(tree, 'is-scrubbable').length).toBe(0);
  });
});

describe('FB-022 AC3 — and the policy refuses to build a binding anyway', () => {
  // The control: the same port, the same call, one field of state different.
  it('builds one for an ordinary port', () => {
    expect(scrubSpecForPortType(WIDTH_TYPE, '%')).not.toBeNull();
    expect(scrubSpecForPortType(WIDTH_TYPE, '%', {})).not.toBeNull();
    expect(scrubSpecForPortType(WIDTH_TYPE, '%', { isConnected: false })).not.toBeNull();
  });

  it('refuses for a connected port', () => {
    expect(scrubSpecForPortType(WIDTH_TYPE, '%', { isConnected: true })).toBeNull();
  });

  // 🔴 Expression mode is the sharper case. There the stored parameter is an object holding
  // the author's expression, so a drag does not merely write a doomed value — it destroys the
  // expression and replaces it with a literal.
  it('refuses for a port being edited as an expression', () => {
    expect(scrubSpecForPortType({ name: 'number' }, undefined, { isExpressionMode: true })).toBeNull();
    expect(scrubSpecForPortType({ name: 'number' }, undefined, { isExpressionMode: false })).not.toBeNull();
  });

  it('refuses for both at once', () => {
    expect(scrubSpecForPortType(WIDTH_TYPE, '%', { isConnected: true, isExpressionMode: true })).toBeNull();
  });
});
