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
