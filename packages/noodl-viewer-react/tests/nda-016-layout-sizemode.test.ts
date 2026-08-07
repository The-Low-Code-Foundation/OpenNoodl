/**
 * NDA-016 — regression tests for the two defects behind
 * "add two Text nodes side by side and the first takes the whole row,
 *  unless you change the width to fixed and back".
 *
 * §0 found the reported symptom is NOT the missing `else` in `Layout.size` that
 * the task was written around. A freshly created Text node's `props.sizeMode` is
 * `'contentHeight'` and its `props.width` is `'100%'`, exactly as declared —
 * verified in the running editor's preview against a live node instance. The
 * cause is that children read their parent's layout as `parentLayout` when *they*
 * render, and `renderChildren` memoises the elements built from it, so a parent
 * that changed its own layout handed React back children still laid out for the
 * layout it had left. Touching any port on a child re-rendered it and the folklore
 * workaround "worked".
 *
 * Both halves are pinned here: `setLayout` invalidating the memo (the real fix),
 * and the Size Mode port holding its declared default (§1, correct regardless).
 */

/* eslint-env jest */

// Node definitions read `Noodl.deployed` at module scope to decide whether to
// build editor-only tooltip HTML. The deploy bootstrap sets it; under jest
// nothing does, so declare it before the imports run. `false` keeps the
// definitions on the same branch the editor and preview take.
(globalThis as Record<string, any>).Noodl = { deployed: false };

// The Group's React component pulls in three hand-written ES-module scroll
// plugins that ts-jest does not transform (`preset: ts-jest` compiles .ts/.tsx
// only). None of them is involved in laying children out, and stubbing them
// keeps this test on the real node definition rather than a reconstruction.
jest.mock('../src/components/visual/Group/scroll-plugins/nested-scroll-plugin', () => ({ default: class {} }));
jest.mock('../src/components/visual/Group/scroll-plugins/patched-momentum-scroll', () => ({ default: () => undefined }));
jest.mock('../src/components/visual/Group/scroll-plugins/slide-scroll-plugin', () => ({ default: class {} }));

import GroupNodeModule from '../src/nodes/visual/group';
import TextNodeModule from '../src/nodes/visual/text';

type AnyFn = (...args: any[]) => any;

interface FakeNode {
  props: Record<string, any>;
  cachedChildren: unknown;
  forceUpdates: number;
  errors: { code: string; message: string }[];
  [key: string]: any;
}

/**
 * A bare stand-in for a compiled node instance, with the definition's own
 * `methods` bound onto it — the same approach as `deprecated-node-defects.test.ts`.
 * A whole node scope is not needed to exercise a single input setter.
 */
function makeInstance(module: { node: { methods: Record<string, AnyFn> } }): FakeNode {
  const instance = {
    props: {},
    style: {},
    cachedChildren: ['a stale child element'],
    forceUpdates: 0,
    errors: [] as { code: string; message: string }[],
    context: {},
    setStyle() {
      /* the direct-to-DOM path, irrelevant here */
    },
    removeStyle() {
      /* as above */
    },
    raiseRuntimeError(code: string, message: string) {
      instance.errors.push({ code, message });
    }
  } as unknown as FakeNode;

  const methods = module.node.methods;
  for (const key of Object.keys(methods)) {
    instance[key] = methods[key].bind(instance);
  }
  // `forceUpdate` is not in `methods` on the definition object we can reach here,
  // so count calls directly.
  instance.forceUpdate = () => {
    instance.forceUpdates++;
  };

  return instance;
}

describe('NDA-016: a layout change reaches the children', () => {
  const groupInputs = GroupNodeModule.node.inputs as Record<string, { set: AnyFn }>;

  test('setting Layout drops the memoised children so they recompute parentLayout', () => {
    const group = makeInstance(GroupNodeModule as any);
    group.props.layout = 'column';

    groupInputs.flexDirection.set.call(group, 'row');

    expect(group.props.layout).toBe('row');
    // The whole defect: before the fix this stayed populated, so the Group
    // re-rendered with children still carrying the column layout's styles — a
    // 100% width that never became a flex-grow, and flex-shrink pinned at 0.
    expect(group.cachedChildren).toBeUndefined();
    expect(group.forceUpdates).toBeGreaterThan(0);
  });

  test('setting Layout to the value it already has is not a re-render', () => {
    const group = makeInstance(GroupNodeModule as any);
    group.props.layout = 'row';

    // Asserted on `setLayout` rather than through the port, because the port's
    // setter re-renders for its own reasons (it rewrites `flex-direction`
    // straight onto the DOM and needs React told). Memoising children is worth
    // keeping; only a real layout change may discard it.
    group.setLayout('row');

    expect(group.cachedChildren).toEqual(['a stale child element']);
    expect(group.forceUpdates).toBe(0);
  });

  test("'none' — absolute positioning — invalidates too", () => {
    const group = makeInstance(GroupNodeModule as any);
    group.props.layout = 'row';

    groupInputs.flexDirection.set.call(group, 'none');

    expect(group.props.layout).toBe('none');
    expect(group.cachedChildren).toBeUndefined();
  });
});

describe('NDA-016 §1: Size Mode holds its declared default', () => {
  const textInputs = TextNodeModule.node.inputs as Record<string, { set: AnyFn }>;

  test('a connection abstaining leaves the node at its declared Size Mode', () => {
    const text = makeInstance(TextNodeModule as any);
    text.props.sizeMode = 'explicit';

    textInputs.sizeMode.set.call(text, undefined);

    // Text declares `defaultSizeMode: 'contentHeight'`. Before the fix the prop
    // was deleted, `Layout.size` assigned no width at all, and the node kept
    // whatever `defaultCss` had left — for Text, `width: 'auto'`, which neither
    // grows nor shrinks.
    expect(text.props.sizeMode).toBe('contentHeight');
    expect(text.errors).toEqual([]);
  });

  test('a value that is not a Size Mode is reported, once, against the node', () => {
    const text = makeInstance(TextNodeModule as any);

    textInputs.sizeMode.set.call(text, 'stretch');

    expect(text.errors).toHaveLength(1);
    expect(text.errors[0].code).toBe('dimensions/unknown-size-mode');
    expect(text.errors[0].message).toContain('stretch');
  });

  test.each(['explicit', 'contentWidth', 'contentHeight', 'contentSize'])(
    "'%s' is a Size Mode the layout engine knows",
    (mode) => {
      const text = makeInstance(TextNodeModule as any);

      textInputs.sizeMode.set.call(text, mode);

      expect(text.props.sizeMode).toBe(mode);
      expect(text.errors).toEqual([]);
    }
  );

  test('an abstaining Width connection does not throw', () => {
    const text = makeInstance(TextNodeModule as any);

    // `onChange` read `value.isFixed` unguarded, so this was a TypeError raised
    // from inside an input setter.
    expect(() => textInputs.width.set.call(text, undefined)).not.toThrow();
    expect(text.props.fixedWidth).toBeUndefined();
  });
});
