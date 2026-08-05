/**
 * FH-015 — "Block Pointer Events" and the click that hits the card anyway.
 *
 * The report: a Group acting as a card has its Click wired to "open details", and a
 * Button inside it has its Click wired to "favourite". Pressing favourite ran both.
 * Turning on the Button's "Block Pointer Events" changed nothing.
 *
 * Slice 1 — the mechanism. `Utils.controlEvents(props)` is `pointerProps(props)`, which is
 * where the `blockTouch` `stopPropagation` wrapper is built. `Button.tsx` spread it and then
 * wrote `onClick={props.onClick}` *after* the spread; JSX later-wins, so the one event the
 * author was trying to block was the one that kept the raw, unwrapped sender. Same shape in
 * `Slider.tsx` (an `inputProps` object spread after `controlEvents`) and in the deprecated
 * Button.
 *
 * Slice 2 — the default. Click-through was not a bug in `blockTouch`, it was the only
 * behaviour there was: every visual node gets a live `onClick` at init whether its Click port
 * is wired or not, and nothing called `stopPropagation` unless `blockTouch` was on. A click
 * now stops at the node that is using it, governed by the `clickBubbling` port
 * (Automatic / Always / Never, defaulting to Automatic).
 *
 * No DOM here on purpose: there is no `jest-environment-jsdom` anywhere in this monorepo
 * (every package's jest.config.js pins `testEnvironment: 'node'`), so these drive the two
 * places the defect actually lives — `pointerProps` itself, and the React element `Button`
 * returns when called as the plain function it is.
 */

/* eslint-env jest */

import * as fs from 'fs';
import * as path from 'path';

import { Button } from '../src/components/controls/Button/Button';
import pointerProps from '../src/pointerlisteners';

type Handler = (event: unknown) => void;

/** A synthetic-event stand-in that records whether propagation was stopped. */
function makeEvent() {
  return {
    stopped: false,
    stopPropagation() {
      this.stopped = true;
    }
  };
}

/** The minimum of a `ReactNodeInstance` that the click path touches. */
function makeNoodlNode({ clickConnected = false }: { clickConnected?: boolean } = {}) {
  const node = {
    dirtyFlushes: 0,
    setDOMElement() {
      /* the ref callback; never invoked without a DOM */
    },
    hasOutput(name: string) {
      return name === 'onClick';
    },
    getOutput(name: string) {
      if (name !== 'onClick') throw new Error('no such output ' + name);
      return { hasConnections: () => clickConnected };
    },
    context: {
      updateDirtyNodes() {
        node.dirtyFlushes++;
      }
    }
  };

  return node;
}

