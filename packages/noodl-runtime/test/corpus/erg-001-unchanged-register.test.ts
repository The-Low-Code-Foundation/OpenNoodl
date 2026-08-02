/**
 * ERG-001 §4 — §0.3's `Unchanged` register, where every entry is also a dead chain.
 *
 * §0.3's load-bearing column is `Unchanged`, and the reason it is worth a whole section is in
 * its "What happens today" column: **silence**. Every node here has a legitimate no-op path
 * that emitted nothing at all, so the same line is simultaneously a missing outcome and a
 * graph that stops for a state the author explicitly asked for.
 *
 * | Node | The no-op | Was |
 * |---|---|---|
 * | `Counter` | Increase at `limitsMax`, Decrease at `limitsMin` (`counter.ts:45-47`, `:59-61`) | bare `return` |
 * | `Switch` | `On` when already on, `Off` when already off (`switch.ts:35-37`, `:48-50`) | bare `return` |
 * | `Timer` | `Start` on a running timer (`timer.ts:53-55`) | bare `return` |
 * | `Undo / Redo` | the history has nowhere to go (`undonode.ts:217-221`) | **silent by design** |
 *
 * ⚠️ `Undo / Redo` is §0.3's clearest single argument for the contract, because the code said
 * so out loud. Its comment read *"`null` means the history had nowhere to go. That is an
 * ordinary end-stop, so no signal and no error"* — and then named the workaround it was forcing
 * on authors: poll `canUndo` / `canRedo` before every press, because pressing tells you nothing.
 *
 * ## ⚠️ Two things this file also pins, found while adopting the contract
 *
 * 1. **`Undo`'s `setError` deduped the *signal*, not just the string.** `if (this._internal.error
 *    === message) return;` gated `sendSignalOnOutput('failure')` too, so a second identical
 *    failure was silent — a per-node latch on a per-invocation fact, NV-iii's shape in a
 *    different node. The signal moved into `reportOutcome`; the dedupe now guards only the
 *    `Error` value output, which is what it is right for.
 * 2. **One token per queued action, not per drain.** `Undo` coalesces a frame's presses into
 *    one scheduled run. Three presses are three invocations and owe three outcomes.
 *
 * ## What reverting reddens — predicted before running
 *
 * | Revert | Reddens |
 * |---|---|
 * | Counter's limit branches back to a bare `return` | the two Counter limit rows; the below-limit controls stay green |
 * | `Switch.setStateByAction`'s `unchanged` back to `return` | the two Switch rows, not the Flip row |
 * | `Undo`'s `result === null` back to a bare `return` | the end-stop rows only |
 * | restoring the signal-side dedupe in `setError` | only the repeated-failure row |
 */

/* eslint-env jest */

import type { NodeInstance, NodeModule } from '@noodl/types';

import { createCorpusGraph, type CorpusGraph } from './graph-harness';

import CounterNode = require('../../src/nodes/std-library/counter');
import UndoNode = require('../../src/nodes/std-library/agent/undonode');
import StateHistoryNode = require('../../src/nodes/std-library/agent/statehistorynode');
import SetGlobalStoreNode = require('../../src/nodes/std-library/agent/globalstoresetnode');

import { globalStoreManager } from '../../src/nodes/std-library/agent/globalstore';
import { stateHistoryManager } from '../../src/nodes/std-library/agent/statehistory';

interface TriggerInstance extends NodeInstance {
  go(): void;
  go2(): void;
  go3(): void;
}

const TriggerModule: NodeModule = {
  node: {
    name: 'corpus.Trigger',
    category: 'Corpus',
    outputs: { go: { type: 'signal' }, go2: { type: 'signal' }, go3: { type: 'signal' } },
    methods: {
      go(this: NodeInstance) {
        this.sendSignalOnOutput('go');
      },
      go2(this: NodeInstance) {
        this.sendSignalOnOutput('go2');
      },
      go3(this: NodeInstance) {
        this.sendSignalOnOutput('go3');
      }
    }
  }
};

type Wire = { sourcePort: string; targetPort: string };

