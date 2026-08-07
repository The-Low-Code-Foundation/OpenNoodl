/**
 * NDA-004 §2, register ⏳ item 3 — Show Popup, sequenced after NDA-010 §3 as the register asked.
 *
 * Every outcome this node had was a *later* one: `Closed`, `Dismissed`, and whatever close
 * actions the target component declares. So a popup that never opened at all was
 * indistinguishable from one the user simply had not finished with — the graph sat waiting for a
 * `Closed` that could not arrive.
 *
 * Two ways it never opened, and the second is a crash rather than a silence.
 *
 * **No Target.** `if (this._internal.target == undefined) return;` — a bare return on the
 * likeliest authoring mistake.
 *
 * **A Target that is not a component.** `NodeContext.showPopup` is `async` and awaits
 * `nodeScope.createNode(popupComponent)`, which for an unregistered name reaches
 * `getComponentModel` and **throws** `Can't find component model for …`. The node dropped the
 * returned promise, so that became an **unhandled promise rejection** — not even
 * `nodecontext.ts`'s blanket catch, which only wraps `update()`. A Show Popup pointed at a
 * deleted or renamed component therefore produced no popup, no signal, and a rejection in a log
 * nobody reads.
 *
 * The report is attached at the node rather than raised inside `showPopup`, which is NDA-008 §3's
 * decision for the Component Stack applied again: the popup layer did not fail, the node that
 * asked it to act did, and that node owns the port and the provenance. Catching the promise also
 * covers a bundle that cannot be fetched, for free, because that rejects through the same one.
 *
 * ## Known residual
 *
 * `showPopup` opens with `if (!this.onShowPopup) return;` — a runtime with no popup host (an SSR
 * render, a cloud function) resolves *successfully* having done nothing. Distinguishing that
 * needs a change in `nodecontext.ts`, which is another workstream's file this session, so it is
 * recorded rather than reached for.
 */

/* eslint-env jest */

import type { NodeInstance, NodeModule } from '@noodl/types';

import { createCorpusGraph, type CorpusGraph } from '../../../noodl-runtime/test/corpus/graph-harness';

import ShowPopupModule from '../../src/nodes/navigation/showpopup';

interface TriggerInstance extends NodeInstance {
  go(): void;
}

const TriggerModule: NodeModule = {
  node: {
    name: 'corpus.Trigger',
    category: 'Corpus',
    outputs: { go: { type: 'signal' } },
    methods: {
      go(this: NodeInstance) {
        this.sendSignalOnOutput('go');
      }
    }
  }
};

async function popupGraph(parameters: Record<string, unknown>): Promise<CorpusGraph> {
  const graph = await createCorpusGraph({
    modules: [TriggerModule, ShowPopupModule as unknown as NodeModule],
    data: {
      components: [
        {
          name: '/root',
          nodes: [
            { id: 'trigger', type: 'corpus.Trigger' },
            { id: 'popup', type: 'NavigationShowPopup', parameters }
          ],
          connections: [{ sourceId: 'trigger', sourcePort: 'go', targetId: 'popup', targetPort: 'show' }]
        }
      ]
    } as never
  });
  await graph.settle(2);
  // `signalsFor` on an id that does not exist returns `[]`, so a node that failed to construct
  // would make the "raises nothing" controls pass vacuously.
  expect(() => graph.node('popup')).not.toThrow();
  return graph;
}

/** What the viewer installs. Without it `showPopup` returns before doing anything at all. */
function installPopupHost(graph: CorpusGraph): void {
  graph.context.onShowPopup = () => {
    /* the viewer mounts the group; nothing here draws */
  };
  graph.context.onClosePopup = () => {
    /* symmetry */
  };
}

describe('NDA-004 §2: Show Popup', () => {
  test('a Show with no Target fires Failure instead of returning quietly', async () => {
    const graph = await popupGraph({});
    graph.node<TriggerInstance>('trigger').go();
    await graph.settle(3);

    expect(graph.signalsFor('popup')).toContain('failure');
    expect(graph.signalsFor('popup')).not.toContain('Closed');

    const raised = graph.errors.filter((e) => e.code === 'show-popup/no-target');
    expect(raised).toHaveLength(1);
    expect(graph.node('popup').getOutput('error').value).toMatch(/Target component/);
  });

  test('a Target that is not a component reports, rather than rejecting into nothing', async () => {
    const graph = await popupGraph({ target: '/NoSuchPopup' });
    installPopupHost(graph);

    graph.node<TriggerInstance>('trigger').go();
    await graph.settle(4);

    expect(graph.signalsFor('popup')).toContain('failure');

    // The structure of the report is the claim. "It did not crash" would not do: an unhandled
    // rejection does not fail a jest run either, which is exactly how this survived — the code
    // and the component name are what did not exist before.
    const raised = graph.errors.filter((e) => e.code === 'show-popup/target-failed');
    expect(raised).toHaveLength(1);
    expect(raised[0].message).toContain('/NoSuchPopup');
    expect(graph.node('popup').getOutput('error').value).toContain('/NoSuchPopup');
  });

  // ✅ Pinned control. The trigger is an author `Do`, so nothing may fire before it is pressed —
  // including on a node with no Target at all, which is how every Show Popup starts life.
  test('(pinned control) booting with no Target raises nothing on its own', async () => {
    const graph = await popupGraph({});
    await graph.settle(4);

    expect(graph.signalsFor('popup')).toEqual([]);
    expect(graph.errors).toEqual([]);
  });

  /**
   * `signalsFor` records a port name *before* delegating, and `sendSignalOnOutput` on a name the
   * node lacks only logs — so deleting the `failure` output leaves the rows above green.
   */
  test('the ports exist on the node, not just in the signal log', async () => {
    const graph = await popupGraph({ target: '/Whatever' });
    const node = graph.node('popup');

    expect(node.hasOutput('Closed')).toBe(true);
    expect(node.hasOutput('Dismissed')).toBe(true);
    expect(node.hasOutput('failure')).toBe(true);
    expect(node.hasOutput('error')).toBe(true);
  });
});
