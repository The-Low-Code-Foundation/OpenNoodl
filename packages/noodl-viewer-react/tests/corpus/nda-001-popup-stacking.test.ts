/**
 * NDA-001 corpus — failure-reporting row F2.
 *
 * `scheduleShow` coalesces repeated `Show` pulses *within one node* (`showpopup.ts:63-73`),
 * and that is all the de-duplication there is. Two Show Popup nodes pulsed in the same frame
 * — one wired to a button, one to a keyboard shortcut, say — each call `context.showPopup`
 * and the app ends up with two stacked popups over each other. There is no "already showing"
 * guard and no stack policy anywhere.
 *
 * **Proxy, deliberately.** The row says "two stacked popups"; the test observes two
 * `context.showPopup` calls. That is the boundary the node owns — everything past it belongs
 * to `PopupManager` and a real DOM — and it is the exact call whose second occurrence is the
 * defect. Recorded as a limitation in the corpus README.
 */

/* eslint-env jest */

// `test.failing`, declared for the @types/jest this monorepo resolves. See the module.
import '../../../noodl-runtime/test/corpus/expected-failure';

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
  test.failing('F2: two Show Popup nodes in one frame produce one popup, or a defined stack policy', async () => {
    const { graph, shown } = await popupGraph(2);

    graph.node<TriggerInstance>('trigger').fire();
    graph.frame();

    // Today: `['/Dialog', '/Dialog']`. Both nodes show, neither knows about the other, and
    // the user gets two identical dialogs stacked — with two Close Popup targets that each
    // resolve through a different injected callback.
    expect(shown).toEqual(['/Dialog']);
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