async function graphWith(type: string, parameters: Record<string, unknown>, wires: Wire[]): Promise<CorpusGraph> {
  const graph = await createCorpusGraph({
    modules: [
      TriggerModule,
      CounterNode as unknown as NodeModule,
      UndoNode as unknown as NodeModule,
      StateHistoryNode as unknown as NodeModule,
      SetGlobalStoreNode as unknown as NodeModule
    ],
    rootComponent: '/root',
    data: {
      components: [
        {
          name: '/root',
          nodes: [
            { id: 'trigger', type: 'corpus.Trigger' },
            { id: 'target', type, parameters }
          ],
          connections: wires.map((w) => ({
            sourceId: 'trigger',
            sourcePort: w.sourcePort,
            targetId: 'target',
            targetPort: w.targetPort
          }))
        }
      ]
    } as never
  });

  await graph.settle(4);
  return graph;
}

function outcomesOf(graph: CorpusGraph, id = 'target'): string[] {
  return graph.signalsFor(id).filter((s) => s === 'done' || s === 'unchanged' || s === 'failure');
}

function countOf(graph: CorpusGraph, signal: string, id = 'target'): number {
  return graph.signalsFor(id).filter((s) => s === signal).length;
}

beforeEach(() => {
  globalStoreManager.reset({ clearState: true });
  stateHistoryManager.reset();
});

// =================================================================================================
// Counter — at its limits
// =================================================================================================

describe('ERG-001 §4: Counter at its limits', () => {
  const WIRES: Wire[] = [
    { sourcePort: 'go', targetPort: 'increase' },
    { sourcePort: 'go2', targetPort: 'decrease' }
  ];
  const LIMITED = { limitsEnabled: true, limitsMin: 0, limitsMax: 1, startValue: 0 };

  test('Increase at Max reports Unchanged, where it used to report nothing', async () => {
    const graph = await graphWith('Counter', LIMITED, WIRES);

    graph.node<TriggerInstance>('trigger').go();
    await graph.settle(3);
    expect(outcomesOf(graph)).toEqual(['done']);

    // Now pinned at limitsMax. This was a bare `return`, and `Count Changed` does not fire
    // either — so "increase, then show the new total" stopped dead at the cap.
    graph.node<TriggerInstance>('trigger').go();
    await graph.settle(3);

    expect(outcomesOf(graph)).toEqual(['done', 'unchanged']);
    expect(countOf(graph, 'completed')).toBe(2);
    // Not a failure: Limits Enabled is what the author asked for, and it raises nothing.
    expect(graph.errors).toEqual([]);
  });

  test('Decrease at Min reports Unchanged too', async () => {
    const graph = await graphWith('Counter', LIMITED, WIRES);

    graph.node<TriggerInstance>('trigger').go2();
    await graph.settle(3);

    expect(outcomesOf(graph)).toEqual(['unchanged']);
    expect(graph.signalsFor('target')).toContain('completed');
  });

  test('(control) below the limit, Increase still moves the count and still fires Count Changed', async () => {
    const graph = await graphWith('Counter', LIMITED, WIRES);

    graph.node<TriggerInstance>('trigger').go();
    await graph.settle(3);

    // Without this, "Counter always says Unchanged" would satisfy both rows above.
    expect(outcomesOf(graph)).toEqual(['done']);
    expect(graph.signalsFor('target')).toContain('countChanged');
    expect(graph.node('target').getOutput('currentCount').value).toBe(1);
  });

  test('(control) with limits off, Increase never reports Unchanged', async () => {
    const graph = await graphWith('Counter', { limitsEnabled: false }, WIRES);

    for (let i = 0; i < 3; i++) {
      graph.node<TriggerInstance>('trigger').go();
      await graph.settle(3);
    }

    // The `Unchanged` must be the *limit*, not the counter having stopped working.
    expect(outcomesOf(graph)).toEqual(['done', 'done', 'done']);
  });
});

// =================================================================================================
// Undo / Redo — the register's clearest entry, because the code said so out loud
// =================================================================================================