describe('FH-015 slice 1 — blockTouch reaches the click', () => {
  it('pointerProps wraps a root-level onClick in stopPropagation when blockTouch is set', () => {
    const fired: string[] = [];
    const listeners = pointerProps({
      blockTouch: true,
      onClick: () => fired.push('click')
    });

    const event = makeEvent();
    (listeners.onClick as Handler)(event);

    expect(fired).toEqual(['click']);
    expect(event.stopped).toBe(true);
  });

  it("Button's rendered onClick is the blocking wrapper, not the raw sender", () => {
    const fired: string[] = [];
    const node = makeNoodlNode();

    const element = Button({
      noodlNode: node,
      blockTouch: true,
      enabled: true,
      buttonType: 'button',
      useLabel: true,
      label: 'Favourite',
      onClick: () => fired.push('favourite')
    } as never) as { props: { onClick?: Handler } };

    expect(typeof element.props.onClick).toBe('function');

    const event = makeEvent();
    element.props.onClick(event);

    // The Button's own Click still fires...
    expect(fired).toEqual(['favourite']);
    // ...and the click no longer reaches the card behind it. This is the assertion that
    // failed before the fix: the raw `props.onClick` never called stopPropagation.
    expect(event.stopped).toBe(true);
  });

  it('Button without blockTouch still sends its Click, and flushes dirty nodes', () => {
    const fired: string[] = [];
    const node = makeNoodlNode();

    const element = Button({
      noodlNode: node,
      enabled: true,
      buttonType: 'button',
      useLabel: true,
      label: 'Favourite',
      onClick: () => fired.push('favourite')
    } as never) as { props: { onClick?: Handler } };

    const event = makeEvent();
    element.props.onClick(event);

    expect(fired).toEqual(['favourite']);
    expect(event.stopped).toBe(false);
    // The `props.onClick` line used to win over `pointerProps`' wrapper, so a Button click
    // was the one click in the runtime that did not flush the graph in the same frame.
    expect(node.dirtyFlushes).toBe(1);
  });

  /**
   * Slider and the deprecated Button both use hooks, and with no jsdom environment they
   * cannot be invoked the way `Button` can. The defect in them is a source-ordering one —
   * an `onClick` written after the `controlEvents` spread — so it is pinned as such.
   */
  it.each([
    ['src/components/controls/Slider/Slider.tsx'],
    ['src/nodes-deprecated/controls/button.tsx']
  ])('%s does not re-assign onClick after the controlEvents spread', (relative) => {
    const source = fs.readFileSync(path.join(__dirname, '..', relative), 'utf8');
    const assignments = source
      .split('\n')
      .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
      .filter((line) => /onClick\s*[:=]\s*\{?\s*props\.onClick/.test(line));

    expect(assignments).toEqual([]);
  });
});

describe('FH-015 slice 2 — a click stops at the node that is using it', () => {
  /** The Group/Text/Image/Circle/Video shape: Noodl's callbacks live under `props.pointer`. */
  function visualProps(node: ReturnType<typeof makeNoodlNode>, fired: string[], extra = {}) {
    return {
      // The stub is deliberately the few members the click path reads, not a whole node.
      noodlNode: node as never,
      pointer: {
        onClick: () => fired.push('click'),
        onMouseOver: () => fired.push('hover')
      },
      ...extra
    };
  }

  it('stops the click when this node\'s Click output has connections', () => {
    const fired: string[] = [];
    const listeners = pointerProps(visualProps(makeNoodlNode({ clickConnected: true }), fired));

    const event = makeEvent();
    (listeners.onClick as Handler)(event);

    expect(fired).toEqual(['click']);
    expect(event.stopped).toBe(true);
  });

  it('leaves an unconnected Click port alone — no behaviour change at all (criterion 4)', () => {
    const fired: string[] = [];
    const listeners = pointerProps(visualProps(makeNoodlNode({ clickConnected: false }), fired));

    const event = makeEvent();
    (listeners.onClick as Handler)(event);

    expect(fired).toEqual(['click']);
    expect(event.stopped).toBe(false);
  });

  it('lets hover through to the parent while the click is being kept in (criterion 3)', () => {
    const fired: string[] = [];
    const listeners = pointerProps(visualProps(makeNoodlNode({ clickConnected: true }), fired));

    const hover = makeEvent();
    (listeners.onMouseOver as Handler)(hover);

    expect(fired).toEqual(['hover']);
    expect(hover.stopped).toBe(false);
    // This is the whole reason `clickBubbling` is not just `blockTouch` turned on by default:
    // blockTouch stops fifteen of the sixteen pointer events, and authors turn it back off
    // the moment the parent's Hover Start stops firing.
  });

  it('"Always" restores the pre-FH-015 bubbling for a project that relied on it', () => {
    const fired: string[] = [];
    const listeners = pointerProps(
      visualProps(makeNoodlNode({ clickConnected: true }), fired, { clickBubbling: 'always' })
    );

    const event = makeEvent();
    (listeners.onClick as Handler)(event);

    expect(fired).toEqual(['click']);
    expect(event.stopped).toBe(false);
  });

  it('"Never" blocks even where there is no Click listener at all', () => {
    const node = makeNoodlNode({ clickConnected: false });
    const listeners = pointerProps({ noodlNode: node as never, clickBubbling: 'never' });

    const event = makeEvent();
    (listeners.onClick as Handler)(event);

    expect(event.stopped).toBe(true);
  });

  it('never touches a node that has no Click port', () => {
    const fired: string[] = [];
    const node = {
      setDOMElement() {},
      hasOutput: () => false,
      getOutput() {
        throw new Error('should not be asked');
      },
      context: { updateDirtyNodes() {} }
    };

    const listeners = pointerProps({
      noodlNode: node as never,
      pointer: { onClick: () => fired.push('click') }
    });

    const event = makeEvent();
    (listeners.onClick as Handler)(event);

    expect(fired).toEqual(['click']);
    expect(event.stopped).toBe(false);
  });

  it('reads the connection at click time, not at render time', () => {
    // A connection made in the editor while the preview is running does not re-render the
    // node, so a render-time answer would be stale exactly when an author is testing wiring.
    let connected = false;
    const node = {
      setDOMElement() {},
      hasOutput: (name: string) => name === 'onClick',
      getOutput: () => ({ hasConnections: () => connected }),
      context: { updateDirtyNodes() {} }
    };

    const listeners = pointerProps({ noodlNode: node as never, pointer: { onClick: () => undefined } });

    const before = makeEvent();
    (listeners.onClick as Handler)(before);
    expect(before.stopped).toBe(false);

    connected = true;

    const after = makeEvent();
    (listeners.onClick as Handler)(after);
    expect(after.stopped).toBe(true);
  });

  it('a Button whose Click is wired keeps the click off the card behind it (criterion 1)', () => {
    const fired: string[] = [];
    const node = makeNoodlNode({ clickConnected: true });

    const element = Button({
      noodlNode: node,
      enabled: true,
      buttonType: 'button',
      useLabel: true,
      label: 'Favourite',
      onClick: () => fired.push('favourite')
    } as never) as { props: { onClick?: Handler } };

    const event = makeEvent();
    element.props.onClick(event);

    expect(fired).toEqual(['favourite']);
    expect(event.stopped).toBe(true);
  });
});

describe('FH-015 slice 2 — the port that carries the decision', () => {
  // The catalog is a serialisation of the live registries (`npm run catalog:check` asserts it
  // byte-for-byte), so this reads the ports as the editor will show them.
  const catalog = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', '..', 'noodl-types', 'src', 'node-catalog.json'), 'utf8')
  ) as { nodes: Array<{ typeName: string; inputs?: Array<Record<string, unknown>> }> };

  const withClickBubbling = catalog.nodes
    .filter((n) => (n.inputs || []).some((p) => p.name === 'clickBubbling'))
    .map((n) => n.typeName)
    .sort();

  it('every node that renders through pointerProps carries the port', () => {
    // The five visual nodes and the six modern controls, plus the six deprecated controls —
    // those render through `pointerProps` too, so the new default reaches them whether they
    // declare the port or not, and without it a project using one would have no way back.
    expect(withClickBubbling).toEqual([
      'Button',
      'Checkbox',
      'Circle',
      'Group',
      'Image',
      'Options',
      'Radio Button',
      'Range',
      'Text',
      'Text Input',
      'Video',
      'net.noodl.controls.button',
      'net.noodl.controls.checkbox',
      'net.noodl.controls.options',
      'net.noodl.controls.radiobutton',
      'net.noodl.controls.range',
      'net.noodl.controls.textinput'
    ]);
  });

  it('the default is Automatic — the correct behaviour, not the legacy one', () => {
    const defaults: unknown[] = [];
    for (const node of catalog.nodes) {
      const port = (node.inputs || []).find((p) => p.name === 'clickBubbling');
      if (port && defaults.indexOf(port.default) === -1) defaults.push(port.default);
    }
    expect(defaults).toEqual(['auto']);
  });
});
