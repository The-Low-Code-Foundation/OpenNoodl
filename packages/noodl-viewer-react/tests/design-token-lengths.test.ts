/**
 * A design token on a dimension port must survive to the DOM.
 *
 * Found on `Puppy test 3` (alpha 0.1.3): an AI-authored page rendered with its
 * whole type hierarchy intact and every rounded corner and border missing. The
 * cause was two hand-written setters in `node-shared-port-definitions.ts` that
 * did `value.value === undefined ? Number(value) + 'px' : …`. `Number('var(--radius-lg)')`
 * is `NaN`, so the property was set to the literal string `'NaNpx'` — which the
 * CSSOM rejects on assignment, dropping the declaration with no error anywhere.
 *
 * The asymmetry is what made it invisible: `fontSize` and `color` are declared
 * with the *same* port type but reach the style object declaratively, so tokens
 * always worked on them. Typography survived and the box model vanished.
 *
 * These tests drive the real Group definition's real setters and assert on the
 * style object it hands to `setStyle`.
 */

/* eslint-env jest */

(globalThis as Record<string, any>).Noodl = { deployed: false };

jest.mock('../src/components/visual/Group/scroll-plugins/nested-scroll-plugin', () => ({ default: class {} }));
jest.mock('../src/components/visual/Group/scroll-plugins/patched-momentum-scroll', () => ({ default: () => undefined }));
jest.mock('../src/components/visual/Group/scroll-plugins/slide-scroll-plugin', () => ({ default: class {} }));

import GroupNodeModule from '../src/nodes/visual/group';

type AnyFn = (...args: any[]) => any;

/** A stand-in node that records the styles the definition writes. */
function makeInstance() {
  const applied: Record<string, unknown> = {};

  const instance: Record<string, any> = {
    props: {},
    style: {},
    _internal: {},
    // `initialize` registers output handlers, which schedule a re-render on the
    // frame clock. Nothing here is under test; it just has to exist.
    context: {
      frameNumber: 0,
      eventEmitter: { once() {}, on() {}, off() {}, emit() {} },
      scheduleUpdate() {}
    },
    raiseRuntimeError() {
      /* not under test */
    }
  };

  const node = GroupNodeModule.node as any;
  for (const key of Object.keys(node.methods || {})) {
    instance[key] = node.methods[key].bind(instance);
  }

  // After binding, not before: `setStyle` is one of the definition's own
  // methods, so installing the recorder first would just be overwritten by the
  // real DOM-writing one.
  instance.setStyle = (style: Record<string, unknown>) => {
    Object.assign(applied, style);
  };
  instance.removeStyle = (names: string[]) => {
    names.forEach((n) => delete applied[n]);
  };
  // The corner/border/shadow mixins each wrap `initialize` to seed `_internal`.
  node.initialize && node.initialize.call(instance);

  return { instance, applied };
}

const inputs = () => (GroupNodeModule.node as any).inputs as Record<string, { set: AnyFn }>;

describe('a design token on a dimension port reaches the DOM', () => {
  test('borderRadius passes var() through verbatim', () => {
    const { instance, applied } = makeInstance();

    inputs().borderRadius.set.call(instance, 'var(--radius-lg)');

    // Before the fix every one of these was the string 'NaNpx'.
    expect(applied.borderTopLeftRadius).toBe('var(--radius-lg)');
    expect(applied.borderTopRightRadius).toBe('var(--radius-lg)');
    expect(applied.borderBottomLeftRadius).toBe('var(--radius-lg)');
    expect(applied.borderBottomRightRadius).toBe('var(--radius-lg)');
    expect(JSON.stringify(applied)).not.toContain('NaN');
  });

  test('borderWidth passes var() through verbatim', () => {
    const { instance, applied } = makeInstance();

    inputs().borderWidth.set.call(instance, 'var(--border-1)');

    expect(applied.borderTopWidth).toBe('var(--border-1)');
    expect(applied.borderBottomWidth).toBe('var(--border-1)');
    expect(JSON.stringify(applied)).not.toContain('NaN');
  });

  test('the editor\'s {value, unit} shape still wins', () => {
    const { instance, applied } = makeInstance();

    inputs().borderRadius.set.call(instance, { value: 12, unit: 'px' });
    expect(applied.borderTopLeftRadius).toBe('12px');

    inputs().borderRadius.set.call(instance, { value: 50, unit: '%' });
    expect(applied.borderTopLeftRadius).toBe('50%');
  });

  test('a bare number is still pixels', () => {
    const { instance, applied } = makeInstance();

    inputs().borderRadius.set.call(instance, 8);
    expect(applied.borderTopLeftRadius).toBe('8px');

    // The legacy numeric-string shape too.
    inputs().borderRadius.set.call(instance, '16');
    expect(applied.borderTopLeftRadius).toBe('16px');
  });

  test('a per-corner token overrides only its own corner', () => {
    const { instance, applied } = makeInstance();

    inputs().borderRadius.set.call(instance, 'var(--radius-sm)');
    inputs().borderTopLeftRadius.set.call(instance, 'var(--radius-lg)');

    expect(applied.borderTopLeftRadius).toBe('var(--radius-lg)');
    expect(applied.borderTopRightRadius).toBe('var(--radius-sm)');
  });

  test('an unset corner falls back to the all-corners value', () => {
    const { instance, applied } = makeInstance();

    inputs().borderRadius.set.call(instance, 'var(--radius-lg)');
    // 'NaNpx' used to be truthy and win this `||` fallback.
    inputs().borderTopLeftRadius.set.call(instance, undefined);

    expect(applied.borderTopLeftRadius).toBe('var(--radius-lg)');
  });

  test('a token in the box-shadow shorthand does not void the whole declaration', () => {
    const { instance, applied } = makeInstance();

    inputs().boxShadowEnabled.set.call(instance, true);
    inputs().boxShadowBlurRadius.set.call(instance, 'var(--space-2)');
    inputs().boxShadowColor.set.call(instance, 'var(--shadow-color)');

    // One bad component invalidates the whole shorthand, so the blur radius
    // alone could take every shadow in a project down with it.
    expect(String(applied.boxShadow)).toContain('var(--space-2)');
    expect(String(applied.boxShadow)).not.toContain('NaN');
    expect(String(applied.boxShadow)).not.toContain('undefined');
  });
});