describe('ERG-001 §4: Undo / Redo at the end of history', () => {
  /** A tracked store with `entries` writes behind it, so Undo has somewhere to go. */
  async function historyGraph(entries: number): Promise<CorpusGraph> {
    const graph = await createCorpusGraph({
      modules: [
        TriggerModule,
        UndoNode as unknown as NodeModule,
        StateHistoryNode as unknown as NodeModule,
        SetGlobalStoreNode as unknown as NodeModule
      ],
      rootComponent: '/root',
      data: {
        components: [
          {
            name: '/root',
            nodes: [
              { id: 'trigger', type: 'corpus.Trigger' },
              { id: 'history', type: 'net.noodl.StateHistory', parameters: { storeName: 'app' } },
              { id: 'target', type: 'net.noodl.StateHistory.Undo', parameters: { storeName: 'app' } }
            ],
            connections: [
              { sourceId: 'trigger', sourcePort: 'go', targetId: 'target', targetPort: 'undo' },
              { sourceId: 'trigger', sourcePort: 'go2', targetId: 'target', targetPort: 'redo' }
            ]
          }
        ]
      } as never
    });

    await graph.settle(4);
    for (let i = 0; i < entries; i++) {
      globalStoreManager.setKey('app', 'k', i + 1);
      await graph.settle(2);
    }
    return graph;
  }

  test('an Undo with somewhere to go reports Done and still fires Undone', async () => {
    const graph = await historyGraph(2);

    graph.node<TriggerInstance>('trigger').go();
    await graph.settle(4);

    expect(outcomesOf(graph)).toEqual(['done']);
    expect(graph.signalsFor('target')).toContain('undone');
    expect(graph.signalsFor('target')).toContain('completed');
  });

  test('⚠️ an Undo at the beginning reports Unchanged, where the code chose silence', async () => {
    const graph = await historyGraph(0);

    graph.node<TriggerInstance>('trigger').go();
    await graph.settle(4);

    // The comment this replaces named its own workaround: "poll `canUndo` first". An author
    // can now wire the press itself.
    expect(outcomesOf(graph)).toEqual(['unchanged']);
    expect(graph.signalsFor('target')).toContain('completed');
    expect(graph.signalsFor('target')).not.toContain('undone');
    // An end-stop is not an error.
    expect(graph.errors).toEqual([]);
  });

  test('a Redo with nothing ahead reports Unchanged as well', async () => {
    const graph = await historyGraph(2);

    graph.node<TriggerInstance>('trigger').go2();
    await graph.settle(4);

    expect(outcomesOf(graph)).toEqual(['unchanged']);
    expect(graph.signalsFor('target')).not.toContain('redone');
  });

  test('three presses in one frame are three invocations and three outcomes', async () => {
    const graph = await historyGraph(0);
    const trigger = graph.node<TriggerInstance>('trigger');

    // The node coalesces a frame's presses into one scheduled run. Coalescing the *work* is
    // right; coalescing the *outcomes* would lose two invocations the author made.
    trigger.go();
    trigger.go();
    trigger.go();
    await graph.settle(4);

    expect(outcomesOf(graph)).toEqual(['unchanged', 'unchanged', 'unchanged']);
    expect(countOf(graph, 'completed')).toBe(3);
  });

  test('⚠️ a repeated identical failure still fires, because the dedupe no longer gates the signal', async () => {
    // No State History node at all, so every press fails the same way with the same message.
    const graph = await createCorpusGraph({
      modules: [TriggerModule, UndoNode as unknown as NodeModule],
      rootComponent: '/root',
      data: {
        components: [
          {
            name: '/root',
            nodes: [
              { id: 'trigger', type: 'corpus.Trigger' },
              { id: 'target', type: 'net.noodl.StateHistory.Undo', parameters: { storeName: 'nothing-tracks-this' } }
            ],
            connections: [{ sourceId: 'trigger', sourcePort: 'go', targetId: 'target', targetPort: 'undo' }]
          }
        ]
      } as never
    });
    await graph.settle(4);

    for (let i = 0; i < 2; i++) {
      graph.node<TriggerInstance>('trigger').go();
      await graph.settle(4);
    }

    // `setError`'s "same message, return early" used to gate `sendSignalOnOutput('failure')`
    // too, so the second press was silent — a per-node latch on a per-invocation fact.
    expect(outcomesOf(graph)).toEqual(['failure', 'failure']);
    expect(countOf(graph, 'completed')).toBe(2);
  });
});
