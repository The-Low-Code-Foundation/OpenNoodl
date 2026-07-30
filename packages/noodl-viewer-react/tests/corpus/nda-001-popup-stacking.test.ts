/**
 * NDA-001 corpus — failure-reporting row F2.
 *
 * **F2 was looking in the wrong place, and NDA-010 §3 reconciled it.** The row asserted that
 * two Show Popup nodes pulsed in the same frame make a single `context.showPopup` call. They
 * cannot, and should not: neither node can see the other, so no guard either one could carry
 * would help. The only thing that can arbitrate is the context they share, which is where the
 * policy now lives — `NodeContext.showPopup` claims a modal slot synchronously and replaces
 * whatever held it.
 *
 * The stub below is what hid that: it replaces the very function the fix belongs in, so this
 * file can only ever see the node's half. What survives here is the node's half, which is
 * real and had to keep working. The outcome F2 was after — one popup on screen, and the
 * superseded one told about it — is asserted against the real `showPopup` in
 * `nda-010-stack-policy.test.ts`.
 *
 * Generalisable: **a proxy that stubs the boundary cannot test a fix that lands on the other
 * side of it**, and a row written before anyone knew which side that was will point away from
 * the fix rather than at it.
 */

/* eslint-env jest */

import type { NodeInstance, NodeModule } from '@noodl/types';

import { createCorpusGraph, type CorpusGraph } from '../../../noodl-runtime/test/corpus/graph-harness';

import ShowPopupModule from '../../src/nodes/navigation/showpopup';

interface TriggerInstance extends NodeInstance {
  fire(): void;
}

const TriggerModule: NodeModule = {
  node: {
    name: 'corpus.Trigger',
    category: 'Corpus',
    outputs: { go: { type: 'signal' } },
    methods: {
      fire(this: NodeInstance) {
        this.sendSignalOnOutput('go');
      }
    }
  }
};

interface PopupGraph {
  graph: CorpusGraph;
  /** The target of every `context.showPopup` call, in order. */
  shown: string[];
}

/** `popupCount` Show Popup nodes, all wired to one trigger, all aimed at `/Dialog`. */
async function popupGraph(popupCount: number): Promise<PopupGraph> {
  const ids = Array.from({ length: popupCount }, (_, index) => 'popup' + (index + 1));

  const graph = await createCorpusGraph({
    modules: [ShowPopupModule as unknown as NodeModule, TriggerModule],
    data: {
      components: [
        {
          name: '/root',
          nodes: [
            { id: 'trigger', type: 'corpus.Trigger' },
            ...ids.map((id) => ({ id, type: 'NavigationShowPopup', parameters: { target: '/Dialog' } }))
          ],
          connections: ids.map((id) => ({
            sourceId: 'trigger',
            sourcePort: 'go',
            targetId: id,
            targetPort: 'show'
          }))
        }
      ]
    } as never
  });

  const shown: string[] = [];
  // The viewer's runtime supplies this; a corpus graph does not have a PopupManager, so the
  // boundary is stubbed and watched.
  (graph.context as unknown as { showPopup(target: string): void }).showPopup = (target: string) => {
    shown.push(target);
  };

  graph.frame();
  return { graph, shown };
}

describe('NDA-001 F2: two Show Popup nodes firing in the same frame', () => {
  // ✅ Reconciled (NDA-010 §3). Both nodes reach the context — that is not the defect and
  // could not be fixed here — and the context resolves the pair to one popup. Pinned because
  // a "fix" that made a Show Popup node drop its request rather than make it would satisfy
  // the row as originally written while breaking the deliberate `Show On Top` case.
  test('F2: both nodes ask; arbitrating between them is the context’s job', async () => {
    const { graph, shown } = await popupGraph(2);

    graph.node<TriggerInstance>('trigger').fire();
    graph.frame();

    expect(shown).toEqual(['/Dialog', '/Dialog']);
  });

  // ✅ Pinned: the within-one-node coalescing that *does* exist must survive whatever
  // NDA-010 does about the cross-node case.
  test('F2 (pinned): one Show Popup node pulsed twice in a frame shows once', async () => {
    const { graph, shown } = await popupGraph(1);

    const popup = graph.node('popup1');
    popup.setInputValue('show', false);
    popup.setInputValue('show', true);
    popup.setInputValue('show', false);
    popup.setInputValue('show', true);
    graph.frame();

    expect(shown).toEqual(['/Dialog']);
  });
});
