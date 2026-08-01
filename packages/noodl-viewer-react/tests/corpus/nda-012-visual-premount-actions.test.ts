/**
 * NDA-012 (Visual) check A3 — an action that arrives before the component exists.
 *
 * Six action ports across two nodes were written as
 * `this.innerReactComponentRef && this.innerReactComponentRef.doThing()`. That reads like a
 * guard and behaves like a coin toss: the ref is assigned by React's ref callback, which
 * commits *after* the graph update that delivered the signal. A `Play` or a
 * `Scroll To Element` in the frame the node mounts hits a null ref and is dropped, with
 * nothing logged, no output, and no way for the author to tell it from a video that declined
 * to play.
 *
 * ⚠️ **The worksheet filed `Group` as an *asymmetry* and it was really a shared bug.** Its two
 * scroll actions tested the ref at different times — `Scroll To Index` inside
 * `scheduleAfterInputsHaveUpdated`, `Scroll To Element` before scheduling — so the cell read as
 * "one defers and one does not". Neither placement worked. `scheduleAfterInputsHaveUpdated`
 * defers to the end of the *graph* update, which is still before React commits, so the
 * difference between the two sites was a difference in how narrow the window was and not in
 * whether it existed. Making them agree would have closed the cell and fixed nothing.
 *
 * The fix is `withInnerComponent` on the React component node: run now if the ref is there,
 * queue and flush from the ref callback if it is not.
 *
 * ## What these rows drive, and why it is not a real mount
 *
 * The corpus harness builds a graph without React, so `innerReactComponentRef` is never
 * assigned — which is exactly the pre-mount state these rows are about. They fire the action
 * against that state, then simulate the ref callback the way `react-component-node.ts` does,
 * and assert the action arrived. A row that mounted a real component would have to *win* a
 * race to observe anything, and losing it would read as a pass.
 */

/* eslint-env jest */

import type { NodeInstance } from '@noodl/types';

import { createCorpusGraph, type CorpusGraph } from '../../../noodl-runtime/test/corpus/graph-harness';

(globalThis as unknown as { Noodl: unknown }).Noodl = { deployed: true, baseUrl: '/' };

// The Group's React component pulls in three hand-written ES-module scroll plugins that
// ts-jest does not transform (`preset: ts-jest` compiles .ts/.tsx only). Stubbed exactly as
// `nda-016-layout-sizemode.test.ts` does, so these rows run against the real node definition
// rather than a reconstruction. None of the three is involved in the ref timing under test.
jest.mock('../../src/components/visual/Group/scroll-plugins/nested-scroll-plugin', () => ({ default: class {} }));
jest.mock('../../src/components/visual/Group/scroll-plugins/patched-momentum-scroll', () => ({
  default: () => undefined
}));
jest.mock('../../src/components/visual/Group/scroll-plugins/slide-scroll-plugin', () => ({ default: class {} }));

/* eslint-disable @typescript-eslint/no-var-requires */
const VideoModule = require('../../src/nodes/visual/video').default;
const GroupModule = require('../../src/nodes/visual/group').default;
/* eslint-enable @typescript-eslint/no-var-requires */

interface DrivableNode extends NodeInstance {
  setInputValue(name: string, value: unknown): void;
  innerReactComponentRef: unknown;
  _flushPendingInnerActions(): void;
  _internal: Record<string, unknown>;
}

async function build(module: { node: { name: string } }, parameters: Record<string, unknown> = {}) {
  const graph: CorpusGraph = await createCorpusGraph({
    modules: [module as never],
    data: {
      components: [{ name: '/root', nodes: [{ id: 'under-test', type: module.node.name, parameters }] }]
    } as never
  });

  (graph.context as unknown as { styles: unknown }).styles = {
    getTextStyle: () => ({}),
    resolveColor: (c: unknown) => c
  };
  graph.update();

  return { graph, node: graph.node('under-test') as unknown as DrivableNode };
}

/**
 * A stand-in for the component React would have mounted, recording what was asked of it.
 *
 * Attached the way the wrapper's `ref` callback attaches the real one — assign, then flush —
 * because that ordering is the fix: a flush before the assignment would run every queued
 * action against a ref that is still null.
 */
function mount(node: DrivableNode): string[] {
  const calls: string[] = [];
  const inner = {
    play: () => calls.push('play'),
    restart: () => calls.push('restart'),
    pause: () => calls.push('pause'),
    reset: () => calls.push('reset'),
    setSourceObject: (v: unknown) => calls.push('setSourceObject:' + JSON.stringify(v)),
    scrollToIndex: (i: number, d: number) => calls.push(`scrollToIndex:${i}:${d}`),
    scrollToElement: (e: unknown, d: number) => calls.push(`scrollToElement:${String(e)}:${d}`)
  };
  node.innerReactComponentRef = inner;
  node._flushPendingInnerActions();
  return calls;
}

