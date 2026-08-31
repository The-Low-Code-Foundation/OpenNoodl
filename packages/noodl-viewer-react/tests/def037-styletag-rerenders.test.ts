/**
 * DEF-037 — the `styleTag` half of the fix.
 *
 * ## Why a tagged port is a class, not four ports
 *
 * `setStyle` patches the changed declaration onto the DOM node and re-runs render only for a
 * hard-coded allowlist — `opacity` crossing zero, margins while the size is a percentage,
 * `position` / `flexDirection` / `clip`. 🔴 **Every one of those checks lives inside
 * `if (!styleTag)`.** So a port carrying a `styleTag` had *no* safety net at all and could only
 * ever re-render through its own hand-written `onChange`.
 *
 * That is not a hypothetical gap; it is how the defect was distributed. `Checkbox`'s `Width` and
 * `Radio Button`'s `Width` are declared identically — same index, same group, same `default: 32`,
 * same `styleTag`, both read at render onto a *different* inner element. Radio Button's carries an
 * `onChange`. Checkbox's does not, and nothing in either file says why.
 *
 * A tagged style is, by construction, one the component re-reads at render (`props.styles[tag]`)
 * onto an element that is not the one the DOM patch would find. That is the whole derived-sibling
 * class, so it re-renders. The hot path the patch exists for — a wire animating `opacity` or
 * `transform` per frame — is **untagged** and keeps it, which is what the last two rows assert.
 *
 * ⚠️ **What this file adds over the drive.** A real editor drive changes a parameter, which is
 * *both* editor-driven and (for Checkbox) tagged — so it cannot say which half of the fix moved
 * it. These rows isolate the tagged half, including for a change that did not come from the editor
 * at all, which is the arm that reaches a **deployed** app: `setStyle` is the runtime's generic
 * path, so a wire driving a tagged port hits this after publish too.
 */

/* eslint-env jest */

(globalThis as Record<string, any>).Noodl = { deployed: false };

import { createNodeFromReactComponent, type ReactNodeDefinition } from '../src/react-component-node';

/** A node with one tagged port and one untagged one, so both arms exist on the same instance. */
function defineProbe() {
  return createNodeFromReactComponent({
    name: 'def037.Probe',
    getReactComponent: () => () => null,
    inputCss: {
      // The Checkbox shape: written into `props.styles.checkbox`, re-read at render.
      borderColor: { type: 'color', displayName: 'Border', group: 'Style', styleTag: 'checkbox' },
      // The plain shape: its own declaration on the root element.
      wordBreak: { type: 'string', displayName: 'Word Break', group: 'Style' },
      opacity: { type: 'number', displayName: 'Opacity', group: 'Style' }
    }
  } as unknown as ReactNodeDefinition);
}

interface Probe {
  instance: Record<string, any>;
  /** How many times React was asked to re-render. */
  renders: () => number;
  /** Declarations the DOM fast path wrote, in order. */
  patched: () => Record<string, unknown>[];
}

function instantiate(): Probe {
  const mod = defineProbe();
  const node = mod.node as any;

  let renders = 0;
  const patched: Record<string, unknown>[] = [];

  // A DOM stand-in that records what the fast path writes. `style` is a plain object rather than a
  // CSSStyleDeclaration on purpose: the fast path assigns by property name and reads
  // `domElement.style.opacity` back, and both work on an object.
  const domElement = {
    style: {} as Record<string, unknown>,
    getAttribute: () => 'checkbox',
    querySelector: () => domElement
  };

  const instance: Record<string, any> = {
    props: { styles: {} },
    style: {},
    _internal: {},
    context: {
      frameNumber: 0,
      eventEmitter: { once() {}, on() {}, off() {}, emit() {} },
      scheduleUpdate() {}
    },
    getDOMElement: () => domElement,
    getVisualParentNode: () => undefined,
    forceUpdate() {
      renders++;
    },
    raiseRuntimeError() {
      /* not under test */
    }
  };

  for (const key of Object.keys(node.methods || {})) {
    instance[key] = node.methods[key].bind(instance);
  }

  // 🔴 After the loop, not before it. `getDOMElement`, `getVisualParentNode` and `forceUpdate` are
  // all real methods on the definition, so assigning the stubs first let the loop overwrite them —
  // `setStyle` then took its `if (!domElement) return` early exit and every row read zero, which
  // looks exactly like a fix that does not work.
  instance.getDOMElement = () => domElement;
  instance.getVisualParentNode = () => undefined;
  instance.forceUpdate = () => {
    renders++;
  };

  node.initialize.call(instance);

  // `initialize` applies declared defaults through the same setters, so start counting after it.
  renders = 0;

  const originalSetStyle = instance.setStyle;
  instance.setStyle = (styles: Record<string, unknown>, tag?: string) => {
    const before = Object.assign({}, domElement.style);
    originalSetStyle(styles, tag);
    const after = domElement.style;
    const delta: Record<string, unknown> = {};
    for (const k of Object.keys(after)) if (before[k] !== after[k]) delta[k] = after[k];
    patched.push(delta);
  };

  return { instance, renders: () => renders, patched: () => patched };
}

describe('DEF-037 — a styleTag port re-renders; an untagged one keeps the DOM fast path', () => {
  test('a tagged port re-renders instead of patching the DOM', () => {
    const p = instantiate();

    p.instance.setStyle({ borderColor: 'red' }, 'checkbox');

    expect(p.renders()).toBe(1);
    // The value still has to land in the style object the component reads at render — otherwise
    // this would pass against a build that re-rendered and drew the old colour.
    expect(p.instance.props.styles.checkbox.borderColor).toBe('red');
    expect(p.patched()[0]).toEqual({});
  });

  test('the tagged arm does not depend on the port name', () => {
    const p = instantiate();

    // `width` is Checkbox's actual missed port. Nothing about the fix keys on which name it is,
    // which is the difference between fixing a class and annotating four ports.
    p.instance.setStyle({ width: '80px' }, 'checkbox');

    expect(p.renders()).toBe(1);
    expect(p.instance.props.styles.checkbox.width).toBe('80px');
  });

  /**
   * 🔴 **The control.** If this ever re-renders, the fast path is gone and every wire animating a
   * style per frame goes through React reconciliation — the cost the allowlist exists to avoid,
   * and a change nobody has measured.
   */
  test('CONTROL — an untagged port still patches the DOM and does not re-render', () => {
    const p = instantiate();

    p.instance.setStyle({ wordBreak: 'break-all' });

    expect(p.renders()).toBe(0);
    expect(p.patched()[0]).toEqual({ wordBreak: 'break-all' });
    expect(p.instance.style.wordBreak).toBe('break-all');
  });

  test('CONTROL — the pre-existing untagged allowlist is untouched', () => {
    const p = instantiate();

    // A plain opacity change stays on the fast path...
    p.instance.setStyle({ opacity: 0.5 });
    expect(p.renders()).toBe(0);

    // ...while the zero crossing still forces a render, because it can change pointer events.
    p.instance.setStyle({ opacity: 0 });
    expect(p.renders()).toBe(1);
  });

  test('both arms on one instance, so the assertion is a difference', () => {
    const p = instantiate();

    p.instance.setStyle({ wordBreak: 'break-all' });
    const afterUntagged = p.renders();

    p.instance.setStyle({ borderColor: 'red' }, 'checkbox');
    const afterTagged = p.renders();

    expect(afterUntagged).toBe(0);
    expect(afterTagged).toBe(1);
  });
});
