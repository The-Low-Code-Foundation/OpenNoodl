import { BasicNodeType } from '@noodl-models/nodelibrary/BasicNodeType';

/**
 * A node's auto-name must be a string, whatever the label port holds.
 *
 * FH-003: setting fx on a label port stores `{ mode: 'expression', expression, fallback, version }`
 * as the parameter value. `labelForNode` returned that object untouched, and the canvas painter
 * stringified it — so every node whose label was an expression was called "[object Object]" on the
 * card, shared one wrap-height cache key with all the others, and painted a sub-label as if the
 * author had renamed it (an object never equals `typeDisplayName()`).
 *
 * The canvas paint itself is outside jasmine's reach; what is testable — and what actually broke —
 * is the string `labelForNode` hands out.
 */
describe('BasicNodeType.labelForNode — an expression-valued label', () => {
  function makeType(args?: TSFixme) {
    return new BasicNodeType({
      name: 'Button',
      usePortAsLabel: 'label',
      portLabelTruncationMode: 'length',
      ...args
    });
  }

  function makeNode(type: TSFixme, parameters: TSFixme) {
    // The shape `labelForNode` actually reads: it goes through `node.type`, not `this`.
    return { type, parameters };
  }

  it('passes a plain string label through', () => {
    const type = makeType();
    expect(type.labelForNode(makeNode(type, { label: 'Sign in' }))).toBe('Sign in');
  });

  it('shows the expression text, not the object and not the fallback', () => {
    const type = makeType();
    const node = makeNode(type, {
      label: { mode: 'expression', expression: 'Noodl.Variables.foo', fallback: 'Click me', version: 1 }
    });

    expect(type.labelForNode(node)).toBe('Noodl.Variables.foo');
  });

  it('never returns a non-string', () => {
    const type = makeType();
    const node = makeNode(type, {
      label: { mode: 'expression', expression: 'Noodl.Variables.foo', fallback: 'Click me', version: 1 }
    });

    expect(typeof type.labelForNode(node)).toBe('string');
  });

  it('gives two different expressions two different labels', () => {
    // The wrap-height cache is keyed on the label; identical keys meant identical cached
    // heights for cards with quite different titles.
    const type = makeType();
    const a = type.labelForNode(
      makeNode(type, { label: { mode: 'expression', expression: 'Noodl.Variables.a', version: 1 } })
    );
    const b = type.labelForNode(
      makeNode(type, { label: { mode: 'expression', expression: 'Noodl.Variables.b', version: 1 } })
    );

    expect(a).not.toBe(b);
  });

  it('falls back to the display name when the expression is empty', () => {
    // An expression object is truthy even with nothing in it, so emptiness can only be judged
    // after resolving. Returning the display name here is also what keeps the sub-label away.
    const type = makeType();
    const node = makeNode(type, { label: { mode: 'expression', expression: '', fallback: '', version: 1 } });

    expect(type.labelForNode(node)).toBe('Button');
  });

  it('falls back to the display name for a parameter that is some other object', () => {
    const type = makeType();
    expect(type.labelForNode(makeNode(type, { label: { some: 'object' } }))).toBe('Button');
  });

  it('falls back to the display name when the label port has no value', () => {
    const type = makeType();
    expect(type.labelForNode(makeNode(type, {}))).toBe('Button');
  });

  it('length-truncates a long expression the same way it truncates a long string', () => {
    const type = makeType();
    const longExpression = 'Noodl.Variables.aVeryLongVariableNameIndeed.andThenSome';
    const node = makeNode(type, { label: { mode: 'expression', expression: longExpression, version: 1 } });

    const label = type.labelForNode(node);
    expect(label.length).toBe(36);
    expect(label).toBe(longExpression.slice(0, 33) + '...');
  });

  it('does not throw on filename truncation of an expression', () => {
    // No node declares `filename` today; the first one that does used to hit
    // `labelName.split('/')` on an object and throw.
    const type = makeType({ portLabelTruncationMode: 'filename' });
    const node = makeNode(type, { label: { mode: 'expression', expression: 'Noodl.Variables.path', version: 1 } });

    expect(type.labelForNode(node)).toBe('Noodl.Variables.path');
    expect(type.labelForNode(makeNode(type, { label: 'assets/img/logo.png' }))).toBe('logo.png');
  });

  it('stringifies a non-string primitive parameter', () => {
    const type = makeType();
    expect(type.labelForNode(makeNode(type, { label: 42 }))).toBe('42');
  });
});
