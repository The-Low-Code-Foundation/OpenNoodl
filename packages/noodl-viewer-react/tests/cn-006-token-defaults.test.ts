/**
 * CN-006 — a design token declared as a port's **default** must survive to the
 * DOM, not just one that an app builder sets.
 *
 * ## Why this is a separate defect from AIB-001
 *
 * AIB-001 fixed `input.set` — the path a *set parameter* takes — in both the
 * `inputProps` and `inputCss` loops, and `design-token-lengths.test.ts` grades
 * it. A port's declared `default` never goes through `set`. It is fitted with
 * the port's unit at definition time (`startStyle`) and at instance time
 * (`props`), so a units-typed port declaring `default: 'var(--space-3)'`
 * produced the string `var(--space-3)px`.
 *
 * That is invalid CSS. The browser drops the declaration with no error, the
 * parameter still reads back as the correct token in the property panel, and
 * the node renders with the property simply absent — the same shape of silence
 * as the two defects AIB-001 found.
 *
 * ⚠️ **It matters because of ✅ D8.** The ruling is that the kit scaffold emits
 * `var(--token)` colour *and spacing* ports **by default**, and CN-006's task
 * file records the premise that the bridge "already handles a `var(--token)`
 * string on a units-typed port". Half true: the ruling landed squarely on the
 * half that was still broken, so the first thing every kit author copies would
 * have shipped with its spacing dead.
 *
 * The asymmetry that hid it is worth naming: **a colour port has no units**, so
 * `default: 'var(--surface-raised)'` always worked. A scaffold reviewed by
 * eye — or a test that asserted the *parameter value* rather than the style —
 * would report tokens working.
 *
 * ## What each test would say on a broken build
 *
 * The two token tests fail with `'var(--space-3)px'` / `'var(--text-sm)px'`.
 * The two control tests are the other half: they pin the behaviour the guard
 * must **not** change, so a "fix" that dropped unit-fitting altogether — which
 * would make the token tests pass — fails here instead.
 */

/* eslint-env jest */

(globalThis as Record<string, any>).Noodl = { deployed: false };

import { createNodeFromReactComponent, type ReactNodeDefinition } from '../src/react-component-node';

/** A units-typed port, the shape a spacing/size/radius port is declared with. */
const PX = { name: 'number', units: ['px'], defaultUnit: 'px' } as any;

function defineWithDefaults(cssDefault: unknown, propDefault: unknown) {
  return createNodeFromReactComponent({
    name: 'cn006.Probe',
    getReactComponent: () => () => null,
    inputCss: {
      paddingLeft: { type: PX, displayName: 'Padding Left', group: 'Style', default: cssDefault },
      // The control that made this invisible: a colour port carries no units, so
      // this arm has always worked and reviewing the scaffold by eye says "tokens
      // are fine".
      backgroundColor: { type: 'color', displayName: 'Background', group: 'Style', default: 'var(--surface-raised)' }
    },
    inputProps: {
      fontSize: { type: PX, displayName: 'Font size', group: 'Style', default: propDefault }
    }
  } as unknown as ReactNodeDefinition);
}

/** Instantiate a definition far enough to read `style` and `props`. */
function instantiate(mod: ReturnType<typeof defineWithDefaults>) {
  const node = mod.node as any;
  const instance: Record<string, any> = {
    props: {},
    style: {},
    _internal: {},
    context: {
      frameNumber: 0,
      eventEmitter: { once() {}, on() {}, off() {}, emit() {} },
      scheduleUpdate() {}
    },
    raiseRuntimeError() {
      /* not under test */
    }
  };
  for (const key of Object.keys(node.methods || {})) instance[key] = node.methods[key].bind(instance);
  node.initialize.call(instance);
  return instance;
}

describe('CN-006 — a token default reaches the DOM', () => {
  test('a units-typed inputCss port defaulting to a token is not unit-fitted', () => {
    const instance = instantiate(defineWithDefaults('var(--space-3)', 12));

    // Before the fix: 'var(--space-3)px'.
    expect(instance.style.paddingLeft).toBe('var(--space-3)');
    expect(JSON.stringify(instance.style)).not.toContain(')px');
  });

  test('a units-typed inputProps port defaulting to a token is not unit-fitted', () => {
    const instance = instantiate(defineWithDefaults(12, 'var(--text-sm)'));

    // Before the fix: 'var(--text-sm)px'.
    expect(instance.props.fontSize).toBe('var(--text-sm)');
  });

  test('CONTROL — a numeric default still gets the port unit, on both loops', () => {
    const instance = instantiate(defineWithDefaults(12, 16));

    expect(instance.style.paddingLeft).toBe('12px');
    expect(instance.props.fontSize).toBe('16px');
  });

  test('CONTROL — a colour default was never broken, and still is not', () => {
    // The arm that made the defect survivable. Asserted so that "tokens work in
    // the scaffold" can never again be true of only this half.
    const instance = instantiate(defineWithDefaults('var(--space-3)', 12));

    expect(instance.style.backgroundColor).toBe('var(--surface-raised)');
  });

  test('the set path AIB-001 fixed is still the set path', () => {
    // Not a duplicate of `design-token-lengths.test.ts`: that grades the stock
    // Group node's hand-written setters, this grades the generic bridge the two
    // guards above live in. A change to one loop that broke the other would show
    // up here rather than in a kit somebody ships.
    const mod = defineWithDefaults(12, 16);
    const node = mod.node as any;
    const instance = instantiate(mod);
    const applied: Record<string, unknown> = {};
    instance.setStyle = (style: Record<string, unknown>) => Object.assign(applied, style);

    node.inputs.paddingLeft.set.call(instance, 'var(--space-6)');
    expect(applied.paddingLeft).toBe('var(--space-6)');

    node.inputs.fontSize.set.call(instance, 'var(--text-lg)');
    expect(instance.props.fontSize).toBe('var(--text-lg)');
  });
});
