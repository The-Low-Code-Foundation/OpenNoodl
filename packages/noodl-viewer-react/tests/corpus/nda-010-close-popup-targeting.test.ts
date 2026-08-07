/**
 * NDA-010 §2 — "a Close Popup node placed anywhere in the popup's component tree works, or
 * says why it does not" (success criterion 2).
 *
 * The reported defect: *"very hard to find the right place to put the close popup node so that
 * it actually works"*. It was not a knack. `NodeContext.showPopup` handed its close callback
 * to `getNodesWithType('NavigationClosePopup')` on the popup's **own top-level scope** and
 * nowhere else, so a Close Popup node one component deeper was never given one — and, before
 * NDA-004, said nothing about it either. Whether the node worked was a property of which
 * scope the author happened to drop it in.
 *
 * These rows pin the two halves of the fix: the nested node now resolves its popup by walking
 * up (`componentwalk.ts`), and a node with no popup above it fails loudly instead of silently.
 */

/* eslint-env jest */

import type { ComponentInstanceLike, NodeInstance, NodeModule } from '@noodl/types';

import { createCorpusGraph, type CorpusGraph } from '../../../noodl-runtime/test/corpus/graph-harness';

import ClosePopupModule from '../../src/nodes/navigation/closepopup';

import { GroupModule } from './visual-container';

/**
 * `showPopup` attaches the popup to its wrapper group inside a `requestAnimationFrame`, and
 * these suites run under `testEnvironment: node` where there is no such global.
 *
 * That attachment is not incidental here — it is what gives the popup a visual parent, which
 * is what the upward walk climbs. Deferring to a macrotask rather than calling straight
 * through keeps the ordering the browser has, and `settle` already drains a `setTimeout(0)`
 * between frames.
 */
const realRequestAnimationFrame = (globalThis as Record<string, unknown>).requestAnimationFrame;

beforeAll(() => {
  (globalThis as Record<string, unknown>).requestAnimationFrame = (callback: (time: number) => void) =>
    setTimeout(() => callback(0), 0) as unknown as number;
});

afterAll(() => {
  (globalThis as Record<string, unknown>).requestAnimationFrame = realRequestAnimationFrame;
});

interface ClosePopupInstance extends NodeInstance {
  close(): void;
}

/**
 * A popup whose Close Popup node sits `depth` components below the popup's own scope.
 *
 * `depth: 0` is the case that always worked — the node is directly in the popup component.
 * `depth: 1` is the reported defect: one component deeper, and `showPopup` never reached it.
 */
async function popupGraph(options: { depth: 0 | 1; target?: string }): Promise<CorpusGraph> {
  const closeNode = {
    id: 'closer',
    type: 'NavigationClosePopup',
    parameters: options.target ? { targetComponent: options.target } : {}
  };

  const components: unknown[] = [
    { name: '/root', nodes: [{ id: 'root-group', type: 'Group' }] },
    {
      name: '/Dialog',
      nodes: [
        {
          id: 'dialog-group',
          type: 'Group',
          children: options.depth === 0 ? [closeNode] : [{ id: 'footer-instance', type: '/DialogFooter' }]
        }
      ]
    }
  ];

  if (options.depth === 1) {
    components.push({
      name: '/DialogFooter',
      nodes: [{ id: 'footer-group', type: 'Group', children: [closeNode] }]
    });
  }

  const graph = await createCorpusGraph({
    modules: [GroupModule, ClosePopupModule as unknown as NodeModule],
    rootComponent: '/root',
    data: { components } as never
  });

  await graph.settle(3);
  return graph;
}

/**
 * Let a requested close actually happen.
 *
 * `showPopup`'s handler defers the teardown with `scheduleNextFrame` — "close next frame so
 * all nodes have a chance to update before being deleted" — which is a `frameStart` listener.
 * `settle` alone never emits one, so a close would look like a node that did nothing.
 */
async function closeFrames(graph: CorpusGraph): Promise<void> {
  for (let i = 0; i < 3; i++) {
    graph.frame();
    await graph.settle(1);
  }
}

/** Open `/Dialog` as a popup the way the viewer does, and report whether it got closed. */
async function showDialog(graph: CorpusGraph): Promise<{ closed: () => boolean }> {
  let shownGroup: { id: string } | undefined;
  let closedGroup: { id: string } | undefined;

  graph.context.setPopupCallbacks({
    onShow: (group: { id: string }) => {
      shownGroup = group;
    },
    onClose: (group: { id: string }) => {
      closedGroup = group;
    }
  });

  await graph.context.showPopup('/Dialog', {});
  await graph.settle(3);

  return { closed: () => !!closedGroup && !!shownGroup && closedGroup.id === shownGroup.id };
}

