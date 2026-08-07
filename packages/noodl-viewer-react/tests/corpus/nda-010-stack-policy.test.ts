/**
 * NDA-010 §3 — the popup stack policy (success criterion 1, and F2's real home).
 *
 * There was no policy. `scheduleShow` coalesces repeated `Show` pulses *within one node*
 * (`showpopup.ts`) and that was the whole of it; two Show Popup nodes pulsed in the same
 * frame — a button and a keyboard shortcut, say — each reached `NodeContext.showPopup` and
 * the user got two identical dialogs stacked, each with its own close callback.
 *
 * **NDA-001's F2 row looked for the fix in the wrong place**, and its stub of
 * `context.showPopup` is why: it asserted that the second *call* never happens. It has to.
 * Neither node can know about the other — the only thing that can is the context they share,
 * which is where the policy now lives. F2 is reconciled in `nda-001-popup-stacking.test.ts`
 * and the outcome it was really after is asserted here, against the real `showPopup`.
 *
 * Settled: **one modal slot by default** (`Replace It`), with `Show On Top` as an explicit
 * per-node opt-in for the layering that is deliberate.
 */

/* eslint-env jest */

import type { NodeInstance, NodeModule } from '@noodl/types';

import { createCorpusGraph, type CorpusGraph } from '../../../noodl-runtime/test/corpus/graph-harness';

import ShowPopupModule from '../../src/nodes/navigation/showpopup';

import { GroupModule } from './visual-container';

/** See the note in `nda-010-close-popup-targeting.test.ts`: `showPopup` uses rAF. */
const realRequestAnimationFrame = (globalThis as Record<string, unknown>).requestAnimationFrame;

beforeAll(() => {
  (globalThis as Record<string, unknown>).requestAnimationFrame = (callback: (time: number) => void) =>
    setTimeout(() => callback(0), 0) as unknown as number;
});

afterAll(() => {
  (globalThis as Record<string, unknown>).requestAnimationFrame = realRequestAnimationFrame;
});

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
  /** Every group the viewer was asked to show, in order. */
  shown: Array<{ id: string }>;
  /** Every group the viewer was asked to close, in order. */
  closed: Array<{ id: string }>;
}

/**
 * `policies.length` Show Popup nodes, all aimed at `/Dialog`, all wired to one trigger.
 *
 * One trigger and one `fire()` is the reported situation exactly: the nodes are pulsed in the
 * same frame, so neither has any opportunity to observe the other's popup.
 */
async function popupGraph(policies: Array<'replace' | 'stack' | undefined>): Promise<PopupGraph> {
  const ids = policies.map((_, index) => 'popup' + (index + 1));

  const graph = await createCorpusGraph({
    modules: [GroupModule, ShowPopupModule as unknown as NodeModule, TriggerModule],
    rootComponent: '/root',
    data: {
      components: [
        {
          name: '/root',
          nodes: [
            {
              id: 'root-group',
              type: 'Group',
              children: [
                { id: 'trigger', type: 'corpus.Trigger' },
                ...ids.map((id, index) => ({
                  id,
                  type: 'NavigationShowPopup',
                  parameters: {
                    target: '/Dialog',
                    ...(policies[index] === undefined ? {} : { stackPolicy: policies[index] })
                  }
                }))
              ]
            }
          ],
          connections: ids.map((id) => ({
            sourceId: 'trigger',
            sourcePort: 'go',
            targetId: id,
            targetPort: 'show'
          }))
        },
        { name: '/Dialog', nodes: [{ id: 'dialog-group', type: 'Group' }] }
      ]
    } as never
  });

  const shown: Array<{ id: string }> = [];
  const closed: Array<{ id: string }> = [];

  graph.context.setPopupCallbacks({
    onShow: (group: { id: string }) => shown.push(group),
    onClose: (group: { id: string }) => closed.push(group)
  });

  await graph.settle(3);
  return { graph, shown, closed };
}

/** Drive enough frames for `scheduleNextFrame` teardowns and the rAF attachment to run. */
async function popupFrames(graph: CorpusGraph): Promise<void> {
  for (let i = 0; i < 4; i++) {
    graph.frame();
    await graph.settle(2);
  }
}

describe('NDA-010 §3: one modal slot by default', () => {
  test('S1: two Show Popup nodes firing in the same frame produce one popup', async () => {
    const { graph, shown } = await popupGraph([undefined, undefined]);

    graph.node<TriggerInstance>('trigger').fire();
    await popupFrames(graph);

    // Before the policy: two. Both nodes still call `showPopup` — they must, neither can see
    // the other — and the context resolves the pair to a single open popup.
    expect(shown).toHaveLength(1);
  });

  test('S2: the superseded popup reports Dismissed, and does not report Closed', async () => {
    const { graph } = await popupGraph([undefined, undefined]);

    graph.node<TriggerInstance>('trigger').fire();
    await popupFrames(graph);

    // `Closed` is where an author puts the save-or-commit work. This popup was replaced
    // before it was ever drawn, so running that branch would commit an interaction that did
    // not happen — which is why the implicit path is a separate signal.
    expect(graph.node('popup1').hasOutput('Dismissed')).toBe(true);
    expect(graph.signalsFor('popup1')).toContain('Dismissed');
    expect(graph.signalsFor('popup1')).not.toContain('Closed');

    // The one that won says nothing: it is still open.
    expect(graph.signalsFor('popup2')).not.toContain('Dismissed');
  });

  test('S3: a popup already on screen is closed, not left behind, when another replaces it', async () => {
    const { graph, shown, closed } = await popupGraph([undefined, undefined]);

    // Separate frames this time, so the first popup genuinely reaches the viewer before the
    // second one asks for the slot. This is the path where a group actually exists to close.
    graph.node('popup1').setInputValue('show', true);
    await popupFrames(graph);
    expect(shown).toHaveLength(1);

    graph.node('popup2').setInputValue('show', true);
    await popupFrames(graph);

    expect(shown).toHaveLength(2);
    expect(closed).toHaveLength(1);
    expect(closed[0].id).toBe(shown[0].id);
    expect(graph.signalsFor('popup1')).toContain('Dismissed');
  });
});

describe('NDA-010 §3: stacking is available, but opted into', () => {
  test('S4: Show On Top layers a popup over the open one', async () => {
    const { graph, shown, closed } = await popupGraph([undefined, 'stack']);

    graph.node<TriggerInstance>('trigger').fire();
    await popupFrames(graph);

    // The confirmation-over-an-editor case. Both are open, and neither was dismissed.
    expect(shown).toHaveLength(2);
    expect(closed).toHaveLength(0);
    expect(graph.signalsFor('popup1')).not.toContain('Dismissed');
  });

  test('S5 (control): one node pulsed twice in a frame still shows once, and is not dismissed', async () => {
    // The within-one-node coalescing that already existed must survive the policy — and the
    // policy must not turn a node's own second pulse into a self-replacement, which would
    // show one popup and fire `Dismissed` alongside it.
    const { graph, shown, closed } = await popupGraph([undefined]);

    const popup = graph.node('popup1');
    popup.setInputValue('show', false);
    popup.setInputValue('show', true);
    popup.setInputValue('show', false);
    popup.setInputValue('show', true);
    await popupFrames(graph);

    expect(shown).toHaveLength(1);
    expect(closed).toHaveLength(0);
    expect(graph.signalsFor('popup1')).not.toContain('Dismissed');
  });
});
