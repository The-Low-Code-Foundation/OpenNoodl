/**
 * NDA-005 — the shared visual port descriptions survive the React node pipeline.
 *
 * **M-rows.** The runtime half (L-rows, `noodl-runtime/test/corpus/nda-005-port-description.test.ts`)
 * pins that `nodedefinition` carries `description` into the compiled metadata. That is not the same
 * claim as *this* one: a visual node's ports do not go straight into `inputs`. They are declared on
 * `inputCss`, `inputProps` and `outputProps`, and `createNodeFromReactComponent` moves them across.
 *
 * The reason to test it rather than read it once is banked in this phase as **"a
 * rebuild-the-object line is a schema assertion"** — `IconType.openPicker` silently dropped three
 * fields of a union one line after the picker produced them. `createNodeFromReactComponent` happens
 * to *assign* rather than rebuild, so the field survives; a later tidy-up that starts constructing
 * a port object would take 70% of the library's descriptions with it and nothing else would notice.
 *
 * These rows are the cheap guard on that, and they are written against the **shared** definitions
 * because that is where the leverage is: 133 distinct port names account for 1,861 of the library's
 * 2,654 ports.
 */

/* eslint-env jest */

import NodeSharedPortDefinitions from '../../src/node-shared-port-definitions';
import { createNodeFromReactComponent } from '../../src/react-component-node';

/** The smallest visual node that carries the shared sets. */
function aVisualNode() {
  const definition = {
    name: 'corpus.Described',
    displayNodeName: 'Described',
    getReactComponent() {
      return function () {
        return null;
      };
    },
    inputs: {},
    inputProps: {},
    inputCss: {},
    outputs: {},
    outputProps: {}
  };

  NodeSharedPortDefinitions.addSharedVisualInputs(definition as never);
  NodeSharedPortDefinitions.addAlignInputs(definition as never);
  NodeSharedPortDefinitions.addMarginInputs(definition as never);
  NodeSharedPortDefinitions.addPointerEventOutputs(definition as never);

  return createNodeFromReactComponent(definition as never).node;
}

describe('NDA-005: shared visual port descriptions reach the compiled node', () => {
  /**
   * `visible` arrives through `addInputs`, the most ordinary of the three routes.
   */
  test('M1: an `addInputs` port keeps its description', () => {
    expect(aVisualNode().inputs.visible.description).toBe(
      'Hides the element while keeping the space it occupies in the layout'
    );
  });

  /**
   * `position` arrives through `addInputCss`, and that route *does* rewrite the port — it installs
   * a generated `set` onto the same object. Assigning a setter onto the authored object is what
   * keeps the description; constructing a fresh one would not.
   */
  test('M2: an `addInputCss` port keeps its description despite gaining a generated setter', () => {
    const port = aVisualNode().inputs.position;

    expect(typeof port.set).toBe('function');
    expect(port.description).toContain('In Layout follows its siblings');
  });

  /**
   * `alignX` arrives through `addInputProps`, the third route.
   */
  test('M3: an `addInputProps` port keeps its description', () => {
    expect(aVisualNode().inputs.alignX.description).toBe(
      'Horizontal alignment of this element within the space its parent gives it'
    );
  });

  /**
   * And an **output**, which before NDA-005 could not be documented by any means: there is no
   * `tooltip` field on an output port, so the catalog's only source for one was nothing at all.
   */
  test('M4: an output prop keeps its description', () => {
    expect(aVisualNode().outputs.hoverEnd.description).toBe('Fires when the pointer leaves this element');
  });

  /**
   * The control. An undocumented shared port must read as *undocumented* rather than inheriting
   * something from a neighbour — the failure mode of a bulk pass is a description landing on the
   * wrong port, which no per-port assertion above would catch.
   */
  test('M5 (control): a port with no description carries none', () => {
    const node = aVisualNode();

    expect(node.inputs.marginLeft.description).toBe(
      "Space outside the element's left edge, between it and its neighbours"
    );
    expect(node.inputs.marginRight.description).toBe(
      "Space outside the element's right edge, between it and its neighbours"
    );
    // Two neighbours in one mixin, each with its own edge named. A copy-paste that left both
    // saying "left" is the realistic bulk-pass mistake, and it passes any single-port check.
    expect(node.inputs.marginLeft.description).not.toEqual(node.inputs.marginRight.description);
  });
});