describe('NDA-010 §2: Close Popup finds the popup it is inside', () => {
  test('a Close Popup node in the popup component closes it (pinned control)', async () => {
    // The case that already worked. Without it, the row below could not tell "the fix works"
    // apart from "the harness never opened a popup at all".
    const graph = await popupGraph({ depth: 0 });
    const popup = await showDialog(graph);

    // ⚠️ Driven through the `Close` port rather than by calling `close()` directly.
    // ERG-001 §4 made the port the only thing that opens an invocation, so a bare method
    // call is a route no author has — and reports nothing, by design.
    graph.node('closer').setInputValue('close', true);
    await closeFrames(graph);

    expect(popup.closed()).toBe(true);
    expect(graph.signalsFor('closer')).toEqual(['done', 'completed']);
  });

  test('a Close Popup node one component deeper closes it too', async () => {
    // The reported defect. `showPopup` never handed this node a callback, so before the fix
    // it took the failure branch and the popup stayed open.
    const graph = await popupGraph({ depth: 1 });
    const popup = await showDialog(graph);

    // ⚠️ Driven through the `Close` port rather than by calling `close()` directly.
    // ERG-001 §4 made the port the only thing that opens an invocation, so a bare method
    // call is a route no author has — and reports nothing, by design.
    graph.node('closer').setInputValue('close', true);
    await closeFrames(graph);

    expect(popup.closed()).toBe(true);
    expect(graph.signalsFor('closer')).toEqual(['done', 'completed']);
    expect(graph.signalsFor('closer')).not.toContain('failure');
  });

  test('the node card says which popup it will close', async () => {
    // BINDING-CONTRACT §(b), for the nested case where the answer is least obvious.
    const graph = await popupGraph({ depth: 1 });
    await showDialog(graph);

    expect(graph.editorConnection.subLabels['closer']).toBe('→ /Dialog');
  });
});

describe('NDA-010 §2: and says so when it cannot', () => {
  test('outside any popup it fails loudly instead of doing nothing', async () => {
    // The node has to be *mounted* to fail: a Close Popup node inside a component nobody
    // instantiated does not exist at runtime at all. So this one sits in the root tree,
    // which is exactly where an author puts it by mistake.
    const graph = await createCorpusGraph({
      modules: [GroupModule, ClosePopupModule as unknown as NodeModule],
      rootComponent: '/root',
      data: {
        components: [
          {
            name: '/root',
            nodes: [{ id: 'root-group', type: 'Group', children: [{ id: 'closer', type: 'NavigationClosePopup' }] }]
          }
        ]
      } as never
    });
    await graph.settle(3);

    // ⚠️ Driven through the `Close` port rather than by calling `close()` directly.
    // ERG-001 §4 made the port the only thing that opens an invocation, so a bare method
    // call is a route no author has — and reports nothing, by design.
    graph.node('closer').setInputValue('close', true);
    await closeFrames(graph);

    expect(graph.signalsFor('closer')).toEqual(['failure', 'completed']);
    expect(graph.errors.map((e) => e.code)).toContain('close-popup/no-popup-in-scope');
  });

  test('an explicit target that is not above it fails rather than closing something else', async () => {
    const graph = await popupGraph({ depth: 1, target: '/SomeOtherDialog' });
    const popup = await showDialog(graph);

    // ⚠️ Driven through the `Close` port rather than by calling `close()` directly.
    // ERG-001 §4 made the port the only thing that opens an invocation, so a bare method
    // call is a route no author has — and reports nothing, by design.
    graph.node('closer').setInputValue('close', true);
    await closeFrames(graph);

    // Closing the enclosing popup here would be worse than closing nothing: the author would
    // watch a popup shut and believe the target had been honoured (BINDING-CONTRACT §(a)).
    expect(popup.closed()).toBe(false);
    expect(graph.errors.map((e) => e.code)).toContain('close-popup/target-not-found');
  });

  test('an explicit target naming the enclosing popup closes it', async () => {
    const graph = await popupGraph({ depth: 1, target: '/Dialog' });
    const popup = await showDialog(graph);

    // ⚠️ Driven through the `Close` port rather than by calling `close()` directly.
    // ERG-001 §4 made the port the only thing that opens an invocation, so a bare method
    // call is a route no author has — and reports nothing, by design.
    graph.node('closer').setInputValue('close', true);
    await closeFrames(graph);

    expect(popup.closed()).toBe(true);
  });
});

describe('NDA-010 §2: showPopup publishes the handler on the popup instance', () => {
  test('the popup component instance carries a close handler', async () => {
    // The seam the walk depends on. Asserted directly so that a future change to `showPopup`
    // which stops publishing it fails here, naming the cause, rather than only showing up as
    // a nested Close Popup mysteriously going quiet again.
    const graph = await popupGraph({ depth: 1 });
    await showDialog(graph);

    const closer = graph.node<ClosePopupInstance>('closer');
    let component: ComponentInstanceLike | undefined = closer.nodeScope.componentOwner;
    let found = false;
    while (component && !found) {
      if (typeof component._popupCloseHandler === 'function') found = true;
      component = component.parentNodeScope ? component.parentNodeScope.componentOwner : undefined;
    }

    expect(found).toBe(true);
  });
});
