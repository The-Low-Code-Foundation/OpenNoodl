/**
 * FLD-004 (c) (#26) — a units port registered DYNAMICALLY merges a bare number into its unit,
 * the way a library port always has.
 *
 * `registerInput` seeded a units port as `{ value, type: defaultUnit }` while `setInputValue`
 * tests `currentInputValue.unit` to decide whether to merge. Wrong key, so that test could never
 * pass for a port registered through here, and the coercion has been dead since `b9c60b07d`.
 *
 * 🔴 **What this does NOT change, measured rather than asserted.** Library ports were never
 * affected: `nodedefinition.ts` assigns `node._inputs = Object.create(inputs)` directly and seeds
 * `_inputValues` through `initializeDefaultValues`, which has always written `unit`. This function
 * is reached only by dynamic registration, and the AC5 blast-radius measurement found **272
 * distinct dynamic registrations across three populations — the `noodl-runtime` suite (75), the
 * `noodl-viewer-react` suite (26) and a 20-project render corpus driven in a real browser (171) —
 * and not one of them carries a units type.** So no shipped port's behaviour moves; the first
 * dynamic units port anybody adds will simply work.
 *
 * The first `it` below is the LIBRARY control, and it is the arm that makes the claim readable:
 * both halves are asserted here, so "the dynamic one now behaves like the library one" is a
 * comparison this file makes rather than one a reader has to take on trust.
 */

/* eslint-env jest */

const Node = require('../src/node');

const DIMENSION = { name: 'dimension', units: ['%', 'px', 'vw', 'vh'], defaultUnit: '%' };

function makeNode() {
  const context = {
    updateIteration: 0,
    nodeIsDirty: jest.fn(),
    styles: { resolveColor: (c) => c },
    getDefaultValueForInput: () => undefined
  };
  const node = new Node(context, 'fld-004-node');
  node.name = 'TestNode';
  return node;
}

describe('FLD-004 (c) — a dynamically registered units port', () => {
  it('CONTROL — the library seeding (nodedefinition) has always used `unit`, and merges', () => {
    // Not a reconstruction: this is what `initializeDefaultValues` writes, verbatim.
    const node = makeNode();
    node.registerInput('height', { type: DIMENSION, set() {} });
    node._inputValues.height = { unit: '%', value: 100 };

    node.setInputValue('height', 400);
    expect(node._inputValues.height).toEqual({ unit: '%', value: 400 });
  });

  it('🔴 merges a bare number into the port’s default unit — AC4, and the reverted arm’s subject', () => {
    const node = makeNode();
    node.registerInput('height', { type: DIMENSION, default: 100, set() {} });

    // The seed itself, before any value arrives: the key `setInputValue` actually reads.
    expect(node._inputValues.height).toEqual({ value: 100, unit: '%' });

    node.setInputValue('height', 400);
    expect(node._inputValues.height).toEqual({ value: 400, unit: '%' });
  });

  it('merges into whatever unit the port is CURRENTLY holding, not the default — the exit #26 is told about', () => {
    const node = makeNode();
    node.registerInput('height', { type: DIMENSION, default: 100, set() {} });

    node.setInputValue('height', { value: 300, unit: 'px' });
    node.setInputValue('height', 400);
    expect(node._inputValues.height).toEqual({ value: 400, unit: 'px' });
  });

  it('does not merge a non-number — a string stays a string and reaches the setter as one', () => {
    const node = makeNode();
    const seen = [];
    node.registerInput('height', { type: DIMENSION, default: 100, set: (v) => seen.push(v) });

    node.setInputValue('height', 'tall');
    expect(node._inputValues.height).toBe('tall');
  });

  it('leaves a non-units port alone — the seed is the declared default, unwrapped', () => {
    const node = makeNode();
    node.registerInput('label', { type: 'string', default: 'hello', set() {} });
    expect(node._inputValues.label).toBe('hello');

    node.setInputValue('label', 'goodbye');
    expect(node._inputValues.label).toBe('goodbye');
  });

  it('uses the first unit when no defaultUnit is declared', () => {
    const node = makeNode();
    node.registerInput('radius', { type: { name: 'number', units: ['px', '%'] }, default: 4, set() {} });
    expect(node._inputValues.radius).toEqual({ value: 4, unit: 'px' });

    node.setInputValue('radius', 12);
    expect(node._inputValues.radius).toEqual({ value: 12, unit: 'px' });
  });
});