/** Fire a signal input the way a connected pulse does. */
function pulse(node: DrivableNode, name: string): void {
  node.setInputValue(name, true);
  node.setInputValue(name, false);
}

describe('A3 — Video actions fired before mount are held, not swallowed', () => {
  it.each([
    ['play', 'play'],
    ['restart', 'restart'],
    ['pause', 'pause'],
    ['reset', 'reset']
  ])('%s survives arriving before the element exists', async (port, call) => {
    const p = await build(VideoModule);
    expect(p.node.innerReactComponentRef).toBeFalsy();

    pulse(p.node, port);
    const calls = mount(p.node);

    expect(calls).toEqual([call]);
  }, 30000);

  it('all four in one frame arrive in the order they were fired', async () => {
    const p = await build(VideoModule);

    pulse(p.node, 'play');
    pulse(p.node, 'pause');
    pulse(p.node, 'restart');
    pulse(p.node, 'reset');

    // Order matters and is not incidental: `Pause` then `Play` and `Play` then `Pause` leave
    // the video in opposite states, so a queue that replayed out of order would be its own
    // defect rather than a fix.
    expect(mount(p.node)).toEqual(['play', 'pause', 'restart', 'reset']);
  }, 30000);

  it('pinned control: once mounted, an action runs immediately rather than queueing', async () => {
    const p = await build(VideoModule);
    const calls = mount(p.node);

    pulse(p.node, 'play');

    // Without this the queue could be satisfied by a node that never runs anything until the
    // *next* mount — and every row above would still pass.
    expect(calls).toEqual(['play']);
  }, 30000);

  it('the source object takes the same path, because it has no other one', async () => {
    const p = await build(VideoModule);

    p.node.setInputValue('srcObject', { src: 'a.mp4' });

    expect(mount(p.node)).toEqual(['setSourceObject:{"src":"a.mp4"}']);
  }, 30000);
});

describe('A3 — Group scroll actions, which the worksheet filed as an asymmetry', () => {
  it('Scroll To Element survives arriving before mount', async () => {
    const p = await build(GroupModule);

    p.node.setInputValue('scrollToElement.element', 'target');
    p.node.setInputValue('scrollToElement.duration', 250);
    pulse(p.node, 'scrollToElement.do');
    p.graph.update();

    expect(mount(p.node)).toEqual(['scrollToElement:target:250']);
  }, 30000);

  it('Scroll To Index survives too — the sibling that was said to be the correct one', async () => {
    const p = await build(GroupModule);

    p.node.setInputValue('scrollToIndex.index', 3);
    p.node.setInputValue('scrollToIndex.duration', 100);
    pulse(p.node, 'scrollToIndex.do');
    p.graph.update();

    // This is the row that shows the cell's diagnosis was incomplete. `Scroll To Index` already
    // checked the ref *inside* `scheduleAfterInputsHaveUpdated`, which the worksheet read as the
    // careful version — and it dropped the action just the same, because the graph update ends
    // before React commits.
    expect(mount(p.node)).toEqual(['scrollToIndex:3:100']);
  }, 30000);

  it('pinned control: the scheduling is kept, so Index still lands before the Do that reads it', async () => {
    const p = await build(GroupModule);
    const calls = mount(p.node);

    // `Do` fired first, `Index` second, same frame — which is the ordering
    // `scheduleAfterInputsHaveUpdated` exists to survive. Removing it while fixing the ref
    // guard would pass every row above and break this one.
    pulse(p.node, 'scrollToIndex.do');
    p.node.setInputValue('scrollToIndex.index', 7);
    p.node.setInputValue('scrollToIndex.duration', 50);
    p.graph.update();

    expect(calls).toEqual(['scrollToIndex:7:50']);
  }, 30000);
});

describe('A3 — the queue does not become a leak', () => {
  it('an unmounted node holds a bounded number of actions', async () => {
    const p = await build(VideoModule);

    for (let i = 0; i < 40; i++) pulse(p.node, 'play');

    // Capped at 16, oldest dropped. A held button against a node that never mounts must not
    // grow without limit, and replaying forty queued `Play`s at mount would be a defect of its
    // own rather than a fix.
    expect(mount(p.node)).toHaveLength(16);
  }, 30000);
});
